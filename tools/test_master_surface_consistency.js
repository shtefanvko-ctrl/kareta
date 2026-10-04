#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const exchange=read('js/next/pages/work_feed.js');
const schedule=read('js/next/pages/master_schedule.js');
const orders=read('js/next/pages/orders.js');
const services=read('js/next/pages/service_management.js');
const community=read('js/next/pages/community.js');
const parts=read('js/next/pages/parts.js');
const pageUi=read('js/next/page_ui.js');
const css=read('css/next/master_surfaces.css');

expect(exchange.includes('k-master-page k-master-surface-page')&&exchange.includes('k-exchange-r131-toolbar'),'exchange must use master surface + search toolbar');
expect(schedule.includes('k-master-page k-master-surface-page')&&schedule.includes('k-master-schedule-canon-shell'),'schedule must use master surface + canonical shell');
expect(orders.includes('k-orders-canon-shell')&&orders.includes('ui.pageShell(context,copy.title'),'orders must use pageShell + canonical shell');
expect(services.includes('k-services-canon-shell')&&services.includes('k-master-canon-search')&&services.includes('k-master-canon-filters'),'services must use canonical search/filter shell');
expect(community.includes("isMasterRole()?' k-master-page k-master-surface-page':''")&&community.includes('k-community-canon-shell'),'community must opt into master surface and canonical community shell');
expect(parts.includes("isMasterContext()?' k-master-page k-master-surface-page':''")&&parts.includes('k-parts-canon-shell'),'parts must opt into master surface and canonical search shell');
expect(pageUi.includes("const masterPageClass = masterSurface ? ' k-master-page k-master-surface-page' : ''"),'pageShell master surface bridge missing');

for(const bp of ['@media(max-width:767px)','@media(min-width:768px) and (max-width:1199px)','@media(min-width:1200px)']){
  expect(css.includes(bp),'master surfaces missing '+bp);
}
for(const cls of ['.k-master-canon-search-shell','.k-master-canon-search','.k-master-canon-filters']){
  expect(css.includes(cls),'canonical control CSS missing '+cls);
}

if(fail.length){for(const item of fail)console.error('FAIL',item);process.exit(1);}
console.log('MASTER_SURFACE_CONSISTENCY: PASS — exchange/schedule/orders/services/community/parts');
