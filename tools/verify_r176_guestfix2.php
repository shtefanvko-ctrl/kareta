<?php
$root = dirname(__DIR__);
$migration = file_get_contents($root . '/api/migrations/007_unify_user_entities.php');
$asset = file_get_contents($root . '/inc/asset_version.php');
$sw = file_get_contents($root . '/sw.js');
$checks = [
    'migration nullable clients' => str_contains($migration, 'ALTER TABLE `clients` MODIFY COLUMN `user_phone` VARCHAR(20) NULL'),
    'migration nullable masters' => str_contains($migration, 'ALTER TABLE `masters` MODIFY COLUMN `user_phone` VARCHAR(20) NULL'),
    'duplicate canonicalization' => str_contains($migration, 'HAVING COUNT(*) > 1'),
    'duplicate rows detached' => str_contains($migration, 'SET t.user_phone = NULL'),
    'existing unique index detection' => str_contains($migration, "NON_UNIQUE = 0"),
    'users insert remains idempotent' => substr_count($migration, 'INSERT IGNORE INTO `users`') >= 2,
    'asset release updated' => str_contains($asset, '20260727-work-contexts-r176-guestfix'),
    'service worker release updated' => str_contains($sw, '20260727-work-contexts-r176-guestfix'),
];
$failed = false;
foreach ($checks as $name => $ok) {
    echo ($ok ? '[OK] ' : '[FAIL] ') . $name . PHP_EOL;
    $failed = $failed || !$ok;
}
exit($failed ? 1 : 0);
