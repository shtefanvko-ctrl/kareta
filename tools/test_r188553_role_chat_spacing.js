'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const listeners=new Map();
const events=[];
let identity={authenticated:true,context:{id:1,key:'personal:1',type:'personal'},capabilities:['requests.read','requests.create','parts.browse','chats.use'],revision:1};
global.location={hash:'#/orders'};
global.BroadcastChannel=undefined;
global.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
global.document={
  getElementById:()=>null,
  documentElement:{dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}},
};
global.window={
  addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
  dispatchEvent(event){events.push(event);(listeners.get(event.type)||[]).forEach(handler=>handler(event));return true;},
  setTimeout(handler){handler();return 1;},
  KaretaIdentity:{snapshot:()=>identity,has:key=>identity.capabilities.includes('*')||identity.capabilities.includes(key),select:async()=>{identity={authenticated:true,context:{id:2,key:'profile:master:2',type:'profile',profileType:'master'},capabilities:['work_orders.read','requests.read','services.manage','chats.use'],revision:2};return identity;}},
  KaretaRealtime:{stop(){},start(){}},KaretaRealtimeClient:{stop(){},start(){}},KaretaStateManager:{resetScope(){}},
  KaretaRouteRuntime:{navigate:(key,options)=>{events.push({type:'navigate',key,options});location.hash=window.KaretaRouteRegistry.get(key).path;},transition:(key,options)=>{events.push({type:'transition',key,options});}},
};

const load=file=>vm.runInThisContext(read(file),{filename:file});
load('js/next/route_registry.js');load('js/next/dynamic_navigation.js');load('js/next/navigation_core.js');

(async()=>{
  window.KaretaNavigationCore.refreshAll({redirect:false});
  assert(document.documentElement.dataset.navigationContext==='personal','personal context dataset was not synchronized');
  assert(document.documentElement.dataset.userRole==='client','personal interface role was not synchronized');
  await window.KaretaNavigationCore.switchContext(2);
  assert(document.documentElement.dataset.navigationContext==='master','master context dataset was not synchronized');
  assert(document.documentElement.dataset.userRole==='master','master interface role was not synchronized');
  const remount=events.find(event=>event?.type==='transition'&&event.key==='orders');
  assert(remount?.options?.force===true,'context switch did not force current accessible route remount');
  assert(!events.some(event=>event?.type==='navigate'&&event.key==='masterDashboard'),'context switch unexpectedly forced role default route');
  assert(events.some(event=>event?.type==='kareta:interface-context-changed'&&event.detail?.role==='master'),'interface context event was not published');

  const runtime=read('js/next/route_runtime.js');
  assert(runtime.includes("force:options.force === true"),'route runtime drops the force option');
  const identityFrontend=read('js/next/identity_frontend.js');
  assert(identityFrontend.includes("state.capabilities.includes('*')"),'administrator compatibility role is not derived from capabilities');
  const chats=read('js/next/pages/chats.js');
  for(const needle of ['KaretaNavigationCore?.interfaceRole','data-chat-filter="unread"','data-chat-reply','data-chat-edit','api.updateMessage','kareta:realtime:event','state.scope+=1','replyToId'])assert(chats.includes(needle),`chat contract missing: ${needle}`);
  const details=read('js/next/pages/details.js');
  assert(details.includes("kareta.chat.prefill")&&!details.includes("kareta.chat.draft"),'provider chat draft key is inconsistent');
  assert(details.includes("isSto?'stoId':'masterId'"),'provider chat target is not routed');
  const db=read('api/db.php');
  for(const needle of ['function kareta_chat_actor','kareta_scope_identity_actor','unread_seller','read_seller_at',"'seller'=>['client','sto','admin','owner']"])assert(db.includes(needle),`server chat contract missing: ${needle}`);
  const css=read('css/next/role_surfaces_chat_spacing.css');
  assert(css.includes('html[data-navigation-context="personal"] .k-masters-page')&&css.includes('padding:10px 12px'),'client master spacing override is missing');
  assert(css.includes('.k-chat-composer-mode')&&css.includes('.k-chat-message-actions'),'chat interaction styles are missing');
  console.log('R188.5.5.3 role, chat and master spacing tests OK');
})().catch(error=>{console.error(error.message);process.exit(1);});
