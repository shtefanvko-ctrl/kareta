(() => {
  'use strict';

  if (window.__KARETA_SESSION_RESUME_RUNTIME__) {
    window.__KARETA_SESSION_RESUME_RUNTIME__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_SESSION_RESUME_RUNTIME__ = { duplicateLoads:0 };

  const RELEASE='r1885589-session-resume-hardening';
  const STORAGE_KEY='kareta.session.resume.v1';
  const PROBE_AFTER_HIDDEN_MS=45_000;
  const MIN_PROBE_INTERVAL_MS=30_000;
  const HINT_MAX_AGE_MS=7*24*60*60*1000;
  const TRANSIENT_STATUS=new Set([0,408,425,429,500,502,503,504]);
  const state={
    hiddenAt:0,
    lastVisibleAt:Date.now(),
    lastProbeAt:0,
    lastVerifiedAt:0,
    probeCount:0,
    skippedCount:0,
    transientFailures:0,
    lastReason:'',
    lastStatus:'idle',
    probing:false,
    offlineSince:0,
    wakeCount:0,
  };
  let flight=null;

  const emit=(name,detail={})=>{try{window.dispatchEvent(new CustomEvent(name,{detail:{...detail,release:RELEASE}}));}catch(_error){}};
  const log=(type,data={},level='info')=>window.KaretaRuntimeLog?.add?.(`session.resume.${type}`,{...data,release:RELEASE},level);
  const normalizeRole=value=>{
    const role=String(value||'').trim().toLowerCase();
    if(role==='service')return 'sto';
    return ['client','master','sto','seller','admin','owner'].includes(role)?role:'client';
  };
  const identitySnapshot=()=>window.KaretaIdentity?.snapshot?.()||{};

  function readHint(){
    try{
      const row=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');
      if(!row||typeof row!=='object')return null;
      if(Date.now()-Number(row.at||0)>HINT_MAX_AGE_MS)return null;
      return row;
    }catch(_error){return null;}
  }

  function writeHint(detail={}){
    const identity=detail.identity||identitySnapshot();
    if(!identity?.authenticated)return null;
    const hint={
      at:Date.now(),
      accountId:Number(identity.account?.id||0)||null,
      contextId:Number(identity.context?.id||0)||null,
      contextKey:String(identity.context?.key||identity.context?.contextKey||''),
      role:normalizeRole(identity.compatibilityRole||document.documentElement.dataset.userRole||'client'),
      revision:Number(identity.revision||0),
      hash:String(location.hash||'#/home'),
    };
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(hint));}catch(_error){}
    document.documentElement.dataset.sessionResumeRole=hint.role;
    state.lastVerifiedAt=hint.at;
    return hint;
  }

  function clearHint(reason='anonymous'){
    try{sessionStorage.removeItem(STORAGE_KEY);}catch(_error){}
    delete document.documentElement.dataset.sessionResumeRole;
    log('hint-cleared',{reason});
  }

  function hint(){
    const row=readHint();
    if(row?.role)document.documentElement.dataset.sessionResumeRole=normalizeRole(row.role);
    return row;
  }

  function routeSnapshot(){
    const hash=String(location.hash||'#/home');
    return {
      hash,
      key:window.KaretaRouteRegistry?.keyFromHash?.(hash)||'',
      contextId:Number(identitySnapshot()?.context?.id||0)||null,
      contextKey:String(identitySnapshot()?.context?.key||''),
      role:normalizeRole(identitySnapshot()?.compatibilityRole||hint()?.role||'client'),
    };
  }

  function preserveUi(before,source){
    const navigation=window.KaretaNavigationCore;
    const current=identitySnapshot();
    const contextChanged=String(before.contextId||before.contextKey||'')!==String(current.context?.id||current.context?.key||'');
    if(contextChanged&&before.key){
      navigation?.refreshAll?.({source,redirect:false,activeKey:before.key});
      navigation?.preserveRouteAfterContextChange?.(before.key,before.hash,source);
    }else{
      navigation?.refreshAll?.({source,redirect:false,activeKey:before.key||undefined});
      if(String(location.hash||'')!==before.hash){
        try{history.replaceState(null,'',before.hash);}catch(_error){}
      }
    }
    window.KaretaNavigationState?.restore?.(before.hash,{replayActive:false,dispatchEvents:false});
    return {contextChanged,hash:String(location.hash||'')};
  }

  function transient(error){
    const status=Number(error?.status||error?.httpStatus||0);
    return TRANSIENT_STATUS.has(status)||error?.name==='AbortError'||/Failed to fetch|NetworkError|network|offline/i.test(String(error?.message||error||''));
  }

  async function probe(reason='resume',options={}){
    if(flight)return flight;
    const now=Date.now();
    const elapsed=now-state.lastProbeAt;
    if(!options.force&&state.lastProbeAt&&elapsed<MIN_PROBE_INTERVAL_MS){
      state.skippedCount+=1;
      log('probe-skipped',{reason,elapsed});
      return false;
    }
    if(navigator.onLine===false){
      state.lastStatus='offline';
      if(!state.offlineSince)state.offlineSince=now;
      document.documentElement.dataset.sessionResume='offline';
      return false;
    }

    const before=routeSnapshot();
    window.KaretaNavigationState?.capture?.(before.hash);
    state.probing=true;
    state.lastProbeAt=now;
    state.probeCount+=1;
    state.lastReason=reason;
    state.lastStatus='checking';
    document.documentElement.dataset.sessionResume='checking';
    emit('kareta:session-resume-check',{reason,before});

    flight=(async()=>{
      try{
        const legacyUser=window.KaretaNext?.state?.user||window.KaretaAppState?.user||null;
        const identity=await window.KaretaIdentity?.load?.({force:true,allowLegacyBridge:true,legacyUser});
        if(!identity?.authenticated){
          state.lastStatus='anonymous';
          document.documentElement.dataset.sessionResume='anonymous';
          log('anonymous',{reason,before},'warn');
          emit('kareta:session-resume-anonymous',{reason,before});
          return false;
        }
        const saved=hint();
        if(saved?.accountId&&Number(identity.account?.id||0)&&Number(saved.accountId)!==Number(identity.account.id)){
          log('account-changed',{reason,from:saved.accountId,to:identity.account.id},'warn');
        }
        const preserved=preserveUi(before,`session-resume:${reason}`);
        writeHint({identity});
        window.KaretaRealtime?.start?.();
        window.KaretaRealtimeClient?.start?.();
        state.lastStatus='verified';
        state.transientFailures=0;
        state.offlineSince=0;
        document.documentElement.dataset.sessionResume='verified';
        emit('kareta:session-resumed',{reason,before,identity,preserved});
        log('verified',{reason,before,preserved,contextId:identity.context?.id||null});
        return true;
      }catch(error){
        if(transient(error)){
          state.transientFailures+=1;
          state.lastStatus='degraded';
          document.documentElement.dataset.sessionResume='degraded';
          // A transient network/backend failure must never own routing or clear the live UI.
          if(String(location.hash||'')!==before.hash){try{history.replaceState(null,'',before.hash);}catch(_error){}}
          window.KaretaNavigationState?.restore?.(before.hash,{replayActive:false,dispatchEvents:false});
          emit('kareta:session-resume-degraded',{reason,error:String(error?.message||error),before});
          log('degraded',{reason,error:String(error?.message||error),before},'warn');
          return false;
        }
        state.lastStatus='failed';
        document.documentElement.dataset.sessionResume='failed';
        emit('kareta:session-resume-failed',{reason,error:String(error?.message||error),before});
        log('failed',{reason,error:String(error?.message||error),before},'error');
        return false;
      }finally{
        state.probing=false;
        flight=null;
      }
    })();
    return flight;
  }

  function shouldProbeAfterResume(hiddenFor){return hiddenFor>=PROBE_AFTER_HIDDEN_MS;}

  function onHidden(){
    state.hiddenAt=Date.now();
    window.KaretaNavigationState?.capture?.();
    const current=identitySnapshot();
    if(current?.authenticated)writeHint({identity:current});
    document.documentElement.dataset.sessionResume='suspended';
    log('hidden',{hash:location.hash,contextId:current?.context?.id||null});
  }

  function onVisible(source='visibility'){
    const now=Date.now();
    const hiddenFor=state.hiddenAt?Math.max(0,now-state.hiddenAt):0;
    state.lastVisibleAt=now;
    state.wakeCount+=hiddenFor>=PROBE_AFTER_HIDDEN_MS?1:0;
    window.KaretaNavigationState?.restore?.(location.hash,{replayActive:false,dispatchEvents:false});
    if(shouldProbeAfterResume(hiddenFor))probe(`${source}:${hiddenFor}`,{force:false});
    else{
      state.skippedCount+=1;
      document.documentElement.dataset.sessionResume=identitySnapshot()?.authenticated?'verified':'idle';
      log('visible-fast',{source,hiddenFor});
    }
    state.hiddenAt=0;
  }

  const initialHint=hint();
  if(initialHint?.role)document.documentElement.dataset.sessionResumeRole=normalizeRole(initialHint.role);

  window.addEventListener('kareta:session-confirmed',event=>{
    const identity=event.detail?.identity||identitySnapshot();
    if(identity?.authenticated)writeHint({identity});
  });
  window.addEventListener('kareta:identity-ready',event=>{
    const identity=event.detail||identitySnapshot();
    if(identity?.authenticated)writeHint({identity});
  });
  window.addEventListener('kareta:context-changed',event=>{
    const identity=event.detail?.identity||identitySnapshot();
    if(identity?.authenticated)writeHint({identity});
  });
  window.addEventListener('kareta:session-anonymous',event=>clearHint(event.detail?.reason||event.detail?.source||'anonymous'));
  window.addEventListener('offline',()=>{
    if(!state.offlineSince)state.offlineSince=Date.now();
    state.lastStatus='offline';
    document.documentElement.dataset.sessionResume='offline';
    window.KaretaNavigationState?.capture?.();
    log('offline',{hash:location.hash});
  });
  window.addEventListener('online',()=>probe('network-online',{force:true}));
  window.addEventListener('pageshow',event=>{
    if(event.persisted)onVisible('pageshow-bfcache');
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')onHidden();
    else if(document.visibilityState==='visible')onVisible('visibility');
  });
  window.addEventListener('pagehide',()=>{
    window.KaretaNavigationState?.capture?.();
    const current=identitySnapshot();
    if(current?.authenticated)writeHint({identity:current});
  });

  window.KaretaSessionResume=Object.freeze({
    RELEASE,
    probe,
    hint,
    clearHint,
    snapshot:()=>({...state,inFlight:!!flight,hint:readHint()}),
  });
})();
