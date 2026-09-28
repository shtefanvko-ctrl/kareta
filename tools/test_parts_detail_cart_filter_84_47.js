const fs=require('fs');
const details=fs.readFileSync('js/next/pages/details.js','utf8');
const parts=fs.readFileSync('js/next/pages/parts.js','utf8');
const css=fs.readFileSync('css/next/parts_windows_product_detail.css','utf8');
const av=fs.readFileSync('inc/asset_version.php','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(details.includes('k-parts-ref-detail'),'reference detail class missing');
ok(details.includes('k-parts-ref-detail-actions'),'reference detail actions missing');
ok(parts.includes('k-parts-ref-filter-dialog'),'reference filter dialog missing');
ok(parts.includes('k-parts-ref-cart-dialog'),'reference cart dialog missing');
ok(css.includes('R188.5.5.6.84.47'),'84.47 css contract missing');
ok(css.includes('bottom:76px'),'mobile sticky CTA missing');
ok(css.includes('border-radius:22px 22px 0 0'),'mobile bottom sheets missing');
ok(av.includes('188.5.5.6.84.47')&&sw.includes('188.5.5.6.84.47'),'version mismatch');
console.log('R188.5.5.6.84.47 parts detail/cart/filter regression: OK');
