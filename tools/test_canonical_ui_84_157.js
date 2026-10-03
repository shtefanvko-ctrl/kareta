'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const escapeRe=s=>String(s).replace(/[|\\{}()[\]^$+*?.-]/g,'\\$&');

const registry=read('inc/asset_registry.php');
const index=read('index.php');
const shell=read('js/next/shell_menu.js');
const shellBundle=read('js/boot/runtime_shell_bundle.js');
const icons=read('js/next/ui_icons.js');
const nav=read('js/next/dynamic_navigation.js');
const loader=read('js/next/route_asset_loader.js');
const canonicalCss=read('css/next/canonical_ui_84_157.css');

const staleLogo='assets/onboarding/kareta_logo_full.png';
for(const p of ['inc/asset_registry.php','index.php','js/next/shell_menu.js','js/next/onboarding/onboarding_form_ui.js','js/next/onboarding/pages/role_page.js']){
  expect(!read(p).includes(staleLogo),'noncanonical full logo reference remains in '+p);
}
expect(registry.includes("'assets/logo/main/kareta_logo_full.png'"),'canonical full logo missing from asset registry');
expect(index.includes('assets/logo/main/kareta_logo_full.png'),'canonical full logo missing from shell');
expect(registry.includes("'css/next/canonical_ui_84_157.css'"),'canonical 84.157 UI layer is not eager');

expect(shell.includes("'KaretaUIIcons'"),'burger menu does not require icon registry');
expect(shell.includes('k-menu-link__icon'),'burger icon slot is not canonical');
expect(shell.includes('routeSvg?.(key)'),'burger does not render route SVG');
expect(shell.includes("svg?.('warning')"),'burger icon fallback can still be empty');
expect(shell.includes('k-menu-profile__avatar'),'burger guest/avatar fallback missing');
expect(shellBundle.includes('k-menu-link__icon')&&shellBundle.includes('k-menu-profile__avatar'),'generated shell bundle is stale');

const routeIconsBlock=(icons.match(/const routeIcons = Object\.freeze\(\{([\s\S]*?)\}\);/)||[])[1]||'';
const menuKeys=[...nav.matchAll(/\{\s*key:'([^']+)'[^\n]*?\bmenu:/g)].map(m=>m[1]);
const missingMenuIcons=menuKeys.filter(key=>!new RegExp('(?:^|[,\\s])'+escapeRe(key)+'\\s*:').test(routeIconsBlock));
expect(missingMenuIcons.length===0,'menu routes without canonical SVG icons: '+missingMenuIcons.join(','));

expect(index.includes('class="k-shell-location-icon"')&&index.includes('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21'),'location pin markup missing');
expect(canonicalCss.includes('--k-radius-sm:5px')&&canonicalCss.includes('--k-radius-md:10px')&&canonicalCss.includes('--k-radius-lg:18px'),'canonical radius tokens missing');
expect(canonicalCss.includes('.k-menu-link__icon svg')&&canonicalCss.includes('visibility:visible!important'),'canonical menu SVG visibility guard missing');
expect(canonicalCss.includes('.k-menu-profile__avatar'),'canonical avatar styling missing');

expect(loader.includes('if(link.sheet){complete();return;}'),'lazy CSS timeout does not verify already-applied stylesheet');
expect(loader.includes('kareta_retry=1'),'lazy CSS has no controlled retry');
expect(shellBundle.includes('if(link.sheet){complete();return;}')&&shellBundle.includes('kareta_retry=1'),'generated shell bundle lazy CSS recovery is stale');
expect(registry.includes("'styles' => ['css/next/work_feed.css']"),'work feed CSS is not declared in lazy asset plan');
expect(fs.existsSync(path.join(root,'css/next/work_feed.css')),'work feed CSS file missing');

console.log('CANONICAL_UI_84_157: PASS menuIcons='+menuKeys.length);
