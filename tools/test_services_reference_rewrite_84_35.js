'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const errors=[];
const must=(ok,msg)=>{if(!ok)errors.push(msg);};

const services=read('js/next/pages/services.js');
const cards=read('js/next/catalog_cards.js');
const css=read('css/next/reference_client_pages.css');
const version=read('inc/asset_version.php');

must(!services.includes('k-services-ref-flow'),'legacy services 4-step flow must be removed from /services');
must(!css.includes('.k-services-ref-flow'),'legacy services flow CSS must be removed');
must(services.includes('k-community-reference-composer k-services-reference-composer'),'services search must reuse community composer surface');
must(services.includes('data-services-toolbar-search'),'services composer search input missing');
must(services.includes('function referenceTabs()'),'services reference tabs renderer missing');
must(services.includes("active===key?'is-active':''"),'services tabs do not compute active state');
for(const label of ['Все','Ремонт','Диагностика','Кузов'])must(services.includes(`'${label}'`)||services.includes(`>${label}<`),`services tab missing: ${label}`);
must(services.includes('k-services-reference-layout'),'services must use the rewritten single reference layout');
must(!services.includes('k-flow-services-layout'),'legacy services flow layout still rendered');
must(!services.includes('k-flow-context-rail'),'legacy request context rail still rendered in services');
must(cards.includes('class="k-services-ref-card k-services-ref-card--service"'),'service catalog card must use k-services-ref-card');
for(const legacy of ['k-catalog-card-service','k-service-catalog-card']){
  must(!cards.includes(legacy),`legacy service card class still emitted: ${legacy}`);
}
must(css.includes('.k-services-ref-card--service'),'service reference card styling missing');
must(css.includes('.k-services-ref-services-grid'),'stable services result grid missing');
must(css.includes('.k-services-reference-composer input'),'community-style services search input CSS missing');
const versionMatch=version.match(/188\.5\.5\.6\.84\.(\d+)/);
must(Number(versionMatch?.[1]||0)>=35,'asset version must be 84.35 or newer');

if(errors.length){console.error(errors.map(e=>'FAIL: '+e).join('\n'));process.exit(1);}
console.log('R188.5.5.6.84.35 services reference rewrite: OK');
