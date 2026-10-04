(() => {
  'use strict';

  const store = window.KaretaShopState;
  const api = window.KaretaApiClient;
  const cards = window.KaretaCatalogCards;
  if (!store || !cards || !api) throw new Error('Parts dependencies are required before pages/parts.js');

  let unsubscribe=null;
  let contextRef=null;
  let usedRows=[];
  let usedLoading=false;
  let usedError='';
  let vehicles=[];
  let vehiclesLoaded=false;
  let selectedVehicleId='';
  let vehicleDialogMode='catalog';
  let marketMode='catalog'; // catalog | mine | favorites | compatible
  let mineStatus='all';
  let pendingMineFocusId='';
  let state={search:'',type:'all',category:'',city:'',sort:'newest',storeId:''};
  let storeMode='nearby';
  const storeTrust=new Map();
  const storeTrustPending=new Set();
  let pendingDeleteId='';
  let mineRows=[];
  let listingWizard=null;
  let listingSaving=false;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=value=>`${new Intl.NumberFormat('ru-RU').format(Number(value||0))} ₸`;
  const icon=name=>window.KaretaUIIcons?.svg?.(name)||window.KaretaUIIcons?.icon?.(name)||'';
  const surfaceKind=()=>String(location.hash||'').split('?')[0]==='#/parts/used'?'used':'new';
  const isUsedSurface=()=>surfaceKind()==='used';
  const isMasterContext=()=>String(window.KaretaNavigationCore?.interfaceRole?.()||window.KaretaRoleAccess?.currentRole?.()||'').toLowerCase()==='master';

  const typeMeta=Object.freeze({
    all:{label:'Все',title:'Все предложения',hint:'Новые, БУ, восстановленные и обмен'},
    new:{label:'Новые',title:'Новые запчасти',hint:'Магазины и новые частные позиции'},
    used:{label:'БУ',title:'БУ запчасти',hint:'Детали от владельцев и разборов'},
    restored:{label:'Восстановленные',title:'Восстановленные',hint:'Проверенные и восстановленные агрегаты'},
    exchange:{label:'Обмен',title:'Обменный фонд',hint:'Старая деталь + доплата или обмен'}
  });
  const conditionMeta=Object.freeze({
    new:'Новая',excellent:'Отличное',good:'Хорошее',fair:'Есть следы',repair:'Под ремонт',restored:'Восстановлена'
  });
  const deliveryMeta=Object.freeze({pickup:'Самовывоз',courier:'Курьер',transport:'Транспортная компания',seller_delivery:'Доставка продавца'});
  const listingStatusMeta=Object.freeze({
    active:{label:'Активно',hint:'Видно в Marketplace'},
    draft:{label:'Черновик',hint:'Не опубликовано'},
    sold:{label:'Продано',hint:'Снято после продажи'},
    archived:{label:'Снято',hint:'Скрыто из Marketplace'}
  });
  const fallbackCategories=Object.freeze({
    audio_speaker:{name:'Динамики',icon:'parts'},audio_sub:{name:'Сабвуферы',icon:'parts'},audio_amp:{name:'Усилители',icon:'battery'},audio_headunit:{name:'Магнитолы',icon:'product'},
    audio_cable:{name:'Кабели',icon:'services'},audio_box:{name:'Короба',icon:'parts'},audio_accessory:{name:'Автозвук',icon:'parts'},soundproof:{name:'Шумоизоляция',icon:'services'},
    camera:{name:'Камеры',icon:'camera'},electrical:{name:'Электрика',icon:'battery'},engine:{name:'Двигатель',icon:'diagnostics'},chassis:{name:'Ходовая',icon:'suspension'},
    body:{name:'Кузов',icon:'paint'},oils:{name:'Масла',icon:'oil'},tires:{name:'Шины и диски',icon:'tires'},merch:{name:'Аксессуары',icon:'product'},other:{name:'Другое',icon:'grid'}
  });

  function categoryIcon(name='',fallback='parts'){
    return window.KaretaUIIcons?.categoryIcon?.(name,fallback)||fallback;
  }
  function categoryMeta(key,categories=[]){
    const id=String(key||'other');
    const row=(Array.isArray(categories)?categories:[]).find(x=>String(x?.key||'')===id)||{};
    const fallback=fallbackCategories[id]||{name:id,icon:'parts'};
    const name=String(row.name||fallback.name),groupName=String(row.groupName||'');
    return {key:id,name,icon:categoryIcon(name+' '+groupName,fallback.icon),count:Number(row.count||0),groupName};
  }
  function uniqueCategories(snapshot){
    const map=new Map();
    (snapshot.categories||[]).forEach(row=>{const meta=categoryMeta(row.key,snapshot.categories);map.set(meta.key,meta);});
    usedRows.forEach(row=>{const meta=categoryMeta(row.category,snapshot.categories);if(!map.has(meta.key))map.set(meta.key,meta);});
    return [...map.values()].sort((a,b)=>(b.count-a.count)||a.name.localeCompare(b.name,'ru'));
  }
  function listingType(row){return ['new','used','restored','exchange'].includes(String(row?.listingType||''))?String(row.listingType):'used';}
  function productType(row){return String(row?.condition_code||'new')==='restored'?'restored':'new';}
  function selectedVehicle(){return vehicles.find(v=>String(v.id)===String(selectedVehicleId))||null;}
  function vehicleLabel(v){return [v?.brand,v?.model,v?.year].filter(Boolean).join(' ')||v?.plate_number||v?.plateNumber||'Автомобиль';}
  function vehicleTokens(v){return [v?.brand,v?.model,v?.year,v?.engine,v?.vin].map(x=>String(x||'').trim().toLowerCase()).filter(x=>x.length>1);}
  function explicitCompatibility(item,source,v){
    if(!v)return false;
    const tokens=vehicleTokens(v); if(!tokens.length)return false;
    const hay=source==='store'
      ? JSON.stringify(item?.fitment||item?.fitments||item?.fitment_json||'').toLowerCase()
      : `${item?.vehicle||''} ${item?.description||''}`.toLowerCase();
    if(!hay.trim())return false;
    const brand=String(v?.brand||'').toLowerCase(),model=String(v?.model||'').toLowerCase();
    if(brand&&model&&hay.includes(brand)&&hay.includes(model))return true;
    return tokens.filter(t=>t.length>=3).some(t=>hay.includes(t));
  }
  function readHashContext(){
    const raw=String(location.hash||''); const query=raw.includes('?')?raw.slice(raw.indexOf('?')+1):''; const params=new URLSearchParams(query);
    const q=params.get('q')||params.get('oem')||''; if(q)state.search=q;
    selectedVehicleId=params.get('vehicleId')||selectedVehicleId;
    return {orderId:params.get('orderId')||'',q,mine:params.get('mine')||'',focus:params.get('focus')||''};
  }
  function sortRows(rows){
    const list=[...rows];
    if(state.sort==='price_asc')list.sort((a,b)=>Number(a.price||0)-Number(b.price||0));
    else if(state.sort==='price_desc')list.sort((a,b)=>Number(b.price||0)-Number(a.price||0));
    else if(state.sort==='popular')list.sort((a,b)=>Number(b.views||0)-Number(a.views||0));
    else list.sort((a,b)=>String(b.createdAt||b.updated_at||b.updatedAt||'').localeCompare(String(a.createdAt||a.updated_at||a.updatedAt||'')));
    return list;
  }
  function textMatch(row,query,source){
    const q=String(query||'').trim().toLowerCase(); if(!q)return true;
    const hay=source==='store'
      ? [row.name,row.sku,row.oem_number,row.brand,row.description,row.store_name,JSON.stringify(row.fitment||[])].join(' ').toLowerCase()
      : [row.title,row.oem,row.brand,row.vehicle,row.description,row.sellerName,row.exchangeNote].join(' ').toLowerCase();
    return hay.includes(q);
  }
  function cityMatch(row,source){if(!state.city)return true;return String(source==='store'?(row.city||row.storeCity||''):row.city||'').toLowerCase().includes(state.city.toLowerCase());}
  function categoryMatch(row){return !state.category||String(row.category||'other')===state.category;}
  function typeMatch(row,source){
    if(state.type==='all')return true;
    if(source==='store')return productType(row)===state.type||(state.type==='exchange'&&Number(row.exchange_available||0)===1);
    return listingType(row)===state.type;
  }
  function storeRows(snapshot){return sortRows((snapshot.products||[]).filter(x=>textMatch(x,state.search,'store')&&categoryMatch(x)&&cityMatch(x,'store')&&typeMatch(x,'store')&&(!state.storeId||String(x.seller_user_id||'')===String(state.storeId))));}
  function storeDirectory(snapshot){
    const map=new Map();
    (snapshot.products||[]).forEach(product=>{
      const id=String(product.seller_user_id??'').trim();if(!id)return;
      const current=map.get(id)||{id,name:String(product.store_name||'Магазин'),city:String(product.city||''),address:String(product.warehouse_address||''),products:0,rating:0,reviews:0};
      current.products+=1;
      if(!current.city)current.city=String(product.city||'');
      if(!current.address)current.address=String(product.warehouse_address||'');
      const trust=storeTrust.get(id);if(trust){current.rating=Number(trust.rating||0);current.reviews=Number(trust.reviews||0);}
      map.set(id,current);
    });
    const rows=[...map.values()];
    if(storeMode==='rating')rows.sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)||Number(b.products||0)-Number(a.products||0)||a.name.localeCompare(b.name,'ru'));
    else if(storeMode==='nearby'&&state.city){const city=state.city.toLowerCase();rows.sort((a,b)=>Number(String(b.city||'').toLowerCase().includes(city))-Number(String(a.city||'').toLowerCase().includes(city))||Number(b.products||0)-Number(a.products||0));}
    else rows.sort((a,b)=>Number(b.products||0)-Number(a.products||0)||a.name.localeCompare(b.name,'ru'));
    return rows;
  }
  function storeStrip(snapshot){
    if(isUsedSurface())return '';
    const rows=storeDirectory(snapshot);
    if(!rows.length)return '<section class="k-parts-store-stories"><header><div><h2>Магазины</h2><p>Магазины появятся после загрузки каталога.</p></div></header><div class="k-parts-store-stories__empty">Пока нет магазинов с активными товарами.</div></section>';
    return `<section class="k-parts-store-stories"><header><div><h2>Магазины</h2><p>Выберите магазин или продолжайте по категориям.</p></div>${state.storeId?'<button type="button" data-parts-store-clear>Все магазины</button>':''}</header><div class="k-parts-store-strip" data-parts-store-strip>${rows.map(row=>{const initials=String(row.name||'М').split(/\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'М';const rating=Number(row.rating||0);return `<button type="button" class="k-parts-store-story ${String(state.storeId)===String(row.id)?'is-active':''}" data-parts-store="${esc(row.id)}" aria-label="Магазин ${esc(row.name)}"><span class="k-parts-store-avatar"><b>${esc(initials)}</b>${rating>0?`<i>${rating.toFixed(1)}</i>`:''}</span><strong>${esc(row.name)}</strong><small>${esc(row.city||`${row.products} товаров`)}</small></button>`;}).join('')}</div></section>`;
  }
  async function hydrateStoreTrust(snapshot){
    if(isUsedSurface())return;
    const ids=storeDirectory(snapshot).map(x=>x.id).filter(id=>!storeTrust.has(id)&&!storeTrustPending.has(id)).slice(0,12);
    if(!ids.length)return;
    ids.forEach(id=>storeTrustPending.add(id));
    await Promise.all(ids.map(async id=>{try{const res=await api.getStoreDetail(id,{signal:contextRef?.lifecycle?.signal});const trust=res?.ok?res.payload?.data?.trust:null;storeTrust.set(id,{rating:Number(trust?.reviewAverage||0),reviews:Number(trust?.reviewCount||0)});}catch(_e){storeTrust.set(id,{rating:0,reviews:0});}finally{storeTrustPending.delete(id);}}));
    const host=document.querySelector('[data-parts-stores]');if(host)host.innerHTML=storeStrip(store.getSnapshot());
  }
  function privateRows(){return sortRows(usedRows.filter(x=>textMatch(x,state.search,'used')&&categoryMatch(x)&&cityMatch(x,'used')&&typeMatch(x,'used')));}
  function marketItems(snapshot){
    const storeItems=storeRows(snapshot).filter(item=>productType(item)==='new').map(item=>({source:'store',item}));
    const usedItems=privateRows().filter(item=>['used','restored','exchange'].includes(listingType(item))).map(item=>({source:'used',item}));
    const scoped=isUsedSurface()?usedItems:storeItems;
    return sortRows(scoped.map(x=>({...x,price:Number(x.item.price||0),createdAt:x.item.createdAt||x.item.updated_at||x.item.updatedAt||''}))).map(x=>({source:x.source,item:x.item}));
  }

  function listingStatus(item){const key=String(item?.status||'active');return listingStatusMeta[key]?key:'active';}
  function ownerListingActions(item){
    if(!item?.isMine)return '';
    const status=listingStatus(item),id=esc(item.id),editLabel=status==='draft'?'Продолжить':'Редактировать';
    const statusActions=status==='active'
      ? `<button type="button" data-used-status="sold" data-used-id="${id}">Продано</button><button type="button" data-used-status="archived" data-used-id="${id}">Снять</button>`
      : (status==='sold'||status==='archived')?`<button type="button" data-used-status="active" data-used-id="${id}">Вернуть</button>`:'';
    return `<div class="k-parts-owner-actions"><button type="button" data-used-edit="${id}">${editLabel}</button>${statusActions}</div>`;
  }
  function usedCard(item,categories=[]){
    const cat=categoryMeta(item.category,categories),type=typeMeta[listingType(item)]||typeMeta.used,status=listingStatus(item),statusMeta=listingStatusMeta[status];
    const price=item.priceNegotiable?'По договорённости':(listingType(item)==='exchange'&&Number(item.price||0)<=0?'Обмен':money(item.price));
    const href=`#/parts/item/${encodeURIComponent(`used:${item.id}`)}`;
    const focusClass=pendingMineFocusId&&String(item.id)===String(pendingMineFocusId)?' is-owner-focus':'';
    const referenceImage=!item.image?(window.KaretaVisualAssets?.partImage?.([item.category,cat.name,item.title].filter(Boolean).join(' '))||''):'',media=item.image||referenceImage;
    return `<article class="k-parts-native-card k-parts-native-card--used${focusClass}" data-used-card="${esc(item.id)}">
      <a class="k-parts-native-card__open" href="${href}" aria-label="Открыть ${esc(item.title)}"></a>
      <div class="k-parts-native-card__media">${media?`<img src="${esc(media)}" alt="${esc(item.title)}" loading="lazy" class="${referenceImage?'is-reference-part':''}">`:`<span>${icon(cat.icon)}</span>`}<b>${esc(type.label)}</b></div>
      <div class="k-parts-native-card__body"><small>${esc(cat.name)} · ${esc(item.city||'Город не указан')}</small><h3><a href="${href}">${esc(item.title||'Черновик объявления')}</a></h3><p>${esc(item.vehicle||item.description||'Без описания совместимости')}</p>
      <div class="k-parts-native-tags">${item.brand?`<span>${esc(item.brand)}</span>`:''}${item.oem?`<span>OEM ${esc(item.oem)}</span>`:''}<span>${esc(conditionMeta[item.condition]||'БУ')}</span></div>
      ${item.isMine?`<div class="k-parts-owner-state is-${status}"><b>${esc(statusMeta.label)}</b><small>${esc(status==='draft'?`Шаг ${Number(item.draftStep||1)} из 8 · ${statusMeta.hint}`:statusMeta.hint)}</small></div>`:''}
      <footer><div><b>${price}</b><small>${item.isMine?`${Number(item.views||0)} просмотров`:`${esc(item.sellerName||'Владелец')} · ${Number(item.views||0)} просмотров`}</small></div>${item.isMine?'':`<button type="button" data-used-favorite="${esc(item.id)}" data-active="${item.favorite?'1':'0'}" aria-label="Сохранить">${icon('heart')}</button>`}</footer>${ownerListingActions(item)}</div>
    </article>`;
  }
  function refProductCard(product,categories=[]){
    const cat=categoryMeta(product.category,categories),href=`#/parts/item/${encodeURIComponent(product.id)}`,title=String(product.name||product.title||'Запчасть'),brand=String(product.brand||product.manufacturer||cat.name||'KARETA'),stock=Number(product.stock_qty??product.stock??0),image=String(product.image_url||product.image||''),price=Number(product.price||0);
    const referenceImage=!image?(window.KaretaVisualAssets?.partImage?.([product.category,cat.name,title].filter(Boolean).join(' '))||''):'',media=image||referenceImage;
    return `<article class="k-parts-ref-card" data-product-href="${href}">
      <a class="k-parts-ref-card__media" href="${href}" aria-label="Открыть ${esc(title)}">${media?`<img src="${esc(media)}" alt="${esc(title)}" loading="lazy" decoding="async" class="${referenceImage?'is-reference-part':''}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="k-parts-ref-card__placeholder" hidden>${icon(cat.icon)}</span>`:`<span class="k-parts-ref-card__placeholder">${icon(cat.icon)}</span>`}</a>
      <div class="k-parts-ref-card__body"><small>${esc(brand)}</small><h3><a href="${href}">${esc(title)}</a></h3><p>${stock>0?'В наличии':(product.stock_status||'Наличие уточняется')}</p></div>
      <footer><strong>${money(price)}</strong><div><button type="button" class="k-parts-ref-favorite" aria-label="В избранное">${icon('heart')}</button><button type="button" class="k-parts-ref-cart" data-shop-add="${esc(product.id)}" aria-label="Добавить в корзину">${icon('cart')}<span>Купить</span></button></div></footer>
    </article>`;
  }
  function itemCard(entry,categories){return entry.source==='store'?refProductCard(entry.item,categories):usedCard(entry.item,categories);}
  function itemGrid(entries,categories,empty='Пока нет предложений.'){return entries.length?`<div class="k-parts-native-grid k-parts-ref-grid">${entries.map(x=>itemCard(x,categories)).join('')}</div>`:`<div class="k-parts-native-empty">${esc(empty)}</div>`;}
  function section(title,subtitle,entries,categories,kind){return `<section class="k-parts-ref-section k-parts-native-section--${esc(kind)}"><header><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" data-market-window="${esc(kind)}">Все · ${entries.length}</button></header>${itemGrid(entries.slice(0,12),categories,'По этим условиям пока ничего нет.')}</section>`;}
  function utilityCards(){
    const vehicle=`<button type="button" data-parts-vehicle-open><span>${icon('car')}</span><b>${selectedVehicle()?esc(vehicleLabel(selectedVehicle())):'Мой автомобиль'}</b><small>${selectedVehicle()?'Подбор по совместимости':'Выбрать для подбора'}</small></button>`;
    if(!isUsedSurface())return `<div class="k-parts-native-utility">${vehicle}<a class="k-parts-utility-link" href="#/parts/used"><span>${icon('parts')}</span><b>Биржа БУ</b><small>Частные объявления, восстановленные и обмен</small></a></div>`;
    return `<div class="k-parts-native-utility">${vehicle}<button type="button" data-used-add><span>${icon('plus')}</span><b>Продать деталь</b><small>БУ, восстановленная или обмен</small></button><button type="button" data-market-mode="favorites"><span>${icon('heart')}</span><b>Избранное</b><small>Сохранённые частные объявления</small></button><button type="button" data-market-mode="mine"><span>${icon('user')}</span><b>Мои объявления</b><small>Управление своими деталями</small></button></div>`;
  }
  function categoryGrid(snapshot){const cats=uniqueCategories(snapshot).slice(0,10);return `<section class="k-parts-ref-categories"><header><h2>Категории</h2><button type="button" data-market-window="all">Все категории</button></header><div>${cats.map(cat=>`<button type="button" class="${state.category===cat.key?'is-active':''}" data-market-category="${esc(cat.key)}"><span>${icon(cat.icon)}</span><b>${esc(cat.name)}</b></button>`).join('')}</div></section>`;}
  function compatibleSection(snapshot){
    const v=selectedVehicle();if(!v)return '';
    const entries=isUsedSurface()
      ? usedRows.filter(x=>['used','restored','exchange'].includes(listingType(x))&&explicitCompatibility(x,'used',v)).map(item=>({source:'used',item}))
      : (snapshot.products||[]).filter(x=>productType(x)==='new'&&explicitCompatibility(x,'store',v)).map(item=>({source:'store',item}));
    return `<section class="k-parts-native-section k-parts-native-compatible"><header><div><small>МОЙ АВТОМОБИЛЬ</small><h2>Подходит по указанной совместимости</h2><p>${esc(vehicleLabel(v))}. KARETA показывает только позиции текущей биржи, где продавец явно указал совместимость; перед покупкой сверяйте OEM/VIN.</p></div><div class="k-parts-section-actions"><button type="button" data-compatible-window>Открыть список · ${entries.length}</button><button type="button" data-parts-vehicle-open>Сменить авто</button></div></header>${itemGrid(entries.slice(0,6),snapshot.categories||[],'Для этого автомобиля пока нет явно подтверждённых совпадений.')}</section>`;
  }
  function catalogContent(snapshot){
    const categories=snapshot.categories||[],storeAll=snapshot.products||[];
    if(snapshot.status==='loading'&&!storeAll.length&&!usedRows.length)return `<div class="k-parts-native-loading">Загружаем Marketplace…</div>`;
    if(!isUsedSurface()){
      const newEntries=storeAll.filter(x=>productType(x)==='new').map(item=>({source:'store',item}));
      return `${compatibleSection(snapshot)}${section('Новые запчасти','Только новые товары магазинов: наличие, доставка и корзина.',newEntries,categories,'new')}`;
    }
    const usedEntries=usedRows.filter(x=>listingType(x)==='used').map(item=>({source:'used',item}));
    const restoredEntries=usedRows.filter(x=>listingType(x)==='restored').map(item=>({source:'used',item}));
    const exchangeEntries=usedRows.filter(x=>listingType(x)==='exchange').map(item=>({source:'used',item}));
    return `${compatibleSection(snapshot)}${section('БУ рядом','Реальные частные объявления и детали с разборов.',usedEntries,categories,'used')}${section('Восстановленные','Агрегаты и детали после восстановления.',restoredEntries,categories,'restored')}${section('Обменный фонд','Обмен детали или агрегата с доплатой.',exchangeEntries,categories,'exchange')}`;
  }
  function marketWindowMeta(snapshot){
    const cat=state.category?categoryMeta(state.category,snapshot.categories||[]):null;
    if(marketMode==='mine')return {eyebrow:'МОИ ОБЪЯВЛЕНИЯ',title:'Мои детали',subtitle:'Публикация и управление своими объявлениями.'};
    if(marketMode==='favorites')return {eyebrow:'ИЗБРАННОЕ',title:'Сохранённые детали',subtitle:'Ваши сохранённые частные предложения.'};
    if(marketMode==='compatible')return {eyebrow:'МОЙ АВТОМОБИЛЬ',title:selectedVehicle()?`Подходит: ${vehicleLabel(selectedVehicle())}`:'Совместимые детали',subtitle:'Только позиции с явно указанной продавцом совместимостью.'};
    if(state.search)return {eyebrow:'ПОИСК',title:`Результаты: ${state.search}`,subtitle:'Новые, БУ, восстановленные и обмен в одном окне.'};
    if(cat)return {eyebrow:'КАТЕГОРИЯ',title:cat.name,subtitle:'Все предложения выбранной категории.'};
    if(state.type!=='all')return {eyebrow:typeMeta[state.type]?.label||'MARKETPLACE',title:typeMeta[state.type]?.title||'Запчасти',subtitle:typeMeta[state.type]?.hint||''};
    return {eyebrow:'MARKETPLACE',title:'Все предложения',subtitle:'Новые, БУ, восстановленные и обмен.'};
  }
  function marketWindowEntries(snapshot){
    let entries=marketItems(snapshot);
    if(marketMode==='mine')entries=mineRows.filter(item=>mineStatus==='all'||listingStatus(item)===mineStatus).map(item=>({source:'used',item}));
    if(marketMode==='favorites')entries=entries.filter(x=>x.source==='used'&&x.item.favorite);
    if(marketMode==='compatible'){const v=selectedVehicle();entries=v?entries.filter(x=>explicitCompatibility(x.item,x.source,v)):[];}
    return entries;
  }
  function mineStatusControls(){
    const counts=mineRows.reduce((acc,item)=>{const key=listingStatus(item);acc.all+=1;acc[key]=(acc[key]||0)+1;return acc;},{all:0,active:0,draft:0,sold:0,archived:0});
    const labels={all:'Все',active:'Активные',draft:'Черновики',sold:'Продано',archived:'Снятые'};
    return `<div class="k-parts-mine-status">${Object.keys(labels).map(key=>`<button type="button" class="${mineStatus===key?'is-active':''}" data-mine-status="${key}"><b>${labels[key]}</b><span>${Number(counts[key]||0)}</span></button>`).join('')}</div>`;
  }
  function renderMarketWindow(snapshot){
    const body=document.querySelector('[data-market-list-body]'); if(!body)return;
    const meta=marketWindowMeta(snapshot),entries=marketWindowEntries(snapshot),mineTools=marketMode==='mine'?mineStatusControls():'';
    body.innerHTML=`<header><div><small>${esc(meta.eyebrow)}</small><h2>${esc(meta.title)}</h2><p>${esc(meta.subtitle)} · ${entries.length} предложений</p></div><button type="button" data-dialog-close="market">${icon('close')}</button></header>${mineTools}${usedLoading?'<div class="k-parts-native-loading">Обновляем объявления…</div>':''}${usedError?`<div class="k-parts-native-error">${esc(usedError)}</div>`:''}${itemGrid(entries,snapshot.categories||[],'По этим условиям ничего не найдено.')}`;
    if(marketMode==='mine'&&pendingMineFocusId){requestAnimationFrame(()=>[...body.querySelectorAll('[data-used-card]')].find(card=>String(card.dataset.usedCard||'')===String(pendingMineFocusId))?.scrollIntoView?.({block:'center'}));}
  }


  function renderParts(){
    const hashCtx=readHashContext(),used=isUsedSurface();
    return `<section class="k-page${isMasterContext()?' k-master-page k-master-surface-page':''} k-shop-page k-parts-native-page k-parts-ref-page" data-page="${used?'parts-used':'parts-new'}" data-parts-surface="${used?'used':'new'}" data-kflow-screen="parts">
      <header class="k-parts-ref-head${isMasterContext()?' k-master-page-header':''}"><div><h1>Запчасти</h1><p>${used?'БУ, восстановленные детали и обмен':'Новые запчасти и товары магазинов'}</p></div>${used?`<button class="k-parts-ref-head-action" type="button" data-used-add aria-label="Продать деталь">${icon('plus')}</button>`:`<button class="k-parts-ref-head-action" type="button" data-shop-cart-open aria-label="Корзина">${icon('cart')}<i data-shop-cart-count>0</i></button>`}</header>
      ${hashCtx.orderId?`<section class="k-parts-repair-context"><span>РЕМОНТ</span><div><b>Подбор для заказа ${esc(hashCtx.orderId)}</b><small>Найденную позицию можно затем зарезервировать в заказ-наряде.</small></div><a href="#/orders/item/${encodeURIComponent(hashCtx.orderId)}">К ремонту</a></section>`:''}
      <section class="k-parts-ref-search k-parts-master-search"><label><span>${icon('search')}</span><input type="search" data-parts-search value="${esc(state.search)}" placeholder="Найти запчасть, OEM или магазин…" autocomplete="off"></label></section>
      <div class="k-parts-master-filters" aria-label="Фильтры магазинов"><button type="button" class="${storeMode==='nearby'?'is-active ':''}is-nearby" data-parts-mode="nearby"><span>${icon('location')}</span><b>Рядом</b></button><button type="button" class="${storeMode==='rating'?'is-active ':''}is-rating" data-parts-mode="rating"><span>${icon('star')}</span><b>Рейтинг</b></button><button type="button" class="is-open" disabled aria-disabled="true" title="График магазинов пока не передаётся каталогом"><span>${icon('calendar')}</span><b>Открыто</b></button><button type="button" class="k-parts-master-filter-icon" data-parts-filter-open aria-label="Дополнительные фильтры">${icon('filter')}<i data-parts-filter-count>0</i></button></div>
      <div data-parts-stores></div>
      <section class="k-parts-ref-vehicle"><button type="button" data-parts-vehicle-open><span>${icon('car')}</span><span><b>${selectedVehicle()?esc(vehicleLabel(selectedVehicle())):'Подобрать по автомобилю'}</b><small>${selectedVehicle()?'Проверять совместимость':'Выберите авто из гаража'}</small></span><i>${icon('chevronRight')}</i></button></section>
      ${used?`<section class="k-parts-ref-used-actions"><button type="button" data-used-add>${icon('plus')}<span><b>Продать деталь</b><small>Создать объявление</small></span></button><button type="button" data-market-mode="favorites">${icon('heart')}<span><b>Избранное</b><small>Сохранённые</small></span></button><button type="button" data-market-mode="mine"><span>${icon('user')}</span><span><b>Мои объявления</b><small>Управление</small></span></button></section>`:''}
      <div data-parts-categories></div>
      <main class="k-parts-ref-main" data-shop-navigator aria-live="polite"></main><aside class="k-flow-parts-cart k-parts-ref-legacy-contract" hidden aria-hidden="true"></aside>
      ${dialogs()}
    </section>`;
  }

  function dialogs(){return `
    <dialog class="k-parts-native-dialog k-parts-market-list-dialog" data-parts-market-list-dialog><div class="k-parts-native-dialog__panel k-parts-market-list-panel" data-market-list-body></div></dialog>
    <dialog class="k-parts-native-dialog k-parts-ref-filter-dialog" data-parts-filter-dialog><div class="k-parts-native-dialog__panel"><header><div><small>ФИЛЬТРЫ</small><h2>Настроить выдачу</h2></div><button type="button" data-dialog-close="filter">${icon('close')}</button></header><div data-parts-filter-body></div><footer><button type="button" data-parts-filter-reset>Сбросить</button><button type="button" class="k-btn k-btn-primary" data-parts-filter-apply>Применить</button></footer></div></dialog>
    <dialog class="k-parts-native-dialog" data-parts-vehicle-dialog><div class="k-parts-native-dialog__panel"><header><div><small>ГАРАЖ</small><h2>Выбрать автомобиль</h2></div><button type="button" data-dialog-close="vehicle">${icon('close')}</button></header><div class="k-parts-vehicle-list" data-parts-vehicle-list></div></div></dialog>
    <dialog class="k-parts-native-dialog k-parts-listing-wizard-dialog" data-used-form-dialog><form class="k-parts-listing-wizard k-parts-listing-wizard--ref" data-used-form novalidate><header><div class="k-listing-ref-head"><small>ОБЪЯВЛЕНИЕ · <span data-listing-step-label>ЭТАП 1 ИЗ 4</span></small><h2 data-used-form-title>Продать деталь</h2><div class="k-listing-main-steps" data-listing-main-steps aria-label="Этапы объявления"><span class="is-active">1</span><span>2</span><span>3</span><span>4</span></div></div><button type="button" data-dialog-close="listing">${icon('close')}</button></header><input type="hidden" name="id"><div class="k-listing-wizard-body" data-listing-wizard-body></div><footer><button type="button" data-listing-back>Назад</button><button type="button" data-listing-draft>Сохранить черновик</button><button type="button" class="k-btn k-btn-primary" data-listing-next>Далее</button><button type="button" class="k-btn k-btn-primary" data-listing-publish hidden>Опубликовать</button></footer><input type="file" data-listing-gallery accept="image/jpeg,image/png,image/webp" multiple hidden><input type="file" data-listing-camera accept="image/jpeg,image/png,image/webp" capture="environment" hidden></form></dialog>
    <dialog class="k-parts-native-dialog" data-parts-category-dialog><div class="k-parts-native-dialog__panel"><header><div><small>КАТЕГОРИЯ</small><h2>Выбрать категорию</h2></div><button type="button" data-dialog-close="category">${icon('close')}</button></header><div class="k-parts-category-choice" data-parts-category-choice></div></div></dialog>
    <dialog class="k-parts-native-dialog" data-delete-dialog><div class="k-parts-native-dialog__panel k-parts-confirm"><header><div><small>ОБЪЯВЛЕНИЕ</small><h2>Удалить объявление?</h2></div><button type="button" data-dialog-close="delete">${icon('close')}</button></header><p>Оно исчезнет из Marketplace. Восстановление через этот экран не предусмотрено.</p><footer><button type="button" data-dialog-close="delete">Отмена</button><button type="button" class="k-btn k-btn-primary" data-used-delete-confirm>Удалить</button></footer></div></dialog>
    <dialog class="k-shop-cart-dialog k-parts-native-cart k-parts-ref-cart-dialog" data-shop-cart-dialog><div class="k-shop-cart-head"><div><h2>Корзина</h2><p>Новые товары магазинов</p></div><button type="button" data-dialog-close="cart">${icon('close')}</button></div><div data-shop-cart-items></div><div class="k-shop-cart-total"><span>Итого</span><b data-shop-cart-total>0 ₸</b></div><form class="k-shop-checkout" data-shop-checkout><label><span>Имя *</span><input name="customerName" required autocomplete="name"></label><label><span>Телефон *</span><input name="customerPhone" required type="tel" autocomplete="tel"></label><input type="hidden" name="deliveryType" value="pickup"><section><span>Получение</span><div class="k-parts-choice-grid">${[['pickup','Самовывоз'],['courier','Курьер'],['transport','Транспортная компания']].map(([v,l])=>`<button type="button" data-delivery-type="${v}" class="${v==='pickup'?'is-active':''}"><b>${l}</b></button>`).join('')}</div></section><label><span>Адрес доставки</span><input name="deliveryAddress" autocomplete="street-address"></label><div class="k-shop-checkout-error" data-shop-checkout-error hidden></div><button class="k-btn k-btn-primary" type="submit">Оформить заказ</button></form></dialog>`;}

  function renderFilter(snapshot){
    const root=document.querySelector('[data-parts-filter-body]');if(!root)return;
    const categories=uniqueCategories(snapshot);
    const typeBlock=isUsedSurface()?`<section><span>Тип предложения</span><div class="k-parts-choice-grid">${['all','used','restored','exchange'].map(t=>`<button type="button" class="${state.type===t?'is-active':''}" data-filter-type="${t}"><b>${typeMeta[t].label}</b></button>`).join('')}</div></section>`:'';
    root.innerHTML=`${typeBlock}<section><span>Категория</span><div class="k-parts-filter-categories"><button type="button" class="${!state.category?'is-active':''}" data-filter-category="">Все</button>${categories.map(c=>`<button type="button" class="${state.category===c.key?'is-active':''}" data-filter-category="${esc(c.key)}">${esc(c.name)}</button>`).join('')}</div></section><label><span>Город</span><input type="text" data-filter-city value="${esc(state.city)}" placeholder="Например, Усть-Каменогорск"></label><section><span>Сортировка</span><div class="k-parts-choice-grid">${[['newest','Сначала новые'],['price_asc','Сначала дешевле'],['price_desc','Сначала дороже'],['popular','Популярные']].map(([v,l])=>`<button type="button" class="${state.sort===v?'is-active':''}" data-filter-sort="${v}"><b>${l}</b></button>`).join('')}</div></section>`;
  }
  function renderVehicles(){
    const root=document.querySelector('[data-parts-vehicle-list]');if(!root)return;
    if(!vehiclesLoaded){root.innerHTML='<div class="k-parts-native-loading">Загружаем гараж…</div>';return;}
    root.innerHTML=`<button type="button" class="k-parts-vehicle-card ${!selectedVehicleId?'is-active':''}" data-vehicle-id=""><span>${icon('car')}</span><div><b>Без автомобиля</b><small>Не ограничивать подбор</small></div></button>${vehicles.map(v=>`<button type="button" class="k-parts-vehicle-card ${String(v.id)===String(selectedVehicleId)?'is-active':''}" data-vehicle-id="${esc(v.id)}"><span>${icon('car')}</span><div><b>${esc(vehicleLabel(v))}</b><small>${esc(v.plate_number||v.plateNumber||v.vin||'Автомобиль из гаража')}</small></div></button>`).join('')||'<div class="k-parts-native-empty">В гараже пока нет автомобилей.</div>'}`;
  }
  function renderCategoryChoice(snapshot){const root=document.querySelector('[data-parts-category-choice]');if(root)root.innerHTML=uniqueCategories(snapshot).map(c=>`<button type="button" data-listing-category="${esc(c.key)}"><span>${icon(c.icon)}</span><b>${esc(c.name)}</b></button>`).join('');}
  function updateCounters(snapshot){
    const count=[state.search,state.type!=='all'?state.type:'',state.category,state.city,state.sort!=='newest'?state.sort:'',state.storeId].filter(Boolean).length;const el=document.querySelector('[data-parts-filter-count]');if(el)el.textContent=String(count);
    document.querySelectorAll('[data-shop-cart-count]').forEach(cartCount=>{cartCount.textContent=String((snapshot.cart||[]).reduce((s,x)=>s+Number(x.qty||0),0));});
  }
  function renderSnapshot(snapshot){
    const nav=document.querySelector('[data-shop-navigator]');if(!nav)return;
    const stores=document.querySelector('[data-parts-stores]');if(stores)stores.innerHTML=storeStrip(snapshot);
    const cats=document.querySelector('[data-parts-categories]');if(cats)cats.innerHTML=categoryGrid(snapshot);
    nav.innerHTML=catalogContent(snapshot);
    renderFilter(snapshot);renderVehicles();renderCategoryChoice(snapshot);updateCounters(snapshot);hydrateStoreTrust(snapshot);if(document.querySelector('[data-parts-market-list-dialog]')?.open)renderMarketWindow(snapshot);
    const cartItems=document.querySelector('[data-shop-cart-items]'),cartTotal=document.querySelector('[data-shop-cart-total]');
    if(cartItems)cartItems.innerHTML=(snapshot.cart||[]).length?(snapshot.cart||[]).map(item=>`<article class="k-shop-cart-item"><div><b>${esc(item.name)}</b><small>${esc(item.storeName||'')}</small></div><div class="k-shop-cart-qty"><button type="button" data-shop-qty="${esc(item.id)}" data-delta="-1">−</button><span>${Number(item.qty||0)}</span><button type="button" data-shop-qty="${esc(item.id)}" data-delta="1">+</button></div><strong>${money(Number(item.price||0)*Number(item.qty||0))}</strong></article>`).join(''):'<div class="k-parts-native-empty">Корзина пуста.</div>';
    if(cartTotal)cartTotal.textContent=money((snapshot.cart||[]).reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||0),0));
  }

  async function loadUsed(){
    usedLoading=true;usedError='';renderSnapshot(store.getSnapshot());
    try{
      const params={sort:'newest'};
      const res=await api.getUsedMarket(params,{signal:contextRef?.lifecycle?.signal});if(!res.ok)throw new Error(res.payload?.message||res.payload?.error||'Не удалось загрузить частные объявления');
      usedRows=Array.isArray(res.payload?.items)?res.payload.items:[];
    }catch(error){usedRows=[];usedError=error?.message||'Не удалось загрузить частные объявления';}
    finally{usedLoading=false;renderSnapshot(store.getSnapshot());}
  }
  async function loadVehicles(){
    try{const res=await api.request('api/db.php?action=clientCabinet.get',{cacheTtlMs:15000,cacheKey:'client.cabinet.parts',signal:contextRef?.lifecycle?.signal});vehicles=Array.isArray(res.payload?.data?.vehicles)?res.payload.data.vehicles:[];}catch(_e){vehicles=[];}finally{vehiclesLoaded=true;renderVehicles();if(selectedVehicleId&&!vehicles.some(v=>String(v.id)===String(selectedVehicleId)))selectedVehicleId='';renderSnapshot(store.getSnapshot());}
  }
  function applyFilters(){renderFilter(store.getSnapshot());updateCounters(store.getSnapshot());renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');}
  function resetFilters(){state={search:'',type:'all',category:'',city:'',sort:'newest',storeId:''};marketMode='catalog';storeMode='nearby';const search=document.querySelector('[data-parts-search]');if(search)search.value='';renderSnapshot(store.getSnapshot());}
  function openDialog(name){document.querySelector(`[data-${name}-dialog]`)?.showModal?.();}
  function closeDialog(name){document.querySelector(`[data-${name}-dialog]`)?.close?.();}
  function blankListingWizard(item=null){
    const donor=item?.donorVehicle&&typeof item.donorVehicle==='object'?item.donorVehicle:{};
    return {id:item?.id||'',step:item?.status==='draft'?Math.max(1,Math.min(8,Number(item?.draftStep||1))):1,listingType:item?.listingType||'used',images:[...(item?.images||[])].slice(0,8),title:item?.title||'',category:item?.category||'other',brand:item?.brand||'',oem:item?.oem||'',vehicle:item?.vehicle||'',sourceVehicleId:item?.sourceVehicleId||'',donorVehicle:{brand:donor.brand||'',model:donor.model||'',year:donor.year||'',engine:donor.engine||'',mileage:Number(donor.mileage||0),note:donor.note||'',unknown:Boolean(donor.unknown)},condition:item?.condition||'good',defects:item?.defects||'',description:item?.description||'',price:Number(item?.price||0),priceNegotiable:Boolean(item?.priceNegotiable),exchangeNote:item?.exchangeNote||'',city:item?.city||'',deliveryModes:[...(item?.deliveryModes||[])],deliveryNote:item?.deliveryNote||'',status:item?.status||'draft'};
  }
  function wizardVehicleLabel(){const source=vehicles.find(v=>String(v.id)===String(listingWizard?.sourceVehicleId||''));if(source)return vehicleLabel(source);const d=listingWizard?.donorVehicle||{};return [d.brand,d.model,d.year].filter(Boolean).join(' ')||(d.unknown?'Неизвестен':'Не выбран');}
  function listingStepTitle(step){return ['Тип объявления','Фотографии','Деталь и OEM','Автомобиль-донор','Состояние и дефекты','Цена и обмен','Получение и доставка','Проверка объявления'][Math.max(0,step-1)]||'Объявление';}
  function listingConditionChoices(){return [['excellent','Отличное','Без заметных дефектов'],['good','Хорошее','Обычные следы эксплуатации'],['fair','Есть следы','Есть заметные дефекты'],['repair','Под ремонт','Нужен ремонт или восстановление']];}
  function listingPreview(){const w=listingWizard||blankListingWizard(),cat=categoryMeta(w.category,store.getSnapshot().categories||[]),type=typeMeta[w.listingType]||typeMeta.used;const price=w.priceNegotiable?'По договорённости':(w.listingType==='exchange'&&Number(w.price||0)<=0?'Обмен':money(w.price));return `<div class="k-listing-preview"><div class="k-listing-preview-media">${w.images[0]?`<img src="${esc(w.images[0])}" alt="">`:`<span>${icon(cat.icon)}</span>`}<b>${esc(type.label)}</b></div><div><small>${esc(cat.name)} · ${esc(w.city||'Город не указан')}</small><h3>${esc(w.title||'Без названия')}</h3><p>${esc(w.vehicle||'Совместимость не указана')}</p><div class="k-parts-native-tags">${w.brand?`<span>${esc(w.brand)}</span>`:''}${w.oem?`<span>OEM ${esc(w.oem)}</span>`:''}<span>${esc(conditionMeta[w.condition]||'Состояние')}</span></div><strong>${esc(price)}</strong></div></div><div class="k-listing-review-grid"><article><small>Автомобиль-донор</small><b>${esc(wizardVehicleLabel())}</b></article><article><small>Фото</small><b>${w.images.length} из 8</b></article><article><small>Получение</small><b>${esc((w.deliveryModes||[]).map(x=>deliveryMeta[x]||x).join(', ')||'Не выбрано')}</b></article><article><small>Дефекты</small><b>${esc(w.defects||'Не указаны')}</b></article></div>${w.exchangeNote?`<div class="k-listing-review-text"><small>Условия обмена</small><p>${esc(w.exchangeNote)}</p></div>`:''}<div class="k-listing-review-text"><small>Описание</small><p>${esc(w.description||'Описание пока не заполнено')}</p></div>`;}
  function listingStepHtml(){const w=listingWizard||blankListingWizard(),cats=store.getSnapshot().categories||[],cat=categoryMeta(w.category,cats);switch(w.step){
    case 1:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 1</small><h3>Что вы хотите разместить?</h3><p>Тип определяет правила цены, состояния и обмена.</p></div><div class="k-parts-choice-grid k-listing-type-grid">${['used','restored','exchange','new'].map(t=>`<button type="button" data-wizard-type="${t}" class="${w.listingType===t?'is-active':''}"><b>${esc(typeMeta[t].label)}</b><small>${esc(typeMeta[t].hint)}</small></button>`).join('')}</div></section>`;
    case 2:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 2</small><h3>Добавьте фотографии</h3><p>До 8 фото. На телефоне можно сразу снять деталь камерой.</p></div><div class="k-listing-photo-actions"><button type="button" data-listing-photo-camera>Снять фото</button><button type="button" data-listing-photo-gallery>Выбрать из галереи</button></div><div class="k-listing-photo-grid">${w.images.map((src,i)=>`<figure><img src="${esc(src)}" alt="Фото ${i+1}"><button type="button" data-listing-photo-remove="${i}" aria-label="Удалить фото">${icon('close')}</button>${i===0?'<b>Главное фото</b>':''}</figure>`).join('')||'<div class="k-listing-photo-empty">Фотографии ещё не добавлены.</div>'}</div><small class="k-listing-help">Фото автоматически уменьшаются перед сохранением.</small></section>`;
    case 3:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 3</small><h3>Что это за деталь?</h3></div><label><span>Название *</span><input data-wizard-field="title" value="${esc(w.title)}" maxlength="180" placeholder="Например: генератор Toyota 2AR-FE"></label><button type="button" class="k-parts-field-button" data-listing-category-open><span>Категория</span><b>${esc(cat.name)}</b></button><div class="k-listing-two"><label><span>Бренд</span><input data-wizard-field="brand" value="${esc(w.brand)}" maxlength="120"></label><label><span>OEM / артикул</span><input data-wizard-field="oem" value="${esc(w.oem)}" maxlength="120"></label></div><label><span>Совместимость</span><input data-wizard-field="vehicle" value="${esc(w.vehicle)}" maxlength="180" placeholder="Toyota Camry XV50, 2012–2017"></label></section>`;
    case 4:{const d=w.donorVehicle||{};return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 4</small><h3>Автомобиль-донор</h3><p>VIN и госномер публично не показываются.</p></div><button type="button" class="k-parts-field-button" data-listing-vehicle-open><span>Из моего гаража</span><b>${esc(wizardVehicleLabel())}</b></button><button type="button" class="k-listing-unknown ${d.unknown?'is-active':''}" data-donor-unknown><b>Автомобиль неизвестен / не применимо</b><small>Например, складская деталь без истории донора</small></button><div class="k-listing-two"><label><span>Марка</span><input data-wizard-donor="brand" value="${esc(d.brand||'')}" maxlength="80"></label><label><span>Модель</span><input data-wizard-donor="model" value="${esc(d.model||'')}" maxlength="100"></label><label><span>Год</span><input data-wizard-donor="year" value="${esc(d.year||'')}" maxlength="16"></label><label><span>Двигатель</span><input data-wizard-donor="engine" value="${esc(d.engine||'')}" maxlength="80"></label><label><span>Пробег донора, км</span><input data-wizard-donor="mileage" type="number" min="0" value="${Number(d.mileage||0)||''}"></label></div><label><span>Комментарий о доноре</span><textarea data-wizard-donor="note" rows="3" maxlength="300">${esc(d.note||'')}</textarea></label></section>`;}
    case 5:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 5</small><h3>Состояние и дефекты</h3></div>${['new','restored'].includes(w.listingType)?`<div class="k-listing-condition-fixed"><small>СОСТОЯНИЕ</small><b>${w.listingType==='new'?'Новая деталь':'Восстановленная деталь'}</b><p>${w.listingType==='restored'?'Опишите, что именно восстанавливалось и какие проверки выполнены.':'Для новой детали укажите упаковку, комплектность и возможные следы хранения.'}</p></div>`:`<div class="k-parts-choice-grid">${listingConditionChoices().map(([v,l,h])=>`<button type="button" data-wizard-condition="${v}" class="${w.condition===v?'is-active':''}"><b>${l}</b><small>${h}</small></button>`).join('')}</div>`}<label><span>Известные дефекты</span><textarea data-wizard-field="defects" rows="4" maxlength="2000" placeholder="Сколы, люфт, трещины, следы ремонта…">${esc(w.defects)}</textarea></label><label><span>Описание детали *</span><textarea data-wizard-field="description" rows="5" maxlength="1200" placeholder="Что проверено, почему продаёте, комплектность…">${esc(w.description)}</textarea></label></section>`;
    case 6:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 6</small><h3>${w.listingType==='exchange'?'Цена и условия обмена':'Цена'}</h3></div><div class="k-parts-choice-grid"><button type="button" data-price-mode="fixed" class="${!w.priceNegotiable?'is-active':''}"><b>Указать цену</b><small>Фиксированная цена или доплата</small></button><button type="button" data-price-mode="negotiable" class="${w.priceNegotiable?'is-active':''}"><b>По договорённости</b><small>Цена обсуждается с покупателем</small></button></div>${!w.priceNegotiable?`<label><span>${w.listingType==='exchange'?'Доплата, ₸':'Цена, ₸'}</span><input data-wizard-field="price" type="number" min="0" step="1" value="${Number(w.price||0)||''}"></label>`:''}${w.listingType==='exchange'?`<label><span>Условия обмена *</span><textarea data-wizard-field="exchangeNote" rows="4" maxlength="500" placeholder="Что принимаете, нужна ли старая деталь, размер доплаты…">${esc(w.exchangeNote)}</textarea></label>`:''}</section>`;
    case 7:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 7</small><h3>Получение и доставка</h3></div><label><span>Город *</span><input data-wizard-field="city" value="${esc(w.city)}" maxlength="120"></label><div class="k-parts-choice-grid">${Object.entries(deliveryMeta).map(([v,l])=>`<button type="button" data-wizard-delivery="${v}" class="${w.deliveryModes.includes(v)?'is-active':''}"><b>${esc(l)}</b></button>`).join('')}</div><label><span>Условия получения</span><textarea data-wizard-field="deliveryNote" rows="4" maxlength="500" placeholder="Район самовывоза, сроки отправки, кто оплачивает доставку…">${esc(w.deliveryNote)}</textarea></label></section>`;
    default:return `<section class="k-listing-step"><div class="k-listing-step-copy"><small>ШАГ 8</small><h3>Проверьте объявление</h3><p>После публикации оно появится в соответствующем окне Marketplace.</p></div>${listingPreview()}</section>`;
  }}
  function renderListingWizard(){const form=document.querySelector('[data-used-form]');if(!form||!listingWizard)return;form.elements.id.value=listingWizard.id||'';const title=form.querySelector('[data-used-form-title]');if(title)title.textContent=listingWizard.id?'Редактировать объявление':'Продать деталь';const macro=Math.min(4,Math.max(1,Math.ceil(Number(listingWizard.step||1)/2))),label=form.querySelector('[data-listing-step-label]');if(label)label.textContent=`ЭТАП ${macro} ИЗ 4 · ${listingStepTitle(listingWizard.step).toUpperCase()}`;form.querySelectorAll('[data-listing-main-steps] span').forEach((node,index)=>{const n=index+1;node.classList.toggle('is-active',n===macro);node.classList.toggle('is-complete',n<macro);});const body=form.querySelector('[data-listing-wizard-body]');if(body)body.innerHTML=listingStepHtml();const back=form.querySelector('[data-listing-back]');if(back)back.hidden=listingWizard.step===1;const next=form.querySelector('[data-listing-next]');if(next)next.hidden=listingWizard.step===8;const publish=form.querySelector('[data-listing-publish]');if(publish)publish.hidden=listingWizard.step!==8;}
  function openListingWizard(item=null){listingWizard=blankListingWizard(item);renderListingWizard();openDialog('used-form');}
  function validateListingStep(step){const w=listingWizard||{};if(step===2&&!w.images?.length)return 'Добавьте хотя бы одну фотографию';if(step===3&&!String(w.title||'').trim())return 'Укажите название детали';if(step===5&&!String(w.description||'').trim())return 'Добавьте описание детали';if(step===5&&['fair','repair'].includes(w.condition)&&!String(w.defects||'').trim())return 'Опишите известные дефекты';if(step===6&&!w.priceNegotiable&&w.listingType!=='exchange'&&Number(w.price||0)<=0)return 'Укажите цену или выберите «по договорённости»';if(step===6&&w.listingType==='exchange'&&!String(w.exchangeNote||'').trim())return 'Укажите условия обмена';if(step===7&&!String(w.city||'').trim())return 'Укажите город';if(step===7&&!w.deliveryModes?.length)return 'Выберите хотя бы один способ получения';return '';}
  async function compressListingImage(file){if(!file||!String(file.type||'').match(/^image\/(jpeg|png|webp)$/))throw new Error('Поддерживаются JPEG, PNG и WebP');if(file.size>12*1024*1024)throw new Error('Фото больше 12 МБ');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Не удалось прочитать фото'));r.readAsDataURL(file);});const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(new Error('Не удалось открыть фото'));x.src=src;});const max=1400,scale=Math.min(1,max/Math.max(img.naturalWidth||1,img.naturalHeight||1));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let q=.82,data='';do{data=canvas.toDataURL('image/jpeg',q);q-=.08;}while(data.length>1150000&&q>=.5);if(data.length>1250000)throw new Error('Фото не удалось достаточно уменьшить');return data;}
  async function addListingPhotos(files){const list=[...(files||[])];if(!listingWizard||!list.length)return;const room=Math.max(0,8-listingWizard.images.length);if(!room){window.KaretaToast?.error?.('Можно добавить не более 8 фотографий');return;}for(const file of list.slice(0,room)){try{listingWizard.images.push(await compressListingImage(file));}catch(error){window.KaretaToast?.error?.(error.message||'Не удалось добавить фото');}}renderListingWizard();}
  async function loadMine(){try{const res=await api.getUsedMarket({mine:1,sort:'newest'},{signal:contextRef?.lifecycle?.signal});mineRows=res.ok&&Array.isArray(res.payload?.items)?res.payload.items:[];}catch(_e){mineRows=[];}return mineRows;}
  async function saveListingWizard(publicationAction){if(!listingWizard||listingSaving)return;const error=publicationAction==='active'?[2,3,5,6,7].map(validateListingStep).find(Boolean):'';if(error){window.KaretaToast?.error?.(error);return;}listingSaving=true;const form=document.querySelector('[data-used-form]');form?.querySelectorAll('button').forEach(b=>b.disabled=true);try{const payload={...listingWizard,publicationAction,draftStep:listingWizard.step,images:listingWizard.images,donorVehicle:listingWizard.donorVehicle,deliveryModes:listingWizard.deliveryModes};const res=await api.saveUsedMarketListing(payload);if(!res.ok)throw new Error(res.payload?.message||res.payload?.error||'Не удалось сохранить объявление');listingWizard.id=res.payload?.id||listingWizard.id;closeDialog('used-form');await Promise.all([loadUsed(),loadMine()]);marketMode='mine';state={search:'',type:'all',category:'',city:'',sort:'newest'};renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');window.KaretaToast?.success?.(publicationAction==='active'?'Объявление опубликовано':'Черновик сохранён');}catch(error){window.KaretaToast?.error?.(error.message||'Ошибка сохранения');}finally{listingSaving=false;form?.querySelectorAll('button').forEach(b=>b.disabled=false);}}

  function bind(context){
    contextRef=context;const page=document.querySelector('.k-parts-native-page');if(!page)return;
    page.addEventListener('click',async event=>{
      const close=event.target.closest('[data-dialog-close]');if(close){const map={filter:'parts-filter',vehicle:'parts-vehicle',listing:'used-form',category:'parts-category',market:'parts-market-list',delete:'delete',cart:'shop-cart'};closeDialog(map[close.dataset.dialogClose]||close.dataset.dialogClose);return;}
      if(event.target.closest('[data-shop-cart-open]')){openDialog('shop-cart');return;}
      if(event.target.closest('[data-parts-filter-open]')){renderFilter(store.getSnapshot());openDialog('parts-filter');return;}
      const partsMode=event.target.closest('[data-parts-mode]');if(partsMode){storeMode=partsMode.dataset.partsMode==='rating'?'rating':'nearby';page.querySelectorAll('[data-parts-mode]').forEach(btn=>btn.classList.toggle('is-active',btn===partsMode));const host=page.querySelector('[data-parts-stores]');if(host)host.innerHTML=storeStrip(store.getSnapshot());return;}
      const storeButton=event.target.closest('[data-parts-store]');if(storeButton){state={...state,storeId:String(storeButton.dataset.partsStore||'')};renderSnapshot(store.getSnapshot());return;}
      if(event.target.closest('[data-parts-store-clear]')){state={...state,storeId:''};renderSnapshot(store.getSnapshot());return;}
      if(event.target.closest('[data-parts-vehicle-open]')){vehicleDialogMode='catalog';renderVehicles();openDialog('parts-vehicle');return;}
      const marketWindow=event.target.closest('[data-market-window]');if(marketWindow){state={search:'',type:marketWindow.dataset.marketWindow||'all',category:'',city:'',sort:'newest'};marketMode='catalog';renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');return;}
      if(event.target.closest('[data-compatible-window]')){state={search:'',type:'all',category:'',city:'',sort:'newest'};marketMode='compatible';renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');return;}
      const category=event.target.closest('[data-market-category]');if(category){state={search:'',type:'all',category:category.dataset.marketCategory||'',city:'',sort:'newest'};marketMode='catalog';renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');return;}
      const refType=event.target.closest('[data-parts-ref-type]');if(refType){const value=refType.dataset.partsRefType||'all';state={...state,type:value==='new'?'new':'all',category:'',sort:'newest'};renderSnapshot(store.getSnapshot());page.querySelectorAll('.k-parts-ref-tabs a,.k-parts-ref-tabs button').forEach(btn=>btn.classList.toggle('is-active',btn===refType));return;}
      if(event.target.closest('[data-parts-reset]')){resetFilters();return;}
      const mode=event.target.closest('[data-market-mode]');if(mode){marketMode=mode.dataset.marketMode||'catalog';mineStatus='all';pendingMineFocusId='';state={search:'',type:'all',category:'',city:'',sort:'newest'};if(marketMode==='mine')await loadMine();renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');return;}
      const mineFilter=event.target.closest('[data-mine-status]');if(mineFilter){mineStatus=mineFilter.dataset.mineStatus||'all';pendingMineFocusId='';renderMarketWindow(store.getSnapshot());return;}
      if(event.target.closest('[data-used-add]')){openListingWizard();return;}
      const fType=event.target.closest('[data-filter-type]');if(fType){state.type=fType.dataset.filterType||'all';renderFilter(store.getSnapshot());return;}
      const fCat=event.target.closest('[data-filter-category]');if(fCat){state.category=fCat.dataset.filterCategory||'';renderFilter(store.getSnapshot());return;}
      const fSort=event.target.closest('[data-filter-sort]');if(fSort){state.sort=fSort.dataset.filterSort||'newest';renderFilter(store.getSnapshot());return;}
      if(event.target.closest('[data-parts-filter-reset]')){state={...state,type:'all',category:'',city:'',sort:'newest'};renderFilter(store.getSnapshot());updateCounters(store.getSnapshot());return;}
      if(event.target.closest('[data-parts-filter-apply]')){state.city=String(document.querySelector('[data-filter-city]')?.value||'').trim();marketMode='catalog';closeDialog('parts-filter');renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');updateCounters(store.getSnapshot());return;}
      const vBtn=event.target.closest('[data-vehicle-id]');if(vBtn){const id=vBtn.dataset.vehicleId||'';if(vehicleDialogMode==='listing'&&listingWizard){const v=vehicles.find(x=>String(x.id)===String(id));listingWizard.sourceVehicleId=id;if(v){listingWizard.donorVehicle={brand:v.brand||'',model:v.model||'',year:v.year||v.year_label||'',engine:v.engine||'',mileage:Number(v.mileage_km||v.mileage||0),note:'',unknown:false};if(!listingWizard.vehicle)listingWizard.vehicle=vehicleLabel(v);}closeDialog('parts-vehicle');renderListingWizard();}else{selectedVehicleId=id;closeDialog('parts-vehicle');renderSnapshot(store.getSnapshot());}return;}
      const wizardType=event.target.closest('[data-wizard-type]');if(wizardType&&listingWizard){listingWizard.listingType=wizardType.dataset.wizardType||'used';if(listingWizard.listingType==='new')listingWizard.condition='new';else if(listingWizard.listingType==='restored')listingWizard.condition='restored';else if(['new','restored'].includes(listingWizard.condition))listingWizard.condition='good';renderListingWizard();return;}
      const wizardCondition=event.target.closest('[data-wizard-condition]');if(wizardCondition&&listingWizard){listingWizard.condition=wizardCondition.dataset.wizardCondition||'good';renderListingWizard();return;}
      const priceMode=event.target.closest('[data-price-mode]');if(priceMode&&listingWizard){listingWizard.priceNegotiable=priceMode.dataset.priceMode==='negotiable';renderListingWizard();return;}
      const deliveryChoice=event.target.closest('[data-wizard-delivery]');if(deliveryChoice&&listingWizard){const value=deliveryChoice.dataset.wizardDelivery;if(listingWizard.deliveryModes.includes(value))listingWizard.deliveryModes=listingWizard.deliveryModes.filter(x=>x!==value);else listingWizard.deliveryModes.push(value);renderListingWizard();return;}
      if(event.target.closest('[data-donor-unknown]')&&listingWizard){listingWizard.sourceVehicleId='';listingWizard.donorVehicle={brand:'',model:'',year:'',engine:'',mileage:0,note:'',unknown:!listingWizard.donorVehicle?.unknown};renderListingWizard();return;}
      if(event.target.closest('[data-listing-category-open]')){renderCategoryChoice(store.getSnapshot());openDialog('parts-category');return;}
      const listingCategory=event.target.closest('[data-listing-category]');if(listingCategory&&listingWizard){listingWizard.category=listingCategory.dataset.listingCategory||'other';closeDialog('parts-category');renderListingWizard();return;}
      if(event.target.closest('[data-listing-vehicle-open]')){vehicleDialogMode='listing';renderVehicles();openDialog('parts-vehicle');return;}
      if(event.target.closest('[data-listing-photo-gallery]')){page.querySelector('[data-listing-gallery]')?.click();return;}
      if(event.target.closest('[data-listing-photo-camera]')){page.querySelector('[data-listing-camera]')?.click();return;}
      const photoRemove=event.target.closest('[data-listing-photo-remove]');if(photoRemove&&listingWizard){listingWizard.images.splice(Number(photoRemove.dataset.listingPhotoRemove||0),1);renderListingWizard();return;}
      if(event.target.closest('[data-listing-back]')&&listingWizard){listingWizard.step=Math.max(1,listingWizard.step-1);renderListingWizard();return;}
      if(event.target.closest('[data-listing-next]')&&listingWizard){const error=validateListingStep(listingWizard.step);if(error){window.KaretaToast?.error?.(error);return;}listingWizard.step=Math.min(8,listingWizard.step+1);renderListingWizard();return;}
      if(event.target.closest('[data-listing-draft]')){await saveListingWizard('draft');return;}
      if(event.target.closest('[data-listing-publish]')){await saveListingWizard('active');return;}
      const fav=event.target.closest('[data-used-favorite]');if(fav){event.stopPropagation();const id=fav.dataset.usedFavorite,active=fav.dataset.active!=='1';const res=await api.favoriteUsedMarketListing(id,active);if(res.ok)await loadUsed();else window.KaretaToast?.error?.(res.payload?.message||'Не удалось сохранить');return;}
      const contact=event.target.closest('[data-used-contact]');if(contact){const item=[...mineRows,...usedRows].find(x=>String(x.id)===String(contact.dataset.usedContact));if(item?.sellerUserId){const res=await api.openDirectChat({userId:item.sellerUserId});if(res.ok){closeDialog('used-detail');location.hash='#/chats';}else window.KaretaToast?.error?.(res.payload?.message||'Не удалось открыть чат');}return;}
      const edit=event.target.closest('[data-used-edit]');if(edit){const item=[...mineRows,...usedRows].find(x=>String(x.id)===String(edit.dataset.usedEdit));if(item){pendingMineFocusId='';closeDialog('parts-market-list');openListingWizard(item);}return;}
      const statusButton=event.target.closest('[data-used-status]');if(statusButton){const id=statusButton.dataset.usedId||'',status=statusButton.dataset.usedStatus||'';if(!id||!['active','sold','archived'].includes(status))return;statusButton.disabled=true;try{const res=await api.setUsedMarketListingStatus(id,status);if(!res.ok)throw new Error(res.payload?.message||res.payload?.error||'Не удалось изменить статус');await Promise.all([loadMine(),loadUsed()]);renderMarketWindow(store.getSnapshot());window.KaretaToast?.success?.(({active:'Объявление снова активно',sold:'Объявление отмечено как проданное',archived:'Объявление снято с публикации'})[status]||'Статус обновлён');}catch(error){window.KaretaToast?.error?.(error.message||'Не удалось изменить статус');}finally{statusButton.disabled=false;}return;}
      const del=event.target.closest('[data-used-delete]');if(del){pendingDeleteId=del.dataset.usedDelete||'';closeDialog('used-detail');openDialog('delete');return;}
      if(event.target.closest('[data-used-delete-confirm]')){if(!pendingDeleteId)return;const res=await api.deleteUsedMarketListing(pendingDeleteId);if(res.ok){pendingDeleteId='';closeDialog('delete');await loadUsed();window.KaretaToast?.success?.('Объявление удалено');}else window.KaretaToast?.error?.(res.payload?.message||'Не удалось удалить');return;}
      const add=event.target.closest('[data-shop-add]');if(add){event.preventDefault();event.stopPropagation();const product=store.getSnapshot().products.find(x=>String(x.id)===String(add.dataset.shopAdd));if(product)store.add(product);return;}
      const productLink=event.target.closest('[data-product-href]');if(productLink&&!event.target.closest('button,a,input,textarea')){const href=productLink.dataset.productHref||'';if(!window.KaretaWindowEngine?.openEntity?.(href,{trigger:productLink}))location.hash=href.replace(/^#/,'');return;}
      const qty=event.target.closest('[data-shop-qty]');if(qty){const item=store.getSnapshot().cart.find(x=>String(x.id)===String(qty.dataset.shopQty));if(item)store.setQty(item.id,Number(item.qty)+Number(qty.dataset.delta||0));return;}
      const delivery=event.target.closest('[data-delivery-type]');if(delivery){const form=document.querySelector('[data-shop-checkout]');form.elements.deliveryType.value=delivery.dataset.deliveryType;form.querySelectorAll('[data-delivery-type]').forEach(b=>b.classList.toggle('is-active',b===delivery));return;}
    });
    let searchTimer=0;const searchInput=page.querySelector('[data-parts-search]');searchInput?.addEventListener('input',event=>{clearTimeout(searchTimer);const value=String(event.currentTarget.value||'').trim();searchTimer=setTimeout(()=>{state={...state,search:value,category:''};renderSnapshot(store.getSnapshot());},180);});searchInput?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();state={...state,search:String(event.currentTarget.value||'').trim(),category:''};renderSnapshot(store.getSnapshot());}});
    page.addEventListener('input',event=>{if(!listingWizard)return;const field=event.target.closest('[data-wizard-field]');if(field){const key=field.dataset.wizardField;listingWizard[key]=field.type==='number'?Number(field.value||0):String(field.value||'');return;}const donor=event.target.closest('[data-wizard-donor]');if(donor){const key=donor.dataset.wizardDonor;listingWizard.sourceVehicleId='';listingWizard.donorVehicle={...(listingWizard.donorVehicle||{}),unknown:false,[key]:donor.type==='number'?Number(donor.value||0):String(donor.value||'')};}});
    page.querySelector('[data-listing-gallery]')?.addEventListener('change',async event=>{await addListingPhotos(event.currentTarget.files);event.currentTarget.value='';});
    page.querySelector('[data-listing-camera]')?.addEventListener('change',async event=>{await addListingPhotos(event.currentTarget.files);event.currentTarget.value='';});
    page.querySelector('[data-shop-checkout]')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),error=form.querySelector('[data-shop-checkout-error]');button.disabled=true;error.hidden=true;try{await store.checkout(Object.fromEntries(new FormData(form).entries()),{signal:context.lifecycle?.signal});form.reset();form.elements.deliveryType.value='pickup';closeDialog('shop-cart');window.KaretaToast?.success?.('Заказ создан. Продавец получил уведомление.');}catch(err){error.textContent=err.message||'Не удалось оформить заказ';error.hidden=false;}finally{button.disabled=false;}});
  }

  function mountParts(context){
    unsubscribe?.();contextRef=context;usedRows=[];mineRows=[];listingWizard=null;listingSaving=false;usedLoading=false;usedError='';vehicles=[];vehiclesLoaded=false;selectedVehicleId='';vehicleDialogMode='catalog';marketMode='catalog';mineStatus='all';pendingMineFocusId='';storeMode='nearby';storeTrust.clear();storeTrustPending.clear();state={search:'',type:'all',category:'',city:'',sort:'newest',storeId:''};const hashCtx=readHashContext();
    unsubscribe=store.subscribe(renderSnapshot);bind(context);store.load({search:'',category:'all',limit:100},{signal:context.lifecycle?.signal});if(isUsedSurface())loadUsed();else{usedRows=[];usedLoading=false;usedError='';}loadVehicles();
    if(hashCtx.mine==='1'){pendingMineFocusId=hashCtx.focus||'';loadMine().then(()=>{if(contextRef!==context)return;marketMode='mine';renderMarketWindow(store.getSnapshot());openDialog('parts-market-list');});}
    return()=>{unsubscribe?.();unsubscribe=null;contextRef=null;store.cancel();};
  }

  window.KaretaPartsPages=Object.freeze({renderParts,mountParts});
})();
