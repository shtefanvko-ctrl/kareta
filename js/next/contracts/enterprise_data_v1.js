(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.KaretaEnterpriseDataV1=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const schemaVersion='1.0.0';
  const commonKeys=Object.freeze([
    'accountId','personId','contextId','cityId',
    'vehicleId','brandId','modelId','generationId','vin',
    'stoId','masterId','sellerId',
    'orderId','serviceId','workOrderId',
    'deviceId','adapterId','diagnosticSessionId','diagnosticJobId',
    'dtcCode','pid','protocol','snapshot',
    'requestId','idempotencyKey','schemaVersion','createdAt','updatedAt'
  ]);
  const legacyAliases=Object.freeze({
    account_id:'accountId',person_id:'personId',context_id:'contextId',city_id:'cityId',
    vehicle_id:'vehicleId',client_vehicle_id:'vehicleId',
    brand_id:'brandId',model_id:'modelId',generation_id:'generationId',
    sto_id:'stoId',master_id:'masterId',seller_id:'sellerId',
    order_id:'orderId',source_order_id:'orderId',service_id:'serviceId',work_order_id:'workOrderId',
    device_id:'deviceId',adapter_id:'adapterId',
    diagnostic_session_id:'diagnosticSessionId',diagnostic_job_id:'diagnosticJobId',
    dtc_code:'dtcCode',code_value:'dtcCode',protocol_label:'protocol',snapshot_json:'snapshot',
    request_id:'requestId',idempotency_key:'idempotencyKey',schema_version:'schemaVersion',
    created_at:'createdAt',updated_at:'updatedAt'
  });

  function canonicalDto(payload={}){
    const out={};
    for(const [key,value] of Object.entries(payload||{})){
      const canonical=legacyAliases[key]||key;
      if(!(canonical in out)||canonical===key) out[canonical]=value;
    }
    if(!String(out.schemaVersion||'').trim()) out.schemaVersion=schemaVersion;
    return out;
  }

  function compatPayload(payload={}){
    const out={...(payload||{})};
    for(const [legacy,canonical] of Object.entries(legacyAliases)){
      if(!(canonical in out)&&legacy in out) out[canonical]=out[legacy];
    }
    if(!String(out.schemaVersion||'').trim()) out.schemaVersion=schemaVersion;
    return out;
  }

  function requestId(){
    if(globalThis.crypto?.randomUUID) return 'req_'+globalThis.crypto.randomUUID();
    return 'req_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
  }

  function envelope(data={},meta={}){
    return {
      schemaVersion,
      requestId:String(meta.requestId||'').trim()||requestId(),
      idempotencyKey:String(meta.idempotencyKey||'').trim(),
      data:canonicalDto(data)
    };
  }

  return Object.freeze({schemaVersion,commonKeys,legacyAliases,canonicalDto,compatPayload,envelope});
});
