/* KARETA R188.5.5.6.84.85 GENERATED BOOT BUNDLE — source order preserved. */
window.KaretaBootProfiler?.bundleStart?.("runtime_shell_bundle","js/boot/runtime_shell_bundle.js");

/* SOURCE: js/next/navigation_core.js */
(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry','KaretaDynamicNavigation'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){window.KaretaRuntimeDependencies.deferScript('navigation_core',dependencies,scriptSource);return;}
  if (window.__KARETA_NAVIGATION_CORE_MODULE__) {
    window.__KARETA_NAVIGATION_CORE_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_NAVIGATION_CORE_MODULE__ = { duplicateLoads:0 };

  const registry = window.KaretaRouteRegistry;
  const navigation = window.KaretaDynamicNavigation;
  if (!registry || !navigation) throw new Error('Navigation Core dependencies are missing');

  const CONTEXT_TEMPLATES = Object.freeze({
    admin: Object.freeze(['adminMonitoring','adminUsers','adminOrganizations','adminManagement','platform','__more__']),
    personal: Object.freeze(['home','services','works','masters','parts','__more__']),
    master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__']),
    seller: Object.freeze(['seller','sellerProducts','sellerOrders','parts','chats','__more__']),
    organization_service: Object.freeze(['stoDashboard','orders','masters','parts','__more__']),
    organization_store: Object.freeze(['seller','sellerProducts','sellerOrders','parts','chats','__more__']),
    organization: Object.freeze(['orders','calendarBooking','finance','chats','__more__']),
    anonymous: Object.freeze(['home','works','masters','parts','__more__']),
  });

  // Desktop navigation is context-owned just like the mobile shell. Public routes may
  // remain accessible to every account, but they must not make Client and Master
  // headers look identical.
  const DESKTOP_TEMPLATES = Object.freeze({
    admin: Object.freeze(['adminMonitoring','adminUsers','adminOrganizations','adminManagement','platform']),
    personal: Object.freeze(['home','services','community','masters','parts','orders','chats']),
    master: Object.freeze(['masterDashboard','masterExchange','orders','masterSchedule','serviceManagement','parts','community','chats','cabinet']),
    seller: Object.freeze(['seller','sellerProducts','sellerOrders','market','finance','parts','chats','cabinet']),
    organization_service: Object.freeze(['stoDashboard','orders','masters','workflow','serviceManagement','finance','parts','chats','cabinet']),
    organization_store: Object.freeze(['seller','sellerProducts','sellerOrders','market','finance','parts','chats','cabinet']),
    organization: Object.freeze(['orders','workflow','calendarBooking','finance','crm','chats','cabinet']),
    anonymous: Object.freeze(['home','services','community','masters','parts']),
  });

  const ACTIONS = Object.freeze({
    admin: Object.freeze({ key:'adminMonitoring', label:'Открыть мониторинг', icon:'monitor' }),
    personal: Object.freeze({ key:'requestNew', label:'Создать заявку', icon:'plus' }),
    master: Object.freeze({ key:'orders', label:'Открыть заявки', icon:'orders' }),
    seller: Object.freeze({ key:'seller', label:'Управлять магазином', icon:'store' }),
    organization_service: Object.freeze({ key:'orders', label:'Создать заказ', icon:'plus' }),
    organization_store: Object.freeze({ key:'sellerProducts', label:'Добавить товар', icon:'plus' }),
    organization: Object.freeze({ key:'orders', label:'Открыть заказы', icon:'orders' }),
    anonymous: Object.freeze({ key:'services', label:'Найти услугу', icon:'services' }),
  });

  const state = { switching:false, revision:0, lastContextKey:'', lastError:'', phase:'idle', transitionId:'', previousContext:null };
  const TAB_ID = (() => { try { return crypto.randomUUID(); } catch (_error) { return `${Date.now()}-${Math.random()}`; } })();
  const contextChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('kareta-account-context') : null;

  function identity(){ return window.KaretaIdentity?.snapshot?.() || {}; }
  function legacyRole(){
    const root = document.documentElement;
    const user = window.KaretaNext?.state?.user || window.KaretaAppState?.user || null;
    return String(root?.dataset?.userRole || user?.role || '').trim().toLowerCase();
  }
  function hasLegacySession(){
    const root = document.documentElement;
    const user = window.KaretaNext?.state?.user || window.KaretaAppState?.user || null;
    return root?.dataset?.identityMode === 'legacy-fallback' || Boolean(user?.id || user?.phone);
  }
  function contextProfile(snapshot=identity()){
    return String(snapshot.context?.profileType || snapshot.context?.profile_type || snapshot.context?.meta?.profileType || '').toLowerCase();
  }
  function contextKind(snapshot=identity()){
    if (!snapshot.authenticated) {
      const role = legacyRole();
      if (hasLegacySession() && ['client','customer','user'].includes(role)) return 'personal';
      return 'anonymous';
    }
    if (window.KaretaIdentity?.has?.('*') === true) return 'admin';
    const type = String(snapshot.context?.type || 'personal').toLowerCase();
    if (type === 'personal') return 'personal';
    if (type === 'profile') return contextProfile(snapshot) === 'seller' ? 'seller' : contextProfile(snapshot) === 'master' ? 'master' : 'personal';
    if (type === 'organization') {
      const orgType = String(snapshot.context?.organizationType || snapshot.context?.organization_type || snapshot.context?.meta?.organizationType || '').toLowerCase();
      if (['service_station','sto','service'].includes(orgType)) return 'organization_service';
      if (['parts_store','shop','store'].includes(orgType)) return 'organization_store';
      return 'organization';
    }
    return 'personal';
  }

  function interfaceRole(kind=contextKind()){
    return ({
      personal:'client',
      master:'master',
      seller:'seller',
      organization_service:'sto',
      organization_store:'seller',
      organization:'sto',
      admin:'admin',
      anonymous:'guest',
    })[kind] || 'client';
  }

  function syncInterfaceContext(){
    const snapshot=identity();
    const kind=contextKind(snapshot);
    const role=interfaceRole(kind);
    const context=snapshot.context || null;
    const root=document.documentElement;
    root.dataset.navigationContext=kind;
    root.dataset.userRole=role;
    root.dataset.accountContextKey=String(context?.key || context?.contextKey || '');
    root.dataset.accountContextId=String(context?.id || '');
    const detail={ kind, role, context, revision:Number(snapshot.revision || 0) };
    try { window.dispatchEvent(new CustomEvent('kareta:interface-context-changed', { detail })); } catch (_error) {}
    return detail;
  }

  function template(kind=contextKind()){
    return [...(CONTEXT_TEMPLATES[kind] || CONTEXT_TEMPLATES.personal)];
  }

  function desktopItems(kind=contextKind()){
    const preferred = DESKTOP_TEMPLATES[kind] || DESKTOP_TEMPLATES.personal;
    const result = [];
    for (const key of preferred) {
      if (!registry.has(key) || !navigation.canAccess(key) || result.includes(key)) continue;
      result.push(key);
    }
    if (!result.length) {
      const fallback = defaultRoute();
      if (fallback && registry.has(fallback)) result.push(fallback);
    }
    return result;
  }

  function mobileLimit(kind=contextKind()){ return ['personal','master','seller','admin','organization_store'].includes(kind) ? 6 : 5; }

  function mobileItems(){
    const preferred = template();
    const limit = mobileLimit();
    const result = [];
    const wantsMore = preferred.includes('__more__');
    const contentLimit = Math.max(0, limit - (wantsMore ? 1 : 0));
    for (const key of preferred) {
      if (key === '__more__') continue;
      if (result.length >= contentLimit) break;
      if (navigation.canAccess(key) && registry.has(key) && !result.includes(key)) result.push(key);
    }
    const candidates = navigation.items('mobile').filter(key => key !== '__more__' && !result.includes(key));
    for (const key of candidates) {
      if (result.length >= contentLimit) break;
      result.push(key);
    }
    const hasExtra = navigation.menuSections().some(section => section.keys.some(key => !result.includes(key)));
    if ((wantsMore || hasExtra) && result.length < limit) result.push('__more__');
    return result.slice(0,limit);
  }

  function defaultRoute(){
    const preferred={admin:'adminMonitoring',personal:'home',master:'masterDashboard',seller:'seller',organization_service:'stoDashboard',organization_store:'seller',organization:'orders',anonymous:'home'}[contextKind()];
    if(preferred&&navigation.canAccess(preferred))return preferred;
    return template().find(key => key !== '__more__' && navigation.canAccess(key)) || navigation.defaultRoute();
  }

  function resolveRoute(routeKey){
    const requested = registry.has(routeKey) ? routeKey : defaultRoute();
    return navigation.canAccess(requested) ? requested : defaultRoute();
  }

  function preserveRouteAfterContextChange(routeKey, routeHash, source='context-resume'){
    const requested = registry.has(routeKey) ? routeKey : '';
    if (requested && navigation.canAccess(requested)) {
      const desiredHash = String(routeHash || location.hash || registry.get(requested)?.path || '');
      if (desiredHash && registry.keyFromHash(desiredHash) === requested && String(location.hash || '') !== desiredHash) {
        try { history.replaceState(null, '', desiredHash); } catch (_error) {}
      }
      window.KaretaRouteRuntime?.transition?.(requested, { source, force:true });
      return { route:requested, hash:String(location.hash || desiredHash), preserved:true };
    }
    const fallback = defaultRoute();
    window.KaretaRouteRuntime?.navigate?.(fallback, { source, replace:true, force:true });
    return { route:fallback, hash:String(location.hash || registry.get(fallback)?.path || ''), preserved:false };
  }

  function primaryAction(){
    const action = ACTIONS[contextKind()] || ACTIONS.personal;
    if (navigation.canAccess(action.key)) return action;
    const fallback = defaultRoute();
    const route = registry.get(fallback);
    return { key:fallback, label:route.label, icon:route.icon };
  }

  function updateQuickActions(){
    const action = primaryAction();
    const button = document.getElementById('k-mobile-orders');
    if (button) {
      button.dataset.actionRoute = action.key;
      button.setAttribute('aria-label', action.label);
      button.setAttribute('title', action.label);
      button.hidden = !navigation.canAccess(action.key);
    }
    try { window.dispatchEvent(new CustomEvent('kareta:primary-action-changed', { detail:action })); } catch (_error) {}
    return action;
  }

  function refreshAll(options={}){
    state.revision += 1;
    syncInterfaceContext();
    navigation.refresh();
    window.KaretaShellNav?.refresh?.({ activeKey:options.activeKey || registry.keyFromHash(location.hash) });
    window.KaretaShellMenu?.render?.();
    updateQuickActions();
    const requested = registry.keyFromHash(location.hash);
    const allowed = resolveRoute(requested);
    if (requested && allowed !== requested && options.redirect !== false) {
      window.KaretaRouteRuntime?.navigate?.(allowed, { source:options.source || 'context-navigation-refresh', replace:true });
    }
    try { window.dispatchEvent(new CustomEvent('kareta:navigation-core-ready', { detail:snapshot() })); } catch (_error) {}
    return snapshot();
  }

  function transitionEvent(name, detail={}){
    try { window.dispatchEvent(new CustomEvent(name, { detail:{ ...detail, phase:state.phase, transitionId:state.transitionId } })); } catch (_error) {}
  }

  function setPhase(phase, detail={}){
    state.phase=phase;
    document.documentElement.dataset.contextSwitchPhase=phase;
    transitionEvent('kareta:context-switch-phase', detail);
  }

  function startRealtime(){
    window.KaretaRealtime?.start?.();
    window.KaretaRealtimeClient?.start?.();
  }

  function stopRealtime(reason='context-switch'){
    window.KaretaRealtime?.stop?.(reason);
    window.KaretaRealtimeClient?.stop?.(reason);
  }

  async function restorePrevious(previous, previousRoute, previousHash){
    if (!previous?.id && !previous?.key) return false;
    setPhase('rollback', { previous });
    try {
      await window.KaretaIdentity.select(previous.id || previous.key);
      refreshAll({ source:'context-switch-rollback', redirect:false });
      const resumed = preserveRouteAfterContextChange(previousRoute, previousHash, 'context-switch-rollback');
      const restored = resumed.route;
      startRealtime();
      transitionEvent('kareta:context-switch-rollback-complete', { context:previous, route:restored, preserved:resumed.preserved });
      return true;
    } catch (rollbackError) {
      state.lastError = `${state.lastError}; rollback:${String(rollbackError?.message || rollbackError)}`;
      transitionEvent('kareta:context-switch-rollback-failed', { error:state.lastError, previous });
      return false;
    }
  }

  async function switchContext(contextIdOrKey, options={}){
    if (state.switching) {
      const error = new Error('context_switch_in_progress');
      error.code = 'context_switch_in_progress';
      throw error;
    }
    const before = identity();
    const previous = before.context ? { ...before.context } : null;
    const previousHash = String(location.hash || registry.get(defaultRoute())?.path || '#/home');
    const previousRoute = registry.keyFromHash(previousHash) || defaultRoute();
    const target = String(contextIdOrKey || '');
    if (!target || String(previous?.id || previous?.key || '') === target) return before;

    state.switching = true;
    state.lastError = '';
    state.previousContext = previous;
    state.transitionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    document.documentElement.classList.add('k-context-switching');
    document.documentElement.setAttribute('aria-busy','true');
    setPhase('preparing', { previous, target });

    let serverContextChanged = false;
    try {
      stopRealtime('context-switch');
      window.KaretaStateManager?.resetScope?.('context');
      setPhase('selecting', { previous, target });
      const next = await window.KaretaIdentity.select(contextIdOrKey);
      serverContextChanged = true;
      state.lastContextKey = String(next?.context?.key || '');

      setPhase('rebuilding', { previous, current:next?.context || null });
      refreshAll({ source:'context-switch', redirect:false });
      const resumed = preserveRouteAfterContextChange(previousRoute, previousHash, 'account-context-switch');
      const startRoute = resumed.route;

      setPhase('realtime', { current:next?.context || null, route:startRoute, preserved:resumed.preserved });
      startRealtime();
      setPhase('complete', { previous, current:next?.context || null, route:startRoute, preserved:resumed.preserved });
      transitionEvent('kareta:context-switch-complete', { previous, current:next?.context || null, route:startRoute, preserved:resumed.preserved });
      try { contextChannel?.postMessage({ type:'context-changed', sender:TAB_ID, contextId:next?.context?.id || null, contextKey:next?.context?.key || '', revision:next?.revision || 0, route:startRoute, preserved:resumed.preserved }); } catch (_error) {}
      return next;
    } catch (error) {
      state.lastError = String(error?.message || error || 'context_switch_failed');
      setPhase('failed', { error:state.lastError, previous, target });
      let rolledBack = false;
      if (serverContextChanged && options.rollback !== false) rolledBack = await restorePrevious(previous, previousRoute, previousHash);
      if (!rolledBack) startRealtime();
      transitionEvent('kareta:context-switch-failed', { error:state.lastError, previous, target, rolledBack });
      throw error;
    } finally {
      state.switching = false;
      state.previousContext = null;
      window.setTimeout(() => {
        document.documentElement.classList.remove('k-context-switching');
        document.documentElement.removeAttribute('aria-busy');
        if (state.phase === 'complete' || state.phase === 'failed' || state.phase === 'rollback') setPhase('idle');
      }, 180);
    }
  }

  async function syncFromOtherTab(message){
    if (!message || message.sender === TAB_ID || message.type !== 'context-changed' || state.switching) return;
    const localHash = String(location.hash || registry.get(defaultRoute())?.path || '#/home');
    const localRoute = registry.keyFromHash(localHash) || defaultRoute();
    state.switching = true;
    state.transitionId = `remote-${Date.now()}`;
    document.documentElement.classList.add('k-context-switching');
    setPhase('syncing-tabs', { remote:true, contextId:message.contextId });
    try {
      stopRealtime('context-sync');
      window.KaretaStateManager?.resetScope?.('context');
      await window.KaretaIdentity.load({ force:true });
      refreshAll({ source:'cross-tab-context-sync', redirect:false });
      const resumed = preserveRouteAfterContextChange(localRoute, localHash, 'cross-tab-context-sync');
      const route = resumed.route;
      startRealtime();
      transitionEvent('kareta:context-sync-complete', { remote:true, route, preserved:resumed.preserved });
    } catch (error) {
      state.lastError=String(error?.message || error);
      startRealtime();
      transitionEvent('kareta:context-sync-failed', { remote:true, error:state.lastError });
    } finally {
      state.switching=false;
      window.setTimeout(()=>{document.documentElement.classList.remove('k-context-switching');setPhase('idle');},180);
    }
  }

  if (contextChannel) contextChannel.addEventListener('message', event => syncFromOtherTab(event.data));

  function snapshot(){
    return { revision:state.revision, switching:state.switching, phase:state.phase, transitionId:state.transitionId, contextKind:contextKind(), interfaceRole:interfaceRole(), desktop:desktopItems(), mobile:mobileItems(), defaultRoute:defaultRoute(), primaryAction:primaryAction(), lastError:state.lastError, previousContext:state.previousContext };
  }

  ['kareta:identity-ready','kareta:capabilities-changed'].forEach(name => window.addEventListener(name, () => refreshAll({ redirect:false, source:name })));
  window.KaretaNavigationCore = Object.freeze({ CONTEXT_TEMPLATES, DESKTOP_TEMPLATES, ACTIONS, contextKind, interfaceRole, syncInterfaceContext, desktopItems, mobileLimit, mobileItems, defaultRoute, resolveRoute, preserveRouteAfterContextChange, primaryAction, updateQuickActions, refreshAll, switchContext, snapshot });
})();
;

/* SOURCE: js/next/shell_nav.js */
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
;

/* SOURCE: js/next/shell_menu.js */
(() => {
  'use strict';
  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry','KaretaDynamicNavigation'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){window.KaretaRuntimeDependencies.deferScript('shell_menu',dependencies,scriptSource);return;}
  if(window.__KARETA_SHELL_MENU_MODULE__){window.__KARETA_SHELL_MENU_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_SHELL_MENU_MODULE__={duplicateLoads:0};
  const registry=window.KaretaRouteRegistry;
  const navigation=window.KaretaDynamicNavigation;
  if(!registry||!navigation)return;
  const state={bound:false,open:false};
  const labels={main:'ОСНОВНОЕ',work:'РАБОТА И ЗАЯВКИ',commerce:'ТОРГОВЛЯ И СКЛАД',management:'УПРАВЛЕНИЕ',communication:'КОММУНИКАЦИИ',account:'АККАУНТ',social:'СООБЩЕСТВО',system:'СИСТЕМА',info:'ИНФОРМАЦИЯ И ПРАВИЛА'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function routeItem(key){const route=registry.get(key);const iconHtml=window.KaretaUIIcons?.routeSvg?.(key)||esc(route.icon);return `<a class="k-menu-link" href="${esc(route.path)}" data-route-link="${esc(key)}" data-route-key="${esc(key)}"><span aria-hidden="true">${iconHtml}</span><div><b>${esc(route.label)}</b><small>${esc(route.description||'Открыть раздел')}</small></div><i aria-hidden="true">›</i></a>`;}
  function sectionsWithSettings(identity){let sections=navigation.menuSections().map(section=>({id:section.id,keys:[...section.keys]}));const legacyUser=window.KaretaNext?.state?.user||window.KaretaAppState?.user||null;const signedIn=Boolean(identity.authenticated||legacyUser?.id||legacyUser?.phone);const desktopPrimary=new Set(window.KaretaNavigationCore?.desktopItems?.()||[]);const desktopMode=window.matchMedia?.('(min-width: 861px)')?.matches===true;if(desktopMode&&desktopPrimary.size){sections=sections.map(section=>({...section,keys:section.keys.filter(key=>!desktopPrimary.has(key))})).filter(section=>section.keys.length);}const alreadyPresent=sections.some(section=>section.keys.includes('cabinetSettings'));if(signedIn&&registry.has('cabinetSettings')&&!alreadyPresent&&!desktopPrimary.has('cabinetSettings')){let account=sections.find(section=>section.id==='account');if(!account){account={id:'account',keys:[]};sections.push(account);}account.keys.push('cabinetSettings');}return sections;}
  function render(){const content=document.getElementById('k-menu-content');if(!content)return false;const identity=window.KaretaIdentity?.snapshot?.()||{};const contextLabel=identity.context?.label||'Гостевой режим';const sections=sectionsWithSettings(identity);const contextHost=document.getElementById('k-context-switcher');content.innerHTML=sections.map(section=>`<section class="k-menu-section"><div class="k-menu-section-title"><span>${esc(labels[section.id]||section.id.toUpperCase())}</span><small>${esc(contextLabel)}</small></div><div class="k-menu-links">${section.keys.map(routeItem).join('')}</div></section>`).join('');if(contextHost)content.prepend(contextHost);window.KaretaContextManager?.render();return true;}
  function setOpen(next){const drawer=document.getElementById('k-menu-drawer');const backdrop=document.getElementById('k-menu-backdrop');const toggle=document.getElementById('k-menu-toggle');if(!drawer||!backdrop||!toggle)return false;const wasOpen=state.open;state.open=Boolean(next);drawer.classList.toggle('is-open',state.open);drawer.setAttribute('aria-hidden',state.open?'false':'true');toggle.setAttribute('aria-expanded',state.open?'true':'false');toggle.setAttribute('aria-label',state.open?'Закрыть меню':'Открыть меню');backdrop.hidden=!state.open;requestAnimationFrame(()=>backdrop.classList.toggle('is-open',state.open));document.documentElement.classList.toggle('k-menu-open',state.open);if(state.open)document.getElementById('k-menu-close')?.focus({preventScroll:true});else if(wasOpen)toggle.focus({preventScroll:true});return true;}
  const close=()=>setOpen(false);const open=()=>{window.KaretaSmartActionHub?.close?.();render();return setOpen(true)};const closeDetail=()=>{const route=document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')||'';const fallback=route==='serviceDetail'?'#/services':(route==='providerDetail'||route==='providerBooking')?'#/masters':route==='productDetail'?'#/parts':'#/home';if(history.length>1){history.back();return true;}location.hash=fallback;return true;};const toggle=()=>document.documentElement.classList.contains('k-detail-view')?closeDetail():(state.open?close():open());
  function bind(){if(state.bound)return true;const toggleButton=document.getElementById('k-menu-toggle');const closeButton=document.getElementById('k-menu-close');const backdrop=document.getElementById('k-menu-backdrop');if(!toggleButton||!backdrop)return false;toggleButton.addEventListener('click',toggle);closeButton?.addEventListener('click',close);backdrop.addEventListener('click',close);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.open)close()});document.addEventListener('click',event=>{if(state.open&&event.target.closest('#k-menu-drawer [data-route-link]'))close()});['kareta:identity-ready','kareta:capabilities-changed','kareta:context-changed','kareta:navigation-changed'].forEach(name=>window.addEventListener(name,render));state.bound=true;render();return true;}
  window.addEventListener('resize',()=>{if(state.open)render();},{passive:true});
  window.KaretaShellMenu=Object.freeze({bind,open,close,toggle,render,getState:()=>({...state})});
})();
;

/* SOURCE: js/next/route_lifecycle.js */
(() => {
  'use strict';

  const state = { scopesCreated:0, scopesDisposed:0, active:null };

  function safeCall(fn){ try { fn(); } catch (error) { console.error('[KARETA lifecycle cleanup]', error); } }

  function create(meta = {}){
    const controller = meta.controller instanceof AbortController ? meta.controller : new AbortController();
    const cleanups = [];
    let disposed = false;
    const token = Number(meta.token || 0);
    const routeKey = String(meta.routeKey || '');

    const addCleanup = cleanup => {
      if (typeof cleanup !== 'function') return () => {};
      if (disposed) { safeCall(cleanup); return () => {}; }
      cleanups.push(cleanup);
      return () => {
        const index = cleanups.indexOf(cleanup);
        if (index >= 0) cleanups.splice(index, 1);
      };
    };

    const listen = (target, type, handler, options = {}) => {
      if (!target?.addEventListener || typeof handler !== 'function') return () => {};
      const opts = typeof options === 'boolean' ? { capture:options } : { ...options };
      if (!opts.signal) opts.signal = controller.signal;
      target.addEventListener(type, handler, opts);
      return () => { try { target.removeEventListener(type, handler, opts.capture || false); } catch (_error) {} };
    };

    const timeout = (handler, delay = 0) => {
      const id = window.setTimeout(() => { if (!disposed && !controller.signal.aborted) handler(); }, delay);
      addCleanup(() => window.clearTimeout(id));
      return id;
    };

    const interval = (handler, delay = 0) => {
      const id = window.setInterval(() => { if (!disposed && !controller.signal.aborted) handler(); }, delay);
      addCleanup(() => window.clearInterval(id));
      return id;
    };

    const frame = handler => {
      const id = window.requestAnimationFrame(() => { if (!disposed && !controller.signal.aborted) handler(); });
      addCleanup(() => window.cancelAnimationFrame(id));
      return id;
    };

    const observe = (observer, target, options) => {
      if (!observer?.observe || !target) return observer;
      observer.observe(target, options);
      addCleanup(() => observer.disconnect?.());
      return observer;
    };

    const own = resource => {
      if (!resource) return resource;
      addCleanup(() => {
        if (typeof resource.destroy === 'function') resource.destroy(true, true);
        else if (typeof resource.disconnect === 'function') resource.disconnect();
        else if (typeof resource.abort === 'function') resource.abort();
        else if (typeof resource.close === 'function') resource.close();
      });
      return resource;
    };

    const isActive = () => !disposed && !controller.signal.aborted && state.active?.token === token;
    const guard = handler => (...args) => isActive() ? handler(...args) : undefined;

    const dispose = reason => {
      if (disposed) return false;
      disposed = true;
      if (!controller.signal.aborted) controller.abort(reason || 'route-disposed');
      cleanups.splice(0).reverse().forEach(safeCall);
      state.scopesDisposed += 1;
      if (state.active?.token === token) state.active = null;
      return true;
    };

    const scope = Object.freeze({ routeKey, token, signal:controller.signal, addCleanup, listen, timeout, interval, frame, observe, own, isActive, guard, dispose });
    state.scopesCreated += 1;
    state.active = scope;
    return scope;
  }

  function audit(){
    return {
      ok:state.scopesCreated - state.scopesDisposed <= 1,
      scopesCreated:state.scopesCreated,
      scopesDisposed:state.scopesDisposed,
      activeRoute:state.active?.routeKey || '',
      activeToken:state.active?.token || 0,
      at:Date.now(),
    };
  }

  window.KaretaRouteLifecycle = Object.freeze({ create, audit, active:() => state.active });
})();
;

/* SOURCE: js/next/route_runtime.js */
(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry','KaretaRouteLifecycle'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){window.KaretaRuntimeDependencies.deferScript('route_runtime',dependencies,scriptSource);return;}
  if(window.__KARETA_ROUTE_RUNTIME_MODULE__){window.__KARETA_ROUTE_RUNTIME_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_ROUTE_RUNTIME_MODULE__={duplicateLoads:0};

  const registry = window.KaretaRouteRegistry;
  const lifecycleManager = window.KaretaRouteLifecycle;
  if (!registry) throw new Error('KaretaRouteRegistry is required before route_runtime.js');
  if (!lifecycleManager) throw new Error('KaretaRouteLifecycle is required before route_runtime.js');

  const state = {
    bound:false,
    bindCount:0,
    transitionCount:0,
    currentKey:'home',
    currentToken:0,
    abortController:null,
    cleanups:[],
    lifecycle:null,
    lastTransitionHash:'',
    render:null,
    hasRoute:null,
    resolveRoute:null,
    actionHandlers:new Map(),
  };

  function runCleanups(){
    state.lifecycle?.dispose?.('route-transition');
    state.lifecycle = null;
    const queue = state.cleanups.splice(0).reverse();
    queue.forEach(cleanup => {
      try { cleanup(); } catch (_error) {}
    });
    if (state.abortController) state.abortController.abort();
    state.abortController = null;
  }

  function addCleanup(cleanup){
    if (typeof cleanup !== 'function') return () => {};
    state.cleanups.push(cleanup);
    return () => {
      const index = state.cleanups.indexOf(cleanup);
      if (index >= 0) state.cleanups.splice(index, 1);
    };
  }

  function resolveKey(routeKey){
    const candidate = state.hasRoute && state.hasRoute(routeKey) ? routeKey : '';
    const resolved = typeof state.resolveRoute === 'function' ? state.resolveRoute(candidate) : candidate;
    if (state.hasRoute && state.hasRoute(resolved)) return resolved;
    const fallback = typeof state.resolveRoute === 'function' ? state.resolveRoute('') : '';
    if (state.hasRoute && state.hasRoute(fallback)) return fallback;
    throw new Error('No accessible route is available for the current role');
  }

  function transition(routeKey, options = {}){
    window.KaretaNavigationState?.capture?.();
    const key = resolveKey(routeKey);
    const normalizedHash = registry.normalizeHash(location.hash);
    if (options.force !== true && state.currentKey === key && state.lastTransitionHash === normalizedHash && state.lifecycle?.isActive?.()) {
      return key;
    }
    if (key !== routeKey && registry.get(key)?.path && registry.normalizeHash(location.hash) !== registry.get(key).path) {
      try { history.replaceState(null, '', registry.get(key).path); } catch (_error) {}
    }
    runCleanups();

    state.currentKey = key;
    state.currentToken += 1;
    state.transitionCount += 1;
    state.abortController = new AbortController();
    state.lastTransitionHash = normalizedHash;
    state.lifecycle = lifecycleManager.create({ routeKey:key, token:state.currentToken, controller:state.abortController });

    if (typeof state.render === 'function') {
      state.render(key, {
        ...state.lifecycle,
        source:options.source || 'runtime',
      });
    }
    window.KaretaNavigationState?.restore?.(location.hash, { replayActive:true });
    try {
      window.dispatchEvent(new CustomEvent('kareta:routechange', {
        detail:{ key, hash:location.hash, token:state.currentToken, source:options.source || 'runtime' }
      }));
    } catch (_error) {}
    return key;
  }

  function navigate(routeKey, options = {}){
    const key = resolveKey(routeKey);
    const route = registry.get(key);
    const replace = options.replace === true;
    if (registry.normalizeHash(location.hash) !== route.path) {
      history[replace ? 'replaceState' : 'pushState'](null, '', route.path);
    }
    return transition(key, { source:options.source || 'navigate', force:options.force === true });
  }

  function handleHashChange(){
    if (window.KaretaOnboardingBridge?.isOnboardingHash?.(location.hash)) {
      window.KaretaOnboardingBridge.start({ force:true });
      return;
    }
    transition(registry.keyFromHash(location.hash), { source:'hashchange' });
  }

  function handleDocumentClick(event){
    const routeLink = event.target.closest('[data-route-link]');
    if (routeLink) {
      const key = routeLink.getAttribute('data-route-key') || routeLink.getAttribute('data-route-link');
      if (state.hasRoute && state.hasRoute(key)) {
        event.preventDefault();
        navigate(key, { source:'route-link' });
        return;
      }
    }

    const actionNode = event.target.closest('[data-next-action]');
    if (!actionNode) return;
    const actionName = actionNode.getAttribute('data-next-action');
    const handler = state.actionHandlers.get(actionName);
    if (!handler) return;
    handler({
      event,
      node:actionNode,
      routeKey:state.currentKey,
      signal:state.abortController ? state.abortController.signal : null,
      addCleanup,
    });
  }

  function bind(options = {}){
    if (typeof options.render === 'function') state.render = options.render;
    if (typeof options.hasRoute === 'function') state.hasRoute = options.hasRoute;
    if (typeof options.resolveRoute === 'function') state.resolveRoute = options.resolveRoute;
    if (!state.render || !state.hasRoute) throw new Error('KaretaRouteRuntime.bind requires render and hasRoute');

    if (!state.bound) {
      window.addEventListener('hashchange', handleHashChange);
      document.addEventListener('click', handleDocumentClick);
      state.bound = true;
      state.bindCount += 1;
    }
    return true;
  }

  function onAction(actionName, handler){
    if (!actionName || typeof handler !== 'function') return false;
    state.actionHandlers.set(String(actionName), handler);
    return true;
  }

  function offAction(actionName){
    return state.actionHandlers.delete(String(actionName));
  }

  function audit(){
    const result = {
      ok:state.bound && state.bindCount === 1 && typeof state.render === 'function' && typeof state.hasRoute === 'function',
      bound:state.bound,
      bindCount:state.bindCount,
      transitionCount:state.transitionCount,
      currentKey:state.currentKey,
      currentToken:state.currentToken,
      cleanupCount:state.cleanups.length,
      lifecycle:lifecycleManager.audit(),
      actionCount:state.actionHandlers.size,
      role:window.KaretaNavigationCore?.interfaceRole?.() || window.KaretaRoleAccess?.currentRole?.() || 'client',
      at:Date.now(),
    };
    window.KaretaRouteRuntimeAudit = result;
    return result;
  }

  window.KaretaRouteRuntime = Object.freeze({
    bind,
    navigate,
    transition,
    addCleanup,
    onAction,
    offAction,
    audit,
    getState:() => ({
      bound:state.bound,
      bindCount:state.bindCount,
      transitionCount:state.transitionCount,
      currentKey:state.currentKey,
      currentToken:state.currentToken,
      cleanupCount:state.cleanups.length,
      lifecycle:lifecycleManager.audit(),
      actionCount:state.actionHandlers.size,
      role:window.KaretaNavigationCore?.interfaceRole?.() || window.KaretaRoleAccess?.currentRole?.() || 'client',
    }),
  });
})();
;

/* SOURCE: js/next/route_asset_loader.js */
(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){
    window.KaretaRuntimeDependencies.deferScript('route_asset_loader',dependencies,scriptSource);
    return;
  }
  if(window.__KARETA_ROUTE_ASSET_LOADER_MODULE__){window.__KARETA_ROUTE_ASSET_LOADER_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_ROUTE_ASSET_LOADER_MODULE__={duplicateLoads:0};

  const release=String(window.KARETA_NEXT_ASSET_VERSION||'next');
  const manifestUrl=String(window.KARETA_ASSET_MANIFEST_URL||`/asset_manifest.php?v=${encodeURIComponent(release)}`);
  const routeManifestUrl=(()=>{
    try{
      const url=new URL(manifestUrl,location.href);
      url.searchParams.set('v',release);
      url.searchParams.set('route_loader','1');
      return `${url.pathname}${url.search}`;
    }catch(_error){return `/asset_manifest.php?v=${encodeURIComponent(release)}&route_loader=1`;}
  })();
  // Compatibility bridge for the frozen index watchdog. Atomic loading already owns
  // script-failure recovery; expose audit as soon as route infrastructure is alive so
  // a slow sequential boot is not mistaken for a missing runtime after 12 seconds.
  if(!window.KaretaNext?.audit){
    window.KaretaNext=Object.assign(window.KaretaNext||{}, {audit:()=>({ok:false,bootPending:true,release,source:'route_asset_loader'})});
  }
  const KNOWN_LAZY_ROUTE_KEYS=new Set([
    'community',
    'parts','usedParts','productDetail',
    'masters','providerDetail','providerBooking','serviceDetail',
    'stoDashboard',
    'seller','sellerProducts','sellerOrders',
    'identityMigration','adminUsers','adminOrganizations','adminMonitoring','adminManagement',
    'services','serviceManagement','profile','following','requestNew','workOrder',
    'cabinet','cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos','cabinetTariff','cabinetSettings',
    'chats','notifications','works','masterExchange','realWorks','workDetail','vehicle','orders','workflow',
    'news','masterNews','masterNewsCreate','masterNewsEdit',
    'about','rules','help','privacy','contacts','lawyer','towTruck',
    'masterOnboarding','masterDashboard','masterSchedule','masterWorkplaceSettings','masterProfileOwner','masterWallOwner','masterWorks','masterReviews','providerReviews',
    'platform','corePlatform','calendarBooking','finance','market','crm','assistant','diagnostics','scanner','scannerQr','scannerDocument',
  ]);

  const state={
    manifest:null,
    manifestPromise:null,
    loadedBundles:new Set(),
    bundlePromises:new Map(),
    failedBundles:new Map(),
    loadedScripts:new Set(),
    loadedStyles:new Set(),
    routeLoads:0,
    assetLoads:0,
  };

  const normalizePath=value=>{
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      const url=/^[a-z][a-z0-9+.-]*:/i.test(raw)
        ? new URL(raw)
        : new URL('/'+raw.replace(/^\/+/,''),location.origin);
      return url.pathname.replace(/^\/+/, '');
    }catch(_error){return raw.replace(/^\/+/, '').split('?')[0];}
  };
  const assetKey=(group,path)=>`${group}:${normalizePath(path)}`;
  const clampProgress=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  function emitRouteLoad(type,detail={}){
    const payload={release,at:Date.now(),...detail,percent:clampProgress(detail.percent)};
    try{window.dispatchEvent(new CustomEvent(`kareta:route-load-${type}`,{detail:payload}));}catch(_error){}
    return payload;
  }
  function reportRouteProgress(options,detail={}){
    const payload=emitRouteLoad('progress',detail);
    try{if(typeof options?.onProgress==='function')options.onProgress(payload);}catch(_error){}
    return payload;
  }

  function currentAssetPaths(){
    document.querySelectorAll('script[src]').forEach(node=>state.loadedScripts.add(normalizePath(node.src)));
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(node=>state.loadedStyles.add(normalizePath(node.href)));
  }
  currentAssetPaths();

  function isKnownLazy(routeKey){return KNOWN_LAZY_ROUTE_KEYS.has(String(routeKey||''));}

  async function manifest(){
    if(state.manifest)return state.manifest;
    if(state.manifestPromise)return state.manifestPromise;
    state.manifestPromise=(async()=>{
      const response=await fetch(routeManifestUrl,{
        cache:'default',credentials:'same-origin',headers:{Accept:'application/json','X-Kareta-Route-Loader':release}
      });
      let payload=null;
      try{payload=await response.json();}catch(_error){throw new Error(`route_manifest_invalid_json:${response.status}`);}
      if(!payload||typeof payload!=='object'||!Array.isArray(payload.assets)||!payload.routeBundles)throw new Error(`route_manifest_not_ready:${response.status}`);
      // Route loading is scoped to the requested bundle. A degraded global manifest
      // (for example, one unrelated missing image) must not disable otherwise valid routes.
      // assetUrl() still fails closed if an asset required by this route is absent.
      if(String(payload.release||'')!==release)throw new Error(`route_manifest_release_mismatch:${payload.release||''}`);
      state.manifest=payload;
      return payload;
    })().finally(()=>{state.manifestPromise=null;});
    return state.manifestPromise;
  }

  function routeBundles(payload,routeKey){
    const out=[];
    const plan=payload?.routeBundles||{};
    for(const [name,bundle] of Object.entries(plan)){
      if(name.startsWith('_')||!bundle||bundle.lazy!==true)continue;
      const keys=Array.isArray(bundle.routeKeys)?bundle.routeKeys:[];
      if(keys.includes(routeKey))out.push([name,bundle]);
    }
    return out;
  }

  function assetUrl(payload,group,path){
    const wanted=normalizePath(path);
    const match=(payload?.assets||[]).find(item=>item?.group===group&&normalizePath(item?.path||item?.url||'')===wanted);
    if(match?.exists===false)throw new Error(`route_asset_missing:${wanted}`);
    if(match?.url){
      const raw=String(match.url);
      if(/^[a-z][a-z0-9+.-]*:/i.test(raw))return raw;
      return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
    }
    return `/${wanted}?v=${encodeURIComponent(release)}`;
  }

  function loadStyle(payload,path,bundleName){
    const normalized=normalizePath(path);
    if(state.loadedStyles.has(normalized))return Promise.resolve(true);
    let existing=Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).find(node=>normalizePath(node.href)===normalized);
    if(existing?.dataset?.karetaRouteAsset==='1'&&existing.dataset.karetaRouteState!=='loaded'){
      try{existing.remove();}catch(_error){}existing=null;
    }
    if(existing){state.loadedStyles.add(normalized);return Promise.resolve(true);}
    return new Promise((resolve,reject)=>{
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=assetUrl(payload,'styles',normalized);
      link.dataset.karetaRouteBundle=bundleName;link.dataset.karetaRelease=release;link.dataset.karetaRouteAsset='1';link.dataset.karetaRouteState='loading';
      const fail=message=>{link.dataset.karetaRouteState='failed';try{link.remove();}catch(_error){}reject(new Error(message));};
      const timer=window.setTimeout(()=>fail(`route_style_timeout:${normalized}`),12000);
      link.addEventListener('load',()=>{window.clearTimeout(timer);link.dataset.karetaRouteState='loaded';state.loadedStyles.add(normalized);state.assetLoads+=1;resolve(true);},{once:true});
      link.addEventListener('error',()=>{window.clearTimeout(timer);fail(`route_style_load_failed:${normalized}`);},{once:true});
      document.head.appendChild(link);
    });
  }

  function loadScript(payload,path,bundleName){
    const normalized=normalizePath(path);
    if(state.loadedScripts.has(normalized))return Promise.resolve(true);
    let existing=Array.from(document.querySelectorAll('script[src]')).find(node=>normalizePath(node.src)===normalized);
    if(existing?.dataset?.karetaRouteAsset==='1'&&existing.dataset.karetaRouteState!=='loaded'){
      try{existing.remove();}catch(_error){}existing=null;
    }
    if(existing){state.loadedScripts.add(normalized);return Promise.resolve(true);}
    return new Promise((resolve,reject)=>{
      let executionError='';
      const script=document.createElement('script');
      script.async=false;script.defer=false;script.src=assetUrl(payload,'scripts',normalized);
      script.dataset.karetaRouteBundle=bundleName;script.dataset.karetaRelease=release;script.dataset.karetaRouteAsset='1';script.dataset.karetaRouteState='loading';
      const sameFile=filename=>normalizePath(filename)===normalized;
      const onWindowError=event=>{if(sameFile(event?.filename||''))executionError=String(event?.error?.message||event?.message||'runtime_execution_error');};
      window.addEventListener('error',onWindowError,true);
      const cleanup=()=>{window.clearTimeout(timer);window.removeEventListener('error',onWindowError,true);};
      const fail=message=>{script.dataset.karetaRouteState='failed';try{script.remove();}catch(_error){}reject(new Error(message));};
      const timer=window.setTimeout(()=>{cleanup();fail(`route_script_timeout:${normalized}`);},15000);
      script.addEventListener('load',()=>{
        cleanup();
        if(executionError){fail(`route_script_execution_failed:${normalized}:${executionError.slice(0,180)}`);return;}
        script.dataset.karetaRouteState='loaded';state.loadedScripts.add(normalized);state.assetLoads+=1;resolve(true);
      },{once:true});
      script.addEventListener('error',()=>{cleanup();fail(`route_script_load_failed:${normalized}`);},{once:true});
      document.body.appendChild(script);
    });
  }

  function validateGlobals(bundleName,bundle){
    const missing=(Array.isArray(bundle.globals)?bundle.globals:[]).filter(name=>!window[name]);
    if(missing.length)throw new Error(`route_bundle_globals_missing:${bundleName}:${missing.join(',')}`);
    return true;
  }

  function promoteCascadeStyles(bundle){
    if(String(bundle?.cascade||'')!=='last')return;
    for(const style of Array.isArray(bundle.styles)?bundle.styles:[]){
      const normalized=normalizePath(style);
      const node=Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).find(link=>normalizePath(link.href)===normalized);
      if(node?.parentNode)node.parentNode.appendChild(node);
    }
  }

  async function loadBundle(payload,bundleName,bundle,signal,onAssetLoaded){
    if(state.loadedBundles.has(bundleName)){promoteCascadeStyles(bundle);validateGlobals(bundleName,bundle);return true;}
    if(state.bundlePromises.has(bundleName))return state.bundlePromises.get(bundleName);
    const promise=(async()=>{
      if(signal?.aborted)throw new DOMException('Route asset load aborted','AbortError');
      for(const style of Array.isArray(bundle.styles)?bundle.styles:[]){
        if(signal?.aborted)throw new DOMException('Route asset load aborted','AbortError');
        await loadStyle(payload,style,bundleName);
        try{onAssetLoaded?.({bundle:bundleName,type:'style',path:normalizePath(style)});}catch(_error){}
      }
      for(const script of Array.isArray(bundle.scripts)?bundle.scripts:[]){
        if(signal?.aborted)throw new DOMException('Route asset load aborted','AbortError');
        await loadScript(payload,script,bundleName);
        try{onAssetLoaded?.({bundle:bundleName,type:'script',path:normalizePath(script)});}catch(_error){}
      }
      validateGlobals(bundleName,bundle);
      promoteCascadeStyles(bundle);
      state.loadedBundles.add(bundleName);state.failedBundles.delete(bundleName);
      try{window.dispatchEvent(new CustomEvent('kareta:route-bundle-loaded',{detail:{bundle:bundleName,release}}));}catch(_error){}
      return true;
    })().catch(error=>{
      state.failedBundles.set(bundleName,String(error?.message||error));
      throw error;
    }).finally(()=>state.bundlePromises.delete(bundleName));
    state.bundlePromises.set(bundleName,promise);
    return promise;
  }

  async function ensureRoute(routeKey,options={}){
    const key=String(routeKey||'');
    if(!isKnownLazy(key))return {ok:true,lazy:false,bundles:[]};
    let lastPercent=4;
    emitRouteLoad('start',{route:key,phase:'start',percent:lastPercent});
    reportRouteProgress(options,{route:key,phase:'start',percent:lastPercent,loaded:0,total:0});
    try{
      const payload=await manifest();
      lastPercent=16;
      reportRouteProgress(options,{route:key,phase:'manifest',percent:lastPercent,loaded:0,total:0});
      const bundles=routeBundles(payload,key);
      if(!bundles.length)throw new Error(`route_bundle_not_declared:${key}`);
      state.routeLoads+=1;
      const pendingBundles=bundles.filter(([name])=>!state.loadedBundles.has(name));
      const total=pendingBundles.reduce((sum,[,bundle])=>sum+
        (Array.isArray(bundle.styles)?bundle.styles.length:0)+
        (Array.isArray(bundle.scripts)?bundle.scripts.length:0),0);
      let completed=0;
      const loaded=[];
      const onAssetLoaded=meta=>{
        completed+=1;
        lastPercent=total>0?Math.min(94,18+Math.round((completed/total)*76)):94;
        reportRouteProgress(options,{route:key,phase:'assets',percent:lastPercent,loaded:completed,total,...meta});
      };
      for(const [name,bundle] of bundles){
        await loadBundle(payload,name,bundle,options.signal,onAssetLoaded);
        loaded.push(name);
        if(total===0){
          lastPercent=Math.min(94,lastPercent+Math.max(1,Math.floor(76/bundles.length)));
          reportRouteProgress(options,{route:key,phase:'bundle',percent:lastPercent,loaded:loaded.length,total:bundles.length,bundle:name});
        }
      }
      lastPercent=100;
      reportRouteProgress(options,{route:key,phase:'ready',percent:lastPercent,loaded:total||loaded.length,total:total||bundles.length});
      emitRouteLoad('end',{route:key,phase:'ready',percent:100,bundles:loaded});
      return {ok:true,lazy:true,bundles:loaded};
    }catch(error){
      const aborted=options.signal?.aborted||error?.name==='AbortError';
      emitRouteLoad(aborted?'cancel':'error',{route:key,phase:aborted?'cancelled':'error',percent:lastPercent,error:String(error?.message||error)});
      throw error;
    }
  }

  function isRouteReady(routeKey){
    const key=String(routeKey||'');
    if(!isKnownLazy(key))return true;
    if(!state.manifest)return false;
    const bundles=routeBundles(state.manifest,key);
    if(!bundles.length)return false;
    return bundles.every(([name,bundle])=>{
      if(!state.loadedBundles.has(name))return false;
      const missing=(Array.isArray(bundle.globals)?bundle.globals:[]).filter(globalName=>!window[globalName]);
      return missing.length===0;
    });
  }

  function prefetchRoute(routeKey,options={}){
    const key=String(routeKey||'');
    if(!isKnownLazy(key)||isRouteReady(key))return Promise.resolve({ok:true,lazy:isKnownLazy(key),prefetched:false,bundles:[]});
    return ensureRoute(key,options).then(result=>({...result,prefetched:true}));
  }

  function audit(){
    const result={
      ok:state.failedBundles.size===0,
      release,
      manifestLoaded:!!state.manifest,
      knownLazyRoutes:Array.from(KNOWN_LAZY_ROUTE_KEYS),
      loadedBundles:Array.from(state.loadedBundles),
      pendingBundles:Array.from(state.bundlePromises.keys()),
      failedBundles:Object.fromEntries(state.failedBundles),
      loadedRouteScripts:Array.from(state.loadedScripts).filter(path=>document.querySelector(`script[data-kareta-route-asset="1"][src*="${path.split('/').pop()}"]`)),
      routeLoads:state.routeLoads,
      assetLoads:state.assetLoads,
      at:Date.now(),
    };
    window.KaretaRouteAssetAudit=result;
    return result;
  }

  window.KaretaRouteAssetLoader=Object.freeze({ensureRoute,prefetchRoute,isRouteReady,isKnownLazy,audit,manifest:()=>manifest()});
})();
;

/* SOURCE: js/next/dashboard_engine.js */
(() => {
  'use strict';
  const registry=new Map();
  const records=new Map();
  const renders=new Map();
  const editing=new Set();
  const busy=new Set();
  const icon=name=>window.KaretaUIIcons?.svg?.(name)||'';
  const esc=value=>window.KaretaUIKit?.esc?.(value)??String(value??'');
  const normalizeSpan=value=>Math.max(1,Math.min(4,Number(value||1)));
  const currentContext=()=>window.KaretaIdentity?.snapshot?.()?.context||window.KaretaNext?.state?.context||null;
  const capabilities=()=>new Set(window.KaretaIdentity?.snapshot?.()?.capabilities||window.KaretaNext?.state?.capabilities||[]);
  const contextKind=context=>{
    const c=context||currentContext()||{};
    const type=String(c.type||c.contextType||'').toLowerCase();
    const key=String(c.key||c.contextKey||'').toLowerCase();
    const profile=String(c.profileType||c.profile_type||'').toLowerCase();
    if(type==='organization'||key.includes('organization')||key.includes('org_'))return 'organization';
    if(profile==='master'||key.includes('master'))return 'master';
    if(profile==='seller'||key.includes('seller'))return 'seller';
    if(type==='system'||key.includes('admin'))return 'admin';
    return 'personal';
  };
  const contextKey=context=>String((context||currentContext()||{}).key||(context||{}).contextKey||'').slice(0,128);
  const scopeKey=(dashboardKey,kind,key)=>`${kind}|${key}|${dashboardKey}`;
  const normalizeLayout=layout=>{
    if(!layout||typeof layout!=='object')return null;
    const order=[...new Set((Array.isArray(layout.order)?layout.order:[]).map(String).filter(Boolean))];
    const spans={};Object.entries(layout.spans||{}).forEach(([key,value])=>{if(key)spans[String(key)]=normalizeSpan(value);});
    return {order,spans};
  };
  const getRecord=(dashboardKey,kind,key)=>{
    const scope=scopeKey(dashboardKey,kind,key);
    if(!records.has(scope))records.set(scope,{dashboardKey,contextKind:kind,contextKey:key,layout:null,revision:0,updatedAt:null});
    return records.get(scope);
  };
  function allowed(widget,context){
    const caps=capabilities();const kind=contextKind(context);
    if(Array.isArray(widget.contextKinds)&&widget.contextKinds.length&&!widget.contextKinds.includes(kind))return false;
    if(Array.isArray(widget.all)&&widget.all.some(cap=>!caps.has(cap)&&!caps.has('*')))return false;
    if(Array.isArray(widget.any)&&widget.any.length&&!widget.any.some(cap=>caps.has(cap)||caps.has('*')))return false;
    return true;
  }
  function register(widget){
    if(!widget||!widget.key||typeof widget.render!=='function')throw new Error('dashboard_widget_invalid');
    registry.set(String(widget.key),Object.freeze({span:1,minSpan:1,...widget}));
  }
  function resolveLayout(dashboardKey,widgets,record){
    const saved=record?.layout;
    const order=Array.isArray(saved?.order)?saved.order:[];
    const byKey=new Map(widgets.map(item=>[item.key,item]));const resolved=[];
    order.forEach(key=>{if(byKey.has(key)){resolved.push(byKey.get(key));byKey.delete(key);}});
    byKey.forEach(item=>resolved.push(item));
    return resolved.map(item=>({...item,span:normalizeSpan(saved?.spans?.[item.key]||item.span)}));
  }
  async function loadLayout(dashboardKey,contextKindValue,contextKeyValue=''){
    const kind=contextKindValue||contextKind();const key=contextKeyValue||contextKey();const record=getRecord(dashboardKey,kind,key);
    try{
      const url=`/api/dashboard_preferences.php?dashboardKey=${encodeURIComponent(dashboardKey)}&contextKind=${encodeURIComponent(kind)}&contextKey=${encodeURIComponent(key)}`;
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok||!String(response.headers.get('content-type')||'').includes('application/json'))return record.layout;
      const data=await response.json();
      if(data.ok){record.layout=normalizeLayout(data.layout);record.revision=Math.max(0,Number(data.revision)||0);record.updatedAt=data.updatedAt||null;}
      return record.layout;
    }catch{return record.layout;}
  }
  async function persist(record,action='save'){
    const scope=scopeKey(record.dashboardKey,record.contextKind,record.contextKey);if(busy.has(scope))throw new Error('dashboard_save_in_progress');busy.add(scope);
    try{
      const response=await fetch('/api/dashboard_preferences.php',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({action,dashboardKey:record.dashboardKey,contextKind:record.contextKind,contextKey:record.contextKey,layout:record.layout,expectedRevision:record.revision})});
      const data=String(response.headers.get('content-type')||'').includes('application/json')?await response.json():{ok:false,error:'dashboard_invalid_response'};
      if(response.status===409){record.layout=normalizeLayout(data.layout);record.revision=Math.max(0,Number(data.revision)||0);const error=new Error('dashboard_revision_conflict');error.code='dashboard_revision_conflict';throw error;}
      if(!response.ok||data.ok===false)throw new Error(data.error||`dashboard_http_${response.status}`);
      record.layout=normalizeLayout(data.layout);record.revision=Math.max(0,Number(data.revision)||0);record.updatedAt=data.updatedAt||null;
      window.dispatchEvent(new CustomEvent('kareta:dashboard-layout-saved',{detail:{dashboardKey:record.dashboardKey,contextKind:record.contextKind,contextKey:record.contextKey,revision:record.revision,action}}));
      return record.layout;
    }finally{busy.delete(scope);}
  }
  async function saveLayout(dashboardKey,contextKindValue,layout,contextKeyValue=''){
    const record=getRecord(dashboardKey,contextKindValue||contextKind(),contextKeyValue||contextKey());record.layout=normalizeLayout(layout);return persist(record,'save');
  }
  async function resetLayout(dashboardKey,contextKindValue,contextKeyValue=''){
    const record=getRecord(dashboardKey,contextKindValue||contextKind(),contextKeyValue||contextKey());await persist(record,'reset');return null;
  }
  function controls(widget,index,total){return `<div class="k-dashboard-widget__controls" aria-label="Настройка виджета"><button type="button" data-dashboard-move="prev" ${index===0?'disabled':''} aria-label="Переместить влево">←</button><button type="button" data-dashboard-move="next" ${index===total-1?'disabled':''} aria-label="Переместить вправо">→</button><button type="button" data-dashboard-span="down" ${widget.span<=1?'disabled':''} aria-label="Уменьшить ширину">−</button><span>${widget.span}/4</span><button type="button" data-dashboard-span="up" ${widget.span>=4?'disabled':''} aria-label="Увеличить ширину">＋</button></div>`;}
  function renderWidget(widget,data,context,isEditing,index,total){
    const body=widget.render(data,context);
    return `<article class="k-dashboard-widget ${isEditing?'is-editing':''}" data-dashboard-widget="${esc(widget.key)}" style="--widget-span:${normalizeSpan(widget.span)}"><header class="k-dashboard-widget__head"><div>${icon(widget.icon||'dashboard')}<span><b>${esc(widget.title||widget.key)}</b>${widget.subtitle?`<small>${esc(widget.subtitle)}</small>`:''}</span></div>${isEditing?controls(widget,index,total):(widget.href?`<a href="${esc(widget.href)}" aria-label="Открыть ${esc(widget.title||widget.key)}">${icon('chevronRight')}</a>`:'')}</header><div class="k-dashboard-widget__body">${body}</div></article>`;
  }
  function render(dashboardKey,data={},options={}){
    const context=options.context||currentContext();const kind=contextKind(context);const key=options.contextKey||contextKey(context);const scope=scopeKey(dashboardKey,kind,key);const record=getRecord(dashboardKey,kind,key);
    const requested=(options.widgets||[]).map(widgetKey=>registry.get(widgetKey)).filter(Boolean).filter(widget=>allowed(widget,context));const widgets=resolveLayout(dashboardKey,requested,record);const isEditing=editing.has(scope);renders.set(scope,{dashboardKey,data,options:{...options,context,contextKey:key}});
    const personalized=options.personalizable!==false;
    return `<section class="k-dashboard ${isEditing?'is-editing':''}" data-dashboard="${esc(dashboardKey)}" data-context-kind="${esc(kind)}" data-context-key="${esc(key)}"><div class="k-dashboard-toolbar">${personalized?`<button type="button" class="k-dashboard-tool" data-dashboard-edit aria-pressed="${isEditing?'true':'false'}">${icon('settings')}<span>${isEditing?'Готово':'Настроить'}</span></button><button type="button" class="k-dashboard-tool" data-dashboard-reset ${record.layout?'':'disabled'}>${icon('refresh')}<span>Сбросить</span></button>`:''}<small data-dashboard-revision>Версия ${record.revision}</small></div><div class="k-dashboard-grid">${widgets.map((widget,index)=>renderWidget(widget,data,context,isEditing,index,widgets.length)).join('')}</div></section>`;
  }
  function rerender(node){
    const dashboardKey=node.dataset.dashboard;const kind=node.dataset.contextKind;const key=node.dataset.contextKey;const cached=renders.get(scopeKey(dashboardKey,kind,key));if(cached)node.outerHTML=render(cached.dashboardKey,cached.data,cached.options);
  }
  async function mutate(node,button){
    const dashboardKey=node.dataset.dashboard;const kind=node.dataset.contextKind;const key=node.dataset.contextKey;const scope=scopeKey(dashboardKey,kind,key);const cached=renders.get(scope);const record=getRecord(dashboardKey,kind,key);if(!cached)return;
    const context=cached.options.context;const widgets=resolveLayout(dashboardKey,(cached.options.widgets||[]).map(widgetKey=>registry.get(widgetKey)).filter(Boolean).filter(widget=>allowed(widget,context)),record);const widgetNode=button.closest('[data-dashboard-widget]');const widgetKey=widgetNode?.dataset.dashboardWidget;const index=widgets.findIndex(widget=>widget.key===widgetKey);if(index<0)return;
    const order=widgets.map(widget=>widget.key);const spans={...(record.layout?.spans||{})};
    if(button.dataset.dashboardMove){const target=button.dataset.dashboardMove==='prev'?index-1:index+1;if(target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];}
    if(button.dataset.dashboardSpan){const widget=widgets[index];spans[widgetKey]=normalizeSpan(widget.span+(button.dataset.dashboardSpan==='up'?1:-1));}
    record.layout={order,spans};rerender(node);
    try{await persist(record,'save');const fresh=document.querySelector(`[data-dashboard="${CSS.escape(dashboardKey)}"][data-context-key="${CSS.escape(key)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.success?.('Расположение виджетов сохранено');}
    catch(error){const fresh=document.querySelector(`[data-dashboard="${CSS.escape(dashboardKey)}"][data-context-key="${CSS.escape(key)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.error?.(error.code==='dashboard_revision_conflict'?'Настройки изменились в другой вкладке. Загружена актуальная версия.':'Не удалось сохранить виджеты');}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-dashboard-edit],[data-dashboard-reset],[data-dashboard-move],[data-dashboard-span]');if(!button)return;const node=button.closest('[data-dashboard]');if(!node)return;const scope=scopeKey(node.dataset.dashboard,node.dataset.contextKind,node.dataset.contextKey);
    if(button.matches('[data-dashboard-edit]')){editing.has(scope)?editing.delete(scope):editing.add(scope);rerender(node);return;}
    if(button.matches('[data-dashboard-reset]')){button.disabled=true;const record=getRecord(node.dataset.dashboard,node.dataset.contextKind,node.dataset.contextKey);resetLayout(record.dashboardKey,record.contextKind,record.contextKey).then(()=>{const fresh=document.querySelector(`[data-dashboard="${CSS.escape(record.dashboardKey)}"][data-context-key="${CSS.escape(record.contextKey)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.success?.('Стандартное расположение восстановлено');}).catch(error=>{const fresh=document.querySelector(`[data-dashboard="${CSS.escape(record.dashboardKey)}"][data-context-key="${CSS.escape(record.contextKey)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.error?.(error.code==='dashboard_revision_conflict'?'Настройки обновлены в другой вкладке':'Не удалось сбросить виджеты');});return;}
    mutate(node,button);
  });
  async function mount(root,dashboardKey,options={}){
    if(!root)return;const context=options.context||currentContext();const kind=contextKind(context);const key=options.contextKey||contextKey(context);await loadLayout(dashboardKey,kind,key);if(typeof options.render==='function')root.innerHTML=options.render();root.dispatchEvent(new CustomEvent('kareta:dashboard-ready',{bubbles:true,detail:{dashboardKey,contextKind:kind,contextKey:key}}));
  }
  window.KaretaDashboardEngine=Object.freeze({register,render,mount,loadLayout,saveLayout,resetLayout,contextKind,contextKinds:['personal','master','seller','organization','admin'],contextKey,allowed});
})();
;

/* SOURCE: js/next/dashboard_widgets.js */
(() => {
  'use strict';
  const engine=window.KaretaDashboardEngine;if(!engine)throw new Error('KaretaDashboardEngine is required');
  const esc=v=>window.KaretaUIKit?.esc?.(v)??String(v??'');
  const money=v=>new Intl.NumberFormat('ru-RU').format(Number(v||0))+' ₸';
  const orderList=(items,empty)=>`<div class="k-dashboard-alert-list">${(Array.isArray(items)?items:[]).slice(0,6).map(x=>`<a href="#/orders/item/${encodeURIComponent(x.id)}"><b>${esc(x.vehicleTitle||'Автомобиль')}</b><small>${esc(x.serviceNames||x.clientName||'Заказ')}</small></a>`).join('')||`<p class="k-empty">${esc(empty)}</p>`}</div>`;
  engine.register({key:'sto.metrics',title:'Показатели СТО',subtitle:'Текущая загрузка',icon:'dashboard',contextKinds:['organization'],span:4,render:data=>{const m=data.metrics||{};return `<div class="k-dashboard-kpis">${[['Машин сегодня',m.todayOrders],['Постов занято',`${m.occupied||0}/${m.bays||0}`],['Мастеров',m.masters],['Выручка',money(m.monthRevenue)],['Завершено',m.completedMonth],['Средний чек',money(m.avgTicket)]].map(([a,b])=>`<div class="k-dashboard-kpi"><b>${esc(b||0)}</b><span>${esc(a)}</span></div>`).join('')}</div>`;}});
  engine.register({key:'sto.queue',title:'Очередь',subtitle:'Ближайшие автомобили',icon:'orders',contextKinds:['organization'],span:2,href:'#/orders',render:data=>orderList(data.queue,'Очередь пуста')});
  engine.register({key:'sto.team',title:'Команда',subtitle:'Загрузка мастеров',icon:'masters',contextKinds:['organization'],span:2,href:'#/masters',render:data=>{const list=Array.isArray(data.masters)?data.masters:[];return `<div class="k-dashboard-list">${list.slice(0,6).map(x=>`<a href="#/masters/profile/master/${encodeURIComponent(x.id)}"><span>${esc(x.name||'Мастер')}</span><small>${esc(x.activeOrders||0)} в работе · ${esc(x.kpi||0)}%</small></a>`).join('')||'<p class="k-empty">Команда не настроена</p>'}</div>`;}});
  engine.register({key:'sto.overdue',title:'Просроченные',subtitle:'Требуют решения',icon:'history',contextKinds:['organization'],span:1,href:'#/orders',render:data=>orderList(data.alerts?.overdue,'Просроченных заказов нет')});
  engine.register({key:'sto.approvals',title:'Согласование',subtitle:'Ответ клиента или СТО',icon:'check',contextKinds:['organization'],span:1,href:'#/workflow',render:data=>orderList(data.alerts?.waitingApproval,'Нет ожидающих согласования')});
  engine.register({key:'sto.parts',title:'Ожидают запчасти',subtitle:'Проверьте снабжение',icon:'parts',contextKinds:['organization'],span:1,href:'#/parts',render:data=>orderList(data.alerts?.waitingParts,'Ожиданий запчастей нет')});
  engine.register({key:'sto.calendar',title:'Календарь',subtitle:'Ближайшие записи',icon:'calendar',contextKinds:['organization'],span:1,href:'#/calendar',render:data=>{const list=Array.isArray(data.calendar)?data.calendar:[];return `<div class="k-dashboard-list">${list.slice(0,6).map(x=>`<a href="${x.orderId?`#/orders/item/${encodeURIComponent(x.orderId)}`:'#/calendar'}"><span>${esc(x.title||x.vehicleTitle||'Запись')}</span><small>${esc(x.startsAt||x.date||'')}</small></a>`).join('')||'<p class="k-empty">Ближайших записей нет</p>'}</div>`;}});
  engine.register({key:'admin.metrics',title:'Платформа',subtitle:'Ключевые показатели',icon:'monitor',contextKinds:['admin'],span:4,render:data=>{const c=data.counts||{};return `<div class="k-dashboard-kpis">${[['Аккаунты',c.accounts],['Люди',c.persons],['Профили',c.person_profiles],['Контексты',c.contexts],['Организации',c.organizations],['Активные сессии',c.activeSessions],['Открытая модерация',c.openModeration]].map(([a,b])=>`<div class="k-dashboard-kpi"><b>${esc(b||0)}</b><span>${esc(a)}</span></div>`).join('')}</div>`;}});
  engine.register({key:'admin.audit',title:'Последние действия',subtitle:'Audit trail',icon:'history',contextKinds:['admin'],span:4,render:data=>{const rows=Array.isArray(data.audit)?data.audit:[];return `<div class="k-dashboard-list">${rows.slice(0,10).map(a=>`<div><span>${esc(a.actionKey)} · ${esc(a.targetType)} #${esc(a.targetId)}</span><small>${esc(a.createdAt)}</small></div>`).join('')||'<p class="k-empty">Аудит пуст</p>'}</div>`;}});
})();
;

/* SOURCE: js/next/smart_action_hub.js */
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
      {key:'cabinetGarage',label:'Гараж',icon:'car',action:'personalGarage'},
      {key:'cabinet',label:'Аккаунт',icon:'user'},
      {key:'cabinetSettings',label:'Подключения',icon:'chats',action:'connections'},
      {key:'masterSchedule',label:'Календарь',icon:'calendar'},
      {key:'orders',label:'Заявки',icon:'orders'},
      {key:'chats',label:'Чаты',icon:'chats',badge:'chat'}
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
  function personalContext(){return (identity().contexts||[]).find(c=>String(c?.type||'').toLowerCase()==='personal')||null;}
  function actionAllowed(item){if(item?.action==='personalGarage')return Boolean(personalContext()&&registry()?.has?.('cabinetGarage'));return routeAllowed(item?.key);}
  function badge(item){const n=item.badge==='chat'?state.unreadChats:item.badge==='notifications'?state.unreadNotifications:0;return n>0?`<b class="k-more-window-badge">${n>99?'99+':n}</b>`:'';}
  function actionMarkup(item,index){const allowed=actionAllowed(item),special=item.action?` data-smart-action-special="${esc(item.action)}"`:'';return `<button type="button" class="k-more-window-action k-more-window-action--${index+1}" data-smart-action-route="${esc(item.key)}"${special} ${allowed?'':'disabled aria-disabled="true"'}><span class="k-more-window-action__inside"><span class="k-more-window-action__icon">${iconSvg(item.icon)}</span><span>${esc(item.label)}</span></span>${badge(item)}</button>`;}
  function contextLabel(c){if(c.type==='personal')return'Клиент';const p=String(c.profileType||c.profile_type||'').toLowerCase();if(p==='master')return'Мастер';if(p==='seller')return'Магазин';if(String(c.organizationType||c.organization_type||'').includes('store'))return'Магазин';return'СТО';}
  function ensure(){
    if(state.root&&document.body.contains(state.root))return state.root;
    const root=document.createElement('div');root.id='k-smart-action-hub';root.className='k-smart-action-hub k-more-window-host';root.hidden=true;root.dataset.contract=MORE_WINDOW_CONTRACT;
    root.innerHTML=`<section class="k-more-window" role="region" aria-label="Ещё"><main class="k-more-window-main"><button type="button" class="k-more-window-profile" data-smart-action-route="cabinet"><span class="k-more-window-avatar" data-more-avatar></span><span class="k-more-window-profile__body"><span class="k-more-window-profile__context" data-more-context></span><strong data-more-profile-title></strong><span class="k-more-window-profile__meta"><span>${iconSvg('phone')}<i data-more-profile-phone>Телефон не указан</i></span><span>${iconSvg('location')}<i data-more-profile-city>Город не указан</i></span></span><span class="k-more-window-profile__stats"><span><b data-more-profile-vehicles>0</b><small>авто</small></span><span><b data-more-profile-promos>0</b><small>акции</small></span><span><b data-more-profile-chats>0</b><small>чаты</small></span></span></span><span class="k-more-window-profile__chevron">${iconSvg('chevronRight')}</span></button><div class="k-more-window-summary"><button type="button" class="k-more-window-summary-card" data-smart-action-route="cabinetGarage"><span class="k-more-window-summary-card__icon">${iconSvg('car')}</span><span><b>Гараж</b><small>Мои автомобили</small></span><strong data-more-garage-count>0</strong></button><button type="button" class="k-more-window-summary-card" data-smart-action-route="cabinetPromos"><span class="k-more-window-summary-card__icon">${iconSvg('discount')}</span><span><b>Акции</b><small>Выгодные предложения</small></span><strong data-more-promo-count>0</strong></button></div><section class="k-more-window-quick"><h2>Быстрый доступ</h2><div class="k-more-window-hub" data-more-actions></div></section><aside class="k-more-window-support"><span class="k-more-window-support__icon">${iconSvg('help')}</span><span><strong>Поддержка KARETA.KZ</strong><small>Мы поможем решить любой вопрос</small></span><button type="button" data-smart-action-route="help">Написать</button></aside><div class="k-more-window-status" data-more-status role="alert" hidden><span data-more-status-text></span><button type="button" data-more-retry>Повторить</button></div></main></section>`;
    document.body.appendChild(root);
    root.addEventListener('click',async event=>{
      const retry=event.target.closest('[data-more-retry]');if(retry){state.error='';render();return;}
      const route=event.target.closest('[data-smart-action-route]');if(!route||route.disabled)return;
      const key=route.dataset.smartActionRoute,special=route.dataset.smartActionSpecial||'';
      if(special==='personalGarage'){await openPersonalGarage();return;}
      if(special==='connections'){try{sessionStorage.setItem('kareta.settings.focus','messaging');}catch(_e){}close();navigate('cabinetSettings');return;}
      close();navigate(key);
    });
    state.root=root;return root;
  }

  function navigate(key){if(window.KaretaRouteRuntime?.navigate)window.KaretaRouteRuntime.navigate(key,{source:'more-window'});else{const route=registry()?.get?.(key);if(route?.path)location.hash=route.path;}}
  async function openPersonalGarage(){
    const target=personalContext();if(!target){state.error='Личный гараж недоступен для этого аккаунта';render();return false;}
    const id=String(target.id||target.key||'');if(!id)return false;
    try{if(String(identity().context?.id||identity().context?.key||'')!==id)await window.KaretaNavigationCore?.switchContext?.(id);close();navigate('cabinetGarage');return true;}
    catch(error){state.error=error?.message||'Не удалось открыть личный гараж';render();return false;}
  }
  function masterStatusLabel(value){return ({online:'Свободен',available:'Свободен',busy:'Занят',break:'Пауза',paused:'Пауза',day_off:'Выходной',offline:'Не принимает'})[String(value||'').toLowerCase()]||'Статус не указан';}
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
    const masterMode=kind()==='master';
    const masterSpec=String(user.spec||user.specialization||snap.context?.meta?.spec||snap.context?.label||'Специализация не указана').trim();
    const masterRating=Number(user.rating||snap.context?.meta?.rating||0);
    const masterStatus=masterStatusLabel(user.availability||snap.context?.meta?.availability||snap.context?.meta?.status||'');
    const phoneNode=root.querySelector('[data-more-profile-phone]');if(phoneNode)phoneNode.textContent=masterMode?masterSpec:(phone||'Телефон не указан');
    const cityNode=root.querySelector('[data-more-profile-city]');if(cityNode)cityNode.textContent=masterMode?(city||'Город не указан'):(city||'Город не указан');
    const profileVehicles=root.querySelector('[data-more-profile-vehicles]');if(profileVehicles)profileVehicles.textContent=masterMode?(masterRating>0?masterRating.toFixed(1):'—'):String(vehicleCount);
    const profilePromos=root.querySelector('[data-more-profile-promos]');if(profilePromos)profilePromos.textContent=masterMode?masterStatus:String(promotionCount);
    const profileChats=root.querySelector('[data-more-profile-chats]');if(profileChats)profileChats.textContent=String(state.unreadChats||0);
    const statLabels=root.querySelectorAll('.k-more-window-profile__stats small');if(statLabels.length>=3){statLabels[0].textContent=masterMode?'рейтинг':'авто';statLabels[1].textContent=masterMode?'статус':'акции';statLabels[2].textContent='чаты';}
    const summary=root.querySelector('.k-more-window-summary');if(summary)summary.hidden=masterMode;
    const garageCount=root.querySelector('[data-more-garage-count]');if(garageCount)garageCount.textContent=String(vehicleCount);
    const promoCount=root.querySelector('[data-more-promo-count]');if(promoCount)promoCount.textContent=String(promotionCount);
    const box=root.querySelector('[data-more-actions]');if(box)box.innerHTML=items.map(actionMarkup).join('')+`<span class="k-more-window-core" aria-hidden="true">${iconSvg(masterMode?'masters':'car')}</span>`;
    const support=root.querySelector('.k-more-window-support');if(support)support.hidden=masterMode;
    const quickTitle=root.querySelector('.k-more-window-quick h2');if(quickTitle)quickTitle.textContent=masterMode?'Действия мастера':'Быстрый доступ';
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
  window.addEventListener('kareta:chat-unread',e=>setUnread('chat',e.detail?.count));
  window.addEventListener('kareta:notification-unread',e=>setUnread('notifications',e.detail?.count));
  window.KaretaSmartActionHub=Object.freeze({open,close,toggle,setLayout,savePreference,loadPreference,switchAccountContext,snapshot:()=>({...state,root:undefined})});
})();
;

/* SOURCE: js/next/navigation_state.js */
(() => {
  'use strict';

  const RELEASE = 'r1885590-full-page-session-state';
  const SCROLL_KEY = 'kareta.navigation.v3';
  const PAGE_KEY = 'kareta.page-state.v3';
  const LEGACY_SCROLL_KEY = 'kareta.navigation.v2';
  const LEGACY_PAGE_KEY = 'kareta.page-state.v2';
  const MAX_AGE = 12 * 60 * 60 * 1000;
  const MAX_ROUTES = 40;
  const MAX_CONTROLS = 160;
  const MAX_TEXT = 12000;
  const ASYNC_RESTORE_WINDOW_MS = 12000;
  const DOCUMENT_ID = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  const positions = new Map();
  const pages = new Map();
  const modalRestorers = new Map();
  const pendingAsync = new Map();
  let restoreToken = 0;
  let saveTimer = 0;
  let observer = null;

  const cssEscape = value => (window.CSS && typeof window.CSS.escape === 'function')
    ? window.CSS.escape(String(value))
    : String(value).replace(/(["'\\.#:[\]()= ])/g, '\\$1');

  function readStore(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_error) {
      return {};
    }
  }

  const scrollStore = { ...readStore(LEGACY_SCROLL_KEY), ...readStore(SCROLL_KEY) };
  const pageStore = { ...readStore(LEGACY_PAGE_KEY), ...readStore(PAGE_KEY) };
  Object.entries(scrollStore).forEach(([key, value]) => positions.set(key, Math.max(0, Number(value) || 0)));
  Object.entries(pageStore).forEach(([key, value]) => {
    if (value && typeof value === 'object' && Date.now() - Number(value.at || 0) <= MAX_AGE) pages.set(key, value);
  });

  function current(hash = location.hash) {
    return String(hash || '#/home');
  }

  function trimMaps() {
    const ordered = [...pages.entries()].sort((a,b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0));
    ordered.slice(MAX_ROUTES).forEach(([key]) => { pages.delete(key); positions.delete(key); });
    for (const [key, row] of pages.entries()) {
      if (Date.now() - Number(row?.at || 0) > MAX_AGE) { pages.delete(key); positions.delete(key); }
    }
  }

  function persist() {
    trimMaps();
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(Object.fromEntries(positions)));
      sessionStorage.setItem(PAGE_KEY, JSON.stringify(Object.fromEntries(pages)));
      sessionStorage.removeItem(LEGACY_SCROLL_KEY);
      sessionStorage.removeItem(LEGACY_PAGE_KEY);
    } catch (_error) {}
  }

  function scheduleCapture(delay = 260) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => capture(), delay);
  }

  function formDescriptor(node) {
    const form=node?.closest?.('form'); if(!form)return null;
    const attrs=['data-lifecycle-form','data-aftercare-form','data-lifecycle-modal','data-work-form','data-work-review-form','data-exchange-form','data-chat-form','data-request-form'];
    for(const name of attrs){const value=form.getAttribute(name);if(value!==null){return {key:`${name}:${value||'1'}`,selector:`form[${name}${value?`="${cssEscape(value)}"`:''}]`};}}
    if(form.id)return {key:`form-id:${form.id}`,selector:`#${cssEscape(form.id)}`};
    return null;
  }

  function controlKey(node, index) {
    const explicit = node.getAttribute('data-state-key') || node.id;
    if (explicit) return String(explicit);
    const form=formDescriptor(node),name=String(node.name||'');
    if(form&&name)return `${form.key}:${name}`;
    if(name)return name;
    return `${node.tagName.toLowerCase()}:${node.type || ''}:${index}`;
  }

  function controlSelector(node) {
    const own=selectorFor(node);if(own)return own;
    const form=formDescriptor(node),name=String(node.name||'');
    if(form&&name)return `${form.selector} [name="${cssEscape(name)}"]`;
    if(name)return `[name="${cssEscape(name)}"]`;
    return '';
  }

  function selectorFor(node) {
    if (!node || node.nodeType !== 1) return '';
    if (node.id) return `#${cssEscape(node.id)}`;
    const attributes = [
      'data-state-key', 'data-state-panel', 'data-state-scroll', 'data-garage-section',
      'data-vehicle-tab', 'data-filter', 'data-category', 'data-master-tab',
      'data-provider-tab', 'data-work-filter', 'data-news-category', 'data-exchange-tab',
      'data-workflow-tab', 'data-order-tab', 'data-tab', 'data-route-key', 'data-action',
      'data-next-action', 'data-lifecycle-stage'
    ];
    for (const name of attributes) {
      const value = node.getAttribute(name);
      if (value !== null && value !== '') return `[${name}="${cssEscape(value)}"]`;
    }
    return '';
  }

  function isSensitive(node) {
    if (!node || node.nodeType !== 1) return true;
    if (node.matches('[data-no-persist], [type="password"], [type="file"]')) return true;
    const autocomplete = String(node.getAttribute('autocomplete') || '').toLowerCase();
    if (/(one-time-code|current-password|new-password|cc-number|cc-csc|cc-exp|cc-exp-month|cc-exp-year)/.test(autocomplete)) return true;
    const identity = `${node.name || ''} ${node.id || ''} ${node.getAttribute('data-state-key') || ''}`.toLowerCase();
    return /(password|passwd|passcode|otp|one.?time|secret|token|cvv|cvc|card.?number|cardnumber|\bpin\b)/i.test(identity);
  }

  function valueRecord(node, index) {
    if (isSensitive(node)) return null;
    const record = { key:controlKey(node, index), tag:node.tagName.toLowerCase(), type:String(node.type || '') };
    const selector = controlSelector(node); if (selector) record.selector = selector;
    if (node.isContentEditable) record.value = String(node.textContent || '').slice(0, MAX_TEXT);
    else if (node.type === 'checkbox' || node.type === 'radio') record.checked = !!node.checked;
    else record.value = String(node.value ?? '').slice(0, MAX_TEXT);
    return record;
  }

  function captureControls(scope) {
    if (!scope) return [];
    const selector = 'input, textarea, select, [contenteditable="true"][data-state-key]';
    return [...scope.querySelectorAll(selector)].slice(0, MAX_CONTROLS).map(valueRecord).filter(Boolean);
  }

  function captureDetails(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll('details')].slice(0,80).map((node,index) => ({ selector:selectorFor(node), index, open:!!node.open }));
  }

  function captureExpanded(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll('[aria-expanded]')].slice(0,100).map((node,index) => ({
      selector:selectorFor(node), index, expanded:node.getAttribute('aria-expanded') === 'true', controls:String(node.getAttribute('aria-controls') || '')
    }));
  }

  function captureScrollContainers(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll('[data-state-scroll]')].slice(0,50).map((node,index) => ({
      selector:selectorFor(node), index, left:Math.max(0,Number(node.scrollLeft||0)), top:Math.max(0,Number(node.scrollTop||0))
    }));
  }

  function modalOpen(node) {
    if (!node || node.hidden) return false;
    if (node.tagName === 'DIALOG') return !!node.open;
    if (node.classList.contains('open')) return true;
    return node.getAttribute('aria-hidden') !== 'true' && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  }

  function captureSafeModal() {
    const rows = [...document.querySelectorAll('[data-state-modal="safe"]')].filter(modalOpen);
    const node = rows.at(-1); if (!node) return null;
    const key = String(node.getAttribute('data-state-modal-key') || node.id || '').trim();
    if (!key) return null;
    return {
      key,
      selector:selectorFor(node) || `[data-state-modal-key="${cssEscape(key)}"]`,
      context:String(node.getAttribute('data-state-modal-context') || '').slice(0,4000),
      controls:captureControls(node),
      scrollTop:Math.max(0,Number(node.scrollTop||node.querySelector('[data-state-modal-scroll]')?.scrollTop||0)),
    };
  }

  function capture(hash = current()) {
    const route = String(hash);
    const outlet = document.getElementById('k-page-outlet');
    positions.set(route, Math.max(0, window.scrollY || 0));
    if (!outlet) { persist(); return null; }

    const activeSelectors = [];
    outlet.querySelectorAll('[aria-selected="true"], [aria-pressed="true"], .is-active, .active').forEach(node => {
      const selector = selectorFor(node);
      if (selector && !activeSelectors.includes(selector)) activeSelectors.push(selector);
    });

    const focused = outlet.contains(document.activeElement) ? selectorFor(document.activeElement) : '';
    const snapshot = {
      version:3,
      release:RELEASE,
      at:Date.now(),
      documentId:DOCUMENT_ID,
      route,
      routeKey:String(outlet.getAttribute('data-current-route') || ''),
      controls:captureControls(outlet),
      activeSelectors:activeSelectors.slice(0,24),
      details:captureDetails(outlet),
      expanded:captureExpanded(outlet),
      scrollContainers:captureScrollContainers(outlet),
      safeModal:captureSafeModal(),
      focused,
      scrollY:Math.max(0, window.scrollY || 0),
    };
    pages.set(route, snapshot);
    persist();
    return snapshot;
  }

  function save(hash = current()) { return capture(String(hash)); }

  function findControl(scope, record, index) {
    if (!scope) return null;
    if (record.selector) { try { const bySelector = scope.querySelector(record.selector); if (bySelector) return bySelector; } catch (_error) {} }
    if (record.key) {
      try { const byState = scope.querySelector(`[data-state-key="${cssEscape(record.key)}"]`); if (byState) return byState; } catch (_error) {}
      const byId = document.getElementById(record.key); if (byId && scope.contains(byId)) return byId;
      try { const byName = scope.querySelector(`[name="${cssEscape(record.key)}"]`); if (byName) return byName; } catch (_error) {}
    }
    return scope.querySelectorAll('input, textarea, select, [contenteditable="true"][data-state-key]')[index] || null;
  }

  function applyControl(node, record, options = {}) {
    if (!node || isSensitive(node)) return false;
    if (node.isContentEditable) node.textContent = String(record.value ?? '');
    else if (record.type === 'checkbox' || record.type === 'radio') node.checked = !!record.checked;
    else if (Object.prototype.hasOwnProperty.call(record, 'value')) node.value = String(record.value ?? '');
    if (options.dispatchEvents === false) return true;
    try { node.dispatchEvent(new Event('input', { bubbles:true })); } catch (_error) {}
    try { node.dispatchEvent(new Event('change', { bubbles:true })); } catch (_error) {}
    return true;
  }

  function restoreDetails(outlet, rows=[]) {
    let applied=0; const all=outlet?.querySelectorAll('details') || [];
    rows.forEach(row => { let node=null; if(row.selector){try{node=outlet.querySelector(row.selector)}catch(_error){}} if(!node)node=all[row.index]||null; if(node){node.open=!!row.open;applied++;} });
    return applied;
  }

  function restoreExpanded(outlet, rows=[]) {
    let applied=0; const all=outlet?.querySelectorAll('[aria-expanded]') || [];
    rows.forEach(row => { let node=null; if(row.selector){try{node=outlet.querySelector(row.selector)}catch(_error){}} if(!node)node=all[row.index]||null; if(!node)return; node.setAttribute('aria-expanded',row.expanded?'true':'false'); if(row.controls){const panel=document.getElementById(row.controls);if(panel){panel.hidden=!row.expanded;panel.classList.toggle('is-open',!!row.expanded);}} applied++; });
    return applied;
  }

  function restoreScrollContainers(outlet, rows=[]) {
    let applied=0; const all=outlet?.querySelectorAll('[data-state-scroll]') || [];
    rows.forEach(row=>{let node=null;if(row.selector){try{node=outlet.querySelector(row.selector)}catch(_error){}}if(!node)node=all[row.index]||null;if(node){node.scrollLeft=Math.max(0,Number(row.left||0));node.scrollTop=Math.max(0,Number(row.top||0));applied++;}});
    return applied;
  }

  function modalNode(snapshot) {
    if (!snapshot) return null;
    let node=null; if(snapshot.selector){try{node=document.querySelector(snapshot.selector)}catch(_error){}}
    if(!node&&snapshot.key){try{node=document.querySelector(`[data-state-modal-key="${cssEscape(snapshot.key)}"]`)}catch(_error){}}
    return node;
  }

  function applyModalSnapshot(node, snapshot, options={}) {
    if(!node||!snapshot)return 0;
    let applied=0;(snapshot.controls||[]).forEach((record,index)=>{if(applyControl(findControl(node,record,index),record,{...options,dispatchEvents:false}))applied++;});
    if(node.tagName==='DIALOG'){if(!node.open){try{node.showModal()}catch(_error){try{node.setAttribute('open','')}catch(_e){}}}}
    else{node.hidden=false;node.classList.add('open');node.setAttribute('aria-hidden','false');}
    const scroller=node.querySelector('[data-state-modal-scroll]')||node;if(snapshot.scrollTop)scroller.scrollTop=Math.max(0,Number(snapshot.scrollTop||0));
    return applied+1;
  }

  function restoreSafeModal(snapshot, options={}) {
    if(!snapshot?.key || options.restoreModal===false)return 0;
    let node=modalNode(snapshot);
    if(!node){const restorer=modalRestorers.get(snapshot.key);if(typeof restorer==='function'){try{node=restorer({...snapshot})||modalNode(snapshot);}catch(_error){node=null;}}}
    return applyModalSnapshot(node,snapshot,options);
  }

  function safeReplay(node) {
    if(!node)return false;
    return node.matches('[data-exchange-tab],[data-workflow-tab],[data-order-tab],[data-master-tab],[data-provider-tab],[data-vehicle-tab],[data-tab]');
  }

  function restoreNow(route, snapshot, options={}) {
    const outlet=document.getElementById('k-page-outlet');
    let applied=0;
    if(snapshot && Date.now()-Number(snapshot.at||0)<=MAX_AGE && outlet){
      (snapshot.controls||[]).forEach((record,index)=>{if(applyControl(findControl(outlet,record,index),record,options))applied++;});
      applied+=restoreDetails(outlet,snapshot.details||[]);
      applied+=restoreExpanded(outlet,snapshot.expanded||[]);
      applied+=restoreScrollContainers(outlet,snapshot.scrollContainers||[]);
      if(options.replayActive!==false){
        (snapshot.activeSelectors||[]).forEach(selector=>{let node=null;try{node=outlet.querySelector(selector)}catch(_error){}if(!node)return;if(safeReplay(node)&&!node.matches('[aria-selected="true"],[aria-pressed="true"],.is-active,.active')){try{node.click();applied++;}catch(_error){}}});
      }
      applied+=restoreSafeModal(snapshot.safeModal,options);
      if(options.restoreFocus===true && snapshot.focused){try{outlet.querySelector(snapshot.focused)?.focus({preventScroll:true});}catch(_error){}}
    }
    const fallbackY=positions.get(route);
    const y=snapshot&&Number.isFinite(Number(snapshot.scrollY))?Number(snapshot.scrollY):(Number.isFinite(fallbackY)?fallbackY:0);
    window.scrollTo({top:Math.max(0,y),left:0,behavior:'auto'});
    return applied;
  }


  function expectedRestoreUnits(snapshot){
    if(!snapshot)return 0;
    return (snapshot.controls||[]).length+(snapshot.details||[]).length+(snapshot.expanded||[]).length+(snapshot.scrollContainers||[]).length+(snapshot.safeModal?((snapshot.safeModal.controls||[]).length+1):0);
  }
  function restoreSatisfied(snapshot,applied){
    const expected=expectedRestoreUnits(snapshot);
    if(expected===0)return true;
    const required=Math.min(expected,Math.max(1,Math.ceil(expected*.6)));
    return Number(applied||0)>=required;
  }

  function markRestored(route,snapshot){if(!snapshot)return;snapshot.documentId=DOCUMENT_ID;snapshot.restoredAt=Date.now();pages.set(route,snapshot);pendingAsync.delete(route);persist();}

  function scheduleAsyncRestore(route,snapshot,options={}){
    if(!snapshot||snapshot.documentId===DOCUMENT_ID)return;
    pendingAsync.set(route,{snapshot,options:{...options,dispatchEvents:false,replayActive:true},deadline:Date.now()+ASYNC_RESTORE_WINDOW_MS});
    ensureObserver();
    setTimeout(()=>{const row=pendingAsync.get(route);if(row&&Date.now()>=row.deadline){pendingAsync.delete(route);markRestored(route,row.snapshot);}},ASYNC_RESTORE_WINDOW_MS+50);
  }

  function tryPendingRestore(){
    const route=current();const row=pendingAsync.get(route);if(!row)return;
    if(Date.now()>row.deadline){pendingAsync.delete(route);markRestored(route,row.snapshot);return;}
    const applied=restoreNow(route,row.snapshot,row.options);
    if(restoreSatisfied(row.snapshot,applied))markRestored(route,row.snapshot);
  }

  function ensureObserver(){
    if(observer||typeof MutationObserver!=='function')return;
    observer=new MutationObserver(()=>{if(pendingAsync.size)requestAnimationFrame(tryPendingRestore)});
    const root=document.getElementById('k-page-outlet')||document.body;
    if(root)observer.observe(root,{subtree:true,childList:true});
  }

  function restore(hash=current(),options={}){
    const route=String(hash);const snapshot=pages.get(route);const token=++restoreToken;
    if(snapshot&&snapshot.documentId!==DOCUMENT_ID)scheduleAsyncRestore(route,snapshot,options);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==restoreToken)return;
      const applied=restoreNow(route,snapshot,options);
      if(snapshot&&snapshot.documentId!==DOCUMENT_ID&&restoreSatisfied(snapshot,applied))markRestored(route,snapshot);
    }));
  }

  function restoreAfterAsync(hash=current(),options={}){
    const route=String(hash),snapshot=pages.get(route);if(!snapshot)return false;
    const applied=restoreNow(route,snapshot,{...options,dispatchEvents:false});
    if(snapshot.documentId!==DOCUMENT_ID&&restoreSatisfied(snapshot,applied))markRestored(route,snapshot);
    return applied>0;
  }

  function registerModalRestorer(key,restorer){if(!key||typeof restorer!=='function')return()=>{};modalRestorers.set(String(key),restorer);return()=>{if(modalRestorers.get(String(key))===restorer)modalRestorers.delete(String(key));};}

  function back(fallback='#/home'){save();if(history.length>1){history.back();return;}location.hash=fallback;}
  function clear(hash=current()){const route=String(hash);positions.delete(route);pages.delete(route);pendingAsync.delete(route);persist();}

  document.addEventListener('click',event=>{const node=event.target.closest('[data-smart-back]');if(!node)return;event.preventDefault();back(node.getAttribute('data-fallback')||'#/home');});
  document.addEventListener('input',event=>{if(event.target.closest('#k-page-outlet,[data-state-modal="safe"]'))scheduleCapture(320);},{passive:true});
  document.addEventListener('change',event=>{if(event.target.closest('#k-page-outlet,[data-state-modal="safe"]'))scheduleCapture(120);},{passive:true});
  document.addEventListener('toggle',event=>{if(event.target.closest?.('#k-page-outlet'))scheduleCapture(80);},true);
  document.addEventListener('click',event=>{if(event.target.closest('[aria-expanded],[data-exchange-tab],[data-workflow-tab],[data-order-tab],[data-master-tab],[data-provider-tab],[data-vehicle-tab],[data-tab],[data-state-modal="safe"]'))scheduleCapture(120);},true);
  window.addEventListener('pagehide',()=>save());
  window.addEventListener('beforeunload',()=>save());
  window.addEventListener('pageshow',event=>{if(event.persisted)restore(current(),{replayActive:false,dispatchEvents:false,restoreModal:true});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();else restore(current(),{replayActive:false,dispatchEvents:false,restoreModal:true});});
  window.addEventListener('kareta:routechange',()=>ensureObserver());

  ensureObserver();

  window.KaretaNavigationState=Object.freeze({
    save,capture,restore,restoreAfterAsync,registerModalRestorer,back,clear,
    get:(hash=current())=>pages.get(String(hash))||null,
    getControl:(key,hash=current())=>{const row=pages.get(String(hash));return (row?.controls||[]).find(x=>x.key===key||x.selector===key)||null;},
    documentId:()=>DOCUMENT_ID,
    release:RELEASE,
  });
})();
;

/* SOURCE: js/next/mobile_back.js */
(() => {
  'use strict';

  const HOME = '#/home';
  const ONBOARDING = /^(#(?:\/)?(?:role|profile|entry|onboarding|welcome|benefits|transparency))/i;
  let syncFrame = 0;
  const BACK_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"></path><path d="M9 12h11"></path></svg>';

  function fallbackFor(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    if (/^#\/works\/item\//.test(hash)) return '#/works';
    if (/^#\/parts\/item\//.test(hash)) return '#/parts';
    if (/^#\/services\/item\//.test(hash)) return '#/services';
    if (/^#\/masters\/profile\//.test(hash)) return '#/masters';
    if (/^#\/orders\/item\//.test(hash) || hash === '#/orders/new') return '#/orders';
    if (/^#\/garage\/car\//.test(hash)) return '#/cabinet/garage';
    if (/^#\/cabinet\//.test(hash)) return '#/cabinet';
    return HOME;
  }

  function isOnboarding(hashValue) {
    return ONBOARDING.test(String(hashValue || location.hash || HOME));
  }

  function shouldShowBack(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    return hash !== HOME && !isOnboarding(hash);
  }

  function shouldShowChat(hashValue) {
    return !isOnboarding(hashValue);
  }

  function shouldShowOrders(hashValue) {
    return !isOnboarding(hashValue);
  }

  function isOrdersSurface(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    return /^#\/orders(?:$|[/?])/.test(hash) || hash === '#/workflow';
  }

  function isProtectedContentSurface(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    return /^#\/(?:parts(?:\/|$)|masters(?:\/|$)|cabinet\/garage(?:\/|$))/.test(hash);
  }

  function hideZeroBadge(id) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const value = Number(String(badge.textContent || '').trim());
    if (!Number.isFinite(value) || value <= 0) {
      badge.hidden = true;
      badge.textContent = '';
    }
  }


  function setChatBadge(count) {
    const badge = document.getElementById('k-mobile-chat-badge');
    if (!badge) return;
    const next = Math.max(0, Number(count) || 0);
    badge.hidden = next < 1;
    badge.textContent = next > 99 ? '99+' : String(next);
    const button = document.getElementById('k-mobile-chat');
    if (button) button.setAttribute('aria-label', next > 0 ? `Открыть чаты, непрочитанных: ${next}` : 'Открыть чаты');
  }

  function syncNow() {
    const backButton = document.getElementById('k-mobile-back');
    const chatButton = document.getElementById('k-mobile-chat');
    const ordersButton = document.getElementById('k-mobile-orders');
    const stack = document.getElementById('k-mobile-fab-stack');
    const hash = location.hash || HOME;
    const protectContent = isProtectedContentSurface(hash);

    if (backButton) {
      backButton.hidden = !shouldShowBack(hash);
      backButton.dataset.fallback = fallbackFor(hash);
    }
    if (chatButton) {
      chatButton.hidden = protectContent || !shouldShowChat(hash);
      chatButton.setAttribute('aria-current', /^#\/chats(?:$|[/?])/.test(hash) ? 'page' : 'false');
    }
    if (ordersButton) {
      ordersButton.hidden = protectContent || !shouldShowOrders(hash);
      ordersButton.setAttribute('aria-current', isOrdersSurface(hash) ? 'page' : 'false');
    }
    hideZeroBadge('k-mobile-chat-badge');
    hideZeroBadge('k-mobile-orders-badge');
    if (stack) stack.hidden = isOnboarding(hash) || protectContent;
  }

  function sync() {
    if (syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      syncNow();
    });
  }

  function back() {
    const button = document.getElementById('k-mobile-back');
    const fallback = button?.dataset.fallback || HOME;
    if (window.KaretaNavigationState?.back) {
      window.KaretaNavigationState.back(fallback);
      return;
    }
    if (history.length > 1) history.back();
    else location.hash = fallback;
  }

  function openOrders() {
    const button=document.getElementById('k-mobile-orders');
    const target=button?.dataset.actionRoute || window.KaretaNavigationCore?.primaryAction?.().key || 'orders';
    if (window.KaretaRouteRuntime?.navigate) {
      window.KaretaRouteRuntime.navigate(target, { source:'mobile-primary-action' });
      return;
    }
    location.hash = window.KaretaRouteRegistry?.get?.(target)?.path || '#/orders';
  }

  function openChats() {
    if (window.KaretaRouteRuntime?.navigate) {
      window.KaretaRouteRuntime.navigate('chats', { source:'mobile-chat-fab' });
      return;
    }
    location.hash = '#/chats';
  }

  function ensureHeaderPlacement() {
    const backButton = document.getElementById('k-mobile-back');
    const header = document.getElementById('k-shell-header');
    if (!backButton || !header) return backButton;
    if (backButton.parentElement !== header) {
      const brand = header.querySelector(':scope > .k-brand');
      header.insertBefore(backButton, brand || header.firstChild);
    }
    if (backButton.dataset.iconVersion !== '84.75') {
      backButton.innerHTML = BACK_ICON_SVG;
      backButton.dataset.iconVersion = '84.75';
    }
    return backButton;
  }

  function boot() {
    const backButton = ensureHeaderPlacement();
    const chatButton = document.getElementById('k-mobile-chat');
    const ordersButton = document.getElementById('k-mobile-orders');

    if (backButton && backButton.dataset.bound !== '1') {
      backButton.dataset.bound = '1';
      backButton.addEventListener('click', back);
    }
    if (chatButton && chatButton.dataset.bound !== '1') {
      chatButton.dataset.bound = '1';
      chatButton.addEventListener('click', openChats);
    }
    if (ordersButton && ordersButton.dataset.bound !== '1') {
      ordersButton.dataset.bound = '1';
      ordersButton.addEventListener('click', openOrders);
    }

    if (document.documentElement.dataset.mobileFabBound !== '1') {
      document.documentElement.dataset.mobileFabBound = '1';
      window.addEventListener('hashchange', sync);
      window.addEventListener('popstate', sync);
      window.addEventListener('pageshow', sync);
      window.addEventListener('kareta:routechange', sync);
      window.addEventListener('kareta:chat-unread', event => setChatBadge(event.detail?.count));
      window.addEventListener('kareta:primary-action-changed', sync);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    }
    setChatBadge(window.KaretaShellNav?.getState?.().unreadChats || 0);
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.KaretaMobileBack = Object.freeze({ sync, fallbackFor });
})();
;

/* SOURCE: js/next/mobile_filters.js */
(() => {
  'use strict';

  const MAX_WIDTH = 900;
  const ROOT_ID = 'k-mobile-filter-stack';
  const MODAL_ID = 'k-mobile-filter-modal';
  const SEARCH_CARD_ID = 'k-mobile-filter-search-card';
  const QUICK_ACTIONS_ID = 'k-mobile-quick-actions';
  let syncFrame = 0;
  let observer = null;
  let signature = '';
  let currentBar = null;
  let activeTrigger = null;

  const definitions = Object.freeze([
    { kind:'search', label:'Поиск', source:'.k-masters-search input[type="search"]', input:true },
    { kind:'city', label:'Город', source:'.k-masters-geo select', select:true },
    { kind:'filter', label:'Фильтры', source:'.k-catalog-filter-panel, .k-masters-filter-panel', panel:true },
    { kind:'sort', label:'Сортировка', source:'.k-shop-sort select', select:true }
  ]);

  function mobile(){ return window.matchMedia(`(max-width:${MAX_WIDTH}px)`).matches; }
  function onboarding(){ return document.body.classList.contains('onboarding-active') || document.body.classList.contains('is-onboarding'); }
  function homeRoute(){ const route=String(location.hash||'#/home').split('?')[0].replace(/^#\/?/,'').replace(/\/+$/,''); return route==='' || route==='home'; }
  function connected(node){ return !!(node && node.isConnected); }
  function log(event,data={}){ try{ window.KaretaRuntimeLog?.event?.(`mobileFilters.${event}`,data); }catch(_){} }

  function icon(name){
    const icons={
      search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>',
      city:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="3"></circle><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"></path></svg>',
      filter:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>',
      sort:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"></path></svg>',
      tow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h13l3 3v2H5a2 2 0 0 1-2-2v-3Z"></path><path d="M6 15V8h8l3 7M8 20a2 2 0 1 0 0 .01M17 20a2 2 0 1 0 0 .01M14 8V5h4l3 3-3 3h-4"></path></svg>',
      lawyer:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 7h14M7 7l-3 6h6L7 7Zm10 0-3 6h6l-3-6ZM8 21h8"></path></svg>',
      services:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3-3a4 4 0 0 1-5.2 5.2L5 16l3 3 7.5-7.5a4 4 0 0 1 5.2-5.2l-3 3-3-3Z"></path><path d="m4 4 4 4"></path></svg>'
    };
    return icons[name]||'';
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(!root){
      root=document.createElement('aside'); root.id=ROOT_ID; root.className='k-mobile-filter-stack';
      root.setAttribute('aria-label','Поиск и фильтры страницы'); root.hidden=true; document.body.appendChild(root);
    }
    return root;
  }

  function ensureQuickActions(){
    let actions=document.getElementById(QUICK_ACTIONS_ID);
    if(actions) return actions;
    actions=document.createElement('nav');
    actions.id=QUICK_ACTIONS_ID;
    actions.className='k-mobile-quick-actions';
    actions.setAttribute('aria-label','Быстрые действия');
    const items=[
      {kind:'tow',label:'Эвакуатор',href:'#/tow-truck'},
      {kind:'lawyer',label:'Автоюрист',href:'#/lawyer'},
      {kind:'services',label:'Услуги',href:'#/services'}
    ];
    actions.innerHTML=items.map(item=>`<a class="k-mobile-quick-action k-mobile-quick-action--${item.kind}" href="${item.href}" data-route-link="${item.href.slice(2)}" aria-label="${item.label}" title="${item.label}"><span aria-hidden="true">${icon(item.kind)}</span><span class="k-mobile-filter-label">${item.label}</span></a>`).join('');
    document.body.appendChild(actions);
    return actions;
  }

  function positionQuickActions(root,actions){
    if(!actions) return;
    const stackVisible=root && !root.hidden && root.childElementCount>0;
    const stackHeight=stackVisible ? Math.ceil(root.getBoundingClientRect().height) : 0;
    const gap=stackVisible ? 12 : 0;
    actions.style.setProperty('--k-mobile-filter-stack-height',`${stackHeight}px`);
    actions.style.setProperty('--k-mobile-filter-stack-gap',`${gap}px`);
  }

  function ensureSearchCard(){
    let card=document.getElementById(SEARCH_CARD_ID);
    if(card) return card;
    card=document.createElement('section');
    card.id=SEARCH_CARD_ID;
    card.className='k-mobile-filter-search-card';
    card.hidden=true;
    card.setAttribute('aria-label','Поиск по странице');
    document.body.appendChild(card);
    return card;
  }

  function closeSearchCard(){
    const card=document.getElementById(SEARCH_CARD_ID);
    if(!card) return;
    card.hidden=true;
    card.replaceChildren();
    document.body.classList.remove('k-mobile-filter-search-open');
    document.querySelector('.k-mobile-filter-button--search')?.setAttribute('aria-expanded','false');
  }

  function ensureModal(){
    let modal=document.getElementById(MODAL_ID);
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id=MODAL_ID;
    modal.className='k-mobile-filter-modal';
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="k-mobile-filter-modal__backdrop" data-mobile-filter-dismiss></div><section class="k-mobile-filter-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="k-mobile-filter-title"><div class="k-mobile-filter-modal__grabber" aria-hidden="true"></div><header><h2 id="k-mobile-filter-title" data-mobile-filter-title>Фильтры</h2></header><div class="k-mobile-filter-modal__body" data-mobile-filter-body></div><footer data-mobile-filter-footer></footer></section>';
    modal.addEventListener('click',event=>{ if(event.target.closest('[data-mobile-filter-dismiss]')) closeModal(); });
    let dragStartY=0; let dragging=false;
    const sheet=modal.querySelector('.k-mobile-filter-modal__sheet');
    sheet.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse' && event.button!==0) return;
      if(event.target.closest('.k-mobile-filter-modal__body')) return;
      dragStartY=event.clientY; dragging=true; sheet.setPointerCapture?.(event.pointerId);
    });
    sheet.addEventListener('pointermove',event=>{
      if(!dragging) return; const delta=Math.max(0,event.clientY-dragStartY);
      sheet.style.transform=`translateY(${Math.min(delta,180)}px)`;
    });
    const finishDrag=event=>{
      if(!dragging) return; dragging=false; const delta=Math.max(0,event.clientY-dragStartY);
      sheet.style.transform=''; if(delta>72) closeModal();
    };
    sheet.addEventListener('pointerup',finishDrag); sheet.addEventListener('pointercancel',finishDrag);
    document.body.appendChild(modal); return modal;
  }

  function toolbar(){
    const candidates=[...document.querySelectorAll('.k-masters-toolbar, .k-catalog-toolbar, .k-orders-toolbar-v2, .k-exchange-toolbar')];
    return candidates.find(node=>node.isConnected && node.closest('.k-page-outlet'))||null;
  }

  function sourceFor(bar,def){ return bar?.querySelector(def.source)||null; }
  function controlsFor(bar){ return definitions.map(def=>[def,sourceFor(bar,def)]).filter(([,node])=>connected(node)); }

  function closeModal(){
    const modal=document.getElementById(MODAL_ID); if(!modal) return;
    modal.classList.remove('is-open','is-closing');
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.inert=true;
    const sheet=modal.querySelector('.k-mobile-filter-modal__sheet');
    if(sheet) sheet.style.transform='';
    document.body.classList.remove('k-mobile-filter-modal-open');
    if(activeTrigger){ activeTrigger.setAttribute('aria-expanded','false'); activeTrigger=null; }
  }

  function dispatchValue(source,value){
    source.value=value;
    source.dispatchEvent(new Event('input',{bubbles:true}));
    source.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function submitSearch(bar,input){
    const button=bar.querySelector('[data-services-submit], [data-shop-submit], [data-orders-submit], [data-masters-submit], .k-masters-search-button');
    if(button){ button.click(); return; }
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function openSearchCard(bar,source){
    const card=ensureSearchCard();
    const wasOpen=!card.hidden;
    closeModal();
    if(wasOpen){ closeSearchCard(); return; }

    const field=document.createElement('label');
    field.className='k-mobile-filter-search-card__field';
    field.innerHTML=`<span class="k-mobile-filter-search-card__icon" aria-hidden="true">${icon('search')}</span><input type="search" autocomplete="off"><button type="button" class="k-mobile-filter-search-card__clear" aria-label="Очистить поиск">×</button>`;
    const input=field.querySelector('input');
    const clear=field.querySelector('button');
    input.placeholder=source.placeholder||'Поиск';
    input.value=source.value||'';

    const apply=()=>{ dispatchValue(source,input.value); submitSearch(bar,source); sync(); };
    input.addEventListener('input',()=>{
      dispatchValue(source,input.value);
      clear.hidden=!input.value;
    });
    input.addEventListener('search',apply);
    input.addEventListener('keydown',event=>{ if(event.key==='Enter'){ event.preventDefault(); apply(); } if(event.key==='Escape'){ closeSearchCard(); } });
    clear.addEventListener('click',()=>{ input.value=''; clear.hidden=true; dispatchValue(source,''); submitSearch(bar,source); input.focus(); });
    clear.hidden=!input.value;

    card.replaceChildren(field);
    card.hidden=false;
    document.querySelector('.k-mobile-filter-button--search')?.setAttribute('aria-expanded','true');
    document.body.classList.add('k-mobile-filter-search-open');
    requestAnimationFrame(()=>input.focus({preventScroll:true}));
    log('searchCardOpen',{route:location.hash||'#/home'});
  }

  function openSelect(dialog,source){
    const body=dialog.querySelector('[data-mobile-filter-body]'); const footer=dialog.querySelector('[data-mobile-filter-footer]');
    const list=document.createElement('div'); list.className='k-mobile-filter-options';
    [...source.options].forEach(option=>{
      const button=document.createElement('button'); button.type='button'; button.className='k-mobile-filter-option';
      if(String(option.value)===String(source.value)) button.classList.add('is-active');
      button.innerHTML=`<span>${option.textContent}</span><b aria-hidden="true">✓</b>`;
      button.addEventListener('click',()=>{ dispatchValue(source,option.value); closeModal(); sync(); }); list.appendChild(button);
    });
    body.replaceChildren(list); footer.replaceChildren();
  }

  function preparePanel(bar,panel){
    if(panel.children.length) return;
    const trigger=bar.querySelector('[data-services-filter-toggle], [data-shop-filter-toggle], [data-order-filter-toggle], [data-master-filter-toggle], [data-work-filter-toggle], [data-news-filter-toggle], .k-masters-filter-button');
    trigger?.click(); trigger?.click();
  }

  function openPanel(dialog,bar,panel){
    preparePanel(bar,panel);
    const body=dialog.querySelector('[data-mobile-filter-body]'); const footer=dialog.querySelector('[data-mobile-filter-footer]');
    const list=document.createElement('div'); list.className='k-mobile-filter-options';
    const items=[...panel.querySelectorAll('button,[role="button"]')];
    items.forEach(sourceButton=>{
      const button=document.createElement('button'); button.type='button'; button.className='k-mobile-filter-option';
      if(sourceButton.classList.contains('is-active') || sourceButton.getAttribute('aria-pressed')==='true') button.classList.add('is-active');
      button.innerHTML=`<span>${sourceButton.textContent.trim()}</span><b aria-hidden="true">✓</b>`;
      button.addEventListener('click',()=>{ sourceButton.click(); closeModal(); sync(); }); list.appendChild(button);
    });
    if(!items.length){ const empty=document.createElement('p'); empty.className='k-mobile-filter-empty'; empty.textContent='Для этой страницы дополнительные фильтры не предусмотрены.'; list.appendChild(empty); }
    body.replaceChildren(list); footer.replaceChildren();
  }

  function openModal(kind,bar,source){
    if(!connected(bar)||!connected(source)){ sync(); return; }
    const def=definitions.find(item=>item.kind===kind); if(!def) return;
    const modal=ensureModal(); modal.querySelector('[data-mobile-filter-title]').textContent=def.label;
    modal.dataset.kind=kind;
    if(def.select) openSelect(modal,source);
    else if(def.panel) openPanel(modal,bar,source);
    modal.hidden=false;
    modal.removeAttribute('aria-hidden');
    modal.inert=false;
    document.body.classList.add('k-mobile-filter-modal-open');
    activeTrigger=document.querySelector(`.k-mobile-filter-button--${kind}`);
    activeTrigger?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    log('modalOpen',{kind,route:location.hash||'#/home'});
  }

  function makeButton(def,bar,source){
    const button=document.createElement('button'); button.type='button';
    button.className=`k-mobile-filter-button k-mobile-filter-button--${def.kind}`; button.dataset.mobileFilterKind=def.kind;
    button.setAttribute('aria-label',def.label); button.setAttribute('title',def.label); button.setAttribute('aria-expanded','false');
    button.innerHTML=`<span class="k-mobile-filter-icon" aria-hidden="true">${icon(def.kind)}</span><span class="k-mobile-filter-label">${def.label}</span>`;
    button.addEventListener('click',()=>{ if(def.kind==='search') openSearchCard(bar,source); else { closeSearchCard(); openModal(def.kind,bar,source); } }); return button;
  }

  function currentSignatureFor(bar,controls){ return [location.hash,bar?.className||'',...controls.map(([def,node])=>`${def.kind}:${node?.name||node?.className||''}:${node?.childElementCount||0}`)].join('|'); }

  function syncNow(){
    const root=ensureRoot(); const quickActions=ensureQuickActions(); ensureModal(); ensureSearchCard();
    if(!mobile()||onboarding()){
      root.hidden=true; root.replaceChildren(); quickActions.hidden=true; signature=''; currentBar=null;
      document.body.classList.remove('k-mobile-filters-active'); closeModal(); closeSearchCard(); return;
    }
    const bar=toolbar(); const controls=bar?controlsFor(bar):[];
    if(!bar||!controls.length){
      root.hidden=true; root.replaceChildren(); signature=''; currentBar=null;
      document.body.classList.remove('k-mobile-filters-active'); closeModal(); closeSearchCard();
      quickActions.hidden=!homeRoute();
      if(!quickActions.hidden) requestAnimationFrame(()=>positionQuickActions(root,quickActions));
      return;
    }
    currentBar=bar; document.body.classList.add('k-mobile-filters-active');
    const next=currentSignatureFor(bar,controls);
    if(next!==signature || root.childElementCount!==controls.length){
      signature=next; root.replaceChildren(...controls.map(([def,node])=>makeButton(def,bar,node)));
      log('render',{controls:controls.map(([def])=>def.kind),route:location.hash||'#/home'});
    }
    root.hidden=false;
    quickActions.hidden=!homeRoute();
    if(!quickActions.hidden) requestAnimationFrame(()=>positionQuickActions(root,quickActions));
  }

  function sync(){
    if(syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame=requestAnimationFrame(()=>{ syncFrame=0; try{syncNow();}catch(error){log('error',{message:error?.message||String(error)});} });
  }

  function boot(){
    ensureRoot(); ensureQuickActions(); ensureModal(); ensureSearchCard();
    window.addEventListener('resize',sync,{passive:true}); window.addEventListener('hashchange',sync); window.addEventListener('pageshow',sync); window.addEventListener('kareta:routechange',sync);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
    document.addEventListener('keydown',event=>{ if(event.key==='Escape') closeModal(); });
    document.addEventListener('pointerdown',event=>{
      const card=document.getElementById(SEARCH_CARD_ID);
      if(!card || card.hidden) return;
      if(card.contains(event.target) || event.target.closest?.('.k-mobile-filter-button--search')) return;
      closeSearchCard();
    });
    observer=new MutationObserver(sync); observer.observe(document.querySelector('.k-page-outlet')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','aria-expanded','value']});
    sync();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.KaretaMobileFilters=Object.freeze({sync,open:kind=>{const def=definitions.find(item=>item.kind===kind);const source=def&&sourceFor(currentBar,def);if(def&&source){if(kind==='search')openSearchCard(currentBar,source);else openModal(kind,currentBar,source);}}});
})();
;

/* SOURCE: js/next/session_resume_runtime.js */
(() => {
  'use strict';

  if (window.__KARETA_SESSION_RESUME_RUNTIME__) {
    window.__KARETA_SESSION_RESUME_RUNTIME__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_SESSION_RESUME_RUNTIME__ = { duplicateLoads:0 };

  const RELEASE='r1885589-session-resume-hardening';
  const STORAGE_KEY='kareta.session.resume.v1';
  const PROBE_AFTER_HIDDEN_MS=45_000;
  const MIN_PROBE_INTERVAL_MS=30_000;
  const HINT_MAX_AGE_MS=7*24*60*60*1000;
  const TRANSIENT_STATUS=new Set([0,408,425,429,500,502,503,504]);
  const state={
    hiddenAt:0,
    lastVisibleAt:Date.now(),
    lastProbeAt:0,
    lastVerifiedAt:0,
    probeCount:0,
    skippedCount:0,
    transientFailures:0,
    lastReason:'',
    lastStatus:'idle',
    probing:false,
    offlineSince:0,
    wakeCount:0,
  };
  let flight=null;

  const emit=(name,detail={})=>{try{window.dispatchEvent(new CustomEvent(name,{detail:{...detail,release:RELEASE}}));}catch(_error){}};
  const log=(type,data={},level='info')=>window.KaretaRuntimeLog?.add?.(`session.resume.${type}`,{...data,release:RELEASE},level);
  const normalizeRole=value=>{
    const role=String(value||'').trim().toLowerCase();
    if(role==='service')return 'sto';
    return ['client','master','sto','seller','admin','owner'].includes(role)?role:'client';
  };
  const identitySnapshot=()=>window.KaretaIdentity?.snapshot?.()||{};

  function readHint(){
    try{
      const row=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');
      if(!row||typeof row!=='object')return null;
      if(Date.now()-Number(row.at||0)>HINT_MAX_AGE_MS)return null;
      return row;
    }catch(_error){return null;}
  }

  function writeHint(detail={}){
    const identity=detail.identity||identitySnapshot();
    if(!identity?.authenticated)return null;
    const hint={
      at:Date.now(),
      accountId:Number(identity.account?.id||0)||null,
      contextId:Number(identity.context?.id||0)||null,
      contextKey:String(identity.context?.key||identity.context?.contextKey||''),
      role:normalizeRole(identity.compatibilityRole||document.documentElement.dataset.userRole||'client'),
      revision:Number(identity.revision||0),
      hash:String(location.hash||'#/home'),
    };
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(hint));}catch(_error){}
    document.documentElement.dataset.sessionResumeRole=hint.role;
    state.lastVerifiedAt=hint.at;
    return hint;
  }

  function clearHint(reason='anonymous'){
    try{sessionStorage.removeItem(STORAGE_KEY);}catch(_error){}
    delete document.documentElement.dataset.sessionResumeRole;
    log('hint-cleared',{reason});
  }

  function hint(){
    const row=readHint();
    if(row?.role)document.documentElement.dataset.sessionResumeRole=normalizeRole(row.role);
    return row;
  }

  function routeSnapshot(){
    const hash=String(location.hash||'#/home');
    return {
      hash,
      key:window.KaretaRouteRegistry?.keyFromHash?.(hash)||'',
      contextId:Number(identitySnapshot()?.context?.id||0)||null,
      contextKey:String(identitySnapshot()?.context?.key||''),
      role:normalizeRole(identitySnapshot()?.compatibilityRole||hint()?.role||'client'),
    };
  }

  function preserveUi(before,source){
    const navigation=window.KaretaNavigationCore;
    const current=identitySnapshot();
    const contextChanged=String(before.contextId||before.contextKey||'')!==String(current.context?.id||current.context?.key||'');
    if(contextChanged&&before.key){
      navigation?.refreshAll?.({source,redirect:false,activeKey:before.key});
      navigation?.preserveRouteAfterContextChange?.(before.key,before.hash,source);
    }else{
      navigation?.refreshAll?.({source,redirect:false,activeKey:before.key||undefined});
      if(String(location.hash||'')!==before.hash){
        try{history.replaceState(null,'',before.hash);}catch(_error){}
      }
    }
    window.KaretaNavigationState?.restore?.(before.hash,{replayActive:false,dispatchEvents:false});
    return {contextChanged,hash:String(location.hash||'')};
  }

  function transient(error){
    const status=Number(error?.status||error?.httpStatus||0);
    return TRANSIENT_STATUS.has(status)||error?.name==='AbortError'||/Failed to fetch|NetworkError|network|offline/i.test(String(error?.message||error||''));
  }

  async function probe(reason='resume',options={}){
    if(flight)return flight;
    const now=Date.now();
    const elapsed=now-state.lastProbeAt;
    if(!options.force&&state.lastProbeAt&&elapsed<MIN_PROBE_INTERVAL_MS){
      state.skippedCount+=1;
      log('probe-skipped',{reason,elapsed});
      return false;
    }
    if(navigator.onLine===false){
      state.lastStatus='offline';
      if(!state.offlineSince)state.offlineSince=now;
      document.documentElement.dataset.sessionResume='offline';
      return false;
    }

    const before=routeSnapshot();
    window.KaretaNavigationState?.capture?.(before.hash);
    state.probing=true;
    state.lastProbeAt=now;
    state.probeCount+=1;
    state.lastReason=reason;
    state.lastStatus='checking';
    document.documentElement.dataset.sessionResume='checking';
    emit('kareta:session-resume-check',{reason,before});

    flight=(async()=>{
      try{
        const legacyUser=window.KaretaNext?.state?.user||window.KaretaAppState?.user||null;
        const identity=await window.KaretaIdentity?.load?.({force:true,allowLegacyBridge:true,legacyUser});
        if(!identity?.authenticated){
          state.lastStatus='anonymous';
          document.documentElement.dataset.sessionResume='anonymous';
          log('anonymous',{reason,before},'warn');
          emit('kareta:session-resume-anonymous',{reason,before});
          return false;
        }
        const saved=hint();
        if(saved?.accountId&&Number(identity.account?.id||0)&&Number(saved.accountId)!==Number(identity.account.id)){
          log('account-changed',{reason,from:saved.accountId,to:identity.account.id},'warn');
        }
        const preserved=preserveUi(before,`session-resume:${reason}`);
        writeHint({identity});
        window.KaretaRealtime?.start?.();
        window.KaretaRealtimeClient?.start?.();
        state.lastStatus='verified';
        state.transientFailures=0;
        state.offlineSince=0;
        document.documentElement.dataset.sessionResume='verified';
        emit('kareta:session-resumed',{reason,before,identity,preserved});
        log('verified',{reason,before,preserved,contextId:identity.context?.id||null});
        return true;
      }catch(error){
        if(transient(error)){
          state.transientFailures+=1;
          state.lastStatus='degraded';
          document.documentElement.dataset.sessionResume='degraded';
          // A transient network/backend failure must never own routing or clear the live UI.
          if(String(location.hash||'')!==before.hash){try{history.replaceState(null,'',before.hash);}catch(_error){}}
          window.KaretaNavigationState?.restore?.(before.hash,{replayActive:false,dispatchEvents:false});
          emit('kareta:session-resume-degraded',{reason,error:String(error?.message||error),before});
          log('degraded',{reason,error:String(error?.message||error),before},'warn');
          return false;
        }
        state.lastStatus='failed';
        document.documentElement.dataset.sessionResume='failed';
        emit('kareta:session-resume-failed',{reason,error:String(error?.message||error),before});
        log('failed',{reason,error:String(error?.message||error),before},'error');
        return false;
      }finally{
        state.probing=false;
        flight=null;
      }
    })();
    return flight;
  }

  function shouldProbeAfterResume(hiddenFor){return hiddenFor>=PROBE_AFTER_HIDDEN_MS;}

  function onHidden(){
    state.hiddenAt=Date.now();
    window.KaretaNavigationState?.capture?.();
    const current=identitySnapshot();
    if(current?.authenticated)writeHint({identity:current});
    document.documentElement.dataset.sessionResume='suspended';
    log('hidden',{hash:location.hash,contextId:current?.context?.id||null});
  }

  function onVisible(source='visibility'){
    const now=Date.now();
    const hiddenFor=state.hiddenAt?Math.max(0,now-state.hiddenAt):0;
    state.lastVisibleAt=now;
    state.wakeCount+=hiddenFor>=PROBE_AFTER_HIDDEN_MS?1:0;
    window.KaretaNavigationState?.restore?.(location.hash,{replayActive:false,dispatchEvents:false});
    if(shouldProbeAfterResume(hiddenFor))probe(`${source}:${hiddenFor}`,{force:false});
    else{
      state.skippedCount+=1;
      document.documentElement.dataset.sessionResume=identitySnapshot()?.authenticated?'verified':'idle';
      log('visible-fast',{source,hiddenFor});
    }
    state.hiddenAt=0;
  }

  const initialHint=hint();
  if(initialHint?.role)document.documentElement.dataset.sessionResumeRole=normalizeRole(initialHint.role);

  window.addEventListener('kareta:session-confirmed',event=>{
    const identity=event.detail?.identity||identitySnapshot();
    if(identity?.authenticated)writeHint({identity});
  });
  window.addEventListener('kareta:identity-ready',event=>{
    const identity=event.detail||identitySnapshot();
    if(identity?.authenticated)writeHint({identity});
  });
  window.addEventListener('kareta:context-changed',event=>{
    const identity=event.detail?.identity||identitySnapshot();
    if(identity?.authenticated)writeHint({identity});
  });
  window.addEventListener('kareta:session-anonymous',event=>clearHint(event.detail?.reason||event.detail?.source||'anonymous'));
  window.addEventListener('offline',()=>{
    if(!state.offlineSince)state.offlineSince=Date.now();
    state.lastStatus='offline';
    document.documentElement.dataset.sessionResume='offline';
    window.KaretaNavigationState?.capture?.();
    log('offline',{hash:location.hash});
  });
  window.addEventListener('online',()=>probe('network-online',{force:true}));
  window.addEventListener('pageshow',event=>{
    if(event.persisted)onVisible('pageshow-bfcache');
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')onHidden();
    else if(document.visibilityState==='visible')onVisible('visibility');
  });
  window.addEventListener('pagehide',()=>{
    window.KaretaNavigationState?.capture?.();
    const current=identitySnapshot();
    if(current?.authenticated)writeHint({identity:current});
  });

  window.KaretaSessionResume=Object.freeze({
    RELEASE,
    probe,
    hint,
    clearHint,
    snapshot:()=>({...state,inFlight:!!flight,hint:readHint()}),
  });
})();
;

window.KaretaBootProfiler?.bundleEnd?.("runtime_shell_bundle");
