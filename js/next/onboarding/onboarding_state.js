(() => {
  'use strict';

  const FLOW_KEY = 'kareta_entry_flow_v1';
  const DONE_KEYS = Object.freeze(['kareta.entry.done.v2','kareta_onboarding_done_v1','kareta_onb_done']);
  const ROLES = Object.freeze(['client','master','sto','seller']);
  const listeners = new Set();

  function safeParse(value){
    try { return JSON.parse(value || '{}') || {}; } catch (_error) { return {}; }
  }
  function read(){
    try { return safeParse(localStorage.getItem(FLOW_KEY)); } catch (_error) { return {}; }
  }
  function role(value){
    const normalized = String(value || '').toLowerCase();
    return ROLES.includes(normalized) ? normalized : 'client';
  }
  function emit(next, previous){
    listeners.forEach(listener => { try { listener(next, previous); } catch (_error) {} });
    window.dispatchEvent(new CustomEvent('kareta:onboarding-state', { detail:next }));
  }
  function write(patch = {}){
    const previous = read();
    const next = Object.freeze({ ...previous, ...patch, role:role(patch.role || previous.role), updatedAt:new Date().toISOString() });
    try { localStorage.setItem(FLOW_KEY, JSON.stringify(next)); } catch (_error) {}
    emit(next, previous);
    return next;
  }
  function isDone(){
    const flow = read();
    try {
      const marker = DONE_KEYS.some(key => localStorage.getItem(key) === '1');
      if (!marker) return false;
      if (flow.onboardingCompleted === true && flow.serverConfirmed === true) return true;

      // Compatibility for users completed before FLOW_KEY became authoritative.
      // A lone legacy marker is not enough: require persisted confirmed-user evidence.
      const completedAt = String(localStorage.getItem('kareta_onboarding_completed_at') || '');
      const cached = safeParse(localStorage.getItem('kareta.auth.user'));
      const confirmedUser = !!String(cached?.phone || '').replace(/\D/g,'');
      return !!completedAt && confirmedUser;
    } catch (_error) { return false; }
  }
  function markPending(step){
    return write({ pending:true, stage:String(step || 'role'), onboardingCompleted:false, onboardingDone:false, serverConfirmed:false });
  }
  function markComplete(serverResult = {}){
    const completedAt = new Date().toISOString();
    const next = write({ pending:false, stage:'done', onboardingCompleted:true, onboardingDone:true, doneDone:true, serverConfirmed:true, serverConfirmedAt:completedAt, completedAt, serverResult });
    try {
      DONE_KEYS.forEach(key => localStorage.setItem(key, '1'));
      localStorage.setItem('kareta_onboarding_completed_at', completedAt);
      localStorage.setItem('kareta_role', role(next.role));
    } catch (_error) {}
    return next;
  }
  function reset(){
    const previous = read();
    try { localStorage.removeItem(FLOW_KEY); DONE_KEYS.forEach(key => localStorage.removeItem(key)); } catch (_error) {}
    emit({}, previous);
  }
  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.KaretaOnboardingState = Object.freeze({ read, write, role, isDone, markPending, markComplete, reset, subscribe, FLOW_KEY, DONE_KEYS, ROLES });
})();
