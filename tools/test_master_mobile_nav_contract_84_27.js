'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(cond,msg)=>{if(!cond){console.error('FAIL:',msg);process.exit(1)}};

const navSource=read('js/next/navigation_core.js');
const cssCurrent=read('css/next/master_mobile_nav.css');
const cssDedup=read('css/next/master_orders_dedup.css');
const migration=read('api/migrations/132_master_navigation_capabilities.php');
const config=read('config.php');
const manifest=JSON.parse(read('api/migration_manifest.json'));

must(navSource.includes("master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'])"),'MASTER mobile template changed');
must(navSource.includes("if (kind !== 'master')"),'MASTER must not receive generic mobile fallback routes');
must(navSource.includes("result.push('__more__')"),'More control finalization missing');
must(!cssDedup.includes('#k-mobile-nav'),'obsolete MASTER dedup layer still owns navigation geometry');
must(cssCurrent.includes('--k-mobile-nav-count:6;')&&cssCurrent.includes('repeat(6,minmax(0,1fr))'),'primary MASTER mobile CSS is not six columns');
must(!cssCurrent.includes('!important')&&!cssCurrent.includes('font-size:8px'),'primary MASTER mobile CSS still uses legacy forced overrides');
must(migration.includes("'version' => 132"),'migration 132 version missing');
must(migration.includes("['services.manage','profile.read']"),'MASTER navigation capability reconciliation incomplete');
const declaredDb=Number((config.match(/KARETA_DB_VERSION',\s*(\d+)/)||[])[1]||0);
must(declaredDb>=132,'DB target regressed below migration 132');
must(Number(manifest.targetDbVersion)===declaredDb,'migration manifest target does not match declared DB version');
const m132=manifest.migrations.find(x=>Number(x.version)===132);
must(m132&&m132.file==='132_master_navigation_capabilities.php','migration 132 missing from manifest');
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/migrations/132_master_navigation_capabilities.php'))).digest('hex');
must(m132.sha256===sha,'migration 132 manifest checksum mismatch');

const allRoutes=new Set(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','home','orders','chats','services','works','masters']);
const allowed=new Set(['masterDashboard','masterExchange','parts']);
const registry={
  has:key=>allRoutes.has(key),
  get:key=>({path:key==='masterDashboard'?'#/master':'#/'+key,label:key,icon:''}),
  keyFromHash:hash=>hash==='#/master'?'masterDashboard':String(hash||'').replace(/^#\//,''),
};
const dynamic={
  canAccess:key=>allowed.has(key),
  items:surface=>surface==='mobile'?['home','masterDashboard','masterExchange','orders','chats','__more__']:[],
  menuSections:()=>[{id:'main',keys:['home','orders','chats','cabinet','serviceManagement']}],
  defaultRoute:()=> 'masterDashboard',
  refresh:()=>{},
};
const rootElement={dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}};
const windowObj={
  KaretaRuntimeDependencies:{missing:()=>[],deferScript:()=>{}},
  KaretaRouteRegistry:registry,
  KaretaDynamicNavigation:dynamic,
  KaretaIdentity:{snapshot:()=>({authenticated:true,mode:'identity',revision:1,context:{id:7,key:'profile:master:7',type:'profile',profileType:'master'},capabilities:[]}),has:()=>false},
  addEventListener:()=>{}, dispatchEvent:()=>{}, setTimeout:(fn)=>{if(typeof fn==='function')fn();},
};
const context={
  window:windowObj,
  document:{currentScript:{src:''},documentElement:rootElement,body:null},
  crypto:{randomUUID:()=> 'test-tab'},
  BroadcastChannel:undefined,
  CustomEvent:function CustomEvent(name,opts){this.type=name;this.detail=opts?.detail;},
  location:{hash:'#/master'},
  history:{replaceState:()=>{}},
  console,
  setTimeout:(fn)=>{if(typeof fn==='function')fn();},
  clearTimeout:()=>{},
  Math, Date, Promise,
};
vm.createContext(context);
vm.runInContext(navSource,context,{filename:'navigation_core.js'});
const core=context.window.KaretaNavigationCore;
must(core&&typeof core.mobileItems==='function','Navigation Core did not initialize');

const degraded=Array.from(core.mobileItems());
must(JSON.stringify(degraded)===JSON.stringify(['masterDashboard','masterExchange','parts','__more__']),`MASTER degraded nav substituted foreign routes: ${JSON.stringify(degraded)}`);
must(degraded.at(-1)==='__more__','More is not rightmost in degraded MASTER nav');
must(!degraded.includes('home'),'public home leaked into MASTER mobile nav');
must(degraded.filter(x=>x==='masterDashboard').length===1,'MASTER dashboard duplicated');

allowed.add('serviceManagement');
allowed.add('cabinet');
const full=Array.from(core.mobileItems());
const expected=['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'];
must(JSON.stringify(full)===JSON.stringify(expected),`MASTER full nav contract mismatch: ${JSON.stringify(full)}`);
must(full.at(-1)==='__more__','More is not far-right in full MASTER nav');
must(!full.includes('home')&&!full.includes('orders'),'foreign home/orders leaked into approved MASTER bottom nav');
must(new Set(full).size===full.length,'MASTER bottom nav contains duplicate route keys');

console.log('OK R188.5.5.6.84.27 MASTER mobile nav contract');
