'use strict';
// Filesystem-only regression for route recovery, no network, browser or DB.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../js/next/recovery_manager.js'),'utf8');
function fixture(hash,options={}){
 const events={},actions=[],logs=[];
 const context={
  location:{hash},navigator:{onLine:true},Date,Promise,Set,CustomEvent:class CustomEvent{constructor(name,opts){this.type=name;this.detail=opts?.detail}},
  document:{documentElement:{dataset:{},removeAttribute(){}},querySelectorAll(){return []}},
  window:{addEventListener(name,callback){events[name]=callback},setTimeout(callback){callback()},dispatchEvent() {},
   KaretaRuntimeLog:{add(type,data){logs.push({type,data})}},
   KaretaOnboardingRouter:options.routerAbsent?null:{isOnboarding(value){return /^#(?:\/)?(?:role|onboarding|entry):/.test(value)}},
   KaretaOnboardingBridge:options.bridgeAbsent?null:{isOnboardingHash(value){return /^#(?:\/)?(?:role|onboarding|entry):/.test(value)}},
   KaretaRealtime:{stop() {},start(){}},KaretaRealtimeClient:{stop(){},start(){}},
   KaretaIdentity:{async load(){return options.identity||{authenticated:false}}},
   KaretaNavigationCore:{refreshAll(){actions.push('refresh')},resolveRoute(key){return key==='masterExchange'?'masterExchange':'home'},defaultRoute(){return 'home'}},
   KaretaContextManager:{render(){actions.push('context-render')}},
   KaretaRouteRegistry:{keyFromHash(value){return value==='#/master/exchange'?'masterExchange':''}},
   KaretaRouteRuntime:{navigate(key){actions.push('navigate:'+key);context.location.hash='#/'+key}}
  }
 };
 vm.runInNewContext(source,context,{filename:'recovery_manager.js'});
 return {recovery:context.window.KaretaRecovery,actions,logs,location:context.location,events};
}
(async()=>{
 for(const hash of ['#role:master:welcome','#role:client:profile','#onboarding:master:role','#entry:master:welcome']){
  const f=fixture(hash);await f.recovery.recoverIdentity('identity_401',{force:true});
  assert.strictEqual(f.location.hash,hash,`onboarding hash lost ${hash}`);
  assert.strictEqual(f.actions.length,0,`SPA navigate during onboarding ${hash}`);
  assert(f.logs.some(x=>x.type==='recovery.onboarding-route-preserved'));
  console.log('PASS preserve onboarding deep-link:',hash);
 }
 let f=fixture('#role:master:welcome',{bridgeAbsent:true});await f.recovery.recoverIdentity('identity_401',{force:true});
 assert.strictEqual(f.location.hash,'#role:master:welcome');console.log('PASS router fallback preserves onboarding hash');
 f=fixture('#/master/exchange');await f.recovery.recoverIdentity('identity_401',{force:true});
 assert(f.actions.includes('navigate:masterExchange'),'ordinary SPA recovery broken');console.log('PASS ordinary SPA route recovered');
 f=fixture('#role:master:welcome',{identity:{authenticated:true,contexts:[{id:1,type:'personal'}],context:{id:1,type:'personal'},mode:'identity'}});
 await f.recovery.recoverIdentity('context_lost',{force:true});assert(!f.actions.some(x=>x.startsWith('navigate:')));console.log('PASS authenticated recovery does not hijack registration');
 console.log('RECOVERY_ONBOARDING_HASH: PASS');
})().catch(e=>{console.error('RECOVERY_ONBOARDING_HASH: FAIL',e.stack);process.exitCode=1});
