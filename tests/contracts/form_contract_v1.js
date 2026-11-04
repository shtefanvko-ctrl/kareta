#!/usr/bin/env node
'use strict';
const form=require('../../js/next/forms/form_contract.js');
const failures=[];
const expect=(ok,name)=>{console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failures.push(name);};

const vehicle=form.prepare('vehicle',{
  id:'veh_1',brandId:'toyota',modelId:'camry',generationId:'xv70',vin:'JT123'
});
expect(vehicle.validation.ok,'vehicle compatibility validation');
expect(vehicle.compatPayload.id==='veh_1','vehicle legacy id preserved');
expect(vehicle.compatPayload.vehicleId==='veh_1','vehicleId canonical alias added');
expect(vehicle.dto.brandId==='toyota'&&vehicle.dto.modelId==='camry'&&vehicle.dto.generationId==='xv70','vehicle stable IDs in DTO');

const order=form.prepare('order',{order_id:'ord_1',client_vehicle_id:'veh_1',status:'confirmed'});
expect(order.compatPayload.order_id==='ord_1','order legacy key preserved');
expect(order.compatPayload.orderId==='ord_1','orderId alias added');
expect(order.compatPayload.vehicleId==='veh_1','order vehicleId alias added');
expect(order.validation.ok,'order compatibility validation');

const bad=form.validate('diagnostic',{vehicleId:'veh_1',severity:'критическая'},{strictEnums:true});
expect(!bad.ok&&bad.errors.some(x=>x.code==='non_english_enum'),'Cyrillic enum rejected');

const badKey=form.validate('order',{'машина':'veh_1'});
expect(!badKey.ok&&badKey.errors.some(x=>x.code==='non_english_key'),'Cyrillic key rejected');

process.exit(failures.length?1:0);
