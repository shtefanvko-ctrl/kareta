(() => {
  'use strict';

  const client = window.KaretaApiClient;
  if (!client) throw new Error('KaretaApiClient is required before service_offers_api.js');

  function text(value){ return String(value ?? '').trim(); }
  function number(value){ const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
  function bool(value){ return value === true || value === 1 || String(value) === '1'; }

  function normalizeCatalog(row){
    return Object.freeze({
      id:text(row?.id),
      category:text(row?.category) || 'other',
      icon:text(row?.icon) || '⚙',
      name:text(row?.name) || 'Услуга',
      shortDesc:text(row?.shortDesc),
      basePrice:number(row?.basePrice),
      avgTime:text(row?.avgTime),
      sort:number(row?.sort),
    });
  }

  function normalizeOffer(row){
    return Object.freeze({
      id:number(row?.id),
      serviceId:text(row?.serviceId),
      ownerType:text(row?.ownerType),
      ownerUserId:number(row?.ownerUserId),
      ownerEntityId:text(row?.ownerEntityId),
      ownerName:text(row?.ownerName),
      city:text(row?.city),
      price:number(row?.price),
      priceType:text(row?.priceType || row?.price_type) || 'fixed',
      priceMax:number(row?.priceMax ?? row?.price_max),
      durationMin:number(row?.durationMin),
      durationMaxMin:number(row?.durationMaxMin ?? row?.duration_max_min),
      warrantyDays:number(row?.warrantyDays),
      availabilityStatus:text(row?.availabilityStatus) || 'available',
      bookingEnabled:bool(row?.bookingEnabled),
      notes:text(row?.notes),
      active:bool(row?.active),
      moderationStatus:text(row?.moderationStatus) || 'approved',
      updatedAt:row?.updatedAt || null,
    });
  }

  function parsePayload(payload){
    const data = payload?.data || {};
    return Object.freeze({
      context:Object.freeze({
        role:text(data?.context?.role),
        ownerType:text(data?.context?.ownerType),
        ownerUserId:number(data?.context?.ownerUserId),
        ownerEntityId:text(data?.context?.ownerEntityId),
        city:text(data?.context?.city),
        label:text(data?.context?.label),
      }),
      catalog:Array.isArray(data.catalog) ? data.catalog.map(normalizeCatalog) : [],
      offers:Array.isArray(data.offers) ? data.offers.map(normalizeOffer) : [],
      metrics:Object.freeze({
        catalogCount:number(data?.metrics?.catalogCount),
        configuredCount:number(data?.metrics?.configuredCount),
        activeCount:number(data?.metrics?.activeCount),
      }),
      fetchedAt:Date.now(),
    });
  }


  function normalizePublicCatalog(payload){
    const data = payload?.data || {};
    const rows = Array.isArray(data.services) ? data.services : [];
    return rows.map(row => normalizeCatalog({
      id:row?.id, category:row?.cat || row?.category, icon:row?.icon, name:row?.name,
      shortDesc:row?.shortDesc || row?.short_desc, basePrice:row?.basePrice || row?.base_price,
      avgTime:row?.avgTime || row?.avg_time, sort:row?.sort,
    }));
  }

  async function loadCatalogFallback(options = {}){
    const response = await client.request('api/db.php?action=services.catalog', {
      method:'GET', cacheTtlMs:30000, cacheKey:'services.catalog', ...options,
    });
    if (!response.ok) {
      const error = new Error(response.payload?.message || response.payload?.error || 'Не удалось загрузить общий каталог услуг');
      error.code = response.payload?.error || 'services_catalog_load_failed';
      error.status = response.status;
      throw error;
    }
    return normalizePublicCatalog(response.payload);
  }

  async function load(options = {}){
    const response = await client.request('api/db.php?action=serviceOffers.mine', {
      method:'GET', cacheTtlMs:15000, cacheKey:'serviceOffers.mine', ...options,
    });
    if (!response.ok) {
      const error = new Error(response.payload?.message || response.payload?.error || 'Не удалось загрузить личные настройки услуг');
      error.code = response.payload?.error || 'service_offers_load_failed';
      error.status = response.status;
      // Authorization/session failures are not catalog failures. Propagate them so
      // the page can enter its auth/error state instead of rendering a misleading
      // editable catalog that will fail on the first save.
      if (response.status === 401 || response.status === 403) throw error;
      const catalog = await loadCatalogFallback(options);
      return Object.freeze({
        context:Object.freeze({ role:'', ownerType:'', ownerUserId:0, ownerEntityId:'', city:'', label:'' }),
        catalog, offers:[],
        metrics:Object.freeze({ catalogCount:catalog.length, configuredCount:0, activeCount:0 }),
        warning:error, partial:true, fetchedAt:Date.now(),
      });
    }
    return parsePayload(response.payload);
  }

  async function post(action, data = {}, options = {}){
    const response = await client.request('api/db.php', {
      method:'POST',
      ...options,
      headers:{ 'Content-Type':'application/json', ...(options.headers || {}) },
      body:JSON.stringify({ action, ...data }),
    });
    if (!response.ok) {
      const error = new Error(response.payload?.message || response.payload?.error || 'Не удалось сохранить предложение');
      error.code = response.payload?.error || 'service_offer_request_failed';
      error.status = response.status;
      throw error;
    }
    client.invalidate('serviceOffers.mine');
    client.invalidate('action=pull');
    return response.payload;
  }

  async function save(offer, options = {}){
    const payload = await post('serviceOffers.save', { offer }, options);
    return normalizeOffer(payload.offer || {});
  }

  async function remove(serviceId, options = {}){
    return post('serviceOffers.delete', { serviceId }, options);
  }

  window.KaretaServiceOffersApi = Object.freeze({ load, save, remove, normalizeOffer, normalizeCatalog, loadCatalogFallback });
})();
