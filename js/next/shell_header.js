(() => {
  'use strict';
  if (window.KaretaShellHeader) return;

  const state={bound:false,loadingNotifications:false,lastNotificationLoad:0};
  const qs=(selector,root=document)=>root.querySelector(selector);
  const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];

  function identity(){return window.KaretaIdentity?.snapshot?.()||{};}
  function resolveCity(){
    const snapshot=identity();
    const user=window.KaretaNext?.state?.user||window.KaretaAppState?.user||{};
    const context=snapshot.context||{};
    const values=[
      user.city,user.cityName,user.city_name,
      snapshot.person?.city,snapshot.account?.city,
      context.city,context.cityName,context.metadata?.city
    ];
    const city=values.find(value=>String(value||'').trim());
    return String(city||'Усть-Каменогорск').trim().slice(0,80);
  }

  function refreshCity(){
    const city=resolveCity();
    qsa('[data-shell-city]').forEach(node=>{node.textContent=city;});
    const button=qs('[data-shell-location]');
    if(button)button.setAttribute('aria-label',`Текущий город: ${city}`);
    return city;
  }

  function setUnread(count){
    const badge=qs('[data-shell-notification-badge]');
    if(!badge)return 0;
    const value=Math.max(0,Number(count)||0);
    badge.hidden=value===0;
    badge.textContent=value>99?'99+':String(value);
    return value;
  }

  async function loadUnread(force=false){
    if(state.loadingNotifications)return;
    const now=Date.now();
    if(!force&&now-state.lastNotificationLoad<15000)return;
    const api=window.KaretaApiClient;
    if(!api?.request)return;
    state.loadingNotifications=true;
    try{
      const result=await api.request('api/domain.php?action=notifications.list',{cacheTtlMs:15000,dedupe:true});
      if(result?.ok){
        const rows=Array.isArray(result.payload?.notifications)?result.payload.notifications:[];
        setUnread(rows.filter(item=>!(item.isRead??Number(item.is_read||0)===1)).length);
        state.lastNotificationLoad=Date.now();
      }
    }catch(_error){}
    finally{state.loadingNotifications=false;}
  }

  function closeLocation({focus=false}={}){
    const button=qs('[data-shell-location]');
    const popover=qs('[data-shell-location-popover]');
    if(!button||!popover)return;
    popover.hidden=true;
    button.setAttribute('aria-expanded','false');
    if(focus)button.focus();
  }

  function toggleLocation(){
    const button=qs('[data-shell-location]');
    const popover=qs('[data-shell-location-popover]');
    if(!button||!popover)return;
    const open=popover.hidden;
    popover.hidden=!open;
    button.setAttribute('aria-expanded',String(open));
  }

  function forceVisible(){
    const header=qs('#k-shell-header');
    if(!header)return;
    header.classList.remove('is-scroll-hidden');
    header.classList.add('is-scroll-visible');
    header.setAttribute('data-scroll-state','fixed');
  }

  function bind(){
    if(state.bound)return true;
    const header=qs('#k-shell-header');
    const location=qs('[data-shell-location]');
    if(!header||!location)return false;

    location.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleLocation();});
    document.addEventListener('click',event=>{
      const popover=qs('[data-shell-location-popover]');
      if(!popover||popover.hidden)return;
      if(popover.contains(event.target)||location.contains(event.target))return;
      closeLocation();
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLocation({focus:true});});
    window.addEventListener('kareta:notification-unread',event=>setUnread(event.detail?.count));
    ['kareta:identity-ready','kareta:context-changed','kareta:interface-context-changed','kareta:session-confirmed'].forEach(name=>window.addEventListener(name,()=>{refreshCity();loadUnread(true);}));
    ['hashchange','pageshow','popstate'].forEach(name=>window.addEventListener(name,()=>{forceVisible();refreshCity();loadUnread();}));

    state.bound=true;
    refreshCity();
    forceVisible();
    loadUnread();
    return true;
  }

  window.KaretaShellHeader=Object.freeze({bind,refreshCity,setUnread,loadUnread,forceVisible,snapshot:()=>({...state,city:resolveCity()})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
