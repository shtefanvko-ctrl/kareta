'use strict';
// Native-bridge simulation only: destructive-command consent, serialization, lifecycle,
// car-scoped evidence capture and non-prescriptive repair links.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src=fs.readFileSync(path.resolve(__dirname,'../js/next/pages/diagnostics.js'),'utf8');
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wait=()=>new Promise(r=>setTimeout(r,25));

async function setup({responses=[],handoff='',snapshot=null,delaySnapshot=false}={}){
  const log={commands:[],confirm:[],enqueued:[],snapshots:0};
  const answers=responses.slice();
  const store=new Map(handoff?[['kareta.obd.vehicleId',handoff]]:[]);
  const nodes=new Map(),events=new Map();
  const makeNode=()=>({
    textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(name,value){this.attributes=this.attributes||{};this.attributes[name]=String(value)},
    querySelector:()=>({disabled:false})
  });
  const q=s=>{if(!nodes.has(s))nodes.set(s,makeNode());return nodes.get(s)};
  const root={
    querySelector:q,querySelectorAll:()=>[],
    addEventListener:(k,fn)=>events.set(k,fn),
    removeEventListener:()=>{}
  };
  let resolveSnapshot=null;
  const snap=snapshot||{dtcCodes:['P0110','p0110','INVALID','P0113'],rpm:850,voltageV:12.8};
  const native={
    available:()=>true,
    elmStatus:async()=>({permission:true,ready:true,connected:true,enabled:true,address:'00:11',name:'OBD'}),
    offlineState:async()=>({count:0}),
    elmSnapshot:async()=>{
      log.snapshots++;
      if(delaySnapshot)return new Promise(resolve=>{resolveSnapshot=()=>resolve(snap)});
      return snap;
    },
    offlineEnqueue:async payload=>{log.enqueued.push(payload);return {syncKey:'queued'};},
    elmCommand:async (cmd,ms)=>{log.commands.push({cmd,ms});return {raw:'44'};},
    offlineDrain:async()=>({items:[]}),
    offlineAcknowledge:async()=>({}),
    elmLiveSnapshot:async()=>({})
  };
  const sessionStorage={
    getItem:k=>store.get(k)||null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };
  const win={
    KaretaPageUI:{escHtml:html},
    KaretaClientCabinetApi:{get:async()=>({payload:{data:{vehicles:[{id:'car-1',brand:'Peugeot',model:'308',vin:'VF123',status:'active'}]}}})},
    KaretaMobile:native,
    confirm:message=>{log.confirm.push(message);return answers.length?answers.shift():false},
    addEventListener:()=>{},removeEventListener:()=>{},
    setInterval:()=>1,clearInterval:()=>{},
  };
  const ctx={
    window:win, document:{querySelector:()=>root},sessionStorage,
    location:{hash:'#/diagnostics'},navigator:{onLine:false},
    fetch:async()=>({ok:true,json:async()=>({ok:true,sessions:[]})}),
    setInterval,clearInterval,setTimeout,clearTimeout,
    CSS:{escape:s=>s}
  };
  vm.runInNewContext(src,ctx,{filename:'diagnostics.js'});
  const markup=win.KaretaDiagnosticsPages.renderDiagnostics();
  assert.match(markup,/data-obd-clear/);
  assert.match(markup,/data-obd-repair-actions/);
  let dispose=null;
  win.KaretaDiagnosticsPages.mountDiagnostics({lifecycle:{addCleanup:fn=>{dispose=fn}}});
  await wait();
  assert.equal(q('[data-obd-clear]').disabled,false,'button should enable only when ready');
  const click=async name=>events.get('click')({target:{closest:sel=>sel===name?{}:null}});
  const sendRaw=async raw=>{q('[data-obd-custom]').value=raw;await click('[data-obd-send]')};
  return {log,native,store,root,q,click,sendRaw,dispose,resolve:()=>{if(!resolveSnapshot)throw Error('Snapshot not pending');resolveSnapshot();}};
}

(async()=>{
  const cancel=await setup({responses:[false]});
  await cancel.click('[data-obd-clear]');
  assert.equal(cancel.log.commands.length,0);
  assert.equal(cancel.log.snapshots,0);
  assert.equal(cancel.q('[data-obd-clear]').disabled,false);

  const noCar=await setup({responses:[true,false]});
  await noCar.click('[data-obd-clear]');
  assert.equal(noCar.log.confirm.length,2);
  assert.equal(noCar.log.snapshots,1);
  assert.equal(noCar.log.commands.length,0);
  assert.equal(noCar.q('[data-obd-pending-save]').hidden,false);

  const authorized=await setup({responses:[true],handoff:'car-1'});
  await authorized.click('[data-obd-clear]');
  assert.equal(authorized.log.confirm.length,1,'one consent sufficient when evidence is queued');
  assert.equal(authorized.log.enqueued.length,1);
  assert.equal(authorized.log.enqueued[0].vehicleId,'car-1');
  assert.equal(authorized.log.commands[0].cmd,'04');
  assert.match(authorized.q('[data-obd-result]').textContent,/Повторно прочитайте DTC/);

  const typed=await setup({responses:[true,true]});
  await typed.sendRaw(' 04 ');
  assert.deepEqual(typed.log.commands.map(c=>c.cmd),['04']);
  await typed.sendRaw('2E1234');
  assert.equal(typed.log.commands.length,1);
  assert.match(typed.q('[data-obd-result]').textContent,/не разрешена/);
  await typed.sendRaw('0400');
  assert.equal(typed.log.commands.length,1);
  assert.match(typed.q('[data-obd-result]').textContent,/кнопку с подтверждением/);

  const concurrent=await setup({responses:[true,true],delaySnapshot:true});
  const p1=concurrent.click('[data-obd-clear]');
  const p2=concurrent.click('[data-obd-clear]');
  assert.equal(concurrent.log.snapshots,1,'concurrent clear requests are serialized');
  concurrent.resolve(); await Promise.all([p1,p2]);
  assert.equal(concurrent.log.commands.length,1);

  const disposed=await setup({responses:[true,true],delaySnapshot:true});
  const pending=disposed.click('[data-obd-clear]');
  disposed.dispose();
  disposed.resolve();
  await pending;
  assert.equal(disposed.log.commands.length,0,'do not send destructive command after page disposal');

  const diagnostic=await setup();
  // The snapshot action reads actual bridge data; filters invalid/duplicate DTC.
  await diagnostic.click('[data-obd-snapshot]');
  const dtc=diagnostic.q('[data-obd-dtc-list]').innerHTML;
  assert.match(dtc,/P0110/);assert.match(dtc,/P0113/);
  assert.doesNotMatch(dtc,/INVALID/);
  assert.equal((dtc.match(/<strong>P0110<\/strong>/g)||[]).length,1);
  assert.equal(diagnostic.q('[data-obd-repair-actions]').hidden,false);
  assert.match(src,/#\/masters\?type=sto/);
  assert.match(src,/#\/parts/);

  console.log('DIAGNOSTICS_SAFE_CLEAR: PASS — consent, queued evidence, raw command guard, lifecycle, DTC actions');
})().catch(e=>{console.error(e);process.exitCode=1});
