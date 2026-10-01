'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const catalog=JSON.parse(read('assets/catalog/garage/service_maintenance.json'));
const copy=value=>JSON.parse(JSON.stringify(value));
const response=payload=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>copy(payload)});
const release=read('inc/asset_version.php').match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)[1];

function harness(fetcher=async()=>response(catalog)){
  const calls=[],listeners=new Map(),body={innerHTML:''},title={textContent:''},eyebrow={textContent:''};
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector:selector=>({'[data-garage-dialog-body]':body,'[data-garage-dialog-title]':title,'[data-garage-dialog-eyebrow]':eyebrow}[selector]||null),querySelectorAll:()=>[],addEventListener(){}};
  const element={outerHTML:'',querySelector:selector=>selector==='[data-garage-dialog]'?dialog:null,querySelectorAll:()=>[],addEventListener:(event,fn)=>listeners.set(event,fn)};
  const data={vehicles:[{id:'car_1',brand:'BMW',model:'E36',year_label:'1994',mileage_km:100000,is_default:1}],maintenance:[],orders:[],reminders:[]};
  const window={KARETA_NEXT_ASSET_VERSION:release,KaretaPageUI:{},KaretaFirstVehicleFlow:{},KaretaClientCabinetApi:{get:async()=>({ok:true,payload:{data:copy(data)}})},addEventListener(){}};
  const context=vm.createContext({window,document:{querySelector:selector=>selector==='#k-page-outlet .k-client-cabinet-page'?element:null},location:{hash:'#/cabinet/garage'},requestAnimationFrame:fn=>fn(),Intl,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push({url,options});return fetcher(url,options);}});
  vm.runInContext(read('js/next/catalog/json_catalog_loader.js'),context);
  vm.runInContext(read('js/next/pages/cabinet.js'),context);
  const click=key=>listeners.get('click')({preventDefault(){},target:{closest:selector=>selector==='[data-garage-view]'?{dataset:{garageView:key}}:null}});
  const close=()=>listeners.get('click')({target:{closest:selector=>selector==='[data-garage-dialog-close]'?{}:null}});
  return {calls,body,dialog,element,window,click,close,mount:()=>window.KaretaCabinetPages.mountGarage()};
}

async function main(){
  let count=0;
  const check=async(name,run)=>{await run();count+=1;};
  await check('boot and garage do not fetch, maps reuse one release URL',async()=>{
    const h=harness();assert.equal(h.calls.length,0);await h.mount();
    assert.equal(h.calls.length,0);assert.ok(h.element.outerHTML.includes('car_1'));
    await h.click('systems');await h.click('consumables');await h.click('systems');
    assert.equal(h.calls.length,1);assert.ok(h.body.innerHTML.includes('Двигатель'));
    assert.equal(h.calls[0].url,'/assets/catalog/garage/service_maintenance.json?v='+release);
  });
  const malformed=[
    payload=>{payload.id='other-catalog';},
    payload=>{payload.systems=[];},
    payload=>{payload.systems[0].id='';},
    payload=>{payload.systems[0].title=null;},
    payload=>{payload.systems[1].id=payload.systems[0].id;},
    payload=>{payload.items[0].id='';},
    payload=>{payload.items[1].id=payload.items[0].id;},
    payload=>{payload.items[0].system='unknown';},
    payload=>{payload.items[0].km='10000';},
    payload=>{payload.items[0].km=0;},
    payload=>{payload.items[0].months=-1;},
    payload=>{payload.items[0].mode='unexpected';},
  ];
  for(const [index,mutate] of malformed.entries()){
    await check('invalid domain payload '+index+' can retry after server repair',async()=>{
      const bad=copy(catalog);mutate(bad);let served=bad;
      const h=harness(async()=>response(served));await h.mount();await h.click('systems');
      assert.ok(h.body.innerHTML.includes('Не удалось загрузить справочник'));
      assert.equal(h.window.KaretaJsonCatalogLoader.audit().cached.length,0);
      served=catalog;await h.click('systems');
      assert.equal(h.calls.length,2);assert.equal(h.calls[1].options.cache,'reload');
      assert.ok(h.body.innerHTML.includes('Двигатель'));await h.click('consumables');assert.equal(h.calls.length,2);
    });
  }
  await check('transport errors show product copy and keep retry',async()=>{
    const h=harness(async()=>{throw new TypeError('Failed to fetch secret/path');});await h.mount();await h.click('systems');
    assert.ok(h.body.innerHTML.includes('Проверьте соединение'));
    assert.ok(h.body.innerHTML.includes('data-garage-view="systems"'));
    assert.equal(h.body.innerHTML.includes('Failed to fetch'),false);
  });
  await check('catalog text and attributes are escaped',async()=>{
    const payload=copy(catalog);const mark='<img src=x onerror="alert(1)">';
    payload.systems[0].title=mark;payload.systems[0].text=mark;payload.items[0].title=mark;
    const h=harness(async()=>response(payload));await h.mount();
    for(const map of ['systems','consumables']){
      await h.click(map);assert.equal(h.body.innerHTML.includes(mark),false);
      assert.ok(h.body.innerHTML.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
    }
  });
  for(const rejects of [false,true]){
    await check('closed dialog ignores late '+(rejects?'failure':'success'),async()=>{
      let resolve,reject;const pending=new Promise((done,fail)=>{resolve=done;reject=fail;});
      const h=harness(()=>pending);await h.mount();const opening=h.click('systems');await h.close();
      if(rejects)reject(new Error('late failure'));else resolve(response(catalog));
      await opening;assert.equal(h.dialog.open,false);assert.ok(h.body.innerHTML.includes('Загрузка справочника'));
    });
  }
  await check('switch while loading dedupes and renders latest map',async()=>{
    let resolve;const h=harness(()=>new Promise(done=>{resolve=done;}));await h.mount();
    const systems=h.click('systems'),items=h.click('consumables');resolve(response(catalog));await Promise.all([systems,items]);
    assert.equal(h.calls.length,1);assert.ok(h.body.innerHTML.includes('Детали и расходники'));
  });
  console.log('GARAGE_CATALOG_RUNTIME: PASS '+count+'/'+count+' (HTTP/DOM boundary fixtures)');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
