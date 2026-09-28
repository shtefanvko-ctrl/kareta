<?php
declare(strict_types=1);
return [
 'version'=>81,
 'note'=>'R186.5 stage 12: CRM cards unified by Person with multiple profiles',
 'run'=>static function(PDO $pdo):void {
  $columnExists=static function(string $table,string $column)use($pdo):bool{$s=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$s->execute([$table,$column]);return (int)$s->fetchColumn()>0;};
  $indexExists=static function(string $table,string $index)use($pdo):bool{$s=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?");$s->execute([$table,$index]);return (int)$s->fetchColumn()>0;};
  if(!$columnExists('crm_customer_profiles','account_id'))$pdo->exec("ALTER TABLE crm_customer_profiles ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER user_id");
  if(!$columnExists('crm_customer_profiles','person_id'))$pdo->exec("ALTER TABLE crm_customer_profiles ADD COLUMN person_id BIGINT UNSIGNED NULL AFTER account_id");
  if(!$columnExists('crm_customer_profiles','profiles_json'))$pdo->exec("ALTER TABLE crm_customer_profiles ADD COLUMN profiles_json JSON NULL AFTER phone");
  if(!$indexExists('crm_customer_profiles','idx_crm_person'))$pdo->exec("ALTER TABLE crm_customer_profiles ADD KEY idx_crm_person(person_id)");
  if(!$indexExists('crm_customer_profiles','idx_crm_account'))$pdo->exec("ALTER TABLE crm_customer_profiles ADD KEY idx_crm_account(account_id)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS identity_crm_person_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    person_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    legacy_user_id BIGINT UNSIGNED NOT NULL,
    source_role VARCHAR(48) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_identity_crm_legacy_user(legacy_user_id),
    KEY idx_identity_crm_person(person_id),
    CONSTRAINT fk_identity_crm_person FOREIGN KEY(person_id) REFERENCES persons(id) ON DELETE CASCADE,
    CONSTRAINT fk_identity_crm_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("INSERT INTO identity_crm_person_links(person_id,account_id,legacy_user_id,source_role)
    SELECT p.id,a.id,u.id,u.role FROM accounts a JOIN persons p ON p.account_id=a.id JOIN users u ON u.phone=a.phone
    ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),account_id=VALUES(account_id),source_role=VALUES(source_role)");
  $pdo->exec("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,legacy_entity_id,payload_json)
    SELECT DISTINCT l.person_id,'client','active','user',CAST(l.legacy_user_id AS CHAR),JSON_OBJECT('source','stage12')
    FROM identity_crm_person_links l
    ON DUPLICATE KEY UPDATE status=IF(status='archived','active',status),updated_at=CURRENT_TIMESTAMP");
  $pdo->exec("INSERT INTO crm_customer_profiles(customer_key,user_id,account_id,person_id,client_id,display_name,phone,profiles_json,status,segment,orders_count,completed_count,total_spent,last_visit_at,payload_json)
    SELECT CONCAT('person:',p.id),MIN(l.legacy_user_id),a.id,p.id,MIN(c.id),
      COALESCE(NULLIF(p.fullname,''),MAX(NULLIF(u.name,'')),a.phone,CONCAT('Клиент ',p.id)),a.phone,
      (SELECT JSON_ARRAYAGG(pp.profile_type) FROM person_profiles pp WHERE pp.person_id=p.id AND pp.status='active'),
      'active','new',
      (SELECT COUNT(*) FROM orders o JOIN identity_crm_person_links ol ON ol.legacy_user_id=o.client_user_id WHERE ol.person_id=p.id),
      (SELECT COUNT(*) FROM orders o JOIN identity_crm_person_links ol ON ol.legacy_user_id=o.client_user_id WHERE ol.person_id=p.id AND o.status IN ('done','completed','closed')),
      COALESCE((SELECT SUM(o.price) FROM orders o JOIN identity_crm_person_links ol ON ol.legacy_user_id=o.client_user_id WHERE ol.person_id=p.id AND o.status IN ('done','completed','closed')),0),
      (SELECT MAX(COALESCE(o.completed_at,o.created_at)) FROM orders o JOIN identity_crm_person_links ol ON ol.legacy_user_id=o.client_user_id WHERE ol.person_id=p.id),
      JSON_OBJECT('schemaVersion',2,'source','identity_person')
    FROM persons p JOIN accounts a ON a.id=p.account_id JOIN identity_crm_person_links l ON l.person_id=p.id JOIN users u ON u.id=l.legacy_user_id LEFT JOIN clients c ON c.user_id=u.id
    GROUP BY p.id,a.id,a.phone,p.fullname
    ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),display_name=VALUES(display_name),phone=VALUES(phone),profiles_json=VALUES(profiles_json),orders_count=VALUES(orders_count),completed_count=VALUES(completed_count),total_spent=VALUES(total_spent),last_visit_at=VALUES(last_visit_at),payload_json=VALUES(payload_json)");
  $pdo->exec("UPDATE crm_customer_profiles SET segment=CASE WHEN total_spent>=500000 OR orders_count>=10 THEN 'vip' WHEN orders_count>=3 THEN 'returning' WHEN orders_count=0 THEN 'lead' ELSE 'new' END WHERE person_id IS NOT NULL");
  $pdo->exec("UPDATE crm_notes n JOIN identity_crm_person_links l ON n.customer_key=CONCAT('user:',l.legacy_user_id) SET n.customer_key=CONCAT('person:',l.person_id)");
 }
];
