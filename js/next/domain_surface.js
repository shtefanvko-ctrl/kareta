(() => {
  'use strict';
  const config=window.KARETA_DOMAIN_SURFACE;
  if(!config||window.KaretaDomainSurface)return;
  const role=String(config.role||'');
  const label=String(config.label||'KARETA');
  const home=String(config.route||'home');
  const roleOf=context=>{
    if(!context)return '';
    const type=String(context.type||context.contextType||'').toLowerCase();
    if(type==='personal')return 'client';
    if(type==='profile'){
      const profile=String(context.profileType||context.profile_type||'').toLowerCase();
      return profile==='master'||profile==='seller'?profile:'';
    }
    if(type==='organization'){
      const kind=String(context.organizationType||context.organization_type||'').toLowerCase();
      const code=String(context.capabilitySetCode||'').toLowerCase();
      return kind==='parts_store'||code.includes('seller')?'seller':'sto';
    }
    return '';
  };
  let gate=null;
  function clear(){ if(gate){gate.remove();gate=null;} }
  function show(snapshot){
    if(!gate){
      gate=document.createElement('section');
      gate.id='k-domain-surface-gate';
      gate.className='k-domain-surface-gate';
      gate.setAttribute('role','dialog');
      gate.setAttribute('aria-modal','true');
      gate.setAttribute('aria-labelledby','k-domain-surface-title');
      document.body.appendChild(gate);
    }
    gate.replaceChildren();
    const card=document.createElement('div');card.className='k-domain-surface-gate__card';
    const heading=document.createElement('h1');heading.id='k-domain-surface-title';heading.textContent=label;
    const info=document.createElement('p');info.textContent='Выбран другой тип аккаунта. Чтобы открыть этот кабинет, переключите свой подтверждённый профиль.';
    const actions=document.createElement('div');actions.className='k-domain-surface-gate__actions';
    const options=(Array.isArray(snapshot.contexts)?snapshot.contexts:[]).filter(item=>roleOf(item)===role);
    for(const context of options){
      const button=document.createElement('button');button.type='button';button.className='k-domain-surface-gate__button';
      button.textContent=`Переключить: ${String(context.label||label).slice(0,90)}`;
      button.addEventListener('click',async()=>{
        button.disabled=true;
        try{
          await window.KaretaIdentity.select(context.id||context.key);
          clear();
          // Use the existing SPA router. Setting an unchanged hash alone does not mount a page.
          if(window.KaretaRouteRuntime?.navigate){
            window.KaretaRouteRuntime.navigate(home,{source:'domain-context-switch',replace:true,force:true});
          }else{
            location.hash='#/'+home;
          }
        }catch(error){button.disabled=false;info.textContent='Не удалось выбрать профиль. Проверьте свои права и попробуйте ещё раз.';}
      });
      actions.appendChild(button);
    }
    if(!options.length){
      const missing=document.createElement('p');missing.className='k-domain-surface-gate__notice';
      missing.textContent='Подтверждённый профиль для этого кабинета не найден. Откройте личный кабинет и оформите соответствующую роль.';
      actions.appendChild(missing);
    }
    const client=document.createElement('a');client.href='https://client.kareta.kz/';client.textContent='Кабинет клиента';
    const portal=document.createElement('a');portal.href='https://kareta.kz/';portal.textContent='Главная KARETA';
    actions.append(client,portal);card.append(heading,info,actions);gate.appendChild(card);
  }
  function enforce(options={}){
    const snap=window.KaretaIdentity?.snapshot?.()||null;
    // Never infer authorization from a hostname, localStorage, or legacy role hints.
    if(!snap||!snap.authenticated||snap.mode!=='identity'){clear();return {state:'anonymous',blocked:false};}
    if(roleOf(snap.context)===role){
      clear();
      if(options.initial===true && (!location.hash||location.hash==='#/'||location.hash==='#/home')){
        if(home!=='home')history.replaceState(null,'',location.pathname+location.search+'#/'+home);
      }
      return {state:'matched',blocked:false};
    }
    show(snap);
    // Clear any previously mounted protected role content after a context switch.
    document.querySelector?.('#k-page-outlet')?.replaceChildren?.();
    return {state:'role-mismatch',blocked:true};
  }
  window.KaretaDomainSurface=Object.freeze({config,roleOf,enforce});
  window.addEventListener('kareta:identity-ready',enforce);
  window.addEventListener('kareta:context-changed',enforce);
  window.addEventListener('kareta:session-anonymous',clear);
  window.addEventListener('kareta:session-confirmed',enforce);
})();
