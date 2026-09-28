<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'version'=>preg_match('/r1865-[a-z0-9-]+/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'sw'=>preg_match('/r1865-[a-z0-9-]+/',(string)@file_get_contents($root.'/sw.js'))===1,
 'recovery'=>is_file($root.'/js/next/recovery_manager.js') && str_contains((string)file_get_contents($root.'/js/next/recovery_manager.js'),'KaretaRecovery'),
 'snapshot'=>is_file($root.'/js/next/diagnostics_snapshot.js') && str_contains((string)file_get_contents($root.'/js/next/diagnostics_snapshot.js'),'KaretaDiagnosticSnapshot'),
 'audit_json'=>is_file($root.'/docs/audit/internal_architecture_audit.json'),
 'audit_md'=>is_file($root.'/docs/audit/INTERNAL_ARCHITECTURE_AUDIT.md'),
 'feedback'=>is_file($root.'/docs/audit/TEST_FEEDBACK_TEMPLATE.md'),
 'assets'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'js/next/recovery_manager.js') && str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'js/next/diagnostics_snapshot.js'),
 'trace_meta'=>str_contains((string)file_get_contents($root.'/api/bootstrap.php'),"'traceId' => substr"),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL: '.implode(',',$bad).PHP_EOL);exit(1);} echo "R186.5 internal audit verifier OK\n";
