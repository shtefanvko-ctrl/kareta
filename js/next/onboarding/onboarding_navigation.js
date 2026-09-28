(() => {
  'use strict';

  const router = window.KaretaOnboardingRouter;
  const draft = window.KaretaOnboardingProfileDraft;
  if (!router || !draft) throw new Error('Onboarding router/draft are required before navigation');

  let navigationCount = 0;
  let lastNavigation = null;

  function currentRole(){ return draft.currentRole(); }
  function surfaceFor(){ return 'overlay'; }

  function commit(step, options = {}){
    const safeStep = router.STEPS.includes(String(step || '').toLowerCase()) ? String(step).toLowerCase() : 'role';
    const role = window.KaretaOnboardingState?.role(options.role || currentRole()) || 'client';
    const surface = surfaceFor(safeStep);
    const target = router.canonical(role, safeStep);

    draft.patch({ role, entryRole:role, stage:safeStep, flowSurface:surface, pending:true }, {
      source:options.source || `navigation:${safeStep}`
    });

    try {
      if (options.replace) history.replaceState(null, '', target);
      else history.pushState(null, '', target);
    } catch (_error) {
      location.hash = target;
      return target;
    }

    navigationCount += 1;
    lastNavigation = Object.freeze({ target, role, step:safeStep, surface, replace:!!options.replace, source:String(options.source || '') });

    const lifecycle = window.KaretaOnboardingLifecycle;
    if (lifecycle?.dispatch) {
      Promise.resolve().then(() => lifecycle.dispatch(target, { source:options.source || `navigation:${safeStep}`, replace:!!options.replace }));
    } else {
      try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (_error) {}
    }
    return target;
  }

  function to(step, options = {}){ return commit(step, options); }
  function replace(step, options = {}){ return commit(step, { ...options, replace:true }); }
  function current(){ return router.parse(location.hash); }
  function audit(){ return { ok:true, navigationCount, lastNavigation, current:current() }; }

  window.KaretaOnboardingNavigation = Object.freeze({ to, replace, current, currentRole, surfaceFor, audit });
})();
