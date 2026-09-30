#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=[];const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const registry=read('inc/asset_registry.php');
const page=read('js/next/pages/cabinet.js');
const loader=read('js/next/catalog/json_catalog_loader.js');
const gate=read('tools/release_gate.php');
const catalogPath='assets/catalog/garage/service_maintenance.json';
const catalog=JSON.parse(read(catalogPath));

expect(catalog.schema===1,'garage catalog schema must be 1');
expect(Array.isArray(catalog.systems)&&catalog.systems.length>=10,'garage systems catalog is incomplete');
expect(Array.isArray(catalog.items)&&catalog.items.length>=20,'garage maintenance items catalog is incomplete');
const systemIds=catalog.systems.map(x=>String(x.id||''));
expect(new Set(systemIds).size===systemIds.length&&!systemIds.includes(''),'garage system ids must be unique');
expect(catalog.items.every(x=>systemIds.includes(String(x.system||''))),'garage item references unknown system');
expect(new Set(catalog.items.map(x=>String(x.id||''))).size===catalog.items.length,'garage item ids must be unique');

const bundleStart=registry.indexOf("'cabinet' => [");
const bundleEnd=registry.indexOf("'chats' => [",bundleStart);
const cabinetBundle=registry.slice(bundleStart,bundleEnd);
expect(cabinetBundle.includes("'js/next/catalog/json_catalog_loader.js'"),'JSON catalog loader is not cabinet-route lazy');
expect(cabinetBundle.indexOf("'js/next/catalog/json_catalog_loader.js'")<cabinetBundle.indexOf("'js/next/pages/cabinet.js'"),'JSON catalog loader must execute before cabinet page');
expect(!page.includes('const serviceSystems=[')&&!page.includes('const serviceConsumables=['),'garage reference arrays remain embedded in cabinet JS');
expect(page.includes("SERVICE_MAINTENANCE_CATALOG='assets/catalog/garage/service_maintenance.json'"),'garage catalog path contract missing');
expect(page.includes("jsonCatalog.load(SERVICE_MAINTENANCE_CATALOG,{schema:1})"),'garage page does not use shared JSON loader');
expect(page.includes("const lazyCatalog=key==='systems'||key==='consumables'"),'garage maps are not demand-loaded');
expect(page.includes("await ensureServiceCatalog();")&&page.includes('Загрузка справочника…'),'garage progressive loading UI missing');
expect(page.includes("garageCategory('systems','Карта узлов','Системы автомобиля',null)")&&page.includes("garageCategory('consumables','Расходники','Ресурс и замены',null)"),'garage summary still depends on unloaded catalog counts');
expect(loader.includes('const cache=new Map()')&&loader.includes('const inFlight=new Map()'),'JSON loader cache/dedupe missing');
expect(loader.includes("cache:'default'")&&loader.includes("?v=${encodeURIComponent(release)}"),'JSON loader release-scoped HTTP cache contract missing');
expect(loader.includes("content-type")&&loader.includes("catalog_mime_invalid"),'JSON loader MIME guard missing');
expect(gate.includes("'catalog.json' => 'tools/test_progressive_json_catalog.js'"),'release gate does not run progressive JSON regression');

function response(payload,{status=200,type='application/json',jsonError=null}={}){
  return {ok:status>=200&&status<300,status,headers:{get:()=>type},json:async()=>{if(jsonError)throw jsonError;return payload;}};
}
function harness(responses,release='catalog-test-release'){
  const calls=[],window={KARETA_NEXT_ASSET_VERSION:release};
  const context=vm.createContext({window,encodeURIComponent,fetch:async(url,options)=>{
    calls.push({url,options});
    if(!responses.length)throw new Error('unexpected_catalog_fetch');
    const next=responses.shift();
    if(next instanceof Error)throw next;
    return next;
  }});
  vm.runInContext(loader,context,{filename:path.join(root,'js/next/catalog/json_catalog_loader.js')});
  return {api:window.KaretaJsonCatalogLoader,calls};
}
async function runtimeChecks(){
  let passed=0,total=0;
  const check=async(name,run)=>{total+=1;try{await run();passed+=1;}catch(error){fail.push(name+': '+String(error.message||error));}};
  await check('demand loading, release URL and cache reuse',async()=>{
    const h=harness([response({schema:1})],'release + 1');
    assert.equal(h.calls.length,0);
    const first=await h.api.load(catalogPath,{schema:1});
    assert.equal(h.calls[0].url,'/'+catalogPath+'?v=release%20%2B%201');
    assert.equal(h.calls[0].options.cache,'default');
    assert.equal(h.calls[0].options.credentials,'same-origin');
    assert.equal(h.calls[0].options.headers.Accept,'application/json');
    assert.equal(await h.api.load(catalogPath,{schema:1}),first);
    assert.equal(h.calls.length,1);
  });
  await check('cached payload still enforces each caller schema',async()=>{
    const h=harness([response({schema:1})]);
    const payload=await h.api.load(catalogPath,{schema:1});
    await assert.rejects(h.api.load(catalogPath,{schema:2}),/catalog_schema_mismatch/);
    assert.equal(await h.api.load(catalogPath,{schema:1}),payload);
    assert.equal(h.calls.length,1);
  });
  await check('optional-schema cache cannot bypass a later required schema',async()=>{
    const h=harness([response({items:[]})]);
    await h.api.load(catalogPath);
    await assert.rejects(h.api.load(catalogPath,{schema:1}),/catalog_schema_mismatch/);
    assert.equal(h.calls.length,1);
  });
  for(const schemas of [[1,1],[1,2],[2,1]]){
    await check('shared request validates independent schemas '+schemas.join('/'),async()=>{
      let resolve;const pending=new Promise(done=>{resolve=done;});
      const h=harness([pending]);
      const results=Promise.allSettled(schemas.map(schema=>h.api.load(catalogPath,{schema})));
      assert.equal(h.calls.length,1);
      resolve(response({schema:1}));
      const settled=await results;
      settled.forEach((result,index)=>{
        assert.equal(result.status,schemas[index]===1?'fulfilled':'rejected');
        if(result.status==='rejected')assert.match(String(result.reason),/catalog_schema_mismatch/);
      });
      assert.equal(h.calls.length,1);
      assert.equal((await h.api.load(catalogPath,{schema:1})).schema,1);
      assert.equal(h.calls.length,1);
    });
  }
  await check('schema failure is not cached and a retry can recover',async()=>{
    const h=harness([response({schema:2}),response({schema:1})]);
    await assert.rejects(h.api.load(catalogPath,{schema:1}),/catalog_schema_mismatch/);
    assert.equal(h.api.audit().cached.length,0);
    assert.equal(h.api.audit().pending.length,0);
    assert.equal((await h.api.load(catalogPath,{schema:1})).schema,1);
    assert.equal(h.calls.length,2);
  });
  for(const [name,bad,pattern] of [
    ['HTTP error',response({}, {status:503}),/catalog_http_503/],
    ['HTML fallback',response({}, {type:'text/html'}),/catalog_mime_invalid/],
    ['invalid JSON',response(null,{jsonError:new SyntaxError('catalog_test_json_invalid')}),/catalog_test_json_invalid/],
    ['array payload',response([]),/catalog_payload_invalid/],
    ['null payload',response(null),/catalog_payload_invalid/],
  ]){
    await check(name+' does not poison cache or retry',async()=>{
      const h=harness([bad,response({schema:1})]);
      await assert.rejects(h.api.load(catalogPath,{schema:1}),pattern);
      assert.equal(h.api.audit().cached.length,0);
      assert.equal(h.api.audit().pending.length,0);
      await h.api.load(catalogPath,{schema:1});
      assert.equal(h.calls.length,2);
    });
  }
  await check('network failure can retry',async()=>{
    const h=harness([new Error('catalog_test_network_failure'),response({schema:1})]);
    await assert.rejects(h.api.load(catalogPath,{schema:1}),/catalog_test_network_failure/);
    assert.equal(h.api.audit().cached.length,0);
    assert.equal(h.api.audit().pending.length,0);
    await h.api.load(catalogPath,{schema:1});
    assert.equal(h.calls.length,2);
  });
  console.log('JSON catalog runtime: '+passed+'/'+total+' PASS');
}
runtimeChecks().then(()=>{
  if(fail.length){console.error(fail.join('\n'));process.exitCode=1;return;}
  console.log('Progressive JSON catalog regression: OK');
}).catch(error=>{console.error(error);process.exitCode=1;});
