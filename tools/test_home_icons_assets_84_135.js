const fs=require('fs');
const root='/home/karetakz/sites/kareta.kz';
const read=p=>fs.readFileSync(root+'/'+p,'utf8');
const a=(v,m)=>{if(!v)throw new Error(m)};
const home=read('css/next/home_simple.css');
const state=read('js/next/onboarding/onboarding_state.js');
const icons=read('js/next/ui_icons.js');
const visuals=read('js/next/visual_assets.js');
const index=read('index.php');
const builder=read('tools/build_boot_js_bundles.js');
const identity=read('js/boot/runtime_identity_bundle.js');
const onboarding=read('js/boot/runtime_onboarding_bundle.js');
const registry=read('inc/asset_registry.php');
const version=read('inc/asset_version.php');

a(home.includes('R188.5.5.6.84.135 — Client Home responsive composition with right rail.'),'84.135 Home contract missing');
a(!home.includes('grid-template-columns:repeat(12,minmax(0,1fr))'),'old 12-column Home desktop layout remains');
a(!home.includes('grid-column:9/-1'),'old split quick-actions placement remains');
a(home.includes('@media (min-width:600px) and (max-width:899px)'),'tablet Home breakpoint missing');
a(home.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'),'tablet Home action/grid contract missing');
a(home.includes('@media (min-width:900px)'),'desktop Home breakpoint missing');
a(home.includes('grid-template-columns:repeat(6,minmax(0,1fr))!important'),'desktop Home quick actions missing');

a(state.includes("localStorage.getItem('kareta_onboarding_completed_at')"),'legacy completed timestamp recovery missing');
a(state.includes("localStorage.getItem('kareta.auth.user')"),'legacy confirmed user recovery missing');
a(onboarding.includes('Compatibility for users completed before FLOW_KEY became authoritative.'),'onboarding runtime bundle stale');

for(const name of ['oil','battery','brakes','tires','suspension','paint','airFilter','sparkPlug','serviceStation']){
  a(icons.includes(name+':'), 'icon missing: '+name);
}
a(icons.includes("tire:'tires'")&&icons.includes("tyres:'tires'"),'tire aliases missing');
a(icons.includes("categories:'grid'"),'categories alias missing');

a(visuals.includes("const ready=document.documentElement.dataset.referenceAssets==='1'"),'visual asset readiness gate missing');
a(visuals.includes("const ext=document.documentElement.dataset.referenceAssetsExt||'png'"),'reference asset extension resolver missing');
a(visuals.includes("asset('automotive','toyota_camry')"),'Toyota reference asset resolver missing');
a(visuals.includes("toyota:'/assets/vehicles/toyota_camry_r62u.svg'"),'vehicle fallback missing');
a(index.includes('data-reference-assets="<?= $referenceAssetsReady ? \'1\' : \'0\' ?>"'),'server reference-assets flag missing');
a(builder.includes("'js/next/ui_icons.js','js/next/visual_assets.js','js/next/reference_client_shell.js'"),'visual_assets absent from boot builder');
a(identity.includes('SOURCE: js/next/visual_assets.js'),'visual_assets absent from runtime identity bundle');
a(!registry.includes("'cssHomeResponsive84134'"),'obsolete Home lazy override still registered');
a(/const KARETA_ASSET_VERSION = '188\.5\.5\.6\.84\.\d+';/.test(version),'release marker missing');
for(const file of ['js/next/pages/core.js','js/next/pages/parts.js','js/next/pages/masters.js','js/next/pages/vehicle.js']){
  const src=read(file);
  a(!/[★☆☻›→×⚙⊙]/.test(src),'legacy glyph icon remains in '+file);
}
console.log('HOME_ICONS_ASSETS: PASS');
