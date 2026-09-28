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
