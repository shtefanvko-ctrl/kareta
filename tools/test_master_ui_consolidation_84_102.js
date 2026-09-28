'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const reg=read('inc/asset_registry.php'),registry=read('js/next/route_registry.js'),loader=read('js/next/route_asset_loader.js');
const more=read('js/next/smart_action_hub.js'),access=read('js/next/role_access.js'),dynamic=read('js/next/dynamic_navigation.js');
const css=read('css/next/master_surface_contract.css'),surfaces=read('css/next/master_surfaces.css'),ownerCss=read('css/next/master_owner_profile.css');
const pageUi=read('js/next/page_ui.js'),cabinet=read('js/next/pages/cabinet.js'),workplace=read('js/next/pages/master_workplace.js'),schedule=read('js/next/pages/master_schedule.js');
expect(reg.includes("'serviceManagement' => [")&&reg.includes("'styles' => ['css/next/master_requests_workplace_services.css']"),'serviceManagement direct CSS dependency missing');
expect(reg.includes("'masterSurfaceContract' => [")&&reg.includes("'cascade' => 'last'")&&reg.includes("'css/next/master_surface_contract.css'"),'canonical Master Surface Contract bundle missing');
expect(reg.includes("'masterSchedule'")&&reg.includes("#/master/schedule"),'master schedule assets are not registered');
expect(!reg.includes("'css/next/master_workplace.css'"),'obsolete heavy master_workplace.css is still loaded on #/master');
expect(registry.includes("masterSchedule:Object.freeze({ path:'#/master/schedule'")&&registry.includes("if (hash === '#/master/schedule') return 'masterSchedule'"),'master schedule route is not native');
expect(!registry.includes("'#/master/schedule':'#/master'"),'legacy schedule redirect still collapses to dashboard');
expect(more.includes("{key:'masterSchedule',label:'Календарь',icon:'calendar'}"),'Master More calendar does not open own schedule');
expect(dynamic.includes("key:'masterSchedule'")&&access.includes("key==='masterSchedule' && normalizedRole!=='master'"),'master schedule access contract missing');
expect(pageUi.includes("masterPageClass = masterSurface ? ' k-master-page k-master-surface-page'"),'shared Master page wrapper missing');
expect(workplace.includes('k-master-page-header')&&schedule.includes('k-master-page-header'),'Master Page Header not used by workplace/schedule');
expect(cabinet.includes('k-staff-cabinet-head k-master-page-header'),'Master account header not consolidated');
expect(cabinet.includes("#/master/profile"),'Master account profile card points to non-Master profile');
for(const token of ['--k-master-content-max','--k-master-page-x','--k-master-page-y','--k-master-section-gap','--k-master-card-radius','--k-master-line','--k-master-surface']){
  expect(surfaces.includes(token)||css.includes(token),`layout token missing ${token}`);
}
expect(css.includes('--k-master-control-radius:12px')&&css.includes('--k-master-small-card-radius:16px')&&css.includes('--k-master-card-radius:20px')&&css.includes('--k-master-dialog-radius:24px'),'Master radius scale is not 12/16/20/24');
expect(!ownerCss.includes('max-width:2400px'),'legacy 2400px Master profile contour remains');
expect(css.includes('.k-staff-cabinet--master{width:100%;max-width:none'),'Master account remains artificially narrow');
expect(loader.includes('promoteCascadeStyles(bundle)'),'route cascade promotion missing');
console.log('OK MASTER UI CONSOLIDATION 84.102');
