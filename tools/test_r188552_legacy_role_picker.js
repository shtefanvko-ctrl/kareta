'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const listeners=new Map();
const hostListeners=new Map();
let closed=0;
let selected='';
let onboarding=null;
let identity={
  loaded:true,
  loading:false,
  authenticated:false,
  account:null,
  contexts:[{id:22,key:'profile:master:22',type:'profile',profileType:'master',label:'Профиль мастера'}],
  context:null,
  capabilities:[],
  deniedCapabilities:[],
  error:''
};

const host={
  hidden:true,
  innerHTML:'',
  dataset:{},
  addEventListener(name,handler){hostListeners.set(name,handler);},
  querySelector(){return null;}
};

global.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
global.document={documentElement:{dataset:{}},getElementById:id=>id==='k-context-switcher'?host:null};
global.window={
  addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
  dispatchEvent(event){(listeners.get(event.type)||[]).forEach(handler=>handler(event));},
  KaretaIdentity:{snapshot:()=>identity,load:async()=>identity,reset:()=>identity,has:()=>false},
  KaretaNavigationCore:{switchContext:async target=>{selected=String(target);identity={...identity,context:identity.contexts.find(item=>String(item.id)===String(target))};return identity;}},
  KaretaShellMenu:{close:()=>{closed++;}},
  KaretaToast:{success(){},error(){}},
  KaretaUIIcons:{svg:name=>`<svg data-icon="${name}"></svg>`},
  KaretaOnboardingNavigation:{to:(step,options)=>{onboarding={step,options};}}
};

vm.runInThisContext(read('js/next/context_manager.js'),{filename:'context_manager.js'});
window.dispatchEvent(new CustomEvent('kareta:session-confirmed',{detail:{legacy:true,user:{id:7,role:'client'}}}));

setTimeout(()=>{
  try{
    assert(host.hidden===false,'legacy context switcher stayed hidden');
    assert(host.innerHTML.includes('class="k-context-legacy"'),'legacy picker was not rendered');
    for(const label of ['Клиент','Мастер','СТО','Магазин'])assert(host.innerHTML.includes(label),`legacy role is missing: ${label}`);
    assert(host.innerHTML.includes('aria-current="true" disabled'),'current legacy role is not marked active');
    assert(host.innerHTML.includes('data-context-switch-select="22"'),'server-confirmed master context is not switchable');
    assert(host.innerHTML.includes('href="#role:sto:role"')&&host.innerHTML.includes('data-context-role-create="sto"'),'СТО creation route is missing');
    assert(host.innerHTML.includes('href="#role:seller:role"')&&host.innerHTML.includes('data-context-role-create="seller"'),'seller creation route is missing');

    let prevented=false;
    const createTarget={closest(selector){return selector==='[data-context-role-create]'?{dataset:{contextRoleCreate:'sto'}}:null;}};
    hostListeners.get('click')({target:createTarget,preventDefault(){prevented=true;}});
    assert(prevented&&onboarding?.step==='role'&&onboarding?.options?.role==='sto','legacy role creation did not open the requested onboarding role');

    const switchTarget={closest(selector){return selector==='[data-context-switch-select]'?{dataset:{contextSwitchSelect:'22'}}:null;}};
    hostListeners.get('click')({target:switchTarget,preventDefault(){}});

    setTimeout(()=>{
      try{
        assert(selected==='22','server context switch was not delegated to Navigation Core');
        assert(window.KaretaContextManager.getState().selected?.id===22,'selected server context was not synchronized');
        assert(closed===2,'drawer was not closed after create/switch actions');
        const hub=read('js/next/smart_action_hub.js');
        assert(!hub.includes('class="k-smart-action-'+'center"'),'Smart Action panel still creates a duplicate center button');
        const css=read('css/next/context_switcher_more_layouts.css');
        assert(!css.includes('.k-smart-action-'+'center'),'obsolete center styles are still registered');
        console.log('R188.5.5.2 legacy role picker tests OK');
      }catch(error){console.error(error.message);process.exitCode=1;}
    },0);
  }catch(error){console.error(error.message);process.exitCode=1;}
},0);
