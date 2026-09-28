'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const core=read('js/next/pages/core.js');
const request=read('js/next/pages/request.js');
const win=read('js/next/request_window.js');
const homeCss=read('css/next/home_simple.css');
const flowCss=read('css/next/kflow_windows.css');
const bundle=read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

expect(core.includes(`truck:'<svg class="k-home-ref-action-svg"`),'custom tow action icon missing');
expect(core.includes(`diagnostics:'<svg class="k-home-ref-action-svg"`),'custom diagnostics action icon missing');
expect(core.includes(`services:'<svg class="k-home-ref-action-svg"`),'custom repair action icon missing');
expect(core.includes(`car:'<svg class="k-home-ref-action-svg"`),'custom car action icon missing');
expect(homeCss.includes('R188.5.5.6.84.76 — quick-action icon refinement'),'home icon CSS patch missing');
expect(homeCss.includes('background:#fff4ef!important'),'home icon visual container missing');

expect(!win.includes('<header class="k-request-window-bar">'),'request outer window bar still rendered');
expect(win.includes("version:'R188.5.5.6.84.76'"),'request window patch version missing');
expect(request.includes("windowMode=Boolean(context.windowMode||root.classList.contains('is-window'))"),'request modal mode guard missing');
expect(request.includes('window.KaretaRequestWindow.close()'),'request header back does not close modal at step one');
for(const css of [flowCss,bundle]){
  expect(css.includes('.k-request-window-r78 .k-request-window-bar{display:none!important}'),'request bar CSS removal guard missing');
  expect(css.includes('.k-flow-request.is-window>.k-flow-request-header{'),'window sticky header selector missing');
  expect(css.includes('position:sticky!important;top:0!important;z-index:40!important'),'request sticky top header contract missing');
  expect(css.includes('.k-flow-request.is-window .k-flow-request-actions{'),'request action dock selector missing');
  expect(css.includes('bottom:0!important;z-index:35!important'),'request action dock is not pinned to window bottom');
  expect(css.includes('grid-template-columns:1fr!important'),'request action dock still has broken multi-column layout');
  expect(css.includes('html.k-request-window-open #k-mobile-nav{visibility:hidden!important'),'mobile nav is not hidden behind modal request window');
}
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:7[6-9]|[89]\d|\d{3,})$/.test(va)&&vs===va,'84.76+ release version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.76 home icons + request sticky header/action dock: OK');
