<?php
return [
    'version' => 23,
    'note'    => 'master geo fields: work_mode, service_radius_km, service_address, service_lat, service_lng, location_source, location_visibility',
    'run'     => function(PDO $pdo): void {
        $existing = [];
        foreach ($pdo->query("SHOW COLUMNS FROM `masters`")->fetchAll(PDO::FETCH_ASSOC) as $col) {
            $existing[] = $col['Field'];
        }
        $add = [
            'work_mode'           => "ALTER TABLE `masters` ADD COLUMN `work_mode`           VARCHAR(20)     NOT NULL DEFAULT 'shop'    COMMENT 'shop|mobile|hybrid'",
            'service_radius_km'   => "ALTER TABLE `masters` ADD COLUMN `service_radius_km`   SMALLINT UNSIGNED NOT NULL DEFAULT 0",
            'service_address'     => "ALTER TABLE `masters` ADD COLUMN `service_address`      VARCHAR(255)    NOT NULL DEFAULT ''",
            'service_lat'         => "ALTER TABLE `masters` ADD COLUMN `service_lat`          DECIMAL(10,7)   NULL DEFAULT NULL",
            'service_lng'         => "ALTER TABLE `masters` ADD COLUMN `service_lng`          DECIMAL(10,7)   NULL DEFAULT NULL",
            'location_source'     => "ALTER TABLE `masters` ADD COLUMN `location_source`      VARCHAR(20)     NOT NULL DEFAULT 'manual'  COMMENT 'manual|ip|gps'",
            'location_visibility' => "ALTER TABLE `masters` ADD COLUMN `location_visibility`  VARCHAR(20)     NOT NULL DEFAULT 'city'    COMMENT 'city|district|hidden'",
        ];
        foreach ($add as $col => $sql) {
            if (!in_array($col, $existing, true)) {
                $pdo->exec($sql);
            }
        }

        // Индексы для будущего nearby-поиска
        try {
            $pdo->exec("ALTER TABLE `masters` ADD INDEX `idx_masters_city`    (`city`)");
        } catch (Throwable $_e) {}
        try {
            $pdo->exec("ALTER TABLE `masters` ADD INDEX `idx_masters_workmode` (`work_mode`)");
        } catch (Throwable $_e) {}
    },
];
