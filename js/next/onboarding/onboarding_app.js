(() => {
  'use strict';
  const state = window.KaretaOnboardingState;
  const draft = window.KaretaOnboardingProfileDraft;
  const router = window.KaretaOnboardingRouter;
  const api = window.KaretaOnboardingApi;
  if (!state || !draft || !router || !api) throw new Error('Onboarding modules are incomplete');
  let finalizing = null;

  function setActive(active){
    document.documentElement.classList.toggle('k-onboarding-active', !!active);
    document.body?.classList.toggle('k-onboarding-active', !!active);
    document.documentElement.classList.toggle('entry-flow-active', !!active);
    document.body?.classList.toggle('entry-flow-active', !!active);
  }
  function targetForRole(role){ return role === 'seller' ? '#/seller' : role === 'master' ? '#/onboarding/master?step=1&view=master-profile' : role === 'sto' ? '#/sto' : '#/home'; }
  function identityContextRole(payload){
    const context=payload?.currentContext || payload?.context || null;
    if(!context)return '';
    const type=String(context.type||context.contextType||'').toLowerCase();
    const profile=String(context.profileType||context.profile_type||'').toLowerCase();
    const organization=String(context.organizationType||context.organization_type||'').toLowerCase();
    if(type==='personal')return 'client';
    if(type==='profile'&&profile==='master')return 'master';
    if(type==='profile'&&profile==='seller')return 'seller';
    if(type==='organization')return organization==='parts_store'?'seller':'sto';
    return '';
  }
  function assertEntryContext(role,payload){
    const selected=state.role(role||'client');
    if(!['client','master'].includes(selected)||!payload)return;
    const actual=identityContextRole(payload);
    if(actual&&actual!==selected){
      const error=new Error(selected==='client'?'Не удалось открыть контекст клиента. Повторите вход.':'Не удалось открыть контекст мастера. Повторите вход.');
      error.code=selected==='client'?'client_context_not_selected':'master_context_not_selected';
      error.selectedRole=selected;error.contextRole=actual;
      throw error;
    }
  }
  function targetAfterAuth(result,flow,user){
    const resolved=window.KaretaPostAuthFirstEntryResolver?.resolve?.(result,flow,user);
    if(resolved?.ok===false){const error=new Error(resolved.error||'entry_context_mismatch');error.code=resolved.error||'entry_context_mismatch';throw error;}
    if(resolved?.target)return resolved.target;
    return targetForRole(resolved?.role||user?.entry_role||user?.role||flow?.entryRole||flow?.role||'client');
  }

  async function authoritativeTargetAfterAuth(result,flow,user){
    const role=String(user?.entry_role||user?.role||flow?.entryRole||flow?.role||'').toLowerCase();
    if(role==='client'){
      let target='#/home';
      try{
        let snap=window.KaretaIdentity?.snapshot?.()||null;
        if(!snap?.loaded&&window.KaretaIdentity?.load)snap=await window.KaretaIdentity.load({allowLegacyBridge:true,legacyUser:user});
        const activeRole=identityContextRole({currentContext:snap?.context});
        if(activeRole!=='client'){
          const personal=(snap?.contexts||[]).find(ctx=>String(ctx?.type||ctx?.contextType||'').toLowerCase()==='personal');
          if(personal&&window.KaretaIdentity?.select){
            snap=await window.KaretaIdentity.select(personal.id||personal.key);
          }
        }
        target='#/home';
      }catch(_clientContextError){
        console.warn('[KARETA onboarding] client context self-heal failed',_clientContextError);
      }
      return target;
    }
    const target=targetAfterAuth(result,flow,user);
    if(role!=='master')return target;
    const gate=window.KaretaMasterOnboardingGate;
    if(!gate?.ensureCompleted)return '#/onboarding/master';
    const allowed=await gate.ensureCompleted({redirect:false,source:'post-auth'});
    return allowed?target:'#/onboarding/master';
  }

  function confirmedUser(result, flow){
    const source = result && typeof result.user === 'object' ? result.user : {};
    const legacyRole=state.role(source.role||'client');
    const role = state.role(window.KaretaPostAuthFirstEntryResolver?.role?.(result,flow,source) || result?.selectedRole || result?.entryRole || flow.entryRole || flow.role || source.entry_role || legacyRole);
    return {
      ...source,
      name:String(source.name || flow.accountName || flow.name || (role === 'seller' ? 'Магазин запчастей' : role === 'sto' ? 'Автосервис' : role === 'master' ? 'Мастер' : 'Клиент')),
      phone:String(source.phone || flow.phone || flow.contactPhone || ''),
      role,
      legacy_role:legacyRole,
      entry_role:role,
      city:String(source.city || flow.city || flow.cityName || ''),
      onboarded:true,
      onboarding_stage:'done'
    };
  }

  function synchronizeSession(result, flow){
    const user = confirmedUser(result, flow);
    const identityPayload = result?.identity?.authenticated ? result.identity : null;
    let identity = null;
    const profileCache = {
      name:user.name,
      phone:user.phone,
      role:user.role,
      entry_role:user.entry_role,
      city:user.city,
      onboarded:true,
      onboarding_stage:'done',
      server_confirmed_at:new Date().toISOString()
    };
    try { localStorage.setItem('kareta.last.role.v1', user.role); } catch (_error) {}
    try { localStorage.setItem('kareta.profile.current', JSON.stringify(profileCache)); } catch (_error) {}
    try { sessionStorage.setItem('kareta.profile.current', JSON.stringify(profileCache)); } catch (_error) {}
    try { localStorage.setItem('kareta.auth.user', JSON.stringify(user)); } catch (_error) {}
    try { sessionStorage.setItem('kareta.auth.user', JSON.stringify(user)); } catch (_error) {}
    try {
      if (window.KaretaNext?.state) {
        window.KaretaNext.state.user = user;
        window.KaretaNext.state.session = { ok:true, user, confirmed:true };
      }
    } catch (_error) {}
    try { window._karetaCookieRole = user.role; window._karetaCookieOnbDone = true; } catch (_error) {}
    try {
      if (identityPayload) {
        assertEntryContext(user.role,identityPayload);
        identity = window.KaretaIdentity?.bootstrapSession?.(identityPayload, 'onboarding-session') || identityPayload;
        document.documentElement.dataset.identityMode = 'identity';
        document.documentElement.dataset.userRole = identity.compatibilityRole || user.role;
        if (window.KaretaNext?.state) {
          window.KaretaNext.state.identity = identity;
          window.KaretaNext.state.identityReady = true;
          window.KaretaNext.state.context = identity.context;
          window.KaretaNext.state.capabilities = identity.capabilities || [];
        }
      }
    } catch (error) {
      window.KaretaRuntimeLog?.add('onboarding.identity.bootstrap_failed', {message:error?.message||'identity_bootstrap_failed'}, 'error');
      throw error;
    }
    try { window.dispatchEvent(new CustomEvent('kareta:session-confirmed', { detail:{ user, result, identity, legacy:!identity } })); } catch (_error) {}
    return user;
  }

  async function refreshNextState(){
    const client = window.KaretaApiClient;
    if (!client || !window.KaretaNext?.state) return null;
    const [stateResult, sessionResult] = await Promise.allSettled([
      client.getState?.(),
      client.getSession?.()
    ]);
    if (stateResult.status === 'fulfilled' && stateResult.value) window.KaretaNext.state.apiSnapshot = stateResult.value;
    if (sessionResult.status === 'fulfilled' && sessionResult.value) {
      const sessionPayload = sessionResult.value?.payload || sessionResult.value;
      // Never overwrite an already confirmed local session with a stale or anonymous snapshot.
      if (sessionPayload?.user) {
        const liveIdentity=window.KaretaIdentity?.snapshot?.()||null;
        const interfaceRole=state.role(liveIdentity?.authenticated ? (liveIdentity.compatibilityRole||'client') : (sessionPayload.user.entry_role||sessionPayload.user.role||'client'));
        const sessionUser={...sessionPayload.user,legacy_role:sessionPayload.user.legacy_role||sessionPayload.user.role||'client',role:interfaceRole,entry_role:interfaceRole};
        window.KaretaNext.state.session = {...sessionPayload,user:sessionUser};
        window.KaretaNext.state.user = sessionUser;
      }
    }
    return { state:stateResult, session:sessionResult };
  }

  async function finalize(options = {}){
    if (finalizing) return finalizing;
    const button = options.button || null;
    const previousText = button?.textContent || '';
    if (button) { button.disabled = true; button.setAttribute('aria-busy','true'); button.textContent = 'Сохраняем…'; }
    finalizing = (async () => {
      const flow = draft.read();
      // Profile finalization is an onboarding operation, not a second app boot.
      // Keep progress local to the submit button and never restart the global preloader.
      const result = await api.confirm(flow, options);
      const user = synchronizeSession(result, flow);
      try { if (!window.KaretaRoleAccess?.identityActive?.()) window.KaretaRoleAccess?.refresh?.(user.role); } catch (_error) {}
      const completed = state.markComplete({ ...result, user });
      // The server session is already established by onboarding.complete. Refreshing data is
      // useful but must not block or reset the successful transition into the application.
      try { await refreshNextState(); } catch (_error) {}
      setActive(false);
      try { document.getElementById('onb2-overlay')?.remove(); } catch (_error) {}
      try { document.getElementById('onboarding-welcome')?.remove(); } catch (_error) {}
      const target = await authoritativeTargetAfterAuth(result,flow,user);
      history.replaceState(null, '', target);
      try {
        const routeKey = window.KaretaRouteRegistry?.keyFromHash?.(target) || window.KaretaRoleAccess?.defaultRoute?.(completed.role) || 'home';
        window.KaretaRouteRuntime?.transition?.(routeKey, { source:'onboarding-complete' });
      } catch (_error) {}
      return completed;
    })();
    try { return await finalizing; }
    catch (error) {
      if (window.KaretaAppPreloader?.isVisible?.()) window.KaretaAppPreloader.fail(error);
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = previousText;
      }
      const host = document.querySelector('.onb-done-actions') || button?.parentElement;
      let message = host?.querySelector('[data-onboarding-save-error]');
      if (host && !message) { message = document.createElement('div'); message.dataset.onboardingSaveError = '1'; message.className = 'onb-profile-error'; host.prepend(message); }
      if (message) { message.hidden = false; message.textContent = error?.message || 'Не удалось сохранить профиль. Повторите попытку.'; }
      throw error;
    } finally { finalizing = null; }
  }
  function audit(){ return { ok:!!(state && router && api), done:state.isDone(), route:router.parse(), finalizing:!!finalizing, flow:draft.read(), draft:draft.audit() }; }
  window.KaretaOnboardingApp = Object.freeze({ finalize, setActive, targetForRole, targetAfterAuth, authoritativeTargetAfterAuth, synchronizeSession, refreshNextState, audit });
})();
