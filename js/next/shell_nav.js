(() => {
  'use strict';
  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry','KaretaDynamicNavigation'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){window.KaretaRuntimeDependencies.deferScript('shell_nav',dependencies,scriptSource);return;}
  if(window.__KARETA_SHELL_NAV_MODULE__){window.__KARETA_SHELL_NAV_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_SHELL_NAV_MODULE__={duplicateLoads:0};
  const registry=window.KaretaRouteRegistry;
  const access=window.KaretaRoleAccess||null;
  const navigation=window.KaretaDynamicNavigation;
  if(!registry||!navigation)return;
  const state={mounted:false,mountCount:0,renderCount:0,activeKey:'home',desktopNode:null,mobileNode:null,signature:'',unreadChats:0};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function routePresentation(key,surface='desktop'){
    const route=registry.get(key);
    const kind=window.KaretaNavigationCore?.contextKind?.()||'anonymous';
    const labels={
      personal:{parts:'Market',orders:'Заявки',cabinet:'Профиль'},
      master:{masterDashboard:'Рабочее место',masterExchange:'Биржа',orders:'Заявки',masterSchedule:'Календарь',community:'Сообщество',parts:'Запчасти',serviceManagement:'Услуги',chats:'Чаты',cabinet:'Аккаунт'},
      organization_service:{stoDashboard:'Главная СТО',orders:'Заказы',masters:'Мастера',workflow:'Производство',serviceManagement:'Услуги',finance:'Выручка / KPI',parts:'Запчасти',chats:'Чаты',cabinet:'Аккаунт'},
      seller:{seller:'Магазин',sellerProducts:'Товары',sellerOrders:'Заказы',market:'Склад',finance:'Финансы',parts:'Витрина',chats:'Чаты',cabinet:'Аккаунт'},
      organization_store:{seller:'Магазин',sellerProducts:'Товары',sellerOrders:'Заказы',market:'Склад',finance:'Финансы',parts:'Витрина',chats:'Чаты',cabinet:'Аккаунт'},
      organization:{orders:'Заказы',workflow:'Производство',calendarBooking:'Календарь',finance:'Финансы',crm:'CRM',chats:'Чаты',cabinet:'Аккаунт'},
      admin:{adminMonitoring:'Мониторинг',adminUsers:'Пользователи',adminOrganizations:'Организации',adminManagement:'Управление',platform:'Платформа'}
    };
    const iconHtml=window.KaretaUIIcons?.routeSvg?.(key)||esc(route.icon);
    const baseLabel=labels[kind]?.[key]||route.label;const resolvedLabel=kind==='master'&&key==='masterDashboard'?'Главная':baseLabel;return {...route,label:resolvedLabel,iconHtml};
  }
  function linkHtml(key,surface='desktop'){if(key==='__more__')return `<button type="button" class="k-nav-link k-nav-more" data-mobile-more aria-label="Открыть быстрые действия" aria-controls="k-smart-action-hub" aria-expanded="false"><span class="k-nav-icon k-nav-more-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="k-nav-label">Ещё</span></button>`;const route=routePresentation(key,surface);const badge=key==='chats'&&state.unreadChats>0?`<b class="k-nav-unread" aria-label="Непрочитанных сообщений: ${state.unreadChats}">${state.unreadChats>99?'99+':state.unreadChats}</b>`:'';return `<a class="k-nav-link" href="${esc(route.path)}" data-route-key="${esc(key)}" data-route-link="${esc(key)}" title="${esc(route.label)}" aria-label="${esc(route.label)}"><span class="k-nav-icon" aria-hidden="true">${route.iconHtml}</span><span class="k-nav-label">${esc(route.label)}</span>${badge}</a>`;}
  function nodes(html){const t=document.createElement('template');t.innerHTML=html.trim();return [...t.content.children];}
  let layoutFrame=0;
  function syncDesktopLayout(){
    if(!state.desktopNode)return;
    if(layoutFrame)cancelAnimationFrame(layoutFrame);
    layoutFrame=requestAnimationFrame(()=>{
      layoutFrame=0;
      const node=state.desktopNode;
      if(!node)return;
      const overflowing=node.scrollWidth>node.clientWidth+2;
      node.classList.toggle('is-overflowing',overflowing);
      node.dataset.overflowing=overflowing?'1':'0';
    });
  }
  function render(){
    if(!state.desktopNode||!state.mobileNode)return false;
    const desktop=window.KaretaNavigationCore?.desktopItems?.()||navigation.items('desktop');const mobile=window.KaretaNavigationCore?.mobileItems?.()||navigation.items('mobile');
    const identity=window.KaretaIdentity?.snapshot?.()||{};
    const signature=`${identity.context?.key||'anon'}|${desktop.join(',')}|${mobile.join(',')}|${state.unreadChats}`;
    if(signature===state.signature)return true;
    state.desktopNode.replaceChildren(...nodes(desktop.map(key=>linkHtml(key,'desktop')).join('')));
    state.mobileNode.replaceChildren(...nodes(mobile.map(key=>linkHtml(key,'mobile')).join('')));state.mobileNode.style.setProperty('--k-mobile-nav-count',String(Math.max(1,mobile.length)));state.mobileNode.querySelector('[data-mobile-more]')?.addEventListener('click',()=>window.KaretaSmartActionHub?.toggle?.());
    state.desktopNode.style.setProperty('--k-desktop-nav-count',String(Math.max(1,desktop.length)));
    state.signature=signature;state.renderCount+=1;setActive(state.activeKey);syncDesktopLayout();return true;
  }
  function mount(options={}){const desktop=document.querySelector(options.desktopSelector||'#k-desktop-nav');const mobile=document.querySelector(options.mobileSelector||'#k-mobile-nav');if(!desktop||!mobile)return false;if(!state.mounted||desktop!==state.desktopNode||mobile!==state.mobileNode){state.desktopNode=desktop;state.mobileNode=mobile;state.mounted=true;state.mountCount+=1;state.signature='';}render();setActive(options.activeKey||state.activeKey);return true;}
  function refresh(options={}){if(!state.mounted)return mount(options);state.signature='';render();setActive(options.activeKey||state.activeKey);return true;}
  function setActive(routeKey){
    if(routeKey==='notFound'){
      state.activeKey='notFound';
      document.querySelectorAll('#k-desktop-nav .k-nav-link,#k-mobile-nav .k-nav-link').forEach(link=>{
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      });
      document.querySelector('#k-mobile-nav [data-mobile-more]')?.setAttribute('aria-expanded','false');
      return;
    }
    const identityMode=window.KaretaIdentity?.snapshot?.()?.mode==='identity';
    const requested=registry.has(routeKey)?routeKey:(window.KaretaNavigationCore?.defaultRoute?.()||navigation.defaultRoute());
    let key=identityMode?(window.KaretaNavigationCore?.resolveRoute?.(requested)||(navigation.canAccess(requested)?requested:navigation.defaultRoute())):(access?.resolve?.(requested)||navigation.resolve?.(requested)||requested);
    const kind=window.KaretaNavigationCore?.contextKind?.()||'anonymous';
    if(['personal','master'].includes(kind)&&['workOrder','requestNew','workflow'].includes(key))key='orders';
    if(['organization_service','organization'].includes(kind)&&['workOrder','requestNew'].includes(key))key='orders';
    if(['personal','master','organization_service','organization_store','seller'].includes(kind)&&key==='productDetail')key='parts';
    if(kind==='personal'&&key==='serviceDetail')key='services';
    if(kind==='personal'&&key==='providerDetail')key='masters';
    if(kind==='master'&&['masterNews','masterNewsCreate','masterNewsEdit'].includes(key))key='community';

    const personalMoreKeys=new Set(['cabinetGarage']);
    const desktopKey=kind==='personal'&&personalMoreKeys.has(key)?'cabinet':key;
    const mobileKey=kind==='personal'&&personalMoreKeys.has(key)?'__more__':key;
    state.activeKey=key;

    document.querySelectorAll('#k-desktop-nav [data-route-link]').forEach(link=>{
      const active=(link.dataset.routeKey||link.dataset.routeLink)===desktopKey;
      link.classList.toggle('is-active',active);
      active?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');
    });
    document.querySelectorAll('#k-mobile-nav [data-route-link]').forEach(link=>{
      const active=(link.dataset.routeKey||link.dataset.routeLink)===mobileKey;
      link.classList.toggle('is-active',active);
      active?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');
    });
    const moreButton=document.querySelector('#k-mobile-nav [data-mobile-more]');
    if(moreButton){
      const active=mobileKey==='__more__';
      moreButton.classList.toggle('is-active',active);
      active?moreButton.setAttribute('aria-current','page'):moreButton.removeAttribute('aria-current');
    }
  }
  function setUnreadChats(count){const next=Math.max(0,Number(count)||0);if(next===state.unreadChats)return;state.unreadChats=next;refresh();}
  function audit(){const desktop=window.KaretaNavigationCore?.desktopItems?.()||navigation.items('desktop');const mobile=window.KaretaNavigationCore?.mobileItems?.()||navigation.items('mobile');const result={ok:state.mounted&&desktop.every(registry.has)&&mobile.every(key=>key==='__more__'||registry.has(key)),mounted:state.mounted,mountCount:state.mountCount,renderCount:state.renderCount,activeKey:state.activeKey,desktopKeys:desktop,mobileKeys:mobile,at:Date.now()};window.KaretaShellNavAudit=result;return result;}
  ['kareta:identity-ready','kareta:capabilities-changed','kareta:context-changed','kareta:navigation-changed'].forEach(name=>window.addEventListener(name,()=>refresh()));
  window.addEventListener('kareta:chat-unread',event=>setUnreadChats(event.detail?.count));
  window.addEventListener('resize',syncDesktopLayout,{passive:true});
  window.addEventListener('pageshow',syncDesktopLayout,{passive:true});
  window.KaretaShellNav=Object.freeze({mount,refresh,setActive,setUnreadChats,audit,getRouteMeta:()=>registry.routes,getState:()=>({...state})});
})();
