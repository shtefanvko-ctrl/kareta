(() => {
  'use strict';
  const api = window.KaretaShopApi;
  if (!api) throw new Error('KaretaShopApi is required before shop_state.js');

  const CART_KEY = 'kareta.shop.cart.v1';
  const CACHE_TTL = 60000;
  const listeners = new Set();
  const cache = new Map();
  const inFlight = new Map();
  let requestId = 0;

  function readCart(){
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && item.id && Number(item.qty) > 0) : [];
    } catch (_error) { return []; }
  }
  function saveCart(cart){ try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_error) {} }
  function keyOf(filters){
    return JSON.stringify({
      search:String(filters.search || '').trim(),
      category:String(filters.category || 'all'),
      limit:Math.max(1, Math.min(100, Number(filters.limit || 60))),
    });
  }

  let snapshot = Object.freeze({
    status:'idle', products:[], categories:[], total:0, cart:readCart(),
    filters:{ search:'', category:'all', limit:60 }, error:null,
    checkoutStatus:'idle', fetchedAt:0, stale:false,
  });

  function emit(patch){
    snapshot=Object.freeze({ ...snapshot, ...patch });
    listeners.forEach(fn=>{ try{fn(snapshot);}catch(_error){} });
    return snapshot;
  }
  function subscribe(fn){ if(typeof fn!=='function') return()=>{}; listeners.add(fn); fn(snapshot); return()=>listeners.delete(fn); }

  function applyPayload(payload, filters, meta = {}){
    return emit({
      status:'ready',
      products:Array.isArray(payload?.products)?payload.products:[],
      categories:Array.isArray(payload?.categories)?payload.categories:[],
      total:Number(payload?.total || 0),
      filters,
      error:null,
      fetchedAt:Number(meta.fetchedAt || Date.now()),
      stale:meta.stale === true,
    });
  }

  async function load(filters = {}, options = {}){
    const id=++requestId;
    const nextFilters={ ...snapshot.filters, ...filters };
    const key=keyOf(nextFilters);
    const cached=cache.get(key);
    const force=options.force === true;

    if (!force && cached && (Date.now()-cached.fetchedAt)<CACHE_TTL) {
      return applyPayload(cached.payload, nextFilters, cached);
    }

    emit({ status:'loading', filters:nextFilters, error:null, stale:false });
    try {
      let promise=inFlight.get(key);
      if(!promise || force){
        const request=api.catalog(nextFilters,{ force });
        promise=request.finally(()=>{ if(inFlight.get(key)===promise) inFlight.delete(key); });
        inFlight.set(key,promise);
      }
      const payload=await promise;
      const record={ payload, fetchedAt:Date.now() };
      cache.set(key,record);
      if(id!==requestId) return snapshot;
      return applyPayload(payload,nextFilters,record);
    } catch(error){
      if(id!==requestId) return snapshot;
      if(cached){
        return applyPayload(cached.payload,nextFilters,{ fetchedAt:cached.fetchedAt, stale:true });
      }
      const message=error?.status===429
        ? 'Каталог временно ограничен защитой сервера. Повторите через несколько секунд.'
        : (error?.message || 'Не удалось загрузить каталог.');
      if(error && message!==error.message) error.message=message;
      return emit({ status:'error', error, stale:false });
    }
  }

  function add(product){
    const cart=[...snapshot.cart];
    const found=cart.find(item=>item.id===product.id);
    if(found) found.qty=Math.min(99,Number(found.qty||0)+1);
    else cart.push({ id:product.id, name:product.name, price:Number(product.price||0), stock:Number(product.stock_qty||0), storeName:product.store_name||'', qty:1 });
    saveCart(cart); return emit({ cart });
  }
  function setQty(id, qty){
    const amount=Math.max(0,Math.min(99,Number(qty||0)));
    const cart=snapshot.cart.map(item=>item.id===id?{...item,qty:Math.min(amount,Math.max(1,Number(item.stock||99)))}:item).filter(item=>item.id!==id||amount>0);
    saveCart(cart); return emit({ cart });
  }
  function clear(){ saveCart([]); return emit({ cart:[] }); }
  function invalidate(){ cache.clear(); window.KaretaApiClient?.invalidate?.('shop.catalog'); }

  async function checkout(customer, options = {}){
    if(!snapshot.cart.length) throw new Error('Корзина пуста');
    emit({ checkoutStatus:'loading', error:null });
    try {
      const order={ ...customer, items:snapshot.cart.map(item=>({ productId:item.id, qty:item.qty })) };
      const payload=await api.createOrder(order, options);
      clear(); invalidate(); emit({ checkoutStatus:'success' });
      await load(snapshot.filters, { force:true }).catch(()=>null);
      return payload;
    } catch(error){ emit({ checkoutStatus:'error', error }); throw error; }
  }

  function cancel(){ requestId+=1; }
  window.KaretaShopState=Object.freeze({
    load, add, setQty, clear, checkout, cancel, invalidate, subscribe,
    getSnapshot:()=>snapshot,
    audit:()=>Object.freeze({ cacheEntries:cache.size, inFlight:inFlight.size, requestId, fetchedAt:snapshot.fetchedAt, stale:snapshot.stale }),
  });
})();
