/* Contract regression: home diagnostics never silently auto-selects garage car. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.resolve(__dirname, '../js/next/pages/diagnostics.js'),'utf8');

const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function setup(startVehicleId) {
  const store = new Map();
  if(startVehicleId !== undefined)store.set('kareta.obd.vehicleId',String(startVehicleId));
  const nodes = new Map();
  const newNode=()=>({
    textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    querySelector(){return {disabled:false};}
  });
  const q=selector=>{
    if(!nodes.has(selector))nodes.set(selector,newNode());
    return nodes.get(selector);
  };
  const listeners = new Map();
  const root={
    querySelector:q,
    querySelectorAll(){return [];},
    addEventListener(name,fn){listeners.set(name,fn);},
    removeEventListener(){}
  };
  const api={get:async()=>({payload:{data:{vehicles:[
    {id:'car-1',brand:'Peugeot',model:'308',year:2018,is_default:true,status:'active',vin:'VF123'},
    {id:'car-2',brand:'Toyota',model:'Corolla',year:2020,status:'active',vin:'JT123'},
  ]}}})};
  const win={
    KaretaPageUI:{escHtml:escapeHtml},
    KaretaClientCabinetApi:api,
    KaretaMobile:{available:()=>false},
    addEventListener(){},removeEventListener(){}
  };
  const ctx={
    window:win,
    document:{querySelector:()=>root},
    sessionStorage:{
      getItem:k=>store.has(k)?store.get(k):null,
      setItem:(k,v)=>store.set(k,String(v)),
      removeItem:k=>store.delete(k)
    },
    navigator:{onLine:false},
    location:{hash:'#/diagnostics'},
    fetch:async()=>({ok:true,json:async()=>({ok:true,sessions:[]})}),
    setInterval:()=>1,clearInterval(){},
    setTimeout,clearTimeout,
    CSS:{escape:s=>s}
  };
  vm.runInNewContext(src,ctx,{filename:'diagnostics.js'});
  const rendered=win.KaretaDiagnosticsPages.renderDiagnostics();
  assert.match(rendered,/data-obd-pending-save/);
  assert.match(rendered,/data-obd-save-current/);
  win.KaretaDiagnosticsPages.mountDiagnostics({lifecycle:{addCleanup(){}}});
  // loadVehicles -> loadHistory is asynchronous; wait for those microtasks.
  await new Promise(resolve=>setTimeout(resolve,15));
  return {store,q,listeners};
}

(async()=>{
  const home=await setup();
  assert.match(home.q('[data-obd-vehicle-current]').innerHTML,/Диагностика без автомобиля/);
  assert.doesNotMatch(home.q('[data-obd-vehicle-current]').innerHTML,/Peugeot 308/);

  const car=await setup('car-2');
  assert.match(car.q('[data-obd-vehicle-current]').innerHTML,/Toyota Corolla/);
  assert.equal(car.store.has('kareta.obd.vehicleId'),false,'vehicle handoff must be one-shot');

  const forbidden=await setup('other-user-car');
  assert.match(forbidden.q('[data-obd-vehicle-current]').innerHTML,/Диагностика без автомобиля/);
  assert.match(forbidden.q('[data-obd-vehicle-current]').innerHTML,/недоступен/);
  assert.equal(forbidden.store.has('kareta.obd.vehicleId'),false);

  const click=car.listeners.get('click');
  assert.equal(typeof click,'function');
  await click({target:{closest:sel=>sel==='[data-obd-vehicle-unbind]'?{}:null}});
  assert.match(car.q('[data-obd-vehicle-current]').innerHTML,/Диагностика без автомобиля/);
  await click({target:{closest:sel=>sel==='[data-obd-vehicle-id]'?{dataset:{obdVehicleId:'car-1'}}:null}});
  assert.match(car.q('[data-obd-vehicle-current]').innerHTML,/Peugeot 308/);
  assert.equal(car.store.has('kareta.obd.vehicleId'),false,'manual selection must not leak to a future home launch');
  console.log('DIAGNOSTICS_ENTRY_INTENT: PASS — home unbound, garage scoped, unknown ID rejected, explicit choice');
})().catch(err=>{console.error(err);process.exitCode=1});
