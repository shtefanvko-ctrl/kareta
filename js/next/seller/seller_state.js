(() => {
  'use strict';
  const api = window.KaretaSellerApi;
  if (!api) throw new Error('KaretaSellerApi is required before seller_state.js');
  let requestId = 0;
  let snapshot = Object.freeze({ status:'idle', profile:null, metrics:{}, products:[], archivedProducts:[], orders:[], categories:[], error:null });
  const listeners = new Set();
  function emit(next){ snapshot=Object.freeze(next); listeners.forEach(fn=>{try{fn(snapshot);}catch(_e){}}); return snapshot; }
  function subscribe(fn){ if(typeof fn!=='function') return()=>{}; listeners.add(fn); fn(snapshot); return()=>listeners.delete(fn); }
  async function load(options={}){
    const id=++requestId; emit({...snapshot,status:'loading',error:null});
    try{
      const payload=await api.dashboard(options);
      if(id!==requestId) return snapshot;
      return emit({status:'ready',profile:payload.profile||null,metrics:payload.metrics||{},products:Array.isArray(payload.products)?payload.products:[],archivedProducts:Array.isArray(payload.archivedProducts)?payload.archivedProducts:[],orders:Array.isArray(payload.orders)?payload.orders:[],categories:Array.isArray(payload.categories)?payload.categories:[],error:null});
    }catch(error){ if(id!==requestId) return snapshot; return emit({...snapshot,status:'error',error}); }
  }
  function cancel(){ requestId+=1; }
  window.KaretaSellerState=Object.freeze({load,cancel,subscribe,getSnapshot:()=>snapshot});
})();
