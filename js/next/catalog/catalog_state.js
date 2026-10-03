(() => {
  'use strict';

  const api = window.KaretaCatalogApi;
  if (!api) throw new Error('KaretaCatalogApi is required before catalog_state.js');

  const RELEASE=String(window.KARETA_NEXT_ASSET_VERSION||'dev');
  const CACHE_TTL = 30000;
  const PERSIST_KEY=`kareta.catalog.snapshot:${RELEASE}`;
  const listeners = new Set();
  let requestId = 0;
  let inFlight = null;
  let snapshot = Object.freeze({
    status:'idle', services:[], products:[], serviceCategories:[], productCategories:[],
    metrics:Object.freeze({ services:0, products:0, productsInStock:0 }),
    error:null, fetchedAt:0, stale:false, serviceSource:'',
  });

  function signatureOf(value){
    try{return JSON.stringify({
      services:(value?.services||[]).map(row=>[row.id,row.name,row.category,row.basePrice,row.minOfferPrice,row.offerCount]),
      products:(value?.products||[]).map(row=>[row.id,row.name,row.priceLabel,row.stock]),
      categories:(value?.serviceCategories||[]).map(row=>[row.key,row.name,row.count]),
    });}catch(_e){return'';}
  }
  function persist(value){
    try{sessionStorage.setItem(PERSIST_KEY,JSON.stringify({
      status:'ready',services:value.services||[],products:value.products||[],
      serviceCategories:value.serviceCategories||[],productCategories:value.productCategories||[],
      metrics:value.metrics||{},fetchedAt:Number(value.fetchedAt||0),stale:true,
      serviceSource:String(value.serviceSource||'')
    }));}catch(_e){}
  }
  try{
    const cached=JSON.parse(sessionStorage.getItem(PERSIST_KEY)||'null');
    if(cached&&Array.isArray(cached.services)&&cached.services.length){
      snapshot=Object.freeze({...snapshot,...cached,status:'ready',error:null,stale:true});
    }
  }catch(_e){}
  let lastSignature=signatureOf(snapshot);

  function categories(rows, field){
    const counts = new Map();
    rows.forEach(row => {
      const key = String(row?.[field] || 'other');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts, ([key, count]) => Object.freeze({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'ru'));
  }

  function emit(patch){
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach(listener => { try { listener(snapshot); } catch (_error) {} });
    return snapshot;
  }

  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener); listener(snapshot); return () => listeners.delete(listener);
  }

  function apply(payload, meta = {}){
    const services = Array.isArray(payload?.services) ? payload.services : [];
    const suppliedServiceCategories = Array.isArray(payload?.serviceCategories) ? payload.serviceCategories : [];
    const products = Array.isArray(payload?.products) ? payload.products : [];
    const serviceCategories=suppliedServiceCategories.length
      ? suppliedServiceCategories.map(item => Object.freeze({ ...item, count:services.filter(service => service.category === item.key).length }))
      : categories(services, 'category');
    const next={
      status:'ready', services, products, serviceCategories,
      productCategories:categories(products, 'category'),
      metrics:Object.freeze({
        services:services.length,
        products:products.length,
        productsInStock:products.filter(product => product.stock).length,
      }),
      error:null,
      fetchedAt:Number(meta.fetchedAt || payload?.fetchedAt || Date.now()),
      stale:meta.stale === true,
      serviceSource:String(payload?.serviceSource || meta.serviceSource || ''),
    };
    const nextSignature=signatureOf(next);
    if(snapshot.status==='ready'&&nextSignature&&nextSignature===lastSignature){
      snapshot=Object.freeze({...snapshot,fetchedAt:next.fetchedAt,stale:next.stale,error:null,serviceSource:next.serviceSource});
      persist(snapshot);
      return snapshot;
    }
    lastSignature=nextSignature;
    const value=emit(next);
    persist(value);
    return value;
  }

  async function load(options = {}){
    const id = ++requestId;
    const force = options.force === true;
    const hasCached=Boolean(snapshot.services.length||snapshot.products.length);
    const fresh=snapshot.status==='ready'&&(Date.now()-snapshot.fetchedAt)<CACHE_TTL;
    if(!force&&fresh)return snapshot;
    const refresh=async()=>{
      try{
        const payload=await api.load({force:force||hasCached,cacheTtlMs:CACHE_TTL});
        if(id!==requestId)return snapshot;
        return apply(payload);
      }catch(error){
        if(id!==requestId)return snapshot;
        if(hasCached){
          snapshot=Object.freeze({...snapshot,status:'ready',error:null,stale:true});
          persist(snapshot);
          return snapshot;
        }
        return emit({status:'error',error});
      }
    };
    if(hasCached){
      // Stale-while-revalidate: keep current content visible and refresh silently.
      if(!inFlight)inFlight=refresh().finally(()=>{inFlight=null;});
      return snapshot;
    }
    emit({status:'loading',error:null,stale:false});
    if(!inFlight)inFlight=refresh().finally(()=>{inFlight=null;});
    return inFlight;
  }

  function hydrate(responsePayload){
    const data = responsePayload?.data || responsePayload || {};
    if (!Array.isArray(data.services) && !Array.isArray(data.partsCatalog)) return snapshot;
    const incomingServices = Array.isArray(data.services) ? data.services.map(api.normalizeService) : [];
    const incomingCategories = Array.isArray(data.serviceCategories) ? data.serviceCategories.map(api.normalizeServiceCategory) : [];
    const incomingProducts = Array.isArray(data.partsCatalog) ? data.partsCatalog.map(api.normalizeProduct) : [];
    const degradedPull = responsePayload?.degraded === true || data.degraded === true || data.partial === true;
    // A degraded/partial pull may contain only orders or parts. It must never erase a healthy dedicated service catalog.
    // serviceSource:snapshot.serviceSource is retained when the service payload is absent.
    const preserveServices = degradedPull && !incomingServices.length && snapshot.services.length;
    const preserveCategories = preserveServices && !incomingCategories.length && snapshot.serviceCategories.length;
    return apply({
      services:preserveServices ? snapshot.services : incomingServices,
      serviceCategories:preserveCategories ? snapshot.serviceCategories : incomingCategories,
      products:Array.isArray(data.partsCatalog) ? incomingProducts : snapshot.products,
      fetchedAt:preserveServices ? snapshot.fetchedAt : Date.now(),
      serviceSource:preserveServices ? snapshot.serviceSource : String(data.serviceSource || data.meta?.source || ''),
    },{
      fetchedAt:preserveServices ? snapshot.fetchedAt : Date.now(),
      stale:preserveServices,
      serviceSource:preserveServices ? snapshot.serviceSource : String(data.serviceSource || data.meta?.source || ''),
    });
  }

  function cancel(){ requestId += 1; }

  window.addEventListener('kareta:realtime:event',event=>{
    const type=String(event.detail?.event?.eventType||'');
    if(/^(service|serviceOffer|catalog)\./i.test(type))void load({force:true,background:true});
  });
  window.addEventListener('online',()=>{if(snapshot.services.length)void load({force:true,background:true});});

  window.KaretaCatalogState = Object.freeze({
    load, hydrate, cancel, subscribe, getSnapshot:() => snapshot,
    audit:() => Object.freeze({ inFlight:!!inFlight, requestId, fetchedAt:snapshot.fetchedAt, stale:snapshot.stale }),
  });
})();
