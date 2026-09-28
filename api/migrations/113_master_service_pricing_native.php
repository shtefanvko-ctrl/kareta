<?php
declare(strict_types=1);

return [
    'version' => 113,
    'note' => 'R188.5.5.6.56: Native service pricing contract with price modes and duration ranges',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            return (int)$st->fetchColumn()>0;
        };
        if (!$hasColumn('service_offers','price_type')) {
            $pdo->exec("ALTER TABLE service_offers ADD COLUMN price_type VARCHAR(24) NOT NULL DEFAULT 'fixed' AFTER price");
        }
        if (!$hasColumn('service_offers','price_max')) {
            $pdo->exec("ALTER TABLE service_offers ADD COLUMN price_max DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER price_type");
        }
        if (!$hasColumn('service_offers','duration_max_min')) {
            $pdo->exec("ALTER TABLE service_offers ADD COLUMN duration_max_min INT UNSIGNED NOT NULL DEFAULT 0 AFTER duration_min");
        }
        $pdo->exec("UPDATE service_offers SET price_type='fixed' WHERE price_type IS NULL OR price_type='' OR price_type NOT IN ('fixed','from','range','agreement')");
        $pdo->exec("UPDATE service_offers SET price_max=0 WHERE price_type<>'range'");
        $pdo->exec("UPDATE service_offers SET duration_max_min=duration_min WHERE duration_max_min>0 AND duration_max_min<duration_min");
    },
];
