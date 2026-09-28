(() => {
  'use strict';
  const api=()=>window.KaretaApiClient;
  const ui=()=>window.KaretaUIKit;
  const esc=v=>ui()?.esc?.(v)??String(v??'');
  const money=v=>ui().money(v||0,'KZT');
  const segmentLabels={all:'Все сегменты',vip:'VIP',returning:'Постоянные',new:'Новые',lead:'Лиды'};

  function renderCrm(){
    return `<section class="k-page k-crm">
      <header class="k-r84-workspace-head"><div><small>CRM И АНАЛИТИКА</small><h1>Клиенты и аналитика</h1><p>История обращений, сегменты, повторные визиты, загрузка и выручка в одном рабочем пространстве.</p></div><button class="k-btn k-btn--primary" type="button" data-crm-refresh>Обновить</button></header>
      <div class="k-crm-kpis" data-crm-kpis></div>
      <div class="k-crm-layout"><main><div class="k-crm-toolbar"><input data-crm-search placeholder="Поиск клиента, телефона, автомобиля"><input type="hidden" data-crm-segment value=""><div class="k-r84-choice-grid" data-crm-segment-choices>${Object.entries(segmentLabels).map(([key,label])=>`<button type="button" data-crm-segment-value="${key==='all'?'':key}" class="${key==='all'?'is-active':''}">${label}</button>`).join('')}</div></div><div class="k-crm-customers" data-crm-customers></div></main><aside><section class="k-crm-panel"><h2>Динамика</h2><div data-crm-trend></div></section><section class="k-crm-panel"><h2>Исполнители</h2><div data-crm-masters></div></section><section class="k-crm-panel"><h2>Карточка клиента</h2><div data-crm-detail>${ui().empty('Выберите клиента')}</div></section></aside></div>
      <div class="k-crm-message" data-crm-message></div>
    </section>`;
  }

  async function mountCrm(){
    const root=document.querySelector('.k-crm');
    if(!root)return;
    let data={customers:[]};
    let selected='';
    const msg=t=>root.querySelector('[data-crm-message]').textContent=t||'';

    const render=()=>{
      const q=root.querySelector('[data-crm-search]').value.trim().toLowerCase();
      const seg=root.querySelector('[data-crm-segment]').value;
      const items=(data.customers||[]).filter(c=>(!seg||c.segment===seg)&&(!q||`${c.displayName} ${c.phone} ${c.vehicleTitle||''}`.toLowerCase().includes(q)));
      root.querySelector('[data-crm-kpis]').innerHTML=[['Клиенты',data.summary?.customers],['Повторные',data.summary?.returning],['Завершено',data.summary?.completedOrders],['Выручка',money(data.summary?.revenue)],['Средний чек',money(data.summary?.averageTicket)],['Записи',data.summary?.upcomingBookings]].map(([a,b])=>ui().card({title:String(b??0),meta:a})).join('');
      root.querySelector('[data-crm-customers]').innerHTML=items.map(c=>`<button class="k-crm-customer ${selected===c.customerKey?'is-active':''}" data-customer="${esc(c.customerKey)}"><span class="k-crm-avatar">${esc((c.displayName||'?').slice(0,1))}</span><span><b>${esc(c.displayName)}</b><small>${esc(c.phone||'Без телефона')} · ${esc(c.vehicleTitle||'Автомобиль не указан')}</small><span class="k-crm-profiles">${(c.profiles||[]).filter(p=>p.status==='active').map(p=>`<i>${esc(({client:'Клиент',master:'Мастер',seller:'Продавец'}[p.type]||p.type))}</i>`).join('')}</span></span><span><em>${esc(c.segmentLabel)}</em><strong>${money(c.totalSpent)}</strong></span></button>`).join('')||ui().empty('Клиенты не найдены');
      root.querySelector('[data-crm-trend]').innerHTML=(data.monthly||[]).map(x=>`<div class="k-crm-bar"><span>${esc(x.month)}</span><i style="--v:${Math.max(4,Math.min(100,Number(x.percent)||0))}%"></i><b>${money(x.revenue)}</b></div>`).join('')||ui().empty('Нет данных');
      root.querySelector('[data-crm-masters]').innerHTML=(data.masters||[]).map(m=>`<div class="k-crm-row"><span>${esc(m.name)}</span><b>${esc(m.completed)} работ</b><small>${money(m.revenue)}</small></div>`).join('')||ui().empty('Нет данных');
    };

    const detail=()=>{
      const c=(data.customers||[]).find(x=>x.customerKey===selected);
      if(!c)return;
      root.querySelector('[data-crm-detail]').innerHTML=`<div class="k-crm-detail"><h3>${esc(c.displayName)}</h3><p>${esc(c.phone||'')}</p><div class="k-crm-profile-list"><b>Профили</b>${(c.profiles||[]).map(p=>`<span class="${p.status==='active'?'is-active':''}">${p.status==='active'?'✓':'•'} ${esc(({client:'Client',master:'Master',seller:'Seller'}[p.type]||p.type))}</span>`).join('')}</div><div class="k-crm-detail-grid"><span>Заказы <b>${esc(c.ordersCount)}</b></span><span>Завершено <b>${esc(c.completedCount)}</b></span><span>Потрачено <b>${money(c.totalSpent)}</b></span><span>Последний визит <b>${esc(c.lastVisitAt||'—')}</b></span></div><h4>Последние обращения</h4>${(c.recentOrders||[]).map(o=>`<div class="k-crm-order"><span>${esc(o.title)}</span><b>${esc(o.status)}</b><small>${money(o.price)}</small></div>`).join('')||ui().empty('Обращений нет')}<h4>Заметка</h4><textarea data-crm-note placeholder="Что важно учесть при следующем обращении"></textarea><button class="k-btn k-btn--secondary" data-crm-note-save>Сохранить заметку</button>${(c.notes||[]).map(n=>`<blockquote>${esc(n.body)}<small>${esc(n.createdAt)}</small></blockquote>`).join('')}</div>`;
    };

    const load=async()=>{
      root.querySelector('[data-crm-customers]').innerHTML=ui().skeleton(6);
      try{data=await api().getCrmView();render();if(selected)detail();}
      catch(e){root.querySelector('[data-crm-customers]').innerHTML=ui().error(e.message||'Не удалось загрузить CRM');}
    };

    root.addEventListener('input',e=>{if(e.target.matches('[data-crm-search]'))render();});
    root.addEventListener('click',async e=>{
      const segment=e.target.closest('[data-crm-segment-value]');
      if(segment){root.querySelector('[data-crm-segment]').value=segment.dataset.crmSegmentValue||'';root.querySelectorAll('[data-crm-segment-value]').forEach(x=>x.classList.toggle('is-active',x===segment));render();return;}
      if(e.target.closest('[data-crm-refresh]'))return load();
      const c=e.target.closest('[data-customer]');if(c){selected=c.dataset.customer;render();detail();return;}
      if(e.target.closest('[data-crm-note-save]')){const body=root.querySelector('[data-crm-note]').value.trim();if(!body)return;try{await api().createCrmNote({customerKey:selected,body});msg('Заметка сохранена');await load();detail();}catch(err){msg(err.message||'Не удалось сохранить заметку');}}
    });
    await load();
  }

  window.KaretaCrmPages=Object.freeze({renderCrm,mountCrm});
})();
