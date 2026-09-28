(() => {
  'use strict';
  if (window.__KARETA_MASTER_ONBOARDING_GATE__) return;
  window.__KARETA_MASTER_ONBOARDING_GATE__ = true;

  const API='/api/master_onboarding.php?action=current';
  const ALLOWED_WHILE_BLOCKED=new Set(['masterOnboarding','rules','privacy','help','about']);
  const state={contextId:null,status:'unknown',step:1,view:'profile',checking:false,lastError:'',checkedAt:0,flight:null,verified:false,deferredUntil:0};
  const snapshot=()=>window.KaretaIdentity?.snapshot?.()||null;
  const isMaster=()=>{const snap=snapshot();const ctx=snap?.context||{};return snap?.mode==='identity'&&snap?.compatibilityRole==='master'&&String(ctx.type||ctx.contextType||'').toLowerCase()==='profile'&&String(ctx.profileType||ctx.profile_type||'').toLowerCase()==='master';};
  const contextId=()=>String(snapshot()?.context?.id||'');
  const cacheKey=id=>`kareta.master.onboarding.status.v1:${id||'current'}`;

  function readCache(id){try{return JSON.parse(localStorage.getItem(cacheKey(id))||sessionStorage.getItem(cacheKey(id))||'null');}catch(_e){return null;}}
  function writeCache(){if(!state.contextId)return;const value=JSON.stringify({status:state.status,step:state.step,view:state.view,deferredUntil:state.deferredUntil||0,at:Date.now()});try{localStorage.setItem(cacheKey(state.contextId),value);sessionStorage.setItem(cacheKey(state.contextId),value);}catch(_e){}}
  function hydrate(){const id=contextId();if(!id)return; if(state.contextId===id&&state.status!=='unknown')return; state.contextId=id;state.verified=false;const c=readCache(id);state.status=c?.status||'unknown';state.step=Math.max(1,Math.min(4,Number(c?.step||1)));state.view=String(c?.view||'profile');state.deferredUntil=Math.max(0,Number(c?.deferredUntil||0));}
  function onboardingHash(){return `#/onboarding/master?step=${state.step||1}&view=${encodeURIComponent(state.view||'profile')}`;}
  function isGeneralOnboarding(){return Boolean(window.KaretaOnboardingBridge?.isOnboardingHash?.(location.hash)) || /^#role:/.test(String(location.hash||''));}
  function isDeferred(){hydrate();return state.status!=='completed'&&Number(state.deferredUntil||0)>Date.now();}
  function blocked(){hydrate();return isMaster() && !isDeferred() && (state.status!=='completed'||!state.verified);}
  function shouldOwnRoute(routeKey=''){return blocked() && !isGeneralOnboarding() && !ALLOWED_WHILE_BLOCKED.has(String(routeKey||''));}
  function resolveRoute(routeKey=''){if(!blocked()||isGeneralOnboarding())return routeKey;return ALLOWED_WHILE_BLOCKED.has(String(routeKey||''))?routeKey:'masterOnboarding';}
  function moveToOnboarding(source='master-onboarding-gate'){
    if(!blocked()||isGeneralOnboarding())return false;
    const wanted=onboardingHash();
    if(!String(location.hash||'').startsWith('#/onboarding/master')){try{history.replaceState(null,'',wanted);}catch(_e){location.hash=wanted;}}
    window.KaretaRouteRuntime?.transition?.('masterOnboarding',{source,force:true});
    return true;
  }
  async function requestCurrent(){
    const r=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});const text=await r.text();let p=null;try{p=text?JSON.parse(text):null;}catch(_e){}
    if(!p||typeof p!=='object')throw new Error('master_onboarding_invalid_json');
    if(!r.ok||p.ok===false){const e=new Error(p.message||p.error||`HTTP ${r.status}`);e.status=r.status;e.payload=p;throw e;}return p;
  }
  async function check(options={}){
    if(!isMaster()){state.contextId=null;state.status='not_applicable';state.lastError='';return {status:state.status};}
    hydrate();
    if(state.flight&&state.flightContext===contextId())return state.flight;
    const requestedContext=contextId();state.flightContext=requestedContext;
    state.checking=true;
    state.flight=(async()=>{try{
      const p=await requestCurrent();if(contextId()!==requestedContext||String(p.contextId||'')!==requestedContext)return {status:'context_changed'};state.verified=true;state.contextId=requestedContext;state.status=String(p.status||'not_started');state.step=Math.max(1,Math.min(4,Number(p.currentStep||p.draft?.currentStep||1)));state.view=String(p.currentView||p.draft?.currentView||({1:'profile',2:'services',3:'work-place',4:'review'}[state.step]));state.deferredUntil=Date.parse(String(p.draft?.deferredUntil||''))||0;state.lastError='';state.checkedAt=Date.now();writeCache();
      if(options.redirect!==false&&state.status!=='completed'&&!isDeferred())moveToOnboarding(options.source||'master-onboarding-check');
      return p;
    }catch(error){if(contextId()!==requestedContext)throw error;state.verified=false;state.lastError=String(error?.message||error);state.status=state.status==='completed'?'completed':'unknown';if(options.redirect!==false&&state.status!=='completed'&&!isDeferred())moveToOnboarding(options.source||'master-onboarding-error');throw error;}finally{if(state.flightContext===requestedContext){state.checking=false;state.flight=null;}}})();
    return state.flight;
  }
  function markCompleted(id){if(id&&String(id)!==contextId())return;state.verified=true;state.contextId=String(id||contextId());state.status='completed';state.step=4;state.view='review';state.deferredUntil=0;state.lastError='';state.checkedAt=Date.now();writeCache();}
  function markDeferred(id,until){if(id&&String(id)!==contextId())return false;state.verified=true;state.contextId=String(id||contextId());state.status=state.status==='completed'?'completed':'in_progress';state.deferredUntil=Date.parse(String(until||''))||Number(until)||0;state.lastError='';state.checkedAt=Date.now();writeCache();return isDeferred();}
  function workAccessAllowed(){return !blocked();}
  async function ensureCompleted(options={}){
    if(!isMaster())return true;
    try{await check({...options,redirect:false});}catch(_error){}
    const ok=workAccessAllowed();
    if(!ok&&options.redirect!==false)moveToOnboarding(options.source||'master-access');
    return ok;
  }
  function onIdentity(event){const detail=event?.detail?.identity||event?.detail||{};const role=detail?.compatibilityRole||snapshot()?.compatibilityRole;if(role!=='master'){state.contextId=null;state.status='not_applicable';return;}state.verified=false;state.status='unknown';state.contextId=String(detail?.context?.id||contextId());hydrate();check({redirect:true,source:'identity-master-onboarding'}).catch(()=>{});}
  window.addEventListener('kareta:identity-ready',onIdentity);
  window.addEventListener('kareta:context-changed',onIdentity);
  window.addEventListener('pageshow',()=>{if(isMaster())check({redirect:true,source:'pageshow-master-onboarding'}).catch(()=>{});});
  window.KaretaMasterOnboardingGate=Object.freeze({check,ensureCompleted,workAccessAllowed,blocked,shouldOwnRoute,resolveRoute,markCompleted,markDeferred,isDeferred,snapshot:()=>({...state})});
})();
