'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const root=path.resolve(__dirname,'..');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const listeners=new Map();
let active={authenticated:true,mode:'identity',context:{id:1,key:'personal:1',type:'personal'},capabilities:['requests.read','requests.create'],deniedCapabilities:[]};
const events=[];
global.location={hash:'#/home'};global.BroadcastChannel=undefined;global.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
global.document={getElementById:()=>null,documentElement:{dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}}};
global.window={
  addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
  dispatchEvent(event){(listeners.get(event.type)||[]).forEach(handler=>handler(event));return true;},
  setTimeout(handler){handler();return 1;},
  KaretaIdentity:{snapshot:()=>active,has:key=>active.capabilities.includes('*')||active.capabilities.includes(key),select:async id=>{events.push('select');active=scenarios[id];return active;}},
  KaretaRealtime:{stop:()=>events.push('stop'),start:()=>events.push('start')},KaretaRealtimeClient:{stop(){},start(){}},
  KaretaStateManager:{resetScope:()=>events.push('reset')},KaretaRouteRuntime:{navigate:key=>{events.push('navigate:'+key);location.hash=window.KaretaRouteRegistry.get(key).path;},transition:(key,options)=>{events.push('transition:'+key);events.push({type:'transition',key,options});}},
};
const load=file=>vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
load('js/next/route_registry.js');load('js/next/dynamic_navigation.js');load('js/next/navigation_core.js');
const scenarios={
  1:{authenticated:true,mode:'identity',context:{id:1,key:'personal:1',type:'personal'},capabilities:['requests.read','requests.create','parts.browse'],deniedCapabilities:[]},
  2:{authenticated:true,mode:'identity',context:{id:2,key:'profile:master:2',type:'profile',profileType:'master'},capabilities:['work_orders.read','requests.read','requests.create','services.manage'],deniedCapabilities:[]},
  3:{authenticated:true,mode:'identity',context:{id:3,key:'organization:org_sto_1',type:'organization',organizationType:'service_station'},capabilities:['organization.read','work_orders.manage','work_orders.assign','requests.read','requests.create','services.manage'],deniedCapabilities:[]},
  4:{authenticated:true,mode:'identity',context:{id:4,key:'profile:seller:4',type:'profile',profileType:'seller'},capabilities:['market.products.manage','market.orders.read','warehouse.stock.manage','parts.browse','chats.use'],deniedCapabilities:[]},
  5:{authenticated:true,mode:'identity',context:{id:5,key:'organization:org_shop_1',type:'organization',organizationType:'parts_store'},capabilities:['market.products.manage','market.orders.read','warehouse.stock.manage','parts.browse','chats.use'],deniedCapabilities:[]},
  6:{authenticated:true,mode:'identity',context:{id:6,key:'personal:admin',type:'personal'},capabilities:['*'],deniedCapabilities:[]},
};
const expectations={1:['personal','home'],2:['master','masterDashboard'],3:['organization_service','stoDashboard'],4:['seller','seller'],5:['organization_store','seller'],6:['admin','adminMonitoring']};
(async()=>{
  for(const [id,[kind,route]] of Object.entries(expectations)){active=scenarios[id];window.KaretaDynamicNavigation.refresh();assert(window.KaretaNavigationCore.contextKind()===kind,`context kind ${id}`);assert(window.KaretaNavigationCore.defaultRoute()===route,`default route ${id}`);assert(window.KaretaDynamicNavigation.canAccess('requestNew')===[1,2,3,6].includes(Number(id)),`request creation scope ${id}`);}
  active=scenarios[4];window.KaretaDynamicNavigation.refresh();const sellerMobile=window.KaretaNavigationCore.mobileItems();assert(sellerMobile.length===6,'seller six-button navigation');assert(sellerMobile.includes('sellerOrders'),'seller product orders route');assert(!sellerMobile.includes('orders'),'service orders leaked into seller navigation');
  active=scenarios[5];window.KaretaDynamicNavigation.refresh();const storeMobile=window.KaretaNavigationCore.mobileItems();assert(storeMobile.includes('sellerProducts')&&storeMobile.includes('sellerOrders'),'store workspace routes');
  assert(window.KaretaRouteRegistry.get('sellerOrders').path==='#/seller/orders','seller order path');
  active=scenarios[1];location.hash='#/orders';events.length=0;await window.KaretaNavigationCore.switchContext(2);assert(events.indexOf('stop')<events.indexOf('select'),'realtime stops before select');assert(events.includes('transition:orders'),'accessible route preserved and remounted');assert(!events.includes('navigate:masterDashboard'),'context switch must not force master dashboard when current route is accessible');assert(events.lastIndexOf('start')>events.indexOf('select'),'realtime restarts after select');
  const orderScope=fs.readFileSync(path.join(root,'api/order_scope.php'),'utf8');assert(orderScope.includes('kareta_scope_identity_actor')&&orderScope.includes('organizationKey'),'identity order isolation contract');
  const identityContext=fs.readFileSync(path.join(root,'api/identity/context_service.php'),'utf8');assert(identityContext.includes("$organizationId=$organizationKey!==''?$organizationKey"),'organization key compatibility alias');
  const domain=fs.readFileSync(path.join(root,'api/domain.php'),'utf8');assert(domain.includes('$context = $identityDecision->context')&&domain.includes("$context['organizationId'] = $organizationKey"),'domain uses selected Identity context');assert(domain.includes('JOIN calendar_events c ON c.id=b.calendar_event_id'),'booking date resolved through calendar event');
  const capabilities=fs.readFileSync(path.join(root,'api/identity/capability_registry.php'),'utf8');assert(capabilities.includes("'market.manage' => 'market.products.manage'"),'legacy market capability canonicalized');
  const sellerApi=fs.readFileSync(path.join(root,'api/seller_shop.php'),'utf8');assert(sellerApi.includes("seller_actor($pdo,['market.products.manage'])")&&sellerApi.includes("seller_actor($pdo,['market.orders.fulfill','market.orders.manage'])"),'seller writes require action capabilities');assert(sellerApi.includes("['session_required','identity_account_unavailable']"),'seller fallback rejects invalid Identity context');
  const adminApi=fs.readFileSync(path.join(root,'api/admin_operations.php'),'utf8');assert(adminApi.includes("catch(DomainException $e)")&&adminApi.includes('admin_identity_resolution_failed'),'admin fallback rejects invalid Identity context');
  console.log('R188.5 role-context scenarios OK');
})().catch(error=>{console.error(error.message);process.exit(1);});
