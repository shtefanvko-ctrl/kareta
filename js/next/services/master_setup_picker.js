(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const accessLabels={owned:'Есть',shared_sto:'В СТО',rented:'Арендую',need_buy:'Нужно купить'};
  const svg=id=>window.KaretaUIIcons?.svg?.(id,{className:'k-setup-art'})||'';

  function mount(root,{lifecycle={},services}={}) {
    const dialog=document.createElement('dialog');dialog.className='k-master-setup';
    dialog.setAttribute('aria-label','Настройка мастерской');root.append(dialog);
    let live=true,mode='services',stage=1,group='',active=null,items=[],groups=[],selection=new Map(),contextId=0,revision=0,dirty=false,saving=false,loading=false,error='',notice='',generation=0,saveTimer=0,scopeKey='',serviceQueue=Promise.resolve();
    const pending=new Set(),desiredServices=new Map(),loadController=new AbortController();let mutationId='',lastPaintKey='',conflictDraft=null;
    function draftKey(){return contextId?'kareta.master.equipment:'+contextId:'';}
    function remember(){const key=draftKey();if(!key)return;try{if(conflictDraft){sessionStorage.setItem(key,JSON.stringify(conflictDraft));return;}if(dirty)sessionStorage.setItem(key,JSON.stringify({contextId,revision,selection:[...selection.values()],group,mutationId}));else sessionStorage.removeItem(key);}catch(_e){}}
    function progressKey(){return scopeKey?'kareta.master.setup:'+scopeKey:'';}
    function rememberStep(){const key=progressKey();if(!key)return;try{sessionStorage.setItem(key,JSON.stringify({mode,stage:Math.min(stage,2),group,pendingServices:[...desiredServices]}));}catch(_e){}}
    function sameSelection(a,b){const normal=rows=>JSON.stringify(rows.map(x=>[x.equipmentId,x.access]).sort((x,y)=>String(x[0]).localeCompare(String(y[0]))));return normal(a)===normal(b);}
    function newMutation(){return window.crypto?.randomUUID?.()||Date.now().toString(36)+'.'+Math.random().toString(36).slice(2);}
    function markChanged(){dirty=true;error='';mutationId=newMutation();remember();clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveEquipment(),250);}
    async function request(url,options={}) {
      const api=window.KaretaApiClient;if(!api)throw new Error('Не удалось загрузить оборудование');
      let result;try{result=await api.request(url,{cacheTtlMs:0,signal:loadController.signal,...options});}catch(e){if(e.name==='AbortError')throw e;throw new Error('Не удалось выполнить запрос. Выбор остаётся в черновике.');}
      if(!result.ok){const e=new Error(result.payload?.message||'Не удалось сохранить выбор');e.status=result.status;e.payload=result.payload;throw e;}return result.payload.data;
    }
    async function loadEquipment(nextGroup='',first=false) {
      const token=++generation;loading=true;error='';paint();
      try{
        const data=await request('api/master_onboarding.php?action=equipment'+(nextGroup?'&group='+encodeURIComponent(nextGroup):''));
        if(!live||token!==generation)return;
        if(contextId&&contextId!==data.contextId)throw new Error('Контекст изменился. Откройте оборудование заново.');
        contextId=data.contextId;groups=data.groups;items=data.items;group=data.groupId;
        if(first){revision=data.revision;stage=data.resumeStage===2?2:1;selection=new Map(data.selection.map(item=>[item.equipmentId,item]));dirty=false;
          try{const raw=JSON.parse(sessionStorage.getItem(draftKey())||'null');if(raw&&raw.contextId===contextId){if(raw.revision===revision&&Array.isArray(raw.selection)){selection=new Map(raw.selection.map(item=>[item.equipmentId,item]));mutationId=raw.mutationId||newMutation();dirty=true;notice='Восстановлен несохранённый выбор';}else if(raw.revision!==revision){if(Array.isArray(raw.selection)&&sameSelection(raw.selection,data.selection)){sessionStorage.removeItem(draftKey());notice='Сохранено';}else{conflictDraft=raw;error='Есть несохранённый выбор другой версии. Выберите сохранённое или свой черновик.';}}}}catch(_e){}
        }
        if(!first)dirty=true;rememberStep();
      }catch(e){if(live&&token===generation&&e.name!=='AbortError')error=e.message;}
      finally{if(live&&token===generation){loading=false;paint();if(dirty&&!error){if(!first)markChanged();else{remember();saveTimer=setTimeout(()=>saveEquipment(),250);}}}}
    }
    async function saveEquipment() {
      clearTimeout(saveTimer);if(!live||!dirty||saving||!contextId)return;
      const version=JSON.stringify({selection:[...selection.values()].map(({equipmentId,access})=>({equipmentId,access})),group}),sent=JSON.parse(version);if(!mutationId)mutationId=newMutation();const sentMutation=mutationId;
      saving=true;error='';paint();
      try{
        const data=await request('api/master_onboarding.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'equipment.save',contextId,expectedRevision:revision,selection:sent.selection,lastGroupId:sent.group,mutationId:sentMutation})});
        if(!live)return;if(data.contextId!==contextId)throw new Error('Контекст изменился. Откройте оборудование заново.');
        revision=data.revision;dirty=version!==JSON.stringify({selection:[...selection.values()].map(({equipmentId,access})=>({equipmentId,access})),group});if(!dirty)mutationId='';notice=dirty?'':'Сохранено';remember();
      }catch(e){if(live&&e.name!=='AbortError'){error=e.message;dirty=true;remember();}}
      finally{if(live){saving=false;paint();if(dirty&&!error){saveTimer=setTimeout(()=>saveEquipment(),250);}}}
    }
    function serviceItems(category) {const snap=services.snapshot();return snap.catalog.filter(item=>item.category===category).map(item=>({id:item.id,name:item.name,shortName:item.name,iconId:window.KaretaUIIcons.serviceName(item.category),groupId:item.category}));}
    function loadServices() {
      const snap=services.snapshot();if(snap.status!=='ready'){groups=[];items=[];selection.clear();error='Личный прайс ещё не загружен. Повторите через несколько секунд.';return;}groups=[...new Set(snap.catalog.map(item=>item.category))].map(id=>({id,label:services.categoryLabel(id),icon_id:window.KaretaUIIcons.serviceName(id)}));
      selection=new Map(snap.catalog.filter(services.selected).map(item=>[item.id,{equipmentId:item.id,name:item.name,iconId:window.KaretaUIIcons.serviceName(item.category),groupId:item.category}]));
      if(!groups.some(x=>x.id===group))group=groups[0]?.id||'';items=serviceItems(group);scopeKey=services.scopeKey();
    }
    async function toggleService(item,forced=null) {
      if(pending.has(item.id))return;const enabled=forced===null?!selection.has(item.id):forced,token=generation;
      desiredServices.set(item.id,enabled);rememberStep();pending.add(item.id);error='';paint();
      const operation=serviceQueue.then(async()=>{if(!live||token!==generation)return;await services.select(item.id,enabled);});
      serviceQueue=operation.catch(()=>{});
      try{await operation;if(!live||token!==generation)return;if(!enabled)selection.delete(item.id);else selection.set(item.id,{equipmentId:item.id,name:item.name,iconId:item.iconId,groupId:item.groupId});desiredServices.delete(item.id);notice='Сохранено';rememberStep();}
      catch(e){if(live&&token===generation)error=e.message||'Услуга не сохранена';}
      finally{pending.delete(item.id);if(live&&token===generation)paint();}
    }
    function card(item){const chosen=selection.get(item.id);return `<button type="button" class="k-setup-tile ${chosen?'is-selected':''}" data-setup-item="${esc(item.id)}" aria-pressed="${!!chosen}" ${pending.has(item.id)?'disabled':''}>${svg(item.iconId)}<b>${esc(item.shortName)}</b><small>${pending.has(item.id)?'Сохраняю…':chosen?(mode==='equipment'?accessLabels[chosen.access]:'Выбрано'):'Выбрать'}</small></button>`;}
    function paint() {
      if(!live)return;const count=selection.size,title=mode==='equipment'?'Моя мастерская':'Мои направления';
      const stepLabels=mode==='equipment'?['Категория','Инструмент','Доступ']:['Категория','Услуги'];
      let content='';
      if(loading)content='<div class="k-setup-message" role="status">Загружаю карточки…</div>';
      else if(stage===1)content=`<p class="k-setup-lead">${mode==='equipment'?'Соберите свой набор оборудования':'Выберите направление, затем отметьте услуги'}</p><div class="k-setup-grid">${groups.map(g=>{const count=[...selection.values()].filter(x=>x.groupId===g.id).length;return `<button type="button" class="k-setup-tile ${count?'is-selected':''}" data-setup-group="${esc(g.id)}">${svg(g.icon_id)}<b>${esc(g.label)}</b><small>${count?count+' выбрано':''}</small></button>`;}).join('')}</div>`;
      else if(stage===2)content=`<div class="k-setup-category-bar"><button type="button" data-setup-stage="1">${svg('chevronLeft')}Категории</button><b>${esc(groups.find(x=>x.id===group)?.label||'')}</b></div><div class="k-setup-grid">${items.map(card).join('')}</div>${!items.length?'<p class="k-setup-message">Карточки пока недоступны</p>':''}`;
      else if(active)content=`<div class="k-setup-focus">${svg(active.iconId)}<h3>${esc(active.name)}</h3><div class="k-setup-access">${Object.entries(accessLabels).map(([key,label])=>`<button type="button" data-setup-access="${key}" aria-pressed="${selection.get(active.id)?.access===key}" class="${selection.get(active.id)?.access===key?'is-selected':''}">${svg(key==='need_buy'?'tabler:package':key==='owned'?'tabler:check':'tabler:car-garage')}<b>${label}</b></button>`).join('')}</div>${selection.has(active.id)?'<button type="button" data-setup-remove>Убрать из набора</button>':''}<button type="button" data-setup-stage="2">К инструментам</button></div>`;
      const paintKey=[mode,stage,group].join(':');const scrollTop=lastPaintKey===paintKey?(dialog.querySelector?.('.k-setup-body')?.scrollTop||0):0;const dockLeft=dialog.querySelector?.('.k-setup-slots')?.scrollLeft||0;lastPaintKey=paintKey;
      const focused=document.activeElement;const focusAttr=focused?.getAttributeNames?.().find(name=>name.startsWith('data-setup-'));const focusValue=focusAttr?focused.getAttribute(focusAttr):null;
      dialog.innerHTML=`<header class="k-setup-header"><div><small>НАСТРОЙКА МАСТЕРА</small><h2>${title}</h2></div><button type="button" data-setup-close aria-label="Закрыть">${svg('close')}</button></header><nav class="k-setup-progress" aria-label="Этапы настройки">${stepLabels.map((label,i)=>`<button type="button" data-setup-stage="${i+1}" ${i===2&&!active?'disabled':''} ${stage===i+1?'aria-current="step"':''}><span>${i+1}</span><small>${label}</small></button>`).join('')}</nav><div class="k-setup-body">${content}</div><footer class="k-setup-dock"><div class="k-setup-dock-title"><b>${mode==='equipment'?'Мой набор':'Мои услуги'} · ${count}</b><span role="status" aria-live="polite">${esc(error||(saving||pending.size?'Сохраняю…':dirty?'Не сохранено':notice||'Сохранено'))}</span></div><div class="k-setup-slots">${[...selection.values()].map(item=>`<button type="button" data-setup-picked="${esc(item.equipmentId)}" aria-label="${esc(item.name)}">${svg(item.iconId)}<small>${esc(item.name)}</small></button>`).join('')}${!count?'<span>Выбранное появится здесь</span>':''}</div><div class="k-setup-dock-actions">${conflictDraft?'<button type="button" data-setup-use-saved>Оставить сохранённое</button><button type="button" data-setup-use-draft>Мой черновик</button>':error?'<button type="button" data-setup-retry>Повторить</button>':''}<button class="k-btn k-btn-primary" type="button" data-setup-close ${saving||pending.size?'disabled':''}>Готово</button></div><small>${mode==='equipment'?'Оборудование указывается вами. Навык подтверждается отдельно.':'Выбранные услуги сохраняются в вашем рабочем прайсе.'}</small></footer>`;
      if(dialog.querySelector){const body=dialog.querySelector('.k-setup-body'),dock=dialog.querySelector('.k-setup-slots');if(body)body.scrollTop=scrollTop;if(dock)dock.scrollLeft=dockLeft;}
      if(focusAttr&&dialog.querySelector){const target=[...dialog.querySelectorAll('button')].find(button=>button.getAttribute(focusAttr)===focusValue)||dialog.querySelector('[aria-current="step"]');if(target&&!target.disabled)target.focus({preventScroll:true});}
    }
    async function close() {if(pending.size||saving)return;if(mode==='equipment'&&dirty){await saveEquipment();if(dirty||error)return;}dialog.close();active=null;}
    async function open(nextMode) {
      if(saving||pending.size)return;mode=nextMode;stage=1;group='';active=null;error='';notice='';selection=new Map();groups=[];items=[];scopeKey='';desiredServices.clear();contextId=0;revision=0;dirty=false;mutationId='';conflictDraft=null;generation++;
      if(mode==='services'){loadServices();if(!groups.length){error='Услуги ещё загружаются. Попробуйте снова.';}try{const step=JSON.parse(sessionStorage.getItem(progressKey())||'null');if(step?.mode===mode&&groups.some(g=>g.id===step.group)){group=step.group;stage=step.stage===2?2:1;items=serviceItems(group);for(const row of step.pendingServices||[])if(Array.isArray(row)&&typeof row[1]==='boolean'&&services.snapshot().catalog.some(x=>x.id===row[0]))desiredServices.set(row[0],row[1]);if(desiredServices.size)error='Есть несохранённые услуги. Нажмите «Повторить».';}}catch(_e){}}
      paint();if(!dialog.open)dialog.showModal();if(mode==='equipment')await loadEquipment('',true);
    }
    const click=async event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.hasAttribute('data-setup-close')){await close();return;}
      if(target.hasAttribute('data-setup-use-saved')){conflictDraft=null;dirty=false;error='';notice='Сохранено';remember();paint();return;}
      if(target.hasAttribute('data-setup-use-draft')&&conflictDraft){selection=new Map(conflictDraft.selection.map(item=>[item.equipmentId,item]));conflictDraft=null;markChanged();paint();return;}
      if(target.hasAttribute('data-setup-retry')){if(mode==='equipment'){if(contextId&&dirty)await saveEquipment();else await loadEquipment(group,!contextId);}else{await services.refresh?.();loadServices();if(groups.length){error='';for(const [id,enabled] of [...desiredServices]){const service=services.snapshot().catalog.find(x=>x.id===id);if(service)await toggleService({id,name:service.name,iconId:window.KaretaUIIcons.serviceName(service.category),groupId:service.category},enabled);}paint();}}return;}
      const nextStage=target.dataset.setupStage;if(nextStage){stage=Number(nextStage);rememberStep();paint();return;}
      const category=target.dataset.setupGroup;if(category){group=category;stage=2;active=null;rememberStep();if(mode==='equipment')await loadEquipment(group);else{items=serviceItems(group);paint();}return;}
      const itemId=target.dataset.setupItem||target.dataset.setupPicked;
      if(itemId){const item=items.find(x=>x.id===itemId)||(()=>{const x=selection.get(itemId);return x?{id:itemId,name:x.name,shortName:x.name,iconId:x.iconId,groupId:x.groupId}:null;})();if(!item)return;if(mode==='services'){await toggleService(item);return;}active=item;stage=3;paint();return;}
      const access=target.dataset.setupAccess;if(access&&active){selection.set(active.id,{equipmentId:active.id,access,name:active.name,iconId:active.iconId,groupId:active.groupId});markChanged();stage=2;rememberStep();paint();return;}
      if(target.hasAttribute('data-setup-remove')&&active){selection.delete(active.id);markChanged();stage=2;paint();}
    };
    const cancel=event=>{event.preventDefault();close();};dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);
    const onRootClick=event=>{if(event.target.closest('[data-master-setup-services]'))open('services');if(event.target.closest('[data-master-setup-equipment]'))open('equipment');};root.addEventListener('click',onRootClick);
    function destroy(){if(!live)return;remember();rememberStep();live=false;generation++;clearTimeout(saveTimer);loadController.abort();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);root.removeEventListener('click',onRootClick);if(dialog.open)dialog.close();dialog.remove();selection.clear();desiredServices.clear();}
    lifecycle.addCleanup?.(destroy);return {open,destroy};
  }
  window.KaretaMasterSetupPicker=Object.freeze({mount});
})();
