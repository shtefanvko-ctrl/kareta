const fs=require('fs');
const css=fs.readFileSync('css/next/reference_client_pages.css','utf8');
const core=fs.readFileSync('js/next/pages/core.js','utf8');
const av=fs.readFileSync('inc/asset_version.php','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function assert(x,m){if(!x)throw new Error(m)}
assert(!css.includes('.k-home-ref-chips{display:none!important}'),'popular services still hidden');
assert(css.includes('.k-home-ref-chips{display:flex!important'),'mobile popular rail missing');
for(const name of ['Замена масла','Диагностика','Шиномонтаж']) assert(core.includes(name),`missing ${name}`);
assert(av.includes('188.5.5.6.84.45')&&sw.includes('188.5.5.6.84.45'),'version mismatch');
console.log('R188.5.5.6.84.45 home popular services regression: OK');
