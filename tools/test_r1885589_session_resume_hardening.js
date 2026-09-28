const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/session_resume_runtime.js'),'utf8');
function must(c,m){if(!c){console.error('FAIL:',m);process.exit(1)}}
let now=1_000_000;
const winListeners={}; const docListeners={}; const logs=[]; const emits=[]; const navCalls=[]; const restores=[]; const captures=[];
let online=true; let loadCount=0; let context={id:22,key:'master:22',profileType:'master'};
let identity={authenticated:true,account:{id:7},context,compatibilityRole:'master',revision:4};
const store=new Map();
const location={hash:'#/master/exchange'};
const history={replaceState(_a,_b,target){location.hash=target;navCalls.push(['replace',target])}};
const document={
  visibilityState:'visible',
  documentElement:{dataset:{}},
  addEventListener(n,cb){(docListeners[n]||(docListeners[n]=[])).push(cb)},
};
const window={
  __KARETA_SESSION_RESUME_RUNTIME__:null,
  KaretaIdentity:{snapshot(){return JSON.parse(JSON.stringify(identity))},async load(){loadCount++;return JSON.parse(JSON.stringify(identity))}},
  KaretaNavigationState:{capture(h){captures.push(h||location.hash)},restore(h,o){restores.push([h,o])}},
  KaretaNavigationCore:{refreshAll(o){navCalls.push(['refresh',o])},preserveRouteAfterContextChange(k,h,s){navCalls.push(['preserve',k,h,s]);location.hash=h;return {route:k,preserved:true}}},
  KaretaRouteRegistry:{keyFromHash(h){return String(h).startsWith('#/master/exchange')?'masterExchange':String(h).startsWith('#/orders')?'orders':''}},
  KaretaRealtime:{start(){navCalls.push(['rt'])}},KaretaRealtimeClient:{start(){}},
  KaretaRuntimeLog:{add(n,d,l){logs.push([n,d,l])}},
  addEventListener(n,cb){(winListeners[n]||(winListeners[n]=[])).push(cb)},
  dispatchEvent(e){emits.push(e)},
};
const sessionStorage={getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)},removeItem(k){store.delete(k)}};
const navigator={get onLine(){return online}};
function CustomEvent(name,opts){this.type=name;this.detail=opts?.detail||{}}
const ctx={window,document,location,history,sessionStorage,navigator,CustomEvent,console,setTimeout,clearTimeout,Date:class extends Date{static now(){return now}},structuredClone:global.structuredClone};
vm.createContext(ctx); vm.runInContext(source,ctx,{filename:'session_resume_runtime.js'});
// Establish a verified resume hint.
(winListeners['kareta:session-confirmed']||[]).forEach(cb=>cb({detail:{identity}}));
must(window.KaretaSessionResume.hint()?.role==='master','verified master hint stored');
// 30 rapid tab switches: no server probe and no route mutation.
for(let i=0;i<30;i++){
  document.visibilityState='hidden'; (docListeners.visibilitychange||[]).forEach(cb=>cb()); now+=1000;
  document.visibilityState='visible'; (docListeners.visibilitychange||[]).forEach(cb=>cb()); now+=1000;
}
must(loadCount===0,'rapid tab switches do not probe identity');
must(location.hash==='#/master/exchange','rapid switches preserve route');
// Long sleep/wake: one background probe, same route.
document.visibilityState='hidden'; (docListeners.visibilitychange||[]).forEach(cb=>cb()); now+=60_000;
document.visibilityState='visible'; (docListeners.visibilitychange||[]).forEach(cb=>cb());
setImmediate(async()=>{
  await Promise.resolve(); await Promise.resolve();
  must(loadCount===1,'long sleep triggers one identity probe');
  must(location.hash==='#/master/exchange','long sleep preserves route');
  // Offline wake must not probe or navigate.
  online=false; (winListeners.offline||[]).forEach(cb=>cb());
  document.visibilityState='hidden'; (docListeners.visibilitychange||[]).forEach(cb=>cb()); now+=60_000;
  document.visibilityState='visible'; (docListeners.visibilitychange||[]).forEach(cb=>cb());
  must(loadCount===1,'offline wake does not probe');
  must(location.hash==='#/master/exchange','offline wake preserves route');
  // Network returns: forced probe, same route.
  online=true; (winListeners.online||[]).forEach(cb=>cb());
  await Promise.resolve(); await Promise.resolve();
  must(loadCount===2,'online recovery probes identity');
  must(location.hash==='#/master/exchange','online recovery preserves route');
  // Server context changed while tab slept: remount same accessible route, no default home.
  now+=31_000; context={id:23,key:'master:23',profileType:'master'}; identity={...identity,context,revision:5};
  document.visibilityState='hidden'; (docListeners.visibilitychange||[]).forEach(cb=>cb()); now+=60_000;
  document.visibilityState='visible'; (docListeners.visibilitychange||[]).forEach(cb=>cb());
  await Promise.resolve(); await Promise.resolve();
  must(navCalls.some(x=>x[0]==='preserve'&&x[2]==='#/master/exchange'),'context change preserves current route');
  must(!navCalls.some(x=>x[0]==='replace'&&x[1]==='#/home'),'never replaces route with client home');
  // Visibility-only restores must suppress control events.
  must(restores.some(x=>x[1]?.dispatchEvents===false),'visibility restore is side-effect free');
  console.log('OK R188.5.5.6.29 session resume hardening');
});
