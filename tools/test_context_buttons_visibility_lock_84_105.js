'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/context_manager.js'),'utf8');
const bundle=fs.readFileSync(path.join(root,'js/boot/runtime_identity_bundle.js'),'utf8');

function render(snapshot, legacyUser=null){
  const listeners={};
  const host={dataset:{},hidden:true,innerHTML:'',addEventListener(){}};
  const ctx={
    console,
    document:{documentElement:{dataset:{}},getElementById:id=>id==='k-context-switcher'?host:null},
    CustomEvent:class{},
    window:{
      addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn)},
      dispatchEvent(){},
      KaretaUIIcons:{svg:n=>`<svg data-icon="${n}"></svg>`},
      KaretaIdentity:{snapshot:()=>snapshot,load:async()=>snapshot,has:()=>false,reset(){}},
      KaretaToast:{success(){},error(){}},
      KaretaShellMenu:{close(){}}
    }
  };
  ctx.window.window=ctx.window; ctx.window.document=ctx.document; ctx.window.CustomEvent=ctx.CustomEvent;
  vm.runInNewContext(source,ctx,{filename:'context_manager.js'});
  if(legacyUser){
    for(const fn of listeners['kareta:session-confirmed']||[]) fn({detail:{legacy:true,user:legacyUser,identity:{authenticated:false}}});
  }else{
    for(const fn of listeners['kareta:identity-ready']||[]) fn({detail:snapshot});
  }
  return host.innerHTML;
}

const contexts=[
  {id:1,key:'personal:1',type:'personal',label:'Личный кабинет'},
  {id:2,key:'profile:master:1',type:'profile',profileType:'master',label:'Мастер'},
  {id:3,key:'org:sto:1',type:'organization',organizationType:'service_station',label:'СТО Test'},
  {id:4,key:'org:store:1',type:'organization',organizationType:'parts_store',label:'Магазин Test'}
];
const snapshot={loaded:true,loading:false,authenticated:true,contexts,accountTypes:[
  {role:'client',status:'active'},{role:'master',status:'active'},{role:'sto',status:'active'},{role:'seller',status:'active'}
],context:contexts[0],capabilities:[],deniedCapabilities:[],error:''};

const modern=render(snapshot);
assert(modern.includes('<b>Клиент</b>'),'client button missing');
assert(modern.includes('<b>Мастер</b>'),'master button missing');
assert(!modern.includes('<b>СТО</b>'),'STO leaked into modern context switcher');
assert(!modern.includes('<b>Магазин</b>'),'shop leaked into modern context switcher');
assert(modern.includes('Клиент и Мастер используют один номер телефона.'),'context note must only describe visible account types');

assert(source.includes("VISIBLE_CONTEXT_OPTIONS.map(legacyRoleChoice).join('')"),'legacy picker must use visible client/master options only');
assert(!source.includes("ROLE_OPTIONS.map(legacyRoleChoice).join('')"),'legacy picker must not render all backend account types');

assert(source.includes("const VISIBLE_CONTEXT_OPTIONS=Object.freeze(ROLE_OPTIONS.filter(option=>CONTEXT_BUTTON_ROLES.has(option.key)))"),'explicit visible-options lock missing');
assert(bundle.includes("const VISIBLE_CONTEXT_OPTIONS=Object.freeze(ROLE_OPTIONS.filter(option=>CONTEXT_BUTTON_ROLES.has(option.key)))"),'runtime identity bundle stale');
assert(source.includes("['master','sto','seller']"),'backend account-type support was accidentally removed');
console.log('R188.5.5.6.84.105 context visibility lock OK');
