'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const css=read('css/next/mobile_services_context_grid.css');
for(const needle of [
  '@media (max-width: 767px)',
  '@media (max-width: 359px)',
  '#k-page-outlet .k-services-page .k-drill-grid',
  '#k-page-outlet .k-services-page .k-drill-grid.k-drill-grid-catalogs',
  '#k-page-outlet .k-services-page .k-services-grid',
  '#k-context-switcher .k-context-buttons',
  '#k-context-switcher .k-context-legacy-roles',
  'grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'
]) assert(css.includes(needle),needle);
assert(!css.includes('grid-template-columns: 1fr'));
const registry=read('inc/asset_registry.php');
assert(registry.includes("'css/next/mobile_services_context_grid.css'"));
const release='r1885568-mobile-two-column-grids';
for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'])assert(read(file).includes(release),file);
assert(read('index.php').includes("$cacheEpoch = 'r1885568-mobile-two-column-grids';"));
console.log('R188.5.5.6.8 mobile two-column grid tests OK');
