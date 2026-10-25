'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

class Element {
  constructor(){this.events=new Map();this.dataset={};this.value='';this.textContent='';this.innerHTML='';this.disabled=false;this.open=false;}
  addEventListener(type,listener){this.events.set(type,listener);}
  removeEventListener(type,listener){if(this.events.get(type)===listener)this.events.delete(type);}
  async emit(type,event={}){return this.events.get(type)?.({preventDefault(){},...event});}
  showModal(){this.open=true;}
  close(){this.open=false;}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const provider={id:17,type:'master',name:'Real master',city:'Алматы',latitude:43.25,longitude:76.91};

function fixture({saved={city:'Алматы'},geoRequest=async()=>({ok:true,payload:{items:[]}}),mapLoader,gpsLocation}={}){
  const elements=new Map(['[data-home-ai-form]','#k-home-ai-problem','[data-home-city]','[data-home-nearby]',
    '[data-home-nearby-map]','[data-home-location-button]','[data-home-location-dialog]',
    '[data-home-location-close]','[data-home-location-detect]','[data-home-location-status]',
    '[data-home-location-cities]'].map(selector=>[selector,new Element()]));
  const calls=[],opened=[],errors=[];
  let location=JSON.stringify(saved),gpsCalls=0;
  const window={KaretaToast:{error:message=>errors.push(message)},setTimeout(){},
    KaretaMobile:{bestLocation:async()=>{gpsCalls++;return gpsLocation?gpsLocation():{latitude:43.24,longitude:76.90};},
      loadGeoMap:mapLoader||(async()=>({open:options=>opened.push(options)}))}};
  const scope={window,document:{querySelector:selector=>elements.get(selector)||null,documentElement:{lang:'ru'}},
    localStorage:{getItem:()=>location,setItem:(_key,value)=>{location=value;}},
    sessionStorage:{setItem(){}},location:{hash:''},navigator:{}};
  vm.runInNewContext(read('js/next/onboarding/onboarding_selection_catalog.js'),scope);
  vm.runInNewContext(read('js/next/pages/core.js'),scope);
  const signal=new AbortController().signal;
  const cleanup=window.KaretaCorePages.mountHome({role:'client',lifecycle:{signal},api:{request:async(url,options)=>{
    calls.push({url,options});
    if(url==='api/db.php?action=masters.catalog')return {ok:true,payload:{masters:[provider]}};
    if(url.startsWith('api/geo.php?'))return geoRequest(url,options);
    return {ok:true,payload:{}};
  }}});
  return {elements,calls,opened,errors,cleanup,signal,gpsCalls:()=>gpsCalls,saved:()=>JSON.parse(location),
    geoCalls:()=>calls.filter(call=>call.url.startsWith('api/geo.php?')),
    click:selector=>elements.get(selector).emit('click')};
}

async function run(){
  // The whole production mountHome executes with fixture data, no real network.
  const city=fixture();await flush();
  assert.equal(city.geoCalls().length,0,'city-only startup must not require GEO API');
  assert.equal(city.gpsCalls(),0,'startup must not request GPS permission');
  await city.click('[data-home-nearby-map]');
  assert.equal(city.opened[0].center.city,'Алматы');
  assert.equal(city.opened[0].points.length,1);
  assert.equal(city.opened[0].points[0].id,'master:17');
  assert.equal(city.opened[0].points[0].distanceKm,null,'city-only map must not invent GPS distance');
  assert.equal(city.geoCalls().length,0,'opening a city map must not call GEO API');
  city.cleanup();

  // Invalid saved coordinates remain city-only, including empty strings and range errors.
  for(const coords of [{lat:null,lng:null},{lat:'',lng:' '},{lat:91,lng:76},{lat:43,lng:181}]){
    const invalid=fixture({saved:{city:'Алматы',...coords}});await flush();
    await invalid.click('[data-home-nearby-map]');
    assert.equal(invalid.geoCalls().length,0);
    assert.equal(invalid.opened[0].center.city,'Алматы');invalid.cleanup();
  }

  const gps=fixture({saved:{city:'Алматы',lat:43.24,lng:76.90},geoRequest:async()=>({ok:true,payload:{data:{items:[
    {ownerType:'master',ownerId:17,latitude:43.241,longitude:76.901,address:'Public address'}
  ]}}})});await flush();
  assert.equal(gps.geoCalls().length,1);
  const request=gps.geoCalls()[0];
  const url=new URL(request.url,'https://fixture.invalid/');
  assert.equal(url.searchParams.get('action'),'nearby');
  assert.equal(url.searchParams.get('lat'),'43.24');
  assert.equal(url.searchParams.get('lng'),'76.9');
  assert.equal(url.searchParams.get('limit'),'100');
  assert.equal(request.options.method,'GET');
  assert.equal(request.options.signal,gps.signal,'request must use route lifecycle cancellation');
  await gps.click('[data-home-nearby-map]');
  assert.equal(gps.opened[0].points[0].user,true);
  assert.equal(gps.opened[0].points[1].latitude,43.241,'map must use real GEO enrichment');
  assert.match(gps.elements.get('[data-home-nearby]').innerHTML,/Public address/);
  await gps.elements.get('[data-home-location-cities]').emit('click',{target:{closest:()=>({dataset:{homeCityValue:'Астана'}})}});
  assert.equal(gps.saved().lat,null,'manual city selection must clear GPS');
  assert.equal(gps.saved().lng,null);
  await gps.click('[data-home-nearby-map]');
  assert.equal(gps.opened[1].center.city,'Астана');
  assert.equal(gps.opened[1].points.length,0,'another city must not inherit prior GPS points');
  assert.match(gps.opened[1].notice,/пока нет/);
  assert.equal(gps.geoCalls().length,1,'manual city switch must not request GEO enrichment');gps.cleanup();

  const failed=fixture({saved:{city:'Алматы',lat:43.24,lng:76.90},geoRequest:async()=>{throw new Error('fixture GEO offline');}});
  await flush();await failed.click('[data-home-nearby-map]');
  assert.equal(failed.opened[0].points[1].latitude,provider.latitude,'GEO failure must retain catalog coordinates');
  assert.match(failed.elements.get('[data-home-nearby]').innerHTML,/Real master/);failed.cleanup();

  const denied=fixture({gpsLocation:async()=>{const error=new Error('denied');error.code='GEOLOCATION_PERMISSION_DENIED';throw error;}});
  await flush();await denied.click('[data-home-location-detect]');
  assert.match(denied.elements.get('[data-home-location-status]').textContent,/не разрешён/);
  assert.equal(denied.elements.get('[data-home-location-detect]').disabled,false);
  assert.equal(denied.geoCalls().length,0,'denied GPS must not call GEO API');
  await denied.click('[data-home-nearby-map]');
  assert.equal(denied.opened[0].center.city,'Алматы','permission denial must retain manual city map');denied.cleanup();

  const pending=deferred();const disposed=fixture({saved:{city:'Алматы',lat:43.24,lng:76.90},geoRequest:()=>pending.promise});
  await flush();const before=disposed.elements.get('[data-home-nearby]').innerHTML;
  disposed.cleanup();pending.resolve({ok:true,payload:{items:[]}});await flush();
  assert.equal(disposed.elements.get('[data-home-nearby]').innerHTML,before,'late GEO response must not render after disposal');
  assert.equal(disposed.opened.length,0);

  const loading=deferred();const closed=fixture({mapLoader:()=>loading.promise});await flush();
  const opening=closed.click('[data-home-nearby-map]');closed.cleanup();
  loading.resolve({open:options=>closed.opened.push(options)});await opening;
  assert.equal(closed.opened.length,0,'late lazy map loader must not open after route disposal');
  console.log('PASS home GEO behavior: city-only, saved GPS, enrichment, manual city, API failure, disposal');
}

module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
