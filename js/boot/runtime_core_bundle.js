/* KARETA R188.5.5.6.84.85 GENERATED BOOT BUNDLE — source order preserved. */
window.KaretaBootProfiler?.bundleStart?.("runtime_core_bundle","js/boot/runtime_core_bundle.js");

/* SOURCE: js/next/pages/core.js */
(() => {
  'use strict';

  const HOME_REFERENCE_ACTIONS = Object.freeze([
    { title:'Услуги', route:'#/services', icon:'services' },
    { title:'СТО рядом', route:'#/masters?type=sto', icon:'location' },
    { title:'Запчасти', route:'#/parts', icon:'parts' },
    { title:'Запись', route:'#/orders/new', icon:'calendar' },
    { title:'Чаты', route:'#/chats', icon:'chats' },
    { title:'Мастера', route:'#/masters', icon:'master' }
  ]);



  const HOME_REFERENCE_POPULAR = Object.freeze([
    { title:'Замена масла', route:'#/services/category/maintenance', icon:'oil', image:'/assets/reference/automotive/oil_filters.png', price:'от 8 000 ₸' },
    { title:'Диагностика', route:'#/services/category/diagnostics', icon:'diagnostics', image:'/assets/reference/automotive/service_station.png', price:'от 5 000 ₸' },
    { title:'Шиномонтаж', route:'#/services/category/tires', icon:'tires', image:'/assets/services/home_hero_lift_r63a.png', price:'от 6 000 ₸' },
    { title:'Ремонт ходовой', route:'#/services', icon:'suspension', image:'/assets/reference/automotive/shock_absorber.png', price:'от 15 000 ₸' },
    { title:'Автоэлектрика', route:'#/services', icon:'services', image:'/assets/reference/automotive/service_station.png', price:'от 7 000 ₸' },
    { title:'Тормозная система', route:'#/services', icon:'diagnostics', image:'/assets/reference/automotive/shock_absorber.png', price:'от 9 000 ₸' },
    { title:'Кондиционер', route:'#/services', icon:'services', image:'/assets/services/home_hero_lift_r63a.png', price:'от 8 000 ₸' },
    { title:'Стартер и генератор', route:'#/services', icon:'diagnostics', image:'/assets/reference/automotive/oil_filters.png', price:'от 10 000 ₸' }
  ]);

  const HOME_PROMO_BANNERS = Object.freeze([
    { id:'diagnostics-25', badge:'−25%', title:'Компьютерная диагностика', provider:'KARETA Service', location:'ул. Казахстан, 68', field:false, price:'4 500 ₸', oldPrice:'6 000 ₸', slots:4, note:'Акция до конца недели', route:'#/services/category/diagnostics', image:'/media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png' },
    { id:'oil-20', badge:'−20%', title:'Замена масла и фильтра', provider:'Мастер Арман', location:'Выезд к клиенту до 20 км', field:true, price:'8 000 ₸', oldPrice:'10 000 ₸', slots:3, note:'Сегодня и завтра', route:'#/services/category/maintenance', image:'/assets/reference/automotive/oil_filters.png' },
    { id:'suspension-18', badge:'−18%', title:'Диагностика ходовой', provider:'СТО Восток', location:'пр. Абая, 112', field:false, price:'7 400 ₸', oldPrice:'9 000 ₸', slots:6, note:'Свободные окна на этой неделе', route:'#/services', image:'/assets/reference/automotive/shock_absorber.png' },
    { id:'tires-15', badge:'−15%', title:'Шиномонтаж комплектом', provider:'KARETA Partner', location:'Выезд к клиенту', field:true, price:'10 200 ₸', oldPrice:'12 000 ₸', slots:2, note:'Осталось мало мест', route:'#/services/category/tires', image:'/assets/services/home_hero_lift_r63a.png' }
  ]);

  function homePromoBanner(item,index){
    const locationIcon=homeRefIcon(item.field?'car':'location');
    return `<article class="k-home-promo-slide" data-home-promo-slide data-promo-index="${index}" style="--k-home-promo-image:url('${esc(item.image)}')">
      <div class="k-home-promo-slide__overlay"></div>
      <div class="k-home-promo-slide__content">
        <div class="k-home-promo-slide__top"><span class="k-home-promo-slide__badge">${esc(item.badge)}</span><span class="k-home-promo-slide__slots">${item.slots>0?`Осталось ${item.slots} мест`:'Мест нет'}</span></div>
        <div class="k-home-promo-slide__copy">
          <small class="k-home-promo-slide__provider">${esc(item.provider)}</small>
          <h2>${esc(item.title)}</h2>
          <div class="k-home-promo-slide__price"><strong>${esc(item.price)}</strong><s>${esc(item.oldPrice)}</s></div>
          <div class="k-home-promo-slide__meta"><span>${locationIcon}${esc(item.location)}</span><span>${homeRefIcon('calendar')}${esc(item.note)}</span></div>
          <button class="k-home-ref-cta k-home-promo-slide__cta" type="button" data-home-promo-book data-promo-id="${esc(item.id)}" data-promo-title="${esc(item.title)}" data-promo-price="${esc(item.price)}">Записаться</button>
        </div>
      </div>
    </article>`;
  }

  function homePromoCarousel(){
    return `<section class="k-home-ref-hero k-home-ref-hero--diagnostic k-home-promo" data-home-promo>
      <div class="k-home-promo__viewport" data-home-promo-viewport>
        <div class="k-home-promo__track">${HOME_PROMO_BANNERS.map(homePromoBanner).join('')}</div>
      </div>
      <div class="k-home-promo__controls">
        <div class="k-home-promo__dots" data-home-promo-dots>${HOME_PROMO_BANNERS.map((_,index)=>`<button type="button" data-home-promo-dot="${index}" class="${index===0?'is-active':''}" aria-label="Баннер ${index+1}"></button>`).join('')}</div>
        <span class="k-home-promo__counter" data-home-promo-counter>1 / ${HOME_PROMO_BANNERS.length}</span>
      </div>
    </section>`;
  }

  function bindHomePromo(root){
    if(!root)return()=>{};
    const viewport=root.querySelector('[data-home-promo-viewport]');
    const slides=[...root.querySelectorAll('[data-home-promo-slide]')];
    const dots=[...root.querySelectorAll('[data-home-promo-dot]')];
    const counter=root.querySelector('[data-home-promo-counter]');
    if(!viewport||slides.length<2)return()=>{};
    let index=0,timer=0,paused=false,down=false,startX=0,startScroll=0,moved=false,suppressClick=false;
    const setActive=next=>{
      index=(next+slides.length)%slides.length;
      const slide=slides[index];
      viewport.scrollTo({left:slide.offsetLeft,behavior:'smooth'});
      dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===index));
      if(counter)counter.textContent=`${index+1} / ${slides.length}`;
    };
    const nearest=()=>{
      const center=viewport.scrollLeft+viewport.clientWidth/2;
      let best=0,dist=Infinity;
      slides.forEach((slide,i)=>{const d=Math.abs((slide.offsetLeft+slide.offsetWidth/2)-center);if(d<dist){dist=d;best=i;}});
      index=best;
      dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===index));
      if(counter)counter.textContent=`${index+1} / ${slides.length}`;
    };
    const restart=()=>{clearInterval(timer);timer=setInterval(()=>{if(!paused&&!document.hidden)setActive(index+1);},5200);};
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>{setActive(i);restart();}));
    root.querySelectorAll('[data-home-promo-book]').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const promo={id:String(button.dataset.promoId||''),title:String(button.dataset.promoTitle||''),price:String(button.dataset.promoPrice||'')};
      const prefill={source:'home_promo',promotion:promo};
      try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify(prefill));}catch(_e){}
      location.hash='#/orders/new';
    }));
    const onScroll=()=>{clearTimeout(onScroll.t);onScroll.t=setTimeout(nearest,80);};
    const pointerDown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;down=true;moved=false;paused=true;startX=e.clientX;startScroll=viewport.scrollLeft;viewport.classList.add('is-dragging');try{viewport.setPointerCapture?.(e.pointerId);}catch(_e){}};
    const pointerMove=e=>{if(!down)return;const dx=e.clientX-startX;if(Math.abs(dx)>4)moved=true;if(moved){viewport.scrollLeft=startScroll-dx;e.preventDefault();}};
    const pointerUp=()=>{if(!down)return;down=false;viewport.classList.remove('is-dragging');if(moved){suppressClick=true;setTimeout(()=>{suppressClick=false;},80);}nearest();setTimeout(()=>{paused=false;restart();},350);};
    const click=event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}};
    viewport.addEventListener('scroll',onScroll,{passive:true});
    viewport.addEventListener('pointerdown',pointerDown);
    viewport.addEventListener('pointermove',pointerMove);
    viewport.addEventListener('pointerup',pointerUp);
    viewport.addEventListener('pointercancel',pointerUp);
    viewport.addEventListener('click',click,true);
    root.addEventListener('mouseenter',()=>{paused=true;});
    root.addEventListener('mouseleave',()=>{paused=false;restart();});
    restart();
    return()=>{clearInterval(timer);viewport.removeEventListener('scroll',onScroll);viewport.removeEventListener('pointerdown',pointerDown);viewport.removeEventListener('pointermove',pointerMove);viewport.removeEventListener('pointerup',pointerUp);viewport.removeEventListener('pointercancel',pointerUp);viewport.removeEventListener('click',click,true);};
  }

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function homeRefIcon(name){
    const aliases={chevron:'chevronRight',wheel:'tires',tow:'truck',engineCheck:'diagnostics'};
    return window.KaretaUIIcons?.svg?.(aliases[name]||name,{className:'k-home-ref-inline-svg'})||'';
  }

  function homeActionIcon(name){
    return window.KaretaUIIcons?.svg?.(name,{className:'k-home-ref-action-svg'})||'';
  }

  const HOME_HERO_MOBILE = '/media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png';

  function homeReferenceCardArt(){
    return `<div class="k-home-ref-hero-art" aria-hidden="true" data-home-hero-art data-hero-state="pending"><picture><img data-home-hero-image src="${HOME_HERO_MOBILE}" alt="" decoding="async" loading="eager" fetchpriority="high"></picture></div>`;
  }

  function mountHomeReferenceCardArt(){
    const art=document.querySelector('[data-home-hero-art]');
    const picture=art?.querySelector('picture');
    const image=art?.querySelector('[data-home-hero-image]');
    if(!art||!picture||!image)return()=>{};
    let fallbackTried=false;
    let disposed=false;
    const sourceLabel=()=>{
      const current=String(image.currentSrc||image.src||'');
      if(current.includes('desktop-ultrawide'))return 'desktopUltrawide';
      if(current.includes('desktop-standard'))return 'desktopStandard';
      if(current.includes('desktop-narrow'))return 'desktopNarrow';
      if(current.includes('kareta_create_request_vehicle_background'))return 'requestVehicle';
      if(current.includes('service-map-mobile'))return 'mobile';
      return 'unknown';
    };
    const markReady=()=>{
      if(disposed)return;
      art.classList.remove('is-image-missing');
      art.dataset.heroState='ready';
      art.dataset.heroSource=sourceLabel();
      art.dataset.heroUrl=String(image.currentSrc||image.src||'');
    };
    const markMissing=()=>{
      if(disposed)return;
      art.classList.add('is-image-missing');
      art.dataset.heroState='missing';
      art.dataset.heroSource='none';
      delete art.dataset.heroUrl;
    };
    const onError=()=>{
      if(disposed)return;
      if(!fallbackTried){
        fallbackTried=true;
        picture.querySelectorAll('source').forEach(source=>source.remove());
        art.dataset.heroFallback='mobile';
        art.dataset.heroState='fallback';
        image.src=HOME_HERO_MOBILE;
        return;
      }
      markMissing();
    };
    image.addEventListener('load',markReady);
    image.addEventListener('error',onError);
    if(image.complete){
      if(image.naturalWidth>0)markReady();
      else onError();
    }
    return()=>{disposed=true;image.removeEventListener('load',markReady);image.removeEventListener('error',onError);};
  }

  function homeNearbyCard(item){
    const type=String(item.type||'sto');
    const title=String(item.name||item.org_name||item.sto_name||'Исполнитель');
    const rating=Math.max(0,Math.min(5,Number(item.rating||0)));
    const address=String(item.address||item.service_address||item.city||'Адрес уточняется');
    const image=String(item.logo_url||item.avatar_url||'').trim();
    const route=`#/masters/profile/${type==='sto'?'sto':'master'}/${encodeURIComponent(item.id||'')}`;
    const initials=title.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'K';
    const imageHtml=image?`<img src="${esc(image)}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-placeholder')">`:`<span>${esc(initials)}</span>`;
    const distance=Number.isFinite(Number(item.distanceKm))?Number(item.distanceKm):null;
    const distanceText=distance===null?'':distance<1?`${Math.max(50,Math.round(distance*1000/50)*50)} м`:`${distance.toLocaleString('ru-RU',{minimumFractionDigits:distance<10?1:0,maximumFractionDigits:distance<10?1:0})} км`;
    const meta=distanceText||String(item.city||'');
    return `<a class="k-home-ref-place" href="${route}"><span class="k-home-ref-place__thumb ${image?'':'is-placeholder'}">${imageHtml}</span><span class="k-home-ref-place__copy"><span class="k-home-ref-place__title"><b>${esc(title)}</b><small>${homeRefIcon('star')}${rating?rating.toFixed(1):'—'}</small></span><span class="k-home-ref-place__meta">${esc(address)}</span><span class="k-home-ref-place__meta k-home-ref-place__distance">${esc(meta)}</span></span></a>`;
  }

  function homeDateLabel(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    const date=new Date(raw.includes('T')?raw:raw.replace(' ','T'));
    if(Number.isNaN(date.getTime()))return '';
    const now=new Date();
    const sameYear=date.getFullYear()===now.getFullYear();
    return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',...(sameYear?{}:{year:'numeric'})}).format(date);
  }

  function homeFeedImage(item){
    const media=Array.isArray(item.media)?item.media:[];
    const first=media.find(row=>String(row?.mediaType||row?.type||'photo')!=='document')||media[0]||{};
    return String(item.coverUrl||item.cover_url||item.image||item.image_url||item.avatar_url||first.fileUrl||first.url||'').trim();
  }

  function homeWorkCard(item){
    const id=String(item.id||'').trim();
    const title=String(item.title||item.serviceLabel||item.service_label||'Выполненная работа').trim();
    const author=String(item.masterName||item.master_name||item.stoName||item.sto_name||'Мастер KARETA').trim();
    const image=homeFeedImage(item);
    const date=homeDateLabel(item.publishedAt||item.published_at||item.createdAt||item.created_at);
    const route=id?`#/works/item/${encodeURIComponent(id)}`:'#/works';
    const imageHtml=image?`<img src="${esc(image)}" alt="${esc(title)}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-placeholder')">`:`<span class="k-home-feed-card__fallback">${homeRefIcon('car')}</span>`;
    return `<a class="k-home-feed-card" href="${route}"><span class="k-home-feed-card__media ${image?'':'is-placeholder'}">${imageHtml}<em>Работа</em></span><span class="k-home-feed-card__body"><b>${esc(title)}</b><small>${esc(author)}</small>${date?`<time>${esc(date)}</time>`:''}</span></a>`;
  }

  function homeCommunityCard(item){
    const title=String(item.title||item.kindLabel||item.kind_label||'Публикация').trim();
    const author=String(item.masterName||item.master_name||item.authorName||item.author_name||item.author||'KARETA.KZ').trim();
    const image=homeFeedImage(item);
    const date=homeDateLabel(item.publishedAt||item.published_at||item.createdAt||item.created_at);
    const masterId=String(item.masterId||item.master_id||'').trim();
    const isWall=String(item.__source||'')==='wall'||!!(item.entityKey||item.entity_key);
    const route=isWall&&masterId?`#/masters/profile/master/${encodeURIComponent(masterId)}?tab=wall`:'#/community';
    const kind=isWall?'Публикация':'Сообщество';
    const imageHtml=image?`<img src="${esc(image)}" alt="${esc(title)}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-placeholder')">`:`<span class="k-home-feed-card__fallback">${homeRefIcon('diagnostics')}</span>`;
    return `<a class="k-home-feed-card" href="${route}"><span class="k-home-feed-card__media ${image?'':'is-placeholder'}">${imageHtml}<em>${kind}</em></span><span class="k-home-feed-card__body"><b>${esc(title)}</b><small>${esc(author)}</small>${date?`<time>${esc(date)}</time>`:''}</span></a>`;
  }

  function homeFeedSkeleton(){
    return Array.from({length:4},()=>'<article class="k-home-feed-card k-home-feed-card--loading" aria-hidden="true"><span></span><i></i><i></i></article>').join('');
  }

  function bindHomeSlider(rail){
    if(!rail)return()=>{};
    let down=false,startX=0,startScroll=0,moved=false,suppressClick=false;
    const pointerDown=event=>{
      if(event.pointerType&&event.pointerType!=='mouse')return;
      if(event.button!==0)return;
      down=true;moved=false;startX=event.clientX;startScroll=rail.scrollLeft;
      rail.classList.add('is-dragging');
      try{rail.setPointerCapture?.(event.pointerId);}catch(_e){}
    };
    const pointerMove=event=>{
      if(!down)return;
      const dx=event.clientX-startX;
      if(Math.abs(dx)>4)moved=true;
      if(moved){rail.scrollLeft=startScroll-dx;event.preventDefault();}
    };
    const pointerUp=()=>{if(!down)return;down=false;rail.classList.remove('is-dragging');if(moved){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}};
    const click=event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}};
    const wheel=event=>{if(Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;const max=rail.scrollWidth-rail.clientWidth;if(max<=2)return;rail.scrollLeft+=event.deltaY;event.preventDefault();};
    rail.addEventListener('pointerdown',pointerDown);
    rail.addEventListener('pointermove',pointerMove);
    rail.addEventListener('pointerup',pointerUp);
    rail.addEventListener('pointercancel',pointerUp);
    rail.addEventListener('click',click,true);
    rail.addEventListener('wheel',wheel,{passive:false});
    return()=>{rail.removeEventListener('pointerdown',pointerDown);rail.removeEventListener('pointermove',pointerMove);rail.removeEventListener('pointerup',pointerUp);rail.removeEventListener('pointercancel',pointerUp);rail.removeEventListener('click',click,true);rail.removeEventListener('wheel',wheel);};
  }

  function homeInitialUser(context){
    return context?.state?.user||window.KaretaNext?.state?.user||{};
  }

  function homeFirstName(value){
    const text=String(value||'').trim();
    return text?text.split(/\s+/)[0]:'';
  }

  function homeInterfaceRole(context={}){
    const raw=window.KaretaNavigationCore?.interfaceRole?.()||context?.role||context?.state?.role||homeInitialUser(context)?.role||'';
    const role=String(raw||'').trim().toLowerCase();
    return role==='personal'?'client':role;
  }


  function homeGreeting(context){
    const user=homeInitialUser(context);
    const name=homeFirstName(user.name||user.fullname||user.displayName);
    return name?`Здравствуйте, ${esc(name)}!`:'Здравствуйте!';
  }

  function homeLocationDialog(){
    return `<dialog class="k-home-location-dialog" data-home-location-dialog aria-labelledby="k-home-location-title"><section class="k-home-location-panel"><header><div><small>МЕСТОПОЛОЖЕНИЕ</small><h2 id="k-home-location-title">Город и расстояние</h2><p>Выберите город или разрешите геопозицию — ближайшие сервисы пересчитаются автоматически.</p></div><button type="button" data-home-location-close aria-label="Закрыть">${homeRefIcon('close')}</button></header><button class="k-home-location-detect" type="button" data-home-location-detect>${homeRefIcon('location')}<span><b>Определить моё местоположение</b><small>Используем только для расчёта расстояния</small></span></button><div class="k-home-location-status" data-home-location-status hidden></div><div class="k-home-location-cities" data-home-location-cities></div></section></dialog>`;
  }

  function renderHome(context){
    return `<section class="k-page k-home-simple k-home-reference k-home-reference--app" data-page="home" data-kflow-screen="home">
      <button class="k-home-ref-location" type="button" data-home-location-button>${homeRefIcon('location')}<span data-home-city>Усть-Каменогорск</span><i>${homeRefIcon('chevron')}</i></button>
      <div class="k-home-ref-heading" aria-hidden="true"><h1 data-home-greeting>${homeGreeting(context)}</h1></div>
      <form class="k-home-ref-search" data-home-ai-form aria-label="Поиск услуги, мастера или СТО"><label class="k-home-ref-search__box">${homeRefIcon('search')}<input id="k-home-ai-problem" class="k-home-ref-search__input" type="text" autocomplete="off" placeholder="Найти услугу, мастера или СТО…"></label></form>
      ${homePromoCarousel()}
      <section class="k-home-ref-actions" aria-label="Быстрые действия">${HOME_REFERENCE_ACTIONS.map(item=>`<a class="k-home-ref-action" href="${item.route}"><span class="k-home-ref-action__icon">${homeActionIcon(item.icon)}</span><b>${item.title}</b></a>`).join('')}</section>
      <section class="k-home-ref-section" data-home-section="popular"><header class="k-home-ref-section__head"><h2>Популярные услуги</h2><a href="#/services">Все <span aria-hidden="true">${homeRefIcon('chevronRight')}</span></a></header><div class="k-home-ref-chips k-home-ref-service-grid">${HOME_REFERENCE_POPULAR.map(item=>`<a class="k-home-ref-chip k-home-ref-service-card" href="${item.route}"><span class="k-home-ref-service-card__media"><img src="${item.image}" alt="" loading="lazy" decoding="async"></span><span class="k-home-ref-service-card__copy"><span class="k-home-ref-service-card__title"><span class="k-ui-icon k-ui-icon--sm" data-icon="${item.icon}">${homeActionIcon(item.icon)}</span><b>${item.title}</b></span><small>${item.price}</small></span></a>`).join('')}</div></section>
      <section class="k-home-ref-section" data-home-section="nearby"><header class="k-home-ref-section__head"><h2>Рядом с вами</h2><a href="#/masters?type=sto">Все <span aria-hidden="true">${homeRefIcon('chevronRight')}</span></a></header><div class="k-home-ref-nearby" data-home-nearby><div class="k-home-ref-place k-home-ref-place--loading" aria-hidden="true"></div><div class="k-home-ref-place k-home-ref-place--loading" aria-hidden="true"></div></div></section>
      <section class="k-home-ref-section k-home-feed-section" data-home-feed-section="works"><header class="k-home-ref-section__head"><h2>Работы мастеров</h2><a href="#/works">Все <span aria-hidden="true">${homeRefIcon('chevronRight')}</span></a></header><div class="k-home-feed-rail" data-home-feed="works" aria-label="Последние работы мастеров">${homeFeedSkeleton()}</div></section>
      <section class="k-home-ref-section k-home-feed-section" data-home-feed-section="community"><header class="k-home-ref-section__head"><h2>Сообщество</h2><a href="#/community">Все <span aria-hidden="true">${homeRefIcon('chevronRight')}</span></a></header><div class="k-home-feed-rail" data-home-feed="community" aria-label="Последнее в сообществе">${homeFeedSkeleton()}</div></section>
      ${homeLocationDialog()}
    </section>`;
  }

  function mountHome(context = {}){
    const api=context.api||window.KaretaApiClient;
    const cabinetApi=window.KaretaClientCabinetApi;
    const form=document.querySelector('[data-home-ai-form]');
    const input=document.querySelector('#k-home-ai-problem');
    const greetingNode=document.querySelector('[data-home-greeting]');
    const cityNode=document.querySelector('[data-home-city]');
    const nearbyNode=document.querySelector('[data-home-nearby]');
    const locationButton=document.querySelector('[data-home-location-button]');
    const locationDialog=document.querySelector('[data-home-location-dialog]');
    const locationClose=document.querySelector('[data-home-location-close]');
    const locationDetect=document.querySelector('[data-home-location-detect]');
    const locationStatus=document.querySelector('[data-home-location-status]');
    const cityChoices=document.querySelector('[data-home-location-cities]');
    const worksRail=document.querySelector('[data-home-feed="works"]');
    const communityRail=document.querySelector('[data-home-feed="community"]');
    const promoRoot=document.querySelector('[data-home-promo]');
    const promoCleanup=bindHomePromo(promoRoot);
    if(!form||!input){promoCleanup?.();return()=>{};}

    let disposed=false;
    let catalog={masters:[],stos:[]};
    let selectedCity='Усть-Каменогорск';
    let userCoords=null;
    const storageKey='kareta.home.location.v1';
    const safeText=value=>String(value||'').trim();
    const normalizeCity=value=>safeText(value).toLocaleLowerCase('ru-RU');
    const haversine=(lat1,lng1,lat2,lng2)=>{const r=6371,toRad=x=>Number(x)*Math.PI/180;const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return 2*r*Math.asin(Math.sqrt(a));};
    const rowCoords=row=>{const lat=Number(row.service_lat??row.lat??row.latitude),lng=Number(row.service_lng??row.lng??row.longitude);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;};
    const readLocation=()=>{try{const v=JSON.parse(localStorage.getItem(storageKey)||'null');if(v&&typeof v==='object'){if(safeText(v.city))selectedCity=safeText(v.city);const lat=Number(v.lat),lng=Number(v.lng);if(Number.isFinite(lat)&&Number.isFinite(lng))userCoords={lat,lng};}}catch(_e){}};
    const saveLocation=()=>{try{localStorage.setItem(storageKey,JSON.stringify({city:selectedCity,lat:userCoords?.lat??null,lng:userCoords?.lng??null,updatedAt:Date.now()}));}catch(_e){}};
    readLocation();
    if(cityNode)cityNode.textContent=selectedCity;

    const submit=event=>{event.preventDefault();const value=input.value.trim();if(!value){location.hash='#/orders/new';return;}try{sessionStorage.setItem('kareta_assistant_problem',value);}catch(_e){}location.hash='#/assistant';};
    form.addEventListener('submit',submit);

    const applyProfile=data=>{if(disposed||!data)return;const user=data.user||data.profile||{};const name=homeFirstName(user.name||user.fullname||user.displayName);if(greetingNode)greetingNode.textContent=name?`Здравствуйте, ${name}!`:'Здравствуйте!';const profileCity=safeText(user.city)||safeText(user.location);if(profileCity&&!userCoords&&selectedCity==='Усть-Каменогорск'){selectedCity=profileCity;if(cityNode)cityNode.textContent=selectedCity;saveLocation();}};
    applyProfile({user:homeInitialUser(context)});

    const allRows=()=>[...(Array.isArray(catalog.stos)?catalog.stos:[]),...(Array.isArray(catalog.masters)?catalog.masters:[])];
    const renderNearby=()=>{if(!nearbyNode)return;const cityKey=normalizeCity(selectedCity);const seen=new Set();const rows=allRows().filter(row=>{const key=`${row.type||'sto'}:${row.id||''}`;if(seen.has(key))return false;seen.add(key);return true;}).map(row=>{const copy={...row};const coords=rowCoords(row);copy.distanceKm=userCoords&&coords?haversine(userCoords.lat,userCoords.lng,coords[0],coords[1]):null;copy.sameCity=!cityKey||normalizeCity(row.city)===cityKey;return copy;}).sort((a,b)=>{const ad=Number(a.distanceKm),bd=Number(b.distanceKm),af=Number.isFinite(ad),bf=Number.isFinite(bd);if(af!==bf)return af?-1:1;if(af&&bf&&ad!==bd)return ad-bd;if(a.sameCity!==b.sameCity)return a.sameCity?-1:1;return Number(b.rating||0)-Number(a.rating||0);}).slice(0,2);nearbyNode.innerHTML=rows.length?rows.map(homeNearbyCard).join(''):'<div class="k-home-ref-nearby-empty">Пока нет доступных исполнителей рядом.</div>';};
    const renderCities=()=>{if(!cityChoices)return;const cities=[selectedCity,...allRows().map(row=>safeText(row.city))].filter(Boolean).filter((city,index,arr)=>arr.findIndex(x=>normalizeCity(x)===normalizeCity(city))===index).sort((a,b)=>a.localeCompare(b,'ru'));cityChoices.innerHTML=cities.map(city=>`<button type="button" class="${normalizeCity(city)===normalizeCity(selectedCity)?'is-active':''}" data-home-city-value="${esc(city)}">${esc(city)}</button>`).join('')||'<span>Города появятся после загрузки каталога.</span>';};
    const setLocationStatus=(message,type='info')=>{if(!locationStatus)return;locationStatus.hidden=!message;locationStatus.textContent=message||'';locationStatus.dataset.type=type;};
    const openLocation=()=>{renderCities();setLocationStatus('');if(locationDialog&&!locationDialog.open)locationDialog.showModal?.();};
    const closeLocation=()=>{if(locationDialog?.open)locationDialog.close?.();};
    locationButton?.addEventListener('click',openLocation);
    locationClose?.addEventListener('click',closeLocation);
    locationDialog?.addEventListener('cancel',event=>{event.preventDefault();closeLocation();});
    cityChoices?.addEventListener('click',event=>{const button=event.target.closest('[data-home-city-value]');if(!button)return;selectedCity=safeText(button.dataset.homeCityValue)||selectedCity;userCoords=null;if(cityNode)cityNode.textContent=selectedCity;saveLocation();renderCities();renderNearby();closeLocation();});
    locationDetect?.addEventListener('click',()=>{if(!navigator.geolocation){setLocationStatus('Геолокация недоступна в этом браузере.','error');return;}locationDetect.disabled=true;setLocationStatus('Определяем местоположение…');navigator.geolocation.getCurrentPosition(position=>{userCoords={lat:Number(position.coords.latitude),lng:Number(position.coords.longitude)};saveLocation();setLocationStatus('Геопозиция определена. Расстояния пересчитаны.','success');renderNearby();locationDetect.disabled=false;window.setTimeout(closeLocation,500);},error=>{setLocationStatus(error?.code===1?'Доступ к геопозиции не разрешён. Выберите город вручную.':'Не удалось определить геопозицию. Выберите город вручную.','error');locationDetect.disabled=false;},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});});

    (async()=>{if(homeInterfaceRole(context)!=='client')return;try{if(cabinetApi?.get){const result=await cabinetApi.get();if(result?.ok)applyProfile(result.payload?.data||result.payload||{});}else if(api?.request){const result=await api.request('api/db.php?action=clientCabinet.get',{cacheTtlMs:15000,cacheKey:'client.cabinet.home'});if(result?.ok)applyProfile(result.payload?.data||result.payload||{});}}catch(_error){}})();
    (async()=>{if(!nearbyNode||!api?.request)return;try{const result=await api.request('api/db.php?action=masters.catalog',{cacheTtlMs:30000,cacheKey:'masters.catalog.home'});if(disposed)return;const payload=result?.payload?.data||result?.payload||{};catalog={stos:Array.isArray(payload.stos)?payload.stos:Array.isArray(payload.stations)?payload.stations:[],masters:Array.isArray(payload.masters)?payload.masters:[]};renderCities();renderNearby();}catch(_error){if(!disposed&&nearbyNode)nearbyNode.innerHTML='<div class="k-home-ref-nearby-empty">Не удалось загрузить ближайшие СТО. Откройте каталог исполнителей.</div>';}})();

    const feedCleanups=[bindHomeSlider(worksRail),bindHomeSlider(communityRail)];
    const renderFeedError=(rail,message)=>{if(rail)rail.innerHTML=`<div class="k-home-feed-empty">${esc(message)}</div>`;};
    (async()=>{if(!worksRail||!api?.getWorkPosts)return;try{const result=await api.getWorkPosts({limit:4},{signal:context.lifecycle?.signal});if(disposed)return;if(!result?.ok)throw new Error('work_feed_failed');const payload=result.payload?.data||result.payload||{};const rows=(Array.isArray(payload.items)?payload.items:Array.isArray(payload.posts)?payload.posts:Array.isArray(payload.works)?payload.works:[]).slice(0,4);worksRail.innerHTML=rows.length?rows.map(homeWorkCard).join(''):'<div class="k-home-feed-empty">Работы мастеров появятся после первых публикаций.</div>';}catch(_error){if(!disposed)renderFeedError(worksRail,'Не удалось загрузить последние работы.');}})();
    (async()=>{if(!communityRail||!api)return;try{const [newsResult,wallResult]=await Promise.allSettled([api.getNews?.({limit:4},{signal:context.lifecycle?.signal}),api.request?.('api/db.php?action=masterSocialWall.community&limit=4',{method:'GET',cacheTtlMs:12000,signal:context.lifecycle?.signal})]);if(disposed)return;const rows=[];if(newsResult.status==='fulfilled'&&newsResult.value?.ok){const payload=newsResult.value.payload?.data||newsResult.value.payload||{};(Array.isArray(payload.items)?payload.items:Array.isArray(payload.news)?payload.news:[]).forEach(item=>rows.push({...item,__source:'news'}));}if(wallResult.status==='fulfilled'&&wallResult.value?.ok){const payload=wallResult.value.payload?.data||wallResult.value.payload||{};(Array.isArray(payload.items)?payload.items:[]).forEach(item=>rows.push({...item,__source:'wall'}));}rows.sort((a,b)=>{const av=new Date(String(a.publishedAt||a.published_at||a.createdAt||a.created_at||0).replace(' ','T')).getTime()||0;const bv=new Date(String(b.publishedAt||b.published_at||b.createdAt||b.created_at||0).replace(' ','T')).getTime()||0;return bv-av;});const latest=rows.slice(0,4);communityRail.innerHTML=latest.length?latest.map(homeCommunityCard).join(''):'<div class="k-home-feed-empty">Новые публикации сообщества появятся здесь.</div>';}catch(_error){if(!disposed)renderFeedError(communityRail,'Не удалось загрузить публикации сообщества.');}})();

    return()=>{disposed=true;promoCleanup?.();form.removeEventListener('submit',submit);feedCleanups.forEach(fn=>fn?.());locationButton?.removeEventListener('click',openLocation);locationClose?.removeEventListener('click',closeLocation);};
  }

  window.KaretaCorePages = Object.freeze({ renderHome, mountHome });
})();
;

/* SOURCE: js/next/request_window.js */
(() => {
  'use strict';
  if(window.__KARETA_REQUEST_WINDOW__)return;
  window.__KARETA_REQUEST_WINDOW__={version:'R188.5.5.6.84.76',lazyRuntime:'R188.5.5.6.84.76'};

  const state={dialog:null,body:null,title:null,baseHash:'',targetHash:'#/orders/new',trigger:null,controller:null,loadController:null,loadToken:0,cleanups:[]};
  const currentRoute=()=>document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')||'';
  const matches=hash=>/^#\/orders\/new(?:\?.*)?$/.test(String(hash||'').trim());
  const setHashSilently=hash=>{try{history.replaceState(history.state,'',hash);}catch(_e){}};

  function cleanup(){
    try{state.loadController?.abort?.('request-window-close');}catch(_e){}
    try{state.controller?.abort?.('request-window-close');}catch(_e){}
    state.loadController=null;state.controller=null;
    state.cleanups.splice(0).reverse().forEach(fn=>{try{fn?.();}catch(error){console.warn('[KARETA request cleanup]',error);}});
  }
  function lifecycle(){
    const controller=new AbortController();state.controller=controller;
    return {signal:controller.signal,token:Date.now(),source:'request-window',isActive:()=>!controller.signal.aborted&&Boolean(state.dialog?.open),addCleanup(fn){if(typeof fn==='function')state.cleanups.push(fn);return fn;}};
  }
  function ensure(){
    if(state.dialog?.isConnected)return state.dialog;
    const dialog=document.createElement('dialog');dialog.className='k-request-window-r78';dialog.setAttribute('data-kareta-request-window','');
    dialog.innerHTML='<div class="k-request-window-surface"><div class="k-request-window-body" data-request-window-body></div></div>';
    document.body.appendChild(dialog);state.dialog=dialog;state.body=dialog.querySelector('[data-request-window-body]');state.title=null;
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-request-window-close]'))close();});
    return dialog;
  }
  function context(root){return {state:window.KaretaNext?.state||{},api:window.KaretaNext?.api||window.KaretaApiClient,lifecycle:lifecycle(),appVersion:String(window.KARETA_NEXT_ASSET_VERSION||''),route:{path:state.targetHash},root,windowMode:true};}
  function errorHtml(error){
    const message=String(error?.message||error||'Не удалось загрузить модуль заявки').replace(/[<>&]/g,'');
    return `<section class="k-entity-window__error"><h3>Не удалось открыть заявку</h3><p>${message}</p><button class="k-btn k-btn-primary" type="button" data-request-window-retry>Повторить</button><button class="k-btn k-btn-secondary" type="button" data-request-window-close>Закрыть</button></section>`;
  }
  function mountLoaded(token){
    if(token!==state.loadToken||!state.dialog?.open)return false;
    const pages=window.KaretaRequestPages;
    if(!pages?.renderRequestWindow||!pages?.mountRequest)throw new Error('request_pages_unavailable_after_lazy_load');
    state.body.innerHTML=pages.renderRequestWindow({state:window.KaretaNext?.state||{},windowMode:true})||'';
    const ctx=context(state.body);const result=pages.mountRequest(ctx);if(typeof result==='function')state.cleanups.push(result);
    requestAnimationFrame(()=>state.body.querySelector('button,input,[tabindex]')?.focus?.({preventScroll:true}));
    window.dispatchEvent(new CustomEvent('kareta:request-window-open',{detail:{targetHash:state.targetHash,baseHash:state.baseHash,lazy:true}}));
    return true;
  }
  async function loadAndMount(token){
    if(window.KaretaRequestPages?.renderRequestWindow&&window.KaretaRequestPages?.mountRequest)return mountLoaded(token);
    const loader=window.KaretaRouteAssetLoader;if(!loader?.ensureRoute)throw new Error('request_route_loader_unavailable');
    const controller=new AbortController();state.loadController=controller;
    try{await loader.ensureRoute('requestNew',{signal:controller.signal});}
    finally{if(state.loadController===controller)state.loadController=null;}
    return mountLoaded(token);
  }
  function startLoad(token){
    state.body.innerHTML='<section class="k-entity-window__loading"><span></span><h3>Готовим заявку…</h3><p>Загружаем только модуль оформления заявки.</p></section>';
    loadAndMount(token).catch(error=>{
      if(error?.name==='AbortError'||token!==state.loadToken||!state.dialog?.open)return;
      console.error('[KARETA request window lazy]',error);state.body.innerHTML=errorHtml(error);
      try{window.KaretaRuntimeLog?.add?.('request.window.lazy.failed',{message:String(error?.message||error)},'error');}catch(_e){}
    });
  }
  function open(hash='#/orders/new',{trigger=null}={}){
    const target=matches(hash)?String(hash):'#/orders/new';
    const dialog=ensure();if(!dialog.open)state.baseHash=String(location.hash||'#/home');if(trigger)state.trigger=trigger;
    cleanup();state.loadToken+=1;const token=state.loadToken;state.targetHash=target;setHashSilently(target);
    if(!dialog.open)dialog.showModal();document.documentElement.classList.add('k-request-window-open');startLoad(token);return true;
  }
  function close({restore=true}={}){
    if(!state.dialog)return false;const base=state.baseHash;state.loadToken+=1;cleanup();if(state.dialog.open){try{state.dialog.close();}catch(_e){}}document.documentElement.classList.remove('k-request-window-open');state.baseHash='';state.targetHash='#/orders/new';if(restore&&base)setHashSilently(base);const trigger=state.trigger;state.trigger=null;try{trigger?.focus?.({preventScroll:true});}catch(_e){}window.dispatchEvent(new CustomEvent('kareta:request-window-close',{detail:{baseHash:base}}));return true;
  }
  function handleClick(event){
    const retry=event.target.closest?.('[data-request-window-retry]');if(retry&&state.dialog?.open){event.preventDefault();cleanup();state.loadToken+=1;startLoad(state.loadToken);return;}
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest('a[href^="#/orders/new"]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;const target=String(link.getAttribute('href')||'#/orders/new');if(!matches(target))return;if(currentRoute()==='requestNew'&&!state.dialog?.open)return;event.preventDefault();event.stopImmediatePropagation();open(target,{trigger:link});
  }
  document.addEventListener('click',handleClick,true);
  window.addEventListener('hashchange',()=>{if(state.dialog?.open&&!matches(location.hash))close({restore:false});});
  window.KaretaRequestWindow=Object.freeze({open,close,isOpen:()=>Boolean(state.dialog?.open),matches,snapshot:()=>({open:Boolean(state.dialog?.open),baseHash:state.baseHash,targetHash:state.targetHash,lazyPending:Boolean(state.loadController)})});
})();
;

/* SOURCE: js/next/client/client_cabinet_api.js */
(() => {
  'use strict';
  const api = window.KaretaApiClient;
  if (!api) throw new Error('KaretaApiClient is required before client_cabinet_api.js');
  const get = (options={}) => api.request('api/db.php?action=clientCabinet.get',{cacheTtlMs:15000,cacheKey:'client.cabinet',...options});
  const post = payload => api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const saveProfile = payload => post({action:'profile.updateMine',...payload});
  const savePreferences = payload => post({action:'clientPreferences.save',...payload});
  const firstEntryCurrent = (options={}) => api.request('api/db.php?action=clientFirstEntry.current',{cacheTtlMs:0,cacheKey:'client.first-entry',...options});
  const saveFirstEntryDraft = payload => post({action:'clientFirstEntry.saveDraft',...payload});
  const dismissFirstEntry = payload => post({action:'clientFirstEntry.dismiss',...payload});
  const saveVehicle = vehicle => post({action:'vehicles.upsert',vehicle});
  const setDefaultVehicle = id => post({action:'vehicles.setDefault',id});
  const archiveVehicle = id => post({action:'vehicles.delete',id});
  const restoreVehicle = id => post({action:'vehicles.restore',id});
  const saveMaintenance = payload => post({action:'clientMaintenance.save',...payload});
  const saveExpense = payload => post({action:'clientExpense.save',...payload});
  const saveWarranty = payload => post({action:'clientWarranty.save',...payload});
  const saveDocument = payload => post({action:'clientDocument.save',...payload});
  const deleteDocument = id => post({action:'clientDocument.delete',id});
  window.KaretaClientCabinetApi = Object.freeze({get,saveProfile,savePreferences,firstEntryCurrent,saveFirstEntryDraft,dismissFirstEntry,saveVehicle,setDefaultVehicle,archiveVehicle,restoreVehicle,saveMaintenance,saveExpense,saveWarranty,saveDocument,deleteDocument});
})();
;

/* SOURCE: js/next/client/first_vehicle_flow.js */
(() => {
  'use strict';

  const api=window.KaretaClientCabinetApi;
  if(!api) throw new Error('KaretaClientCabinetApi is required before first_vehicle_flow.js');

  const RELEASE='first-vehicle-v4-visual-picker';
  const BODY_TYPES=Object.freeze([
    {id:'sedan',label:'Седан',icon:'sedan'},
    {id:'suv',label:'Кроссовер',icon:'suv'},
    {id:'hatchback',label:'Хэтчбек',icon:'hatch'},
    {id:'wagon',label:'Универсал',icon:'wagon'},
    {id:'coupe',label:'Купе',icon:'coupe'},
    {id:'minivan',label:'Минивэн',icon:'van'},
    {id:'pickup',label:'Пикап',icon:'pickup'},
    {id:'other',label:'Другой',icon:'car'}
  ]);
  const PENDING_KEY='kareta.firstVehicle.pendingIntro.v1';
  const DRAFT_PREFIX='kareta.firstVehicle.draft.v1:';
  const EDIT_DRAFT_PREFIX='kareta.vehicle.edit.draft.v1:';
  const PROMPT_PREFIX='kareta.firstVehicle.prompt.v1:';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeText=value=>String(value??'').trim().replace(/\s+/g,' ');
  const normalizeVin=value=>String(value??'').toUpperCase().replace(/\s+/g,'').replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17);
  const normalizePlate=value=>String(value??'').toUpperCase().replace(/\s+/g,' ').trimStart().slice(0,24);
  const currentYear=()=>new Date().getFullYear();

  const CATALOG=Object.freeze([
    {id:'toyota',name:'Toyota',popular:true,models:[
      {id:'camry',name:'Camry',generations:[['XV30',2001,2006],['XV40',2006,2011],['XV50',2011,2018],['XV70',2017,2024],['XV80',2024,2030]]},
      {id:'corolla',name:'Corolla'}, {id:'rav4',name:'RAV4'}, {id:'land-cruiser',name:'Land Cruiser'}, {id:'prado',name:'Land Cruiser Prado'}, {id:'highlander',name:'Highlander'}, {id:'hilux',name:'Hilux'}]},
    {id:'lexus',name:'Lexus',popular:true,models:[{id:'rx',name:'RX'},{id:'lx',name:'LX'},{id:'gx',name:'GX'},{id:'es',name:'ES'},{id:'nx',name:'NX'},{id:'is',name:'IS'}]},
    {id:'hyundai',name:'Hyundai',popular:true,models:[{id:'accent',name:'Accent'},{id:'elantra',name:'Elantra'},{id:'sonata',name:'Sonata'},{id:'tucson',name:'Tucson'},{id:'santa-fe',name:'Santa Fe'},{id:'palisade',name:'Palisade'}]},
    {id:'kia',name:'Kia',popular:true,models:[{id:'rio',name:'Rio'},{id:'cerato',name:'Cerato'},{id:'k5',name:'K5'},{id:'sportage',name:'Sportage'},{id:'sorento',name:'Sorento'},{id:'carnival',name:'Carnival'}]},
    {id:'chevrolet',name:'Chevrolet',popular:true,models:[{id:'cobalt',name:'Cobalt'},{id:'nexia',name:'Nexia'},{id:'malibu',name:'Malibu'},{id:'tracker',name:'Tracker'},{id:'captiva',name:'Captiva'},{id:'tahoe',name:'Tahoe'}]},
    {id:'lada',name:'LADA',popular:true,models:[{id:'granta',name:'Granta'},{id:'vesta',name:'Vesta'},{id:'niva',name:'Niva'},{id:'largus',name:'Largus'},{id:'priora',name:'Priora'},{id:'kalina',name:'Kalina'}]},
    {id:'volkswagen',name:'Volkswagen',popular:true,models:[{id:'polo',name:'Polo'},{id:'passat',name:'Passat'},{id:'tiguan',name:'Tiguan'},{id:'touareg',name:'Touareg'},{id:'golf',name:'Golf'},{id:'jetta',name:'Jetta'}]},
    {id:'nissan',name:'Nissan',popular:true,models:[{id:'qashqai',name:'Qashqai'},{id:'x-trail',name:'X-Trail'},{id:'murano',name:'Murano'},{id:'patrol',name:'Patrol'},{id:'teana',name:'Teana'},{id:'almera',name:'Almera'}]},
    {id:'honda',name:'Honda',models:[{id:'cr-v',name:'CR-V'},{id:'accord',name:'Accord'},{id:'civic',name:'Civic'},{id:'pilot',name:'Pilot'},{id:'fit',name:'Fit'}]},
    {id:'mazda',name:'Mazda',models:[{id:'3',name:'3'},{id:'6',name:'6'},{id:'cx-5',name:'CX-5'},{id:'cx-7',name:'CX-7'},{id:'cx-9',name:'CX-9'}]},
    {id:'mitsubishi',name:'Mitsubishi',models:[{id:'outlander',name:'Outlander'},{id:'pajero',name:'Pajero'},{id:'pajero-sport',name:'Pajero Sport'},{id:'lancer',name:'Lancer'},{id:'asx',name:'ASX'}]},
    {id:'subaru',name:'Subaru',models:[{id:'forester',name:'Forester'},{id:'outback',name:'Outback'},{id:'legacy',name:'Legacy'},{id:'impreza',name:'Impreza'},{id:'xv',name:'XV'}]},
    {id:'renault',name:'Renault',models:[{id:'logan',name:'Logan'},{id:'duster',name:'Duster'},{id:'sandero',name:'Sandero'},{id:'kaptur',name:'Kaptur'},{id:'koleos',name:'Koleos'}]},
    {id:'skoda',name:'Škoda',models:[{id:'octavia',name:'Octavia'},{id:'rapid',name:'Rapid'},{id:'kodiaq',name:'Kodiaq'},{id:'superb',name:'Superb'},{id:'karoc',name:'Karoq'}]},
    {id:'ford',name:'Ford',models:[{id:'focus',name:'Focus'},{id:'mondeo',name:'Mondeo'},{id:'kuga',name:'Kuga'},{id:'explorer',name:'Explorer'},{id:'transit',name:'Transit'}]},
    {id:'mercedes-benz',name:'Mercedes-Benz',models:[{id:'c-class',name:'C-Class'},{id:'e-class',name:'E-Class'},{id:'s-class',name:'S-Class'},{id:'gle',name:'GLE'},{id:'glc',name:'GLC'},{id:'g-class',name:'G-Class'}]},
    {id:'bmw',name:'BMW',models:[{id:'3-series',name:'3 Series'},{id:'5-series',name:'5 Series'},{id:'7-series',name:'7 Series'},{id:'x3',name:'X3'},{id:'x5',name:'X5'},{id:'x6',name:'X6'}]},
    {id:'audi',name:'Audi',models:[{id:'a4',name:'A4'},{id:'a6',name:'A6'},{id:'a8',name:'A8'},{id:'q5',name:'Q5'},{id:'q7',name:'Q7'},{id:'q8',name:'Q8'}]},
    {id:'geely',name:'Geely',models:[{id:'coolray',name:'Coolray'},{id:'atlas',name:'Atlas'},{id:'tugella',name:'Tugella'},{id:'emgrand',name:'Emgrand'}]},
    {id:'chery',name:'Chery',models:[{id:'tiggo-4',name:'Tiggo 4'},{id:'tiggo-7',name:'Tiggo 7'},{id:'tiggo-8',name:'Tiggo 8'},{id:'arrizo-8',name:'Arrizo 8'}]},
    {id:'haval',name:'Haval',models:[{id:'jolion',name:'Jolion'},{id:'f7',name:'F7'},{id:'dargo',name:'Dargo'},{id:'h9',name:'H9'}]},
    {id:'jac',name:'JAC',models:[{id:'s3',name:'S3'},{id:'s5',name:'S5'},{id:'js4',name:'JS4'},{id:'js6',name:'JS6'},{id:'t8',name:'T8'}]},
    {id:'byd',name:'BYD',models:[{id:'song-plus',name:'Song Plus'},{id:'han',name:'Han'},{id:'seal',name:'Seal'},{id:'atto-3',name:'Atto 3'}]},
    {id:'suzuki',name:'Suzuki',models:[{id:'vitara',name:'Vitara'},{id:'grand-vitara',name:'Grand Vitara'},{id:'sx4',name:'SX4'},{id:'jimny',name:'Jimny'}]},
    {id:'peugeot',name:'Peugeot',models:[{id:'206',name:'206'},{id:'307',name:'307'},{id:'308',name:'308'},{id:'408',name:'408'},{id:'3008',name:'3008'}]},
    {id:'opel',name:'Opel',models:[{id:'astra',name:'Astra'},{id:'vectra',name:'Vectra'},{id:'zafira',name:'Zafira'},{id:'insignia',name:'Insignia'}]},
    {id:'land-rover',name:'Land Rover',models:[{id:'range-rover',name:'Range Rover'},{id:'range-rover-sport',name:'Range Rover Sport'},{id:'discovery',name:'Discovery'},{id:'defender',name:'Defender'}]},
    {id:'range-rover',name:'Range Rover',models:[{id:'range-rover',name:'Range Rover'},{id:'sport',name:'Sport'},{id:'evoque',name:'Evoque'},{id:'velar',name:'Velar'}]},
    {id:'volvo',name:'Volvo',models:[{id:'xc40',name:'XC40'},{id:'xc60',name:'XC60'},{id:'xc90',name:'XC90'},{id:'s60',name:'S60'},{id:'s90',name:'S90'}]},
    {id:'tesla',name:'Tesla',models:[{id:'model-3',name:'Model 3'},{id:'model-y',name:'Model Y'},{id:'model-s',name:'Model S'},{id:'model-x',name:'Model X'}]},
    {id:'porsche',name:'Porsche',models:[{id:'cayenne',name:'Cayenne'},{id:'macan',name:'Macan'},{id:'panamera',name:'Panamera'},{id:'911',name:'911'}]},
    {id:'jeep',name:'Jeep',models:[{id:'grand-cherokee',name:'Grand Cherokee'},{id:'wrangler',name:'Wrangler'},{id:'compass',name:'Compass'}]},
    {id:'infiniti',name:'Infiniti',models:[{id:'qx50',name:'QX50'},{id:'qx60',name:'QX60'},{id:'qx80',name:'QX80'},{id:'q50',name:'Q50'}]},
    {id:'jaguar',name:'Jaguar',models:[{id:'f-pace',name:'F-Pace'},{id:'e-pace',name:'E-Pace'},{id:'xe',name:'XE'},{id:'xf',name:'XF'}]},
    {id:'cadillac',name:'Cadillac',models:[{id:'escalade',name:'Escalade'},{id:'xt5',name:'XT5'},{id:'xt6',name:'XT6'}]},
    {id:'mini',name:'MINI',models:[{id:'cooper',name:'Cooper'},{id:'countryman',name:'Countryman'},{id:'clubman',name:'Clubman'}]},
    {id:'citroen',name:'Citroen',models:[{id:'c3',name:'C3'},{id:'c4',name:'C4'},{id:'c5-aircross',name:'C5 Aircross'}]},
    {id:'fiat',name:'Fiat',models:[{id:'500',name:'500'},{id:'doblo',name:'Doblo'},{id:'ducato',name:'Ducato'}]},
    {id:'gaz',name:'ГАЗ',models:[{id:'gazelle',name:'Газель'},{id:'sobol',name:'Соболь'},{id:'volga',name:'Волга'}]},
    {id:'uaz',name:'УАЗ',models:[{id:'patriot',name:'Patriot'},{id:'hunter',name:'Hunter'},{id:'profi',name:'Profi'}]}
  ]);

  const state={root:null,sourceRoot:null,data:null,step:0,success:null,onReturn:null,mode:'manual',saving:false,autoScheduled:false,editVehicleId:'',editLegacyBrandName:'',serverRevision:0,serverStatus:'',serverUpdatedAt:0,serverLoaded:false,serverSaving:false,serverSavePending:false,serverSaveTimer:0,serverConflict:false,serverDraftSignature:'',serverBackoffUntil:0};

  function identity(){return window.KaretaIdentity?.snapshot?.()||{};}
  function scopeKey(detail={}){
    const snap=detail.identity||identity();
    const user=detail.user||window.KaretaNext?.state?.user||{};
    const raw=snap.person?.id||snap.account?.id||snap.context?.personId||snap.context?.accountId||user.id||user.phone||'client';
    return String(raw).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)||'client';
  }
  const draftKey=()=>state.editVehicleId?`${EDIT_DRAFT_PREFIX}${scopeKey()}:${state.editVehicleId}`:DRAFT_PREFIX+scopeKey();
  const promptKey=()=>PROMPT_PREFIX+scopeKey();
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_e){return null}}
  function readDraft(){return {...defaultDraft(),...(readJson(draftKey())||{})};}
  function defaultDraft(){return {step:2,brandId:'',brandName:'',modelId:'',modelName:'',customModelName:'',year:'',generation:'',bodyType:'',vin:'',plateNumber:'',engineVolume:'',fuelType:'',engine:'',mileage:'',isDefault:false,serverRevision:0};}
  function draftSignature(draft={}){const stable={...draft};delete stable.updatedAt;delete stable.serverRevision;return JSON.stringify(stable);}
  function writeDraft(patch={}){const next={...readDraft(),...patch,serverRevision:state.serverRevision,updatedAt:Date.now()};try{localStorage.setItem(draftKey(),JSON.stringify(next));}catch(_e){}if(!state.editVehicleId)scheduleServerDraft();return next;}
  function clearDraft(){try{localStorage.removeItem(draftKey());}catch(_e){}}
  function markPrompt(value){try{localStorage.setItem(promptKey(),String(value));}catch(_e){}}
  function promptStatus(){try{return localStorage.getItem(promptKey())||'';}catch(_e){return''}}
  function setPendingIntro(){try{sessionStorage.setItem(PENDING_KEY,scopeKey());}catch(_e){}}
  function consumePendingIntro(){try{const value=sessionStorage.getItem(PENDING_KEY);if(!value||value!==scopeKey())return false;sessionStorage.removeItem(PENDING_KEY);return true;}catch(_e){return false}}

  function serverPayload(result){return result?.payload?.data||result?.data||null;}
  function serverTime(value){const t=Date.parse(String(value||''));return Number.isFinite(t)?t:0;}
  function applyServerState(data={},options={}){
    state.serverLoaded=true;state.serverRevision=Math.max(0,Number(data.revision||0)||0);state.serverStatus=String(data.status||'');state.serverUpdatedAt=serverTime(data.updatedAt);state.serverConflict=false;
    if(state.serverStatus==='completed')markPrompt('completed');else if(state.serverStatus==='dismissed')markPrompt('dismissed');
    if(options.restoreDraft!==false&&!state.editVehicleId&&data.draft&&typeof data.draft==='object'&&Object.keys(data.draft).length){
      const local=readJson(draftKey()),localBaseRevision=Math.max(0,Number(local?.serverRevision||0)||0);
      if(!local||state.serverRevision>localBaseRevision){const restored={...defaultDraft(),...data.draft,serverRevision:state.serverRevision,updatedAt:Date.now()};try{localStorage.setItem(draftKey(),JSON.stringify(restored));}catch(_e){}}
    }
    return data;
  }
  async function loadServerFirstEntry(options={}){
    if(typeof api.firstEntryCurrent!=='function')return null;
    try{const result=await api.firstEntryCurrent({force:true,dedupe:false,...options});if(result?.ok){return applyServerState(serverPayload(result)||{});}return null;}catch(_e){return null;}
  }
  function scheduleServerDraft(delay=1400){
    if(state.editVehicleId||typeof api.saveFirstEntryDraft!=='function')return;
    state.serverSavePending=true;if(state.serverSaveTimer)clearTimeout(state.serverSaveTimer);
    const backoff=Math.max(0,state.serverBackoffUntil-Date.now());
    state.serverSaveTimer=setTimeout(()=>{state.serverSaveTimer=0;flushServerDraft();},Math.max(delay,backoff));
  }
  async function flushServerDraft(){
    if(state.editVehicleId||typeof api.saveFirstEntryDraft!=='function')return false;
    if(Date.now()<state.serverBackoffUntil){scheduleServerDraft(state.serverBackoffUntil-Date.now());return false;}
    if(state.serverSaving){state.serverSavePending=true;return false;}
    const draft=readDraft(),signature=draftSignature(draft);
    if(signature===state.serverDraftSignature){state.serverSavePending=false;return true;}
    state.serverSaving=true;state.serverSavePending=false;
    try{
      const result=await api.saveFirstEntryDraft({expectedRevision:state.serverRevision,currentStep:Math.max(1,Math.min(3,Number(draft.step||state.step||2)||2)),draft});
      const data=serverPayload(result);
      if(result?.ok&&data){applyServerState(data,{restoreDraft:false});state.serverDraftSignature=signature;state.serverBackoffUntil=0;return true;}
      if(Number(result?.status||result?.payload?.meta?.httpStatus||0)===429){state.serverBackoffUntil=Date.now()+Math.max(5000,Number(result?.retryAfter||0)*1000);state.serverSavePending=true;return false;}
      if(result?.payload?.error==='revision_conflict'&&data){applyServerState(data,{restoreDraft:false});state.serverConflict=true;state.serverSavePending=true;return false;}
      return false;
    }catch(_e){return false;}finally{state.serverSaving=false;if(state.serverSavePending)scheduleServerDraft(Math.max(1800,state.serverBackoffUntil-Date.now()));}
  }
  async function dismissServerFirstEntry(){
    if(typeof api.dismissFirstEntry!=='function')return false;
    try{
      const result=await api.dismissFirstEntry({});
      const data=serverPayload(result);
      if(result?.ok&&data){applyServerState(data,{restoreDraft:false});return true;}
    }catch(_e){}
    return false;
  }

  function currentRole(detail={}){
    const snap=detail.identity||identity();
    const explicit=detail?.result?.selectedRole||detail?.result?.entryRole||detail.user?.entry_role||detail.user?.role||'';
    if(explicit)return String(explicit).toLowerCase();
    if(snap?.authenticated)return String(snap.compatibilityRole||'').toLowerCase();
    return String(window.KaretaNavigationCore?.interfaceRole?.()||window.KaretaRoleAccess?.currentRole?.()||'').toLowerCase();
  }
  function clientContextReady(detail={}){
    const snap=detail.identity||identity();
    if(!snap?.authenticated)return currentRole(detail)==='client';
    return currentRole(detail)==='client'&&String(snap.context?.type||'').toLowerCase()==='personal';
  }
  async function maybeScheduleFirstEntry(detail={}){
    if(state.autoScheduled||!clientContextReady(detail))return false;
    state.autoScheduled=true;
    const server=await loadServerFirstEntry();
    if(server){
      if(server.hasVehicles||server.status==='completed'){markPrompt('completed');state.autoScheduled=false;return false;}
      if(server.status==='dismissed'){markPrompt('dismissed');state.autoScheduled=false;return false;}
    }else if(promptStatus()){state.autoScheduled=false;return false;}
    let result;
    try{result=await api.get({cacheTtlMs:0,force:true,dedupe:false});}catch(_e){state.autoScheduled=false;return false;}
    if(!result?.ok){state.autoScheduled=false;return false;}
    const payload=result.payload?.data||result.payload||{},vehicles=payload.vehicles||[],archived=payload.archivedVehicles||[];
    if(payload.firstEntry&&typeof payload.firstEntry==='object')applyServerState(payload.firstEntry);
    if(vehicles.length||archived.length){markPrompt('completed');state.autoScheduled=false;return false;}
    if(state.serverStatus==='dismissed'){markPrompt('dismissed');state.autoScheduled=false;return false;}
    setPendingIntro();
    window.setTimeout(()=>{
      if(!clientContextReady()){state.autoScheduled=false;return;}
      if(window.KaretaRouteRuntime?.navigate)window.KaretaRouteRuntime.navigate('cabinetGarage',{source:'first-vehicle-entry',force:true});
      else location.hash='#/cabinet/garage';
    },260);
    return true;
  }

  function brandByName(name){const needle=normalizeText(name).toLocaleLowerCase('ru-RU');return CATALOG.find(x=>x.name.toLocaleLowerCase('ru-RU')===needle)||null;}
  function vehicleToDraft(vehicle={}){
    const brand=brandByName(vehicle.brand||''),model=brand?modelByName(brand,vehicle.model||''):null;
    const legacyBrand=Boolean(!brand&&normalizeText(vehicle.brand)),custom=Boolean(brand&&vehicle.model&&!model);
    const fuel=normalizeText(vehicle.fuel_type??vehicle.fuelType??'');
    const volume=normalizeText(vehicle.engine_volume??vehicle.engineVolume??'');
    return {...defaultDraft(),step:2,brandId:legacyBrand?'legacy-edit':(brand?.id||''),brandName:brand?.name||normalizeText(vehicle.brand),modelId:legacyBrand?'legacy-edit':(custom?'custom':(model?.id||'')),modelName:legacyBrand?normalizeText(vehicle.model):(model?.name||''),customModelName:custom?normalizeText(vehicle.model):'',year:String(vehicle.year_label??vehicle.year??''),generation:normalizeText(vehicle.generation),bodyType:normalizeText(vehicle.body_type??vehicle.bodyType??''),vin:normalizeVin(vehicle.vin),plateNumber:normalizePlate(vehicle.plate),engineVolume:volume,fuelType:fuel,engine:[volume,fuel].filter(Boolean).join(' '),mileage:String(Math.max(0,Number(vehicle.mileage_km??vehicle.mileageKm??0)||0)),isDefault:Boolean(Number(vehicle.is_default??vehicle.isDefault??0))};
  }
  function brandById(id){return CATALOG.find(x=>x.id===id)||null;}
  function isLegacyEditBrand(draft){return Boolean(state.editVehicleId&&state.editLegacyBrandName&&draft.brandId==='legacy-edit'&&normalizeText(draft.brandName).toLocaleLowerCase('ru-RU')===state.editLegacyBrandName.toLocaleLowerCase('ru-RU'));}
  function modelByName(brand,name){const needle=normalizeText(name).toLocaleLowerCase('ru-RU');return brand?.models?.find(x=>x.name.toLocaleLowerCase('ru-RU')===needle)||null;}
  function generationOptions(draft){
    const brand=brandById(draft.brandId),model=brand?.models?.find(x=>x.id===draft.modelId);
    const year=Number(draft.year||0);
    const rows=(model?.generations||[]).filter(item=>!year||(year>=item[1]&&year<=item[2])).map(item=>item[0]);
    return [...new Set(rows)];
  }
  function finalModel(draft){return draft.modelId==='custom'?normalizeText(draft.customModelName):normalizeText(draft.modelName);}
  function vehicleTitle(draft){return [normalizeText(draft.brandName),finalModel(draft)].filter(Boolean).join(' ')||'Автомобиль';}

  function carIcon(){return '<svg viewBox="0 0 96 64" aria-hidden="true"><path d="M18 39 24 23c2-5 6-8 12-8h24c6 0 10 3 12 8l6 16"/><path d="M12 39h72v12a5 5 0 0 1-5 5h-5v-7H22v7h-5a5 5 0 0 1-5-5V39Z"/><path d="M26 39h44M25 46h8M63 46h8"/><circle cx="29" cy="46" r="2"/><circle cx="67" cy="46" r="2"/></svg>';}
  function successIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/></svg>';}
  function steps(active){const rows=[1,2,3];return `<div class="kmo-stepper k-first-vehicle-steps" aria-label="Прогресс добавления автомобиля">${rows.map((n,index)=>`${index?'<i aria-hidden="true"></i>':''}<span class="${n===active?'is-active':''}${n<active?' is-done':''}" aria-current="${n===active?'step':'false'}">${n}</span>`).join('')}</div>`;}
  function flowHeader(step){return `<header class="k-first-vehicle-header"><div class="k-first-vehicle-brand-row"><span aria-hidden="true"></span><img class="k-first-vehicle-logo" src="/assets/onboarding/kareta_logo_full.png" alt="KARETA.KZ Автосервис"><span aria-hidden="true"></span></div>${steps(step)}</header>`;}
  function errorLine(name){return `<small class="k-first-vehicle-error" data-fv-error="${name}" aria-live="polite"></small>`;}
  function intro(){return `${flowHeader(1)}<div class="k-first-vehicle-copy"><h1>Ваш первый автомобиль</h1><p>Сейчас нужна только минимальная карточка. Подробные данные автомобиля можно заполнить позже в гараже.</p></div><section class="k-first-vehicle-card k-first-vehicle-intro-card"><div class="k-first-vehicle-illustration">${carIcon()}</div><ul><li>Марка, модель и год выбираются карточками</li><li>Тип кузова — одним нажатием</li><li>VIN, госномер и пробег можно указать сразу или позже</li><li>Автомобиль сразу появится в гараже и заявках</li></ul></section><div class="k-first-vehicle-actions"><button class="k-first-vehicle-primary" type="button" data-first-vehicle-next>Заполнить автомобиль</button><button class="k-first-vehicle-secondary" type="button" data-first-vehicle-later>Сделать позже</button></div>`;}
  function bodyIcon(type){
    const paths={
      sedan:'M5 15h14l-2-5-3-2H9l-2 2-2 5Zm2 0v2m10-2v2M8 10h8',
      suv:'M4 15h16l-1-6-3-2H8L5 9l-1 6Zm3 0v2m10-2v2M7 9h10',
      hatch:'M5 15h14l-1-6-4-2H9L6 9l-1 6Zm2 0v2m10-2v2',
      wagon:'M4 15h16l-1-6-2-2H7L5 9l-1 6Zm3 0v2m10-2v2M7 9h10',
      coupe:'M5 15h14l-2-5-4-2h-3l-3 2-2 5Zm2 0v2m10-2v2',
      van:'M4 15h16V8l-3-2H7L4 9v6Zm3 0v2m10-2v2M8 8h7',
      pickup:'M4 15h16v-5h-6l-2-3H7L4 10v5Zm3 0v2m10-2v2',
      car:'M5 15h14l-2-5-3-2H9l-2 2-2 5Zm2 0v2m10-2v2'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[type]||paths.car}"/></svg>`;
  }
  function yearOptions(selected){
    const out=[];for(let y=currentYear()+1;y>=1950;y--)out.push(y);
    return [...new Set(out)];
  }
  function primaryChoice(draft){const vehicles=state.data?.vehicles||[],isEditingPrimary=state.editVehicleId&&Boolean(draft.isDefault);if(!vehicles.length||isEditingPrimary)return'';return `<label class="k-first-vehicle-primary-choice"><input type="checkbox" data-first-vehicle-default ${draft.isDefault?'checked':''}><span><b>Сделать основным автомобилем</b><small>Он будет автоматически выбран при создании новой заявки.</small></span></label>`;}
  function basic(draft){
    const brand=brandById(draft.brandId)||brandByName(draft.brandName),legacyBrand=isLegacyEditBrand(draft),models=brand?.models||[];
    const gens=generationOptions(draft),canSave=Boolean((brand||legacyBrand)&&finalModel(draft)&&draft.year);
    const brands=CATALOG.slice().sort((a,b)=>Number(b.popular)-Number(a.popular)||a.name.localeCompare(b.name,'ru'));
    const brandTiles=brands.map(x=>{const logo=window.KaretaVisualAssets?.brandLogo?.(x.name)||'';return `<button type="button" class="k-fv-picker-tile k-fv-brand-tile${draft.brandId===x.id?' is-selected':''}" data-fv-brand="${esc(x.id)}" aria-pressed="${draft.brandId===x.id?'true':'false'}">${logo?`<img src="${esc(logo)}" alt="">`:`<span class="k-fv-brand-fallback">${esc(x.name.slice(0,2).toUpperCase())}</span>`}<b>${esc(x.name)}</b></button>`;}).join('');
    const modelTiles=brand?models.map(x=>`<button type="button" class="k-fv-picker-tile k-fv-model-tile${draft.modelId===x.id?' is-selected':''}" data-fv-model="${esc(x.id)}"><span>${carIcon()}</span><b>${esc(x.name)}</b></button>`).join(''):'';
    const yearTiles=yearOptions(draft.year).map(y=>`<button type="button" class="k-fv-year-chip${String(draft.year)===String(y)?' is-selected':''}" data-fv-year="${y}">${y}</button>`).join('');
    const bodyTiles=BODY_TYPES.map(x=>`<button type="button" class="k-fv-body-tile${draft.bodyType===x.id?' is-selected':''}" data-fv-body="${esc(x.id)}"><span>${bodyIcon(x.icon)}</span><b>${esc(x.label)}</b></button>`).join('');
    return `${flowHeader(2)}<div class="k-first-vehicle-copy"><h1>${state.editVehicleId?'Автомобиль':'Добавьте автомобиль'}</h1><p>Выберите основные данные. Остальное можно добавить сейчас или позже в гараже.</p></div>
      <form class="k-first-vehicle-card k-first-vehicle-form k-first-vehicle-picker-form" data-first-vehicle-form="basic" novalidate>
        <input type="hidden" name="brandName" value="${esc(draft.brandName)}"><input type="hidden" name="modelName" value="${esc(draft.modelName)}"><input type="hidden" name="year" value="${esc(draft.year)}"><input type="hidden" name="generation" value="${esc(draft.generation)}"><input type="hidden" name="bodyType" value="${esc(draft.bodyType)}">
        <section class="k-fv-picker-block"><header><span>1</span><div><h2>Марка</h2><p>${draft.brandName?esc(draft.brandName):'Выберите логотип'}</p></div></header><div class="k-fv-picker-rail k-fv-brand-rail">${brandTiles}</div>${errorLine('brandName')}</section>
        <section class="k-fv-picker-block${brand||legacyBrand?'':' is-disabled'}"><header><span>2</span><div><h2>Модель</h2><p>${finalModel(draft)?esc(finalModel(draft)):(brand?'Выберите модель':'Сначала выберите марку')}</p></div></header>
          ${brand?`<div class="k-fv-picker-rail k-fv-model-rail">${modelTiles}<button type="button" class="k-fv-picker-tile k-fv-model-tile is-custom${draft.modelId==='custom'?' is-selected':''}" data-fv-model="custom"><span>+</span><b>Другая</b></button></div>`:legacyBrand?`<div class="k-fv-custom-row"><input name="legacyModelName" value="${esc(draft.modelName)}" placeholder="Модель автомобиля"></div>`:''}
          ${draft.modelId==='custom'?`<div class="k-fv-custom-row"><input name="customModelName" value="${esc(draft.customModelName)}" maxlength="80" placeholder="Название модели"></div>`:''}${errorLine('modelName')}${errorLine('customModelName')}
        </section>
        <section class="k-fv-picker-block"><header><span>3</span><div><h2>Год выпуска</h2><p>${draft.year?esc(draft.year):'Прокрутите и выберите'}</p></div></header><div class="k-fv-year-rail">${yearTiles}</div>${errorLine('year')}</section>
        <section class="k-fv-picker-block"><header><span>4</span><div><h2>Тип кузова</h2><p>${BODY_TYPES.find(x=>x.id===draft.bodyType)?.label||'Необязательно'}</p></div></header><div class="k-fv-body-grid">${bodyTiles}</div></section>
        ${gens.length?`<section class="k-fv-picker-block k-fv-generation-block"><header><span>+</span><div><h2>Поколение</h2><p>Определили по модели и году</p></div></header><div class="k-fv-generation-row">${gens.map(x=>`<button type="button" class="${draft.generation===x?'is-selected':''}" data-fv-generation="${esc(x)}">${esc(x)}</button>`).join('')}<button type="button" class="${!draft.generation?'is-selected':''}" data-fv-generation="">Не знаю</button></div></section>`:''}
        <details class="k-fv-extra" ${draft.vin||draft.plateNumber||draft.mileage?'open':''}><summary><span>Дополнительно</span><small>VIN, госномер, пробег</small></summary><div class="k-fv-extra-grid"><label><span>VIN</span><input name="vin" value="${esc(draft.vin)}" maxlength="17" placeholder="17 символов"></label><label><span>Госномер</span><input name="plateNumber" value="${esc(draft.plateNumber)}" maxlength="24" placeholder="123 ABC 16"></label><label><span>Пробег, км</span><input name="mileage" type="number" min="0" inputmode="numeric" value="${esc(draft.mileage)}" placeholder="0"></label></div></details>
      </form>
      ${primaryChoice(draft)}<div class="k-first-vehicle-actions"><button class="k-first-vehicle-primary" type="button" data-first-vehicle-confirm ${canSave?'':'disabled'}>Продолжить</button><small class="k-first-vehicle-submit-error" data-fv-submit-error aria-live="polite"></small></div>`;
  }
  function isPrimaryDraft(draft){return (state.data?.vehicles||[]).length===0||Boolean(draft.isDefault);}
  function reviewCard(draft,{success=false}={}){
    const primary=isPrimaryDraft(draft);
    return `<article class="k-first-vehicle-review-card${success?' is-success':''}"><div class="k-first-vehicle-car-visual">${carIcon()}</div><div class="k-first-vehicle-review-head"><div><h2>${esc(vehicleTitle(draft))}</h2><p>${esc([draft.year,draft.generation,BODY_TYPES.find(x=>x.id===draft.bodyType)?.label].filter(Boolean).join(' · '))}</p></div>${primary?'<b>Основной автомобиль</b>':''}</div><p class="k-first-vehicle-review-meta">${esc([draft.plateNumber?('Госномер: '+draft.plateNumber):'',draft.vin?('VIN: '+draft.vin):'',Number(draft.mileage)>0?(Number(draft.mileage).toLocaleString('ru-RU')+' км'):''].filter(Boolean).join(' · ')||'Карточка готова. Дополнительные характеристики можно заполнить позже в гараже.')}</p></article>`;
  }
  function confirm(draft){const editing=Boolean(state.editVehicleId);return `${flowHeader(3)}<div class="k-first-vehicle-copy"><h1>Подтвердите автомобиль</h1><p>Проверьте минимальную карточку перед сохранением в гараж.</p></div><section class="k-first-vehicle-card k-first-vehicle-review">${reviewCard(draft)}</section><div class="k-first-vehicle-actions"><button class="k-first-vehicle-primary" type="button" data-first-vehicle-save ${state.saving?'disabled aria-busy="true"':''}>${state.saving?'Сохраняем…':(editing?'Подтвердить изменения':'Подтвердить и добавить')}</button><button class="k-first-vehicle-secondary is-bordered" type="button" data-first-vehicle-edit-basic>Изменить данные</button><small class="k-first-vehicle-submit-error" data-fv-submit-error aria-live="polite"></small></div>`;}
  function success(draft){const editing=Boolean(state.editVehicleId);return `${flowHeader(3)}<section class="k-first-vehicle-success"><div class="k-first-vehicle-success-icon">${successIcon()}</div><h1>${editing?'Автомобиль обновлён':'Автомобиль добавлен'}</h1><p>${editing?`Данные ${esc(vehicleTitle(draft))} сохранены`:`${esc(vehicleTitle(draft))} теперь находится в вашем гараже`}</p>${reviewCard(draft,{success:true})}</section><div class="k-first-vehicle-actions k-first-vehicle-success-actions">${editing?'':`<button class="k-first-vehicle-primary" type="button" data-first-vehicle-create-request>Создать заявку</button>`}<button class="k-first-vehicle-secondary is-bordered" type="button" data-first-vehicle-to-garage>Перейти в гараж</button>${editing?'':`<button class="k-first-vehicle-secondary" type="button" data-first-vehicle-home>На главную</button>`}</div>`;}

  function emptyGarage(){const draft=readDraft(),hasDraft=Boolean(draft.brandName||draft.modelName||draft.year||draft.vin||draft.plateNumber);return `<section class="k-first-vehicle-empty" data-first-vehicle-empty><div class="k-first-vehicle-empty-visual">${carIcon()}</div><span>МОЙ ГАРАЖ</span><h2>В гараже пока нет автомобилей</h2><p>Добавьте автомобиль, чтобы быстрее оформлять заявки и хранить историю обслуживания.</p><button class="k-btn k-btn-primary" type="button" data-garage-add-vehicle>${hasDraft?'Продолжить добавление':'Добавить автомобиль'}</button></section>`;}

  function ensureSurfaceRoot(){
    let root=document.getElementById('k-first-vehicle-layer');
    if(!root){
      root=document.createElement('section');
      root.id='k-first-vehicle-layer';
      root.className='k-page k-client-cabinet-page k-first-vehicle-page';
      root.dataset.firstVehicleSurface='';
      root.hidden=true;
      root.setAttribute('aria-hidden','true');
      const fab=document.getElementById('k-mobile-fab-stack');
      const host=fab?.parentNode||document.getElementById('k-app')||document.body;
      if(fab&&fab.parentNode===host)host.insertBefore(root,fab);else host.appendChild(root);
    }
    root.classList.add('k-page','k-client-cabinet-page','k-first-vehicle-page');
    return root;
  }
  function activateSurface(){
    const root=state.root||ensureSurfaceRoot();
    state.root=root;
    root.hidden=false;root.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('k-first-vehicle-active');document.body?.classList.add('k-first-vehicle-active');
  }
  function deactivateSurface(){
    document.documentElement.classList.remove('k-first-vehicle-active');document.body?.classList.remove('k-first-vehicle-active');
    const root=state.root||document.getElementById('k-first-vehicle-layer');
    if(root){root.hidden=true;root.setAttribute('aria-hidden','true');root.replaceChildren();}
    state.root=null;state.sourceRoot=null;
  }
  function render(){if(!state.root)return;activateSurface();const draft=readDraft();state.root.innerHTML=`<div class="k-first-vehicle-shell" data-first-vehicle-shell>${state.success?success(state.success):state.step===1?intro():state.step===2?basic(draft):confirm(draft)}</div>`;bind();}
  function setError(name,message=''){state.root?.querySelector(`[data-fv-error="${name}"]`)?.replaceChildren(document.createTextNode(message));const input=state.root?.querySelector(`[name="${name}"]`);if(input)input.classList.toggle('is-invalid',Boolean(message));}
  function syncBasic(form){
    const brandInput=form.elements.brandName,brandValue=normalizeText(brandInput?.value),brand=brandByName(brandValue);const previous=readDraft();
    const legacyBrand=Boolean(state.editVehicleId&&state.editLegacyBrandName&&brandValue.toLocaleLowerCase('ru-RU')===state.editLegacyBrandName.toLocaleLowerCase('ru-RU'));
    const patch={brandName:brand?.name||brandValue,brandId:brand?.id||(legacyBrand?'legacy-edit':''),year:String(form.elements.year?.value||''),generation:String(form.elements.generation?.value||''),bodyType:String(form.elements.bodyType?.value||previous.bodyType||''),vin:normalizeVin(form.elements.vin?.value??previous.vin),plateNumber:normalizePlate(form.elements.plateNumber?.value??previous.plateNumber),mileage:String(Math.max(0,Number(form.elements.mileage?.value??previous.mileage??0)||0))};
    if((brand&&brand.id!==previous.brandId)||(!legacyBrand&&!brand&&previous.brandId)){patch.modelId='';patch.modelName='';patch.customModelName='';patch.generation='';}
    const modelValue=normalizeText(form.elements.modelName?.value);
    if(previous.modelId==='custom'||form.elements.customModelName){patch.modelId='custom';patch.modelName='';patch.customModelName=normalizeText(form.elements.customModelName?.value||previous.customModelName);}else if(brand){const model=modelByName(brand,modelValue);patch.modelId=model?.id||'';patch.modelName=model?.name||modelValue;patch.customModelName='';}else if(legacyBrand){patch.modelId='legacy-edit';patch.modelName=normalizeText(form.elements.legacyModelName?.value||modelValue||previous.modelName);patch.customModelName='';}
    return writeDraft(patch);
  }
  function validateBasic(){const form=state.root?.querySelector('[data-first-vehicle-form="basic"]');if(!form)return false;const draft=syncBasic(form);['brandName','modelName','customModelName','year'].forEach(x=>setError(x,''));const brand=brandById(draft.brandId),legacyBrand=isLegacyEditBrand(draft);let ok=true;if(!brand&&!legacyBrand){setError('brandName','Выберите марку автомобиля');ok=false;}const model=finalModel(draft);if(!model){setError(draft.modelId==='custom'?'customModelName':'modelName','Выберите модель автомобиля');ok=false;}else if(!legacyBrand&&draft.modelId!=='custom'&&!modelByName(brand,draft.modelName)){setError('modelName','Выберите модель автомобиля');ok=false;}const year=Number(draft.year);if(!/^\d{4}$/.test(String(draft.year))||year<1950||year>currentYear()+1){setError('year','Укажите корректный год выпуска');ok=false;}return ok;}
  function go(step){state.step=Math.max(1,Math.min(3,Number(step)||1));writeDraft({step:state.step});render();state.root?.scrollTo?.({top:0,behavior:'smooth'});}
  function leaveToGarage(){deactivateSurface();state.onReturn?.();}
  function navigate(hash){deactivateSurface();if(String(location.hash)!==hash)location.hash=hash;else window.KaretaRouteRuntime?.transition?.(window.KaretaRouteRegistry?.keyFromHash?.(hash)||'home',{source:'first-vehicle',force:true});}
  async function save(){if(state.saving)return;const draft=readDraft();if(!validateBasicFallback(draft)){go(2);return;}state.saving=true;render();const editing=Boolean(state.editVehicleId),vehicle={flowVersion:RELEASE,id:state.editVehicleId||undefined,brandId:draft.brandId,modelId:draft.modelId,brand:draft.brandName,model:finalModel(draft),title:vehicleTitle(draft),year:Number(draft.year),generation:draft.generation,bodyType:draft.bodyType,vin:draft.vin,plate:draft.plateNumber,mileageKm:Number(draft.mileage||0),engineType:draft.fuelType,engineVolume:draft.engineVolume,fuelType:draft.fuelType,isDefault:(state.data?.vehicles||[]).length===0||Boolean(draft.isDefault)};let result;try{result=await api.saveVehicle(vehicle);}catch(error){result={ok:false,payload:{message:error?.message||`Не удалось ${editing?'сохранить':'добавить'} автомобиль`}};}state.saving=false;if(!result?.ok){render();const error=result?.payload?.error||'';const message=result?.payload?.message||({vehicle_duplicate_vin:'Этот автомобиль уже добавлен в ваш гараж',vehicle_duplicate_plate:'Автомобиль с таким госномером уже есть в гараже',invalid_vehicle_vin:'VIN должен содержать 17 символов'}[error]||`Не удалось ${editing?'сохранить':'добавить'} автомобиль`);const out=state.root?.querySelector('[data-fv-submit-error]');if(out)out.textContent=message;return;}const created=result.payload?.vehicle||vehicle;state.success={...draft,id:created.id||state.editVehicleId||'',brandName:created.brand||draft.brandName,modelName:created.model||draft.modelName,year:created.year||created.year_label||draft.year,generation:created.generation||draft.generation,bodyType:created.bodyType??created.body_type??draft.bodyType,plateNumber:created.plate||draft.plateNumber,vin:created.vin||draft.vin,mileage:created.mileageKm??created.mileage_km??draft.mileage,engineVolume:created.engineVolume??created.engine_volume??draft.engineVolume,fuelType:created.fuelType??created.fuel_type??draft.fuelType,isDefault:Boolean(Number(created.isDefault??created.is_default??vehicle.isDefault))};clearDraft();if(!editing){markPrompt('completed');state.serverStatus='completed';state.serverConflict=false;}window.KaretaApiClient?.invalidate?.('client.cabinet');window.KaretaApiClient?.invalidate?.('client.first-entry');render();window.KaretaToast?.success?.(editing?'Автомобиль обновлён':'Автомобиль добавлен');}
  function validateBasicFallback(d){const brand=brandById(d.brandId),legacyBrand=isLegacyEditBrand(d),model=finalModel(d),year=Number(d.year);return Boolean((brand||legacyBrand)&&model&&/^\d{4}$/.test(String(d.year))&&year>=1950&&year<=currentYear()+1);}

  function bind(){const root=state.root;if(!root||root.dataset.firstVehicleBound==='1')return;root.dataset.firstVehicleBound='1';const click=async event=>{
    const brandButton=event.target.closest('[data-fv-brand]');if(brandButton){const brand=brandById(brandButton.dataset.fvBrand);if(brand){writeDraft({brandId:brand.id,brandName:brand.name,modelId:'',modelName:'',customModelName:'',generation:''});render();}return;}
    const modelButton=event.target.closest('[data-fv-model]');if(modelButton){const draft=readDraft(),brand=brandById(draft.brandId),id=String(modelButton.dataset.fvModel||'');if(id==='custom'){writeDraft({modelId:'custom',modelName:'',customModelName:'',generation:''});render();return;}const model=brand?.models?.find(x=>x.id===id);if(model){writeDraft({modelId:model.id,modelName:model.name,customModelName:'',generation:''});render();}return;}
    const yearButton=event.target.closest('[data-fv-year]');if(yearButton){writeDraft({year:String(yearButton.dataset.fvYear||''),generation:''});render();return;}
    const bodyButton=event.target.closest('[data-fv-body]');if(bodyButton){writeDraft({bodyType:String(bodyButton.dataset.fvBody||'')});render();return;}
    const generationButton=event.target.closest('[data-fv-generation]');if(generationButton){writeDraft({generation:String(generationButton.dataset.fvGeneration||'')});render();return;}
    if(event.target.closest('[data-first-vehicle-later]')){markPrompt('dismissed');clearDraft();await dismissServerFirstEntry();navigate('#/home');return;}
    if(event.target.closest('[data-first-vehicle-next]')){if(state.step===1){go(2);return;}return;}
    if(event.target.closest('[data-first-vehicle-confirm]')){if(state.step===2&&validateBasic()){go(3);return;}return;}
    if(event.target.closest('[data-first-vehicle-edit-basic]')){go(2);return;}
    if(event.target.closest('[data-first-vehicle-save]')){await save();return;}
    if(event.target.closest('[data-first-vehicle-create-request]')){const v=state.success||{};try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({vehicleId:v.id||'',clientVehicleId:v.id||'',clientCar:vehicleTitle(v),source:'first_vehicle_success'}));}catch(_e){}navigate('#/orders/new');return;}
    if(event.target.closest('[data-first-vehicle-to-garage]')){state.success=null;leaveToGarage();return;}
    if(event.target.closest('[data-first-vehicle-home]')){navigate('#/home');return;}
  };
    const input=event=>{if(event.target.matches('[data-first-vehicle-default]')){writeDraft({isDefault:Boolean(event.target.checked)});render();return;}const form=event.target.closest('form');if(!form)return;if(form.dataset.firstVehicleForm==='basic'){
      const before=readDraft();const next=syncBasic(form);if(event.target.name==='brandName'&&brandByName(event.target.value)&&next.brandId!==before.brandId){render();return;}if(event.target.name==='modelName'){const value=normalizeText(event.target.value);if(value==='Моей модели нет'){writeDraft({modelId:'custom',modelName:''});render();return;}const brand=brandById(next.brandId);if(brand&&modelByName(brand,value)&&next.modelId!==before.modelId){render();return;}}if(event.target.name==='year'&&event.type==='change'){render();return;}const button=root.querySelector('[data-first-vehicle-confirm]');if(button&&state.step===2)button.disabled=!((brandById(next.brandId)||isLegacyEditBrand(next))&&finalModel(next)&&next.year);
    }};
    root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',input);
  }

  function start({root,startStep=2,data={},onReturn=null,mode='manual',vehicle=null}={}){state.sourceRoot=root||null;state.root=ensureSurfaceRoot();if(!state.root)return false;state.data=data||{};state.onReturn=typeof onReturn==='function'?onReturn:null;state.mode=mode;state.success=null;state.saving=false;state.editVehicleId=mode==='edit'?String(vehicle?.id||''):'';const flowRoot=state.root;if(!state.editVehicleId&&!state.serverLoaded)loadServerFirstEntry().then(()=>{if(state.root===flowRoot&&state.step>=2)render();});state.editLegacyBrandName=state.editVehicleId&&!brandByName(vehicle?.brand||'')?normalizeText(vehicle?.brand):'';state.step=startStep===1&&!state.editVehicleId?1:2;if(state.editVehicleId){const stored=readJson(draftKey());if(!stored)writeDraft({...vehicleToDraft(vehicle),step:state.step});else writeDraft({step:state.step});}else writeDraft({step:state.step});render();return true;}

  window.addEventListener('kareta:session-confirmed',event=>{window.setTimeout(()=>maybeScheduleFirstEntry(event.detail||{}),0);});

  window.addEventListener('kareta:session-anonymous',()=>{
    deactivateSurface();
    try{sessionStorage.removeItem(PENDING_KEY);}catch(_error){}
    if(state.serverSaveTimer)clearTimeout(state.serverSaveTimer);
    Object.assign(state,{data:null,success:null,autoScheduled:false,editVehicleId:'',editLegacyBrandName:'',serverLoaded:false,serverRevision:0,serverStatus:'',serverSavePending:false,serverSaveTimer:0});
  });

  window.addEventListener('hashchange',()=>{if(!String(location.hash||'').startsWith('#/cabinet/garage'))deactivateSurface();});
  window.addEventListener('kareta:context-changed',event=>{if(currentRole(event.detail||{})!=='client')deactivateSurface();window.setTimeout(()=>maybeScheduleFirstEntry(event.detail||{}),80);});

  window.KaretaFirstVehicleFlow=Object.freeze({CATALOG,emptyGarage,start,consumePendingIntro,maybeScheduleFirstEntry,readDraft,clearDraft,scopeKey,loadServerFirstEntry,flushServerDraft,deactivateSurface});
})();
;

/* SOURCE: js/next/account_window.js */
(() => {
  'use strict';

  if (window.__KARETA_ACCOUNT_WINDOW__) return;
  window.__KARETA_ACCOUNT_WINDOW__={version:'R188.5.5.6.79'};

  const api=window.KaretaClientCabinetApi;
  const uiIcons=window.KaretaUIIcons;
  if(!api) throw new Error('KaretaClientCabinetApi is required before account_window.js');

  const state={dialog:null,body:null,title:null,subtitle:null,baseHash:'',targetHash:'',kind:'',trigger:null,cleanup:[]};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('ru-RU').format(Number(v||0))+' ₸';
  const icon=name=>uiIcons?.icon?.(name)||'';
  const currentRoute=()=>document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')||'';
  const clientPage=()=>Boolean(document.querySelector('[data-native-ui="client-account"]'));
  const cache={cabinet:null};

  const meta={
    profile:{title:'Профиль',subtitle:'Личные данные клиента',hash:'#/cabinet/data'},
    documents:{title:'Документы',subtitle:'Цифровой архив автомобилей',hash:'#/cabinet/documents'},
    tariff:{title:'Тариф',subtitle:'Лимиты и KARETA PRO',hash:'#/cabinet/tariff'},
    notifications:{title:'Уведомления',subtitle:'События и правила оповещений',hash:'#/notifications'},
    security:{title:'Безопасность',subtitle:'Сессия и доступ к аккаунту',hash:''},
    interface:{title:'Интерфейс',subtitle:'Вид меню и мобильные параметры',hash:'#/cabinet/settings'},
  };

  function ensureDialog(){
    if(state.dialog?.isConnected)return state.dialog;
    const d=document.createElement('dialog');
    d.className='k-account-window-r79';
    d.setAttribute('data-account-window-dialog','');
    d.innerHTML=`<div class="k-account-window-r79__surface"><header class="k-account-window-r79__head"><div><small data-account-window-subtitle>АККАУНТ</small><h2 data-account-window-title>Настройки</h2></div><button type="button" data-account-window-close aria-label="Закрыть">×</button></header><div class="k-account-window-r79__body" data-account-window-body></div></div>`;
    document.body.appendChild(d);
    state.dialog=d;state.body=d.querySelector('[data-account-window-body]');state.title=d.querySelector('[data-account-window-title]');state.subtitle=d.querySelector('[data-account-window-subtitle]');
    d.addEventListener('cancel',e=>{e.preventDefault();close();});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-account-window-close]'))close();});
    return d;
  }
  function cleanup(){state.cleanup.splice(0).reverse().forEach(fn=>{try{fn?.();}catch(_e){}});}
  function listen(node,type,fn,opts){node?.addEventListener?.(type,fn,opts);state.cleanup.push(()=>node?.removeEventListener?.(type,fn,opts));}
  function setHash(hash){if(!hash)return;try{history.replaceState(history.state,'',hash);}catch(_e){}}
  function invalidate(){window.KaretaApiClient?.invalidate?.('client.cabinet');cache.cabinet=null;}
  async function cabinet(force=false){if(cache.cabinet&&!force)return cache.cabinet;const r=await api.get(force?{cacheTtlMs:0,force:true}:{});if(!r.ok)throw new Error(r.payload?.message||r.payload?.error||'Не удалось загрузить аккаунт');return cache.cabinet=r.payload?.data||{};}
  function loading(){state.body.innerHTML='<section class="k-account-window-r79__loading"><span></span><h3>Загрузка…</h3></section>';}
  function error(message){state.body.innerHTML=`<section class="k-account-window-r79__empty">${icon('warning')}<h3>Не удалось открыть раздел</h3><p>${esc(message||'Неизвестная ошибка')}</p><button class="k-btn k-btn-primary" type="button" data-account-retry>Повторить</button></section>`;state.body.querySelector('[data-account-retry]')?.addEventListener('click',()=>render(state.kind,true),{once:true});}
  function choice(name,value,label,current){return `<button type="button" class="k-account-choice ${String(value)===String(current)?'is-selected':''}" data-account-choice="${esc(name)}" data-value="${esc(value)}"><span>${esc(label)}</span></button>`;}
  function bindChoices(root){listen(root,'click',e=>{const b=e.target.closest('[data-account-choice]');if(!b)return;const name=b.dataset.accountChoice,value=b.dataset.value;const hidden=root.querySelector(`input[type="hidden"][name="${name}"]`);if(hidden)hidden.value=value;root.querySelectorAll(`[data-account-choice="${name}"]`).forEach(x=>x.classList.toggle('is-selected',x===b));});}

  function profileHtml(d){const u=d.user||{},avatar=String(u.avatarUrl||u.avatar_url||'');return `<form class="k-account-window-form" data-account-profile-form><div class="k-account-profile-editor"><div class="k-account-profile-avatar">${avatar?`<img src="${esc(avatar)}" alt="">`:`<span>${esc(String(u.name||'К').trim().slice(0,2).toUpperCase())}</span>`}</div><div><small>ПРОФИЛЬ КЛИЕНТА</small><h3>${esc(u.name||'Укажите имя')}</h3><p>${esc(u.phone||'')}</p></div></div><div class="k-account-field-grid"><label>Имя<input name="name" maxlength="120" value="${esc(u.name||'')}" required></label><label>Город<input name="city" maxlength="120" value="${esc(u.city||'')}"></label><label>Email<input name="email" type="email" maxlength="191" value="${esc(u.email||'')}"></label><label>Телефон<input value="${esc(u.phone||'')}" disabled><small>Телефон является логином.</small></label><label class="is-wide">Фото профиля — URL<input name="avatarUrl" type="url" value="${esc(avatar)}" placeholder="https://..."></label><label class="is-wide">О себе<textarea name="bio" maxlength="1000" rows="5">${esc(u.bio||'')}</textarea></label></div><footer><output data-account-status></output><button class="k-btn k-btn-primary" type="submit">Сохранить профиль</button></footer></form>`;}
  async function renderProfile(){const d=await cabinet();state.body.innerHTML=profileHtml(d);const form=state.body.querySelector('[data-account-profile-form]');listen(form,'submit',async e=>{e.preventDefault();const out=form.querySelector('[data-account-status]');out.textContent='Сохранение…';const r=await api.saveProfile(Object.fromEntries(new FormData(form).entries()));if(!r.ok){out.textContent=r.payload?.message||'Не удалось сохранить';window.KaretaToast?.error?.(out.textContent);return;}invalidate();out.textContent='Профиль сохранён';window.KaretaToast?.success?.('Профиль сохранён');try{await window.KaretaCabinetPages?.refreshClientCabinet?.();}catch(_e){}});}

  const docTypes={insurance:'Страховка',inspection:'Техосмотр',registration:'Регистрация',power_of_attorney:'Доверенность',service:'Сервисный документ',warranty:'Гарантия',other:'Другое'};
  function docState(doc){if(!doc.expires_at)return ['active','Без срока'];const days=Math.ceil((new Date(doc.expires_at+'T00:00:00')-new Date())/86400000);if(days<0)return ['expired','Просрочен'];if(days<=Number(doc.reminder_days||30))return ['soon',`Осталось ${days} дн.`];return ['active',`До ${doc.expires_at}`];}
  function documentsList(d){const names=Object.fromEntries((d.vehicles||[]).map(v=>[String(v.id),v.title||[v.brand,v.model].filter(Boolean).join(' ')]));const docs=d.documents||[];return `<div class="k-account-window-toolbar"><div><b>${docs.length} документов</b><small>Архив привязан к автомобилям.</small></div><button class="k-btn k-btn-primary" type="button" data-account-doc-add>${icon('plus')}<span>Добавить документ</span></button></div><div class="k-account-flat-list">${docs.map(doc=>{const [key,label]=docState(doc);return `<article class="k-account-flat-row is-${key}"><div><span>${esc(docTypes[doc.document_type]||'Документ')}</span><b>${esc(doc.title||'Документ')}</b><small>${esc(names[String(doc.vehicle_id)]||'Автомобиль')} · ${esc(doc.document_number||'Без номера')} · ${esc(label)}</small></div><div class="k-account-flat-actions">${doc.file_url?`<a class="k-btn k-btn-secondary" href="${esc(doc.file_url)}" target="_blank" rel="noopener">Файл</a>`:''}<button class="k-btn k-btn-danger" type="button" data-account-doc-delete="${esc(doc.id)}">Удалить</button></div></article>`;}).join('')||'<div class="k-account-window-r79__empty"><h3>Документов пока нет</h3><p>Добавьте страховку, техосмотр, гарантию или другой документ.</p></div>'}</div>`;}
  function documentEditor(d){const vehicles=d.vehicles||[];if(!vehicles.length)return `<section class="k-account-window-r79__empty"><h3>Сначала добавьте автомобиль</h3><p>Документы привязываются к конкретной машине.</p><a class="k-btn k-btn-primary" href="#/cabinet/garage">Открыть гараж</a></section>`;const vehicle=String(vehicles[0]?.id||'');return `<form class="k-account-window-form" data-account-doc-form><div class="k-account-window-toolbar"><button class="k-btn k-btn-secondary" type="button" data-account-doc-back>← Архив</button><b>Новый документ</b></div><section class="k-account-picker-block"><h3>Автомобиль</h3><input type="hidden" name="vehicleId" value="${esc(vehicle)}">${vehicles.map(v=>choice('vehicleId',v.id,v.title||[v.brand,v.model].filter(Boolean).join(' ')||'Автомобиль',vehicle)).join('')}</section><section class="k-account-picker-block"><h3>Тип документа</h3><input type="hidden" name="documentType" value="insurance">${Object.entries(docTypes).map(([k,l])=>choice('documentType',k,l,'insurance')).join('')}</section><div class="k-account-field-grid"><label>Название<input name="title" required placeholder="Полис ОГПО"></label><label>Номер<input name="documentNumber" placeholder="Номер документа"></label><label>Кем выдан<input name="issuerName"></label><label>Дата выдачи<input name="issuedAt" type="date"></label><label>Действует до<input name="expiresAt" type="date"></label></div><section class="k-account-picker-block"><h3>Напомнить заранее</h3><input type="hidden" name="reminderDays" value="30">${[[7,'7 дней'],[14,'14 дней'],[30,'30 дней'],[60,'60 дней'],[90,'90 дней']].map(([v,l])=>choice('reminderDays',v,l,30)).join('')}</section><div class="k-account-field-grid"><label class="is-wide">Ссылка на файл<input name="fileUrl" type="url" placeholder="https://..."></label><label class="is-wide">Примечание<textarea name="note" rows="4"></textarea></label></div><footer><output data-account-status></output><button class="k-btn k-btn-primary" type="submit">Сохранить документ</button></footer></form>`;}
  async function renderDocuments(force=false){const d=await cabinet(force);state.body.innerHTML=documentsList(d);const openEditor=()=>{state.body.innerHTML=documentEditor(d);const form=state.body.querySelector('[data-account-doc-form]');bindChoices(form);state.body.querySelector('[data-account-doc-back]')?.addEventListener('click',()=>renderDocuments(true),{once:true});listen(form,'submit',async e=>{e.preventDefault();const out=form.querySelector('[data-account-status]');out.textContent='Сохранение…';const r=await api.saveDocument(Object.fromEntries(new FormData(form).entries()));if(!r.ok){out.textContent=r.payload?.message||'Не удалось сохранить документ';window.KaretaToast?.error?.(out.textContent);return;}invalidate();window.KaretaToast?.success?.('Документ сохранён');renderDocuments(true);});};state.body.querySelector('[data-account-doc-add]')?.addEventListener('click',openEditor,{once:true});listen(state.body,'click',async e=>{const b=e.target.closest('[data-account-doc-delete]');if(!b)return;const r=await api.deleteDocument(b.dataset.accountDocDelete);if(!r.ok){window.KaretaToast?.error?.(r.payload?.message||'Не удалось удалить документ');return;}invalidate();window.KaretaToast?.success?.('Документ удалён');renderDocuments(true);});}

  function tariffMetric(title,used,limit,note=''){const u=Math.max(0,Number(used||0)),l=Math.max(0,Number(limit||0)),pct=l>0?Math.min(100,Math.round(u*100/l)):0;return `<div class="k-account-tariff-metric"><span><small>${esc(title)}</small><b>${u} / ${l||'∞'}</b></span><i><em style="width:${pct}%"></em></i>${note?`<small>${esc(note)}</small>`:''}</div>`;}
  async function renderTariff(){const role=String(window.KaretaRoleAccess?.currentRole?.()||'client').toLowerCase();const r=await window.KaretaApiClient.request('api/db.php?action=tariffs.getMine',{method:'GET',cacheTtlMs:0});if(!r.ok)throw new Error(r.payload?.message||r.payload?.error||'Не удалось загрузить тариф');const d=r.payload?.data||{},limits=d.limits||{},usage=d.usage||{},current=d.current||{},plans=Array.isArray(d.plans)?d.plans:[];const metrics=role==='master'?[tariffMetric('Принято сегодня',usage.acceptedRequestsToday,limits.acceptedRequestsPerDay),tariffMetric('Приёмы на дату',usage.activeIntakesOnDate,limits.activeIntakesPerDay),tariffMetric('Открытые ремонты',usage.openRepairs,limits.openRepairs)]:[tariffMetric('Активные заявки',usage.activeRequests,limits.activeRequests),tariffMetric('Автомобили',usage.vehicles,limits.vehicles)];state.body.innerHTML=`<section class="k-account-tariff-current"><header><div><small>ТЕКУЩИЙ ТАРИФ</small><h3>${esc(current.name||'—')}</h3><p>${esc(current.description||'')}</p></div><strong>${current.isPaid?(Number(current.monthlyPrice||0)>0?money(current.monthlyPrice)+'/мес.':'Платный тариф'):'Бесплатно'}</strong></header><div class="k-account-tariff-metrics">${metrics.join('')}</div></section><section class="k-account-plan-list">${plans.map(p=>`<article class="${String(p.code)===String(current.code)?'is-current':''}"><div><small>${p.isPaid?'KARETA PRO':'ОБЫЧНЫЙ'}</small><b>${esc(p.name||'Тариф')}</b><p>${esc(p.description||'')}</p></div><strong>${p.isPaid?(Number(p.monthlyPrice||0)>0?money(p.monthlyPrice)+'/мес.':'Платный'):'Бесплатно'}</strong></article>`).join('')}</section>`;}

  async function renderNotifications(){const d=await cabinet();const p=d.preferences||{};state.body.innerHTML=`<form class="k-account-window-form" data-account-notify-form><div class="k-account-setting-list"><label><span><b>Статусы заказов</b><small>Этапы, стоимость и готовность.</small></span><input type="checkbox" name="notify_orders" ${Number(p.notify_orders)!==0?'checked':''}><i></i></label><label><span><b>Напоминания по автомобилю</b><small>ТО, документы и сервисные сроки.</small></span><input type="checkbox" name="notify_service" ${Number(p.notify_service)!==0?'checked':''}><i></i></label><label><span><b>Акции</b><small>Персональные предложения KARETA.</small></span><input type="checkbox" name="notify_promotions" ${Number(p.notify_promotions)!==0?'checked':''}><i></i></label></div><footer><output data-account-status></output><button class="k-btn k-btn-primary" type="submit">Сохранить уведомления</button></footer></form><section class="k-account-events"><header><div><small>ПОСЛЕДНИЕ СОБЫТИЯ</small><h3>Центр уведомлений</h3></div><button class="k-btn k-btn-secondary" type="button" data-account-notify-refresh>Обновить</button></header><div data-account-notify-list><div class="k-account-window-r79__loading">Загрузка…</div></div></section>`;const form=state.body.querySelector('[data-account-notify-form]');listen(form,'submit',async e=>{e.preventDefault();const payload={notify_orders:form.notify_orders.checked,notify_service:form.notify_service.checked,notify_promotions:form.notify_promotions.checked};const out=form.querySelector('[data-account-status]');out.textContent='Сохранение…';const r=await api.savePreferences(payload);if(!r.ok){out.textContent=r.payload?.message||'Ошибка сохранения';return;}invalidate();out.textContent='Сохранено';window.KaretaToast?.success?.('Уведомления сохранены');});const list=state.body.querySelector('[data-account-notify-list]');const loadEvents=async()=>{const r=await window.KaretaApiClient.request('api/domain.php?action=notifications.list',{cacheTtlMs:0,force:true,dedupe:false});const rows=Array.isArray(r.payload?.notifications)?r.payload.notifications:[];list.innerHTML=rows.slice(0,12).map(n=>`<article class="k-account-event-row ${!(n.isRead??Number(n.is_read||0)===1)?'is-unread':''}"><div><b>${esc(n.title||'Уведомление')}</b><small>${esc(n.body||'')}</small></div>${(n.actionUrl||n.action_url)?`<a class="k-btn k-btn-secondary" href="${esc(n.actionUrl||n.action_url)}">Открыть</a>`:''}</article>`).join('')||'<p>Новых событий нет.</p>';};state.body.querySelector('[data-account-notify-refresh]')?.addEventListener('click',loadEvents);loadEvents();}

  async function renderSecurity(){const d=await cabinet();const id=window.KaretaIdentity?.snapshot?.()||{};const account=id.account||{},session=id.session||{},context=id.context||{};state.body.innerHTML=`<section class="k-account-security"><div class="k-account-security-status">${icon(id.authenticated?'lock':'warning')}<div><small>СОСТОЯНИЕ ДОСТУПА</small><h3>${id.authenticated?'Сессия подтверждена':'Требуется проверка сессии'}</h3><p>${esc(d.user?.phone||account.phone||'Телефон не определён')}</p></div></div><div class="k-account-security-rows"><span><small>Контекст</small><b>${esc(context.key||context.contextKey||id.compatibilityRole||'client')}</b></span><span><small>Режим Identity</small><b>${esc(id.mode||'—')}</b></span><span><small>Сессия</small><b>${esc(session.id||session.sessionId||'Активная')}</b></span><span><small>Статус аккаунта</small><b>${esc(account.status||'active')}</b></span></div><div class="k-account-security-actions"><button class="k-btn k-btn-primary" type="button" data-account-session-check>${icon('refresh')}<span>Перепроверить сессию</span></button><a class="k-btn k-btn-secondary" href="#/privacy">Конфиденциальность</a>${window.KaretaIdentity?.logout?'<button class="k-btn k-btn-danger" type="button" data-account-logout>Выйти из аккаунта</button>':''}</div><output data-account-security-status></output></section>`;state.body.querySelector('[data-account-session-check]')?.addEventListener('click',async()=>{const out=state.body.querySelector('[data-account-security-status]');out.textContent='Проверка…';try{await window.KaretaIdentity?.load?.({force:true,allowLegacyBridge:true,legacyUser:window.KaretaNext?.state?.user});out.textContent='Сессия подтверждена';window.KaretaToast?.success?.('Сессия проверена');renderSecurity();}catch(e){out.textContent=e.message||'Не удалось проверить сессию';window.KaretaToast?.error?.(out.textContent);}});state.body.querySelector('[data-account-logout]')?.addEventListener('click',async e=>{const button=e.currentTarget,out=state.body.querySelector('[data-account-security-status]');button.disabled=true;out.textContent='Выход…';try{await window.KaretaIdentity.logout();close({restore:false});}catch(_error){out.textContent='Не удалось выйти. Проверьте соединение и повторите.';button.disabled=false;}});}

  function layoutPicker(){return `<section class="k-account-picker-block k-account-picker-block--fixed"><h3>Дополнительное меню «Ещё»</h3><input type="hidden" name="more_menu_layout" value="honeycomb"><div class="k-account-more-fixed"><span aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></span><div><b>Соты KARETA</b><small>Единое окно V1.2: профиль, 6 быстрых действий и поддержка.</small></div></div></section>`;}

  async function renderInterface(){const d=await cabinet(),p=d.preferences||{};await window.KaretaSmartActionHub?.loadPreference?.();const current=window.KaretaSmartActionHub?.snapshot?.().layout||p.more_menu_layout||'honeycomb';state.body.innerHTML=`<form class="k-account-window-form" data-account-interface-form><div class="k-account-setting-list"><label><span><b>Компактный мобильный режим</b><small>Меньше пояснений и вертикальных отступов.</small></span><input type="checkbox" name="compact_mobile" ${Number(p.compact_mobile)!==0?'checked':''}><i></i></label></div>${layoutPicker(current)}<footer><output data-account-status></output><button class="k-btn k-btn-primary" type="submit">Сохранить интерфейс</button></footer></form><div data-messaging-settings-host></div>`;const form=state.body.querySelector('[data-account-interface-form]');bindChoices(form);listen(form,'submit',async e=>{e.preventDefault();const payload={compact_mobile:form.compact_mobile.checked,more_menu_layout:form.more_menu_layout.value};const out=form.querySelector('[data-account-status]');out.textContent='Сохранение…';const r=await api.savePreferences(payload);if(!r.ok){out.textContent=r.payload?.message||'Ошибка сохранения';return;}await window.KaretaSmartActionHub?.savePreference?.(payload.more_menu_layout);document.documentElement.classList.toggle('k-compact-mobile',payload.compact_mobile);invalidate();out.textContent='Интерфейс сохранён';window.KaretaToast?.success?.('Интерфейс сохранён');});window.KaretaMessagingSettings?.mount?.(state.body.querySelector('[data-messaging-settings-host]'));}

  async function render(kind,force=false){cleanup();state.kind=kind;loading();try{if(kind==='profile')await renderProfile(force);else if(kind==='documents')await renderDocuments(force);else if(kind==='tariff')await renderTariff();else if(kind==='notifications')await renderNotifications();else if(kind==='security')await renderSecurity();else if(kind==='interface')await renderInterface();else throw new Error('Раздел аккаунта не найден');}catch(e){console.error('[KARETA account window]',e);error(e?.message||String(e));}}
  function open(kind,{trigger=null}={}){const m=meta[kind];if(!m)return false;const d=ensureDialog();if(!state.baseHash)state.baseHash=String(location.hash||'#/cabinet');state.trigger=trigger||state.trigger;state.targetHash=m.hash;state.title.textContent=m.title;state.subtitle.textContent=m.subtitle;if(m.hash)setHash(m.hash);if(!d.open)d.showModal();document.documentElement.classList.add('k-account-window-open');render(kind);try{window.dispatchEvent(new CustomEvent('kareta:account-window-open',{detail:{kind,baseHash:state.baseHash}}));}catch(_e){}return true;}
  function close({restore=true}={}){if(!state.dialog)return false;cleanup();if(state.dialog.open)try{state.dialog.close();}catch(_e){}document.documentElement.classList.remove('k-account-window-open');const base=state.baseHash;state.baseHash='';state.kind='';state.targetHash='';if(restore&&base)setHash(base);try{state.trigger?.focus?.({preventScroll:true});}catch(_e){}state.trigger=null;return true;}
  function kindFromLink(link){const explicit=link.dataset.accountWindow;if(explicit)return explicit;const href=String(link.getAttribute('href')||'');return {'#/cabinet/data':'profile','#/cabinet/documents':'documents','#/cabinet/tariff':'tariff','#/cabinet/settings':'interface','#/notifications':'notifications'}[href]||'';}
  function onClick(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const link=e.target.closest('[data-account-window],a[href="#/cabinet/data"],a[href="#/cabinet/documents"],a[href="#/cabinet/tariff"],a[href="#/cabinet/settings"],a[href="#/notifications"]');if(!link||!clientPage()||currentRoute()!=='cabinet')return;const kind=kindFromLink(link);if(!kind)return;e.preventDefault();e.stopImmediatePropagation();open(kind,{trigger:link});}

  function openPending(){
    let kind='';try{kind=sessionStorage.getItem('kareta.account.window.pending')||'';}catch(_e){}
    if(!kind||currentRoute()!=='cabinet'||!clientPage())return;
    try{sessionStorage.removeItem('kareta.account.window.pending');}catch(_e){}
    setTimeout(()=>{if(clientPage()&&currentRoute()==='cabinet')open(kind);},0);
  }
  document.addEventListener('click',onClick,true);
  window.addEventListener('hashchange',()=>{if(state.dialog?.open&&state.targetHash&&String(location.hash)!==state.targetHash)close({restore:false});setTimeout(openPending,0);});
  window.addEventListener('kareta:routechange',()=>setTimeout(openPending,0));
  window.addEventListener('kareta:session-anonymous',()=>{invalidate();close({restore:false});});
  setTimeout(openPending,0);
  window.KaretaAccountWindow=Object.freeze({open,close,isOpen:()=>Boolean(state.dialog?.open),snapshot:()=>({open:Boolean(state.dialog?.open),kind:state.kind,baseHash:state.baseHash,targetHash:state.targetHash})});
})();
;

/* SOURCE: js/next/window_engine.js */
(() => {
  'use strict';

  if (window.__KARETA_WINDOW_ENGINE__) return;
  window.__KARETA_WINDOW_ENGINE__ = { version:'R188.5.5.6.84.68' };

  const state = {
    dialog:null,
    body:null,
    title:null,
    baseHash:'',
    targetHash:'',
    trigger:null,
    controller:null,
    cleanups:[],
    replacing:false,
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentRoute = () => document.querySelector('#k-page-outlet')?.getAttribute('data-current-route') || '';
  const entityKeys = new Set(['workOrder']);

  function descriptor(hashValue){
    const hash=String(hashValue||'').trim();
    if(/^#\/orders\/item\/[^/?]+/.test(hash)) return {key:'workOrder',label:'Заказ-наряд',render:()=>window.KaretaWorkOrderPages?.renderWorkOrder?.(window.KaretaNext?.state||{}),mount:ctx=>window.KaretaWorkOrderPages?.mountWorkOrder?.(ctx)};
    return null;
  }

  function lifecycle(existingController=null){
    const controller=existingController||new AbortController();
    state.controller=controller;
    return {
      signal:controller.signal,
      token:Date.now(),
      source:'entity-window',
      isActive:()=>!controller.signal.aborted && Boolean(state.dialog?.open),
      addCleanup(fn){if(typeof fn==='function')state.cleanups.push(fn);return fn;},
    };
  }

  function cleanupMounted(){
    try{state.controller?.abort?.('entity-window-close');}catch(_e){}
    state.controller=null;
    const queue=state.cleanups.splice(0).reverse();
    queue.forEach(fn=>{try{fn?.();}catch(error){console.warn('[KARETA window cleanup]',error);}});
  }

  function ensureDialog(){
    if(state.dialog?.isConnected)return state.dialog;
    const dialog=document.createElement('dialog');
    dialog.className='k-entity-window';
    dialog.setAttribute('data-kareta-entity-window','');
    dialog.innerHTML=`<div class="k-entity-window__surface"><header class="k-entity-window__head"><div><small>РАБОЧЕЕ ОКНО</small><h2 data-entity-window-title>Карточка</h2></div><button type="button" class="k-entity-window__close" data-entity-window-close aria-label="Закрыть">×</button></header><div class="k-entity-window__body" data-entity-window-body></div></div>`;
    document.body.appendChild(dialog);
    state.dialog=dialog;
    state.body=dialog.querySelector('[data-entity-window-body]');
    state.title=dialog.querySelector('[data-entity-window-title]');
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{
      if(event.target===dialog || event.target.closest('[data-entity-window-close]')){close();return;}
      if(event.target.closest('[data-entity-window-retry]'))open(state.targetHash,{trigger:state.trigger});
    });
    return dialog;
  }

  function context(localLifecycle){
    return {
      state:window.KaretaNext?.state || {},
      api:window.KaretaNext?.api || window.KaretaApiClient,
      lifecycle:localLifecycle,
      appVersion:String(window.KARETA_NEXT_ASSET_VERSION||''),
      route:{path:state.targetHash},
    };
  }

  function setHashSilently(hash){
    try{history.replaceState(history.state,'',hash);}catch(_e){}
  }

  function renderError(message){
    if(!state.body)return;
    state.body.innerHTML=`<section class="k-entity-window__error"><h3>Не удалось открыть окно</h3><p>${esc(message||'Неизвестная ошибка')}</p><div class="k-entity-window__error-actions"><button class="k-btn k-btn-primary" type="button" data-entity-window-retry>Повторить</button><button class="k-btn k-btn-secondary" type="button" data-entity-window-close>Закрыть</button></div></section>`;
  }

  function open(hashValue,{trigger=null}={}){
    const target=String(hashValue||'').trim();
    const meta=descriptor(target);
    if(!meta)return false;
    const dialog=ensureDialog();
    if(!state.baseHash)state.baseHash=String(location.hash||'#/home');
    if(trigger)state.trigger=trigger;
    state.replacing=Boolean(dialog.open);
    cleanupMounted();
    state.targetHash=target;
    setHashSilently(target);
    state.title.textContent=meta.label;
    state.body.innerHTML='<section class="k-entity-window__loading"><span></span><h3>Открываем карточку…</h3></section>';
    if(!dialog.open)dialog.showModal();
    document.documentElement.classList.add('k-entity-window-open');
    const loadController=new AbortController();
    state.controller=loadController;
    (async()=>{
      try{
        const loader=window.KaretaRouteAssetLoader;
        if(loader?.isKnownLazy?.(meta.key)){
          await loader.ensureRoute(meta.key,{signal:loadController.signal});
        }
        if(loadController.signal.aborted||state.targetHash!==target||!dialog.open)return;
        const html=meta.render?.();
        state.body.innerHTML=html || '<section class="k-empty"><h2>Карточка недоступна</h2></section>';
        const lc=lifecycle(loadController);
        const result=meta.mount?.(context(lc));
        if(typeof result==='function')state.cleanups.push(result);
        dialog.scrollTop=0;
        state.body.scrollTop=0;
        try{dialog.querySelector('button,input,a,[tabindex]')?.focus?.({preventScroll:true});}catch(_e){}
        try{window.dispatchEvent(new CustomEvent('kareta:entity-window-open',{detail:{key:meta.key,hash:target,baseHash:state.baseHash}}));}catch(_e){}
      }catch(error){
        if(error?.name==='AbortError'||loadController.signal.aborted)return;
        console.error('[KARETA entity window]',error);
        renderError(error?.message||String(error));
      }
    })();
    return true;
  }

  function close({restore=true}={}){
    if(!state.dialog)return false;
    const base=state.baseHash;
    cleanupMounted();
    if(state.dialog.open){try{state.dialog.close();}catch(_e){}}
    document.documentElement.classList.remove('k-entity-window-open');
    state.targetHash='';
    state.baseHash='';
    if(restore && base)setHashSilently(base);
    const trigger=state.trigger;state.trigger=null;
    try{trigger?.focus?.({preventScroll:true});}catch(_e){}
    try{window.dispatchEvent(new CustomEvent('kareta:entity-window-close',{detail:{baseHash:base}}));}catch(_e){}
    return true;
  }

  function handleClick(event){
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const link=event.target.closest('a[href^="#/"]');
    if(!link || link.hasAttribute('download') || (link.target && link.target!=='_self'))return;
    const target=String(link.getAttribute('href')||'');
    const meta=descriptor(target);
    if(!meta)return;
    const active=currentRoute();
    if(entityKeys.has(active) && !state.dialog?.open)return; // direct/deep-linked entity pages remain valid.
    event.preventDefault();
    event.stopImmediatePropagation();
    open(target,{trigger:link});
  }

  // Capture phase is intentional: entity navigation is resolved before the generic hash router.
  document.addEventListener('click',handleClick,true);
  window.addEventListener('hashchange',()=>{if(state.dialog?.open && String(location.hash)!==state.targetHash)close({restore:false});});

  window.KaretaWindowEngine=Object.freeze({openEntity:open,close,descriptor,isOpen:()=>Boolean(state.dialog?.open),snapshot:()=>({open:Boolean(state.dialog?.open),baseHash:state.baseHash,targetHash:state.targetHash})});
})();
;

/* SOURCE: js/next/client_viewport_runtime.js */
(() => {
  'use strict';

  if (window.__KARETA_CLIENT_VIEWPORT_RUNTIME__) return;
  window.__KARETA_CLIENT_VIEWPORT_RUNTIME__ = { version:'188.5.5.6.84.63' };

  const root = document.documentElement;
  let frame = 0;
  let blurTimer = 0;
  let navResizeObserver = null;
  let navMutationObserver = null;
  let observedNav = null;

  const editable = node => !!node && (
    /^(INPUT|TEXTAREA|SELECT)$/i.test(node.tagName || '') ||
    node.isContentEditable === true ||
    node.closest?.('[contenteditable="true"]')
  );

  function schedule(){
    if(frame) return;
    frame=requestAnimationFrame(()=>{frame=0;sync();});
  }

  function ensureFocusedVisible({keyboardOpen=false,navHeight=0,viewportHeight=0,viewportTop=0}={}){
    const node=document.activeElement;
    if(!editable(node) || typeof node.getBoundingClientRect!=='function') return;
    const rect=node.getBoundingClientRect();
    const topLimit=Math.max(8,viewportTop+10);
    const bottomInset=keyboardOpen?14:Math.max(14,navHeight+14);
    const bottomLimit=Math.max(topLimit+44,viewportTop+viewportHeight-bottomInset);
    if(rect.top>=topLimit && rect.bottom<=bottomLimit) return;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    try{node.scrollIntoView({block:'center',inline:'nearest',behavior:reduce?'auto':'smooth'});}catch(_error){node.scrollIntoView?.();}
  }

  function sync(){
    const vv=window.visualViewport;
    const layoutHeight=Math.max(1,window.innerHeight||document.documentElement.clientHeight||1);
    const layoutWidth=Math.max(1,window.innerWidth||document.documentElement.clientWidth||1);
    const height=Math.max(1,Math.round(vv?.height||layoutHeight));
    const width=Math.max(1,Math.round(vv?.width||layoutWidth));
    const top=Math.max(0,Math.round(vv?.offsetTop||0));
    const left=Math.max(0,Math.round(vv?.offsetLeft||0));
    const bottom=Math.max(0,Math.round(layoutHeight-height-top));
    const focused=editable(document.activeElement);
    const keyboardOpen=focused && (bottom>=88 || height/layoutHeight<0.82);
    const mobile=window.matchMedia?.('(max-width: 900px)')?.matches !== false;
    const nav=document.getElementById('k-mobile-nav');
    const navVisible=mobile && nav && getComputedStyle(nav).display!=='none' && getComputedStyle(nav).visibility!=='hidden';
    const navHeight=navVisible?Math.max(0,Math.ceil(nav.getBoundingClientRect().height)):0;
    const safeNavHeight=navHeight || (mobile?72:0);

    root.style.setProperty('--k-visual-viewport-height',`${height}px`);
    root.style.setProperty('--k-visual-viewport-width',`${width}px`);
    root.style.setProperty('--k-visual-viewport-top',`${top}px`);
    root.style.setProperty('--k-visual-viewport-left',`${left}px`);
    root.style.setProperty('--k-keyboard-inset',`${keyboardOpen?bottom:0}px`);
    root.style.setProperty('--k-mobile-nav-live-height',`${safeNavHeight}px`);
    root.style.setProperty('--k-client-active-bottom-space',keyboardOpen?'0px':`${safeNavHeight}px`);
    root.style.setProperty('--k-client-nav-clearance',`${keyboardOpen?16:safeNavHeight+18}px`);
    document.body?.classList.toggle('k-client-keyboard-open',keyboardOpen);
    if(focused){
      window.setTimeout(()=>ensureFocusedVisible({keyboardOpen,navHeight:safeNavHeight,viewportHeight:height,viewportTop:top}), keyboardOpen?40:0);
    }
  }


  function observeNavigation(){
    const nav=document.getElementById('k-mobile-nav');
    if(!nav || nav===observedNav) return;
    navResizeObserver?.disconnect?.();
    navMutationObserver?.disconnect?.();
    observedNav=nav;
    if('ResizeObserver' in window){
      navResizeObserver=new ResizeObserver(schedule);
      navResizeObserver.observe(nav);
    }
    navMutationObserver=new MutationObserver(schedule);
    navMutationObserver.observe(nav,{attributes:true,childList:true,subtree:true,attributeFilter:['class','style','aria-current','aria-expanded']});
    schedule();
  }

  function onFocus(){
    clearTimeout(blurTimer);
    schedule();
    setTimeout(schedule,70);
    setTimeout(schedule,220);
  }
  function onBlur(){
    clearTimeout(blurTimer);
    blurTimer=setTimeout(schedule,80);
  }

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,80),{passive:true});
  document.addEventListener('focusin',onFocus,true);
  document.addEventListener('focusout',onBlur,true);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',schedule,{passive:true});
    window.visualViewport.addEventListener('scroll',schedule,{passive:true});
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){observeNavigation();schedule();}});
  ['kareta:navigation-changed','kareta:navigation-core-ready','kareta:interface-context-changed','kareta:route-rendered'].forEach(name=>window.addEventListener(name,()=>{observeNavigation();schedule();}));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeNavigation,{once:true});else observeNavigation();
  sync();
})();
;

/* SOURCE: js/next/client_surface_modernization_phase3.js */
(() => {
  'use strict';
  if (window.__KARETA_CLIENT_SURFACE_MODERNIZATION_PHASE3__) return;
  window.__KARETA_CLIENT_SURFACE_MODERNIZATION_PHASE3__={version:'188.5.5.6.84.63'};

  let frame=0;
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;enhanceMore();});};

  function enhanceMore(){
    const root=document.getElementById('k-smart-action-hub');
    const win=root?.querySelector('.k-more-window');
    const main=win?.querySelector('.k-more-window-main');
    if(!root||!win||!main)return false;
    win.setAttribute('role','dialog');
    win.setAttribute('aria-modal','true');
    main.querySelector('.k-more-window-head')?.remove();
    return true;
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-more-close]'))return;
    event.preventDefault();
    window.KaretaSmartActionHub?.close?.();
  });

  const observer=new MutationObserver(schedule);
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});schedule();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  ['kareta:navigation-changed','kareta:route-rendered','kareta:identity-ready'].forEach(name=>window.addEventListener(name,schedule));
})();
;

window.KaretaBootProfiler?.bundleEnd?.("runtime_core_bundle");
