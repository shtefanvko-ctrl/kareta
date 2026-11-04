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
const dynamicWindow={
  KaretaRouteRegistry:routes,addEventListener:()=>{},
  KaretaIdentity:{snapshot:()=>({authenticated:true,mode:'identity',context:{type:'profile',profileType:'master'},capabilities:[],deniedCapabilities:[]}),has:()=>false}
};
vm.runInNewContext(read('js/next/dynamic_navigation.js'),{
  window:dynamicWindow,document:{currentScript:null}
});
assert.equal(dynamicWindow.KaretaDynamicNavigation.canAccess('map'),true);
assert.ok(dynamicWindow.KaretaDynamicNavigation.menuSections().some(section=>section.keys.includes('map')));
const roleWindow={...dynamicWindow,addEventListener:()=>{}};
vm.runInNewContext(read('js/next/role_access.js'),{
  window:roleWindow,document:{currentScript:null,documentElement:{dataset:{identityMode:'identity'}}},
  localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}
});
for(const role of ['client','master','sto','seller','admin']) {
  assert.equal(roleWindow.KaretaRoleAccess.canAccess('map',role),true,'Map role permission: '+role);
}
const navSource=read('js/next/navigation_core.js').split('const DESKTOP_TEMPLATES = Object.freeze({')[1];
for(const kind of ['personal','master','seller','organization_service','organization_store','anonymous']){
  assert.ok(navSource.split(kind+': Object.freeze([')[1]?.split('])')[0]?.includes("'map'"),'Map desktop context: '+kind);
}
console.log('PASS GIS map route, deep-link key, role access/menu, mobile-nav invariant, lazy UI, exact-only Geo API boundary');
