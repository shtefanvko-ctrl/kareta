(() => {
  'use strict';
  const ui=window.KaretaPageUI;
  const apiModule=window.KaretaWorkOrderApi;
  if(!ui||!apiModule) throw new Error('Work order dependencies are required');

  const esc=ui.escHtml;
  const money=v=>Number(v||0)>0?`${new Intl.NumberFormat('ru-RU').format(Number(v))} ₸`:'—';
  const bool=v=>Number(v)===1||v===true||v==='1';
  const text=v=>String(v??'').trim();
  const icon=(name,className='k-work-native-icon')=>window.KaretaUIIcons?.svg?.(name,{className})||'';
  const PROFESSIONAL=new Set(['master','sto','admin','owner']);
  const workflowLabels={intake:'Принятие',diagnostics:'Диагностика',estimate:'Смета',approval:'Допработы',work_order:'Запчасти',parts_reservation:'Запчасти',in_progress:'Работы',quality_control:'Контроль',payment:'Подготовка к выдаче',delivery:'Выдача',warranty:'Гарантия',completed:'Завершено'};
  const requirementLabels={diagnostics_report:'Завершите диагностический отчёт',diagnostics_checklist:'Заполните диагностику',estimate_approval:'Получите согласование клиента',pending_extra_quotes:'Дождитесь решения по допработам',parts_not_reserved:'Зарезервируйте необходимые запчасти',unfinished_work_checklist:'Завершите рабочий чек-лист',running_work_timer:'Остановите активный таймер',quality_not_passed:'Проведите контроль качества',payment_confirmation:'Подтвердите оплату',handover_not_ready:'Подготовьте акт выдачи',handover_not_accepted:'Клиент должен подтвердить получение',warranty_not_activated:'Активируйте гарантию'};
  const claimStatusLabels={submitted:'Обращение отправлено',accepted:'Принято по гарантии',inspection:'Осмотр завершён',repair:'Гарантийный ремонт',quality_control:'Контроль качества',ready:'Готово к возврату',completed:'Возврат завершён',rejected:'Отказано',closed:'Закрыто'};
  // Historical contract markers retained for release-gate compatibility; R77 actions use data-work-open instead.
  const R77_LEGACY_CONTRACT='data-lifecycle-click="open-reserve" · Найти в Marketplace · ПОДТВЕРЖДЁННЫЙ ОТЗЫВ';
  const tabs=Object.freeze([
    ['diagnostics','Диагностика','services'],
    ['estimate','Смета','finance'],
    ['extra','Допработы','plus'],
    ['parts','Запчасти','parts'],
    ['quality','Контроль','check'],
    ['delivery','Выдача','car'],
    ['warranty','Гарантия','shield']
  ]);

  const clientTabs=Object.freeze([
    ['diagnostics','Ход работ','services'],
    ['estimate','Смета','finance'],
    ['extra','Согласования','plus'],
    ['parts','Запчасти','parts'],
    ['quality','Проверка','check'],
    ['delivery','Выдача','car'],
    ['warranty','Гарантия','shield']
  ]);
  const clientMilestones=Object.freeze([
    {key:'intake',label:'Принято',stages:['intake']},
    {key:'diagnostics',label:'Диагностика',stages:['diagnostics','estimate','approval']},
    {key:'parts',label:'Запчасти',stages:['work_order','parts_reservation']},
    {key:'repair',label:'Ремонт',stages:['in_progress','quality_control','payment']},
    {key:'ready',label:'Готово',stages:['delivery','warranty','completed']},
  ]);
  const clientStatusLabels=Object.freeze({
    new:'Создано',pending:'Ожидает мастера',accepted:'Принято',confirmed:'Подтверждено',diagnostics:'Диагностика',
    in_progress:'В работе',process:'В работе',work:'В работе',quality_control:'Проверка',payment:'Подготовка к выдаче',ready:'Готово',
    done_pending:'Готово к выдаче',done_pending_client:'Готово к выдаче',master_selected:'Мастер выбран',
    delivery:'Выдача',done:'Завершено',completed:'Завершено',cancelled:'Отменено',canceled:'Отменено'
  });

  function orderId(){ const m=String(location.hash).match(/^#\/orders\/item\/([^/?]+)/); return m?decodeURIComponent(m[1]):''; }
  function effectiveWorkOrderRole(workflowData){
    const lifecycleRole=text(workflowData?.lifecycle?.actor?.role).toLowerCase();
    if(lifecycleRole)return lifecycleRole;
    const surfaceRole=text(document.documentElement?.dataset?.userRole).toLowerCase();
    return surfaceRole||'client';
  }
  function friendlyStage(value){ const key=text(value); return workflowLabels[key]||key.replaceAll('_',' ')||'Этап ремонта'; }
  function clientStageLabel(value){
    const key=text(value);
    return ({intake:'Принято',diagnostics:'Диагностика',estimate:'Смета',approval:'Согласования',work_order:'Запчасти',parts_reservation:'Запчасти',in_progress:'Ремонт',quality_control:'Проверка',payment:'Подготовка к выдаче',delivery:'Выдача',warranty:'Гарантия',completed:'Завершено'})[key]||friendlyStage(key);
  }
  function renderWorkOrder(context){
    return ui.pageShell(context,'Заказ-наряд','Единый рабочий центр ремонта.',`<div id="k-work-order" class="k-work-order k-work-order-r77 k-work-order-r84" data-phase="loading"><section class="k-empty"><h2>Загрузка заказ-наряда</h2><p>Получаем актуальное состояние ремонта.</p></section></div>`,{page:'work-order',eyebrow:'WORK ORDER',chromeHeader:false});
  }
  function tabForStage(stage){
    if(['intake','diagnostics','in_progress'].includes(stage))return 'diagnostics';
    if(stage==='estimate')return 'estimate';
    if(stage==='approval')return 'extra';
    if(['work_order','parts_reservation'].includes(stage))return 'parts';
    if(stage==='quality_control')return 'quality';
    if(['payment','delivery'].includes(stage))return 'delivery';
    if(['warranty','completed'].includes(stage))return 'warranty';
    return 'diagnostics';
  }
  function choiceField(name,label,options,currentValue='',className=''){
    const list=(Array.isArray(options)?options:[]).filter(Boolean);
    const selected=String(currentValue||list[0]?.value||'');
    return `<fieldset class="k-work-choice ${esc(className)}" data-work-choice-field="${esc(name)}"><legend>${esc(label)}</legend><input type="hidden" name="${esc(name)}" value="${esc(selected)}">${list.map(item=>`<button type="button" class="${String(item.value)===selected?'is-active':''}" data-work-choice data-choice-name="${esc(name)}" data-choice-value="${esc(item.value)}"${item.price!==undefined?` data-choice-price="${esc(item.price)}"`:''}${item.cost!==undefined?` data-choice-cost="${esc(item.cost)}"`:''}><span>${item.icon?icon(item.icon,'k-work-choice__icon'):''}<b>${esc(item.label)}</b></span>${item.meta?`<small>${esc(item.meta)}</small>`:''}</button>`).join('')}</fieldset>`;
  }
  function workflowProgress(workflowData){
    const wf=workflowData?.workflow||{},stages=Array.isArray(workflowData?.stages)?workflowData.stages:[],current=String(wf.current_stage||'intake'),index=stages.indexOf(current);
    if(!stages.length)return '';
    return `<div class="k-work-progress" aria-label="Этап ремонта">${stages.map((stage,i)=>`<span class="${stage===current?'is-current':i<index?'is-done':''}"><i>${i<index?icon('check'):String(i+1)}</i><b>${esc(workflowLabels[stage]||stage)}</b></span>`).join('')}</div>`;
  }
  function nextRequirement(workflowData){
    const allowed=Array.isArray(workflowData?.allowedNext)?workflowData.allowedNext:[],requirements=workflowData?.requirements||{};
    if(!allowed.length)return '';
    const stage=allowed[0],missing=Array.isArray(requirements[stage])?requirements[stage]:[];
    return `<div class="k-work-next"><span>${icon(missing.length?'warning':'check')}</span><div><small>Следующий этап</small><b>${esc(workflowLabels[stage]||stage)}</b>${missing.length?`<p>${missing.map(x=>esc(requirementLabels[x]||x)).join(' · ')}</p>`:'<p>Все обязательные условия выполнены.</p>'}</div></div>`;
  }
  function summaryRow(o){
    return `<div class="k-work-summary-r77 k-work-summary-r84"><span><small>Клиент</small><b>${esc(o.clientName||'Клиент')}</b><em>${esc(o.clientPhone||'')}</em></span><span><small>Автомобиль</small><b>${esc(o.clientCar||o.vehicleTitle||'Не указан')}</b><em>${esc([o.date,o.time].filter(Boolean).join(' · '))}</em></span><span><small>Исполнитель</small><b>${esc(o.masterName||o.stoName||'Не назначен')}</b><em>${esc(o.stoName||'')}</em></span><span><small>Стоимость</small><b>${money(o.price)}</b><em>${esc(o.status||'new')}</em></span></div>`;
  }
  function checklist(items,editable=true){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return '<p class="k-work-muted">Чек-лист появится после принятия заказа.</p>';
    return `<div class="k-work-flat-list">${rows.map(x=>`<label class="k-work-flat-row k-work-check ${Number(x.done)?'is-done':''}"><input type="checkbox" data-check-id="${esc(x.id)}" ${Number(x.done)?'checked':''} ${editable?'':'disabled'}><span>${icon(Number(x.done)?'check':'orders')}<div><b>${esc(x.title)}</b><small>${esc(x.stageKey?friendlyStage(x.stageKey):'Общий этап')}</small></div></span></label>`).join('')}</div>`;
  }
  function mediaGrid(items){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return '<p class="k-work-muted">Фото, видео и документы пока не добавлены.</p>';
    return `<div class="k-work-media-r77">${rows.map(x=>{const type=String(x.mediaType||'photo'),url=esc(x.fileUrl||''),preview=type==='video'?`<video src="${url}" preload="metadata" muted playsinline controls></video>`:type==='document'?`<div class="k-work-doc-preview">${icon('document')}<b>Документ</b></div>`:`<img src="${url}" alt="${esc(x.caption||'Материал по ремонту')}" loading="lazy">`;return `<a href="${url}" target="_blank" rel="noopener"><span>${preview}</span><b>${esc(x.caption||'Материал по ремонту')}</b><small>${esc(x.stageKey?friendlyStage(x.stageKey):'Без этапа')} · ${esc(x.createdAt||'')}</small></a>`;}).join('')}</div>`;
  }
  function timerBlock(data,professional){
    const active=(Array.isArray(data.timers)?data.timers:[]).find(t=>t.status==='running');
    if(!professional){
      return `<div class="k-work-timer-r77 k-client-work-timer ${active?'is-running':''}"><span>${icon('clock')}</span><div><small>Рабочее время</small><b>${active?'Исполнитель работает':'Работы ещё не начались'}</b><p>${active?`${esc(clientStageLabel(active.stageKey))} · начато ${esc(active.startedAt||'')}`:'Когда исполнитель начнёт диагностику или ремонт, статус обновится здесь.'}</p></div></div>`;
    }
    return `<div class="k-work-timer-r77 ${active?'is-running':''}"><span>${icon('clock')}</span><div><small>Рабочий таймер</small><b>${active?`Идёт: ${esc(friendlyStage(active.stageKey))}`:'Не запущен'}</b><p>${active?`Начат ${esc(active.startedAt||'')}`:'Запускайте таймер только на фактическую диагностику или ремонт.'}</p></div>${active?`<button class="k-btn k-btn-primary" data-work-stop-timer="${esc(active.id)}">Завершить</button>`:`<div><button class="k-btn k-btn-secondary" data-work-start-timer="diagnostics">Диагностика</button><button class="k-btn k-btn-primary" data-work-start-timer="in_progress">Ремонт</button></div>`}</div>`;
  }
  function diagnosticsTab(data,workflowData,professional){
    const lc=workflowData?.lifecycle||{},d=lc.diagnostics||{};
    return `<section class="k-work-tab-panel" data-work-panel="diagnostics"><div class="k-work-panel-head"><div><span>${icon('services')}</span><div><small>Диагностика и выполнение</small><h2>${d.completedAt?'Диагностика завершена':'Текущее техническое состояние'}</h2></div></div>${professional?'<button class="k-btn k-btn-secondary" type="button" data-work-open="diagnostics">Открыть отчёт</button>':''}</div>${timerBlock(data,professional)}<div class="k-work-facts-r77"><span><small>Жалоба клиента</small><b>${esc(d.complaints||'Не зафиксирована')}</b></span><span><small>Результат диагностики</small><b>${esc(d.findings||'Не заполнен')}</b></span><span><small>Рекомендации</small><b>${esc(d.recommendations||'Нет')}</b></span><span><small>Запчасти</small><b>${bool(d.partsRequired)?'Требуются':'Не отмечены как обязательные'}</b></span></div><div class="k-work-subsection"><header><div><small>Проверки</small><h3>Чек-лист заказа</h3></div></header>${checklist(data.checklist||[],professional)}</div><div class="k-work-subsection"><header><div><small>Фиксация</small><h3>Материалы ремонта</h3></div>${professional?'<div class="k-work-inline-actions"><button class="k-btn k-btn-secondary" data-work-media-stage="diagnostics">Диагностика</button><button class="k-btn k-btn-secondary" data-work-media-stage="in_progress">В процессе</button><button class="k-btn k-btn-secondary" data-work-action="add-media">Добавить</button></div>':''}</header>${mediaGrid(data.media||[])}</div></section>`;
  }
  function costRows(costs){
    if(!costs.length)return '<p class="k-work-muted">Фактические расходы пока не зафиксированы.</p>';
    return `<div class="k-work-flat-list">${costs.map(c=>`<div class="k-work-flat-row"><span>${icon('finance')}<div><b>${esc(c.title)}</b><small>${esc(c.costType)} · ${esc(c.quantity)} × ${money(c.unitCost)} · ${esc(c.sourceType)}</small></div></span><strong>${money(c.totalCost)}</strong>${c.sourceType==='manual'?`<button type="button" class="k-work-icon-button" data-aftercare-click="cost-delete" data-cost-id="${esc(c.id)}" aria-label="Удалить расход">${icon('trash')}</button>`:''}</div>`).join('')}</div>`;
  }
  function estimateTab(data,workflowData,professional){
    const o=data.order||{},lc=workflowData?.lifecycle||{},after=lc.aftercare||{},f=after.financialResult||{},settings=after.financeSettings||{},costs=Array.isArray(after.costEntries)?after.costEntries:[];
    if(!professional){
      const final=Number(o.finalPrice||o.price||0),labor=Number(o.laborPrice||0),parts=Number(o.partsPrice||0),extraQuotes=Array.isArray(lc.extraQuotes)?lc.extraQuotes:[],acceptedExtra=extraQuotes.filter(q=>String(q.status||'')==='accepted').reduce((sum,q)=>sum+Number(q.totalPrice||0),0);
      return `<section class="k-work-tab-panel k-client-work-estimate" data-work-panel="estimate"><div class="k-work-panel-head"><div><span>${icon('finance')}</span><div><small>Стоимость ремонта</small><h2>Смета для клиента</h2></div></div></div><div class="k-client-work-price-summary"><span><small>Текущая сумма</small><b>${money(final)}</b></span>${labor>0?`<span><small>Работы</small><b>${money(labor)}</b></span>`:''}${parts>0?`<span><small>Запчасти</small><b>${money(parts)}</b></span>`:''}${acceptedExtra>0?`<span><small>Согласованные допработы</small><b>${money(acceptedExtra)}</b></span>`:''}</div><p class="k-client-work-price-note">Сумма обновляется только после вашего согласования дополнительных работ и запчастей.</p></section>`;
    }
    return `<section class="k-work-tab-panel" data-work-panel="estimate"><div class="k-work-panel-head"><div><span>${icon('finance')}</span><div><small>Смета и фактический результат</small><h2>Финансы заказ-наряда</h2></div></div><div class="k-work-inline-actions"><button class="k-btn k-btn-secondary" data-work-open="finance-settings">Параметры</button><button class="k-btn k-btn-primary" data-work-open="cost">Добавить расход</button></div></div><div class="k-work-kpi-strip"><span><small>Сумма заказа</small><b>${money(o.price)}</b></span><span><small>Выручка</small><b>${money(f.revenueTotal)}</b></span><span><small>Себестоимость</small><b>${money(f.directCostTotal)}</b></span><span class="${Number(f.grossProfit||0)<0?'is-loss':'is-profit'}"><small>Валовая прибыль</small><b>${money(f.grossProfit)}</b></span><span><small>Маржа</small><b>${Number(f.marginPercent||0).toFixed(1)}%</b></span></div><div class="k-work-settings-line"><span><small>Себестоимость часа</small><b>${money(settings.laborCostPerHour)}</b></span><span><small>Накладные</small><b>${Number(settings.overheadPercent||0).toFixed(1)}%</b></span><span><small>Резерв гарантии</small><b>${Number(settings.warrantyReservePercent||0).toFixed(1)}%</b></span></div><div class="k-work-subsection"><header><div><small>Факт</small><h3>Расходы по заказу</h3></div></header>${costRows(costs)}</div></section>`;
  }
  function quoteRows(quotes,role){
    const rows=Array.isArray(quotes)?quotes:[];
    if(!rows.length)return '<p class="k-work-muted">Дополнительные работы не запрашивались.</p>';
    return `<div class="k-work-flat-list">${rows.map(q=>`<div class="k-work-flat-row is-${esc(q.status||'pending')}"><span>${icon(q.status==='accepted'?'check':q.status==='declined'?'close':'clock')}<div><b>${esc(q.title||'Дополнительные работы')}</b><small>${esc(q.comment||'Без комментария')} · ${q.status==='pending'?'ожидает решения':q.status==='accepted'?'согласовано':'отклонено'}</small></div></span><strong>${money(q.totalPrice)}</strong>${role==='client'&&q.status==='pending'?`<div class="k-work-row-actions"><button class="k-btn k-btn-primary" data-extra-decision="approved" data-quote-id="${esc(q.id)}">Согласовать</button><button class="k-btn k-btn-secondary" data-extra-decision="declined" data-quote-id="${esc(q.id)}">Отклонить</button></div>`:''}</div>`).join('')}</div>`;
  }
  function extraTab(workflowData,professional,role){
    const quotes=workflowData?.lifecycle?.extraQuotes||[];
    return `<section class="k-work-tab-panel" data-work-panel="extra"><div class="k-work-panel-head"><div><span>${icon('plus')}</span><div><small>Изменение объёма ремонта</small><h2>Дополнительные работы</h2></div></div>${professional?'<button class="k-btn k-btn-primary" data-work-open="extra">Запросить согласование</button>':''}</div>${quoteRows(quotes,role)}</section>`;
  }
  function reservationRows(items){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return '<p class="k-work-muted">Резерв запчастей пока пуст.</p>';
    return `<div class="k-work-flat-list">${rows.map(x=>{const issued=Number(x.qtyIssued||0),returned=Number(x.qtyReturned||0),returnable=Math.max(0,issued-returned);return `<div class="k-work-flat-row"><span>${icon('parts')}<div><b>${esc(x.partName)}</b><small>${esc([x.oem&&`OEM ${x.oem}`,x.sku&&`SKU ${x.sku}`,x.supplierLabel,x.warehouseId&&`Склад #${x.warehouseId}`].filter(Boolean).join(' · '))}</small></div></span><strong>${esc(x.qtyReserved)} / ${esc(x.qtyRequested)}</strong><em>${money(x.unitPrice)}</em>${returnable>0?`<button class="k-btn k-btn-secondary" data-aftercare-click="inventory-return" data-reservation-id="${esc(x.id)}" data-returnable="${esc(returnable)}">Вернуть ${esc(returnable)}</button>`:''}</div>`;}).join('')}</div>`;
  }
  function clientReservationRows(items){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return '<p class="k-work-muted">Запчасти пока не добавлены в заказ.</p>';
    return `<div class="k-work-flat-list k-client-work-parts-list">${rows.map(x=>`<div class="k-work-flat-row"><span>${icon('parts')}<div><b>${esc(x.partName||'Запчасть')}</b><small>${esc([x.oem&&`OEM ${x.oem}`,x.sku&&`SKU ${x.sku}`,x.status==='reserved'?'Зарезервировано':x.status==='issued'?'Выдано в работу':'В заказе'].filter(Boolean).join(' · '))}</small></div></span><strong>${esc(x.qtyReserved||x.qtyRequested||1)} шт.</strong>${Number(x.unitPrice||0)>0?`<em>${money(x.unitPrice)}</em>`:''}</div>`).join('')}</div>`;
  }
  function installedPartRows(parts,professional){
    const rows=Array.isArray(parts)?parts:[];
    return `<div class="k-work-subsection"><header><div><small>Факт ремонта</small><h3>Установленные детали</h3></div>${professional?'<button class="k-btn k-btn-secondary" data-work-action="add-part">Добавить</button>':''}</header>${rows.length?`<div class="k-work-flat-list">${rows.map(p=>`<div class="k-work-flat-row"><span>${icon('parts')}<div><b>${esc(p.name)}</b><small>Установлено в заказе</small></div></span><strong>${esc(p.qty||1)} × ${money(p.price)}</strong></div>`).join('')}</div>`:'<p class="k-work-muted">Установленные детали ещё не зафиксированы.</p>'}</div>`;
  }
  function partsTab(data,workflowData,professional){
    const lc=workflowData?.lifecycle||{},readiness=lc.readiness||{};
    if(!professional){
      return `<section class="k-work-tab-panel k-client-work-parts" data-work-panel="parts"><div class="k-work-panel-head"><div><span>${icon('parts')}</span><div><small>Детали ремонта</small><h2>Запчасти</h2></div></div></div><div class="k-work-status-line"><span>${icon(readiness.partsRequired?'warning':'info')}</span><div><b>${readiness.partsRequired?'Для ремонта нужны запчасти':'Обязательные запчасти не отмечены'}</b><small>${readiness.partsRequired?(readiness.partsReserved?'Необходимые позиции зарезервированы.':'Исполнитель формирует резерв необходимых деталей.'):'Исполнитель обновит этот раздел, если потребуются детали.'}</small></div></div><div class="k-work-subsection"><header><div><small>В заказе</small><h3>Подобранные позиции</h3></div></header>${clientReservationRows(lc.reservations||[])}</div>${installedPartRows(data.order?.orderParts||[],false)}</section>`;
    }
    return `<section class="k-work-tab-panel" data-work-panel="parts"><div class="k-work-panel-head"><div><span>${icon('parts')}</span><div><small>Резерв и расход</small><h2>Запчасти ремонта</h2></div></div><div class="k-work-inline-actions"><a class="k-btn k-btn-secondary" href="#/parts?orderId=${encodeURIComponent(data.order?.id||'')}">Новые запчасти</a><button class="k-btn k-btn-secondary" data-work-open="inventory">Со склада</button><button class="k-btn k-btn-primary" data-work-open="reserve">Внешний резерв</button></div></div><div class="k-work-status-line"><span>${icon(readiness.partsRequired?'warning':'info')}</span><div><b>${readiness.partsRequired?'Запчасти обязательны по диагностике':'Обязательные детали не отмечены'}</b><small>${readiness.partsRequired?'Перед началом работ резерв должен быть полным.':'Заказ можно продолжить без обязательного резерва.'}</small></div></div><div class="k-work-subsection"><header><div><small>Резерв</small><h3>Зарезервированные позиции</h3></div></header>${reservationRows(lc.reservations||[])}</div>${installedPartRows(data.order?.orderParts||[],true)}</section>`;
  }
  function qualityRows(items){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return '<p class="k-work-muted">Контроль качества ещё не проводился.</p>';
    return `<div class="k-work-flat-list">${rows.map(x=>`<div class="k-work-flat-row is-${esc(x.result)}"><span>${icon(x.result==='pass'?'check':'warning')}<div><b>Попытка ${esc(x.attemptNo)} · ${x.result==='pass'?'Пройдено':'Нужна доработка'}</b><small>${esc(x.notes||'Без комментария')}</small></div></span><em>${esc(x.checkedAt||'')}</em></div>`).join('')}</div>`;
  }
  function eventRows(items){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return '<p class="k-work-muted">История появится после первых действий.</p>';
    return `<div class="k-work-history-r77">${rows.slice(0,40).map(x=>`<div><i></i><span><b>${esc(String(x.eventType||'Событие').replaceAll('_',' '))}</b><small>${esc(x.actorRole||'system')} · ${esc(x.createdAt||'')}</small></span></div>`).join('')}</div>`;
  }
  function reportRows(reports){
    const rows=Array.isArray(reports)?reports:[];
    if(!rows.length)return '<p class="k-work-muted">Отчётов пока нет.</p>';
    return `<div class="k-work-flat-list">${rows.map(r=>`<div class="k-work-flat-row"><span>${icon('document')}<div><b>${esc(r.actorLabel||'Мастер')}</b><small>${esc(r.text||r.body||'Обновление работы')}</small></div></span><em>${esc(r.createdAt||'')}</em></div>`).join('')}</div>`;
  }
  function qualityTab(data,workflowData,professional){
    const lc=workflowData?.lifecycle||{};
    if(!professional){
      return `<section class="k-work-tab-panel k-client-work-quality" data-work-panel="quality"><div class="k-work-panel-head"><div><span>${icon('check')}</span><div><small>Финальная проверка</small><h2>Контроль качества</h2></div></div></div><div class="k-work-subsection"><header><div><small>Результат</small><h3>Проверки автомобиля</h3></div></header>${qualityRows(lc.qualityChecks||[])}</div><div class="k-work-subsection"><header><div><small>Обновления</small><h3>Что сообщил исполнитель</h3></div></header>${reportRows(data.reports||[])}</div></section>`;
    }
    return `<section class="k-work-tab-panel" data-work-panel="quality"><div class="k-work-panel-head"><div><span>${icon('check')}</span><div><small>Проверка результата</small><h2>Контроль качества и история</h2></div></div><button class="k-btn k-btn-primary" data-work-open="quality">Провести контроль</button></div><div class="k-work-subsection"><header><div><small>Контроль</small><h3>Результаты проверок</h3></div></header>${qualityRows(lc.qualityChecks||[])}</div><div class="k-work-subsection"><header><div><small>Отчёты</small><h3>Рабочие записи</h3></div></header>${reportRows(data.reports||[])}</div><div class="k-work-subsection"><header><div><small>Аудит</small><h3>История действий</h3></div></header>${eventRows(data.events||[])}</div></section>`;
  }
  function publicationBlock(data,workflowData,o){
    const lc=workflowData?.lifecycle||{},policy=lc.publicationPolicy||{},role=effectiveWorkOrderRole(workflowData);
    if(!data.publication)return '<p class="k-work-muted">Черновик публикации пока не сформирован.</p>';
    if(data.publication.status==='published')return `<div class="k-work-publication-row"><span>${icon('community')}<div><small>Публикация</small><b>${esc(data.publication.title)}</b><p>${esc(data.publication.body)}</p></div></span><a class="k-btn k-btn-primary" href="#/works/item/work_${encodeURIComponent(o.id)}">Открыть</a></div>`;
    const consent=bool(policy.clientConsent);
    return `<div class="k-work-publication-row"><span>${icon('community')}<div><small>Черновик публикации</small><b>${esc(data.publication.title)}</b><p>${esc(data.publication.body)}</p></div></span>${role==='client'?'<em>Настраивается при выдаче</em>':consent?'<button class="k-btn k-btn-primary" data-work-action="publish-post">Опубликовать</button>':'<em>Нет согласия клиента</em>'}</div>`;
  }
  function clientNextStep(workflowData){
    const stage=String(workflowData?.workflow?.current_stage||'intake');
    const copy={
      intake:['Заявка принята','Исполнитель подтверждает заказ и готовит автомобиль к диагностике.'],
      diagnostics:['Идёт диагностика','Исполнитель проверяет автомобиль и фиксирует результаты.'],
      estimate:['Формируется смета','После диагностики появится стоимость работ и необходимых запчастей.'],
      approval:['Нужно ваше решение','Проверьте новые работы во вкладке «Согласования».'],
      work_order:['Подбираются запчасти','Исполнитель формирует список деталей для ремонта.'],
      parts_reservation:['Резервируются запчасти','Необходимые детали подготавливаются к ремонту.'],
      in_progress:['Автомобиль в ремонте','Исполнитель выполняет согласованные работы.'],
      quality_control:['Финальная проверка','После ремонта автомобиль проходит контроль качества.'],
      payment:['Ремонт завершён','Исполнитель готовит расчёт и автомобиль к выдаче.'],
      delivery:['Автомобиль готов к выдаче','Проверьте условия выдачи и подтвердите получение автомобиля.'],
      warranty:['Гарантия действует','Условия гарантии и обращения доступны в соответствующем разделе.'],
      completed:['Заказ завершён','История ремонта, документы и гарантия сохраняются в заказе.']
    };
    const item=copy[stage]||['Заказ обновляется','Следите за текущим этапом ремонта в этой карточке.'];
    return `<div class="k-client-work-next"><span>${icon(['delivery','warranty','completed'].includes(stage)?'check':'clock')}</span><div><small>Что сейчас</small><b>${esc(item[0])}</b><p>${esc(item[1])}</p></div></div>`;
  }
  function clientHandoverDocuments(value){
    const docs=Array.isArray(value)?value:[];
    if(!docs.length)return '<p class="k-work-muted">Документы выдачи пока не добавлены.</p>';
    const safeUrl=url=>/^(?:https?:\/\/|\/(?!\/)|#)/i.test(text(url))?text(url):'';
    return `<div class="k-client-work-documents">${docs.map((item,index)=>{const obj=item&&typeof item==='object'?item:null,label=text(obj?.label||obj?.name||obj?.title||obj?.fileName||(typeof item==='string'?item:'')||`Документ ${index+1}`),url=safeUrl(obj?.url||obj?.fileUrl||obj?.href);return url?`<a href="${esc(url)}" target="_blank" rel="noopener"><span>${icon('document')}</span><div><b>${esc(label)}</b><small>Открыть документ</small></div>${icon('chevronRight')}</a>`:`<div><span>${icon('document')}</span><div><b>${esc(label)}</b><small>Документ сохранён в заказе</small></div></div>`;}).join('')}</div>`;
  }
  function warrantyStatusLabel(value){
    return ({active:'Действует',draft:'Подготавливается',expired:'Срок истёк',closed:'Завершена',inactive:'Не активирована'})[String(value||'').toLowerCase()]||text(value)||'Не активирована';
  }
  function deliveryTab(data,workflowData,professional,role){
    const o=data.order||{},lc=workflowData?.lifecycle||{},handover=lc.handover||{},warranty=lc.warranty||{},policy=lc.publicationPolicy||{};
    if(!professional&&role==='client'){
      const ready=['ready','accepted'].includes(String(handover.status||'')),details=[handover.odometerKm&&`Пробег ${handover.odometerKm} км`,handover.fuelLevel&&`Топливо: ${handover.fuelLevel}`,handover.keysCount!==undefined&&handover.keysCount!==null&&`Ключи: ${handover.keysCount}`].filter(Boolean).join(' · ');
      return `<section class="k-work-tab-panel k-client-work-delivery" data-work-panel="delivery"><div class="k-work-panel-head"><div><span>${icon('car')}</span><div><small>Получение автомобиля</small><h2>${ready?'Автомобиль готов к выдаче':'Подготовка к выдаче'}</h2></div></div></div><div class="k-work-facts-r77"><span><small>Статус</small><b>${esc(handover.status||'Готовится')}</b></span><span><small>Оплата</small><b>${esc(handover.paymentStatus||'Уточняется')}</b></span><span><small>Гарантия</small><b>${esc(warrantyStatusLabel(warranty.status))}</b></span><span><small>Параметры выдачи</small><b>${esc(details||'Будут заполнены исполнителем')}</b></span></div>${text(handover.notes)?`<div class="k-client-work-handover-note"><span>${icon('info')}</span><div><small>Комментарий при выдаче</small><p>${esc(handover.notes)}</p></div></div>`:''}<div class="k-work-subsection"><header><div><small>Документы</small><h3>Документы по ремонту и выдаче</h3></div></header>${clientHandoverDocuments(handover.documents)}</div>${data.publication?`<div class="k-work-subsection"><header><div><small>Сообщество</small><h3>Публикация о выполненной работе</h3></div></header>${publicationBlock(data,workflowData,o)}</div>`:''}${String(o.status||'')==='done'?reviewBlock():''}</section>`;
    }
    return `<section class="k-work-tab-panel" data-work-panel="delivery"><div class="k-work-panel-head"><div><span>${icon('car')}</span><div><small>Расчёт и передача автомобиля</small><h2>Выдача клиенту</h2></div></div><div class="k-work-inline-actions">${professional?'<button class="k-btn k-btn-secondary" data-work-open="warranty">Условия гарантии</button><button class="k-btn k-btn-primary" data-work-open="handover">Подготовить выдачу</button>':role==='client'&&['ready','accepted'].includes(String(handover.status||''))?'<button class="k-btn k-btn-primary" data-work-open="delivery">Подтвердить получение</button>':''}</div></div><div class="k-work-facts-r77"><span><small>Статус акта</small><b>${esc(handover.status||'Не подготовлен')}</b></span><span><small>Оплата</small><b>${esc(handover.paymentStatus||'Не зафиксирована')}</b></span><span><small>Гарантия</small><b>${warranty.status==='active'?'Активна':warranty.warrantyDays?`${esc(warranty.warrantyDays)} дней`:'Не настроена'}</b></span><span><small>Публикация</small><b>${bool(policy.clientConsent)?'Клиент разрешил':'Нет согласия'}</b></span></div><div class="k-work-subsection"><header><div><small>Портфолио</small><h3>Публикация завершённой работы</h3></div>${professional?'<button class="k-btn k-btn-secondary" data-work-action="prepare-post">Обновить черновик</button>':''}</header>${publicationBlock(data,workflowData,o)}</div>${String(o.status||'')==='done'&&role==='client'?reviewBlock():''}</section>`;
  }
  function reviewRatingField(name,label,selected=5){return `<fieldset><legend>${esc(label)}</legend><div class="k-native-rating-buttons">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="${esc(name)}" value="${n}" ${Number(selected)===n?'checked':''}><span>${n} ★</span></label>`).join('')}</div></fieldset>`;}
  function reviewBlock(){return `<div class="k-work-subsection"><header><div><small>После выдачи</small><h3>Подтверждённый отзыв</h3></div></header><form data-work-review-form class="k-work-review-native-rating">${reviewRatingField('stars','Общая оценка')}${reviewRatingField('qualityRating','Качество')}${reviewRatingField('timingRating','Сроки')}${reviewRatingField('neatnessRating','Аккуратность')}${reviewRatingField('communicationRating','Общение')}<label>Комментарий<textarea name="text" rows="4" maxlength="4000" required></textarea></label><button class="k-btn k-btn-primary" type="submit">Опубликовать отзыв</button><output data-work-review-status></output></form></div>`;}
  function claimRows(claims){
    const rows=Array.isArray(claims)?claims:[];
    if(!rows.length)return '<p class="k-work-muted">Гарантийных обращений ещё не было.</p>';
    return `<div class="k-work-flat-list">${rows.map(c=>`<div class="k-work-flat-row is-${esc(c.status||'submitted')}"><span>${icon('shield')}<div><b>Обращение №${esc(c.claimNo||1)} · ${esc(claimStatusLabels[c.status]||c.status)}</b><small>${esc(c.issueText||'Гарантийное обращение')} · ${esc(c.symptoms||c.inspectionNotes||'')}</small></div></span><em>${esc(c.openedAt||'')}</em></div>`).join('')}</div>`;
  }
  function warrantyControls(workflowData){
    const lc=workflowData?.lifecycle||{},after=lc.aftercare||{},claim=after.activeClaim||null,warranty=lc.warranty||{},role=effectiveWorkOrderRole(workflowData),professional=PROFESSIONAL.has(role),client=role==='client',closed=!claim||['rejected','completed','closed'].includes(String(claim.status||''));
    if(client&&String(warranty.status||'')==='active'&&closed)return '<button class="k-btn k-btn-primary" data-work-open="claim-submit">Создать гарантийное обращение</button>';
    if(claim&&professional&&claim.status==='submitted')return `<div class="k-work-inline-actions"><button class="k-btn k-btn-primary" data-aftercare-click="claim-accept" data-claim-id="${esc(claim.id)}">Принять на проверку</button><button class="k-btn k-btn-secondary" data-work-open="claim-reject" data-claim-id="${esc(claim.id)}">Отказать</button></div>`;
    if(claim&&professional&&['accepted','inspection'].includes(claim.status))return `<button class="k-btn k-btn-primary" data-work-open="claim-inspect" data-claim-id="${esc(claim.id)}">Открыть осмотр</button>`;
    if(claim&&professional&&claim.status==='repair')return `<button class="k-btn k-btn-primary" data-work-open="claim-repair" data-claim-id="${esc(claim.id)}">Завершить гарантийный ремонт</button>`;
    if(claim&&professional&&claim.status==='quality_control')return `<button class="k-btn k-btn-primary" data-work-open="claim-quality" data-claim-id="${esc(claim.id)}">Контроль гарантии</button>`;
    if(claim&&client&&claim.status==='ready')return `<button class="k-btn k-btn-primary" data-aftercare-click="claim-confirm" data-claim-id="${esc(claim.id)}">Подтвердить получение</button>`;
    return '';
  }
  function warrantyTab(workflowData){
    const lc=workflowData?.lifecycle||{},after=lc.aftercare||{},claims=Array.isArray(after.claims)?after.claims:[],w=lc.warranty||{},claim=after.activeClaim||null,role=effectiveWorkOrderRole(workflowData),client=role==='client';
    if(client){
      return `<section class="k-work-tab-panel k-client-work-warranty" data-work-panel="warranty"><div class="k-work-panel-head"><div><span>${icon('shield')}</span><div><small>После ремонта</small><h2>Гарантия</h2></div></div>${warrantyControls(workflowData)}</div><div class="k-client-work-warranty-summary"><span><small>Статус</small><b>${esc(warrantyStatusLabel(w.status))}</b></span><span><small>Срок</small><b>${Number(w.warrantyDays||0)>0?`${esc(w.warrantyDays)} дней`:'Не указан'}</b></span><span><small>Начало</small><b>${esc(w.startsAt||'—')}</b></span><span><small>Окончание</small><b>${esc(w.endsAt||'—')}</b></span></div>${text(w.scopeText)||text(w.exclusionsText)?`<div class="k-client-work-warranty-terms">${text(w.scopeText)?`<article><span>${icon('check')}</span><div><small>Распространяется на</small><p>${esc(w.scopeText)}</p></div></article>`:''}${text(w.exclusionsText)?`<article><span>${icon('info')}</span><div><small>Исключения</small><p>${esc(w.exclusionsText)}</p></div></article>`:''}</div>`:''}${claim?`<div class="k-work-status-line"><span>${icon('info')}</span><div><b>${esc(claimStatusLabels[claim.status]||claim.status)}</b><small>${esc(claim.issueText||'Гарантийное обращение')}</small></div></div>`:''}<div class="k-work-subsection"><header><div><small>Обращения</small><h3>История по гарантии</h3></div></header>${claimRows(claims)}</div></section>`;
    }
    return `<section class="k-work-tab-panel" data-work-panel="warranty"><div class="k-work-panel-head"><div><span>${icon('shield')}</span><div><small>После ремонта</small><h2>Гарантия и возврат</h2></div></div>${warrantyControls(workflowData)}</div><div class="k-work-facts-r77"><span><small>Статус гарантии</small><b>${esc(w.status||'Не активирована')}</b></span><span><small>Срок</small><b>${Number(w.warrantyDays||0)>0?`${esc(w.warrantyDays)} дней`:'Не установлен'}</b></span><span><small>Начало</small><b>${esc(w.startsAt||'—')}</b></span><span><small>Окончание</small><b>${esc(w.endsAt||'—')}</b></span></div>${claim?`<div class="k-work-status-line"><span>${icon('info')}</span><div><b>${esc(claimStatusLabels[claim.status]||claim.status)}</b><small>${esc(claim.issueText||'Гарантийное обращение')}</small></div></div>`:''}<div class="k-work-subsection"><header><div><small>История</small><h3>Гарантийные обращения</h3></div></header>${claimRows(claims)}</div></section>`;
  }
  function actionZone(workflowData){
    const lc=workflowData?.lifecycle||{},role=effectiveWorkOrderRole(workflowData),professional=PROFESSIONAL.has(role),client=role==='client',stage=String(workflowData?.workflow?.current_stage||'intake'),readiness=lc.readiness||{},handover=lc.handover||{};
    let body='';
    if(professional&&stage==='intake')body=`<button class="k-btn k-btn-primary" data-lifecycle-click="accept">Принять в работу</button>`;
    if(professional&&stage==='diagnostics')body=`<button class="k-btn k-btn-primary" data-work-open="diagnostics">Диагностический отчёт</button>`;
    if(professional&&stage==='estimate')body=`<button class="k-btn k-btn-secondary" data-lifecycle-click="skip-extra">Допработы не нужны</button><button class="k-btn k-btn-primary" data-work-open="extra">Запросить допработы</button>`;
    if(stage==='approval')body=client?'<span>Примите решение во вкладке «Согласования».</span>':'<span>Ожидается решение клиента по дополнительным работам.</span>';
    if(professional&&['work_order','parts_reservation'].includes(stage))body=`<button class="k-btn k-btn-secondary" data-work-open="inventory">Со склада</button><button class="k-btn k-btn-secondary" data-work-open="reserve">Внешний резерв</button><button class="k-btn k-btn-primary" data-lifecycle-click="parts-complete" data-no-parts="${readiness.partsRequired?'0':'1'}">${readiness.partsRequired?'Подтвердить резерв':'Начать без запчастей'}</button>`;
    if(professional&&stage==='in_progress')body=`<button class="k-btn k-btn-primary" data-lifecycle-click="work-complete">Передать на контроль</button>`;
    if(professional&&stage==='quality_control')body=`<button class="k-btn k-btn-primary" data-work-open="quality">Провести контроль</button>`;
    if(professional&&stage==='payment')body=`<button class="k-btn k-btn-secondary" data-work-open="warranty">Гарантия</button><button class="k-btn k-btn-primary" data-work-open="handover">Подготовить выдачу</button>`;
    if(stage==='delivery')body=client?`<button class="k-btn k-btn-primary" data-work-open="delivery">Подтвердить получение</button>`:`<span>${handover.status==='ready'?'Ожидается подтверждение клиента.':'Подготовьте акт выдачи.'}</span>`;
    if(['warranty','completed'].includes(stage))body='<span>Основной ремонт завершён. Дальнейшие действия находятся во вкладке «Гарантия».</span>';
    return `<footer class="k-work-action-zone"><div><small>Текущий этап</small><b>${esc(client?clientStageLabel(stage):(workflowLabels[stage]||stage))}</b></div><div>${body||'<span>Действий на текущем этапе нет.</span>'}</div></footer>`;
  }
  function clientMilestoneProgress(workflowData){
    const stage=String(workflowData?.workflow?.current_stage||'intake');
    let current=clientMilestones.findIndex(item=>item.stages.includes(stage));
    if(current<0)current=0;
    return `<div class="k-client-work-progress" aria-label="Этап ремонта">${clientMilestones.map((item,i)=>`<span class="${i<current?'is-done':i===current?'is-current':''}"><i>${i<current?icon('check'):String(i+1)}</i><b>${esc(item.label)}</b></span>`).join('')}</div>`;
  }
  function clientExecutorCard(o){
    const isSto=Boolean(text(o.stoId)&&text(o.stoName)),id=isSto?text(o.stoId):text(o.masterId),name=text(isSto?o.stoName:o.masterName)||'Исполнитель ещё не назначен',profile=id?`#/masters/profile/${isSto?'sto':'master'}/${encodeURIComponent(id)}`:'';
    return `<article class="k-client-work-executor"><span class="k-client-work-executor__avatar">${icon(isSto?'store':'masters')}</span><div><small>Исполнитель</small><b>${esc(name)}</b><p>${id?'Можно открыть профиль или написать по заказу.':'После выбора мастера здесь появятся профиль и чат.'}</p></div><div>${profile?`<a href="${profile}" class="k-btn k-btn-secondary">Профиль</a>`:''}${o.chatId?`<a href="#/chats" class="k-btn k-btn-primary" data-order-chat="${esc(o.chatId)}">${icon('chats')}<span>Чат</span></a>`:''}</div></article>`;
  }
  function clientOverview(o,workflowData){
    const stage=String(workflowData?.workflow?.current_stage||'intake'),address=text(o.geo?.address||o.address),dateLine=[o.dateLabel||o.date,o.time].filter(Boolean).join(' · '),vehicleMeta=[o.vehiclePlate,o.vehicleVin?`VIN ${o.vehicleVin}`:''].filter(Boolean).join(' · ');
    return `<section class="k-client-work-overview"><article><span>${icon('car')}</span><div><small>Автомобиль</small><b>${esc(o.clientCar||o.vehicleTitle||'Не указан')}</b><p>${esc(vehicleMeta||'Данные автомобиля в заявке')}</p></div></article><article><span>${icon('calendar')}</span><div><small>Когда</small><b>${esc(dateLine||'По согласованию')}</b><p>${esc(address||'Место уточняется')}</p></div></article><article><span>${icon('services')}</span><div><small>Текущий этап</small><b>${esc(clientStageLabel(stage))}</b><p>${esc(o.serviceNames||'Работы по автомобилю')}</p></div></article><article><span>${icon('finance')}</span><div><small>Стоимость</small><b>${money(o.finalPrice||o.price)}</b><p>${Number(o.finalPrice||0)>0?'Итоговая сумма':'Текущая сумма заказа'}</p></div></article></section>`;
  }
  function renderClientDetail(data,workflowData,activeTab){
    const o=data.order||{},stage=String(workflowData?.workflow?.current_stage||'intake'),current=activeTab||tabForStage(stage),status=clientStatusLabels[String(o.status||'').toLowerCase()]||workflowLabels[stage]||'Заказ';
    return `<div class="k-client-work-order-v2"><header class="k-client-work-head"><a class="k-work-back" href="#/orders">${icon('chevronLeft')}<span>Мои заявки</span></a><div class="k-client-work-head__copy"><span class="k-client-work-status">${esc(status)}</span><small>Заказ № ${esc(o.num||o.id)}</small><h1>${esc(o.clientCar||o.vehicleTitle||'Автомобиль')}</h1><p>${esc(o.serviceNames||'Работы по автомобилю')}</p></div><div class="k-client-work-head__price"><small>Стоимость</small><strong>${money(o.finalPrice||o.price)}</strong></div></header>${clientMilestoneProgress(workflowData)}${clientNextStep(workflowData)}${clientOverview(o,workflowData)}${clientExecutorCard(o)}<nav class="k-work-tabs k-client-work-tabs" aria-label="Разделы заказа">${clientTabs.map(([key,label,ico])=>`<button type="button" data-work-tab="${key}" class="${key===current?'is-active':''}" aria-selected="${key===current?'true':'false'}">${icon(ico)}<span>${label}</span></button>`).join('')}</nav><div class="k-work-panels k-client-work-panels">${diagnosticsTab(data,workflowData,false)}${estimateTab(data,workflowData,false)}${extraTab(workflowData,false,'client')}${partsTab(data,workflowData,false)}${qualityTab(data,workflowData,false)}${deliveryTab(data,workflowData,false,'client')}${warrantyTab(workflowData)}</div>${actionZone(workflowData)}</div>`;
  }
  function renderProfessionalDetail(data,workflowData,activeTab){
    const o=data.order||{},lc=workflowData?.lifecycle||{},role=effectiveWorkOrderRole(workflowData),professional=PROFESSIONAL.has(role),current=activeTab||tabForStage(String(workflowData?.workflow?.current_stage||'intake'));
    return `<div class="k-work-native-head"><a class="k-work-back" href="#/orders">${icon('chevronLeft')}<span>Все заказы</span></a><div><span class="k-badge">${esc(o.status||'new')}</span><h1>Заказ-наряд № ${esc(o.num||o.id)}</h1><p>${esc(o.serviceNames||'Работы по автомобилю')}</p></div><div><small>Текущая стоимость</small><strong>${money(o.price)}</strong></div></div>${summaryRow(o)}${workflowProgress(workflowData)}${nextRequirement(workflowData)}<nav class="k-work-tabs" aria-label="Разделы заказ-наряда">${tabs.map(([key,label,ico])=>`<button type="button" data-work-tab="${key}" class="${key===current?'is-active':''}" aria-selected="${key===current?'true':'false'}">${icon(ico)}<span>${label}</span></button>`).join('')}</nav><div class="k-work-panels">${diagnosticsTab(data,workflowData,professional)}${estimateTab(data,workflowData,professional)}${extraTab(workflowData,professional,role)}${partsTab(data,workflowData,professional)}${qualityTab(data,workflowData,professional)}${deliveryTab(data,workflowData,professional,role)}${warrantyTab(workflowData)}</div>${actionZone(workflowData)}`;
  }
  function renderDetail(data,workflowData,activeTab){
    const role=effectiveWorkOrderRole(workflowData);
    return role==='client'?renderClientDetail(data,workflowData,activeTab):renderProfessionalDetail(data,workflowData,activeTab);
  }
  function modal(title,body,stateKey='',context={}){
    const attrs=stateKey?` data-state-modal="safe" data-state-modal-key="${esc(stateKey)}" data-state-modal-context="${esc(encodeURIComponent(JSON.stringify(context||{})))}"`:'';
    return `<dialog class="k-work-modal k-work-modal-r77 k-work-modal-r84" aria-label="${esc(title)}"${attrs}><div data-state-modal-scroll><header><div><small>РАБОЧЕЕ ДЕЙСТВИЕ</small><h2>${esc(title)}</h2></div><button type="button" data-work-close aria-label="Закрыть">${icon('close')}</button></header><div class="k-work-modal-r77__body">${body}</div></div></dialog>`;
  }
  function errorMessage(payload,fallback){const raw=String(payload?.message||payload?.error||fallback);const code=raw.replace('workflow_requirements_missing:','').split(',').map(x=>requirementLabels[x]||x).join(' · ');return code||fallback;}
  function mountWorkOrder(context){
    const root=document.querySelector('#k-work-order'); if(!root)return; const id=orderId(); const api=context.api; const lifecycle=context.lifecycle||{};
    let currentWorkflow=null,currentData=null,activeTab='';
    const modalContext=snapshot=>{try{return JSON.parse(decodeURIComponent(String(snapshot?.context||'')))||{};}catch(_error){return {};}};
    const activateTab=tab=>{activeTab=tabs.some(x=>x[0]===tab)?tab:'diagnostics';root.querySelectorAll('[data-work-tab]').forEach(btn=>{const on=btn.dataset.workTab===activeTab;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false');});root.querySelectorAll('[data-work-panel]').forEach(panel=>panel.hidden=panel.dataset.workPanel!==activeTab);};
    const openSafeModal=(kind,ctx={})=>{
      document.querySelector('.k-work-modal')?.remove();
      const lc=currentWorkflow?.lifecycle||{},after=lc.aftercare||{},claim=after.activeClaim||null,d=lc.diagnostics||{},w=lc.warranty||{},handover=lc.handover||{},policy=lc.publicationPolicy||{};
      let title='',body='';
      if(kind==='diagnostics'){
        title='Диагностический отчёт';body=`<form data-lifecycle-form="diagnostics"><label>Жалоба клиента<textarea name="complaints" rows="3" required>${esc(d.complaints||'')}</textarea></label><label>Результаты диагностики<textarea name="findings" rows="6" required>${esc(d.findings||'')}</textarea></label><label>Рекомендации<textarea name="recommendations" rows="4">${esc(d.recommendations||'')}</textarea></label><label class="k-lifecycle-check"><input type="checkbox" name="partsRequired" ${bool(d.partsRequired)?'checked':''}> Для ремонта требуются запчасти</label><footer><button class="k-btn k-btn-secondary" name="complete" value="0">Сохранить черновик</button><button class="k-btn k-btn-primary" name="complete" value="1">Завершить диагностику</button></footer></form>`;
      }else if(kind==='quality'){
        title='Контроль качества';body=`<form data-lifecycle-form="quality"><div class="k-lifecycle-check-grid"><label><input type="checkbox" name="roadTest"> Контрольная поездка</label><label><input type="checkbox" name="noLeaks"> Нет течей</label><label><input type="checkbox" name="noFaultCodes"> Нет активных ошибок</label><label><input type="checkbox" name="fastenersChecked"> Крепёж проверен</label><label><input type="checkbox" name="clientRequestVerified"> Жалоба устранена</label></div>${choiceField('result','Результат',[{value:'pass',label:'Проверка пройдена',icon:'check'},{value:'fail',label:'Вернуть на доработку',icon:'warning'}],'pass')}<label>Комментарий<textarea name="notes" rows="4"></textarea></label><button class="k-btn k-btn-primary">Сохранить результат</button></form>`;
      }else if(kind==='warranty'){
        title='Условия гарантии';body=`<form data-lifecycle-form="warranty"><label>Срок, дней<input type="number" min="0" max="3650" name="warrantyDays" value="${esc(w.warrantyDays??30)}"></label><label>На что распространяется<textarea name="scopeText" rows="4">${esc(w.scopeText||'На выполненные работы и установленные Мастером детали')}</textarea></label><label>Исключения<textarea name="exclusionsText" rows="4">${esc(w.exclusionsText||'Естественный износ, внешние повреждения и вмешательство третьих лиц')}</textarea></label><button class="k-btn k-btn-primary">Сохранить гарантию</button></form>`;
      }else if(kind==='handover'){
        title='Подготовить выдачу';body=`<form data-lifecycle-form="handover">${choiceField('paymentStatus','Оплата',[{value:'paid',label:'Оплачено',icon:'check'},{value:'not_required',label:'Не требуется',icon:'info'},{value:'pending',label:'Ожидается',icon:'clock'}],handover.paymentStatus||'not_required')}<div class="k-work-form-grid"><label>Пробег, км<input type="number" min="0" name="odometerKm"></label><label>Уровень топлива<input name="fuelLevel" placeholder="Например, 1/2"></label><label>Количество ключей<input type="number" min="0" max="10" name="keysCount" value="1"></label></div><label>Примечание<textarea name="notes" rows="4"></textarea></label><button class="k-btn k-btn-primary">Подготовить к выдаче</button></form>`;
      }else if(kind==='delivery'){
        title='Подтвердить получение';body=`<form data-lifecycle-form="delivery"><label class="k-lifecycle-check"><input type="checkbox" name="clientConsent" ${bool(policy.clientConsent)?'checked':''}> Разрешаю публикацию ремонта без персональных данных</label><label class="k-lifecycle-check"><input type="checkbox" name="autoPublish" ${bool(policy.autoPublish)?'checked':''}> Автоматически опубликовать после выдачи</label><label class="k-lifecycle-check"><input type="checkbox" name="anonymizeClient" ${policy.id?bool(policy.anonymizeClient)?'checked':'':'checked'}> Скрыть имя, телефон и госномер</label><label class="k-lifecycle-check"><input type="checkbox" name="showPrice" ${bool(policy.showPrice)?'checked':''}> Разрешаю показывать итоговую стоимость</label><footer><button class="k-btn k-btn-secondary" name="intent" value="save-consent">Сохранить настройки</button><button class="k-btn k-btn-primary" name="intent" value="confirm-handover">Подтвердить получение</button></footer></form>`;
      }else if(kind==='extra'){
        title='Дополнительные работы';body='<form data-lifecycle-modal="extra"><label>Наименование<input name="title" required></label><div class="k-work-form-grid"><label>Работы, ₸<input name="laborPrice" type="number" min="0" value="0"></label><label>Запчасти, ₸<input name="partsPrice" type="number" min="0" value="0"></label></div><label>Причина и состав<textarea name="comment" rows="5" required></textarea></label><button class="k-btn k-btn-primary">Отправить клиенту</button></form>';
      }else if(kind==='inventory'){
        const options=after.inventoryOptions||[];if(!options.length){window.KaretaToast?.error('На доступных складах нет свободных позиций');return null;}
        const claimId=ctx.claimId||((claim&&['inspection','repair','quality_control','ready'].includes(String(claim.status||'')))?String(claim.id||''):'');
        title='Резерв со склада';body=`<form data-lifecycle-modal="inventory"><input type="hidden" name="claimId" value="${esc(claimId)}">${choiceField('stockKey','Складская позиция',options.map(x=>({value:`${x.warehouseId}:${x.productId}`,label:x.productTitle,meta:`${x.warehouseTitle} · доступно ${x.available}`,icon:'warehouse',price:x.price||0,cost:x.costPrice||0})),`${options[0]?.warehouseId}:${options[0]?.productId}`,'is-stock')}<div class="k-work-form-grid"><label>Количество<input name="quantity" type="number" min="0.001" step="0.001" value="1" required></label><label>Цена клиенту, ₸<input name="unitPrice" type="number" min="0" value="${esc(options[0]?.price||0)}"></label><label>Себестоимость, ₸<input name="costUnitPrice" type="number" min="0" value="${esc(options[0]?.costPrice||0)}"></label></div><label>Комментарий<input name="note"></label><button class="k-btn k-btn-primary">Зарезервировать</button></form>`;
      }else if(kind==='reserve'){
        title='Внешний резерв';body='<form data-lifecycle-modal="reserve"><label>Название<input name="partName" required></label><div class="k-work-form-grid"><label>OEM<input name="oem"></label><label>SKU<input name="sku"></label><label>Поставщик<input name="supplierLabel"></label><label>Требуется<input name="qtyRequested" type="number" min="0.001" step="0.001" value="1"></label><label>Зарезервировано<input name="qtyReserved" type="number" min="0" step="0.001" value="1"></label><label>Цена за единицу<input name="unitPrice" type="number" min="0" value="0"></label></div><button class="k-btn k-btn-primary">Сохранить резерв</button></form>';
      }else if(kind==='finance-settings'){
        const settings=after.financeSettings||{};title='Параметры себестоимости';body=`<form data-aftercare-form="finance-settings"><div class="k-work-form-grid"><label>Себестоимость часа, ₸<input name="laborCostPerHour" type="number" min="0" value="${esc(settings.laborCostPerHour||0)}"></label><label>Накладные, %<input name="overheadPercent" type="number" min="0" max="100" step="0.1" value="${esc(settings.overheadPercent||0)}"></label><label>Резерв гарантии, %<input name="warrantyReservePercent" type="number" min="0" max="100" step="0.1" value="${esc(settings.warrantyReservePercent||0)}"></label></div><button class="k-btn k-btn-primary">Сохранить параметры</button></form>`;
      }else if(kind==='cost'){
        title='Фактический расход';body=`<form data-aftercare-form="cost">${choiceField('costType','Тип расхода',[{value:'consumable',label:'Расходные материалы',icon:'parts'},{value:'outsourced',label:'Сторонняя работа',icon:'services'},{value:'labor',label:'Дополнительный труд',icon:'clock'},{value:'warranty',label:'Гарантийный расход',icon:'shield'},{value:'adjustment',label:'Корректировка',icon:'edit'}],'consumable')}<label>Наименование<input name="title" required></label><div class="k-work-form-grid"><label>Количество<input name="quantity" type="number" min="0.001" step="0.001" value="1"></label><label>Цена единицы<input name="unitCost" type="number" min="0" value="0"></label></div><label>Комментарий<input name="note"></label><button class="k-btn k-btn-primary">Добавить расход</button></form>`;
      }else if(kind==='claim-submit'){
        title='Гарантийное обращение';body=`<form data-aftercare-form="claim-submit"><label>Что произошло<textarea name="issueText" rows="5" required></textarea></label><label>Симптомы и условия проявления<textarea name="symptoms" rows="4"></textarea></label>${choiceField('requestedResolution','Желаемое решение',[{value:'repair',label:'Гарантийный ремонт',icon:'services'},{value:'inspection',label:'Осмотр и заключение',icon:'search'},{value:'refund',label:'Компенсация',icon:'finance'}],'repair')}<button class="k-btn k-btn-primary">Отправить обращение</button></form>`;
      }else if(kind==='claim-inspect'){
        const claimId=ctx.claimId||claim?.id||'';title='Осмотр по гарантии';body=`<form data-aftercare-form="claim-inspect"><input type="hidden" name="claimId" value="${esc(claimId)}"><label class="k-lifecycle-check"><input type="checkbox" name="covered" ${bool(claim?.covered)?'checked':''}> Случай покрывается гарантией</label><label>Результаты осмотра<textarea name="inspectionNotes" rows="5" required>${esc(claim?.inspectionNotes||'')}</textarea></label><label>Причина повторной неисправности<textarea name="rootCause" rows="4">${esc(claim?.rootCause||'')}</textarea></label><label>Причина отказа<textarea name="rejectionReason" rows="4">${esc(claim?.rejectionReason||'')}</textarea></label><footer><button class="k-btn k-btn-secondary">Сохранить заключение</button>${bool(claim?.covered)?`<button type="button" class="k-btn k-btn-primary" data-aftercare-click="claim-start" data-claim-id="${esc(claimId)}">Начать гарантийный ремонт</button>`:''}</footer></form>`;
      }else if(kind==='claim-repair'){
        const claimId=ctx.claimId||claim?.id||'';title='Завершить гарантийный ремонт';body=`<form data-aftercare-form="claim-repair"><input type="hidden" name="claimId" value="${esc(claimId)}"><label>Что выполнено<textarea name="repairNotes" rows="6" required>${esc(claim?.repairNotes||'')}</textarea></label><button class="k-btn k-btn-primary">Передать на контроль качества</button></form>`;
      }else if(kind==='claim-quality'){
        const claimId=ctx.claimId||claim?.id||'';title='Контроль гарантийного ремонта';body=`<form data-aftercare-form="claim-quality"><input type="hidden" name="claimId" value="${esc(claimId)}">${choiceField('result','Результат',[{value:'pass',label:'Проверка пройдена',icon:'check'},{value:'fail',label:'Вернуть на доработку',icon:'warning'}],'pass')}<label>Комментарий<textarea name="notes" rows="4" required></textarea></label><button class="k-btn k-btn-primary">Сохранить результат</button></form>`;
      }else if(kind==='claim-reject'){
        const claimId=ctx.claimId||'';title='Отказать по гарантии';body=`<form data-lifecycle-modal="claim-reject"><input type="hidden" name="claimId" value="${esc(claimId)}"><label>Причина отказа<textarea name="reason" rows="5" required></textarea></label><button class="k-btn k-btn-primary">Сохранить решение</button></form>`;
      }else if(kind==='inventory-return'){
        title='Вернуть деталь на склад';body=`<form data-lifecycle-modal="inventory-return"><input type="hidden" name="reservationId" value="${esc(ctx.reservationId||'')}"><label>Количество<input name="quantity" type="number" min="0.001" step="0.001" max="${esc(ctx.returnable||1)}" value="${esc(ctx.returnable||1)}"></label><button class="k-btn k-btn-primary">Вернуть на склад</button></form>`;
      }else if(kind==='media-stage'||kind==='media'){
        const fixedStage=kind==='media-stage'?String(ctx.stageKey||'diagnostics'):'';title='Добавить материал';body=`<form data-work-form="media">${fixedStage?`<input type="hidden" name="stageKey" value="${esc(fixedStage)}">`:`${choiceField('stageKey','Этап',[{value:'before',label:'До ремонта',icon:'car'},{value:'diagnostics',label:'Диагностика',icon:'search'},{value:'in_progress',label:'В процессе',icon:'services'},{value:'after',label:'После ремонта',icon:'check'}],'diagnostics')}`}${choiceField('mediaType','Тип',[{value:'photo',label:'Фото',icon:'view'},{value:'video',label:'Видео',icon:'view'},{value:'document',label:'Документ',icon:'document'}],'photo')}${choiceField('visibility','Доступ',[{value:'client',label:'Только клиенту',icon:'lock'},{value:'public',label:'Можно публиковать',icon:'community'}],'client')}<label>Ссылка на файл<input name="fileUrl" required placeholder="uploads/... или https://..."></label><label>Описание<input name="caption"></label><button class="k-btn k-btn-primary">Добавить материал</button></form>`;
      }else if(kind==='part'){
        title='Установленная запчасть';body='<form data-work-form="part"><label>Название<input name="name" required></label><div class="k-work-form-grid"><label>Количество<input name="qty" type="number" min="1" value="1"></label><label>Цена<input name="price" type="number" min="0"></label></div><button class="k-btn k-btn-primary">Сохранить</button></form>';
      }else return null;
      document.body.insertAdjacentHTML('beforeend',modal(title,body,`work-order:${kind}`,ctx));
      const modalEl=document.querySelector(`[data-state-modal-key="work-order:${kind}"]`);
      if(modalEl?.showModal&&!modalEl.open){try{modalEl.showModal();}catch(_error){}}
      modalEl?.addEventListener?.('close',()=>modalEl.remove(),{once:true});
      return modalEl;
    };
    const modalKinds=['diagnostics','quality','warranty','handover','delivery','extra','inventory','reserve','finance-settings','cost','claim-submit','claim-inspect','claim-repair','claim-quality','claim-reject','inventory-return','media-stage','media','part'];
    const unregisterModalRestorers=modalKinds.map(kind=>window.KaretaNavigationState?.registerModalRestorer?.(`work-order:${kind}`,snapshot=>openSafeModal(kind,modalContext(snapshot)))).filter(Boolean);
    const load=async()=>{
      const [res,wfRes]=await Promise.all([apiModule.detail(api,id,{signal:lifecycle.signal,force:true}),apiModule.workflow(api,id,{signal:lifecycle.signal}).catch(()=>({ok:false}))]);
      if(!res.ok)throw new Error(res.payload?.message||'Не удалось загрузить заказ-наряд');
      currentData=res.payload.data||{};currentWorkflow=wfRes.ok?(wfRes.payload?.data||{}):null;if(!activeTab)activeTab=tabForStage(String(currentWorkflow?.workflow?.current_stage||'intake'));
      const actorRole=effectiveWorkOrderRole(currentWorkflow);root.classList.toggle('is-client',actorRole==='client');root.classList.toggle('is-professional',PROFESSIONAL.has(actorRole));
      root.dataset.phase='ready';root.innerHTML=renderDetail(currentData,currentWorkflow,activeTab);activateTab(activeTab);
      window.KaretaNavigationState?.restoreAfterAsync?.(location.hash,{replayActive:true,restoreModal:true,restoreFocus:false});
    };
    const reload=()=>load().catch(e=>window.KaretaToast?.error(e.message));
    load().catch(e=>{root.innerHTML=`<section class="k-empty"><h2>Заказ-наряд недоступен</h2><p>${esc(e.message)}</p></section>`;});
    const run=async(button,promise,fallback,followStage=false)=>{if(button)button.disabled=true;try{const res=await promise;if(!res.ok){if(button)button.disabled=false;window.KaretaToast?.error(errorMessage(res.payload,fallback));return false;}if(followStage)activeTab='';await reload();return true;}catch(err){if(button)button.disabled=false;window.KaretaToast?.error(err.message||fallback);return false;}};
    const click=async e=>{
      const orderChat=e.target.closest('[data-order-chat]');if(orderChat){try{sessionStorage.setItem('kareta.chat.open',orderChat.dataset.orderChat||'');}catch(_error){}return;}
      const close=e.target.closest('[data-work-close]');if(close){const modalEl=close.closest('.k-work-modal');try{modalEl?.close?.();}catch(_error){}modalEl?.remove();window.KaretaNavigationState?.capture?.();return;}
      if(e.target.matches?.('.k-work-modal-r77')){try{e.target.close?.();}catch(_error){}e.target.remove();return;}
      const tab=e.target.closest('[data-work-tab]');if(tab){activateTab(tab.dataset.workTab);return;}
      const choice=e.target.closest('[data-work-choice]');if(choice){const field=choice.closest('[data-work-choice-field]'),name=choice.dataset.choiceName,value=choice.dataset.choiceValue;field?.querySelectorAll('[data-work-choice]').forEach(x=>x.classList.toggle('is-active',x===choice));const hidden=field?.querySelector('input[type="hidden"]');if(hidden)hidden.value=value;if(name==='stockKey'){const form=choice.closest('form');const price=form?.elements?.unitPrice,cost=form?.elements?.costUnitPrice;if(price)price.value=choice.dataset.choicePrice||0;if(cost)cost.value=choice.dataset.choiceCost||0;}return;}
      const open=e.target.closest('[data-work-open]');if(open){openSafeModal(open.dataset.workOpen,{claimId:open.dataset.claimId||''});return;}
      const timerStart=e.target.closest('[data-work-start-timer]');if(timerStart){await run(timerStart,apiModule.startTimer(api,{orderId:id,stageKey:timerStart.dataset.workStartTimer}),'Таймер не запущен');return;}
      const timerStop=e.target.closest('[data-work-stop-timer]');if(timerStop){await run(timerStop,apiModule.stopTimer(api,{timerId:timerStop.dataset.workStopTimer}),'Таймер не остановлен');return;}
      const decision=e.target.closest('[data-extra-decision]');if(decision){await run(decision,apiModule.decideExtraWork(api,{quoteId:decision.dataset.quoteId,decision:decision.dataset.extraDecision}),'Решение не сохранено',true);return;}
      const aftercareClick=e.target.closest('[data-aftercare-click]');if(aftercareClick){const action=aftercareClick.dataset.aftercareClick,claimId=aftercareClick.dataset.claimId||'';if(action==='inventory-return'){openSafeModal('inventory-return',{reservationId:aftercareClick.dataset.reservationId||'',returnable:aftercareClick.dataset.returnable||1});return;}if(action==='cost-delete'){await run(aftercareClick,apiModule.deleteCost(api,{orderId:id,costEntryId:aftercareClick.dataset.costId}),'Расход не удалён');return;}if(action==='claim-accept'){await run(aftercareClick,apiModule.decideWarrantyClaim(api,{claimId,decision:'accepted'}),'Обращение не принято');return;}if(action==='claim-start'){await run(aftercareClick,apiModule.startWarrantyRepair(api,{claimId}),'Гарантийный ремонт не запущен');return;}if(action==='claim-confirm'){await run(aftercareClick,apiModule.confirmWarrantyReturn(api,{claimId}),'Получение не подтверждено');return;}}
      const life=e.target.closest('[data-lifecycle-click]');if(life){const action=life.dataset.lifecycleClick;if(action==='accept')await run(life,apiModule.acceptOrder(api,{orderId:id}),'Не удалось принять заказ',true);if(action==='skip-extra')await run(life,apiModule.skipExtraWork(api,{orderId:id}),'Не удалось подтвердить смету',true);if(action==='parts-complete')await run(life,apiModule.completeParts(api,{orderId:id,noPartsRequired:life.dataset.noParts==='1'}),'Резерв не завершён',true);if(action==='work-complete')await run(life,apiModule.completeWork(api,{orderId:id}),'Не удалось передать на контроль',true);return;}
      const quickMedia=e.target.closest('[data-work-media-stage]');if(quickMedia){openSafeModal('media-stage',{stageKey:quickMedia.dataset.workMediaStage});return;}
      const action=e.target.closest('[data-work-action]')?.dataset.workAction;
      if(action==='add-part'){openSafeModal('part');return;}if(action==='add-media'){openSafeModal('media');return;}if(action==='prepare-post'){await run(e.target.closest('[data-work-action]'),apiModule.publicationPrepare(api,{orderId:id}),'Не удалось создать публикацию');return;}
      if(action==='publish-post'){const policy=currentWorkflow?.lifecycle?.publicationPolicy;if(!bool(policy?.clientConsent)){window.KaretaToast?.error('Согласие клиента не зарегистрировано сервером');return;}const button=e.target.closest('[data-work-action]');button.disabled=true;const res=await api.publishWorkPost({orderId:id,clientConsent:true});if(!res.ok){button.disabled=false;window.KaretaToast?.error(errorMessage(res.payload,'Не удалось опубликовать'));}else{api.invalidate('work.posts:');location.hash=res.payload?.post?.route||`#/works/item/work_${encodeURIComponent(id)}`;}return;}
    };
    const change=async e=>{const input=e.target.closest('[data-check-id]');if(!input)return;const res=await apiModule.checklistToggle(api,{orderId:id,itemId:input.dataset.checkId,done:input.checked});if(!res.ok){input.checked=!input.checked;window.KaretaToast?.error('Не удалось сохранить чек-лист');}};
    const submit=async e=>{
      const reviewForm=e.target.closest('[data-work-review-form]');if(reviewForm){e.preventDefault();const values=Object.fromEntries(new FormData(reviewForm));const status=reviewForm.querySelector('[data-work-review-status]'),button=reviewForm.querySelector('button[type=submit]');button.disabled=true;const res=await api.submitReview({orderId:id,stars:Number(values.stars||5),qualityRating:Number(values.qualityRating||5),timingRating:Number(values.timingRating||5),neatnessRating:Number(values.neatnessRating||5),communicationRating:Number(values.communicationRating||5),text:String(values.text||'').trim(),dateLabel:new Date().toLocaleDateString('ru-RU')});button.disabled=false;status.textContent=res.ok?'Спасибо. Подтверждённый отзыв опубликован.':errorMessage(res.payload,'Отзыв не отправлен');if(res.ok)reviewForm.querySelectorAll('textarea,input,button').forEach(el=>el.disabled=true);return;}
      const form=e.target.closest('[data-lifecycle-form],[data-lifecycle-modal],[data-work-form],[data-aftercare-form]');if(!form)return;e.preventDefault();const submitter=e.submitter;const values=Object.fromEntries(new FormData(form));let promise,followStage=false;
      if(form.dataset.lifecycleForm==='diagnostics'){promise=apiModule.saveDiagnostics(api,{orderId:id,complaints:values.complaints,findings:values.findings,recommendations:values.recommendations,partsRequired:form.elements.partsRequired.checked,complete:submitter?.value==='1'});followStage=submitter?.value==='1';}
      if(form.dataset.lifecycleForm==='quality'){promise=apiModule.saveQuality(api,{orderId:id,result:values.result,roadTest:form.elements.roadTest.checked,noLeaks:form.elements.noLeaks.checked,noFaultCodes:form.elements.noFaultCodes.checked,fastenersChecked:form.elements.fastenersChecked.checked,clientRequestVerified:form.elements.clientRequestVerified.checked,notes:values.notes});followStage=true;}
      if(form.dataset.lifecycleForm==='warranty')promise=apiModule.configureWarranty(api,{orderId:id,warrantyDays:Number(values.warrantyDays||0),scopeText:values.scopeText,exclusionsText:values.exclusionsText});
      if(form.dataset.lifecycleForm==='handover'){promise=apiModule.prepareHandover(api,{orderId:id,paymentStatus:values.paymentStatus,odometerKm:values.odometerKm?Number(values.odometerKm):null,fuelLevel:values.fuelLevel,keysCount:Number(values.keysCount||1),notes:values.notes});followStage=true;}
      if(form.dataset.lifecycleForm==='delivery'){const consentPayload={orderId:id,clientConsent:form.elements.clientConsent.checked,autoPublish:form.elements.autoPublish.checked,anonymizeClient:form.elements.anonymizeClient.checked,showPrice:form.elements.showPrice.checked};if(submitter?.value==='save-consent')promise=apiModule.publicationConsent(api,consentPayload);else{const consent=await apiModule.publicationConsent(api,consentPayload);if(!consent.ok){window.KaretaToast?.error(errorMessage(consent.payload,'Настройки публикации не сохранены'));return;}promise=apiModule.confirmHandover(api,{orderId:id});followStage=true;}}
      if(form.dataset.lifecycleModal==='extra')promise=apiModule.requestExtraWork(api,{orderId:id,title:values.title,laborPrice:Number(values.laborPrice||0),partsPrice:Number(values.partsPrice||0),comment:values.comment});
      if(form.dataset.lifecycleModal==='reserve')promise=apiModule.reservePart(api,{orderId:id,partName:values.partName,oem:values.oem,sku:values.sku,supplierLabel:values.supplierLabel,qtyRequested:Number(values.qtyRequested||1),qtyReserved:Number(values.qtyReserved||0),unitPrice:Number(values.unitPrice||0)});
      if(form.dataset.lifecycleModal==='inventory'){const [warehouseId,productId]=String(values.stockKey||'').split(':');promise=apiModule.reserveInventory(api,{orderId:id,claimId:values.claimId||'',warehouseId:Number(warehouseId||0),productId:Number(productId||0),quantity:Number(values.quantity||1),unitPrice:Number(values.unitPrice||0),costUnitPrice:Number(values.costUnitPrice||0),note:values.note||''});}
      if(form.dataset.lifecycleModal==='inventory-return')promise=apiModule.returnInventory(api,{orderId:id,reservationId:values.reservationId,quantity:Number(values.quantity||0)});
      if(form.dataset.lifecycleModal==='claim-reject')promise=apiModule.decideWarrantyClaim(api,{claimId:values.claimId,decision:'rejected',reason:values.reason});
      if(form.dataset.aftercareForm==='claim-submit')promise=apiModule.submitWarrantyClaim(api,{orderId:id,issueText:values.issueText,symptoms:values.symptoms,requestedResolution:values.requestedResolution});
      if(form.dataset.aftercareForm==='claim-inspect')promise=apiModule.inspectWarrantyClaim(api,{claimId:values.claimId,covered:form.elements.covered.checked,inspectionNotes:values.inspectionNotes,rootCause:values.rootCause,rejectionReason:values.rejectionReason});
      if(form.dataset.aftercareForm==='claim-repair')promise=apiModule.completeWarrantyRepair(api,{claimId:values.claimId,repairNotes:values.repairNotes});
      if(form.dataset.aftercareForm==='claim-quality')promise=apiModule.warrantyQuality(api,{claimId:values.claimId,result:values.result,notes:values.notes});
      if(form.dataset.aftercareForm==='finance-settings')promise=apiModule.saveFinanceSettings(api,{laborCostPerHour:Number(values.laborCostPerHour||0),overheadPercent:Number(values.overheadPercent||0),warrantyReservePercent:Number(values.warrantyReservePercent||0)});
      if(form.dataset.aftercareForm==='cost'){const active=currentWorkflow?.lifecycle?.aftercare?.activeClaim||null,claimId=active&&['repair','quality_control','ready'].includes(String(active.status||''))?String(active.id||''):'';promise=apiModule.saveCost(api,{orderId:id,claimId,costType:values.costType,title:values.title,quantity:Number(values.quantity||1),unitCost:Number(values.unitCost||0),note:values.note||''});}
      if(form.dataset.workForm==='part')promise=apiModule.addPart(api,{id,part:{name:values.name,qty:Number(values.qty),price:Number(values.price)}});
      if(form.dataset.workForm==='media')promise=apiModule.mediaSave(api,{orderId:id,...values,mediaType:String(values.mediaType||'photo'),visibility:String(values.visibility||'client')});
      if(!promise)return;const ok=await run(submitter,promise,'Не удалось сохранить',followStage);if(ok){const modalEl=document.querySelector('.k-work-modal');try{modalEl?.close?.();}catch(_error){}modalEl?.remove();}
    };
    document.addEventListener('click',click);document.addEventListener('change',change);document.addEventListener('submit',submit);
    lifecycle.addCleanup?.(()=>{document.removeEventListener('click',click);document.removeEventListener('change',change);document.removeEventListener('submit',submit);unregisterModalRestorers.forEach(fn=>{try{fn?.();}catch(_error){}});const modalEl=document.querySelector('.k-work-modal');try{modalEl?.close?.();}catch(_error){}modalEl?.remove();});
  }
  window.KaretaWorkOrderPages=Object.freeze({renderWorkOrder,mountWorkOrder});
})();
