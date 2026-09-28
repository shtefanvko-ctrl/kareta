$ErrorActionPreference='Continue'
$root='/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz'
$checks=@(
  @('php:index',@('php','-l',"$root/index.php")),
  @('php:config',@('php','-l',"$root/config.php")),
  @('php:asset_registry',@('php','-l',"$root/inc/asset_registry.php")),
  @('php:identity_session',@('php','-l',"$root/api/identity_session.php")),
  @('php:db_api',@('php','-l',"$root/api/db.php")),
  @('node:route_registry',@('node','--check',"$root/js/next/route_registry.js")),
  @('node:app_next',@('node','--check',"$root/js/next/app_next.js")),
  @('node:project_audit_syntax',@('node','--check',"$root/tools/test_project_audit_r188558410.js")),
  @('migration manifest/checksums',@('php',"$root/tools/test_release_migration_manifest.php")),
  @('master workplace auth guard',@('node',"$root/tools/test_r1885568427_master_workplace_auth_guard.js")),
  @('legacy role capability budget',@('node',"$root/tools/test_legacy_role_budget_84_109.js")),
  @('frontend role authorization boundary',@('node',"$root/tools/test_frontend_role_authorization_84_109.js")),
  @('master mobile shell visual contract',@('node',"$root/tools/test_master_mobile_shell_visual.js")),
  @('identity API/garage recovery',@('node',"$root/tools/test_r1885607_identity_api_client_garage_recovery.js")),
  @('direct DB API client contract',@('node',"$root/tools/test_direct_db_api_client_84_109.js")),
  @('db monolith decomposition contract',@('node',"$root/tools/test_db_monolith_decomposition_84_109.js")),
  @('API contract smoke suite',@('node',"$root/tools/test_api_contract_smoke_84_109.js")),
  @('PWA release/manifest contract',@('node',"$root/tools/test_release_pwa_contract.js")),
  @('manifest fallback regression',@('node',"$root/tools/test_r1885568428_manifest_fallback.js")),
  @('project audit contracts',@('node',"$root/tools/test_project_audit_r188558410.js")),
  @('browser support matrix',@('node',"$root/tools/test_browser_support_matrix_84_109.js")),
  @('production feature matrix',@('node',"$root/tools/test_production_feature_matrix_84_109.js")),
  @('runtime release metadata',@('node',"$root/tools/test_runtime_release_metadata_84_109.js")),
  @('release notes 84.77-84.109',@('node',"$root/tools/test_release_notes_84_77_84_109.js")),
  @('route lazy loader',@('node',"$root/tools/test_route_lazy_loader_84_66.js")),
  @('master exchange structure',@('node',"$root/tools/test_master_exchange_structure_84_109.js"))
)
$pass=0;$fail=0
foreach($item in $checks){
  $label=$item[0];$a=$item[1]
  $exe=$a[0];$rest=@();if($a.Count -gt 1){$rest=$a[1..($a.Count-1)]}
  $output=& wsl -e $exe @rest 2>&1
  $rc=$LASTEXITCODE
  if($rc -eq 0){$pass++;Write-Output ("[PASS] "+$label)}
  else{$fail++;Write-Output ("[FAIL] "+$label+" rc="+$rc);$output | Select-Object -Last 20 | ForEach-Object {Write-Output ("  "+$_)}}
}
Write-Output ("SUMMARY: "+$pass+"/"+($pass+$fail)+" passed; "+$fail+" failed")
if($fail -eq 0){Write-Output 'RELEASE_CHECKLIST_WINDOWS: PASS';exit 0}else{Write-Output 'RELEASE_CHECKLIST_WINDOWS: FAIL';exit 1}
