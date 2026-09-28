<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_reminder_dispatch(
      reminder_key VARCHAR(191) PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      last_sent_at DATETIME NOT NULL,
      INDEX idx_vrd_user(user_id,last_sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
