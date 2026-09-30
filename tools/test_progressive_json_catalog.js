#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=[];const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const registry=read('inc/asset_registry.php');
const page=read('js/next/pages/cabinet.js');
const loader=read('js/next/catalog/json_catalog_loader.js');
const gate=read('tools/release_gate.php');
const catalogPath='assets/catalog/garage/service_maintenance.json';
const catalog=JSON.parse(read(catalogPath));

expect(catalog.schema===1,'garage catalog schema must be 1');
expect(Array.isArray(catalog.systems)&&catalog.systems.length>=10,'garage systems catalog is incomplete');
expect(Array.isArray(catalog.items)&&catalog.items.length>=20,'garage maintenance items catalog is incomplete');
const systemIds=catalog.systems.map(x=>String(x.id||''));
expect(new Set(systemIds).size===systemIds.length&&!systemIds.includes(''),'garage system ids must be unique');
expect(catalog.items.every(x=>systemIds.includes(String(x.system||''))),'garage item references unknown system');
expect(new Set(catalog.items.map(x=>String(x.id||''))).size===catalog.items.length,'garage item ids must be unique');

const bundleStart=registry.indexOf("'cabinet' => [");
const bundleEnd=registry.indexOf("'chats' => [",bundleStart);
const cabinetBundle=registry.slice(bundleStart,bundleEnd);
expect(cabinetBundle.includes("'js/next/catalog/json_catalog_loader.js'"),'JSON catalog loader is not cabinet-route lazy');
expect(cabinetBundle.indexOf("'js/next/catalog/json_catalog_loader.js'")<cabinetBundle.indexOf("'js/next/pages/cabinet.js'"),'JSON catalog loader must execute before cabinet page');
expect(!page.includes('const serviceSystems=[')&&!page.includes('const serviceConsumables=['),'garage reference arrays remain embedded in cabinet JS');
expect(page.includes("SERVICE_MAINTENANCE_CATALOG='assets/catalog/garage/service_maintenance.json'"),'garage catalog path contract missing');
expect(page.includes("jsonCatalog.load(SERVICE_MAINTENANCE_CATALOG,{schema:1})"),'garage page does not use shared JSON loader');
expect(page.includes("const lazyCatalog=key==='systems'||key==='consumables'"),'garage maps are not demand-loaded');
expect(page.includes("await ensureServiceCatalog();")&&page.includes('Загрузка справочника…'),'garage progressive loading UI missing');
expect(page.includes("garageCategory('systems','Карта узлов','Системы автомобиля',null)")&&page.includes("garageCategory('consumables','Расходники','Ресурс и замены',null)"),'garage summary still depends on unloaded catalog counts');
expect(loader.includes('const cache=new Map()')&&loader.includes('const inFlight=new Map()'),'JSON loader cache/dedupe missing');
expect(loader.includes("cache:'default'")&&loader.includes("?v=${encodeURIComponent(release)}"),'JSON loader release-scoped HTTP cache contract missing');
expect(loader.includes("content-type")&&loader.includes("catalog_mime_invalid"),'JSON loader MIME guard missing');
expect(gate.includes("'catalog.json' => 'tools/test_progressive_json_catalog.js'"),'release gate does not run progressive JSON regression');

if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('Progressive JSON catalog regression: OK');
