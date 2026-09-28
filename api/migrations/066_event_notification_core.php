<?php
return [
 'version'=>66,
 'note'=>'Domain event recipients and unified notification delivery',
 'run'=>static function(PDO $pdo):void {
  $hasColumn=static function(PDO $pdo,string $table,string $column):bool{$st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$st->execute([$table,$column]);return (int)$st->fetchColumn()>0;};
  if(!$hasColumn($pdo,'notification_center','notification_key')){
   $pdo->exec("ALTER TABLE notification_center ADD COLUMN notification_key VARCHAR(191) NULL AFTER id");
   $pdo->exec("ALTER TABLE notification_center ADD UNIQUE KEY uq_notification_key(notification_key)");
  }
  if(!$hasColumn($pdo,'notification_center','action_url'))$pdo->exec("ALTER TABLE notification_center ADD COLUMN action_url VARCHAR(255) NOT NULL DEFAULT '' AFTER body");
  $pdo->exec("CREATE TABLE IF NOT EXISTS domain_event_recipients (
    event_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    delivery_status VARCHAR(24) NOT NULL DEFAULT 'pending',
    delivered_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(event_id,user_id),
    KEY idx_event_recipient_user(user_id,event_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("INSERT IGNORE INTO domain_event_recipients(event_id,user_id,delivery_status,delivered_at)
    SELECT e.id,e.actor_user_id,'delivered',e.occurred_at FROM domain_events e WHERE e.actor_user_id IS NOT NULL");
 }
];
