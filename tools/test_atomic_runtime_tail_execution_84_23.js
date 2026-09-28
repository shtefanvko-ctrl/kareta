'use strict';
const fs=require('fs'),vm=require('vm');
const files=['js/next/pages/cabinet.js','js/next/account_window.js','js/next/pages/services.js','js/next/pages/news.js','js/next/pages/community.js','js/next/pages/following.js','js/next/pages/profile_relations.js','js/next/pages/workflow.js','js/next/pages/work_feed.js','js/next/pages/service_management.js','js/next/window_engine.js','js/next/app_next.js'];
let universal;
const handler={get(t,p){if(p===Symbol.iterator)return function*(){}; if(p==='then')return undefined; if(p==='length')return 0; if(p==='toString')return ()=>''; return universal;},apply(){return universal;},construct(){return universal;},set(){return true;},has(){return true;}};
universal=new Proxy(function(){},handler);
const backing={KaretaPageUI:{},KaretaClientCabinetApi:{},KaretaFirstVehicleFlow:{},__KARETA_NEXT_APP_MODULE__:null,KARETA_NEXT_ASSET_VERSION:'188.5.5.6.84.25'};
const win=new Proxy(backing,{get(t,p){if(p in t)return t[p]; return universal;},set(t,p,v){t[p]=v;return true;},has(){return true;}});
const storage={getItem(){return null},setItem(){},removeItem(){},clear(){}};
const sandbox={console,window:win,document:{readyState:'loading',currentScript:{src:'https://example.test/js/next/app_next.js'},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},getElementById(){return null},documentElement:{classList:{toggle(){}}}},location:{hash:'#/home',href:'https://example.test/'},history:universal,navigator:universal,localStorage:storage,sessionStorage:storage,setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},requestAnimationFrame(fn){return 0},cancelAnimationFrame(){},fetch:async()=>({ok:true,json:async()=>({})}),AbortController:class{constructor(){this.signal={};}abort(){}},CustomEvent:class{},Event:class{},HTMLElement:class{},HTMLFormElement:class{},FormData:class{},URL,URLSearchParams,Intl,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Map,Set,WeakMap,WeakSet,Error,TypeError,RangeError,Symbol,parseInt,parseFloat,isNaN,encodeURIComponent,decodeURIComponent,crypto:{randomUUID:()=> 'uuid',getRandomValues:a=>a},MutationObserver:class{observe(){}disconnect(){}},IntersectionObserver:class{observe(){}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}}};
let failures=0;
for(const f of files){
  try{vm.runInNewContext(fs.readFileSync(f,'utf8'),sandbox,{filename:f,timeout:3000}); console.log(`[PASS] tail runtime executes: ${f}`);}
  catch(e){failures++;console.error(`[FAIL] tail runtime executes: ${f} — ${e.name}: ${e.message}`);break;}
}
process.exit(failures?1:0);
