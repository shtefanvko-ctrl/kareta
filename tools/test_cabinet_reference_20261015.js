'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'js/next/pages/cabinet.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/next/client_cabinet.css'),'utf8');
const nodes=Object.fromEntries(['k-master-cabinet-active','k-master-cabinet-done','k-master-cabinet-rating','k-master-cabinet-revenue'].map(id=>[id,{textContent:'—'}]));
const status={textContent:''};
let role='master', response={ok:false,payload:{message:'Статистика недоступна'}};
const window={
  KaretaPageUI:{escHtml:String},
  KaretaClientCabinetApi:{},
  KaretaUIIcons:{svg:()=>'<svg></svg>'},
  KaretaNavigationCore:{interfaceRole:()=>role},
  KaretaApiClient:{request:async()=>response}
};
const document={querySelector:selector=>selector==='[data-master-cabinet-status]'?status:null,getElementById:id=>nodes[id]||null};
vm.runInNewContext(script,{window,document,location:{hash:'#/cabinet'},console});
const pages=window.KaretaCabinetPages;
const master=pages.renderCabinet();
assert(master.includes('data-cabinet-role="master"'));
for(const route of ['#/master/profile','#/master/schedule','#/orders','#/services/manage','#/finance','#/community','#/chats','#/parts','#/notifications','#/cabinet/settings'])
  assert(master.includes('href="'+route+'"'),route);
assert.equal((master.match(/Публичный профиль/g)||[]).length,1);
role='sto';
const sto=pages.renderCabinet();
assert(sto.includes('data-cabinet-role="sto"'));
for(const route of ['#/sto','#/orders','#/services/manage','#/finance','#/community','#/chats'])
  assert(sto.includes('href="'+route+'"'),route);
assert(!sto.includes('id="k-master-cabinet-active"'));
role='client';
assert(pages.renderCabinet().includes('data-native-ui="client-account"'));
role='master';
(async()=>{
  await pages.mountCabinet();
  assert.equal(status.textContent,'Статистика недоступна');
  assert.equal(nodes['k-master-cabinet-active'].textContent,'—');
  response={ok:true,payload:{data:{metrics:{activeOrders:3,completedOrders:0,rating:4.8,revenueMonth:10000}}}};
  await pages.mountCabinet();
  assert.equal(status.textContent,'');
  assert.equal(nodes['k-master-cabinet-active'].textContent,'3');
  assert.equal(nodes['k-master-cabinet-done'].textContent,'0');
  assert.equal(nodes['k-master-cabinet-rating'].textContent,'4.8');
  assert(css.includes('.k-staff-section .k-staff-cabinet-grid{grid-template-columns:minmax(0,1fr)'));
  console.log('PASS cabinet reference 2026-10-15: role routing, mobile layout, real-data/error states');
})().catch(e=>{console.error(e);process.exitCode=1;});
