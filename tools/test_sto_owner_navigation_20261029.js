'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const masterSource=fs.readFileSync('js/next/pages/masters.js','utf8');
const serviceSource=fs.readFileSync('js/next/pages/services.js','utf8');
const manageSource=fs.readFileSync('js/next/pages/service_management.js','utf8');

function mastersView(role,hash){
  const window={KaretaRoleAccess:{currentRole:()=>role},KaretaUIIcons:{icon:()=>'',svg:()=>''}};
  const location={hash};
  vm.runInNewContext(masterSource,{window,location,URLSearchParams,Intl,Number,String,Object,Array,encodeURIComponent});
  return window.KaretaMastersPages.renderMasters();
}
let markup=mastersView('sto','#/masters');
assert.match(markup,/data-sto-team/,'STO must initially see its assigned team');
assert.match(markup,/data-sto-all-masters/,'STO must be able to open the shared directory');
markup=mastersView('sto','#/masters?view=directory');
assert.doesNotMatch(markup,/data-sto-team(?:\\s|>)/,'Directory must not be confused with the team view');
assert.match(markup,/data-sto-own-masters/,'STO must have a My masters button beside directory filters');
markup=mastersView('client','#/masters');
assert.doesNotMatch(markup,/data-sto-own-masters/,'Clients cannot see STO-only actions');
assert.doesNotMatch(markup,/data-sto-team/,'Client should keep the directory');

assert.match(serviceSource,/stoOwnerContext\(\)&&isServicesRoot\(\)/,'STO service root must be redirected to own offers');
assert.match(serviceSource,/location\.replace\('#\/services\/manage'\)/,'Own offers route must be existing serviceManagement');
assert.match(serviceSource,/URLSearchParams[^\n]+\.has\('view'\)/,'Explicit catalogue view must remain reachable');
assert.match(manageSource,/#\/services\?view=catalog/,'STO must be able to return to shared catalogue');
console.log('STO owner navigation regression: PASS (static routes and isolated masters renderer)');
