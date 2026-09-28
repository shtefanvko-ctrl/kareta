'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const listeners=new Map();
let fetchCalls=0;
const host={hidden:true,innerHTML:'',dataset:{},addEventListener(){},querySelector(){return null;}};
const documentElement={dataset:{},classList:{toggle(){},add(){},remove(){}}};
const storage={data:new Map(),setItem(key,value){this.data.set(key,String(value));},getItem(key){return this.data.get(key)||null;},removeItem(key){this.data.delete(key);}};
const windowObject={
  addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
  dispatchEvent(event){(listeners.get(event.type)||[]).forEach(handler=>handler(event));},
  KaretaNext:{state:{}},
  KaretaOnboardingState:{role:value=>String(value||'client'),isDone:()=>false,markComplete:value=>value},
  KaretaOnboardingProfileDraft:{read:()=>({role:'client',phone:'+77000000000',name:'Тест'}),audit:()=>({})},
  KaretaOnboardingRouter:{parse:()=>null},
  KaretaOnboardingApi:{},
  KaretaUIIcons:{svg:()=>'<svg></svg>'},
  KaretaRuntimeLog:{add(){}},
};
const context=vm.createContext({
  window:windowObject,
  document:{documentElement,body:{classList:{toggle(){}}},getElementById:id=>id==='k-context-switcher'?host:null},
  fetch:async()=>{fetchCalls++;throw new Error('unexpected_fetch');},
  localStorage:storage,
  sessionStorage:storage,
  CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
  structuredClone:value=>JSON.parse(JSON.stringify(value)),
  console,
  Date,
  JSON,
});

vm.runInContext(read('js/next/identity_frontend.js'),context,{filename:'identity_frontend.js'});
vm.runInContext(read('js/next/context_manager.js'),context,{filename:'context_manager.js'});
vm.runInContext(read('js/next/onboarding/onboarding_app.js'),context,{filename:'onboarding_app.js'});

const identityPayload={
  ok:true,authenticated:true,
  account:{id:15,phone:'+77000000000',personId:22},
  session:{id:31,currentContextId:41,expiresAt:'2026-08-12 00:00:00'},
  contexts:[{id:41,key:'personal:15',type:'personal',label:'Личный кабинет'}],
  currentContext:{id:41,key:'personal:15',type:'personal',label:'Личный кабинет'},
  capabilities:['order.create'],deniedCapabilities:[],
};
const user=windowObject.KaretaOnboardingApp.synchronizeSession({user:{id:9,name:'Тест',phone:'+77000000000',role:'client'},identity:identityPayload},{role:'client'});
const identity=windowObject.KaretaIdentity.snapshot();
const manager=windowObject.KaretaContextManager.getState();
assert(user.role==='client','confirmed user was not synchronized');
assert(identity.authenticated&&identity.account.id===15&&identity.context.id===41,'Identity payload was not hydrated');
assert(manager.selected?.id===41&&manager.contexts.length===1,'Context manager did not accept hydrated Identity state');
assert(windowObject.KaretaNext.state.identityReady===true,'application Identity state was not marked ready');
assert(documentElement.dataset.identityMode==='identity','document identity mode was not updated');
assert(fetchCalls===0,'onboarding hydration triggered an unnecessary Context API request');

const managerSource=read('js/next/context_manager.js');
assert(!managerSource.includes('options.allowLegacyBridge||state.legacyUser'),'legacy bridge is still enabled by local user presence');
const authSource=read('api/auth_session.php');
assert((authSource.match(/'identity'\s*=>\s*\$identity/g)||[]).length>=2,'onboarding responses do not include Identity state');
const bridge=read('api/identity/onboarding_identity_bridge.php');
for(const needle of ['KaretaAccountService','KaretaProfileService','KaretaSessionService','KaretaIdentityContextService'])assert(bridge.includes(needle),`server bridge dependency missing: ${needle}`);
const migration=read('api/migrations/100_onboarding_identity_session_bridge.php');
for(const table of ['accounts','persons','person_profiles','contexts','context_members'])assert(migration.includes(`INSERT INTO ${table}`),`migration backfill missing: ${table}`);
console.log('R188.5.5.1 onboarding Identity tests OK');
