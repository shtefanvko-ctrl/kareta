'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const access=fs.readFileSync(path.join(root,'js/next/role_access.js'),'utf8');
const rolePage=fs.readFileSync(path.join(root,'js/next/onboarding/pages/role_page.js'),'utf8');
const lifecycle=fs.readFileSync(path.join(root,'js/next/onboarding/onboarding_lifecycle.js'),'utf8');
const publicRoutes=['home','services','masters','parts','community','works','serviceDetail','providerDetail','productDetail','about','privacy','help'];
const protectedRoutes=['orders','chats','cabinet','cabinetGarage','masterDashboard','masterExchange','masterSchedule','stoDashboard','seller','adminUsers','adminMonitoring','identityMigration','notifications','following','requestNew','finance','workflow'];
const known=new Set([...publicRoutes,...protectedRoutes,'this-is-not-a-route']);
let identity={authenticated:false,mode:'anonymous'};
let guest='1';
const storage={getItem:k=>k==='kareta.guest.preview.v1'?guest:null};
const registry={has:k=>known.has(k),desktopKeys:[...known],mobileKeys:[...known]};
const sandbox={
 window:{KaretaRouteRegistry:registry,KaretaIdentity:{snapshot:()=>identity,has:()=>false},
  KaretaDynamicNavigation:{canAccess:()=>true,defaultRoute:()=> 'home',items:()=>publicRoutes},
  addEventListener(){},dispatchEvent(){}},
 document:{currentScript:{src:'test'},documentElement:{dataset:{identityMode:'anonymous'}}},
 sessionStorage:storage,localStorage:{getItem:()=>null},location:{hostname:'kareta.kz'},
 CustomEvent:class {}
};
vm.runInNewContext(access,sandbox,{filename:'role_access.js',timeout:1500});
const role=sandbox.window.KaretaRoleAccess;
for(const key of publicRoutes)assert.equal(role.canAccess(key),true,'public '+key);
for(const key of protectedRoutes)assert.equal(role.canAccess(key),false,'guest denied '+key);
assert.equal(role.canAccess('this-is-not-a-route'),false,'unknown denied');
for(const surface of ['mobile','desktop'])assert.ok(role.keys(surface).every(key=>!protectedRoutes.includes(key)),surface+' protected navigation');
assert.equal(role.hasCapability('*'),false,'guest cannot acquire wildcard');
identity={authenticated:true,mode:'identity',compatibilityRole:'admin'};
assert.equal(role.canAccess('adminUsers'),true,'authenticated Identity retains authority');
identity={authenticated:false,mode:'anonymous'};
sandbox.location.hostname='attacker.example';
assert.equal(role.canAccess('orders'),true,'preview flag has no effect on unrelated hosts; existing fallback preserved');
assert.match(rolePage,/const guestAllowed=\(\)=>\['kareta.kz','www.kareta.kz','s.kareta.kz'/);
assert.match(lifecycle,/const guestActive=\(\)=>\{/);
assert.match(lifecycle,/sessionStorage.getItem\('kareta.guest.preview.v1'\)==='1'/);
assert.match(lifecycle,/authenticated!==true/);
console.log('PASS guest public catalogue routes; protected routes, admin actions and capabilities denied on kareta.kz');
