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

  // Selected Tabler Icons v3.48.0 (MIT). The SVG sprite is requested only when used.
  const thematicNames = Object.freeze(["tabler:tools","tabler:tool","tabler:engine","tabler:gas-station","tabler:battery-automotive","tabler:car","tabler:car-garage","tabler:car-crane","tabler:device-desktop","tabler:device-heart-monitor","tabler:wave-sine","tabler:bolt","tabler:plug-connected","tabler:temperature","tabler:snowflake","tabler:air-conditioning","tabler:wind","tabler:hammer","tabler:paint","tabler:spray","tabler:brush","tabler:disc","tabler:steering-wheel","tabler:ruler-measure","tabler:shield-check","tabler:car-fan","tabler:bulb","tabler:glass","tabler:wash-machine","tabler:bucket","tabler:photo","tabler:package","tabler:check","tabler:settings","tabler:filter","tabler:search","tabler:flame","tabler:gauge","tabler:wiper"]);
  const thematicKeys = new Set(thematicNames);
  const thematicBody = key => thematicKeys.has(key)
    ? `<use href="assets/icons/tabler/sprite-v3.48.0.svg#${key.slice(7)}"></use>`
    : '';

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
  // One thematic icon ID per canonical service category; menu/category aliases remain unchanged.
  const serviceThemes = Object.freeze({"maintenance":"tabler:tool","diagnostics":"tabler:device-desktop","diagnostic":"tabler:device-desktop","diag":"tabler:device-desktop","wash":"tabler:wash-machine","detailing":"tabler:brush","engine":"tabler:engine","fuel":"tabler:gas-station","cooling_heating":"tabler:temperature","climate":"tabler:snowflake","exhaust":"tabler:wind","transmission":"tabler:tools","suspension_steering":"tabler:steering-wheel","chassis":"tabler:steering-wheel","suspension":"tabler:steering-wheel","electrical":"tabler:bolt","electric":"tabler:bolt","lighting":"tabler:bulb","multimedia_security":"tabler:shield-check","security":"tabler:shield-check","audio":"tabler:device-desktop","brakes":"tabler:disc","tires":"tabler:disc","alignment":"tabler:ruler-measure","body_welding":"tabler:hammer","body":"tabler:hammer","paint":"tabler:paint","glass":"tabler:glass"});
  const serviceName = category => serviceThemes[String(category||'').trim().toLowerCase()] || 'tabler:tool';
  const svg = (name, options={}) => {
    const key=normalize(name), body=paths[key] || thematicBody(key) || paths.warning;
    const cls=options.className?` class="${String(options.className)}"`:'';
    return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  };
  const icon = (name, className='k-ui-icon') => `<span class="${className}" data-icon="${normalize(name)}" aria-hidden="true">${svg(name)}</span>`;
  const routeName = routeKey => routeIcons[String(routeKey)] || 'warning';
  const routeSvg = (routeKey, options={}) => svg(routeName(routeKey), options);
  const action = (name, label, value='') => `${icon(name)}<span>${label}</span>${value!==''?`<b>${value}</b>`:''}`;
  window.KaretaUIIcons=Object.freeze({svg,icon,routeSvg,routeName,action,categoryIcon,serviceName,has:name=>Object.hasOwn(paths,normalize(name))||thematicKeys.has(normalize(name)),normalize,names:Object.freeze([...Object.keys(paths),...thematicNames]),routeNames:routeIcons});
})();
