(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const APP_DEPENDENCIES=[
    'KaretaRouteRegistry','KaretaRouteRuntime','KaretaRouteAssetLoader','KaretaApiClient','KaretaCorePages',
    'KaretaRoleAccess','KaretaShellNav','KaretaShellMenu'
  ];
  const missingDependencies=window.KaretaRuntimeDependencies?.missing?.(APP_DEPENDENCIES)||[];
  if(missingDependencies.length){window.KaretaRuntimeDependencies.deferScript('app_next',APP_DEPENDENCIES,scriptSource);return;}
  if (window.__KARETA_NEXT_APP_MODULE__) {
    window.__KARETA_NEXT_APP_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_NEXT_APP_MODULE__ = { duplicateLoads:0 };

  const APP_VERSION = String(window.KARETA_NEXT_ASSET_VERSION || 'next');
  const routeRegistry = window.KaretaRouteRegistry;
  const routeRuntime = window.KaretaRouteRuntime;
  const routeAssetLoader = window.KaretaRouteAssetLoader;
  const apiClient = window.KaretaApiClient;
  const roleAccess = window.KaretaRoleAccess;
  const preloader = window.KaretaAppPreloader;
  const bootProfiler = window.KaretaBootProfiler;
  const profilePromise = (name,promise,meta={}) => bootProfiler?.timePromise?.(name,promise,meta) || Promise.resolve(promise);
  bootProfiler?.markOnce?.('app-next-execute',{version:APP_VERSION});
  if (!routeRegistry) throw new Error('KaretaRouteRegistry is required before app_next.js');
  if (!routeRuntime) throw new Error('KaretaRouteRuntime is required before app_next.js');
  if (!routeAssetLoader) throw new Error('KaretaRouteAssetLoader is required before app_next.js');
  if (!apiClient) throw new Error('KaretaApiClient is required before app_next.js');
  if (!window.KaretaCorePages) throw new Error('KaretaCorePages is required before app_next.js');
  if (!roleAccess) throw new Error('KaretaRoleAccess is required before app_next.js');

  // Route pages are resolved from window only at render/mount time. Heavy modules
  // can therefore be absent during atomic boot and loaded by route_asset_loader.js.
  const PAGE_BINDINGS = Object.freeze({
    home:{global:'KaretaCorePages',render:'renderHome',mount:'mountHome'},
    platform:{global:'KaretaPlatformPages',render:'renderPlatform',mount:'mountPlatform'},
    corePlatform:{global:'KaretaCorePlatformPages',render:'renderCorePlatform',mount:'mountCorePlatform'},
    calendarBooking:{global:'KaretaCalendarBookingPages',render:'renderCalendarBooking',mount:'mountCalendarBooking'},
    finance:{global:'KaretaFinancePages',render:'renderFinance',mount:'mountFinance'},
    market:{global:'KaretaMarketPages',render:'renderMarket',mount:'mountMarket'},
    crm:{global:'KaretaCrmPages',render:'renderCrm',mount:'mountCrm'},
    identityMigration:{global:'KaretaIdentityMigrationPages',render:'render',mount:'mount'},
    adminUsers:{global:'KaretaAdminWorkspacePages',render:'render',mount:'mount',renderArgs:['adminUsers']},
    adminOrganizations:{global:'KaretaAdminWorkspacePages',render:'render',mount:'mount',renderArgs:['adminOrganizations']},
    adminMonitoring:{global:'KaretaAdminWorkspacePages',render:'render',mount:'mount',renderArgs:['adminMonitoring']},
    adminManagement:{global:'KaretaAdminWorkspacePages',render:'render',mount:'mount',renderArgs:['adminManagement']},
    assistant:{global:'KaretaAssistantPages',render:'renderAssistant',mount:'mountAssistant'},
    diagnostics:{global:'KaretaDiagnosticsPages',render:'renderDiagnostics',mount:'mountDiagnostics'},
    services:{global:'KaretaServicesPages',render:'renderServices',mount:'mountServices'},
    news:{global:'KaretaNewsPages',render:'renderNews',mount:'mountNews'},
    masterNews:{global:'KaretaNewsPages',render:'renderMasterNews',mount:'mountMasterNews'},
    masterNewsCreate:{global:'KaretaNewsPages',render:'renderMasterNewsCreate',mount:'mountMasterNewsEditor'},
    masterNewsEdit:{global:'KaretaNewsPages',render:'renderMasterNewsEdit',mount:'mountMasterNewsEditor'},
    works:{global:'KaretaWorkFeedPages',render:'renderWorks',mount:'mountWorks'},
    community:{global:'KaretaCommunityPages',render:'renderCommunity',mount:'mountCommunity'},
    masterExchange:{global:'KaretaWorkFeedPages',render:'renderExchange',mount:'mountExchange'},
    profile:{global:'KaretaProfileRelationsPages',render:'renderProfile',mount:'mountProfile'},
    following:{global:'KaretaFollowingPages',render:'renderFollowing',mount:'mountFollowing'},
    realWorks:{global:'KaretaWorkFeedPages',render:'renderRealWorks',mount:'mountRealWorks'},
    workDetail:{global:'KaretaWorkFeedPages',render:'renderWorkDetail',mount:'mountWorkDetail'},
    serviceManagement:{global:'KaretaServiceManagementPages',render:'renderServiceManagement',mount:'mountServiceManagement'},
    masters:{global:'KaretaMastersPages',render:'renderMasters',mount:'mountMasters'},
    masterOnboarding:{global:'KaretaMasterOnboardingPages',render:'renderMasterOnboarding',mount:'mountMasterOnboarding'},
    masterProfileOwner:{global:'KaretaMasterProfileOwnerPages',render:'renderMasterProfileOwner',mount:'mountMasterProfileOwner'},
    masterWallOwner:{global:'KaretaMasterWallPages',render:'renderMasterWall',mount:'mountMasterWall'},
    masterWorks:{global:'KaretaMasterWorksPages',render:'renderMasterWorks',mount:'mountMasterWorks'},
    masterReviews:{global:'KaretaMasterReviewsPages',render:'renderMasterReviews',mount:'mountMasterReviews'},
    masterDashboard:{global:'KaretaMasterWorkplacePages',render:'renderMasterWorkplace',mount:'mountMasterWorkplace'},
    masterSchedule:{global:'KaretaMasterSchedulePages',render:'renderMasterSchedule',mount:'mountMasterSchedule'},
    stoDashboard:{global:'KaretaStoWorkplacePages',render:'renderStoWorkplace',mount:'mountStoWorkplace'},
    parts:{global:'KaretaPartsPages',render:'renderParts',mount:'mountParts'},
    usedParts:{global:'KaretaPartsPages',render:'renderParts',mount:'mountParts'},
    seller:{global:'KaretaSellerPages',render:'renderSeller',mount:'mountSeller'},
    sellerProducts:{global:'KaretaSellerPages',render:'renderProducts',mount:'mountSeller'},
    sellerOrders:{global:'KaretaSellerPages',render:'renderOrders',mount:'mountSeller'},
    orders:{global:'KaretaOrdersPages',render:'renderOrders',mount:'mountOrders'},
    requestNew:{global:'KaretaRequestPages',render:'renderRequest',mount:'mountRequest'},
    workflow:{global:'KaretaWorkflowPages',render:'renderWorkflow',mount:'mountWorkflow'},
    workOrder:{global:'KaretaWorkOrderPages',render:'renderWorkOrder',mount:'mountWorkOrder'},
    vehicle:{global:'KaretaVehiclePages',render:'renderVehicle',mount:'mountVehicle'},
    chats:{global:'KaretaChatsPages',render:'renderChats',mount:'mountChats'},
    notifications:{global:'KaretaNotificationsPages',render:'renderNotifications',mount:'mountNotifications'},
    cabinet:{global:'KaretaCabinetPages',render:'renderCabinet',mount:'mountCabinet'},
    cabinetGarage:{global:'KaretaCabinetPages',render:'renderGarage',mount:'mountGarage'},
    cabinetData:{global:'KaretaCabinetPages',render:'renderData',mount:'mountData'},
    cabinetHistory:{global:'KaretaCabinetPages',render:'renderHistory',mount:'mountHistory'},
    cabinetDocuments:{global:'KaretaCabinetPages',render:'renderDocuments',mount:'mountDocuments'},
    cabinetPromos:{global:'KaretaCabinetPages',render:'renderPromos',mount:'mountPromos'},
    cabinetTariff:{global:'KaretaCabinetPages',render:'renderTariff',mount:'mountTariff'},
    cabinetSettings:{global:'KaretaCabinetPages',render:'renderSettings',mount:'mountSettings'},
    about:{global:'KaretaInfoPages',render:'renderAbout'},
    rules:{global:'KaretaInfoPages',render:'renderRules'},
    help:{global:'KaretaInfoPages',render:'renderHelp'},
    privacy:{global:'KaretaInfoPages',render:'renderPrivacy'},
    contacts:{global:'KaretaInfoPages',render:'renderContacts'},
    lawyer:{global:'KaretaInfoPages',render:'renderLawyer',mount:'mountLawyer'},
    towTruck:{global:'KaretaInfoPages',render:'renderTowTruck',mount:'mountTowTruck'},
    productDetail:{global:'KaretaDetailPages',render:'renderProduct',mount:'mountProduct'},
    serviceDetail:{global:'KaretaDetailPages',render:'renderService',mount:'mountService'},
    providerDetail:{global:'KaretaDetailPages',render:'renderProvider',mount:'mountProvider'},
    providerBooking:{global:'KaretaDetailPages',render:'renderProviderBooking',mount:'mountProviderBooking'},
    providerReviews:{global:'KaretaMasterReviewsPages',render:'renderProviderReviews',mount:'mountProviderReviews'},
  });

  function invokePage(routeKey,phase,context){
    const binding=PAGE_BINDINGS[routeKey];
    if(!binding)throw new Error(`No page binding for route: ${routeKey}`);
    const module=window[binding.global];
    if(!module)throw new Error(`${binding.global} is unavailable for route ${routeKey}`);
    const methodName=phase==='mount'?binding.mount:binding.render;
    if(!methodName)return phase==='render'?'':undefined;
    const method=module[methodName];
    if(typeof method!=='function')throw new Error(`${binding.global}.${methodName} is unavailable for route ${routeKey}`);
    const args=phase==='render'&&Array.isArray(binding.renderArgs)?[...binding.renderArgs,context]:[context];
    return method.apply(module,args);
  }

  const PAGE_RENDERERS = Object.freeze(Object.fromEntries(
    Object.keys(PAGE_BINDINGS).map(key=>[key,context=>invokePage(key,'render',context)])
  ));
  const PAGE_MOUNTS = Object.freeze(Object.fromEntries(
    Object.entries(PAGE_BINDINGS).filter(([,binding])=>!!binding.mount).map(([key])=>[key,context=>invokePage(key,'mount',context)])
  ));

  const ROUTES = Object.freeze(Object.fromEntries(
    Object.entries(routeRegistry.routes).map(([key, meta]) => [key, Object.freeze({
      ...meta,
      render:PAGE_RENDERERS[key],
    })])
  ));



  const state = {
    routeKey:'home',
    routeParams:{},
    shellMountCount:0,
    outletRenderCount:0,
    apiSnapshot:null,
    session:null,
    user:null,
    bootGuardSnapshot:null,
    bootRouteWarmup:null,
  };

  function qs(selector, scope = document){
    return scope.querySelector(selector);
  }


  function resolveAppRoute(routeKey){
    const gate=window.KaretaMasterOnboardingGate;
    const requested=routeRegistry.has(routeKey) ? routeKey : '';
    if (gate?.shouldOwnRoute?.(requested)) return gate.resolveRoute(requested);
    const identityMode=window.KaretaIdentity?.snapshot?.()?.mode==='identity';
    const base=identityMode ? (window.KaretaNavigationCore?.resolveRoute?.(requested)||requested) : roleAccess.resolve(requested);
    return gate?.resolveRoute?.(base) || base;
  }
  function routeKeyFromHash(hashValue){ return resolveAppRoute(routeRegistry.keyFromHash(hashValue)); }

  function updateActiveNav(){
    if (window.KaretaShellNav) window.KaretaShellNav.setActive(state.routeKey);
  }

  function bindSmartShellHeader(){
    const header = qs('#k-shell-header');
    if (!header || header.dataset.smartScrollBound === '1') return true;

    header.dataset.smartScrollBound = '1';
    const positions = new WeakMap();
    let windowY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    let touchY = null;
    let ticking = false;
    let pendingTarget = window;

    const show = () => {
      header.classList.remove('is-scroll-hidden');
      header.classList.add('is-scroll-visible');
      header.setAttribute('data-scroll-state', 'visible');
    };

    const hide = () => {
      header.classList.remove('is-scroll-visible');
      header.classList.add('is-scroll-hidden');
      header.setAttribute('data-scroll-state', 'hidden');
    };

    const readScrollTop = target => {
      if (!target || target === window || target === document || target === document.documentElement || target === document.body) {
        return Math.max(0, window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0);
      }
      return Math.max(0, Number(target.scrollTop) || 0);
    };

    const previousFor = target => {
      if (!target || target === window || target === document || target === document.documentElement || target === document.body) return windowY;
      return positions.has(target) ? positions.get(target) : readScrollTop(target);
    };

    const remember = (target, value) => {
      if (!target || target === window || target === document || target === document.documentElement || target === document.body) windowY = value;
      else positions.set(target, value);
    };

    const update = () => {
      ticking = false;
      const target = pendingTarget;
      const currentY = readScrollTop(target);
      const lastY = previousFor(target);
      const delta = currentY - lastY;
      const headerHeight = Math.max(56, header.offsetHeight || 0);
      const menuOpen = document.body.classList.contains('k-menu-open')
        || qs('#k-menu-toggle')?.getAttribute('aria-expanded') === 'true';

      if (menuOpen || currentY <= 8) {
        show();
      } else if (delta < -0.5) {
        show();
      } else if (delta > 4 && currentY > headerHeight + 16) {
        hide();
      }

      remember(target, currentY);
    };

    const scheduleUpdate = target => {
      pendingTarget = target || window;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    document.addEventListener('scroll', event => scheduleUpdate(event.target), { passive:true, capture:true });
    window.addEventListener('scroll', () => scheduleUpdate(window), { passive:true });

    document.addEventListener('wheel', event => {
      if (event.deltaY < 0) show();
    }, { passive:true, capture:true });

    document.addEventListener('touchstart', event => {
      touchY = event.touches && event.touches[0] ? event.touches[0].clientY : null;
    }, { passive:true, capture:true });
    document.addEventListener('touchmove', event => {
      const y = event.touches && event.touches[0] ? event.touches[0].clientY : null;
      if (touchY !== null && y !== null && y > touchY + 1) show();
      if (y !== null) touchY = y;
    }, { passive:true, capture:true });
    document.addEventListener('touchend', () => { touchY = null; }, { passive:true, capture:true });
    document.addEventListener('touchcancel', () => { touchY = null; }, { passive:true, capture:true });

    window.addEventListener('hashchange', show);
    window.addEventListener('pageshow', show);
    window.addEventListener('popstate', show);
    qs('#k-menu-toggle')?.addEventListener('click', show);
    qs('#k-menu-close')?.addEventListener('click', show);
    header.addEventListener('focusin', show);
    show();
    return true;
  }

  const routeLoadingText=value=>String(value||'').replace(/[<>&"']/g,char=>({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
  })[char]);
  const routeLoadingStageLabel=phase=>({
    start:'Подготавливаем раздел…',
    manifest:'Проверяем ресурсы…',
    assets:'Загружаем интерфейс…',
    bundle:'Собираем раздел…',
    ready:'Готово'
  })[String(phase||'')]||'Загружаем раздел…';
  function routeLoadingHtml(route){
    const label=routeLoadingText(route?.label||'раздел');
    return `<section class="k-page k-route-loading" data-route-loading aria-busy="true" aria-live="polite" aria-label="Загрузка: ${label}">
      <div class="k-route-loading__head">
        <span class="k-route-loading__spinner" aria-hidden="true"></span>
        <div><strong>Загрузка: ${label}</strong><small data-route-loading-label>Подготавливаем раздел…</small></div>
      </div>
      <div class="k-route-loading__progress" data-route-loading-progress role="progressbar" aria-label="Прогресс загрузки раздела" aria-valuemin="0" aria-valuemax="100" aria-valuenow="4" style="--k-route-progress:4%"><i aria-hidden="true"></i></div>
      <div class="k-route-skeleton" aria-hidden="true">
        <span class="k-route-skeleton__title"></span>
        <span class="k-route-skeleton__line"></span>
        <span class="k-route-skeleton__line k-route-skeleton__line--short"></span>
        <div class="k-route-skeleton__grid"><i></i><i></i><i></i><i></i></div>
      </div>
    </section>`;
  }
  function updateRouteLoadingProgress(outlet,routeKey,routeToken,detail={}){
    if(!outlet||outlet.getAttribute('data-current-route')!==String(routeKey||''))return;
    if(outlet.getAttribute('data-route-token')!==String(routeToken))return;
    if(outlet.getAttribute('data-route-assets-loading')!=='1')return;
    const percent=Math.max(0,Math.min(100,Math.round(Number(detail.percent)||0)));
    const progress=outlet.querySelector('[data-route-loading-progress]');
    if(progress){
      progress.setAttribute('aria-valuenow',String(percent));
      progress.style.setProperty('--k-route-progress',`${percent}%`);
    }
    const label=outlet.querySelector('[data-route-loading-label]');
    if(label)label.textContent=routeLoadingStageLabel(detail.phase);
  }
  function routeLoadErrorHtml(route,error){
    const label=String(route?.label||'раздел');
    const message=String(error?.message||'Не удалось загрузить файлы раздела').replace(/[<>&]/g,'');
    return `<section class="k-page k-route-load-error"><div class="k-empty"><h1>${label} временно недоступен</h1><p>${message}</p><button type="button" class="k-btn k-btn-primary" data-next-action="route-assets-retry">Повторить</button></div></section>`;
  }

  function renderResolvedRoute(key,route,outlet,lifecycle){
    if(lifecycle.isActive?.()===false)return false;
    const renderToken=bootProfiler?.start?.('route.render',{route:key,source:String(lifecycle?.source||'render')});
    const context={state,route,api:apiClient,lifecycle,appVersion:APP_VERSION};
    const html=route.render(context);
    outlet.innerHTML=html;
    outlet.setAttribute('data-current-route',key);
    outlet.setAttribute('data-route-token',String(state.routeParams.token));
    outlet.removeAttribute('data-route-assets-loading');
    outlet.focus({preventScroll:true});
    updateActiveNav();

    const mount=PAGE_MOUNTS[key];
    if(typeof mount==='function'&&lifecycle.isActive?.()!==false){
      const unmount=mount(context);
      if(typeof unmount==='function')lifecycle.addCleanup?.(unmount);
    }
    try{window.KaretaNavigationState?.restore?.(location.hash,{replayActive:true});}catch(_error){}
    bootProfiler?.end?.(renderToken,{ok:true,route:key});
    const firstRender=bootProfiler?.markOnce?.('first-render',{route:key,source:String(lifecycle?.source||'render')});
    if(firstRender&&typeof window.requestAnimationFrame==='function'){
      window.requestAnimationFrame(()=>bootProfiler?.markOnce?.('first-frame',{route:key}));
    }
    return true;
  }

  function renderRoute(routeKey, lifecycle = {}){
    const requested=ROUTES[routeKey]?routeKey:'';
    const key=resolveAppRoute(requested);
    const route=ROUTES[key];
    const outlet=qs('#k-page-outlet');
    if(!outlet||!route)return;

    state.routeKey=key;
    state.routeParams={token:Number(lifecycle.token||0),source:String(lifecycle.source||'render')};
    state.outletRenderCount+=1;

    if(!routeAssetLoader.isKnownLazy?.(key)||routeAssetLoader.isRouteReady?.(key)){
      renderResolvedRoute(key,route,outlet,lifecycle);
      return;
    }

    outlet.setAttribute('data-current-route',key);
    outlet.setAttribute('data-route-token',String(state.routeParams.token));
    outlet.setAttribute('data-route-assets-loading','1');
    outlet.innerHTML=routeLoadingHtml(route);
    updateRouteLoadingProgress(outlet,key,state.routeParams.token,{phase:'start',percent:4});
    updateActiveNav();

    routeAssetLoader.ensureRoute(key,{
      signal:lifecycle.signal,
      onProgress:detail=>updateRouteLoadingProgress(outlet,key,state.routeParams.token,detail)
    }).then(()=>{
      if(lifecycle.isActive?.()===false)return;
      renderResolvedRoute(key,route,outlet,lifecycle);
    }).catch(error=>{
      if(lifecycle.isActive?.()===false||error?.name==='AbortError')return;
      console.error('[KARETA route assets]',{route:key,error});
      outlet.removeAttribute('data-route-assets-loading');
      outlet.innerHTML=routeLoadErrorHtml(route,error);
      try{window.KaretaRuntimeLog?.add?.('route.assets.failed',{route:key,message:String(error?.message||error)},'error');}catch(_error){}
    });
  }

  function registerActions(){
    // Lightweight core action: service cards can open Request without forcing the
    // full Services module to be a boot dependency.
    routeRuntime.onAction('service-booking',({node})=>{
      const name=node?.dataset?.serviceName||'Выбранная услуга';
      try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:name,serviceId:node?.dataset?.serviceId||'',source:'services_catalog'}));}catch(_error){}
      if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
    });
    routeRuntime.onAction('route-assets-retry',()=>routeRuntime.transition(state.routeKey,{source:'route-assets-retry',force:true}));
  }


  async function warmSession(){
    const sessionWaveToken=bootProfiler?.start?.('session.wave');
    preloader?.update?.(48, 'Проверка сессии…', { step:1 });

    // R188.5.5.6.84.82: DB/version probe, Identity current session and legacy
    // compatibility session are independent reads. Running them in series added
    // several avoidable network round-trips to every cold start.
    let identityError = null;
    const guardPromise=profilePromise('session.guard',Promise.resolve(window.KaretaProductionGuard?.check?.({fast:true})),{kind:'db-version'}).catch(()=>null);
    const identityPromise=profilePromise('session.identity',Promise.resolve(window.KaretaIdentity?.load?.({force:true})),{kind:'identity-current'})
      .then(value=>({value,error:null}))
      .catch(error=>({value:null,error}));
    const legacyPromise=profilePromise('session.legacy',Promise.resolve(apiClient.getSession()),{kind:'legacy-session'})
      .then(value=>({value,error:null}))
      .catch(error=>({value:null,error}));

    const [guard,identityResult,legacyResult]=await Promise.all([guardPromise,identityPromise,legacyPromise]);
    state.bootGuardSnapshot=guard||null;
    const identity=identityResult?.value||null;
    identityError=identityResult?.error||null;
    if(identityError && ![401,409].includes(Number(identityError?.status||0))) console.warn('[KARETA identity frontend]', identityError);
    const sessionResult=legacyResult?.value||null;
    if(legacyResult?.error) console.error('[KARETA legacy session]', legacyResult.error);

    preloader?.update?.(60, 'Проверка контекста и прав…', { step:2 });
    state.session = sessionResult?.payload || null;
    state.user = sessionResult?.payload?.user || null;
    state.runtimeDegraded = !sessionResult?.ok || guard?.dbReady===false || sessionResult?.payload?.dbReady===false;
    state.identityReady = Boolean(identity?.authenticated);
    state.identityError = identityError?.message || '';
    state.identity = identity?.authenticated ? identity : null;

    const resumeHint = window.KaretaSessionResume?.hint?.() || null;
    const identityStatus = Number(identityError?.status || identityError?.httpStatus || 0);
    const identityTransient = Boolean(identityError) && (!identityStatus || [408,425,429,500,502,503,504].includes(identityStatus) || navigator.onLine === false);
    const mode = state.identityReady ? 'identity' : (state.user ? 'legacy-fallback' : (identityTransient && resumeHint ? 'resume-degraded' : 'anonymous'));
    const activeRole = state.identityReady
      ? (identity?.compatibilityRole || 'client')
      : (identityTransient && resumeHint?.role ? resumeHint.role : (state.user?.role || ''));
    document.documentElement.dataset.identityMode = mode;
    if (activeRole) document.documentElement.dataset.userRole = roleAccess.normalizeRole?.(activeRole) || String(activeRole).toLowerCase();
    else delete document.documentElement.dataset.userRole;

    if (state.identityReady) {
      state.context = identity.context;
      state.capabilities = identity.capabilities || [];
      const compatibilityRole = identity.compatibilityRole || 'client';
      roleAccess.clearLegacyOverride?.();
      preloader?.role?.(compatibilityRole);
      try { window.dispatchEvent(new CustomEvent('kareta:session-confirmed', { detail:{ user:state.user, identity, context:identity.context, capabilities:identity.capabilities, result:sessionResult?.payload || sessionResult } })); } catch (_error) {}
    } else if (state.user) {
      state.context = null;
      state.capabilities = [];
      roleAccess.refresh(state.user.role || 'client');
      preloader?.role?.(state.user.role || 'client');
      try { window.dispatchEvent(new CustomEvent('kareta:session-confirmed', { detail:{ user:state.user, legacy:true, identityError:state.identityError, result:sessionResult?.payload || sessionResult } })); } catch (_error) {}
    } else {
      state.context = null;
      state.capabilities = [];
      if (identityTransient && resumeHint) {
        document.documentElement.dataset.sessionResume = 'degraded';
        preloader?.role?.(resumeHint.role || 'client');
        try { window.dispatchEvent(new CustomEvent('kareta:session-degraded', { detail:{ identityError:state.identityError, resumeHint, route:String(location.hash || '') } })); } catch (_error) {}
      } else {
        try { window.dispatchEvent(new CustomEvent('kareta:session-anonymous', { detail:{ identityError:state.identityError } })); } catch (_error) {}
      }
    }
    bootProfiler?.end?.(sessionWaveToken,{ok:true,mode});
    return { identity, legacy:sessionResult, guard, mode };
  }

  function startInitialRouteWarmup(){
    const requested=routeRegistry.keyFromHash(location.hash);
    const key=routeRegistry.has(requested)?requested:'';
    if(!key||!routeAssetLoader.isKnownLazy?.(key)||routeAssetLoader.isRouteReady?.(key)){
      state.bootRouteWarmup=null;
      return null;
    }
    const promise=profilePromise('route.assets.prewarm',routeAssetLoader.ensureRoute(key),{route:key,phase:'prewarm'}).then(
      result=>({ok:true,result,error:null}),
      error=>({ok:false,result:null,error})
    );
    const warmup={key,promise,startedAt:Date.now()};
    state.bootRouteWarmup=warmup;
    try{window.KaretaRuntimeLog?.add?.('boot.route_warmup.started',{route:key},'info');}catch(_error){}
    return warmup;
  }

  async function ensureInitialRouteReady(routeKey){
    const key=String(routeKey||'');
    if(!routeAssetLoader.isKnownLazy?.(key)||routeAssetLoader.isRouteReady?.(key))return true;
    const warmup=state.bootRouteWarmup;
    if(warmup?.key===key&&warmup.promise){
      const warmed=await warmup.promise;
      if(warmed?.ok&&routeAssetLoader.isRouteReady?.(key)){
        try{window.KaretaRuntimeLog?.add?.('boot.route_warmup.reused',{route:key,elapsedMs:Math.max(0,Date.now()-Number(warmup.startedAt||Date.now()))},'info');}catch(_error){}
        return true;
      }
    }
    await profilePromise('route.assets.final',routeAssetLoader.ensureRoute(key),{route:key,phase:'final'});
    return true;
  }

  async function hydrateApiSnapshot(){
    // Identity/context is authoritative for protected aggregate reads. A legacy
    // PHP user can exist briefly while Identity is still anonymous/degraded; in
    // that window /api/db.php?action=pull correctly returns 409. Do not issue it.
    if(!state.identity?.authenticated){
      const skipped={ok:true,status:204,skipped:true,reason:state.runtimeDegraded?'runtime_degraded':'identity_not_ready',payload:{}};
      state.apiSnapshot=skipped;
      window.dispatchEvent(new CustomEvent('kareta:api-snapshot-skipped',{detail:skipped}));
      return skipped;
    }
    let dataResult = null;
    try { dataResult = await apiClient.getState(); }
    catch (error) { console.error('[KARETA state]', error); }
    if (!dataResult?.ok) {
      state.runtimeDegraded = true;
      dataResult = { ok:false, status:dataResult?.status || 0, payload:{ users:[], masters:[], services:[], parts:[], orders:[], chats:[], news:[], workPosts:[] } };
      window.dispatchEvent(new CustomEvent('kareta:runtime-degraded', { detail:{ source:'pull', status:dataResult.status } }));
    }
    state.apiSnapshot = dataResult;
    // Catalog state is route-lazy from R188.5.5.6.84.67. If Services has already
    // been opened we can hydrate it from the global snapshot; otherwise the route
    // module will load its own catalog on demand.
    window.KaretaCatalogState?.hydrate?.(dataResult?.payload);
    window.dispatchEvent(new CustomEvent('kareta:api-snapshot', { detail:dataResult }));
    return dataResult;
  }

  function scheduleApiSnapshot(){
    if(!state.identity?.authenticated){
      hydrateApiSnapshot();
      return false;
    }
    const run = () => hydrateApiSnapshot().catch(error => console.error('[KARETA snapshot]', error));
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout:1800 });
    } else {
      window.setTimeout(run, 250);
    }
    return true;
  }

  function audit(){
    const shell = qs('#k-app');
    const outlet = qs('#k-page-outlet');
    const desktop = qs('#k-desktop-nav');
    const mobile = qs('#k-mobile-nav');
    const oldBundles = Array.from(document.querySelectorAll('link[href],script[src]')).filter(el => {
      const value = String(el.getAttribute('href') || el.getAttribute('src') || '');
      return /client_app_bundle|legacy_responsive_bundle|staff_ui_bundle|\/js\/app\.js/.test(value);
    });

    const result = {
      ok:!!(shell && outlet && desktop && mobile && oldBundles.length === 0),
      shell:!!shell,
      outlet:!!outlet,
      desktopNav:!!desktop,
      mobileNav:!!mobile,
      oldBundles:oldBundles.map(el => el.getAttribute('href') || el.getAttribute('src')),
      shellMountCount:state.shellMountCount,
      shellNav:window.KaretaShellNav ? window.KaretaShellNav.audit() : null,
      routeRuntime:routeRuntime.audit(),
      routeAssets:routeAssetLoader.audit?.() || null,
      apiClient:!!window.KaretaApiClient,
      outletRenderCount:state.outletRenderCount,
      route:state.routeKey,
      roleAccess:roleAccess.audit(),
      version:APP_VERSION,
      at:Date.now(),
    };

    window.KaretaNextAudit = result;
    return result;
  }


  async function clearRuntimeCaches(){
    try {
      if ('caches' in window) {
        const keys=await caches.keys();
        await Promise.all(keys.filter(key=>String(key).startsWith('kareta-')).map(key=>caches.delete(key)));
      }
    } catch (_error) {}
    try { apiClient.invalidate?.(); } catch (_error) {}
  }

  function serviceWorkerControllerVersion(){
    try{
      const src=String(navigator.serviceWorker?.controller?.scriptURL||'');
      if(!src)return '';
      return String(new URL(src,location.href).searchParams.get('v')||'');
    }catch(_error){return '';}
  }

  async function resetServiceWorkerRuntime(reason,expectedVersion){
    const expected=String(expectedVersion||APP_VERSION||'');
    const key=`kareta.runtime.reconcile:${reason}:${expected}`;
    if(sessionStorage.getItem(key)==='1') return false;
    sessionStorage.setItem(key,'1');
    await clearRuntimeCaches();
    try{
      const regs=await navigator.serviceWorker?.getRegistrations?.()||[];
      await Promise.all(regs.map(reg=>reg.unregister().catch(()=>false)));
    }catch(_error){}
    try{window.KaretaRuntimeLog?.add?.('runtime.version.reconcile',{reason,appVersion:APP_VERSION,expectedVersion:expected,controllerVersion:serviceWorkerControllerVersion(),automaticReload:false},'warn');}catch(_error){}
    const message=`Доступна другая версия приложения (${expected}). Нажмите «Повторить», чтобы синхронизировать файлы.`;
    if(window.KaretaBootRecovery?.fail)await window.KaretaBootRecovery.fail(`version:${reason}:${APP_VERSION}:${expected}`);
    else preloader?.fail?.(new Error(message));
    return false;
  }

  async function verifyRuntimeVersion(){
    // R188.5.5.6.84.84: version parity reuses the public DB probe already executed
    // by ProductionGuard inside warmSession. A second awaited ping here created a
    // serial network waterfall before session hydration on every cold start.
    const guard=state.bootGuardSnapshot||window.KaretaProductionGuard?.snapshot?.()?.snapshot||null;
    const serverVersion=String(guard?.assetVersion||'');
    if(serverVersion&&serverVersion!==APP_VERSION){
      return resetServiceWorkerRuntime('server-app-mismatch',serverVersion);
    }
    const controllerVersion=serviceWorkerControllerVersion();
    if(controllerVersion&&controllerVersion!==APP_VERSION){
      // A stale controller is not a broken document. Assets are versioned and
      // fetched network-first, so forcing a page reload here made deploys boot
      // twice. The current worker is reconciled after the UI is ready.
      window.KaretaRuntimeLog?.add?.('runtime.sw.handoff_pending',{
        appVersion:APP_VERSION,controllerVersion
      },'warn');
    }
    return true;
  }

  let serviceWorkerRegistrationFlight=null;
  async function registerCurrentServiceWorker(){
    if(!('serviceWorker' in navigator)) return null;
    if(serviceWorkerRegistrationFlight) return serviceWorkerRegistrationFlight;
    serviceWorkerRegistrationFlight=(async()=>{
      const beforeVersion=serviceWorkerControllerVersion();
      let controllerChanged=false;
      const onControllerChange=()=>{
        controllerChanged=true;
        const controllerVersion=serviceWorkerControllerVersion();
        try{sessionStorage.setItem(`kareta.sw.controller:${APP_VERSION}`,controllerVersion||APP_VERSION);}catch(_error){}
        window.KaretaRuntimeLog?.add?.('runtime.sw.controller_changed',{
          appVersion:APP_VERSION,beforeVersion,controllerVersion,reload:false
        },'info');
      };
      navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);
      try{
        const registration=await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`, {scope:'/',updateViaCache:'none'});
        const nudge=worker=>{
          if(worker && worker.state==='installed')worker.postMessage({type:'KARETA_SKIP_WAITING'});
        };
        if(registration.waiting)nudge(registration.waiting);
        registration.addEventListener('updatefound',()=>{
          const worker=registration.installing;
          worker?.addEventListener('statechange',()=>nudge(worker));
        });
        await registration.update().catch(()=>null);
        if(registration.waiting)nudge(registration.waiting);

        // Give an installing worker a short chance to claim this page. A
        // controller change never reloads the already-correct document.
        if(beforeVersion && beforeVersion!==APP_VERSION && !controllerChanged){
          await new Promise(resolve=>setTimeout(resolve,1200));
        }
        window.KaretaRuntimeLog?.add?.('runtime.sw.reconciled',{
          appVersion:APP_VERSION,beforeVersion,controllerVersion:serviceWorkerControllerVersion(),controllerChanged
        },'info');
        return registration;
      }finally{
        navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
      }
    })().finally(()=>{serviceWorkerRegistrationFlight=null;});
    return serviceWorkerRegistrationFlight;
  }

  let bootPromise = null;
  let bootCompleted = false;
  let primaryPrefetchScheduled=false;

  function schedulePrimaryRoutePrefetch(){
    if(primaryPrefetchScheduled||!routeAssetLoader.prefetchRoute)return;
    primaryPrefetchScheduled=true;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
    if(connection?.saveData||/^(?:slow-2g|2g)$/i.test(String(connection?.effectiveType||'')))return;
    const run=async()=>{
      for(const key of ['parts','masters','community']){
        if(state.routeKey===key||routeAssetLoader.isRouteReady?.(key))continue;
        try{await routeAssetLoader.prefetchRoute(key);}catch(_error){}
      }
    };
    if('requestIdleCallback' in window)window.requestIdleCallback(()=>run(),{timeout:2500});
    else window.setTimeout(()=>run(),700);
  }

  async function prepareShellNavigation(activeKey){
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    for(let attempt=0;attempt<20;attempt+=1){
      const nav=window.KaretaShellNav;
      const desktop=document.getElementById('k-desktop-nav');
      const mobile=document.getElementById('k-mobile-nav');
      if(nav?.mount&&desktop&&mobile){
        try{if(nav.mount({activeKey}))return nav;}catch(_error){}
      }
      await sleep(50);
    }
    return null;
  }

  async function bootInternal(){
    const bootToken=bootProfiler?.start?.('boot.total',{version:APP_VERSION,route:String(location.hash||'#/home')});
    try {
      // Route resolution happens before warmSession for the shell. Treat that phase
      // as anonymous so a stale cached master/STO role cannot mount a protected page.
      if(!document.documentElement.dataset.identityMode) document.documentElement.dataset.identityMode='booting';
      if(preloader?.isVisible?.()) preloader.update(40,'Подготовка интерфейса…',{step:0});
      else preloader?.show?.({ progress:40, status:'Подготовка интерфейса…' });
      const shellNav=await prepareShellNavigation(routeKeyFromHash(location.hash));
      if(!shellNav)throw new Error('Не удалось подготовить меню приложения.');
      state.shellMountCount = shellNav.getState().mountCount;
      const bindShellMenu=()=>{
        try{return window.KaretaShellMenu?.bind?.()===true;}catch(_error){return false;}
      };
      if(!bindShellMenu()){
        const lateBind=()=>{if(bindShellMenu())window.removeEventListener('kareta:runtime-module-reloaded',lateBind);};
        window.addEventListener('kareta:runtime-module-reloaded',lateBind);
        window.addEventListener('kareta:identity-ready',lateBind,{once:true});
        window.setTimeout(lateBind,250);
        window.setTimeout(lateBind,1000);
        window.KaretaRuntimeLog?.add?.('shell.menu.deferred',{release:APP_VERSION},'warn');
      }
      if (!bindSmartShellHeader()) throw new Error('Не удалось подготовить поведение верхней панели.');
      bootProfiler?.markOnce?.('shell-ready');

      preloader?.update?.(44, 'Подготовка навигации…', { step:0 });
      routeRuntime.bind({
        render:renderRoute,
        hasRoute:key => !!ROUTES[key],
        resolveRoute:key => resolveAppRoute(key),
      });
      registerActions();
      bootProfiler?.markOnce?.('router-ready');

      // Static route assets can load while the independent session/DB reads are in
      // flight. No protected data is fetched here; only release-scoped CSS/JS.
      startInitialRouteWarmup();
      await warmSession();
      bootProfiler?.markOnce?.('session-ready',{mode:String(document.documentElement.dataset.identityMode||'')});
      if (!(await profilePromise('version.verify',verifyRuntimeVersion(),{kind:'asset-sw-parity'}))) {
        bootProfiler?.end?.(bootToken,{ok:false,reason:'version-parity'});
        bootProfiler?.report?.({route:String(location.hash||'#/home'),status:'blocked',error:'version-parity'});
        return;
      }
      await profilePromise('onboarding.gate',Promise.resolve(window.KaretaMasterOnboardingGate?.check?.({ redirect:false, source:'app-boot' })),{source:'app-boot'}).catch(()=>null);
      const targetRoute = routeKeyFromHash(location.hash);
      if(routeAssetLoader.isKnownLazy?.(targetRoute) && !routeAssetLoader.isRouteReady?.(targetRoute)){
        preloader?.update?.(68, 'Загрузка интерфейса…', {step:3});
        await ensureInitialRouteReady(targetRoute);
      }
      bootProfiler?.markOnce?.('route-assets-ready',{route:targetRoute});
      routeRuntime.transition(targetRoute, { source:'boot' });
      if (state.user || state.identity?.authenticated) {
        window.KaretaShellNav?.refresh?.({ role:roleAccess.currentRole(), activeKey:targetRoute });
        window.KaretaShellMenu?.render?.(roleAccess.currentRole());
        updateActiveNav();
      }
      preloader?.update?.(82, 'Интерфейс подготовлен', { step:4 });
      scheduleApiSnapshot();
      preloader?.update?.(90, 'Проверка обновлений…', { step:6 });
      // Service Worker reconciliation is intentionally detached from the visible
      // boot. Installing/claiming a worker must never restart or delay the 0→100 pass.

      preloader?.update?.(96, 'Запуск интерфейса…', { step:7 });
      window.KaretaNext = Object.assign(window.KaretaNext || {}, {
        boot,
        audit,
        renderRoute,
        updateActiveNav,
        state,
        routes:ROUTES,
        api:apiClient,
      });
      bootCompleted = true;
      bootProfiler?.markOnce?.('interactive',{route:targetRoute,degraded:state.runtimeDegraded===true});
      bootProfiler?.end?.(bootToken,{ok:true,route:targetRoute,degraded:state.runtimeDegraded===true});
      preloader?.complete?.(state.runtimeDegraded ? 'Приложение запущено в ограниченном режиме' : 'Добро пожаловать!');
      bootProfiler?.scheduleReport?.({route:targetRoute});
      window.setTimeout(()=>{registerCurrentServiceWorker().catch(()=>null);schedulePrimaryRoutePrefetch();window.KaretaProductionGuard?.check?.({force:true}).catch(()=>null);},0);
    } catch (error) {
      const bootError=String(error?.message||error||'boot_failed');
      bootProfiler?.end?.(bootToken,{ok:false,error:bootError});
      bootProfiler?.report?.({route:String(location.hash||'#/home'),status:'failed',error:bootError});
      console.error('[KARETA boot]', error);
      preloader?.fail?.(error);
    }
  }

  function boot(){
    if (bootCompleted) return Promise.resolve(window.KaretaNext);
    if (bootPromise) return bootPromise;
    bootPromise = bootInternal().finally(() => {
      if (!bootCompleted) bootPromise = null;
    });
    return bootPromise;
  }

  window.KaretaNext = Object.assign(window.KaretaNext || {}, {
    boot,
    audit,
    state,
    routes:ROUTES,
    api:apiClient,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
