'use strict';
// Focused E2 source/render contracts. PHP syntax, authenticated E2E and live database acceptance remain separate.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const widgetsSource=fs.readFileSync(path.join(root,'js/next/dashboard_widgets.js'),'utf8');
const page=fs.readFileSync(path.join(root,'js/next/pages/admin_workspaces.js'),'utf8');
const api=fs.readFileSync(path.join(root,'api/admin_operations.php'),'utf8');
const css=fs.readFileSync(path.join(root,'css/next/workspace_admin.css'),'utf8');
const registered=new Map();
const document={documentElement:{lang:'ru'}};
const htmlEsc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const window={KaretaDashboardEngine:{register:w=>registered.set(w.key,w)},KaretaUIKit:{esc:htmlEsc}};
vm.runInNewContext(widgetsSource,{window,document,Intl,Number,Math,Array,Object,String});
let checked=0;
function check(name,fn){fn();checked++;console.log('PASS admin E2: '+name);}
check('frontend modules parse',()=>{new Function(widgetsSource);new Function(page);});
check('six business KPIs use nullable database contract',()=>{
  const metric=registered.get('admin.metrics');
  assert.ok(metric,'admin.metrics registered');
  const html=metric.render({businessCounts:{accounts:0,orders:12,masters:4,sto:3,shops:null,sellerProducts:8}});
  for(const key of ['accounts','orders','masters','sto','shops','sellerProducts'])assert.ok(html.includes('data-admin-metric="'+key+'"'),key);
  assert.ok(html.includes('<b>0</b>'),'real zero must display as zero');
  assert.ok(html.includes('<b>—</b>'),'missing source must display unavailable symbol');
  assert.ok(html.includes('Нет данных'),'missing source must have text');
  assert.ok(!html.includes('NaN'),'must not render invalid numbers');
  assert.ok(!html.includes('12 458'),'demo counts cannot be embedded');
});
check('seven-day trend renders real inputs and unavailable state',()=>{
  const widget=registered.get('admin.activity7d');
  assert.ok(widget,'admin.activity7d registered');
  const days=['2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15'];
  const html=widget.render({activity7d:{days,accounts:[1,0,3,4,0,2,5],orders:[0,2,0,1,3,4,7]}});
  assert.ok(html.includes('k-admin-week-chart__days'));
  assert.equal((html.match(/k-admin-week-chart__day"/g)||[]).length,7);
  assert.ok(html.includes('title="Заказы: 7"'));
  const unavailable=widget.render({activity7d:{days,accounts:null,orders:null}});
  assert.ok(unavailable.includes('Нет данных'));
});
check('RU/KK/EN labels resolve without full route replacement',()=>{
  const data={businessCounts:{accounts:5,orders:0,masters:2,sto:1,shops:3,sellerProducts:4}};
  for(const [lang,needle] of [['ru','Аккаунты'],['kk','Аккаунттар'],['en','Accounts']]){
    document.documentElement.lang=lang;
    assert.ok(registered.get('admin.metrics').render(data).includes(needle),lang);
  }
});
check('read-only SQL has fixed domain sources and no fake counts',()=>{
  for(const source of ["FROM orders","FROM person_profiles WHERE profile_type='master'","FROM organizations WHERE type='service_station'","FROM organizations WHERE type='parts_store'","FROM seller_products"]){
    assert.ok(api.includes(source),source);
  }
  assert.ok(api.includes('function ao_metric('));
  assert.ok(api.includes('catch(Throwable $_e){return null;}'),'query failures are not fake zeros');
  assert.ok(api.includes("['accounts','orders']"),'seven-day table allowlist');
  assert.ok(api.includes("'businessCounts'=>$business"));
  assert.ok(api.includes("'activity7d'=>$activity"));
});
check('dashboard stays in one existing monitoring page and fails visibly',()=>{
  assert.ok(page.includes("widgets:['admin.metrics','admin.activity7d','admin.audit']"));
  assert.ok(page.includes('admin_dashboard_engine_unavailable'));
  assert.ok(page.includes('data-admin-page="users"'));
  assert.ok(page.includes('data-admin-page="organizations"'));
  assert.ok(page.includes('data-admin-page="management"'));
});
check('responsive chart CSS is scoped and valid',()=>{
  for(const token of ['.k-admin-business-kpis','.k-admin-week-chart__days','@media(max-width:380px)'])assert.ok(css.includes(token),token);
  assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
});
console.log('Admin E2 focused source/widget checks: '+checked+' PASS; PHP lint and live auth/runtime NOT RUN here.');
