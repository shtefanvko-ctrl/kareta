(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const money = value => `от ${new Intl.NumberFormat('ru-RU').format(Number(value || 1000) > 0 ? Number(value || 1000) : 1000)} ₸`;

  const uiIcon = name => window.KaretaUIIcons?.icon(name) || '';
  const initials = name => String(name || 'K').trim().split(/\s+/).slice(0,2).map(v => v.charAt(0)).join('').toUpperCase();
  const currentRole = () => String(window.KaretaRoleAccess?.currentRole?.() || window.KaretaNext?.state?.user?.role || 'client').toLowerCase();
  const uiSvg = name => window.KaretaUIIcons?.svg?.(name) || '';

  function renderPublicMasters(){
    return `<section class="k-page k-masters-page k-master-reference-list k-provider-reference-app" data-masters-page data-kflow-screen="masters">
      <div class="k-master-reference-inner">
        <div class="k-provider-ref-titlebar"><h1 data-master-title>Мастера</h1><div class="k-provider-ref-kind" role="group" aria-label="Тип исполнителя"><button type="button" data-master-provider-kind="sto">СТО</button><button type="button" data-master-provider-kind="master">Мастера</button></div></div>
        <label class="k-master-reference-search">${uiIcon('search')}<input type="search" data-master-search placeholder="Найти СТО, услугу или мастера…" autocomplete="off"></label>
        <div class="k-master-reference-filters" aria-label="Фильтры исполнителей"><button type="button" class="is-active is-nearby" data-master-mode="nearby"><span class="k-master-reference-filter-glyph">${uiIcon('location')}</span><span>Рядом</span></button><button type="button" class="is-rating" data-master-mode="rating"><span class="k-master-reference-filter-glyph">${uiIcon('star')}</span><span>Рейтинг</span></button><button type="button" class="is-available" data-master-mode="available"><span class="k-master-reference-filter-glyph">${uiIcon('calendar')}</span><span>Открыты</span></button><button type="button" class="k-master-reference-filter-icon is-filter" data-master-filter-toggle aria-label="Дополнительные фильтры"><span class="k-master-reference-filter-glyph">${uiIcon('filter')}</span></button></div>
        <div class="k-master-reference-filter-panel" data-master-filter-panel hidden><button type="button" class="is-active" data-master-spec="">Все услуги</button><button type="button" data-master-spec="диагност">Диагностика</button><button type="button" data-master-spec="ходов">Ходовая</button><button type="button" data-master-spec="электр">Электрика</button></div>
        <div class="k-masters-status" data-masters-status>Загружаем исполнителей…</div>
        <section class="k-masters-directory k-master-reference-directory" data-masters-directory aria-live="polite"></section>
      </div>
    </section>`;
  }



  function renderStoTeam(){
    return `<section class="k-page k-masters-page k-sto-r75-team k-flow-primary-page" data-masters-page data-sto-team data-kflow-screen="masters">
      <header class="k-sto-r75-team-toolbar"><div><strong>Мастера СТО</strong><span>Команда, загрузка и KPI вашего автосервиса.</span></div><div><label class="k-sto-r75-team-search">${uiSvg('search')}<input type="search" data-sto-team-search placeholder="Имя или специализация" autocomplete="off"></label><button class="k-btn k-btn-secondary" type="button" data-sto-team-refresh>${uiSvg('refresh')}<span>Обновить</span></button></div></header>
      <div class="k-sto-r75-team-summary" data-sto-team-summary><span><b>—</b><small>Мастеров</small></span><span><b>—</b><small>Сегодня</small></span><span><b>—</b><small>В работе</small></span><span><b>—</b><small>Средняя загрузка</small></span></div>
      <div class="k-sto-r75-team-list" data-sto-team-list><div class="k-empty"><h2>Загружаем команду</h2><p>Получаем Мастеров и текущую загрузку.</p></div></div>
    </section>`;
  }

  function renderMasters(){
    return currentRole()==='sto' ? renderStoTeam() : renderPublicMasters();
  }

  function stoTeamRow(master,dispatch){
    const d=dispatch||{},load=Math.max(0,Math.round(Number(d.loadPct||0)));
    return `<article class="k-sto-r75-team-row" data-sto-team-master="${esc(master.id)}" data-search="${esc(String((master.name||'')+' '+(master.spec||'')).toLowerCase())}"><a href="#/masters/profile/master/${encodeURIComponent(master.id)}" class="k-sto-r75-team-main"><span class="k-sto-r75-team-avatar">${esc(initials(master.name||'М'))}</span><span><b>${esc(master.name||'Мастер')}</b><small>${esc(master.spec||'Специализация не указана')}</small></span></a><span class="k-sto-r75-team-load"><b>${load}%</b><i><em style="width:${Math.min(100,load)}%"></em></i><small>ETA ${esc(d.etaStart||'—')}</small></span><span class="k-sto-r75-team-kpi"><b>${Number(master.todayOrders||0)}</b><small>сегодня</small></span><span class="k-sto-r75-team-kpi"><b>${Number(master.activeOrders||0)}</b><small>в работе</small></span><span class="k-sto-r75-team-kpi"><b>${Number(master.kpi||0)}%</b><small>KPI</small></span><div class="k-sto-r75-team-actions"><a class="k-btn k-btn-secondary" href="#/masters/profile/master/${encodeURIComponent(master.id)}">${uiSvg('user')}<span>Профиль</span></a><button class="k-btn k-btn-secondary" type="button" data-sto-team-chat="${esc(master.id)}" data-sto-team-name="${esc(master.name||'Мастер')}">${uiSvg('chats')}<span>Чат</span></button></div></article>`;
  }

  async function mountStoTeam(root,context={}){
    const api=context.api||window.KaretaApiClient,list=root.querySelector('[data-sto-team-list]'),summary=root.querySelector('[data-sto-team-summary]'),search=root.querySelector('[data-sto-team-search]');
    let masters=[];
    const paint=()=>{const q=String(search?.value||'').trim().toLowerCase(),rows=masters.filter(x=>!q||String((x.master.name||'')+' '+(x.master.spec||'')).toLowerCase().includes(q));list.innerHTML=rows.length?rows.map(x=>stoTeamRow(x.master,x.dispatch)).join(''):'<div class="k-empty"><h2>Мастера не найдены</h2><p>Измените поиск или привяжите Мастера к СТО.</p></div>';};
    const load=async()=>{list.innerHTML='<div class="k-empty"><h2>Обновляем команду</h2><p>Проверяем загрузку и активные ремонты.</p></div>';try{const result=window.KaretaStoWorkplaceApi?.get?await window.KaretaStoWorkplaceApi.get(api,{signal:context.lifecycle?.signal}):await api.request('api/db.php?action=stoWorkplace.get',{force:true,cacheTtlMs:0,signal:context.lifecycle?.signal});if(!result?.ok)throw new Error(result?.payload?.message||result?.payload?.error||result?.message||'Не удалось загрузить Мастеров');const data=result.payload?.data||result.data||{},dispatchRows=Array.isArray(data.dispatch?.masters)?data.dispatch.masters:[],dispatchMap=new Map(dispatchRows.map(x=>[String(x.id),x]));masters=(Array.isArray(data.masters)?data.masters:[]).map(master=>({master,dispatch:dispatchMap.get(String(master.id))||{}}));const totalToday=masters.reduce((a,x)=>a+Number(x.master.todayOrders||0),0),active=masters.reduce((a,x)=>a+Number(x.master.activeOrders||0),0),avg=masters.length?Math.round(masters.reduce((a,x)=>a+Number(x.dispatch.loadPct||0),0)/masters.length):0;const vals=summary?.querySelectorAll('b')||[];if(vals[0])vals[0].textContent=String(masters.length);if(vals[1])vals[1].textContent=String(totalToday);if(vals[2])vals[2].textContent=String(active);if(vals[3])vals[3].textContent=`${avg}%`;paint();}catch(error){list.innerHTML=`<div class="k-empty"><h2>Команда временно недоступна</h2><p>${esc(error?.message||'Не удалось выполнить операцию')}</p></div>`;}};
    search?.addEventListener('input',paint,{signal:context.lifecycle?.signal});
    root.querySelector('[data-sto-team-refresh]')?.addEventListener('click',load,{signal:context.lifecycle?.signal});
    root.addEventListener('click',async event=>{const btn=event.target.closest('[data-sto-team-chat]');if(!btn)return;if(btn.disabled)return;btn.disabled=true;try{const r=await api.openDirectChat({masterId:btn.dataset.stoTeamChat});if(!r?.ok)throw new Error(r?.payload?.message||'Не удалось открыть чат');const chatId=String(r.payload?.chat?.id||'');if(chatId)try{sessionStorage.setItem('kareta.chat.open',chatId)}catch(_e){}location.hash='#/chats';}catch(error){window.KaretaToast?.error?.(error?.message||'Не удалось открыть чат');btn.disabled=false;}},{signal:context.lifecycle?.signal});
    await load();
  }


  function mastersSkeleton(count = 4){
    const cards = Array.from({length: count}, () => `<article class="k-provider-card k-skeleton-card k-skeleton-provider" aria-hidden="true"><div class="k-skeleton-provider__head"><span class="k-skeleton k-skeleton-avatar"></span><div class="k-skeleton-provider__copy"><span class="k-skeleton k-skeleton-line k-skeleton-line--short"></span><span class="k-skeleton k-skeleton-line k-skeleton-line--title"></span><span class="k-skeleton k-skeleton-line"></span></div></div><div class="k-skeleton-tags"><span class="k-skeleton"></span><span class="k-skeleton"></span><span class="k-skeleton"></span></div><div class="k-skeleton-actions"><span class="k-skeleton"></span><span class="k-skeleton"></span><span class="k-skeleton"></span></div></article>`).join('');
    return `<div class="k-provider-section k-skeleton-section" aria-label="Загрузка исполнителей"><div class="k-provider-section-head"><span class="k-skeleton k-skeleton-heading"></span></div><div class="k-provider-grid">${cards}</div></div>`;
  }

  function masterCard(row){
    const available=String(row.availability||'online')==='online';
    const avatar=row.avatar_url||row.avatar||row.photo||'';
    const rating=Number(row.rating||0).toFixed(1);
    const reviews=Number(row.reviewsCount||row.reviews_count||0);
    const experience=String(row.experienceLabel||row.experience_label||'').trim();
    const spec=String(row.spec||'Автомеханик').trim();
    const explicitAvailability=String(row.availabilityLabel||row.availability_label||row.nextAvailabilityLabel||'').trim();
    const availabilityText=explicitAvailability||(available?'Свободен сегодня':'Завтра');
    const rawTags=[...new Set(spec.split(/[,/·]+/).map(x=>x.trim()).filter(Boolean))].slice(0,3);
    const tags=rawTags.length?rawTags:[spec];
    const location=String(row.distanceLabel||row.city||'').trim();
    const profileHref=`#/masters/profile/master/${encodeURIComponent(row.id)}`;
    const bookHref=`#/masters/book/master/${encodeURIComponent(row.id)}`;
    const chatHref=`#/chats?masterId=${encodeURIComponent(row.id)}`;
    const phone=String(row.phone||row.phone_number||row.contactPhone||'').trim();
    return `<article class="k-master-reference-card" data-master-card="${esc(row.id)}">
      <div class="k-master-reference-card__main">
        <a class="k-master-reference-avatar" href="${profileHref}">${avatar?`<img src="${esc(avatar)}" alt="${esc(row.name||'Мастер')}">`:`<span>${esc(initials(row.name||'Мастер'))}</span>`}</a>
        <div class="k-master-reference-copy">
          <h2>${esc(row.name||'Мастер')}</h2>
          <p>${esc([spec,experience].filter(Boolean).join(' · '))}</p>
          <div class="k-master-reference-rating"><b>${uiIcon('star')}</b><strong>${rating}</strong><span>·</span><span>${reviews} отзывов</span></div>
          ${location?`<div class="k-master-reference-location">${uiIcon('location')}<span>${esc(location)}</span></div>`:''}
          <div class="k-master-reference-availability ${available?'is-free':'is-later'}"><i></i><span>${esc(availabilityText)}</span></div>
          <div class="k-master-reference-tags">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>
        </div>
      </div>
      <div class="k-master-reference-actions">
        <a class="k-master-reference-action-icon" href="${chatHref}" aria-label="Написать мастеру" title="Написать">${uiIcon('comment')}<span>Написать</span></a>
        ${phone?`<a class="k-master-reference-action-icon" href="tel:${esc(phone)}" aria-label="Позвонить мастеру" title="Позвонить">${uiIcon('phone')}<span>Позвонить</span></a>`:`<span class="k-master-reference-action-icon is-disabled" aria-disabled="true">${uiIcon('phone')}<span>Телефон</span></span>`}
        <a class="k-master-reference-action-secondary" href="${profileHref}">Подробнее</a>
        <a class="k-master-reference-action-primary" href="${bookHref}">${uiIcon('calendar')}<span>Записаться</span></a>
      </div>
    </article>`;
  }

  function referenceStationCard(row){
    const logo=row.logo_url||row.avatar_url||row.logo||row.avatar||window.KaretaVisualAssets?.stationImage||'';
    const rating=Number(row.rating||0).toFixed(1),reviews=Number(row.reviewsCount||row.reviewCount||row.reviews_count||0);
    const location=[row.distanceLabel,row.address,row.city].filter(Boolean)[0]||'Адрес уточняется';
    const hours=String(row.workHours||row.work_hours||row.scheduleLabel||'Открыто сегодня');
    const raw=String(row.spec||row.servicesLabel||row.description||'Диагностика · ТО · Ремонт').split(/[,/·]+/).map(x=>x.trim()).filter(Boolean).slice(0,3);
    const tags=raw.length?raw:['Диагностика','ТО','Ремонт'],href=`#/masters/profile/sto/${encodeURIComponent(row.id)}`;
    const chatHref=`#/chats?stoId=${encodeURIComponent(row.id)}`;
    const phone=String(row.phone||row.phone_number||row.contactPhone||'').trim();
    const receptionStatus=String(row.receptionStatus||row.reception_status||'open').toLowerCase();
    const statusKey=['open','busy','day_off'].includes(receptionStatus)?receptionStatus:'open';
    const statusLabel={open:'Открыто',busy:'Занято',day_off:'Выходной'}[statusKey];
    return `<article class="k-master-reference-card k-master-reference-card--sto"><div class="k-master-reference-card__main"><a class="k-master-reference-avatar" href="${href}">${logo?`<img src="${esc(logo)}" alt="${esc(row.name||'СТО')}" loading="lazy">`:`<span>СТО</span>`}</a><div class="k-master-reference-copy"><div class="k-master-reference-sto-head"><h2>${esc(row.name||'Автосервис')}</h2><strong class="k-master-reference-sto-status is-${esc(statusKey)}">${esc(statusLabel)}</strong></div><div class="k-master-reference-rating"><b>${uiIcon('star')}</b><strong>${rating}</strong><span>(${reviews} отзывов)</span></div><div class="k-master-reference-location">${uiIcon('location')}<span>${esc(location)}</span></div><p>${esc(hours)}</p><div class="k-master-reference-tags">${tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div></div></div><div class="k-master-reference-actions"><a class="k-master-reference-action-icon" href="${chatHref}" aria-label="Написать в СТО">${uiIcon('comment')}<span>Написать</span></a>${phone?`<a class="k-master-reference-action-icon" href="tel:${esc(phone)}" aria-label="Позвонить в СТО">${uiIcon('phone')}<span>Позвонить</span></a>`:`<span class="k-master-reference-action-icon is-disabled">${uiIcon('phone')}<span>Телефон</span></span>`}<a class="k-master-reference-action-secondary" href="${href}">Подробнее</a><a class="k-master-reference-action-primary" href="${href}">${uiIcon('calendar')}<span>Записаться</span></a></div></article>`;
  }

  function subscriptionCard(row){
    const isSto=String(row.type||'master')==='sto';
    const avatar=row.avatar_url||row.logo_url||row.avatar||row.logo||'';
    const profile=`#/masters/profile/${isSto?'sto':'master'}/${encodeURIComponent(row.id)}`;
    const label=isSto?'СТО':'Мастер';
    return `<article class="k-subscription-card" data-subscription-card="${esc(isSto?'sto':'master')}:${esc(row.id)}">
      <a class="k-subscription-card__profile" href="${profile}">
        <div class="k-subscription-card__avatar ${isSto?'is-sto':''}">${avatar?`<img src="${esc(avatar)}" alt="${esc(row.name)}">`:esc(isSto?'СТО':initials(row.name))}</div>
        <div><span>${label}</span><h3>${esc(row.name||label)}</h3><p>${esc(row.spec||row.description||'Ремонт и обслуживание')}</p></div>
      </a>
      <div class="k-subscription-card__meta"><span>${uiIcon('star')} ${Number(row.rating||0).toFixed(1)}</span><span>${esc(row.city||'Казахстан')}</span></div>
      <div class="k-subscription-card__actions"><a href="${profile}">Профиль</a><a href="#/chats?${isSto?'stoId':'masterId'}=${encodeURIComponent(row.id)}">Сообщение</a><button type="button" data-subscription-unfollow data-provider-type="${isSto?'sto':'master'}" data-provider-id="${esc(row.id)}">Отписаться</button></div>
    </article>`;
  }

  function paintSubscriptions(container,masters,stations){
    if(!container)return;
    const items=[...masters.filter(row=>row.social_state?.following),...stations.filter(row=>row.social_state?.following)];
    container.innerHTML=items.length?`<div class="k-my-subscriptions__track">${items.map(subscriptionCard).join('')}</div>`:`<div class="k-my-subscriptions__empty"><div><b>Подписок пока нет</b><span>Нажмите «Подписаться» в карточке мастера или СТО — они появятся здесь.</span></div></div>`;
  }

  function stationCard(row){
    const avatar = row.avatar_url || row.logo_url || row.logo || '';
    const rating = Number(row.rating || 0).toFixed(1);
    const reviews = Number(row.reviewsCount || row.reviewCount || row.reviews_count || 0);
    const works = Number(row.worksCount || row.completedOrders || row.completed_count || 0);
    const social=row.social_state||{};
    const following=!!social.following;
    return `<article class="k-provider-card k-provider-card--sto k-social-provider-card" data-sto-social-card="${esc(row.id)}">
      <div class="k-social-provider-cover k-social-provider-cover--sto" aria-hidden="true"></div>
      <div class="k-social-provider-head">
        <div class="k-social-provider-avatar-wrap"><div class="k-provider-avatar k-provider-avatar--sto">${avatar?`<img src="${esc(avatar)}" alt="${esc(row.name)}">`:'СТО'}</div><span class="k-social-provider-presence is-online"></span></div>
        <div class="k-social-provider-identity"><div class="k-provider-kind">Автосервис</div><h2>${esc(row.name)}</h2><p>${esc(row.spec || row.description || 'Комплексный ремонт автомобилей')}</p></div>
        <button class="k-social-provider-follow ${following?'is-active':''}" type="button" data-sto-follow="${esc(row.id)}" aria-pressed="${following}">${following?'Подписан':'Подписаться'}</button>
      </div>
      <div class="k-provider-tags"><span>${esc(row.city || 'Казахстан')}</span>${row.address?`<span>${esc(row.address)}</span>`:''}${row.workHours?`<span>${esc(row.workHours)}</span>`:''}</div>
      <div class="k-social-provider-stats"><div><b>${rating}</b><span>рейтинг</span></div><div><b>${reviews}</b><span>отзывов</span></div><div><b>${works}</b><span>работ</span></div><div><b>${esc(row.masterCount || 0)}</b><span>мастеров</span></div></div>
      <div class="k-social-provider-price"><span>Стоимость работ</span><b>${money(row.minPrice)}</b></div>
      <div class="k-provider-actions"><a class="k-btn k-btn-primary" href="#/masters/profile/sto/${encodeURIComponent(row.id)}">Профиль СТО</a><a class="k-btn k-btn-secondary" href="#/chats?stoId=${encodeURIComponent(row.id)}">Сообщение</a></div>
      <div class="k-social-follow-settings ${following?'is-visible':''}" data-sto-follow-settings><label><input type="checkbox" data-sto-follow-news="${esc(row.id)}" ${social.followNews!==false?'checked':''}> Новости</label><label><input type="checkbox" data-sto-follow-works="${esc(row.id)}" ${social.followWorks!==false?'checked':''}> Работы</label></div>
    </article>`;
  }

  const MASTERS_CACHE_TTL=30000;
  const MASTERS_CACHE_KEY=`kareta.masters.snapshot:${String(window.KARETA_NEXT_ASSET_VERSION||'dev')}`;
  let mastersCache={};
  try{mastersCache=JSON.parse(sessionStorage.getItem(MASTERS_CACHE_KEY)||'{}')||{};}catch(_e){mastersCache={};}
  const mastersCacheId=(kind,search)=>`${kind}:${String(search||'').trim().toLowerCase()}`;
  const mastersSignature=rows=>{try{return JSON.stringify((rows||[]).map(row=>[row.id,row.name,row.rating,row.availability,row.minPrice,row.offerCount,row.receptionStatus,row.reception_status]));}catch(_e){return'';}};
  function readMastersCache(key){const row=mastersCache[key];return row&&Array.isArray(row.rows)?row:null;}
  function writeMastersCache(key,rows){
    mastersCache[key]={at:Date.now(),rows,signature:mastersSignature(rows)};
    const keys=Object.keys(mastersCache).sort((a,b)=>Number(mastersCache[b]?.at||0)-Number(mastersCache[a]?.at||0));
    keys.slice(12).forEach(old=>delete mastersCache[old]);
    try{sessionStorage.setItem(MASTERS_CACHE_KEY,JSON.stringify(mastersCache));}catch(_e){}
    return mastersCache[key];
  }

  function mountMasters(context = {}){
    const root=document.querySelector('[data-masters-page]'); if(!root)return;
    if(root.hasAttribute('data-sto-team'))return mountStoTeam(root,context);
    const api=context.api||window.KaretaApiClient,status=root.querySelector('[data-masters-status]'),directory=root.querySelector('[data-masters-directory]'),input=root.querySelector('[data-master-search]'),filterPanel=root.querySelector('[data-master-filter-panel]'),title=root.querySelector('[data-master-title]');
    let mode='nearby',specFilter='',search='',rows=[],timer=0;
    const params=()=>{try{return new URLSearchParams(String(location.hash||'').split('?')[1]||'')}catch(_e){return new URLSearchParams()}};
    let providerKind=params().get('type')==='sto'?'sto':'master';
    const skeleton=()=>`<div class="k-master-reference-skeleton">${Array.from({length:4},()=>'<article><span></span><div><i></i><i></i><i></i><i></i></div></article>').join('')}</div>`;
    const score=row=>Number(row.rating||0),isFree=row=>providerKind==='sto'?String(row.isOpen??row.openNow??'1')!=='0':String(row.availability||'online')==='online';
    const matchesSpec=row=>!specFilter||String([row.spec,row.description,row.servicesLabel].filter(Boolean).join(' ')).toLowerCase().includes(specFilter);
    const syncKind=()=>{root.querySelectorAll('[data-master-provider-kind]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.masterProviderKind===providerKind));if(title)title.textContent=providerKind==='sto'?'СТО рядом':'Мастера';};
    const paint=()=>{let view=rows.filter(matchesSpec);if(mode==='available')view=view.filter(isFree);if(mode==='rating')view=[...view].sort((a,b)=>score(b)-score(a));if(mode==='nearby')view=[...view].sort((a,b)=>Number(isFree(b))-Number(isFree(a))||score(b)-score(a));directory.innerHTML=view.length?view.map(row=>providerKind==='sto'?referenceStationCard(row):masterCard(row)).join(''):'<div class="k-master-reference-empty"><b>Ничего не найдено</b><span>Измените поиск или фильтр.</span></div>';status.textContent=view.length?`Найдено: ${view.length}`:'По вашему запросу ничего не найдено';status.hidden=view.length>0;};
    const load=async({force=false,reason='route'}={})=>{
      syncKind();
      const key=mastersCacheId(providerKind,search);
      const cached=readMastersCache(key);
      const hasCached=Boolean(cached?.rows);
      if(hasCached){rows=cached.rows;paint();}
      else{status.hidden=false;status.textContent='Загружаем исполнителей…';directory.innerHTML=skeleton();}
      if(hasCached&&!force&&(Date.now()-Number(cached.at||0))<MASTERS_CACHE_TTL)return;
      try{
        const result=await api.getMastersCatalog({type:providerKind,search},{force:force||hasCached,signal:context.lifecycle?.signal});
        if(!result?.ok)throw new Error(result?.payload?.message||'Не удалось загрузить каталог');
        const data=result.payload?.data||{};
        const nextRows=providerKind==='sto'?(Array.isArray(data.stos)?data.stos:Array.isArray(data.stations)?data.stations:[]):(Array.isArray(data.masters)?data.masters:[]);
        const nextSignature=mastersSignature(nextRows);
        writeMastersCache(key,nextRows);
        if(!hasCached||nextSignature!==cached.signature){rows=nextRows;paint();}
        else{rows=cached.rows;status.hidden=true;}
      }catch(error){
        if(hasCached){rows=cached.rows;paint();return;}
        rows=[];directory.innerHTML='<div class="k-master-reference-empty"><b>Каталог временно недоступен</b><span>Попробуйте обновить страницу.</span></div>';status.hidden=false;status.textContent=error?.message||'Не удалось загрузить каталог';
      }
    };
    root.addEventListener('click',event=>{const kind=event.target.closest('[data-master-provider-kind]');if(kind){const next=kind.dataset.masterProviderKind;if(next&&next!==providerKind){providerKind=next;specFilter='';try{const q=new URLSearchParams(String(location.hash||'').split('?')[1]||'');q.set('type',providerKind);history.replaceState(null,'',location.pathname+location.search+'#/masters?'+q.toString());}catch(_e){}load();}return;}const modeButton=event.target.closest('[data-master-mode]');if(modeButton){mode=modeButton.dataset.masterMode||'nearby';root.querySelectorAll('[data-master-mode]').forEach(x=>x.classList.toggle('is-active',x===modeButton));paint();return;}const toggle=event.target.closest('[data-master-filter-toggle]');if(toggle){filterPanel.hidden=!filterPanel.hidden;return;}const spec=event.target.closest('[data-master-spec]');if(spec){specFilter=String(spec.dataset.masterSpec||'');filterPanel.querySelectorAll('[data-master-spec]').forEach(x=>x.classList.toggle('is-active',x===spec));filterPanel.hidden=true;paint();}},{signal:context.lifecycle?.signal});
    input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{search=String(input.value||'').trim();load();},260);},{signal:context.lifecycle?.signal});
    input?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();clearTimeout(timer);search=String(input.value||'').trim();load();}},{signal:context.lifecycle?.signal});
    const refreshFromRealtime=event=>{const type=String(event.detail?.event?.eventType||'');if(/^(master|sto|provider|serviceOffer|service)\./i.test(type))void load({force:true,reason:'realtime'});};
    const refreshOnResume=()=>{if(!document.hidden)void load({force:true,reason:'resume'});};
    window.addEventListener('kareta:realtime:event',refreshFromRealtime,{signal:context.lifecycle?.signal});
    document.addEventListener('visibilitychange',refreshOnResume,{signal:context.lifecycle?.signal});
    window.addEventListener('online',refreshOnResume,{signal:context.lifecycle?.signal});
    load();
  }


  window.KaretaMastersPages = Object.freeze({ renderMasters, mountMasters });
})();
