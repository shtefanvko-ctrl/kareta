'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const rootPath=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(rootPath,file),'utf8');
const equipment=JSON.parse(read('storage/catalog/master_equipment.json'));
const catalog=JSON.parse(read('storage/catalog/services.json')).services;
class Element {
  constructor(){this.listeners={};this.children=[];this.innerHTML='';this.open=false;this.isConnected=true;}
  setAttribute(){} append(el){this.children.push(el);el.parent=this;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x!==fn);}
  showModal(){this.open=true;} close(){this.open=false;}
  remove(){this.isConnected=false;this.parent.children=this.parent.children.filter(x=>x!==this);}
  async click(attribute,value=''){const key=attribute.replace(/^data-/,'').replace(/-([a-z])/g,(_,x)=>x.toUpperCase());const button={dataset:{[key]:value},hasAttribute:name=>name===attribute,closest:()=>button};for(const fn of this.listeners.click||[])await fn({target:button});}
}
const storage=new Map(),sessionStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
let currentContext=11,failSave=false,dropAfterCommit=false,lateGet=null,apiCalls=[],serviceConcurrency=0,servicePeak=0,failService=false;
const profiles=new Map(),selectedServices=new Map();
const profile=()=>{if(!profiles.has(currentContext))profiles.set(currentContext,{revision:0,selection:[],group:''});return profiles.get(currentContext);};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const window={console,KaretaApiClient:{request:async(url,options)=>{
  apiCalls.push({url,method:options.method||'GET',cache:options.cacheTtlMs});
  if(lateGet){const data=await lateGet;lateGet=null;return {ok:true,payload:{data}};}
  const p=profile();
  if(options.method==='POST'){
    const body=JSON.parse(options.body);
    if(failSave)return {ok:false,status:503,payload:{message:'offline'}};
    if(body.contextId!==currentContext)return {ok:false,status:409,payload:{message:'context changed'}};
    if(body.mutationId&&body.mutationId===p.mutationId)return {ok:true,payload:{data:{contextId:currentContext,revision:p.revision,selection:p.selection}}};
    if(body.expectedRevision!==p.revision)return {ok:false,status:409,payload:{error:'equipment_revision_conflict',message:'revision conflict'}};
    p.revision++;p.selection=body.selection;p.group=body.lastGroupId;p.mutationId=body.mutationId;if(dropAfterCommit){dropAfterCommit=false;throw Error('response lost');}
    return {ok:true,payload:{data:{contextId:currentContext,revision:p.revision,selection:p.selection}}};
  }
  const urlObj=new URL(url,'https://kareta.test'),group=urlObj.searchParams.get('group')||p.group||equipment.groups[0].id;
  const items=equipment.items.filter(x=>x.group_id===group).map(x=>({id:x.id,name:x.label_tablet,shortName:x.label_mobile,iconId:x.icon_id,groupId:x.group_id}));
  const selection=p.selection.map(x=>{const item=equipment.items.find(i=>i.id===x.equipmentId);return {...x,name:item.label_mobile,iconId:item.icon_id,groupId:item.group_id};});
  return {ok:true,payload:{data:{contextId:currentContext,revision:p.revision,selection,groups:equipment.groups,groupId:group,items,resumeStage:p.group?2:1}}};
}}};
const context={window,console,document:{createElement:()=>new Element()},sessionStorage,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(read('js/next/ui_icons.js'),context);
vm.runInNewContext(read('js/next/services/master_setup_picker.js'),context);
const getSelected=()=>{if(!selectedServices.has(currentContext))selectedServices.set(currentContext,new Set());return selectedServices.get(currentContext);};
const services={snapshot:()=>({status:'ready',catalog}),scopeKey:()=>`master:${currentContext}`,categoryLabel:x=>x,selected:item=>getSelected().has(item.id),refresh:async()=>{},select:async(id,enabled)=>{
  serviceConcurrency++;servicePeak=Math.max(servicePeak,serviceConcurrency);await tick();serviceConcurrency--;
  if(failService)throw Error('service offline');if(enabled)getSelected().add(id);else getSelected().delete(id);
}};
const mount=()=>{const root=new Element(),cleanup=[];const controller=window.KaretaMasterSetupPicker.mount(root,{services,lifecycle:{addCleanup:fn=>cleanup.push(fn)}});return {root,controller,dialog:root.children[0],cleanup};};
(async()=>{
  const ui=mount();assert.equal(apiCalls.length,0,'equipment is fetched before opening');
  await ui.controller.open('equipment');assert.ok(ui.dialog.innerHTML.includes('data-setup-group="diagnostic"'));
  assert.ok(!/<input|<textarea|<select/i.test(ui.dialog.innerHTML),'button flow has typing fields');
  await ui.dialog.click('data-setup-group','diagnostic');
  await ui.dialog.click('data-setup-item','obd_scanner');
  assert.ok(ui.dialog.innerHTML.includes('data-setup-access="shared_sto"'));
  await ui.dialog.click('data-setup-access','owned');
  await ui.dialog.click('data-setup-close');
  assert.deepEqual(profile().selection,[{equipmentId:'obd_scanner',access:'owned'}]);
  assert.equal(ui.dialog.open,false);assert.ok(!storage.has('kareta.master.equipment:11'));
  await ui.controller.open('equipment');assert.ok(ui.dialog.innerHTML.includes('Мой набор · 1'),'reload loses saved selection');
  await ui.dialog.click('data-setup-item','obd_scanner');await ui.dialog.click('data-setup-access','need_buy');
  failSave=true;await ui.dialog.click('data-setup-close');
  assert.equal(ui.dialog.open,true,'failed save masquerades as success');assert.ok(storage.has('kareta.master.equipment:11'));
  ui.controller.destroy();assert.equal(ui.root.children.length,0);
  failSave=false;const restored=mount();await restored.controller.open('equipment');await restored.dialog.click('data-setup-close');
  assert.equal(profile().selection[0].access,'need_buy','unsaved draft not restored');
  await restored.controller.open('equipment');await restored.dialog.click('data-setup-item','obd_scanner');await restored.dialog.click('data-setup-access','rented');dropAfterCommit=true;await restored.dialog.click('data-setup-close');assert.equal(restored.dialog.open,true);const revisionAfterLostReply=profile().revision;restored.controller.destroy();
  const knownSaved=mount();await knownSaved.controller.open('equipment');assert.ok(!storage.has('kareta.master.equipment:11'),'already-saved draft is not reconciled');await knownSaved.dialog.click('data-setup-close');assert.equal(profile().revision,revisionAfterLostReply,'already-saved selection written again');knownSaved.controller.destroy();currentContext=22;const other=mount();await other.controller.open('equipment');
  assert.ok(other.dialog.innerHTML.includes('Мой набор · 0'),'equipment leaked into another context');
  await other.dialog.click('data-setup-close');
  await other.controller.open('services');await other.dialog.click('data-setup-group','maintenance');
  const rows=catalog.filter(x=>x.category==='maintenance');
  await Promise.all([other.dialog.click('data-setup-item',rows[0].id),other.dialog.click('data-setup-item',rows[1].id)]);
  assert.equal(servicePeak,1,'rapid choices write overlapping service batches');assert.equal(getSelected().size,2);
  failService=true;await other.dialog.click('data-setup-item',rows[2].id);other.controller.destroy();
  assert.ok(storage.get('kareta.master.setup:master:22').includes(rows[2].id),'failed service choice lost');
  failService=false;const resumed=mount();await resumed.controller.open('services');await resumed.dialog.click('data-setup-retry');
  assert.ok(getSelected().has(rows[2].id));resumed.controller.destroy();
  currentContext=33;const stopped=mount();let resolveLate;
  lateGet=new Promise(resolve=>resolveLate=resolve);const opening=stopped.controller.open('equipment');stopped.controller.destroy();
  const before=apiCalls.length;resolveLate({contextId:33,revision:0,selection:[],groups:equipment.groups,groupId:'diagnostic',items:[]});await opening;await tick();
  assert.equal(apiCalls.length,before,'destroyed context starts additional work');assert.equal(stopped.root.children.length,0);
  assert.ok(apiCalls.every(x=>x.cache===0),'private equipment catalog cached across users');
  currentContext=44;const conflict=mount();await conflict.controller.open('equipment');await conflict.dialog.click('data-setup-group','diagnostic');await conflict.dialog.click('data-setup-close');await conflict.controller.open('equipment');
  await conflict.dialog.click('data-setup-item','obd_scanner');await conflict.dialog.click('data-setup-access','owned');
  profile().revision++;profile().selection=[{equipmentId:'obd_scanner',access:'rented'}];
  await conflict.dialog.click('data-setup-close');assert.ok(conflict.dialog.innerHTML.includes('data-setup-use-draft'),'409 does not expose conflict choice');assert.equal(profile().selection[0].access,'rented','409 overwrites other tab before choice');
  const conflictingDraft=storage.get('kareta.master.equipment:44');await conflict.dialog.click('data-setup-group','engine');assert.equal(storage.get('kareta.master.equipment:44'),conflictingDraft,'browsing overwrites unresolved draft');
  await conflict.dialog.click('data-setup-use-draft');await conflict.dialog.click('data-setup-close');assert.equal(profile().selection[0].access,'owned','chosen draft does not save against latest revision');
  await conflict.controller.open('equipment');await conflict.dialog.click('data-setup-item','obd_scanner');await conflict.dialog.click('data-setup-access','need_buy');profile().revision++;profile().selection=[{equipmentId:'obd_scanner',access:'shared_sto'}];
  await conflict.dialog.click('data-setup-close');await conflict.dialog.click('data-setup-use-saved');const savedRevision=profile().revision;await conflict.dialog.click('data-setup-close');assert.equal(profile().revision,savedRevision,'keep-saved writes over current version');assert.ok(!storage.has('kareta.master.equipment:44'));conflict.controller.destroy();
  console.log(JSON.stringify({status:'PASS',transport:'MOCK',checks:['lazy-open','button-only','progressive-group','save-reopen','offline-draft','context-isolation','serialized-service-writes','service-draft-resume','late-response-cleanup','lost-reply-reconciliation','revision-conflict-choice','unresolved-draft-preserved','keep-saved-no-write'],browser:'NOT_RUN',database:'NOT_RUN'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
