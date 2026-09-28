(() => {
  'use strict';

  if (window.__KARETA_CONTEXT_MANAGER_MODULE__) {
    window.__KARETA_CONTEXT_MANAGER_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_CONTEXT_MANAGER_MODULE__ = { duplicateLoads:0 };

  const ROLE_OPTIONS=Object.freeze([
    Object.freeze({key:'client',label:'Клиент',icon:'user'}),
    Object.freeze({key:'master',label:'Мастер',icon:'masters'}),
    Object.freeze({key:'sto',label:'СТО',icon:'work'}),
    Object.freeze({key:'seller',label:'Магазин',icon:'store'})
  ]);
  const CONTEXT_BUTTON_ROLES=Object.freeze(new Set(['client','master']));
  const VISIBLE_CONTEXT_OPTIONS=Object.freeze(ROLE_OPTIONS.filter(option=>CONTEXT_BUTTON_ROLES.has(option.key)));
  const state={loaded:false,loading:false,contexts:[],accountTypes:[],selected:null,capabilities:[],deniedCapabilities:[],error:'',legacyUser:null,legacyMode:false};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function sync(snapshot){
    state.loaded=Boolean(snapshot?.loaded);
    state.loading=Boolean(snapshot?.loading);
    state.contexts=Array.isArray(snapshot?.contexts)?snapshot.contexts:[];
    state.accountTypes=Array.isArray(snapshot?.accountTypes)?snapshot.accountTypes:[];
    state.selected=snapshot?.context||null;
    state.capabilities=Array.isArray(snapshot?.capabilities)?snapshot.capabilities:[];
    state.deniedCapabilities=Array.isArray(snapshot?.deniedCapabilities)?snapshot.deniedCapabilities:[];
    state.error=String(snapshot?.error||'');
    state.legacyMode=Boolean(!snapshot?.authenticated && state.legacyUser);
    if(state.selected){
      document.documentElement.dataset.workContext=String(state.selected.type||'personal');
      document.documentElement.dataset.workContextId=String(state.selected.id||'');
    }else{
      delete document.documentElement.dataset.workContext;
      delete document.documentElement.dataset.workContextId;
    }
    render();
    return state;
  }

  function resetAnonymous(){
    window.KaretaIdentity?.reset?.('context-manager');
    return sync(window.KaretaIdentity?.snapshot?.()||{});
  }

  async function load(forceOrOptions=false){
    const options=typeof forceOrOptions==='object'&&forceOrOptions!==null?forceOrOptions:{force:Boolean(forceOrOptions)};
    state.loading=true;state.error='';render();
    try{return sync(await window.KaretaIdentity.load({force:Boolean(options.force),allowLegacyBridge:Boolean(options.allowLegacyBridge),legacyUser:state.legacyUser}));}
    catch(error){state.loading=false;state.loaded=true;state.error=error.message||'Ошибка загрузки контекста';render();return state;}
  }

  async function select(contextIdOrKey,options={}){
    const current=state.contexts.find(item=>String(item.id)===String(contextIdOrKey)||String(item.key)===String(contextIdOrKey));
    if(!current||String(current.id||current.key)===String(state.selected?.id||state.selected?.key))return state;
    state.loading=true;state.error='';render();
    try{
      const next=window.KaretaNavigationCore?.switchContext
        ? await window.KaretaNavigationCore.switchContext(current.id||current.key)
        : await window.KaretaIdentity.select(current.id||current.key);
      const result=sync(next?.identity||next);
      if(options.closeMenu!==false)window.KaretaShellMenu?.close?.();
      if(options.toast!==false)window.KaretaToast?.success?.(`Тип аккаунта «${contextTitle(current)}» включён`);
      return result;
    } catch(error){state.error=error.message||'Не удалось переключить тип аккаунта';throw error;}
    finally { state.loading=false;render(); }
  }

  async function requestType(role){
    const normalized=String(role||'').toLowerCase();
    if(!['master','sto','seller'].includes(normalized)||state.loading)return state;
    state.loading=true;state.error='';render();
    try{
      const response=await fetch('/api/context.php?action=request-type',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({role:normalized})});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload||payload.ok!==true){const error=new Error(payload?.message||payload?.error||`HTTP ${response.status}`);error.status=response.status;error.payload=payload;throw error;}
      const refreshed=window.KaretaIdentity?.load?await window.KaretaIdentity.load({force:true}):null;
      let result=sync(refreshed||{...window.KaretaIdentity?.snapshot?.(),...payload,authenticated:true});
      const type=ROLE_OPTIONS.find(item=>item.key===normalized)?.label||'Тип аккаунта';
      const autoApproved=payload?.request?.autoApproved===true||payload?.autoApproved===true;
      if(autoApproved){
        const targetId=payload?.request?.targetContextId||payload?.request?.targetContextKey||'';
        const target=state.contexts.find(item=>String(item.id||item.key)===String(targetId))
          ||state.contexts.find(item=>roleForContext(item)===normalized)
          ||null;
        if(!target)throw new Error('account_type_context_not_materialized');
        if(String(target.id||target.key)!==String(state.selected?.id||state.selected?.key)){
          result=await select(target.id||target.key,{toast:false,closeMenu:false});
        }
        window.KaretaShellMenu?.close?.();
        window.KaretaToast?.success?.(`Тип аккаунта «${type}» добавлен для тестирования и включён`);
      }else{
        window.KaretaToast?.success?.(payload?.request?.alreadyPending?`Заявка «${type}» уже на проверке`:`Заявка на тип «${type}» отправлена`);
      }
      window.dispatchEvent(new CustomEvent('kareta:account-types-changed',{detail:result}));
      return result;
    }catch(error){state.error=error.message||'Не удалось добавить тип аккаунта';window.KaretaToast?.error?.(state.error);throw error;}
    finally{state.loading=false;render();}
  }

  function accountTypeState(role){
    return state.accountTypes.find(item=>String(item?.role||'').toLowerCase()===role)||{role,status:role==='client'?'active':'available',description:'Добавить к текущему номеру телефона'};
  }

  function contextForRole(role,type){
    const matches=state.contexts.filter(context=>roleForContext(context)===role);
    const selectedId=String(state.selected?.id||state.selected?.key||'');
    return matches.find(context=>String(context.id||context.key)===selectedId)
      ||matches.find(context=>String(context.id||'')===String(type?.contextId||'')||String(context.key||'')===String(type?.contextKey||''))
      ||matches[0]||null;
  }

  function accountTypeChoice(option){
    const type=accountTypeState(option.key);
    const context=contextForRole(option.key,type);
    if(!context)return missingRoleChoice(option);
    const active=String(context.id||context.key)===String(state.selected?.id||state.selected?.key);
    const count=state.contexts.filter(item=>roleForContext(item)===option.key).length;
    const detail=`${context.label||optionLabel(context)}${count>1?` · ещё ${count-1}`:''}`;
    return `<button type="button" role="listitem" class="k-context-button ${active?'is-active':''}" data-context-switch-select="${esc(context.id||context.key)}" ${active?'aria-current="true" disabled':''} ${state.loading?'aria-busy="true" disabled':''}><span class="k-context-button-icon">${iconSvg(option.icon)}</span><span><b>${esc(option.label)}</b><small>${esc(detail)}</small></span>${active?'<i>Активен</i>':'<i>Переключить</i>'}</button>`;
  }

  function missingRoleChoice(option){
    const type=accountTypeState(option.key);const status=String(type.status||'available');
    const pending=status==='pending';const setup=status==='setup_required';const rejected=status==='rejected';
    const description=String(type.description||'Добавить к текущему номеру телефона');
    const stateLabel=pending?'На проверке':setup?'Настройка':rejected?'Повторить':'Добавить';
    const className=`k-context-button k-context-button--type is-${esc(status)}`;
    const content=`<span class="k-context-button-icon">${iconSvg(option.icon)}</span><span><b>${esc(option.label)}</b><small>${esc(description)}</small></span><i>${esc(stateLabel)}</i>`;
    if(pending)return `<button type="button" role="listitem" class="${className}" disabled aria-disabled="true">${content}</button>`;
    if(setup)return `<button type="button" role="listitem" class="${className}" data-context-retry ${state.loading?'aria-busy="true" disabled':''}>${content}</button>`;
    return `<button type="button" role="listitem" class="${className}" data-context-type-request="${esc(option.key)}" ${state.loading?'aria-busy="true" disabled':''}>${content}</button>`;
  }

  function accountTypeSummary(){
    const activeRoles=new Set(state.contexts.map(roleForContext).filter(Boolean));
    const visibleActive=[...activeRoles].filter(role=>CONTEXT_BUTTON_ROLES.has(role)).length;
    const visiblePending=state.accountTypes.filter(item=>CONTEXT_BUTTON_ROLES.has(String(item?.role||'').toLowerCase())&&item.status==='pending').length;
    return `${visibleActive||1} активный тип${visiblePending?` · ${visiblePending} на проверке`:''} · Клиент и Мастер`;
  }

  function optionLabel(context){
    if(context.type==='personal')return `Личный: ${context.label||'Кабинет'}`;
    if(context.type==='profile')return context.label||'Профессиональный профиль';
    const kind=context.organizationType==='service_station'?'СТО':context.organizationType==='parts_store'?'Магазин':'Организация';
    return `${kind}: ${context.label||context.organizationKey||'Контекст'}`;
  }

  function contextTitle(context){
    if(context?.type==='personal')return 'Клиент';
    if(context?.type==='profile')return String(context.profileType||'').toLowerCase()==='seller'?'Магазин':'Мастер';
    if(context?.type==='organization')return String(context.organizationType||'').toLowerCase()==='parts_store'?'Магазин':'СТО';
    return context?.label||'Аккаунт';
  }

  function contextIcon(context){const title=contextTitle(context);return title==='Клиент'?'user':title==='Мастер'?'masters':title==='Магазин'?'store':'work';}
  function iconSvg(name){return window.KaretaUIIcons?.svg?.(name)||'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>';}
  function roleForContext(context){
    if(context?.type==='personal')return 'client';
    if(context?.type==='profile')return String(context.profileType||context.profile_type||'').toLowerCase()==='seller'?'seller':'master';
    if(context?.type==='organization')return String(context.organizationType||context.organization_type||'').toLowerCase()==='parts_store'?'seller':'sto';
    return '';
  }
  function legacyRole(){
    const role=String(state.legacyUser?.role||'client').toLowerCase();
    return ({service:'sto',service_station:'sto',station:'sto',parts_store:'seller',shop:'seller',store:'seller'}[role]||role);
  }
  function legacyRoleChoice(option){
    const activeRole=legacyRole();
    const serverContext=state.contexts.find(context=>roleForContext(context)===option.key)||null;
    const selectedKey=String(state.selected?.id||state.selected?.key||'');
    const serverKey=String(serverContext?.id||serverContext?.key||'');
    const active=(serverKey!==''&&serverKey===selectedKey)||(!state.selected&&option.key===activeRole);
    const content=`<span class="k-context-role-icon">${iconSvg(option.icon)}</span><span class="k-context-role-copy"><b>${esc(option.label)}</b><small>${active?'Текущий тип аккаунта':serverContext?esc(serverContext.label||optionLabel(serverContext)):'Создать профиль'}</small></span><i class="k-context-role-state">${active?'Активен':serverContext?'Переключить':'Добавить'}</i>`;
    if(active)return `<button type="button" role="listitem" class="k-context-role-choice is-active" aria-current="true" disabled>${content}</button>`;
    if(serverContext)return `<button type="button" role="listitem" class="k-context-role-choice" data-context-switch-select="${esc(serverContext.id||serverContext.key)}" ${state.loading?'aria-busy="true" disabled':''}>${content}</button>`;
    return `<a role="listitem" class="k-context-role-choice" href="#role:${esc(option.key)}:role" data-context-role-create="${esc(option.key)}" data-context-add-profile>${content}</a>`;
  }
  function bindHost(host){
    if(host.dataset.contextSwitcherBound==='true')return;
    host.dataset.contextSwitcherBound='true';
    host.addEventListener('click',event=>{
      const retry=event.target.closest('[data-context-retry]');
      if(retry){load({force:true,allowLegacyBridge:true});return;}
      const button=event.target.closest('[data-context-switch-select]');
      if(button){select(button.dataset.contextSwitchSelect).catch(error=>{window.KaretaToast?.error?.(error.message||'Не удалось переключить тип аккаунта');render();});return;}
      const request=event.target.closest('[data-context-type-request]');
      if(request){requestType(request.dataset.contextTypeRequest).catch(()=>{});return;}
      const create=event.target.closest('[data-context-role-create]');
      if(create){const role=String(create.dataset.contextRoleCreate||'client');window.KaretaShellMenu?.close?.();if(window.KaretaOnboardingNavigation?.to){event.preventDefault();window.KaretaOnboardingNavigation.to('role',{role,source:'legacy-context-picker'});}return;}
      if(event.target.closest('[data-context-add-profile]'))window.KaretaShellMenu?.close?.();
    });
  }

  function render(){
    const host=document.getElementById('k-context-switcher');
    if(!host)return false;
    bindHost(host);
    if(state.loading&&!state.loaded){host.hidden=false;host.innerHTML='<div class="k-context-loading">Загрузка контекста…</div>';return true;}
    if(state.error && !state.legacyMode){host.hidden=false;host.innerHTML=`<button class="k-context-error" type="button" data-context-retry>${esc(state.error)} · повторить</button>`;return true;}
    if(state.legacyMode){
      host.hidden=false;
      host.innerHTML=`<section class="k-context-legacy"><header><span>ТИП АККАУНТА</span><small>Доступные типы: Клиент и Мастер</small></header><div class="k-context-legacy-roles" role="list" aria-label="Типы аккаунта">${VISIBLE_CONTEXT_OPTIONS.map(legacyRoleChoice).join('')}</div><div class="k-context-legacy-footer"><small>${state.error?esc(state.error):'Серверные контексты обновятся после восстановления Identity-сессии.'}</small><button class="k-context-recover" type="button" data-context-retry ${state.loading?'aria-busy="true" disabled':''}>Обновить типы</button></div></section>`;
      return true;
    }
    if(!state.contexts.length){host.innerHTML='';host.hidden=true;return true;}
    const typeButtons=VISIBLE_CONTEXT_OPTIONS.map(accountTypeChoice).join('');
    host.hidden=false;
    host.innerHTML=`<section class="k-context-card"><header><span>ТИП АККАУНТА</span><small>${esc(accountTypeSummary())}</small></header><div class="k-context-buttons" role="list" aria-label="Типы аккаунта">${typeButtons}</div><div class="k-context-account-note">Клиент и Мастер используют один номер телефона.</div>${state.error?`<button class="k-context-error" type="button" data-context-retry>${esc(state.error)} · повторить</button>`:''}</section>`;
    return true;
  }

  function has(capability){return window.KaretaIdentity?.has?.(capability)===true;}

  window.addEventListener('kareta:identity-ready',event=>sync(event.detail));
  window.addEventListener('kareta:identity-anonymous',()=>sync(window.KaretaIdentity?.snapshot?.()||{}));
  window.addEventListener('kareta:capabilities-changed',event=>sync(event.detail));
  window.addEventListener('kareta:context-changed',event=>sync(event.detail?.identity||window.KaretaIdentity?.snapshot?.()||{}));
  window.addEventListener('kareta:session-confirmed',event=>{
    const detail=event.detail||{};
    state.legacyUser=detail.user||null;
    if(detail.identity?.authenticated){state.legacyMode=false;sync(detail.identity);return;}
    state.legacyMode=Boolean(detail.legacy);
    if(state.legacyMode)load({force:true,allowLegacyBridge:true});
    else sync(window.KaretaIdentity?.snapshot?.()||{});
  });
  window.addEventListener('kareta:session-anonymous',resetAnonymous);

  window.KaretaContextManager=Object.freeze({load,select,requestType,render,has,resetAnonymous,getState:()=>({...state,contexts:[...state.contexts],accountTypes:[...state.accountTypes],capabilities:[...state.capabilities],deniedCapabilities:[...state.deniedCapabilities]})});
})();
