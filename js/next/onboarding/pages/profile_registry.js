/* r69x: explicit owner registry for role/profile onboarding screens. */
(() => {
  'use strict';
  const api = window.OnboardingV2;
  const roles = Object.freeze({
    client: window.KaretaClientProfilePage,
    master: window.KaretaMasterProfilePage,
    sto: window.KaretaServiceProfilePage,
    seller: window.KaretaSellerProfilePage
  });
  if (!api) throw new Error('OnboardingV2 profile flow failed to initialize');
  Object.entries(roles).forEach(([key, module]) => {
    if (!module || module.role !== key || typeof module.open !== 'function') {
      throw new Error(`Onboarding profile owner is unavailable: ${key}`);
    }
  });
  function openRole(role, step = 'profile') {
    const owner = roles[String(role || '').toLowerCase()];
    if (!owner) throw new Error(`Unsupported onboarding role: ${role}`);
    return owner.open(step);
  }
  window.KaretaOnboardingProfilePages = Object.freeze({
    roles,
    show: typeof api.show === 'function' ? api.show.bind(api) : null,
    render: typeof api.render === 'function' ? api.render.bind(api) : null,
    openFromRoute: typeof api.openFromRoute === 'function' ? api.openFromRoute.bind(api) : null,
    openRole,
    audit(){
      const roleAudit = Object.fromEntries(Object.entries(roles).map(([key, owner]) => [key, owner.audit()]));
      return {
        ok: typeof api.show === 'function' && Object.values(roleAudit).every(item => item.ok),
        overlayMounted: !!document.getElementById('onb2-overlay'),
        activeStep: document.querySelector('#onb2-overlay .onb2-step.active')?.id || null,
        roles: roleAudit
      };
    }
  });
})();
