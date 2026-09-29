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
      if (hasLegacySession()) {
        if (['client','customer','user'].includes(role)) return 'personal';
        if (role === 'master') return 'master';
        if (role === 'seller') return 'seller';
        if (['sto','service'].includes(role)) return 'organization_service';
      }
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
