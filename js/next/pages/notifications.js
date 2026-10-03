(() => {
  'use strict';
  const api=window.KaretaApiClient;
  if(!api) throw new Error('Notifications dependencies are required');
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=value=>{const d=new Date(String(value||''));return Number.isNaN(d.getTime())?'':d.toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});};
  const icon=kind=>({garage:'🚗',order:'✓',chat:'💬',system:'●',offer:'₸',default:'○'})[kind]||'○';
  const identityAuthenticated=()=>window.KaretaIdentity?.snapshot?.()?.authenticated===true;
  function kindOf(n){
    const raw=String(n.eventType||n.event_type||n.type||'').toLowerCase();
    const title=String(n.title||'').toLowerCase();
    if(raw.includes('garage')||raw.includes('vehicle')||title.includes('автомоб'))return 'garage';
    if(raw.includes('order')||raw.includes('request')||raw.includes('work')||title.includes('заяв')||title.includes('заказ')||title.includes('ремонт'))return 'order';
    if(raw.includes('message')||raw.includes('chat')||title.includes('сообщ'))return 'chat';
    if(raw.includes('offer')||raw.includes('price')||title.includes('предлож')||title.includes('цен'))return 'offer';
    if(raw.includes('system')||raw.includes('reminder'))return 'system';
    return 'default';
  }
  function renderNotifications(){
    return `<section class="k-page k-notifications-page k-notifications-ref-v2" data-notifications-page>
      <header class="k-notifications-ref-head">
        <div class="k-notifications-ref-copy"><small>ЦЕНТР СОБЫТИЙ</small><h1>Уведомления</h1><p>Заявки, сообщения, напоминания и предложения — в одной ленте.</p></div>
        <div class="k-notifications-ref-head-actions"><button type="button" data-notifications-read-all>Прочитать все</button><button type="button" data-notifications-refresh aria-label="Обновить уведомления">↻</button></div>
      </header>
      <nav class="k-notifications-ref-tabs" role="tablist" aria-label="Фильтр уведомлений">
        <button type="button" class="is-active" role="tab" aria-selected="true" data-notifications-tab="all">Все <span data-notification-count-all>0</span></button>
        <button type="button" role="tab" aria-selected="false" data-notifications-tab="unread">Новые <span data-notification-count-unread>0</span></button>
        <button type="button" role="tab" aria-selected="false" data-notifications-tab="order">Заявки</button>
        <button type="button" role="tab" aria-selected="false" data-notifications-tab="chat">Сообщения</button>
      </nav>
      <div class="k-notifications-ref-status" data-notifications-status aria-live="polite"></div>
      <section class="k-notifications-list k-notifications-ref-list" data-notifications-list><div class="k-notifications-ref-skeleton">${'<i></i>'.repeat(4)}</div></section>
    </section>`;
  }
  function card(n){
    const unread=!(n.isRead ?? Number(n.is_read||0)===1),virtual=Boolean(n.virtual),kind=kindOf(n);
    const actionLabel=n.actionLabel||n.action_label||'Открыть';
    const eventLabel=String(n.eventType||n.event_type||n.type||'Событие').replaceAll('_',' ');
    return `<article class="k-notification-card k-notification-ref-card ${unread?'is-unread':''} ${virtual?'is-system-reminder':''}" data-notification-id="${esc(n.id)}" data-notification-kind="${esc(kind)}">
      <div class="k-notification-ref-icon" aria-hidden="true">${icon(kind)}</div>
      <div class="k-notification-ref-main"><div class="k-notification-ref-meta"><span>${esc(eventLabel)}</span>${unread?'<i>Новое</i>':''}<time>${esc(fmt(n.createdAt||n.created_at))}</time></div><h2>${esc(n.title||'Уведомление')}</h2>${n.body?`<p>${esc(n.body)}</p>`:''}</div>
      <div class="k-notification-actions k-notification-ref-actions">${(n.actionUrl||n.action_url)?`<a href="${esc(n.actionUrl||n.action_url)}">${esc(actionLabel)} <span>›</span></a>`:''}${unread&&!virtual?`<button type="button" data-notification-read="${esc(n.id)}" aria-label="Отметить прочитанным">✓</button>`:''}</div>
    </article>`;
  }
  async function firstVehicleReminder(){
    const role=String(window.KaretaRoleAccess?.currentRole?.()||window.KaretaNavigationCore?.interfaceRole?.()||window.KaretaNext?.state?.user?.role||'').toLowerCase();
    if(role!=='client')return null;
    const clientApi=window.KaretaClientCabinetApi;if(!clientApi?.get)return null;
    try{
      const result=await clientApi.get({cacheTtlMs:0,force:true,dedupe:false});
      if(!result?.ok)return null;
      const data=result.payload?.data||result.payload||{},active=Array.isArray(data.vehicles)?data.vehicles:[],archived=Array.isArray(data.archivedVehicles)?data.archivedVehicles:[];
      if(active.length||archived.length)return null;
      return {id:'client-first-vehicle-reminder',virtual:true,isRead:false,eventType:'ГАРАЖ',title:'Добавьте первый автомобиль',body:'Марка, модель и год — достаточно для старта. Остальные данные можно заполнить позже.',actionUrl:'#/cabinet/garage?firstVehicle=1',actionLabel:'Добавить авто'};
    }catch(_e){return null;}
  }
  async function mountNotifications(context={}){
    const root=document.querySelector('[data-notifications-page]'),list=root?.querySelector('[data-notifications-list]');if(!root||!list)return;
    if(!identityAuthenticated()){
      const actions=root.querySelector('.k-notifications-ref-head-actions');if(actions)actions.hidden=true;
      const tabs=root.querySelector('.k-notifications-ref-tabs');if(tabs)tabs.hidden=true;
      const status=root.querySelector('[data-notifications-status]');if(status)status.textContent='Требуется вход';
      list.innerHTML='<div class="k-notifications-ref-empty"><span>🔒</span><h2>Войдите, чтобы увидеть уведомления</h2><p>Центр событий доступен после входа в аккаунт.</p><a href="#/home">Перейти к входу</a></div>';
      window.dispatchEvent(new CustomEvent('kareta:notification-unread',{detail:{count:0}}));
      return;
    }
    let disposed=false,pollTimer=0,requestSeq=0,rows=[],tab='all';
    const publish=items=>window.dispatchEvent(new CustomEvent('kareta:notification-unread',{detail:{count:items.filter(n=>!(n.isRead??Number(n.is_read||0)===1)).length}}));
    const updateCounts=()=>{
      const unread=rows.filter(n=>!(n.isRead??Number(n.is_read||0)===1)).length;
      const a=root.querySelector('[data-notification-count-all]'),u=root.querySelector('[data-notification-count-unread]');if(a)a.textContent=String(rows.length);if(u)u.textContent=String(unread);
      const status=root.querySelector('[data-notifications-status]');if(status)status.textContent=unread?`${unread} непрочитанных`:'Всё прочитано';
    };
    const paint=()=>{
      const filtered=rows.filter(n=>tab==='all'||(tab==='unread'&&!(n.isRead??Number(n.is_read||0)===1))||kindOf(n)===tab);
      list.innerHTML=filtered.map(card).join('')||`<div class="k-notifications-ref-empty"><span>✓</span><h2>${tab==='unread'?'Новых уведомлений нет':'Здесь пока пусто'}</h2><p>${tab==='unread'?'Вы прочитали все события.':'Новые события появятся здесь автоматически.'}</p></div>`;
      updateCounts();
    };
    const load=async(quiet=false)=>{
      const seq=++requestSeq;if(!quiet)list.innerHTML=`<div class="k-notifications-ref-skeleton">${'<i></i>'.repeat(4)}</div>`;
      try{
        const [r,vehicleReminder]=await Promise.all([api.request('api/domain.php?action=notifications.list',{cacheTtlMs:0,force:true,dedupe:false}),firstVehicleReminder()]);
        if(disposed||seq!==requestSeq)return;
        const serverRows=Array.isArray(r.payload?.notifications)?r.payload.notifications:[];rows=vehicleReminder?[vehicleReminder,...serverRows]:serverRows;publish(rows);paint();
      }catch(_e){if(disposed||seq!==requestSeq)return;list.innerHTML='<div class="k-notifications-ref-empty"><span>!</span><h2>Не удалось загрузить уведомления</h2><p>Проверьте соединение и повторите.</p><button type="button" data-notifications-refresh>Повторить</button></div>';}
    };
    const click=async e=>{
      const t=e.target.closest('[data-notifications-tab]');if(t){tab=t.dataset.notificationsTab||'all';root.querySelectorAll('[data-notifications-tab]').forEach(x=>{const active=x===t;x.classList.toggle('is-active',active);x.setAttribute('aria-selected',active?'true':'false');});paint();return;}
      if(e.target.closest('[data-notifications-refresh]')){load(false);return;}
      if(e.target.closest('[data-notifications-read-all]')){await api.request('api/domain.php?action=notification.readAll',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':'notifications-read-all-'+Date.now()},body:JSON.stringify({})});rows=rows.map(n=>n.virtual?n:{...n,isRead:true,is_read:1});publish(rows);paint();window.KaretaToast?.success?.('Все уведомления прочитаны');return;}
      const one=e.target.closest('[data-notification-read]');if(one){const id=one.dataset.notificationRead;await api.request('api/domain.php?action=notification.read',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':'notification-read-'+id},body:JSON.stringify({id})});const row=rows.find(n=>String(n.id)===String(id));if(row){row.isRead=true;row.is_read=1;}publish(rows);paint();}
    };
    root.addEventListener('click',click);pollTimer=window.setInterval(()=>{if(!document.hidden)load(true);},30000);context.lifecycle?.addCleanup?.(()=>{disposed=true;requestSeq++;root.removeEventListener('click',click);window.clearInterval(pollTimer);});load(false);
  }
  window.KaretaNotificationsPages=Object.freeze({renderNotifications,mountNotifications});
})();
