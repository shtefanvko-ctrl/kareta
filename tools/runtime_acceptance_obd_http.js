'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const base=String(process.env.KARETA_ACCEPTANCE_BASE_URL||'http://127.0.0.1:8080').replace(/\/$/,'');
const report={status:'RUNNING',base,startedAt:new Date().toISOString(),steps:[]};
const cookies=new Map();

function captureCookies(headers){
  const values=typeof headers.getSetCookie==='function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  for(const value of values){
    const first=String(value||'').split(';',1)[0];
    const eq=first.indexOf('=');
    if(eq<=0)continue;
    cookies.set(first.slice(0,eq).trim(),first.slice(eq+1).trim());
  }
}
function cookieHeader(){
  return [...cookies.entries()].map(([key,value])=>key+'='+value).join('; ');
}
function mark(name,data={}){report.steps.push({name,...data});}

async function request(urlPath,{method='GET',data,status=200,label=urlPath}={}){
  const headers={Accept:'application/json'};
  const cookie=cookieHeader();
  if(cookie)headers.Cookie=cookie;
  let body;
  if(data!==undefined){
    headers['Content-Type']='application/json';
    body=JSON.stringify(data);
  }
  const response=await fetch(base+urlPath,{
    method,headers,body,redirect:'manual',signal:AbortSignal.timeout(15000)
  });
  captureCookies(response.headers);
  const text=await response.text();
  let payload=null;
  try{payload=JSON.parse(text);}catch(_error){}
  assert.equal(response.status,status,label+' HTTP '+response.status+' body='+text.slice(0,500));
  assert.ok(payload&&typeof payload==='object',label+' must return JSON');
  return payload;
}

(async()=>{
  try{
    const phone='77005550145';
    const requested=await request('/api/auth_session.php',{
      method:'POST',
      data:{action:'onboarding.requestCode',phone},
      label:'requestCode'
    });
    assert.equal(requested.ok,true);
    assert.equal(requested.testMode,true,'OBD acceptance requires test OTP transport');
    const code=String(requested.testCode||requested.devCode||'');
    assert.match(code,/^\d{4,8}$/);
    mark('otp_request',{status:'PASS'});

    const verified=await request('/api/auth_session.php',{
      method:'POST',
      data:{action:'onboarding.verifyCode',phone,code,entryRole:'client'},
      label:'verifyCode'
    });
    assert.equal(verified.ok,true);
    assert.equal(verified.verified,true);
    mark('otp_verify',{status:'PASS'});

    if(!verified.existingAccount){
      const completed=await request('/api/auth_session.php',{
        method:'POST',
        data:{action:'onboarding.complete',profile:{
          phone,
          name:'KARETA OBD Runtime Acceptance',
          role:'client',
          entry_role:'client',
          city:'Усть-Каменогорск',
          profile:{specialization:''},
          vehicle:{}
        }},
        label:'onboarding.complete'
      });
      assert.equal(completed.ok,true);
      assert.equal(completed.confirmed,true);
    }
    mark('client_session',{status:'PASS',existingAccount:Boolean(verified.existingAccount)});

    const vehicleId='veh_runtime_obd_001';
    const vehicleVin='JTDBR32E720123456';
    const syncKey='nq_runtime_obd_001';
    const forbiddenVehicleId='veh_runtime_obd_forbidden';
    const orderId='ord_runtime_obd_001';

    const vehicle=await request('/api/db.php',{
      method:'POST',
      data:{
        action:'vehicles.upsert',
        vehicle:{
          id:vehicleId,
          title:'Toyota Corolla 2016',
          brand:'Toyota',
          model:'Corolla',
          year:'2016',
          vin:vehicleVin,
          mileageKm:125000,
          isDefault:true
        }
      },
      label:'vehicle upsert'
    });
    assert.equal(vehicle.ok,true);
    assert.equal(String(vehicle.vehicle?.id||''),vehicleId);
    mark('vehicle_upsert',{status:'PASS',vehicleId});

    const basePayload={
      kind:'obd_session',
      capturedAt:Date.now(),
      adapter:{name:'ELM327 Runtime',address:'00:11:22:33:44:55'},
      vin:vehicleVin,
      protocol:'ISO 15765-4 CAN',
      orderId,
      dtc:{raw:'43 01 00',codes:['P0100']},
      snapshot:{rpm:850,speedKph:0,coolantC:82,voltageV:13.9,vin:vehicleVin}
    };

    const missing=await request('/api/obd.php?action=sync',{
      method:'POST',
      data:{items:[{id:'nq_runtime_missing_vehicle',payload:{...basePayload,vehicleId:''}}]},
      status:422,
      label:'missing vehicle'
    });
    assert.equal(missing.ok,false);
    assert.equal(missing.code,'VEHICLE_ID_REQUIRED');
    mark('missing_vehicle_rejected',{status:'PASS',code:missing.code});

    const forbidden=await request('/api/obd.php?action=sync',{
      method:'POST',
      data:{items:[{id:'nq_runtime_forbidden_vehicle',payload:{...basePayload,vehicleId:forbiddenVehicleId}}]},
      status:403,
      label:'forbidden vehicle'
    });
    assert.equal(forbidden.ok,false);
    assert.equal(forbidden.code,'VEHICLE_FORBIDDEN');
    assert.equal(String(forbidden.vehicleId||''),forbiddenVehicleId);
    mark('forbidden_vehicle_rejected',{status:'PASS',code:forbidden.code});

    const validItem={id:syncKey,createdAt:Date.now(),payload:{...basePayload,vehicleId}};
    const first=await request('/api/obd.php?action=sync',{
      method:'POST',
      data:{items:[validItem]},
      label:'valid sync'
    });
    assert.equal(first.ok,true);
    assert.equal(first.count,1);
    assert.deepEqual(first.accepted,[syncKey]);
    assert.equal(first.sessions?.length,1);
    assert.equal(String(first.sessions[0].syncKey||''),syncKey);
    assert.equal(String(first.sessions[0].vehicleId||''),vehicleId);
    assert.equal(String(first.sessions[0].orderId||''),orderId);
    assert.match(String(first.sessions[0].diagnosticSessionId||''),/^obd_[0-9a-f]{40}$/);
    const diagnosticSessionId=String(first.sessions[0].diagnosticSessionId);
    mark('valid_sync',{status:'PASS',diagnosticSessionId});

    const repeat={...validItem,payload:{
      ...validItem.payload,
      snapshot:{...validItem.payload.snapshot,rpm:915,coolantC:84},
      dtc:{raw:'43 01 00 03 00',codes:['P0100','P0300']}
    }};
    const second=await request('/api/obd.php?action=sync',{
      method:'POST',
      data:{items:[repeat]},
      label:'idempotent repeat'
    });
    assert.equal(second.ok,true);
    assert.equal(second.count,1);
    assert.equal(String(second.sessions?.[0]?.diagnosticSessionId||''),diagnosticSessionId);
    mark('idempotent_repeat',{status:'PASS',diagnosticSessionId});

    const history=await request('/api/obd.php?action=history&vehicleId='+encodeURIComponent(vehicleId)+'&limit=10',{
      label:'history'
    });
    assert.equal(history.ok,true);
    assert.equal(Array.isArray(history.sessions),true);
    const row=history.sessions.find(item=>String(item.diagnosticSessionId||item.id||'')===diagnosticSessionId);
    assert.ok(row,'synced diagnostic session missing from history');
    assert.equal(String(row.vehicleId||''),vehicleId);
    assert.equal(Number(row.snapshot?.rpm),915);
    assert.deepEqual(row.dtcJson?.codes||[],['P0100','P0300']);
    assert.equal(String(row.vin||''),vehicleVin);
    assert.ok(String(row.schemaVersion||'').length>0);
    mark('history_round_trip',{status:'PASS',vehicleId,rpm:Number(row.snapshot?.rpm)});

    const forbiddenHistory=await request('/api/obd.php?action=history&vehicleId='+encodeURIComponent(forbiddenVehicleId)+'&limit=10',{
      status:403,
      label:'forbidden history'
    });
    assert.equal(forbiddenHistory.ok,false);
    assert.equal(forbiddenHistory.code,'VEHICLE_FORBIDDEN');
    mark('forbidden_history_rejected',{status:'PASS',code:forbiddenHistory.code});

    report.status='PASS';
    report.vehicleId=vehicleId;
    report.diagnosticSessionId=diagnosticSessionId;
    console.log('RUNTIME_OBD_ACCEPTANCE: PASS vehicleId='+vehicleId+' diagnosticSessionId='+diagnosticSessionId);
  }catch(error){
    report.status='FAIL';
    report.failure=String(error?.stack||error);
    console.error(report.failure);
    process.exitCode=1;
  }finally{
    report.finishedAt=new Date().toISOString();
    const dir=path.join(root,'artifacts/runtime-acceptance');
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'obd.json'),JSON.stringify(report,null,2)+'\n');
  }
})();
