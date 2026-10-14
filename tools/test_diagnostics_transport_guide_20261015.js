'use strict';
/* Bridge fixture: Classic support is contingent on actual ECU handshake; other transports are roadmap-only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../js/next/pages/diagnostics.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../css/next/diagnostics.css'),'utf8');

async function exercise({android=true}={}){
  const elements=new Map(),handlers=new Map(),mutations=[];
  const create=()=>({
    innerHTML:'',textContent:'',disabled:false,hidden:false,style:{},dataset:{},value:'',
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(key,value){this.attributes??={};this.attributes[key]=String(value)},
    querySelector(){return {disabled:false}}
  });
  const q=s=>{if(!elements.has(s))elements.set(s,create());return elements.get(s)};
  const page={querySelector:q,querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener(){}};
  const doc={documentElement:{lang:'ru'},querySelector:()=>page};
  let callback=null,observerDisconnected=false; 
  class MutationObserverMock{
    constructor(cb){callback=cb}
    observe(el,opts){assert.equal(el,doc.documentElement);assert.deepEqual([...opts.attributeFilter],['lang']);mutations.push('observe')}
    disconnect(){observerDisconnected=true}
  }
  const bridge={
    available:()=>android,
    elmStatus:async()=>({permission:true,ready:false,connected:false,enabled:true}),
    elmDevices:async()=>({devices:[{address:'00:11',name:'ELM327',likelyElm:true}]}),
    elmConnect:async()=>({connected:true}),
    elmInit:async()=>({vehicleConnected:true}),
    requestPermission:async()=>({granted:true}),
    offlineState:async()=>({count:0}),
    offlineDrain:async()=>({items:[]})
  };
  const win={
    KaretaPageUI:{escHtml:String},KaretaClientCabinetApi:{get:async()=>({payload:{data:{vehicles:[]}}})},
    KaretaMobile:bridge,addEventListener(){},removeEventListener(){},setInterval:()=>1,clearInterval(){}
  };
  const ctx={
    document:doc,window:win,MutationObserver:MutationObserverMock,
    navigator:{onLine:false},location:{hash:'#/diagnostics'},
    fetch:async()=>({ok:true,json:async()=>({sessions:[]})}),
    sessionStorage:{getItem:()=>'',removeItem:()=>{}},
    setInterval,clearInterval,setTimeout,clearTimeout,CSS:{escape:String}
  };
  vm.runInNewContext(source,ctx,{filename:'diagnostics.js'});
  const markup=win.KaretaDiagnosticsPages.renderDiagnostics();
  assert.match(markup,/data-obd-transport="classic"/);
  assert.match(markup,/data-obd-transport="ble"/);
  assert.match(markup,/data-obd-transport="wifi"/);
  assert.match(markup,/Пока недоступно/);
  assert.equal((markup.match(/data-obd-step="/g)||[]).length,3);
  let cleanup=null;
  win.KaretaDiagnosticsPages.mountDiagnostics({lifecycle:{addCleanup:fn=>{cleanup=fn}}});
  await new Promise(r=>setTimeout(r,25));
  const state=name=>q('[data-obd-step="'+name+'"]').dataset.state;
  if(android){
    assert.equal(state('permission'),'done');
    assert.equal(state('adapter'),'active');
    assert.equal(state('ecu'),'pending');
    assert.match(q('[data-obd-transport-status]').textContent,/Выберите сопряжённый ELM327/);
  }else{
    assert.match(q('[data-obd-transport-status]').textContent,/Android-приложении/);
  }
  doc.documentElement.lang='kk';callback();
  assert.equal(q('[data-obd-ble-hint]').textContent,'Әзірге қолжетімсіз');
  assert.match(q('[data-obd-transport-title]').textContent,/Автокөлікке/);
  doc.documentElement.lang='en';callback();
  assert.equal(q('[data-obd-wifi-hint]').textContent,'Not available yet');
  if(android){
    await handlers.get('click')({target:{closest:selector=>selector==='[data-obd-address]'?{dataset:{obdAddress:'00:11',obdName:'ELM327'}}:null}});
    assert.equal(state('permission'),'done');
    assert.equal(state('adapter'),'done');
    assert.equal(state('ecu'),'done');
    assert.match(q('[data-obd-transport-status]').textContent,/ECU responding/);
  }
  cleanup();
  assert.equal(observerDisconnected,true);
}
(async()=>{
  assert.match(css,/\.k-obd-transport-choice\.is-planned/);
  await exercise();
  await exercise({android:false});
  console.log('DIAGNOSTICS_TRANSPORT_GUIDE: PASS — Classic handshake stages, BLE/Wi-Fi nonclaims, RU/KK/EN change, cleanup');
})().catch(error=>{console.error(error);process.exitCode=1});
