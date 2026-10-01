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
    parts:Object.freeze({ path:'#/parts', label:'Запчасти', icon:'▣' }),
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
