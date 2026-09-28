'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const app=read('js/next/app_next.js');
const guard=read('js/next/production_guard.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

const warm=(app.match(/async function warmSession\(\)\{([\s\S]*?)\n  \}\n\n  function startInitialRouteWarmup/)||[])[1]||'';
expect(warm.includes('guardPromise')&&warm.includes('identityPromise')&&warm.includes('legacyPromise'),'session reads are not started independently');
expect(warm.includes('Promise.all([guardPromise,identityPromise,legacyPromise])'),'session/DB reads are no longer parallel');
expect(warm.includes('state.bootGuardSnapshot=guard||null'),'fast DB/version probe is not persisted for version parity');

const verify=(app.match(/async function verifyRuntimeVersion\(\)\{([\s\S]*?)\n  \}\n\n  let serviceWorkerRegistrationFlight/)||[])[1]||'';
expect(verify.includes('state.bootGuardSnapshot'),'version parity does not reuse warmSession guard result');
expect(!verify.includes('apiClient.request')&&!verify.includes('fetch('),'verifyRuntimeVersion performs a second network request');
expect(verify.includes("resetServiceWorkerRuntime('server-app-mismatch',serverVersion)"),'server/app mismatch recovery regressed');
expect(verify.includes('runtime.sw.handoff_pending'),'stale SW handoff contract regressed');

const startWarm=(app.match(/function startInitialRouteWarmup\(\)\{([\s\S]*?)\n  \}\n\n  async function ensureInitialRouteReady/)||[])[1]||'';
expect(startWarm.includes('routeRegistry.keyFromHash(location.hash)'),'initial deep-link is not identified before session wait');
expect(startWarm.includes('routeAssetLoader.ensureRoute(key)'),'initial static route assets are not started early');
expect(!/api\//.test(startWarm),'route warmup performs protected/API data reads before session');

const ensureWarm=(app.match(/async function ensureInitialRouteReady\(routeKey\)\{([\s\S]*?)\n  \}\n\n  async function hydrateApiSnapshot/)||[])[1]||'';
expect(ensureWarm.includes('await warmup.promise'),'boot does not reuse the in-flight initial route load');
expect(ensureWarm.includes('routeAssetLoader.ensureRoute(key)'),'failed/mismatched route warmup has no fail-closed retry');

const idxStart=app.indexOf('startInitialRouteWarmup();');
const idxWarm=app.indexOf('await warmSession();');
const idxVerify=Math.max(app.indexOf('if (!(await verifyRuntimeVersion())) return;'),app.indexOf("if (!(await profilePromise('version.verify',verifyRuntimeVersion()"));
const idxGate=Math.max(app.indexOf("await window.KaretaMasterOnboardingGate?.check?.({ redirect:false, source:'app-boot' })"),app.indexOf("await profilePromise('onboarding.gate'"));
const idxReady=app.indexOf('await ensureInitialRouteReady(targetRoute);');
const idxRender=app.indexOf("routeRuntime.transition(targetRoute, { source:'boot' })");
expect(idxStart>=0&&idxWarm>idxStart,'route assets do not overlap session hydration');
expect(idxVerify>idxWarm,'version parity still creates a serial pre-session network stage');
expect(idxGate>idxVerify,'master onboarding gate order changed unexpectedly');
expect(idxReady>idxGate&&idxRender>idxReady,'route readiness is not guaranteed before first render');
expect(app.includes("preloader?.update?.(68, 'Загрузка интерфейса…'"),'route preparation status still exposes route-specific loading churn');

expect(guard.includes("const ping=await readJson(`/api/db.php?action=ping&identity_probe=${Date.now()}`)"),'single fast DB/version probe missing');
expect(!app.includes("api/db.php?action=ping&_=${Date.now()}"),'old duplicate version ping remains in app boot');

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(vs===va&&Number(String(va||'').split('.').pop())>=84,'84.84+ asset/SW version parity missing');
const freeze=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const rel of ['index.php','js/next/smart_action_hub.js']){
  const expected=freeze.files[rel];
  if(!expected)continue;
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
  expect(actual===expected,`protected source changed: ${rel}`);
}

if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.84 first-paint waterfall cut OK: duplicate version ping removed; initial route assets overlap session hydration');
