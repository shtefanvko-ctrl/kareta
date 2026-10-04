(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  const catalogState = window.KaretaCatalogState;
  const cards=window.KaretaCatalogCards;
  if (!ui) throw new Error('KaretaPageUI is required before pages/services.js');
  if (!catalogState) throw new Error('KaretaCatalogState is required before pages/services.js');
  if (!cards) throw new Error('KaretaCatalogCards is required before pages/services.js');

  const CATEGORY_FALLBACK = Object.freeze({
    maintenance:'Техническое обслуживание', diagnostics:'Диагностика', wash:'Автомойка', detailing:'Детейлинг', engine:'Двигатель', fuel:'Топливная система',
    cooling_heating:'Охлаждение и отопление', climate:'Кондиционеры', exhaust:'Выхлопная система',
    transmission:'Трансмиссия и сцепление', suspension_steering:'Ходовая и рулевое', electrical:'Автоэлектрика',
    lighting:'Освещение', multimedia_security:'Автозвук и безопасность', brakes:'Тормозная система', tires:'Шиномонтаж', alignment:'Развал-схождение',
    body_welding:'Кузовные и сварочные работы', paint:'Малярные работы', glass:'Автостёкла', workshop:'Дополнительные работы', other:'Другое',
  });
  const SERVICE_GROUPS = Object.freeze([
    { key:'care', name:'Обслуживание и диагностика', icon:'diagnostics', text:'Регламентные работы, осмотр и поиск неисправностей', categories:['maintenance','diagnostics'] },
    { key:'clean', name:'Мойка и детейлинг', icon:'wash', text:'Быстрая мойка, уход за салоном, кузовом и защитные покрытия', categories:['wash','detailing'] },
    { key:'powertrain', name:'Двигатель и трансмиссия', icon:'engine', text:'Силовой агрегат, топливо, охлаждение и выхлоп', categories:['engine','fuel','cooling_heating','exhaust','transmission'] },
    { key:'control', name:'Ходовая, тормоза и колёса', icon:'suspension', text:'Подвеска, рулевое, тормоза, шиномонтаж и геометрия колёс', categories:['suspension_steering','brakes','tires','alignment'] },
    { key:'electric', name:'Электрика и оснащение', icon:'battery', text:'Автоэлектрика, освещение, мультимедиа и безопасность', categories:['electrical','lighting','multimedia_security'] },
    { key:'comfort', name:'Комфорт и оснащение', icon:'climate', text:'Климат, мультимедиа и дополнительное оборудование', categories:['climate','multimedia_security'] },
    { key:'body', name:'Кузов, окраска и стёкла', icon:'paint', text:'Кузовные, сварочные, малярные работы и автостёкла', categories:['body_welding','paint','glass','workshop','other'] },
  ]);

  let categoryMeta = new Map();
  let view = { search:'', group:null, category:null };
  let unsubscribe = null;

  function routeState(){
    const hash=String(location.hash||'#/services').split('?')[0];
    let match=hash.match(/^#\/services\/group\/([^/]+)$/);
    if(match){
      const groupKey=decodeURIComponent(match[1]);
      return {group:SERVICE_GROUPS.some(item=>item.key===groupKey)?groupKey:null,category:null};
    }
    match=hash.match(/^#\/services\/category\/([^/]+)$/);
    if(match){
      const category=decodeURIComponent(match[1]);
      const group=SERVICE_GROUPS.find(item=>item.categories.includes(category));
      return {group:group?.key||null,category};
    }
    return {group:null,category:null};
  }
  function groupUrl(key){ return `#/services/group/${encodeURIComponent(key)}`; }
  function categoryUrl(key){ return `#/services/category/${encodeURIComponent(key)}`; }
  function isServicesRoot(){ return String(location.hash||'#/services').split('?')[0]==='#/services'; }

  const categoryLabel = key => categoryMeta.get(String(key || 'other'))?.name || CATEGORY_FALLBACK[key] || String(key || 'other').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
  const categoryIcon = key => window.KaretaUIIcons?.categoryIcon?.(`${String(key||'')} ${categoryLabel(key)}`,'services') || 'services';
  const money = value => Number(value || 0) > 0 ? `${new Intl.NumberFormat('ru-RU').format(Number(value))} ₸` : 'Цена по осмотру';
  const servicePrice = service => service.minOfferPrice > 0 ? `от ${money(service.minOfferPrice)}` : service.priceLabel || money(service.basePrice);
  const serviceTime = service => service.timeLabel || service.avgTime || 'По согласованию';

  function serviceCard(service){ return cards.service(service,{name:categoryLabel(service.category),icon:categoryIcon(service.category)}); }
  function referenceServiceAsCategoryCard(service){
    const href=`#/services/item/${encodeURIComponent(service.id)}`;
    const key=String(service.category||view.category||'other');
    const meta=[servicePrice(service),serviceTime(service)].filter(Boolean).join(' · ');
    return `<a class="k-services-ref-card k-services-ref-card--category k-services-ref-card--service-category" href="${href}" data-service-id="${ui.escHtml(service.id)}"><span class="k-services-ref-card__icon">${referenceServiceIcon(categoryIconKind(key))}</span><b>${ui.escHtml(service.name||'Услуга')}</b><small>${ui.escHtml(service.shortDesc||service.whyText||categoryLabel(key))}</small><span class="k-services-ref-card__count">${ui.escHtml(meta||'Подробнее')}</span><span class="k-services-ref-card__arrow" aria-hidden="true">›</span></a>`;
  }
  function useCategoryVisualForServices(){
    const category=String(view.category||'');
    return category==='diagnostics'||['body_welding','paint','glass','workshop','other'].includes(category)||view.group==='body';
  }




  function closeHotDealModal(){
    const modal=document.querySelector('[data-hot-deal-modal-root]');
    if(!modal)return;
    modal.classList.remove('is-open');
    document.body.classList.remove('k-modal-open');
    window.setTimeout(()=>modal.remove(),180);
  }

  function openHotDealModal(button){
    if(!button?.dataset?.hotDealModal)return false;
    closeHotDealModal();
    const title=button.dataset.dealTitle||button.dataset.serviceName||'Бронирование услуги';
    const subtitle=button.dataset.dealSubtitle||'';
    const description=button.dataset.dealDescription||'';
    const price=button.dataset.dealPrice||'';
    const oldPrice=button.dataset.dealOldPrice||'';
    const time=button.dataset.dealTime||'По согласованию';
    const modal=document.createElement('div');
    modal.className='k-hot-deal-modal';
    modal.dataset.hotDealModalRoot='1';
    modal.innerHTML=`<div class="k-hot-deal-modal__backdrop" data-hot-deal-modal-close></div><section class="k-hot-deal-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="k-hot-deal-modal-title"><button type="button" class="k-hot-deal-modal__close" data-hot-deal-modal-close aria-label="Закрыть">×</button><span class="k-hot-deal-modal__eyebrow">БРОНИРОВАНИЕ ОКНА</span><h2 id="k-hot-deal-modal-title">${ui.escHtml(title)}</h2>${subtitle?`<p class="k-hot-deal-modal__subtitle">${ui.escHtml(subtitle)}</p>`:''}<div class="k-hot-deal-modal__meta"><span>⏱ ${ui.escHtml(time)}</span><strong>${ui.escHtml(price)}</strong>${oldPrice?`<s>${ui.escHtml(oldPrice)}</s>`:''}</div><div class="k-hot-deal-modal__description"><h3>Описание и условия</h3><p>${ui.escHtml(description||'Подробности услуги и окончательная стоимость будут подтверждены мастером перед началом работ.')}</p></div><div class="k-hot-deal-modal__actions"><button type="button" class="k-btn" data-hot-deal-modal-close>Отмена</button><button type="button" class="k-btn k-btn-primary" data-hot-deal-modal-confirm>Перейти к бронированию</button></div></section>`;
    modal.addEventListener('click',event=>{
      if(event.target.closest('[data-hot-deal-modal-close]')){closeHotDealModal();return;}
      if(!event.target.closest('[data-hot-deal-modal-confirm]'))return;
      try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:button.dataset.serviceName||title,category:button.dataset.serviceCategory||'',promotion:true,description,source:'services_promotion'}));}catch(_e){}
      closeHotDealModal();
      if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
    });
    document.body.appendChild(modal);
    document.body.classList.add('k-modal-open');
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    modal.querySelector('.k-hot-deal-modal__close')?.focus();
    return true;
  }

  function hotDealsBlock(){
    const deals=[
      {badge:'СВОБОДНЫЙ ЧАС',title:'Быстрая мойка сейчас',subtitle:'Свободный пост на ближайший час',price:'от 3 490 ₸',old:'4 900 ₸',time:'45 минут',note:'Опоздание более чем на 10 минут — доплата 500 ₸ за каждые следующие 10 минут.',service:'Быстрая мойка по свободному часу',category:'wash',theme:'wash',icon:'wash'},
      {badge:'−35% СЕГОДНЯ',title:'Экспресс-диагностика',subtitle:'Компьютер + визуальная проверка',price:'5 900 ₸',old:'9 000 ₸',time:'30 минут',note:'Фиксированная цена действует только в выбранное окно записи.',service:'Экспресс-диагностика по акции',category:'diagnostics',theme:'diagnostics',icon:'diagnostics'},
      {badge:'ПОСЛЕДНЕЕ ОКНО',title:'Химчистка одного ряда',subtitle:'Сиденья и локальные загрязнения',price:'от 7 900 ₸',old:'11 500 ₸',time:'60 минут',note:'Точная стоимость зависит от материала и степени загрязнения.',service:'Экспресс-химчистка салона',category:'detailing',theme:'detail',icon:'wash'},
      {badge:'−25% ДО 18:00',title:'Проверка ходовой',subtitle:'Люфты, стойки, шаровые и ступицы',price:'3 900 ₸',old:'5 200 ₸',time:'25 минут',note:'При последующем ремонте стоимость проверки засчитывается в заказ.',service:'Быстрая диагностика ходовой',category:'suspension_steering',theme:'suspension',icon:'suspension'}
    ];
    return `<section class="k-hot-deals" aria-labelledby="k-hot-deals-title"><div class="k-hot-deals__head"><div><span>ГОРЯЧИЕ СКИДКИ</span><h2 id="k-hot-deals-title">Свободные окна прямо сейчас</h2><p>Цена снижена, пока у мастера или мойки есть свободное время.</p></div><div class="k-hot-deals__controls"><button type="button" data-hot-deals-prev aria-label="Предыдущая акция">←</button><button type="button" data-hot-deals-next aria-label="Следующая акция">→</button></div></div><div class="k-hot-deals__viewport" data-hot-deals-viewport><div class="k-hot-deals__track">${deals.map((deal,index)=>`<article class="k-hot-deal k-hot-deal--${ui.escHtml(deal.theme)}"><div class="k-hot-deal__top"><span class="k-hot-deal__badge">${ui.escHtml(deal.badge)}</span><span class="k-hot-deal__live"><i></i> доступно</span></div><div class="k-hot-deal__main"><div class="k-hot-deal__icon" aria-hidden="true">${referenceServiceIcon(deal.icon)}</div><div class="k-hot-deal__summary"><h3>${ui.escHtml(deal.title)}</h3><p>${ui.escHtml(deal.subtitle)}</p></div></div><div class="k-hot-deal__meta"><div class="k-hot-deal__price"><strong>${ui.escHtml(deal.price)}</strong><s>${ui.escHtml(deal.old)}</s></div><div class="k-hot-deal__facts"><span>⏱ ${ui.escHtml(deal.time)}</span><span>№ ${index+1}</span></div></div><button type="button" class="k-btn k-btn-primary" data-hot-deal-book data-hot-deal-modal="1" data-deal-title="${ui.escHtml(deal.title)}" data-deal-subtitle="${ui.escHtml(deal.subtitle)}" data-deal-description="${ui.escHtml(deal.note)}" data-deal-price="${ui.escHtml(deal.price)}" data-deal-old-price="${ui.escHtml(deal.old)}" data-deal-time="${ui.escHtml(deal.time)}" data-service-name="${ui.escHtml(deal.service)}" data-service-category="${ui.escHtml(deal.category)}">Забронировать окно</button></article>`).join('')}</div></div><div class="k-hot-deals__foot"><span>Условия фиксируются в приложении при бронировании.</span><b>Количество окон ограничено</b></div></section>`;
  }

  function serviceBundlesBlock(){
    const bundles=[
      {label:'3 ПО ЦЕНЕ 2',title:'Полная диагностика',items:['Компьютерная диагностика','Дымогенератор','Проверка давления топлива'],price:'12 900 ₸',old:'19 500 ₸',save:'Экономия 6 600 ₸',service:'Комплект: 3 диагностики по цене 2',category:'diagnostics',icon:'diagnostics'},
      {label:'КОМПЛЕКС',title:'Подготовка к сезону',items:['Проверка жидкостей','Диагностика ходовой','Проверка аккумулятора'],price:'9 900 ₸',old:'14 700 ₸',save:'Экономия 4 800 ₸',service:'Комплект: подготовка к сезону',category:'maintenance',icon:'oil'},
      {label:'МОЙКА + УХОД',title:'Чистый автомобиль',items:['Кузов и коврики','Пылесос салона','Чернение шин'],price:'6 900 ₸',old:'9 500 ₸',save:'Экономия 2 600 ₸',service:'Комплект: чистый автомобиль',category:'wash',icon:'wash'},
      {label:'ДЕТЕЙЛИНГ',title:'Защита кузова',items:['Двухфазная мойка','Очистка кузова','Твёрдый воск'],price:'17 900 ₸',old:'24 000 ₸',save:'Экономия 6 100 ₸',service:'Комплект: защита кузова',category:'detailing',icon:'paint'}
    ];
    return `<section class="k-service-bundles" aria-labelledby="k-service-bundles-title" data-service-bundles><div class="k-service-bundles__head"><div><span>КОМПЛЕКТЫ УСЛУГ</span><h2 id="k-service-bundles-title">Больше работ — меньше цена</h2><p>Готовые наборы с фиксированным составом и понятной экономией.</p></div><div class="k-service-bundles__controls"><button type="button" class="k-service-bundles__prev" aria-label="Предыдущий комплект">←</button><button type="button" class="k-service-bundles__next" aria-label="Следующий комплект">→</button></div></div><div class="swiper k-service-bundles__slider" data-service-bundles-slider><div class="swiper-wrapper k-service-bundles__grid">${bundles.map(bundle=>`<article class="swiper-slide k-service-bundle"><div class="k-service-bundle__label">${ui.escHtml(bundle.label)}</div><div class="k-service-bundle__icon">${referenceServiceIcon(bundle.icon)}</div><h3>${ui.escHtml(bundle.title)}</h3><ul>${bundle.items.map(item=>`<li>${ui.escHtml(item)}</li>`).join('')}</ul><div class="k-service-bundle__price"><strong>${ui.escHtml(bundle.price)}</strong><s>${ui.escHtml(bundle.old)}</s></div><b class="k-service-bundle__save">${ui.escHtml(bundle.save)}</b><button type="button" class="k-btn k-btn-primary" data-hot-deal-book data-service-name="${ui.escHtml(bundle.service)}" data-service-category="${ui.escHtml(bundle.category)}">Выбрать комплект</button></article>`).join('')}</div><div class="swiper-pagination k-service-bundles__pagination"></div></div></section>`;
  }

  function washDetailingBlock(){
    const groups=[
      {key:'wash',title:'Автомойка',icon:'wash',text:'Быстрые и комплексные мойки',services:['Экспресс-мойка кузова','Комплекс кузов + салон','Мойка двигателя','Мойка днища','Пылесос и коврики']},
      {key:'detailing',title:'Детейлинг',icon:'paint',text:'Глубокий уход и защита автомобиля',services:['Химчистка салона','Полировка кузова','Керамическое покрытие','Антидождь','Полировка фар']}
    ];
    return `<section class="k-wash-detailing" aria-labelledby="k-wash-detailing-title"><div class="k-wash-detailing__head"><span>НОВЫЕ КАТЕГОРИИ</span><h2 id="k-wash-detailing-title">Мойка и детейлинг</h2><p>От быстрой мойки до глубокой очистки и защиты кузова.</p></div><div class="k-wash-detailing__grid">${groups.map(group=>`<article class="k-wash-detailing-card k-wash-detailing-card--${group.key}"><div class="k-wash-detailing-card__icon">${referenceServiceIcon(group.icon)}</div><div><h3>${group.title}</h3><p>${group.text}</p></div><div class="k-wash-detailing-card__services">${group.services.map(item=>`<span>${item}</span>`).join('')}</div><button type="button" data-service-promo-category="${group.key}">Открыть категорию →</button></article>`).join('')}</div></section>`;
  }

  function selectedGroup(){ return SERVICE_GROUPS.find(group => group.key === view.group) || null; }
  function groupCount(group, snapshot){ return snapshot.serviceCategories.filter(category => group.categories.includes(category.key)).reduce((sum,category)=>sum+Number(category.count||0),0); }
  function filteredServices(snapshot){
    const query=view.search.trim().toLowerCase();
    return snapshot.services.filter(service => (!view.category || service.category===view.category) && (!query || [service.name,service.shortDesc,service.whyText].some(value=>String(value||'').toLowerCase().includes(query)))).slice(0,300);
  }

  function referenceServiceIcon(kind){
    const key=window.KaretaUIIcons?.normalize?.(kind)||String(kind||'services');
    return window.KaretaUIIcons?.svg?.(key)||window.KaretaUIIcons?.svg?.('services')||'';
  }

  function groupIconKind(key){
    return SERVICE_GROUPS.find(group=>group.key===key)?.icon||'services';
  }
  function categoryIconKind(key){
    return window.KaretaUIIcons?.categoryIcon?.(`${String(key||'')} ${categoryLabel(key)}`,'services')||'services';
  }

  function referenceGroupCard(group,snapshot){
    const count=groupCount(group,snapshot);
    return `<a class="k-services-ref-card k-services-ref-card--category" href="${groupUrl(group.key)}" data-service-group="${ui.escHtml(group.key)}"><span class="k-services-ref-card__icon">${referenceServiceIcon(groupIconKind(group.key))}</span><b>${ui.escHtml(group.name)}</b><small>${ui.escHtml(group.text)}</small><span class="k-services-ref-card__count">${count} услуг</span></a>`;
  }

  function referenceCategoryCard(category){
    const key=String(category.key||'other');
    return `<a class="k-services-ref-card k-services-ref-card--category" href="${categoryUrl(key)}" data-service-leaf="${ui.escHtml(key)}"><span class="k-services-ref-card__icon">${referenceServiceIcon(categoryIconKind(key))}</span><b>${ui.escHtml(category.name||categoryLabel(key))}</b><small>${Number(category.count||0)} услуг</small><span class="k-services-ref-card__arrow" aria-hidden="true">›</span></a>`;
  }

  function referenceTabKey(){
    if(view.category==='diagnostics')return 'diagnostics';
    if(['body_welding','paint','glass','workshop'].includes(String(view.category||''))||view.group==='body')return 'body';
    if(view.group||view.category)return 'repair';
    return 'all';
  }

  function referenceTabs(){
    const active=referenceTabKey();
    const items=[
      ['all','Все','#/services'],
      ['repair','Ремонт',groupUrl('powertrain')],
      ['diagnostics','Диагностика',categoryUrl('diagnostics')],
      ['body','Кузов',categoryUrl('body_welding')]
    ];
    return `<nav class="k-services-ref-tabs" aria-label="Навигация по услугам">${items.map(([key,label,href])=>`<a class="${active===key?'is-active':''}" href="${href}" data-services-tab="${key}" ${active===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
  }

  function referenceRootCategories(snapshot){
    const ready=snapshot.status==='ready';
    const total=ready?Number(snapshot.metrics?.services||snapshot.services.length||0):0;
    return `<div class="k-services-ref-section-head"><div><h2>Выберите услугу</h2><p>Сначала выберите направление — дальше покажем конкретные работы.</p></div>${ready?`<span>${total} услуг</span>`:''}</div>
      <div class="k-services-ref-grid k-services-ref-grid--groups" aria-label="Категории услуг">${SERVICE_GROUPS.filter((item,index,array)=>array.findIndex(x=>x.key===item.key)===index).map(group=>referenceGroupCard(group,snapshot)).join('')}</div>
      <div class="k-services-ref-actions">
        <a class="k-services-ref-btn k-services-ref-btn--outline" href="#/orders/new?mode=own_price">Своя цена</a>
        <a class="k-services-ref-btn k-services-ref-btn--primary" href="#/orders/new">Создать заявку</a>
      </div>
      <a class="k-services-ref-secondary-link" href="#/orders/new">＋ Добавить ещё услугу</a>
      <small class="k-services-ref-meta">${ready?`${total} услуг в каталоге`:(snapshot.status==='error'?'Каталог временно недоступен':'Загрузка каталога…')}</small>`;
  }

  function rootCategoriesBlock(snapshot){ return referenceRootCategories(snapshot); }

  function navigatorHead(title,text,backHref='#/services'){
    return `<div class="k-services-ref-navigator-head"><a href="${backHref}" data-service-back="${backHref==='#/services'?'root':'group'}" aria-label="Назад">‹</a><div><h2>${ui.escHtml(title)}</h2>${text?`<p>${ui.escHtml(text)}</p>`:''}</div></div>`;
  }

  function renderNavigator(snapshot,options={}){
    if(snapshot.status==='loading'||snapshot.status==='idle') return '<div class="k-services-ref-state"><h2>Загрузка каталога</h2><p>Получаем актуальный список услуг.</p></div>';
    if(snapshot.status==='error') return `<div class="k-services-ref-state"><h2>Каталог недоступен</h2><p>${ui.escHtml(snapshot.error?.message||'Ошибка загрузки')}</p></div>`;
    if(!view.group){
      const results=view.search?filteredServices(snapshot):[];
      if(view.search)return `<div class="k-services-ref-results-head"><div><h2>Результаты поиска</h2><p>По запросу «${ui.escHtml(view.search)}»</p></div><span>${results.length}</span></div>${results.length?`<section class="k-services-ref-services-grid">${results.map(serviceCard).join('')}</section>`:'<div class="k-services-ref-state"><h2>Услуги не найдены</h2><p>Попробуйте изменить запрос.</p></div>'}`;
      return options.home?hotDealsBlock():'';
    }
    const group=selectedGroup();
    if(!view.category){
      const categories=snapshot.serviceCategories.filter(category=>group?.categories.includes(category.key)&&Number(category.count)>0);
      return `${navigatorHead(group?.name||'Категории','Выберите конкретную работу.')}
        <div class="k-services-ref-grid k-services-ref-grid--categories">${categories.map(referenceCategoryCard).join('')}</div>`;
    }
    const services=filteredServices(snapshot);
    const backHref=group?groupUrl(group.key):'#/services';
    return `${navigatorHead(categoryLabel(view.category),group?.name||'Каталог услуг',backHref)}
      <div class="k-services-ref-results-head"><div><h2>${ui.escHtml(categoryLabel(view.category))}</h2><p>${view.search?`Поиск: «${ui.escHtml(view.search)}»`:'Выберите подходящую услугу.'}</p></div><span>${services.length}</span></div>
      ${services.length?`<section class="${useCategoryVisualForServices()?'k-services-ref-grid k-services-ref-grid--categories k-services-ref-grid--service-categories':'k-services-ref-services-grid'}">${services.map(useCategoryVisualForServices()?referenceServiceAsCategoryCard:serviceCard).join('')}</section>`:'<div class="k-services-ref-state"><h2>Ничего не найдено</h2><p>Измените запрос или вернитесь к категориям.</p></div>'}`;
  }

  function panel(){ return ''; }

  function toolbar(){
    const searchIcon=window.KaretaUIIcons?.svg?.('search')||'⌕';
    const submitIcon=window.KaretaUIIcons?.svg?.('chevronRight')||'›';
    return `<section class="k-services-canon-shell" aria-label="Услуги">
      <div class="k-services-canon-titlebar"><h1>Услуги</h1><a class="k-services-canon-create" href="#/orders/new">＋ Заявка</a></div>
      <div class="k-services-canon-search" role="search" aria-label="Поиск услуг">
        <span class="k-services-canon-search__icon" aria-hidden="true">${searchIcon}</span>
        <input type="search" data-services-toolbar-search value="${ui.escHtml(view.search)}" placeholder="Найти услугу, работу или категорию…" autocomplete="off" aria-label="Найти услугу">
        <button type="button" class="k-services-canon-search__submit" data-services-submit aria-label="Выполнить поиск">${submitIcon}</button>
      </div>
      <div class="k-services-canon-filters" data-services-tabs>${referenceTabs()}</div>
    </section>`;
  }

  function renderServices(context){
    const route=routeState();
    view={search:'',group:route.group,category:route.category};
    const root=isServicesRoot();
    const title='Услуги';
    const subtitle='';
    return ui.pageShell(context,title,subtitle,`<div class="k-services-reference-layout" data-kflow-screen="services"><div class="k-services-reference-shell" data-services-shell>${toolbar()}<section class="k-services-root-categories" data-services-root-categories ${root?'':'hidden'}>${root?rootCategoriesBlock(catalogState.getSnapshot()):''}</section><section class="k-services-catalog-outlet" data-services-navigator>${renderNavigator(catalogState.getSnapshot())}</section></div></div>`,{page:'services',eyebrow:'',chromeHeader:false});
  }

  function setupDeals(scope){
    const viewport=scope?.querySelector('[data-hot-deals-viewport]');
    if(!viewport||viewport.dataset.hotDealsReady==='1')return;
    viewport.dataset.hotDealsReady='1';
    const step=()=>Math.max(280,Math.min(viewport.clientWidth*.84,420));
    scope.querySelector('[data-hot-deals-prev]')?.addEventListener('click',()=>viewport.scrollBy({left:-step(),behavior:'smooth'}));
    scope.querySelector('[data-hot-deals-next]')?.addEventListener('click',()=>viewport.scrollBy({left:step(),behavior:'smooth'}));
    let active=false,startX=0,startScroll=0,moved=false;
    const down=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;active=true;moved=false;startX=e.clientX;startScroll=viewport.scrollLeft;viewport.classList.add('is-dragging');viewport.setPointerCapture?.(e.pointerId);};
    const move=e=>{if(!active)return;const dx=e.clientX-startX;if(Math.abs(dx)>5)moved=true;viewport.scrollLeft=startScroll-dx;};
    const up=e=>{if(!active)return;active=false;viewport.classList.remove('is-dragging');try{viewport.releasePointerCapture?.(e.pointerId);}catch(_e){}};
    viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',up);viewport.addEventListener('dragstart',e=>e.preventDefault());viewport.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);
  }


  function setupBundles(scope){
    const sliders=[...(scope||document).querySelectorAll('[data-service-bundles-slider]')];
    sliders.forEach(el=>{
      if(el.dataset.bundleSliderReady==='1')return;
      const section=el.closest('[data-service-bundles]');
      const init=()=>{
        if(typeof window.Swiper!=='function'||!document.contains(el)||el.dataset.bundleSliderReady==='1')return;
        try{
          window.KaretaSliderRuntime?.deactivateFallback?.(el);
          const instance=new window.Swiper(el,(window.KaretaSliderRuntime?.options||((x)=>x))({
            slidesPerView:1.14,spaceBetween:12,grabCursor:true,simulateTouch:true,allowTouchMove:true,watchOverflow:true,
            pagination:{el:el.querySelector('.swiper-pagination'),clickable:true},
            navigation:{prevEl:section?.querySelector('.k-service-bundles__prev'),nextEl:section?.querySelector('.k-service-bundles__next')},
            breakpoints:{560:{slidesPerView:2.05},900:{slidesPerView:3.05},1280:{slidesPerView:4}}
          }));
          el.dataset.bundleSliderReady='1';
          el._karetaBundleSwiper=instance;
        }catch(_e){el.dataset.bundleSliderReady='0';window.KaretaSliderRuntime?.activateFallback?.(el,section||el.parentElement||document);}
      };
      if(typeof window.Swiper==='function')init();
      else window.KaretaSwiperLoader?.load?.().then(()=>{if(typeof window.Swiper==='function')init();else window.KaretaSliderRuntime?.activateFallback?.(el,section||el.parentElement||document);}).catch(()=>window.KaretaSliderRuntime?.activateFallback?.(el,section||el.parentElement||document));
    });
  }

  function syncCabinetBundlesHost(){
    const host=document.querySelector('[data-cabinet-service-bundles-host]');
    if(!host)return;
    const active=/^#\/cabinet(?:$|[/:?])/.test(String(location.hash||''));
    host.hidden=!active;
    if(!active){host.replaceChildren();return;}
    if(!host.querySelector('[data-service-bundles]'))host.innerHTML=serviceBundlesBlock();
    requestAnimationFrame(()=>setupBundles(host));
  }

  function renderHomeDrilldown(){
    const previous=view;
    view={search:'',group:null,category:null};
    const html=`<section class="k-catalog-drilldown k-home-services-drilldown" data-home-services-drilldown aria-label="Услуги и специальные предложения">${renderNavigator(catalogState.getSnapshot(),{home:true})}</section>`;
    view=previous;
    return html;
  }

  function mountHomeDrilldown(context={}){
    const lifecycle=context.lifecycle||{};
    const root=document.querySelector('[data-home-services-drilldown]');
    if(!root)return()=>{};
    const render=snapshot=>{
      const previous=view;
      view={search:'',group:null,category:null};
      root.innerHTML=renderNavigator(snapshot,{home:true});
      view=previous;
      setupDeals(root);
      setupBundles(root);
    };
    const onClick=event=>{
      const promo=event.target.closest('[data-service-promo-category]');
      const deal=event.target.closest('[data-hot-deal-book]');
      if(deal){
        if(!openHotDealModal(deal)){
          try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:deal.dataset.serviceName||'Акционная услуга',category:deal.dataset.serviceCategory||'',promotion:true,source:'services_promotion'}));}catch(_e){}
          if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
        }
      }else if(promo){
        location.hash=categoryUrl(promo.dataset.servicePromoCategory||'');
      }
    };
    root.addEventListener('click',onClick);
    const stop=catalogState.subscribe(render);
    catalogState.load({signal:lifecycle.signal});
    lifecycle.addCleanup?.(()=>{root.removeEventListener('click',onClick);stop?.();});
    return()=>{root.removeEventListener('click',onClick);stop?.();};
  }

  function updateView(snapshot){
    const navigator=document.querySelector('[data-services-navigator]');
    const rootCategories=document.querySelector('[data-services-root-categories]');
    const tabs=document.querySelector('[data-services-tabs]');
    if(!navigator)return;
    categoryMeta=new Map(snapshot.serviceCategories.map(item=>[item.key,item]));
    if(tabs)tabs.innerHTML=referenceTabs();
    if(rootCategories){
      const showRoot=isServicesRoot()&&!view.search;
      rootCategories.hidden=!showRoot;
      if(showRoot)rootCategories.innerHTML=rootCategoriesBlock(snapshot);
    }
    navigator.innerHTML=renderNavigator(snapshot);
    requestAnimationFrame(()=>{setupDeals(navigator);setupBundles(navigator);});
  }

  function mountServices(context={}){
    const lifecycle=context.lifecycle||{};
    const initialRoute=routeState();
    view={search:'',group:initialRoute.group,category:initialRoute.category};
    try{
      const intent=JSON.parse(sessionStorage.getItem('kareta.services.intent')||'null');
      if(intent?.category && isServicesRoot()){
        location.replace(categoryUrl(intent.category));
        return;
      }
      sessionStorage.removeItem('kareta.services.intent');
    }catch(_e){}
    unsubscribe?.(); unsubscribe=catalogState.subscribe(updateView);
    const shell=document.querySelector('[data-services-shell]');
    const navigator=document.querySelector('[data-services-navigator]');
    const searchInput=document.querySelector('[data-services-toolbar-search]');
    const submitSearch=()=>{
      view.search=String(searchInput?.value||'').trim();
      updateView(catalogState.getSnapshot());
    };
    document.querySelector('[data-services-submit]')?.addEventListener('click',submitSearch);
    searchInput?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submitSearch();}});
    let timer=0;
    searchInput?.addEventListener('input',event=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        view.search=String(event.target.value||'').trim();
        updateView(catalogState.getSnapshot());
      },140);
    });
    shell?.addEventListener('click',event=>{
      const group=event.target.closest('[data-service-group]');
      const leaf=event.target.closest('[data-service-leaf]');
      const back=event.target.closest('[data-service-back]');
      const promo=event.target.closest('[data-service-promo-category]');
      const deal=event.target.closest('[data-hot-deal-book]');
      if(deal){
        if(!openHotDealModal(deal)){
          try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:deal.dataset.serviceName||'Акционная услуга',category:deal.dataset.serviceCategory||'',promotion:true,source:'services_promotion'}));}catch(_e){}
          if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
        }
      }else if(promo){
        location.hash=categoryUrl(promo.dataset.servicePromoCategory||'');
      }else if(group){
        event.preventDefault();location.hash=groupUrl(group.dataset.serviceGroup||'');
      }else if(leaf){
        event.preventDefault();location.hash=categoryUrl(leaf.dataset.serviceLeaf||'');
      }else if(back){
        event.preventDefault();location.hash=back.dataset.serviceBack==='root'?'#/services':groupUrl(view.group||'');
      }
    });
    requestAnimationFrame(()=>{setupDeals(navigator);setupBundles(navigator);});
    lifecycle.addCleanup?.(()=>{unsubscribe?.();unsubscribe=null;catalogState.cancel();clearTimeout(timer);});
    catalogState.load({signal:lifecycle.signal});
    return()=>{unsubscribe?.();unsubscribe=null;catalogState.cancel();clearTimeout(timer);};
  }

  function registerActions(runtime,dependencies={}){
    if(!runtime||typeof runtime.onAction!=='function')throw new Error('KaretaServicesPages.registerActions requires RouteRuntime');
    const getToastRoot=typeof dependencies.getToastRoot==='function'?dependencies.getToastRoot:()=>document.querySelector('#k-toast-root');
    runtime.onAction('service-booking',({node})=>{const name=node?.dataset?.serviceName||'Выбранная услуга';try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:name,serviceId:node?.dataset?.serviceId||'',source:'services_catalog'}));}catch(_e){}if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';});
    return true;
  }

  window.addEventListener('hashchange',syncCabinetBundlesHost);
  let documentHooksReady=false;
  function initDocumentHooks(){
    if(documentHooksReady)return;documentHooksReady=true;
    const host=document.querySelector('[data-cabinet-service-bundles-host]');
    host?.addEventListener('click',event=>{
      const deal=event.target.closest('[data-hot-deal-book]');
      if(!deal)return;
      try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:deal.dataset.serviceName||'Комплект услуг',category:deal.dataset.serviceCategory||'',promotion:true,source:'services_promotion'}));}catch(_e){}
      if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
    });
    syncCabinetBundlesHost();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDocumentHooks,{once:true});
  else initDocumentHooks();

  window.KaretaServicesPages=Object.freeze({renderServices,mountServices,renderHomeDrilldown,mountHomeDrilldown,serviceBundlesBlock,setupBundles,syncCabinetBundlesHost,openHotDealModal,closeHotDealModal,registerActions,getCatalog:()=>catalogState.getSnapshot().services});
})();
