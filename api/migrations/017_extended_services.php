<?php
return [
    'version' => 17,
    'note'    => 'Extended service categories and catalog reseed',
    'run'     => function(PDO $pdo): void {
        kareta_ensure_column($pdo, 'services', 'category_label',
            "ALTER TABLE `services` ADD COLUMN `category_label` VARCHAR(64) NULL DEFAULT NULL AFTER `cat`");
        kareta_ensure_column($pdo, 'services', 'sort',
            "ALTER TABLE `services` ADD COLUMN `sort` INT NOT NULL DEFAULT 0 AFTER `active`");
        try {
            $pdo->exec("CREATE INDEX IF NOT EXISTS `idx_services_cat` ON `services`(`cat`)");
        } catch (Throwable $_e) {
            try { $pdo->exec("ALTER TABLE `services` ADD INDEX `idx_services_cat` (`cat`)"); } catch (Throwable $_e2) {}
        }
        if (function_exists('kareta_ensure_catalog_content')) {
            kareta_ensure_catalog_content($pdo);
        }
    },
];
