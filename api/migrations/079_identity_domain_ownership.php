<?php
declare(strict_types=1);
return [
 'version'=>79,
 'note'=>'R186.5 stage 10: context-owned domain entities, visibility and ACL',
 'run'=>static function(PDO $pdo):void{
   $hasColumn=static function(PDO $pdo,string $table,string $column):bool{
     $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
     $st->execute([$table,$column]);return (int)$st->fetchColumn()>0;
   };
   if(!$hasColumn($pdo,'domain_entities','owner_context_id'))$pdo->exec("ALTER TABLE domain_entities ADD COLUMN owner_context_id BIGINT UNSIGNED NULL AFTER organization_id");
   if(!$hasColumn($pdo,'domain_entities','visibility'))$pdo->exec("ALTER TABLE domain_entities ADD COLUMN visibility VARCHAR(24) NOT NULL DEFAULT 'private' AFTER owner_context_id");
   if(!$hasColumn($pdo,'domain_entities','permissions_json'))$pdo->exec("ALTER TABLE domain_entities ADD COLUMN permissions_json JSON NULL AFTER visibility");
   if(!$hasColumn($pdo,'domain_entities','ownership_revision'))$pdo->exec("ALTER TABLE domain_entities ADD COLUMN ownership_revision INT UNSIGNED NOT NULL DEFAULT 1 AFTER permissions_json");
   try{$pdo->exec("ALTER TABLE domain_entities ADD KEY idx_domain_owner_context(owner_context_id,entity_type), ADD KEY idx_domain_visibility(visibility,entity_type)");}catch(Throwable $_e){}
   try{$pdo->exec("ALTER TABLE domain_entities ADD CONSTRAINT fk_domain_owner_context FOREIGN KEY(owner_context_id) REFERENCES contexts(id) ON DELETE SET NULL");}catch(Throwable $_e){}

   $pdo->exec("CREATE TABLE IF NOT EXISTS domain_entity_acl (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      entity_id BIGINT UNSIGNED NOT NULL,
      grantee_context_id BIGINT UNSIGNED NOT NULL,
      permission_key VARCHAR(96) NOT NULL DEFAULT 'read',
      effect ENUM('allow','deny') NOT NULL DEFAULT 'allow',
      expires_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(id),
      UNIQUE KEY uq_domain_entity_acl(entity_id,grantee_context_id,permission_key),
      KEY idx_domain_acl_context(grantee_context_id,permission_key,effect),
      CONSTRAINT fk_domain_acl_entity FOREIGN KEY(entity_id) REFERENCES domain_entities(id) ON DELETE CASCADE,
      CONSTRAINT fk_domain_acl_context FOREIGN KEY(grantee_context_id) REFERENCES contexts(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

   $pdo->exec("UPDATE domain_entities d
      JOIN contexts c ON c.context_type='organization' AND c.organization_key=d.organization_id AND c.status='active'
      SET d.owner_context_id=c.id,d.ownership_revision=d.ownership_revision+1
      WHERE d.owner_context_id IS NULL AND d.organization_id IS NOT NULL AND d.organization_id<>''");
   $pdo->exec("UPDATE domain_entities d
      JOIN users u ON u.id=d.owner_user_id
      JOIN accounts a ON a.phone=u.phone
      JOIN contexts c ON c.account_id=a.id AND c.context_type='personal' AND c.status='active'
      SET d.owner_context_id=c.id,d.ownership_revision=d.ownership_revision+1
      WHERE d.owner_context_id IS NULL");
   $pdo->exec("UPDATE domain_entities SET visibility=CASE
      WHEN entity_type IN ('organization','person','product','service') THEN 'public'
      ELSE 'private' END
      WHERE visibility='' OR visibility IS NULL");
   $pdo->exec("UPDATE domain_entities SET permissions_json=JSON_OBJECT('owner','manage','public','read','authenticated','read') WHERE permissions_json IS NULL");
 }
];
