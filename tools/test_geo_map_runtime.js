'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');

const catalogWindow={};
vm.runInNewContext(read('js/next/onboarding/onboarding_selection_catalog.js'),{window:catalogWindow});
const catalog=catalogWindow.KaretaOnboardingSelectionCatalog;
assert.equal(catalog.cities.length,8);
for(const city of catalog.cities){
  const center=catalog.resolveCityCenter(city);
  assert.ok(center,city);
  assert.ok(center.latitude>=-90&&center.latitude<=90,city);
  assert.ok(center.longitude>=-180&&center.longitude<=180,city);
  assert.equal(center.city,city);
  assert.equal(center.precision,'city');
}
assert.equal(catalog.resolveCityCenter('Өскемен').city,'Усть-Каменогорск');
assert.equal(catalog.resolveCityCenter('unknown town'),null);

const geoSource=read('js/next/geo_map.js');
assert.match(geoSource,/GEO_MAP_POINTS_REQUIRED/);
assert.match(geoSource,/data-geo-tile-render/);
assert.match(geoSource,/options\.center\?\.source==='GeoNames'/);
assert.match(geoSource,/if\(!points\.length&&!validPoint\(options\.center\)\)/);
assert.match(geoSource,/if\(!state\|\|!dlg\.open\)return/);

const core=read('js/next/pages/core.js');
assert.match(core,/data-home-nearby-map/);
assert.match(core,/resolveCityCenter\?\.\(selectedCity\)/);
assert.match(core,/String\(rawLat\)\.trim\(\)===''/);
assert.match(core,/points:mapPoints,center,notice/);
assert.doesNotMatch(core,/api\/geo\.php/);

const runtime=read('js/boot/runtime_core_bundle.js');
assert.match(runtime,/data-home-nearby-map/);
assert.match(runtime,/resolveCityCenter\?\.\(selectedCity\)/);

const bridge=read('js/mobile_native_bridge.js');
assert.match(bridge,/bestLocation: options => bestLocation\(options\)/);
assert.match(bridge,/openBestMap: \(query, lat, lng\) => bestMap\(query, lat, lng\)/);
assert.match(bridge,/loadGeoMap: \(\) => loadGeoMap\(\)/);
assert.match(bridge,/\/js\/next\/geo_map\.js/);

const config=read('config.php'),index=read('index.php');
assert.match(config,/KARETA_GEO_TILE_URL/);
assert.match(index,/KARETA_GEO_MAP_CONFIG/);
assert.match(index,/\$geoImgSource/);
assert.match(index,/mobile_native_bridge\.js\?v=<\?= rawurlencode\(\$assetVersion\) \?>/);

console.log('PASS geo runtime reconcile: 8 cities, city map without GPS, strict coords, lazy map, CSP/config, source/runtime parity');
