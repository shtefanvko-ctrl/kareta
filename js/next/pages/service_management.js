(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  const state = window.KaretaServiceOffersState;
  const offersApi = window.KaretaServiceOffersApi;
  if (!ui) throw new Error('KaretaPageUI is required before service_management.js');
  if (!state) throw new Error('KaretaServiceOffersState is required before service_management.js');
  if (!offersApi) throw new Error('KaretaServiceOffersApi is required before service_management.js');

  const icon=name=>window.KaretaUIIcons?.svg?.(name==='search'?'tabler:search':name,{className:'k-master-dialog-icon'})||'';
  const serviceSvg=service=>{const icons=window.KaretaUIIcons;return icons?.svg?.(icons.serviceName?.(service.category)||icons.categoryIcon?.(service.category)||'services',{className:'k-service-themed-icon'})||'';};
  const NATIVE_SERVICE_CONTRACT = 'R188.5.5.6.56';
  const MASTER_SERVICE_MATRIX_R64_CONTRACT = 'R188.5.5.6.64';
  const CATEGORY_LABELS = Object.freeze({
    diagnostics:"Диагностика",wash:"Автомойка",detailing:"Детейлинг",fuel:"Топливная система",cooling_heating:"Охлаждение и отопление",exhaust:"Выхлопная система",suspension_steering:"Ходовая и рулевое",multimedia_security:"Автозвук и безопасность",tires:"Шиномонтаж",alignment:"Развал-схождение",body_welding:"Кузовные и сварочные работы",glass:"Автостёкла",
    engine:'Двигатель', chassis:'Ходовая', transmission:'Трансмиссия', brakes:'Тормоза',
    electrical:'Электрика', electric:'Электрика', lighting:'Освещение', audio:'Автозвук',
    climate:'Кондиционер', body:'Кузов', diagnostic:'Диагностика', diag:'Диагностика',
    maintenance:'Техобслуживание', security:'Охранные системы', other:'Другое',
  });
  const PRICE_TYPES = Object.freeze({ fixed:'Фиксированная', from:'От', range:'Диапазон', agreement:'По договорённости' });
  const AVAILABILITY = Object.freeze({ available:'Доступно', busy:'Занято', paused:'Пауза' });

  let view = { search:'', category:'all', status:'all' };
  let addView = { search:'', category:'all' };
  let editingServiceId = '';
  let pendingRemoveServiceId = '';
  let unsubscribe = null;

  function currentRole(){
    return String(window.KaretaRoleAccess?.currentRole?.() || window.KaretaNext?.state?.user?.role || 'master').trim().toLowerCase();
  }
  function roleCopy(){
    const role=currentRole();
    if(role==='sto') return {
      eyebrow:'УСЛУГИ СТО', title:'Услуги и цены СТО', pageTitle:'Услуги СТО',
      text:'Прайс автосервиса: цена, длительность, гарантия и доступность каждой услуги.',
      owner:'СТО', configured:'услуг настроено', active:'доступно для записи'
    };
    if(role==='admin'||role==='owner') return {
      eyebrow:'УПРАВЛЕНИЕ УСЛУГАМИ', title:'Предложения исполнителя', pageTitle:'Управление предложениями',
      text:'Проверка коммерческих условий исполнителя без изменения общего справочника услуг.',
      owner:'Платформа', configured:'настроено', active:'активно'
    };
    return {
      eyebrow:'МОИ УСЛУГИ', title:'Услуги, цены и специализации', pageTitle:'Мои услуги',
      text:'Один рабочий прайс Мастера для публичного профиля, поиска и matching Биржи.',
      owner:'Мастер', configured:'услуг настроено', active:'доступно клиентам'
    };
  }
  function categoryLabel(value){
    const key=String(value||'other');
    return CATEGORY_LABELS[key] || key.replace(/[_-]+/g,' ').replace(/^./,ch=>ch.toUpperCase());
  }
  function money(value){
    const amount=Number(value||0);
    return amount>0 ? `${new Intl.NumberFormat('ru-RU').format(amount)} ₸` : '—';
  }
  function priceLabel(offer){
    if(!offer) return 'Цена не настроена';
    const type=String(offer.priceType||'fixed');
    const from=Number(offer.price||0), to=Number(offer.priceMax||0);
    if(type==='agreement') return 'По договорённости';
    if(type==='from') return from>0 ? `от ${money(from)}` : 'от —';
    if(type==='range') return from>0 && to>from ? `${money(from)} — ${money(to)}` : (from>0 ? `от ${money(from)}` : 'Диапазон не задан');
    return money(from);
  }
  function durationLabel(offer){
    const from=Number(offer?.durationMin||0), to=Number(offer?.durationMaxMin||0);
    if(from<=0) return 'По оценке';
    if(to>from) return `${from}–${to} мин`;
    return `${from} мин`;
  }
  function offerStatus(offer){
    if(!offer) return 'not-configured';
    if(!offer.active || !offer.bookingEnabled || offer.availabilityStatus==='paused') return 'paused';
    if(offer.availabilityStatus==='busy') return 'busy';
    return 'active';
  }
  function statusBadge(offer){
    const status=offerStatus(offer);
    if(status==='active') return '<span class="k-badge k-badge-success">Доступно</span>';
    if(status==='busy') return '<span class="k-badge k-badge-warning">Занято</span>';
    if(status==='paused') return '<span class="k-badge k-badge-muted">Пауза</span>';
    return '<span class="k-badge">Не настроено</span>';
  }
  function offerMap(snapshot){ return new Map(snapshot.offers.map(offer=>[offer.serviceId,offer])); }
  function catalogMap(snapshot){ return new Map(snapshot.catalog.map(service=>[service.id,service])); }
  function configuredRows(snapshot){
    const catalog=catalogMap(snapshot);
    const query=view.search.trim().toLowerCase();
    return snapshot.offers.map(offer=>({ offer, service:catalog.get(offer.serviceId)||{id:offer.serviceId,name:offer.serviceId,category:'other',icon:'⚙',shortDesc:''} })).filter(({offer,service})=>{
      if(view.category!=='all' && service.category!==view.category) return false;
      if(view.status!=='all' && offerStatus(offer)!==view.status) return false;
      if(!query) return true;
      return [service.name,service.shortDesc,service.category,offer.notes].some(value=>String(value||'').toLowerCase().includes(query));
    }).sort((a,b)=>{
      const sa=offerStatus(a.offer)==='active'?0:offerStatus(a.offer)==='busy'?1:2;
      const sb=offerStatus(b.offer)==='active'?0:offerStatus(b.offer)==='busy'?1:2;
      return sa-sb || String(a.service.name).localeCompare(String(b.service.name),'ru');
    });
  }
  function specializationRows(snapshot){
    const catalog=catalogMap(snapshot); const counts=new Map();
    snapshot.offers.filter(o=>offerStatus(o)==='active').forEach(o=>{
      const category=catalog.get(o.serviceId)?.category||'other';
      counts.set(category,(counts.get(category)||0)+1);
    });
    return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]||categoryLabel(a[0]).localeCompare(categoryLabel(b[0]),'ru'));
  }
  function summary(snapshot){
    const active=snapshot.offers.filter(o=>offerStatus(o)==='active').length;
    const paused=snapshot.offers.filter(o=>offerStatus(o)==='paused').length;
    const categories=specializationRows(snapshot).length;
    const prices=snapshot.offers.filter(o=>o.priceType!=='agreement'&&Number(o.price||0)>0).map(o=>Number(o.price));
    const avg=prices.length?Math.round(prices.reduce((a,b)=>a+b,0)/prices.length):0;
    return { configured:snapshot.offers.length, active, paused, categories, avg };
  }
  function serviceCard(service,offer){
    const paused=offerStatus(offer)==='paused';
    return `<article class="k-service-native-card is-${ui.escHtml(offerStatus(offer))}" data-service-offer-card="${ui.escHtml(service.id)}">
      <header><div class="k-service-native-title"><span class="k-service-native-icon">${serviceSvg(service)}</span><div><small>${ui.escHtml(categoryLabel(service.category))}</small><h3>${ui.escHtml(service.name)}</h3></div></div>${statusBadge(offer)}</header>
      ${service.shortDesc?`<p>${ui.escHtml(service.shortDesc)}</p>`:''}
      <div class="k-service-native-facts">
        <article><span>Цена</span><b>${ui.escHtml(priceLabel(offer))}</b></article>
        <article><span>Время</span><b>${ui.escHtml(durationLabel(offer))}</b></article>
        <article><span>Гарантия</span><b>${Number(offer.warrantyDays||0)>0?`${ui.escHtml(offer.warrantyDays)} дн.`:'Не задана'}</b></article>
        <article><span>Запись</span><b>${offer.bookingEnabled?'Включена':'Выключена'}</b></article>
      </div>
      ${offer.notes?`<div class="k-service-native-note">${ui.escHtml(offer.notes)}</div>`:''}
      <div class="k-service-native-actions"><button class="k-btn k-btn-primary" type="button" data-service-edit="${ui.escHtml(service.id)}">Редактировать</button><button class="k-btn k-btn-secondary" type="button" data-service-toggle="${ui.escHtml(service.id)}">${paused?'Возобновить':'Приостановить'}</button></div>
    </article>`;
  }
  function renderConfigured(snapshot){
    if(snapshot.status==='idle'||snapshot.status==='loading') return '<div class="k-empty"><h2>Загрузка услуг</h2><p>Получаем ваш прайс и общий справочник.</p></div>';
    if(snapshot.status==='error'&&!snapshot.catalog.length) return `<div class="k-empty"><h2>Не удалось загрузить услуги</h2><p>${ui.escHtml(snapshot.error?.message||'Ошибка сервера')}</p><button class="k-btn k-btn-primary" type="button" data-service-offers-retry>Повторить</button></div>`;
    const rows=configuredRows(snapshot);
    if(!snapshot.offers.length) return '<div class="k-empty"><h2>Прайс пока пуст</h2><p>Добавьте услуги из общего справочника и укажите собственные условия.</p><button class="k-btn k-btn-primary" type="button" data-service-open-add>Добавить услугу</button></div>';
    if(!rows.length) return '<div class="k-empty"><h2>Ничего не найдено</h2><p>Измените поиск или фильтры.</p></div>';
    return `<section class="k-service-native-grid">${rows.map(({service,offer})=>serviceCard(service,offer)).join('')}</section>`;
  }
  function categoryCounts(snapshot){
    const counts=new Map(); snapshot.catalog.forEach(s=>counts.set(s.category,(counts.get(s.category)||0)+1)); return counts;
  }
  function categoryButtons(snapshot, selected, attr){
    const counts=categoryCounts(snapshot);
    const rows=Array.from(counts.entries()).sort((a,b)=>categoryLabel(a[0]).localeCompare(categoryLabel(b[0]),'ru'));
    return `<button type="button" class="${selected==='all'?'is-active':''}" ${attr}="all"><b>Все</b><small>${snapshot.catalog.length}</small></button>${rows.map(([key,count])=>`<button type="button" class="${selected===key?'is-active':''}" ${attr}="${ui.escHtml(key)}"><b>${ui.escHtml(categoryLabel(key))}</b><small>${count}</small></button>`).join('')}`;
  }
  function renderSpecializations(snapshot){
    const rows=specializationRows(snapshot);
    if(!rows.length) return '<div class="k-service-native-specialty-empty">Активные специализации появятся после добавления услуг.</div>';
    return rows.map(([key,count])=>`<button type="button" data-service-specialty="${ui.escHtml(key)}"><span>${ui.escHtml(categoryLabel(key))}</span><b>${count}</b></button>`).join('');
  }
  function addRows(snapshot){
    const offers=offerMap(snapshot), query=addView.search.trim().toLowerCase();
    const rows=snapshot.catalog.filter(service=>{
      if(addView.category!=='all'&&service.category!==addView.category)return false;
      if(query && ![service.name,service.shortDesc,service.category].some(v=>String(v||'').toLowerCase().includes(query)))return false;
      return true;
    });
    if(!rows.length)return '<div class="k-empty">Услуги не найдены.</div>';
    return rows.map(service=>{const configured=offers.has(service.id);return `<article class="k-service-picker-card${configured?' is-configured':''}"><span>${serviceSvg(service)}</span><div><small>${ui.escHtml(categoryLabel(service.category))}</small><b>${ui.escHtml(service.name)}</b>${service.shortDesc?`<p>${ui.escHtml(service.shortDesc)}</p>`:''}<em>База: ${ui.escHtml(money(service.basePrice))}${service.avgTime?` · ${ui.escHtml(service.avgTime)}`:''}</em></div><button class="k-btn ${configured?'k-btn-secondary':'k-btn-primary'}" type="button" data-service-pick="${ui.escHtml(service.id)}">${configured?'Настроить':'Добавить'}</button></article>`;}).join('');
  }
  function renderDialogs(snapshot){
    return `<dialog class="k-service-native-dialog" data-service-filter-dialog><form method="dialog"><header><div><small>ФИЛЬТРЫ</small><h2>Показать услуги</h2></div><button value="cancel" aria-label="Закрыть">${icon('close')}</button></header><div class="k-service-dialog-body"><section><h3>Категория</h3><div class="k-service-choice-grid" data-service-filter-categories>${categoryButtons(snapshot,view.category,'data-service-filter-category')}</div></section><section><h3>Статус</h3><div class="k-service-choice-grid k-service-choice-grid--status">${[['all','Все'],['active','Доступные'],['busy','Занято'],['paused','Пауза']].map(([key,label])=>`<button type="button" class="${view.status===key?'is-active':''}" data-service-filter-status="${key}"><b>${label}</b></button>`).join('')}</div></section></div><footer><button class="k-btn k-btn-secondary" type="button" data-service-filter-reset>Сбросить</button><button class="k-btn k-btn-primary" value="cancel">Готово</button></footer></form></dialog>
    <dialog class="k-service-native-dialog k-service-native-dialog--large" data-service-add-dialog><form method="dialog"><header><div><small>ОБЩИЙ СПРАВОЧНИК</small><h2>Добавить услугу</h2></div><button value="cancel" aria-label="Закрыть">${icon('close')}</button></header><div class="k-service-dialog-body"><label class="k-service-native-search"><span>${icon('search')}</span><input type="search" data-service-add-search placeholder="Найти услугу"></label><div class="k-service-choice-grid k-service-choice-grid--categories" data-service-add-categories>${categoryButtons(snapshot,addView.category,'data-service-add-category')}</div><div class="k-service-picker-list" data-service-picker-list>${addRows(snapshot)}</div></div><footer><button class="k-btn k-btn-primary" value="cancel">Закрыть</button></footer></form></dialog>
    <dialog class="k-service-native-dialog" data-service-edit-dialog><form data-service-edit-form><header><div><small data-service-edit-category>УСЛУГА</small><h2 data-service-edit-title>Настройка услуги</h2></div><button type="button" aria-label="Закрыть" data-service-dialog-close>${icon('close')}</button></header><div class="k-service-dialog-body" data-service-edit-body></div><footer><button class="k-btn k-btn-ghost" type="button" data-service-remove-open>Убрать услугу</button><button class="k-btn k-btn-primary" type="submit">Сохранить</button></footer></form></dialog>
    <dialog class="k-service-native-dialog k-service-native-dialog--confirm" data-service-remove-dialog><form method="dialog"><header><div><small>ПОДТВЕРЖДЕНИЕ</small><h2>Убрать услугу?</h2></div><button value="cancel" aria-label="Закрыть">${icon('close')}</button></header><div class="k-service-dialog-body"><p>Услуга исчезнет из вашего публичного прайса и matching, но останется в общем справочнике KARETA.KZ.</p></div><footer><button class="k-btn k-btn-secondary" value="cancel">Отмена</button><button class="k-btn k-btn-primary" type="button" data-service-remove-confirm>Убрать</button></footer></form></dialog>`;
  }
  function editBody(service,offer,snapshot){
    const current=offer||{serviceId:service.id,price:Number(service.basePrice||0),priceMax:0,priceType:'fixed',durationMin:0,durationMaxMin:0,warrantyDays:0,city:snapshot.context?.city||'',availabilityStatus:'available',bookingEnabled:true,notes:'',active:true};
    const priceType=String(current.priceType||'fixed'), availability=String(current.availabilityStatus||'available');
    return `<input type="hidden" name="serviceId" value="${ui.escHtml(service.id)}"><input type="hidden" name="priceType" value="${ui.escHtml(priceType)}"><input type="hidden" name="availabilityStatus" value="${ui.escHtml(availability)}">
      <section><h3>Тип цены</h3><div class="k-service-choice-grid k-service-choice-grid--price">${Object.entries(PRICE_TYPES).map(([key,label])=>`<button type="button" class="${priceType===key?'is-active':''}" data-service-choice="priceType" data-service-choice-value="${key}"><b>${label}</b></button>`).join('')}</div></section>
      <section class="k-service-edit-fields"><label data-price-from><span>${priceType==='range'?'Цена от, ₸':priceType==='from'?'Цена от, ₸':'Цена, ₸'}</span><input type="number" name="price" min="0" step="100" value="${ui.escHtml(current.price||0)}" ${priceType==='agreement'?'disabled':''}></label><label data-price-to ${priceType==='range'?'':'hidden'}><span>Цена до, ₸</span><input type="number" name="priceMax" min="0" step="100" value="${ui.escHtml(current.priceMax||0)}"></label><label><span>Время от, мин</span><input type="number" name="durationMin" min="0" max="10080" step="10" value="${ui.escHtml(current.durationMin||0)}"></label><label><span>Время до, мин</span><input type="number" name="durationMaxMin" min="0" max="10080" step="10" value="${ui.escHtml(current.durationMaxMin||0)}"></label><label><span>Гарантия, дней</span><input type="number" name="warrantyDays" min="0" max="3650" step="1" value="${ui.escHtml(current.warrantyDays||0)}"></label><label><span>Город</span><input type="text" name="city" maxlength="120" value="${ui.escHtml(current.city||snapshot.context?.city||'')}" placeholder="Усть-Каменогорск"></label></section>
      <section><h3>Доступность</h3><div class="k-service-choice-grid k-service-choice-grid--status">${Object.entries(AVAILABILITY).map(([key,label])=>`<button type="button" class="${availability===key?'is-active':''}" data-service-choice="availabilityStatus" data-service-choice-value="${key}"><b>${label}</b></button>`).join('')}</div></section>
      <label class="k-service-native-switch"><input type="checkbox" name="bookingEnabled" ${current.bookingEnabled!==false?'checked':''}><span><b>Принимать запись</b><small>Клиент сможет выбрать эту услугу при записи.</small></span></label>
      <label class="k-service-native-textarea"><span>Комментарий клиенту</span><textarea name="notes" maxlength="500" rows="4" placeholder="Что входит в цену, особенности работы, условия гарантии">${ui.escHtml(current.notes||'')}</textarea></label>`;
  }
  let masterSearch='';
  let masterDrafts=new Map();
  let masterMatrixUnsubscribe=null;

  function standardMinutes(value){
    const numbers=String(value||'').match(/\d+/g)||[];
    if(!numbers.length)return 60;
    return Math.max(5,Number(numbers[0]||60));
  }
  function masterOfferEnabled(offer){return !!offer&&offer.active!==false&&offer.bookingEnabled!==false&&String(offer.availabilityStatus||'available')!=='paused';}
  function masterEffective(service,offer){
    const draft=masterDrafts.get(service.id);
    if(draft)return draft;
    return {enabled:masterOfferEnabled(offer),price:Number(offer?.price||service.basePrice||0),duration:Number(offer?.durationMin||standardMinutes(service.avgTime))};
  }
  function masterMatrixGroups(snapshot){
    const offers=offerMap(snapshot),query=masterSearch.trim().toLowerCase(),groups=new Map();
    snapshot.catalog.forEach(service=>{
      if(query&&![service.name,service.shortDesc,service.category,categoryLabel(service.category)].some(v=>String(v||'').toLowerCase().includes(query)))return;
      const key=String(service.category||'other');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({service,offer:offers.get(service.id)});
    });
    return Array.from(groups.entries()).sort((a,b)=>categoryLabel(a[0]).localeCompare(categoryLabel(b[0]),'ru'));
  }
  function masterServiceRow(service,offer){
    const effective=masterEffective(service,offer),enabled=effective.enabled===true;
    const standardPrice=Number(service.basePrice||0),standardTime=service.avgTime||`${standardMinutes(service.avgTime)} мин`;
    return `<article class="k-master-service-row k-master-service-card-r84 ${enabled?'is-enabled':''}" data-master-service-row="${ui.escHtml(service.id)}"><label class="k-master-service-check k-master-service-card-r84__head"><input type="checkbox" data-master-service-enabled="${ui.escHtml(service.id)}" ${enabled?'checked':''}><span aria-hidden="true"></span><span class="k-master-service-card-r84__icon">${serviceSvg(service)}</span><div><b>${ui.escHtml(service.name)}</b>${service.shortDesc?`<small>${ui.escHtml(service.shortDesc)}</small>`:''}<em>Стандарт: ${ui.escHtml(money(standardPrice))} · ${ui.escHtml(standardTime)}</em></div></label><div class="k-master-service-own-fields k-master-service-card-r84__fields"><label><span>Моя цена, ₸</span><div><input type="number" min="0" max="999999999" step="100" data-master-service-price="${ui.escHtml(service.id)}" value="${ui.escHtml(Math.round(Number(effective.price||0)))}" ${enabled?'':'disabled'}><small>₸</small></div></label><label><span>Моё время, мин</span><div><input type="number" min="5" max="10080" step="5" data-master-service-duration="${ui.escHtml(service.id)}" value="${ui.escHtml(Math.round(Number(effective.duration||standardMinutes(service.avgTime))))}" ${enabled?'':'disabled'}><small>мин</small></div></label></div></article>`;
  }
  function masterCategoryBlock(key,rows){
    const enabledCount=rows.filter(({service,offer})=>masterEffective(service,offer).enabled).length;
    const all=rows.length>0&&enabledCount===rows.length;
    return `<section class="k-master-service-category k-master-service-category-r84" data-master-service-category="${ui.escHtml(key)}"><header><label><input type="checkbox" data-master-category-toggle="${ui.escHtml(key)}" ${all?'checked':''}><span></span><div><small>КАТЕГОРИЯ</small><h2>${ui.escHtml(categoryLabel(key))}</h2><p><b data-master-category-count>${enabledCount}</b> из ${rows.length} выбрано</p></div></label></header><div class="k-master-service-category__rows k-master-service-grid-r84">${rows.map(({service,offer})=>masterServiceRow(service,offer)).join('')}</div></section>`;
  }
  function masterMatrixHtml(snapshot){
    if(snapshot.status==='idle'||snapshot.status==='loading')return '<div class="k-empty"><h2>Загрузка «Моих услуг»</h2><p>Получаем общий каталог и ваш текущий прайс.</p></div>';
    if(snapshot.status==='error'&&!snapshot.catalog.length)return `<div class="k-empty"><h2>Не удалось загрузить каталог</h2><p>${ui.escHtml(snapshot.error?.message||'Ошибка сервера')}</p><button class="k-btn k-btn-primary" type="button" data-master-services-retry>Повторить</button></div>`;
    const groups=masterMatrixGroups(snapshot);
    if(!groups.length)return '<div class="k-empty"><h2>Услуги не найдены</h2><p>Измените поисковый запрос.</p></div>';
    return groups.map(([key,rows])=>masterCategoryBlock(key,rows)).join('');
  }
  function masterSelectionCount(snapshot){const offers=offerMap(snapshot);return snapshot.catalog.filter(service=>masterEffective(service,offers.get(service.id)).enabled).length;}
  function renderMasterServiceManagement(context={}){
    const snapshot=state.getSnapshot(),selected=masterSelectionCount(snapshot);
    return ui.pageShell(context,'Мои услуги','Выберите направления, услуги и оборудование по карточкам. Каждый выбор сохраняется отдельно.',`<section class="k-master-services-overview"><article><b data-master-services-selected>${selected}</b><span>оказываю</span></article><article><b>${snapshot.offers.filter(masterOfferEnabled).length}</b><span>опубликовано</span></article></section><section class="k-master-setup-launch"><button type="button" data-master-setup-professions>${icon('tabler:tools')}<b>Профессии</b><small>Направления работы</small></button><button type="button" data-master-setup-services>${icon('tabler:tool')}<b>Мои услуги</b><small>Категории и работы</small></button><button type="button" data-master-setup-equipment>${icon('tabler:package')}<b>Оборудование</b><small>Собрать свою мастерскую</small></button></section><details class="k-master-service-editor"><summary>Цены и время</summary><section class="k-master-services-toolbar"><label><span>${icon('search')}</span><input type="search" data-master-services-search placeholder="Найти услугу или категорию" value="${ui.escHtml(masterSearch)}"></label><div><button class="k-btn k-btn-secondary" type="button" data-master-services-save disabled>Сохранить Мои услуги</button></div></section><div class="k-catalog-status" data-service-offers-status>${snapshot.status==='partial'?'Каталог загружен, личный прайс временно недоступен.':'Изменения ещё не сохранены.'}</div><div class="k-master-services-matrix" data-master-services-matrix>${masterMatrixHtml(snapshot)}</div></details>`,{page:'service-management',eyebrow:'МОИ УСЛУГИ',chromeHeader:false,panel:`<aside class="k-panel k-context-panel k-master-services-help"><h2>Как работает</h2><p>Выбранная карточка включает услугу в ваш профиль и matching Биржи. «Моя цена» заменяет стандартную цену, «Моё время» — стандартную длительность.</p><p>Повторный выбор убирает услугу только из вашего прайса; общий каталог KARETA.KZ не меняется.</p></aside>`});
  }
  function updateMasterMatrix(snapshot){
    const matrix=document.querySelector('[data-master-services-matrix]');if(!matrix)return;matrix.innerHTML=masterMatrixHtml(snapshot);
    const count=document.querySelector('[data-master-services-selected]');if(count)count.textContent=String(masterSelectionCount(snapshot));
    const save=document.querySelector('[data-master-services-save]');if(save)save.disabled=masterDrafts.size===0;
    document.querySelectorAll('[data-master-category-toggle]').forEach(input=>{const block=input.closest('[data-master-service-category]');const rows=[...(block?.querySelectorAll('[data-master-service-enabled]')||[])];const checked=rows.filter(x=>x.checked).length;input.checked=rows.length>0&&checked===rows.length;input.indeterminate=checked>0&&checked<rows.length;const countEl=block?.querySelector('[data-master-category-count]');if(countEl)countEl.textContent=String(checked);});
  }
  function captureMasterDraft(root,serviceId,forcedEnabled=null,changedField=''){
    const row=root.querySelector(`[data-master-service-row="${CSS.escape(serviceId)}"]`);if(!row)return;
    const enabled=forcedEnabled===null?row.querySelector('[data-master-service-enabled]')?.checked===true:forcedEnabled;
    const price=Number(row.querySelector('[data-master-service-price]')?.value||0);
    const duration=Math.max(5,Number(row.querySelector('[data-master-service-duration]')?.value||60));
    const previous=masterDrafts.get(serviceId)||{};
    masterDrafts.set(serviceId,{enabled,price,duration,priceTouched:previous.priceTouched===true||changedField==='price',durationTouched:previous.durationTouched===true||changedField==='duration'});
  }
  async function saveMasterDrafts(root,lifecycle){
    const snapshot=state.getSnapshot(),catalog=catalogMap(snapshot),offers=offerMap(snapshot),entries=[...masterDrafts.entries()];
    if(!entries.length)return;
    const status=root.querySelector('[data-service-offers-status]'),button=root.querySelector('[data-master-services-save]');if(button)button.disabled=true;
    let done=0;if(status)status.textContent=`Сохранение 0 из ${entries.length}…`;
    for(const [serviceId,draft] of entries){
      const service=catalog.get(serviceId),existing=offers.get(serviceId);if(!service)continue;
      if(draft.enabled){const keepPrice=!!existing&&draft.priceTouched!==true,keepDuration=!!existing&&draft.durationTouched!==true;await offersApi.save({...existing,serviceId,priceType:keepPrice?String(existing.priceType||'fixed'):'fixed',price:keepPrice?Number(existing.price||0):Math.max(0,draft.price),priceMax:keepPrice?Number(existing.priceMax||0):0,durationMin:keepDuration?Number(existing.durationMin||0):Math.max(5,draft.duration),durationMaxMin:keepDuration?Number(existing.durationMaxMin||0):0,warrantyDays:Number(existing?.warrantyDays||0),city:String(existing?.city||snapshot.context?.city||''),availabilityStatus:existing&&masterOfferEnabled(existing)?String(existing.availabilityStatus||'available'):'available',notes:String(existing?.notes||''),bookingEnabled:true,active:true},{signal:lifecycle.signal});}
      else if(existing){await offersApi.remove(serviceId,{signal:lifecycle.signal});}
      done++;if(status)status.textContent=`Сохранение ${done} из ${entries.length}…`;
    }
    masterDrafts.clear();await state.load({signal:lifecycle.signal,force:true});if(status)status.textContent='«Мои услуги» сохранены. Профиль и matching Биржи обновлены.';window.KaretaToast?.success?.('Мои услуги сохранены');
  }
  function mountMasterServiceManagement(context={}){
    const lifecycle=context.lifecycle||{},root=document.querySelector('[data-page="service-management"]');if(!root)return;
    masterSearch='';masterDrafts=new Map();masterMatrixUnsubscribe?.();masterMatrixUnsubscribe=state.subscribe(updateMasterMatrix);
    const onInput=event=>{
      if(event.target.matches('[data-master-services-search]')){masterSearch=event.target.value||'';updateMasterMatrix(state.getSnapshot());return;}
      const id=event.target.dataset.masterServicePrice||event.target.dataset.masterServiceDuration;if(id){captureMasterDraft(root,id,null,event.target.matches('[data-master-service-price]')?'price':'duration');const save=root.querySelector('[data-master-services-save]');if(save)save.disabled=false;return;}
    };
    const onChange=event=>{
      const enabled=event.target.closest('[data-master-service-enabled]');if(enabled){const id=enabled.dataset.masterServiceEnabled||'';const row=enabled.closest('[data-master-service-row]');row?.classList.toggle('is-enabled',enabled.checked);row?.querySelectorAll('[data-master-service-price],[data-master-service-duration]').forEach(input=>input.disabled=!enabled.checked);captureMasterDraft(root,id,enabled.checked);updateMasterMatrix(state.getSnapshot());return;}
      const category=event.target.closest('[data-master-category-toggle]');if(category){const block=category.closest('[data-master-service-category]');block?.querySelectorAll('[data-master-service-enabled]').forEach(input=>{input.checked=category.checked;const id=input.dataset.masterServiceEnabled||'';const row=input.closest('[data-master-service-row]');row?.classList.toggle('is-enabled',category.checked);row?.querySelectorAll('[data-master-service-price],[data-master-service-duration]').forEach(field=>field.disabled=!category.checked);captureMasterDraft(root,id,category.checked);});updateMasterMatrix(state.getSnapshot());}
    };
    const onClick=async event=>{
      const retry=event.target.closest('[data-master-services-retry]');if(retry){retry.disabled=true;try{await state.load({signal:lifecycle.signal,force:true});}finally{if(retry.isConnected)retry.disabled=false;}return;}
      const save=event.target.closest('[data-master-services-save]');if(save){try{await saveMasterDrafts(root,lifecycle);}catch(error){const status=root.querySelector('[data-service-offers-status]');if(status)status.textContent=error?.message||'Не удалось сохранить услуги';window.KaretaToast?.error?.(error?.message||'Не удалось сохранить услуги');if(save.isConnected)save.disabled=false;}return;}
    };
    window.KaretaMasterSetupPicker?.mount?.(root,{lifecycle,services:{
      snapshot:()=>state.getSnapshot(),categoryLabel,refresh:()=>state.load({signal:lifecycle.signal,force:true}),
      scopeKey:()=>{const c=state.getSnapshot().context;return c?.ownerUserId?['master',c.ownerUserId,c.ownerEntityId].join(':'):'';},
      selected:service=>masterEffective(service,offerMap(state.getSnapshot()).get(service.id)).enabled,
      select:async(serviceId,enabled)=>{captureMasterDraft(root,serviceId,enabled);if(!masterDrafts.has(serviceId))throw new Error('Услуга недоступна. Обновите каталог.');await saveMasterDrafts(root,lifecycle);}
    }});
    window.KaretaMasterProfessionPicker?.mount?.(root,{lifecycle});
    root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('click',onClick);state.load({signal:lifecycle.signal,force:true});
    const cleanup=()=>{masterMatrixUnsubscribe?.();masterMatrixUnsubscribe=null;state.cancel();root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('click',onClick);};lifecycle.addCleanup?.(cleanup);return cleanup;
  }

  function renderServiceManagement(context={}){
    if(currentRole()==='master')return renderMasterServiceManagement(context);
    const copy=roleCopy(), snapshot=state.getSnapshot();
    return ui.pageShell(context,copy.pageTitle,copy.text,`<section class="k-service-native-summary" data-service-summary></section>
      <section class="k-service-native-specialties"><div><small>СПЕЦИАЛИЗАЦИИ</small><h2>Сферы работы</h2><p>Формируются автоматически из активных услуг и используются в поиске и matching.</p></div><div class="k-service-specialty-grid" data-service-specialties></div></section>
      <section class="k-service-native-toolbar"><label class="k-service-native-search"><span>${icon('search')}</span><input type="search" data-service-offers-search placeholder="Найти в моём прайсе"></label><button class="k-btn k-btn-secondary" type="button" data-service-open-filter>Фильтры <b data-service-filter-count hidden>0</b></button><button class="k-btn k-btn-primary" type="button" data-service-open-add>Добавить услугу</button></section>
      <div class="k-catalog-status" data-service-offers-status>Загрузка…</div><div data-service-offers-list>${renderConfigured(snapshot)}</div>${renderDialogs(snapshot)}`,
      {page:'service-management',eyebrow:copy.eyebrow,chromeHeader:false,panel:`<aside class="k-panel k-context-panel k-service-native-side"><h2>Единый прайс</h2><p>Изменения на этой странице автоматически используются в публичном профиле, поиске услуг и Бирже.</p><a class="k-btn k-btn-secondary" href="${currentRole()==='sto'?'#/cabinet':'#/master/profile'}">${currentRole()==='sto'?'Аккаунт СТО':'Мой профиль'}</a><a class="k-btn k-btn-ghost" href="#/services">Общий каталог</a></aside>`});
  }
  function summaryHtml(snapshot){
    const s=summary(snapshot); return `<article><b>${s.configured}</b><span>услуг</span></article><article><b>${s.active}</b><span>доступно</span></article><article><b>${s.categories}</b><span>сфер</span></article><article><b>${s.avg?money(s.avg):'—'}</b><span>средняя цена</span></article>`;
  }
  function updateDialogs(snapshot){
    const filterCats=document.querySelector('[data-service-filter-categories]'); if(filterCats)filterCats.innerHTML=categoryButtons(snapshot,view.category,'data-service-filter-category');
    document.querySelectorAll('[data-service-filter-status]').forEach(b=>b.classList.toggle('is-active',b.dataset.serviceFilterStatus===view.status));
    const addCats=document.querySelector('[data-service-add-categories]'); if(addCats)addCats.innerHTML=categoryButtons(snapshot,addView.category,'data-service-add-category');
    const picker=document.querySelector('[data-service-picker-list]'); if(picker)picker.innerHTML=addRows(snapshot);
  }
  function updateView(snapshot){
    const list=document.querySelector('[data-service-offers-list]'), status=document.querySelector('[data-service-offers-status]'); if(!list||!status)return;
    list.innerHTML=renderConfigured(snapshot);
    const summaryRoot=document.querySelector('[data-service-summary]'); if(summaryRoot)summaryRoot.innerHTML=summaryHtml(snapshot);
    const specialties=document.querySelector('[data-service-specialties]'); if(specialties)specialties.innerHTML=renderSpecializations(snapshot);
    const filterCount=(view.category!=='all'?1:0)+(view.status!=='all'?1:0); const filterBadge=document.querySelector('[data-service-filter-count]'); if(filterBadge){filterBadge.textContent=String(filterCount);filterBadge.hidden=filterCount===0;}
    if(snapshot.status==='ready') status.textContent=`Настроено ${snapshot.offers.length} услуг. Изменения сохраняются в едином прайсе.`;
    else if(snapshot.status==='partial') status.textContent='Общий каталог доступен, личный прайс временно не загружен.';
    else if(snapshot.status==='error') status.textContent=snapshot.error?.message||'Ошибка загрузки';
    else status.textContent='Загрузка каталога и прайса…';
    status.classList.toggle('is-error',snapshot.status==='error'||snapshot.status==='partial');
    updateDialogs(snapshot);
  }
  function openDialog(selector){ const dialog=document.querySelector(selector); if(dialog&&!dialog.open)dialog.showModal(); return dialog; }
  function openEdit(serviceId){
    const snapshot=state.getSnapshot(), service=catalogMap(snapshot).get(serviceId); if(!service)return;
    const offer=offerMap(snapshot).get(serviceId); editingServiceId=serviceId;
    const dialog=document.querySelector('[data-service-edit-dialog]'); if(!dialog)return;
    dialog.querySelector('[data-service-edit-title]').textContent=service.name;
    dialog.querySelector('[data-service-edit-category]').textContent=categoryLabel(service.category);
    dialog.querySelector('[data-service-edit-body]').innerHTML=editBody(service,offer,snapshot);
    dialog.querySelector('[data-service-remove-open]').hidden=!offer;
    if(!dialog.open)dialog.showModal();
  }
  function syncEditConditional(form){
    const priceType=String(form?.querySelector('[name="priceType"]')?.value||'fixed');
    const from=form?.querySelector('[data-price-from]'), to=form?.querySelector('[data-price-to]'), price=form?.querySelector('[name="price"]');
    if(from){const label=from.querySelector('span');if(label)label.textContent=priceType==='range'||priceType==='from'?'Цена от, ₸':'Цена, ₸';}
    if(to)to.hidden=priceType!=='range'; if(price)price.disabled=priceType==='agreement';
  }
  function formPayload(form){
    const fd=new FormData(form), priceType=String(fd.get('priceType')||'fixed');
    let price=Number(fd.get('price')||0), priceMax=Number(fd.get('priceMax')||0);
    if(priceType==='agreement'){price=0;priceMax=0;} if(priceType!=='range')priceMax=0;
    const duration=Number(fd.get('durationMin')||0), durationMax=Math.max(0,Number(fd.get('durationMaxMin')||0));
    return { serviceId:String(fd.get('serviceId')||''),priceType,price,priceMax,durationMin:duration,durationMaxMin:duration>0&&durationMax>duration?durationMax:0,warrantyDays:Number(fd.get('warrantyDays')||0),city:String(fd.get('city')||'').trim(),availabilityStatus:String(fd.get('availabilityStatus')||'available'),notes:String(fd.get('notes')||'').trim(),bookingEnabled:form.querySelector('[name="bookingEnabled"]')?.checked===true,active:true };
  }
  function showMessage(message,error=false){ const status=document.querySelector('[data-service-offers-status]'); if(!status)return;status.textContent=message;status.classList.toggle('is-error',error); }
  function mountServiceManagement(context={}){
    if(currentRole()==='master')return mountMasterServiceManagement(context);
    const lifecycle=context.lifecycle||{}; view={search:'',category:'all',status:'all'};addView={search:'',category:'all'};editingServiceId='';pendingRemoveServiceId='';unsubscribe?.();unsubscribe=state.subscribe(updateView);
    const root=document.querySelector('[data-page="service-management"]'); const search=root?.querySelector('[data-service-offers-search]'); let timer=0;
    const onSearch=()=>{clearTimeout(timer);timer=window.setTimeout(()=>{view.search=search?.value||'';updateView(state.getSnapshot());},100);};
    const onInput=event=>{if(event.target.matches('[data-service-add-search]')){addView.search=event.target.value||'';updateDialogs(state.getSnapshot());}};
    const onSubmit=async event=>{const form=event.target.closest('[data-service-edit-form]');if(!form)return;event.preventDefault();const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;try{await state.save(formPayload(form));form.closest('dialog')?.close();showMessage('Услуга сохранена. Публичный прайс и matching обновлены.');}catch(error){showMessage(error?.message||'Не удалось сохранить услугу',true);}finally{if(button)button.disabled=false;}};
    const onClick=async event=>{
      const retry=event.target.closest('[data-service-offers-retry]'); if(retry){retry.disabled=true;try{await state.load({signal:lifecycle.signal,force:true});}finally{retry.disabled=false;}return;}
      if(event.target.closest('[data-service-open-filter]')){openDialog('[data-service-filter-dialog]');return;}
      if(event.target.closest('[data-service-open-add]')){addView={search:'',category:'all'};const addSearch=document.querySelector('[data-service-add-search]');if(addSearch)addSearch.value='';updateDialogs(state.getSnapshot());openDialog('[data-service-add-dialog]');return;}
      const specialty=event.target.closest('[data-service-specialty]');if(specialty){view.category=specialty.dataset.serviceSpecialty||'all';updateView(state.getSnapshot());return;}
      const fc=event.target.closest('[data-service-filter-category]');if(fc){view.category=fc.dataset.serviceFilterCategory||'all';updateView(state.getSnapshot());return;}
      const fs=event.target.closest('[data-service-filter-status]');if(fs){view.status=fs.dataset.serviceFilterStatus||'all';updateView(state.getSnapshot());return;}
      if(event.target.closest('[data-service-filter-reset]')){view.category='all';view.status='all';updateView(state.getSnapshot());return;}
      const ac=event.target.closest('[data-service-add-category]');if(ac){addView.category=ac.dataset.serviceAddCategory||'all';updateDialogs(state.getSnapshot());return;}
      const pick=event.target.closest('[data-service-pick]');if(pick){document.querySelector('[data-service-add-dialog]')?.close();openEdit(pick.dataset.servicePick||'');return;}
      const edit=event.target.closest('[data-service-edit]');if(edit){openEdit(edit.dataset.serviceEdit||'');return;}
      const close=event.target.closest('[data-service-dialog-close]');if(close){close.closest('dialog')?.close();return;}
      const choice=event.target.closest('[data-service-choice]');if(choice){const form=choice.closest('form'),name=choice.dataset.serviceChoice,value=choice.dataset.serviceChoiceValue||'';const hidden=form?.querySelector(`[name="${CSS.escape(name)}"]`);if(hidden)hidden.value=value;form?.querySelectorAll(`[data-service-choice="${CSS.escape(name)}"]`).forEach(b=>b.classList.toggle('is-active',b===choice));syncEditConditional(form);return;}
      const toggle=event.target.closest('[data-service-toggle]');if(toggle){const id=toggle.dataset.serviceToggle||'', snap=state.getSnapshot(), offer=offerMap(snap).get(id);if(!offer)return;toggle.disabled=true;try{const paused=offerStatus(offer)==='paused';await state.save({...offer,serviceId:id,availabilityStatus:paused?'available':'paused',bookingEnabled:paused?true:false,active:true});showMessage(paused?'Услуга снова доступна клиентам.':'Услуга приостановлена.');}catch(error){showMessage(error?.message||'Не удалось изменить доступность',true);}finally{toggle.disabled=false;}return;}
      if(event.target.closest('[data-service-remove-open]')){pendingRemoveServiceId=editingServiceId;document.querySelector('[data-service-edit-dialog]')?.close();openDialog('[data-service-remove-dialog]');return;}
      const remove=event.target.closest('[data-service-remove-confirm]');if(remove){const id=pendingRemoveServiceId;if(!id)return;remove.disabled=true;try{await state.remove(id);document.querySelector('[data-service-remove-dialog]')?.close();showMessage('Услуга убрана из вашего прайса.');}catch(error){showMessage(error?.message||'Не удалось убрать услугу',true);}finally{remove.disabled=false;pendingRemoveServiceId='';}return;}
    };
    search?.addEventListener('input',onSearch);root?.addEventListener('input',onInput);root?.addEventListener('submit',onSubmit);root?.addEventListener('click',onClick);state.load({signal:lifecycle.signal});
    const cleanup=()=>{clearTimeout(timer);unsubscribe?.();unsubscribe=null;state.cancel();search?.removeEventListener('input',onSearch);root?.removeEventListener('input',onInput);root?.removeEventListener('submit',onSubmit);root?.removeEventListener('click',onClick);}; lifecycle.addCleanup?.(cleanup);return cleanup;
  }
  window.KaretaServiceManagementPages=Object.freeze({renderServiceManagement,mountServiceManagement,NATIVE_SERVICE_CONTRACT});
})();
