(() => {
  'use strict';
  if (window.KaretaMessagingSettings) return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[char]));
  const api=()=>window.KaretaApiClient;
  async function request(action='',payload=null){
    const url=`api/messaging.php?action=${encodeURIComponent(action||'status')}`;
    const options=payload===null?{cacheTtlMs:0,force:true,dedupe:false}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cacheTtlMs:0,dedupe:false};
    return api().request(url,options);
  }
  function channelMeta(name){return name==='telegram'?{title:'Telegram',note:'Сообщения и ответы через бота KARETA.'}:{title:'WhatsApp',note:'Сообщения через официальный номер KARETA.'};}
  function channelRow(name,status){
    const provider=status?.providers?.[name]||{},link=status?.links?.[name]||null,meta=channelMeta(name),configured=provider.configured===true,linked=link?.linked===true;
    const detail=linked?(link.displayName||link.externalPhone||'Канал привязан'):(configured?'Готов к подключению':'Провайдер ещё не настроен на сервере');
    return `<article class="k-messaging-channel ${linked?'is-linked':''}" data-messaging-channel="${name}"><div class="k-messaging-channel__icon" aria-hidden="true">${name==='telegram'?'TG':'WA'}</div><div class="k-messaging-channel__copy"><div><strong>${meta.title}</strong><span class="k-messaging-status ${linked?'is-on':configured?'is-ready':'is-off'}">${linked?'Подключён':configured?'Доступен':'Не настроен'}</span></div><p>${esc(detail)}</p><small>${meta.note}</small></div><div class="k-messaging-channel__actions">${linked?`<button class="k-btn k-btn-secondary" type="button" data-messaging-unlink="${name}">Отключить</button>`:`<button class="k-btn k-btn-secondary" type="button" data-messaging-link="${name}" ${configured?'':'disabled'}>Подключить</button>`}</div></article>`;
  }
  function render(host,status){
    const prefs=status?.preferences||{},links=status?.links||{},providers=status?.providers||{};
    const canPrimary=name=>name==='kareta'||(providers[name]?.configured===true&&links[name]?.linked===true);
    host.innerHTML=`<section class="k-messaging-settings"><header class="k-messaging-settings__head"><div><span>КАНАЛЫ СВЯЗИ</span><h3>WhatsApp и Telegram</h3><p>KARETA хранит основную историю чата. Внешние каналы используются для доставки и ответов.</p></div><button class="k-btn k-btn-secondary" type="button" data-messaging-refresh>Обновить</button></header><div class="k-messaging-channels">${channelRow('telegram',status)}${channelRow('whatsapp',status)}</div><form class="k-messaging-preferences" data-messaging-preferences><fieldset><legend>Основной канал сообщений</legend><div class="k-messaging-primary">${[['kareta','KARETA'],['telegram','Telegram'],['whatsapp','WhatsApp']].map(([value,label])=>`<label class="${canPrimary(value)?'':'is-disabled'}"><input type="radio" name="primaryChannel" value="${value}" ${String(prefs.primaryChannel||'kareta')===value?'checked':''} ${canPrimary(value)?'':'disabled'}><span>${label}</span></label>`).join('')}</div></fieldset><div class="k-messaging-toggles"><label><span><b>Новые сообщения</b><small>Переписка по заказам и прямым чатам.</small></span><input type="checkbox" name="notifyMessages" ${prefs.notifyMessages!==false?'checked':''}><i></i></label><label><span><b>Заказы и статусы</b><small>Изменения ремонта и заявки.</small></span><input type="checkbox" name="notifyOrders" ${prefs.notifyOrders!==false?'checked':''}><i></i></label><label><span><b>Согласования</b><small>Сметы, работы и решения клиента.</small></span><input type="checkbox" name="notifyApprovals" ${prefs.notifyApprovals!==false?'checked':''}><i></i></label><label><span><b>Расписание</b><small>Записи, переносы и рабочие события.</small></span><input type="checkbox" name="notifySchedule" ${prefs.notifySchedule!==false?'checked':''}><i></i></label><label><span><b>Принимать ответы из мессенджеров</b><small>Ответ попадёт в тот же чат KARETA.</small></span><input type="checkbox" name="allowExternalReplies" ${prefs.allowExternalReplies!==false?'checked':''}><i></i></label></div><footer><output data-messaging-status></output><button class="k-btn k-btn-primary" type="submit">Сохранить каналы</button></footer></form></section>`;
  }
  async function mount(host){
    if(!host||host.dataset.messagingMounted==='1')return;
    host.dataset.messagingMounted='1';host.innerHTML='<div class="k-messaging-loading">Загрузка каналов связи…</div>';
    let status=null;
    const refresh=async()=>{const result=await request('status');if(!result.ok)throw new Error(result.payload?.message||result.payload?.error||'Каналы связи недоступны');status=result.payload?.messaging||result.data?.messaging||{};render(host,status);bind();return status;};
    const bind=()=>{
      host.querySelector('[data-messaging-refresh]')?.addEventListener('click',()=>refresh().catch(error=>window.KaretaToast?.error?.(error.message)));
      host.querySelectorAll('[data-messaging-link]').forEach(button=>button.addEventListener('click',async()=>{
        const channel=button.dataset.messagingLink||'';const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;button.disabled=true;
        try{const result=await request('link.create',{channel});if(!result.ok)throw new Error(result.payload?.message||result.payload?.error||'Не удалось создать ссылку подключения');const url=result.payload?.link?.connectUrl||'';if(!url)throw new Error('Ссылка подключения не получена');if(popup)popup.location.href=url;else location.href=url;window.KaretaToast?.success?.('Подтвердите подключение в мессенджере, затем нажмите «Обновить»');}
        catch(error){try{popup?.close?.();}catch(_e){}window.KaretaToast?.error?.(error.message);button.disabled=false;}
      }));
      host.querySelectorAll('[data-messaging-unlink]').forEach(button=>button.addEventListener('click',async()=>{const channel=button.dataset.messagingUnlink||'';button.disabled=true;try{const result=await request('unlink',{channel});if(!result.ok)throw new Error(result.payload?.message||result.payload?.error||'Не удалось отключить канал');window.KaretaToast?.success?.('Канал отключён');await refresh();}catch(error){window.KaretaToast?.error?.(error.message);button.disabled=false;}}));
      host.querySelector('[data-messaging-preferences]')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,out=form.querySelector('[data-messaging-status]'),save=form.querySelector('[type=submit]');save.disabled=true;out.textContent='Сохранение…';try{const payload={primaryChannel:form.querySelector('[name=primaryChannel]:checked')?.value||'kareta',notifyMessages:form.notifyMessages.checked,notifyOrders:form.notifyOrders.checked,notifyApprovals:form.notifyApprovals.checked,notifySchedule:form.notifySchedule.checked,allowExternalReplies:form.allowExternalReplies.checked};const result=await request('preferences.save',payload);if(!result.ok)throw new Error(result.payload?.message||result.payload?.error||'Не удалось сохранить каналы');out.textContent='Сохранено';window.KaretaToast?.success?.('Каналы связи сохранены');status=result.payload?.messaging||status;}catch(error){out.textContent=error.message;window.KaretaToast?.error?.(error.message);}finally{save.disabled=false;}});
    };
    try{await refresh();}catch(error){host.innerHTML=`<div class="k-empty-card"><h3>Каналы связи недоступны</h3><p>${esc(error.message)}</p><button type="button" class="k-btn k-btn-secondary" data-messaging-retry>Повторить</button></div>`;host.querySelector('[data-messaging-retry]')?.addEventListener('click',()=>{delete host.dataset.messagingMounted;mount(host);});}
  }
  window.KaretaMessagingSettings=Object.freeze({mount,refresh:request});
})();
