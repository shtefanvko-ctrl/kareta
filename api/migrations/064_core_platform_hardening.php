<?php
return [
 'version'=>64,
 'note'=>'Core platform hardening, schema versioning and legacy-domain backfill',
 'run'=>static function(PDO $pdo):void {
  $hasColumn=static function(PDO $pdo,string $table,string $column):bool{$s=$pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1");$s->execute([$table,$column]);return(bool)$s->fetchColumn();};
  if(!$hasColumn($pdo,'domain_entities','schema_version'))$pdo->exec("ALTER TABLE domain_entities ADD COLUMN schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER status");
  if(!$hasColumn($pdo,'domain_relations','schema_version'))$pdo->exec("ALTER TABLE domain_relations ADD COLUMN schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER status");
  if(!$hasColumn($pdo,'domain_events','schema_version'))$pdo->exec("ALTER TABLE domain_events ADD COLUMN schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER organization_id");
  $pdo->exec("INSERT INTO domain_entities(entity_type,entity_key,owner_user_id,status,schema_version,title,payload_json)
    SELECT 'person',CAST(u.id AS CHAR),u.id,'active',1,COALESCE(NULLIF(u.name,''),NULLIF(u.phone,''),CONCAT('Пользователь ',u.id)),JSON_OBJECT('role',COALESCE(u.role,'client'),'source','users') FROM users u
    ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id),title=VALUES(title),payload_json=VALUES(payload_json),schema_version=1");
  $pdo->exec("INSERT INTO domain_entities(entity_type,entity_key,owner_user_id,organization_id,status,schema_version,title,payload_json)
    SELECT 'organization',o.id,o.owner_user_id,o.id,o.status,1,o.name,JSON_OBJECT('type',o.type,'city',o.city,'source','organizations') FROM organizations o
    ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id),organization_id=VALUES(organization_id),status=VALUES(status),title=VALUES(title),payload_json=VALUES(payload_json),schema_version=1");
  $pdo->exec("INSERT INTO domain_relations(source_type,source_key,relation_type,target_type,target_key,status,schema_version,payload_json)
    SELECT 'person',CAST(om.user_id AS CHAR),'member_of','organization',om.organization_id,om.status,1,JSON_OBJECT('memberRole',om.member_role,'position',om.position,'source','organization_members')
    FROM organization_members om WHERE om.user_id IS NOT NULL
    ON DUPLICATE KEY UPDATE status=VALUES(status),payload_json=VALUES(payload_json),schema_version=1");
 }
];
