'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const api=read('js/next/onboarding/onboarding_api.js');
const app=read('js/next/onboarding/onboarding_app.js');
const resolver=read('js/next/onboarding/post_auth_first_entry_resolver.js');
const server=read('api/auth_session.php');
const gateway=read('api/onboarding_code.php');
const bootstrap=read('api/bootstrap.php');
const roleKeys=['client','master','sto','seller'];

for(const token of [
  "['client','master','sto','seller'], true)) $selectedEntryRole",
  "['client','master','sto','seller'], true)) $entryRole"
]) assert(server.includes(token),'primary gateway clamped a selected role: '+token);
assert(gateway.includes("['client','master','sto','seller'],true)"),'secondary gateway clamped a selected role');
assert(bootstrap.includes("VALUES(?,?,'pending',?)"),'business role application moderation missing');
assert(bootstrap.includes("$role     = (string)($existing['role'] ?? 'client');"),'legacy role grant authority missing');

const posted=[],bag=new Map();
const store={setItem:(key,value)=>bag.set(key,String(value)),removeItem:key=>bag.delete(key),getItem:key=>bag.get(key)||null};
const mockWindow={KaretaRuntimeLog:{add:()=>{}}};
const mockResponse={ok:true,status:200,text:async()=>JSON.stringify({ok:true,verified:true,phone:'+77009999977',existingAccount:false}),headers:{get:()=>''}};
vm.runInNewContext(api,{window:mockWindow,sessionStorage:store,navigator:{onLine:true},
  fetch:async(_url,request)=>{posted.push(JSON.parse(request.body));return mockResponse;},
  AbortController,console,setTimeout,clearTimeout});
const roles=mockWindow.KaretaOnboardingApi;
assert(roles&&typeof roles.verifyCode==='function','OTP API not exported');

const roleWindow={};
vm.runInNewContext(resolver,{window:roleWindow});
const routing=roleWindow.KaretaPostAuthFirstEntryResolver;
const personal={authenticated:true,currentContext:{type:'personal'}};
const storeContext={authenticated:true,currentContext:{type:'organization',organizationType:'parts_store'}};
const serviceContext={authenticated:true,currentContext:{type:'organization',organizationType:'service_station'}};
assert.equal(routing.resolve({selectedRole:'seller',identity:personal,postAuth:{redirectRoute:'#/seller'}}).target,'#/home','pending seller gained workspace');
assert.equal(routing.resolve({selectedRole:'sto',identity:personal,postAuth:{redirectRoute:'#/sto'}}).target,'#/home','pending STO gained workspace');
assert.equal(routing.resolve({selectedRole:'seller',identity:storeContext,postAuth:{redirectRoute:'#/seller'}}).target,'#/seller');
assert.equal(routing.resolve({selectedRole:'sto',identity:serviceContext,postAuth:{redirectRoute:'#/sto'}}).target,'#/sto');
assert.equal(routing.resolve({selectedRole:'seller',identity:null,postAuth:{redirectRoute:'#/seller'}}).target,'#/home','missing identity must not grant store');

const cache=new Map();
const storage={setItem:(key,value)=>cache.set(key,value),removeItem:key=>cache.delete(key),getItem:key=>cache.get(key)||null};
const appWindow={
  KaretaOnboardingState:{role:value=>roleKeys.includes(String(value))?String(value):'client'},
  KaretaOnboardingProfileDraft:{},KaretaOnboardingRouter:{},KaretaOnboardingApi:{},
  KaretaPostAuthFirstEntryResolver:routing,KaretaRuntimeLog:{add:()=>{}},
  KaretaIdentity:{bootstrapSession:identity=>identity},
  KaretaNext:{state:{}},dispatchEvent:()=>{},
};
vm.runInNewContext(app,{window:appWindow,document:{documentElement:{dataset:{}}},
  localStorage:storage,sessionStorage:storage,CustomEvent:class{},console,Date,Promise});
const sync=appWindow.KaretaOnboardingApp.synchronizeSession;
const baseUser={phone:'+77009999977',name:'Test',role:'client'};
const flow={role:'seller',entryRole:'seller',accountName:'Test'};
const pending=sync({user:baseUser,selectedRole:'seller',identity:personal,roleApplication:{status:'pending',requestedRole:'seller'}},flow);
assert.equal(pending.role,'client','unapproved business role became effective');
assert.equal(pending.entry_role,'seller','requested role disappeared from session');
const approved=sync({user:baseUser,selectedRole:'seller',identity:storeContext},flow);
assert.equal(approved.role,'seller','authorized store context lost');
assert.equal(approved.entry_role,'seller');

(async()=>{
  for(const role of [...roleKeys,'unexpected']){
    await roles.verifyCode('+77009999977','0000',4,role);
    const payload=posted.at(-1);
    assert.equal(payload.action,'onboarding.verifyCode');
    assert.equal(payload.entryRole,role==='unexpected'?'client':role,'OTP role mismatch: '+role);
  }
  console.log('PASS four-role OTP selection, existing gateway parity, moderated context and pending routing');
})().catch(error=>{console.error(error);process.exitCode=1;});
