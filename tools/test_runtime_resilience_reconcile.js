'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=[];
const expect=(v,m)=>{if(!v)fail.push(m);};
const loader=read('js/next/route_asset_loader.js');
const menu=read('js/next/shell_menu.js');
const bundle=read('js/boot/runtime_shell_bundle.js');

for(const source of [loader,bundle]){
  expect(source.includes('if(link.sheet){complete();return;}'),'applied stylesheet timeout guard missing');
  expect(source.includes('kareta_retry=1'),'bounded CSS retry marker missing');
  expect(source.includes('if(attemptNo<1)'),'CSS retry is not bounded to one retry');
  expect(source.includes('link.dataset.karetaRouteAttempt=String(attemptNo+1)'),'route CSS attempt telemetry missing');
}
for(const source of [menu,bundle]){
  expect(source.includes('k-menu-link__icon'),'burger menu icon slot contract missing');
  expect(source.includes("routeName?.(key)||'warning'"),'burger icon fallback name missing');
  expect(source.includes("svg?.('warning')"),'burger SVG fallback missing');
}
expect(!menu.includes('k-menu-profile__avatar'),'legacy drawer profile/avatar surface must not be reintroduced');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('RUNTIME_RESILIENCE_RECONCILE: PASS cssRetry=1 appliedSheetGuard=1 burgerFallback=1 legacyAvatar=0');
