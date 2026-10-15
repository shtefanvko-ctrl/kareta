'use strict';
// Execute the real diagnostics sync function with mocked Native Bridge and HTTP.
// No live DB, remote service, or physical Android device is touched.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../js/next/pages/diagnostics.js'),'utf8');
const begin=code.indexOf('    async function syncOffline(){');
const end=code.indexOf('    async function runSnapshot(){',begin);
assert(begin>=0&&end>begin,'canonical syncOffline must exist in diagnostics.js');
const makeSync=new Function(
  'navigator','mobile','queuedVehicleId','fetch','setResult','updateOffline','loadHistory',
  code.slice(begin,end)+'\nreturn syncOffline;'
);
const row=(id,vehicleId='car-1')=>({id,payload:{vehicleId}});
async function check({items=[],accepted=[],responseOk=true,payloadOk=true,online=true,omitAccepted=false}={}){
  const ack=[],requests=[],messages=[];
  let refreshed=0,history=0,drains=0;
  const mobile={
    available:()=>true,
    offlineState:async()=>({count:items.length}),
    offlineDrain:async()=>{drains++;return {items}},
    offlineAcknowledge:async rows=>{ack.push(...rows)},
  };
  const fetch=async(url,opts)=>{
    requests.push({url,body:JSON.parse(opts.body)});
    return {ok:responseOk,json:async()=>({
      ok:payloadOk,
      ...(omitAccepted?{}:{accepted})
    })};
  };
  const fn=makeSync({onLine:online},mobile,
    item=>String(item?.payload?.vehicleId??'').trim(),
    fetch,message=>messages.push(message),
    async()=>{refreshed++},async()=>{history++});
  return {done:await fn(),ack,requests,messages,refreshed,history,drains};
}
(async()=>{
  const a=row('a'),b=row('b'),noCar=row('no-car','');
  const partial=await check({items:[a,b],accepted:['a']});
  assert.equal(partial.done,false);
  assert.deepEqual(partial.ack.map(x=>x.id),['a'],'unaccepted queue item must never be acknowledged');
  assert.deepEqual(partial.requests[0].body.items,[a,b],'send all eligible records');
  assert.match(partial.messages[0],/1 неподтверждённых/);
  assert.equal(partial.history,1);

  const all=await check({items:[a,b],accepted:['a','b']});
  assert.equal(all.done,true);
  assert.deepEqual(all.ack.map(x=>x.id),['a','b']);

  const none=await check({items:[a,b],accepted:[]});
  assert.equal(none.done,false);
  assert.equal(none.ack.length,0);
  assert.match(none.messages[0],/2 неподтверждённых/);

  const unknown=await check({items:[a],accepted:['some-other-id']});
  assert.equal(unknown.done,false);
  assert.equal(unknown.ack.length,0);

  const mixed=await check({items:[a,noCar],accepted:['a','no-car']});
  assert.equal(mixed.done,false);
  assert.deepEqual(mixed.ack.map(x=>x.id),['a']);
  assert.deepEqual(mixed.requests[0].body.items,[a]);
  assert.match(mixed.messages[0],/без vehicleId/);

  const missing=await check({items:[a],omitAccepted:true});
  assert.equal(missing.done,false);
  assert.equal(missing.ack.length,0);
  assert.match(missing.messages[0],/SYNC_ACK_INVALID/);

  const invalid=await check({items:[a],accepted:'a'});
  assert.equal(invalid.done,false);
  assert.equal(invalid.ack.length,0);

  const failed=await check({items:[a],responseOk:false,payloadOk:false});
  assert.equal(failed.done,false);
  assert.equal(failed.ack.length,0);

  const noId=await check({items:[row('')],accepted:['']});
  assert.equal(noId.done,false);
  assert.equal(noId.ack.length,0,'blank local ID is not a valid acknowledgment key');

  const offline=await check({items:[a],accepted:['a'],online:false});
  assert.equal(offline.done,false);
  assert.equal(offline.ack.length,0);
  assert.equal(offline.requests.length,0);
  const empty=await check({items:[],accepted:[]});
  assert.equal(empty.done,true);
  assert.equal(empty.requests.length,0);
  console.log('OBD_OFFLINE_ACCEPTED_ACK: PASS partial/full/none/unknown/no-car/malformed/http/offline/empty');
})().catch(err=>{console.error(err);process.exitCode=1});
