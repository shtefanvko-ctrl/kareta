#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const registryWindow={};
vm.runInNewContext(read('js/next/route_registry.js'),{window:registryWindow,location:{hash:'#/home'}});
const routes=registryWindow.KaretaRouteRegistry;
assert.equal(routes.keyFromHash('#/map'),'map');
assert.equal(routes.keyFromHash('#/map?city=Алматы&type=sto'),'map');
assert.equal(routes.routes.map.path,'#/map');
assert.equal(routes.surfaceForKey('map'),'workspace');
assert.equal(Array.from(routes.mobileKeys).join(','),'home,parts,masters,orders,cabinet');
assert.equal(routes.uxAudit().ok,true);

const mapWindow={};
vm.runInNewContext(read('js/next/pages/map.js'),{window:mapWindow});
const pages=mapWindow.KaretaMapPages;
assert.equal(typeof pages.renderMap,'function');
assert.equal(typeof pages.mountMap,'function');
const html=pages.renderMap();
for(const selector of ['data-gis-canvas','data-gis-search','data-gis-city','data-gis-location','data-gis-category','data-gis-radius','data-gis-verified','data-gis-results']) {
  assert.ok(html.includes(selector),'Missing map UI '+selector);
}
assert.ok(!html.includes('data-gis-tile'),'The first render must not load map tiles');

const map=read('js/next/pages/map.js');
assert.match(map,/\/api\/geo\.php\?/);
assert.match(map,/payload\.meta\?\.visibility!==\x27exact_only\x27/);
assert.match(map,/controller\?\.abort\(\)/);
assert.match(map,/credentials:\x27same-origin\x27/);
assert.ok(!map.includes('masters.catalog'),'Do not read unclassified private locations from catalog');

const geo=read('js/next/geo_map.js');
assert.match(geo,/function setPoints\(/);
assert.match(geo,/options\.host/);
assert.match(geo,/onViewportChange/);
assert.ok(geo.includes('openBestMap'),'Keep native route handoff');
const boot=read('js/next/route_asset_loader.js');
assert.match(boot,/\x27map\x27,\x27community\x27/);
const app=read('js/next/app_next.js');
assert.match(app,/map:\{global:\x27KaretaMapPages\x27,render:\x27renderMap\x27,mount:\x27mountMap\x27\}/);
console.log('PASS GIS map route, deep-link key, mobile-nav invariant, lazy UI, exact-only Geo API boundary');
