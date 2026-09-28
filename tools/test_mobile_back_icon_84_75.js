'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const logic=read('js/next/mobile_back.js');
const source=read('css/next/mobile_brand_center.css');
const bundle=read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const svg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"></path><path d="M9 12h11"></path></svg>';
expect(logic.includes(`const BACK_ICON_SVG = '${svg}'`),'requested back SVG constant missing');
expect(logic.includes('backButton.innerHTML = BACK_ICON_SVG'),'existing back node does not receive requested SVG');
expect(logic.includes("backButton.dataset.iconVersion = '84.75'"),'back icon idempotence guard missing');
expect(logic.includes("backButton.addEventListener('click', back)"),'back click logic regressed');
expect(logic.includes('window.KaretaNavigationState?.back'),'navigation-state back logic regressed');
for(const css of [source,bundle]){
  expect(css.includes('#k-shell-header > #k-mobile-back.k-mobile-back'),'header back selector missing');
  expect(css.includes('border:0!important'),'back border was not removed');
  expect(css.includes('box-shadow:none!important'),'back shadow was not removed');
  expect(css.includes('outline:none!important'),'back outline was not removed');
  expect(css.includes('stroke:currentColor!important'),'SVG stroke contract missing');
}
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:7[5-9]|[89]\d|\d{3,})$/.test(va)&&vs===va,'84.75+ release version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.75 mobile back clean icon + exact SVG: OK');
