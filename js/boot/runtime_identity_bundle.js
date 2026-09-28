/* KARETA R188.5.5.6.84.85 GENERATED BOOT BUNDLE — source order preserved. */
window.KaretaBootProfiler?.bundleStart?.("runtime_identity_bundle","js/boot/runtime_identity_bundle.js");

/* SOURCE: js/next/route_registry.js */
(() => {
  'use strict';

  const ROUTES = Object.freeze({
    home:Object.freeze({ path:'#/home', label:'Главная', icon:'⌂' }),
    platform:Object.freeze({ path:'#/platform', label:'Платформа', icon:'◆' }),
    corePlatform:Object.freeze({ path:'#/core', label:'Ядро', icon:'◉' }),
    calendarBooking:Object.freeze({ path:'#/calendar', label:'Календарь', icon:'▦' }),
    finance:Object.freeze({ path:'#/finance', label:'Финансы', icon:'₸' }),
    market:Object.freeze({ path:'#/market', label:'Marketplace', icon:'▣' }),
    crm:Object.freeze({ path:'#/crm', label:'CRM', icon:'◫' }),
    identityMigration:Object.freeze({ path:'#/admin/identity-migration', label:'Identity Migration', icon:'⇄', nav:false }),
    adminUsers:Object.freeze({ path:'#/admin/users', label:'Пользователи', icon:'users' }),
    adminOrganizations:Object.freeze({ path:'#/admin/organizations', label:'Организации', icon:'organization' }),
    adminMonitoring:Object.freeze({ path:'#/admin/monitoring', label:'Мониторинг', icon:'monitor' }),
    adminManagement:Object.freeze({ path:'#/admin/management', label:'Управление', icon:'settings' }),
    services:Object.freeze({ path:'#/services', label:'Услуги', icon:'⚙' }),
    news:Object.freeze({ path:'#/news', label:'Новости', icon:'◫', description:'Новости перенесены в Сообщество', nav:false }),
    masterNews:Object.freeze({ path:'#/master/news', label:'Мои новости', icon:'▤', nav:false }),
    masterNewsCreate:Object.freeze({ path:'#/master/news/create', label:'Создать новость', icon:'＋', nav:false }),
    masterNewsEdit:Object.freeze({ path:'#/master/news/edit', label:'Редактировать новость', icon:'✎', nav:false }),
    works:Object.freeze({ path:'#/works', label:'Сообщество', icon:'◎', description:'Новости, работы, товары и публикации KARETA.KZ' }),
    profile:Object.freeze({ path:'#/profile', label:'Профиль', icon:'☻', nav:false }),
    following:Object.freeze({ path:'#/following', label:'Мои подписки', icon:'◎', description:'Мастера, новости и работы из ваших подписок', nav:false }),
    realWorks:Object.freeze({ path:'#/real-works', label:'Реальные работы', icon:'▥', description:'Каталог выполненных ремонтов мастеров и СТО', nav:false }),
    workDetail:Object.freeze({ path:'#/works/item', label:'Работа', icon:'▥', nav:false }),
    serviceManagement:Object.freeze({ path:'#/services/manage', label:'Мои услуги', icon:'🧾' }),
    masters:Object.freeze({ path:'#/masters', label:'Мастера', icon:'👨‍🔧' }),
    masterOnboarding:Object.freeze({ path:'#/onboarding/master', label:'Настройка мастера', icon:'wrench', nav:false }),
    masterDashboard:Object.freeze({ path:'#/master', label:'Рабочее место', icon:'🧰' }),
    masterSchedule:Object.freeze({ path:'#/master/schedule', label:'Мой график', icon:'calendar', nav:false }),
    masterProfileOwner:Object.freeze({ path:'#/master/profile', label:'Мой профиль', icon:'☻', nav:false }),
    masterWallOwner:Object.freeze({ path:'#/master/wall', label:'Моя Стена', icon:'▤', nav:false }),
    masterWorks:Object.freeze({ path:'#/master/works', label:'Мои работы', icon:'▥', nav:false }),
    masterReviews:Object.freeze({ path:'#/master/reviews', label:'Отзывы', icon:'★', nav:false }),
    masterExchange:Object.freeze({ path:'#/master/exchange', label:'Биржа', icon:'⌁', nav:false }),
    community:Object.freeze({ path:'#/community', label:'Сообщество', icon:'◎', nav:false }),
    stoDashboard:Object.freeze({ path:'#/sto', label:'СТО', icon:'🏢' }),
    parts:Object.freeze({ path:'#/parts', label:'Новые запчасти', icon:'▣' }),
    usedParts:Object.freeze({ path:'#/parts/used', label:'Биржа БУ', icon:'exchange', nav:false }),
    seller:Object.freeze({ path:'#/seller', label:'Магазин', icon:'🛒' }),
    sellerProducts:Object.freeze({ path:'#/seller/products', label:'Товары', icon:'▣' }),
    sellerOrders:Object.freeze({ path:'#/seller/orders', label:'Заказы товаров', icon:'●' }),
    orders:Object.freeze({ path:'#/orders', label:'Заказы', icon:'●' }),
    workflow:Object.freeze({ path:'#/workflow', label:'Workflow', icon:'▦', nav:false }),
    requestNew:Object.freeze({ path:'#/orders/new', label:'Новая заявка', icon:'＋', nav:false }),
    workOrder:Object.freeze({ path:'#/orders/item', label:'Заказ-наряд', icon:'▤', nav:false }),
    vehicle:Object.freeze({ path:'#/garage/car', label:'Автомобиль', icon:'◈', nav:false }),
    chats:Object.freeze({ path:'#/chats', label:'Чаты', icon:'✉' }),
    notifications:Object.freeze({ path:'#/notifications', label:'Уведомления', icon:'bell', nav:false }),
    cabinet:Object.freeze({ path:'#/cabinet', label:'Кабинет', icon:'☻' }),
    cabinetGarage:Object.freeze({ path:'#/cabinet/garage', label:'Мой гараж', icon:'◈', nav:false }),
    cabinetData:Object.freeze({ path:'#/cabinet/data', label:'Мои данные', icon:'◎', nav:false }),
    cabinetHistory:Object.freeze({ path:'#/cabinet/history', label:'История', icon:'↺', nav:false }),
    cabinetDocuments:Object.freeze({ path:'#/cabinet/documents', label:'Документы', icon:'▤', nav:false }),
    cabinetPromos:Object.freeze({ path:'#/cabinet/promotions', label:'Мои акции', icon:'%', nav:false }),
    cabinetTariff:Object.freeze({ path:'#/cabinet/tariff', label:'Тариф', icon:'₸', nav:false }),
    cabinetSettings:Object.freeze({ path:'#/cabinet/settings', label:'Настройки', icon:'⚙', nav:false }),
    about:Object.freeze({ path:'#/about', label:'О платформе', icon:'ⓘ', description:'Возможности KARETA.KZ для каждой роли' }),
    rules:Object.freeze({ path:'#/rules', label:'Правила', icon:'✓', description:'Правила работы и ответственность участников' }),
    help:Object.freeze({ path:'#/help', label:'Помощь', icon:'?', description:'Ответы по услугам, товарам и заказам' }),
    notFound:Object.freeze({ path:'#/404', label:'Страница не найдена', icon:'?', description:'Запрошенный адрес не существует', nav:false }),
    assistant:Object.freeze({ path:'#/assistant', label:'AI-консультант', icon:'✦', description:'Предварительная помощь по неисправности', nav:false }),
    diagnostics:Object.freeze({ path:'#/diagnostics', label:'Диагностика', icon:'⌁', description:'ELM327, OBD-II и офлайн-диагностика' }),
    privacy:Object.freeze({ path:'#/privacy', label:'Конфиденциальность', icon:'🔐', description:'Использование и защита данных' }),
    contacts:Object.freeze({ path:'#/contacts', label:'Контакты', icon:'☎', description:'Связь и поддержка платформы' }),
    lawyer:Object.freeze({ path:'#/lawyer', label:'Юрист', icon:'⚖', description:'Помощь при ДТП, страховых и правовых спорах', nav:false }),
    towTruck:Object.freeze({ path:'#/tow-truck', label:'Эвакуатор', icon:'▰', description:'Вызов эвакуатора и передача геопозиции', nav:false }),
    productDetail:Object.freeze({ path:'#/parts/item', label:'Товар', icon:'▣', nav:false }),
    serviceDetail:Object.freeze({ path:'#/services/item', label:'Услуга', icon:'⚙', nav:false }),
    providerDetail:Object.freeze({ path:'#/masters/profile', label:'Исполнитель', icon:'◉', nav:false }),
    providerBooking:Object.freeze({ path:'#/masters/book', label:'Запись к мастеру', icon:'calendar', nav:false }),
    providerReviews:Object.freeze({ path:'#/masters/reviews', label:'Отзывы', icon:'★', nav:false })
  });

  const UX_SURFACE_BY_KEY = Object.freeze({
    home:'workspace', platform:'workspace', corePlatform:'workspace', calendarBooking:'workspace', finance:'workspace', market:'workspace', crm:'workspace',
    identityMigration:'workspace', adminUsers:'workspace', adminOrganizations:'workspace', adminMonitoring:'workspace', adminManagement:'workspace',
    services:'workspace', news:'deep-link-fallback', masterNews:'workspace', masterNewsCreate:'work-dialog', masterNewsEdit:'work-dialog', works:'workspace', profile:'entity-window', following:'workspace', realWorks:'workspace',
    workDetail:'entity-window', serviceManagement:'workspace', masters:'workspace', masterOnboarding:'workspace', masterDashboard:'workspace', masterSchedule:'workspace', masterProfileOwner:'workspace', masterWallOwner:'workspace', masterWorks:'workspace', masterReviews:'workspace', masterExchange:'workspace', community:'workspace', stoDashboard:'workspace',
    parts:'workspace', usedParts:'workspace', seller:'workspace', sellerProducts:'workspace', sellerOrders:'workspace', orders:'workspace', workflow:'workspace', requestNew:'work-dialog', workOrder:'entity-window', vehicle:'entity-window', chats:'workspace', notifications:'deep-link-fallback',
    cabinet:'workspace', cabinetGarage:'workspace', cabinetData:'deep-link-fallback', cabinetHistory:'workspace', cabinetDocuments:'deep-link-fallback', cabinetPromos:'workspace', cabinetTariff:'deep-link-fallback', cabinetSettings:'deep-link-fallback',
    about:'workspace', rules:'workspace', help:'workspace', notFound:'deep-link-fallback', assistant:'workspace', diagnostics:'workspace', privacy:'workspace', contacts:'workspace', lawyer:'workspace', towTruck:'workspace',
    productDetail:'entity-window', serviceDetail:'entity-window', providerDetail:'entity-window', providerBooking:'entity-window', providerReviews:'entity-window'
  });
  const UX_SURFACE_TYPES = Object.freeze(['workspace','entity-window','work-dialog','deep-link-fallback']);
  function surfaceForKey(routeKey){ return UX_SURFACE_BY_KEY[routeKey] || 'workspace'; }
  function uxAudit(){
    const keys=Object.keys(ROUTES), missing=keys.filter(key=>!Object.prototype.hasOwnProperty.call(UX_SURFACE_BY_KEY,key));
    const extra=Object.keys(UX_SURFACE_BY_KEY).filter(key=>!Object.prototype.hasOwnProperty.call(ROUTES,key));
    const invalid=Object.entries(UX_SURFACE_BY_KEY).filter(([,type])=>!UX_SURFACE_TYPES.includes(type)).map(([key])=>key);
    return Object.freeze({ok:missing.length===0&&extra.length===0&&invalid.length===0,total:keys.length,missing:Object.freeze(missing),extra:Object.freeze(extra),invalid:Object.freeze(invalid),surfaces:UX_SURFACE_BY_KEY});
  }

  const DESKTOP_KEYS = Object.freeze(Object.keys(ROUTES).filter(key => ROUTES[key].nav !== false));
  const MOBILE_KEYS = Object.freeze(['home','parts','masters','orders','cabinet']);

  const LEGACY_ALIASES = Object.freeze({
    '#home':'#/home', '#following':'#/following', '#news':'#/works', '#/news':'#/works', '#works':'#/works', '#real-works':'#/real-works', '#services':'#/services', '#services:quick':'#/services', '#services:manage':'#/services/manage', '#master:services':'#/services/manage', '#sto:services':'#/services/manage',
    '#masters':'#/masters', '#master':'#/master', '#master:profile':'#/master/profile', '#master:wall':'#/master/wall', '#master:works':'#/master/works', '#master:reviews':'#/master/reviews', '#master:work:queue':'#/master/exchange',
    '#/master/requests':'#/orders', '#/master/workplace':'#/master', '#/master/settings':'#/cabinet/settings',
    '#sto':'#/sto', '#sto_dashboard':'#/sto', '#parts':'#/parts', '#seller':'#/seller', '#shop':'#/seller',
    '#orders':'#/orders', '#myorders':'#/orders', '#messages':'#/chats', '#chats':'#/chats', '#cabinet':'#/cabinet',
    '#about':'#/about', '#rules':'#/rules', '#help':'#/help', '#assistant':'#/assistant', '#privacy':'#/privacy', '#contacts':'#/contacts', '#lawyer':'#/lawyer', '#tow-truck':'#/tow-truck'
  });

  function normalizeHash(hashValue){
    const raw = String(hashValue || location.hash || '#/home').trim();
    const hash = raw.startsWith('#') ? raw : '#' + raw;
    const clean = hash.split('?')[0];
    return LEGACY_ALIASES[clean] || clean || '#/home';
  }
  function keyFromHash(hashValue){
    const hash = normalizeHash(hashValue);
    if (/^#\/works\/item\/[^/]+$/.test(hash)) return 'workDetail';
    if (hash === '#/parts/used') return 'usedParts';
    if (/^#\/parts\/item\/[^/]+$/.test(hash)) return 'productDetail';
    if (/^#\/parts\/store\/[^/]+$/.test(hash)) return 'productDetail';
    if (/^#\/services\/item\/[^/]+$/.test(hash)) return 'serviceDetail';
    if (/^#\/services\/(group|category)\/[^/]+$/.test(hash)) return 'services';
    if (/^#\/profile\/(person|organization)\/[^/]+$/.test(hash) || hash === '#/profile') return 'profile';
    if (/^#\/masters\/reviews\/(master|sto)\/[^/]+$/.test(hash)) return 'providerReviews';
    if (/^#\/masters\/book\/master\/[^/]+$/.test(hash)) return 'providerBooking';
    if (/^#\/masters\/profile\/(master|sto)\/[^/]+$/.test(hash)) return 'providerDetail';
    if (hash === '#/master/schedule') return 'masterSchedule';
    if (hash === '#/master/profile') return 'masterProfileOwner';
    if (hash === '#/master/wall') return 'masterWallOwner';
    if (hash === '#/master/works') return 'masterWorks';
    if (hash === '#/master/reviews') return 'masterReviews';
    if (hash === '#/master/exchange') return 'masterExchange';
    if (hash === '#/community' || /^#\/community(?:\/.*)?$/.test(hash)) return 'community';
    if (hash === '#/master/news') return 'masterNews';
    if (hash === '#/master/news/create') return 'masterNewsCreate';
    if (/^#\/master\/news\/edit\/[^/]+$/.test(hash)) return 'masterNewsEdit';
    if (hash === '#/platform') return 'platform';
    if (hash === '#/calendar') return 'calendarBooking';
    if (hash === '#/finance') return 'finance';
    if (hash === '#/market') return 'market';
    if (hash === '#/crm') return 'crm';
    if (hash === '#/admin/identity-migration') return 'identityMigration';
    if (hash === '#/admin/users') return 'adminUsers';
    if (hash === '#/admin/organizations') return 'adminOrganizations';
    if (hash === '#/admin/monitoring') return 'adminMonitoring';
    if (hash === '#/admin/management') return 'adminManagement';
    if (hash === '#/workflow') return 'workflow';
    if (hash === '#/seller/products') return 'sellerProducts';
    if (hash === '#/seller/orders') return 'sellerOrders';
    if (hash === '#/orders/new') return 'requestNew';
    if (/^#\/orders\/item\/[^/]+$/.test(hash)) return 'workOrder';
    if (/^#\/garage\/car\/[^/]+$/.test(hash)) return 'vehicle';
    if (hash === '#/notifications') return 'notifications';
    if (hash === '#/cabinet/garage') return 'cabinetGarage';
    if (hash === '#/cabinet/data') return 'cabinetData';
    if (hash === '#/cabinet/history') return 'cabinetHistory';
    if (hash === '#/cabinet/documents') return 'cabinetDocuments';
    if (hash === '#/cabinet/promotions') return 'cabinetPromos';
    if (hash === '#/cabinet/tariff') return 'cabinetTariff';
    if (hash === '#/cabinet/settings') return 'cabinetSettings';
    const found = Object.entries(ROUTES).find(([, route]) => route.path === hash);
    return found ? found[0] : 'notFound';
  }
  function get(routeKey){ return ROUTES[routeKey] || ROUTES.home; }
  function has(routeKey){ return Object.prototype.hasOwnProperty.call(ROUTES, routeKey); }

  window.KaretaRouteRegistry = Object.freeze({ routes:ROUTES, desktopKeys:DESKTOP_KEYS, mobileKeys:MOBILE_KEYS, uxSurfaces:UX_SURFACE_BY_KEY, uxSurfaceTypes:UX_SURFACE_TYPES, surfaceForKey, uxAudit, normalizeHash, keyFromHash, get, has });
})();
;

/* SOURCE: js/next/production_guard.js */
(() => {
  'use strict';
  const state={status:'idle',lastCheck:0,error:'',snapshot:null};

  async function readJson(url){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    const text=await response.text();
    let data=null; try{data=text?JSON.parse(text):null;}catch(_error){}
    if(!data||typeof data!=='object') throw Object.assign(new Error('health_invalid_json'),{status:response.status,preview:text.slice(0,160)});
    if(!response.ok||data.ok===false) throw Object.assign(new Error(data.error||`HTTP ${response.status}`),{status:response.status,payload:data});
    return data;
  }

  function commit(snapshot,status,error=''){
    state.status=status;
    state.error=String(error||'');
    state.lastCheck=Date.now();
    state.snapshot=snapshot;
    document.documentElement.dataset.identityHealth=status;
    if(typeof snapshot?.dbReady==='boolean') document.documentElement.dataset.databaseReady=String(snapshot.dbReady);
    return snapshot;
  }

  async function check(options={}){
    if(!options.force && state.snapshot && Date.now()-state.lastCheck<30000) return state.snapshot;
    state.status='checking'; state.error='';
    try{
      // Ping is intentionally public and returns HTTP 200 even when the DB is not
      // configured. It prevents a predictable cascade of 503 Identity requests.
      const ping=await readJson(`/api/db.php?action=ping&identity_probe=${Date.now()}`);
      if(ping.dbReady!==true){
        const unavailable=commit({
          ok:false,
          status:'degraded',
          reason:String(ping.databaseState||'database_unavailable'),
          recoveryAction:String(ping.recoveryAction||''),
          dbReady:false,
          identityReady:false,
          assetVersion:String(ping.assetVersion||''),
        },'unavailable','database_unavailable');
        window.KaretaRuntimeLog?.add?.('identity.health.unavailable',{reason:unavailable.reason,dbReady:false},'warn');
        window.dispatchEvent(new CustomEvent('kareta:identity-health-error',{detail:{expected:true,snapshot:unavailable,state:{...state}}}));
        return unavailable;
      }

      // Fast boot only needs the public DB/version probe. Identity/session itself
      // is checked in parallel by app_next; the heavier schema health inspection
      // runs after first paint. Other callers keep the full health behavior.
      if(options.fast===true){
        return commit({ok:true,status:'ready-fast',dbReady:true,identityReady:true,assetVersion:String(ping.assetVersion||'')},'ready-fast');
      }

      const health=await readJson('/api/identity_health.php');
      const ready=commit({...health,dbReady:true,identityReady:true},'ready');
      window.dispatchEvent(new CustomEvent('kareta:identity-health',{detail:ready}));
      return ready;
    }catch(error){
      const message=String(error?.message||error);
      const degraded=commit({ok:false,status:'degraded',reason:'health_check_failed',dbReady:null,identityReady:false,error:message},'degraded',message);
      window.KaretaRuntimeLog?.add?.('identity.health.failed',{error:message,status:error?.status||0},'warn');
      window.dispatchEvent(new CustomEvent('kareta:identity-health-error',{detail:{error,snapshot:degraded,state:{...state}}}));
      return degraded;
    }
  }
  window.addEventListener('online',()=>check({force:true}));
  window.KaretaProductionGuard=Object.freeze({check,snapshot:()=>({...state})});
})();
;

/* SOURCE: js/next/identity_frontend.js */
(() => {
  'use strict';

  if (window.__KARETA_IDENTITY_FRONTEND_MODULE__) {
    window.__KARETA_IDENTITY_FRONTEND_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_IDENTITY_FRONTEND_MODULE__ = { duplicateLoads:0 };

  const state = {
    loaded:false,
    loading:false,
    authenticated:false,
    account:null,
    session:null,
    contexts:[],
    accountTypes:[],
    context:null,
    capabilities:[],
    deniedCapabilities:[],
    error:'',
    mode:'anonymous',
    revision:0,
  };
  let loadFlight = null;

  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

  function emit(name, detail = {}) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_error) {}
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials:'same-origin',
      ...options,
      headers:{
        Accept:'application/json',
        ...(options.body ? {'Content-Type':'application/json'} : {}),
        ...(options.headers || {}),
      },
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch (_error) {}
    if (!payload || typeof payload !== 'object') {
      const error = new Error('identity_invalid_json');
      error.status = response.status;
      error.payload = { ok:false, error:'identity_invalid_json', contentType:response.headers.get('content-type') || '', preview:raw.slice(0,180) };
      error.invalidJson = true;
      throw error;
    }
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.message || payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function requestWithFallback(primaryUrl, fallbackUrl, options = {}) {
    try { return await request(primaryUrl, options); }
    catch (error) {
      if (!fallbackUrl || (!error.invalidJson && error.status !== 404)) throw error;
      if (error.status >= 500) throw error;
      return request(fallbackUrl, options);
    }
  }

  function normalizeContext(context) {
    if (!context) return null;
    return {
      ...context,
      id:Number(context.id || 0) || null,
      key:String(context.key || context.contextKey || ''),
      type:String(context.type || context.contextType || 'personal'),
      profileType:String(context.profileType || ''),
      label:String(context.label || 'Личный кабинет'),
    };
  }

  function compatibilityRole(context = state.context) {
    if (state.capabilities.includes('*')) return 'admin';
    if (!context) return 'client';
    if (context.type === 'profile') {
      if (context.profileType === 'master') return 'master';
      if (context.profileType === 'seller') return 'seller';
    }
    if (context.type === 'organization') {
      const code = String(context.capabilitySetCode || '');
      if (code.includes('seller') || context.organizationType === 'parts_store') return 'seller';
      return 'sto';
    }
    return 'client';
  }

  function apply(payload, source = 'load') {
    state.loaded = true;
    state.loading = false;
    state.error = '';
    state.authenticated = Boolean(payload?.authenticated ?? payload?.account);
    state.mode = state.authenticated ? 'identity' : 'anonymous';
    state.account = payload?.account || null;
    state.session = payload?.session || state.session || null;
    if (Array.isArray(payload?.contexts)) state.contexts = payload.contexts.map(normalizeContext).filter(Boolean);
    if (Array.isArray(payload?.accountTypes)) state.accountTypes = payload.accountTypes.map(item => ({ ...item, role:String(item?.role || ''), status:String(item?.status || 'available') }));
    if (payload?.currentContext) state.context = normalizeContext(payload.currentContext);
    state.capabilities = Array.isArray(payload?.capabilities) ? [...new Set(payload.capabilities.map(String))] : [];
    state.deniedCapabilities = Array.isArray(payload?.deniedCapabilities) ? [...new Set(payload.deniedCapabilities.map(String))] : [];
    state.revision = Number(payload?.sessionContext?.contextRevision || state.session?.contextRevision || state.revision || 0);

    const root = document.documentElement;
    if (state.context) {
      root.dataset.identityContext = state.context.type;
      root.dataset.identityContextId = String(state.context.id || '');
      root.dataset.identityContextKey = state.context.key || '';
      root.dataset.identityProfile = state.context.profileType || '';
    } else {
      delete root.dataset.identityContext;
      delete root.dataset.identityContextId;
      delete root.dataset.identityContextKey;
      delete root.dataset.identityProfile;
    }

    const detail = snapshot();
    emit('kareta:identity-ready', { ...detail, source });
    emit('kareta:capabilities-changed', detail);
    return detail;
  }

  function reset(source = 'anonymous') {
    Object.assign(state, {
      loaded:true, loading:false, authenticated:false, account:null, session:null,
      contexts:[], accountTypes:[], context:null, capabilities:[], deniedCapabilities:[], error:'', mode:'anonymous', revision:0,
    });
    ['identityContext','identityContextId','identityContextKey','identityProfile'].forEach(key => delete document.documentElement.dataset[key]);
    emit('kareta:identity-anonymous', { source });
    emit('kareta:capabilities-changed', snapshot());
    return snapshot();
  }

  function bootstrapSession(payload, source = 'session-bootstrap') {
    if (!payload || payload.authenticated !== true || !payload.account || !payload.currentContext) {
      const error = new Error('identity_bootstrap_invalid');
      error.payload = payload || null;
      throw error;
    }
    return apply(payload, source);
  }

  function load(options = {}) {
    if (loadFlight) return loadFlight;
    if (state.loaded && !options.force) return snapshot();
    const previouslyAuthenticated=state.authenticated;
    state.loading = true;
    state.error = '';
    loadFlight = (async () => { try {
      const current = await requestWithFallback('/api/identity_session.php?action=current', '/api/identity/session?action=current');
      if (!current.authenticated) {
        const legacyUser=options.legacyUser||window.KaretaNext?.state?.user||window.KaretaAppState?.user||null;
        if(options.allowLegacyBridge&&legacyUser){
          try{
            const legacyContexts=await requestWithFallback('/api/context.php?action=list','/api/context/list');
            return apply({...legacyContexts,authenticated:true,session:null},'legacy-context-bridge');
          }catch(legacyError){
            if(![401,403,409].includes(Number(legacyError.status||0)))throw legacyError;
          }
        }
        const result=reset('identity-session');
        if(previouslyAuthenticated)emit('kareta:session-anonymous',{source:'identity-session',reason:'session_expired'});
        return result;
      }
      // R188.5.5.6.84.82: current identity endpoint now returns contexts,
      // accountTypes and deniedCapabilities in the same response. Keep the old
      // second request only as compatibility fallback for an older backend.
      if(Array.isArray(current.contexts)) return apply({ ...current, authenticated:true }, 'identity-session-single-roundtrip');
      const contexts = await requestWithFallback('/api/context.php?action=list', '/api/context/list');
      return apply({ ...current, ...contexts, authenticated:true }, 'identity-session');
    } catch (error) {
      state.loading = false;
      state.loaded = true;
      state.error = error.message || 'identity_load_failed';
      if (error.status === 401 || error.status === 409) {
        const result=reset(error.status===409?'identity-conflict':'identity-expired');
        emit('kareta:session-expired', { reason:error.payload?.error||error.message||'session_expired', status:error.status, error });
        return result;
      }
      emit('kareta:identity-error', { error, state:snapshot() });
      throw error;
    } })().finally(()=>{loadFlight=null;});
    return loadFlight;
  }

  async function select(contextIdOrKey) {
    const body = typeof contextIdOrKey === 'number' || /^\d+$/.test(String(contextIdOrKey || ''))
      ? { contextId:Number(contextIdOrKey) }
      : { contextKey:String(contextIdOrKey || '') };
    try {
      const payload = await requestWithFallback('/api/context.php?action=select', '/api/context/select', { method:'POST', body:JSON.stringify(body) });
      const detail = apply(payload, 'context-select');
      emit('kareta:context-changed', { context:detail.context, capabilities:detail.capabilities, identity:detail });
      return detail;
    } catch (error) {
      if (error.status === 403 && String(error.payload?.error||error.message)==='context_not_available') {
        emit('kareta:context-lost', { reason:'context_not_available', requested:contextIdOrKey, error });
      }
      if (error.status === 401) emit('kareta:session-expired', { reason:error.payload?.error||'session_required', status:error.status, error });
      throw error;
    }
  }

  function wildcardMatch(granted, requested) {
    if (granted === '*') return true;
    if (granted === requested) return true;
    return granted.endsWith('.*') && requested.startsWith(granted.slice(0, -1));
  }

  function has(capability) {
    const requested = String(capability || '').trim();
    if (!requested) return false;
    if (state.deniedCapabilities.some(item => wildcardMatch(item, requested))) return false;
    return state.capabilities.some(item => wildcardMatch(item, requested));
  }

  function hasAny(capabilities) { return (capabilities || []).some(has); }
  function hasAll(capabilities) { return (capabilities || []).every(has); }
  function snapshot() {
    return clone({
      loaded:state.loaded, loading:state.loading, authenticated:state.authenticated,
      account:state.account, session:state.session, contexts:state.contexts, accountTypes:state.accountTypes,
      context:state.context, capabilities:state.capabilities,
      deniedCapabilities:state.deniedCapabilities, error:state.error, mode:state.mode,
      revision:state.revision, compatibilityRole:compatibilityRole(),
    });
  }

  window.KaretaIdentity = Object.freeze({ load, select, reset, bootstrapSession, has, hasAny, hasAll, compatibilityRole, snapshot });
})();
;

/* SOURCE: js/next/master_onboarding_gate.js */
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
;

/* SOURCE: js/next/dynamic_navigation.js */
(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){window.KaretaRuntimeDependencies.deferScript('dynamic_navigation',dependencies,scriptSource);return;}
  if(window.__KARETA_DYNAMIC_NAVIGATION_MODULE__){window.__KARETA_DYNAMIC_NAVIGATION_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_DYNAMIC_NAVIGATION_MODULE__={duplicateLoads:0};

  const registry = window.KaretaRouteRegistry;
  if (!registry) throw new Error('KaretaRouteRegistry is required before dynamic_navigation.js');

  const CAPABILITY_ALIASES = Object.freeze({
    'vehicles.read':['vehicles.read','vehicle.read'],
    'vehicles.update':['vehicles.update','vehicle.edit'],
    'requests.read':['requests.read','order.read','orders.read','orders.readOwn'],
    'requests.create':['requests.create','order.create','orders.create'],
    'work_orders.read':['work_orders.read','workorder.read','work_order.read'],
    'work_orders.assign':['work_orders.assign','workorder.assign','work_order.assign'],
    'work_orders.manage':['work_orders.manage','orders.manageService'],
    'finance.manage':['finance.manage','finance.read','finance.manageOwn','finance.manageOrganization'],
    'warehouse.stock.manage':['warehouse.stock.manage','warehouse.manage','seller.stock.manage'],
    'warehouse.stock.reserve':['warehouse.stock.reserve','warehouse.reserve'],
    'market.products.manage':['market.products.manage','seller.products.manage','market.product.manage_own'],
    'chats.use':['chats.use','chat.use'],
    'profile.read':['profile.read','profile.manage','profile.manage_own','vehicle.read']
  });

  const ITEMS = Object.freeze([
    { key:'home', section:'main', desktop:10, mobilePriority:10, public:true },
    { key:'works', section:'main', desktop:20, public:true },
    { key:'community', section:'social', menu:21, public:true },
    { key:'services', section:'main', desktop:30, menu:30, public:true },
    { key:'masters', section:'main', desktop:40, menu:40, public:true },
    { key:'parts', section:'main', desktop:50, menu:50, public:true },

    { key:'orders', section:'work', desktop:60, menu:60, mobilePriority:30, any:['requests.read'], contextTypes:['personal','profile','organization'] },
    { key:'requestNew', section:'work', menu:61, any:['requests.create'], contextTypes:['personal','profile','organization'] },
    { key:'workflow', section:'work', menu:62, any:['requests.read','work_orders.read','work_orders.assign'] },
    { key:'masterDashboard', section:'work', desktop:63, menu:63, mobilePriority:10, any:['work_orders.read','work_orders.take','profile.master'], contextProfiles:['master'] },
    { key:'masterSchedule', section:'work', any:['calendar.read','calendar.manage','work_orders.read','profile.master'], contextProfiles:['master'] },
    { key:'masterOnboarding', section:'work', any:['master.onboarding.view'], contextTypes:['profile'], contextProfiles:['master'] },
    { key:'masterWallOwner', section:'work', any:['profile.manage','profile.manage_own','profile.master'], contextTypes:['profile'], contextProfiles:['master'] },
    { key:'masterWorks', section:'work', any:['profile.manage','profile.manage_own','profile.master'], contextTypes:['profile'], contextProfiles:['master'] },
    { key:'masterReviews', section:'work', any:['profile.manage','profile.manage_own','profile.master'], contextTypes:['profile'], contextProfiles:['master'] },
    { key:'masterExchange', section:'work', menu:63.1, mobilePriority:20, contextTypes:['profile'], contextProfiles:['master'] },
    { key:'stoDashboard', section:'work', desktop:64, menu:64, mobilePriority:10, any:['organization.read','work_orders.manage'], contextTypes:['organization'] },
    { key:'seller', section:'commerce', desktop:65, menu:65, mobilePriority:10, any:['warehouse.stock.manage','market.products.manage'], contextProfiles:['seller'], allowOrganization:true },
    { key:'sellerProducts', section:'commerce', desktop:65.1, menu:65.1, mobilePriority:20, any:['warehouse.stock.manage','market.products.manage'], contextProfiles:['seller'], allowOrganization:true },
    { key:'sellerOrders', section:'commerce', desktop:65.2, menu:65.2, mobilePriority:30, any:['market.orders.read','market.orders.manage'], contextProfiles:['seller'], allowOrganization:true },
    { key:'serviceManagement', section:'work', desktop:66, menu:66, any:['service.manage','services.manage','services.manageOwn'], masterAny:['work_orders.read'], contextTypes:['profile','organization'] },
    { key:'calendarBooking', section:'work', desktop:67, menu:67, mobilePriority:40, any:['calendar.read','calendar.manage'], contextTypes:['profile','organization'] },
    { key:'finance', section:'management', desktop:68, menu:68, any:['finance.manage'], contextTypes:['profile','organization'] },
    { key:'crm', section:'management', desktop:69, menu:69, any:['crm.read','crm.note.write'], contextTypes:['organization'] },
    { key:'market', section:'commerce', desktop:70, menu:70, mobilePriority:35, any:['warehouse.stock.manage','warehouse.stock.reserve','parts.browse'], contextTypes:['profile','organization'] },
    { key:'platform', section:'system', menu:80, any:['platform.read','*'] },
    { key:'corePlatform', section:'system', menu:81, any:['domain.read','*'] },
    { key:'identityMigration', section:'system', menu:82, any:['*'], contextTypes:['personal','organization'] },
    { key:'adminUsers', section:'system', desktop:83, menu:83, any:['*'] },
    { key:'adminOrganizations', section:'system', desktop:84, menu:84, any:['*'] },
    { key:'adminMonitoring', section:'system', desktop:85, menu:85, any:['*'] },
    { key:'adminManagement', section:'system', desktop:86, menu:86, any:['*'] },
    { key:'chats', section:'communication', desktop:90, menu:90, mobilePriority:80, any:['chats.use'] },
    { key:'notifications', section:'communication', menu:91, contextTypes:['personal','profile','organization'] },
    { key:'cabinet', section:'account', desktop:100, menu:100, mobilePriority:90, any:['profile.read'], masterAny:['profile.edit_own','profile.master'], personalDefault:true },
    { key:'cabinetGarage', section:'account', any:['vehicles.read'], contextTypes:['personal'] },
    { key:'cabinetData', section:'account', any:['profile.read'], contextTypes:['personal'] },
    { key:'cabinetHistory', section:'account', any:['requests.read'], contextTypes:['personal'] },
    { key:'cabinetDocuments', section:'account', any:['vehicles.read'], contextTypes:['personal'] },
    { key:'cabinetPromos', section:'account', any:['profile.read'], contextTypes:['personal'] },
    { key:'cabinetSettings', section:'account', menu:101, contextTypes:['personal','profile','organization'] },
    { key:'following', section:'social', menu:110, public:true },
    { key:'realWorks', section:'social', menu:111, public:true },
    { key:'about', section:'info', menu:200, public:true },
    { key:'rules', section:'info', menu:201, public:true },
    { key:'help', section:'info', menu:202, public:true },
    { key:'privacy', section:'info', menu:203, public:true },
    { key:'contacts', section:'info', menu:204, public:true },
  ]);

  const state = { revision:0, cache:new Map() };
  const identity = () => window.KaretaIdentity?.snapshot?.() || { authenticated:false, context:null, capabilities:[], deniedCapabilities:[] };
  const rawHas = capability => window.KaretaIdentity?.has?.(capability) === true;
  const has = capability => (CAPABILITY_ALIASES[capability] || [capability]).some(rawHas);
  const contextProfileType = snapshot => String(snapshot.context?.profileType || snapshot.context?.profile_type || snapshot.context?.meta?.profileType || '').toLowerCase();
  const contextAllowed = (item, snapshot) => {
    if (!snapshot.authenticated) return Boolean(item.public);
    const type = String(snapshot.context?.type || 'personal').toLowerCase();
    if (item.contextTypes?.length && !item.contextTypes.includes(type)) return false;
    if (item.contextProfiles?.length) {
      const profile = contextProfileType(snapshot);
      if (!(item.allowOrganization && type === 'organization') && !item.contextProfiles.includes(profile)) return false;
    }
    return true;
  };
  const allowed = item => {
    const snapshot = identity();
    if (!contextAllowed(item, snapshot)) return false;
    if (item.public) return true;
    if (!snapshot.authenticated) return false;
    if (item.all?.length && !item.all.every(has)) return false;
    const masterProfile=String(snapshot.context?.type||'').toLowerCase()==='profile'&&contextProfileType(snapshot)==='master';
    const any=[...(item.any||[]),...(masterProfile?(item.masterAny||[]):[])];
    if (any.length && !any.some(has)) return false;
    return true;
  };
  const rank = (item, surface) => Number(item[surface] ?? item.menu ?? item.desktop ?? 9999);
  const eligible = () => ITEMS.filter(item => registry.has(item.key) && allowed(item));

  function mobileItems() {
    const candidates = eligible()
      .filter(item => item.mobilePriority !== undefined)
      .sort((a,b) => Number(a.mobilePriority)-Number(b.mobilePriority));
    if (candidates.length <= 5) return candidates.map(item => item.key);
    return [...candidates.slice(0,4).map(item => item.key), '__more__'];
  }

  function items(surface='desktop') {
    const snapshot = identity();
    const key = `${state.revision}|${surface}|${snapshot.context?.key || 'anon'}|${(snapshot.capabilities || []).join(',')}|${(snapshot.deniedCapabilities || []).join(',')}`;
    if (state.cache.has(key)) return [...state.cache.get(key)];
    const result = surface === 'mobile'
      ? mobileItems()
      : eligible().filter(item => item[surface] !== undefined).sort((a,b) => rank(a,surface)-rank(b,surface)).map(item => item.key);
    state.cache.set(key, result);
    return [...result];
  }

  function menuSections() {
    const groups = new Map();
    eligible()
      .filter(item => item.menu !== undefined)
      .sort((a,b) => rank(a,'menu')-rank(b,'menu'))
      .forEach(item => {
        const section = item.section || 'main';
        if (!groups.has(section)) groups.set(section, []);
        groups.get(section).push(item.key);
      });
    return [...groups.entries()].map(([id, keys]) => ({ id, keys }));
  }
  function canAccess(routeKey) {
    if (routeKey === '__more__') return true;
    const item = ITEMS.find(entry => entry.key === routeKey);
    if (!item) return registry.has(routeKey);
    return allowed(item);
  }
  function defaultRoute() {
    const snapshot = identity();
    const profile = contextProfileType(snapshot);
    const preferred = snapshot.context?.type === 'organization'
      ? ['stoDashboard','seller','orders','home','cabinet']
      : profile === 'master'
        ? ['masterDashboard','orders','home','cabinet']
        : profile === 'seller'
          ? ['seller','market','home','cabinet']
          : ['home','cabinet'];
    return preferred.find(canAccess) || items('desktop')[0] || 'home';
  }
  function refresh() {
    state.revision += 1;
    state.cache.clear();
    const detail = snapshot();
    try { window.dispatchEvent(new CustomEvent('kareta:navigation-changed', { detail })); } catch (_error) {}
    return detail;
  }
  function snapshot() {
    return { revision:state.revision, desktop:items('desktop'), mobile:items('mobile'), sections:menuSections(), defaultRoute:defaultRoute() };
  }

  window.addEventListener('kareta:identity-ready', refresh);
  window.addEventListener('kareta:capabilities-changed', refresh);
  window.addEventListener('kareta:context-changed', refresh);
  window.KaretaDynamicNavigation = Object.freeze({ ITEMS, CAPABILITY_ALIASES, items, menuSections, canAccess, defaultRoute, refresh, snapshot });
})();
;

/* SOURCE: js/next/role_access.js */
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
;

/* SOURCE: js/next/context_manager.js */
(() => {
  'use strict';

  if (window.__KARETA_CONTEXT_MANAGER_MODULE__) {
    window.__KARETA_CONTEXT_MANAGER_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_CONTEXT_MANAGER_MODULE__ = { duplicateLoads:0 };

  const ROLE_OPTIONS=Object.freeze([
    Object.freeze({key:'client',label:'Клиент',icon:'user'}),
    Object.freeze({key:'master',label:'Мастер',icon:'masters'}),
    Object.freeze({key:'sto',label:'СТО',icon:'work'}),
    Object.freeze({key:'seller',label:'Магазин',icon:'store'})
  ]);
  const CONTEXT_BUTTON_ROLES=Object.freeze(new Set(['client','master']));
  const VISIBLE_CONTEXT_OPTIONS=Object.freeze(ROLE_OPTIONS.filter(option=>CONTEXT_BUTTON_ROLES.has(option.key)));
  const state={loaded:false,loading:false,contexts:[],accountTypes:[],selected:null,capabilities:[],deniedCapabilities:[],error:'',legacyUser:null,legacyMode:false};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function sync(snapshot){
    state.loaded=Boolean(snapshot?.loaded);
    state.loading=Boolean(snapshot?.loading);
    state.contexts=Array.isArray(snapshot?.contexts)?snapshot.contexts:[];
    state.accountTypes=Array.isArray(snapshot?.accountTypes)?snapshot.accountTypes:[];
    state.selected=snapshot?.context||null;
    state.capabilities=Array.isArray(snapshot?.capabilities)?snapshot.capabilities:[];
    state.deniedCapabilities=Array.isArray(snapshot?.deniedCapabilities)?snapshot.deniedCapabilities:[];
    state.error=String(snapshot?.error||'');
    state.legacyMode=Boolean(!snapshot?.authenticated && state.legacyUser);
    if(state.selected){
      document.documentElement.dataset.workContext=String(state.selected.type||'personal');
      document.documentElement.dataset.workContextId=String(state.selected.id||'');
    }else{
      delete document.documentElement.dataset.workContext;
      delete document.documentElement.dataset.workContextId;
    }
    render();
    return state;
  }

  function resetAnonymous(){
    window.KaretaIdentity?.reset?.('context-manager');
    return sync(window.KaretaIdentity?.snapshot?.()||{});
  }

  async function load(forceOrOptions=false){
    const options=typeof forceOrOptions==='object'&&forceOrOptions!==null?forceOrOptions:{force:Boolean(forceOrOptions)};
    state.loading=true;state.error='';render();
    try{return sync(await window.KaretaIdentity.load({force:Boolean(options.force),allowLegacyBridge:Boolean(options.allowLegacyBridge),legacyUser:state.legacyUser}));}
    catch(error){state.loading=false;state.loaded=true;state.error=error.message||'Ошибка загрузки контекста';render();return state;}
  }

  async function select(contextIdOrKey,options={}){
    const current=state.contexts.find(item=>String(item.id)===String(contextIdOrKey)||String(item.key)===String(contextIdOrKey));
    if(!current||String(current.id||current.key)===String(state.selected?.id||state.selected?.key))return state;
    state.loading=true;state.error='';render();
    try{
      const next=window.KaretaNavigationCore?.switchContext
        ? await window.KaretaNavigationCore.switchContext(current.id||current.key)
        : await window.KaretaIdentity.select(current.id||current.key);
      const result=sync(next?.identity||next);
      if(options.closeMenu!==false)window.KaretaShellMenu?.close?.();
      if(options.toast!==false)window.KaretaToast?.success?.(`Тип аккаунта «${contextTitle(current)}» включён`);
      return result;
    } catch(error){state.error=error.message||'Не удалось переключить тип аккаунта';throw error;}
    finally { state.loading=false;render(); }
  }

  async function requestType(role){
    const normalized=String(role||'').toLowerCase();
    if(!['master','sto','seller'].includes(normalized)||state.loading)return state;
    state.loading=true;state.error='';render();
    try{
      const response=await fetch('/api/context.php?action=request-type',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({role:normalized})});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload||payload.ok!==true){const error=new Error(payload?.message||payload?.error||`HTTP ${response.status}`);error.status=response.status;error.payload=payload;throw error;}
      const refreshed=window.KaretaIdentity?.load?await window.KaretaIdentity.load({force:true}):null;
      let result=sync(refreshed||{...window.KaretaIdentity?.snapshot?.(),...payload,authenticated:true});
      const type=ROLE_OPTIONS.find(item=>item.key===normalized)?.label||'Тип аккаунта';
      const autoApproved=payload?.request?.autoApproved===true||payload?.autoApproved===true;
      if(autoApproved){
        const targetId=payload?.request?.targetContextId||payload?.request?.targetContextKey||'';
        const target=state.contexts.find(item=>String(item.id||item.key)===String(targetId))
          ||state.contexts.find(item=>roleForContext(item)===normalized)
          ||null;
        if(!target)throw new Error('account_type_context_not_materialized');
        if(String(target.id||target.key)!==String(state.selected?.id||state.selected?.key)){
          result=await select(target.id||target.key,{toast:false,closeMenu:false});
        }
        window.KaretaShellMenu?.close?.();
        window.KaretaToast?.success?.(`Тип аккаунта «${type}» добавлен для тестирования и включён`);
      }else{
        window.KaretaToast?.success?.(payload?.request?.alreadyPending?`Заявка «${type}» уже на проверке`:`Заявка на тип «${type}» отправлена`);
      }
      window.dispatchEvent(new CustomEvent('kareta:account-types-changed',{detail:result}));
      return result;
    }catch(error){state.error=error.message||'Не удалось добавить тип аккаунта';window.KaretaToast?.error?.(state.error);throw error;}
    finally{state.loading=false;render();}
  }

  function accountTypeState(role){
    return state.accountTypes.find(item=>String(item?.role||'').toLowerCase()===role)||{role,status:role==='client'?'active':'available',description:'Добавить к текущему номеру телефона'};
  }

  function contextForRole(role,type){
    const matches=state.contexts.filter(context=>roleForContext(context)===role);
    const selectedId=String(state.selected?.id||state.selected?.key||'');
    return matches.find(context=>String(context.id||context.key)===selectedId)
      ||matches.find(context=>String(context.id||'')===String(type?.contextId||'')||String(context.key||'')===String(type?.contextKey||''))
      ||matches[0]||null;
  }

  function accountTypeChoice(option){
    const type=accountTypeState(option.key);
    const context=contextForRole(option.key,type);
    if(!context)return missingRoleChoice(option);
    const active=String(context.id||context.key)===String(state.selected?.id||state.selected?.key);
    const count=state.contexts.filter(item=>roleForContext(item)===option.key).length;
    const detail=`${context.label||optionLabel(context)}${count>1?` · ещё ${count-1}`:''}`;
    return `<button type="button" role="listitem" class="k-context-button ${active?'is-active':''}" data-context-switch-select="${esc(context.id||context.key)}" ${active?'aria-current="true" disabled':''} ${state.loading?'aria-busy="true" disabled':''}><span class="k-context-button-icon">${iconSvg(option.icon)}</span><span><b>${esc(option.label)}</b><small>${esc(detail)}</small></span>${active?'<i>Активен</i>':'<i>Переключить</i>'}</button>`;
  }

  function missingRoleChoice(option){
    const type=accountTypeState(option.key);const status=String(type.status||'available');
    const pending=status==='pending';const setup=status==='setup_required';const rejected=status==='rejected';
    const description=String(type.description||'Добавить к текущему номеру телефона');
    const stateLabel=pending?'На проверке':setup?'Настройка':rejected?'Повторить':'Добавить';
    const className=`k-context-button k-context-button--type is-${esc(status)}`;
    const content=`<span class="k-context-button-icon">${iconSvg(option.icon)}</span><span><b>${esc(option.label)}</b><small>${esc(description)}</small></span><i>${esc(stateLabel)}</i>`;
    if(pending)return `<button type="button" role="listitem" class="${className}" disabled aria-disabled="true">${content}</button>`;
    if(setup)return `<button type="button" role="listitem" class="${className}" data-context-retry ${state.loading?'aria-busy="true" disabled':''}>${content}</button>`;
    return `<button type="button" role="listitem" class="${className}" data-context-type-request="${esc(option.key)}" ${state.loading?'aria-busy="true" disabled':''}>${content}</button>`;
  }

  function accountTypeSummary(){
    const activeRoles=new Set(state.contexts.map(roleForContext).filter(Boolean));
    const visibleActive=[...activeRoles].filter(role=>CONTEXT_BUTTON_ROLES.has(role)).length;
    const visiblePending=state.accountTypes.filter(item=>CONTEXT_BUTTON_ROLES.has(String(item?.role||'').toLowerCase())&&item.status==='pending').length;
    return `${visibleActive||1} активный тип${visiblePending?` · ${visiblePending} на проверке`:''} · Клиент и Мастер`;
  }

  function optionLabel(context){
    if(context.type==='personal')return `Личный: ${context.label||'Кабинет'}`;
    if(context.type==='profile')return context.label||'Профессиональный профиль';
    const kind=context.organizationType==='service_station'?'СТО':context.organizationType==='parts_store'?'Магазин':'Организация';
    return `${kind}: ${context.label||context.organizationKey||'Контекст'}`;
  }

  function contextTitle(context){
    if(context?.type==='personal')return 'Клиент';
    if(context?.type==='profile')return String(context.profileType||'').toLowerCase()==='seller'?'Магазин':'Мастер';
    if(context?.type==='organization')return String(context.organizationType||'').toLowerCase()==='parts_store'?'Магазин':'СТО';
    return context?.label||'Аккаунт';
  }

  function contextIcon(context){const title=contextTitle(context);return title==='Клиент'?'user':title==='Мастер'?'masters':title==='Магазин'?'store':'work';}
  function iconSvg(name){return window.KaretaUIIcons?.svg?.(name)||'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>';}
  function roleForContext(context){
    if(context?.type==='personal')return 'client';
    if(context?.type==='profile')return String(context.profileType||context.profile_type||'').toLowerCase()==='seller'?'seller':'master';
    if(context?.type==='organization')return String(context.organizationType||context.organization_type||'').toLowerCase()==='parts_store'?'seller':'sto';
    return '';
  }
  function legacyRole(){
    const role=String(state.legacyUser?.role||'client').toLowerCase();
    return ({service:'sto',service_station:'sto',station:'sto',parts_store:'seller',shop:'seller',store:'seller'}[role]||role);
  }
  function legacyRoleChoice(option){
    const activeRole=legacyRole();
    const serverContext=state.contexts.find(context=>roleForContext(context)===option.key)||null;
    const selectedKey=String(state.selected?.id||state.selected?.key||'');
    const serverKey=String(serverContext?.id||serverContext?.key||'');
    const active=(serverKey!==''&&serverKey===selectedKey)||(!state.selected&&option.key===activeRole);
    const content=`<span class="k-context-role-icon">${iconSvg(option.icon)}</span><span class="k-context-role-copy"><b>${esc(option.label)}</b><small>${active?'Текущий тип аккаунта':serverContext?esc(serverContext.label||optionLabel(serverContext)):'Создать профиль'}</small></span><i class="k-context-role-state">${active?'Активен':serverContext?'Переключить':'Добавить'}</i>`;
    if(active)return `<button type="button" role="listitem" class="k-context-role-choice is-active" aria-current="true" disabled>${content}</button>`;
    if(serverContext)return `<button type="button" role="listitem" class="k-context-role-choice" data-context-switch-select="${esc(serverContext.id||serverContext.key)}" ${state.loading?'aria-busy="true" disabled':''}>${content}</button>`;
    return `<a role="listitem" class="k-context-role-choice" href="#role:${esc(option.key)}:role" data-context-role-create="${esc(option.key)}" data-context-add-profile>${content}</a>`;
  }
  function bindHost(host){
    if(host.dataset.contextSwitcherBound==='true')return;
    host.dataset.contextSwitcherBound='true';
    host.addEventListener('click',event=>{
      const retry=event.target.closest('[data-context-retry]');
      if(retry){load({force:true,allowLegacyBridge:true});return;}
      const button=event.target.closest('[data-context-switch-select]');
      if(button){select(button.dataset.contextSwitchSelect).catch(error=>{window.KaretaToast?.error?.(error.message||'Не удалось переключить тип аккаунта');render();});return;}
      const request=event.target.closest('[data-context-type-request]');
      if(request){requestType(request.dataset.contextTypeRequest).catch(()=>{});return;}
      const create=event.target.closest('[data-context-role-create]');
      if(create){const role=String(create.dataset.contextRoleCreate||'client');window.KaretaShellMenu?.close?.();if(window.KaretaOnboardingNavigation?.to){event.preventDefault();window.KaretaOnboardingNavigation.to('role',{role,source:'legacy-context-picker'});}return;}
      if(event.target.closest('[data-context-add-profile]'))window.KaretaShellMenu?.close?.();
    });
  }

  function render(){
    const host=document.getElementById('k-context-switcher');
    if(!host)return false;
    bindHost(host);
    if(state.loading&&!state.loaded){host.hidden=false;host.innerHTML='<div class="k-context-loading">Загрузка контекста…</div>';return true;}
    if(state.error && !state.legacyMode){host.hidden=false;host.innerHTML=`<button class="k-context-error" type="button" data-context-retry>${esc(state.error)} · повторить</button>`;return true;}
    if(state.legacyMode){
      host.hidden=false;
      host.innerHTML=`<section class="k-context-legacy"><header><span>ТИП АККАУНТА</span><small>Доступные типы: Клиент и Мастер</small></header><div class="k-context-legacy-roles" role="list" aria-label="Типы аккаунта">${VISIBLE_CONTEXT_OPTIONS.map(legacyRoleChoice).join('')}</div><div class="k-context-legacy-footer"><small>${state.error?esc(state.error):'Серверные контексты обновятся после восстановления Identity-сессии.'}</small><button class="k-context-recover" type="button" data-context-retry ${state.loading?'aria-busy="true" disabled':''}>Обновить типы</button></div></section>`;
      return true;
    }
    if(!state.contexts.length){host.innerHTML='';host.hidden=true;return true;}
    const typeButtons=VISIBLE_CONTEXT_OPTIONS.map(accountTypeChoice).join('');
    host.hidden=false;
    host.innerHTML=`<section class="k-context-card"><header><span>ТИП АККАУНТА</span><small>${esc(accountTypeSummary())}</small></header><div class="k-context-buttons" role="list" aria-label="Типы аккаунта">${typeButtons}</div><div class="k-context-account-note">Клиент и Мастер используют один номер телефона.</div>${state.error?`<button class="k-context-error" type="button" data-context-retry>${esc(state.error)} · повторить</button>`:''}</section>`;
    return true;
  }

  function has(capability){return window.KaretaIdentity?.has?.(capability)===true;}

  window.addEventListener('kareta:identity-ready',event=>sync(event.detail));
  window.addEventListener('kareta:identity-anonymous',()=>sync(window.KaretaIdentity?.snapshot?.()||{}));
  window.addEventListener('kareta:capabilities-changed',event=>sync(event.detail));
  window.addEventListener('kareta:context-changed',event=>sync(event.detail?.identity||window.KaretaIdentity?.snapshot?.()||{}));
  window.addEventListener('kareta:session-confirmed',event=>{
    const detail=event.detail||{};
    state.legacyUser=detail.user||null;
    if(detail.identity?.authenticated){state.legacyMode=false;sync(detail.identity);return;}
    state.legacyMode=Boolean(detail.legacy);
    if(state.legacyMode)load({force:true,allowLegacyBridge:true});
    else sync(window.KaretaIdentity?.snapshot?.()||{});
  });
  window.addEventListener('kareta:session-anonymous',resetAnonymous);

  window.KaretaContextManager=Object.freeze({load,select,requestType,render,has,resetAnonymous,getState:()=>({...state,contexts:[...state.contexts],accountTypes:[...state.accountTypes],capabilities:[...state.capabilities],deniedCapabilities:[...state.deniedCapabilities]})});
})();
;

/* SOURCE: js/next/ui_icons.js */
(() => {
  'use strict';

  const paths = Object.freeze({
    home:'<path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V21h13V10.5"></path><path d="M9.5 21v-6h5v6"></path>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"></path>',
    oil:'<path d="M4 10h10l3 3v4H7l-3-3v-4Z"></path><path d="M8 10V7h4"></path><path d="M19 11c0 1.5-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-2.5-2-4Z"></path>',
    battery:'<rect x="4" y="7" width="16" height="12" rx="2"></rect><path d="M8 7V4h3v3M14 7V4h3v3M8 13h4M10 11v4M15 13h2"></path>',
    brakes:'<circle cx="11" cy="12" r="7"></circle><circle cx="11" cy="12" r="2.5"></circle><path d="M16.5 7.5c2 1 3.5 2.9 3.5 5.2 0 2.1-1.2 4-3 5.1l-2.2-3.5a3.3 3.3 0 0 0 0-4.8l1.7-2Z"></path>',
    tires:'<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="M9 4.6 7.4 8M15 4.6 16.6 8M19.4 9l-3.4 1.5M4.6 9 8 10.5M19.4 15 16 13.5M4.6 15 8 13.5M9 19.4 10.5 16M15 19.4 13.5 16"></path>',
    suspension:'<path d="m7 20 10-16"></path><path d="m9.2 17.2 5.6-8.4"></path><path d="M8.5 6.5 17 12M7 9l8.5 5.5M5.5 11.5 14 17"></path><circle cx="6" cy="20" r="2"></circle><circle cx="18" cy="4" r="2"></circle>',
    paint:'<path d="M4 8h9l3 3-4 4H8l-4-3V8Z"></path><path d="M13 10h5l2 2M7 15l-2 5"></path><circle cx="18.5" cy="16.5" r="1"></circle>',
    airFilter:'<rect x="4" y="6" width="16" height="12" rx="2"></rect><path d="M7 8v8M10 8v8M13 8v8M16 8v8"></path>',
    sparkPlug:'<path d="M10 3h4v5h-4zM9 8h6l-1 5h-4L9 8Z"></path><path d="M10 13h4v5h-4zM12 18v3M9 21h6"></path>',
    serviceStation:'<path d="M3 10 12 4l9 6v10H3V10Z"></path><path d="M7 20v-6h10v6M8 10h8M9 17h6"></path>',
    engine:'<path d="M5 9h4l2-3h5l2 3h2v8h-3l-2 2H9l-2-2H4v-6h1V9Z"></path><path d="M11 6V4h4v2M4 12H2v4h2M20 11h2v5h-2"></path>',
    wash:'<path d="M12 3c-4 5.2-7 8.6-7 12a7 7 0 0 0 14 0c0-3.4-3-6.8-7-12Z"></path><path d="M9 16c.8 1.5 2 2.3 3.8 2.3"></path>',
    climate:'<circle cx="12" cy="12" r="2.2"></circle><path d="M12 3c2 0 3 2.2 2 5l-2 4M21 12c0 2-2.2 3-5 2l-4-2M12 21c-2 0-3-2.2-2-5l2-4M3 12c0-2 2.2-3 5-2l4 2"></path>',
    lighting:'<path d="M9 4h6l4 4v8l-4 4H9l-4-4V8l4-4Z"></path><path d="M9 8h6M9 12h6M9 16h6"></path>',
    glass:'<path d="M5 6h14l-2 12H7L5 6Z"></path><path d="M8 9h8M9 13h6"></path>',
    services:'<path d="M14.5 6.5a4 4 0 0 1-5 5L4 17l3 3 5.5-5.5a4 4 0 0 1 5-5l-3 3-3-3 3-3Z"></path>',
    diagnostics:'<circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path><path d="M7.5 11h2l1.2-3 2.3 6 1.2-3H16"></path>',
    community:'<circle cx="8" cy="9" r="3"></circle><circle cx="16" cy="9" r="3"></circle><path d="M2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0"></path>',
    masters:'<circle cx="12" cy="8" r="4"></circle><path d="M5 21a7 7 0 0 1 14 0"></path><path d="m17.5 5.5 1 1 2-2"></path>',
    parts:'<path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"></path><path d="M4 7l8 4 8-4M12 11v10"></path>',
    cart:'<circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle><path d="M3 4h2l2.2 10h10.9l2-7H6.1M8 17h10"></path>',
    camera:'<path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z"></path><circle cx="12" cy="13" r="3.5"></circle>',
    heart:'<path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"></path>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path>',
    comment:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"></path>',
    share:'<path d="M12 3v12m0-12 4 4m-4-4L8 7"></path><path d="M5 12v7h14v-7"></path>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"></path>',
    message:'<path d="M4 5h16v12H8l-4 3V5Z"></path><path d="M8 9h8M8 13h5"></path>',
    chats:'<path d="M4 5h16v12H8l-4 3V5Z"></path><path d="M8 9h8M8 13h5"></path>',
    bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8Z"></path><path d="M10 20a2 2 0 0 0 4 0"></path>',
    car:'<path d="M5 14V10l2-4h10l2 4v4"></path><path d="M6 14h12"></path><circle cx="8" cy="17" r="2"></circle><circle cx="16" cy="17" r="2"></circle>',
    following:'<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path><path d="M2 21a6 6 0 0 1 12 0"></path><path d="M17 8v6M14 11h6"></path>',
    user:'<circle cx="12" cy="8" r="4"></circle><path d="M5 21a7 7 0 0 1 14 0"></path>',
    settings:'<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>',
    more:'<circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle>',
    view:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
    search:'<circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path>',
    grid:'<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect>',
    news:'<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path>',
    work:'<path d="M14.5 6.5a4 4 0 0 1-5 5L4 17l3 3 5.5-5.5a4 4 0 0 1 5-5l-3 3-3-3 3-3Z"></path>',
    product:'<path d="M4 8h16l-1 12H5L4 8Z"></path><path d="M8 8a4 4 0 0 1 8 0"></path>',
    plus:'<path d="M12 5v14M5 12h14"></path>',
    check:'<path d="m5 12 4 4L19 6"></path>',
    close:'<path d="M6 6l12 12M18 6 6 18"></path>',
    send:'<path d="M22 2 11 13"></path><path d="m22 2-7 20-4-9-9-4 20-7Z"></path>',
    chevronRight:'<path d="m9 18 6-6-6-6"></path>',
    chevronLeft:'<path d="m15 18-6-6 6-6"></path>',
    edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"></path><path d="m13 7 4 4"></path>',
    trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"></path>',
    filter:'<path d="M4 6h16M7 12h10M10 18h4"></path>',
    sort:'<path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"></path>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4M16 3v4M4 10h16"></path>',
    orders:'<rect x="6" y="3" width="12" height="18" rx="2"></rect><path d="M9 8h6M9 12h6M9 16h4"></path>',
    exchange:'<path d="M4 7h13"></path><path d="m14 4 3 3-3 3"></path><path d="M20 17H7"></path><path d="m10 14-3 3 3 3"></path>',
    clock:'<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"></path>',
    store:'<path d="M4 9h16l-1-5H5L4 9Z"></path><path d="M5 9v11h14V9M9 20v-6h6v6"></path>',
    warehouse:'<path d="M3 10 12 4l9 6v10H3V10Z"></path><path d="M7 13h10M7 17h10"></path>',
    finance:'<rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M3 10h18M7 15h3"></path>',
    crm:'<circle cx="9" cy="8" r="3"></circle><path d="M3 20a6 6 0 0 1 12 0"></path><path d="M16 8h5M18.5 5.5v5"></path>',
    location:'<path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle>',
    phone:'<path d="M7 4h3l1.5 4-2 1.2a12 12 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2.2 2C10.5 19.5 4.5 13.5 4 6.2A2 2 0 0 1 7 4Z"></path>',
    warning:'<path d="M12 3 2 21h20L12 3Z"></path><path d="M12 9v5M12 18h.01"></path>',
    info:'<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path>',
    help:'<circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1.2.9-1.2 1.7v.5M12 17h.01"></path>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
    unlock:'<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 7-2"></path>',
    scale:'<path d="M12 3v18M7 6h10M5 6l-3 6h6L5 6Zm14 0-3 6h6l-3-6ZM8 21h8"></path>',
    truck:'<path d="M3 6h11v11H3V6Zm11 4h4l3 3v4h-7v-7Z"></path><circle cx="7" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle>',
    refresh:'<path d="M20 7v5h-5"></path><path d="M18.2 16a8 8 0 1 1 .8-8l1 4"></path>',
    document:'<path d="M6 3h8l4 4v14H6V3Z"></path><path d="M14 3v5h5M9 12h6M9 16h6"></path>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m4 18 5-5 4 4 2-2 5 5"></path>'
  });

  const routeIcons = Object.freeze({
    home:'home',platform:'grid',corePlatform:'grid',calendarBooking:'calendar',finance:'finance',market:'warehouse',crm:'crm',identityMigration:'refresh',
    adminUsers:'community',adminOrganizations:'store',adminMonitoring:'view',adminManagement:'settings',services:'services',news:'news',masterNews:'news',masterNewsCreate:'plus',masterNewsEdit:'edit',
    works:'community',community:'community',masterExchange:'exchange',profile:'user',following:'following',realWorks:'work',workDetail:'work',serviceManagement:'services',masters:'masters',masterDashboard:'work',masterSchedule:'calendar',masterOnboarding:'user',masterProfileOwner:'user',masterWallOwner:'community',masterWorks:'work',masterReviews:'comment',stoDashboard:'store',
    parts:'parts',usedParts:'exchange',seller:'store',sellerProducts:'parts',sellerOrders:'orders',orders:'orders',workflow:'work',requestNew:'plus',workOrder:'orders',vehicle:'car',chats:'chats',notifications:'bell',cabinet:'user',
    cabinetGarage:'car',cabinetData:'user',cabinetHistory:'refresh',cabinetDocuments:'document',cabinetPromos:'product',cabinetTariff:'finance',cabinetSettings:'settings',about:'info',rules:'check',help:'help',assistant:'plus',
    privacy:'lock',contacts:'phone',lawyer:'scale',towTruck:'truck',productDetail:'parts',serviceDetail:'services',providerDetail:'masters',providerBooking:'calendar',providerReviews:'comment'
  });

  const normalize = name => ({cabinet:'user',garage:'car',data:'user',history:'refresh',promo:'product',tariff:'finance',notifications:'bell',likes:'heart',comments:'comment',save:'bookmark',next:'chevronRight',chevron:'chevronRight',users:'community',organization:'store',monitor:'view',dashboard:'grid',database:'warehouse',layers:'grid',categories:'grid',category:'grid',shield:'check',key:'settings',core:'grid',documents:'document',master:'masters',mechanic:'masters',wrench:'services',tools:'services',service:'services',box:'parts',clipboard:'orders',mapPin:'location',oilChange:'oil',brake:'brakes',wheel:'tires',tire:'tires',tyres:'tires',shock:'suspension',airfilter:'airFilter',air_filter:'airFilter',spark:'sparkPlug',spark_plug:'sparkPlug',sto:'serviceStation',station:'serviceStation',painting:'paint',diagnostic:'diagnostics'}[name] || name);
  const categoryIcon = (value='', fallback='services') => {
    const raw=String(value||'').trim().toLowerCase().replace(/ё/g,'е');
    if(!raw)return normalize(fallback);
    if(/maintenance|тех.*обслуж|(^|[^а-яa-z])то([^а-яa-z]|$)|замен.*масл|масл|oil/.test(raw))return 'oil';
    if(/diagnostic|диагност/.test(raw))return 'diagnostics';
    if(/wash|мойк|детейл|detailing|химчист/.test(raw))return 'wash';
    if(/engine|двигател|мотор|fuel|топлив|exhaust|выхлоп/.test(raw))return 'engine';
    if(/cooling|heating|climate|охлажд|отоплен|кондицион/.test(raw))return 'climate';
    if(/transmission|трансмисс|сцеплен|кпп|коробк/.test(raw))return 'services';
    if(/suspension|steering|ходов|подвес|рулев|амортиз|стойк/.test(raw))return 'suspension';
    if(/brake|тормоз|колод/.test(raw))return 'brakes';
    if(/tire|tyre|шин|колес|развал|схожд|alignment/.test(raw))return 'tires';
    if(/electrical|электр|акб|аккум|battery/.test(raw))return 'battery';
    if(/lighting|освещ|фар|свет/.test(raw))return 'lighting';
    if(/multimedia|security|мультимед|автозвук|сигнал|безопас/.test(raw))return 'lock';
    if(/body|кузов|свар|paint|маляр|окрас/.test(raw))return 'paint';
    if(/glass|стекл|лобов/.test(raw))return 'glass';
    if(/filter|фильтр/.test(raw))return 'airFilter';
    if(/spark|свеч/.test(raw))return 'sparkPlug';
    if(/service station|workshop|сто|сервис/.test(raw))return 'serviceStation';
    return normalize(fallback);
  };
  const svg = (name, options={}) => {
    const key=normalize(name), body=paths[key] || paths.warning;
    const cls=options.className?` class="${String(options.className)}"`:'';
    return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  };
  const icon = (name, className='k-ui-icon') => `<span class="${className}" data-icon="${normalize(name)}" aria-hidden="true">${svg(name)}</span>`;
  const routeName = routeKey => routeIcons[String(routeKey)] || 'warning';
  const routeSvg = (routeKey, options={}) => svg(routeName(routeKey), options);
  const action = (name, label, value='') => `${icon(name)}<span>${label}</span>${value!==''?`<b>${value}</b>`:''}`;
  window.KaretaUIIcons=Object.freeze({svg,icon,routeSvg,routeName,action,categoryIcon,has:name=>Object.hasOwn(paths,normalize(name)),normalize,names:Object.freeze(Object.keys(paths)),routeNames:routeIcons});
})();
;

/* SOURCE: js/next/visual_assets.js */
(() => {
  'use strict';
  const base='/assets/reference';
  const ready=document.documentElement.dataset.referenceAssets==='1';
  const ext=document.documentElement.dataset.referenceAssetsExt||'png';
  const asset=(group,name)=>`${base}/${group}/${name}.${ext}`;

  const automotive=Object.freeze({
    toyota_camry:asset('automotive','toyota_camry'),lexus_is:asset('automotive','lexus_is'),
    kia_sedan:asset('automotive','kia_sedan'),hyundai_tucson:asset('automotive','hyundai_tucson'),
    brake_discs:asset('automotive','brake_discs'),oil_filters:asset('automotive','oil_filters'),
    brake_pads:asset('automotive','brake_pads'),shock_absorber:asset('automotive','shock_absorber'),
    air_filter:asset('automotive','air_filter'),spark_plugs:asset('automotive','spark_plugs'),
    service_station:asset('automotive','service_station')
  });

  const brands=Object.freeze({
    toyota:'Toyota',lexus:'Lexus',kia:'Kia',hyundai:'Hyundai',bmw:'BMW',mercedes_benz:'Mercedes-Benz',audi:'Audi',
    volkswagen:'Volkswagen',nissan:'Nissan',honda:'Honda',mazda:'Mazda',subaru:'Subaru',mitsubishi:'Mitsubishi',ford:'Ford',
    chevrolet:'Chevrolet',tesla:'Tesla',porsche:'Porsche',land_rover:'Land Rover',range_rover:'Range Rover',volvo:'Volvo',skoda:'Skoda',
    renault:'Renault',peugeot:'Peugeot',chery:'Chery',haval:'Haval',geely:'Geely',byd:'BYD',suzuki:'Suzuki',
    jeep:'Jeep',cadillac:'Cadillac',infiniti:'Infiniti',mini:'Mini',jaguar:'Jaguar',fiat:'Fiat',citroen:'Citroen',opel:'Opel'
  });

  const key=v=>String(v||'').trim().toLowerCase().replace(/ё/g,'е').replace(/mercedes(?:-benz)?/,'mercedes_benz').replace(/land\s*rover/,'land_rover').replace(/range\s*rover/,'range_rover').replace(/[^a-z0-9_]+/g,'_').replace(/^_|_$/g,'');
  const brandLogo=v=>{const k=key(v);return ready&&Object.hasOwn(brands,k)?asset('brands',k):''};

  const vehicleFallback=Object.freeze({
    toyota:'/assets/vehicles/toyota_camry_r62u.svg',
    kia:'/assets/vehicles/kia_rio_r62u.svg',
    hyundai:'/assets/vehicles/hyundai_tucson_r62u.svg'
  });
  const vehicleImage=v=>{
    const k=key(v);
    if(ready)return ({toyota:automotive.toyota_camry,lexus:automotive.lexus_is,kia:automotive.kia_sedan,hyundai:automotive.hyundai_tucson})[k]||'';
    return vehicleFallback[k]||'';
  };

  const partImage=v=>{
    if(!ready)return '';
    const k=key(v);
    if(/brake.*pad|pad.*brake|колод/.test(k))return automotive.brake_pads;
    if(/brake|тормоз/.test(k))return automotive.brake_discs;
    if(/oil.*filter|масл.*фильтр/.test(k))return automotive.oil_filters;
    if(/air.*filter|воздуш.*фильтр/.test(k))return automotive.air_filter;
    if(/spark|свеч/.test(k))return automotive.spark_plugs;
    if(/suspension|shock|амортиз|ходов/.test(k))return automotive.shock_absorber;
    return '';
  };

  window.KaretaVisualAssets=Object.freeze({
    ready,base,automotive,brands,key,brandLogo,vehicleImage,partImage,
    stationImage:ready?automotive.service_station:''
  });
})();
;

/* SOURCE: js/next/reference_client_shell.js */
(() => {
  'use strict';

  function ensureClientNotificationControl(){
    const actions=document.querySelector('#k-shell-header > .k-shell-actions');
    if(!actions||document.getElementById('k-header-notifications'))return;
    const link=document.createElement('a');
    link.id='k-header-notifications';
    link.className='k-header-notifications';
    link.href='#/notifications';
    link.setAttribute('aria-label','Уведомления');
    link.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8Z"></path><path d="M10 20a2 2 0 0 0 4 0"></path></svg>';
    actions.insertBefore(link,actions.firstChild);
  }

  function ensureClientLocationIcon(){
    const header=document.querySelector('#k-shell-header');
    const actions=header?.querySelector(':scope > .k-shell-actions');
    if(!header||!actions)return;
    let button=header.querySelector('[data-shell-location-icon]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='k-shell-location-icon';
      button.setAttribute('data-shell-location-icon','');
      button.setAttribute('aria-label','Город: Усть-Каменогорск');
      button.title='Усть-Каменогорск';
      button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"></path><circle cx="12" cy="10" r="2.2"></circle></svg><span class="k-shell-location-label" data-shell-city>Усть-Каменогорск</span>';
    }
    if(button.parentElement!==actions)actions.insertBefore(button,actions.firstChild);
    if(button.dataset.bound==='1')return;
    button.dataset.bound='1';
    button.addEventListener('click',()=>{
      const open=()=>document.querySelector('[data-home-location-button]')?.click();
      if(String(location.hash||'').startsWith('#/home'))open();
      else{location.hash='#/home';window.setTimeout(open,180);}
    });
  }

  function ensureFrozenClientHeaderAddons(){
    ensureClientNotificationControl();
    ensureClientLocationIcon();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureFrozenClientHeaderAddons,{once:true});
  else ensureFrozenClientHeaderAddons();
  window.addEventListener('kareta:interface-context-changed',ensureFrozenClientHeaderAddons);
})();
;

window.KaretaBootProfiler?.bundleEnd?.("runtime_identity_bundle");
