<?php
declare(strict_types=1);

return [
    'version' => 116,
    'note' => 'R188.5.5.6.63: seller storefront profile return policy and moderation reason',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            return (int)$st->fetchColumn()>0;
        };
        if (!$pdo->query("SHOW TABLES LIKE 'seller_profiles'")->fetchColumn()) return;
        if (!$hasColumn('seller_profiles','return_policy')) {
            $pdo->exec("ALTER TABLE seller_profiles ADD COLUMN return_policy VARCHAR(1000) NOT NULL DEFAULT '' AFTER return_days");
        }
        if (!$hasColumn('seller_profiles','moderation_reason')) {
            $pdo->exec("ALTER TABLE seller_profiles ADD COLUMN moderation_reason VARCHAR(500) NOT NULL DEFAULT '' AFTER moderation_status");
        }
    },
];
