const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(p,'utf8');
const lifecycle=read('js/next/onboarding/onboarding_lifecycle.js');
const rolePage=read('js/next/onboarding/pages/role_page.js');
const formUi=read('js/next/onboarding/onboarding_form_ui.js');
const state=read('js/next/onboarding/onboarding_state.js');
const index=read('index.php');
const registry=read('inc/asset_registry.php');
const catalog=read('js/next/catalog_cards.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const textRoots=['index.php','inc','js','storage'];
let svgRefs=[];
function walk(p){
  const st=fs.statSync(p);
  if(st.isDirectory()) for(const n of fs.readdirSync(p)) walk(path.join(p,n));
  else if(/\.(?:php|js|json|html|css)$/i.test(p)){
    const s=read(p);
    if(/kareta_logo_(?:full|icon)\.svg/.test(s)) svgRefs.push(p);
  }
}
for(const p of textRoots) if(fs.existsSync(p)) walk(p);
const checks={
  'png full external or exists':!fs.existsSync('assets')||fs.existsSync('assets/onboarding/kareta_logo_full.png'),
  'png icon external or exists':!fs.existsSync('assets')||fs.existsSync('assets/onboarding/kareta_logo_icon.png'),
  'obsolete full svg absent when bundled':!fs.existsSync('assets')||!fs.existsSync('assets/onboarding/kareta_logo_full.svg'),
  'obsolete icon svg absent when bundled':!fs.existsSync('assets')||!fs.existsSync('assets/onboarding/kareta_logo_icon.svg'),
  'no logo svg references':svgRefs.length===0,
  'index uses png brand':index.includes("kareta_logo_full.png")&&index.includes("kareta_logo_icon.png"),
  'registry uses png brand':registry.includes("kareta_logo_full.png")&&registry.includes("kareta_logo_icon.png"),
  'catalog png fallback':catalog.includes('kareta_logo_icon.png'),
  'onboarding form png':formUi.includes('kareta_logo_full.png'),
  'welcome png':rolePage.includes('class="onb2-welcome-logo" src="assets/onboarding/kareta_logo_full.png"'),
  'welcome greeting':rolePage.includes('Добро пожаловать!')&&rolePage.includes('Всё для автомобиля<br>в одном месте'),
  'welcome is lifecycle step':lifecycle.includes("Object.freeze(['welcome','role','profile','code'])"),
  'fresh entry starts welcome':lifecycle.includes("stage:'welcome', pending:true")&&lifecycle.includes("const step = 'welcome';"),
  'onboarding state exposes reset':state.includes('function reset')&&state.includes('reset, subscribe'),
  'welcome route remains lifecycle-owned':lifecycle.includes("Object.freeze(['welcome','role','profile','code'])"),
  'asset version':asset.includes('r1885596-png-brand-welcome-restoration'),
  'sw version':sw.includes('r1885596-png-brand-welcome-restoration'),
};
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
if(bad.length){console.error('FAIL '+bad.join(', ')+' svgRefs='+svgRefs.join(','));process.exit(1)}
console.log('OK R188.5.5.6.36 PNG brand + welcome restoration');
