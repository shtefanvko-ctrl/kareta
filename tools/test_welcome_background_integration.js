const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const exists = p => fs.existsSync(path.join(root,p));
const assert = (ok,msg) => { if(!ok){ console.error('[FAIL]',msg); process.exit(1); } };

const welcomeManifestPath='assets/onboarding/backgrounds/welcome/manifest.json';
const errorManifestPath='assets/errors/403/manifest.json';
assert(exists(welcomeManifestPath),'welcome manifest missing');
assert(exists(errorManifestPath),'403 manifest missing');
const welcome=JSON.parse(read(welcomeManifestPath));
const err403=JSON.parse(read(errorManifestPath));
assert(welcome.screen==='onboarding.welcome','welcome manifest screen mismatch');
assert(['city-calm','road-assist','service-map'].includes(welcome.activeTheme),'unexpected active welcome theme');
for(const key of ['city-calm','road-assist','service-map']){
  const theme=welcome.themes?.[key];
  assert(theme,`theme missing: ${key}`);
  for(const sourceKey of ['mobile','desktopNarrow','desktopStandard','desktopUltrawide']){
    const rel=theme.sources?.[sourceKey];
    assert(rel,`${key}.${sourceKey} missing`);
    const abs=path.resolve(root,'assets/onboarding/backgrounds/welcome',rel);
    assert(fs.existsSync(abs),`background file missing: ${abs}`);
  }
}
assert(err403.screen==='errors.403','403 manifest screen mismatch');
assert(Object.keys(err403.backgrounds||{}).length===8,'403 background count must be 8');
for(const [key,item] of Object.entries(err403.backgrounds||{})){
  assert(item.path,`403 path missing: ${key}`);
  const abs=path.resolve(root,'assets/errors/403',item.path);
  assert(fs.existsSync(abs),`403 file missing: ${abs}`);
}

const registry=read('inc/asset_registry.php');
for(const asset of ['css/next/welcome_background.css','css/next/error_403_background.css','js/next/welcome_background.js','js/next/error_403_background.js']){
  assert(registry.includes(`'${asset}'`),`registry missing ${asset}`);
}
const loader=read('js/next/welcome_background.js');
assert(loader.includes('activeTheme'),'welcome loader must use activeTheme');
assert(loader.includes("cache:'no-cache'"),'welcome manifest must bypass stale cache');
assert(loader.includes('desktopUltrawide') && loader.includes('desktopNarrow'),'responsive source selection missing');
const preloader=read('js/next/app_preloader.js');
assert(preloader.includes('KaretaWelcomeBackground?.ready'),'preloader is not waiting for welcome background readiness');
assert(preloader.includes('1400'),'preloader background fallback timeout missing');

const role=read('js/next/onboarding/pages/role_page.js');
const match=role.match(/  function welcomeStepHtml\(\)\{[\s\S]*?\n  \}\n\n  function roleStepHtml/);
assert(match,'welcomeStepHtml block missing');
assert(match[0].includes('<h1>Добро пожаловать!</h1>'),'welcome reference title mismatch');
assert(match[0].includes('Всё для автомобиля<br>в одном месте'),'welcome reference subtitle mismatch');
assert(match[0].includes('>Начать</button>'),'welcome reference CTA mismatch');
assert(registry.includes("'css/next/onboarding_kflow_reference.css'"),'onboarding reference CSS missing');

const version=read('inc/asset_version.php').match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)?.[1]||'';
assert(/^188\.5\.5\.6\.84\.\d+$/.test(version),'short asset version mismatch');
assert(version.length<=32,'asset version too long');
console.log('[OK] welcome/403 manifest background integration');
