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
console.log('GEO_MAP_RUNTIME: PASS');
