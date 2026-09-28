(() => { 'use strict';
 const api=()=>window.KaretaApiClient;
 const model=()=>window.KaretaDomainModel;
 const cache=new Map();
 const key=(type,id)=>`${type}:${id}`;
 async function get(type,id,{force=false}={}){const ref=key(type,id);if(!force&&cache.has(ref))return cache.get(ref);const result=await api().getDomainEntity(type,id,{force});if(!result.ok)throw new Error(result.message||result.code||'domain_entity_error');const data=result.data?.entity?result.data:result.payload;const value={...data,entity:model().normalize(type,data.entity||{})};cache.set(ref,value);return value;}
 async function timeline(type,id,options={}){const data=await get(type,id,options);return data.timeline||[];}
 async function relations(type,id,options={}){const data=await get(type,id,options);return data.relations||[];}
 function invalidate(type,id){if(type&&id)cache.delete(key(type,id));else cache.clear();}
 window.KaretaDomainRepository=Object.freeze({get,timeline,relations,invalidate,ref:key});
})();
