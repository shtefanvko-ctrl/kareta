(() => {
  'use strict';

  const api = window.KaretaServiceOffersApi;
  if (!api) throw new Error('KaretaServiceOffersApi is required before service_offers_state.js');

  const listeners = new Set();
  let requestId = 0;
  let inFlight = null;
  let snapshot = Object.freeze({
    status:'idle', context:null, catalog:[], offers:[], metrics:Object.freeze({ catalogCount:0, configuredCount:0, activeCount:0 }),
    error:null, warning:null, partial:false, savingServiceId:'', fetchedAt:0,
  });

  function emit(patch){
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach(listener => { try { listener(snapshot); } catch (_error) {} });
    return snapshot;
  }

  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(snapshot);
    return () => listeners.delete(listener);
  }

  function metrics(offers, catalogCount = snapshot.catalog.length){
    return Object.freeze({
      catalogCount,
      configuredCount:offers.length,
      activeCount:offers.filter(offer => offer.active && offer.bookingEnabled && offer.availabilityStatus !== 'paused').length,
    });
  }

  async function load(options = {}){
    const id = ++requestId;
    emit({ status:'loading', error:null });
    try {
      if (!inFlight || options.force === true) inFlight = api.load(options).finally(() => { inFlight = null; });
      const data = await inFlight;
      if (id !== requestId) return snapshot;
      return emit({ ...data, status:data.partial ? 'partial' : 'ready', error:null, warning:data.warning || null, partial:data.partial === true, savingServiceId:'' });
    } catch (error) {
      if (id !== requestId) return snapshot;
      return emit({ status:'error', error, warning:null, partial:false, savingServiceId:'' });
    }
  }

  async function save(offer, options = {}){
    const serviceId = String(offer?.serviceId || '');
    emit({ savingServiceId:serviceId, error:null });
    try {
      const saved = await api.save(offer, options);
      const offers = snapshot.offers.filter(item => item.serviceId !== saved.serviceId).concat(saved);
      return emit({ offers, metrics:metrics(offers), savingServiceId:'', status:'ready', error:null, warning:null, partial:false });
    } catch (error) {
      emit({ savingServiceId:'', error });
      throw error;
    }
  }

  async function remove(serviceId, options = {}){
    const id = String(serviceId || '');
    emit({ savingServiceId:id, error:null });
    try {
      await api.remove(id, options);
      const offers = snapshot.offers.filter(item => item.serviceId !== id);
      return emit({ offers, metrics:metrics(offers), savingServiceId:'', status:'ready', error:null, warning:null, partial:false });
    } catch (error) {
      emit({ savingServiceId:'', error });
      throw error;
    }
  }

  function cancel(){ requestId += 1; }

  window.KaretaServiceOffersState = Object.freeze({
    load, save, remove, cancel, subscribe, getSnapshot:() => snapshot,
    audit:() => Object.freeze({ status:snapshot.status, offers:snapshot.offers.length, catalog:snapshot.catalog.length, inFlight:!!inFlight }),
  });
})();
