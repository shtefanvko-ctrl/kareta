'use strict';

const assert=require('node:assert/strict');

async function runObdAcceptance({context,base,json,report}){
  const vehicleId='veh_runtime_obd_001';
  const vehicleVin='JTDBR32E720123456';
  const syncKey='nq_runtime_obd_001';
  const forbiddenVehicleId='veh_runtime_obd_forbidden';
  const orderId='ord_runtime_obd_001';

  report.obd={vehicleId,syncKey,steps:[]};
  const mark=(name,data={})=>report.obd.steps.push({name,...data});

  const vehicle=await json(await context.request.post(base+'/api/db.php',{
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
        isDefault:true,
      }
    }
  }),'obd vehicle upsert');
  assert.equal(vehicle.ok,true,'vehicle upsert ok');
  assert.equal(String(vehicle.vehicle?.id||''),vehicleId,'vehicle id mismatch');
  mark('vehicle_upsert',{status:'PASS'});

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

  const missing=await json(await context.request.post(base+'/api/obd.php?action=sync',{
    data:{items:[{id:'nq_runtime_missing_vehicle',payload:{...basePayload,vehicleId:''}}]}
  }),'obd missing vehicle',422);
  assert.equal(missing.ok,false);
  assert.equal(missing.code,'VEHICLE_ID_REQUIRED');
  mark('missing_vehicle_rejected',{status:'PASS',code:missing.code});

  const forbidden=await json(await context.request.post(base+'/api/obd.php?action=sync',{
    data:{items:[{id:'nq_runtime_forbidden_vehicle',payload:{...basePayload,vehicleId:forbiddenVehicleId}}]}
  }),'obd forbidden vehicle',403);
  assert.equal(forbidden.ok,false);
  assert.equal(forbidden.code,'VEHICLE_FORBIDDEN');
  assert.equal(String(forbidden.vehicleId||''),forbiddenVehicleId);
  mark('forbidden_vehicle_rejected',{status:'PASS',code:forbidden.code});

  const validItem={id:syncKey,createdAt:Date.now(),payload:{...basePayload,vehicleId}};
  const first=await json(await context.request.post(base+'/api/obd.php?action=sync',{
    data:{items:[validItem]}
  }),'obd valid sync');
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

  const secondItem={
    ...validItem,
    payload:{
      ...validItem.payload,
      snapshot:{...validItem.payload.snapshot,rpm:915,coolantC:84},
      dtc:{raw:'43 01 00 03 00',codes:['P0100','P0300']}
    }
  };
  const second=await json(await context.request.post(base+'/api/obd.php?action=sync',{
    data:{items:[secondItem]}
  }),'obd idempotent repeat');
  assert.equal(second.ok,true);
  assert.equal(second.count,1);
  assert.equal(String(second.sessions?.[0]?.diagnosticSessionId||''),diagnosticSessionId,'same sync key must resolve to same diagnostic session');
  mark('idempotent_repeat',{status:'PASS',diagnosticSessionId});

  const history=await json(await context.request.get(base+'/api/obd.php?action=history&vehicleId='+encodeURIComponent(vehicleId)+'&limit=10'),'obd history');
  assert.equal(history.ok,true);
  assert.equal(Array.isArray(history.sessions),true);
  const row=history.sessions.find(item=>String(item.diagnosticSessionId||item.id||'')===diagnosticSessionId);
  assert.ok(row,'synced diagnostic session missing from history');
  assert.equal(String(row.vehicleId||''),vehicleId);
  assert.equal(Number(row.snapshot?.rpm),915);
  assert.deepEqual(row.dtcJson?.codes||[],['P0100','P0300']);
  assert.equal(String(row.vin||''),vehicleVin);
  assert.ok(String(row.schemaVersion||'').length>0);
  mark('history_round_trip',{status:'PASS',rpm:Number(row.snapshot?.rpm),vehicleId:String(row.vehicleId)});

  const forbiddenHistory=await json(await context.request.get(base+'/api/obd.php?action=history&vehicleId='+encodeURIComponent(forbiddenVehicleId)+'&limit=10'),'obd forbidden history',403);
  assert.equal(forbiddenHistory.ok,false);
  assert.equal(forbiddenHistory.code,'VEHICLE_FORBIDDEN');
  mark('forbidden_history_rejected',{status:'PASS',code:forbiddenHistory.code});

  report.obd.status='PASS';
  report.obd.diagnosticSessionId=diagnosticSessionId;
  console.log('RUNTIME_OBD_ACCEPTANCE: PASS vehicleId='+vehicleId+' diagnosticSessionId='+diagnosticSessionId);
}

module.exports={runObdAcceptance};
