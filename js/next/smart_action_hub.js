(() => {
  'use strict';
  const MORE_WINDOW_CONTRACT='KARETA_MORE_WINDOW_V1_2';
  const ACTIONS=Object.freeze({
    anonymous:Object.freeze([
      {key:'services',label:'Услуги',icon:'services'},
      {key:'works',label:'Сообщество',icon:'community'},
      {key:'masters',label:'Мастера',icon:'masters'},
      {key:'parts',label:'Запчасти',icon:'parts'},
      {key:'about',label:'О платформе',icon:'info'},
      {key:'help',label:'Помощь',icon:'help'}
    ]),
    personal:Object.freeze([
      {key:'orders',label:'Мои заявки',icon:'orders'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'cabinetGarage',label:'Автомобили',icon:'car'},
      {key:'following',label:'Подписки',icon:'following'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'},
      {key:'help',label:'Помощь',icon:'help'}
    ]),
    master:Object.freeze([
      {key:'masterDashboard',label:'Рабочее место',icon:'work'},
      {key:'masterSchedule',label:'Календарь',icon:'calendar'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'orders',label:'Мои заказы',icon:'orders'},
      {key:'following',label:'Подписки',icon:'following'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'}
    ]),
    organization_service:Object.freeze([
      {key:'orders',label:'Заказы',icon:'orders'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'calendarBooking',label:'Календарь',icon:'calendar'},
      {key:'workflow',label:'Процессы',icon:'work'},
      {key:'finance',label:'Финансы',icon:'finance'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'}
    ]),
    seller:Object.freeze([
      {key:'sellerProducts',label:'Товары',icon:'parts'},
      {key:'sellerOrders',label:'Заказы',icon:'orders'},
      {key:'market',label:'Склад',icon:'warehouse'},
      {key:'finance',label:'Финансы',icon:'finance'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'}
    ]),
    organization_store:Object.freeze([
      {key:'sellerProducts',label:'Товары',icon:'parts'},
      {key:'sellerOrders',label:'Заказы',icon:'orders'},
      {key:'market',label:'Склад',icon:'warehouse'},
      {key:'finance',label:'Финансы',icon:'finance'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'}
    ]),
    organization:Object.freeze([
      {key:'orders',label:'Заказы',icon:'orders'},
      {key:'calendarBooking',label:'Календарь',icon:'calendar'},
      {key:'finance',label:'Финансы',icon:'finance'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'},
      {key:'help',label:'Помощь',icon:'help'}
    ]),
    admin:Object.freeze([
      {key:'adminMonitoring',label:'Мониторинг',icon:'view'},
      {key:'adminUsers',label:'Пользователи',icon:'users'},
      {key:'adminOrganizations',label:'Организации',icon:'work'},
      {key:'corePlatform',label:'Ядро',icon:'core'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'},
      {key:'cabinetSettings',label:'Настройки',icon:'settings'}
    ])
  });
  const state={open:false,layout:'honeycomb',loaded:true,root:null,lastFocus:null,unreadChats:0,unreadNotifications:0,switching:false,switchLabel:'',error:''};
  const registry=()=>window.KaretaRouteRegistry;
  const identity=()=>window.KaretaIdentity?.snapshot?.()||{};
  const kind=()=>window.KaretaNavigationCore?.contextKind?.()||'anonymous';
  const supported=()=>Object.hasOwn(ACTIONS,kind());
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iconSvg=name=>window.KaretaUIIcons?.svg?.(name)||'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle></svg>';
  const roleLabel=()=>({anonymous:'Гость',personal:'Клиент',master:'Мастер',organization_service:'СТО',seller:'Магазин',organization_store:'Магазин',organization:'Организация',admin:'Администратор'})[kind()]||'Клиент';
  const profileTitle=()=>{const snap=identity();const user=window.KaretaNext?.state?.user||{};return String(snap.account?.name||user.name||user.fullname||snap.context?.label||'Личный профиль');};
  const avatarUrl=()=>{const snap=identity();const user=window.KaretaNext?.state?.user||{};return String(snap.account?.avatarUrl||snap.account?.avatar_url||user.avatarUrl||user.avatar_url||'').trim();};
  function initials(){const value=profileTitle().replace(/[^\p{L}\p{N}\s]/gu,' ').trim();return value.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'K';}
  function actions(){return ACTIONS[kind()]||ACTIONS.anonymous;}
  function routeAllowed(key){const nav=window.KaretaDynamicNavigation;return Boolean(registry()?.has?.(key)&&(nav?.canAccess?.(key)||['cabinet','cabinetGarage','cabinetSettings','following','notifications','help','about'].includes(key)));}
  function badge(item){const n=item.badge==='chat'?state.unreadChats:item.badge==='notifications'?state.unreadNotifications:0;return n>0?`<b class="k-more-window-badge">${n>99?'99+':n}</b>`:'';}
  function actionMarkup(item,index){const allowed=routeAllowed(item.key);return `<button type="button" class="k-more-window-action k-more-window-action--${index+1}" data-smart-action-route="${esc(item.key)}" ${allowed?'':'disabled aria-disabled="true"'}><span class="k-more-window-action__inside"><span class="k-more-window-action__icon">${iconSvg(item.icon)}</span><span>${esc(item.label)}</span></span>${badge(item)}</button>`;}
  function contextLabel(c){if(c.type==='personal')return'Клиент';const p=String(c.profileType||c.profile_type||'').toLowerCase();if(p==='master')return'Мастер';if(p==='seller')return'Магазин';if(String(c.organizationType||c.organization_type||'').includes('store'))return'Магазин';return'СТО';}
  function ensure(){
    if(state.root&&document.body.contains(state.root))return state.root;
    const root=document.createElement('div');root.id='k-smart-action-hub';root.className='k-smart-action-hub k-more-window-host';root.hidden=true;root.dataset.contract=MORE_WINDOW_CONTRACT;
    root.innerHTML=`<section class="k-more-window" role="region" aria-label="Ещё"><main class="k-more-window-main"><button type="button" class="k-more-window-profile" data-smart-action-route="cabinet"><span class="k-more-window-avatar" data-more-avatar></span><span class="k-more-window-profile__body"><span class="k-more-window-profile__context" data-more-context></span><strong data-more-profile-title></strong><span class="k-more-window-profile__meta"><span>${iconSvg('phone')}<i data-more-profile-phone>Телефон не указан</i></span><span>${iconSvg('location')}<i data-more-profile-city>Город не указан</i></span></span><span class="k-more-window-profile__stats"><span><b data-more-profile-vehicles>0</b><small>авто</small></span><span><b data-more-profile-promos>0</b><small>акции</small></span><span><b data-more-profile-chats>0</b><small>чаты</small></span></span></span><span class="k-more-window-profile__chevron">${iconSvg('chevronRight')}</span></button><div class="k-more-window-summary"><button type="button" class="k-more-window-summary-card" data-smart-action-route="cabinetGarage"><span class="k-more-window-summary-card__icon">${iconSvg('car')}</span><span><b>Гараж</b><small>Мои автомобили</small></span><strong data-more-garage-count>0</strong></button><button type="button" class="k-more-window-summary-card" data-smart-action-route="cabinetPromos"><span class="k-more-window-summary-card__icon">${iconSvg('discount')}</span><span><b>Акции</b><small>Выгодные предложения</small></span><strong data-more-promo-count>0</strong></button></div><section class="k-more-window-quick"><h2>Быстрый доступ</h2><div class="k-more-window-hub" data-more-actions></div></section><aside class="k-more-window-support"><span class="k-more-window-support__icon">${iconSvg('help')}</span><span><strong>Поддержка KARETA.KZ</strong><small>Мы поможем решить любой вопрос</small></span><button type="button" data-smart-action-route="help">Написать</button></aside><button type="button" class="k-more-window-logout" data-more-logout hidden>Выйти из аккаунта</button><div class="k-more-window-status" data-more-status role="alert" hidden><span data-more-status-text></span><button type="button" data-more-retry>Повторить</button></div></main></section>`;
    document.body.appendChild(root);
    root.addEventListener('click',async event=>{
      const logout=event.target.closest('[data-more-logout]');
      if(logout){
        logout.disabled=true;
        try{await window.KaretaIdentity.logout();close();}
        catch(_error){state.error='Не удалось выйти из аккаунта. Проверьте соединение и повторите.';render();}
        finally{logout.disabled=false;}
        return;
      }
      const retry=event.target.closest('[data-more-retry]');if(retry){state.error='';render();return;}
      const route=event.target.closest('[data-smart-action-route]');if(route&&!route.disabled){const key=route.dataset.smartActionRoute;close();navigate(key);return;}
    });
    state.root=root;return root;
  }

  function navigate(key){if(window.KaretaRouteRuntime?.navigate)window.KaretaRouteRuntime.navigate(key,{source:'more-window'});else{const route=registry()?.get?.(key);if(route?.path)location.hash=route.path;}}
  function render(){
    const root=ensure(),snap=identity(),items=actions();
    root.dataset.contextKind=kind();root.dataset.layout='honeycomb';
    const avatar=root.querySelector('[data-more-avatar]'),url=avatarUrl();if(avatar)avatar.innerHTML=url?`<img src="${esc(url)}" alt="" onerror="this.remove();this.parentElement.textContent='${esc(initials())}'">`:esc(initials());
    const context=root.querySelector('[data-more-context]');if(context)context.textContent=roleLabel();
    const title=root.querySelector('[data-more-profile-title]');if(title)title.textContent=profileTitle();
    const user=window.KaretaNext?.state?.user||{};
    const vehicleRows=user.vehicles||user.garage||window.KaretaNext?.state?.vehicles||[];
    const promoRows=window.KaretaNext?.state?.promotions||window.KaretaNext?.state?.offers||[];
    const vehicleCount=Array.isArray(vehicleRows)?vehicleRows.length:Number(user.vehicleCount||user.vehiclesCount||0)||0;
    const promotionCount=Array.isArray(promoRows)?promoRows.length:Number(user.promotionCount||user.promotionsCount||0)||0;
    const phone=String(snap.account?.phone||snap.person?.phone||user.phone||user.phoneNumber||'').trim();
    const city=String(user.city||user.location||snap.context?.city||snap.account?.city||'').trim();
    const phoneNode=root.querySelector('[data-more-profile-phone]');if(phoneNode)phoneNode.textContent=phone||'Телефон не указан';
    const cityNode=root.querySelector('[data-more-profile-city]');if(cityNode)cityNode.textContent=city||'Город не указан';
    const profileVehicles=root.querySelector('[data-more-profile-vehicles]');if(profileVehicles)profileVehicles.textContent=String(vehicleCount);
    const profilePromos=root.querySelector('[data-more-profile-promos]');if(profilePromos)profilePromos.textContent=String(promotionCount);
    const profileChats=root.querySelector('[data-more-profile-chats]');if(profileChats)profileChats.textContent=String(state.unreadChats||0);
    const garageCount=root.querySelector('[data-more-garage-count]');if(garageCount)garageCount.textContent=String(vehicleCount);
    const promoCount=root.querySelector('[data-more-promo-count]');if(promoCount)promoCount.textContent=String(promotionCount);
    const box=root.querySelector('[data-more-actions]');if(box)box.innerHTML=items.map(actionMarkup).join('')+`<span class="k-more-window-core" aria-hidden="true">${iconSvg('car')}</span>`;
    const support=root.querySelector('.k-more-window-support');if(support)support.hidden=kind()==='master';
    const logout=root.querySelector('[data-more-logout]');if(logout)logout.hidden=!Boolean(snap.authenticated||user.phone);
    const quickTitle=root.querySelector('.k-more-window-quick h2');if(quickTitle)quickTitle.textContent=kind()==='master'?'Инструменты':'Быстрый доступ';
    const status=root.querySelector('[data-more-status]');if(status){const text=status.querySelector('[data-more-status-text]');status.hidden=!state.error;if(text)text.textContent=state.error||'';}
  }
  function setMoreButtonState(active){document.querySelectorAll('[data-mobile-more]').forEach(button=>{button.classList.toggle('is-active',active);button.setAttribute('aria-expanded',active?'true':'false');});}
  async function switchAccountContext(id){if(!id||state.switching)return;const snap=identity(),target=snap.contexts?.find?.(c=>String(c.id||c.key)===String(id));state.switching=true;state.switchLabel=contextLabel(target||{});render();try{await window.KaretaNavigationCore?.switchContext?.(id);window.KaretaToast?.success?.(`Режим «${state.switchLabel}» включён`);close();}catch(e){window.KaretaToast?.error?.(e.message||'Не удалось сменить аккаунт');}finally{state.switching=false;state.switchLabel='';render();}}
  async function open(){if(!supported())return false;window.KaretaShellMenu?.close?.();const root=ensure();render();state.lastFocus=document.activeElement;root.hidden=false;requestAnimationFrame(()=>{root.classList.add('is-open');root.querySelector('.k-more-window-profile')?.focus?.();});state.open=true;setMoreButtonState(true);document.documentElement.classList.add('k-smart-action-open');return true;}
  function close(){const root=ensure(),wasOpen=state.open;root.classList.remove('is-open');state.open=false;setMoreButtonState(false);document.documentElement.classList.remove('k-smart-action-open');window.setTimeout(()=>{if(!state.open)root.hidden=true;},180);if(wasOpen)try{state.lastFocus?.focus?.({preventScroll:true});}catch(_e){}state.lastFocus=null;}
  function toggle(){return state.open?close():open();}
  function setUnread(type,count){const n=Math.max(0,Number(count)||0);if(type==='chat')state.unreadChats=n;if(type==='notifications')state.unreadNotifications=n;render();}
  function setLayout(){state.layout='honeycomb';return state.layout;}
  async function loadPreference(){state.layout='honeycomb';return state.layout;}
  async function savePreference(){state.layout='honeycomb';return state.layout;}
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)close();});
  window.addEventListener('hashchange',()=>{if(state.open)close();});
  window.addEventListener('kareta:routechange',()=>{if(state.open)close();});
  window.addEventListener('kareta:context-changed',()=>{if(state.open)render();});
  window.addEventListener('kareta:identity-ready',()=>{if(state.open)render();});
  window.addEventListener('kareta:session-anonymous',()=>{state.unreadChats=0;state.unreadNotifications=0;state.error='';if(state.open)close();});
  window.addEventListener('kareta:chat-unread',e=>setUnread('chat',e.detail?.count));
  window.addEventListener('kareta:notification-unread',e=>setUnread('notifications',e.detail?.count));
  window.KaretaSmartActionHub=Object.freeze({open,close,toggle,setLayout,savePreference,loadPreference,switchAccountContext,snapshot:()=>({...state,root:undefined})});
})();
