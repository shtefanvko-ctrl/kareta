(() => {
  'use strict';
  const api=window.KaretaClientCabinetApi;
  const flow=window.KaretaFirstVehicleFlow;
  if(!api||!flow) throw new Error('CLIENT first vehicle dependencies are required');

  function params(){const raw=String(location.hash||'');const q=raw.includes('?')?raw.slice(raw.indexOf('?')+1):'';return new URLSearchParams(q);}
  function role(){return String(window.KaretaNavigationCore?.interfaceRole?.()||window.KaretaIdentity?.snapshot?.()?.compatibilityRole||window.KaretaNext?.state?.user?.role||'').toLowerCase();}
  function navigate(key,hash){if(window.KaretaRouteRuntime?.navigate)window.KaretaRouteRuntime.navigate(key,{source:'client-first-vehicle-route',force:true});else location.hash=hash;}
  function render(){return '<section class="k-page k-client-first-vehicle-route" data-client-first-vehicle-route aria-live="polite"><div class="k-first-vehicle-route-loading">Загружаем гараж…</div></section>';}
  async function mount(context={}){
    const root=document.querySelector('[data-client-first-vehicle-route]');if(!root)return()=>{};
    if(role()!=='client'){
      const fallback=window.KaretaRoleAccess?.defaultRoute?.(role())||'home';
      const hash=window.KaretaRouteRegistry?.get?.(fallback)?.path||'#/home';
      navigate(fallback,hash);return()=>{};
    }
    // Clear any stale pre-dedicated-route bridge token from older builds.
    flow.consumePendingIntro?.();
    const p=params(),manual=p.get('mode')==='manual',requested=Math.max(1,Math.min(4,Number(p.get('step')||(manual?2:1))||1));
    let result=null;try{result=await api.get({cacheTtlMs:0,force:true,dedupe:false,signal:context.lifecycle?.signal});}catch(_e){}
    const data=result?.payload?.data||result?.payload||{};const active=Array.isArray(data.vehicles)?data.vehicles:[];
    if(!manual&&active.length){navigate('home','#/home');return()=>{};}
    flow.start({root,startStep:manual?Math.max(2,requested):requested,data,mode:manual?'manual':'intro',onReturn:()=>navigate('cabinetGarage','#/cabinet/garage')});
    return()=>{};
  }
  window.KaretaClientFirstVehiclePages=Object.freeze({renderClientFirstVehicle:render,mountClientFirstVehicle:mount});
})();
