'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const source=read('css/next/mobile_brand_center.css');
const bundle=read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
for(const css of [source,bundle]){
  expect(css.includes('@media (max-width:860px)'), 'mobile breakpoint missing');
  expect(css.includes('#k-shell-header > .k-brand'), 'brand selector missing');
  expect(css.includes('left:50%!important'), 'brand is not centered horizontally');
  expect(css.includes('top:50%!important'), 'brand is not centered vertically');
  expect(css.includes('transform:translate(-50%,-50%)!important'), 'brand centering transform missing');
  expect(css.includes('object-position:center center!important'), 'brand image is not center-aligned');
}
expect(/188\.5\.5\.6\.84\.(?:7[3-9]|[89]\d|\d{3,})/.test(asset),'84.73+ asset version missing');
expect(/188\.5\.5\.6\.84\.(?:7[3-9]|[89]\d|\d{3,})/.test(sw),'84.73+ service worker version missing');
if(fail.length){ console.error(fail.join('\n')); process.exit(1); }
console.log('R188.5.5.6.84.73 mobile brand center regression OK');
