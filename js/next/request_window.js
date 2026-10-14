(() => {
  'use strict';
  if(window.__KARETA_REQUEST_WINDOW__)return;
  window.__KARETA_REQUEST_WINDOW__={version:'R188.5.5.6.84.76',lazyRuntime:'R188.5.5.6.84.76'};

  const state={dialog:null,body:null,title:null,baseHash:'',targetHash:'#/orders/new',trigger:null,controller:null,loadController:null,loadToken:0,cleanups:[]};
  const currentRoute=()=>document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')||'';
  const matches=hash=>/^#\/orders\/new(?:\?.*)?$/.test(String(hash||'').trim());
  const setHashSilently=hash=>{try{history.replaceState(history.state,'',hash);}catch(_e){}};

  function cleanup(){
    try{state.loadController?.abort?.('request-window-close');}catch(_e){}
    try{state.controller?.abort?.('request-window-close');}catch(_e){}
    state.loadController=null;state.controller=null;
    state.cleanups.splice(0).reverse().forEach(fn=>{try{fn?.();}catch(error){console.warn('[KARETA request cleanup]',error);}});
  }
  function lifecycle(){
    const controller=new AbortController();state.controller=controller;
    return {signal:controller.signal,token:Date.now(),source:'request-window',isActive:()=>!controller.signal.aborted&&Boolean(state.dialog?.open),addCleanup(fn){if(typeof fn==='function')state.cleanups.push(fn);return fn;}};
  }
  function ensure(){
    if(state.dialog?.isConnected)return state.dialog;
    const dialog=document.createElement('dialog');dialog.className='k-request-window-r78';dialog.setAttribute('data-kareta-request-window','');
    dialog.innerHTML='<div class="k-request-window-surface"><div class="k-request-window-body" data-request-window-body></div></div>';
    document.body.appendChild(dialog);state.dialog=dialog;state.body=dialog.querySelector('[data-request-window-body]');state.title=null;
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-request-window-close]'))close();});
    return dialog;
  }
  function context(root){return {state:window.KaretaNext?.state||{},api:window.KaretaNext?.api||window.KaretaApiClient,lifecycle:lifecycle(),appVersion:String(window.KARETA_NEXT_ASSET_VERSION||''),route:{path:state.targetHash},root,windowMode:true};}
  function errorHtml(error){
    const message=String(error?.message||error||'Не удалось загрузить модуль заявки').replace(/[<>&]/g,'');
    return `<section class="k-entity-window__error"><h3>Не удалось открыть заявку</h3><p>${message}</p><button class="k-btn k-btn-primary" type="button" data-request-window-retry>Повторить</button><button class="k-btn k-btn-secondary" type="button" data-request-window-close>Закрыть</button></section>`;
  }
  function mountLoaded(token){
    if(token!==state.loadToken||!state.dialog?.open)return false;
    const pages=window.KaretaRequestPages;
    if(!pages?.renderRequestWindow||!pages?.mountRequest)throw new Error('request_pages_unavailable_after_lazy_load');
    state.body.innerHTML=pages.renderRequestWindow({state:window.KaretaNext?.state||{},windowMode:true})||'';
    const ctx=context(state.body),result=pages.mountRequest(ctx);
    if(result&&typeof result.then==='function'){
      result.then(cleanupFn=>{
        if(typeof cleanupFn!=='function')return;
        if(ctx.lifecycle.isActive()&&token===state.loadToken)state.cleanups.push(cleanupFn);
        else cleanupFn();
      }).catch(error=>{if(ctx.lifecycle.isActive())console.error('[KARETA request async mount]',error);});
    }else if(typeof result==='function')state.cleanups.push(result);
    requestAnimationFrame(()=>state.body.querySelector('button,input,[tabindex]')?.focus?.({preventScroll:true}));
    window.dispatchEvent(new CustomEvent('kareta:request-window-open',{detail:{targetHash:state.targetHash,baseHash:state.baseHash,lazy:true}}));
    return true;
  }
  async function loadAndMount(token){
    if(window.KaretaRequestPages?.renderRequestWindow&&window.KaretaRequestPages?.mountRequest)return mountLoaded(token);
    const loader=window.KaretaRouteAssetLoader;if(!loader?.ensureRoute)throw new Error('request_route_loader_unavailable');
    const controller=new AbortController();state.loadController=controller;
    try{await loader.ensureRoute('requestNew',{signal:controller.signal});}
    finally{if(state.loadController===controller)state.loadController=null;}
    return mountLoaded(token);
  }
  function startLoad(token){
    state.body.innerHTML='<section class="k-entity-window__loading"><span></span><h3>Готовим заявку…</h3><p>Загружаем только модуль оформления заявки.</p></section>';
    loadAndMount(token).catch(error=>{
      if(error?.name==='AbortError'||token!==state.loadToken||!state.dialog?.open)return;
      console.error('[KARETA request window lazy]',error);state.body.innerHTML=errorHtml(error);
      try{window.KaretaRuntimeLog?.add?.('request.window.lazy.failed',{message:String(error?.message||error)},'error');}catch(_e){}
    });
  }
  function open(hash='#/orders/new',{trigger=null}={}){
    const target=matches(hash)?String(hash):'#/orders/new';
    const dialog=ensure();if(!dialog.open)state.baseHash=String(location.hash||'#/home');if(trigger)state.trigger=trigger;
    cleanup();state.loadToken+=1;const token=state.loadToken;state.targetHash=target;setHashSilently(target);
    if(!dialog.open)dialog.showModal();document.documentElement.classList.add('k-request-window-open');startLoad(token);return true;
  }
  function close({restore=true}={}){
    if(!state.dialog)return false;const base=state.baseHash;state.loadToken+=1;cleanup();if(state.dialog.open){try{state.dialog.close();}catch(_e){}}document.documentElement.classList.remove('k-request-window-open');state.baseHash='';state.targetHash='#/orders/new';if(restore&&base)setHashSilently(base);const trigger=state.trigger;state.trigger=null;try{trigger?.focus?.({preventScroll:true});}catch(_e){}window.dispatchEvent(new CustomEvent('kareta:request-window-close',{detail:{baseHash:base}}));return true;
  }
  function handleClick(event){
    const retry=event.target.closest?.('[data-request-window-retry]');if(retry&&state.dialog?.open){event.preventDefault();cleanup();state.loadToken+=1;startLoad(state.loadToken);return;}
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest('a[href^="#/orders/new"]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;const target=String(link.getAttribute('href')||'#/orders/new');if(!matches(target))return;if(currentRoute()==='requestNew'&&!state.dialog?.open)return;event.preventDefault();event.stopImmediatePropagation();open(target,{trigger:link});
  }
  document.addEventListener('click',handleClick,true);
  window.addEventListener('hashchange',()=>{if(state.dialog?.open&&!matches(location.hash))close({restore:false});});
  window.KaretaRequestWindow=Object.freeze({open,close,isOpen:()=>Boolean(state.dialog?.open),matches,snapshot:()=>({open:Boolean(state.dialog?.open),baseHash:state.baseHash,targetHash:state.targetHash,lazyPending:Boolean(state.loadController)})});
})();
