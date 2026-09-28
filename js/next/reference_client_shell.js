(() => {
  'use strict';

  function ensureClientNotificationControl(){
    const actions=document.querySelector('#k-shell-header > .k-shell-actions');
    if(!actions||document.getElementById('k-header-notifications'))return;
    const link=document.createElement('a');
    link.id='k-header-notifications';
    link.className='k-header-notifications';
    link.href='#/notifications';
    link.setAttribute('aria-label','Уведомления');
    link.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8Z"></path><path d="M10 20a2 2 0 0 0 4 0"></path></svg>';
    actions.insertBefore(link,actions.firstChild);
  }

  function ensureClientLocationIcon(){
    const header=document.querySelector('#k-shell-header');
    const actions=header?.querySelector(':scope > .k-shell-actions');
    if(!header||!actions)return;
    let button=header.querySelector('[data-shell-location-icon]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='k-shell-location-icon';
      button.setAttribute('data-shell-location-icon','');
      button.setAttribute('aria-label','Город: Усть-Каменогорск');
      button.title='Усть-Каменогорск';
      button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"></path><circle cx="12" cy="10" r="2.2"></circle></svg><span class="k-shell-location-label" data-shell-city>Усть-Каменогорск</span>';
    }
    if(button.parentElement!==actions)actions.insertBefore(button,actions.firstChild);
    if(button.dataset.bound==='1')return;
    button.dataset.bound='1';
    button.addEventListener('click',()=>{
      const open=()=>document.querySelector('[data-home-location-button]')?.click();
      if(String(location.hash||'').startsWith('#/home'))open();
      else{location.hash='#/home';window.setTimeout(open,180);}
    });
  }

  function ensureFrozenClientHeaderAddons(){
    ensureClientNotificationControl();
    ensureClientLocationIcon();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureFrozenClientHeaderAddons,{once:true});
  else ensureFrozenClientHeaderAddons();
  window.addEventListener('kareta:interface-context-changed',ensureFrozenClientHeaderAddons);
})();
