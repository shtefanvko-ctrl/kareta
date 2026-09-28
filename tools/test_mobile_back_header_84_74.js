'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const index=read('index.php');
const logic=read('js/next/mobile_back.js');
const source=read('css/next/mobile_brand_center.css');
const bundle=read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

// Shell HTML remains frozen; runtime moves the SAME node before binding it.
expect((index.match(/id="k-mobile-back"/g)||[]).length===1,'duplicate #k-mobile-back nodes in frozen shell');
expect(index.includes('<div id="k-mobile-fab-stack"')&&index.indexOf('id="k-mobile-back"')>index.indexOf('<div id="k-mobile-fab-stack"'),'frozen shell baseline unexpectedly changed');
expect(logic.includes('function ensureHeaderPlacement()'),'runtime header placement function missing');
expect(logic.includes("document.getElementById('k-shell-header')"),'shell header lookup missing');
expect(logic.includes("header.querySelector(':scope > .k-brand')"),'brand placement anchor missing');
expect(logic.includes('header.insertBefore(backButton, brand || header.firstChild)'),'same back node is not moved to header left before brand');
expect(logic.includes('const backButton = ensureHeaderPlacement();'),'placement is not performed before event binding');

// Existing functional contract remains unchanged.
expect(logic.includes("backButton.addEventListener('click', back)"),'back click binding changed/missing');
expect(logic.includes('window.KaretaNavigationState?.back'),'navigation-state back logic changed/missing');
expect(logic.includes('history.back()'),'browser history fallback changed/missing');
expect(logic.includes('backButton.hidden = !shouldShowBack(hash)'),'route visibility logic changed/missing');
expect(logic.includes('backButton.dataset.fallback = fallbackFor(hash)'),'route fallback mapping changed/missing');

for(const css of [source,bundle]){
  expect(css.includes('#k-shell-header > #k-mobile-back.k-mobile-back'),'header back selector missing');
  expect(css.includes('left:max(12px,env(safe-area-inset-left,0px))!important'),'header back is not pinned left with safe area');
  expect(css.includes('top:50%!important'),'header back vertical centering missing');
  expect(css.includes('transform:translateY(-50%)!important'),'header back vertical transform missing');
  expect(css.includes('#k-shell-header > #k-mobile-back[hidden]{display:none!important}'),'hidden contract missing');
}
expect(source.includes('#k-shell-header > .k-brand')&&source.includes('left:50%!important'),'84.73 centered brand regressed');
expect(/188\.5\.5\.6\.84\.(?:7[4-9]|[89]\d|\d{3,})/.test(asset),'84.74+ asset version missing');
expect(/188\.5\.5\.6\.84\.(?:7[4-9]|[89]\d|\d{3,})/.test(sw),'84.74+ service worker version missing');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.74 mobile back runtime-relocated into shell header: OK');
