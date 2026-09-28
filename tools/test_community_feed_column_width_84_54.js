'use strict';
const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const ref=read('css/next/reference_client_pages.css');
const community=read('css/next/community.css');
const version=read('inc/asset_version.php');
const checks=[
  ['late reference override exists',ref.includes('R188.5.5.6.84.54 — Community feed-column mobile width ownership')],
  ['legacy mobile 430 cap neutralized later',/R188\.5\.5\.6\.84\.54[\s\S]*?\.k-community-page\.k-community-v2\.k-flow-primary-page\{[\s\S]*?max-width:none!important;/.test(ref)],
  ['community root is border-box in late asset',/R188\.5\.5\.6\.84\.54[\s\S]*?\.k-community-page\.k-community-v2\.k-flow-primary-page\{[\s\S]*?box-sizing:border-box!important;/.test(ref)],
  ['feed-column explicit 100 percent width in late asset',/\.k-flow-community-main\.k-community-feed-column\{[\s\S]*?width:100%!important;[\s\S]*?max-width:100%!important;[\s\S]*?min-width:0!important;/.test(ref)],
  ['feed-column children contained',/\.k-flow-community-main\.k-community-feed-column>\*\{[\s\S]*?max-width:100%!important;/.test(ref)],
  ['community defensive contract exists',community.includes('R188.5.5.6.84.54 — feed column may never exceed its grid track / viewport')],
  ['version 84.54+',/188\.5\.5\.6\.84\.(?:5[4-9]|[6-9]\d|\d{3,})/.test(version)]
];
let fail=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'} ${name}`);if(!ok)fail++;}
if(fail)process.exit(1);
console.log('community feed column width 84.54 OK');
