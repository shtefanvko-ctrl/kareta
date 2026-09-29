<?php
declare(strict_types=1);

return [
  'version'=>134,
  'note'=>'R188 mobile OBD/ELM327 diagnostic sessions and offline sync core',
  'run'=>static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS obd_diagnostic_sessions(
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      account_id BIGINT UNSIGNED NOT NULL,
      vehicle_id VARCHAR(80) NULL,
      sync_key VARCHAR(120) NOT NULL,
      adapter_name VARCHAR(120) NOT NULL DEFAULT '',
      adapter_address VARCHAR(32) NOT NULL DEFAULT '',
      vin VARCHAR(32) NOT NULL DEFAULT '',
      protocol_label VARCHAR(80) NOT NULL DEFAULT '',
      dtc_json LONGTEXT NULL,
      snapshot_json LONGTEXT NULL,
      raw_json LONGTEXT NULL,
      source VARCHAR(24) NOT NULL DEFAULT 'android',
      captured_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_obd_sync_key(account_id,sync_key),
      KEY idx_obd_account_captured(account_id,captured_at),
      KEY idx_obd_vehicle_captured(vehicle_id,captured_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  },
];
