(() => {
  'use strict';

  if (window.__KARETA_IDENTITY_FRONTEND_MODULE__) {
    window.__KARETA_IDENTITY_FRONTEND_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_IDENTITY_FRONTEND_MODULE__ = { duplicateLoads:0 };

  const state = {
    loaded:false,
    loading:false,
    authenticated:false,
    account:null,
    session:null,
    contexts:[],
    accountTypes:[],
    context:null,
    capabilities:[],
    deniedCapabilities:[],
    error:'',
    mode:'anonymous',
    revision:0,
  };
  let loadFlight = null;
  let logoutFlight = null;

  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

  function emit(name, detail = {}) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_error) {}
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials:'same-origin',
      ...options,
      headers:{
        Accept:'application/json',
        ...(options.body ? {'Content-Type':'application/json'} : {}),
        ...(options.headers || {}),
      },
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch (_error) {}
    if (!payload || typeof payload !== 'object') {
      const error = new Error('identity_invalid_json');
      error.status = response.status;
      error.payload = { ok:false, error:'identity_invalid_json', contentType:response.headers.get('content-type') || '', preview:raw.slice(0,180) };
      error.invalidJson = true;
      throw error;
    }
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.message || payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function requestWithFallback(primaryUrl, fallbackUrl, options = {}) {
    try { return await request(primaryUrl, options); }
    catch (error) {
      if (!fallbackUrl || (!error.invalidJson && error.status !== 404)) throw error;
      if (error.status >= 500) throw error;
      return request(fallbackUrl, options);
    }
  }

  function normalizeContext(context) {
    if (!context) return null;
    return {
      ...context,
      id:Number(context.id || 0) || null,
      key:String(context.key || context.contextKey || ''),
      type:String(context.type || context.contextType || 'personal'),
      profileType:String(context.profileType || ''),
      label:String(context.label || 'Личный кабинет'),
    };
  }

  function compatibilityRole(context = state.context) {
    if (state.capabilities.includes('*')) return 'admin';
    if (!context) return 'client';
    if (context.type === 'profile') {
      if (context.profileType === 'master') return 'master';
      if (context.profileType === 'seller') return 'seller';
    }
    if (context.type === 'organization') {
      const code = String(context.capabilitySetCode || '');
      if (code.includes('seller') || context.organizationType === 'parts_store') return 'seller';
      return 'sto';
    }
    return 'client';
  }

  function apply(payload, source = 'load') {
    state.loaded = true;
    state.loading = false;
    state.error = '';
    state.authenticated = Boolean(payload?.authenticated ?? payload?.account);
    state.mode = state.authenticated ? 'identity' : 'anonymous';
    state.account = payload?.account || null;
    state.session = payload?.session || state.session || null;
    if (Array.isArray(payload?.contexts)) state.contexts = payload.contexts.map(normalizeContext).filter(Boolean);
    if (Array.isArray(payload?.accountTypes)) state.accountTypes = payload.accountTypes.map(item => ({ ...item, role:String(item?.role || ''), status:String(item?.status || 'available') }));
    if (payload?.currentContext) state.context = normalizeContext(payload.currentContext);
    state.capabilities = Array.isArray(payload?.capabilities) ? [...new Set(payload.capabilities.map(String))] : [];
    state.deniedCapabilities = Array.isArray(payload?.deniedCapabilities) ? [...new Set(payload.deniedCapabilities.map(String))] : [];
    state.revision = Number(payload?.sessionContext?.contextRevision || state.session?.contextRevision || state.revision || 0);

    const root = document.documentElement;
    if (state.context) {
      root.dataset.identityContext = state.context.type;
      root.dataset.identityContextId = String(state.context.id || '');
      root.dataset.identityContextKey = state.context.key || '';
      root.dataset.identityProfile = state.context.profileType || '';
    } else {
      delete root.dataset.identityContext;
      delete root.dataset.identityContextId;
      delete root.dataset.identityContextKey;
      delete root.dataset.identityProfile;
    }

    const detail = snapshot();
    emit('kareta:identity-ready', { ...detail, source });
    emit('kareta:capabilities-changed', detail);
    return detail;
  }

  function reset(source = 'anonymous') {
    Object.assign(state, {
      loaded:true, loading:false, authenticated:false, account:null, session:null,
      contexts:[], accountTypes:[], context:null, capabilities:[], deniedCapabilities:[], error:'', mode:'anonymous', revision:0,
    });
    ['identityContext','identityContextId','identityContextKey','identityProfile'].forEach(key => delete document.documentElement.dataset[key]);
    emit('kareta:identity-anonymous', { source });
    emit('kareta:capabilities-changed', snapshot());
    return snapshot();
  }

  function logout() {
    if (logoutFlight) return logoutFlight;
    logoutFlight = (async () => {
      // The resolver revokes both the Identity cookie and the legacy PHP session.
      // Keep the local session intact if the server could not confirm logout.
      await request('/api/identity_session.php?action=logout', { method:'POST', body:JSON.stringify({ action:'logout' }) });
      if (loadFlight) await loadFlight.catch(() => {});
      reset('logout');
      window.KaretaApiClient?.invalidate?.();
      const next = window.KaretaNext?.state;
      if (next) Object.assign(next, { user:null, session:null, identity:null, identityReady:false, context:null, capabilities:[] });
      document.documentElement.dataset.identityMode = 'anonymous';
      delete document.documentElement.dataset.userRole;
      window.KaretaRoleAccess?.clearLegacyOverride?.();
      window._karetaCookieRole = '';
      window._karetaCookieOnbDone = false;
      if (window.App?.logout) {
        await window.App.logout();
      } else {
        for (const key of ['kareta.auth.user','kareta.profile.current','kareta.auth.phone','kareta_role','kareta_onboarding_completed_at']) {
          try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (_error) {}
        }
        window.KaretaOnboardingState?.reset?.();
        window.KaretaOnboardingLifecycle?.resume?.({ source:'logout' });
      }
      emit('kareta:session-anonymous', { source:'logout', reason:'user_logout' });
      return snapshot();
    })().finally(() => { logoutFlight = null; });
    return logoutFlight;
  }

  function bootstrapSession(payload, source = 'session-bootstrap') {
    if (!payload || payload.authenticated !== true || !payload.account || !payload.currentContext) {
      const error = new Error('identity_bootstrap_invalid');
      error.payload = payload || null;
      throw error;
    }
    return apply(payload, source);
  }

  function load(options = {}) {
    if (loadFlight) return loadFlight;
    if (state.loaded && !options.force) return snapshot();
    const previouslyAuthenticated=state.authenticated;
    state.loading = true;
    state.error = '';
    loadFlight = (async () => { try {
      const current = await requestWithFallback('/api/identity_session.php?action=current', '/api/identity/session?action=current');
      if (!current.authenticated) {
        const legacyUser=options.legacyUser||window.KaretaNext?.state?.user||window.KaretaAppState?.user||null;
        if(options.allowLegacyBridge&&legacyUser){
          try{
            const legacyContexts=await requestWithFallback('/api/context.php?action=list','/api/context/list');
            return apply({...legacyContexts,authenticated:true,session:null},'legacy-context-bridge');
          }catch(legacyError){
            if(![401,403,409].includes(Number(legacyError.status||0)))throw legacyError;
          }
        }
        const result=reset('identity-session');
        if(previouslyAuthenticated)emit('kareta:session-anonymous',{source:'identity-session',reason:'session_expired'});
        return result;
      }
      // R188.5.5.6.84.82: current identity endpoint now returns contexts,
      // accountTypes and deniedCapabilities in the same response. Keep the old
      // second request only as compatibility fallback for an older backend.
      if(Array.isArray(current.contexts)) return apply({ ...current, authenticated:true }, 'identity-session-single-roundtrip');
      const contexts = await requestWithFallback('/api/context.php?action=list', '/api/context/list');
      return apply({ ...current, ...contexts, authenticated:true }, 'identity-session');
    } catch (error) {
      state.loading = false;
      state.loaded = true;
      state.error = error.message || 'identity_load_failed';
      if (error.status === 401 || error.status === 409) {
        const result=reset(error.status===409?'identity-conflict':'identity-expired');
        emit('kareta:session-expired', { reason:error.payload?.error||error.message||'session_expired', status:error.status, error });
        return result;
      }
      emit('kareta:identity-error', { error, state:snapshot() });
      throw error;
    } })().finally(()=>{loadFlight=null;});
    return loadFlight;
  }

  async function select(contextIdOrKey) {
    const body = typeof contextIdOrKey === 'number' || /^\d+$/.test(String(contextIdOrKey || ''))
      ? { contextId:Number(contextIdOrKey) }
      : { contextKey:String(contextIdOrKey || '') };
    try {
      const payload = await requestWithFallback('/api/context.php?action=select', '/api/context/select', { method:'POST', body:JSON.stringify(body) });
      const detail = apply(payload, 'context-select');
      emit('kareta:context-changed', { context:detail.context, capabilities:detail.capabilities, identity:detail });
      return detail;
    } catch (error) {
      if (error.status === 403 && String(error.payload?.error||error.message)==='context_not_available') {
        emit('kareta:context-lost', { reason:'context_not_available', requested:contextIdOrKey, error });
      }
      if (error.status === 401) emit('kareta:session-expired', { reason:error.payload?.error||'session_required', status:error.status, error });
      throw error;
    }
  }

  function wildcardMatch(granted, requested) {
    if (granted === '*') return true;
    if (granted === requested) return true;
    return granted.endsWith('.*') && requested.startsWith(granted.slice(0, -1));
  }

  function has(capability) {
    const requested = String(capability || '').trim();
    if (!requested) return false;
    if (state.deniedCapabilities.some(item => wildcardMatch(item, requested))) return false;
    return state.capabilities.some(item => wildcardMatch(item, requested));
  }

  function hasAny(capabilities) { return (capabilities || []).some(has); }
  function hasAll(capabilities) { return (capabilities || []).every(has); }
  function snapshot() {
    return clone({
      loaded:state.loaded, loading:state.loading, authenticated:state.authenticated,
      account:state.account, session:state.session, contexts:state.contexts, accountTypes:state.accountTypes,
      context:state.context, capabilities:state.capabilities,
      deniedCapabilities:state.deniedCapabilities, error:state.error, mode:state.mode,
      revision:state.revision, compatibilityRole:compatibilityRole(),
    });
  }

  window.KaretaIdentity = Object.freeze({ load, select, reset, logout, bootstrapSession, has, hasAny, hasAll, compatibilityRole, snapshot });
})();
