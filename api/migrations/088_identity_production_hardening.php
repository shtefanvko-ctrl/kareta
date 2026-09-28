<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS identity_health_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT UNSIGNED NULL,
    context_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(64) NOT NULL,
    severity ENUM('info','warning','error') NOT NULL DEFAULT 'info',
    request_id VARCHAR(64) NULL,
    trace_id VARCHAR(160) NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_identity_health_created (created_at),
    KEY idx_identity_health_account (account_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
