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
      <section class="k-home-ref-section" data-home-section="nearby"><header class="k-home-ref-section__head"><h2>Рядом с вами</h2><div class="k-home-ref-section__tools"><button type="button" data-home-nearby-map>${homeRefIcon('location')}<span>Карта</span></button><a href="#/masters?type=sto">Все <span aria-hidden="true">${homeRefIcon('chevronRight')}</span></a></div></header><div class="k-home-ref-nearby" data-home-nearby><div class="k-home-ref-place k-home-ref-place--loading" aria-hidden="true"></div><div class="k-home-ref-place k-home-ref-place--loading" aria-hidden="true"></div></div></section>
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
    const nearbyMapButton=document.querySelector('[data-home-nearby-map]');
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
    let geoNearby=new Map();
    let nearbyRows=[];
    let geoRequestSeq=0;
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

    const allRows=()=>[
      ...(Array.isArray(catalog.stos)?catalog.stos:[]).map(row=>({...row,type:row.type||'sto'})),
      ...(Array.isArray(catalog.masters)?catalog.masters:[]).map(row=>({...row,type:row.type||'master'}))
    ];
    const geoKey=row=>`${String(row.type||'')}:${String(row.id||'')}`;
    const loadGeoNearby=async()=>{
      if(!userCoords||!api?.request){geoNearby=new Map();return;}
      const seq=++geoRequestSeq;
      const lat=Number(userCoords.lat),lng=Number(userCoords.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)){geoNearby=new Map();return;}
      try{
        const url=`api/geo.php?action=nearby&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radiusKm=100&types=sto,master,shop&limit=100`;
        const result=await api.request(url,{method:'GET',cacheTtlMs:15000,cacheKey:`geo.nearby.home.${lat.toFixed(3)}.${lng.toFixed(3)}`});
        if(disposed||seq!==geoRequestSeq)return;
        const payload=result?.payload?.data||result?.payload||{};
        const items=Array.isArray(payload.items)?payload.items:[];
        geoNearby=new Map(items.map(item=>[`${String(item.ownerType||'')}:${String(item.ownerId||'')}`,item]));
      }catch(_error){if(seq===geoRequestSeq)geoNearby=new Map();}
    };
    const renderNearby=()=>{if(!nearbyNode)return;const cityKey=normalizeCity(selectedCity),seen=new Set();nearbyRows=allRows().filter(row=>{const key=geoKey(row);if(seen.has(key))return false;seen.add(key);return true;}).map(row=>{const copy={...row};const point=geoNearby.get(geoKey(copy)),coords=rowCoords(row);copy.distanceKm=point&&Number.isFinite(Number(point.distanceKm))?Number(point.distanceKm):(userCoords&&coords?haversine(userCoords.lat,userCoords.lng,coords[0],coords[1]):null);if(point){copy.service_lat=point.latitude;copy.service_lng=point.longitude;if(!safeText(copy.address)&&safeText(point.address))copy.address=point.address;}copy.sameCity=!cityKey||normalizeCity(row.city)===cityKey;return copy;}).sort((a,b)=>{const ad=Number(a.distanceKm),bd=Number(b.distanceKm),af=Number.isFinite(ad),bf=Number.isFinite(bd);if(af!==bf)return af?-1:1;if(af&&bf&&ad!==bd)return ad-bd;if(a.sameCity!==b.sameCity)return a.sameCity?-1:1;return Number(b.rating||0)-Number(a.rating||0);});const rows=nearbyRows.slice(0,2);nearbyNode.innerHTML=rows.length?rows.map(homeNearbyCard).join(''):'<div class="k-home-ref-nearby-empty">Пока нет доступных исполнителей рядом.</div>';};
    const renderCities=()=>{if(!cityChoices)return;const cities=[selectedCity,...allRows().map(row=>safeText(row.city))].filter(Boolean).filter((city,index,arr)=>arr.findIndex(x=>normalizeCity(x)===normalizeCity(city))===index).sort((a,b)=>a.localeCompare(b,'ru'));cityChoices.innerHTML=cities.map(city=>`<button type="button" class="${normalizeCity(city)===normalizeCity(selectedCity)?'is-active':''}" data-home-city-value="${esc(city)}">${esc(city)}</button>`).join('')||'<span>Города появятся после загрузки каталога.</span>';};
    const setLocationStatus=(message,type='info')=>{if(!locationStatus)return;locationStatus.hidden=!message;locationStatus.textContent=message||'';locationStatus.dataset.type=type;};
    const openLocation=()=>{renderCities();setLocationStatus('');if(locationDialog&&!locationDialog.open)locationDialog.showModal?.();};
    const closeLocation=()=>{if(locationDialog?.open)locationDialog.close?.();};
    const openNearbyMap=async()=>{if(!nearbyMapButton||disposed)return;nearbyMapButton.disabled=true;try{if(!userCoords){const point=await resolveCurrentLocation();if(disposed)return;userCoords={lat:point.lat,lng:point.lng};saveLocation();}await loadGeoNearby();if(disposed)return;renderNearby();const providerPoints=nearbyRows.filter(row=>{const coords=rowCoords(row);return !!coords&&geoNearby.has(geoKey(row));}).map(row=>{const coords=rowCoords(row),type=String(row.type||'master'),id=String(row.id||''),profile='#/masters/profile/'+(type==='sto'?'sto':'master')+'/'+encodeURIComponent(id),book=type==='sto'?profile:'#/masters/book/master/'+encodeURIComponent(id);return {id:geoKey(row),label:safeText(row.name)||(type==='sto'?'СТО':'Мастер'),address:safeText(row.address),city:safeText(row.city),distanceKm:Number(row.distanceKm),latitude:coords[0],longitude:coords[1],kind:type,route:true,actions:[{label:'Профиль',href:profile},{label:'Записаться',href:book,primary:true}]};});const shopPoints=[...geoNearby.values()].filter(point=>String(point?.ownerType||'')==='shop'&&String(point?.kind||'')==='pickup'&&Number.isFinite(Number(point?.latitude))&&Number.isFinite(Number(point?.longitude))).map(point=>{const publicId=Number(point.publicId||0);return {id:'shop:'+String(point.ownerId||point.id||''),label:safeText(point.label)||'Магазин запчастей',address:safeText(point.address),city:safeText(point.city),distanceKm:Number(point.distanceKm),latitude:Number(point.latitude),longitude:Number(point.longitude),kind:'shop',route:true,actions:publicId>0?[{label:'Товары',href:'#/parts/store/'+encodeURIComponent(String(publicId)),primary:true}]:[]};});const mapPoints=[...providerPoints,...shopPoints].sort((a,b)=>Number(a.distanceKm||9999)-Number(b.distanceKm||9999)).slice(0,49);if(!mapPoints.length)throw new Error('GEO_MAP_NO_POINTS');const geoMap=await window.KaretaMobile?.loadGeoMap?.();if(!geoMap?.open)throw new Error('GEO_MAP_UNAVAILABLE');geoMap.open({title:'Рядом с вами',points:[{id:'user',label:'Вы',latitude:userCoords.lat,longitude:userCoords.lng,user:true,kind:'you',route:false},...mapPoints],center:{latitude:userCoords.lat,longitude:userCoords.lng}});}catch(error){const denied=error?.code===1||error?.code==='GEOLOCATION_PERMISSION_DENIED';window.KaretaToast?.error?.(denied?'Разрешите доступ к геопозиции для карты':error?.message==='GEO_MAP_NO_POINTS'?'Публичных точек рядом пока нет':'Карта временно недоступна');}finally{nearbyMapButton.disabled=false;}};
    locationButton?.addEventListener('click',openLocation);
    nearbyMapButton?.addEventListener('click',openNearbyMap);
    locationClose?.addEventListener('click',closeLocation);
    locationDialog?.addEventListener('cancel',event=>{event.preventDefault();closeLocation();});
    cityChoices?.addEventListener('click',event=>{const button=event.target.closest('[data-home-city-value]');if(!button)return;selectedCity=safeText(button.dataset.homeCityValue)||selectedCity;userCoords=null;geoNearby=new Map();geoRequestSeq+=1;if(cityNode)cityNode.textContent=selectedCity;saveLocation();renderCities();renderNearby();closeLocation();});
    const resolveCurrentLocation=async()=>{
      const mobile=window.KaretaMobile;
      if(mobile?.bestLocation){
        const point=await mobile.bestLocation({enableHighAccuracy:false,timeout:8000,maximumAge:300000});
        return {lat:Number(point.latitude),lng:Number(point.longitude),source:point.source||'unknown'};
      }
      if(!navigator.geolocation)throw Object.assign(new Error('GEOLOCATION_UNAVAILABLE'),{code:'GEOLOCATION_UNAVAILABLE'});
      return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(position=>resolve({lat:Number(position.coords.latitude),lng:Number(position.coords.longitude),source:'browser'}),reject,{enableHighAccuracy:false,timeout:8000,maximumAge:300000}));
    };
    locationDetect?.addEventListener('click',async()=>{locationDetect.disabled=true;setLocationStatus('Определяем местоположение…');try{const point=await resolveCurrentLocation();if(disposed)return;userCoords={lat:point.lat,lng:point.lng};saveLocation();await loadGeoNearby();if(disposed)return;setLocationStatus('Геопозиция определена. Расстояния пересчитаны.','success');renderNearby();window.setTimeout(closeLocation,500);}catch(error){const denied=error?.code===1||error?.code==='GEOLOCATION_PERMISSION_DENIED';setLocationStatus(denied?'Доступ к геопозиции не разрешён. Выберите город вручную.':'Не удалось определить геопозицию. Выберите город вручную.','error');}finally{locationDetect.disabled=false;}});

    (async()=>{if(homeInterfaceRole(context)!=='client')return;try{if(cabinetApi?.get){const result=await cabinetApi.get();if(result?.ok)applyProfile(result.payload?.data||result.payload||{});}else if(api?.request){const result=await api.request('api/db.php?action=clientCabinet.get',{cacheTtlMs:15000,cacheKey:'client.cabinet.home'});if(result?.ok)applyProfile(result.payload?.data||result.payload||{});}}catch(_error){}})();
    (async()=>{if(!nearbyNode||!api?.request)return;try{const result=await api.request('api/db.php?action=masters.catalog',{cacheTtlMs:30000,cacheKey:'masters.catalog.home'});if(disposed)return;const payload=result?.payload?.data||result?.payload||{};catalog={stos:Array.isArray(payload.stos)?payload.stos:Array.isArray(payload.stations)?payload.stations:[],masters:Array.isArray(payload.masters)?payload.masters:[]};renderCities();if(userCoords)await loadGeoNearby();if(disposed)return;renderNearby();}catch(_error){if(!disposed&&nearbyNode)nearbyNode.innerHTML='<div class="k-home-ref-nearby-empty">Не удалось загрузить ближайшие СТО. Откройте каталог исполнителей.</div>';}})();

    const feedCleanups=[bindHomeSlider(worksRail),bindHomeSlider(communityRail)];
    const renderFeedError=(rail,message)=>{if(rail)rail.innerHTML=`<div class="k-home-feed-empty">${esc(message)}</div>`;};
    (async()=>{if(!worksRail||!api?.getWorkPosts)return;try{const result=await api.getWorkPosts({limit:4},{signal:context.lifecycle?.signal});if(disposed)return;if(!result?.ok)throw new Error('work_feed_failed');const payload=result.payload?.data||result.payload||{};const rows=(Array.isArray(payload.items)?payload.items:Array.isArray(payload.posts)?payload.posts:Array.isArray(payload.works)?payload.works:[]).slice(0,4);worksRail.innerHTML=rows.length?rows.map(homeWorkCard).join(''):'<div class="k-home-feed-empty">Работы мастеров появятся после первых публикаций.</div>';}catch(_error){if(!disposed)renderFeedError(worksRail,'Не удалось загрузить последние работы.');}})();
    (async()=>{if(!communityRail||!api)return;try{const [newsResult,wallResult]=await Promise.allSettled([api.getNews?.({limit:4},{signal:context.lifecycle?.signal}),api.request?.('api/db.php?action=masterSocialWall.community&limit=4',{method:'GET',cacheTtlMs:12000,signal:context.lifecycle?.signal})]);if(disposed)return;const rows=[];if(newsResult.status==='fulfilled'&&newsResult.value?.ok){const payload=newsResult.value.payload?.data||newsResult.value.payload||{};(Array.isArray(payload.items)?payload.items:Array.isArray(payload.news)?payload.news:[]).forEach(item=>rows.push({...item,__source:'news'}));}if(wallResult.status==='fulfilled'&&wallResult.value?.ok){const payload=wallResult.value.payload?.data||wallResult.value.payload||{};(Array.isArray(payload.items)?payload.items:[]).forEach(item=>rows.push({...item,__source:'wall'}));}rows.sort((a,b)=>{const av=new Date(String(a.publishedAt||a.published_at||a.createdAt||a.created_at||0).replace(' ','T')).getTime()||0;const bv=new Date(String(b.publishedAt||b.published_at||b.createdAt||b.created_at||0).replace(' ','T')).getTime()||0;return bv-av;});const latest=rows.slice(0,4);communityRail.innerHTML=latest.length?latest.map(homeCommunityCard).join(''):'<div class="k-home-feed-empty">Новые публикации сообщества появятся здесь.</div>';}catch(_error){if(!disposed)renderFeedError(communityRail,'Не удалось загрузить публикации сообщества.');}})();

    return()=>{disposed=true;promoCleanup?.();form.removeEventListener('submit',submit);feedCleanups.forEach(fn=>fn?.());locationButton?.removeEventListener('click',openLocation);nearbyMapButton?.removeEventListener('click',openNearbyMap);locationClose?.removeEventListener('click',closeLocation);};
  }

  window.KaretaCorePages = Object.freeze({ renderHome, mountHome });
})();
