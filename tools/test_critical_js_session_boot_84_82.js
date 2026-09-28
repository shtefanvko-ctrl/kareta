'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const preloader=read('js/next/app_preloader.js');
const app=read('js/next/app_next.js');
const guard=read('js/next/production_guard.js');
const identity=read('js/next/identity_frontend.js');
const identityApi=read('api/identity_session.php');
const asset=read('inc/asset_version.php');const sw=read('sw.js');
try{cp.execFileSync(process.execPath,[path.join(root,'tools/build_boot_js_bundles.js'),'--check'],{stdio:'pipe'});}catch(e){fail.push(`generated boot bundles are stale: ${String(e.stdout||e.stderr||e.message)}`)}
const groups={
 'js/boot/runtime_onboarding_bundle.js':['js/next/welcome_background.js','js/next/onboarding_bridge.js'],
 'js/boot/runtime_identity_bundle.js':['js/next/route_registry.js','js/next/production_guard.js','js/next/identity_frontend.js','js/next/reference_client_shell.js'],
 'js/boot/runtime_shell_bundle.js':['js/next/navigation_core.js','js/next/route_asset_loader.js','js/next/session_resume_runtime.js'],
 'js/boot/runtime_ui_bundle.js':['js/next/page_ui.js','js/next/api_client.js','js/next/slider_runtime.js'],
 'js/boot/runtime_core_bundle.js':['js/next/pages/core.js','js/next/client_surface_modernization_phase3.js'],
};
for(const [bundle,sources] of Object.entries(groups)){
  const full=path.join(root,bundle);expect(fs.existsSync(full),`missing boot bundle ${bundle}`);if(!fs.existsSync(full))continue;
  const text=fs.readFileSync(full,'utf8');let last=-1;
  for(const src of sources){const i=text.indexOf(`SOURCE: ${src}`);expect(i>last,`${bundle} source order broken at ${src}`);last=i;}
  expect(text.includes('GENERATED BOOT BUNDLE'),`${bundle} generated marker missing`);
}
expect(registry.includes("'bootJsMode' => 'grouped-source-bundles-v1'"),'grouped boot JS metadata missing');
expect(registry.includes("'scriptSources' => ["),'canonical script source list missing');
expect(preloader.includes('atomicBaselineLoaded')&&preloader.includes('const mapped=4+Math.round((completed/remaining)*34)'),'progress baseline protection missing');
expect(app.includes("KaretaProductionGuard?.check?.({fast:true})"),'boot does not use fast health probe');
expect(app.includes('Promise.all([guardPromise,identityPromise,legacyPromise])'),'session reads are not parallelized');
expect(app.includes("KaretaProductionGuard?.check?.({force:true})"),'full identity health is not deferred after first paint');
expect(guard.includes("if(options.fast===true)")&&guard.includes("status:'ready-fast'"),'fast production guard path missing');
expect(identity.includes('identity-session-single-roundtrip')&&identity.includes('if(Array.isArray(current.contexts))'),'Identity frontend does not consume one-response contexts');
expect(identityApi.includes("'contexts'=>$contexts")&&identityApi.includes("'accountTypes'=>$ctx->listAccountTypes")&&identityApi.includes("'deniedCapabilities'=>$caps['denied']"),'identity current response does not include full context payload');
try{
 const out=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo json_encode(['boot'=>count($r['scripts']),'sources'=>count($r['scriptSources']??[]),'lazy'=>count(kareta_route_asset_paths('scripts'))]);`],{encoding:'utf8'}).trim();
 const d=JSON.parse(out);expect(d.boot===11,`expected 11 boot script requests, got ${d.boot}`);expect(d.sources===72,`expected 72 canonical source modules, got ${d.sources}`);expect(d.lazy===59||d.lazy===60,`unexpected lazy script count: ${d.lazy}`);
}catch(e){fail.push(`registry probe failed: ${e.message}`)}
const sourceBytes=(()=>{try{const out=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); $sum=0; foreach($r['scriptSources'] as $p){$f=${JSON.stringify(root)}.'/'.$p;if(is_file($f))$sum+=filesize($f);} echo $sum;`],{encoding:'utf8'}).trim();return Number(out)}catch(_){return 0}})();
const bootBytes=Object.keys(groups).reduce((n,f)=>n+fs.statSync(path.join(root,f)).size,0)+['js/next/runtime_logger.js','js/next/runtime_dependencies.js','js/next/recovery_manager.js','js/next/diagnostics_snapshot.js','js/next/app_preloader.js','js/next/app_next.js'].reduce((n,f)=>n+fs.statSync(path.join(root,f)).size,0);
expect(sourceBytes>0&&bootBytes/sourceBytes<1.08,`bundle overhead too high: source=${sourceBytes} boot=${bootBytes}`);
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(vs===va&&Number(String(va||'').split('.').pop())>=82,'84.82+ release parity mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log(`R188.5.5.6.84.82 critical JS + session bootstrap OK: boot requests=11; source modules=72; boot bytes=${bootBytes}`);
