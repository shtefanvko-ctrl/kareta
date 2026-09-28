/* ═══════════════════════════════════════════════════════
   KARETA.KZ — ORDER LIFECYCLE FRONTEND CONTRACT r319
   Single frontend source for order status labels/colors/groups.
═══════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const STATUSES = ['new','waiting_responses','process','done_pending_client','done','cancelled','dispute'];
  const ACTIVE_STATUSES = ['new','waiting_responses','process','done_pending_client'];
  const OPEN_STATUSES = ['new','waiting_responses'];
  const WORK_STATUSES = ['process'];
  const CLIENT_CONFIRM_STATUSES = ['done_pending_client'];
  const CLOSED_STATUSES = ['done','cancelled'];

  const SERVICE_LABEL = {
    draft:'Черновик',
    new:'Новая',
    waiting_responses:'Ждёт откликов',
    process:'В работе',
    done_pending_client:'Ждёт подтверждения клиента',
    done:'Завершена',
    cancelled:'Отменена',
    dispute:'Спор'
  };

  const PARTS_LABEL = {
    draft:'Черновик',
    new:'Новый запрос',
    waiting_responses:'Ждёт предложений',
    process:'В подборе',
    done_pending_client:'Ждёт подтверждения клиента',
    done:'Обработан',
    cancelled:'Отменён',
    dispute:'Спор'
  };

  const ICON = {
    draft:'✏️',
    new:'🕐',
    waiting_responses:'📬',
    process:'🔧',
    done_pending_client:'✅',
    done:'🏁',
    cancelled:'✖',
    dispute:'⚠️'
  };

  const COLOR = {
    draft:'var(--text3)',
    new:'#60a5fa',
    waiting_responses:'#60a5fa',
    process:'var(--orange)',
    done_pending_client:'#f59e0b',
    done:'#22c55e',
    cancelled:'#ef4444',
    dispute:'#ef4444'
  };

  function normalize(status){
    const s = String(status || 'new').trim();
    if (s === 'open') return 'new';
    if (s === 'accepted' || s === 'assigned' || s === 'in_work') return 'process';
    if (s === 'ready' || s === 'completed_pending_client') return 'done_pending_client';
    if (s === 'completed' || s === 'closed') return 'done';
    if (s === 'canceled') return 'cancelled';
    return s || 'new';
  }

  function typeOf(orderOrType){
    if (typeof orderOrType === 'string') return orderOrType === 'parts_request' ? 'parts_request' : 'service_order';
    return String(orderOrType && orderOrType.type || 'service_order') === 'parts_request' ? 'parts_request' : 'service_order';
  }

  function label(status, orderOrType){
    const st = normalize(status);
    const map = typeOf(orderOrType) === 'parts_request' ? PARTS_LABEL : SERVICE_LABEL;
    return map[st] || st || 'Без статуса';
  }

  function shortLabel(status, orderOrType){
    const st = normalize(status);
    const short = {
      new:'Новая',
      waiting_responses:'Отклики',
      process:'В работе',
      done_pending_client:'Подтвердить',
      done:'Готово',
      cancelled:'Отмена',
      dispute:'Спор'
    };
    if (typeOf(orderOrType) === 'parts_request' && st === 'process') return 'В подборе';
    if (typeOf(orderOrType) === 'parts_request' && st === 'done') return 'Обработан';
    return short[st] || label(st, orderOrType);
  }

  function icon(status){ return ICON[normalize(status)] || '📋'; }
  function color(status){ return COLOR[normalize(status)] || 'var(--text3)'; }
  function withIcon(status, orderOrType){ return icon(status) + ' ' + label(status, orderOrType); }
  function cssClass(status){ return normalize(status).replace(/[^a-z0-9_-]/gi,'') || 'new'; }
  function isActive(status){ return ACTIVE_STATUSES.includes(normalize(status)); }
  function isOpen(status){ return OPEN_STATUSES.includes(normalize(status)); }
  function isWork(status){ return WORK_STATUSES.includes(normalize(status)); }
  function needsClientConfirm(status){ return CLIENT_CONFIRM_STATUSES.includes(normalize(status)); }
  function isClosed(status){ return CLOSED_STATUSES.includes(normalize(status)); }

  const TRANSITIONS = {
    new: { waiting_responses:['client','admin','owner','system'], process:['admin','owner','system'], cancelled:['client','admin','owner'] },
    waiting_responses: { process:['master','sto','admin','owner','system'], cancelled:['client','admin','owner'] },
    process: { done_pending_client:['master','sto','admin','owner'], cancelled:['admin','owner'], dispute:['client','master','sto','admin','owner'] },
    done_pending_client: { done:['client','admin','owner','system'], dispute:['client','admin','owner'] },
    done: {},
    cancelled: {},
    dispute: { process:['admin','owner'], done:['admin','owner'], cancelled:['admin','owner'] }
  };

  function roleLevel(role){
    return ({guest:0,client:1,master:2,sto:2,admin:3,owner:4})[String(role||'guest')] || 0;
  }

  function actorRole(){
    const u = window._appState && window._appState.user;
    return String((u && u.role) || window.currentRole || 'client');
  }

  function canTransition(from, to, role){
    const a = normalize(from);
    const b = normalize(to);
    const r = normalizeRole(role || actorRole() || 'client');
    if (a === b) return { ok:true, skipped:true, from:a, to:b, role:r };
    const allowed = ((TRANSITIONS[a] && TRANSITIONS[a][b]) || []).map(normalizeRole);
    if (!allowed.length) return { ok:false, error:'invalid_transition', from:a, to:b, role:r };
    // role-level comparison was too permissive: master/sto could inherit client transitions.
    // Frontend must mirror backend intent: transition is allowed only for explicitly listed roles.
    const ok = allowed.includes(r);
    return ok ? { ok:true, from:a, to:b, role:r } : { ok:false, error:'role_not_allowed', from:a, to:b, role:r };
  }

  function allowedNext(from, role){
    const a = normalize(from);
    const r = String(role || actorRole() || 'client');
    return Object.keys(TRANSITIONS[a] || {}).filter(function(to){ return canTransition(a, to, r).ok; });
  }

  function nextStatus(from, role){
    return allowedNext(from, role)[0] || null;
  }



  const ACTION_LABELS = {
    open_detail:'Открыть заявку',
    open_chat:'Открыть чат',
    accept_response:'Принять отклик',
    master_claim:'Взять заявку',
    assign_master:'Назначить мастера',
    accept_lead:'Принять лид СТО',
    assign_order_master:'Назначить мастера СТО',
    add_stage:'Добавить этап',
    add_report:'Добавить отчёт',
    manage_parts:'Запчасти/расходники',
    confirm_done:'Подтвердить выполнение',
    open_dispute:'Открыть спор',
    cancel_order:'Отменить заявку',
    delete_order:'Удалить заявку'
  };
  const ACTION_ICONS = {
    open_detail:'📋', open_chat:'💬', accept_response:'🤝', master_claim:'🧰', assign_master:'👨‍🔧',
    accept_lead:'🏢', assign_order_master:'👨‍🔧',
    add_stage:'✅', add_report:'📄', manage_parts:'🔩', confirm_done:'🏁', open_dispute:'⚠️', cancel_order:'✖', delete_order:'🗑'
  };

  function normalizeRole(role){
    const r = String(role || actorRole() || 'client').trim().toLowerCase();
    if (r === 'sto_owner' || r === 'service') return 'sto';
    if (r === 'administrator') return 'admin';
    return r || 'client';
  }

  function isRole(role, list){
    const r = normalizeRole(role);
    return (Array.isArray(list) ? list : String(list||'').split(',')).map(normalizeRole).includes(r);
  }

  function isOrderAssigned(order){
    if (!order) return false;
    const mid = String(order.masterId ?? order.master_id ?? '0');
    const uid = String(order.masterUserId ?? order.master_user_id ?? '0');
    return !['', '0', 'null', 'undefined'].includes(mid) || !['', '0', 'null', 'undefined'].includes(uid);
  }

  function makeAction(key, role, extra){
    return Object.assign({
      key,
      role: normalizeRole(role),
      label: ACTION_LABELS[key] || key,
      icon: ACTION_ICONS[key] || '•',
      kind: 'action',
      backendAction: null,
      backendRoles: []
    }, extra || {});
  }

  function getAvailableActions(order, role, options){
    const o = order || {};
    const r = normalizeRole(role);
    const st = normalize(o.status || 'new');
    const type = typeOf(o);
    const assigned = isOrderAssigned(o);
    const opts = options || {};
    const actions = [];
    const push = function(action){
      if (!action || !action.key) return;
      if (!actions.some(function(x){ return x.key === action.key; })) actions.push(action);
    };

    push(makeAction('open_detail', r, {kind:'navigation', backendAction:'orders.get', backendRoles:['client','master','sto','admin','owner']}));
    if (st !== 'draft' && opts.canOpenChat !== false) push(makeAction('open_chat', r, {kind:'navigation', backendAction:'messages/chats read', backendRoles:['client','master','sto','admin','owner']}));

    if (isRole(r, ['client']) && ['new','waiting_responses'].includes(st) && opts.hasResponses !== false) {
      push(makeAction('accept_response', r, {kind:'order', backendAction:'clientExchange.acceptResponse', backendRoles:['client']}));
    }
    // UX/IX do not expose two equivalent owner/admin controls for the same unassigned order.
    // Master/STO take the order; admin/owner assign/dispatch it.
    if (isRole(r, ['master']) && ['new','waiting_responses'].includes(st) && !assigned) {
      push(makeAction('master_claim', r, {kind:'order', backendAction:'orders.masterClaim', backendRoles:['master']}));
    }
    // STO не должен видеть master_claim, потому что backend endpoint orders.masterClaim разрешён только роли master.
    // Для СТО используется отдельный backend-flow stoExchange.acceptLead / stoExchange.assignOrderMaster.
    if (isRole(r, ['sto']) && ['new','waiting_responses'].includes(st) && !assigned && opts.hasStoScope !== false) {
      push(makeAction('accept_lead', r, {kind:'assignment', backendAction:'stoExchange.acceptLead', backendRoles:['sto','admin','owner'], requiresStoScope:true}));
    }
    if (isRole(r, ['admin','owner']) && !['done','cancelled'].includes(st)) {
      push(makeAction('assign_master', r, {kind:'assignment', backendAction:'orders.assignMaster', backendRoles:['admin','owner']}));
    }
    if (isRole(r, ['master','sto','admin','owner']) && st === 'process') {
      push(makeAction('add_stage', r, {kind:'work', backendAction:'orders.addStage', backendRoles:['master','sto','admin','owner'], requiresStoScope:isRole(r,['sto'])}));
      push(makeAction('add_report', r, {kind:'work', backendAction:'orders.addReport', backendRoles:['master','sto','admin','owner'], requiresStoScope:isRole(r,['sto'])}));
      push(makeAction('manage_parts', r, {kind:'work', backendAction:'orders.addPart/orders.removePart', backendRoles:['master','sto','admin','owner'], requiresStoScope:isRole(r,['sto'])}));
    }
    if (isRole(r, ['client','admin','owner']) && st === 'done_pending_client') {
      push(makeAction('confirm_done', r, {kind:'completion', targetStatus:'done', backendAction:isRole(r,['client'])?'orders.confirmDone':'orders.setStatus', backendRoles:isRole(r,['client'])?['client']:['admin','owner']}));
    }
    if (isRole(r, ['client','master','sto','admin','owner']) && ['process','done_pending_client'].includes(st)) {
      push(makeAction('open_dispute', r, {kind:'risk', targetStatus:'dispute', backendAction:'orders.dispute', backendRoles:['client','master','sto']}));
    }
    if ((isRole(r, ['client']) && ['new','waiting_responses'].includes(st)) || (isRole(r, ['admin','owner']) && !['done','cancelled'].includes(st))) {
      push(makeAction('cancel_order', r, {kind:'risk', targetStatus:'cancelled', backendAction:isRole(r,['client'])?'orders.cancelByClient':'orders.setStatus', backendRoles:isRole(r,['client'])?['client']:['admin','owner']}));
    }
    if (isRole(r, ['admin','owner'])) {
      push(makeAction('delete_order', r, {kind:'danger', backendAction:'orders.delete', backendRoles:['admin','owner']}));
    }

    allowedNext(st, r).forEach(function(to){
      push({
        key:'set_status:' + to,
        role:r,
        label: label(to, type),
        shortLabel: shortLabel(to, type),
        icon: icon(to),
        color: color(to),
        kind:'status',
        targetStatus:to,
        backendAction:'orders.setStatus',
        backendRoles:['master','sto','admin','owner']
      });
    });

    return actions;
  }

  function hasAction(order, role, key, options){
    return getAvailableActions(order, role, options).some(function(a){ return a.key === key; });
  }

  window.KaretaOrderLifecycle = {
    version:'stable', STATUSES, ACTIVE_STATUSES, OPEN_STATUSES, WORK_STATUSES,
    CLIENT_CONFIRM_STATUSES, CLOSED_STATUSES, TRANSITIONS,
    normalize, normalizeRole, typeOf, label, shortLabel, icon, color, withIcon, cssClass,
    isActive, isOpen, isWork, needsClientConfirm, isClosed,
    actorRole, canTransition, allowedNext, nextStatus,
    getAvailableActions, hasAction, isOrderAssigned
  };
  window.getOrderAvailableActions = getAvailableActions;
})();
