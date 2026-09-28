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
