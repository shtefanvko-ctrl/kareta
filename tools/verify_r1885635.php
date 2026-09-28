<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['css/next/sto_native_surface_audit.css','tools/test_r1885635_sto_native_surface_audit.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_75.md','docs/releases/plans/PLAN_R188_5_5_6_75_STO_NATIVE_SURFACE_AUDIT.md'] as $f){if(!is_file($root.'/'.$f))$fail[]='missing '.$f;}
foreach(['inc/asset_version.php','sw.js'] as $f){$s=@file_get_contents($root.'/'.$f)?:'';if(!str_contains($s,'r1885635-sto-native-surface-audit'))$fail[]='tag missing '.$f;}
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.5.6.75 verifier OK\n";
