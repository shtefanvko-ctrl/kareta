<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS account_ui_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    context_kind VARCHAR(32) NOT NULL,
    more_menu_layout ENUM('grid','arc','hex') NOT NULL DEFAULT 'grid',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_account_ui_context(account_id,context_kind),
    CONSTRAINT fk_account_ui_preferences_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
