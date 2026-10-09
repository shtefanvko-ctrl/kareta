(() => {
  'use strict';
  const api=window.KaretaApiClient;
  if(!api) throw new Error('KaretaApiClient is required before pages/details.js');
  const uiIcon=name=>window.KaretaUIIcons?.icon(name)||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0)>0?`${new Intl.NumberFormat('ru-RU').format(Number(v))} ₸`:'По согласованию';
  const servicePriceLabel=o=>{const type=String(o?.priceType||o?.price_type||'fixed'),from=Number(o?.price||0),to=Number(o?.priceMax??o?.price_max??0);if(type==='agreement')return 'По договорённости';if(type==='from')return from>0?`от ${money(from)}`:'По договорённости';if(type==='range')return from>0&&to>from?`${money(from)} — ${money(to)}`:(from>0?`от ${money(from)}`:'По договорённости');return money(from);};
  const serviceDurationLabel=o=>{const from=Number(o?.durationMin??o?.duration_min??0),to=Number(o?.durationMaxMin??o?.duration_max_min??0);if(from<=0)return 'По оценке';return to>from?`${from}–${to} мин.`:`${from} мин.`;};
  const hashParts=()=>decodeURIComponent(String(location.hash||'').split('?')[0].replace(/^#\/?/,'')).split('/').filter(Boolean);
  const loading=(back,title)=>`<section class="k-page k-detail-page"><button class="k-detail-back" type="button" data-smart-back data-fallback="${back}">← Назад</button><div class="k-detail-loading"><h1 class="k-title">${esc(title)}</h1><p>Загружаем подробную информацию…</p></div></section>`;
  const error=(back,message)=>`<section class="k-page k-detail-page"><button class="k-detail-back" type="button" data-smart-back data-fallback="${back}">← Назад</button><div class="k-empty"><h1>Карточка недоступна</h1><p>${esc(message||'Данные не найдены')}</p></div></section>`;
  const productLoading=()=>`<section class="k-page k-detail-page k-product-detail"><div class="k-detail-loading"><h1 class="k-title">Товар</h1><p>Загружаем подробную информацию…</p></div></section>`;
  const productError=message=>`<section class="k-page k-detail-page k-product-detail"><div class="k-empty"><h1>Карточка недоступна</h1><p>${esc(message||'Данные не найдены')}</p></div></section>`;
  function renderProduct(){return productLoading();}
  function renderService(){return loading('#/services','Услуга');}
  const providerLoading=()=>`<section class="k-page k-detail-page k-provider-profile-page"><div class="k-detail-loading"><h1 class="k-title">Профиль мастера</h1><p>Загружаем профиль специалиста…</p></div></section>`;
  const providerError=message=>`<section class="k-page k-detail-page k-provider-profile-page"><div class="k-empty"><h1>Профиль недоступен</h1><p>${esc(message||'Данные мастера не найдены')}</p></div></section>`;
  function renderProvider(){return providerLoading();}
  function set(html){const root=document.querySelector('#k-page-outlet');if(root)root.innerHTML=html;}
  const partConditionLabel=value=>({new:'Новая',restored:'Восстановленная',excellent:'Отличное',good:'Хорошее',fair:'Есть следы',repair:'Под ремонт'}[String(value||'').toLowerCase()]||'Не указано');
  const partTypeLabel=value=>({new:'Новая',used:'БУ',restored:'Восстановленная',exchange:'Обмен'}[String(value||'').toLowerCase()]||'Запчасть');
  const partListingStatusLabel=value=>({active:'Активно',draft:'Черновик',sold:'Продано',archived:'Снято'}[String(value||'').toLowerCase()]||'');
  function fitmentLabel(value){
    if(value==null)return '';
    if(typeof value==='string')return value;
    if(Array.isArray(value))return value.map(fitmentLabel).filter(Boolean).join(' · ');
    if(typeof value==='object')return [value.brand||value.make,value.model,value.year||value.years,value.engine].filter(Boolean).join(' ');
    return String(value);
  }
  function partImages(values,title){
    const rows=(Array.isArray(values)?values:[values]).map(v=>String(v||'').trim()).filter(Boolean).slice(0,8);
    return rows.length?`<div class="k-part-detail-gallery">${rows.map((src,i)=>`<button type="button" data-part-image="${esc(src)}" aria-label="Открыть фото ${i+1}"><img src="${esc(src)}" alt="${esc(title)}" loading="lazy"></button>`).join('')}</div>`:`<div class="k-part-detail-no-image"><span>PARTS</span><small>Фотографии пока нет</small></div>`;
  }
  function installationHtml(rows){
    const list=Array.isArray(rows)?rows:[];
    return list.length?`<div class="k-part-installation-list">${list.map(row=>`<a href="${row.work_post_id?`#/works/item/${encodeURIComponent(row.work_post_id)}`:'#/works'}"><small>ПОДТВЕРЖДЁННАЯ УСТАНОВКА</small><b>${esc(row.vehicle_label||'Автомобиль KARETA')}</b><span>${esc(row.service_label||'Ремонт')} · ${esc(row.master_name||row.sto_name||'Исполнитель')}</span>${row.published_at?`<time>${esc(String(row.published_at).slice(0,10))}</time>`:''}</a>`).join('')}</div>`:`<div class="k-part-native-empty"><b>Подтверждённых установок пока нет</b><p>Здесь появятся только установки, реально проведённые через заказ-наряд KARETA и опубликованные с согласия клиента.</p></div>`;
  }
  function reviewSummary(reviews){
    const rows=Array.isArray(reviews)?reviews:[];if(!rows.length)return {avg:0,count:0};const sum=rows.reduce((a,r)=>a+Math.max(1,Math.min(5,Number(r.rating||5))),0);return {avg:sum/rows.length,count:rows.length};
  }
  function wirePartImageViewer(){
    document.querySelectorAll('[data-part-image]').forEach(btn=>btn.addEventListener('click',()=>{const dialog=document.querySelector('[data-part-image-dialog]'),img=dialog?.querySelector('img');if(img)img.src=btn.dataset.partImage||'';dialog?.showModal?.();}));
    document.querySelectorAll('[data-part-dialog-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog')?.close?.()));
  }
  async function mountProduct(ctx={}){
    if(hashParts()[1]==='store')return mountStore(ctx);
    const token=hashParts()[2]||'';const isUsed=token.startsWith('used:');const id=isUsed?token.slice(5):token;
    if(!id)return set(productError('Не указан товар.'));
    if(isUsed){
      const r=await api.getUsedMarketDetail(id,{signal:ctx.lifecycle?.signal});if(!r.ok)return set(productError(r.payload?.message||'Объявление не найдено'));
      const p=r.payload.data||{};api.viewUsedMarketListing(id).catch(()=>{});
      const type=partTypeLabel(p.listingType),condition=partConditionLabel(p.condition),donor=p.donorVehicle||{},sellerStats=p.sellerStats||{},installations=p.realInstallations||[];
      const donorLabel=[donor.brand,donor.model,donor.year].filter(Boolean).join(' ')||p.vehicle||'';
      const price=p.priceNegotiable?'По договорённости':((p.listingType==='exchange'&&Number(p.price||0)<=0)?'Обмен':money(p.price));
      set(`<section class="k-page k-detail-page k-product-detail k-part-native-detail k-parts-ref-detail is-used">
        <button class="k-detail-back" type="button" data-smart-back data-fallback="#/parts">← Запчасти</button>
        <header class="k-part-detail-header"><div><small>${esc(type)} · ${esc(p.city||'Город не указан')}${p.isMine&&partListingStatusLabel(p.status)?` · ${esc(partListingStatusLabel(p.status))}`:''}</small><h1>${esc(p.title||'Запчасть')}</h1><div class="k-part-detail-tags">${p.brand?`<span>${esc(p.brand)}</span>`:''}${p.oem?`<span>OEM ${esc(p.oem)}</span>`:''}<span>${esc(condition)}</span></div></div><div class="k-part-detail-price"><b>${price}</b><small>${Number(p.views||0)} просмотров</small></div></header>
        ${partImages(p.images||p.image,p.title)}
        <section class="k-part-detail-actions k-parts-ref-detail-actions">${p.isMine?`<a class="k-btn k-btn-secondary" href="#/parts?mine=1&focus=${encodeURIComponent(p.id)}">Управлять объявлением</a>`:`<button class="k-btn k-btn-primary" type="button" data-used-contact>Связаться по покупке</button><button class="k-btn k-btn-secondary" type="button" data-used-favorite data-active="${p.favorite?'1':'0'}">${p.favorite?'Сохранено':'Сохранить'}</button>${p.listingType==='exchange'?'<button class="k-btn k-btn-secondary" type="button" data-used-exchange>Предложить обмен</button>':''}`}</section>
        <div class="k-part-detail-layout"><main>
          <section class="k-part-detail-section"><header><small>О ДЕТАЛИ</small><h2>Состояние и описание</h2></header><div class="k-part-detail-facts"><article><span>Тип</span><b>${esc(type)}</b></article><article><span>Состояние</span><b>${esc(condition)}</b></article><article><span>OEM</span><b>${esc(p.oem||'Не указан')}</b></article><article><span>Бренд</span><b>${esc(p.brand||'Не указан')}</b></article></div><p>${esc(p.description||'Описание не заполнено.')}</p>${p.defects?`<div class="k-part-defects-card"><b>Известные дефекты</b><p>${esc(p.defects)}</p></div>`:''}</section>
          <section class="k-part-detail-section"><header><small>ПРОИСХОЖДЕНИЕ</small><h2>Откуда деталь</h2></header>${donorLabel?`<div class="k-part-donor-card"><b>${esc(donorLabel)}</b>${donor.color?`<span>Цвет автомобиля: ${esc(donor.color)}</span>`:''}${Number(donor.mileage||0)>0?`<span>Пробег донора: ${new Intl.NumberFormat('ru-RU').format(Number(donor.mileage))} км</span>`:''}${donor.engine?`<span>Двигатель: ${esc(donor.engine)}</span>`:''}${donor.note?`<span>${esc(donor.note)}</span>`:''}<p>Показываются только публичные сведения об автомобиле-доноре. VIN и госномер не раскрываются.</p></div>`:`<div class="k-part-native-empty"><b>Автомобиль-донор не указан</b><p>Продавец не привязал деталь к автомобилю из гаража.</p></div>`}</section>
          <section class="k-part-detail-section"><header><small>СОВМЕСТИМОСТЬ</small><h2>Для каких автомобилей</h2></header><div class="k-part-fitment-card">${p.vehicle?`<b>${esc(p.vehicle)}</b><p>Совместимость указана продавцом. Перед установкой необходимо сверить OEM и VIN автомобиля.</p>`:'<b>Совместимость не заполнена</b><p>Перед покупкой уточните OEM и применимость у продавца.</p>'}</div></section>
          ${p.exchangeNote?`<section class="k-part-detail-section"><header><small>ОБМЕН</small><h2>Условия обмена</h2></header><div class="k-part-exchange-card"><p>${esc(p.exchangeNote)}</p></div></section>`:''}
          <section class="k-part-detail-section"><header><small>ПОЛУЧЕНИЕ</small><h2>Доставка и самовывоз</h2></header><div class="k-part-delivery-grid">${(p.deliveryModes||[]).length?(p.deliveryModes||[]).map(v=>`<span>${esc(({pickup:'Самовывоз',courier:'Курьер',transport:'Транспортная компания',seller_delivery:'Доставка продавца'}[v]||v))}</span>`).join(''):'<span>Уточнить у продавца</span>'}</div>${p.deliveryNote?`<p class="k-part-detail-note">${esc(p.deliveryNote)}</p>`:''}</section>
          <section class="k-part-detail-section"><header><small>ИСТОРИЯ KARETA</small><h2>Реальные установки</h2></header>${installationHtml(installations)}</section>
          <section class="k-part-detail-section"><header><small>ОТЗЫВЫ</small><h2>Отзывы о детали</h2></header><div class="k-part-native-empty"><b>Отзывов о частной детали пока нет</b><p>KARETA не создаёт рейтинг объявления без подтверждённой сделки. Отзывы появятся после внедрения завершённой сделки Marketplace.</p></div></section>
        </main><aside><section class="k-part-detail-seller"><small>ПРОДАВЕЦ</small><h2>${esc(p.sellerName||'Пользователь')}</h2><div><span>Активных объявлений</span><b>${Number(sellerStats.activeListings||0)}</b></div><div><span>Продано через статусы Marketplace</span><b>${Number(sellerStats.soldListings||0)}</b></div>${!p.isMine?'<button class="k-btn k-btn-primary" type="button" data-used-contact>Написать продавцу</button>':''}</section></aside></div>
        <dialog class="k-part-image-dialog" data-part-image-dialog><button type="button" data-part-dialog-close>×</button><img alt="Фото детали"></dialog>
      </section>`);
      wirePartImageViewer();
      document.querySelectorAll('[data-used-favorite]').forEach(btn=>btn.addEventListener('click',async()=>{const active=btn.dataset.active!=='1';const res=await api.favoriteUsedMarketListing(id,active);if(res.ok)mountProduct(ctx);else window.KaretaToast?.error?.(res.payload?.message||'Не удалось сохранить');}));
      const openSeller=async()=>{if(!p.sellerUserId)return window.KaretaToast?.error?.('Продавец недоступен');const res=await api.openDirectChat({userId:p.sellerUserId});if(res.ok)location.hash='#/chats';else window.KaretaToast?.error?.(res.payload?.message||'Не удалось открыть чат');};
      document.querySelectorAll('[data-used-contact],[data-used-exchange]').forEach(btn=>btn.addEventListener('click',openSeller));
      return;
    }
    const r=await api.getProductDetail(id,{signal:ctx.lifecycle?.signal}); if(!r.ok)return set(productError(r.payload?.message));
    const p=r.payload.data||{},delivery=Array.isArray(p.delivery_modes)?p.delivery_modes:[],payments=Array.isArray(p.payment_methods)?p.payment_methods:[],fitment=Array.isArray(p.fitment)?p.fitment:[],reviews=Array.isArray(p.reviews)?p.reviews:[],questions=Array.isArray(p.questions)?p.questions:[],summary=reviewSummary(reviews),condition=partConditionLabel(p.condition_code||'new');
    const fitmentCards=fitment.map(v=>fitmentLabel(v)).filter(Boolean).map(v=>`<article><b>${esc(v)}</b></article>`).join('');
    set(`<section class="k-page k-detail-page k-product-detail k-part-native-detail k-parts-ref-detail is-store">
      <button class="k-detail-back" type="button" data-smart-back data-fallback="#/parts">← Запчасти</button>
      <header class="k-part-detail-header"><div><small>${esc(condition)} · ${esc(p.store_name||'Магазин')}</small><h1>${esc(p.name||'Товар')}</h1><div class="k-part-detail-tags">${p.brand?`<span>${esc(p.brand)}</span>`:''}${p.oem_number?`<span>OEM ${esc(p.oem_number)}</span>`:''}${p.sku?`<span>SKU ${esc(p.sku)}</span>`:''}<span>${esc(condition)}</span></div></div><div class="k-part-detail-price"><b>${money(p.price)}</b>${Number(p.old_price||0)>Number(p.price||0)?`<s>${money(p.old_price)}</s>`:''}<small>В наличии: ${Number(p.stock_qty||0)}</small></div></header>
      ${partImages(p.image_url,p.name)}
      <section class="k-part-detail-actions k-parts-ref-detail-actions"><button class="k-btn k-btn-primary" type="button" data-detail-add>В корзину</button><button class="k-btn k-btn-secondary" type="button" data-scroll-question>Задать вопрос</button>${Number(p.exchange_available||0)===1?'<button class="k-btn k-btn-secondary" type="button" data-store-exchange>Обсудить обмен</button>':''}</section>
      <div class="k-part-detail-layout"><main>
        <section class="k-part-detail-section"><header><small>О ТОВАРЕ</small><h2>Характеристики</h2></header><div class="k-part-detail-facts"><article><span>Состояние</span><b>${esc(condition)}</b></article><article><span>OEM</span><b>${esc(p.oem_number||'Не указан')}</b></article><article><span>SKU</span><b>${esc(p.sku||'Не указан')}</b></article><article><span>Бренд</span><b>${esc(p.brand||'Не указан')}</b></article></div><p>${esc(p.description||'Описание не заполнено.')}</p></section>
        <section class="k-part-detail-section"><header><small>СОВМЕСТИМОСТЬ</small><h2>Подходит автомобилям</h2></header>${fitmentCards?`<div class="k-part-fitment-grid">${fitmentCards}</div><p class="k-part-detail-note">Совместимость указана продавцом. Перед заказом сверяйте OEM и VIN.</p>`:`<div class="k-part-native-empty"><b>Точная совместимость не указана</b><p>Перед покупкой уточните OEM/VIN у продавца.</p></div>`}</section>
        ${Number(p.exchange_available||0)===1?`<section class="k-part-detail-section"><header><small>ОБМЕН</small><h2>Обменный фонд</h2></header><div class="k-part-exchange-card"><p>${esc(p.exchange_note||'Продавец принимает обмен. Условия уточняются в чате.')}</p></div></section>`:''}
        <section class="k-part-detail-section"><header><small>ИСТОРИЯ KARETA</small><h2>Реальные установки · ${Number(p.installationCount||0)}</h2></header>${installationHtml(p.realInstallations||[])}</section>
        <section class="k-part-detail-section" id="reviews"><header><small>ОТЗЫВЫ</small><h2>Отзывы о товаре</h2></header><div class="k-part-review-summary"><strong>${summary.count?summary.avg.toFixed(1):'—'}</strong><span>${summary.count} отзывов</span></div><div class="k-review-grid">${reviews.map(v=>`<article><b>${esc(v.author_name||'Клиент')} · ${esc(v.rating)}/5</b><p>${esc(v.body||'')}</p></article>`).join('')||'<div class="k-part-native-empty">Отзывов пока нет.</div>'}</div><form class="k-detail-form k-part-review-form" data-product-review><input type="hidden" name="rating" value="5"><div class="k-part-rating-choice">${[1,2,3,4,5].map(n=>`<button type="button" data-review-rating="${n}" class="${n===5?'is-active':''}">${n} ★</button>`).join('')}</div><textarea name="text" placeholder="Ваш отзыв" required></textarea><button class="k-btn k-btn-primary">Оставить отзыв</button></form></section>
        <section class="k-part-detail-section" id="questions"><header><small>ВОПРОСЫ</small><h2>Вопросы продавцу</h2></header><div class="k-review-grid">${questions.map(v=>`<article><b>${esc(v.author_name||'Пользователь')}</b><p>${esc(v.body||'')}</p>${v.answer?`<small>Ответ продавца: ${esc(v.answer)}</small>`:''}</article>`).join('')||'<div class="k-part-native-empty">Вопросов пока нет.</div>'}</div><form class="k-detail-form" data-product-question><textarea name="text" placeholder="Задайте вопрос о товаре" required></textarea><button class="k-btn k-btn-secondary">Отправить вопрос</button></form></section>
      </main><aside><section class="k-part-detail-seller"><small>ПРОДАВЕЦ</small><h2><a href="#/parts/store/${encodeURIComponent(String(p.seller_user_id||0))}">${esc(p.store_name||'Магазин')}</a></h2><p>${esc(p.store_description||'Продавец Marketplace KARETA.')}</p><div><span>Город</span><b>${esc(p.city||'Не указан')}</b></div><div><span>Склад</span><b>${esc(p.warehouse_address||'Уточняется')}</b></div><div><span>Доставка</span><b>${esc(delivery.join(', ')||'Уточняется')}</b></div><div><span>Оплата</span><b>${esc(payments.join(', ')||'По согласованию')}</b></div>${p.minimum_order?`<div><span>Минимальный заказ</span><b>${esc(p.minimum_order)}</b></div>`:''}<div><span>Возврат</span><b>${Number(p.return_days||14)} дней</b></div>${p.return_policy?`<div><span>Условия возврата</span><b>${esc(p.return_policy)}</b></div>`:''}<a class="k-btn k-btn-secondary" href="#/parts/store/${encodeURIComponent(String(p.seller_user_id||0))}">Открыть магазин</a><button class="k-btn k-btn-secondary" type="button" data-open-store-chat>Написать продавцу</button></section></aside></div>
      <dialog class="k-part-image-dialog" data-part-image-dialog><button type="button" data-part-dialog-close>×</button><img alt="Фото детали"></dialog>
    </section>`);
    wirePartImageViewer();
    document.querySelector('[data-detail-add]')?.addEventListener('click',()=>{window.KaretaShopState?.add?.({id:p.id,name:p.name,price:Number(p.price||0),stock_qty:Number(p.stock_qty||0),store_name:p.store_name,image_url:p.image_url});window.KaretaToast?.success?.('Товар добавлен в корзину');});
    document.querySelector('[data-scroll-question]')?.addEventListener('click',()=>document.querySelector('#questions')?.scrollIntoView?.({behavior:'smooth',block:'start'}));
    const openStoreChat=async()=>{const prefill=`Здравствуйте. Пишу по товару ${p.name||''}.`;const res=Number(p.seller_user_id||0)>0?await api.openDirectChat({userId:Number(p.seller_user_id)}):await api.openSupportChat(prefill);if(res.ok){const chatId=res.payload?.chat?.id||res.payload?.id||'';try{if(chatId)sessionStorage.setItem('kareta.chat.open',chatId);sessionStorage.setItem('kareta.chat.prefill',prefill);}catch(_e){}location.hash='#/chats';}else window.KaretaToast?.error?.(res.payload?.message||'Не удалось открыть чат');};
    document.querySelectorAll('[data-open-store-chat],[data-store-exchange]').forEach(btn=>btn.addEventListener('click',openStoreChat));
    const reviewForm=document.querySelector('[data-product-review]');reviewForm?.querySelectorAll('[data-review-rating]').forEach(btn=>btn.addEventListener('click',()=>{reviewForm.elements.rating.value=btn.dataset.reviewRating;reviewForm.querySelectorAll('[data-review-rating]').forEach(x=>x.classList.toggle('is-active',x===btn));}));
    reviewForm?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const rr=await api.submitProductReview({productId:p.id,rating:Number(fd.get('rating')||5),text:String(fd.get('text')||'')});if(!rr.ok)return window.KaretaToast?.error?.(rr.payload?.message||'Отзыв не отправлен');window.KaretaToast?.success?.('Отзыв опубликован');mountProduct(ctx);});
    document.querySelector('[data-product-question]')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const qr=await api.submitProductQuestion({productId:p.id,text:String(fd.get('text')||'')});if(!qr.ok)return window.KaretaToast?.error?.(qr.payload?.message||'Вопрос не отправлен');window.KaretaToast?.success?.('Вопрос отправлен');mountProduct(ctx);});
  }

  async function mountStore(ctx={}){
    const sellerId=hashParts()[2]||'';
    if(sellerId==='')return set(error('#/parts','Не указан продавец.'));
    const r=await api.getStoreDetail(sellerId,{signal:ctx.lifecycle?.signal});
    if(!r.ok)return set(error('#/parts',r.payload?.message||'Магазин не найден.'));
    const data=r.payload.data||{},p=data.profile||{},products=Array.isArray(data.products)?data.products:[],trust=data.trust||{};
    const deliveryLabels={pickup:'Самовывоз',courier:'Курьер',transport:'Транспортная компания',seller_delivery:'Доставка продавца'};
    const paymentLabels={cash:'Наличные',card:'Карта',transfer:'Перевод',invoice:'Счёт для юрлица',kaspi:'Kaspi'};
    const deliveries=(Array.isArray(p.delivery_modes)?p.delivery_modes:[]).map(v=>deliveryLabels[v]||v);
    const payments=(Array.isArray(p.payment_methods)?p.payment_methods:[]).map(v=>paymentLabels[v]||v);
    const categories=Array.isArray(p.category_labels)&&p.category_labels.length?p.category_labels:(Array.isArray(p.category_tags)?p.category_tags:[]);
    const productCards=products.map(item=>`<article class="k-storefront-product k-parts-ref-card" data-storefront-product data-search="${esc(`${item.name||''} ${item.brand||''} ${item.oem_number||''} ${item.sku||''}`.toLowerCase())}"><a class="k-storefront-product-media" href="#/parts/item/${encodeURIComponent(item.id)}">${item.image_url?`<img src="${esc(item.image_url)}" alt="${esc(item.name)}" loading="lazy">`:'<span>PARTS</span>'}</a><div><small>${esc(item.brand||item.category||'Запчасть')}</small><a href="#/parts/item/${encodeURIComponent(item.id)}"><b>${esc(item.name||'Товар')}</b></a><span>${item.oem_number?`OEM ${esc(item.oem_number)} · `:''}SKU ${esc(item.sku||'—')}</span><footer><strong>${money(item.price)}</strong><em>${Number(item.stock_qty||0)>0?'В наличии':'Нет в наличии'}</em></footer></div></article>`).join('');
    const avg=Number(trust.reviewAverage||0),reviewCount=Number(trust.reviewCount||0),delivered=Number(trust.deliveredOrders||0),storeName=String(p.store_name||'Магазин'),initial=storeName.trim().charAt(0).toUpperCase()||'K';
    const logo=p.logo_url?`<img src="${esc(p.logo_url)}" alt="${esc(storeName)}">`:`<span>${esc(initial)}</span>`;
    set(`<section class="k-page k-detail-page k-storefront-page k-storefront-ref-page" data-storefront-root>
      <header class="k-storefront-ref-top"><button class="k-storefront-ref-icon" type="button" data-smart-back data-fallback="#/parts" aria-label="Назад">←</button><strong>KARETA.KZ</strong><button class="k-storefront-ref-icon" type="button" data-storefront-share aria-label="Поделиться">↗</button></header>
      <section class="k-storefront-ref-profile"><div class="k-storefront-ref-logo">${logo}</div><div class="k-storefront-ref-main"><small>МАГАЗИН ЗАПЧАСТЕЙ</small><h1>${esc(storeName)}</h1><p>${esc(p.description||p.assortment||'Магазин автомобильных запчастей.')}</p><div class="k-storefront-tags">${p.city?`<span>${esc(p.city)}</span>`:''}${categories.slice(0,5).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="k-storefront-actions"><button class="k-btn k-btn-primary" type="button" data-storefront-chat>Написать</button><button class="k-btn k-btn-secondary" type="button" data-storefront-follow>☆ Сохранить</button></div></section>
      <section class="k-storefront-trust"><article><strong>${Number(trust.activeProducts||products.length)}</strong><span>товаров</span></article><article><strong>${delivered}</strong><span>заказов выдано</span></article><article><strong>${reviewCount?avg.toFixed(1):'—'}</strong><span>${reviewCount?`${reviewCount} отзывов`:'без отзывов'}</span></article><article><strong>${Number(p.return_days||14)}</strong><span>дней возврата</span></article></section>
      <nav class="k-storefront-ref-tabs" aria-label="Разделы магазина"><button type="button" class="is-active" data-storefront-tab="products">Товары</button><button type="button" data-storefront-tab="about">О магазине</button><button type="button" data-storefront-tab="reviews">Отзывы</button></nav>
      <section class="k-storefront-ref-pane is-active" data-storefront-pane="products"><label class="k-community-reference-composer k-storefront-ref-search"><span>⌕</span><input type="search" data-storefront-search placeholder="Найти товар, OEM или бренд" autocomplete="off"></label><div class="k-storefront-products" data-storefront-products>${productCards||'<div class="k-empty">Сейчас у магазина нет опубликованных товаров в наличии.</div>'}</div><div class="k-empty" data-storefront-empty hidden>По вашему запросу товаров нет.</div></section>
      <section class="k-storefront-ref-pane" data-storefront-pane="about" hidden><div class="k-storefront-ref-about"><article><small>АДРЕС</small><b>${esc(p.warehouse_address||p.city||'Уточняется в чате')}</b><span>${esc(p.city||'')}</span></article><article><small>ДОСТАВКА</small><b>${esc(deliveries.join(', ')||'Уточняется')}</b><span>Условия подтверждает продавец</span></article><article><small>ОПЛАТА</small><b>${esc(payments.join(', ')||'По согласованию')}</b><span>${esc(p.minimum_order||'Без указанного минимального заказа')}</span></article><article><small>ВОЗВРАТ</small><b>${Number(p.return_days||14)} дней</b><span>${esc(p.return_policy||'Условия возврата уточняются у продавца')}</span></article></div><button class="k-btn k-btn-primary k-storefront-ref-chat-wide" type="button" data-storefront-chat>Открыть чат с магазином</button></section>
      <section class="k-storefront-ref-pane" data-storefront-pane="reviews" hidden><div class="k-storefront-ref-review-summary"><strong>${reviewCount?avg.toFixed(1):'—'}</strong><div><b>${reviewCount?`${reviewCount} отзывов`:'Отзывов пока нет'}</b><p>Отзывы формируются после заказов через KARETA.</p></div></div></section>
    </section>`);
    const openChat=async btn=>{btn.disabled=true;try{const numericSellerId=Number(sellerId),prefill=`Здравствуйте. Пишу со страницы магазина ${storeName}.`;const chat=numericSellerId>0?await api.openDirectChat({userId:numericSellerId}):await api.openSupportChat(prefill);if(!chat.ok)throw new Error(chat.payload?.message||'Чат недоступен');const chatId=chat.payload?.chat?.id||chat.payload?.id||'';try{if(chatId)sessionStorage.setItem('kareta.chat.open',chatId);sessionStorage.setItem('kareta.chat.prefill',prefill);}catch(_e){}location.hash='#/chats';}catch(problem){btn.disabled=false;window.KaretaToast?.error?.(problem.message||'Не удалось открыть чат');}};
    document.querySelectorAll('[data-storefront-chat]').forEach(btn=>btn.addEventListener('click',()=>openChat(btn)));
    document.querySelectorAll('[data-storefront-tab]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.storefrontTab;document.querySelectorAll('[data-storefront-tab]').forEach(x=>x.classList.toggle('is-active',x===btn));document.querySelectorAll('[data-storefront-pane]').forEach(pane=>{const active=pane.dataset.storefrontPane===key;pane.hidden=!active;pane.classList.toggle('is-active',active);});}));
    const search=document.querySelector('[data-storefront-search]');search?.addEventListener('input',()=>{const q=String(search.value||'').trim().toLowerCase();let shown=0;document.querySelectorAll('[data-storefront-product]').forEach(card=>{const visible=!q||String(card.dataset.search||'').includes(q);card.hidden=!visible;if(visible)shown++;});const empty=document.querySelector('[data-storefront-empty]');if(empty)empty.hidden=shown>0;});
    document.querySelector('[data-storefront-share]')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:storeName,text:p.description||'Магазин KARETA',url:location.href});else{await navigator.clipboard?.writeText?.(location.href);window.KaretaToast?.success?.('Ссылка скопирована');}}catch(_e){}});
    document.querySelector('[data-storefront-follow]')?.addEventListener('click',event=>{const btn=event.currentTarget,active=btn.dataset.active==='1';btn.dataset.active=active?'0':'1';btn.textContent=active?'☆ Сохранить':'★ Сохранено';});
  }

  async function mountService(ctx={}){
    const id=hashParts()[2]||''; const r=await api.getServiceDetail(id,{signal:ctx.lifecycle?.signal}); if(!r.ok)return set(error('#/services',r.payload?.message));
    const s=r.payload.data?.service||{}, offers=Array.isArray(r.payload.data?.offers)?r.payload.data.offers:[], providerOffers=offers.filter(o=>['sto','master'].includes(String(o?.provider?.type||o?.ownerType||'').toLowerCase()));
    const workList=Array.isArray(s.list)&&s.list.length?s.list:[s.whyText||'Диагностика и согласование объёма работ', 'Выполнение работ по согласованному объёму', 'Проверка результата перед завершением'];
    const steps=Array.isArray(s.steps)&&s.steps.length?s.steps:['Создайте заявку с автомобилем и описанием проблемы','Получите предложения мастеров и СТО','Подтвердите цену и время до начала работ'];
    const pricedProviderOffers=providerOffers.filter(o=>String(o?.priceType||'fixed')!=='agreement'&&Number(o?.price||0)>0);
    const providerMinPrice=pricedProviderOffers.length?Math.min(...pricedProviderOffers.map(o=>Number(o.price||0))):0;
    const price=providerMinPrice>0?money(providerMinPrice):money(s.minOfferPrice||s.basePrice);
    const time=String(s.timeLabel||s.avgTime||'По согласованию');
    const providerInitials=name=>String(name||'K').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'K';
    const offerRows=providerOffers.length?providerOffers.map((o,index)=>{
      const provider=o.provider||{},type=String(provider.type||o.ownerType||'master').toLowerCase(),providerId=String(provider.id||o.ownerEntityId||''),providerName=String(provider.name||o.ownerName||(type==='sto'?'СТО':'Мастер'));
      const profileHref=`#/masters/profile/${type==='sto'?'sto':'master'}/${encodeURIComponent(providerId)}`;
      const avatar=String(provider.avatarUrl||'').trim();
      const location=[provider.address,provider.city,o.city].map(v=>String(v||'').trim()).find(Boolean)||'Местоположение уточняется';
      const rating=Number(provider.rating||0),ordersCount=Number(provider.ordersCount||0);
      const providerMeta=[type==='sto'?'СТО':'Мастер',rating>0?`★ ${rating.toFixed(1)}`:'',ordersCount>0?`${ordersCount} работ`:''].filter(Boolean).join(' · ');
      const receptionStatus=String(provider.receptionStatus||'open').toLowerCase(),statusKey=['open','busy','day_off'].includes(receptionStatus)?receptionStatus:'open',statusLabel={open:'Открыто',busy:'Занято',day_off:'Выходной'}[statusKey];
      return `<article class="k-service-provider-card ${type==='sto'?'is-sto':'is-master'}" data-service-provider-card data-provider-type="${esc(type)}" data-provider-id="${esc(providerId)}">
        <a class="k-service-provider-card__avatar" href="${profileHref}" aria-label="Открыть профиль ${esc(providerName)}">${avatar?`<img src="${esc(avatar)}" alt="${esc(providerName)}" loading="lazy">`:`<span>${esc(type==='sto'?'СТО':providerInitials(providerName))}</span>`}</a>
        <div class="k-service-provider-card__copy">
          <div class="k-service-provider-card__top"><small>${esc(providerMeta)}</small>${type==='sto'?`<strong class="k-master-reference-sto-status is-${esc(statusKey)}">${esc(statusLabel)}</strong>`:''}</div>
          <a class="k-service-provider-card__name" href="${profileHref}">${esc(providerName)}</a>
          <span class="k-service-provider-card__location">${uiIcon('location')}<i>${esc(location)}</i></span>
          <div class="k-service-provider-card__facts"><span><b>${esc(servicePriceLabel(o))}</b><small>за эту услугу</small></span><span><b>${esc(serviceDurationLabel(o))}</b><small>время</small></span>${Number(o.warrantyDays||0)>0?`<span><b>${esc(o.warrantyDays)} дн.</b><small>гарантия</small></span>`:''}</div>
        </div>
        <div class="k-service-provider-card__actions">
          <a class="k-service-provider-card__more" href="${profileHref}">Подробнее</a>
          <button type="button" class="k-service-provider-card__book" data-service-provider-book data-provider-type="${esc(type)}" data-provider-id="${esc(providerId)}" data-provider-name="${esc(providerName)}" data-service-id="${esc(s.id||id)}" data-service-name="${esc(s.name||'Услуга')}" data-offer-id="${esc(o.id||'')}" data-offer-price="${esc(o.price||0)}" data-offer-price-type="${esc(o.priceType||'fixed')}" data-offer-price-max="${esc(o.priceMax||0)}">${uiIcon('calendar')}<span>Записаться</span></button>
        </div>
      </article>`;
    }).join(''):`<div class="k-service-detail-ref-empty"><b>Исполнителей пока нет</b><p>Создайте заявку — СТО и мастера смогут предложить цену и удобное время.</p></div>`;
    set(`<section class="k-page k-detail-page k-service-detail-ref" data-service-detail-ref>
      <header class="k-service-detail-ref-topbar"><button type="button" data-smart-back data-fallback="#/services" aria-label="Назад">‹</button><div><small>УСЛУГА</small><span>${esc(s.categoryName||s.category||'Каталог KARETA')}</span></div><a href="#/services" aria-label="Каталог услуг">⌕</a></header>
      <div class="k-service-detail-ref-layout"><main>
        <section class="k-service-detail-ref-hero"><div class="k-service-detail-ref-icon" aria-hidden="true">${esc(s.icon||'⚙')}</div><div class="k-service-detail-ref-hero-copy"><h1>${esc(s.name||'Услуга')}</h1><p>${esc(s.shortDesc||s.whyText||'Состав и итоговая стоимость подтверждаются до начала работ.')}</p></div><div class="k-service-detail-ref-facts"><article><span>Стоимость от</span><b>${price}</b></article><article><span>Ориентир по времени</span><b>${esc(time)}</b></article><article><span>Предложений</span><b>${providerOffers.length}</b></article></div><button class="k-service-detail-ref-primary" data-next-action="service-booking" data-service-id="${esc(s.id)}" data-service-name="${esc(s.name)}">Создать заявку</button></section>
        <section class="k-service-detail-ref-section"><header><small>СОСТАВ</small><h2>Что входит в работу</h2></header><ul class="k-service-detail-ref-list">${workList.map(x=>`<li><i>✓</i><span>${esc(x)}</span></li>`).join('')}</ul></section>
        <section class="k-service-detail-ref-section"><header><small>СЦЕНАРИЙ</small><h2>Как это работает</h2></header><ol class="k-service-detail-ref-steps">${steps.map((x,i)=>`<li><i>${i+1}</i><span>${esc(x)}</span></li>`).join('')}</ol></section>
        <section class="k-service-detail-ref-section k-service-detail-ref-offers"><header><div><small>КТО ОКАЗЫВАЕТ УСЛУГУ</small><h2>СТО и мастера с ценами</h2></div><span>${providerOffers.length}</span></header><div class="k-service-provider-list">${offerRows}</div></section>
      </main><aside class="k-service-detail-ref-aside"><div><small>БЫСТРЫЙ СТАРТ</small><h2>${esc(s.name||'Нужен ремонт?')}</h2><p>Выберите автомобиль, способ получения предложений, место и время. Цена подтверждается до начала работ.</p><div class="k-service-detail-ref-aside-facts"><span><b>${price}</b> ориентир</span><span><b>${esc(time)}</b> время</span></div><button data-next-action="service-booking" data-service-id="${esc(s.id)}" data-service-name="${esc(s.name)}">Оставить заявку</button><a href="#/masters">Сначала выбрать мастера</a></div></aside></div>
    </section>`);
    document.querySelectorAll('[data-service-provider-book]').forEach(button=>button.addEventListener('click',()=>{
      const type=String(button.dataset.providerType||'master').toLowerCase();
      const providerId=String(button.dataset.providerId||'');
      const providerName=String(button.dataset.providerName||'');
      const serviceId=String(button.dataset.serviceId||s.id||id);
      const serviceName=String(button.dataset.serviceName||s.name||'Услуга');
      const base={serviceId,serviceName,offerId:button.dataset.offerId||'',offerPrice:Number(button.dataset.offerPrice||0),offerPriceType:button.dataset.offerPriceType||'fixed',offerPriceMax:Number(button.dataset.offerPriceMax||0),source:'service_provider_booking',description:`Запись на услугу ${serviceName} у ${providerName}`};
      const payload=type==='sto'?{...base,stoId:providerId,stoName:providerName}:{...base,masterId:providerId,masterName:providerName};
      try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify(payload));}catch(_e){}
      if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
    },{signal:ctx.lifecycle?.signal}));
  }
  async function mountProvider(ctx={}){
    const parts=hashParts(), type=parts[2]||'master', id=parts[3]||'';
    const r=await api.getProviderDetail(type,id,{signal:ctx.lifecycle?.signal});
    if(!r.ok)return set(providerError(r.payload?.message));
    const payloadData=r.payload.data||{};
    const p=payloadData.provider||{}, offers=Array.isArray(payloadData.offers)?payloadData.offers:[], reviews=Array.isArray(payloadData.reviews)?payloadData.reviews:[], works=Array.isArray(payloadData.works)?payloadData.works:[], news=Array.isArray(payloadData.news)?payloadData.news:[], wallPosts=Array.isArray(payloadData.wallPosts)?payloadData.wallPosts:[];
    const reviewSummary=payloadData.reviewSummary||{}, socialState=payloadData.socialState||{}, socialCounts=payloadData.socialCounts||{};
    const isSto=type==='sto', providerType=isSto?'sto':'master';
    const query=String(location.hash||'').split('?')[1]||'', queryParams=new URLSearchParams(query), activeTab=queryParams.get('tab')||'profile';
    const profileBase=`#/masters/profile/${providerType}/${encodeURIComponent(id)}`;
    const social=window.KaretaSocialState;
    const openDialog=dialog=>{if(!dialog)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');};
    const closeDialog=dialog=>{if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');};
    const wireDialogs=()=>{
      document.querySelectorAll('[data-provider-open]').forEach(btn=>btn.addEventListener('click',()=>openDialog(document.querySelector(`[data-provider-dialog="${CSS.escape(btn.dataset.providerOpen||'')}"]`))));
      document.querySelectorAll('[data-provider-close]').forEach(btn=>btn.addEventListener('click',()=>closeDialog(btn.closest('dialog'))));
      document.querySelectorAll('.k-provider-native-dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog(dialog);}));
    };
    const wireFollow=(selector='[data-provider-follow]')=>{
      document.querySelectorAll(selector).forEach(btn=>btn.addEventListener('click',async()=>{
        const next=btn.dataset.following!=='1';btn.disabled=true;
        const rr=isSto?await api.updateStoSocial(id,'following',next):await api.updateMasterSocial(id,'following',next);btn.disabled=false;
        if(!rr.ok)return window.KaretaToast?.error(rr.payload?.message||'Не удалось изменить подписку');
        document.querySelectorAll('[data-provider-follow]').forEach(x=>{x.dataset.following=next?'1':'0';if(x.dataset.providerFollowMode==='icon'){x.classList.toggle('is-active',next);x.setAttribute('aria-label',next?'Убрать из сохранённых':'Сохранить мастера');x.innerHTML=uiIcon('bookmark');}else{x.textContent=next?'Вы подписаны':'Подписаться';x.classList.toggle('k-btn-primary',!next);x.classList.toggle('k-btn-secondary',next);}});
        const count=Number(rr.payload?.counts?.followers??socialCounts.followers??0);document.querySelectorAll('[data-provider-followers]').forEach(x=>x.textContent=String(count));
        social?.setFollowing?.(providerType,id,next,{name:p.name||''});
      }));
    };
    const wireChatBook=()=>{
      document.querySelectorAll('[data-provider-chat]').forEach(btn=>btn.addEventListener('click',()=>{
        const providerLabel=isSto?'СТО':'мастера';
        try{sessionStorage.setItem('kareta.chat.prefill',`Здравствуйте. Хочу уточнить ремонт у ${providerLabel} ${btn.dataset.providerName||''}.`);}catch(_e){}
        location.hash=`#/chats?${isSto?'stoId':'masterId'}=${encodeURIComponent(id)}`;
      }));
      document.querySelectorAll('[data-provider-book]').forEach(btn=>btn.addEventListener('click',()=>{
        try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify(isSto?{stoId:id,stoName:btn.dataset.providerName||p.name||'',description:`Запись в СТО ${btn.dataset.providerName||p.name||''}`,source:'provider_profile'}:{masterId:id,masterName:btn.dataset.providerName||p.name||'',description:`Запись к мастеру ${btn.dataset.providerName||p.name||''}`,source:'provider_profile'}));}catch(_e){}
        if(!isSto){location.hash=`#/masters/book/master/${encodeURIComponent(id)}`;return;}
        if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
      }));
    };

    if(activeTab==='wall'){
      const rawFilter=queryParams.get('type')||'all', allowedWallFilters=['all','works','posts','advice','news','video','parts'], wallFilter=allowedWallFilters.includes(rawFilter)?rawFilter:'all';
      let wallPayload=null;
      if(!isSto){
        const wr=await api.request(`api/db.php?action=masterSocialWall.feed&masterId=${encodeURIComponent(id)}&limit=100`,{method:'GET',cacheTtlMs:12000,cacheKey:`master.wall:${id}`,signal:ctx.lifecycle?.signal});
        if(wr.ok)wallPayload=wr.payload?.data||{};
      }
      const fallbackPosts=[
        ...news.map(item=>({source:'news',entityKey:`news:${item.id||item.slug||''}`,kind:'news',kindLabel:'Новость',id:item.id||'',title:item.title||'Новость',text:item.intro||item.summary||item.body||'',image:item.image_url||item.cover_url||'',photos:[],videoUrl:'',product:null,date:item.published_at||item.created_at||'',likes:Number(item.likes_count||0),comments:Number(item.comments_count||0),views:Number(item.views_count||0),liked:false,saved:false,href:item.id?`#/news/${encodeURIComponent(item.id)}`:'#/works'})),
        ...works.map(item=>({source:'work',entityKey:`work:${item.id||''}`,kind:'work',kindLabel:'Выполненная работа',id:item.id||'',title:item.title||'Выполненная работа',text:item.description||item.summary||item.serviceLabel||item.service_label||'',image:item.coverUrl||item.cover_url||item.media?.[0]?.fileUrl||'',photos:[],videoUrl:'',product:null,date:item.publishedAt||item.created_at||'',likes:Number(item.likesCount||item.likes_count||0),comments:Number(item.commentsCount||item.comments_count||0),views:Number(item.viewsCount||item.views_count||0),liked:false,saved:false,href:item.id?`#/works/item/${encodeURIComponent(item.id)}`:'#/real-works'}))
      ];
      const posts=(Array.isArray(wallPayload?.items)?wallPayload.items:fallbackPosts).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const counts=wallPayload?.counts||{all:posts.length,works:posts.filter(x=>x.kind==='work').length,posts:posts.filter(x=>x.kind==='note').length,advice:posts.filter(x=>x.kind==='advice').length,news:posts.filter(x=>x.kind==='news').length,video:posts.filter(x=>x.kind==='video').length,parts:posts.filter(x=>x.kind==='part').length};
      const matchFilter=post=>wallFilter==='all'||(wallFilter==='works'&&post.kind==='work')||(wallFilter==='posts'&&post.kind==='note')||(wallFilter==='advice'&&post.kind==='advice')||(wallFilter==='news'&&post.kind==='news')||(wallFilter==='video'&&post.kind==='video')||(wallFilter==='parts'&&post.kind==='part');
      const shown=posts.filter(matchFilter);
      const following=Boolean(socialState.following??social?.isFollowing?.(providerType,id)??false);
      const filterLabels={all:'Все',works:'Работы',posts:'Публикации',advice:'Советы',news:'Новости',video:'Видео',parts:'Запчасти'},filterLabel=filterLabels[wallFilter]||'Все';
      const postMedia=post=>{
        const photos=Array.isArray(post.photos)?post.photos.filter(Boolean):[];
        if(photos.length)return `<div class="k-master-wall-post__media-grid">${photos.slice(0,6).map(src=>`<img src="${esc(src)}" alt="${esc(post.title||post.kindLabel||'Публикация')}" loading="lazy">`).join('')}</div>`;
        if(post.image)return post.href?`<a class="k-master-wall-post__media" href="${esc(post.href)}"><img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy" onerror="this.closest('.k-master-wall-post__media').classList.add('is-empty');this.hidden=true"></a>`:`<div class="k-master-wall-post__media"><img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy"></div>`;
        return '';
      };
      const postHtml=shown.map(post=>`<article class="k-master-wall-post" data-wall-post="${esc(post.entityKey||`${post.source}:${post.id}`)}" data-wall-kind="${esc(post.kind)}">
        <header class="k-master-wall-post__head"><div class="k-master-wall-post__avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:esc(String(p.name||(isSto?'СТО':'М')).slice(0,2).toUpperCase())}</div><div><b>${esc(p.name||(isSto?'СТО':'Мастер'))}</b><small>${esc(post.kindLabel||({work:'Выполненная работа',news:'Новость',advice:'Совет',video:'Видео',part:'Запчасть'}[post.kind]||'Публикация'))}${post.date?` · ${esc(String(post.date).slice(0,10))}`:''}</small></div></header>
        ${postMedia(post)}${post.videoUrl?`<a class="k-master-wall-post__video" href="${esc(post.videoUrl)}" target="_blank" rel="noopener"><b>▶</b><span><b>Видео Мастера</b><small>Открыть видео в отдельном окне</small></span></a>`:''}
        <div class="k-master-wall-post__body"><h2>${esc(post.title||post.kindLabel||'Публикация')}</h2>${post.text?`<p>${esc(post.text)}</p>`:''}</div>
        ${post.product?`<div class="k-master-wall-post__product">${post.product.imageUrl?`<img src="${esc(post.product.imageUrl)}" alt="${esc(post.product.name)}">`:''}<div><strong>${esc(post.product.name)}</strong><span>${post.product.oem?`OEM ${esc(post.product.oem)} · `:''}${post.product.storeName?esc(post.product.storeName):'Запчасть KARETA'}</span><b>${Number(post.product.price||0)>0?money(post.product.price):'Цена по запросу'}</b></div><a class="k-btn k-btn-secondary" href="#/parts/item/${encodeURIComponent(post.product.id)}">Открыть</a></div>`:''}
        <footer class="k-master-wall-post__actions"><button type="button" class="k-social-action ${post.liked?'is-active':''}" data-wall-like="${esc(post.entityKey||'')}" data-wall-source="${esc(post.source||'post')}" data-wall-source-id="${esc(post.id||'')}">${uiIcon('heart')}<span>Нравится</span><b>${Number(post.likes||0)}</b></button><button type="button" class="k-social-action" data-wall-comments="${esc(post.entityKey||'')}" data-wall-source="${esc(post.source||'post')}" data-wall-source-id="${esc(post.id||'')}">${uiIcon('comment')}<span>Комментарии</span><b>${Number(post.comments||0)}</b></button><span class="k-master-wall-post__views">${uiIcon('view')}<b>${Number(post.views||0)}</b></span><button type="button" class="k-master-wall-save ${post.saved?'is-active':''}" data-wall-save="${esc(post.entityKey||'')}" data-wall-source="${esc(post.source||'post')}" data-wall-source-id="${esc(post.id||'')}">${post.saved?'Сохранено':'Сохранить'}</button>${post.href?`<a class="k-master-wall-post__open" href="${esc(post.href)}">Открыть</a>`:''}</footer>
      </article>`).join('');
      set(`<section class="k-page k-detail-page k-provider-profile-page k-master-wall-page ${isSto?'is-sto':'is-master'}">
        <header class="k-master-wall-hero"><div class="k-master-wall-hero__avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="${esc(p.name||'')}">`:esc(String(p.name||(isSto?'СТО':'М')).slice(0,2).toUpperCase())}</div><div><small>Стена ${isSto?'автосервиса':'мастера'}</small><h1>${esc(p.name||(isSto?'СТО':'Мастер'))}</h1><p>Реальные работы, советы, публикации, видео и запчасти в одной социальной ленте.</p></div><div class="k-master-wall-hero__actions"><button class="k-btn ${following?'k-btn-secondary':'k-btn-primary'}" type="button" data-provider-follow data-following="${following?'1':'0'}">${following?'Вы подписаны':'Подписаться'}</button><button class="k-btn k-btn-secondary" type="button" data-provider-chat data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Сообщение</button></div><div class="k-master-wall-hero__count"><b>${posts.length}</b><span>публикаций</span></div></header>
        <div class="k-master-wall-native-actions"><a class="k-btn k-btn-secondary" href="${profileBase}">Профиль</a><button class="k-btn k-btn-secondary" type="button" data-provider-open="wall-filter">Фильтры · ${esc(filterLabel)}</button></div>
        <div class="k-master-wall-feed">${postHtml||`<div class="k-empty"><h2>${wallFilter==='all'?'Стена пока пустая':'В этом разделе пока ничего нет'}</h2><p>Новые работы и публикации ${isSto?'СТО':'мастера'} появятся здесь.</p></div>`}</div>
        <dialog class="k-provider-native-dialog" data-provider-dialog="wall-filter"><div class="k-provider-dialog-panel"><header><div><small>СТЕНА</small><h2>Что показать</h2></div><button type="button" data-provider-close aria-label="Закрыть">×</button></header><div class="k-master-wall-filter-grid">${[['all','Все публикации'],['works','Работы'],['posts','Публикации'],['advice','Советы'],['news','Новости'],['video','Видео'],['parts','Запчасти']].map(([key,label])=>`<a class="${wallFilter===key?'is-active':''}" href="${profileBase}?tab=wall${key==='all'?'':`&type=${key}`}"><span>${label}</span><b>${Number(counts[key]||0)}</b></a>`).join('')}</div></div></dialog>
        <dialog class="k-master-wall-comments-dialog" data-wall-comments-dialog><div class="k-master-wall-comments-panel"><header><div><small>ОБСУЖДЕНИЕ</small><h2>Комментарии</h2></div><button type="button" data-wall-comments-close aria-label="Закрыть">×</button></header><div class="k-master-wall-comments-list" data-wall-comments-list><div class="k-empty">Загружаем комментарии…</div></div><form class="k-master-wall-comment-form" data-wall-comment-form><input type="hidden" name="entityKey"><input type="hidden" name="source"><input type="hidden" name="sourceId"><input type="hidden" name="parentId"><textarea name="text" rows="2" maxlength="1500" required placeholder="Написать комментарий"></textarea><button class="k-btn k-btn-primary" type="submit">Отправить</button></form></div></dialog>
      </section>`);
      wireDialogs();wireFollow();wireChatBook();
      const commentDialog=document.querySelector('[data-wall-comments-dialog]'),commentList=commentDialog?.querySelector('[data-wall-comments-list]'),commentForm=commentDialog?.querySelector('[data-wall-comment-form]');
      const commentHtml=(item,source)=>{const authorReply=source==='work'?!!item.isWorkAuthorReply:String(item.authorMasterId||'')===String(id);return `<article class="k-master-wall-comment ${item.parentId?'is-reply':''}" data-comment-id="${esc(item.id)}"><header><b>${esc(item.authorName||'Пользователь')}${authorReply?' · Автор работы':''}</b><small>${esc(String(item.createdAt||'').slice(0,16))}</small></header><p>${esc(item.body||'')}</p><footer><button type="button" class="k-btn k-btn-secondary" data-wall-comment-reply="${esc(item.id)}">Ответить</button>${item.canDelete?`<button type="button" class="k-btn k-btn-secondary" data-wall-comment-delete="${esc(item.id)}">Удалить</button>`:''}</footer></article>`;};
      const loadComments=async(entityKey,source,sourceId)=>{if(!commentDialog||!commentList||!commentForm)return;commentForm.elements.entityKey.value=entityKey;commentForm.elements.source.value=source;commentForm.elements.sourceId.value=sourceId;commentForm.elements.parentId.value='';commentForm.elements.text.placeholder='Написать комментарий';commentList.innerHTML='<div class="k-empty">Загружаем комментарии…</div>';commentDialog.showModal();let rr;if(source==='work')rr=await api.getWorkPostComments(sourceId,{cacheTtlMs:0,dedupe:false});else rr=await api.request(`api/db.php?action=masterSocialWall.comments&entityKey=${encodeURIComponent(entityKey)}`,{method:'GET',cacheTtlMs:0,dedupe:false});if(!rr.ok){commentList.innerHTML=`<div class="k-empty">${esc(rr.payload?.message||'Не удалось загрузить комментарии')}</div>`;return;}const items=rr.payload?.data?.items||rr.payload?.items||[];commentList.innerHTML=items.length?items.map(x=>commentHtml(x,source)).join(''):'<div class="k-empty">Комментариев пока нет. Начните обсуждение.</div>';};
      document.querySelectorAll('[data-wall-like]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const source=btn.dataset.wallSource,sourceId=btn.dataset.wallSourceId,entityKey=btn.dataset.wallLike,current=btn.classList.contains('is-active');let rr;if(source==='work')rr=await api.likeWorkPost(sourceId);else rr=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.like',entityKey,value:!current}),cacheTtlMs:0,dedupe:false});btn.disabled=false;if(!rr.ok)return window.KaretaToast?.error(rr.payload?.message||'Не удалось поставить отметку');const data=rr.payload?.data||rr.payload||{};btn.classList.toggle('is-active',!!data.liked);const b=btn.querySelector('b');if(b)b.textContent=String(Number(data.likesCount||0));}));
      document.querySelectorAll('[data-wall-save]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const source=btn.dataset.wallSource,sourceId=btn.dataset.wallSourceId,entityKey=btn.dataset.wallSave,current=btn.classList.contains('is-active');let rr;if(source==='work')rr=await api.saveWorkPost(sourceId,!current);else rr=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.saveState',entityKey,value:!current}),cacheTtlMs:0,dedupe:false});btn.disabled=false;if(!rr.ok)return window.KaretaToast?.error(rr.payload?.message||'Не удалось сохранить');const saved=source==='work'?!!(rr.payload?.data?.saved??!current):!!(rr.payload?.data?.saved);btn.classList.toggle('is-active',saved);btn.textContent=saved?'Сохранено':'Сохранить';}));
      document.querySelectorAll('[data-wall-comments]').forEach(btn=>btn.addEventListener('click',()=>loadComments(btn.dataset.wallComments,btn.dataset.wallSource,btn.dataset.wallSourceId)));
      commentDialog?.querySelector('[data-wall-comments-close]')?.addEventListener('click',()=>commentDialog.close());
      commentList?.addEventListener('click',async e=>{const reply=e.target.closest('[data-wall-comment-reply]');if(reply){commentForm.elements.parentId.value=reply.dataset.wallCommentReply;commentForm.elements.text.placeholder='Ответить на комментарий';commentForm.elements.text.focus();return;}const del=e.target.closest('[data-wall-comment-delete]');if(!del)return;const source=commentForm.elements.source.value,idComment=del.dataset.wallCommentDelete;del.disabled=true;const rr=source==='work'?await api.deleteWorkPostComment(idComment):await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.commentDelete',id:idComment}),cacheTtlMs:0,dedupe:false});if(!rr.ok){del.disabled=false;return window.KaretaToast?.error(rr.payload?.message||'Не удалось удалить комментарий');}await loadComments(commentForm.elements.entityKey.value,source,commentForm.elements.sourceId.value);});
      commentForm?.addEventListener('submit',async e=>{e.preventDefault();const button=commentForm.querySelector('[type=submit]');button.disabled=true;const source=commentForm.elements.source.value,sourceId=commentForm.elements.sourceId.value,entityKey=commentForm.elements.entityKey.value,parentId=commentForm.elements.parentId.value,text=commentForm.elements.text.value.trim();let rr;if(source==='work')rr=await api.addWorkPostComment(sourceId,text,parentId);else rr=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.comment',entityKey,text,parentId}),cacheTtlMs:0,dedupe:false});button.disabled=false;if(!rr.ok)return window.KaretaToast?.error(rr.payload?.message||'Комментарий не отправлен');commentForm.elements.text.value='';commentForm.elements.parentId.value='';await loadComments(entityKey,source,sourceId);});
      return;
    }

    const resume=(p.resume&&typeof p.resume==='object'&&!Array.isArray(p.resume))?p.resume:{};
    const splitList=value=>Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean):String(value||'').split(/[,;|\n]/).map(x=>x.trim()).filter(Boolean);
    const initials=isSto?'СТО':String(p.name||'K').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    const experience=p.experience_label||resume.experience||p.experience_years?`${esc(p.experience_label||resume.experience||p.experience_years)}${(resume.experience||p.experience_years)&&!p.experience_label?' лет':''}`:'Не указан';
    const primaryServices=[...(Array.isArray(p.primary_services)?p.primary_services:[]),...offers.map(o=>o.service_category_name||o.serviceCategoryName||''),...splitList(p.spec),...splitList(resume.spec)].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,10);
    const brands=splitList(resume.brands).slice(0,14), skills=splitList(resume.skills).slice(0,12);
    const about=resume.bio||p.description||p.offer_text||`${isSto?'Автосервис':'Мастер'} принимает заявки через KARETA.KZ и фиксирует этапы ремонта.`;
    const providerLocation=[p.city||resume.city,p.district||resume.district].filter(Boolean).join(' · ')||'Казахстан';
    const address=p.service_address||p.address||resume.address||'';
    const workMode=p.work_mode||resume.workMode||'';
    const guarantee=resume.guarantee||'';
    const responseTime=resume.responseTimeLabel||'';
    const paymentMethods=resume.paymentMethods||'';
    const availability=String(p.availability||'online');
    const availabilityLabel={online:'Принимает заявки',busy:'Занят',offline:'Не принимает заявки'}[availability]||'Статус уточняется';
    const minPrice=offers.reduce((m,o)=>{const v=Number(o.price||0);return v>0&&(!m||v<m)?v:m;},0);
    const reviewAvg=Number(reviewSummary.average??(reviews.length?reviews.reduce((n,v)=>n+Number(v.rating||0),0)/reviews.length:Number(p.rating||0)))||0;
    const following=Boolean(socialState.following??social?.isFollowing?.(providerType,id)??false), followers=Number(socialCounts.followers||0);
    const serviceCards=offers.slice(0,4).map(o=>`<article class="k-master-service-card k-r84-provider-service-card"><div><span class="k-provider-service-icon">${esc(o.service_icon||'⚙')}</span><div><strong>${esc(o.service_name||o.service_id||'Услуга')}</strong><small>${esc(serviceDurationLabel(o))} · гарантия ${esc(o.warranty_days||o.warrantyDays||0)} дн.</small></div></div><b>${esc(servicePriceLabel(o))}</b></article>`).join('');
    const allServices=offers.map(o=>`<article class="k-provider-dialog-row"><div><strong>${esc(o.service_name||o.service_id||'Услуга')}</strong>${o.service_description?`<p>${esc(o.service_description)}</p>`:''}<small>${esc(serviceDurationLabel(o))} · гарантия ${esc(o.warranty_days||o.warrantyDays||0)} дн.${o.notes?` · ${esc(o.notes)}`:''}</small></div><b>${esc(servicePriceLabel(o))}</b></article>`).join('');
    const workCard=w=>`<a class="k-master-work-card" href="#/works/item/${encodeURIComponent(w.id)}"><div class="k-master-work-card__media">${w.coverUrl||w.cover_url?`<img src="${esc(w.coverUrl||w.cover_url)}" alt="${esc(w.title)}" loading="lazy">`:`<span>${esc((w.vehicleLabel||w.vehicle_label||'AUTO').slice(0,8))}</span>`}</div><div><strong>${esc(w.title)}</strong><span>${esc(w.vehicleLabel||w.vehicle_label||'Автомобиль')}</span><small>${esc(w.serviceLabel||w.service_label||'Выполненная работа')}</small><div class="k-provider-work-metrics"><span>${uiIcon('heart')} ${Number(w.likesCount||w.likes_count||0)}</span><span>${uiIcon('comment')} ${Number(w.commentsCount||w.comments_count||0)}</span><span>${uiIcon('view')} ${Number(w.viewsCount||w.views_count||0)}</span></div></div></a>`;
    const workCards=works.slice(0,3).map(workCard).join(''), allWorks=works.map(workCard).join('');
    const reviewCard=v=>`<article class="k-master-review-card"><div class="k-master-review-card__head"><b>${esc(v.author_name||v.authorName||'Клиент')}</b><span>${'★'.repeat(Math.max(0,Math.min(5,Number(v.rating||0))))}</span></div><p>${esc(v.text||v.body||'')}</p><small>${v.order_id?'Подтверждённый заказ':'Отзыв клиента'}${v.created_at?` · ${esc(String(v.created_at).slice(0,10))}`:''}</small>${v.master_reply?`<div class="k-master-review-reply"><b>Ответ мастера</b><p>${esc(v.master_reply)}</p></div>`:''}</article>`;
    const reviewCards=reviews.slice(0,3).map(reviewCard).join(''), allReviews=reviews.map(reviewCard).join('');
    const breakdown=reviewSummary.breakdown||{};
    const reviewBreakdown=[5,4,3,2,1].map(n=>{const count=Number(breakdown[String(n)]||0), pct=reviews.length?Math.round(count/reviews.length*100):0;return `<div><span>${n} ★</span><i><b style="width:${pct}%"></b></i><em>${count}</em></div>`}).join('');
    const dimensionLabels={quality_rating:'Качество',timing_rating:'Сроки',neatness_rating:'Аккуратность',communication_rating:'Общение'};
    const dimensionHtml=Object.entries(reviewSummary.dimensions||{}).map(([key,value])=>`<article><strong>${Number(value||0).toFixed(1)}</strong><span>${esc(dimensionLabels[key]||key)}</span></article>`).join('');
    const wallPreview=[
      ...wallPosts.map(item=>({kind:item.kind||'note',title:item.title||'Публикация',text:item.preview||item.text||'',date:item.publishedAt||'',href:`${profileBase}?tab=wall`})),
      ...news.map(item=>({kind:'news',title:item.title||'Новость',text:item.intro||item.body||'',date:item.published_at||item.created_at||'',href:item.id?`#/news/${encodeURIComponent(item.id)}`:'#/works'})),
      ...works.map(item=>({kind:'work',title:item.title||'Выполненная работа',text:item.summary||item.serviceLabel||'',date:item.publishedAt||'',href:item.id?`#/works/item/${encodeURIComponent(item.id)}`:'#/works'}))
    ].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3);
    const wallCards=wallPreview.map(post=>`<a class="k-provider-wall-preview-card" href="${post.href}"><small>${post.kind==='work'?'РАБОТА':'ПУБЛИКАЦИЯ'}${post.date?` · ${esc(String(post.date).slice(0,10))}`:''}</small><strong>${esc(post.title)}</strong>${post.text?`<p>${esc(post.text)}</p>`:''}</a>`).join('');
    const extraFacts=[
      ['Формат работы',workMode],['Район',p.district||resume.district],['Радиус выезда',Number(p.service_radius_km||0)>0?`${Number(p.service_radius_km)} км`:''],['Ответ',responseTime],['Гарантия',guarantee],['Оплата',paymentMethods],['Языки',resume.languages]
    ].filter(([,v])=>String(v||'').trim());

    if(!isSto){
      const specialtyTags=(primaryServices.length?primaryServices:splitList(p.spec)).slice(0,3);
      const serviceRows=offers.slice(0,2).map(o=>`<a class="k-master-ref-service-row" href="#/services/item/${encodeURIComponent(o.service_id||o.id||'')}"><span>${esc(o.service_name||o.service_id||'Услуга')}</span><b>${esc(servicePriceLabel(o))}</b><i>›</i></a>`).join('')||'<div class="k-master-ref-empty-row">Услуги пока не опубликованы</div>';
      const workRows=works.slice(0,2).map(w=>{const src=w.coverUrl||w.cover_url||w.image_url||w.media?.[0]?.fileUrl||'';return `<a class="k-master-ref-work" href="#/works/item/${encodeURIComponent(w.id||'')}">${src?`<img src="${esc(src)}" alt="${esc(w.title||'Работа мастера')}" loading="lazy">`:`<span>${uiIcon('services')}</span>`}</a>`;}).join('')||'<div class="k-master-ref-work is-empty"></div><div class="k-master-ref-work is-empty"></div>';
      set(`<section class="k-page k-master-ref-profile" data-master-ref-profile data-master-ref-version="2">
        <div class="k-master-ref-profile__inner">
          <div class="k-master-ref-topbar"><button type="button" data-smart-back data-fallback="#/masters" aria-label="Назад">${uiIcon('chevronLeft')}</button><div><button type="button" data-master-ref-share aria-label="Поделиться">${uiIcon('share')}</button><button type="button" class="${following?'is-active':''}" data-provider-follow data-provider-follow-mode="icon" data-following="${following?'1':'0'}" aria-label="${following?'Убрать из сохранённых':'Сохранить мастера'}">${uiIcon('bookmark')}</button></div></div>
          <header class="k-master-ref-identity"><div class="k-master-ref-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="${esc(p.name||'Мастер')}">`:`<span>${esc(initials)}</span>`}</div><div><h1>${esc(p.name||'Мастер')}</h1><p>${esc(p.spec||primaryServices[0]||'Автомеханик')}</p><div class="k-master-ref-rating"><b>★</b><strong>${reviewAvg.toFixed(1)}</strong><span>·</span><span>${reviews.length||Number(p.reviews_count||0)} отзывов</span></div><div class="k-master-ref-online ${availability==='online'?'is-online':''}"><i></i><span>${availability==='online'?(responseTime?`Отвечает ${esc(responseTime)}`:'Отвечает за 10 минут'):esc(availabilityLabel)}</span></div></div></header>
          <div class="k-master-ref-actions"><button type="button" data-provider-chat data-provider-name="${esc(p.name||'Мастер')}">${uiIcon('message')}<span>Написать</span></button><button class="is-primary" type="button" data-provider-book data-provider-name="${esc(p.name||'Мастер')}">Записаться</button></div>
          <div class="k-master-ref-tags">${specialtyTags.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
          <section class="k-master-ref-section"><h2>Услуги и цены</h2><div class="k-master-ref-services">${serviceRows}</div></section>
          <section class="k-master-ref-section"><div class="k-master-ref-section-head"><h2>Последние работы</h2>${works.length?`<a href="${profileBase}?tab=wall&type=works">Все <span>›</span></a>`:''}</div><div class="k-master-ref-works">${workRows}</div></section>
        </div>
      </section>`);
      document.querySelector('[data-master-ref-share]')?.addEventListener('click',async()=>{const url=location.href,title=p.name||'Мастер KARETA.KZ';try{if(navigator.share)await navigator.share({title,url});else{await navigator.clipboard?.writeText?.(url);window.KaretaToast?.success?.('Ссылка скопирована');}}catch(_e){}});
      wireFollow();
      wireChatBook();
      return;
    }

    set(`<section class="k-page k-detail-page k-provider-profile-page k-provider-native-profile k-r84-provider-profile ${isSto?'is-sto':'is-master'}">
      <header class="k-provider-profile-hero k-provider-native-hero k-r84-provider-hero">
        <div class="k-provider-profile-avatar k-r84-provider-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="${esc(p.name)}">`:esc(initials)}</div>
        <div class="k-provider-profile-main k-r84-provider-copy"><div class="k-provider-native-status k-r84-provider-status"><span class="is-${esc(availability)}">${esc(availabilityLabel)}</span>${p.sto_name?`<a href="${p.sto_id?`#/masters/profile/sto/${encodeURIComponent(p.sto_id)}`:'#/masters'}">${esc(p.sto_name)}</a>`:''}</div><h1 class="k-title">${esc(p.name||(isSto?'СТО':'Мастер'))}</h1><p>${esc(p.offer_text||p.description||resume.offer||resume.bio||'Профессиональный ремонт и обслуживание автомобилей.')}</p><div class="k-provider-profile-tags">${primaryServices.slice(0,6).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>
        <div class="k-provider-profile-score k-r84-provider-score"><strong>${reviewAvg.toFixed(1)}</strong><span>рейтинг</span><small>${Number(reviewSummary.verified||0)} подтверждённых</small></div>
      </header>

      <section class="k-provider-native-primary-actions k-r84-provider-actions"><button class="k-btn k-btn-primary" type="button" data-provider-book data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Записаться</button><button class="k-btn k-btn-secondary" type="button" data-provider-chat data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Написать</button><button class="k-btn ${following?'k-btn-secondary':'k-btn-primary'}" type="button" data-provider-follow data-following="${following?'1':'0'}">${following?'Вы подписаны':'Подписаться'}</button></section>

      <section class="k-provider-profile-metrics k-provider-native-metrics k-r84-provider-metrics"><article><strong>${esc(p.orders_count||0)}</strong><span>выполненных работ</span></article><article><strong>${works.length}</strong><span>работ в профиле</span></article><article><strong data-provider-followers>${followers}</strong><span>подписчиков</span></article><article><strong>${experience}</strong><span>опыт</span></article><article><strong>${offers.length}</strong><span>услуг</span></article><article><strong>${minPrice?money(minPrice):'По запросу'}</strong><span>стоимость от</span></article></section>

      <div class="k-provider-native-layout k-r84-provider-layout"><main class="k-provider-profile-content">
        <section class="k-detail-section k-provider-native-about"><div class="k-provider-section-head"><div><small>О СПЕЦИАЛИСТЕ</small><h2>Опыт и подход</h2></div><button class="k-btn k-btn-secondary" type="button" data-provider-open="experience">Подробнее</button></div><p>${esc(about)}</p><div class="k-provider-native-facts"><article><span>Город</span><b>${esc(providerLocation)}</b></article>${address?`<article><span>Место работы</span><b>${esc(address)}</b></article>`:''}<article><span>Статус</span><b>${esc(availabilityLabel)}</b></article>${responseTime?`<article><span>Обычно отвечает</span><b>${esc(responseTime)}</b></article>`:''}</div></section>

        <section class="k-detail-section"><div class="k-provider-section-head"><div><small>СПЕЦИАЛИЗАЦИИ</small><h2>Что делает ${isSto?'СТО':'мастер'}</h2></div></div><div class="k-provider-specialty-grid">${primaryServices.length?primaryServices.map(x=>`<article><span>${uiIcon('services')}</span><b>${esc(x)}</b></article>`).join(''):'<div class="k-empty">Специализации пока не заполнены.</div>'}</div>${brands.length?`<div class="k-provider-brand-block"><b>Работает с марками</b><div>${brands.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}</section>

        <section class="k-detail-section"><div class="k-provider-section-head"><div><small>ПРАЙС</small><h2>Услуги и цены</h2></div>${offers.length>4?`<button class="k-btn k-btn-secondary" type="button" data-provider-open="services">Все услуги · ${offers.length}</button>`:''}</div><div class="k-master-service-list">${serviceCards||`<div class="k-empty">${isSto?'СТО ещё не опубликовало':'Мастер ещё не опубликовал'} услуги.</div>`}</div><button class="k-btn k-btn-primary" type="button" data-provider-book data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Записаться на услугу</button></section>

        <section class="k-detail-section"><div class="k-provider-section-head"><div><small>ПОРТФОЛИО</small><h2>Реальные работы</h2></div>${works.length>3?`<button class="k-btn k-btn-secondary" type="button" data-provider-open="works">Все работы · ${works.length}</button>`:''}</div><div class="k-master-work-grid">${workCards||'<div class="k-empty">Опубликованных работ пока нет.</div>'}</div></section>

        <section class="k-detail-section"><div class="k-provider-section-head"><div><small>РЕПУТАЦИЯ</small><h2>Отзывы клиентов</h2></div>${reviews.length>0?`<a class="k-btn k-btn-secondary" href="#/masters/reviews/${encodeURIComponent(providerType)}/${encodeURIComponent(id)}">Все отзывы · ${reviews.length}</a>`:''}</div><div class="k-provider-review-summary"><div class="k-provider-review-score"><strong>${reviewAvg.toFixed(1)}</strong><span>${reviews.length} отзывов</span><small>${Number(reviewSummary.verified||0)} по подтверждённым заказам</small></div><div class="k-provider-review-breakdown">${reviewBreakdown}</div></div>${dimensionHtml?`<div class="k-provider-review-dimensions">${dimensionHtml}</div>`:''}<div class="k-master-review-grid">${reviewCards||'<div class="k-empty">Отзывов пока нет.</div>'}</div></section>

        <section class="k-detail-section"><div class="k-provider-section-head"><div><small>СОЦИАЛЬНАЯ СТРАНИЦА</small><h2>Стена ${isSto?'СТО':'мастера'}</h2></div><a class="k-btn k-btn-secondary" href="${profileBase}?tab=wall">Открыть стену · ${works.length+news.length+wallPosts.length}</a></div><div class="k-provider-wall-preview">${wallCards||'<div class="k-empty">Публикаций пока нет.</div>'}</div></section>
      </main>

      <aside class="k-provider-profile-aside k-provider-native-aside k-r84-provider-aside"><div class="k-provider-contact-card k-r84-provider-contact"><small>БЫСТРОЕ ДЕЙСТВИЕ</small><h2>Нужен похожий ремонт?</h2><p>Создайте заявку сразу с выбранным ${isSto?'СТО':'мастером'} или сначала уточните детали в чате.</p><button class="k-btn k-btn-primary" type="button" data-provider-book data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Создать заявку</button><button class="k-btn k-btn-secondary" type="button" data-provider-chat data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Написать</button></div>${p.sto_name||p.stoName?`<div class="k-provider-sto-card"><small>КОМАНДА</small><h3>${esc(p.sto_name||p.stoName)}</h3><p>${esc(p.sto_address||address||p.city||'')}</p>${p.sto_id?`<a class="k-btn k-btn-secondary" href="#/masters/profile/sto/${encodeURIComponent(p.sto_id)}">Открыть СТО</a>`:''}</div>`:''}</aside>
      </div>

      <dialog class="k-provider-native-dialog" data-provider-dialog="experience"><div class="k-provider-dialog-panel"><header><div><small>ПРОФИЛЬ</small><h2>Опыт и условия работы</h2></div><button type="button" data-provider-close aria-label="Закрыть">×</button></header><div class="k-provider-dialog-facts"><article><span>Опыт</span><b>${experience}</b></article>${extraFacts.map(([label,value])=>`<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('')}</div>${skills.length?`<section><h3>Навыки и оборудование</h3><div class="k-provider-dialog-tags">${skills.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:''}${resume.education?`<section><h3>Образование</h3><p>${esc(resume.education)}</p></section>`:''}${resume.courses?`<section><h3>Обучение и сертификаты</h3><p>${esc(resume.courses)}</p></section>`:''}${resume.awards?`<section><h3>Достижения</h3><p>${esc(resume.awards)}</p></section>`:''}</div></dialog>
      <dialog class="k-provider-native-dialog" data-provider-dialog="services"><div class="k-provider-dialog-panel is-wide"><header><div><small>УСЛУГИ</small><h2>Полный прайс</h2></div><button type="button" data-provider-close aria-label="Закрыть">×</button></header><div class="k-provider-dialog-list">${allServices||'<div class="k-empty">Услуг пока нет.</div>'}</div><button class="k-btn k-btn-primary" type="button" data-provider-book data-provider-name="${esc(p.name||(isSto?'СТО':'Мастер'))}">Создать заявку</button></div></dialog>
      <dialog class="k-provider-native-dialog" data-provider-dialog="works"><div class="k-provider-dialog-panel is-wide"><header><div><small>ПОРТФОЛИО</small><h2>Все работы</h2></div><button type="button" data-provider-close aria-label="Закрыть">×</button></header><div class="k-provider-dialog-work-grid">${allWorks||'<div class="k-empty">Работ пока нет.</div>'}</div></div></dialog>
      
    </section>`);
    wireDialogs();wireFollow();wireChatBook();
  }

  function renderProviderBooking(){return `<section class="k-page k-master-ref-booking" data-master-ref-booking><div class="k-master-ref-booking__inner"><div class="k-detail-loading"><h1 class="k-title">Запись к мастеру</h1><p>Загружаем свободное время…</p></div></div></section>`;}
  async function mountProviderBooking(ctx={}){
    const parts=hashParts(),type=parts[2]||'master',id=parts[3]||'';
    if(type!=='master'||!id){set(providerError('Мастер не найден'));return;}
    const rr=await api.getProviderDetail('master',id,{signal:ctx.lifecycle?.signal});
    if(!rr.ok){set(providerError(rr.payload?.message));return;}
    const data=rr.payload?.data||{},p=data.provider||{},offers=Array.isArray(data.offers)?data.offers:[];
    const now=new Date(),days=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()+i);const iso=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return {date:d,iso,weekday:new Intl.DateTimeFormat('ru-RU',{weekday:'short'}).format(d).replace('.',''),day:d.getDate()};});
    let selectedDate=days[Math.min(3,days.length-1)].iso,selectedTime='',selectedService=null,slots=[],slotError='',loadToken=0;
    const selectableOffers=offers.filter(o=>String(o.service_id??o.serviceId??'').trim());
    const serviceIdOf=o=>String(o?.service_id??o?.serviceId??'').trim();
    const serviceNameOf=o=>String(o?.service_name??o?.serviceName??o?.name??'Услуга');
    const slotTime=slot=>String(typeof slot==='string'?slot:(slot?.value??slot?.time??slot?.label??'')).match(/\b\d{2}:\d{2}\b/)?.[0]||'';
    const slotAllowed=slot=>slot?.available!==false&&!['busy','booked','closed'].includes(String(slot?.status||'').toLowerCase());
    const root=document.querySelector('[data-master-ref-booking]');
    if(!root)return;
    const avatar=p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="${esc(p.name||'Мастер')}">`:`<span>${esc(String(p.name||'М').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase())}</span>`;
    root.innerHTML=`<div class="k-master-ref-booking__inner">
      <section class="k-master-ref-booking-master"><div>${avatar}</div><span><b>${esc(p.name||'Мастер')}</b><small>${esc(p.spec||'Автомеханик')}</small></span></section>
      <div class="k-master-ref-booking-stepper" aria-label="Шаг 1 из 3"><span class="is-active">1</span><i></i><span>2</span><i></i><span>3</span></div>
      <section class="k-master-ref-booking-block k-master-ref-booking-services"><h2>Выберите услугу</h2>
      <div class="k-master-ref-booking-service-options" data-book-services>${selectableOffers.length?selectableOffers.map(offer=>`<button type="button" data-book-service-option="${esc(serviceIdOf(offer))}" aria-pressed="false"><b>${esc(serviceNameOf(offer))}</b><small>${servicePriceLabel(offer)}</small></button>`).join(''):'<p class="k-master-ref-no-slots">У мастера пока нет услуг для записи.</p>'}</div></section>
      <section class="k-master-ref-booking-block"><h2>Выберите дату</h2><div class="k-master-ref-week" data-book-week>${days.map(day=>`<button type="button" data-book-date="${day.iso}" class="${day.iso===selectedDate?'is-active':''}"><small>${esc(day.weekday)}</small><b>${day.day}</b><i></i></button>`).join('')}</div></section>
      <section class="k-master-ref-booking-block"><h2>Свободное время</h2><div class="k-master-ref-time" data-book-time><span class="k-master-ref-loading-slots">Загружаем…</span></div></section>

      <button class="k-master-ref-booking-continue" type="button" data-book-continue disabled>Продолжить</button>
    </div>`;
    const timeBox=root.querySelector('[data-book-time]'),continueButton=root.querySelector('[data-book-continue]');
    const paintSlots=()=>{
      const available=slots.filter(slot=>slotAllowed(slot)&&slotTime(slot));
      timeBox.innerHTML=selectedService
        ? (slotError?'<span class="k-master-ref-no-slots">'+esc(slotError)+'</span>':available.length
          ?available.slice(0,12).map(slot=>`<button type="button" data-book-slot="${esc(slotTime(slot))}" class="${selectedTime===slotTime(slot)?'is-active':''}">${esc(slot.label||slotTime(slot))}</button>`).join('')
          :'<span class="k-master-ref-no-slots">На эту дату свободных окон нет</span>')
        :'<span class="k-master-ref-no-slots">Сначала выберите услугу</span>';
      continueButton.disabled=!selectedService||!selectedDate||!selectedTime;
    };
    const loadSlots=async()=>{
      const token=++loadToken;
      selectedTime='';slots=[];slotError='';continueButton.disabled=true;
      if(!selectedService){paintSlots();return;}
      timeBox.innerHTML='<span class="k-master-ref-loading-slots">Загружаем…</span>';
      try{
        const result=await api.getBookingSlots({masterId:id,date:selectedDate,serviceId:serviceIdOf(selectedService)},{signal:ctx.lifecycle?.signal,cacheTtlMs:0,force:true});
        if(!result?.ok)throw new Error(result?.payload?.message||'Не удалось проверить свободное время');
        slots=Array.isArray(result?.payload?.data?.slots)?result.payload.data.slots:[];
      }catch(error){slots=[];slotError=error?.message||'Не удалось получить свободное время';}
      if(ctx.lifecycle?.signal?.aborted||token!==loadToken)return;
      paintSlots();
    };
    root.addEventListener('click',async event=>{
      const serviceButton=event.target.closest('[data-book-service-option]');
      if(serviceButton){
        selectedService=selectableOffers.find(o=>serviceIdOf(o)===serviceButton.dataset.bookServiceOption)||null;
        root.querySelectorAll('[data-book-service-option]').forEach(x=>{const isActive=x===serviceButton;x.classList.toggle('is-active',isActive);x.setAttribute('aria-pressed',String(isActive));});
        await loadSlots();return;
      }
      const dateButton=event.target.closest('[data-book-date]');
      if(dateButton){selectedDate=dateButton.dataset.bookDate;root.querySelectorAll('[data-book-date]').forEach(x=>x.classList.toggle('is-active',x===dateButton));await loadSlots();return;}
      const timeButton=event.target.closest('[data-book-slot]');
      if(timeButton){selectedTime=timeButton.dataset.bookSlot;root.querySelectorAll('[data-book-slot]').forEach(x=>x.classList.toggle('is-active',x===timeButton));continueButton.disabled=!selectedService||!selectedTime;return;}
      if(!event.target.closest('[data-book-continue]')||continueButton.disabled||!selectedService||!selectedTime)return;
      const serviceId=serviceIdOf(selectedService),serviceName=serviceNameOf(selectedService);
      if(!serviceId||!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)||!/^\d{2}:\d{2}$/.test(selectedTime))return;
      continueButton.disabled=true;
      try{
        const latest=await api.getBookingSlots({masterId:id,date:selectedDate,serviceId},{signal:ctx.lifecycle?.signal,cacheTtlMs:0,force:true});
        if(!latest?.ok||!Array.isArray(latest?.payload?.data?.slots)||!latest.payload.data.slots.some(slot=>slotAllowed(slot)&&slotTime(slot)===selectedTime))throw new Error('Выбранное время уже недоступно. Выберите другое.');
        if(id.startsWith('demo-master-'))throw new Error('Это демонстрационный профиль. Для настоящей записи выберите действующего мастера.');
        sessionStorage.setItem('kareta.request.prefill',JSON.stringify({
          bookingContextId:'booking:'+Date.now()+':'+Math.random().toString(36).slice(2),
          providerType:'master',masterId:id,masterName:p.name||'',
          serviceId,serviceName,offerId:selectedService.id||selectedService.offer_id||'',date:selectedDate,time:selectedTime,timeMode:'exact',
          city:p.city||'',cityId:p.cityId||p.city_id||'',visitMode:'service',source:'master_booking'
        }));
        if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';
      }catch(error){slotError=error?.message||'Не удалось подтвердить выбранное время';paintSlots();}
    },{signal:ctx.lifecycle?.signal});
    await loadSlots();
  }

  window.KaretaDetailPages=Object.freeze({renderProduct,renderService,renderProvider,renderProviderBooking,mountProduct,mountService,mountProvider,mountProviderBooking});
})();
