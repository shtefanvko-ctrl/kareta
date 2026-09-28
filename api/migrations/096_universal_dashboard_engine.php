<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS dashboard_layout_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    context_kind VARCHAR(32) NOT NULL,
    dashboard_key VARCHAR(96) NOT NULL,
    layout_json JSON NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dashboard_layout(account_id,context_kind,dashboard_key),
    KEY idx_dashboard_layout_context(context_kind,dashboard_key),
    CONSTRAINT fk_dashboard_layout_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
