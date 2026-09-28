(() => {
  'use strict';
  const VERSION = String(window.KARETA_NEXT_ASSET_VERSION || 'r168');
  const endpoint = '/api/client_error.php';
  let sent = 0;
  let healthPromise = null;
  let healthCachedAt = 0;
  let healthCachedValue = null;
  const HEALTH_CACHE_MS = 60000;

  function currentRole(){
    try { return window.KaretaRoleAccess?.currentRole?.() || window.KaretaNext?.state?.user?.role || ''; }
    catch (_error) { return ''; }
  }

  function report(payload){
    if (sent >= 10) return;
    sent += 1;
    const body = JSON.stringify({ ...payload, url:location.href, role:currentRole(), version:VERSION });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type:'application/json' }));
        return;
      }
    } catch (_error) {}
    fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true, cache:'no-store' }).catch(() => {});
  }

  if (!window.__KARETA_ERROR_BOUNDARY__) {
    window.__KARETA_ERROR_BOUNDARY__ = 'runtime_integrity';
    window.addEventListener('error', event => {
      const target = event.target;
      if (target && target !== window && (target.src || target.href)) {
        report({ message:'resource_load_failed', source:target.src || target.href });
        return;
      }
      report({ message:event.message || 'window_error', source:event.filename || '', line:event.lineno || 0, column:event.colno || 0, stack:event.error?.stack || '' });
    }, true);
    window.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      report({ message:String(reason?.message || reason || 'unhandled_rejection'), stack:String(reason?.stack || '') });
    });
  }

  async function readJsonResponse(response){
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch (_error) {
      const error = new Error('runtime_health_invalid_json');
      error.status = response.status;
      error.preview = text.slice(0, 180);
      throw error;
    }
    if (!response.ok && !data) throw Object.assign(new Error('runtime_health_http_error'), { status:response.status });
    return data || { ok:false, error:'empty_response' };
  }

  function health(options = {}){
    const force = options.force === true;
    if (!force && healthCachedValue && (Date.now() - healthCachedAt) < HEALTH_CACHE_MS) {
      return Promise.resolve(healthCachedValue);
    }
    if (healthPromise) return healthPromise;
    healthPromise = (async () => {
      try {
        const response = await fetch('/api/runtime_health.php', { cache:'no-store', credentials:'same-origin', headers:{ Accept:'application/json' } });
        const data = await readJsonResponse(response);
        healthCachedAt = Date.now();
        healthCachedValue = data;
        window.KaretaRuntimeHealth = data;
        window.dispatchEvent(new CustomEvent('kareta:runtime-health', { detail:data }));
        return data;
      } catch (error) {
        // Runtime health is diagnostic only. It must never block onboarding or application boot.
        report({ message:'runtime_health_request_failed', stack:error?.stack || String(error), source:error?.preview || '' });
        return null;
      }
    })().finally(() => { healthPromise = null; });
    return healthPromise;
  }

  window.KaretaRuntimeIntegrity = Object.freeze({ health, report });
})();
