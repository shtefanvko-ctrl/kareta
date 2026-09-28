(() => {
  'use strict';

  const RELEASE = 'r1885590-full-page-session-state';
  const SCROLL_KEY = 'kareta.navigation.v3';
  const PAGE_KEY = 'kareta.page-state.v3';
  const LEGACY_SCROLL_KEY = 'kareta.navigation.v2';
  const LEGACY_PAGE_KEY = 'kareta.page-state.v2';
  const MAX_AGE = 12 * 60 * 60 * 1000;
  const MAX_ROUTES = 40;
  const MAX_CONTROLS = 160;
  const MAX_TEXT = 12000;
  const ASYNC_RESTORE_WINDOW_MS = 12000;
  const DOCUMENT_ID = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  const positions = new Map();
  const pages = new Map();
  const modalRestorers = new Map();
  const pendingAsync = new Map();
  let restoreToken = 0;
  let saveTimer = 0;
  let observer = null;

  const cssEscape = value => (window.CSS && typeof window.CSS.escape === 'function')
    ? window.CSS.escape(String(value))
    : String(value).replace(/(["'\\.#:[\]()= ])/g, '\\$1');

  function readStore(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_error) {
      return {};
    }
  }

  const scrollStore = { ...readStore(LEGACY_SCROLL_KEY), ...readStore(SCROLL_KEY) };
  const pageStore = { ...readStore(LEGACY_PAGE_KEY), ...readStore(PAGE_KEY) };
  Object.entries(scrollStore).forEach(([key, value]) => positions.set(key, Math.max(0, Number(value) || 0)));
  Object.entries(pageStore).forEach(([key, value]) => {
    if (value && typeof value === 'object' && Date.now() - Number(value.at || 0) <= MAX_AGE) pages.set(key, value);
  });

  function current(hash = location.hash) {
    return String(hash || '#/home');
  }

  function trimMaps() {
    const ordered = [...pages.entries()].sort((a,b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0));
    ordered.slice(MAX_ROUTES).forEach(([key]) => { pages.delete(key); positions.delete(key); });
    for (const [key, row] of pages.entries()) {
      if (Date.now() - Number(row?.at || 0) > MAX_AGE) { pages.delete(key); positions.delete(key); }
    }
  }

  function persist() {
    trimMaps();
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(Object.fromEntries(positions)));
      sessionStorage.setItem(PAGE_KEY, JSON.stringify(Object.fromEntries(pages)));
      sessionStorage.removeItem(LEGACY_SCROLL_KEY);
      sessionStorage.removeItem(LEGACY_PAGE_KEY);
    } catch (_error) {}
  }

  function scheduleCapture(delay = 260) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => capture(), delay);
  }

  function formDescriptor(node) {
    const form=node?.closest?.('form'); if(!form)return null;
    const attrs=['data-lifecycle-form','data-aftercare-form','data-lifecycle-modal','data-work-form','data-work-review-form','data-exchange-form','data-chat-form','data-request-form'];
    for(const name of attrs){const value=form.getAttribute(name);if(value!==null){return {key:`${name}:${value||'1'}`,selector:`form[${name}${value?`="${cssEscape(value)}"`:''}]`};}}
    if(form.id)return {key:`form-id:${form.id}`,selector:`#${cssEscape(form.id)}`};
    return null;
  }

  function controlKey(node, index) {
    const explicit = node.getAttribute('data-state-key') || node.id;
    if (explicit) return String(explicit);
    const form=formDescriptor(node),name=String(node.name||'');
    if(form&&name)return `${form.key}:${name}`;
    if(name)return name;
    return `${node.tagName.toLowerCase()}:${node.type || ''}:${index}`;
  }

  function controlSelector(node) {
    const own=selectorFor(node);if(own)return own;
    const form=formDescriptor(node),name=String(node.name||'');
    if(form&&name)return `${form.selector} [name="${cssEscape(name)}"]`;
    if(name)return `[name="${cssEscape(name)}"]`;
    return '';
  }

  function selectorFor(node) {
    if (!node || node.nodeType !== 1) return '';
    if (node.id) return `#${cssEscape(node.id)}`;
    const attributes = [
      'data-state-key', 'data-state-panel', 'data-state-scroll', 'data-garage-section',
      'data-vehicle-tab', 'data-filter', 'data-category', 'data-master-tab',
      'data-provider-tab', 'data-work-filter', 'data-news-category', 'data-exchange-tab',
      'data-workflow-tab', 'data-order-tab', 'data-tab', 'data-route-key', 'data-action',
      'data-next-action', 'data-lifecycle-stage'
    ];
    for (const name of attributes) {
      const value = node.getAttribute(name);
      if (value !== null && value !== '') return `[${name}="${cssEscape(value)}"]`;
    }
    return '';
  }

  function isSensitive(node) {
    if (!node || node.nodeType !== 1) return true;
    if (node.matches('[data-no-persist], [type="password"], [type="file"]')) return true;
    const autocomplete = String(node.getAttribute('autocomplete') || '').toLowerCase();
    if (/(one-time-code|current-password|new-password|cc-number|cc-csc|cc-exp|cc-exp-month|cc-exp-year)/.test(autocomplete)) return true;
    const identity = `${node.name || ''} ${node.id || ''} ${node.getAttribute('data-state-key') || ''}`.toLowerCase();
    return /(password|passwd|passcode|otp|one.?time|secret|token|cvv|cvc|card.?number|cardnumber|\bpin\b)/i.test(identity);
  }

  function valueRecord(node, index) {
    if (isSensitive(node)) return null;
    const record = { key:controlKey(node, index), tag:node.tagName.toLowerCase(), type:String(node.type || '') };
    const selector = controlSelector(node); if (selector) record.selector = selector;
    if (node.isContentEditable) record.value = String(node.textContent || '').slice(0, MAX_TEXT);
    else if (node.type === 'checkbox' || node.type === 'radio') record.checked = !!node.checked;
    else record.value = String(node.value ?? '').slice(0, MAX_TEXT);
    return record;
  }

  function captureControls(scope) {
    if (!scope) return [];
    const selector = 'input, textarea, select, [contenteditable="true"][data-state-key]';
    return [...scope.querySelectorAll(selector)].slice(0, MAX_CONTROLS).map(valueRecord).filter(Boolean);
  }

  function captureDetails(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll('details')].slice(0,80).map((node,index) => ({ selector:selectorFor(node), index, open:!!node.open }));
  }

  function captureExpanded(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll('[aria-expanded]')].slice(0,100).map((node,index) => ({
      selector:selectorFor(node), index, expanded:node.getAttribute('aria-expanded') === 'true', controls:String(node.getAttribute('aria-controls') || '')
    }));
  }

  function captureScrollContainers(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll('[data-state-scroll]')].slice(0,50).map((node,index) => ({
      selector:selectorFor(node), index, left:Math.max(0,Number(node.scrollLeft||0)), top:Math.max(0,Number(node.scrollTop||0))
    }));
  }

  function modalOpen(node) {
    if (!node || node.hidden) return false;
    if (node.tagName === 'DIALOG') return !!node.open;
    if (node.classList.contains('open')) return true;
    return node.getAttribute('aria-hidden') !== 'true' && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  }

  function captureSafeModal() {
    const rows = [...document.querySelectorAll('[data-state-modal="safe"]')].filter(modalOpen);
    const node = rows.at(-1); if (!node) return null;
    const key = String(node.getAttribute('data-state-modal-key') || node.id || '').trim();
    if (!key) return null;
    return {
      key,
      selector:selectorFor(node) || `[data-state-modal-key="${cssEscape(key)}"]`,
      context:String(node.getAttribute('data-state-modal-context') || '').slice(0,4000),
      controls:captureControls(node),
      scrollTop:Math.max(0,Number(node.scrollTop||node.querySelector('[data-state-modal-scroll]')?.scrollTop||0)),
    };
  }

  function capture(hash = current()) {
    const route = String(hash);
    const outlet = document.getElementById('k-page-outlet');
    positions.set(route, Math.max(0, window.scrollY || 0));
    if (!outlet) { persist(); return null; }

    const activeSelectors = [];
    outlet.querySelectorAll('[aria-selected="true"], [aria-pressed="true"], .is-active, .active').forEach(node => {
      const selector = selectorFor(node);
      if (selector && !activeSelectors.includes(selector)) activeSelectors.push(selector);
    });

    const focused = outlet.contains(document.activeElement) ? selectorFor(document.activeElement) : '';
    const snapshot = {
      version:3,
      release:RELEASE,
      at:Date.now(),
      documentId:DOCUMENT_ID,
      route,
      routeKey:String(outlet.getAttribute('data-current-route') || ''),
      controls:captureControls(outlet),
      activeSelectors:activeSelectors.slice(0,24),
      details:captureDetails(outlet),
      expanded:captureExpanded(outlet),
      scrollContainers:captureScrollContainers(outlet),
      safeModal:captureSafeModal(),
      focused,
      scrollY:Math.max(0, window.scrollY || 0),
    };
    pages.set(route, snapshot);
    persist();
    return snapshot;
  }

  function save(hash = current()) { return capture(String(hash)); }

  function findControl(scope, record, index) {
    if (!scope) return null;
    if (record.selector) { try { const bySelector = scope.querySelector(record.selector); if (bySelector) return bySelector; } catch (_error) {} }
    if (record.key) {
      try { const byState = scope.querySelector(`[data-state-key="${cssEscape(record.key)}"]`); if (byState) return byState; } catch (_error) {}
      const byId = document.getElementById(record.key); if (byId && scope.contains(byId)) return byId;
      try { const byName = scope.querySelector(`[name="${cssEscape(record.key)}"]`); if (byName) return byName; } catch (_error) {}
    }
    return scope.querySelectorAll('input, textarea, select, [contenteditable="true"][data-state-key]')[index] || null;
  }

  function applyControl(node, record, options = {}) {
    if (!node || isSensitive(node)) return false;
    if (node.isContentEditable) node.textContent = String(record.value ?? '');
    else if (record.type === 'checkbox' || record.type === 'radio') node.checked = !!record.checked;
    else if (Object.prototype.hasOwnProperty.call(record, 'value')) node.value = String(record.value ?? '');
    if (options.dispatchEvents === false) return true;
    try { node.dispatchEvent(new Event('input', { bubbles:true })); } catch (_error) {}
    try { node.dispatchEvent(new Event('change', { bubbles:true })); } catch (_error) {}
    return true;
  }

  function restoreDetails(outlet, rows=[]) {
    let applied=0; const all=outlet?.querySelectorAll('details') || [];
    rows.forEach(row => { let node=null; if(row.selector){try{node=outlet.querySelector(row.selector)}catch(_error){}} if(!node)node=all[row.index]||null; if(node){node.open=!!row.open;applied++;} });
    return applied;
  }

  function restoreExpanded(outlet, rows=[]) {
    let applied=0; const all=outlet?.querySelectorAll('[aria-expanded]') || [];
    rows.forEach(row => { let node=null; if(row.selector){try{node=outlet.querySelector(row.selector)}catch(_error){}} if(!node)node=all[row.index]||null; if(!node)return; node.setAttribute('aria-expanded',row.expanded?'true':'false'); if(row.controls){const panel=document.getElementById(row.controls);if(panel){panel.hidden=!row.expanded;panel.classList.toggle('is-open',!!row.expanded);}} applied++; });
    return applied;
  }

  function restoreScrollContainers(outlet, rows=[]) {
    let applied=0; const all=outlet?.querySelectorAll('[data-state-scroll]') || [];
    rows.forEach(row=>{let node=null;if(row.selector){try{node=outlet.querySelector(row.selector)}catch(_error){}}if(!node)node=all[row.index]||null;if(node){node.scrollLeft=Math.max(0,Number(row.left||0));node.scrollTop=Math.max(0,Number(row.top||0));applied++;}});
    return applied;
  }

  function modalNode(snapshot) {
    if (!snapshot) return null;
    let node=null; if(snapshot.selector){try{node=document.querySelector(snapshot.selector)}catch(_error){}}
    if(!node&&snapshot.key){try{node=document.querySelector(`[data-state-modal-key="${cssEscape(snapshot.key)}"]`)}catch(_error){}}
    return node;
  }

  function applyModalSnapshot(node, snapshot, options={}) {
    if(!node||!snapshot)return 0;
    let applied=0;(snapshot.controls||[]).forEach((record,index)=>{if(applyControl(findControl(node,record,index),record,{...options,dispatchEvents:false}))applied++;});
    if(node.tagName==='DIALOG'){if(!node.open){try{node.showModal()}catch(_error){try{node.setAttribute('open','')}catch(_e){}}}}
    else{node.hidden=false;node.classList.add('open');node.setAttribute('aria-hidden','false');}
    const scroller=node.querySelector('[data-state-modal-scroll]')||node;if(snapshot.scrollTop)scroller.scrollTop=Math.max(0,Number(snapshot.scrollTop||0));
    return applied+1;
  }

  function restoreSafeModal(snapshot, options={}) {
    if(!snapshot?.key || options.restoreModal===false)return 0;
    let node=modalNode(snapshot);
    if(!node){const restorer=modalRestorers.get(snapshot.key);if(typeof restorer==='function'){try{node=restorer({...snapshot})||modalNode(snapshot);}catch(_error){node=null;}}}
    return applyModalSnapshot(node,snapshot,options);
  }

  function safeReplay(node) {
    if(!node)return false;
    return node.matches('[data-exchange-tab],[data-workflow-tab],[data-order-tab],[data-master-tab],[data-provider-tab],[data-vehicle-tab],[data-tab]');
  }

  function restoreNow(route, snapshot, options={}) {
    const outlet=document.getElementById('k-page-outlet');
    let applied=0;
    if(snapshot && Date.now()-Number(snapshot.at||0)<=MAX_AGE && outlet){
      (snapshot.controls||[]).forEach((record,index)=>{if(applyControl(findControl(outlet,record,index),record,options))applied++;});
      applied+=restoreDetails(outlet,snapshot.details||[]);
      applied+=restoreExpanded(outlet,snapshot.expanded||[]);
      applied+=restoreScrollContainers(outlet,snapshot.scrollContainers||[]);
      if(options.replayActive!==false){
        (snapshot.activeSelectors||[]).forEach(selector=>{let node=null;try{node=outlet.querySelector(selector)}catch(_error){}if(!node)return;if(safeReplay(node)&&!node.matches('[aria-selected="true"],[aria-pressed="true"],.is-active,.active')){try{node.click();applied++;}catch(_error){}}});
      }
      applied+=restoreSafeModal(snapshot.safeModal,options);
      if(options.restoreFocus===true && snapshot.focused){try{outlet.querySelector(snapshot.focused)?.focus({preventScroll:true});}catch(_error){}}
    }
    const fallbackY=positions.get(route);
    const y=snapshot&&Number.isFinite(Number(snapshot.scrollY))?Number(snapshot.scrollY):(Number.isFinite(fallbackY)?fallbackY:0);
    window.scrollTo({top:Math.max(0,y),left:0,behavior:'auto'});
    return applied;
  }


  function expectedRestoreUnits(snapshot){
    if(!snapshot)return 0;
    return (snapshot.controls||[]).length+(snapshot.details||[]).length+(snapshot.expanded||[]).length+(snapshot.scrollContainers||[]).length+(snapshot.safeModal?((snapshot.safeModal.controls||[]).length+1):0);
  }
  function restoreSatisfied(snapshot,applied){
    const expected=expectedRestoreUnits(snapshot);
    if(expected===0)return true;
    const required=Math.min(expected,Math.max(1,Math.ceil(expected*.6)));
    return Number(applied||0)>=required;
  }

  function markRestored(route,snapshot){if(!snapshot)return;snapshot.documentId=DOCUMENT_ID;snapshot.restoredAt=Date.now();pages.set(route,snapshot);pendingAsync.delete(route);persist();}

  function scheduleAsyncRestore(route,snapshot,options={}){
    if(!snapshot||snapshot.documentId===DOCUMENT_ID)return;
    pendingAsync.set(route,{snapshot,options:{...options,dispatchEvents:false,replayActive:true},deadline:Date.now()+ASYNC_RESTORE_WINDOW_MS});
    ensureObserver();
    setTimeout(()=>{const row=pendingAsync.get(route);if(row&&Date.now()>=row.deadline){pendingAsync.delete(route);markRestored(route,row.snapshot);}},ASYNC_RESTORE_WINDOW_MS+50);
  }

  function tryPendingRestore(){
    const route=current();const row=pendingAsync.get(route);if(!row)return;
    if(Date.now()>row.deadline){pendingAsync.delete(route);markRestored(route,row.snapshot);return;}
    const applied=restoreNow(route,row.snapshot,row.options);
    if(restoreSatisfied(row.snapshot,applied))markRestored(route,row.snapshot);
  }

  function ensureObserver(){
    if(observer||typeof MutationObserver!=='function')return;
    observer=new MutationObserver(()=>{if(pendingAsync.size)requestAnimationFrame(tryPendingRestore)});
    const root=document.getElementById('k-page-outlet')||document.body;
    if(root)observer.observe(root,{subtree:true,childList:true});
  }

  function restore(hash=current(),options={}){
    const route=String(hash);const snapshot=pages.get(route);const token=++restoreToken;
    if(snapshot&&snapshot.documentId!==DOCUMENT_ID)scheduleAsyncRestore(route,snapshot,options);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==restoreToken)return;
      const applied=restoreNow(route,snapshot,options);
      if(snapshot&&snapshot.documentId!==DOCUMENT_ID&&restoreSatisfied(snapshot,applied))markRestored(route,snapshot);
    }));
  }

  function restoreAfterAsync(hash=current(),options={}){
    const route=String(hash),snapshot=pages.get(route);if(!snapshot)return false;
    const applied=restoreNow(route,snapshot,{...options,dispatchEvents:false});
    if(snapshot.documentId!==DOCUMENT_ID&&restoreSatisfied(snapshot,applied))markRestored(route,snapshot);
    return applied>0;
  }

  function registerModalRestorer(key,restorer){if(!key||typeof restorer!=='function')return()=>{};modalRestorers.set(String(key),restorer);return()=>{if(modalRestorers.get(String(key))===restorer)modalRestorers.delete(String(key));};}

  function back(fallback='#/home'){save();if(history.length>1){history.back();return;}location.hash=fallback;}
  function clear(hash=current()){const route=String(hash);positions.delete(route);pages.delete(route);pendingAsync.delete(route);persist();}

  document.addEventListener('click',event=>{const node=event.target.closest('[data-smart-back]');if(!node)return;event.preventDefault();back(node.getAttribute('data-fallback')||'#/home');});
  document.addEventListener('input',event=>{if(event.target.closest('#k-page-outlet,[data-state-modal="safe"]'))scheduleCapture(320);},{passive:true});
  document.addEventListener('change',event=>{if(event.target.closest('#k-page-outlet,[data-state-modal="safe"]'))scheduleCapture(120);},{passive:true});
  document.addEventListener('toggle',event=>{if(event.target.closest?.('#k-page-outlet'))scheduleCapture(80);},true);
  document.addEventListener('click',event=>{if(event.target.closest('[aria-expanded],[data-exchange-tab],[data-workflow-tab],[data-order-tab],[data-master-tab],[data-provider-tab],[data-vehicle-tab],[data-tab],[data-state-modal="safe"]'))scheduleCapture(120);},true);
  window.addEventListener('pagehide',()=>save());
  window.addEventListener('beforeunload',()=>save());
  window.addEventListener('pageshow',event=>{if(event.persisted)restore(current(),{replayActive:false,dispatchEvents:false,restoreModal:true});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();else restore(current(),{replayActive:false,dispatchEvents:false,restoreModal:true});});
  window.addEventListener('kareta:routechange',()=>ensureObserver());

  ensureObserver();

  window.KaretaNavigationState=Object.freeze({
    save,capture,restore,restoreAfterAsync,registerModalRestorer,back,clear,
    get:(hash=current())=>pages.get(String(hash))||null,
    getControl:(key,hash=current())=>{const row=pages.get(String(hash));return (row?.controls||[]).find(x=>x.key===key||x.selector===key)||null;},
    documentId:()=>DOCUMENT_ID,
    release:RELEASE,
  });
})();
