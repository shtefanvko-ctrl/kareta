(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  const icon = name => window.KaretaUIIcons?.icon?.(name) || window.KaretaUIIcons?.svg?.(name) || '';
  const R65_CLIENT_ACCEPTANCE_COMPAT='onSuccess:result=>acceptedExchangeNextAction';
  const R67_CLIENT_RESCHEDULE_CONTRACT='R188.5.5.6.67';
  const R69_CLIENT_ARRIVAL_CONTRACT='R188.5.5.6.69';
  const ordersApi = window.KaretaOrdersApi;
  const ordersState = window.KaretaOrdersState;
  const workflow = window.KaretaWorkflowEngine;
  if (!ui) throw new Error('KaretaPageUI is required before pages/orders.js');
  if (!ordersApi) throw new Error('KaretaOrdersApi is required before pages/orders.js');
  if (!ordersState) throw new Error('KaretaOrdersState is required before pages/orders.js');

  const STATUS_LABELS = Object.freeze({
    new:'Новая',
    waiting_responses:'Ожидает откликов',
    process:'В работе',
    accepted:'Принята',
    assigned:'Назначена',
    in_progress:'В работе',
    completed:'Выполнена',
    done:'Выполнена',
    delivered:'Выдана',
    closed:'Закрыта',
    cancelled:'Отменена',
    warranty_return:'Возврат по гарантии',
  });
  const COMPLETED = new Set(['completed','done','delivered','closed']);
  const CANCELLED = new Set(['cancelled']);
  const CLIENT_UI_KEY = 'kareta.client.orders.native.v1';

  let clientExchangeSnapshot = { orders:[], stats:{}, receivedAt:0 };
  let clientExchangeError = '';
  let clientRescheduleSnapshot = { proposals:[], receivedAt:0 };
  let clientRescheduleError = '';
  let clientArrivalSnapshot = { states:[], receivedAt:0 };
  let clientArrivalError = '';

  function statusLabel(status){
    return STATUS_LABELS[status] || String(status || 'Без статуса');
  }

  function formatPrice(value){
    const amount = Number(value || 0);
    return amount > 0 ? `${new Intl.NumberFormat('ru-RU').format(amount)} ₸` : '';
  }

  function progressFor(status){
    const map={new:12,waiting_responses:22,accepted:35,assigned:45,process:58,in_progress:68,completed:92,done:96,delivered:98,closed:100,cancelled:100,warranty_return:54};
    return map[status] ?? 10;
  }

  function formatDate(value){
    if(!value) return '';
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});
  }

  function dateTs(value){
    const ts=value?new Date(value).getTime():0;
    return Number.isFinite(ts)?ts:0;
  }

  function currentRole(){
    return String(window.KaretaRoleAccess?.currentRole?.() || window.KaretaNext?.state?.user?.role || 'client').toLowerCase();
  }

  function uiIcon(name){
    return window.KaretaUIIcons?.svg?.(name)||'';
  }

  function roleCopy(role){
    const map={
      master:{title:'Мои ремонты',description:'Назначенные вам автомобили, этапы ремонта, связь с клиентом и история выполненных работ.',toolbar:'Заказы мастера',toolbarText:'Только ваши назначенные, активные и завершённые ремонты.',create:'Записать клиента',emptyTitle:'У вас пока нет назначенных ремонтов',emptyText:'Запишите клиента на себя или дождитесь назначения заказа от СТО.',search:'Номер, клиент, автомобиль или услуга'},
      sto:{title:'Заказы СТО',description:'Очередь, назначение мастеров, статусы ремонтов и история только вашего автосервиса.',toolbar:'Журнал СТО',toolbarText:'Все заказы, привязанные к вашему СТО и его мастерам.',create:'Создать заказ',emptyTitle:'У СТО пока нет заказов',emptyText:'Создайте запись клиенту или назначьте мастера после поступления заявки.',search:'Номер, клиент, мастер, автомобиль или услуга'},
      seller:{title:'Заказы запчастей',description:'Заявки на запчасти, комплектацию и переписку с покупателями.',toolbar:'Заказы продавца',toolbarText:'Ваши запросы и заказы по товарам.',create:'Создать заявку',emptyTitle:'Заказов пока нет',emptyText:'Новые запросы на запчасти появятся здесь.',search:'Номер, товар, автомобиль или клиент'},
      client:{title:'Мои заявки',description:'Ремонт, предложения исполнителей и история автомобиля в одном рабочем потоке.',toolbar:'Мои заявки',toolbarText:'Все обращения, статусы и переписка в одном месте.',create:'Создать заявку',emptyTitle:'Заявок пока нет',emptyText:'Создайте первую заявку — она попадёт подходящим Мастерам и СТО.',search:'Номер, услуга или автомобиль'}
    };
    return map[role] || map.client;
  }

  function exchangeByOrderId(id){
    return (clientExchangeSnapshot.orders||[]).find(item=>String(item.id)===String(id)) || null;
  }

  function rescheduleByOrderId(id){
    return (clientRescheduleSnapshot.proposals||[]).find(item=>String(item.orderId)===String(id)) || null;
  }

  function arrivalByOrderId(id){
    return (clientArrivalSnapshot.states||[]).find(item=>String(item.orderId)===String(id)) || null;
  }

  function formatDateTime(value){
    if(!value) return '—';
    const date=new Date(String(value).replace(' ','T'));
    if(Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function clientReschedulePanel(proposal){
    if(!proposal) return '';
    const reason=String(proposal.reason||'').trim();
    return `<section class="k-client-r67-reschedule" data-client-reschedule-proposal="${ui.escHtml(proposal.id)}"><header><div><small>МАСТЕР ПРЕДЛАГАЕТ ПЕРЕНОС</small><strong>${ui.escHtml(proposal.masterName||'Мастер')}</strong></div><span>Ожидает решения</span></header><div class="k-client-r67-reschedule__times"><div><small>Сейчас</small><b>${ui.escHtml(formatDateTime(proposal.currentStart))}</b></div><div><small>Предлагает</small><b>${ui.escHtml(formatDateTime(proposal.proposedStart))}</b></div></div><p>Работа ${Math.max(0,Number(proposal.durationMin||0))} мин${Number(proposal.bufferMin||0)>0?` + ${Number(proposal.bufferMin)} мин резерв`:''}.${reason?` Причина: ${ui.escHtml(reason)}`:''}</p><div class="k-client-r67-reschedule__actions"><button class="k-btn k-btn-primary" type="button" data-client-reschedule-accept="${ui.escHtml(proposal.id)}">Подтвердить</button><button class="k-btn k-btn-secondary" type="button" data-client-reschedule-decline="${ui.escHtml(proposal.id)}">Отклонить</button>${proposal.chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${ui.escHtml(proposal.chatId)}">Чат</a>`:''}</div></section>`;
  }

  function clientArrivalPanel(order,state){
    if(!state||!state.masterId||clientOrderCategory(order)!=='active')return '';
    const labels={on_way:'Еду',arrived:'Прибыл',late:'Опаздываю',no_show:'Не приехал'};
    const current=String(state.status||''),locked=current==='no_show';
    const detail=current?`${labels[current]||current}${Number(state.etaMinutes||0)>0&&['on_way','late'].includes(current)?` · ${Number(state.etaMinutes)} мин`:''}`:'Статус ещё не отправлен';
    return `<section class="k-client-r69-arrival ${locked?'is-no-show':''}" data-client-arrival="${ui.escHtml(order.id)}"><header><div><small>ПРИЕЗД НА ЗАПИСЬ</small><strong>${ui.escHtml(formatDateTime(state.plannedStart)||'Время уточняется')}</strong></div><span>${ui.escHtml(detail)}</span></header>${locked?`<p>Мастер отметил неявку, рабочее окно освобождено. Новое время согласуйте в чате или через перенос записи.</p>`:`<div class="k-client-r69-arrival__controls"><label>ETA, мин<input type="number" min="5" max="360" step="5" value="${Math.max(5,Number(state.etaMinutes||20))}" data-client-arrival-eta></label><div><button type="button" class="k-btn k-btn-secondary" data-client-arrival-status="on_way" data-order-id="${ui.escHtml(order.id)}">Еду</button><button type="button" class="k-btn k-btn-primary" data-client-arrival-status="arrived" data-order-id="${ui.escHtml(order.id)}">Прибыл</button><button type="button" class="k-btn k-btn-secondary" data-client-arrival-status="late" data-order-id="${ui.escHtml(order.id)}">Опаздываю</button></div></div>`}</section>`;
  }

  function clientOrderCategory(order){
    const status=String(order?.status||'');
    if(COMPLETED.has(status)) return 'completed';
    if(CANCELLED.has(status)) return 'cancelled';
    return 'active';
  }

  function renderStoOrderRow(order){
    const client=order.clientName||'Клиент';
    const performer=order.masterName||'Мастер не назначен';
    const stage=order.currentStage||statusLabel(order.status);
    const price=formatPrice(order.price)||'Уточняется';
    const meta=[order.car,formatDate(order.createdAt)].filter(Boolean).join(' · ')||'Автомобиль уточняется';
    const eta=order.estimatedEnd||'По согласованию';
    return `<article class="k-sto-r75-order" data-order-id="${ui.escHtml(order.id)}" data-order-status="${ui.escHtml(order.status)}">
      <div class="k-sto-r75-order__state"><span class="k-order-status k-order-status--${ui.escHtml(order.status)}">${ui.escHtml(statusLabel(order.status))}</span><small>${ui.escHtml(order.number?`№ ${order.number}`:order.id)}</small></div>
      <a class="k-sto-r75-order__main" href="#/orders/item/${encodeURIComponent(order.id)}"><strong>${ui.escHtml(order.serviceNames||'Работы по заявке')}</strong><span>${ui.escHtml(meta)}</span><small>${ui.escHtml(client)} · ${ui.escHtml(performer)}</small></a>
      <div class="k-sto-r75-order__facts"><span><small>Этап</small><b>${ui.escHtml(stage)}</b></span><span><small>Стоимость</small><b>${ui.escHtml(price)}</b></span><span><small>Готовность</small><b>${ui.escHtml(eta)}</b></span></div>
      <div class="k-sto-r75-order__actions"><a class="k-btn k-btn-primary" href="#/orders/item/${encodeURIComponent(order.id)}">${uiIcon('orders')}<span>Заказ</span></a>${order.chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${ui.escHtml(order.chatId)}">${uiIcon('chats')}<span>Чат</span></a>`:''}<a class="k-btn k-btn-secondary" href="#/workflow">${uiIcon('work')}<span>Процесс</span></a></div>
    </article>`;
  }

  function renderOrderCard(order, role=currentRole()){
    const meta = [order.car, order.createdAt].filter(Boolean).join(' · ');
    const price = formatPrice(order.price);
    const progress=workflow?.progressFor(order.status) ?? progressFor(order.status);
    const performer=order.masterName||order.stoName||(role==='master'?'Вы назначены исполнителем':'Подбираем исполнителя');
    const client=order.clientName||'Клиент';
    const stage=order.currentStage||statusLabel(order.status);
    const warranty=order.warrantyDays>0?`${order.warrantyDays} дн.`:'Уточняется';
    const eta=order.estimatedEnd||'По согласованию';
    return `<article class="k-order-card" data-order-id="${ui.escHtml(order.id)}" data-order-status="${ui.escHtml(order.status)}">
      <div class="k-order-card__top">
        <span class="k-order-status k-order-status--${ui.escHtml(order.status)}">${ui.escHtml(statusLabel(order.status))}</span>
        <span class="k-order-number">${ui.escHtml(order.number ? `№ ${order.number}` : order.id)}</span>
      </div>
      <a class="k-order-card__body" href="#/orders/item/${encodeURIComponent(order.id)}" aria-label="Открыть заказ-наряд ${ui.escHtml(order.number || order.id)}">
        <h3>${ui.escHtml(order.serviceNames)}</h3>
        <p>${ui.escHtml(meta || 'Автомобиль и дата уточняются')}</p>
        ${workflow?workflow.renderPipeline(order.status,{compact:true}):`<div class="k-order-progress" aria-label="Прогресс заявки"><span style="width:${progress}%"></span></div>`}
        <div class="k-order-card__facts">
          ${role!=='client'?`<div><small>Клиент</small><strong>${ui.escHtml(client)}</strong></div>`:''}
          <div><small>${role==='master'?'СТО / исполнитель':'Исполнитель'}</small><strong>${ui.escHtml(performer)}</strong></div>
          <div><small>Стоимость</small><strong>${ui.escHtml(price || 'Уточняется')}</strong></div>
          <div><small>Текущий этап</small><strong>${ui.escHtml(stage)}</strong></div>
          <div><small>Готовность</small><strong>${ui.escHtml(eta)}</strong></div>
          <div><small>Гарантия</small><strong>${ui.escHtml(warranty)}</strong></div>
        </div>
      </a>
      <div class="k-order-card__actions">
        <a class="k-btn k-btn-primary" href="#/orders/item/${encodeURIComponent(order.id)}">Открыть заявку</a>
        ${order.chatId ? `<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${ui.escHtml(order.chatId)}">Чат</a>` : '<a class="k-btn k-btn-secondary" href="#/chats">Консультант</a>'}
        ${order.phone?`<a class="k-btn k-btn-secondary" href="tel:${ui.escHtml(order.phone)}">Позвонить</a>`:''}
        ${order.address?`<a class="k-btn k-btn-secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}">Маршрут</a>`:''}
        ${role==='client'&&COMPLETED.has(order.status)?`<button class="k-btn k-btn-secondary" type="button" data-repeat-order="${ui.escHtml(order.id)}">Повторить</button>`:''}
      </div>
    </article>`;
  }

  function renderClientOrderCard(order){
    const exchange=exchangeByOrderId(order.id);
    const reschedule=rescheduleByOrderId(order.id);
    const arrival=arrivalByOrderId(order.id);
    const responses=Array.isArray(exchange?.responses)?exchange.responses:[];
    const responsesCount=Number(exchange?.responsesCount||responses.length||0);
    const accepted=responses.find(item=>item.status==='accepted');
    const performer=accepted?.masterName||order.masterName||order.stoName||'Исполнитель ещё не выбран';
    const stage=order.currentStage||statusLabel(order.status);
    const progress=workflow?.progressFor(order.status) ?? progressFor(order.status);
    const price=formatPrice(order.price);
    const date=formatDate(order.createdAt);
    const category=clientOrderCategory(order);
    const hasOffers=responsesCount>0;
    const range=exchange?.minOffer
      ? `${exchangeMoney(exchange.minOffer)}${exchange.maxOffer&&Number(exchange.maxOffer)!==Number(exchange.minOffer)?` — ${exchangeMoney(exchange.maxOffer)}`:''}`
      : '';
    const deadline=exchange?.deadlineAt?new Date(exchange.deadlineAt):null;
    const exchangeOpen=['new','waiting_responses'].includes(String(order.status||''));
    const expired=deadline&&!Number.isNaN(deadline.getTime())&&deadline.getTime()<=Date.now();
    const stateClass=category==='completed'?'is-completed':category==='cancelled'?'is-cancelled':accepted?'is-assigned':hasOffers?'has-offers':'is-active';

    return `<article class="k-client-order-card ${stateClass}" data-order-id="${ui.escHtml(order.id)}" data-order-status="${ui.escHtml(order.status)}" data-order-category="${ui.escHtml(category)}" data-order-has-offers="${hasOffers?'1':'0'}" data-order-created="${dateTs(order.createdAt)}" data-order-price="${Number(order.price||0)}">
      <header class="k-client-order-card__head">
        <div class="k-client-order-card__status"><span>${ui.escHtml(statusLabel(order.status))}</span>${hasOffers&&exchangeOpen?`<b>${responsesCount} ${responsesCount===1?'отклик':'откликов'}</b>`:''}</div>
        <div class="k-client-order-card__number"><b>${ui.escHtml(order.number?`№ ${order.number}`:order.id)}</b>${date?`<small>${ui.escHtml(date)}</small>`:''}</div>
      </header>
      <div class="k-client-order-card__main">
        <div class="k-client-order-card__identity">
          <span class="k-client-order-card__icon" aria-hidden="true">●</span>
          <div><h3>${ui.escHtml(order.serviceNames||'Заявка на ремонт')}</h3><p>${ui.escHtml(order.car||'Автомобиль не указан')}</p></div>
        </div>
        <div class="k-client-order-card__progress" aria-label="Готовность ${progress}%"><span style="width:${progress}%"></span></div>
        <div class="k-client-order-card__facts">
          <div><small>Сейчас</small><strong>${ui.escHtml(stage)}</strong></div>
          <div><small>Исполнитель</small><strong>${ui.escHtml(performer)}</strong></div>
          <div><small>Стоимость</small><strong>${ui.escHtml(price||range||'Уточняется')}</strong></div>
          <div><small>Готовность</small><strong>${ui.escHtml(order.estimatedEnd||'По согласованию')}</strong></div>
        </div>
        ${clientReschedulePanel(reschedule)}
        ${clientArrivalPanel(order,arrival)}
        ${exchangeOpen?`<section class="k-client-order-offers ${hasOffers?'has-items':'is-waiting'}">
          <div><small>${expired?'Раунд завершён':'Предложения исполнителей'}</small><strong>${hasOffers?`${responsesCount} · ${range||'цены указаны внутри'}`:'Мастера оценивают заявку'}</strong></div>
          ${hasOffers?`<button type="button" class="k-btn k-btn-secondary" data-client-order-offers="${ui.escHtml(order.id)}">Сравнить</button>`:expired?`<button type="button" class="k-btn k-btn-secondary" data-client-order-offers="${ui.escHtml(order.id)}">Открыть</button>`:'<span class="k-client-order-offers__pulse" aria-label="Ожидаем предложения"></span>'}
        </section>`:''}
      </div>
      <footer class="k-client-order-card__actions">
        <a class="k-btn k-btn-primary" href="#/orders/item/${encodeURIComponent(order.id)}">Открыть заявку</a>
        <button class="k-btn k-btn-secondary" type="button" data-client-order-actions="${ui.escHtml(order.id)}">Действия</button>
      </footer>
    </article>`;
  }

  function renderClientState(snapshot){
    if(snapshot.phase==='loading'||snapshot.phase==='idle'){
      return `<section class="k-client-orders-loading" aria-live="polite"><div></div><div></div><div></div></section>`;
    }
    if(snapshot.phase==='error'){
      return `<section class="k-client-orders-empty" aria-live="assertive"><span>!</span><div><h2>Не удалось загрузить заявки</h2><p>${ui.escHtml(snapshot.error?.message||'Проверьте соединение и повторите попытку.')}</p><button class="k-btn k-btn-primary" type="button" data-orders-retry>Повторить</button></div></section>`;
    }
    if(snapshot.phase==='empty'){
      return `<section class="k-client-orders-empty"><span>＋</span><div><h2>Заявок пока нет</h2><p>Создайте первую заявку — она попадёт подходящим Мастерам и СТО, а дальнейший ремонт останется связан с вашим автомобилем.</p><a class="k-btn k-btn-primary" href="#/orders/new">Создать заявку</a></div></section>`;
    }
    return `<section class="k-client-orders-list" data-client-order-list>${snapshot.orders.map(renderClientOrderCard).join('')}</section>`;
  }

  function renderState(snapshot, role=currentRole()){
    if(role==='client') return renderClientState(snapshot);
    const copy=roleCopy(role);
    if (snapshot.phase === 'loading' || snapshot.phase === 'idle') {
      return `<section class="k-empty" aria-live="polite"><h2 class="k-section-title">Загрузка заказов</h2><p>Получаем актуальные заявки из API.</p></section>`;
    }
    if (snapshot.phase === 'error') {
      return `<section class="k-empty" aria-live="assertive"><h2 class="k-section-title">Не удалось загрузить заявки</h2><p>${ui.escHtml(snapshot.error && snapshot.error.message || 'Проверьте соединение и повторите попытку.')}</p><button class="k-btn k-btn-primary" type="button" data-orders-retry>Повторить</button></section>`;
    }
    if (snapshot.phase === 'empty') {
      return `<section class="k-empty"><h2 class="k-section-title">${ui.escHtml(copy.emptyTitle)}</h2><p>${ui.escHtml(copy.emptyText)}</p><div class="k-orders-toolbar__actions"><a class="k-btn k-btn-secondary k-orders-workflow-link" href="#/workflow">${uiIcon('work')}<span>Производство</span></a><a class="k-btn k-btn-primary" href="#/orders/new">${ui.escHtml(copy.create)}</a></div></section>`;
    }
    if(role==='sto') return `<section class="k-sto-r75-orders-list">${snapshot.orders.map(renderStoOrderRow).join('')}</section>`;
    return `<section class="k-orders-grid k-orders-grid--${ui.escHtml(role)}">${snapshot.orders.map(order=>renderOrderCard(order,role)).join('')}</section>`;
  }

  function exchangeMoney(v){const n=Number(v||0);return n?`${new Intl.NumberFormat('ru-RU').format(n)} ₸`:'—';}

  function exchangeResponseCard(orderId,r){
    const price=r.priceTo>r.priceFrom&&r.priceFrom>0?`${exchangeMoney(r.priceFrom)}–${exchangeMoney(r.priceTo)}`:exchangeMoney(r.priceFrom||r.priceTo);
    return `<article class="k-client-native-bid" data-client-bid="${ui.escHtml(r.id)}">
      <header><div class="k-client-native-bid__avatar" aria-hidden="true">${ui.escHtml(String(r.masterName||'М').slice(0,1).toUpperCase())}</div><div><b>${ui.escHtml(r.masterName||'Мастер')}</b><span>${ui.escHtml(r.stoName||r.masterSpec||'Частный мастер')}</span></div><strong>${price}</strong></header>
      <div class="k-client-native-bid__facts"><span><small>Рейтинг</small><b>★ ${Number(r.rating||0).toFixed(1)}</b><em>${Number(r.reviewsCount||0)} отзывов</em></span><span><small>Начало</small><b>${ui.escHtml(r.startTime||'По согласованию')}</b></span><span><small>Срок</small><b>${ui.escHtml(r.duration||'Уточняется')}</b></span><span><small>Гарантия</small><b>${ui.escHtml(r.warranty||'Уточняется')}</b></span></div>
      ${r.comment?`<p>${ui.escHtml(r.comment)}</p>`:''}
      <div class="k-client-native-bid__actions">${r.status==='accepted'?'<span class="k-client-native-bid__accepted">✓ Исполнитель выбран</span>':r.status==='declined'?'<span class="k-client-native-bid__declined">Отклонено</span>':`<button class="k-btn k-btn-primary" type="button" data-client-bid-choose="${ui.escHtml(r.id)}" data-order-id="${ui.escHtml(orderId)}">Выбрать исполнителя</button><button class="k-btn k-btn-secondary" type="button" data-client-bid-decline="${ui.escHtml(r.id)}" data-order-id="${ui.escHtml(orderId)}">Отклонить</button>`}</div>
    </article>`;
  }

  function clientDialogShell(){
    return `<dialog class="k-client-orders-dialog" data-client-orders-dialog aria-labelledby="k-client-orders-dialog-title"><div class="k-client-orders-dialog__sheet" data-state-modal-scroll><header><div><span data-client-orders-dialog-kicker>ЗАЯВКА</span><h2 id="k-client-orders-dialog-title" data-client-orders-dialog-title>Действие</h2></div><button type="button" data-client-orders-dialog-close aria-label="Закрыть">${icon('close')}</button></header><div class="k-client-orders-dialog__body" data-client-orders-dialog-body></div></div></dialog>`;
  }

  function renderClientOrders(context){
    clientExchangeSnapshot={orders:[],stats:{},receivedAt:0};
    clientExchangeError='';
    clientRescheduleSnapshot={proposals:[],receivedAt:0};
    clientRescheduleError='';
    clientArrivalSnapshot={states:[],receivedAt:0};
    clientArrivalError='';
    return `<section class="k-page k-client-orders-native" data-page="orders orders-client" data-client-orders-native data-r67-contract="${R67_CLIENT_RESCHEDULE_CONTRACT}" data-r69-arrival-contract="${R69_CLIENT_ARRIVAL_CONTRACT}">
      <header class="k-client-orders-native__head">
        <div><span>МОИ ЗАЯВКИ</span><h1>Ремонт и обслуживание</h1><p>Каждая заявка связана с автомобилем, предложениями исполнителей и дальнейшим заказ-нарядом.</p></div>
        <a class="k-btn k-btn-primary" href="#/orders/new">＋ Создать заявку</a>
      </header>
      <section class="k-client-orders-status-grid" aria-label="Состояние заявок">
        <button type="button" class="is-active" data-client-order-status-filter="all"><span>Все</span><b data-client-orders-count="all">0</b><small>Все обращения</small></button>
        <button type="button" data-client-order-status-filter="active"><span>Активные</span><b data-client-orders-count="active">0</b><small>Сейчас в процессе</small></button>
        <button type="button" data-client-order-status-filter="offers"><span>Отклики</span><b data-client-orders-count="offers">0</b><small>Есть выбор мастера</small></button>
        <button type="button" data-client-order-status-filter="completed"><span>Готово</span><b data-client-orders-count="completed">0</b><small>История ремонтов</small></button>
      </section>
      <section class="k-client-orders-tools" aria-label="Поиск заявок">
        <label class="k-client-orders-search"><span aria-hidden="true">${icon('search')}</span><input type="search" data-order-search placeholder="Номер, услуга или автомобиль" autocomplete="off"></label>
        <button type="button" class="k-btn k-btn-secondary" data-client-orders-filter-open>Фильтры</button>
      </section>
      <div class="k-client-orders-exchange-note" data-client-orders-exchange-note hidden></div>
      <div class="k-orders-search-result" data-orders-search-result aria-live="polite"></div>
      <div id="k-orders-content" data-orders-role="client" data-orders-phase="idle">${renderClientState(ordersState.getSnapshot())}</div>
      ${clientDialogShell()}
    </section>`;
  }

  function renderOrders(context){
    const role=currentRole();
    if(role==='client') return renderClientOrders(context);
    const copy=roleCopy(role);
    const body = `<section class="k-orders-toolbar k-orders-toolbar--${ui.escHtml(role)} ${role==='sto'?'k-sto-r75-orders-toolbar':''}"><div><strong>${ui.escHtml(copy.toolbar)}</strong><span>${ui.escHtml(copy.toolbarText)}</span></div><div class="k-orders-toolbar__actions"><a class="k-btn k-btn-secondary k-orders-workflow-link" href="#/workflow">${uiIcon('work')}<span>Производство</span></a><a class="k-btn k-btn-primary" href="#/orders/new">${ui.escHtml(copy.create)}</a></div></section>
      <section class="k-orders-toolbar-v2" aria-label="Поиск заказов">
        <label class="k-masters-search"><span class="k-masters-search__icon" aria-hidden="true">${icon('search')}</span><input type="search" data-order-search placeholder="${ui.escHtml(copy.search)}" autocomplete="off"></label>
        <div class="k-masters-filter-wrap"><button type="button" class="k-masters-filter-button" data-order-filter-toggle aria-expanded="false"><span aria-hidden="true">≡</span><span data-order-filter-label>Все</span></button><div class="k-masters-filter-panel" data-order-filter-panel hidden><button type="button" class="is-active" data-order-filter="all">Все заказы</button><button type="button" data-order-filter="active">Активные</button><button type="button" data-order-filter="completed">Завершённые</button><button type="button" data-order-filter="cancelled">Отменённые</button></div></div>
        <button type="button" class="k-btn k-btn-primary k-masters-search-button" data-orders-submit>Поиск</button>
      </section>
      <div class="k-orders-search-result" data-orders-search-result aria-live="polite"></div>
      <div id="k-orders-content" data-orders-role="${ui.escHtml(role)}" data-orders-phase="idle">${renderState(ordersState.getSnapshot(),role)}</div>`;
    return ui.pageShell(context,copy.title,copy.description,body,{page:`orders orders-${role}`,eyebrow:role==='sto'?'STO ORDERS':role==='master'?'MASTER ORDERS':'ORDERS DOMAIN',chromeHeader:false});
  }

  function loadClientUiState(){
    try{
      const raw=JSON.parse(sessionStorage.getItem(CLIENT_UI_KEY)||'{}');
      return {filter:String(raw.filter||'all'),sort:String(raw.sort||'newest'),search:String(raw.search||'')};
    }catch(_e){return {filter:'all',sort:'newest',search:''};}
  }

  function saveClientUiState(state){
    try{sessionStorage.setItem(CLIENT_UI_KEY,JSON.stringify({filter:state.filter,sort:state.sort,search:state.search}));}catch(_e){}
  }

  function clientFilterDialog(filterMode,sortMode){
    const choice=(value,label,desc)=>`<button type="button" class="k-client-orders-choice ${filterMode===value?'is-active':''}" data-client-filter-choice="${value}"><span>${ui.escHtml(label)}</span><small>${ui.escHtml(desc)}</small><b>${filterMode===value?'✓':''}</b></button>`;
    const sort=(value,label)=>`<button type="button" class="k-client-orders-sort-choice ${sortMode===value?'is-active':''}" data-client-sort-choice="${value}"><span>${ui.escHtml(label)}</span><b>${sortMode===value?'✓':''}</b></button>`;
    return `<section class="k-client-orders-filter-dialog"><h3>Показывать</h3><div class="k-client-orders-choice-grid">${choice('all','Все','Все обращения')}${choice('active','Активные','Новые и в работе')}${choice('offers','С откликами','Можно выбрать исполнителя')}${choice('completed','Завершённые','История ремонта')}${choice('cancelled','Отменённые','Закрытые без ремонта')}</div><h3>Сортировка</h3><div class="k-client-orders-sort-list">${sort('newest','Сначала новые')}${sort('oldest','Сначала старые')}${sort('price_desc','Сначала дороже')}${sort('price_asc','Сначала дешевле')}</div><div class="k-client-orders-dialog__actions"><button type="button" class="k-btn k-btn-secondary" data-client-filter-reset>Сбросить</button><button type="button" class="k-btn k-btn-primary" data-client-orders-dialog-close>Готово</button></div></section>`;
  }

  function offerDialog(orderId){
    const order=ordersState.getSnapshot().orders.find(item=>String(item.id)===String(orderId));
    const exchange=exchangeByOrderId(orderId);
    if(!order||!exchange) return `<section class="k-client-orders-dialog-empty"><h3>Предложения пока не загружены</h3><p>Основная заявка доступна. Обновите предложения ещё раз.</p><button class="k-btn k-btn-primary" type="button" data-client-exchange-refresh>Обновить</button></section>`;
    const responses=Array.isArray(exchange.responses)?exchange.responses:[];
    const deadline=exchange.deadlineAt?new Date(exchange.deadlineAt):null;
    const expired=deadline&&!Number.isNaN(deadline.getTime())&&deadline.getTime()<=Date.now();
    const range=exchange.minOffer?`${exchangeMoney(exchange.minOffer)}${exchange.maxOffer&&Number(exchange.maxOffer)!==Number(exchange.minOffer)?` — ${exchangeMoney(exchange.maxOffer)}`:''}`:'Ожидаем';
    return `<section class="k-client-orders-offers-dialog"><div class="k-client-orders-offers-summary"><div><small>${ui.escHtml(order.car||'Автомобиль')}</small><h3>${ui.escHtml(order.serviceNames||'Заявка')}</h3></div><div><small>Диапазон</small><strong>${range}</strong></div></div><p class="k-client-orders-offers-note">Сравнивайте не только цену: учитывайте рейтинг, срок начала, гарантию и специализацию исполнителя.</p><div class="k-client-orders-bids">${responses.length?responses.map(item=>exchangeResponseCard(orderId,item)).join(''):'<div class="k-client-orders-dialog-empty"><h3>Откликов ещё нет</h3><p>Мастера и СТО оценивают заявку. Она останется доступной независимо от состояния Биржи.</p></div>'}</div>${expired&&exchange.exchangeStatus==='open'?`<button class="k-btn k-btn-secondary" type="button" data-client-exchange-republish="${ui.escHtml(orderId)}">Запустить новый раунд на 3 дня</button>`:''}</section>`;
  }

  function orderActionsDialog(orderId){
    const order=ordersState.getSnapshot().orders.find(item=>String(item.id)===String(orderId));
    if(!order) return '<div class="k-client-orders-dialog-empty">Заявка не найдена.</div>';
    return `<section class="k-client-orders-actions-dialog"><a href="#/orders/item/${encodeURIComponent(order.id)}"><span>▦</span><div><b>Открыть заказ</b><small>Статус, этапы ремонта и документы</small></div><i>›</i></a><a href="#/chats" ${order.chatId?`data-order-chat="${ui.escHtml(order.chatId)}"`:''}><span>✉</span><div><b>Чат</b><small>Переписка по этой заявке</small></div><i>›</i></a>${order.address?`<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}"><span>⌖</span><div><b>Маршрут</b><small>${ui.escHtml(order.address)}</small></div><i>›</i></a>`:''}${COMPLETED.has(order.status)?`<button type="button" data-repeat-order="${ui.escHtml(order.id)}"><span>↻</span><div><b>Повторить заявку</b><small>Создать новое обращение по этой услуге</small></div><i>›</i></button>`:''}</section>`;
  }

  function acceptConfirmDialog(orderId,responseId,schedulePreview={}){
    const exchange=exchangeByOrderId(orderId);
    const response=(exchange?.responses||[]).find(item=>String(item.id)===String(responseId));
    if(!response) return '<div class="k-client-orders-dialog-empty">Предложение не найдено.</div>';
    const price=response.priceTo>response.priceFrom&&response.priceFrom>0?`${exchangeMoney(response.priceFrom)}–${exchangeMoney(response.priceTo)}`:exchangeMoney(response.priceFrom||response.priceTo);
    const preview=schedulePreview||{};const conflicts=Array.isArray(preview.conflicts)?preview.conflicts:[];const planned=preview.plannedStart?new Date(String(preview.plannedStart).replace(' ','T')):null;const plannedLabel=planned&&!Number.isNaN(planned.getTime())?planned.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):(response.startTime||'По согласованию');
    return `<section class="k-client-orders-confirm"><div class="k-client-orders-confirm__mark">✓</div><h3>Выбрать ${ui.escHtml(response.masterName||'этого мастера')}?</h3><p>После подтверждения исполнитель будет закреплён за заявкой, а согласованное время попадёт в календарь Мастера.</p><div class="k-client-orders-confirm__facts"><span><small>Стоимость</small><b>${price}</b></span><span><small>Начало</small><b>${ui.escHtml(plannedLabel)}</b></span><span><small>Гарантия</small><b>${ui.escHtml(response.warranty||'Уточняется')}</b></span></div>${preview.schedulable?`<div class="k-client-r66-schedule ${preview.hasConflict?'is-conflict':'is-ok'}"><b>${preview.hasConflict?'Есть пересечение в расписании':'Время свободно в календаре'}</b><span>${Number(preview.durationMin||0)>0?`Плановая длительность: ${Number(preview.durationMin)} мин.`:'Длительность по согласованию'}</span>${conflicts.map(item=>`<small>${ui.escHtml(item.title||'Занято')} · ${ui.escHtml(String(item.start||'').slice(0,16))}</small>`).join('')}</div>`:''}<div class="k-client-orders-dialog__actions"><button type="button" class="k-btn k-btn-secondary" data-client-order-offers="${ui.escHtml(orderId)}">Назад</button><button type="button" class="k-btn k-btn-primary" data-client-bid-confirm="${ui.escHtml(responseId)}" data-order-id="${ui.escHtml(orderId)}" data-schedule-conflict="${preview.hasConflict?'1':'0'}">${preview.hasConflict?'Подтвердить несмотря на пересечение':'Подтвердить выбор'}</button></div></section>`;
  }

  function mountOrders(context){
    const lifecycle = context && context.lifecycle ? context.lifecycle : {};
    const api = context && context.api;
    const routeToken = Number(lifecycle.token || 0);
    const role=currentRole();
    const root = document.querySelector('#k-orders-content');
    if (!root) return;

    const searchInput=document.querySelector('[data-order-search]');
    const resultLabel=document.querySelector('[data-orders-search-result]');
    let filterMode='all';
    let sortMode='newest';
    let filterPanel=null,filterToggle=null,filterLabel=null;

    const clientUi=role==='client'?loadClientUiState():null;
    if(clientUi){filterMode=clientUi.filter;sortMode=clientUi.sort;if(searchInput)searchInput.value=clientUi.search;}

    const dialog=role==='client'?document.querySelector('[data-client-orders-dialog]'):null;
    const dialogBody=dialog?.querySelector('[data-client-orders-dialog-body]');
    const dialogTitle=dialog?.querySelector('[data-client-orders-dialog-title]');
    const dialogKicker=dialog?.querySelector('[data-client-orders-dialog-kicker]');
    const exchangeNote=role==='client'?document.querySelector('[data-client-orders-exchange-note]'):null;

    const openDialog=(title,kicker,html)=>{
      if(!dialog||!dialogBody)return;
      if(dialogTitle)dialogTitle.textContent=title;
      if(dialogKicker)dialogKicker.textContent=kicker;
      dialogBody.innerHTML=html;
      if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else dialog.setAttribute('open','');
    };
    const closeDialog=()=>{try{dialog?.close();}catch(_e){dialog?.removeAttribute('open');}};

    if(role!=='client'){
      filterToggle=document.querySelector('[data-order-filter-toggle]');
      filterPanel=document.querySelector('[data-order-filter-panel]');
      filterLabel=document.querySelector('[data-order-filter-label]');
    }

    const updateClientStats=(snapshot=ordersState.getSnapshot())=>{
      if(role!=='client')return;
      const orders=Array.isArray(snapshot.orders)?snapshot.orders:[];
      const counts={all:orders.length,active:0,offers:0,completed:0};
      orders.forEach(order=>{const category=clientOrderCategory(order);if(category==='active')counts.active++;if(category==='completed')counts.completed++;const ex=exchangeByOrderId(order.id);if(Number(ex?.responsesCount||ex?.responses?.length||0)>0&&!COMPLETED.has(String(order.status||'')))counts.offers++;});
      Object.entries(counts).forEach(([key,value])=>{const node=document.querySelector(`[data-client-orders-count="${key}"]`);if(node)node.textContent=String(value);});
      document.querySelectorAll('[data-client-order-status-filter]').forEach(button=>button.classList.toggle('is-active',button.dataset.clientOrderStatusFilter===filterMode));
    };

    const persistClientUi=()=>{if(role==='client')saveClientUiState({filter:filterMode,sort:sortMode,search:String(searchInput?.value||'')});};

    const applyFilters=()=>{
      const query=String(searchInput&&searchInput.value||'').trim().toLowerCase();
      const cards=[...root.querySelectorAll('[data-order-status]')];
      let shown=0;
      cards.forEach(card=>{
        const status=String(card.dataset.orderStatus||'');
        const category=String(card.dataset.orderCategory||clientOrderCategory({status}));
        const hasOffers=card.dataset.orderHasOffers==='1';
        const statusMatch=filterMode==='all'||(filterMode==='offers'&&hasOffers&&!COMPLETED.has(status))||(filterMode==='completed'&&category==='completed')||(filterMode==='cancelled'&&category==='cancelled')||(filterMode==='active'&&category==='active');
        const textMatch=!query||String(card.textContent||'').toLowerCase().includes(query);
        const visible=statusMatch&&textMatch;
        card.hidden=!visible;
        if(visible)shown+=1;
      });
      if(role==='client'){
        const list=root.querySelector('[data-client-order-list]');
        if(list){
          const sorted=[...list.querySelectorAll('[data-order-status]')].sort((a,b)=>{
            if(sortMode==='oldest')return Number(a.dataset.orderCreated||0)-Number(b.dataset.orderCreated||0);
            if(sortMode==='price_desc')return Number(b.dataset.orderPrice||0)-Number(a.dataset.orderPrice||0);
            if(sortMode==='price_asc')return Number(a.dataset.orderPrice||0)-Number(b.dataset.orderPrice||0);
            return Number(b.dataset.orderCreated||0)-Number(a.dataset.orderCreated||0);
          });
          sorted.forEach(card=>list.appendChild(card));
        }
        updateClientStats();
        persistClientUi();
      }
      if(resultLabel){const total=cards.length;resultLabel.textContent=total?`Показано ${shown} из ${total}`:'';}
    };

    const closeFilter=()=>{if(filterPanel)filterPanel.hidden=true;if(filterToggle)filterToggle.setAttribute('aria-expanded','false');};

    const rerenderClientOrders=()=>{
      if(role!=='client')return;
      const snapshot=ordersState.getSnapshot();
      root.setAttribute('data-orders-phase',snapshot.phase);
      root.innerHTML=renderClientState(snapshot);
      requestAnimationFrame(applyFilters);
    };

    const loadReschedules=async()=>{
      if(role!=='client'||!ordersApi.rescheduleProposals)return;
      try{
        const data=await ordersApi.rescheduleProposals(api,{signal:lifecycle.signal});
        if(lifecycle.signal&&lifecycle.signal.aborted)return;
        clientRescheduleSnapshot={proposals:Array.isArray(data?.proposals)?data.proposals:[],receivedAt:Date.now()};
        clientRescheduleError='';
        rerenderClientOrders();
      }catch(error){
        if(error&&error.name==='AbortError')return;
        clientRescheduleError=String(error?.message||'Не удалось проверить переносы');
      }
    };

    const loadArrivals=async()=>{
      if(role!=='client'||!ordersApi.arrivalStates)return;
      try{const data=await ordersApi.arrivalStates(api,{signal:lifecycle.signal});if(lifecycle.signal&&lifecycle.signal.aborted)return;clientArrivalSnapshot={states:Array.isArray(data?.states)?data.states:[],receivedAt:Date.now()};clientArrivalError='';rerenderClientOrders();}catch(error){if(error&&error.name==='AbortError')return;clientArrivalError=String(error?.message||'Не удалось обновить статус приезда');}
    };

    const loadExchange=async()=>{
      if(role!=='client'||!ordersApi.exchangeDashboard)return;
      if(exchangeNote){exchangeNote.hidden=true;exchangeNote.innerHTML='';}
      try{
        const data=await ordersApi.exchangeDashboard(api,{signal:lifecycle.signal,limit:50});
        if(lifecycle.signal&&lifecycle.signal.aborted)return;
        clientExchangeSnapshot={orders:Array.isArray(data?.orders)?data.orders:[],stats:data?.stats||{},receivedAt:Date.now()};
        clientExchangeError='';
        rerenderClientOrders();
      }catch(error){
        if(error&&error.name==='AbortError')return;
        clientExchangeError=String(error?.message||'Не удалось обновить предложения');
        if(exchangeNote){exchangeNote.hidden=false;exchangeNote.innerHTML=`<div><b>Предложения временно не обновлены</b><span>${ui.escHtml(clientExchangeError)}. Основные заявки остаются доступны.</span></div><button type="button" class="k-btn k-btn-secondary" data-client-exchange-refresh>Повторить</button>`;}
      }
    };
    if(role==='client'){loadExchange();loadReschedules();loadArrivals();}

    const refreshOrders=()=>{const requestId=ordersState.begin();return ordersApi.list(api,{signal:lifecycle.signal,cacheTtlMs:0}).then(snapshot=>ordersState.resolve(requestId,snapshot)).catch(error=>ordersState.reject(requestId,error));};
    const acceptedExchangeNextAction=(result,orderId)=>{const next=result?.nextAction||{},chatId=String(next.chatId||result?.chat?.id||''),safeId=ui.escHtml(String(orderId||result?.order?.id||'')),schedule=next.schedule||result?.schedule?.plan||null,scheduleText=schedule?.plannedStart?` Запись: ${new Date(String(schedule.plannedStart).replace(' ','T')).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}.`:'';openDialog('Мастер выбран','ЗАЯВКА ПРИНЯТА',`<section class="k-client-exchange-next"><p>Заявка передана выбранному Мастеру и появилась в рабочих заказах.${ui.escHtml(scheduleText)}</p><div><a class="k-btn k-btn-primary" href="#/orders/item/${encodeURIComponent(String(orderId||result?.order?.id||''))}">Открыть заказ</a>${chatId?`<a class="k-btn k-btn-secondary" href="#/chats" data-order-chat="${ui.escHtml(chatId)}">Перейти в чат</a>`:''}</div><small>Заказ ${safeId}</small></section>`);};
    const awaitableExchange=(promise,button,{closeOnSuccess=false,onSuccess=null}={})=>{Promise.resolve(promise).then(result=>{if(closeOnSuccess)closeDialog();loadExchange();refreshOrders();if(typeof onSuccess==='function')onSuccess(result);}).catch(error=>{if(button)button.disabled=false;window.KaretaToast?.error?.(error&&error.message||'Операция не выполнена');});};

    const onClick=async event=>{
      const retry=event.target.closest('[data-orders-retry]');
      if(retry){refreshOrders();return;}
      const chat=event.target.closest('[data-order-chat]');
      if(chat){try{sessionStorage.setItem('kareta.chat.open',chat.dataset.orderChat||'');}catch(_e){}closeDialog();return;}
      const repeat=event.target.closest('[data-repeat-order]');
      if(repeat){
        const id=repeat.dataset.repeatOrder;
        const order=ordersState.getSnapshot().orders.find(x=>String(x.id)===String(id));
        if(order){try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:order.serviceNames,description:order.description||`Повторная заявка: ${order.serviceNames}`,vehicleId:order.vehicleId||'',source:'repeat_order'}));}catch(_e){}closeDialog();if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new';}
        return;
      }

      if(role==='client'){
        if(event.target.closest('[data-client-orders-dialog-close]')){closeDialog();return;}
        const statusButton=event.target.closest('[data-client-order-status-filter]');
        if(statusButton){filterMode=statusButton.dataset.clientOrderStatusFilter||'all';applyFilters();return;}
        const filterOpen=event.target.closest('[data-client-orders-filter-open]');
        if(filterOpen){openDialog('Фильтры заявок','МОИ ЗАЯВКИ',clientFilterDialog(filterMode,sortMode));return;}
        const filterChoice=event.target.closest('[data-client-filter-choice]');
        if(filterChoice){filterMode=filterChoice.dataset.clientFilterChoice||'all';openDialog('Фильтры заявок','МОИ ЗАЯВКИ',clientFilterDialog(filterMode,sortMode));applyFilters();return;}
        const sortChoice=event.target.closest('[data-client-sort-choice]');
        if(sortChoice){sortMode=sortChoice.dataset.clientSortChoice||'newest';openDialog('Фильтры заявок','МОИ ЗАЯВКИ',clientFilterDialog(filterMode,sortMode));applyFilters();return;}
        const reset=event.target.closest('[data-client-filter-reset]');
        if(reset){filterMode='all';sortMode='newest';if(searchInput)searchInput.value='';openDialog('Фильтры заявок','МОИ ЗАЯВКИ',clientFilterDialog(filterMode,sortMode));applyFilters();return;}
        const offers=event.target.closest('[data-client-order-offers]');
        if(offers){const orderId=offers.dataset.clientOrderOffers;openDialog('Предложения мастеров','СРАВНЕНИЕ',offerDialog(orderId));return;}
        const actions=event.target.closest('[data-client-order-actions]');
        if(actions){openDialog('Действия с заявкой','ЗАЯВКА',orderActionsDialog(actions.dataset.clientOrderActions));return;}
        const arrivalButton=event.target.closest('[data-client-arrival-status]');
        if(arrivalButton){if(arrivalButton.disabled)return;const panel=arrivalButton.closest('[data-client-arrival]'),etaInput=panel?.querySelector('[data-client-arrival-eta]'),status=arrivalButton.dataset.clientArrivalStatus||'',etaMinutes=['on_way','late'].includes(status)?Math.max(5,Number(etaInput?.value||20)):0;arrivalButton.disabled=true;try{await ordersApi.setArrival(api,arrivalButton.dataset.orderId,status,{etaMinutes,signal:lifecycle.signal});window.KaretaToast?.success?.(status==='arrived'?'Мастеру отправлено: вы прибыли':status==='late'?'Мастеру отправлено опоздание':'Мастеру отправлен ваш ETA');await loadArrivals();}catch(error){window.KaretaToast?.error?.(error?.message||'Не удалось отправить статус приезда');}finally{if(arrivalButton.isConnected)arrivalButton.disabled=false;}return;}
        const rescheduleAccept=event.target.closest('[data-client-reschedule-accept]');
        if(rescheduleAccept){if(rescheduleAccept.disabled)return;rescheduleAccept.disabled=true;try{await ordersApi.respondReschedule(api,rescheduleAccept.dataset.clientRescheduleAccept,'accept',{signal:lifecycle.signal});window.KaretaToast?.success?.('Новое время подтверждено');await loadReschedules();await refreshOrders();}catch(error){if(error?.status===409&&error?.payload?.error==='slot_no_longer_available')window.KaretaToast?.error?.('Это окно уже занято. Мастер должен предложить другое время.');else window.KaretaToast?.error?.(error?.message||'Не удалось подтвердить перенос');await loadReschedules();}finally{if(rescheduleAccept.isConnected)rescheduleAccept.disabled=false;}return;}
        const rescheduleDecline=event.target.closest('[data-client-reschedule-decline]');
        if(rescheduleDecline){if(rescheduleDecline.disabled)return;rescheduleDecline.disabled=true;try{await ordersApi.respondReschedule(api,rescheduleDecline.dataset.clientRescheduleDecline,'decline',{signal:lifecycle.signal});window.KaretaToast?.success?.('Перенос отклонён. Текущее время сохранено.');await loadReschedules();await refreshOrders();}catch(error){window.KaretaToast?.error?.(error?.message||'Не удалось отклонить перенос');}finally{if(rescheduleDecline.isConnected)rescheduleDecline.disabled=false;}return;}
                const choose=event.target.closest('[data-client-bid-choose]');
        if(choose){if(choose.disabled)return;choose.disabled=true;try{const result=await ordersApi.previewExchangeSchedule(api,choose.dataset.orderId,choose.dataset.clientBidChoose,{signal:lifecycle.signal});openDialog('Подтверждение исполнителя','ВАШ ВЫБОР',acceptConfirmDialog(choose.dataset.orderId,choose.dataset.clientBidChoose,result?.preview||{}));}catch(error){openDialog('Подтверждение исполнителя','ВАШ ВЫБОР',acceptConfirmDialog(choose.dataset.orderId,choose.dataset.clientBidChoose,{}));}finally{if(choose.isConnected)choose.disabled=false;}return;}
        const confirm=event.target.closest('[data-client-bid-confirm]');
        if(confirm){if(confirm.disabled)return;confirm.disabled=true;const orderId=confirm.dataset.orderId,responseId=confirm.dataset.clientBidConfirm;try{const result=await ordersApi.acceptExchangeResponse(api,orderId,responseId,{signal:lifecycle.signal,confirmScheduleConflict:confirm.dataset.scheduleConflict==='1'});closeDialog();loadExchange();refreshOrders();acceptedExchangeNextAction(result,orderId);}catch(error){if(error?.status===409&&error?.payload?.error==='schedule_conflict'){openDialog('Подтверждение исполнителя','КОНФЛИКТ ВРЕМЕНИ',acceptConfirmDialog(orderId,responseId,error.payload?.preview||{}));}else window.KaretaToast?.error?.(error?.message||'Не удалось принять отклик');}finally{if(confirm.isConnected)confirm.disabled=false;}return;}
        const decline=event.target.closest('[data-client-bid-decline]');
        if(decline){if(decline.disabled)return;decline.disabled=true;awaitableExchange(ordersApi.declineExchangeResponse(api,decline.dataset.orderId,decline.dataset.clientBidDecline,{signal:lifecycle.signal}),decline);return;}
        const exRefresh=event.target.closest('[data-client-exchange-refresh]');if(exRefresh){loadExchange();return;}
        const exRepublish=event.target.closest('[data-client-exchange-republish]');if(exRepublish){if(exRepublish.disabled)return;exRepublish.disabled=true;awaitableExchange(ordersApi.republishExchangeOrder(api,exRepublish.dataset.clientExchangeRepublish,{signal:lifecycle.signal}),exRepublish);return;}
        return;
      }

      const toggle=event.target.closest('[data-order-filter-toggle]');
      if(toggle){const open=filterPanel&&filterPanel.hidden;if(filterPanel)filterPanel.hidden=!open;toggle.setAttribute('aria-expanded',open?'true':'false');return;}
      const button=event.target.closest('[data-order-filter]');
      if(button){filterMode=button.dataset.orderFilter||'all';if(filterPanel)filterPanel.querySelectorAll('[data-order-filter]').forEach(x=>x.classList.toggle('is-active',x===button));if(filterLabel)filterLabel.textContent=button.textContent.trim().replace(' заявки','');closeFilter();applyFilters();return;}
      const submit=event.target.closest('[data-orders-submit]');
      if(submit){applyFilters();return;}
      if(filterPanel&&!filterPanel.hidden&&!event.target.closest('[data-order-filter-panel]'))closeFilter();
    };

    let searchTimer=0;
    const onInput=event=>{if(event.target!==searchInput)return;clearTimeout(searchTimer);searchTimer=setTimeout(applyFilters,120);};
    const onKeydown=event=>{if(event.key==='Enter'&&event.target===searchInput){event.preventDefault();applyFilters();}if(event.key==='Escape'){if(role==='client'&&dialog?.open)closeDialog();else closeFilter();}};
    const onDialogClick=event=>{if(role==='client'&&event.target===dialog)closeDialog();};

    document.addEventListener('click',onClick);
    document.addEventListener('keydown',onKeydown);
    searchInput?.addEventListener('input',onInput);
    dialog?.addEventListener('click',onDialogClick);
    if (typeof lifecycle.addCleanup === 'function') lifecycle.addCleanup(()=>{
      document.removeEventListener('click',onClick);
      document.removeEventListener('keydown',onKeydown);
      searchInput?.removeEventListener('input',onInput);
      dialog?.removeEventListener('click',onDialogClick);
      clearTimeout(searchTimer);
      try{dialog?.close();}catch(_e){}
    });

    const unsubscribe = ordersState.subscribe(snapshot => {
      const outlet = document.querySelector('#k-page-outlet');
      if (!root.isConnected || !outlet || Number(outlet.getAttribute('data-route-token') || 0) !== routeToken) return;
      root.setAttribute('data-orders-phase', snapshot.phase);
      root.innerHTML = renderState(snapshot,role);
      requestAnimationFrame(()=>{updateClientStats(snapshot);applyFilters();});
    });
    if (typeof lifecycle.addCleanup === 'function') lifecycle.addCleanup(unsubscribe);

    const requestId = ordersState.begin();
    ordersApi.list(api, { signal:lifecycle.signal })
      .then(snapshot => {if (lifecycle.signal && lifecycle.signal.aborted) return;ordersState.resolve(requestId, snapshot);})
      .catch(error => {if (error && error.name === 'AbortError') return;ordersState.reject(requestId, error);});
  }

  window.KaretaOrdersPages = Object.freeze({
    renderOrders,
    mountOrders,
    renderState,
  });
})();
