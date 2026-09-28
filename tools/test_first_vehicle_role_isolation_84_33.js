
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const flow=read('js/next/client/first_vehicle_flow.js');
const cabinet=read('js/next/pages/cabinet.js');
const access=read('js/next/role_access.js');
const dynamic=read('js/next/dynamic_navigation.js');
const css=read('css/next/first_vehicle_flow.css');
const version=read('inc/asset_version.php');
const sw=read('sw.js');
const checks=[];const expect=(n,v)=>{checks.push([n,!!v]);console.log(`${v?'PASS':'FAIL'} ${n}`)};
expect('first vehicle takeover hides shared header and mobile nav',css.includes('html.k-first-vehicle-active #k-shell-header')&&css.includes('html.k-first-vehicle-active #k-mobile-nav')&&css.includes('display:none!important'));
expect('first vehicle takeover removes app and outlet gutters',css.includes('html.k-first-vehicle-active .k-app-shell')&&css.includes('padding-top:0!important')&&css.includes('html.k-first-vehicle-active #k-page-outlet')&&css.includes('padding:0!important'));
expect('first vehicle root is full viewport height',css.includes('.k-page.k-client-cabinet-page.k-first-vehicle-page')&&css.includes('min-height:100dvh!important'));
expect('flow activates and deactivates fullscreen surface',flow.includes("classList.add('k-first-vehicle-active')")&&flow.includes("classList.remove('k-first-vehicle-active')")&&flow.includes("if(!String(location.hash||'').startsWith('#/cabinet/garage'))deactivateSurface()"));
expect('third review step removed',!flow.includes('function review(draft)')&&!flow.includes('Проверьте автомобиль')&&!flow.includes("['3','Гараж']")&&flow.includes('data-first-vehicle-save'));
expect('minimal card remains brand model year',flow.includes('name="brandName"')&&flow.includes('name="modelName"')&&flow.includes('name="year"'));
expect('cabinet role follows active interface context first',cabinet.includes('KaretaNavigationCore?.interfaceRole?.()')&&cabinet.includes("function isClientCabinetRole(){return currentRole()==='client';}"));
expect('master cannot inherit client garage from capabilities',!cabinet.includes("hasCapability?.('vehicles.read')===true"));
expect('identity client subroutes restricted to personal context',dynamic.includes("{ key:'cabinetGarage', section:'account', any:['vehicles.read'], contextTypes:['personal'] }")&&dynamic.includes("{ key:'cabinetHistory', section:'account', any:['requests.read'], contextTypes:['personal'] }"));
expect('legacy client subroutes blocked for non-client role',access.includes('CLIENT_ONLY_ROUTES')&&access.includes("normalizedRole!=='client'"));
expect('release 84.33',version.includes('188.5.5.6.84.33')&&sw.includes('188.5.5.6.84.33'));
const bad=checks.filter(x=>!x[1]);console.log(`\
${checks.length-bad.length}/${checks.length} checks passed`);process.exit(bad.length?1:0);
