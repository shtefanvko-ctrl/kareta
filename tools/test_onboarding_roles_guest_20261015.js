'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const role=read('js/next/onboarding/pages/role_page.js');
const lifecycle=read('js/next/onboarding/onboarding_lifecycle.js');
const bundle=read('js/boot/runtime_onboarding_bundle.js');
const styles=read('css/next/onboarding_kflow_reference.css');
const styleBundle=read('css/runtime_boot_bundle.css');
for(const id of ['client','master','sto','seller']){
 assert(role.includes("roleBranch('"+id+"')"),id+' missing from role choices');
 assert(bundle.includes("roleBranch('"+id+"')"),id+' missing from bundled runtime');
}
assert(role.includes("data-action=\"guest-preview\""));
assert(role.includes('Просто посмотреть'));
assert(role.includes("if(role==='sto')")&&role.includes("if(role==='seller')"));
assert(styles.includes('.k-flow-guest-preview')&&styleBundle.includes('.k-flow-guest-preview'));
assert(lifecycle.includes("['client','master','sto','seller'].includes(pendingRole)"));

const values=new Map(), transitions=[];
const sessionStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const location={hash:'#role:client:role'};
const history={replaceState:(_a,_b,hash)=>{location.hash=hash;}};
const deleted=[];
const document={getElementById:id=>({remove:()=>deleted.push(id)})};
let authenticated=false;
const kstate={read:()=>({}),role:x=>x,isDone:()=>false,write:()=>{},FLOW_KEY:'entry',DONE_KEYS:[]};
const draft={read:()=>({role:'client',pending:true}),patch:()=>{},currentRole:()=> 'client'};
const router={isOnboarding:()=>location.hash.startsWith('#role:'),parse:()=>location.hash.startsWith('#role:')?{role:'client',step:'role'}:null,canonical:()=> '#role:client:role'};
const app={setActive:value=>transitions.push(['active',value]),targetForRole:()=> '#/home'};
const window={KaretaOnboardingState:kstate,KaretaOnboardingProfileDraft:draft,KaretaOnboardingRouter:router,KaretaOnboardingApp:app,
 KaretaOnboardingProfilePages:{openFromRoute:()=>true},KaretaOnboardingNavigation:{audit:()=>({})},
 KaretaIdentity:{snapshot:()=>({authenticated})},KaretaNavigationCore:{refreshAll:()=>transitions.push(['nav'])},
 KaretaRouteRuntime:{transition:(route)=>transitions.push(['route',route])},addEventListener:()=>{}};
vm.runInNewContext(lifecycle,{window,document,location,history,sessionStorage,CustomEvent:class{},Promise,Date,setTimeout,console}, {filename:'onboarding_lifecycle.js'});
const flow=window.KaretaOnboardingLifecycle;
assert.equal(flow.enterGuestPreview(),true);
assert.equal(sessionStorage.getItem('kareta.entry.guestPreview.v1'),'1');
assert.equal(location.hash,'#/home');
assert.equal(flow.guestPreviewActive(),true);
assert(transitions.some(x=>x[0]==='route'&&x[1]==='home'));
assert(transitions.some(x=>x[0]==='active'&&x[1]===false));
assert.equal(flow.reconcile('resume'),false); // no forced registration after focus
assert.equal(flow.resume(), '#/home');
authenticated=true;assert.equal(flow.guestPreviewActive(),false); // no impersonation
authenticated=false;assert.equal(flow.enterGuestPreview(),true);
location.hash='#role:client:role';flow.dispatch('#role:client:role');
assert.equal(sessionStorage.getItem('kareta.entry.guestPreview.v1'),null); // explicit login
console.log('PASS role cards x4, guest preview anonymous + return to login, boot JS & CSS');
