(() => {
  'use strict';
  const safe = fn => { try { return fn(); } catch (_) { return null; } };
  function snapshot(reason='manual'){
    const identity=safe(()=>window.KaretaIdentity?.snapshot?.()) || {};
    const context=safe(()=>window.KaretaContextManager?.current?.()) || identity.context || null;
    const nav=safe(()=>window.KaretaNavigationCore?.snapshot?.()) || null;
    const recovery=safe(()=>window.KaretaRecovery?.snapshot?.()) || null;
    return {
      generatedAt:new Date().toISOString(), reason,
      version:String(window.KARETA_NEXT_ASSET_VERSION || ''),
      route:String(location.hash || location.pathname || ''),
      online:navigator.onLine, visibility:document.visibilityState,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      identity:{mode:identity.mode||'',authenticated:!!identity.authenticated,accountId:identity.account?.id||identity.accountId||null,personId:identity.person?.id||identity.personId||null},
      context:context ? {id:context.id||null,key:context.contextKey||context.key||'',type:context.contextType||context.type||''} : null,
      capabilities:Array.isArray(identity.capabilities)?identity.capabilities.slice(0,250):[],
      deniedCapabilities:Array.isArray(identity.deniedCapabilities)?identity.deniedCapabilities.slice(0,250):[],
      navigation:nav,
      recovery,
      runtimeEvents:safe(()=>window.KaretaRuntimeLog?.snapshot?.().slice(-30)) || [],
      userAgent:navigator.userAgent
    };
  }
  function download(reason='manual'){
    const data=JSON.stringify(snapshot(reason),null,2);
    const blob=new Blob([data],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`kareta-diagnostic-${Date.now()}.json`; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  window.KaretaDiagnosticSnapshot=Object.freeze({snapshot,download,copy:async(reason='manual')=>navigator.clipboard.writeText(JSON.stringify(snapshot(reason),null,2))});
})();
