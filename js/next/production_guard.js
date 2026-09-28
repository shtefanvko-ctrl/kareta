(() => {
  'use strict';
  const state={status:'idle',lastCheck:0,error:'',snapshot:null};

  async function readJson(url){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    const text=await response.text();
    let data=null; try{data=text?JSON.parse(text):null;}catch(_error){}
    if(!data||typeof data!=='object') throw Object.assign(new Error('health_invalid_json'),{status:response.status,preview:text.slice(0,160)});
    if(!response.ok||data.ok===false) throw Object.assign(new Error(data.error||`HTTP ${response.status}`),{status:response.status,payload:data});
    return data;
  }

  function commit(snapshot,status,error=''){
    state.status=status;
    state.error=String(error||'');
    state.lastCheck=Date.now();
    state.snapshot=snapshot;
    document.documentElement.dataset.identityHealth=status;
    if(typeof snapshot?.dbReady==='boolean') document.documentElement.dataset.databaseReady=String(snapshot.dbReady);
    return snapshot;
  }

  async function check(options={}){
    if(!options.force && state.snapshot && Date.now()-state.lastCheck<30000) return state.snapshot;
    state.status='checking'; state.error='';
    try{
      // Ping is intentionally public and returns HTTP 200 even when the DB is not
      // configured. It prevents a predictable cascade of 503 Identity requests.
      const ping=await readJson(`/api/db.php?action=ping&identity_probe=${Date.now()}`);
      if(ping.dbReady!==true){
        const unavailable=commit({
          ok:false,
          status:'degraded',
          reason:String(ping.databaseState||'database_unavailable'),
          recoveryAction:String(ping.recoveryAction||''),
          dbReady:false,
          identityReady:false,
          assetVersion:String(ping.assetVersion||''),
        },'unavailable','database_unavailable');
        window.KaretaRuntimeLog?.add?.('identity.health.unavailable',{reason:unavailable.reason,dbReady:false},'warn');
        window.dispatchEvent(new CustomEvent('kareta:identity-health-error',{detail:{expected:true,snapshot:unavailable,state:{...state}}}));
        return unavailable;
      }

      // Fast boot only needs the public DB/version probe. Identity/session itself
      // is checked in parallel by app_next; the heavier schema health inspection
      // runs after first paint. Other callers keep the full health behavior.
      if(options.fast===true){
        return commit({ok:true,status:'ready-fast',dbReady:true,identityReady:true,assetVersion:String(ping.assetVersion||'')},'ready-fast');
      }

      const health=await readJson('/api/identity_health.php');
      const ready=commit({...health,dbReady:true,identityReady:true},'ready');
      window.dispatchEvent(new CustomEvent('kareta:identity-health',{detail:ready}));
      return ready;
    }catch(error){
      const message=String(error?.message||error);
      const degraded=commit({ok:false,status:'degraded',reason:'health_check_failed',dbReady:null,identityReady:false,error:message},'degraded',message);
      window.KaretaRuntimeLog?.add?.('identity.health.failed',{error:message,status:error?.status||0},'warn');
      window.dispatchEvent(new CustomEvent('kareta:identity-health-error',{detail:{error,snapshot:degraded,state:{...state}}}));
      return degraded;
    }
  }
  window.addEventListener('online',()=>check({force:true}));
  window.KaretaProductionGuard=Object.freeze({check,snapshot:()=>({...state})});
})();
