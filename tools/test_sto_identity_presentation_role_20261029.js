'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('js/next/role_access.js','utf8');

function boot(opts={}){
  let interfaceRole=opts.interfaceRole??'sto';
  const auth={authenticated:opts.authenticated!==false,mode:opts.authenticated===false?'anonymous':'identity',compatibilityRole:opts.compatibilityRole??'client'};
  const window={
    KaretaRouteRegistry:{has:key=>['services','masters','diagnostics','home'].includes(key),desktopKeys:['home','services','masters'],mobileKeys:['home']},
    KaretaIdentity:{snapshot:()=>auth,has:()=>false},
    KaretaDynamicNavigation:{canAccess:key=>opts.capabilityAllowed===true,items:()=>[],defaultRoute:()=> 'home',refresh:()=>{}},
    KaretaNavigationCore:opts.missingCore?undefined:{interfaceRole:()=>interfaceRole},
    addEventListener:()=>{},dispatchEvent:()=>{}
  };
  const doc={currentScript:{src:'/js/next/role_access.js'},documentElement:{dataset:{identityMode:opts.authenticated===false?'anonymous':'identity'}}};
  vm.runInNewContext(code,{window,document:doc,localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},CustomEvent:class CustomEvent{},Object,Array,Set,String,JSON});
  return window.KaretaRoleAccess;
}
const sto=boot({interfaceRole:'sto',compatibilityRole:'client'});
assert.equal(sto.currentRole(),'sto','STO organization context must win over old client compatibilityRole');
assert.equal(sto.snapshot().role,'sto','role snapshot must agree with currentRole');
assert.equal(sto.canAccess('masters'),false,'STO display role cannot grant server capability access');
assert.equal(boot({interfaceRole:'sto',compatibilityRole:'client',capabilityAllowed:true}).canAccess('masters'),true,'capability navigation should retain authority');
assert.equal(boot({interfaceRole:'master'}).currentRole(),'master');
assert.equal(boot({interfaceRole:'client'}).currentRole(),'client');
assert.equal(boot({interfaceRole:'seller'}).currentRole(),'seller');
assert.equal(boot({interfaceRole:'admin'}).currentRole(),'admin');
assert.equal(boot({missingCore:true,compatibilityRole:'sto'}).currentRole(),'sto','legacy compatibility should still work if nav module has not loaded');
assert.equal(boot({authenticated:false,interfaceRole:'sto'}).currentRole(),'client','unauthenticated state must never inherit STO presentation');
console.log('PASS identity presentation role coherence and capability boundary');
