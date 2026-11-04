/* Autonomous seller Geo API contract; no network or browser session. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/seller/seller_api.js'),'utf8');
const page=fs.readFileSync(path.join(root,'js/next/pages/seller.js'),'utf8');
let response={ok:true,payload:{ok:true,point:{visibility:'hidden'}}};
const calls=[];
const window={KaretaApiClient:{request:async(url,opts)=>{calls.push({url,opts});return response;}}};
vm.runInNewContext(source,{window,JSON,String,Error,encodeURIComponent});
const api=window.KaretaSellerApi;
(async()=>{
  assert.equal(typeof api.saveGeoPoint,'function');
  assert.equal(typeof api.getPublicGeoPoints,'function');
  const safe={ownerType:'shop',ownerId:'91',kind:'warehouse',visibility:'hidden',publishExact:false,address:'private'};
  await api.saveGeoPoint(safe);
  assert.equal(calls[0].url,'api/geo.php?action=upsert');
  assert.equal(calls[0].opts.method,'POST');
  assert.equal(calls[0].opts.credentials,undefined); // shared client owns same-origin credentials
  assert.equal(calls[0].opts.headers['Content-Type'],'application/json');
  assert.equal(calls[0].opts.dedupe,false);
  assert.equal(JSON.parse(calls[0].opts.body).publishExact,false);
  await api.saveGeoPoint({...safe,kind:'pickup',visibility:'exact',publishExact:true});
  assert.equal(JSON.parse(calls[1].opts.body).publishExact,true);
  await api.getPublicGeoPoints('91');
  assert.equal(calls[2].url,'api/geo.php?action=entity&ownerType=shop&ownerId=91');
  assert.equal(calls[2].opts.method,'GET');
  response={ok:false,status:403,payload:{error:'geo_owner_forbidden'}};
  await assert.rejects(()=>api.saveGeoPoint(safe),error=>error.code==='geo_owner_forbidden'&&error.status===403);
  assert(page.includes('data-seller-geo-detect')&&page.includes('data-seller-geo-save="warehouse"'));
  assert(page.includes('data-seller-geo-save="pickup"')&&page.includes("form.elements.pickupPublic.checked===true"));
  assert(page.includes('window.KaretaMobile.bestLocation')&&page.includes('Разрешаю показывать точный адрес'));
  assert(page.includes("kind==='warehouse'?'hidden'"),'hidden warehouse visibility must be explicit');
  console.log('GEO_SELLER_CLIENT: PASS POST/GET, consent, ownership denial, opt-in UI and click-GPS');
})().catch(error=>{console.error(error);process.exitCode=1;});
