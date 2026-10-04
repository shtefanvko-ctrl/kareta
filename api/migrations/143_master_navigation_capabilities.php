<?php
declare(strict_types=1);

return [
    'version' => 143,
    'note' => 'R188.5.5.6.84.27: reconcile MASTER navigation capabilities for services and account surfaces',
    'run' => static function (PDO $pdo): void {
        $setStmt = $pdo->prepare("INSERT INTO capability_sets(code,title,scope_type,is_system) VALUES('profile.master','Профессиональный профиль мастера','profile',1) ON DUPLICATE KEY UPDATE scope_type='profile',is_system=1");
        $setStmt->execute();
        $find = $pdo->prepare("SELECT id FROM capability_sets WHERE code='profile.master' LIMIT 1");
        $find->execute();
        $setId = (int)($find->fetchColumn() ?: 0);
        if ($setId <= 0) throw new RuntimeException('profile.master capability set unavailable');

        $insert = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach (['services.manage','profile.read'] as $capability) {
            $insert->execute([$setId,$capability]);
        }
    },
];
