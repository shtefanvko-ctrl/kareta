/* Lazy inline Geo Map contract. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const config=read('config.php');
const index=read('index.php');
const bridge=read('js/mobile_native_bridge.js');
const map=read('js/next/geo_map.js');
const css=read('css/next/geo_map.css');
const masters=read('js/next/pages/masters.js');
const parts=read('js/next/pages/parts.js');
const home=read('js/next/pages/core.js');
const masterWorkplace=read('js/next/pages/master_workplace.js');
const geoApi=read('api/geo.php');
const geoCore=read('api/geo_core.php');
const assetRegistry=read('inc/asset_registry.php');
const bootBuilder=read('tools/build_boot_js_bundles.js');

assert(config.includes("'https://tile.openstreetmap.org/{z}/{x}/{y}.png'"),'canonical OSM tile URL missing');
assert(config.includes("'KARETA_GEO_TILE_URL'"),'tile provider is not deployment-configurable');
assert(index.includes("$geoTileOrigin"),'tile origin CSP derivation missing');
assert(index.includes("window.KARETA_GEO_MAP_CONFIG"),'public map config missing');
assert(index.includes("img-src 'self' data: blob: https://images.unsplash.com{$geoImgSource}"),'CSP does not scope tile image origin');
assert(index.includes('/js/mobile_native_bridge.js?v=<?= rawurlencode($assetVersion) ?>'),'mobile bridge must be release-scoped');

assert(bridge.includes('function loadGeoMap()'),'shared lazy map loader missing');
assert(bridge.includes("wantedPath = '/js/next/geo_map.js'"),'lazy map path missing');
assert(bridge.includes("window.KARETA_NEXT_ASSET_VERSION"),'lazy map URL must be release-scoped');
assert(!assetRegistry.includes('js/next/geo_map.js'),'geo map must not join global asset registry');
assert(!bootBuilder.includes("'js/next/geo_map.js'"),'geo map must not join boot bundle');

assert(map.includes("config.tileUrl.replace('{z}'"),'tile URL template rendering missing');
assert(map.includes("config.attributionLabel"),'visible map attribution missing');
assert(map.includes('data-geo-map-attribution'),'attribution surface missing');
assert(map.includes('slice(0,50)'),'map point bound missing');
assert(!map.includes('fetch('),'map renderer must not background-fetch tiles or API data');
assert(map.includes("loading=\"eager\""),'visible viewport tiles should load only when rendered');
assert(map.includes("if(!state||!dialog?.open)return"),'closed map must not render tiles');
assert(css.includes('.k-geo-map-attribution'),'attribution CSS missing');

assert(masters.includes('data-master-map'),'provider map trigger missing');
assert(masters.includes("title:providerKind==='sto'?'СТО рядом':'Мастера рядом'"),'provider map title/scope missing');
assert(masters.includes("user:true"),'provider map must show local user point');
assert(parts.includes('data-parts-nearby-map'),'parts map trigger missing');
assert(parts.includes("title:'Магазины рядом'"),'parts map scope missing');
assert(parts.includes("nearbyShops.slice(0,49)"),'parts public map point bound missing');
assert(home.includes('data-home-nearby-map'),'client home nearby map trigger missing');
assert(home.includes("title:'Рядом с вами'"),'client home map scope missing');
assert(home.includes("geoNearby.has(geoKey(row))"),'client home map must use public Geo API points only');
assert(home.includes("if(!mapPoints.length)throw new Error('GEO_MAP_NO_POINTS')"),'client home map must fail closed without public points');
assert(home.includes('types=sto,master,shop'),'client home unified Geo query must include shops');
assert(home.includes("String(point?.ownerType||'')==='shop'"),'client home map must consume public shop points');
assert(home.includes("label:'Товары'"),'client home shop pin product action missing');
assert(home.includes("label:'Профиль'")&&home.includes("label:'Записаться'"),'client home provider pin actions missing');
assert(map.includes("actions:(Array.isArray(point?.actions)"),'generic point action normalization missing');
assert(map.includes("data-geo-map-action"),'map action surface missing');
assert(map.includes("state.clusters=new Map()"),'marker cluster state missing');
assert(map.includes("data-geo-map-cluster"),'cluster marker interaction missing');
assert(map.includes("Math.floor(item.left/clusterSize)"),'screen-space cluster bucket missing');
assert(css.includes('.k-geo-map-cluster'),'cluster CSS missing');
assert(css.includes('.k-geo-map-detail__actions'),'pin action CSS missing');
assert(masters.includes("label:'Профиль'")&&masters.includes("label:'Записаться'"),'provider directory map actions missing');
assert(parts.includes("label:'Товары'"),'parts map product action missing');
assert(map.includes("radiusKm:Number.isFinite(Number(point?.radiusKm))"),'generic radius normalization missing');
assert(map.includes('k-geo-map-radius'),'work radius map overlay missing');
assert(css.includes('.k-geo-map-radius'),'work radius map CSS missing');
assert(geoApi.includes("$action==='mine'"),'owner-only Geo read action missing');
assert(geoApi.includes("geo_context_allows_owner($pdo,$auth,$ownerType,$ownerId)"),'owner-only Geo read must enforce ownership');
assert(geoApi.includes("kareta_geo_owner_points($pdo,$ownerType,$ownerId,false)"),'owner-only Geo read must include private owner points');
assert(geoCore.includes("metadata_json AS metadataJson")&&geoCore.includes("$row['metadata']=is_array($meta)?$meta:[]"),'owner point metadata decode missing');
assert(masterWorkplace.includes('data-master-work-zone'),'master home work-zone card missing');
assert(masterWorkplace.includes("types=sto,shop&limit=49"),'master work-zone nearby scope must be public STO and shops');
assert(masterWorkplace.includes("title:'Рабочая зона мастера'"),'master work-zone map title missing');
assert(masterWorkplace.includes("action=mine&ownerType=master&ownerId="),'master work-zone must lazy-load owner-only point data');
assert(masterWorkplace.includes("origin?.metadata?.radiusKm"),'master mobile work radius must come from owner-only point metadata');
assert(masterWorkplace.includes("label:'Товары'")&&masterWorkplace.includes("label:'Записаться'"),'master work-zone pin actions missing');


/* Execute coordinate/center helpers to catch runtime regressions missed by string contracts. */
{
  const vm = require('vm');
  const coordinateStart = map.indexOf('  const coordinate=');
  const normalizeStart = map.indexOf('  const normalizePoint=');
  const centerStart = map.indexOf('  function centerOf(');
  const fitStart = map.indexOf('  function fitZoom(');
  assert(coordinateStart >= 0 && normalizeStart > coordinateStart && centerStart >= 0 && fitStart > centerStart);
  const scope = {};
  vm.runInNewContext(map.slice(coordinateStart, normalizeStart) + map.slice(centerStart, fitStart) +
    '\nthis.validPoint=validPoint;this.centerOf=centerOf;', scope);
  for (const point of [
    {latitude:null,longitude:null}, {latitude:' ',longitude:''},
    {latitude:91,longitude:82}, {latitude:49,longitude:181}
  ]) assert.strictEqual(scope.validPoint(point), false, 'invalid map coordinates accepted');
  assert.strictEqual(scope.validPoint({latitude:49.9483,longitude:82.6285}), true);
  assert.strictEqual(scope.validPoint({lat:0,lng:0}), true, 'zero coordinates are legitimate');
  const center = scope.centerOf([{latitude:49.9483,longitude:82.6285,user:false}]);
  assert.strictEqual(center.latitude,49.9483);
  assert.strictEqual(center.longitude,82.6285);
  assert(Number.isFinite(scope.centerOf([]).latitude), 'fallback center invalid');
}

assert(masters.includes("if(!result?.ok)throw new Error('GEO_API_UNAVAILABLE')"),'directory must reject failed nearby API');
assert(masters.includes("if(!geoReady)throw new Error('GEO_API_UNAVAILABLE')"),'directory map must distinguish API failure from no points');
assert(parts.includes("nearbyShopsStatus==='error'"),'parts map must distinguish API failure from no points');
assert(masterWorkplace.includes("if(!result?.ok)throw new Error('GEO_API_UNAVAILABLE')"),'work zone must reject failed nearby API');
require('./test_geo_map_runtime.js');
console.log('GEO_MAP_LAZY: PASS');