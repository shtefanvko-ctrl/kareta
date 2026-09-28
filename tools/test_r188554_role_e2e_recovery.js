'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function roleMatrix(){
  const listeners=new Map();
  let identity={authenticated:false,context:null,capabilities:[],deniedCapabilities:[],revision:0};
  global.location={hash:'#/home'};
  global.BroadcastChannel=undefined;
  global.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
  global.document={
    getElementById:()=>null,
    documentElement:{dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}},
  };
  global.window={
    addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
    dispatchEvent(event){(listeners.get(event.type)||[]).forEach(handler=>handler(event));return true;},
    setTimeout(handler){handler();return 1;},
    KaretaIdentity:{snapshot:()=>identity,has:key=>identity.capabilities.includes('*')||identity.capabilities.includes(key)},
    KaretaRouteRuntime:{navigate(){}},
  };
  const load=file=>vm.runInThisContext(read(file),{filename:file});
  load('js/next/route_registry.js');load('js/next/dynamic_navigation.js');load('js/next/navigation_core.js');

  const cases=[
    {name:'Personal',context:{id:1,key:'personal:1',type:'personal'},caps:['requests.read','requests.create','parts.browse','chats.use','profile.read'],kind:'personal',role:'client',route:'home',action:'requestNew',mobile:['home','services','works','masters','parts','__more__']},
    {name:'Master',context:{id:2,key:'profile:master:2',type:'profile',profileType:'master'},caps:['work_orders.read','requests.read','requests.create','services.manage','parts.browse','chats.use','profile.read'],kind:'master',role:'master',route:'masterDashboard',action:'orders',mobile:['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__']},
    {name:'Seller',context:{id:3,key:'profile:seller:3',type:'profile',profileType:'seller'},caps:['warehouse.stock.manage','market.products.manage','market.orders.read','parts.browse','chats.use','profile.read'],kind:'seller',role:'seller',route:'seller',action:'seller',mobile:['seller','sellerProducts','sellerOrders','parts','chats','__more__']},
    {name:'STO',context:{id:4,key:'organization:4',type:'organization',organizationType:'service_station'},caps:['organization.read','work_orders.manage','requests.read','services.manage','parts.browse','chats.use','profile.read'],kind:'organization_service',role:'sto',route:'stoDashboard',action:'orders',mobile:['stoDashboard','orders','masters','parts','__more__']},
    {name:'Admin',context:{id:5,key:'personal:admin',type:'personal'},caps:['*'],kind:'admin',role:'admin',route:'adminMonitoring',action:'adminMonitoring',mobile:['adminMonitoring','adminUsers','adminOrganizations','adminManagement','platform','__more__']},
  ];
  for(const item of cases){
    identity={authenticated:true,context:item.context,contexts:[item.context],capabilities:item.caps,deniedCapabilities:[],revision:identity.revision+1};
    window.KaretaDynamicNavigation.refresh();
    const snapshot=window.KaretaNavigationCore.refreshAll({redirect:false,source:'r188554-test'});
    assert(snapshot.contextKind===item.kind,`${item.name}: context kind`);
    assert(snapshot.interfaceRole===item.role,`${item.name}: interface role`);
    assert(snapshot.defaultRoute===item.route,`${item.name}: default route ${snapshot.defaultRoute}`);
    assert(snapshot.primaryAction.key===item.action,`${item.name}: primary action ${snapshot.primaryAction.key}`);
    assert(JSON.stringify(snapshot.mobile)===JSON.stringify(item.mobile),`${item.name}: mobile menu ${JSON.stringify(snapshot.mobile)}`);
    assert(document.documentElement.dataset.userRole===item.role,`${item.name}: role dataset`);
  }
}

async function recoveryMatrix(){
  const listeners=new Map(),events=[],calls={load:0,select:0,start:0,stop:0,navigate:0,refresh:0};
  let loadImpl=()=>Promise.resolve({authenticated:true,mode:'identity',context:{id:1,key:'personal:1',type:'personal'},contexts:[{id:1,key:'personal:1',type:'personal'}]});
  const sandbox={
    navigator:{onLine:true},location:{hash:'#/home'},console,Promise,Date,Math,Object,Set,Map,String,Number,Boolean,Array,JSON,
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
    document:{documentElement:{dataset:{},removeAttribute(){}},querySelectorAll:()=>[]},
  };
  sandbox.window={
    addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
    dispatchEvent(event){events.push(event);(listeners.get(event.type)||[]).forEach(handler=>handler(event));return true;},
    setTimeout(handler){handler();return 1;},
    KaretaIdentity:{load:options=>{calls.load+=1;return loadImpl(options);},select:async()=>{calls.select+=1;return {authenticated:true,mode:'identity',context:{id:1,key:'personal:1',type:'personal'},contexts:[{id:1,key:'personal:1',type:'personal'}]};},snapshot:()=>({authenticated:true})},
    KaretaNavigationCore:{refreshAll(){calls.refresh+=1;},resolveRoute:()=> 'home',defaultRoute:()=> 'home'},
    KaretaRouteRegistry:{keyFromHash:()=> 'home'},
    KaretaRouteRuntime:{navigate(_route,options){calls.navigate+=1;assert(options.force===true,'recovery route must force remount');}},
    KaretaContextManager:{render(){}},
    KaretaRealtime:{start(){calls.start+=1;},stop(){calls.stop+=1;}},
    KaretaRuntimeLog:{add(){}},
  };
  Object.assign(sandbox.window,{document:sandbox.document,navigator:sandbox.navigator,location:sandbox.location,CustomEvent:sandbox.CustomEvent});
  sandbox.globalThis=sandbox;sandbox.self=sandbox.window;
  const context=vm.createContext(sandbox);
  const source=read('js/next/recovery_manager.js');
  vm.runInContext(source,context,{filename:'recovery_manager.js'});
  const firstListeners=[...listeners.values()].reduce((sum,rows)=>sum+rows.length,0);
  vm.runInContext(source,context,{filename:'recovery_manager.duplicate.js'});
  const secondListeners=[...listeners.values()].reduce((sum,rows)=>sum+rows.length,0);
  assert(firstListeners===secondListeners,'duplicate recovery module added listeners');
  assert(sandbox.window.__KARETA_RECOVERY_MANAGER_MODULE__.duplicateLoads===1,'duplicate recovery module was not counted');

  let release;
  loadImpl=()=>new Promise(resolve=>{release=resolve;});
  const first=sandbox.window.KaretaRecovery.recoverIdentity('single-flight',{force:true});
  const second=sandbox.window.KaretaRecovery.recoverIdentity('single-flight',{force:true});
  assert(first===second,'recovery did not reuse its in-flight promise');
  release({authenticated:true,mode:'identity',context:{id:1,key:'personal:1',type:'personal'},contexts:[{id:1,key:'personal:1',type:'personal'}]});
  assert(await first===true,'authenticated recovery failed');
  assert(calls.load===1,'single-flight recovery duplicated identity load');
  assert(calls.navigate===1&&calls.start===1,'authenticated recovery did not rebuild the active surface');

  const beforeCooldown=calls.load;
  assert(await sandbox.window.KaretaRecovery.recoverIdentity('cooldown')===false,'cooldown did not suppress immediate recovery');
  assert(calls.load===beforeCooldown,'cooldown still issued an identity request');

  loadImpl=async()=>({authenticated:true,mode:'identity',context:{id:99,key:'removed:99',type:'profile'},contexts:[{id:1,key:'personal:1',type:'personal'}]});
  assert(await sandbox.window.KaretaRecovery.recoverIdentity('removed-context',{force:true})===true,'removed context recovery failed');
  assert(calls.select===1,'removed context did not fall back to personal context');
  assert(events.some(event=>event.type==='kareta:context-recovered'),'context recovered event missing');

  loadImpl=async()=>({authenticated:false,mode:'anonymous',contexts:[],context:null});
  assert(await sandbox.window.KaretaRecovery.recoverIdentity('expired-session',{force:true})===false,'anonymous recovery result must be false');
  assert(events.some(event=>event.type==='kareta:session-anonymous'&&event.detail?.source==='recovery'),'anonymous recovery event missing');
}

async function identitySingleFlight(){
  const events=[];let fetchCalls=0,releaseCurrent;
  const response=(status,payload)=>({ok:status>=200&&status<300,status,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(payload)});
  const sandbox={
    console,structuredClone:value=>JSON.parse(JSON.stringify(value)),
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
    document:{documentElement:{dataset:{}}},
    fetch:async()=>{fetchCalls+=1;if(fetchCalls===1)return new Promise(resolve=>{releaseCurrent=()=>resolve(response(200,{ok:true,authenticated:true,account:{id:7},session:{id:8}}));});return response(200,{ok:true,currentContext:{id:1,type:'personal',key:'personal:7'},contexts:[{id:1,type:'personal',key:'personal:7'}],capabilities:['requests.read']});},
  };
  sandbox.window={dispatchEvent:event=>events.push(event),addEventListener(){}};sandbox.window.window=sandbox.window;
  vm.createContext(sandbox);vm.runInContext(read('js/next/identity_frontend.js'),sandbox,{filename:'identity_frontend.js'});
  const first=sandbox.window.KaretaIdentity.load({force:true}),second=sandbox.window.KaretaIdentity.load({force:true});
  assert(first===second,'identity load did not reuse the in-flight promise');
  releaseCurrent();const identity=await first;
  assert(fetchCalls===2,'identity single-flight duplicated endpoint requests');
  assert(identity.authenticated&&identity.context?.id===1,'identity single-flight returned invalid snapshot');

  let step=0;
  sandbox.fetch=async()=>{step+=1;return step===1?response(200,{ok:true,authenticated:true,account:{id:7}}):response(401,{ok:false,error:'session_required'});};
  const expired=await sandbox.window.KaretaIdentity.load({force:true});
  assert(expired.authenticated===false,'401 identity context did not reset the session');
  assert(events.some(event=>event.type==='kareta:session-expired'),'401 identity context did not publish session expiry');
}

function staticContracts(){
  const identity=read('js/next/identity_frontend.js'),app=read('js/next/app_next.js'),navigation=read('js/next/navigation_core.js'),chats=read('js/next/pages/chats.js'),css=read('css/next/role_runtime_chats.css');
  for(const [source,needle] of [[identity,'let loadFlight = null'],[identity,'kareta:session-expired'],[app,'__KARETA_NEXT_APP_MODULE__'],[navigation,'__KARETA_NAVIGATION_CORE_MODULE__'],[chats,'__KARETA_CHATS_PAGES_MODULE__'],[chats,'data-chat-message-search-input'],[chats,'role="log"'],[chats,"event.key.toLowerCase()==='f'"],[chats,'aria-current="true"'],[css,'.k-chat-message.is-current-match']])assert(source.includes(needle),`missing contract: ${needle}`);
  assert(!chats.includes('CSS.escape('),'chat search still requires CSS.escape');
  for(const width of [320,360,390,768,1024]){
    const layout=width<=760?'mobile':'desktop';
    assert(layout==='mobile'?css.includes('@media(max-width:760px)'):css.includes('.k-chat-main{grid-template-rows:'),`chat layout contract missing at ${width}px`);
  }
}

(async()=>{roleMatrix();await identitySingleFlight();await recoveryMatrix();staticContracts();console.log('R188.5.5.4 role E2E, recovery and chat search tests OK');})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
