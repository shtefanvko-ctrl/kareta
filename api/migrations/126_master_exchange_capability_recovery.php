<?php
declare(strict_types=1);

return [
    'version' => 126,
    'note' => 'R188.5.5.6.73.1: normalize master/client exchange capabilities for Identity contexts',
    'run' => static function (PDO $pdo): void {
        $sets = [
            'personal.client' => ['requests.read','requests.create','requests.update'],
            'profile.master' => ['requests.read','requests.create','requests.respond','work_orders.read'],
        ];
        $setStmt = $pdo->prepare("INSERT INTO capability_sets(code,title,scope_type,is_system) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE scope_type=VALUES(scope_type),is_system=1");
        $titles = [
            'personal.client' => ['Базовый клиентский контекст','personal'],
            'profile.master' => ['Профессиональный профиль мастера','profile'],
        ];
        $find = $pdo->prepare("SELECT id FROM capability_sets WHERE code=? LIMIT 1");
        $insert = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach ($sets as $code => $caps) {
            [$title,$scope] = $titles[$code];
            $setStmt->execute([$code,$title,$scope]);
            $find->execute([$code]);
            $setId = (int)($find->fetchColumn() ?: 0);
            if ($setId <= 0) continue;
            foreach ($caps as $cap) $insert->execute([$setId,$cap]);
        }
    },
];
