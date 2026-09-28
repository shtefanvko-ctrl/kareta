(() => {
  'use strict';

  const MAX_WIDTH = 900;
  const ROOT_ID = 'k-mobile-filter-stack';
  const MODAL_ID = 'k-mobile-filter-modal';
  const SEARCH_CARD_ID = 'k-mobile-filter-search-card';
  const QUICK_ACTIONS_ID = 'k-mobile-quick-actions';
  let syncFrame = 0;
  let observer = null;
  let signature = '';
  let currentBar = null;
  let activeTrigger = null;

  const definitions = Object.freeze([
    { kind:'search', label:'Поиск', source:'.k-masters-search input[type="search"]', input:true },
    { kind:'city', label:'Город', source:'.k-masters-geo select', select:true },
    { kind:'filter', label:'Фильтры', source:'.k-catalog-filter-panel, .k-masters-filter-panel', panel:true },
    { kind:'sort', label:'Сортировка', source:'.k-shop-sort select', select:true }
  ]);

  function mobile(){ return window.matchMedia(`(max-width:${MAX_WIDTH}px)`).matches; }
  function onboarding(){ return document.body.classList.contains('onboarding-active') || document.body.classList.contains('is-onboarding'); }
  function homeRoute(){ const route=String(location.hash||'#/home').split('?')[0].replace(/^#\/?/,'').replace(/\/+$/,''); return route==='' || route==='home'; }
  function connected(node){ return !!(node && node.isConnected); }
  function log(event,data={}){ try{ window.KaretaRuntimeLog?.event?.(`mobileFilters.${event}`,data); }catch(_){} }

  function icon(name){
    const icons={
      search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>',
      city:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="3"></circle><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"></path></svg>',
      filter:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>',
      sort:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"></path></svg>',
      tow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h13l3 3v2H5a2 2 0 0 1-2-2v-3Z"></path><path d="M6 15V8h8l3 7M8 20a2 2 0 1 0 0 .01M17 20a2 2 0 1 0 0 .01M14 8V5h4l3 3-3 3h-4"></path></svg>',
      lawyer:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 7h14M7 7l-3 6h6L7 7Zm10 0-3 6h6l-3-6ZM8 21h8"></path></svg>',
      services:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3-3a4 4 0 0 1-5.2 5.2L5 16l3 3 7.5-7.5a4 4 0 0 1 5.2-5.2l-3 3-3-3Z"></path><path d="m4 4 4 4"></path></svg>'
    };
    return icons[name]||'';
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(!root){
      root=document.createElement('aside'); root.id=ROOT_ID; root.className='k-mobile-filter-stack';
      root.setAttribute('aria-label','Поиск и фильтры страницы'); root.hidden=true; document.body.appendChild(root);
    }
    return root;
  }

  function ensureQuickActions(){
    let actions=document.getElementById(QUICK_ACTIONS_ID);
    if(actions) return actions;
    actions=document.createElement('nav');
    actions.id=QUICK_ACTIONS_ID;
    actions.className='k-mobile-quick-actions';
    actions.setAttribute('aria-label','Быстрые действия');
    const items=[
      {kind:'tow',label:'Эвакуатор',href:'#/tow-truck'},
      {kind:'lawyer',label:'Автоюрист',href:'#/lawyer'},
      {kind:'services',label:'Услуги',href:'#/services'}
    ];
    actions.innerHTML=items.map(item=>`<a class="k-mobile-quick-action k-mobile-quick-action--${item.kind}" href="${item.href}" data-route-link="${item.href.slice(2)}" aria-label="${item.label}" title="${item.label}"><span aria-hidden="true">${icon(item.kind)}</span><span class="k-mobile-filter-label">${item.label}</span></a>`).join('');
    document.body.appendChild(actions);
    return actions;
  }

  function positionQuickActions(root,actions){
    if(!actions) return;
    const stackVisible=root && !root.hidden && root.childElementCount>0;
    const stackHeight=stackVisible ? Math.ceil(root.getBoundingClientRect().height) : 0;
    const gap=stackVisible ? 12 : 0;
    actions.style.setProperty('--k-mobile-filter-stack-height',`${stackHeight}px`);
    actions.style.setProperty('--k-mobile-filter-stack-gap',`${gap}px`);
  }

  function ensureSearchCard(){
    let card=document.getElementById(SEARCH_CARD_ID);
    if(card) return card;
    card=document.createElement('section');
    card.id=SEARCH_CARD_ID;
    card.className='k-mobile-filter-search-card';
    card.hidden=true;
    card.setAttribute('aria-label','Поиск по странице');
    document.body.appendChild(card);
    return card;
  }

  function closeSearchCard(){
    const card=document.getElementById(SEARCH_CARD_ID);
    if(!card) return;
    card.hidden=true;
    card.replaceChildren();
    document.body.classList.remove('k-mobile-filter-search-open');
    document.querySelector('.k-mobile-filter-button--search')?.setAttribute('aria-expanded','false');
  }

  function ensureModal(){
    let modal=document.getElementById(MODAL_ID);
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id=MODAL_ID;
    modal.className='k-mobile-filter-modal';
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="k-mobile-filter-modal__backdrop" data-mobile-filter-dismiss></div><section class="k-mobile-filter-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="k-mobile-filter-title"><div class="k-mobile-filter-modal__grabber" aria-hidden="true"></div><header><h2 id="k-mobile-filter-title" data-mobile-filter-title>Фильтры</h2></header><div class="k-mobile-filter-modal__body" data-mobile-filter-body></div><footer data-mobile-filter-footer></footer></section>';
    modal.addEventListener('click',event=>{ if(event.target.closest('[data-mobile-filter-dismiss]')) closeModal(); });
    let dragStartY=0; let dragging=false;
    const sheet=modal.querySelector('.k-mobile-filter-modal__sheet');
    sheet.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse' && event.button!==0) return;
      if(event.target.closest('.k-mobile-filter-modal__body')) return;
      dragStartY=event.clientY; dragging=true; sheet.setPointerCapture?.(event.pointerId);
    });
    sheet.addEventListener('pointermove',event=>{
      if(!dragging) return; const delta=Math.max(0,event.clientY-dragStartY);
      sheet.style.transform=`translateY(${Math.min(delta,180)}px)`;
    });
    const finishDrag=event=>{
      if(!dragging) return; dragging=false; const delta=Math.max(0,event.clientY-dragStartY);
      sheet.style.transform=''; if(delta>72) closeModal();
    };
    sheet.addEventListener('pointerup',finishDrag); sheet.addEventListener('pointercancel',finishDrag);
    document.body.appendChild(modal); return modal;
  }

  function toolbar(){
    const candidates=[...document.querySelectorAll('.k-masters-toolbar, .k-catalog-toolbar, .k-orders-toolbar-v2, .k-exchange-toolbar')];
    return candidates.find(node=>node.isConnected && node.closest('.k-page-outlet'))||null;
  }

  function sourceFor(bar,def){ return bar?.querySelector(def.source)||null; }
  function controlsFor(bar){ return definitions.map(def=>[def,sourceFor(bar,def)]).filter(([,node])=>connected(node)); }

  function closeModal(){
    const modal=document.getElementById(MODAL_ID); if(!modal) return;
    modal.classList.remove('is-open','is-closing');
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.inert=true;
    const sheet=modal.querySelector('.k-mobile-filter-modal__sheet');
    if(sheet) sheet.style.transform='';
    document.body.classList.remove('k-mobile-filter-modal-open');
    if(activeTrigger){ activeTrigger.setAttribute('aria-expanded','false'); activeTrigger=null; }
  }

  function dispatchValue(source,value){
    source.value=value;
    source.dispatchEvent(new Event('input',{bubbles:true}));
    source.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function submitSearch(bar,input){
    const button=bar.querySelector('[data-services-submit], [data-shop-submit], [data-orders-submit], [data-masters-submit], .k-masters-search-button');
    if(button){ button.click(); return; }
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function openSearchCard(bar,source){
    const card=ensureSearchCard();
    const wasOpen=!card.hidden;
    closeModal();
    if(wasOpen){ closeSearchCard(); return; }

    const field=document.createElement('label');
    field.className='k-mobile-filter-search-card__field';
    field.innerHTML=`<span class="k-mobile-filter-search-card__icon" aria-hidden="true">${icon('search')}</span><input type="search" autocomplete="off"><button type="button" class="k-mobile-filter-search-card__clear" aria-label="Очистить поиск">×</button>`;
    const input=field.querySelector('input');
    const clear=field.querySelector('button');
    input.placeholder=source.placeholder||'Поиск';
    input.value=source.value||'';

    const apply=()=>{ dispatchValue(source,input.value); submitSearch(bar,source); sync(); };
    input.addEventListener('input',()=>{
      dispatchValue(source,input.value);
      clear.hidden=!input.value;
    });
    input.addEventListener('search',apply);
    input.addEventListener('keydown',event=>{ if(event.key==='Enter'){ event.preventDefault(); apply(); } if(event.key==='Escape'){ closeSearchCard(); } });
    clear.addEventListener('click',()=>{ input.value=''; clear.hidden=true; dispatchValue(source,''); submitSearch(bar,source); input.focus(); });
    clear.hidden=!input.value;

    card.replaceChildren(field);
    card.hidden=false;
    document.querySelector('.k-mobile-filter-button--search')?.setAttribute('aria-expanded','true');
    document.body.classList.add('k-mobile-filter-search-open');
    requestAnimationFrame(()=>input.focus({preventScroll:true}));
    log('searchCardOpen',{route:location.hash||'#/home'});
  }

  function openSelect(dialog,source){
    const body=dialog.querySelector('[data-mobile-filter-body]'); const footer=dialog.querySelector('[data-mobile-filter-footer]');
    const list=document.createElement('div'); list.className='k-mobile-filter-options';
    [...source.options].forEach(option=>{
      const button=document.createElement('button'); button.type='button'; button.className='k-mobile-filter-option';
      if(String(option.value)===String(source.value)) button.classList.add('is-active');
      button.innerHTML=`<span>${option.textContent}</span><b aria-hidden="true">✓</b>`;
      button.addEventListener('click',()=>{ dispatchValue(source,option.value); closeModal(); sync(); }); list.appendChild(button);
    });
    body.replaceChildren(list); footer.replaceChildren();
  }

  function preparePanel(bar,panel){
    if(panel.children.length) return;
    const trigger=bar.querySelector('[data-services-filter-toggle], [data-shop-filter-toggle], [data-order-filter-toggle], [data-master-filter-toggle], [data-work-filter-toggle], [data-news-filter-toggle], .k-masters-filter-button');
    trigger?.click(); trigger?.click();
  }

  function openPanel(dialog,bar,panel){
    preparePanel(bar,panel);
    const body=dialog.querySelector('[data-mobile-filter-body]'); const footer=dialog.querySelector('[data-mobile-filter-footer]');
    const list=document.createElement('div'); list.className='k-mobile-filter-options';
    const items=[...panel.querySelectorAll('button,[role="button"]')];
    items.forEach(sourceButton=>{
      const button=document.createElement('button'); button.type='button'; button.className='k-mobile-filter-option';
      if(sourceButton.classList.contains('is-active') || sourceButton.getAttribute('aria-pressed')==='true') button.classList.add('is-active');
      button.innerHTML=`<span>${sourceButton.textContent.trim()}</span><b aria-hidden="true">✓</b>`;
      button.addEventListener('click',()=>{ sourceButton.click(); closeModal(); sync(); }); list.appendChild(button);
    });
    if(!items.length){ const empty=document.createElement('p'); empty.className='k-mobile-filter-empty'; empty.textContent='Для этой страницы дополнительные фильтры не предусмотрены.'; list.appendChild(empty); }
    body.replaceChildren(list); footer.replaceChildren();
  }

  function openModal(kind,bar,source){
    if(!connected(bar)||!connected(source)){ sync(); return; }
    const def=definitions.find(item=>item.kind===kind); if(!def) return;
    const modal=ensureModal(); modal.querySelector('[data-mobile-filter-title]').textContent=def.label;
    modal.dataset.kind=kind;
    if(def.select) openSelect(modal,source);
    else if(def.panel) openPanel(modal,bar,source);
    modal.hidden=false;
    modal.removeAttribute('aria-hidden');
    modal.inert=false;
    document.body.classList.add('k-mobile-filter-modal-open');
    activeTrigger=document.querySelector(`.k-mobile-filter-button--${kind}`);
    activeTrigger?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    log('modalOpen',{kind,route:location.hash||'#/home'});
  }

  function makeButton(def,bar,source){
    const button=document.createElement('button'); button.type='button';
    button.className=`k-mobile-filter-button k-mobile-filter-button--${def.kind}`; button.dataset.mobileFilterKind=def.kind;
    button.setAttribute('aria-label',def.label); button.setAttribute('title',def.label); button.setAttribute('aria-expanded','false');
    button.innerHTML=`<span class="k-mobile-filter-icon" aria-hidden="true">${icon(def.kind)}</span><span class="k-mobile-filter-label">${def.label}</span>`;
    button.addEventListener('click',()=>{ if(def.kind==='search') openSearchCard(bar,source); else { closeSearchCard(); openModal(def.kind,bar,source); } }); return button;
  }

  function currentSignatureFor(bar,controls){ return [location.hash,bar?.className||'',...controls.map(([def,node])=>`${def.kind}:${node?.name||node?.className||''}:${node?.childElementCount||0}`)].join('|'); }

  function syncNow(){
    const root=ensureRoot(); const quickActions=ensureQuickActions(); ensureModal(); ensureSearchCard();
    if(!mobile()||onboarding()){
      root.hidden=true; root.replaceChildren(); quickActions.hidden=true; signature=''; currentBar=null;
      document.body.classList.remove('k-mobile-filters-active'); closeModal(); closeSearchCard(); return;
    }
    const bar=toolbar(); const controls=bar?controlsFor(bar):[];
    if(!bar||!controls.length){
      root.hidden=true; root.replaceChildren(); signature=''; currentBar=null;
      document.body.classList.remove('k-mobile-filters-active'); closeModal(); closeSearchCard();
      quickActions.hidden=!homeRoute();
      if(!quickActions.hidden) requestAnimationFrame(()=>positionQuickActions(root,quickActions));
      return;
    }
    currentBar=bar; document.body.classList.add('k-mobile-filters-active');
    const next=currentSignatureFor(bar,controls);
    if(next!==signature || root.childElementCount!==controls.length){
      signature=next; root.replaceChildren(...controls.map(([def,node])=>makeButton(def,bar,node)));
      log('render',{controls:controls.map(([def])=>def.kind),route:location.hash||'#/home'});
    }
    root.hidden=false;
    quickActions.hidden=!homeRoute();
    if(!quickActions.hidden) requestAnimationFrame(()=>positionQuickActions(root,quickActions));
  }

  function sync(){
    if(syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame=requestAnimationFrame(()=>{ syncFrame=0; try{syncNow();}catch(error){log('error',{message:error?.message||String(error)});} });
  }

  function boot(){
    ensureRoot(); ensureQuickActions(); ensureModal(); ensureSearchCard();
    window.addEventListener('resize',sync,{passive:true}); window.addEventListener('hashchange',sync); window.addEventListener('pageshow',sync); window.addEventListener('kareta:routechange',sync);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
    document.addEventListener('keydown',event=>{ if(event.key==='Escape') closeModal(); });
    document.addEventListener('pointerdown',event=>{
      const card=document.getElementById(SEARCH_CARD_ID);
      if(!card || card.hidden) return;
      if(card.contains(event.target) || event.target.closest?.('.k-mobile-filter-button--search')) return;
      closeSearchCard();
    });
    observer=new MutationObserver(sync); observer.observe(document.querySelector('.k-page-outlet')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','aria-expanded','value']});
    sync();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.KaretaMobileFilters=Object.freeze({sync,open:kind=>{const def=definitions.find(item=>item.kind===kind);const source=def&&sourceFor(currentBar,def);if(def&&source){if(kind==='search')openSearchCard(currentBar,source);else openModal(kind,currentBar,source);}}});
})();
