const fs=require('fs');
const css=fs.readFileSync('css/next/community.css','utf8');
const js=fs.readFileSync('js/next/pages/community.js','utf8');
const av=fs.readFileSync('inc/asset_version.php','utf8');
const checks=[
  ['route wrapper exists',js.includes('k-page k-community-page k-community-v2 k-flow-primary-page')],
  ['community width hard-contained',css.includes('.k-community-page.k-community-v2{')&&css.includes('max-width:100%!important')],
  ['root overflow clipped',css.includes('overflow-x:clip!important')],
  ['layout width constrained',css.includes('.k-community-v2 .k-community-layout-v2{width:100%!important;overflow-x:clip!important}')],
  ['tablet tracks can shrink',css.includes('grid-template-columns:minmax(0,61.8fr) minmax(0,38.2fr)!important')],
  ['header constrained',css.includes('.k-community-v2 .k-community-header{overflow:hidden!important}')],
  ['long text wraps',css.includes('overflow-wrap:anywhere')],
  ['mobile outlet selector constrained',css.includes('#k-page-outlet>.k-page.k-community-page.k-community-v2.k-flow-primary-page')],
  ['version 84.52+',(()=>{const m=av.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/);return m&&Number(m[1])>=52;})()]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
