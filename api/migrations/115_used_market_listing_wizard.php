<?php
declare(strict_types=1);

return [
    'version' => 115,
    'note' => 'R188.5.5.6.60: native used/restored/exchange listing wizard with drafts, donor, defects, delivery and photo workflow',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            return (int)$st->fetchColumn()>0;
        };
        $hasIndex = static function (string $table, string $index) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?");
            $st->execute([$table,$index]);
            return (int)$st->fetchColumn()>0;
        };

        if (!$pdo->query("SHOW TABLES LIKE 'used_market_listings'")->fetchColumn()) return;
        if (!$hasColumn('used_market_listings','price_negotiable')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN price_negotiable TINYINT(1) NOT NULL DEFAULT 0 AFTER price");
        if (!$hasColumn('used_market_listings','defects_text')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN defects_text TEXT NOT NULL AFTER description");
        if (!$hasColumn('used_market_listings','donor_vehicle_json')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN donor_vehicle_json MEDIUMTEXT NULL AFTER source_vehicle_id");
        if (!$hasColumn('used_market_listings','delivery_modes_json')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN delivery_modes_json VARCHAR(255) NOT NULL DEFAULT '[]' AFTER exchange_note");
        if (!$hasColumn('used_market_listings','delivery_note')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN delivery_note VARCHAR(500) NOT NULL DEFAULT '' AFTER delivery_modes_json");
        if (!$hasColumn('used_market_listings','draft_step')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN draft_step TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER status");
        if (!$hasColumn('used_market_listings','published_at')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN published_at DATETIME NULL AFTER draft_step");
        if (!$hasIndex('used_market_listings','idx_used_market_owner_status')) $pdo->exec("ALTER TABLE used_market_listings ADD KEY idx_used_market_owner_status(seller_user_id,status,updated_at)");
        $pdo->exec("UPDATE used_market_listings SET published_at=COALESCE(published_at,created_at),draft_step=8 WHERE status='active'");
    },
];
