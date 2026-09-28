<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS capability_aliases (
        alias_key VARCHAR(128) PRIMARY KEY,
        canonical_key VARCHAR(128) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cap_alias_canonical(canonical_key,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    require_once __DIR__ . '/../identity/capability_registry.php';
    $stmt = $pdo->prepare("INSERT INTO capability_aliases(alias_key,canonical_key,status) VALUES(?,?,'active') ON DUPLICATE KEY UPDATE canonical_key=VALUES(canonical_key),status='active'");
    foreach (KaretaCapabilityRegistry::aliases() as $alias => $canonical) {
        $stmt->execute([$alias,$canonical]);
    }
};
