<?php
declare(strict_types=1);

return [
    'version' => 137,
    'note' => 'Unified geo points for masters, service stations, organization units and shops',
    'run' => static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `geo_points` (
          `id` VARCHAR(96) NOT NULL PRIMARY KEY,
          `owner_type` VARCHAR(32) NOT NULL,
          `owner_id` VARCHAR(96) NOT NULL,
          `kind` VARCHAR(32) NOT NULL DEFAULT 'service',
          `label` VARCHAR(191) NOT NULL DEFAULT '',
          `country_code` VARCHAR(8) NOT NULL DEFAULT 'KZ',
          `city` VARCHAR(120) NOT NULL DEFAULT '',
          `address` VARCHAR(255) NOT NULL DEFAULT '',
          `latitude` DECIMAL(10,7) NULL DEFAULT NULL,
          `longitude` DECIMAL(10,7) NULL DEFAULT NULL,
          `source` VARCHAR(24) NOT NULL DEFAULT 'manual',
          `visibility` VARCHAR(24) NOT NULL DEFAULT 'hidden',
          `metadata_json` LONGTEXT NULL,
          `verified_at` DATETIME NULL,
          `active` TINYINT(1) NOT NULL DEFAULT 1,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY `uq_geo_owner_kind` (`owner_type`,`owner_id`,`kind`),
          KEY `idx_geo_public_bbox` (`visibility`,`owner_type`,`active`,`latitude`,`longitude`),
          KEY `idx_geo_city_owner` (`city`,`owner_type`,`active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'masters')) {
            $hasLat = function_exists('kareta_column_exists') && kareta_column_exists($pdo, 'masters', 'service_lat');
            $hasLng = function_exists('kareta_column_exists') && kareta_column_exists($pdo, 'masters', 'service_lng');
            if ($hasLat && $hasLng) {
                $pdo->exec("INSERT INTO `geo_points`
                    (`id`,`owner_type`,`owner_id`,`kind`,`label`,`country_code`,`city`,`address`,`latitude`,`longitude`,`source`,`visibility`,`active`)
                    SELECT
                      CONCAT('geo_',SHA2(CONCAT('master|',m.id,'|',CASE WHEN COALESCE(m.work_mode,'shop')='mobile' THEN 'mobile_origin' ELSE 'service' END),256)),
                      'master',
                      CAST(m.id AS CHAR),
                      CASE WHEN COALESCE(m.work_mode,'shop')='mobile' THEN 'mobile_origin' ELSE 'service' END,
                      COALESCE(NULLIF(m.name,''),'Мастер'),
                      'KZ',
                      COALESCE(m.city,''),
                      COALESCE(m.service_address,''),
                      m.service_lat,
                      m.service_lng,
                      COALESCE(NULLIF(m.location_source,''),'manual'),
                      CASE
                        WHEN COALESCE(m.work_mode,'shop')='mobile' THEN 'city'
                        WHEN COALESCE(m.location_visibility,'')='exact' THEN 'exact'
                        ELSE 'hidden'
                      END,
                      COALESCE(m.active,1)
                    FROM `masters` m
                    WHERE m.service_lat IS NOT NULL
                      AND m.service_lng IS NOT NULL
                    ON DUPLICATE KEY UPDATE
                      label=VALUES(label),
                      city=VALUES(city),
                      address=VALUES(address),
                      latitude=VALUES(latitude),
                      longitude=VALUES(longitude),
                      source=VALUES(source),
                      visibility=VALUES(visibility),
                      active=VALUES(active),
                      updated_at=CURRENT_TIMESTAMP");
            }
        }
    },
];
