<?php
declare(strict_types=1);

return [
    'version' => 136,
    'note' => 'R188 OBD remote diagnostic control plane (active-app polling)',
    'run' => static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS obd_mobile_devices(
          id VARCHAR(80) NOT NULL PRIMARY KEY,
          account_id BIGINT UNSIGNED NOT NULL,
          platform VARCHAR(24) NOT NULL DEFAULT 'android',
          app_version VARCHAR(40) NOT NULL DEFAULT '',
          native_api_version INT UNSIGNED NOT NULL DEFAULT 0,
          capabilities_json LONGTEXT NULL,
          push_token VARCHAR(255) NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'active',
          last_seen_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_obd_device_account(account_id,status),
          KEY idx_obd_device_seen(last_seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS obd_diagnostic_jobs(
          id VARCHAR(80) NOT NULL PRIMARY KEY,
          account_id BIGINT UNSIGNED NOT NULL,
          requested_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
          vehicle_id VARCHAR(80) NULL,
          request_key VARCHAR(120) NOT NULL,
          action VARCHAR(32) NOT NULL,
          payload_json LONGTEXT NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'pending',
          claimed_device_id VARCHAR(80) NULL,
          result_sync_key VARCHAR(120) NOT NULL DEFAULT '',
          error_code VARCHAR(80) NOT NULL DEFAULT '',
          error_message VARCHAR(500) NOT NULL DEFAULT '',
          attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          expires_at DATETIME NOT NULL,
          claimed_at DATETIME NULL,
          completed_at DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_obd_job_request(account_id,request_key),
          KEY idx_obd_job_pull(account_id,status,expires_at,created_at),
          KEY idx_obd_job_device(claimed_device_id,status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
