<?php
declare(strict_types=1);
return [
    'version'=>127,
    'note'=>'R188.5.5.6.74: STO schedule capacity command center, lane preferences and capacity incidents',
    'run'=>static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS sto_schedule_preferences(
          sto_id VARCHAR(64) NOT NULL PRIMARY KEY,
          default_range VARCHAR(16) NOT NULL DEFAULT 'day',
          show_master_lanes TINYINT(1) NOT NULL DEFAULT 1,
          show_bay_lanes TINYINT(1) NOT NULL DEFAULT 1,
          show_capacity_summary TINYINT(1) NOT NULL DEFAULT 1,
          compact_density TINYINT(1) NOT NULL DEFAULT 0,
          updated_by_user_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS sto_capacity_incidents(
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          sto_id VARCHAR(64) NOT NULL,
          lane_type VARCHAR(16) NOT NULL,
          lane_id VARCHAR(64) NOT NULL,
          starts_at DATETIME NOT NULL,
          ends_at DATETIME NOT NULL,
          reason VARCHAR(191) NOT NULL DEFAULT '',
          status VARCHAR(16) NOT NULL DEFAULT 'active',
          created_by_user_id BIGINT UNSIGNED NULL,
          resolved_by_user_id BIGINT UNSIGNED NULL,
          resolved_at DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_sto_incident_window(sto_id,lane_type,lane_id,status,starts_at,ends_at),
          KEY idx_sto_incident_status(sto_id,status,starts_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
