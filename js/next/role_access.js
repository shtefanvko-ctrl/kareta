(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){window.KaretaRuntimeDependencies.deferScript('role_access',dependencies,scriptSource);return;}
  if(window.__KARETA_ROLE_ACCESS_MODULE__){window.__KARETA_ROLE_ACCESS_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_ROLE_ACCESS_MODULE__={duplicateLoads:0};

  const registry = window.KaretaRouteRegistry;
  if (!registry) throw new Error('KaretaRouteRegistry is required before role_access.js');

  const LEGACY = Object.freeze({
    client:{ role:'client', label:'Клиент', defaultRoute:'home', desktop:['home','works','services','masters','parts','diagnostics','orders','chats','cabinet'], mobile:['home','services','works','masters','parts','__more__'] },
    master:{ role:'master', label:'Мастер', defaultRoute:'masterDashboard', desktop:['masterDashboard','masterExchange','serviceManagement','diagnostics','parts','cabinet'], mobile:['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'] },
    sto:{ role:'sto', label:'СТО', defaultRoute:'stoDashboard', desktop:['stoDashboard','orders','masters','workflow','serviceManagement','diagnostics','finance','parts','chats','cabinet'], mobile:['stoDashboard','orders','masters','chats','cabinet'] },
    seller:{ role:'seller', label:'Продавец', defaultRoute:'seller', desktop:['seller','sellerProducts','sellerOrders','market','finance','parts','chats','cabinet'], mobile:['seller','sellerProducts','sellerOrders','parts','chats','cabinet'] },
    admin:{ role:'admin', label:'Администратор', defaultRoute:'home', desktop:registry.desktopKeys, mobile:registry.mobileKeys },
    owner:{ role:'owner', label:'Владелец', defaultRoute:'home', desktop:registry.desktopKeys, mobile:registry.mobileKeys },
  });

  const CLIENT_ONLY_ROUTES = new Set(['cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos']);
  let forcedLegacyRole = '';
  const identitySnapshot = () => window.KaretaIdentity?.snapshot?.() || { authenticated:false, mode:'anonymous' };
  const identityActive = () => {
    const snapshot = identitySnapshot();
    return snapshot.authenticated === true && snapshot.mode === 'identity';
  };
  function normalizeRole(value){
    const role=String(value||'').trim().toLowerCase();
    const normalized=role==='service'?'sto':role;
    return LEGACY[normalized] ? normalized : 'client';
  }
  function safeJson(storage,key){ try{return JSON.parse(storage.getItem(key)||'null')}catch(_e){return null} }
  function storedRole(){
    const resumeHint=window.KaretaSessionResume?.hint?.() || null;
    if(resumeHint?.role)return normalizeRole(resumeHint.role);
    const candidates=[window.KaretaNext?.state?.user,safeJson(localStorage,'kareta.auth.user'),safeJson(sessionStorage,'kareta.auth.user'),safeJson(localStorage,'kareta.profile.current')];
    const found=candidates.find(item=>item?.role);
    return normalizeRole(found?.role || window._karetaCookieRole || 'client');
  }
  function currentRole(){
    if (identityActive()) return normalizeRole(identitySnapshot().compatibilityRole || 'client');
    // Once warmSession has established that there is no authenticated session,
    // stale localStorage/session-resume role hints must never authorize a protected route.
    // A resume-degraded boot is the only anonymous-like state where the cached role is
    // intentionally retained while the Identity backend is transiently unavailable.
    const mode=String(document.documentElement?.dataset?.identityMode||'');
    if(mode==='anonymous'||mode==='booting') return 'client';
    if(mode==='resume-degraded'){
      const resumeHint=window.KaretaSessionResume?.hint?.()||null;
      return normalizeRole(resumeHint?.role||'client');
    }
    return normalizeRole(forcedLegacyRole || storedRole());
  }
  function policy(role=currentRole()){ return LEGACY[normalizeRole(role)]; }
  function dynamic(){ return window.KaretaDynamicNavigation; }
  function canAccess(routeKey, role=currentRole()){
    const key=String(routeKey||'');
    const normalizedRole=normalizeRole(role);
    if (!registry.has(key)) return false;
    if (['scanner','scannerQr','scannerDocument'].includes(key)) return ['client','master'].includes(normalizedRole);
    if (identityActive()) {
      if(key==='diagnostics') return ['client','master','sto','admin','owner'].includes(normalizedRole);
      return dynamic()?.canAccess?.(key) === true;
    }
    if (CLIENT_ONLY_ROUTES.has(key) && normalizedRole!=='client') return false;
    if (key==='masterSchedule' && normalizedRole!=='master') return false;
    return [...policy(normalizedRole).desktop,...policy(normalizedRole).mobile,'requestNew','workOrder','vehicle','notifications','following','cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos','cabinetSettings','about','rules','help','privacy','contacts','usedParts','productDetail','serviceDetail','providerDetail','providerBooking','providerReviews','workDetail','masterSchedule','masterProfileOwner','masterWallOwner','masterWorks','masterReviews'].includes(key);
  }
  function defaultRoute(role=currentRole()){
    if (identityActive()) return dynamic()?.defaultRoute?.() || 'home';
    return policy(role).defaultRoute;
  }
  function resolve(routeKey,role=currentRole()){
    const key=registry.has(routeKey)?routeKey:defaultRoute(role);
    return canAccess(key,role)?key:defaultRoute(role);
  }
  function keys(surface='desktop', role=currentRole()){
    if (identityActive()) return dynamic()?.items?.(surface==='routes'?'desktop':surface) || [];
    const p=policy(role);
    return [...(surface==='mobile'?p.mobile:p.desktop)].filter(registry.has);
  }
  function hasCapability(capability){ return identityActive() && window.KaretaIdentity?.has?.(capability)===true; }
  function refresh(role){
    // forced role is intentionally ignored while Identity is authoritative.
    forcedLegacyRole = identityActive() ? '' : (role?normalizeRole(role):'');
    if (identityActive()) dynamic()?.refresh?.();
    const detail=snapshot();
    try{window.dispatchEvent(new CustomEvent('kareta:role-access',{detail}))}catch(_e){}
    return detail;
  }
  function clearLegacyOverride(){ forcedLegacyRole=''; return snapshot(); }
  function snapshot(role=currentRole()){
    if (identityActive()) {
      return Object.freeze({
        role:normalizeRole(identitySnapshot().compatibilityRole || 'client'),
        label:'Identity Context',
        defaultRoute:defaultRoute(),
        desktop:keys('desktop'),
        mobile:keys('mobile'),
        dynamic:true,
        legacyFallback:false,
      });
    }
    const p=policy(role);
    return Object.freeze({ role:p.role,label:p.label,defaultRoute:defaultRoute(role),desktop:keys('desktop',role),mobile:keys('mobile',role),dynamic:false,legacyFallback:true });
  }
  function audit(){
    const s=snapshot();
    return {ok:registry.has(s.defaultRoute)&&s.desktop.every(key=>key==='__more__'||registry.has(key))&&s.mobile.every(key=>key==='__more__'||registry.has(key)),...s};
  }

  window.addEventListener('kareta:identity-ready', clearLegacyOverride);
  window.addEventListener('kareta:context-changed', clearLegacyOverride);
  window.KaretaRoleAccess=Object.freeze({ POLICIES:LEGACY, normalizeRole,currentRole,policy,canAccess,defaultRoute,resolve,keys,hasCapability,refresh,clearLegacyOverride,snapshot,audit,identityActive });
})();
