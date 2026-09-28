(() => {
  'use strict';
  if (window.__KARETA_RECOVERY_MANAGER_MODULE__) {
    window.__KARETA_RECOVERY_MANAGER_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_RECOVERY_MANAGER_MODULE__ = { duplicateLoads:0 };

  const MAX_RETRIES = 2;
  const RECOVERY_COOLDOWN_MS = 4500;
  const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);
  const state = {
    recovering:false, phase:'idle', lastReason:'', attempts:0, consecutiveFailures:0,
    lastStartedAt:0, lastCompletedAt:0, lastStatus:'idle', suppressed:0,
  };
  let recoveryFlight = null;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const log = (type, data={}, level='info') => window.KaretaRuntimeLog?.add?.(`recovery.${type}`, data, level);
  const emit = (name, detail={}) => {
    try { window.dispatchEvent(new CustomEvent(name, { detail:{ ...detail, phase:state.phase } })); } catch (_error) {}
  };
  const setPhase = (phase, detail={}) => {
    state.phase=phase;
    document.documentElement.dataset.recoveryPhase=phase;
    emit('kareta:recovery-phase', detail);
  };

  function clearTransientUi(){
    document.documentElement.removeAttribute('data-kareta-loading-stuck');
    document.querySelectorAll('[aria-busy="true"]').forEach(el => {
      if (!el.closest?.('.k-context-switching')) el.setAttribute('aria-busy','false');
    });
    document.querySelectorAll('button[disabled][data-kareta-auto-disabled="1"]').forEach(el => { el.disabled=false; delete el.dataset.karetaAutoDisabled; });
  }

  function stopRealtime(reason){
    window.KaretaRealtime?.stop?.(reason);
    window.KaretaRealtimeClient?.stop?.(reason);
  }

  function startRealtime(){
    window.KaretaRealtime?.start?.();
    window.KaretaRealtimeClient?.start?.();
  }

  function rebuildRoleSurface(source){
    const navigation=window.KaretaNavigationCore;
    navigation?.refreshAll?.({ source, redirect:false });
    window.KaretaContextManager?.render?.();
    const requested=window.KaretaRouteRegistry?.keyFromHash?.(location.hash)||'';
    const target=navigation?.resolveRoute?.(requested)||navigation?.defaultRoute?.()||'home';
    window.KaretaRouteRuntime?.navigate?.(target,{source,replace:true,force:true});
    return target;
  }

  async function runRecovery(reason, options){
    state.recovering=true;
    state.lastReason=reason;
    state.lastStartedAt=Date.now();
    state.attempts+=1;
    setPhase('preparing',{reason,attempt:state.attempts});
    log('start',{reason,attempt:state.attempts},'warn');
    try{
      stopRealtime(`recovery:${reason}`);
      clearTransientUi();
      if (navigator.onLine === false) {
        state.lastStatus='offline';
        setPhase('waiting-network',{reason});
        return false;
      }

      setPhase('identity',{reason});
      const legacyUser=window.KaretaNext?.state?.user || window.KaretaAppState?.user || null;
      const identity = await window.KaretaIdentity?.load?.({
        force:true,
        allowLegacyBridge:true,
        legacyUser
      });
      if(identity?.authenticated){
        const contexts=Array.isArray(identity.contexts)?identity.contexts:[];
        const currentId=String(identity.context?.id||identity.context?.key||'');
        const currentAvailable=contexts.some(item=>String(item.id||item.key||'')===currentId);
        let recoveredIdentity=identity;
        if(!currentAvailable&&contexts.length){
          const fallback=contexts.find(item=>item.type==='personal')||contexts[0];
          setPhase('context-fallback',{reason,from:currentId,to:fallback.id||fallback.key});
          recoveredIdentity=await window.KaretaIdentity.select(fallback.id||fallback.key);
          emit('kareta:context-recovered',{reason,context:recoveredIdentity.context});
        }
        setPhase('interface',{reason});
        const route=rebuildRoleSurface('identity-recovery');
        startRealtime();
        state.consecutiveFailures=0;
        state.lastStatus='recovered';
        emit('kareta:identity-recovered',{reason,identity:recoveredIdentity,route});
        log('success',{reason,mode:recoveredIdentity.mode,route});
        return true;
      }

      setPhase('anonymous',{reason});
      stopRealtime(`anonymous:${reason}`);
      const route=rebuildRoleSurface('session-recovery-anonymous');
      state.lastStatus='anonymous';
      state.consecutiveFailures=0;
      emit('kareta:session-anonymous',{source:'recovery',reason,route});
      log('anonymous',{reason,route},'warn');
      return false;
    }catch(error){
      state.consecutiveFailures+=1;
      state.lastStatus='failed';
      setPhase('failed',{reason,error:String(error?.message||error)});
      log('failed',{reason,error,consecutiveFailures:state.consecutiveFailures},'error');
      return false;
    }finally{
      state.recovering=false;
      state.lastCompletedAt=Date.now();
      window.setTimeout(()=>{if(!state.recovering)setPhase('idle',{reason});},180);
    }
  }

  function recoverIdentity(reason='identity_failure', options={}){
    if(recoveryFlight)return recoveryFlight;
    const elapsed=Date.now()-state.lastStartedAt;
    if(!options.force&&state.lastStartedAt>0&&elapsed<RECOVERY_COOLDOWN_MS){
      state.suppressed+=1;
      log('suppressed',{reason,elapsed,cooldown:RECOVERY_COOLDOWN_MS},'warn');
      return Promise.resolve(false);
    }
    recoveryFlight=runRecovery(String(reason||'identity_failure'),options).finally(()=>{recoveryFlight=null;});
    return recoveryFlight;
  }

  async function retry(operation, options={}){
    const retries=Math.max(0,Math.min(5,Number(options.retries ?? MAX_RETRIES)));
    let last;
    for(let attempt=0;attempt<=retries;attempt++){
      try{return await operation(attempt);}catch(error){
        last=error;
        const status=Number(error?.status || error?.httpStatus || 0);
        const transient=!status || TRANSIENT.has(status) || error?.name==='AbortError';
        if(!transient || attempt>=retries) break;
        await wait(Math.min(2500,300*Math.pow(2,attempt)));
      }
    }
    throw last;
  }

  window.addEventListener('kareta:session-expired', event => recoverIdentity(event.detail?.reason||'session_expired'));
  window.addEventListener('kareta:context-lost', event => recoverIdentity(event.detail?.reason||'context_lost',{force:true}));
  window.addEventListener('kareta:identity-error', event => {
    const status=Number(event.detail?.error?.status||0);
    if(!status||TRANSIENT.has(status))recoverIdentity(`identity_error_${status||'network'}`);
  });
  window.addEventListener('online', () => {
    clearTransientUi();
    if(window.KaretaSessionResume?.probe){
      window.KaretaSessionResume.probe('network-online',{force:true});
      return;
    }
    const identity=window.KaretaIdentity?.snapshot?.()||{};
    if(identity.authenticated||identity.error||state.lastStatus==='offline'||state.lastStatus==='failed')recoverIdentity('network_online',{force:true});
  });
  window.addEventListener('unhandledrejection', event => {
    const message=String(event.reason?.message || event.reason || '');
    if(/session_context_mismatch|session_required|identity_account_unavailable/i.test(message)) recoverIdentity(message);
  });

  window.KaretaRecovery = Object.freeze({ retry, recoverIdentity, clearTransientUi, snapshot:()=>({...state,inFlight:!!recoveryFlight}) });
})();
