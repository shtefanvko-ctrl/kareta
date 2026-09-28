<?php
declare(strict_types=1);

return [
    'version' => 129,
    'note' => 'R188.5.5.6.84.21: server-synced CLIENT first vehicle entry state and revisioned draft',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `client_first_entry_state` (
          `account_id` BIGINT UNSIGNED NOT NULL,
          `user_id` BIGINT UNSIGNED NULL,
          `context_id` BIGINT UNSIGNED NULL,
          `status` VARCHAR(24) NOT NULL DEFAULT 'not_started',
          `current_step` TINYINT UNSIGNED NOT NULL DEFAULT 1,
          `draft_json` JSON NULL,
          `revision` INT UNSIGNED NOT NULL DEFAULT 0,
          `dismissed_at` DATETIME NULL,
          `completed_at` DATETIME NULL,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`account_id`),
          KEY `idx_client_first_entry_user` (`user_id`),
          KEY `idx_client_first_entry_status` (`status`,`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Existing accounts that already own an active or archived vehicle must
        // never receive the first-vehicle prompt after this migration.
        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo,'accounts') && kareta_table_exists($pdo,'users') && kareta_table_exists($pdo,'client_vehicles')) {
            try {
                $pdo->exec("INSERT INTO client_first_entry_state(account_id,user_id,status,current_step,draft_json,revision,completed_at)
                  SELECT a.id,u.id,'completed',4,NULL,1,NOW()
                  FROM accounts a
                  JOIN users u ON u.phone=a.phone
                  WHERE EXISTS(
                    SELECT 1 FROM client_vehicles v
                    WHERE (v.user_id=u.id OR (v.user_phone<>'' AND v.user_phone=u.phone))
                  )
                  ON DUPLICATE KEY UPDATE
                    user_id=VALUES(user_id),
                    status='completed',
                    current_step=4,
                    draft_json=NULL,
                    revision=GREATEST(revision,1),
                    completed_at=COALESCE(completed_at,NOW())");
            } catch (Throwable $_) {}
        }
    },
];
