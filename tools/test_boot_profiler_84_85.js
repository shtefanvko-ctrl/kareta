'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const logger=read('js/next/runtime_logger.js');
const app=read('js/next/app_next.js');
const builder=read('tools/build_boot_js_bundles.js');
const registry=read('inc/asset_registry.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

expect(logger.includes('window.KaretaBootProfiler = api'),'boot profiler global is not exported from first boot module');
expect(logger.includes("performance.getEntriesByType?.('navigation')")&&logger.includes("performance.getEntriesByType('resource')"),'navigation/resource timing backfill missing');
expect(logger.includes("PerformanceObserver.supportedEntryTypes?.includes?.('longtask')")&&logger.includes("observer.observe({type:'longtask', buffered:true})"),'long-task observer missing');
expect(logger.includes("sessionStorage.setItem('kareta_boot_profile_v1'")&&logger.includes("[KARETA][boot.profile]"),'profile persistence/console report missing');
expect(logger.includes("window.KaretaRuntimeLog?.add?.('boot.profile'"),'boot profile is not attached to runtime logs');
expect(logger.includes("if (/password|token|cookie|authorization|otp|code/i.test(key)) return"),'profiler metadata redaction missing');
expect(logger.includes("bootJsPattern")&&logger.includes("runtime_boot_bundle\\.css")&&logger.includes("asset_manifest\\.php"),'transport attribution is incomplete');

expect(builder.includes('KaretaBootProfiler?.bundleStart')&&builder.includes('KaretaBootProfiler?.bundleEnd'),'generated bundles do not expose execution spans');
try{cp.execFileSync(process.execPath,[path.join(root,'tools/build_boot_js_bundles.js'),'--check'],{stdio:'pipe'});}catch(e){fail.push(`generated boot bundles are stale: ${String(e.stdout||e.stderr||e.message)}`)}
for(const file of ['runtime_onboarding_bundle','runtime_identity_bundle','runtime_shell_bundle','runtime_ui_bundle','runtime_core_bundle']){
  const text=read(`js/boot/${file}.js`);
  expect(text.includes(`bundleStart?.(${JSON.stringify(file)}`),`${file} start marker missing`);
  expect(text.includes(`bundleEnd?.(${JSON.stringify(file)}`),`${file} end marker missing`);
}

expect(app.includes("profilePromise('session.guard'")&&app.includes("profilePromise('session.identity'")&&app.includes("profilePromise('session.legacy'"),'parallel session sub-stages are not profiled');
expect(app.includes("bootProfiler?.start?.('session.wave'")&&app.includes('bootProfiler?.end?.(sessionWaveToken'),'session wave span missing');
expect(app.includes("profilePromise('route.assets.prewarm'")&&app.includes("profilePromise('route.assets.final'"),'route asset warm/final timing missing');
expect(app.includes("bootProfiler?.start?.('route.render'")&&app.includes("markOnce?.('first-render'")&&app.includes("markOnce?.('first-frame'"),'render/first-frame milestones missing');
expect(app.includes("markOnce?.('interactive'")&&app.includes("scheduleReport?.({route:targetRoute})"),'interactive/report completion milestone missing');
expect(app.includes("bootProfiler?.start?.('boot.total'")&&app.includes("bootProfiler?.end?.(bootToken,{ok:true"),'total boot span missing');
expect(registry.includes("'bootProfiler' => 'timeline-v1'"),'asset registry profiler metadata missing');

try{
  const out=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo json_encode(['boot'=>count($r['scripts']),'sources'=>count($r['scriptSources']??[]),'lazy'=>count(kareta_route_asset_paths('scripts'))]);`],{encoding:'utf8'}).trim();
  const d=JSON.parse(out);
  expect(d.boot===11,`boot profiler added a startup request: ${d.boot}`);
  expect(d.sources===72,`canonical source count changed: ${d.sources}`);
  expect(d.lazy===59||d.lazy===60,`unexpected lazy script count: ${d.lazy}`);
}catch(e){fail.push(`registry probe failed: ${e.message}`)}

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(vs===va&&Number(String(va||'').split('.').pop())>=85,'84.85+ asset/SW parity missing');
const freeze=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const rel of ['index.php','js/next/smart_action_hub.js']){
  const expected=freeze.files[rel]; if(!expected)continue;
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
  expect(actual===expected,`protected source changed: ${rel}`);
}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.85 boot profiler OK: 11 boot requests retained; HTML/CSS/manifest/session/bundle/render/interactive timings instrumented');
