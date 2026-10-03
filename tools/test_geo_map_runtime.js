'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../js/next/geo_map.js'),'utf8');
class Node {
  constructor(){this.style={};this.dataset={};this.events={};this.innerHTML='';this.textContent='';this.open=false;this.isConnected=true;this.clientWidth=320;this.clientHeight=320;this.nodes={};}
  addEventListener(name,fn){this.events[name]=fn;}
  querySelector(key){return this.nodes[key]||(this.nodes[key]=new Node());}
  querySelectorAll(){return [];}
  showModal(){this.open=true;}
  close(){this.open=false;}
  emit(type,target){this.events[type]?.({type,target});}
}
const frames=[],dialogs=[],window={};
const document={
  documentElement:{lang:'ru'},head:{appendChild(){}},body:{appendChild(node){dialogs.push(node);}},
  querySelectorAll(){return [];},createElement(){return new Node();}
};
vm.runInNewContext(source,{window,document,URL,requestAnimationFrame:fn=>frames.push(fn)});
const map=window.KaretaGeoMap;
assert.throws(()=>map.open({points:[{latitude:null,longitude:null}]}),/GEO_MAP_POINTS_REQUIRED/);
map.open({points:[{id:'sto',latitude:49.9483,longitude:82.6285,label:'STO'}]});
frames.shift()();
const dlg=dialogs[0],tiles=dlg.querySelector('[data-geo-map-tiles]'),status=dlg.querySelector('[data-geo-map-status]');
assert(tiles.innerHTML.includes('tile.openstreetmap.org'));
assert(!tiles.innerHTML.includes('NaN'),'automatic map center produced invalid tiles');
assert.strictEqual(status.textContent,'Подложка загружается…');
const first=tiles.innerHTML.match(/data-geo-tile-render="(\d+)"/)[1];
tiles.emit('error',{dataset:{geoTileRender:first}});
assert(status.textContent.includes('Подложка недоступна'));
tiles.emit('load',{dataset:{geoTileRender:first}});
assert(status.textContent.includes('Часть карты'));
map.close();
const oldStatus=status.textContent;
tiles.emit('error',{dataset:{geoTileRender:first}});
assert.strictEqual(status.textContent,oldStatus,'closed map accepted a tile event');
document.documentElement.lang='kk';
map.open({points:[{latitude:43.2389,longitude:76.8897}],center:{latitude:43.2389,longitude:76.8897}});
frames.shift()();
const second=tiles.innerHTML.match(/data-geo-tile-render="(\d+)"/)[1];
const pending=status.textContent;
tiles.emit('error',{dataset:{geoTileRender:first}});
assert.strictEqual(status.textContent,pending,'stale tile affected reopened map');
tiles.emit('error',{dataset:{geoTileRender:second}});
assert(status.textContent.includes('қолжетімсіз'));
map.close();
document.documentElement.lang='en';
map.open({points:[{latitude:51.1694,longitude:71.4491}],center:{latitude:51.1694,longitude:71.4491}});
map.close();
assert.doesNotThrow(()=>frames.shift()(),'closing before animation caused an exception');

document.documentElement.lang='ru';
map.open({points:[],center:{latitude:43.252,longitude:76.911,source:'GeoNames'},notice:'No public points'});
frames.shift()();
assert(!tiles.innerHTML.includes('NaN'));
assert.strictEqual(dlg.querySelector('[data-geo-map-data-status]').textContent,'No public points');
assert.strictEqual(dlg.querySelector('[data-geo-map-data-status]').hidden,false);
assert.strictEqual(dlg.querySelector('[data-geo-map-detail]').innerHTML,'');
map.close();
assert.throws(()=>map.open({points:[],center:{latitude:null,longitude:null}}),/GEO_MAP_POINTS_REQUIRED/);
const catalogWindow={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/next/onboarding/onboarding_selection_catalog.js'),'utf8'),{window:catalogWindow});
const catalog=catalogWindow.KaretaOnboardingSelectionCatalog;
assert.strictEqual(catalog.cities.length,8);
for(const city of catalog.cities){
  const center=catalog.resolveCityCenter(city);
  assert(center&&center.latitude>40&&center.latitude<56&&center.longitude>46&&center.longitude<88,city);
  assert.strictEqual(center.city,city);
  assert.strictEqual(center.precision,'city');
}
assert.strictEqual(catalog.resolveCityCenter('Өскемен').city,'Усть-Каменогорск');
assert.strictEqual(catalog.resolveCityCenter('unknown town'),null);
const core=fs.readFileSync(path.join(__dirname,'../js/next/pages/core.js'),'utf8');
const cityStart=core.indexOf('const openCityMap=async()=>');
const cityEnd=core.indexOf('const openNearbyMap',cityStart);
assert(cityStart>=0&&cityEnd>cityStart);
(async()=>{
  let response={ok:true,payload:{data:{items:[]}}},opened;
  const scope={
    window:{KaretaOnboardingSelectionCatalog:catalog,KaretaMobile:{loadGeoMap:async()=>({open:options=>{opened=options;}})}},
    document:{documentElement:{lang:'ru'}},selectedCity:'Алматы',disposed:false,
    api:{request:async()=>response}
  };
  vm.runInNewContext(core.slice(cityStart,cityEnd)+'this.openCityMap=openCityMap;',scope);
  await scope.openCityMap();
  assert.strictEqual(opened.points.length,0);
  assert.strictEqual(opened.center.city,'Алматы');
  assert(opened.notice.includes('пока нет'));
  response={ok:false};
  await scope.openCityMap();
  assert.strictEqual(opened.points.length,0);
  assert(opened.notice.includes('Не удалось'));
  response={ok:true,payload:{items:[{ownerType:'master',ownerId:2,label:'Master',latitude:43.25,longitude:76.9},{ownerType:'shop',ownerId:3,publicId:9,kind:'pickup',latitude:43.26,longitude:76.91}]}};
  await scope.openCityMap();
  assert.strictEqual(opened.points.length,2);
  for(const point of opened.points){assert(!point.user);assert(!Object.hasOwn(point,'distanceKm'));}
  assert.strictEqual(opened.points[0].actions.length,2);
  assert.strictEqual(opened.points[1].actions[0].href,'#/parts/store/9');
  scope.disposed=true;opened=null;
  await scope.openCityMap();
  assert.strictEqual(opened,null);
  console.log('GEO_MAP_CITY: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
console.log('GEO_MAP_RUNTIME: PASS');
