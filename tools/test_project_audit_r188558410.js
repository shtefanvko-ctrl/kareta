'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message);};

const core=read('js/next/pages/core.js');
const requestWindow=read('js/next/request_window.js');
const details=read('js/next/pages/details.js');
const homeCss=read('css/next/home_responsive.css');
const version=read('inc/asset_version.php');
const config=read('config.php');

assert(version.includes("'188.5.5.6.84.14'"),'Audit release mismatch');
assert(core.includes('function homeLocation(context = {})'),'Home city must use runtime profile/context data');
assert(core.includes("getMastersCatalog({type:'sto',city}"),'Nearby catalog must use the resolved city');
assert(core.includes("dataset.state='loading'")&&core.includes("dataset.state=degradedBlocks.size?'partial':'ready'"),'Home state machine is incomplete');
assert(core.includes('data-home-nearby-retry')&&core.includes('Поблизости пока ничего не найдено'),'Nearby error/empty states are incomplete');
assert(core.includes('homeSafeMediaUrl')&&core.includes('data-home-station-image')&&core.includes('onImageError'),'Nearby image security/recovery is incomplete');
assert(core.includes('data-request-service-name="Диагностика"')&&core.includes('data-request-source="home_popular"'),'Home request intent metadata is incomplete');
assert(requestWindow.indexOf("sessionStorage.setItem('kareta.request.prefill'")<requestWindow.indexOf('open(target,{trigger:link})'),'Request prefill must be persisted before the request window opens');
assert(!details.includes('`#/news/${encodeURIComponent(item.id)}`'),'Unsupported news detail route returned');
assert(!homeCss.includes('.k-mobile-nav')&&!homeCss.includes('#k-mobile-nav'),'Home audit must not change bottom navigation');
const dbVersion=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);
assert(dbVersion>=127,'Current schema version must include all audited migrations');

console.log('R188.5.5.6.84.14 project audit contracts: OK');
