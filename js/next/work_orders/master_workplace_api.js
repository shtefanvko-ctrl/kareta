(() => {
  'use strict';

  const localBlocked=()=>({ok:false,status:409,payload:{ok:false,error:'master_onboarding_required',code:'MASTER_ONBOARDING_REQUIRED',redirectRoute:'#/onboarding/master',message:'Завершите анкету мастера'}});
  const guardedRequest=(api,...args)=>{
    const gate=window.KaretaMasterOnboardingGate;
    if(gate?.workAccessAllowed?.()===false)return Promise.resolve(localBlocked());
    return api.request(...args);
  };
  const post=(api,action,payload={})=>guardedRequest(api,'api/db.php',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...(window.KaretaFormContract?.prepare?.('master',payload)?.compatPayload||payload)}),
    cacheTtlMs:0,
    dedupe:false,
  });
  const get=(api,options={})=>guardedRequest(api,'api/db.php?action=masterWorkplace.get',{
    cacheTtlMs:0,
    force:true,
    dedupe:false,
    ...options,
  });
  const startTimer=(api,payload)=>post(api,'workTimers.start',payload);
  const stopTimer=(api,payload)=>post(api,'workTimers.stop',payload);
  const saveAvailability=(api,payload)=>post(api,'masterWorkplace.availability.save',payload);
  const savePreferences=(api,payload)=>post(api,'masterWorkplace.preferences.save',{preferences:payload});
  const saveExchangeResponse=(api,payload)=>post(api,'masterExchange.saveResponse',{response:payload});
  const saveOrderPlan=(api,payload)=>post(api,'masterSchedule.orderPlan.save',payload);
  const freeSlots=(api,payload)=>post(api,'masterSchedule.freeSlots',payload);
  const proposeReschedule=(api,payload)=>post(api,'masterSchedule.reschedule.propose',payload);
  const cancelExchangeResponse=(api,payload)=>post(api,'masterExchange.cancelResponse',payload);
  const toggleExchangeSaved=(api,payload)=>post(api,'masterExchange.toggleSaved',{request_id:payload?.request_id||payload?.requestId||payload?.id||'',active:!!payload?.active});
  const hideExchangeLead=(api,payload)=>post(api,'masterExchange.toggleHidden',{request_id:payload?.request_id||payload?.requestId||payload?.id||'',active:!!payload?.active});

  window.KaretaMasterWorkplaceApi=Object.freeze({
    get,
    startTimer,
    stopTimer,
    saveAvailability,
    savePreferences,
    saveExchangeResponse,
    saveOrderPlan,
    freeSlots,
    proposeReschedule,
    cancelExchangeResponse,
    toggleExchangeSaved,
    hideExchangeLead,
  });
})();
