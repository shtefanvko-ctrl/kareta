const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const css=read('css/next/desktop_full_width.css');
const app=read('css/next/app_next.css');
function ok(v,m){if(!v)throw new Error(m)}
ok(app.includes('--k-page-max:2400px;'),'canonical app page max must be 2400');
ok(css.includes('@media (min-width: 901px)'),'desktop-only contract missing');
ok(css.includes('#k-page-outlet > .k-page'),'root page authority missing');
ok(css.includes('max-width: var(--k-page-max, 2400px) !important'),'2400 max rule missing');
ok(css.includes('.k-home-simple'),'home page not covered');
ok(css.includes('.k-client-cabinet'),'client cabinet not covered');
ok(css.includes('.k-sto-workplace-page'),'STO workplace not covered');
ok(!/@media\s*\(max-width/.test(css),'release override must not modify mobile widths');
console.log('R1885597 desktop full-width test OK');
