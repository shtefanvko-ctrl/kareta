(() => {
  'use strict';

  const state = window.KaretaOnboardingState;
  const draft = window.KaretaOnboardingProfileDraft;
  const router = window.KaretaOnboardingRouter;
  const app = window.KaretaOnboardingApp;
  const profilePages = window.KaretaOnboardingProfilePages;
  const navigation = window.KaretaOnboardingNavigation;
  if (!state || !draft || !router || !app || !profilePages || !navigation) {
    throw new Error('Compact onboarding lifecycle dependencies are incomplete');
  }

  const OVERLAY_STEPS = Object.freeze(['welcome','role','profile','code']);
  let booted = false;
  let listenersBound = false;
  let dispatching = false;
  let dispatchCount = 0;
  let lastSource = '';
  let lastAction = '';

  function sessionRole(flow = {}){
    // During role selection the branch chosen by the user is authoritative.
    // A previously authenticated MASTER/PERSONAL context must never overwrite
    // CLIENT/MASTER while the general onboarding flow is still pending.
    const pendingRole = state.role(flow?.entryRole || flow?.role || 'client');
    if (flow?.pending === true && ['client','master'].includes(pendingRole)) return pendingRole;
    try {
      const identity = window.KaretaIdentity?.snapshot?.() || null;
      if (identity?.authenticated && identity?.compatibilityRole) return state.role(identity.compatibilityRole);
    } catch (_error) {}
    try {
      const user = window.KaretaNext?.state?.user || window.KaretaAppState?.user || null;
      if (user?.entry_role || user?.role) return state.role(user.entry_role || user.role);
    } catch (_error) {}
    return pendingRole;
  }

  function roleOf(flow){ return sessionRole(flow || {}); }

  function normalizePhone(value){
    const digits = String(value || '').replace(/\D/g, '');
    const normalized = digits.length === 10 ? `7${digits}` : digits;
    return normalized.length === 11 && normalized[0] === '7' ? `+${normalized}` : '';
  }

  function hasActiveCodeContext(flow){
    const phone = normalizePhone(flow?.phone || flow?.contactPhone || '');
    if (!phone) return false;
    try {
      const requestedPhone = String(sessionStorage.getItem('kareta_onboarding_demo_phone') || '');
      const requestedAt = Number(sessionStorage.getItem('kareta_onboarding_demo_requested_at') || 0);
      return requestedPhone === phone && requestedAt > 0 && Date.now() - requestedAt <= 10 * 60 * 1000;
    } catch (_error) { return false; }
  }

  function clearTransientVerification(){
    try {
      sessionStorage.removeItem('kareta_onboarding_demo_phone');
      sessionStorage.removeItem('kareta_onboarding_demo_requested_at');
      sessionStorage.removeItem('kareta_onboarding_demo_verified');
    } catch (_error) {}
  }

  function removeSurfaces(){
    ['onboarding-welcome','onb2-overlay','k-onboarding-page-host'].forEach(id => {
      try { document.getElementById(id)?.remove(); } catch (_error) {}
    });
    try { if (window.OnboardingV2?.state) window.OnboardingV2.state.overlay = null; } catch (_error) {}
  }

  function transitionToApp(flow, options = {}){
    const role = roleOf(flow || draft.read());
    const leavingOnboarding = router.isOnboarding() || options.forceRoute === true;
    const target = options.target || app.targetForRole(role);
    removeSurfaces();
    app.setActive(false);
    try { window.KaretaRoleAccess?.refresh?.(role); } catch (_error) {}

    // Once onboarding is complete it must never own normal application routing.
    // visibilitychange/pageshow/session refreshes may clean onboarding UI, but they
    // must preserve the current hash and mounted business surface. Only an actual
    // onboarding URL is allowed to redirect to the role start page.
    if (!leavingOnboarding) {
      const currentHash = String(location.hash || '');
      const currentKey = window.KaretaRouteRegistry?.keyFromHash?.(currentHash) || '';
      try { window.KaretaShellNav?.refresh?.({ role, activeKey:currentKey || undefined }); } catch (_error) {}
      lastAction = 'app-route-preserved';
      return currentHash || target;
    }

    try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; }
    const targetKey = window.KaretaRouteRegistry?.keyFromHash?.(target) || window.KaretaRoleAccess?.defaultRoute?.(role);
    try { window.KaretaShellNav?.refresh?.({ role, activeKey:targetKey }); } catch (_error) {}
    try { window.KaretaRouteRuntime?.transition?.(targetKey, { source:options.source || 'onboarding-lifecycle' }); } catch (_error) {}
    lastAction = 'leave-to-app';
    return target;
  }

  function openOverlay(parsed, context = {}){
    const currentFlow = draft.read();
    if (parsed.step === 'code' && !hasActiveCodeContext(currentFlow)) {
      clearTransientVerification();
      draft.patch({
        role:parsed.role, entryRole:parsed.role, stage:'role', pending:true, flowSurface:'overlay',
        roleSetupDone:false, phoneVerified:false, serverConfirmed:false, accountExists:false, authMode:''
      }, { source:'lifecycle-invalid-code-route-reset' });
      const target = router.canonical(parsed.role, 'role');
      try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; return true; }
      parsed = { ...parsed, step:'role' };
    }

    removeSurfaces();
    const step = OVERLAY_STEPS.includes(parsed.step) ? parsed.step : 'role';
    draft.patch({ role:parsed.role, entryRole:parsed.role, stage:step, pending:true, flowSurface:'overlay' }, { source:`lifecycle-overlay:${step}` });
    app.setActive(true);
    const result = profilePages.openFromRoute?.(router.canonical(parsed.role, step), { replace:context.replace !== false });
    lastAction = `overlay:${step}`;
    return result !== false;
  }

  function dispatch(raw = location.hash, context = {}){
    if (dispatching) return false;
    dispatching = true;
    dispatchCount += 1;
    lastSource = String(context.source || 'unknown');
    try {
      const flow = draft.read();
      const parsed = raw && typeof raw === 'object' ? raw : router.parse(raw);
      if (state.isDone()) {
        if (parsed || context.forceDoneCheck) transitionToApp(flow, { source:lastSource, forceRoute:!!parsed });
        else app.setActive(false);
        return !!parsed;
      }
      if (!parsed) return false;
      return openOverlay(parsed, context);
    } finally { dispatching = false; }
  }

  function hasMeaningfulDraft(flow){
    return !!(flow && typeof flow === 'object' && (flow.pending === true || Number(flow.draftRevision || 0) > 0 || flow.stage || flow.role));
  }

  function resume(options = {}){
    const flow = draft.read();
    if (state.isDone()) return transitionToApp(flow, { source:options.source || 'resume-done', forceRoute:router.isOnboarding() });
    app.setActive(true);
    const parsed = router.parse();
    if (parsed) return dispatch(parsed, { source:options.source || 'resume-route', replace:true });

    // A fresh unauthenticated entry must always begin with the platform welcome screen.
    // Do not resurrect a stale role/profile/code stage from localStorage.
    clearTransientVerification();
    draft.patch({
      stage:'welcome', pending:true, flowSurface:'overlay', roleSetupDone:false,
      phoneVerified:false, serverConfirmed:false, accountExists:false, authMode:''
    }, { source:'lifecycle-fresh-welcome-start' });
    const step = 'welcome';
    const target = router.canonical(roleOf(flow), step);
    try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; return true; }
    return dispatch(target, { source:options.source || 'resume', replace:true });
  }

  function currentSurfaceIsHealthy(){
    const parsed = router.parse();
    if (!parsed) return state.isDone();
    const overlay = document.getElementById('onb2-overlay');
    return !!overlay && String(overlay.dataset.step || '') === parsed.step;
  }

  function reconcile(source, options = {}){
    if (state.isDone()) {
      if (router.isOnboarding()) return transitionToApp(draft.read(), { source, forceRoute:true });
      removeSurfaces();
      app.setActive(false);
      try { window.KaretaRoleAccess?.refresh?.(sessionRole(draft.read())); } catch (_error) {}
      lastAction = 'stable-app-preserve-route';
      return false;
    }
    if (!options.force && currentSurfaceIsHealthy()) return;
    if (router.isOnboarding()) dispatch(location.hash, { source, replace:true });
    else resume({ source });
  }

  function bindListeners(){
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('hashchange', () => dispatch(location.hash, { source:'hashchange', replace:true }));
    window.addEventListener('popstate', () => dispatch(location.hash, { source:'popstate', replace:false }));
    window.addEventListener('pageshow', event => { if (event.persisted) reconcile('pageshow-bfcache', { force:true }); });
    window.addEventListener('storage', event => {
      if (event.key === state.FLOW_KEY || state.DONE_KEYS.includes(event.key)) reconcile('storage-sync');
    });
    window.addEventListener('kareta:session-anonymous', event => {
      const flow=state.read();
      const hadCompletedState=state.isDone() || flow?.serverConfirmed === true || flow?.onboardingCompleted === true;
      if (!hadCompletedState) return;
      // Server/session authority wins over stale localStorage completion markers. Without this,
      // an expired/logout session can keep isDone() true and suppress the login surface forever.
      state.reset();
      clearTransientVerification();
      try { localStorage.removeItem('kareta.auth.user'); } catch (_error) {}
      try { sessionStorage.removeItem('kareta.auth.user'); } catch (_error) {}
      lastAction='session-anonymous-stale-done-reset';
      const target=router.canonical('client','welcome');
      try { history.replaceState(null,'',target); } catch (_error) { location.hash=target; return; }
      app.setActive(true);
      dispatch(target,{source:'session-anonymous-relogin',replace:true,detail:event?.detail||{}});
    });
    window.addEventListener('kareta:session-confirmed', event => {
      const detail=event.detail || {};
      const identity=detail.identity || window.KaretaIdentity?.snapshot?.() || {};
      const user=detail.user || window.KaretaNext?.state?.user || null;
      if (!identity?.authenticated && !user?.phone) return;
      const flow=draft.read();
      const explicitRole=state.role(detail?.result?.selectedRole || detail?.result?.entryRole || user?.entry_role || flow?.entryRole || flow?.role || identity?.compatibilityRole || user?.role || 'client');
      // finalize()/role_page.js own the successful transition while the role picker is active.
      // Completing + routing again from this listener caused CLIENT to inherit a stale MASTER
      // context and open the master questionnaire. Preserve the selected branch and defer.
      const pendingStage=String(flow?.stage || router.parse()?.step || '');
      const recoverableWelcome=pendingStage==='welcome' && !normalizePhone(flow?.phone || flow?.contactPhone || '');
      if ((router.isOnboarding() || flow?.pending === true) && !recoverableWelcome) {
        state.write({ role:explicitRole, entryRole:explicitRole });
        lastAction='session-confirmed-deferred-to-onboarding-owner';
        return;
      }
      const confirmedRole = state.role(identity?.compatibilityRole || user?.entry_role || user?.role || explicitRole);
      if (state.isDone()) {
        state.write({ role:confirmedRole, entryRole:confirmedRole, pending:false, stage:'done' });
        reconcile('session-confirmed', { force:true });
        return;
      }
      state.write({ role:confirmedRole, entryRole:confirmedRole });
      state.markComplete({
        role:confirmedRole,
        user:user || null,
        identityAccount:identity?.account || null,
        recoveredFromSession:true
      });
      reconcile('session-confirmed', { force:true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reconcile('visibility-resume');
    });
  }

  function installCompatibilityRoute(){
    const api = window.OnboardingV2;
    if (!api || api.__lifecycleRouteOwner) return;
    const coreOpen = profilePages.openFromRoute;
    api.openFromRoute = function(raw, options){
      const parsed = router.parse(raw || location.hash);
      if (!parsed) return coreOpen?.(raw, options || {});
      return dispatch(router.canonical(parsed.role, parsed.step), { source:'legacy-openFromRoute', replace:options?.replace !== false });
    };
    api.__lifecycleRouteOwner = true;
    window._onb2OpenRoute = api.openFromRoute;
  }

  function start(options = {}){
    if (!options.force && state.isDone() && !router.isOnboarding()) return false;
    if (options.force && options.skipWelcome === true && !router.isOnboarding()) {
      const target = router.canonical(draft.currentRole(), 'role');
      try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; return true; }
      return dispatch(target, { source:options.source || 'forced-role-start', replace:true });
    }
    return resume({ source:options.source || 'start' });
  }

  function boot(options = {}){
    if (!booted) { booted = true; bindListeners(); installCompatibilityRoute(); }
    return start({ ...options, source:options.source || 'boot' });
  }

  function audit(){
    const flow = draft.read();
    return {
      ok:booted && listenersBound,
      booted, listenersBound, dispatching, dispatchCount, lastSource, lastAction,
      route:router.parse(), surface:String(flow.flowSurface || ''), stage:String(flow.stage || ''), done:state.isDone(),
      navigation:navigation.audit(), activeSteps:[...OVERLAY_STEPS]
    };
  }

  window.KaretaOnboardingLifecycle = Object.freeze({ boot, start, resume, dispatch, reconcile, transitionToApp, audit });
})();
