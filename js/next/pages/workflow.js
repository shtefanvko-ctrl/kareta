(() => {
  'use strict';
  const ui=window.KaretaPageUI;
  const state=window.KaretaOrdersState;
  const engine=window.KaretaWorkflowEngine;
  if(!ui||!state||!engine) throw new Error('Workflow page dependencies are required');
  const esc=ui.escHtml;
  const currentRole=()=>String(window.KaretaRoleAccess?.currentRole?.()||window.KaretaNext?.state?.user?.role||'client').toLowerCase();
  const uiIcon=name=>window.KaretaUIIcons?.svg?.(name)||'';

  const icons=Object.freeze({
    new:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l3 3V20H7z"/><path d="M14 3.5V7h3M9.5 11h5M9.5 14h5M9.5 17h3.5"/></svg>',
    waiting_responses:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3z"/><path d="M8.5 9h7M8.5 12h4.5"/></svg>',
    accepted:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.7-3.6 3-5.5 6.5-5.5s5.8 1.9 6.5 5.5M16.5 11.5l1.5 1.5 3-3"/></svg>',
    assigned:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14.5h16M6 14.5l1.3-5h9.4l1.3 5M7.5 9.5l1.2-3h6.6l1.2 3"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/><path d="M10 12h4"/></svg>',
    in_progress:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 5.2a4 4 0 0 0-5 5L4.5 15.5a2.1 2.1 0 0 0 3 3l5.3-5.3a4 4 0 0 0 5-5l-2.6 2.6-2-2z"/></svg>',
    completed:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.3 2.3 4.8-5"/></svg>',
    paid:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16M8 14h3"/></svg>',
    closed:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v12H5zM4 4h16v3H4zM9 11h6"/><path d="M10 15l1.5 1.5L15 13"/></svg>'
  });

  function stageIcon(stage){
    const common={new:'orders',waiting_responses:'chats',accepted:'check',assigned:'car',in_progress:'work',completed:'check',paid:'finance',closed:'archive'};
    return `<span class="k-workflow-stage-icon" aria-hidden="true">${uiIcon(common[stage.key]||'orders')||icons[stage.key]||icons.new}</span>`;
  }

  function stoTicket(order){
    const price=order.price?`${new Intl.NumberFormat('ru-RU').format(Number(order.price))} ₸`:'Цена уточняется';
    return `<a class="k-sto-r75-workflow-row" href="#/orders/item/${encodeURIComponent(order.id)}"><span class="k-sto-r75-workflow-row__number">${esc(order.number?`№ ${order.number}`:order.id)}</span><span class="k-sto-r75-workflow-row__main"><strong>${esc(order.serviceNames||'Заявка на ремонт')}</strong><small>${esc(order.car||order.clientCar||'Автомобиль уточняется')} · ${esc(order.clientName||'Клиент')}</small></span><b>${esc(price)}</b>${uiIcon('chevronRight')}</a>`;
  }

  function column(stage,orders){
    const items=orders.filter(o=>(engine.stageFor(o.status).key===stage.key));
    return `<section class="k-workflow-column" data-workflow-stage="${esc(stage.key)}">
      <header class="k-workflow-column__head">
        ${stageIcon(stage)}
        <div class="k-workflow-column__meta">
          <strong>${esc(stage.label)}</strong>
          <small>${stage.progress}% процесса</small>
        </div>
        <span class="k-workflow-column__count" aria-label="Заявок: ${items.length}">${items.length}</span>
      </header>
      <div class="k-workflow-column__body">${items.length?(currentRole()==='sto'?items.map(stoTicket).join(''):items.map(o=>`<a class="k-workflow-ticket" href="#/orders/item/${encodeURIComponent(o.id)}"><span>${esc(o.number?`№ ${o.number}`:o.id)}</span><strong>${esc(o.serviceNames||'Заявка на ремонт')}</strong><small>${esc(o.car||o.clientCar||'Автомобиль уточняется')}</small><div><em>${esc(o.clientName||'Клиент')}</em><b>${esc(o.price?`${new Intl.NumberFormat('ru-RU').format(Number(o.price))} ₸`:'Цена уточняется')}</b></div></a>`).join('')):'<p class="k-workflow-column__empty">Нет заявок</p>'}</div>
    </section>`;
  }

  function renderWorkflow(context){
    const snapshot=state.getSnapshot();
    const orders=Array.isArray(snapshot.orders)?snapshot.orders:[];
    const sto=currentRole()==='sto';
    const body=sto?`<section class="k-sto-r75-workflow-toolbar"><div><strong>Производство СТО</strong><span>Все этапы ремонта в одном плоском журнале.</span></div><div><a class="k-btn k-btn-secondary" href="#/orders">${uiIcon('orders')}<span>Заказы</span></a><a class="k-btn k-btn-primary" href="#/orders/new">${uiIcon('plus')}<span>Новый заказ</span></a></div></section><section class="k-workflow-board k-workflow-board--sto-r75" data-state-scroll="workflow.board" data-workflow-board>${engine.STAGES.slice(1).map(s=>column(s,orders)).join('')}</section>`:`<section class="k-workflow-hero"><div><span>R179 WORKFLOW ENGINE</span><h2>Единый процесс ремонта</h2><p>Все заявки распределены по этапам: от публикации до закрытия.</p></div><a class="k-btn k-btn-primary" href="#/orders/new">Новая заявка</a></section><section class="k-workflow-board" data-state-scroll="workflow.board" data-workflow-board>${engine.STAGES.slice(1).map(s=>column(s,orders)).join('')}</section>`;
    return ui.pageShell(context,sto?'Производство':'Workflow',sto?'Этапы ремонтов СТО без вложенных карточек.':'Управляйте заявками как единым операционным процессом.',body,{page:sto?'workflow workflow-sto-r75':'workflow',eyebrow:sto?'СТО':'R179',chromeHeader:false});
  }
  function mountWorkflow(context={}){
    const root=document.querySelector('[data-workflow-board]'); if(!root)return;
    const render=()=>{const orders=state.getSnapshot().orders||[];root.innerHTML=engine.STAGES.slice(1).map(s=>column(s,orders)).join('');};
    const unsubscribe=state.subscribe?.(render); context.lifecycle?.addCleanup?.(()=>unsubscribe?.());
    if((state.getSnapshot().phase==='idle'||state.getSnapshot().phase==='error')&&context.api){const id=state.begin();window.KaretaOrdersApi.list(context.api).then(data=>state.resolve(id,data)).catch(error=>state.reject(id,error));}
  }
  window.KaretaWorkflowPages=Object.freeze({renderWorkflow,mountWorkflow});
})();
