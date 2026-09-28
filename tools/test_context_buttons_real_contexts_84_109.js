'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/context_manager.js'),'utf8');
const bundle=fs.readFileSync(path.join(root,'js/boot/runtime_identity_bundle.js'),'utf8');

function render(snapshot){
  const listeners={};
  const host={dataset:{},hidden:true,innerHTML:'',addEventListener(){}};
  const ctx={console,CustomEvent:class{},document:{
    documentElement:{dataset:{}},
    getElementById:id=>id==='k-context-switcher'?host:null
  },window:{
    addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);},
    dispatchEvent(){},
    KaretaUIIcons:{svg:n=>`<svg data-icon="${n}"></svg>`},
    KaretaIdentity:{snapshot:()=>snapshot,load:async()=>snapshot,has:()=>false,reset(){}},
    KaretaToast:{success(){},error(){}},
    KaretaShellMenu:{close(){}}
  }};
  ctx.window.window=ctx.window;
  ctx.window.document=ctx.document;
  ctx.window.CustomEvent=ctx.CustomEvent;
  vm.runInNewContext(source,ctx,{filename:'context_manager.js'});
  for(const fn of listeners['kareta:identity-ready']||[]) fn({detail:snapshot});
  return host;
}

const personal={id:1,key:'personal:1',type:'personal',label:'Личный кабинет'};
const master={id:2,key:'profile:master:1',type:'profile',profileType:'master',label:'Мастер'};
const sto={id:3,key:'org:sto:1',type:'organization',organizationType:'service_station',label:'СТО Test'};
const seller={id:4,key:'org:shop:1',type:'organization',organizationType:'parts_store',label:'Магазин Test'};
const unknownOrg={id:5,key:'org:other:1',type:'organization',organizationType:'other',label:'Other Org'};
const accountTypes=['client','master','sto','seller'].map(role=>({role,status:'active'}));
const base={loaded:true,loading:false,authenticated:true,accountTypes,capabilities:[],deniedCapabilities:[],error:''};

const clientOnly=render({...base,contexts:[personal],context:personal});
assert(clientOnly.innerHTML.includes('<b>Клиент</b>'),'real personal context missing');
assert(!clientOnly.innerHTML.includes('<b>СТО</b>'),'STO synthesized from accountTypes');
assert(!clientOnly.innerHTML.includes('<b>Магазин</b>'),'seller synthesized from accountTypes');
const all=render({...base,contexts:[personal,master,sto,seller,unknownOrg],context:personal});
for(const label of ['Клиент','Мастер','СТО','Магазин']){
  assert(all.innerHTML.includes(`<b>${label}</b>`),`real ${label} context missing`);
}
assert(!all.innerHTML.includes('Other Org'),'unsupported organization type must not masquerade as STO');
assert(all.innerHTML.includes('Доступно контекстов: 4'),'summary must count only renderable real contexts');
assert(source.includes('const contexts=availableContexts();'),'server-driven context filter missing');
assert(!source.includes('VISIBLE_CONTEXT_OPTIONS'),'hardcoded visibility lock must be removed');
assert(source.includes("organization==='service_station'?'sto':organization==='parts_store'?'seller':''"),'organization mapping must fail closed');
assert(bundle.includes('const contexts=availableContexts();'),'runtime identity bundle stale');
console.log('CONTEXT_BUTTONS_REAL_CONTEXTS_84_109: PASS');
