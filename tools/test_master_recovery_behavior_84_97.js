'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');let count=0;
const check=(value,msg)=>{assert.ok(value,msg);count++;};
async function main(){
 let identity={mode:'identity',authenticated:true,compatibilityRole:'master',context:{id:11}};
 let answer={ok:true,contextId:11,status:'in_progress'},pending=null;
 const storage=new Map([['kareta.master.onboarding.status.v1:11',JSON.stringify({status:'completed'})]]);
 const transitions=[];
 const sandbox={window:{KaretaIdentity:{snapshot:()=>identity},addEventListener(){},KaretaRouteRuntime:{transition:(...a)=>transitions.push(a)}},location:{hash:'#/master'},history:{replaceState(){}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async()=>{if(pending)return pending;return{ok:true,text:async()=>JSON.stringify(answer)};},Date,Set,Promise,JSON};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'js/next/master_onboarding_gate.js'),'utf8'),sandbox);
 const gate=sandbox.window.KaretaMasterOnboardingGate;
 check(!gate.workAccessAllowed(),'cached completion must not authorize');
 check(!(await gate.ensureCompleted()),'incomplete account is blocked');
 check(transitions.at(-1)[0]==='masterOnboarding','incomplete account redirected');
 answer={ok:true,contextId:11,status:'completed'};
 check(await gate.ensureCompleted(),'server completion unlocks');
 let resolve;pending=new Promise(r=>resolve=r);const first=gate.check({redirect:false});
 identity={...identity,context:{id:22}};check(!gate.workAccessAllowed(),'context switch relocks immediately');
 resolve({ok:true,text:async()=>JSON.stringify({ok:true,contextId:11,status:'completed'})});await first;pending=null;
 check(!gate.workAccessAllowed(),'stale completion cannot authorize another context');
 gate.markCompleted(11);check(!gate.workAccessAllowed(),'completion of previous context ignored');
 answer={ok:true,contextId:22,status:'completed'};check(await gate.ensureCompleted(),'new context needs its own response');
 sandbox.fetch=async()=>{throw new Error('offline');};check(!(await gate.ensureCompleted()),'failure closes access despite prior completion');
 identity={...identity,compatibilityRole:'client',context:{id:33}};check(gate.workAccessAllowed(),'client routes remain available');
 vm.runInContext(fs.readFileSync(path.join(root,'js/next/work_orders/master_workplace_api.js'),'utf8'),sandbox);
 identity={...identity,compatibilityRole:'master',context:{id:44}};let requests=0;const api={request:()=>{requests++;return Promise.resolve({ok:true});}};
 for(const [method,payload] of [['get',{}],['startTimer',{orderId:'o1'}],['saveAvailability',{status:'busy'}],['saveOrderPlan',{orderId:'o1'}],['saveExchangeResponse',{request_id:'r1'}]]){
   const result=await sandbox.window.KaretaMasterWorkplaceApi[method](api,payload);check(!result.ok&&result.payload.code==='MASTER_ONBOARDING_REQUIRED',`${method} blocked`);
 }
 check(requests===0,'blocked actions never request business data');
 // Load the real page in a VM; export pure helpers only in this test harness.
 const page=fs.readFileSync(path.join(root,'js/next/pages/master_onboarding.js'),'utf8').replace('window.KaretaMasterOnboardingPages=Object.freeze({renderMasterOnboarding:renderPage,mountMasterOnboarding});','window.testPage={defaultDraft,mergeDraft,filteredServices,draftForStorage,flushDraft,loadCatalog,model};');
 const pageEnv={window:{},Set,Map,Intl,URLSearchParams,AbortController,setTimeout,clearTimeout,navigator:{onLine:true},document:{querySelector:()=>null}};vm.createContext(pageEnv);vm.runInContext(page,pageEnv);
 const helpers=pageEnv.window.testPage;helpers.model.draft=helpers.defaultDraft();
 helpers.model.catalog=Array.from({length:80},(_,id)=>({id}));check(helpers.filteredServices().length===80,'catalog pagination exposes every loaded service');
 helpers.model.draft.viewState={modal:'avatar-crop',temp:{dataUrl:'do-not-store'}};
 check(helpers.draftForStorage().viewState.temp===null,'crop bytes excluded from persisted draft');
 check(helpers.model.draft.viewState.temp.dataUrl==='do-not-store','sanitization does not mutate editing state');
 // A second caller (submit) must wait for edits queued during the first save.
 const saveCalls=[];let releaseSave;
 pageEnv.fetch=async(_url,options)=>{
   const body=JSON.parse(options.body);saveCalls.push(body);
   if(saveCalls.length===1)await new Promise(resolve=>releaseSave=resolve);
   return {ok:true,text:async()=>JSON.stringify({ok:true,status:'in_progress',revision:body.expectedRevision+1})};
 };
 helpers.model.status='ready';helpers.model.savePending=true;
 const saving=helpers.flushDraft();
 helpers.model.draft.profile.displayName='Latest name';helpers.model.savePending=true;
 const submitWait=helpers.flushDraft();releaseSave();await Promise.all([saving,submitWait]);
 check(saveCalls.length===2,'queued changes saved before submit continues');
 check(saveCalls[1].expectedRevision===1&&saveCalls[1].draft.profile.displayName==='Latest name','queued write uses new revision and current draft');
 check(helpers.model.revision===2&&!helpers.model.savePending,'save queue drained');
 pageEnv.navigator.onLine=false;helpers.model.savePending=true;await helpers.flushDraft();
 check(saveCalls.length===2&&helpers.model.savePending,'offline draft retained without network');
 pageEnv.navigator.onLine=true;
 pageEnv.fetch=async()=>({ok:false,status:409,text:async()=>JSON.stringify({ok:false,error:'draft_revision_conflict',revision:9,draft:{services:[]}})});
 await assert.rejects(()=>helpers.flushDraft());
 check(helpers.model.remoteDraft.revision===9&&helpers.model.savePending,'conflict keeps local edits and offers server revision');
 check(helpers.model.draft.profile.displayName==='Latest name','conflict never silently overwrites local draft');
 let conflictRequests=0;pageEnv.fetch=async()=>{conflictRequests++;throw new Error('unexpected');};await helpers.flushDraft();
 check(conflictRequests===0,'unresolved conflict cannot overwrite server');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'api/migration_manifest.json'),'utf8'));
 const php=fs.readFileSync(path.join(root,'api/migration_manifest.php'),'utf8');
 check(manifest.targetDbVersion===129&&manifest.migrations.length===129,'active migration version remains 129');
 const crypto=require('crypto');for(const m of manifest.migrations){assert.ok(php.includes(`'${m.file}', 'checksum' => '${m.sha256}'`));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/migrations',m.file))).digest('hex'),m.sha256);}
 check(true,'PHP/JSON manifests and all 129 checksums agree');
 console.log(`MASTER_RECOVERY_BEHAVIOR_84_97 ${count}/${count}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
