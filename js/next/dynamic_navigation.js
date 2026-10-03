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
    { key:'assistant', section:'work', menu:63.2, contextProfiles:['master'], allowOrganization:true },
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
