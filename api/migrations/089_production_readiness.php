<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS production_release_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    release_version VARCHAR(96) NOT NULL,
    gate_status ENUM('passed','failed','warning') NOT NULL,
    gate_name VARCHAR(96) NOT NULL,
    details_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_release_gate (release_version, gate_status),
    KEY idx_release_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
