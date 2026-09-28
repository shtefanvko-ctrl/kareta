(() => {
  'use strict';
  if (window.KaretaPostAuthFirstEntryResolver) return;

  const normalizeRole = value => {
    const role=String(value||'').trim().toLowerCase();
    return ['client','master','sto','seller'].includes(role)?role:'client';
  };

  function role(result={}, flow={}, user={}){
    return normalizeRole(
      result?.selectedRole || result?.entryRole || result?.identity?.selectedRole || result?.identity?.entryRole ||
      flow?.entryRole || flow?.role || user?.entry_role || user?.role || 'client'
    );
  }

  function postAuth(result={}){
    const value=result?.postAuth || result?.identity?.postAuth;
    return value && typeof value==='object' ? value : null;
  }

  function contextRole(result={}){
    const context=result?.identity?.currentContext || result?.identity?.context || null;
    if(!context)return '';
    const type=String(context.type||context.contextType||'').toLowerCase();
    const profile=String(context.profileType||context.profile_type||'').toLowerCase();
    const organization=String(context.organizationType||context.organization_type||'').toLowerCase();
    if(type==='profile'&&profile==='master')return'master';
    if(type==='profile'&&profile==='seller')return'seller';
    if(type==='organization')return organization==='parts_store'?'seller':'sto';
    if(type==='personal')return'client';
    return'';
  }

  function defaultTarget(role){
    return role==='master'?'#/onboarding/master?step=1&view=master-profile':role==='sto'?'#/sto':role==='seller'?'#/seller':'#/home';
  }

  function resolve(result={}, flow={}, user={}){
    const selectedRole=role(result,flow,user);
    const server=postAuth(result);
    const activeContextRole=contextRole(result);
    let target=String(server?.redirectRoute||'').trim() || defaultTarget(selectedRole);
    let firstEntryRequired=server?.firstEntryRequired;

    if(selectedRole==='master'){
      // MASTER must never silently fall back to PERSONAL after role selection.
      // The backend activates/selects the MASTER context before returning success.
      if(activeContextRole && activeContextRole!=='master'){
        return {ok:false,role:selectedRole,contextRole:activeContextRole,target:'#/onboarding/master?step=1&view=master-profile',firstEntryRequired:true,error:'master_context_not_selected'};
      }
      const status=String(server?.onboardingStatus||'not_started');
      if(status!=='completed'){
        const step=Math.max(1,Math.min(4,Number(server?.step||1)||1));
        const view=String(server?.view||({1:'master-profile',2:'master-services',3:'master-work-place',4:'master-review'}[step]));
        target=`#/onboarding/master?step=${step}&view=${encodeURIComponent(view)}`;
        firstEntryRequired=true;
      }else{
        target=target.startsWith('#/onboarding/master')?'#/master':target;
        firstEntryRequired=false;
      }
    }
    if(selectedRole==='client'){
      // CLIENT must own the PERSONAL context. Never render master first-entry UI
      // just because an older MASTER context was active before role selection.
      if(activeContextRole && activeContextRole!=='client'){
        return {ok:false,role:selectedRole,contextRole:activeContextRole,target:'#/home',firstEntryRequired:true,error:'client_context_not_selected'};
      }
      // Vehicle first-entry is resolved by KaretaFirstVehicleFlow after the
      // session-confirmed event, because it must inspect the real Garage state.
      target='#/home';
    }
    return {ok:true,role:selectedRole,contextRole:activeContextRole,target,firstEntryRequired:firstEntryRequired??null,postAuth:server};
  }

  window.KaretaPostAuthFirstEntryResolver=Object.freeze({normalizeRole,role,contextRole,resolve,defaultTarget});
})();
