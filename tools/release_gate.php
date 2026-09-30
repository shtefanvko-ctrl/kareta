<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
$root = dirname(__DIR__);
$args = array_slice($argv, 1);
$package = 'auto';
foreach ($args as $arg) if (str_starts_with($arg, '--package=')) $package = substr($arg, 10);
if ($package === 'auto') $package = is_dir($root . '/assets') ? 'full' : 'no-assets';
if (!in_array($package, ['full','no-assets'], true)) { fwrite(STDERR, "Unknown package mode: {$package}\n"); exit(2); }

$checks = [];
$add = static function(string $name, bool $ok, string $detail='') use (&$checks): void {
    $checks[] = ['name'=>$name,'ok'=>$ok,'detail'=>$detail];
};
$read = static function(string $path): string {
    $text = @file_get_contents($path);
    return is_string($text) ? $text : '';
};
$run = static function(array $cmd, ?string &$output=null): int {
    $parts = array_map('escapeshellarg', $cmd);
    $lines = []; $code = 0;
    exec(implode(' ', $parts) . ' 2>&1', $lines, $code);
    $output = implode("\n", $lines);
    return $code;
};

$add('php_version', PHP_VERSION_ID >= 80100, PHP_VERSION);
$add('package_mode', true, $package);
if ($package === 'no-assets') $add('assets_external_contract', !is_dir($root . '/assets'), 'asset bytes external');
$add('config_example', is_file($root . '/config.private.example.php'));
$add('private_config_excluded', !is_file($root . '/config.private.php'));

$assetText = $read($root . '/inc/asset_version.php');
$swText = $read($root . '/sw.js');
preg_match("/KARETA_ASSET_VERSION\\s*=\\s*'([^']+)'/", $assetText, $am);
preg_match("/const\\s+RELEASE\\s*=\\s*['\"]([^'\"]+)['\"]\\s*;/", $swText, $sm);
$assetVersion = (string)($am[1] ?? '');
$swVersion = (string)($sm[1] ?? '');
$add('release_target', preg_match('/^188\.5\.5\.6\.84\.(?:10[1-9]|1[1-9][0-9]|[2-9][0-9]{2,})$/', $assetVersion) === 1, $assetVersion);
$add('release_parity', $assetVersion !== '' && hash_equals($assetVersion, $swVersion), "asset={$assetVersion}; sw={$swVersion}");

$protected = [
    'index.php' => '5e3dbc84e0ff808dd023d490399677f7ff1616d3c7bebaeb1bfab462d0854d26',
    'js/next/smart_action_hub.js' => '1b43d237e7de8a94cc960344ad69bcd9be5545816929bc0a62d457468c03c122',
];
foreach ($protected as $relative => $hash) {
    $path = $root . '/' . $relative;
    $actual = is_file($path) ? hash_file('sha256', $path) : '';
    $add('protected_' . str_replace(['/', '.'], '_', $relative), $actual === $hash, $actual);
}

$forbidden = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($it as $file) {
    if (!$file->isFile()) continue;
    $relative = str_replace('\\','/', substr($file->getPathname(), strlen($root)+1));
    if (preg_match('#(?:storage/(?:logs|runtime)/(?!\.htaccess$|\.gitkeep$|\.keep$).+|\.tmp$|\.bak$|~$|_old\.php$|\.k8479\.rollback\.)#i', $relative)) $forbidden[] = $relative;
}
$add('forbidden_runtime_files', $forbidden === [], implode(',', array_slice($forbidden,0,8)));

$manifestPath = $root . '/api/migration_manifest.php';
$manifest = is_file($manifestPath) ? require $manifestPath : null;
$manifestOk = is_array($manifest) && isset($manifest['version'],$manifest['files']) && is_array($manifest['files']);
$manifestDetail = '';
if ($manifestOk) {
    $version = (int)$manifest['version'];
    $files = $manifest['files'];
    $manifestOk = array_keys($files) === range(1,$version);
    if ($manifestOk) {
        foreach ($files as $number => $meta) {
            $name = (string)($meta['file'] ?? '');
            $expected = (string)($meta['checksum'] ?? '');
            $path = $root . '/api/migrations/' . $name;
            if ($name === '' || $expected === '' || !is_file($path) || hash_file('sha256',$path) !== $expected) {
                $manifestOk = false; $manifestDetail = "migration {$number}: {$name}"; break;
            }
        }
    }
    if ($manifestDetail === '') $manifestDetail = 'version=' . $version . '; files=' . count($files);
}
$add('migration_manifest_integrity', $manifestOk, $manifestDetail);

// Syntax is an invariant of the package, not a historical-release test.
$phpFiles = []; $jsFiles = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($it as $file) {
    if (!$file->isFile()) continue;
    $ext = strtolower($file->getExtension());
    if ($ext === 'php') $phpFiles[] = $file->getPathname();
    if ($ext === 'js') $jsFiles[] = $file->getPathname();
}
sort($phpFiles); sort($jsFiles);
$phpFailures = [];
foreach ($phpFiles as $file) {
    $output = ''; if ($run([PHP_BINARY,'-l',$file],$output) !== 0) $phpFailures[] = str_replace($root.'/','',$file) . ': ' . $output;
}
$add('php_syntax_all', $phpFailures === [], 'files=' . count($phpFiles) . ($phpFailures ? '; ' . $phpFailures[0] : ''));
$node = trim((string)shell_exec('command -v node 2>/dev/null'));
$jsFailures = [];
if ($node === '') $jsFailures[] = 'node not found';
else foreach ($jsFiles as $file) {
    $output = ''; if ($run([$node,'--check',$file],$output) !== 0) $jsFailures[] = str_replace($root.'/','',$file) . ': ' . $output;
}
$add('js_syntax_all', $jsFailures === [], 'files=' . count($jsFiles) . ($jsFailures ? '; ' . $jsFailures[0] : ''));

$focused = [
    '84.18' => 'tools/test_master_first_entry_resilience_84_18.js',
    '84.29' => 'tools/test_master_onboarding_workplace_gate_84_29.js',
    '84.97' => 'tools/test_master_recovery_behavior_84_97.js',
    '84.98' => 'tools/test_request_submit_db_backoff_84_98.js',
    '84.99' => 'tools/test_master_ui_cleanup_84_99.js',
    '84.100' => 'tools/test_master_ui_polish_84_100.js',
    '84.101' => 'tools/test_master_contour_84_101.js',
    '84.102' => 'tools/test_master_ui_consolidation_84_102.js',
    '84.102.bundle' => 'tools/test_master_bundle_sync.js',
    '84.102.direct' => 'tools/test_master_direct_route_visual.js',
    '84.102.sequence' => 'tools/test_master_route_sequence_visual.js',
    '84.102.mobile' => 'tools/test_master_mobile_shell_visual.js',
    '84.103' => 'tools/test_context_buttons_client_master_84_103.js',
    '84.104' => 'tools/test_provider_detail_failsoft_84_104.js',
    '84.105' => 'tools/test_context_buttons_visibility_lock_84_105.js',
    '84.106' => 'tools/test_master_ui_final_84_106.js',
    '84.65' => 'tools/test_production_stabilization_84_65.js',
    '84.66' => 'tools/test_route_lazy_loader_84_66.js',
    '84.67' => 'tools/test_route_lazy_runtime_84_67.js',
    '84.68' => 'tools/test_route_lazy_runtime_84_68.js',
    '84.69' => 'tools/test_runtime_cleanup_route_lazy_84_69.js',
    '84.70' => 'tools/test_boot_sms_root_cause_84_70.js',
    '84.71' => 'tools/test_single_document_temp_otp_84_71.js',
    '84.72' => 'tools/test_single_pass_performance_84_72.js',
    '84.73' => 'tools/test_mobile_brand_center_84_73.js',
    '84.74' => 'tools/test_mobile_back_header_84_74.js',
    '84.75' => 'tools/test_mobile_back_icon_84_75.js',
    '84.76' => 'tools/test_home_request_ui_84_76.js',
    '84.77' => 'tools/test_client_tow_garage_84_77.js',
    '84.78' => 'tools/test_vehicle_chat_native_84_78.js',
    '84.79' => 'tools/test_recovery_merge_84_79.js',
    '84.80' => 'tools/test_commissioning_otp_84_80.js',
    '84.81' => 'tools/test_critical_css_split_84_81.js',
    '84.82' => 'tools/test_critical_js_session_boot_84_82.js',
    '84.83' => 'tools/test_fast_manifest_hot_path_84_83.js',
    '84.84' => 'tools/test_first_paint_waterfall_84_84.js',
    '84.85' => 'tools/test_boot_profiler_84_85.js',
    '84.86' => 'tools/test_messaging_core_84_86.js',
    '84.87' => 'tools/test_telegram_live_actions_84_87.js',
    '84.88' => 'tools/test_request_urgency_cleanup_84_88.js',
    '84.89' => 'tools/test_boot_error_codes_84_89.js',
    '84.91' => 'tools/test_masters_mobile_shell_84_91.js',
    '84.92' => 'tools/test_community_single_header_84_92.js',
    '84.93' => 'tools/test_request_problem_step_84_93.js',
    '84.94' => 'tools/test_garage_mobile_layout_84_94.js',
    '84.95' => 'tools/test_mobile_fab_badges_84_95.js',
    'master.more' => 'tools/test_master_more_contract.js',
];
if ($node !== '') foreach ($focused as $label => $relative) {
    $path = $root . '/' . $relative;
    if (!is_file($path)) { $add('regression_' . str_replace('.','_',$label), false, 'missing ' . $relative); continue; }
    $output = ''; $code = $run([$node,$path],$output);
    $last = trim((string)(array_slice(preg_split('/\R/', $output) ?: [], -1)[0] ?? ''));
    $add('regression_' . str_replace('.','_',$label), $code === 0, $code === 0 ? $last : $output);
}

foreach ($checks as $check) {
    echo ($check['ok'] ? '[OK]   ' : '[FAIL] ') . $check['name'];
    if ($check['detail'] !== '') echo ' — ' . $check['detail'];
    echo PHP_EOL;
}
$failed = array_values(array_filter($checks, static fn(array $c): bool => !$c['ok']));
echo 'RESULT: ' . ($failed ? 'FAIL' : 'OK') . ' (' . (count($checks)-count($failed)) . '/' . count($checks) . ')' . PHP_EOL;
exit($failed ? 1 : 0);
