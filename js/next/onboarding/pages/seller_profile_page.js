(() => {
  'use strict';
  const role = 'seller';
  const definitions = window.KaretaOnboardingRoleDefinitions;
  if (!definitions) throw new Error('KaretaOnboardingRoleDefinitions is unavailable');
  const definition = definitions.getRole(role);
  const specializations = definitions.getSpecializations(role);

  function open(step = 'profile') {
    const api = window.OnboardingV2;
    if (!api || typeof api.openFromRoute !== 'function') throw new Error('OnboardingV2 is unavailable');
    return api.openFromRoute(`#role:${role}:${step}`);
  }

  window.KaretaSellerProfilePage = Object.freeze({
    role,
    title: 'Продавец запчастей',
    defaultStep: 'profile',
    definition,
    specializations,
    open,
    audit() {
      return { ok: !!window.OnboardingV2 && !!definition, role, specializationCount: specializations.length };
    }
  });
})();
