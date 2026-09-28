<?php
return [
 'version'=>70,
 'note'=>'CRM customer profiles, notes, segments and analytics indexes',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS crm_customer_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_key VARCHAR(80) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    client_id VARCHAR(64) NULL,
    organization_id VARCHAR(64) NULL,
    display_name VARCHAR(191) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    segment VARCHAR(32) NOT NULL DEFAULT 'new',
    orders_count INT UNSIGNED NOT NULL DEFAULT 0,
    completed_count INT UNSIGNED NOT NULL DEFAULT 0,
    total_spent DECIMAL(14,2) NOT NULL DEFAULT 0,
    last_visit_at DATETIME NULL,
    next_followup_at DATETIME NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_crm_customer_key(customer_key),
    KEY idx_crm_org_segment(organization_id,segment,status),
    KEY idx_crm_user(user_id),
    KEY idx_crm_phone(phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS crm_notes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    note_key VARCHAR(80) NOT NULL,
    customer_key VARCHAR(80) NOT NULL,
    author_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    note_type VARCHAR(24) NOT NULL DEFAULT 'note',
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_crm_note_key(note_key),
    KEY idx_crm_notes_customer(customer_key,created_at),
    KEY idx_crm_notes_org(organization_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("INSERT INTO crm_customer_profiles(customer_key,user_id,client_id,display_name,phone,orders_count,total_spent,last_visit_at,payload_json)
    SELECT CONCAT('user:',u.id),u.id,c.id,COALESCE(NULLIF(u.name,''),NULLIF(c.name,''),NULLIF(u.phone,''),CONCAT('Клиент ',u.id)),COALESCE(NULLIF(u.phone,''),c.phone,''),
      (SELECT COUNT(*) FROM orders o WHERE o.client_user_id=u.id),
      COALESCE((SELECT SUM(o.price) FROM orders o WHERE o.client_user_id=u.id AND o.status IN ('done','completed','closed')),0),
      (SELECT MAX(COALESCE(o.completed_at,o.created_at)) FROM orders o WHERE o.client_user_id=u.id),
      JSON_OBJECT('schemaVersion',1,'source','users')
    FROM users u LEFT JOIN clients c ON c.user_id=u.id WHERE u.role='client'
    ON DUPLICATE KEY UPDATE client_id=VALUES(client_id),display_name=VALUES(display_name),phone=VALUES(phone),orders_count=VALUES(orders_count),total_spent=VALUES(total_spent),last_visit_at=VALUES(last_visit_at),payload_json=VALUES(payload_json)");
  $pdo->exec("UPDATE crm_customer_profiles SET completed_count=(SELECT COUNT(*) FROM orders o WHERE o.client_user_id=crm_customer_profiles.user_id AND o.status IN ('done','completed','closed')), segment=CASE WHEN total_spent>=500000 OR orders_count>=10 THEN 'vip' WHEN orders_count>=3 THEN 'returning' WHEN orders_count=0 THEN 'lead' ELSE 'new' END");
 }
];
