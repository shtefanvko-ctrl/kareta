(() => {
  'use strict';
  const state = window.KaretaOnboardingState;
  if (!state) throw new Error('KaretaOnboardingState is required');

  const STEPS = Object.freeze(['welcome','role','profile','code']);
  const LEGACY_PREFIXES = Object.freeze(['role','onboarding','entry']);
  const LEGACY_PROFILE_STEPS = new Set(['quick','desc','spec','city','city-search','address','contact','verify','account','vehicle','permissions','review','done']);

  function normalizeStep(value, prefix){
    const step = String(value || 'role').toLowerCase();
    if (STEPS.includes(step)) return step;
    if (step === 'welcome') return 'welcome';
    if (['benefits','transparency'].includes(step)) return 'role';
    if (LEGACY_PROFILE_STEPS.has(step)) return 'profile';
    return 'role';
  }

  function parse(hashValue = location.hash){
    const raw = String(hashValue || '').replace(/^#/,'').replace(/^\//,'').trim();
    if (!raw) return null;
    const parts = raw.split(':').filter(Boolean);
    const prefix = parts.shift()?.toLowerCase();
    if (!LEGACY_PREFIXES.includes(prefix)) return null;
    let role = state.role(parts[0]);
    if (state.ROLES.includes(String(parts[0] || '').toLowerCase())) parts.shift();
    const step = normalizeStep(parts.shift(), prefix);
    return { role, step, raw };
  }

  function isOnboarding(hashValue = location.hash){ return !!parse(hashValue); }
  function canonical(role, step){ return '#role:' + state.role(role) + ':' + normalizeStep(step, 'role'); }
  function navigate(role, step, options = {}) {
    const navigation = window.KaretaOnboardingNavigation;
    if (navigation?.to) return navigation.to(step, { ...options, role, source:options.source || 'router-compat' });
    const target = canonical(role, step);
    history[options.replace ? 'replaceState' : 'pushState'](null, '', target);
    try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (_error) {}
    return target;
  }
  function resumeRoute(){
    const flow = state.read();
    const step = STEPS.includes(flow.stage) ? flow.stage : (flow.roleSetupDone ? 'profile' : 'welcome');
    return canonical(flow.role, step);
  }
  window.KaretaOnboardingRouter = Object.freeze({ STEPS, parse, isOnboarding, canonical, navigate, resumeRoute });
})();
