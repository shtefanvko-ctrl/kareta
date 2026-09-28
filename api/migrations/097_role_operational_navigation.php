<?php
declare(strict_types=1);

return [
    'version' => 97,
    'note' => 'R188.4: allow operational client booking from master and service-organization contexts',
    'run' => static function (PDO $pdo): void {
        $setIdStmt = $pdo->prepare("SELECT id FROM capability_sets WHERE code=? LIMIT 1");
        $capStmt = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach (['profile.master','organization.master','organization.member'] as $code) {
            $setIdStmt->execute([$code]);
            $setId = (int)($setIdStmt->fetchColumn() ?: 0);
            if ($setId > 0) $capStmt->execute([$setId,'order.create']);
        }
    },
];
