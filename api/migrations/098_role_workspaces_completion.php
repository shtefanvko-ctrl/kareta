<?php
declare(strict_types=1);

return [
    'version' => 98,
    'note' => 'R188.5 role workspaces completion, scoped dashboard revisions and store capabilities',
    'run' => static function (PDO $pdo): void {
        $columnExists = static function (string $table, string $column) use ($pdo): bool {
            $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
            $st->execute([$table, $column]);
            return (int)$st->fetchColumn() > 0;
        };
        $indexExists = static function (string $table, string $index) use ($pdo): bool {
            $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?');
            $st->execute([$table, $index]);
            return (int)$st->fetchColumn() > 0;
        };

        if (!$columnExists('dashboard_layout_preferences', 'context_key')) {
            $pdo->exec("ALTER TABLE dashboard_layout_preferences ADD COLUMN context_key VARCHAR(128) NOT NULL DEFAULT '' AFTER context_kind");
        }
        if (!$columnExists('dashboard_layout_preferences', 'revision')) {
            $pdo->exec('ALTER TABLE dashboard_layout_preferences ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 1 AFTER layout_json');
        }
        if ($indexExists('dashboard_layout_preferences', 'uq_dashboard_layout')) {
            $pdo->exec('ALTER TABLE dashboard_layout_preferences DROP INDEX uq_dashboard_layout');
        }
        if (!$indexExists('dashboard_layout_preferences', 'uq_dashboard_layout_scope')) {
            $pdo->exec('ALTER TABLE dashboard_layout_preferences ADD UNIQUE KEY uq_dashboard_layout_scope(account_id,context_kind,context_key,dashboard_key)');
        }

        $sets = [
            'profile.seller' => [
                'market.products.manage','market.orders.read','market.orders.fulfill',
                'warehouse.stock.manage','finance.manage','chats.use','profile.manage','parts.browse',
            ],
            'organization.seller' => [
                'market.products.manage','market.orders.read','market.orders.fulfill',
                'warehouse.stock.manage','finance.manage','chats.use','profile.manage','parts.browse',
            ],
            'organization.master' => ['work_orders.assign'],
            'organization.member' => ['work_orders.assign'],
        ];
        $setId = $pdo->prepare('SELECT id FROM capability_sets WHERE code=? LIMIT 1');
        $insert = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach ($sets as $code => $capabilities) {
            $setId->execute([$code]);
            $id = (int)($setId->fetchColumn() ?: 0);
            if ($id <= 0) continue;
            foreach ($capabilities as $capability) $insert->execute([$id, $capability]);
        }
    },
];
