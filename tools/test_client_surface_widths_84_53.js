'use strict';
const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const community=read('css/next/community.css');
const masters=read('css/next/masters.css');
const primary=read('css/next/kflow_primary_pages.css');
const parts=read('css/next/parts_native_marketplace.css');
const client=read('css/next/client_surface_layout.css');
const ver=read('inc/asset_version.php');
const checks=[
  ['client surfaces have requested 43px margin',/scroll-padding-inline:\s*var\(--k-client-page-gutter\);\s*margin-bottom:\s*43px(?:\s*!important)?;/.test(client)],
  ['community 84.53 viewport contract',community.includes('R188.5.5.6.84.53 — Community mobile viewport ownership')],
  ['community no inline containment shrink',community.includes('contain:none!important')],
  ['community mobile media stays in parent',community.includes('.k-community-v2 .k-community-post-media{\n    width:100%!important;\n    max-width:100%!important;')],
  ['community mobile sheets fit parent',community.includes('width:100%!important;\n    max-width:100%!important;\n    transform:none!important;')],
  ['masters reference caps removed',community.length>0 && masters.includes('R188.5.5.6.84.53 — Masters width ownership') && /\.k-master-reference-inner\{[\s\S]*?width:100%!important;[\s\S]*?max-width:none!important;/.test(masters)],
  ['masters primary cap removed',/\.k-masters-page\.k-flow-primary-page\{[\s\S]*?width:100%!important;[\s\S]*?max-width:none!important;/.test(primary)],
  ['parts root uses border-box',/\.k-parts-native-page\.k-parts-ref-page\{[\s\S]*?box-sizing:border-box!important;/.test(parts)],
  ['parts categories contained',parts.includes('.k-parts-ref-categories{\n  width:100%!important;\n  overflow:hidden!important;')],
  ['parts mobile category rail scrolls internally',parts.includes('overflow-x:auto!important;') && parts.includes('flex:0 0 min(112px,38vw)!important;')],
  ['version 84.53+',/188\.5\.5\.6\.84\.(?:5[3-9]|[6-9]\d|\d{3,})/.test(ver)]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'} ${name}`);if(!ok)fail++;}
if(fail)process.exit(1);
console.log('client surface widths 84.53 OK');
