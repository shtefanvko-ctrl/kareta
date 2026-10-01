'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const result=name=>({ok:true,payload:{data:{user:{name},metrics:{vehicles:0},vehicles:[]}}});

async function checkApiCacheAndDedupe(invalidation){
  const old=deferred(),next=deferred(),requests=[],saved=new Map();
  const sessionStorage={get length(){return saved.size;},key:i=>[...saved.keys()][i]||null,getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const fetch=url=>{requests.push(url);return requests.length===1?old.promise:next.promise;};
  const response=name=>({ok:true,status:200,url:'/account',headers:new Headers({'content-type':'application/json'}),json:async()=>({ok:true,data:{user:{name}}})});
  const window={};
  vm.runInNewContext(read('js/next/api_client.js'),{window,fetch,Headers,URLSearchParams,sessionStorage,setTimeout});
  const api=window.KaretaApiClient,options={cacheKey:'client.cabinet',cacheTtlMs:15000};
  const oldRead=api.request('/account',options);
  api.invalidate(invalidation); // logout or a targeted refresh detaches the old in-flight read
  const newRead=api.request('/account',options);
  assert.equal(requests.length,2,'new account must start a fresh request');
  old.resolve(response('Old account'));
  assert.equal((await oldRead).payload.data.user.name,'Old account');
  const shared=api.request('/account',options);
  assert.equal(requests.length,2,'old finally must not detach the new request');
  next.resolve(response('New account'));
  assert.equal((await shared).payload.data.user.name,'New account');
  assert.equal((await newRead).payload.data.user.name,'New account');
  const cached=await api.request('/account',options);
  assert.equal(cached.fromCache,true);
  assert.equal(cached.payload.data.user.name,'New account','old response must never repopulate the persistent cache');
  assert.equal(requests.length,2);
}

async function checkCabinetRender(){
  const old=deferred(),next=deferred(),listeners=new Map(),hosts=new Map();
  const node=id=>{if(!hosts.has(id))hosts.set(id,{innerHTML:'',textContent:''});return hosts.get(id);};
  let calls=0;
  const window={
    KaretaPageUI:{},KaretaFirstVehicleFlow:{},
    KaretaClientCabinetApi:{get:()=>++calls===1?old.promise:next.promise},
    KaretaNavigationCore:{interfaceRole:()=> 'client'},
    addEventListener:(event,fn)=>listeners.set(event,fn),
  };
  const document={querySelector:selector=>selector==='#k-client-profile-host'||selector==='#k-client-vehicles-host'?node(selector):null,getElementById:node};
  vm.runInNewContext(read('js/next/pages/cabinet.js'),{window,document,Intl});
  const oldMount=window.KaretaCabinetPages.mountCabinet();
  listeners.get('kareta:session-anonymous')();
  const newMount=window.KaretaCabinetPages.mountCabinet();
  old.resolve(result('Old account'));
  await oldMount;
  assert.equal(node('#k-client-profile-host').innerHTML.includes('Old account'),false,'stale response must not render');
  assert.equal(node('#k-client-profile-host').innerHTML.includes('session_changed'),false,'stale error must not render');
  next.resolve(result('New account'));
  await newMount;
  assert.ok(node('#k-client-profile-host').innerHTML.includes('New account'));
  await window.KaretaCabinetPages.mountCabinet();
  assert.equal(calls,2,'new account data must own the local cabinet cache');
}

async function checkAccountWindow(){
  const old=deferred(),next=deferred(),listeners=new Map(),body={innerHTML:'',querySelector:()=>null};
  let calls=0;
  const dialog={isConnected:true,open:false,addEventListener(){},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},querySelector:selector=>selector==='[data-account-window-body]'?body:{textContent:''}};
  const document={body:{appendChild(){}},documentElement:{classList:{add(){},remove(){}}},createElement:()=>dialog,addEventListener(){},querySelector:()=>null};
  const window={
    KaretaClientCabinetApi:{get:()=>++calls===1?old.promise:next.promise},
    KaretaApiClient:{invalidate(){}},
    KaretaUIIcons:{icon:()=>''},
    addEventListener:(event,fn)=>listeners.set(event,fn),
  };
  const location={hash:'#/cabinet'};
  const history={state:null,replaceState:(_state,_title,hash)=>{location.hash=hash;}};
  vm.runInNewContext(read('js/next/account_window.js'),{window,document,location,history,sessionStorage:{getItem:()=>null},setTimeout:()=>0,console});
  window.KaretaAccountWindow.open('profile');
  listeners.get('kareta:session-anonymous')();
  window.KaretaAccountWindow.open('profile');
  old.resolve(result('Old account'));
  await settle();
  assert.equal(body.innerHTML.includes('Old account'),false,'old dialog load must not display in new account');
  next.resolve(result('New account'));
  await settle();
  assert.ok(body.innerHTML.includes('New account'));
  window.KaretaAccountWindow.open('profile');
  assert.equal(calls,2,'new dialog must reuse only its own cache');
}

Promise.all([checkApiCacheAndDedupe(''),checkApiCacheAndDedupe('client.cabinet'),checkCabinetRender(),checkAccountWindow()])
  .then(()=>console.log('CABINET_SESSION_ISOLATION_84_151: PASS cache, cabinet, account window'))
  .catch(error=>{console.error(error);process.exitCode=1;});
