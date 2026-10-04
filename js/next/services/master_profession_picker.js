(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=id=>window.KaretaUIIcons?.svg?.(id,{className:'k-setup-art'})||'';

  function language(){
    const raw=String(document.documentElement?.lang||document.documentElement?.dataset?.lang||'ru').toLowerCase();
    if(raw.startsWith('kk'))return 'kk';if(raw.startsWith('en'))return 'en';return 'ru';
  }
  function label(item){
    const lang=language();
    return String(item?.['label_'+lang]||item?.label_ru||item?.id||'');
  }
  function mutationId(){return window.crypto?.randomUUID?.()||Date.now().toString(36)+'.'+Math.random().toString(36).slice(2);}
  function mount(root,{lifecycle={}}={}){
    if(!root)return null;
    const dialog=document.createElement('dialog');dialog.className='k-master-setup k-master-profession-setup';dialog.setAttribute('aria-label','Профессии мастера');root.append(dialog);
    const controller=new AbortController();let live=true,loading=false,saving=false,error='',notice='',contextId=0,revision=0,items=[],selection=new Set(),dirty=false,mutation='',conflictDraft=null,timer=0;
    const key=()=>contextId?'kareta.master.professions:'+contextId:'';
    const currentRows=()=>[...selection].sort();
    function remember(){
      const k=key();if(!k)return;
      try{
        if(conflictDraft){sessionStorage.setItem(k,JSON.stringify(conflictDraft));return;}
        if(dirty)sessionStorage.setItem(k,JSON.stringify({contextId,revision,selection:currentRows(),mutationId:mutation}));
        else sessionStorage.removeItem(k);
      }catch(_e){}
    }
    function validDraft(raw){return raw&&raw.contextId===contextId&&Number.isInteger(raw.revision)&&raw.revision>=0&&Array.isArray(raw.selection)&&raw.selection.every(id=>typeof id==='string'&&items.some(x=>x.id===id))&&new Set(raw.selection).size===raw.selection.length;}
    async function request(url,options={}){
      const api=window.KaretaApiClient;if(!api)throw new Error('Не удалось загрузить профессии');
      let result;try{result=await api.request(url,{cacheTtlMs:0,signal:controller.signal,...options});}catch(e){if(e.name==='AbortError')throw e;throw new Error('Не удалось выполнить запрос. Выбор остаётся в черновике.');}
      if(!result.ok){const e=new Error(result.payload?.message||'Не удалось сохранить профессии');e.status=result.status;e.payload=result.payload;throw e;}
      return result.payload.data;
    }
    async function load(first=true){
      loading=true;error='';paint();
      try{
        const data=await request('api/master_onboarding.php?action=professions');
        if(!live)return;
        if(contextId&&contextId!==data.contextId)throw new Error('Контекст изменился. Откройте профессии заново.');
        contextId=data.contextId;revision=Number(data.revision||0);items=Array.isArray(data.items)?data.items:[];selection=new Set(Array.isArray(data.selection)?data.selection:[]);dirty=false;
        if(first){
          try{
            const raw=JSON.parse(sessionStorage.getItem(key())||'null');
            if(validDraft(raw)){
              if(raw.revision===revision){selection=new Set(raw.selection);mutation=raw.mutationId||mutationId();dirty=true;notice='Восстановлен несохранённый выбор';}
              else if(JSON.stringify([...raw.selection].sort())===JSON.stringify(currentRows())){sessionStorage.removeItem(key());notice='Сохранено';}
              else{conflictDraft=raw;error='Есть несохранённый выбор другой версии. Выберите сохранённое или свой черновик.';}
            }
          }catch(_e){}
        }
      }catch(e){if(live&&e.name!=='AbortError')error=e.message;}
      finally{if(live){loading=false;paint();}}
    }
    async function save(){
      clearTimeout(timer);if(!live||!dirty||saving||!contextId||conflictDraft)return;
      const sent=currentRows();const sentMutation=mutation||mutationId();mutation=sentMutation;saving=true;error='';paint();
      try{
        const data=await request('api/master_onboarding.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'professions.save',contextId,expectedRevision:revision,selection:sent,mutationId:sentMutation})});
        if(!live)return;if(data.contextId!==contextId)throw new Error('Контекст изменился. Откройте профессии заново.');
        revision=Number(data.revision||revision);dirty=JSON.stringify(sent)!==JSON.stringify(currentRows());if(!dirty){mutation='';notice='Сохранено';}remember();
      }catch(e){
        if(live&&e.name!=='AbortError'){
          error=e.message;dirty=true;remember();
          if(e.status===409&&e.payload?.error==='profession_revision_conflict'){
            const draft={contextId,revision,selection:currentRows(),mutationId:mutation};await load(false);
            conflictDraft=draft;error='Профессии изменены в другой вкладке. Выберите сохранённое или свой черновик.';remember();
          }
        }
      }finally{if(live){saving=false;paint();if(dirty&&!error&&!conflictDraft)timer=setTimeout(save,300);}}
    }
    function scheduleSave(){dirty=true;error='';mutation=mutationId();remember();clearTimeout(timer);timer=setTimeout(save,300);paint();}
    function paint(){
      if(!live)return;
      const count=selection.size;
      let body='';
      if(conflictDraft)body='<div class="k-setup-message">Сохранённая версия и ваш черновик различаются. Выберите, что оставить.</div>';
      else if(loading)body='<div class="k-setup-message" role="status">Загружаю профессии…</div>';
      else body=`<p class="k-setup-lead">Укажите направления, в которых вы работаете. Это самоуказание, а не подтверждение квалификации. Услуги включаются отдельно.</p><div class="k-setup-grid k-profession-grid">${items.map(item=>`<button type="button" class="k-setup-tile ${selection.has(item.id)?'is-selected':''}" data-profession-id="${esc(item.id)}" aria-pressed="${selection.has(item.id)}">${icon(item.icon_id)}<b>${esc(label(item))}</b><small>${selection.has(item.id)?'Выбрано':'Выбрать'}</small></button>`).join('')}</div>`;
      dialog.innerHTML=`<header class="k-setup-header"><div><small>НАСТРОЙКА МАСТЕРА</small><h2>Мои профессии</h2></div><button type="button" data-profession-close aria-label="Закрыть">${icon('close')}</button></header><div class="k-setup-body">${body}</div><footer class="k-setup-dock"><div class="k-setup-dock-title"><b>Профессии · ${count}</b><span role="status" aria-live="polite">${esc(error||(saving?'Сохраняю…':dirty?'Не сохранено':notice||'Сохранено'))}</span></div><div class="k-setup-dock-actions">${conflictDraft?'<button type="button" data-profession-use-saved>Оставить сохранённое</button><button type="button" data-profession-use-draft>Мой черновик</button>':error?'<button type="button" data-profession-retry>Повторить</button>':''}<button class="k-btn k-btn-primary" type="button" data-profession-close ${saving?'disabled':''}>Готово</button></div><small>Профессия не включает услуги автоматически и пока не участвует в подборе заявок.</small></footer>`;
    }
    async function open(){if(saving)return;contextId=0;revision=0;items=[];selection=new Set();dirty=false;mutation='';conflictDraft=null;error='';notice='';paint();if(!dialog.open)dialog.showModal();await load(true);}
    async function close(){if(saving)return;if(dirty&&!conflictDraft){await save();if(dirty||error)return;}dialog.close();}
    const onDialog=async event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-profession-close')){await close();return;}
      if(b.hasAttribute('data-profession-retry')){if(dirty)await save();else await load(false);return;}
      if(b.hasAttribute('data-profession-use-saved')){conflictDraft=null;dirty=false;error='';notice='Сохранено';remember();paint();return;}
      if(b.hasAttribute('data-profession-use-draft')&&conflictDraft){const draft=conflictDraft;selection=new Set(draft.selection);revision=Number(draft.revision||revision);conflictDraft=null;mutation=mutationId();dirty=true;error='';remember();await load(false);selection=new Set(draft.selection);scheduleSave();return;}
      if(conflictDraft)return;
      const id=b.dataset.professionId;if(id){selection.has(id)?selection.delete(id):selection.add(id);scheduleSave();}
    };
    const onRoot=event=>{if(event.target.closest('[data-master-setup-professions]'))open();};
    dialog.addEventListener('click',onDialog);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});root.addEventListener('click',onRoot);
    function destroy(){if(!live)return;remember();live=false;clearTimeout(timer);controller.abort();root.removeEventListener('click',onRoot);dialog.removeEventListener('click',onDialog);if(dialog.open)dialog.close();dialog.remove();}
    lifecycle.addCleanup?.(destroy);return {open,destroy};
  }
  window.KaretaMasterProfessionPicker=Object.freeze({mount});
})();