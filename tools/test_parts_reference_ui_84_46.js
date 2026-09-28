const fs=require('fs');
const js=fs.readFileSync('js/next/pages/parts.js','utf8');
const css=fs.readFileSync('css/next/parts_native_marketplace.css','utf8');
const av=fs.readFileSync('inc/asset_version.php','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(js.includes('k-parts-ref-page'),'reference page missing');
ok(js.includes('Найти запчасть или VIN'),'reference search missing');
ok(js.includes('data-parts-ref-type="new"'),'new tab missing');
ok(js.includes('#/parts/used'),'used route missing');
ok(js.includes('k-parts-ref-card'),'reference product card missing');
ok(js.includes('data-shop-add'),'cart action missing');
ok(js.includes('data-parts-vehicle-open'),'vehicle compatibility action missing');
ok(css.includes('.k-parts-ref-grid'),'reference grid styles missing');
ok(css.includes('grid-template-columns:repeat(4'),'desktop product grid missing');
ok(/188\.5\.5\.6\.84\.(4[6-9]|[5-9][0-9])/.test(av)&&/188\.5\.5\.6\.84\.(4[6-9]|[5-9][0-9])/.test(sw),'version mismatch');
console.log('R188.5.5.6.84.46 parts reference UI regression: OK');
