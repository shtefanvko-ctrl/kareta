$node='C:\Program Files\nodejs\node.exe'
$root='C:\Users\KARETA.KZ\Desktop\kareta.kz'
Set-Location $root
$checks=@(
 @('node:route_registry',@('--check',"$root\js\next\route_registry.js")),
 @('node:app_next',@('--check',"$root\js\next\app_next.js")),
 @('node:project_audit_syntax',@('--check',"$root\tools\test_project_audit_r188558410.js")),
 @('master workplace auth guard',@("$root\tools\test_r1885568427_master_workplace_auth_guard.js")),
 @('legacy role capability budget',@("$root\tools\test_legacy_role_budget_84_109.js")),
 @('frontend role authorization boundary',@("$root\tools\test_frontend_role_authorization_84_109.js")),
 @('master mobile shell visual contract',@("$root\tools\test_master_mobile_shell_visual.js")),
 @('identity API/garage recovery',@("$root\tools\test_r1885607_identity_api_client_garage_recovery.js")),
 @('direct DB API client contract',@("$root\tools\test_direct_db_api_client_84_109.js")),
 @('db monolith decomposition contract',@("$root\tools\test_db_monolith_decomposition_84_109.js")),
 @('API contract smoke suite',@("$root\tools\test_api_contract_smoke_84_109.js")),
 @('PWA release/manifest contract',@("$root\tools\test_release_pwa_contract.js")),
 @('manifest fallback regression',@("$root\tools\test_r1885568428_manifest_fallback.js")),
 @('project audit contracts',@("$root\tools\test_project_audit_r188558410.js")),
 @('browser support matrix',@("$root\tools\test_browser_support_matrix_84_109.js")),
 @('production feature matrix',@("$root\tools\test_production_feature_matrix_84_109.js")),
 @('runtime release metadata',@("$root\tools\test_runtime_release_metadata_84_109.js")),
 @('release notes 84.77-84.109',@("$root\tools\test_release_notes_84_77_84_109.js")),
 @('route lazy loader',@("$root\tools\test_route_lazy_loader_84_66.js")),
 @('master exchange structure',@("$root\tools\test_master_exchange_structure_84_109.js")),
 @('boot bundles fresh',@("$root\tools\build_boot_js_bundles.js",'--check'))
)
$pass=0;$fail=0
foreach($item in $checks){
 $label=$item[0];$args=$item[1]
 $out=& $node @args 2>&1;$rc=$LASTEXITCODE
 if($rc -eq 0){$pass++;Write-Output ("[PASS] "+$label)}
 else{$fail++;Write-Output ("[FAIL] "+$label+" rc="+$rc);$out|Select-Object -Last 30}
}
Write-Output ("NODE_SUMMARY: "+$pass+"/"+($pass+$fail)+" passed; "+$fail+" failed")
if($fail){exit 1}
