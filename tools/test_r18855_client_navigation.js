'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const expected=['home','services','works','masters','parts','__more__'];

let identity={authenticated:false,mode:'anonymous',context:null};
const html={
  dataset:{identityMode:'legacy-fallback',userRole:'client'},
  classList:{add(){},remove(){}},
  setAttribute(){},
  removeAttribute(){}
};
const registry={
  has:key=>expected.includes(key)||['requestNew','cabinetSettings'].includes(key),
  get:key=>({path:key==='works'?'#/works':`#/${key}`,label:key,icon:key}),
  keyFromHash:()=>'',
};
const navigation={
  canAccess:key=>registry.has(key),
  items:()=>[],
  menuSections:()=>[{id:'account',keys:['cabinetSettings']}],
  defaultRoute:()=> 'home',
  refresh(){},
};
const listeners=new Map();
const windowObject={
  KaretaRouteRegistry:registry,
  KaretaDynamicNavigation:navigation,
  KaretaIdentity:{snapshot:()=>identity,has:()=>false},
  KaretaNext:{state:{user:{id:77,role:'client',phone:'+77000000000'}}},
  addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
  dispatchEvent(){},
  setTimeout(handler){handler();},
};
const context=vm.createContext({
  window:windowObject,
  document:{documentElement:html,getElementById:()=>null},
  location:{hash:'#/home'},
  crypto:{randomUUID:()=> 'r18855-test'},
  CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
  BroadcastChannel:undefined,
  console,
  setTimeout:handler=>handler(),
});
vm.runInContext(read('js/next/navigation_core.js'),context,{filename:'navigation_core.js'});

const core=windowObject.KaretaNavigationCore;
assert(core.contextKind()==='personal','legacy client was not mapped to personal context');
assert(JSON.stringify(core.mobileItems())===JSON.stringify(expected),'legacy client mobile navigation order is incorrect');

identity={authenticated:true,mode:'identity',context:{type:'personal'}};
html.dataset.identityMode='identity';
delete html.dataset.userRole;
windowObject.KaretaNext.state.user=null;
assert(core.contextKind()==='personal','Identity personal context was not detected');
assert(JSON.stringify(core.mobileItems())===JSON.stringify(expected),'Identity client mobile navigation order is incorrect');

identity={authenticated:false,mode:'anonymous',context:null};
html.dataset.identityMode='anonymous';
delete html.dataset.userRole;
assert(core.contextKind()==='anonymous','anonymous visitor was incorrectly promoted to client');

const app=read('js/next/app_next.js');
assert(app.includes('dataset.userRole')&&app.includes('roleAccess.normalizeRole?.(activeRole)'),'active role is not synchronized to document state');
const hub=read('js/next/smart_action_hub.js');
const personalStart=hub.indexOf('personal:Object.freeze([');
const masterStart=hub.indexOf('master:Object.freeze([');
const personalBlock=hub.slice(personalStart,masterStart);
assert(personalStart>=0&&personalBlock.includes("key:'cabinetSettings',label:'Настройки'"),'Settings is missing from client More menu');
const routeRegistry=read('js/next/route_registry.js');
assert(routeRegistry.includes("works:Object.freeze({ path:'#/works', label:'Сообщество'"),'Community route is missing or renamed');
assert(routeRegistry.includes("parts:Object.freeze({ path:'#/parts', label:'Запчасти'"),'Parts route label is not canonical');
assert(!routeRegistry.includes("label:'Новые запчасти'"),'Legacy parts route label returned');
const shellNav=read('js/next/shell_nav.js');
assert(shellNav.includes("personal:{parts:'Запчасти'"),'Personal shell parts label is not canonical');
assert(!shellNav.includes("personal:{parts:'Market'"),'Legacy personal Market label returned');
const css=read('css/next/client_mobile_navigation.css');
assert(css.includes('--k-mobile-nav-count: 6 !important')&&css.includes('repeat(6, minmax(0, 1fr))'),'six-column client CSS contract is missing');
console.log('R188.5.5 client navigation tests OK');
