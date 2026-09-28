(() => {
  'use strict';
  if (window.__KARETA_CLIENT_SURFACE_MODERNIZATION_PHASE3__) return;
  window.__KARETA_CLIENT_SURFACE_MODERNIZATION_PHASE3__={version:'188.5.5.6.84.63'};

  let frame=0;
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;enhanceMore();});};

  function enhanceMore(){
    const root=document.getElementById('k-smart-action-hub');
    const win=root?.querySelector('.k-more-window');
    const main=win?.querySelector('.k-more-window-main');
    if(!root||!win||!main)return false;
    win.setAttribute('role','dialog');
    win.setAttribute('aria-modal','true');
    main.querySelector('.k-more-window-head')?.remove();
    return true;
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-more-close]'))return;
    event.preventDefault();
    window.KaretaSmartActionHub?.close?.();
  });

  const observer=new MutationObserver(schedule);
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});schedule();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  ['kareta:navigation-changed','kareta:route-rendered','kareta:identity-ready'].forEach(name=>window.addEventListener(name,schedule));
})();
