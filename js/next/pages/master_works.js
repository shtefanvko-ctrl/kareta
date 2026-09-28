(() => {
  'use strict';
  const api=window.KaretaApiClient;
  const ui=window.KaretaPageUI;
  if(!api||!ui) throw new Error('KaretaApiClient and KaretaPageUI are required before pages/master_works.js');
  const esc=ui.escHtml;
  const icon=name=>window.KaretaUIIcons?.svg?.(name,{className:'k-master-dialog-icon'})||'';
  const money=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v||0)))+' ₸';
  const dt=v=>{if(!v)return '—';const d=new Date(String(v).replace(' ','T'));return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});};
  let snapshot=null;

  function renderMasterWorks(){
    return `<section class="k-page k-master-page k-master-surface-page k-master-works-page"><div id="k-master-works" class="k-master-works"><section class="k-empty"><h2>Загружаем портфолио</h2><p>Проверяем опубликованные работы и завершённые заказ-наряды.</p></section></div></section>`;
  }
  function stat(label,value,text){return `<article class="k-master-works-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(text||'')}</span></article>`;}
  function publishedCard(x){
    return `<article class="k-master-work-card is-published">
      ${x.coverUrl?`<a class="k-master-work-card__media" href="#/works/item/${encodeURIComponent(x.id)}"><img src="${esc(x.coverUrl)}" alt="${esc(x.title||'Работа')}" loading="lazy"></a>`:`<div class="k-master-work-card__media is-empty"><span>РАБОТА KARETA</span></div>`}
      <div class="k-master-work-card__body"><header><span class="k-master-work-status is-published">Опубликовано</span><small>${esc(dt(x.publishedAt))}</small></header><h3>${esc(x.title||x.serviceLabel||'Выполненная работа')}</h3><p>${esc(x.vehicleLabel||'Автомобиль')} · ${esc(x.serviceLabel||'Ремонт')}</p>
      <div class="k-master-work-facts"><span><b>${Number(x.mediaCount||0)}</b><small>материалов</small></span><span><b>${Number(x.likesCount||0)}</b><small>лайков</small></span><span><b>${Number(x.commentsCount||0)}</b><small>комментариев</small></span><span><b>${Number(x.viewsCount||0)}</b><small>просмотров</small></span></div>
      <footer><a class="k-btn k-btn-primary" href="#/works/item/${encodeURIComponent(x.id)}">Открыть работу</a>${x.orderId?`<a class="k-btn k-btn-secondary" href="#/orders/item/${encodeURIComponent(x.orderId)}">Заказ-наряд</a>`:''}</footer></div>
    </article>`;
  }
  function candidateCard(x){
    const ready=!!x.readyToPublish;
    return `<article class="k-master-work-candidate ${ready?'is-ready':'is-waiting'}" data-order-id="${esc(x.orderId)}">
      <header><span class="k-master-work-status ${ready?'is-ready':'is-waiting'}">${ready?'Готово к публикации':'Ожидает согласия клиента'}</span><small>${esc(dt(x.completedAt))}</small></header>
      <h3>${esc(x.serviceLabel||'Завершённый ремонт')}</h3><p>${esc(x.vehicleLabel||'Автомобиль')}</p>
      <div class="k-master-work-candidate__facts"><span><b>${Number(x.mediaCount||0)}</b><small>публичных материалов</small></span><span><b>${x.showPrice?money(x.orderPrice):'Скрыта'}</b><small>стоимость</small></span><span><b>${x.anonymizeClient?'Да':'Нет'}</b><small>анонимизация</small></span></div>
      ${ready?'<p class="k-master-work-note">Клиент разрешил публикацию. Работа привязана к завершённому заказ-наряду и будет опубликована с подтверждёнными данными ремонта.</p>':'<p class="k-master-work-note">Мастер не может обойти согласие клиента. После разрешения работа появится здесь как готовая к публикации.</p>'}
      <footer>${ready?`<button class="k-btn k-btn-primary" type="button" data-master-work-publish="${esc(x.orderId)}">Подготовить публикацию</button>`:''}<a class="k-btn k-btn-secondary" href="#/orders/item/${encodeURIComponent(x.orderId)}">Открыть заказ</a></footer>
    </article>`;
  }
  function paint(data){
    snapshot=data;const root=document.querySelector('#k-master-works');if(!root)return;
    const published=Array.isArray(data.published)?data.published:[],candidates=Array.isArray(data.candidates)?data.candidates:[],ready=candidates.filter(x=>x.readyToPublish),waiting=candidates.filter(x=>!x.readyToPublish),counts=data.counts||{},master=data.master||{};
    root.innerHTML=`<header class="k-master-works-hero k-master-page-header"><div><small>ПОРТФОЛИО МАСТЕРА</small><h1>Мои работы</h1><p>Портфолио формируется из реальных завершённых заказ-нарядов. Публикация возможна только после согласия клиента.</p></div><div class="k-master-works-hero__actions"><a class="k-btn k-btn-primary" href="#/masters/profile/master/${encodeURIComponent(master.id||'')}">Посмотреть как клиент</a><a class="k-btn k-btn-secondary" href="#/master/profile">Мой профиль</a></div></header>
      <section class="k-master-works-stats">${stat('Опубликовано',String(counts.published||0),'видят клиенты')}${stat('Готово',String(counts.ready||0),'можно опубликовать')}${stat('Ждут согласия',String(counts.awaitingConsent||0),'решает клиент')}</section>
      <section class="k-master-works-section"><header><div><small>ЗАВЕРШЁННЫЕ РЕМОНТЫ</small><h2>Готовы к публикации</h2></div><span>${ready.length}</span></header><div class="k-master-work-candidates">${ready.length?ready.map(candidateCard).join(''):'<div class="k-empty"><h3>Нет работ, готовых к публикации</h3><p>После завершения ремонта и согласия клиента заказ автоматически появится здесь.</p></div>'}</div></section>
      ${waiting.length?`<section class="k-master-works-section"><header><div><small>ПРИВАТНОСТЬ КЛИЕНТА</small><h2>Ожидают согласия</h2></div><span>${waiting.length}</span></header><div class="k-master-work-candidates">${waiting.map(candidateCard).join('')}</div></section>`:''}
      <section class="k-master-works-section"><header><div><small>ПУБЛИЧНОЕ ПОРТФОЛИО</small><h2>Опубликованные работы</h2></div><span>${published.length}</span></header><div class="k-master-works-grid">${published.length?published.map(publishedCard).join(''):'<div class="k-empty"><h3>Портфолио пока пустое</h3><p>Здесь будут отображаться подтверждённые работы из завершённых ремонтов.</p></div>'}</div></section>
      <dialog class="k-master-work-publish-dialog" data-master-work-dialog><form data-master-work-publish-form><header><div><small>ПУБЛИКАЦИЯ РАБОТЫ</small><h2>Подготовить кейс</h2></div><button type="button" data-master-work-close aria-label="Закрыть">${icon('close')}</button></header><input type="hidden" name="orderId"><label>Заголовок<input name="title" maxlength="255" required></label><label>Описание выполненной работы<textarea name="body" rows="7" maxlength="12000" required></textarea></label><div class="k-master-work-policy" data-master-work-policy></div><footer><button class="k-btn k-btn-secondary" type="button" data-master-work-close>Отмена</button><button class="k-btn k-btn-primary" type="submit">Опубликовать работу</button></footer></form></dialog>`;
  }
  async function load(ctx={}){
    const root=document.querySelector('#k-master-works');if(!root)return;
    const r=await api.request('api/db.php?action=masterWorks.portfolio',{method:'GET',cacheTtlMs:0,signal:ctx.lifecycle?.signal});
    if(!r.ok){root.innerHTML=`<section class="k-empty"><h2>Не удалось загрузить портфолио</h2><p>${esc(r.payload?.message||r.payload?.error||'Повторите попытку')}</p><button class="k-btn k-btn-primary" type="button" data-master-works-retry>Повторить</button></section>`;return;}
    paint(r.payload?.data||{});
  }
  function openPublish(orderId){
    const item=(snapshot?.candidates||[]).find(x=>String(x.orderId)===String(orderId));if(!item||!item.readyToPublish)return;
    const dialog=document.querySelector('[data-master-work-dialog]'),form=dialog?.querySelector('form');if(!dialog||!form)return;
    form.orderId.value=item.orderId;form.title.value=item.draftTitle||`${item.serviceLabel||'Ремонт'} — ${item.vehicleLabel||'автомобиль'}`;form.body.value=item.draftBody||'';
    const policy=dialog.querySelector('[data-master-work-policy]');if(policy)policy.innerHTML=`<span>Согласие клиента: <b>получено</b></span><span>Персональные данные: <b>${item.anonymizeClient?'скрываются':'по настройке клиента'}</b></span><span>Стоимость: <b>${item.showPrice?'разрешена к публикации':'скрыта клиентом'}</b></span>`;
    dialog.showModal();
  }
  function mountMasterWorks(ctx={}){
    const page=document.querySelector('.k-master-works-page');if(!page)return()=>{};
    const click=e=>{const pub=e.target.closest('[data-master-work-publish]');if(pub){openPublish(pub.dataset.masterWorkPublish);return;}if(e.target.closest('[data-master-work-close]')){page.querySelector('[data-master-work-dialog]')?.close();return;}if(e.target.closest('[data-master-works-retry]'))load(ctx);};
    const submit=async e=>{const form=e.target.closest('[data-master-work-publish-form]');if(!form)return;e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;const values=Object.fromEntries(new FormData(form));const r=await api.publishWorkPost({orderId:values.orderId,title:String(values.title||'').trim(),body:String(values.body||'').trim(),summary:String(values.body||'').trim().slice(0,220)});button.disabled=false;if(!r.ok){window.KaretaToast?.error(r.payload?.message||'Не удалось опубликовать работу');return;}page.querySelector('[data-master-work-dialog]')?.close();api.invalidate('work.posts:');window.KaretaToast?.success('Работа опубликована в портфолио');await load(ctx);};
    page.addEventListener('click',click);page.addEventListener('submit',submit);load(ctx);
    return()=>{page.removeEventListener('click',click);page.removeEventListener('submit',submit);};
  }
  window.KaretaMasterWorksPages=Object.freeze({renderMasterWorks,mountMasterWorks});
})();
