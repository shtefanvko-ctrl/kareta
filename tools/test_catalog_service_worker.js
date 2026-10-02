'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const release=source.match(/const RELEASE = '([^']+)'/)[1];
const origin='https://catalog-test.invalid';
const catalogUrl=origin+'/assets/catalog/garage/service_maintenance.json?v='+release;
const json=(type='application/json',status=200)=>new Response('{"schema":1}',{status,headers:{'Content-Type':type}});
function harness(responses){
  const stores=new Map(),handlers=new Map(),calls=[];
  const key=request=>typeof request==='string'?request:request.url;
  const caches={open:async name=>{
    if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);
    return {match:async request=>entries.get(key(request)),put:async(request,response)=>entries.set(key(request),response)};
  },match:async request=>{for(const entries of stores.values())if(entries.has(key(request)))return entries.get(key(request));}};
  const self={location:{origin},addEventListener:(name,fn)=>handlers.set(name,fn)};
  vm.runInNewContext(source,{self,caches,Request,Response,URL,fetch:async request=>{calls.push(key(request));const response=responses.shift();if(response instanceof Error)throw response;return response;}});
  async function get(url=catalogUrl){let result;handlers.get('fetch')({request:new Request(url),respondWith:pending=>{result=pending;}});return result;}
  return {stores,calls,get,cache:()=>stores.get('kareta-static-'+release)};
}
async function main(){
  let count=0;
  for(const type of ['text/html','','text/json']){
    const h=harness([json(type),new Error('offline')]);await h.get();
    assert.equal(h.cache()?.has(catalogUrl)||false,false,'invalid MIME must not enter SW cache');
    assert.equal((await h.get()).type,'error');count+=1;
  }
  const h=harness([json(),new Error('offline'),new Error('offline')]);await h.get();
  assert.equal(h.cache().has(catalogUrl),true);assert.equal((await h.get()).status,200);
  assert.equal((await h.get(catalogUrl.replace(release,'older-release'))).type,'error','catalog cache key must preserve release URL');count+=1;
  const poisoned=harness([new Error('offline')]);poisoned.stores.set('kareta-static-'+release,new Map([[catalogUrl,json('text/html')]]));
  assert.equal((await poisoned.get()).type,'error','old poisoned cached response must be rejected');count+=1;
  const previous=harness([new Error('offline')]);previous.stores.set('kareta-static-old',new Map([[catalogUrl,json()]]));
  assert.equal((await previous.get()).type,'error','offline fallback must stay in current release cache');count+=1;
  const suffix=harness([json('application/vnd.kareta+json; charset=utf-8')]);await suffix.get();assert.ok(suffix.cache().has(catalogUrl));count+=1;
  const unavailable=harness([json('application/json',404)]);await unavailable.get();assert.equal(unavailable.cache()?.has(catalogUrl)||false,false);count+=1;
  const scriptUrl=origin+'/js/next/pages/cabinet.js?v='+release;
  const compatibility=harness([new Response('/* cabinet */',{headers:{'Content-Type':'application/javascript'}})]);
  await compatibility.get(scriptUrl);await compatibility.get(scriptUrl);
  assert.equal(compatibility.calls.length,1,'unaffected JS path must remain cache-first');count+=1;
  console.log('CATALOG_SERVICE_WORKER: PASS '+count+'/'+count+' (Fetch/Cache boundary fixtures)');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
