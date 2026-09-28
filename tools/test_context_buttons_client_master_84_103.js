'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/context_manager.js'),'utf8');
const listeners={};
const host={dataset:{},hidden:true,innerHTML:'',addEventListener(){}};
const contexts=[
  {id:1,key:'personal:1',type:'personal',label:'Личный кабинет'},
  {id:2,key:'profile:master:1',type:'profile',profileType:'master',label:'Мастер'},
  {id:3,key:'org:sto:1',type:'organization',organizationType:'service_station',label:'СТО Test'},
  {id:4,key:'org:store:1',type:'organization',organizationType:'parts_store',label:'Магазин Test'}
];
const snapshot={loaded:true,loading:false,authenticated:true,contexts,accountTypes:[
  {role:'client',status:'active'},{role:'master',status:'active'},{role:'sto',status:'active'},{role:'seller',status:'active'}
],context:contexts[0],capabilities:[],deniedCapabilities:[],error:''};
const ctx={
  console,
  document:{documentElement:{dataset:{}},getElementById:id=>id==='k-context-switcher'?host:null},
  CustomEvent:class{},
  window:{
    addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn)},
    dispatchEvent(){},
    KaretaUIIcons:{svg:n=>`<svg data-icon="${n}"></svg>`},
    KaretaIdentity:{snapshot:()=>snapshot,load:async()=>snapshot,has:()=>false},
    KaretaToast:{success(){},error(){}},
    KaretaShellMenu:{close(){}}
  }
};
ctx.window.window=ctx.window;
ctx.window.document=ctx.document;
ctx.window.CustomEvent=ctx.CustomEvent;
vm.runInNewContext(source,ctx,{filename:'context_manager.js'});
for(const fn of listeners['kareta:identity-ready']||[])fn({detail:snapshot});
assert(host.innerHTML.includes('<b>Клиент</b>'),'client context button missing');
assert(host.innerHTML.includes('<b>Мастер</b>'),'master context button missing');
assert(!host.innerHTML.includes('<b>СТО</b>'),'STO must not render in k-context-buttons');
assert(!host.innerHTML.includes('<b>Магазин</b>'),'seller must not render in k-context-buttons');
assert(host.innerHTML.includes('Клиент и Мастер'),'visible context summary not updated');
assert(source.includes("['master','sto','seller']"),'STO/seller backend account-type capability was accidentally removed');
console.log('R188.5.5.6.84.103 context buttons client/master only OK');
