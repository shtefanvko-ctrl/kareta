<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS api_legacy_bridge_audit (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      capability VARCHAR(120) NOT NULL,
      mode VARCHAR(32) NOT NULL,
      decision VARCHAR(80) NOT NULL,
      legacy_roles_json JSON NULL,
      request_method VARCHAR(12) NULL,
      request_path VARCHAR(255) NULL,
      request_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(id), KEY idx_bridge_created(created_at), KEY idx_bridge_capability(capability), KEY idx_bridge_mode(mode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
