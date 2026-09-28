(()=>{'use strict';
const esc=v=>window.KaretaUIKit?.esc?.(v)??String(v??'');
let activeController=null;
const req=async(method='GET',payload=null)=>{
  if(activeController) activeController.abort();
  activeController=new AbortController();
  const response=await fetch('/api/identity_migration_admin.php?action=overview',{
    method,credentials:'same-origin',cache:'no-store',signal:activeController.signal,
    headers:{'Accept':'application/json',...(payload?{'Content-Type':'application/json'}:{})},
    body:payload?JSON.stringify(payload):null
  });
  const contentType=String(response.headers.get('content-type')||'').toLowerCase();
  const text=await response.text();
  if(!contentType.includes('application/json')){
    const error=new Error(response.ok?'migration_invalid_content_type':'migration_http_'+response.status);
    error.status=response.status; throw error;
  }
  let json; try{json=JSON.parse(text)}catch{throw new Error('migration_invalid_json')}
  if(!response.ok||json.ok===false){const error=new Error(json.error||('migration_http_'+response.status));error.status=response.status;throw error}
  return json;
};
function render(){return `<section class="k-page k-migration" aria-labelledby="k-migration-title"><header class="k-migration__hero"><div><span>STAGE 14B</span><h1 id="k-migration-title">Identity Migration Control Center</h1><p>Контролируемые dry-run/apply батчи, конфликты и история запусков. Массовая миграция не запускается автоматически.</p></div><button class="k-btn k-btn--secondary" type="button" data-mig-refresh>Обновить</button></header><div data-mig-status aria-live="polite"></div><section class="k-migration__actions" aria-label="Управление батчем"><label>После user ID <input type="number" inputmode="numeric" min="0" value="0" data-mig-after></label><label>Лимит <input type="number" inputmode="numeric" min="1" max="500" value="100" data-mig-limit></label><button class="k-btn k-btn--secondary" type="button" data-mig-dry>Dry run</button><button class="k-btn k-btn--primary" type="button" data-mig-apply>Apply batch</button></section><div class="k-migration__grid"><section aria-labelledby="k-migration-conflicts-title"><h2 id="k-migration-conflicts-title">Конфликты</h2><div data-mig-conflicts></div></section><section aria-labelledby="k-migration-runs-title"><h2 id="k-migration-runs-title">Запуски</h2><div data-mig-runs></div></section></div><div class="k-migration__message" role="status" aria-live="polite" data-mig-message></div></section>`}
async function mount(){
  const root=document.querySelector('.k-migration'); if(!root)return;
  let data={status:{counts:{}},conflicts:[],runs:[]}; let busy=false;
  const controls=[...root.querySelectorAll('button,input')];
  const setBusy=value=>{busy=Boolean(value);root.setAttribute('aria-busy',String(busy));controls.forEach(el=>{el.disabled=busy})};
  const msg=(text,type='info')=>{const el=root.querySelector('[data-mig-message]');el.textContent=text||'';el.dataset.type=type};
  const paint=()=>{
    const counts=data.status?.counts||{};
    root.querySelector('[data-mig-status]').innerHTML=`<div class="k-migration__kpis">${[['Legacy users',counts.users],['Accounts',counts.accounts],['Persons',counts.persons],['Links',counts.identity_legacy_links],['Open conflicts',counts.openConflicts]].map(([label,value])=>`<article><b>${esc(value??0)}</b><span>${esc(label)}</span></article>`).join('')}</div>`;
    root.querySelector('[data-mig-conflicts]').innerHTML=(data.conflicts||[]).map(x=>`<article class="k-migration__conflict"><header><b>${esc(x.conflictType)}</b><i>${esc(x.severity)}</i></header><p>${esc(x.legacyType)} #${esc(x.legacyId)} ${esc(x.phone||'')}</p><small>${esc(x.status)} · ${esc(x.lastSeenAt)}</small><div><button type="button" data-conflict-resolve="${Number(x.id)||0}">Resolve</button><button type="button" data-conflict-ignore="${Number(x.id)||0}">Ignore</button>${x.status!=='open'?`<button type="button" data-conflict-reopen="${Number(x.id)||0}">Reopen</button>`:''}</div></article>`).join('')||'<p class="k-empty">Конфликтов нет</p>';
    root.querySelector('[data-mig-runs]').innerHTML=(data.runs||[]).map(x=>`<article class="k-migration__run"><b>${esc(x.mode)} · ${esc(x.status)}</b><span>scanned ${esc(x.scanned)} / migrated ${esc(x.migrated)} / conflicts ${esc(x.conflicts)} / failed ${esc(x.failed)}</span><small>${esc(x.startedAt)} → ${esc(x.finishedAt||'running')}</small></article>`).join('')||'<p class="k-empty">Запусков нет</p>';
  };
  const load=async()=>{setBusy(true);msg('Загрузка…');try{data=await req();paint();msg('')}catch(error){if(error.name!=='AbortError')msg(error.message,'error')}finally{setBusy(false)}};
  root.addEventListener('click',async event=>{
    if(busy)return;
    if(event.target.closest('[data-mig-refresh]'))return load();
    const after=Math.max(0,Number(root.querySelector('[data-mig-after]').value)||0);
    const limit=Math.min(500,Math.max(1,Number(root.querySelector('[data-mig-limit]').value)||100));
    try{
      setBusy(true);
      if(event.target.closest('[data-mig-dry]')){msg('Dry run выполняется…');await req('POST',{action:'runBatch',mode:'dry_run',after,limit});msg('Dry run завершён');return await load()}
      if(event.target.closest('[data-mig-apply]')){const approved=await window.KaretaNativeDialogs?.confirm?.({title:'Применить Identity Migration?',message:`Будет применён батч после user ID ${after}, лимит ${limit}.`,detail:'Операция изменяет Identity-схему для выбранного батча и должна выполняться только после проверки dry run.',confirmLabel:'Применить батч',danger:true,trigger:event.target.closest('[data-mig-apply]')});if(!approved)return;msg('Применение батча…');await req('POST',{action:'runBatch',mode:'apply',confirm:'APPLY',after,limit});msg('Батч применён');return await load()}
      const resolve=event.target.closest('[data-conflict-resolve]');if(resolve){await req('POST',{action:'resolveConflict',conflictId:Number(resolve.dataset.conflictResolve)});return await load()}
      const ignore=event.target.closest('[data-conflict-ignore]');if(ignore){await req('POST',{action:'ignoreConflict',conflictId:Number(ignore.dataset.conflictIgnore)});return await load()}
      const reopen=event.target.closest('[data-conflict-reopen]');if(reopen){await req('POST',{action:'reopenConflict',conflictId:Number(reopen.dataset.conflictReopen)});return await load()}
    }catch(error){if(error.name!=='AbortError')msg(error.message,'error')}finally{setBusy(false)}
  });
  await load();
}
window.KaretaIdentityMigrationPages=Object.freeze({render,mount});
})();
