(() => {
  'use strict';
  if(window.__KARETA_JSON_CATALOG_LOADER_MODULE__){window.__KARETA_JSON_CATALOG_LOADER_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_JSON_CATALOG_LOADER_MODULE__={duplicateLoads:0};

  const release=String(window.KARETA_NEXT_ASSET_VERSION||'next');
  const cache=new Map();
  const inFlight=new Map();
  const REQUEST_TIMEOUT_MS=15000;
  let requests=0,cacheHits=0,dedupeHits=0;

  function normalize(path){
    const value=String(path||'').trim().replace(/^\/+/, '');
    if(!/^assets\/catalog\/[A-Za-z0-9_./-]+\.json$/.test(value)||value.includes('..'))throw new Error('catalog_path_invalid');
    return value;
  }
  function urlFor(path){const key=normalize(path);return `/${key}?v=${encodeURIComponent(release)}`;}
  function validateSchema(payload,key,schema){
    if(schema!==undefined&&payload.schema!==schema)throw new Error(`catalog_schema_mismatch:${key}`);
    return payload;
  }
  async function load(path,options={}){
    const key=normalize(path),force=options.force===true,schema=options.schema;
    if(!force&&cache.has(key)){cacheHits+=1;return validateSchema(cache.get(key),key,schema);}
    let request=!force&&inFlight.get(key);
    if(request){dedupeHits+=1;}
    else{
      request=(async()=>{
        requests+=1;
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
        try{
          const response=await fetch(urlFor(key),{cache:force?'reload':'default',credentials:'same-origin',headers:{Accept:'application/json'},signal:controller.signal});
          if(!response.ok)throw new Error(`catalog_http_${response.status}:${key}`);
          const type=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
          if(!/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/.test(type))throw new Error(`catalog_mime_invalid:${key}`);
          const payload=await response.json();
          if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error(`catalog_payload_invalid:${key}`);
          return payload;
        }finally{clearTimeout(timer);}
      })().finally(()=>{if(inFlight.get(key)===request)inFlight.delete(key);});
      inFlight.set(key,request);
    }
    const payload=validateSchema(await request,key,schema);
    cache.set(key,payload);
    return payload;
  }
  function clear(path){if(path)cache.delete(normalize(path));else cache.clear();}
  function audit(){return Object.freeze({release,requests,cacheHits,dedupeHits,cached:Array.from(cache.keys()),pending:Array.from(inFlight.keys())});}

  window.KaretaJsonCatalogLoader=Object.freeze({load,clear,audit,urlFor});
})();
