'use strict';
const {read,routePlan,styleOrder,MASTER_ROUTE_KEYS}=require('./master_route_contract_utils');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const plan=routePlan(),surface='css/next/master_surface_contract.css';
for(const key of MASTER_ROUTE_KEYS){
  const order=styleOrder(plan,[key]);
  expect(order.includes(surface),`${key}: Master Surface Contract not loaded on direct entry`);
  expect(order.at(-1)===surface,`${key}: canonical Master Surface Contract is not last on direct entry`);
}
const serviceDirect=styleOrder(plan,['serviceManagement']);
expect(serviceDirect.includes('css/next/master_requests_workplace_services.css'),'serviceManagement direct entry lacks master_requests_workplace_services.css');
expect(serviceDirect.indexOf('css/next/master_requests_workplace_services.css')<serviceDirect.indexOf(surface),'serviceManagement stylesheet must load before final Master Surface Contract');
const pageUi=read('js/next/page_ui.js');
expect(pageUi.includes("masterPageClass = masterSurface ? ' k-master-page k-master-surface-page'"),'pageShell does not assign Master wrapper');
const wrappers={
  masterDashboard:['js/next/pages/master_workplace.js','k-master-page k-master-surface-page'],
  masterSchedule:['js/next/pages/master_schedule.js','k-master-page k-master-surface-page'],
  masterExchange:['js/next/pages/work_feed.js','k-master-page k-master-surface-page'],
  masterProfileOwner:['js/next/pages/master_profile_owner.js','k-master-page k-master-surface-page'],
  masterWallOwner:['js/next/pages/master_wall.js','k-master-page k-master-surface-page'],
  masterWorks:['js/next/pages/master_works.js','k-master-page k-master-surface-page'],
  masterReviews:['js/next/pages/master_reviews.js','k-master-page k-master-surface-page'],
  cabinet:['js/next/pages/cabinet.js','k-master-page k-master-surface-page'],
  parts:['js/next/pages/parts.js','k-master-page k-master-surface-page'],
  community:['js/next/pages/community.js',"k-master-page k-master-surface-page"],
};
for(const [key,[file,needle]] of Object.entries(wrappers))expect(read(file).includes(needle),`${key}: explicit Master wrapper missing`);
const css=read(surface);
for(const token of ['--k-master-content-max','--k-master-page-x','--k-master-page-y','--k-master-section-gap','--k-master-card-radius','--k-master-line','--k-master-surface'])expect(css.includes(token),`Master layout token missing: ${token}`);
expect(css.includes('.k-master-page-header'),'Master Page Header contract missing');
console.log('OK master_direct_route_visual_test');
