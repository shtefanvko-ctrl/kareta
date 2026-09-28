'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/pages/cabinet.js'),'utf8');
let failures=0;
function expect(name,ok,detail=''){
  if(ok) console.log(`[PASS] ${name}${detail?` — ${detail}`:''}`);
  else { failures++; console.error(`[FAIL] ${name}${detail?` — ${detail}`:''}`); }
}
const sandbox={
  console,
  Intl,
  URL,
  FormData: class FormData {},
  HTMLFormElement: class HTMLFormElement {},
  setTimeout:()=>0,
  clearTimeout:()=>{},
  sessionStorage:{setItem(){},getItem(){return null;},removeItem(){}},
  location:{hash:'#/cabinet'},
  document:{
    querySelector(){return null;},
    querySelectorAll(){return [];},
    getElementById(){return null;},
    documentElement:{classList:{toggle(){}}}
  },
};
sandbox.window=sandbox;
sandbox.window.KaretaPageUI={replace(){}};
sandbox.window.KaretaClientCabinetApi={};
sandbox.window.KaretaFirstVehicleFlow={};
sandbox.window.KaretaRoleAccess={currentRole:()=> 'client',hasCapability:()=>true};
sandbox.window.KaretaNext={state:{user:{role:'client'}}};
try{
  vm.runInNewContext(source,sandbox,{filename:'cabinet.js'});
  expect('cabinet.js executes without ReferenceError',true);
}catch(error){
  expect('cabinet.js executes without ReferenceError',false,error&&error.stack||String(error));
}
const pages=sandbox.window.KaretaCabinetPages;
expect('KaretaCabinetPages exported',!!pages);
for(const name of ['renderCabinet','renderGarage','renderData','renderHistory','renderDocuments','renderPromos','renderTariff','renderSettings','mountCabinet','mountGarage','mountData','mountHistory','mountDocuments','mountPromos','mountTariff','mountSettings','refreshClientCabinet']){
  expect(`export ${name} is callable`,typeof pages?.[name]==='function');
}
expect('mountData implementation retained',/async function mountData\s*\(/.test(source));
expect('account-window bridge retained',/function openClientAccountWindow\s*\(/.test(source));
process.exit(failures?1:0);
