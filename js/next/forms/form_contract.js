(function(root,factory){
  'use strict';
  const data=root?.KaretaEnterpriseDataV1 || (typeof require==='function' ? require('../contracts/enterprise_data_v1.js') : null);
  const api=factory(data);
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.KaretaFormContract=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis,function(data){
  'use strict';
  if(!data) throw new Error('KaretaEnterpriseDataV1 is required');

  const ID_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
  const KEY_RE=/^[A-Za-z][A-Za-z0-9]*$/;
  const CYRILLIC_RE=/[\u0400-\u052F]/;
  const roles=Object.freeze(['client','master','sto','seller','admin','owner']);
  const severities=Object.freeze(['info','warning','low','medium','high','critical']);

  const definitions=Object.freeze({
    onboarding:Object.freeze({
      canonicalIds:['accountId','personId','contextId','cityId'],
      enumFields:Object.freeze({role:roles})
    }),
    vehicle:Object.freeze({
      canonicalIds:['vehicleId','brandId','modelId','generationId']
    }),
    master:Object.freeze({
      canonicalIds:['accountId','personId','contextId','cityId','masterId','stoId','serviceId']
    }),
    sto:Object.freeze({
      canonicalIds:['accountId','contextId','cityId','stoId','masterId','orderId','workOrderId','serviceId']
    }),
    seller:Object.freeze({
      canonicalIds:['accountId','contextId','cityId','sellerId','orderId']
    }),
    order:Object.freeze({
      canonicalIds:['accountId','contextId','cityId','vehicleId','orderId','serviceId','workOrderId','masterId','stoId']
    }),
    workOrder:Object.freeze({
      canonicalIds:['vehicleId','orderId','workOrderId','masterId','stoId','serviceId']
    }),
    diagnostic:Object.freeze({
      canonicalIds:['accountId','contextId','vehicleId','deviceId','adapterId','diagnosticSessionId','diagnosticJobId'],
      enumFields:Object.freeze({severity:severities})
    })
  });

  const formAliases=Object.freeze({
    vehicle:Object.freeze({id:'vehicleId',clientVehicleId:'vehicleId'}),
    order:Object.freeze({id:'orderId',clientVehicleId:'vehicleId',vehicle_id:'vehicleId',client_vehicle_id:'vehicleId'}),
    workOrder:Object.freeze({id:'workOrderId',clientVehicleId:'vehicleId',vehicle_id:'vehicleId',client_vehicle_id:'vehicleId'}),
    master:Object.freeze({master_id:'masterId',sto_id:'stoId',city_id:'cityId'}),
    sto:Object.freeze({sto_id:'stoId',master_id:'masterId',order_id:'orderId',work_order_id:'workOrderId'}),
    seller:Object.freeze({seller_id:'sellerId',order_id:'orderId'}),
    diagnostic:Object.freeze({vehicle_id:'vehicleId',diagnostic_session_id:'diagnosticSessionId',diagnostic_job_id:'diagnosticJobId'})
  });

  function clone(value){
    if(Array.isArray(value)) return value.map(clone);
    if(value&&typeof value==='object'){
      const out={};
      for(const [key,item] of Object.entries(value)) out[key]=clone(item);
      return out;
    }
    return value;
  }

  function deepCompat(value){
    if(Array.isArray(value)) return value.map(deepCompat);
    if(!value||typeof value!=='object') return value;
    const out={};
    for(const [key,item] of Object.entries(value)) out[key]=deepCompat(item);
    for(const [legacy,canonical] of Object.entries(data.legacyAliases)){
      if(!(canonical in out)&&legacy in out) out[canonical]=out[legacy];
    }
    return out;
  }

  function addFormAliases(type,payload){
    const out=payload;
    for(const [legacy,canonical] of Object.entries(formAliases[type]||{})){
      if(!(canonical in out)&&legacy in out) out[canonical]=out[legacy];
    }
    return out;
  }

  function validateKeys(value,path='',errors=[]){
    if(Array.isArray(value)){value.forEach((item,index)=>validateKeys(item,`${path}[${index}]`,errors));return errors;}
    if(!value||typeof value!=='object') return errors;
    for(const [key,item] of Object.entries(value)){
      const current=path?`${path}.${key}`:key;
      if(CYRILLIC_RE.test(key)) errors.push({path:current,code:'non_english_key'});
      validateKeys(item,current,errors);
    }
    return errors;
  }

  function validate(type,payload={},options={}){
    const definition=definitions[type]||Object.freeze({canonicalIds:[]});
    const errors=validateKeys(payload);
    for(const key of definition.canonicalIds||[]){
      if(!(key in payload)||payload[key]==null||payload[key]==='') continue;
      const value=String(payload[key]);
      if(!ID_RE.test(value)) errors.push({path:key,code:'invalid_canonical_id'});
    }
    for(const [key,allowed] of Object.entries(definition.enumFields||{})){
      if(!(key in payload)||payload[key]==null||payload[key]==='') continue;
      const value=String(payload[key]);
      if(CYRILLIC_RE.test(value)) errors.push({path:key,code:'non_english_enum'});
      if(options.strictEnums===true&&!allowed.includes(value)) errors.push({path:key,code:'invalid_enum'});
    }
    if(options.strict===true){
      for(const key of options.required||[]){
        if(payload[key]==null||String(payload[key]).trim()==='') errors.push({path:key,code:'required'});
      }
    }
    return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors.map(Object.freeze))});
  }

  function canonicalDto(type,payload={},options={}){
    const source=deepCompat(clone(payload||{}));
    addFormAliases(type,source);
    if(options.canonical&&typeof options.canonical==='object'){
      for(const [key,value] of Object.entries(options.canonical)){
        if(value!==undefined&&value!==null&&String(value)!=='') source[key]=value;
      }
    }
    const out=data.canonicalDto(source);
    return out;
  }

  function compatPayload(type,payload={},options={}){
    const source=deepCompat(clone(payload||{}));
    addFormAliases(type,source);
    if(options.canonical&&typeof options.canonical==='object'){
      for(const [key,value] of Object.entries(options.canonical)){
        if(value!==undefined&&value!==null&&String(value)!=='') source[key]=value;
      }
    }
    if(!String(source.schemaVersion||'').trim()) source.schemaVersion=data.schemaVersion;
    if(!String(source.requestId||'').trim()) source.requestId=data.envelope({}).requestId;
    const idempotencyKey=String(options.idempotencyKey??source.idempotencyKey??'').trim();
    if(idempotencyKey) source.idempotencyKey=idempotencyKey;
    return source;
  }

  function prepare(type,payload={},options={}){
    const compat=compatPayload(type,payload,options);
    const dto=canonicalDto(type,compat,options);
    const validation=validate(type,dto,options);
    return Object.freeze({
      type,
      schemaVersion:data.schemaVersion,
      compatPayload:compat,
      dto,
      envelope:data.envelope(dto,{requestId:compat.requestId,idempotencyKey:compat.idempotencyKey||''}),
      validation
    });
  }

  return Object.freeze({definitions,formAliases,validate,canonicalDto,compatPayload,prepare,ID_RE,KEY_RE});
});
