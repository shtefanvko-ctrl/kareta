(() => {
  'use strict';

  const NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55';
  const MASTER_WORKPLACE_R64_CONTRACT='R188.5.5.6.64';
  const MASTER_EXCHANGE_R65_CONTRACT='R188.5.5.6.65';
  const MASTER_SCHEDULING_R66_CONTRACT='R188.5.5.6.66';
  const MASTER_CAPACITY_R67_CONTRACT='R188.5.5.6.67';
  const MASTER_UI_R71_CONTRACT='R188.5.5.6.71';
  const MASTER_WORKSPACE_R81_CONTRACT='R188.5.5.6.81';
  const MASTER_HOME_STRUCTURE_CONTRACT='R188.5.5.6.84.115';
  const MASTER_HOME_BLOCK_ORDER=Object.freeze(['header','status','quick-actions','my-requests','notes','paused','today']);
  const ui=window.KaretaPageUI;
  const apiModule=window.KaretaMasterWorkplaceApi;
  if(!ui||!apiModule) throw new Error('Master workplace dependencies are required');

  const esc=ui.escHtml;
  const icon=name=>window.KaretaUIIcons?.svg?.(name,{className:'k-master-native-icon'})||'';
  const fmtTime=value=>String(value||'').slice(0,5);
  const toLocalInput=value=>String(value||'').replace(' ','T').slice(0,16);
  const fmtDateTime=value=>{if(!value)return 'Не назначено';const d=new Date(String(value).replace(' ','T'));return Number.isNaN(d.getTime())?String(value):d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};
  const CLOSED=new Set(['completed','done','delivered','closed','cancelled']);
  const NEW_STATUSES=new Set(['new','accepted','assigned']);
  const WORK_STATUSES=new Set(['process','in_progress','work']);
  const statusLabel=value=>({new:'Новая',waiting_responses:'На бирже',accepted:'Принята',assigned:'Назначена',process:'В работе',in_progress:'В работе',work:'В работе',waiting_parts:'Ждёт запчасти',waiting_approval:'Ждёт согласования',pending:'Ожидает',completed:'Готово',done:'Готово',delivered:'Выдана',closed:'Закрыта',cancelled:'Отменена'}[String(value||'').toLowerCase()]||String(value||'Новая'));
  const availabilityLabel=value=>({online:'Свободен',busy:'Занят',lunch:'Обед',day_off:'Выходной'}[String(value||'').toLowerCase()]||'Свободен');

  function renderMasterWorkplace(){
    const allowed=window.KaretaMasterOnboardingGate?.workAccessAllowed?.()!==false;
    return `<section class="k-page k-master-page k-master-surface-page k-master-workplace-page k-master-native-workplace-page"><div id="k-master-workplace" class="k-master-workplace k-master-native-workplace" data-phase="${allowed?'loading':'guard'}"><section class="k-empty"><h2>${allowed?'Загружаем рабочее место':'Завершите анкету мастера'}</h2><p>${allowed?'Получаем текущую смену, автомобили и ближайшие записи.':'Рабочее место откроется после завершения обязательной анкеты'}</p></section></div></section>`;
  }

  function quickAction(path,iconName,title,text,badge='',attrs=''){
    return `<a class="k-master-native-action" href="${path}" ${attrs}><span class="k-master-native-action__icon">${icon(iconName)}</span><span><b>${esc(title)}</b><small>${esc(text)}</small></span>${badge?`<em>${esc(badge)}</em>`:''}</a>`;
  }


  function orderCard(order,timer){
    const running=timer&&timer.status==='running';
    const status=String(order.status||'').toLowerCase();
    return `<article class="k-master-native-order ${running?'is-running':''}" data-order-id="${esc(order.id)}">
      <header><div><span class="k-master-native-order__time">${esc(fmtTime(order.time)||'По времени')}</span><span class="k-master-native-order__status is-${esc(status||'new')}">${esc(statusLabel(status))}</span></div><small>${esc(order.date||'Сегодня')}</small></header>
      <h3>${esc(order.clientCar||order.vehicleTitle||'Автомобиль')}</h3>
      <p>${esc(order.serviceNames||'Работы по заказу')}</p>
      <div class="k-master-native-order__client"><span>${esc(order.clientName||'Клиент')}</span>${order.clientPhone?`<span>${esc(order.clientPhone)}</span>`:''}</div>
      <footer><a class="k-btn k-btn-secondary" href="#/orders/item/${encodeURIComponent(order.id)}">Открыть заказ</a>${order.chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${esc(order.chatId)}">Чат</a>`:''}${running?`<button class="k-btn k-btn-primary" type="button" data-stop-timer="${esc(timer.id)}">Завершить этап</button>`:!CLOSED.has(status)?`<button class="k-btn k-btn-primary" type="button" data-start-timer="${esc(order.id)}" data-stage="${NEW_STATUSES.has(status)?'diagnosis':'repair'}">${NEW_STATUSES.has(status)?'Начать диагностику':'Начать работу'}</button>`:''}</footer>
    </article>`;
  }

  function appointmentCard(order){
    return `<a class="k-master-native-appointment" href="#/orders/item/${encodeURIComponent(order.id)}"><span><b>${esc(order.date||'')}</b><small>${esc(fmtTime(order.time)||'По согласованию')}</small></span><span><strong>${esc(order.clientCar||order.vehicleTitle||'Автомобиль')}</strong><small>${esc(order.serviceNames||'Работы по заказу')}</small></span><i aria-hidden="true">›</i></a>`;
  }

  function statusDialog(master){
    const current=String(master.availability||'online');
    const options=[
      ['online','Свободен','Принимаю новые заявки и записи'],
      ['busy','Занят','Работаю с текущим автомобилем'],
      ['lunch','Обед','Временно не принимаю новые работы'],
      ['day_off','Выходной','Сегодня недоступен для записи'],
    ];
    return `<dialog class="k-master-native-dialog" data-master-status-dialog><div class="k-master-native-dialog__panel"><header><div><small>СТАТУС СМЕНЫ</small><h2>Изменить статус</h2></div><button type="button" data-master-status-close aria-label="Закрыть">${icon('close')}</button></header><div class="k-master-native-status-grid">${options.map(([value,title,text])=>`<button type="button" data-master-status-option="${value}" class="${current===value?'is-active':''}"><span></span><b>${title}</b><small>${text}</small></button>`).join('')}</div><footer><button class="k-btn k-btn-secondary" type="button" data-master-status-close>Отмена</button></footer></div></dialog>`;
  }

  function workplacePreferences(data){
    const raw=data?.preferences||{};
    return {
      windows:{status:true,attention:true,nextOrder:true,newAccepted:true,todayQueue:true,upcoming:true,...(raw.windows||{}),quickActions:false,exchange:false},
      params:{upcomingLimit:6,autoRefreshSec:60,compactCards:false,...(raw.params||{})},
    };
  }


  function workplaceSettingsDialog(preferences){
    const windows=preferences.windows||{},params=preferences.params||{};
    const windowOptions=[
      ['status','Статус смены','Показывать состояние Мастера в верхней рабочей строке.'],
      ['attention','Требует решения','Подсвечивать заказы, которые ждут согласования или запчастей.'],
      ['nextOrder','Приоритетная машина','Поднимать ближайшую машину в начало оперативной ленты.'],
      ['newAccepted','Новые принятые','Показывать заявки, где клиент уже выбрал ваш отклик.'],
      ['todayQueue','Очередь сегодня','Показывать сегодняшние реальные записи.'],
      ['upcoming','Ближайшие записи','Показывать будущие записи после сегодняшней очереди.'],
    ];
    const choice=(name,values,current)=>`<div class="k-master-r81-choice" data-r81-choice="${name}">${values.map(value=>`<button type="button" data-r81-choice-value="${value}" class="${String(current)===String(value)?'is-active':''}">${value===0?'Выкл.':value}</button>`).join('')}</div>`;
    return `<dialog class="k-master-r81-window" data-master-workspace-settings-dialog data-r81-contract="${MASTER_WORKSPACE_R81_CONTRACT}"><div class="k-master-r81-window__shell"><header><div><small>ИНТЕРФЕЙС МАСТЕРА</small><h2>Настроить рабочий экран</h2><p>На самой странице остаются только оперативные данные. Видимость и плотность настраиваются здесь.</p></div><button type="button" data-master-workspace-settings-close aria-label="Закрыть">${icon('close')}</button></header><div class="k-master-r81-window__body"><section><h3>Что показывать</h3><div class="k-master-r81-toggle-list">${windowOptions.map(([key,title,text])=>`<button type="button" class="k-master-r81-toggle ${windows[key]!==false?'is-active':''}" data-master-workspace-window="${key}" aria-pressed="${windows[key]!==false?'true':'false'}"><span>${icon(windows[key]!==false?'check':'close')}</span><b>${esc(title)}</b><small>${esc(text)}</small></button>`).join('')}</div></section><section><h3>Параметры ленты</h3><label><span>Будущих записей</span>${choice('upcomingLimit',[3,6,9,12],Number(params.upcomingLimit||6))}</label><label><span>Автообновление, секунд</span>${choice('autoRefreshSec',[0,30,60,120,300],Number(params.autoRefreshSec??60))}</label><button type="button" class="k-master-r81-toggle ${params.compactCards?'is-active':''}" data-master-workspace-compact aria-pressed="${params.compactCards?'true':'false'}"><span>${icon(params.compactCards?'check':'close')}</span><b>Компактная лента</b><small>Уменьшает вертикальные отступы строк рабочего дня.</small></button></section></div><footer><button class="k-btn k-btn-secondary" type="button" data-master-workspace-settings-close>Отмена</button><button class="k-btn k-btn-primary" type="button" data-master-workspace-settings-save>Сохранить</button></footer></div></dialog>`;
  }

  function operationalOrderRow(order,timer,kind='queue',priority=false){
    const status=String(order.status||'').toLowerCase(),running=timer&&timer.status==='running';
    const label=kind==='future'?'БЛИЖАЙШАЯ ЗАПИСЬ':priority?'СЛЕДУЮЩАЯ МАШИНА':'СЕГОДНЯ';
    return `<article class="k-master-r81-operation is-order ${priority?'is-priority':''}" data-r81-operation="order" data-order-id="${esc(order.id)}"><div class="k-master-r81-operation__time"><small>${label}</small><strong>${esc(fmtTime(order.time)||'—')}</strong><span>${esc(order.date||'Сегодня')}</span></div><div class="k-master-r81-operation__main"><div><h3>${esc(order.clientCar||order.vehicleTitle||'Автомобиль')}</h3><span class="k-master-r81-status is-${esc(status||'new')}">${esc(statusLabel(status))}</span></div><p>${esc(order.serviceNames||'Работы по заказу')}</p><small>${esc(order.clientName||'Клиент')}</small></div><div class="k-master-r81-operation__actions"><a class="k-btn k-btn-secondary" href="#/orders/item/${encodeURIComponent(order.id)}">Заказ</a>${order.chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${esc(order.chatId)}">Чат</a>`:''}${running?`<button class="k-btn k-btn-primary" type="button" data-stop-timer="${esc(timer.id)}">Завершить</button>`:!CLOSED.has(status)?`<button class="k-btn k-btn-primary" type="button" data-start-timer="${esc(order.id)}" data-stage="${NEW_STATUSES.has(status)?'diagnosis':'repair'}">${NEW_STATUSES.has(status)?'Диагностика':'В работу'}</button>`:''}</div></article>`;
  }

  function operationalAcceptedRow(item){
    const schedule=item.schedule||{},replyState=String(item.replyState||'waiting');
    return `<article class="k-master-r81-operation is-accepted ${replyState==='overdue'?'is-warning':''}" data-r81-operation="accepted"><div class="k-master-r81-operation__time"><small>КЛИЕНТ ВЫБРАЛ ВАС</small><strong>${esc(schedule.plannedStart?fmtTime(schedule.plannedStart):'—')}</strong><span>${esc(schedule.plannedStart?String(schedule.plannedStart).slice(0,10):'Время не задано')}</span></div><div class="k-master-r81-operation__main"><div><h3>${esc(item.vehicleTitle||'Автомобиль')}</h3><span class="k-master-r81-status">Принято</span></div><p>${esc(item.serviceNames||'Работы по заказу')}</p><small>${replyState==='overdue'?'Ответ клиенту просрочен':`Ответить клиенту ≤ ${Number(item.replySlaMin||15)} мин`}</small></div><div class="k-master-r81-operation__actions"><a class="k-btn k-btn-secondary" href="#/orders/item/${encodeURIComponent(item.orderId)}">Заказ</a>${item.chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${esc(item.chatId)}">Чат</a>`:''}<button class="k-btn k-btn-primary" type="button" data-master-plan-open="${esc(item.orderId)}" data-plan-start="${esc(toLocalInput(schedule.plannedStart))}" data-plan-duration="${Number(schedule.durationMin||120)}" data-plan-reschedule="${schedule.plannedStart?'1':'0'}">${schedule.plannedStart?'Перенести':'Назначить время'}</button></div></article>`;
  }

  function operationalLeadRow(item){
    const matched=item.serviceMatched!==false,price=Number(item.price||0),responses=Number(item.responsesCount||0),id=String(item.id||'');
    return `<article class="k-master-r81-operation is-lead ${matched?'is-matched':'is-unmatched'}" data-r81-operation="lead"><div class="k-master-r81-operation__time"><small>БИРЖА</small><strong>${esc(fmtTime(item.time)||'—')}</strong><span>${esc(item.date||'По согласованию')}</span></div><div class="k-master-r81-operation__main"><div><h3>${esc(item.vehicleTitle||item.clientCar||'Автомобиль')}</h3><span class="k-master-r81-status">${matched?'Мои услуги':'Вне услуг'}</span></div><p>${esc(item.serviceNames||'Заявка на обслуживание')}</p><small>${responses} откл.${price>0?` · ${new Intl.NumberFormat('ru-RU').format(price)} ₸`:''}</small></div><div class="k-master-r81-operation__actions"><a class="k-btn k-btn-primary" href="#/master/exchange?focus=${encodeURIComponent(id)}&quick=1">Открыть заявку</a></div></article>`;
  }

  function quickCommand(path,iconName,title,badge=''){
    return `<a class="k-master-r81-command" href="${path}">${icon(iconName)}<span>${esc(title)}</span>${badge?`<em>${esc(badge)}</em>`:''}</a>`;
  }

  function exchangeLeadCard(item){
    const matched=item.serviceMatched!==false;const price=Number(item.price||0),responses=Number(item.responsesCount||0),suggested=Math.max(0,Number(item.myResponse?.price_from||item.suggestedPrice||item.price||0)),duration=Math.max(0,Number(item.suggestedDurationMin||0));const id=String(item.id||'');
    return `<article class="k-master-native-lead ${matched?'is-matched':'is-unmatched'}" data-workplace-lead="${esc(id)}"><header><span>${matched?'Подходит по услугам':'Вне Моих услуг'}</span><small>${responses} откл.</small></header><h3>${esc(item.vehicleTitle||item.clientCar||'Автомобиль')}</h3><p>${esc(item.serviceNames||'Заявка на обслуживание')}</p><div class="k-master-native-lead__meta"><span>${esc([item.date,fmtTime(item.time)].filter(Boolean).join(' · ')||'Время по согласованию')}</span>${price>0?`<b>${new Intl.NumberFormat('ru-RU').format(price)} ₸</b>`:''}</div><small class="k-master-native-lead__reason">${esc(item.matchReason||'Доступна в Бирже')}</small><div class="k-master-native-lead__quick"><label><span>Моя цена, ₸</span><input type="number" min="0" step="500" value="${suggested||''}" data-workplace-lead-price></label><label><span>Начало</span><input type="text" value="${esc(item.myResponse?.start_time||'')}" placeholder="Сегодня 18:00" data-workplace-lead-start></label><label><span>Время, мин</span><input type="number" min="15" step="15" value="${duration||''}" placeholder="120" data-workplace-lead-duration></label></div><footer><button class="k-btn k-btn-primary" type="button" data-workplace-exchange-quick="${esc(id)}" data-title="${esc(item.serviceNames||'Ремонт автомобиля')}">${item.myResponse?'Обновить отклик':'Быстрый отклик'}</button><a class="k-btn k-btn-secondary" href="#/master/exchange?focus=${encodeURIComponent(id)}&quick=1">Открыть заявку</a></footer></article>`;
  }
  function acceptedOrderCard(item){
    const schedule=item.schedule||{};const replyState=String(item.replyState||'waiting');const startState=String(schedule.state||'unscheduled');
    const replyLabel=replyState==='answered'?'Клиенту ответили':replyState==='overdue'?'Ответ клиенту просрочен':`Ответить ≤ ${Number(item.replySlaMin||15)} мин`;
    const startLabel=startState==='unscheduled'?'Время не назначено':startState==='overdue'?'Время начала прошло':startState==='soon'?'Начало в ближайшие 2 часа':'Запись назначена';
    return `<article class="k-master-r66-accepted ${replyState==='overdue'?'is-sla-overdue':''} ${startState==='soon'?'is-start-soon':''}" data-r66-accepted="${esc(item.orderId)}"><header><span>ПРИНЯТО КЛИЕНТОМ</span><small>${esc(fmtDateTime(item.acceptedAt))}</small></header><h3>${esc(item.vehicleTitle||'Автомобиль')}</h3><p>${esc(item.serviceNames||'Работы по заказу')}</p><div class="k-master-r66-sla"><span class="is-${esc(replyState)}">${esc(replyLabel)}</span><span class="is-${esc(startState)}">${esc(startLabel)}</span></div><div class="k-master-r66-plan"><b>${esc(schedule.plannedStart?fmtDateTime(schedule.plannedStart):'Запись: по согласованию')}</b>${Number(schedule.durationMin||0)>0?`<small>${Number(schedule.durationMin)} мин.</small>`:''}${schedule.conflictOverride?'<em>Конфликт подтверждён вручную</em>':''}</div><footer><a class="k-btn k-btn-secondary" href="#/orders/item/${encodeURIComponent(item.orderId)}">Открыть заказ</a>${item.chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${esc(item.chatId)}">Чат с клиентом</a>`:''}<button class="k-btn k-btn-primary" type="button" data-master-plan-open="${esc(item.orderId)}" data-plan-start="${esc(toLocalInput(schedule.plannedStart))}" data-plan-duration="${Number(schedule.durationMin||120)}" data-plan-reschedule="${schedule.plannedStart?'1':'0'}">${schedule.plannedStart?'Перенести запись':'Назначить время'}</button></footer></article>`;
  }

  function scheduleDialog(){
    return `<dialog class="k-master-native-dialog k-master-r66-plan-dialog k-master-r67-plan-dialog" data-master-plan-dialog><div class="k-master-native-dialog__panel"><header><div><small>КАЛЕНДАРЬ И ЗАГРУЗКА</small><h2 data-master-plan-title>Время работы</h2></div><button type="button" data-master-plan-close aria-label="Закрыть">${icon('close')}</button></header><div class="k-master-r66-plan-form"><div class="k-master-r67-duration" data-master-plan-duration-info><b>Рассчитываем время по «Моим услугам»</b><span>Учитываем рабочее время и резерв приёмки.</span></div><div class="k-master-r67-free-slots" data-master-plan-slots><div class="k-master-r67-loading">Ищем ближайшие свободные окна…</div></div><label><span>Выбранное начало</span><input type="datetime-local" data-master-plan-start></label><label><span>Плановая длительность, мин</span><input type="number" min="15" max="1440" step="15" value="120" data-master-plan-duration></label><label class="k-master-r67-reason" data-master-plan-reason-wrap hidden><span>Причина переноса</span><input type="text" maxlength="500" placeholder="Например: нужна дополнительная диагностика" data-master-plan-reason></label><div class="k-master-r66-conflict" data-master-plan-conflict hidden></div></div><footer><button class="k-btn k-btn-secondary" type="button" data-master-plan-close>Отмена</button><button class="k-btn k-btn-primary" type="button" data-master-plan-save>Сохранить</button><button class="k-btn k-btn-danger" type="button" data-master-plan-force hidden>Сохранить несмотря на конфликт</button></footer></div></dialog>`;
  }
  function renderFreeSlots(result){const slots=Array.isArray(result?.slots)?result.slots:[],duration=result?.duration||{};const source=duration.source==='my_services'?'по вашему времени в «Моих услугах»':duration.source==='mixed'?'по «Моим услугам» и стандартной оценке':duration.source==='standard_or_order'?'по стандартному времени/оценке заказа':'по оценке заказа';return {info:`<b>${Number(duration.serviceMinutes||0)} мин. работа + ${Number(duration.bufferMin||0)} мин. резерв</b><span>Расчёт ${esc(source)}.</span>`,html:slots.length?slots.slice(0,18).map(slot=>`<button type="button" data-master-free-slot="${esc(toLocalInput(slot.start))}" data-master-free-duration="${Number(slot.workMinutes||duration.serviceMinutes||120)}" class="${slot.capacityWarning?'is-capacity-warning':''}"><b>${esc(fmtDateTime(slot.start))}</b><span>${Number(slot.reservedMinutes||0)} мин. занято</span><small>Загрузка дня ${Number(slot.projectedLoadPct||0)}%${slot.capacityWarning?' · высокая':''}</small></button>`).join(''):'<div class="k-master-r67-no-slots"><b>Свободных окон не найдено</b><span>Измените рабочий день или проверьте следующие даты в календаре.</span></div>'};}

  function masterHomeBlock(key,body,className=''){
    return `<section class="k-master-home-block ${className}" data-master-block="${esc(key)}" data-master-home-contract="${MASTER_HOME_STRUCTURE_CONTRACT}">${body}</section>`;
  }

  const masterMoney=value=>`${new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(value||0)))} ₸`;
  function masterWorkspaceViewFromHash(){
    try{const q=new URLSearchParams(String(location.hash||'').split('?')[1]||'');const view=String(q.get('view')||'overview');return ['overview','kpi','statistics','today','paused'].includes(view)?view:'overview';}catch(_e){return'overview';}
  }
  function masterWorkspaceNav(active='overview'){
    const rows=[
      ['overview','Обзор'],
      ['kpi','KPI'],
      ['statistics','Статистика'],
      ['today','Сегодня'],
      ['paused','На паузе']
    ];
    return `<nav class="k-master-desktop-workspace-nav" aria-label="Рабочее место мастера">${rows.map(([key,label])=>`<button type="button" data-master-workspace-view="${key}" class="${active===key?'is-active':''}" aria-pressed="${active===key?'true':'false'}">${label}</button>`).join('')}</nav>`;
  }
  function masterKpiPanel(data){
    const b=data.business||{},m=b.metrics||{},ex=b.exchange||{},services=b.services||{},comm=b.communication||{},readiness=b.readiness||{};
    const completed=Math.max(0,Number(m.completedMonth||0)),total=Math.max(0,Number(m.totalOrders||0)),completionRate=total?Math.min(100,Math.round(Number(m.completedOrders||0)*100/total)):0;
    const items=[
      ['Активные заказы',m.activeOrders||0,'Сейчас в работе'],
      ['Завершено за месяц',completed,'Закрытые ремонты'],
      ['Выручка за месяц',masterMoney(m.revenueMonth||0),'По завершённым заказам'],
      ['Средний чек',masterMoney(m.averageTicket||0),'Средняя стоимость заказа'],
      ['Клиенты',m.uniqueClients||0,'Уникальные клиенты'],
      ['Конверсия биржи',`${Number(ex.winRate||0)}%`,`${Number(ex.accepted||0)} принятых из ${Number(ex.responses||0)} откликов`],
      ['Готовность профиля',`${Number(readiness.percent||0)}%`,'Профиль, услуги и график'],
      ['Закрытие заказов',`${completionRate}%`,'Доля завершённых заказов']
    ];
    return `<section class="k-master-workspace-panel k-master-kpi-panel" data-master-workspace-panel="kpi" hidden><header><div><small>KPI</small><h2>Ключевые показатели</h2><p>Рабочие показатели мастера по текущим данным KARETA.KZ.</p></div></header><div class="k-master-workspace-kpi-grid">${items.map(([label,value,text])=>`<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(text)}</small></article>`).join('')}</div><div class="k-master-workspace-kpi-foot"><a href="#/orders">Все заявки</a><a href="#/master/exchange">Биржа</a><a href="#/master/schedule">Календарь</a><a href="#/services/manage">Мои услуги</a></div></section>`;
  }
  function masterStatisticsPanel(data){
    const b=data.business||{},m=b.metrics||{},ex=b.exchange||{},services=b.services||{},comm=b.communication||{},schedule=b.schedule||{};
    const rows=[
      ['Всего заказов',Number(m.totalOrders||0),Math.max(1,Number(m.totalOrders||1))],
      ['Завершено',Number(m.completedOrders||0),Math.max(1,Number(m.totalOrders||1))],
      ['Активных услуг',Number(services.active||0),Math.max(1,Number(services.configured||1))],
      ['Рабочих дней / 14',Number(schedule.workDaysNext14||0),14],
      ['Откликов на бирже',Number(ex.responses||0),Math.max(1,Number(ex.available||0)+Number(ex.responses||0))],
      ['Принято откликов',Number(ex.accepted||0),Math.max(1,Number(ex.responses||1))]
    ];
    return `<section class="k-master-workspace-panel k-master-statistics-panel" data-master-workspace-panel="statistics" hidden><header><div><small>СТАТИСТИКА</small><h2>Нагрузка и эффективность</h2><p>Сводка по заказам, услугам, бирже и рабочему графику.</p></div><div class="k-master-statistics-summary"><span><b>${esc(masterMoney(m.revenueMonth||0))}</b><small>выручка месяца</small></span><span><b>${esc(masterMoney(m.averageTicket||0))}</b><small>средний чек</small></span><span><b>${Number(comm.unreadChats||0)}</b><small>непрочитанных чатов</small></span></div></header><div class="k-master-statistics-bars">${rows.map(([label,value,max])=>{const pct=Math.max(0,Math.min(100,Math.round(value*100/max)));return `<article><div><span>${esc(label)}</span><b>${value}</b></div><i><span style="width:${pct}%"></span></i><small>${pct}%</small></article>`;}).join('')}</div><footer><a href="#/master/schedule">Открыть календарь</a><a href="#/chats">Чаты</a><a href="#/community">Сообщество</a></footer></section>`;
  }
  function applyMasterWorkspaceView(root,view,{syncHistory=true}={}){
    if(!root)return;
    const desktop=window.matchMedia?.('(min-width: 1100px)')?.matches===true;
    const safe=desktop&&['overview','kpi','statistics','today','paused'].includes(view)?view:'overview';
    root.dataset.masterWorkspaceView=safe;
    root.querySelectorAll('[data-master-workspace-view]').forEach(btn=>{const active=btn.dataset.masterWorkspaceView===safe;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',active?'true':'false');});
    root.querySelectorAll('[data-master-workspace-panel]').forEach(panel=>{panel.hidden=panel.dataset.masterWorkspacePanel!==safe;});
    root.querySelectorAll('[data-master-block]').forEach(block=>{const key=block.dataset.masterBlock;block.hidden=safe==='overview'?false:(safe==='today'?key!=='today':safe==='paused'?key!=='paused':true);});
    if(syncHistory&&desktop){
      try{const base='#/master';history.replaceState(history.state,'',safe==='overview'?base:`${base}?view=${encodeURIComponent(safe)}`);}catch(_e){}
    }
  }

  function masterWorkZone(master){
    const ready=String(master?.id||'')!=='';
    return `<div class="k-master-home-work-zone" data-master-work-zone><div><span class="k-master-home-work-zone__icon">${icon('location')}</span><span><small>РАБОЧАЯ ЗОНА</small><b data-master-work-zone-mode>Моя рабочая зона</b><em data-master-work-zone-location>Точка, радиус выезда, ближайшие СТО и магазины</em><strong data-master-work-zone-radius>Загружается только при открытии карты</strong></span></div><button class="k-btn k-btn-secondary" type="button" data-master-work-zone-map ${ready?'':'disabled'}>${icon('location')}<span>Карта</span></button></div>`;
  }

  function masterOrderList(orders,timerByOrder,emptyTitle,emptyText,emptyAction=''){
    const rows=Array.isArray(orders)?orders:[];
    return rows.length
      ? `<div class="k-master-native-order-list">${rows.map(order=>orderCard(order,timerByOrder.get(String(order.id)))).join('')}</div>`
      : `<div class="k-empty k-master-empty-r84"><h3>${esc(emptyTitle)}</h3><p>${esc(emptyText)}</p>${emptyAction}</div>`;
  }

  function renderData(data){
    const master=data.master||{};
    const preferences=workplacePreferences(data);
    const today=Array.isArray(data.todayOrders)?data.todayOrders:[];
    const active=Array.isArray(data.activeOrders)?data.activeOrders:[];
    const waiting=Array.isArray(data.waitingOrders)?data.waitingOrders:[];
    const timers=Array.isArray(data.timers)?data.timers:[];
    const running=timers.find(timer=>timer.status==='running');
    const timerByOrder=new Map(timers.map(timer=>[String(timer.orderId),timer]));
    const availability=running?'busy':String(master.availability||'online');
    const openOrders=active.filter(order=>!CLOSED.has(String(order.status||'').toLowerCase()));
    const blocks={
      header:masterHomeBlock('header',`<header class="k-master-page-header"><div class="k-master-page-header__copy"><small>РАБОЧЕЕ МЕСТО</small><h1>Главная мастера</h1><p>Текущая смена, заявки и рабочий день.</p></div></header>`,'k-master-home-header'),
      status:masterHomeBlock('status',`<div class="k-master-native-availability is-${esc(availability)}"><div><span aria-hidden="true"></span><small>СТАТУС ПРИЁМА</small><strong>${esc(running?'Занят':availabilityLabel(availability))}</strong><p>${running?`Работа с ${esc(fmtTime(running.startedAt))}`:'Управляет доступностью для новых записей'}</p></div><div class="k-master-home-status-actions"><button class="k-btn k-btn-secondary" type="button" data-master-status-open>Изменить статус</button><button class="k-btn k-btn-secondary" type="button" data-master-workspace-settings-open>${icon('settings')}<span>Настроить</span></button></div></div>${masterWorkZone(master)}`,'k-master-home-status'),
      'quick-actions':masterHomeBlock('quick-actions',`<header class="k-master-home-section-head"><div><small>БЫСТРЫЕ ДЕЙСТВИЯ</small><h2>Быстрые действия</h2></div></header><div class="k-master-native-actions">${quickAction('#/orders','orders','Мои заявки','Все обращения и ремонты')}${quickAction('#/master','edit','Заметки','Рабочие заметки','','data-master-home-jump="notes"')}${quickAction('#/services/manage','services','Услуги','Цены и доступность')}${quickAction('#/parts','parts','Запчасти','Подбор и товары')}</div>`,'k-master-home-quick-actions'),
      'my-requests':masterHomeBlock('my-requests',`<div class="k-master-native-queue"><header><div><small>МОИ ЗАЯВКИ</small><h2>Мои заявки</h2><p>Активные заказы, которые требуют работы мастера.</p></div><a href="#/orders">Все заявки</a></header>${masterOrderList(openOrders,timerByOrder,'Активных заявок нет','Новые принятые заявки появятся здесь.','<div class="k-master-empty-r84__actions"><a class="k-btn k-btn-primary" href="#/master/exchange">Открыть Биржу</a><a class="k-btn k-btn-secondary" href="#/orders">Все заявки</a></div>')}</div>`,'k-master-home-my-requests'),
      notes:masterHomeBlock('notes',`<div class="k-master-native-upcoming"><header><div><small>ЗАМЕТКИ</small><h2>Заметки</h2></div></header><div class="k-empty k-master-home-notes-empty"><h3>Заметок пока нет</h3><p>Здесь будут ваши рабочие заметки.</p></div></div>`,'k-master-home-notes'),
      paused:masterHomeBlock('paused',`<div class="k-master-native-queue"><header><div><small>ПАУЗА</small><h2>Заявки на паузе</h2><p>Ожидание запчастей, согласования или другого блокирующего этапа.</p></div><a href="#/orders">Все заявки</a></header>${masterOrderList(waiting,timerByOrder,'Заявок на паузе нет','Остановленные заявки будут отображаться в этом блоке.','<div class="k-master-empty-r84__actions"><a class="k-btn k-btn-secondary" href="#/orders">Открыть заявки</a></div>')}</div>`,'k-master-home-paused'),
      today:masterHomeBlock('today',`<div class="k-master-native-queue"><header><div><small>СЕГОДНЯ</small><h2>Сегодня</h2><p>Записи и работы на текущий день.</p></div><a href="#/master/schedule">График</a></header>${masterOrderList(today,timerByOrder,'На сегодня записей нет','Свободное время можно открыть в графике мастера.','<div class="k-master-empty-r84__actions"><a class="k-btn k-btn-secondary" href="#/master/schedule">Открыть график</a></div>')}</div>`,'k-master-home-today'),
    };
    const orderedBlocks=MASTER_HOME_BLOCK_ORDER.map(key=>blocks[key]).join('');
    const activeView=masterWorkspaceViewFromHash();
    return `${masterWorkspaceNav(activeView)}${masterKpiPanel(data)}${masterStatisticsPanel(data)}${orderedBlocks}${statusDialog({...master,availability})}${scheduleDialog()}${workplaceSettingsDialog(preferences)}`;
  }

  function mountMasterWorkplace(context){
    const root=document.querySelector('#k-master-workplace');
    if(!root)return;
    const authenticated=Boolean(context?.state?.identity?.authenticated||context?.state?.identityReady||context?.state?.user);
    if(!authenticated){
      root.dataset.phase='auth-required';
      root.innerHTML='<section class="k-master-native-load-error"><div><small>РАБОЧЕЕ МЕСТО</small><h1>Требуется вход</h1><p>Рабочее место Мастера доступно после подтверждения сессии.</p></div></section>';
      queueMicrotask(()=>window.KaretaRouteRuntime?.navigate?.('home',{source:'master-workplace-auth-guard',replace:true,force:true}));
      return;
    }
    const lifecycle=context.lifecycle||{};
    const ensureAccess=()=>window.KaretaMasterOnboardingGate?.ensureCompleted?.({source:'master-workplace'})??Promise.resolve(false);
    let loading=false;
    let actionPending=false;
    let currentData=null;
    let refreshTimer=0;
    const desktopWorkspaceMq=window.matchMedia?.('(min-width: 1100px)');
    const onWorkspaceViewport=()=>{if(desktopWorkspaceMq&&!desktopWorkspaceMq.matches)applyMasterWorkspaceView(root,'overview',{syncHistory:false});};
    desktopWorkspaceMq?.addEventListener?.('change',onWorkspaceViewport);
    const scheduleRefresh=data=>{clearInterval(refreshTimer);refreshTimer=0;const prefs=workplacePreferences(data);root.classList.toggle('is-compact',prefs.params.compactCards===true);const sec=Number(prefs.params.autoRefreshSec||0);if(sec>0)refreshTimer=window.setInterval(()=>{if(document.visibilityState==='visible'&&!actionPending&&!root.querySelector('dialog[open]'))load().catch(()=>{});},sec*1000);};
    const openWorkZoneMap=async button=>{
      const master=currentData?.master||{},masterId=String(master.id||'');
      if(!masterId)throw new Error('MASTER_GEO_POINT_MISSING');
      button.disabled=true;
      try{
        const mineResult=await context.api.request('api/geo.php?action=mine&ownerType=master&ownerId='+encodeURIComponent(masterId),{method:'GET',cacheTtlMs:5000,cacheKey:'geo.mine.master.'+masterId});
        if(!mineResult?.ok)throw new Error(mineResult?.payload?.message||mineResult?.payload?.error||'MASTER_GEO_UNAVAILABLE');
        const minePayload=mineResult?.payload?.data||mineResult?.payload||{},own=(Array.isArray(minePayload.items)?minePayload.items:[]).filter(point=>point?.latitude!=null&&point?.longitude!=null&&String(point.latitude).trim()!==''&&String(point.longitude).trim()!==''&&Number.isFinite(Number(point.latitude))&&Number.isFinite(Number(point.longitude))&&Math.abs(Number(point.latitude))<=90&&Math.abs(Number(point.longitude))<=180),service=own.find(point=>String(point.kind||'')==='service')||null,origin=own.find(point=>String(point.kind||'')==='mobile_origin')||null,mode=service&&origin?'both':origin?'mobile':'shop',primary=origin||service;
        if(!primary)throw new Error('MASTER_GEO_POINT_MISSING');
        const lat=Number(primary.latitude),lng=Number(primary.longitude),radius=Math.max(0,Number(origin?.metadata?.radiusKm||0)),searchRadius=Math.max(5,Math.min(100,radius||20)),zone=root.querySelector('[data-master-work-zone]');
        const modeLabel=mode==='mobile'?'Выезд к клиенту':mode==='both'?'Приём + выезд':'Приём по адресу',location=[primary.city,primary.address].filter(Boolean).join(' · ')||'Рабочая точка',radiusLabel=radius>0?'Радиус выезда: '+radius+' км':'Без выездного радиуса';
        if(zone){const modeNode=zone.querySelector('[data-master-work-zone-mode]'),locationNode=zone.querySelector('[data-master-work-zone-location]'),radiusNode=zone.querySelector('[data-master-work-zone-radius]');if(modeNode)modeNode.textContent=modeLabel;if(locationNode)locationNode.textContent=location;if(radiusNode)radiusNode.textContent=radiusLabel;}
        const result=await context.api.request(`api/geo.php?action=nearby&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radiusKm=${encodeURIComponent(searchRadius)}&types=sto,shop&limit=49`,{method:'GET',cacheTtlMs:15000,cacheKey:`geo.nearby.master-zone.${lat.toFixed(3)}.${lng.toFixed(3)}.${searchRadius}`});
        if(!result?.ok)throw new Error('GEO_API_UNAVAILABLE');
        const payload=result?.payload?.data||result?.payload||{},nearby=Array.isArray(payload.items)?payload.items:[];
        const ownPoints=own.slice(0,2).map(point=>({id:'own:'+String(point.id||point.kind||''),label:String(point.kind||'')==='service'?'Место приёма':'Точка выезда',address:String(point.address||''),city:String(point.city||''),latitude:point.latitude,longitude:point.longitude,kind:String(point.kind||'work'),user:true,route:false,radiusKm:String(point.id||'')===String(primary.id||'')&&origin?radius:0}));
        const nearbyPoints=nearby.map(point=>{const type=String(point.ownerType||''),ownerId=String(point.ownerId||''),publicId=Number(point.publicId||0),profile=type==='sto'?'#/masters/profile/sto/'+encodeURIComponent(ownerId):'';return {id:type+':'+ownerId,label:String(point.label||type),address:String(point.address||''),city:String(point.city||''),distanceKm:Number(point.distanceKm),latitude:point.latitude,longitude:point.longitude,kind:type,route:true,actions:type==='sto'?[{label:'Профиль',href:profile},{label:'Записаться',href:profile,primary:true}]:(type==='shop'&&publicId>0?[{label:'Товары',href:'#/parts/store/'+encodeURIComponent(String(publicId)),primary:true}]:[])};});
        const geoMap=await window.KaretaMobile?.loadGeoMap?.();if(!geoMap?.open)throw new Error('GEO_MAP_UNAVAILABLE');
        geoMap.open({title:'Рабочая зона мастера',points:[...ownPoints,...nearbyPoints].slice(0,50),center:{latitude:lat,longitude:lng}});
      }finally{button.disabled=false;}
    };

    const load=async()=>{
      if(loading)return;
      loading=true;
      try{
        if(!(await ensureAccess()))return;
        const response=await apiModule.get(context.api,{signal:lifecycle.signal});
        if(!response.ok)throw new Error(response.payload?.message||response.payload?.error||'Не удалось загрузить рабочее место');
        if(!root.isConnected)return;
        const data=response.payload?.data||{};
        currentData=data;
        root.dataset.phase='ready';
        root.innerHTML=renderData(data);
        applyMasterWorkspaceView(root,masterWorkspaceViewFromHash(),{syncHistory:false});
        scheduleRefresh(data);
      }finally{loading=false;}
    };

    const fail=error=>{
      if(!root.isConnected)return;
      root.dataset.phase='error';
      root.innerHTML=`<section class="k-master-native-load-error"><div><small>СМЕНА</small><h1>Данные временно недоступны</h1><p>${esc(error?.message||'Проверьте соединение')}</p></div><button class="k-btn k-btn-primary" type="button" data-master-reload>Повторить</button></section>`;
    };

    const runAction=async(button,callback,success)=>{
      if(actionPending)return;
      actionPending=true;button.disabled=true;
      try{
        const response=await callback();
        if(!response?.ok)throw new Error(response?.payload?.message||response?.payload?.error||'Операция не выполнена');
        if(success)window.KaretaToast?.success?.(success);
        await load();
      }catch(error){window.KaretaToast?.error?.(error?.message||'Операция не выполнена');}
      finally{actionPending=false;if(button.isConnected)button.disabled=false;}
    };

    const click=async event=>{
      const workspaceView=event.target.closest('[data-master-workspace-view]');
      if(workspaceView){applyMasterWorkspaceView(root,workspaceView.dataset.masterWorkspaceView||'overview');return;}
      const reload=event.target.closest('[data-master-reload]');
      if(reload){load().catch(fail);return;}
      const workZoneMap=event.target.closest('[data-master-work-zone-map]');
      if(workZoneMap){try{await openWorkZoneMap(workZoneMap);}catch(error){window.KaretaToast?.error?.(error?.message==='MASTER_GEO_POINT_MISSING'?'Настройте рабочую точку в профиле мастера':'Карта рабочей зоны временно недоступна');}return;}
      const homeJump=event.target.closest('[data-master-home-jump]');
      if(homeJump){event.preventDefault();const key=String(homeJump.dataset.masterHomeJump||'');const target=[...root.querySelectorAll('[data-master-block]')].find(node=>node.dataset.masterBlock===key);target?.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}
      const openStatus=event.target.closest('[data-master-status-open]');
      if(openStatus){root.querySelector('[data-master-status-dialog]')?.showModal?.();return;}
      const closeStatus=event.target.closest('[data-master-status-close]');
      if(closeStatus){closeStatus.closest('dialog')?.close?.();return;}
      const status=event.target.closest('[data-master-status-option]');
      if(status){runAction(status,()=>apiModule.saveAvailability(context.api,{status:status.dataset.masterStatusOption}),'Статус Мастера обновлён');return;}
      const settingsOpen=event.target.closest('[data-master-workspace-settings-open]');
      if(settingsOpen){root.querySelector('[data-master-workspace-settings-dialog]')?.showModal?.();return;}
      const settingsClose=event.target.closest('[data-master-workspace-settings-close]');
      if(settingsClose){settingsClose.closest('dialog')?.close?.();return;}
      const windowToggle=event.target.closest('[data-master-workspace-window]');
      if(windowToggle){const active=!windowToggle.classList.contains('is-active');windowToggle.classList.toggle('is-active',active);windowToggle.setAttribute('aria-pressed',active?'true':'false');return;}
      const compactToggle=event.target.closest('[data-master-workspace-compact]');
      if(compactToggle){const active=!compactToggle.classList.contains('is-active');compactToggle.classList.toggle('is-active',active);compactToggle.setAttribute('aria-pressed',active?'true':'false');return;}
      const choice=event.target.closest('[data-r81-choice-value]');
      if(choice){const group=choice.closest('[data-r81-choice]');group?.querySelectorAll('[data-r81-choice-value]').forEach(x=>x.classList.toggle('is-active',x===choice));return;}
      const settingsSave=event.target.closest('[data-master-workspace-settings-save]');
      if(settingsSave){const dialog=settingsSave.closest('[data-master-workspace-settings-dialog]');const windowsOut={};dialog?.querySelectorAll('[data-master-workspace-window]').forEach(x=>windowsOut[x.dataset.masterWorkspaceWindow]=x.classList.contains('is-active'));const readChoice=name=>Number(dialog?.querySelector(`[data-r81-choice="${name}"] .is-active`)?.dataset.r81ChoiceValue||0);const paramsOut={exchangeLimit:readChoice('exchangeLimit')||6,upcomingLimit:readChoice('upcomingLimit')||6,autoRefreshSec:readChoice('autoRefreshSec'),compactCards:!!dialog?.querySelector('[data-master-workspace-compact]')?.classList.contains('is-active')};settingsSave.disabled=true;try{const response=await apiModule.savePreferences(context.api,{windows:windowsOut,params:paramsOut});if(!response.ok)throw new Error(response.payload?.message||response.payload?.error||'Настройки не сохранены');dialog?.close?.();window.KaretaToast?.success?.('Рабочий экран обновлён');await load();}catch(error){window.KaretaToast?.error?.(error?.message||'Не удалось сохранить настройки');}finally{if(settingsSave.isConnected)settingsSave.disabled=false;}return;}
      const planOpen=event.target.closest('[data-master-plan-open]');if(planOpen){const dialog=root.querySelector('[data-master-plan-dialog]');if(dialog){dialog.dataset.orderId=planOpen.dataset.masterPlanOpen||'';dialog.dataset.reschedule=planOpen.dataset.planReschedule||'0';const startInput=dialog.querySelector('[data-master-plan-start]'),durationInput=dialog.querySelector('[data-master-plan-duration]'),warning=dialog.querySelector('[data-master-plan-conflict]'),force=dialog.querySelector('[data-master-plan-force]'),save=dialog.querySelector('[data-master-plan-save]'),reasonWrap=dialog.querySelector('[data-master-plan-reason-wrap]'),title=dialog.querySelector('[data-master-plan-title]'),slots=dialog.querySelector('[data-master-plan-slots]'),info=dialog.querySelector('[data-master-plan-duration-info]');if(startInput)startInput.value=planOpen.dataset.planStart||'';if(durationInput)durationInput.value=planOpen.dataset.planDuration||'120';if(warning){warning.hidden=true;warning.innerHTML='';}if(force)force.hidden=true;if(reasonWrap)reasonWrap.hidden=dialog.dataset.reschedule!=='1';if(title)title.textContent=dialog.dataset.reschedule==='1'?'Предложить перенос клиенту':'Назначить время';if(save)save.textContent=dialog.dataset.reschedule==='1'?'Предложить клиенту':'Сохранить время';if(slots)slots.innerHTML='<div class="k-master-r67-loading">Ищем ближайшие свободные окна…</div>';dialog.showModal?.();try{const r=await apiModule.freeSlots(context.api,{orderId:dialog.dataset.orderId,days:10});if(!r.ok)throw new Error(r.payload?.message||'Не удалось рассчитать окна');const view=renderFreeSlots(r.payload?.result||{});if(slots)slots.innerHTML=view.html;if(info)info.innerHTML=view.info;const suggested=r.payload?.result?.duration?.serviceMinutes;if(durationInput&&Number(suggested)>0)durationInput.value=String(suggested);}catch(error){if(slots)slots.innerHTML=`<div class="k-master-r67-no-slots"><b>Расчёт недоступен</b><span>${esc(error?.message||'Проверьте календарь вручную')}</span></div>`;}}return;}
      const freeSlot=event.target.closest('[data-master-free-slot]');if(freeSlot){const dialog=freeSlot.closest('[data-master-plan-dialog]');dialog?.querySelectorAll('[data-master-free-slot]').forEach(x=>x.classList.toggle('is-selected',x===freeSlot));const startInput=dialog?.querySelector('[data-master-plan-start]'),durationInput=dialog?.querySelector('[data-master-plan-duration]');if(startInput)startInput.value=freeSlot.dataset.masterFreeSlot||'';if(durationInput&&Number(freeSlot.dataset.masterFreeDuration)>0)durationInput.value=freeSlot.dataset.masterFreeDuration;return;}
      const planClose=event.target.closest('[data-master-plan-close]');if(planClose){planClose.closest('dialog')?.close?.();return;}
      const planSave=event.target.closest('[data-master-plan-save], [data-master-plan-force]');if(planSave){const dialog=planSave.closest('[data-master-plan-dialog]'),orderId=dialog?.dataset.orderId||'',plannedStart=String(dialog?.querySelector('[data-master-plan-start]')?.value||''),durationMin=Number(dialog?.querySelector('[data-master-plan-duration]')?.value||120),forceConflict=planSave.hasAttribute('data-master-plan-force'),isReschedule=dialog?.dataset.reschedule==='1',reason=String(dialog?.querySelector('[data-master-plan-reason]')?.value||'').trim();if(!plannedStart){dialog?.querySelector('[data-master-plan-start]')?.focus();window.KaretaToast?.error?.('Выберите свободное окно');return;}planSave.disabled=true;try{const response=isReschedule?await apiModule.proposeReschedule(context.api,{orderId,plannedStart,durationMin,reason}):await apiModule.saveOrderPlan(context.api,{orderId,plannedStart,durationMin,forceConflict});if(!response.ok){if(!isReschedule&&(Number(response.status||0)===409||response.payload?.error==='schedule_conflict')){const preview=response.payload?.preview||response.payload?.result?.preview||{};const warning=dialog?.querySelector('[data-master-plan-conflict]'),force=dialog?.querySelector('[data-master-plan-force]');const conflicts=Array.isArray(preview.conflicts)?preview.conflicts:[];if(warning){warning.hidden=false;warning.innerHTML=`<b>Есть пересечение</b>${conflicts.map(c=>`<span>${esc(c.title||'Занято')} · ${esc(fmtDateTime(c.start))}–${esc(fmtDateTime(c.end))}</span>`).join('')}`;}if(force)force.hidden=false;return;}throw new Error(response.payload?.message||response.payload?.error||(isReschedule?'Не удалось предложить перенос':'Не удалось сохранить время'));}dialog?.close?.();window.KaretaToast?.success?.(isReschedule?'Перенос отправлен клиенту на подтверждение':'Время заказа сохранено');await load();}catch(error){window.KaretaToast?.error?.(error?.message||(isReschedule?'Не удалось предложить перенос':'Не удалось сохранить время'));}finally{if(planSave.isConnected)planSave.disabled=false;}return;}
      const quick=event.target.closest('[data-workplace-exchange-quick]');if(quick){const card=quick.closest('[data-workplace-lead]'),price=Number(card?.querySelector('[data-workplace-lead-price]')?.value||0),startText=String(card?.querySelector('[data-workplace-lead-start]')?.value||'').trim(),duration=Number(card?.querySelector('[data-workplace-lead-duration]')?.value||0);if(price<=0){card?.querySelector('[data-workplace-lead-price]')?.focus();window.KaretaToast?.error?.('Укажите цену');return;}if(!startText){card?.querySelector('[data-workplace-lead-start]')?.focus();window.KaretaToast?.error?.('Укажите время начала');return;}await runAction(quick,()=>apiModule.saveExchangeResponse(context.api,{request_id:quick.dataset.workplaceExchangeQuick,request_title:quick.dataset.title||'',priceType:'fixed',price_from:price,price_to:price,start_time:startText,duration_text:duration>0?`${duration} мин`:'По оценке заявки',warranty_text:'По условиям работ',comment:'Быстрый отклик с рабочего места',work_format:'service'}),'Отклик отправлен');return;}const start=event.target.closest('[data-start-timer]');
      if(start){runAction(start,()=>apiModule.startTimer(context.api,{orderId:start.dataset.startTimer,stageKey:start.dataset.stage||'repair'}),'Рабочий этап начат');return;}
      const stop=event.target.closest('[data-stop-timer]');
      if(stop){runAction(stop,()=>apiModule.stopTimer(context.api,{timerId:stop.dataset.stopTimer}),'Рабочий этап завершён');return;}
      const chat=event.target.closest('[data-order-chat]');
      if(chat){try{sessionStorage.setItem('kareta.chat.open',chat.dataset.orderChat||'');}catch(_e){}return;}
    };

    root.addEventListener('click',click);
    lifecycle.addCleanup?.(()=>{clearInterval(refreshTimer);desktopWorkspaceMq?.removeEventListener?.('change',onWorkspaceViewport);root.removeEventListener('click',click);});
    load().catch(fail);
  }

  window.KaretaMasterWorkplacePages=Object.freeze({renderMasterWorkplace,mountMasterWorkplace,renderData});
})();
