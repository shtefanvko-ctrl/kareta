<?php
return [
 'version'=>71,
 'note'=>'Realtime delivery indexes and user cursors',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS realtime_user_cursors (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    last_event_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_seen_at DATETIME NULL,
    transport VARCHAR(16) NOT NULL DEFAULT 'none',
    client_id VARCHAR(80) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_realtime_seen(last_seen_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  foreach ([
    "ALTER TABLE domain_event_recipients ADD KEY idx_der_user_event(user_id,event_id)",
    "ALTER TABLE notification_center ADD KEY idx_nc_user_status_created(user_id,status,created_at)",
  ] as $sql) { try { $pdo->exec($sql); } catch (Throwable $_ignored) {} }
 }
];
