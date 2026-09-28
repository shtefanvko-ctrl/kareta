(() => {
  'use strict';
  const state = window.KaretaOnboardingState;
  const router = window.KaretaOnboardingRouter;
  const app = window.KaretaOnboardingApp;
  const lifecycle = window.KaretaOnboardingLifecycle;
  const profilePages = window.KaretaOnboardingProfilePages;
  if (!state || !router || !app || !lifecycle || !profilePages) {
    throw new Error('Modular onboarding lifecycle is required before onboarding_bridge.js');
  }

  function finish(){
    if (!state.isDone()) return false;
    lifecycle.transitionToApp(state.read(), { source:'onboarding-bridge-finish', forceRoute:router.isOnboarding() });
    return true;
  }

  function start(options = {}){
    return lifecycle.start({
      force:options.force === true,
      skipWelcome:options.skipWelcome === true,
      source:options.source || 'onboarding-bridge-start'
    });
  }

  function boot(){ return lifecycle.boot({ source:'onboarding-bridge-boot' }); }

  function audit(){
    return {
      ...app.audit(),
      lifecycle:lifecycle.audit(),
      profile:profilePages.audit()
    };
  }

  window.KaretaOnboardingBridge = Object.freeze({
    boot,
    start,
    finish,
    isDone:state.isDone,
    isOnboardingHash:router.isOnboarding,
    audit
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
