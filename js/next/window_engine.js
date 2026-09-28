(() => {
  'use strict';

  if (window.__KARETA_WINDOW_ENGINE__) return;
  window.__KARETA_WINDOW_ENGINE__ = { version:'R188.5.5.6.84.68' };

  const state = {
    dialog:null,
    body:null,
    title:null,
    baseHash:'',
    targetHash:'',
    trigger:null,
    controller:null,
    cleanups:[],
    replacing:false,
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentRoute = () => document.querySelector('#k-page-outlet')?.getAttribute('data-current-route') || '';
  const entityKeys = new Set(['workOrder']);

  function descriptor(hashValue){
    const hash=String(hashValue||'').trim();
    if(/^#\/orders\/item\/[^/?]+/.test(hash)) return {key:'workOrder',label:'Заказ-наряд',render:()=>window.KaretaWorkOrderPages?.renderWorkOrder?.(window.KaretaNext?.state||{}),mount:ctx=>window.KaretaWorkOrderPages?.mountWorkOrder?.(ctx)};
    return null;
  }

  function lifecycle(existingController=null){
    const controller=existingController||new AbortController();
    state.controller=controller;
    return {
      signal:controller.signal,
      token:Date.now(),
      source:'entity-window',
      isActive:()=>!controller.signal.aborted && Boolean(state.dialog?.open),
      addCleanup(fn){if(typeof fn==='function')state.cleanups.push(fn);return fn;},
    };
  }

  function cleanupMounted(){
    try{state.controller?.abort?.('entity-window-close');}catch(_e){}
    state.controller=null;
    const queue=state.cleanups.splice(0).reverse();
    queue.forEach(fn=>{try{fn?.();}catch(error){console.warn('[KARETA window cleanup]',error);}});
  }

  function ensureDialog(){
    if(state.dialog?.isConnected)return state.dialog;
    const dialog=document.createElement('dialog');
    dialog.className='k-entity-window';
    dialog.setAttribute('data-kareta-entity-window','');
    dialog.innerHTML=`<div class="k-entity-window__surface"><header class="k-entity-window__head"><div><small>РАБОЧЕЕ ОКНО</small><h2 data-entity-window-title>Карточка</h2></div><button type="button" class="k-entity-window__close" data-entity-window-close aria-label="Закрыть">×</button></header><div class="k-entity-window__body" data-entity-window-body></div></div>`;
    document.body.appendChild(dialog);
    state.dialog=dialog;
    state.body=dialog.querySelector('[data-entity-window-body]');
    state.title=dialog.querySelector('[data-entity-window-title]');
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{
      if(event.target===dialog || event.target.closest('[data-entity-window-close]')){close();return;}
      if(event.target.closest('[data-entity-window-retry]'))open(state.targetHash,{trigger:state.trigger});
    });
    return dialog;
  }

  function context(localLifecycle){
    return {
      state:window.KaretaNext?.state || {},
      api:window.KaretaNext?.api || window.KaretaApiClient,
      lifecycle:localLifecycle,
      appVersion:String(window.KARETA_NEXT_ASSET_VERSION||''),
      route:{path:state.targetHash},
    };
  }

  function setHashSilently(hash){
    try{history.replaceState(history.state,'',hash);}catch(_e){}
  }

  function renderError(message){
    if(!state.body)return;
    state.body.innerHTML=`<section class="k-entity-window__error"><h3>Не удалось открыть окно</h3><p>${esc(message||'Неизвестная ошибка')}</p><div class="k-entity-window__error-actions"><button class="k-btn k-btn-primary" type="button" data-entity-window-retry>Повторить</button><button class="k-btn k-btn-secondary" type="button" data-entity-window-close>Закрыть</button></div></section>`;
  }

  function open(hashValue,{trigger=null}={}){
    const target=String(hashValue||'').trim();
    const meta=descriptor(target);
    if(!meta)return false;
    const dialog=ensureDialog();
    if(!state.baseHash)state.baseHash=String(location.hash||'#/home');
    if(trigger)state.trigger=trigger;
    state.replacing=Boolean(dialog.open);
    cleanupMounted();
    state.targetHash=target;
    setHashSilently(target);
    state.title.textContent=meta.label;
    state.body.innerHTML='<section class="k-entity-window__loading"><span></span><h3>Открываем карточку…</h3></section>';
    if(!dialog.open)dialog.showModal();
    document.documentElement.classList.add('k-entity-window-open');
    const loadController=new AbortController();
    state.controller=loadController;
    (async()=>{
      try{
        const loader=window.KaretaRouteAssetLoader;
        if(loader?.isKnownLazy?.(meta.key)){
          await loader.ensureRoute(meta.key,{signal:loadController.signal});
        }
        if(loadController.signal.aborted||state.targetHash!==target||!dialog.open)return;
        const html=meta.render?.();
        state.body.innerHTML=html || '<section class="k-empty"><h2>Карточка недоступна</h2></section>';
        const lc=lifecycle(loadController);
        const result=meta.mount?.(context(lc));
        if(typeof result==='function')state.cleanups.push(result);
        dialog.scrollTop=0;
        state.body.scrollTop=0;
        try{dialog.querySelector('button,input,a,[tabindex]')?.focus?.({preventScroll:true});}catch(_e){}
        try{window.dispatchEvent(new CustomEvent('kareta:entity-window-open',{detail:{key:meta.key,hash:target,baseHash:state.baseHash}}));}catch(_e){}
      }catch(error){
        if(error?.name==='AbortError'||loadController.signal.aborted)return;
        console.error('[KARETA entity window]',error);
        renderError(error?.message||String(error));
      }
    })();
    return true;
  }

  function close({restore=true}={}){
    if(!state.dialog)return false;
    const base=state.baseHash;
    cleanupMounted();
    if(state.dialog.open){try{state.dialog.close();}catch(_e){}}
    document.documentElement.classList.remove('k-entity-window-open');
    state.targetHash='';
    state.baseHash='';
    if(restore && base)setHashSilently(base);
    const trigger=state.trigger;state.trigger=null;
    try{trigger?.focus?.({preventScroll:true});}catch(_e){}
    try{window.dispatchEvent(new CustomEvent('kareta:entity-window-close',{detail:{baseHash:base}}));}catch(_e){}
    return true;
  }

  function handleClick(event){
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const link=event.target.closest('a[href^="#/"]');
    if(!link || link.hasAttribute('download') || (link.target && link.target!=='_self'))return;
    const target=String(link.getAttribute('href')||'');
    const meta=descriptor(target);
    if(!meta)return;
    const active=currentRoute();
    if(entityKeys.has(active) && !state.dialog?.open)return; // direct/deep-linked entity pages remain valid.
    event.preventDefault();
    event.stopImmediatePropagation();
    open(target,{trigger:link});
  }

  // Capture phase is intentional: entity navigation is resolved before the generic hash router.
  document.addEventListener('click',handleClick,true);
  window.addEventListener('hashchange',()=>{if(state.dialog?.open && String(location.hash)!==state.targetHash)close({restore:false});});

  window.KaretaWindowEngine=Object.freeze({openEntity:open,close,descriptor,isOpen:()=>Boolean(state.dialog?.open),snapshot:()=>({open:Boolean(state.dialog?.open),baseHash:state.baseHash,targetHash:state.targetHash})});
})();
