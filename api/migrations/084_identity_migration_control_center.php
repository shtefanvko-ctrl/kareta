<?php
declare(strict_types=1);
return [
 'version'=>84,
 'note'=>'R186.5 stage 14B: migration control center audit and conflict resolution',
 'run'=>static function(PDO $pdo):void{
  $pdo->exec("CREATE TABLE IF NOT EXISTS identity_migration_actions (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
   actor_user_id BIGINT UNSIGNED NULL,
   actor_account_id BIGINT UNSIGNED NULL,
   action_type VARCHAR(48) NOT NULL,
   target_type VARCHAR(48) NOT NULL DEFAULT '',
   target_id VARCHAR(96) NOT NULL DEFAULT '',
   payload_json JSON NULL,
   result_json JSON NULL,
   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(id), KEY idx_identity_migration_actions(created_at,action_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
