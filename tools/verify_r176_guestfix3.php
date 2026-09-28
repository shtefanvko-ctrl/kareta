<?php
$root = dirname(__DIR__);
$migration = file_get_contents($root . '/api/migrations/020_master_content_seed.php');
$config = file_get_contents($root . '/inc/asset_version.php');
$sw = file_get_contents($root . '/sw.js');
$checks = [
    'posts001 maps seven fields' => str_contains($migration, 'foreach ($posts001 as [$id,$type,$title,$preview,$body,$tags,$daysAgo])'),
    'posts002 maps seven fields' => str_contains($migration, 'foreach ($posts002 as [$id,$type,$title,$preview,$body,$tags,$daysAgo])'),
    'date helper is local closure' => str_contains($migration, '$mkdate = static function(int $daysAgo'),
    'phone helper is local closure' => str_contains($migration, '$rPhone = static function()'),
    'post body is inserted' => str_contains($migration, 'mb_substr($preview,0,200), $body,'),
    'asset release updated' => preg_match('/20260727-work-contexts-r176-guestfix[3-9]/', $config) === 1,
    'service worker release updated' => preg_match('/20260727-work-contexts-r176-guestfix[3-9]/', $sw) === 1,
];
$failed = false;
foreach ($checks as $name => $ok) {
    echo ($ok ? '[OK] ' : '[FAIL] ') . $name . PHP_EOL;
    $failed = $failed || !$ok;
}
exit($failed ? 1 : 0);
