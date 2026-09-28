(() => {
  'use strict';
  if (window.__KARETA_RUNTIME_DEPENDENCIES_MODULE__) {
    window.__KARETA_RUNTIME_DEPENDENCIES_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_RUNTIME_DEPENDENCIES_MODULE__ = { duplicateLoads:0 };

  const RELEASE=String(window.KARETA_NEXT_ASSET_VERSION||'dev');
  const WAIT_MS=10000;
  const POLL_MS=40;
  const pending=new Map();
  const state={deferred:0,reloaded:0,recoveries:0,lastMissing:[],lastSource:'',mixedVersions:[]};

  const log=(type,data={},level='info')=>window.KaretaRuntimeLog?.add?.(`runtime.dependencies.${type}`,data,level);
  const exists=name=>{
    const parts=String(name||'').split('.').filter(Boolean);let cursor=window;
    for(const part of parts){cursor=cursor?.[part];if(cursor==null)return false;}
    return true;
  };
  const missing=dependencies=>(dependencies||[]).filter(name=>!exists(name));
  const emit=(name,detail={})=>{try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch(_error){}};
  const retryUrl=source=>{
    try{const url=new URL(source,location.href);url.searchParams.set('kareta_retry','1');url.searchParams.set('kareta_release',RELEASE);return url.href;}
    catch(_error){return source;}
  };

  async function clearRuntimeCaches(){
    try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>String(key).startsWith('kareta-')).map(key=>caches.delete(key)));}}catch(_error){}
    try{const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];await Promise.all(registrations.map(registration=>registration.unregister().catch(()=>false)));}catch(_error){}
  }

  async function requestRecovery(source,dependencies,reason='dependency_timeout'){
    const absent=missing(dependencies);state.recoveries+=1;state.lastMissing=absent;state.lastSource=source;
    log('failure',{source,reason,missing:absent,release:RELEASE,automaticReload:false},'error');
    emit('kareta:runtime-dependency-error',{source,reason,missing:absent,release:RELEASE});
    document.documentElement.dataset.runtimeDependencies='failed';
    const message=`Не загружены модули: ${absent.join(', ')||source}`;
    if(window.KaretaBootRecovery?.fail){await window.KaretaBootRecovery.fail(`dependency:${reason}:${absent.join(',')||source}`);}
    else window.KaretaAppPreloader?.fail?.(new Error(message));
    return false;
  }

  function inject(record){
    if(record.injected)return;record.injected=true;
    const script=document.createElement('script');script.src=retryUrl(record.source);script.async=false;script.defer=false;script.dataset.karetaDependencyRetry=record.name;
    script.addEventListener('load',()=>{
      const absent=missing(record.dependencies);
      if(absent.length){requestRecovery(record.name,record.dependencies,'retry_incomplete');return;}
      pending.delete(record.name);state.reloaded+=1;document.documentElement.dataset.runtimeDependencies='ready';
      log('reloaded',{name:record.name,source:record.source});emit('kareta:runtime-module-reloaded',{name:record.name,release:RELEASE});
    },{once:true});
    script.addEventListener('error',()=>requestRecovery(record.name,record.dependencies,'retry_load_failed'),{once:true});
    document.head.appendChild(script);
  }

  function deferScript(name,dependencies,source){
    const key=String(name||'runtime-module');
    if(pending.has(key))return true;
    const record={name:key,dependencies:[...new Set((dependencies||[]).map(String))],source:String(source||''),startedAt:Date.now(),timer:0,injected:false};
    pending.set(key,record);state.deferred+=1;state.lastMissing=missing(record.dependencies);state.lastSource=key;
    document.documentElement.dataset.runtimeDependencies='waiting';
    log('deferred',{name:key,missing:state.lastMissing,source:record.source},'warn');
    const poll=()=>{
      const absent=missing(record.dependencies);state.lastMissing=absent;
      if(!absent.length){inject(record);return;}
      if(Date.now()-record.startedAt>=WAIT_MS){pending.delete(key);requestRecovery(key,record.dependencies);return;}
      record.timer=window.setTimeout(poll,POLL_MS);
    };
    record.timer=window.setTimeout(poll,0);
    return true;
  }

  function auditDocument(){
    const versions=[],declared=[],orders=[];
    document.querySelectorAll('script[src*="/js/next/"]').forEach(script=>{
      try{const version=new URL(script.src,location.href).searchParams.get('v');if(version)versions.push(version);}catch(_error){}
      if(script.dataset?.karetaRelease)declared.push(String(script.dataset.karetaRelease));
      if(script.dataset?.karetaScriptOrder!=null)orders.push(Number(script.dataset.karetaScriptOrder));
    });
    const unique=[...new Set([...versions,...declared])];state.mixedVersions=unique;
    const invalidOrder=orders.some((value,index)=>!Number.isInteger(value)||(index>0&&value<=orders[index-1]));
    const mixed=unique.length!==1||unique[0]!==RELEASE;
    if(mixed||invalidOrder){
      const reason=mixed?`mixed_versions:${unique.join(',')}`:'invalid_script_order';
      log('asset_audit',{release:RELEASE,versions:unique,orders,reason},'error');requestRecovery('asset-version-audit',[],reason);return false;
    }
    return true;
  }

  window.addEventListener('load',()=>window.setTimeout(auditDocument,0),{once:true});
  window.KaretaRuntimeDependencies=Object.freeze({exists,missing,deferScript,requestRecovery,auditDocument,snapshot:()=>({...state,pending:[...pending.keys()],release:RELEASE})});
})();
