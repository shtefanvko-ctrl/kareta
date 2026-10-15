'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Exercise the private renderer without publishing a new production-global test API.
const accountSource=fs.readFileSync('js/next/account_window.js','utf8');
const exposed=accountSource.replace(/\}\)\(\);\s*$/, 'window.__testNotifications=notificationEventsHtml;})();');
assert.notEqual(exposed,accountSource,'notification renderer must remain discoverable in the existing module');
const registered=[];
const accountWindow={KaretaClientCabinetApi:{},
  addEventListener:(name,fn)=>registered.push(['window',name,fn])};
const accountDocument={addEventListener:(name,fn,capture)=>registered.push(['document',name,fn,capture])};
vm.runInNewContext(exposed,{window:accountWindow,document:accountDocument,setTimeout:()=>0,console});
assert(registered.some(([scope,event,fn,capture])=>scope==='document'&&event==='click'&&typeof fn==='function'&&capture===true),
  'account window must retain its capturing click handler');
assert(registered.some(([scope,event])=>scope==='window'&&event==='hashchange'),
  'account window route lifecycle handler must remain registered');
const render=accountWindow.__testNotifications;
assert.equal(typeof render,'function');
for(const response of [
  {ok:false,status:503},
  {ok:false,status:401},
  {ok:false,status:403},
  {ok:true,payload:{}},
  {ok:true,payload:{data:{}}}
]){
  const markup=render(response);
  assert.match(markup,/role="alert"/,'fail-closed notification state');
  assert.match(markup,/data-account-notify-retry/,'failure can be retried');
  assert.doesNotMatch(markup,/Новых событий нет/,'failure must not masquerade as no notifications');
}
assert.match(render({ok:false,status:401}),/Сессия завершена/);
assert.match(render({ok:false,status:403}),/Нет доступа/);
assert.match(render({ok:true,payload:{notifications:[]}}),/Новых событий нет/);
assert.match(render({ok:true,payload:{data:{notifications:[]}}}),/Новых событий нет/);
const notified=render({ok:true,payload:{notifications:[{title:'<img onerror=alert(1)>',body:'Test & check',action_url:'#/orders'}]}});
assert.match(notified,/&lt;img/,'API fields must be HTML-escaped');
assert.match(notified,/Test &amp; check/);
assert.match(notified,/href="#\/orders"/);
assert.doesNotMatch(notified,/role="alert"/);

// The existing document route must show capability-accurate copy in RU/KK/EN.
// No new route, uploader, backend OCR or replacement garage form is introduced.
const scannerSource=fs.readFileSync('js/next/pages/scanner.js','utf8');
assert.match(scannerSource,/KaretaDocumentOCR\?\.available\?\.\(\)\?ocr\.ready:t\[16\]/);
for(const lang of ['ru','kk','en']){
  const handlers={};
  const stage={innerHTML:'',querySelector:()=>null};
  const camera={files:null,addEventListener:(type,fn)=>handlers.camera=fn,removeEventListener(){}};
  const gallery={files:null,addEventListener:(type,fn)=>handlers.gallery=fn,removeEventListener(){}};
  const nodes={'[data-doc-stage]':stage,'[data-doc-camera]':camera,'[data-doc-gallery]':gallery,'[data-doc-status]':{textContent:''},'[data-doc-title]':{textContent:''},'[data-doc-back-link]':{textContent:''}};
  const root={isConnected:true,querySelector:sel=>nodes[sel]||null,addEventListener:(event,fn)=>handlers[event]=fn,removeEventListener(){}};
  let capable=true,removed=0;
  const w={KaretaRouteRegistry:{keyFromHash:()=> 'scannerDocument'},KaretaNavigationCore:{interfaceRole:()=> 'client'},KaretaDocumentOCR:{available:()=>capable},KaretaUIIcons:{svg:()=>''}};
  const d={documentElement:{lang},querySelector:()=>root};
  const sandbox={window:w,document:d,location:{hash:'#/scan/document'},URL:{createObjectURL:f=>'blob:'+f.name,revokeObjectURL:()=>removed++},console};
  vm.runInNewContext(scannerSource,sandbox);
  const life={isActive:()=>true,addCleanup:()=>{}};
  w.KaretaScannerPages.mount({lifecycle:life});
  const click=action=>handlers.click({target:{closest:()=>({dataset:{docNext:action}})}});
  const upload=(where,name)=>{const el=where==='front'?camera:gallery;el.files=[{type:'image/jpeg',size:1000,name}];handlers[where==='front'?'camera':'gallery']({target:el});};
  upload('front','front.jpg');click('rear');upload('gallery','rear.jpg');click('ready');
  assert.match(stage.innerHTML,/data-doc-next="recognize"/,'OCR supported: recognize action');
  const readyCopy={ru:/Если распознавание доступно/,kk:/Тану қолжетімді болса/,en:/If recognition is available/};
  assert.match(stage.innerHTML,readyCopy[lang]);
  capable=false;
  click('rear');click('ready');
  assert.doesNotMatch(stage.innerHTML,/data-doc-next="recognize"/,'no false OCR available button');
  const unavailable={ru:/Автоматическое распознавание полей/,kk:/Техпаспорт деректерін автоматты тану/,en:/Automatic document OCR is not yet available/};
  assert.match(stage.innerHTML,unavailable[lang]);
}
console.log('PASS redflags: notification API failures vs empty state, OCR capability copy RU/KK/EN');
