(() => {
  'use strict';
  const engine=window.KaretaDashboardEngine;if(!engine)throw new Error('KaretaDashboardEngine is required');
  const esc=v=>window.KaretaUIKit?.esc?.(v)??String(v??'');
  const money=v=>new Intl.NumberFormat('ru-RU').format(Number(v||0))+' ₸';
  const orderList=(items,empty)=>`<div class="k-dashboard-alert-list">${(Array.isArray(items)?items:[]).slice(0,6).map(x=>`<a href="#/orders/item/${encodeURIComponent(x.id)}"><b>${esc(x.vehicleTitle||'Автомобиль')}</b><small>${esc(x.serviceNames||x.clientName||'Заказ')}</small></a>`).join('')||`<p class="k-empty">${esc(empty)}</p>`}</div>`;
  engine.register({key:'sto.metrics',title:'Показатели СТО',subtitle:'Текущая загрузка',icon:'dashboard',contextKinds:['organization'],span:4,render:data=>{const m=data.metrics||{};return `<div class="k-dashboard-kpis">${[['Машин сегодня',m.todayOrders],['Постов занято',`${m.occupied||0}/${m.bays||0}`],['Мастеров',m.masters],['Выручка',money(m.monthRevenue)],['Завершено',m.completedMonth],['Средний чек',money(m.avgTicket)]].map(([a,b])=>`<div class="k-dashboard-kpi"><b>${esc(b||0)}</b><span>${esc(a)}</span></div>`).join('')}</div>`;}});
  engine.register({key:'sto.queue',title:'Очередь',subtitle:'Ближайшие автомобили',icon:'orders',contextKinds:['organization'],span:2,href:'#/orders',render:data=>orderList(data.queue,'Очередь пуста')});
  engine.register({key:'sto.team',title:'Команда',subtitle:'Загрузка мастеров',icon:'masters',contextKinds:['organization'],span:2,href:'#/masters',render:data=>{const list=Array.isArray(data.masters)?data.masters:[];return `<div class="k-dashboard-list">${list.slice(0,6).map(x=>`<a href="#/masters/profile/master/${encodeURIComponent(x.id)}"><span>${esc(x.name||'Мастер')}</span><small>${esc(x.activeOrders||0)} в работе · ${esc(x.kpi||0)}%</small></a>`).join('')||'<p class="k-empty">Команда не настроена</p>'}</div>`;}});
  engine.register({key:'sto.overdue',title:'Просроченные',subtitle:'Требуют решения',icon:'history',contextKinds:['organization'],span:1,href:'#/orders',render:data=>orderList(data.alerts?.overdue,'Просроченных заказов нет')});
  engine.register({key:'sto.approvals',title:'Согласование',subtitle:'Ответ клиента или СТО',icon:'check',contextKinds:['organization'],span:1,href:'#/workflow',render:data=>orderList(data.alerts?.waitingApproval,'Нет ожидающих согласования')});
  engine.register({key:'sto.parts',title:'Ожидают запчасти',subtitle:'Проверьте снабжение',icon:'parts',contextKinds:['organization'],span:1,href:'#/parts',render:data=>orderList(data.alerts?.waitingParts,'Ожиданий запчастей нет')});
  engine.register({key:'sto.calendar',title:'Календарь',subtitle:'Ближайшие записи',icon:'calendar',contextKinds:['organization'],span:1,href:'#/calendar',render:data=>{const list=Array.isArray(data.calendar)?data.calendar:[];return `<div class="k-dashboard-list">${list.slice(0,6).map(x=>`<a href="${x.orderId?`#/orders/item/${encodeURIComponent(x.orderId)}`:'#/calendar'}"><span>${esc(x.title||x.vehicleTitle||'Запись')}</span><small>${esc(x.startsAt||x.date||'')}</small></a>`).join('')||'<p class="k-empty">Ближайших записей нет</p>'}</div>`;}});
  // Real database aggregates only. An unavailable metric is distinct from an actual zero.
  const adminCopy={
    ru:{accounts:'Аккаунты',orders:'Заказы',masters:'Мастера (активные профили)',sto:'СТО (активные)',shops:'Магазины (активные)',sellerProducts:'Товары магазинов (все статусы)',unavailable:'Нет данных',users7:'Регистрации',orders7:'Заказы',range:'Последние 7 дней',dbTime:'Период по времени базы данных'},
    kk:{accounts:'Аккаунттар',orders:'Тапсырыстар',masters:'Шеберлер (белсенді профильдер)',sto:'Автосервистер (белсенді)',shops:'Дүкендер (белсенді)',sellerProducts:'Дүкен тауарлары (барлық күйлер)',unavailable:'Дерек жоқ',users7:'Тіркелулер',orders7:'Тапсырыстар',range:'Соңғы 7 күн',dbTime:'Дерекқор уақыты бойынша кезең'},
    en:{accounts:'Accounts',orders:'Orders',masters:'Masters (active profiles)',sto:'Service centers (active)',shops:'Stores (active)',sellerProducts:'Store products (all statuses)',unavailable:'Unavailable',users7:'Registrations',orders7:'Orders',range:'Last 7 days',dbTime:'Using database local dates'}
  };
  const adminText=()=>adminCopy[String(document.documentElement?.lang||'ru').toLowerCase().slice(0,2)]||adminCopy.ru;
  const adminValue=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ru-RU').format(Number(v));
  const adminSafeCount=v=>Number.isFinite(Number(v))&&Number(v)>=0?Number(v):0;
  engine.register({key:'admin.metrics',title:'Показатели платформы',subtitle:'Только подтверждённые значения',icon:'monitor',contextKinds:['admin'],span:4,render:data=>{
    const c=data.businessCounts||{},tr=adminText();
    return `<div class="k-dashboard-kpis k-admin-business-kpis">${['accounts','orders','masters','sto','shops','sellerProducts'].map(key=>{const value=c[key],available=value!==null&&value!==undefined&&Number.isFinite(Number(value));return `<div class="k-dashboard-kpi" data-admin-metric="${key}"><b>${esc(adminValue(value))}</b><span>${esc(tr[key])}</span>${!available?`<small class="k-admin-metric-unavailable">${esc(tr.unavailable)}</small>`:''}</div>`;}).join('')}</div>`;
  }});
  engine.register({key:'admin.activity7d',title:'Активность за 7 дней',subtitle:'Регистрации и созданные заказы',icon:'analytics',contextKinds:['admin'],span:4,render:data=>{
    const tr=adminText(),report=data.activity7d||{},days=Array.isArray(report.days)?report.days:[],users=Array.isArray(report.accounts)&&report.accounts.length===7?report.accounts:null,orders=Array.isArray(report.orders)&&report.orders.length===7?report.orders:null;
    if(days.length!==7||(!users&&!orders))return `<p class="k-empty" role="status">${esc(tr.unavailable)}</p>`;
    const range=days.map((day,i)=>({day:String(day),user:users?adminSafeCount(users[i]):null,order:orders?adminSafeCount(orders[i]):null}));
    const ceiling=Math.max(1,...range.flatMap(item=>[item.user??0,item.order??0]));
    return `<div class="k-admin-week-chart" role="img" aria-label="${esc(tr.range)}: ${esc(range.map(item=>item.day+' '+tr.users7+' '+(item.user??'—')+' '+tr.orders7+' '+(item.order??'—')).join('; '))}">
      <div class="k-admin-week-chart__legend">${users?`<span class="is-users">${esc(tr.users7)}</span>`:''}${orders?`<span class="is-orders">${esc(tr.orders7)}</span>`:''}</div>
      <div class="k-admin-week-chart__days">${range.map(item=>`<div class="k-admin-week-chart__day"><div class="k-admin-week-chart__bars">${users?`<i class="is-users" style="height:${Math.round(100*(item.user||0)/ceiling)}%" title="${esc(tr.users7)}: ${item.user}"></i>`:''}${orders?`<i class="is-orders" style="height:${Math.round(100*(item.order||0)/ceiling)}%" title="${esc(tr.orders7)}: ${item.order}"></i>`:''}</div><small>${esc(item.day.slice(5))}</small></div>`).join('')}</div>
      <small class="k-admin-week-chart__source">${esc(tr.dbTime)}${users&&orders?'':` · ${esc(tr.unavailable)}`}</small></div>`;
  }});
  engine.register({key:'admin.audit',title:'Последние действия',subtitle:'Audit trail',icon:'history',contextKinds:['admin'],span:4,render:data=>{const rows=Array.isArray(data.audit)?data.audit:[];return `<div class="k-dashboard-list">${rows.slice(0,10).map(a=>`<div><span>${esc(a.actionKey)} · ${esc(a.targetType)} #${esc(a.targetId)}</span><small>${esc(a.createdAt)}</small></div>`).join('')||'<p class="k-empty">Аудит пуст</p>'}</div>`;}});
})();
