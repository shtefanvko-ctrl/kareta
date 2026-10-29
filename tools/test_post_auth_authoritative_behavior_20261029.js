'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert').strict;
const source=fs.readFileSync(path.join(__dirname,'../js/next/onboarding/onboarding_app.js'),'utf8');
const profile={id:9,type:'profile',profileType:'master'};
const personal={id:8,type:'personal'};
let identity={loaded:true,authenticated:true,context:profile,contexts:[profile,personal]};
let current={status:'completed',currentStep:4,currentView:'master-review'};
let shouldFail=false;
const calls=[];
const identityApi={
 snapshot:()=>identity,
 load:async options=>{calls.push(['load',options]);return identity;},
 select:async id=>{calls.push(['select',id]);identity={...identity,context:identity.contexts.find(x=>x.id===id)||null};return identity;}
};
const resolver={
 role:(result,flow,user)=>result?.selectedRole||flow?.entryRole||user?.entry_role||user?.role||'client',
 resolve:(result,flow,user)=>{
   const role=resolver.role(result,flow,user);
   return {ok:true,role,target:role==='master'?'#/onboarding/master?step=1&view=master-profile':
       role==='seller'?'#/seller':'#/home'};
 }
};
const context={
 window:{
  KaretaOnboardingState:{role:r=>r},
  KaretaOnboardingProfileDraft:{},
  KaretaOnboardingRouter:{},
  KaretaOnboardingApi:{},
  KaretaPostAuthFirstEntryResolver:resolver,
  KaretaIdentity:identityApi,
  KaretaMasterOnboardingGate:{
   check:async options=>{calls.push(['check',options]);if(shouldFail)throw Error('API unavailable');return current;}
  }
 },
 console:{warn(){}},
 document:{documentElement:{classList:{toggle(){}}},body:{classList:{toggle(){}}}}
};
vm.runInNewContext(source,context,{filename:'onboarding_app.js'});
const route=(role)=>context.window.KaretaOnboardingApp.authoritativeTargetAfterAuth(
 {selectedRole:role},{entryRole:role},{entry_role:role,role});
(async()=>{
 assert.equal(await route('master'),'#/master','completed master must enter work area');
 assert.equal(calls.filter(x=>x[0]==='check').length,1,'live server status must be checked');
 current={status:'in_progress',currentStep:3,currentView:'master-work-place'};
 assert.equal(await route('master'),'#/onboarding/master?step=3&view=master-work-place');
 current={status:'not_started',currentStep:1,currentView:'master-profile'};
 assert.equal(await route('master'),'#/onboarding/master?step=1&view=master-profile');
 shouldFail=true;
 assert.equal(await route('master'),'#/onboarding/master?step=1&view=master-profile',
 'status-fetch failure must not expose master workspace');
 shouldFail=false;
 identity={loaded:true,authenticated:true,context:personal,contexts:[personal]};
 await assert.rejects(route('master'),e=>e.code==='master_context_not_selected',
 'personal context cannot masquerade as master');
 identity={loaded:true,authenticated:false,context:profile,contexts:[profile]};
 await assert.rejects(route('master'),e=>e.code==='session_required',
 'anonymous cannot access master');
 identity={loaded:true,authenticated:true,context:personal,contexts:[personal]};
 assert.equal(await route('client'),'#/home');
 identity={loaded:true,authenticated:true,context:profile,contexts:[profile]};
 assert.equal(await route('seller'),'#/seller');
 console.log('QA_POST_AUTH_AUTHORITATIVE_BEHAVIOR: PASS 8/8 master/client/seller routes, deny on unknown state/context/session');
})().catch(err=>{console.error(err.stack);process.exitCode=1});

[executed on device: KaretaMeneger (aee288ef-382f-43d6-933b-f16fb6b5c0bd)]