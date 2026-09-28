/* ═══════════════════════════════════════════════════════════
   KARETA.KZ — MESSENGER v3.0
   WhatsApp-стиль. Данные из DB.Chats + DB.Messages.
   Роли: client, master (этапы+отчёты+файлы), admin/owner
═══════════════════════════════════════════════════════════ */

const Messenger = (() => {

  const STAGES = [
    { id:'accepted',  ico:'📝', label:'Заявка принята',        desc:'Мастер принял заявку' },
    { id:'diagnosed', ico:'🔍', label:'Диагностика завершена', desc:'Установлена причина' },
    { id:'parts',     ico:'🛒', label:'Запчасти получены',     desc:'Комплектующие готовы' },
    { id:'started',   ico:'🔧', label:'Ремонт начат',          desc:'Выполняется ремонт' },
    { id:'quality',   ico:'🔬', label:'Контроль качества',     desc:'Проверка после ремонта' },
    { id:'done',      ico:'✅', label:'Работа завершена',      desc:'Ремонт выполнен' },
    { id:'delivered', ico:'🚗', label:'Авто выдано клиенту',   desc:'Клиент забрал авто' },
  ];

  let _activeChatId = null;
  let _open = false;
  let _view = 'list'; // 'list' | 'chat'
  let _replyState = null;
  let _chatSearch = { open:false, query:'', matches:[], index:-1 };
  function _toolsLoad(){ try { return JSON.parse(localStorage.getItem('kareta.catalogTools.messages') || '{}') || {}; } catch(_e){ return {}; } }
  function _toolsSave(patch){ try { localStorage.setItem('kareta.catalogTools.messages', JSON.stringify(Object.assign({}, _toolsLoad(), patch || {}, { updatedAt:new Date().toISOString() }))); } catch(_e){} }
  let _pageFilter = _toolsLoad().filter || 'all';
  function _isStaffRole(role){ return role==='master' || role==='sto' || role==='admin' || role==='owner'; }
  let _pageQuery = _toolsLoad().q || '';
  let _profilePanelChatId = null;
  const _historySyncing = new Set();
  const _historySyncedAt = new Map();
  const _actionBusy = { stage:new Set(), report:new Set(), parts:new Set(), open:new Set() };

  function _withActionBusy(bucket, key, runner) {
    const store = _actionBusy[bucket];
    const safeKey = String(key || '').trim();
    if (!store || !safeKey) return Promise.resolve().then(runner);
    if (store.has(safeKey)) return Promise.resolve({ ok:true, skipped:true, busy:true });
    store.add(safeKey);
    return Promise.resolve().then(runner).finally(() => {
      setTimeout(() => { try { store.delete(safeKey); } catch(_e) {} }, 900);
    });
  }

  function _role()  { return window._appState?.user?.role || 'guest'; }
  function _user()  { return window._appState?.user; }
  function _now()   { return DB._nowStr(); }
  function _safePhone(v) { return String(v || '').replace(/\D/g, ''); }
  function _draftKey(chatId) { return 'kareta.chat.draft.' + _safeText(chatId || '', ''); }
  function _loadDraft(chatId) { try { return localStorage.getItem(_draftKey(chatId)) || ''; } catch(_e) { return ''; } }
  function _saveDraft(chatId, value) { try {
    const key = _draftKey(chatId);
    const text = String(value || '');
    if (text.trim()) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  } catch(_e) {} }
  function _clearDraft(chatId) { try { localStorage.removeItem(_draftKey(chatId)); } catch(_e) {} }
  function _scrollMessagesToBottom() {
    const msgsEl = document.getElementById('msng-msgs');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ─── Получить чаты для текущего пользователя ─── */
  function _myChats() {
    const role = _role(); const u = _user();
    if (!u) return [];
    const allChats = DB.Chats.getAll();
    if (role === 'client') {
      const phone = _safePhone(u.phone);
      return allChats.filter(c => _safePhone(c.clientPhone) === phone);
    }
    if (role === 'master') {
      const m = DB.Masters.getByPhone(u.phone);
      const phone = _safePhone(u.phone);
      return m ? allChats.filter(c => String(c.masterId || '') === String(m.id || '') || _safePhone(c.masterPhone) === phone) : [];
    }
    if (role === 'sto') {
      let stoId = '';
      try { stoId = String(DB.StoExchangeStore?.getState?.().stoId || ''); } catch(_e) {}
      const stoOrders = new Set((DB.Orders.getAll()||[]).filter(o => stoId && String(o.stoId||o.sto_id||'')===stoId).map(o => String(o.id)));
      const teamMasterIds = new Set();
      try { (DB.StoExchangeStore?.getState?.().masters || []).forEach(m => teamMasterIds.add(String(m.id||''))); } catch(_e) {}
      return allChats.filter(c => {
        if (Number(c.stoUserId||c.sto_user_id||0) === Number(u.id||0)) return true;
        if (stoId && String(c.stoId||c.sto_id||'') === stoId) return true;
        if (stoOrders.has(String(c.orderId||''))) return true;
        if (teamMasterIds.has(String(c.masterId||''))) return true;
        return false;
      });
    }
    if (role === 'admin' || role === 'owner') return allChats;
    return [];
  }

  /* ─── Подсчёт непрочитанных ─── */
  function _totalUnread() {
    const role = _role(); const u = _user();
    if (!u) return 0;
    return _myChats().reduce((s,c) => s + (c.unread?.[role]||0), 0);
  }


  function _orderType(chat) {
    if (!chat || !chat.orderId) return 'service_order';
    return DB.Orders.get(chat.orderId)?.type || 'service_order';
  }

  function _typeLabel(type) {
    return type === 'parts_request' ? 'Запрос запчастей' : 'Обычная заявка';
  }

  function _statusLabel(status, type) {
    return window.KaretaOrderLifecycle?.label?.(status, type) || status || 'Без статуса';
  }

  function _statusColor(status) {
    return window.KaretaOrderLifecycle?.color?.(status) || 'var(--text3)';
  }

  function _lastChatTimestamp(chat) {
    const msgs = DB.Messages.get(chat?.id || '') || [];
    const lastMsg = msgs.slice().reverse().find(m => m && m.type !== 'event') || msgs[msgs.length - 1] || null;
    return String(lastMsg?.createdAt || lastMsg?.created_at || lastMsg?.date || lastMsg?.timeIso || chat?.updated_at || chat?.updatedAt || chat?.created_at || chat?.createdAt || lastMsg?.time || '');
  }

  function _chatPriorityWeight(chat) {
    const state = _chatInboxState(chat);
    const role = _role();
    const unread = Number(chat?.unread?.[role] || 0);
    if (state === 'overdue' || state === 'overdue_admin_queue') return 0;
    if (unread > 0) return 1;
    if (state === 'admin_queue') return 2;
    if (state === 'waiting_staff') return 3;
    if (state === 'open') return 4;
    if (state === 'waiting_client') return 5;
    if (state === 'new') return 6;
    return 9;
  }

  function _sortChats(list) {
    return (list || []).slice().sort((a,b) => {
      const aw = _chatPriorityWeight(a);
      const bw = _chatPriorityWeight(b);
      if (aw !== bw) return aw - bw;
      const at = _lastChatTimestamp(a);
      const bt = _lastChatTimestamp(b);
      return String(bt).localeCompare(String(at), 'ru');
    });
  }

  function _parseDateish(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function _lastHumanMsg(chat) {
    const msgs = DB.Messages.get(chat.id) || [];
    return msgs.slice().reverse().find(m => ['client','master','sto','admin','owner'].includes(String(m.from || ''))) || null;
  }

  function _isActiveChat(chat) {
    return ['new','process'].includes(String(chat?.status || 'new'));
  }

  function _chatInboxState(chat) {
    const role = _role();
    const status = String(chat?.status || 'new');
    if (!_isActiveChat(chat)) return status === 'cancelled' ? 'cancelled' : 'done';

    const masterId = String(chat?.masterId || '0');
    const last = _lastHumanMsg(chat);
    const from = String(last?.from || '');
    const lastAt = _parseDateish(last?.createdAt || last?.created_at || last?.date || last?.timeIso || chat?.updated_at || chat?.updatedAt || chat?.created_at || chat?.createdAt || '');
    const isOverdue = !!(lastAt && ((Date.now() - lastAt.getTime()) > 24*60*60*1000));

    if ((role === 'admin' || role === 'owner') && masterId === '0') return isOverdue ? 'overdue_admin_queue' : 'admin_queue';
    if ((chat?.unread?.[role] || 0) > 0) return isOverdue ? 'overdue' : 'waiting_staff';
    if (from === 'client') return isOverdue ? 'overdue' : 'waiting_staff';
    if (['master','sto','admin','owner','system'].includes(from)) return 'waiting_client';
    return 'open';
  }

  function _chatStateLabel(state) {
    return ({
      overdue:'Просрочен', overdue_admin_queue:'Просрочен', admin_queue:'Админ', waiting_staff:'Ждёт ответа',
      waiting_client:'Ждёт клиента', open:'Открыт', new:'Новый', done:'Завершён', cancelled:'Отменён'
    })[String(state || '')] || 'Открыт';
  }

  function _chatFilterOptions() {
    const role = _role();
    const base = [
      { id:'open', label:'Открытые' },
      { id:'all', label:'Все' },
      { id:'unread', label:'Непрочитанные' },
      { id:'new', label:'Новые' },
      { id:'process', label:'В работе' },
      { id:'done', label:'Выполнены' },
      { id:'cancelled', label:'Отменены' },
    ];
    if (_isStaffRole(role)) {
      const staff = [
        { id:'waiting_staff', label:'Ждут ответа' },
        { id:'waiting_client', label:'Ждут клиента' },
        { id:'overdue', label:'Просрочены' },
      ];
      if (role === 'admin' || role === 'owner') staff.unshift({ id:'admin_queue', label:'У администрации' });
      return [base[0], ...staff, ...base.slice(1)];
    }
    return base;
  }

  function _getVisibleChats() {
    const role = _role();
    const q = (_pageQuery || '').trim().toLowerCase();
    let list = _myChats();

    if (_pageFilter === 'open') list = list.filter(c => _isActiveChat(c));
    else if (_pageFilter === 'unread') list = list.filter(c => (c.unread?.[role] || 0) > 0);
    else if (_pageFilter === 'waiting_staff') list = list.filter(c => _chatInboxState(c) === 'waiting_staff');
    else if (_pageFilter === 'waiting_client') list = list.filter(c => _chatInboxState(c) === 'waiting_client');
    else if (_pageFilter === 'admin_queue') list = list.filter(c => ['admin_queue','overdue_admin_queue'].includes(_chatInboxState(c)));
    else if (_pageFilter === 'overdue') list = list.filter(c => ['overdue','overdue_admin_queue'].includes(_chatInboxState(c)));
    else if (_pageFilter !== 'all') list = list.filter(c => (c.status || 'new') === _pageFilter);

    if (q) {
      list = list.filter(c =>
        (c.clientName || '').toLowerCase().includes(q) ||
        (c.masterName || '').toLowerCase().includes(q) ||
        (c.orderTitle || '').toLowerCase().includes(q) ||
        String(c.orderId || '').toLowerCase().includes(q) ||
        (c.car || '').toLowerCase().includes(q)
      );
    }

    return _sortChats(list);
  }

  function _staffInboxStats(chats) {
    const all = chats || _myChats();
    return {
      adminQueue: all.filter(c => ['admin_queue','overdue_admin_queue'].includes(_chatInboxState(c))).length,
      waitingStaff: all.filter(c => _chatInboxState(c) === 'waiting_staff').length,
      waitingClient: all.filter(c => _chatInboxState(c) === 'waiting_client').length,
      overdue: all.filter(c => ['overdue','overdue_admin_queue'].includes(_chatInboxState(c))).length,
      active: all.filter(c => _isActiveChat(c)).length,
    };
  }

  function _renderStaffInboxCards(chats) {
    const role = _role();
    if (!_isStaffRole(role)) return '';
    const s = _staffInboxStats(chats);
    const cards = [
      (role === 'admin' || role === 'owner') ? { id:'admin_queue', icon:'🧷', title:'У администрации', count:s.adminQueue, sub:'Новые и возвращённые без мастера' } : null,
      { id:'waiting_staff', icon:'📥', title:'Ждут ответа', count:s.waitingStaff, sub:'Клиент написал, нужен ответ' },
      { id:'waiting_client', icon:'🕓', title:'Ждут клиента', count:s.waitingClient, sub:'Последний ход за сотрудником' },
      { id:'overdue', icon:'⏰', title:'Просрочены', count:s.overdue, sub:'Нет реакции больше 24 часов' },
    ].filter(Boolean);
    return `<div class="msng-staff-cards">${cards.map(c => `<button class="msng-staff-card ${_pageFilter===c.id?'active':''}" onclick="Messenger.setPageFilter('${c.id}')"><div class="msng-staff-card-top"><span>${c.icon}</span><strong>${c.title}</strong></div><div class="msng-staff-card-count">${c.count}</div><div class="msng-staff-card-sub">${c.sub}</div></button>`).join('')}</div>`;
  }


  function _renderPageQuickActions(chats) {
    const role = _role();
    const all = chats || _myChats();
    const unread = all.reduce((s,c) => s + Number(c.unread?.[role] || 0), 0);
    const active = all.filter(c => _isActiveChat(c)).length;
    const last = _sortChats(all)[0] || null;
    const canSupport = role === 'client' || role === 'guest';
    const waitingClient = all.filter(c => _chatInboxState(c) === 'waiting_client').length;
    const overdue = all.filter(c => ['overdue','overdue_admin_queue'].includes(_chatInboxState(c))).length;
    const waitingStaff = all.filter(c => _chatInboxState(c) === 'waiting_staff').length;
    const chips = [
      { label:'Открытые', value:String(active), filter:'open', hot:active>0 },
      { label:'Новые', value:String(unread), filter:'unread', hot:unread>0 },
      _isStaffRole(role) ? { label:'Ждут ответа', value:String(waitingStaff), filter:'waiting_staff', hot:waitingStaff>0 } : null,
      _isStaffRole(role) ? { label:'Просрочены', value:String(overdue), filter:'overdue', hot:overdue>0 } : null,
      _isStaffRole(role) ? { label:'Ждут клиента', value:String(waitingClient), filter:'waiting_client', hot:false } : null,
    ].filter(Boolean);
    const priorityText = _isStaffRole(role)
      ? (overdue ? 'Сначала откройте просроченные диалоги.' : waitingStaff ? 'Сначала ответьте клиентам, которые ждут реакции.' : 'Очередь чистая: можно смотреть все активные диалоги.')
      : (unread ? 'Есть новые сообщения по вашим заявкам.' : 'Когда появится ответ мастера или администрации, он будет здесь.');
    return `<section class="msng-quick-dashboard card">
      <div class="msng-quick-dashboard-main">
        <span>Центр сообщений</span>
        <b>${unread ? unread + ' новых сообщений' : 'Все сообщения обработаны'}</b>
        <small>${last ? 'Последний диалог: ' + _safeText(last.orderTitle || last.clientName || 'чат') : 'Диалоги появятся после заявок или обращения в поддержку.'}</small>
        <em class="msng-queue-hint">${priorityText}</em>
      </div>
      <div class="msng-quick-dashboard-chips">
        ${chips.map(c => `<button type="button" class="${c.hot ? 'is-hot' : ''}" onclick="Messenger.setPageFilter('${c.filter}')"><strong>${c.value}</strong><span>${c.label}</span></button>`).join('')}
      </div>
      <div class="msng-quick-dashboard-actions">
        ${canSupport ? '<button type="button" class="btn btn-primary" onclick="Messenger.openAdminChat()">Написать администрации</button>' : '<button type="button" class="btn btn-primary" onclick="Messenger.openFirstUrgent()">Открыть срочный</button>'}
        <button type="button" class="btn btn-outline" onclick="Messenger.clearPageSearch();Messenger.setPageFilter('all')">Все чаты</button>
      </div>
    </section>`;
  }


  function _ordersDoneByPhone(phone) {
    const p = String(phone || '').replace(/\D/g, '');
    if (!p) return [];
    return (DB.Orders.getAll() || []).filter(o => String(o.clientPhone || '').replace(/\D/g, '') === p && ['done','completed'].includes(String(o.status || '').toLowerCase()));
  }

  function _loyaltyProfileByPhone(phone) {
    const doneOrders = _ordersDoneByPhone(phone);
    const points = Math.max(0, Math.min(9999, doneOrders.reduce((a,o)=>a + ((Number(o.price) || 0) * 0.05 | 0), 0) + 850));
    const levels = [
      { icon:'🥉', n:'Бронза',  min:0,    max:499,  disc:'5%',  color:'#c98b5a' },
      { icon:'🥈', n:'Серебро', min:500,  max:999,  disc:'10%', color:'#a7b3c8' },
      { icon:'🥇', n:'Золото',  min:1000, max:2499, disc:'15%', color:'#f2c14e' },
      { icon:'💎', n:'Платина', min:2500, max:9999, disc:'20% + приоритет', color:'#7dd3fc' },
    ];
    const cur = levels.slice().reverse().find(l => points >= l.min) || levels[0];
    const next = levels[levels.indexOf(cur) + 1] || null;
    const history = doneOrders
      .slice()
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''),'ru'))
      .slice(0,3)
      .map(o => ({
        pts: Math.max(0, ((Number(o.price)||0) * 0.05 | 0)),
        title: o.title || o.serviceTitle || o.problem || 'Работа по заявке',
        date: _formatDateShort(o.createdAt || o.date || '')
      }));
    return { points, levels, cur, next, history };
  }

  function _safeText(v, fallback='') {
    return (v === undefined || v === null) ? fallback : String(v);
  }

  function _escHtml(v) {
    return _safeText(v, '').replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]) || ch;
    });
  }

  function _escAttr(v) { return _escHtml(v).replace(/`/g, '&#96;'); }

  function _jsArg(v) { return _escAttr(JSON.stringify(_safeText(v, ''))); }
  function _safeMediaSrc(v) {
    const value = _safeText(v, '').trim();
    if (!value) return '';
    if (/^blob:[A-Za-z0-9+.-]+:/i.test(value)) return value;
    if (/^data:(?:image\/(?:png|jpeg|webp|gif)|video\/(?:mp4|webm)|audio\/(?:webm|ogg|mpeg));base64,[A-Za-z0-9+/=]+$/i.test(value)) return value;
    if (/^(?:\/)?uploads\/chat\/[A-Za-z0-9/_-]+\.(?:jpe?g|png|webp|gif|mp4|webm|pdf|txt)$/i.test(value)) return value.startsWith('/') ? value : '/' + value;
    if (/^\/api\/chat_attachment\.php\?[A-Za-z0-9%&=_-]+$/i.test(value)) return value;
    return '';
  }

  function _isOwnMessage(m, role) {
    const from = String(m?.from || '');
    return (role === 'client' && from === 'client') || ((role === 'master' || role === 'sto' || role === 'admin' || role === 'owner') && from !== 'client');
  }

  function _formatDateShort(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
  }

  function _renderLoyaltyCard(profile, mode) {
    if (!profile || !profile.cur) return '';
    const compact = mode === 'compact';
    if (compact) {
      return `<div class="msng-loyalty-card msng-loyalty-card--compact">
        <div class="msng-loyalty-main"><span class="msng-loyalty-icon">${profile.cur.icon}</span><span class="msng-loyalty-title">${profile.cur.n}</span><span class="msng-loyalty-points">${profile.points} баллов</span></div>
        <div class="msng-loyalty-disc">${profile.cur.disc}</div>
      </div>`;
    }
    return `<div class="msng-loyalty-card">
      <div class="msng-loyalty-head">
        <div>
          <div class="msng-loyalty-caption">Программа лояльности</div>
          <div class="msng-loyalty-level"><span class="msng-loyalty-icon">${profile.cur.icon}</span><span>${profile.cur.n}</span></div>
        </div>
        <div class="msng-loyalty-points-big">${profile.points}</div>
      </div>
      <div class="msng-loyalty-sub">${profile.cur.disc} · 1 балл = 1 ₸</div>
      <div class="msng-loyalty-actions">
        <button class="msng-loyalty-btn" onclick="window.showLoyaltyRedeem?.()">💳 Потратить баллы</button>
        <button class="msng-loyalty-btn msng-loyalty-btn--ghost" onclick="window.App?.go?.('cabinet')">📅 Заработать ещё</button>
      </div>
      <div class="msng-loyalty-levels">${profile.levels.map(l => `<div class="msng-loyalty-tier ${l.n===profile.cur.n?'active':''}"><span>${l.icon}</span><div><strong>${l.n}</strong><small>${l.min.toLocaleString('ru-RU')}${l.max < 9999 ? '–'+l.max.toLocaleString('ru-RU') : '+'} баллов</small></div><b>${l.disc}</b></div>`).join('')}</div>
      <div class="msng-loyalty-history-title">История баллов</div>
      <div class="msng-loyalty-history">${(profile.history.length ? profile.history : [{pts:0,title:'Пока нет завершённых заказов',date:'—'}]).map(h => `<div class="msng-loyalty-row"><span class="msng-loyalty-row-pts">+${h.pts}</span><div class="msng-loyalty-row-main"><div>${h.title}</div><small>${h.date}</small></div></div>`).join('')}</div>
    </div>`;
  }

  function _chatStats() {
    const role = _role();
    const all = _myChats();
    return {
      total: all.length,
      unread: all.reduce((s,c) => s + ((c.unread?.[role]) || 0), 0),
      active: all.filter(c => (c.status || 'new') === 'process').length,
      done: all.filter(c => (c.status || 'new') === 'done').length,
    };
  }



  function _chatFilterCount(filterId) {
    const role = _role();
    const list = _myChats();
    if (filterId === 'all') return list.length;
    if (filterId === 'open') return list.filter(c => _isActiveChat(c)).length;
    if (filterId === 'unread') return list.filter(c => (c.unread?.[role] || 0) > 0).length;
    if (filterId === 'waiting_staff') return list.filter(c => _chatInboxState(c) === 'waiting_staff').length;
    if (filterId === 'waiting_client') return list.filter(c => _chatInboxState(c) === 'waiting_client').length;
    if (filterId === 'admin_queue') return list.filter(c => ['admin_queue','overdue_admin_queue'].includes(_chatInboxState(c))).length;
    if (filterId === 'overdue') return list.filter(c => ['overdue','overdue_admin_queue'].includes(_chatInboxState(c))).length;
    return list.filter(c => (c.status || 'new') === filterId).length;
  }

  function _renderPageFilters() {
    const icons = {
      open:'📂', all:'💬', unread:'🔴', new:'🆕', process:'🔧', done:'🏁', cancelled:'✖',
      waiting_staff:'⏳', waiting_client:'👤', admin_queue:'🛡️', overdue:'⚠️'
    };
    return `<div class="mo-filter-bar msng-mo-filter-bar">
      <div class="mo-filter-tabs">${_chatFilterOptions().map(f => {
        const cnt = _chatFilterCount(f.id);
        const hot = ['unread','overdue','admin_queue'].includes(f.id) && cnt > 0;
        return `<button class="mo-filter-tab ${_pageFilter===f.id?'active':''}" data-filter="${f.id}" onclick="Messenger.setPageFilter('${f.id}')">
          <span class="mo-filter-tab-ico">${icons[f.id] || '💬'}</span>${f.label}<span class="mo-filter-cnt ${hot?'mo-filter-cnt--hot':''}">${cnt}</span>
        </button>`;
      }).join('')}</div>
    </div>`;
  }


  function _renderPageSearchButton() {
    return `<div class="mo-search-action msng-search-action" data-search-scope="messages">
      <button type="button" class="mo-search-toggle" aria-expanded="false" aria-controls="msng-page-search-panel" onclick="Messenger.togglePageSearch()"><span>🔎</span><b>Поиск по чатам</b></button>
      <div class="mo-search-panel" id="msng-page-search-panel" data-search-panel="messages" hidden>
        <input class="mo-search-input" id="msng-page-search-input" data-search-input="messages" type="search" value="${_escAttr(_pageQuery || '')}" placeholder="Поиск по чатам, заявке, авто, клиенту..." oninput="Messenger.searchChatsPage(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Messenger.searchChatsPage(this.value)}">
        <button type="button" class="mo-search-clear" onclick="Messenger.clearPageSearch()" aria-label="Очистить поиск">✕</button>
        <button type="button" class="mo-search-submit" onclick="Messenger.searchChatsPage(document.getElementById('msng-page-search-input')?.value||'')" aria-label="Начать поиск"><span>🔎</span><b>Найти</b></button>
      </div>
    </div>`;
  }

  function togglePageSearch() {
    const wrap = document.querySelector('.mo-search-action[data-search-scope="messages"]');
    const panel = document.getElementById('msng-page-search-panel');
    if(!panel) return;
    const isHidden = panel.hasAttribute('hidden');
    if(isHidden) panel.removeAttribute('hidden'); else panel.setAttribute('hidden','');
    _toolsSave({ searchOpen: !!isHidden });
    wrap?.classList.toggle('open', isHidden);
    const btn = wrap?.querySelector?.('.mo-search-toggle');
    if(btn) btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    // do not autofocus page search on #messages toolbar toggle.
  }

  function clearPageSearch() {
    _pageQuery = '';
    _toolsSave({ q:'' });
    const input = document.getElementById('msng-page-search-input');
    if(input) input.value = '';
    _renderListPage();
  }

  function _restorePageToolsState() {
    try {
      const state = _toolsLoad();
      const wrap = document.querySelector('.mo-search-action[data-search-scope="messages"]');
      const panel = document.getElementById('msng-page-search-panel');
      const input = document.getElementById('msng-page-search-input');
      const shouldOpen = !!state.searchOpen || !!String(_pageQuery || '').trim();
      if (input && input.value !== String(_pageQuery || '')) input.value = String(_pageQuery || '');
      if (panel) {
        if (shouldOpen) panel.removeAttribute('hidden'); else panel.setAttribute('hidden','');
      }
      if (wrap) wrap.classList.toggle('open', shouldOpen);
      const btn = wrap?.querySelector?.('.mo-search-toggle');
      if (btn) btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    } catch(_e) {}
  }

  // grouped page sections removed. #messages renders one flat list only.

  function _renderPageList(chats, role) {
    if (!chats.length) {
      return `<div class="msng-empty msng-empty--page">
        <div style="font-size:48px;margin-bottom:12px">💬</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">Ничего не найдено</div>
        <div style="font-size:13px;color:var(--text3)">Попробуйте другой фильтр или измените запрос поиска</div>
      </div>`;
    }

    // фильтр «Все» больше не группирует один и тот же чат по нескольким секциям.
    // Рендерим плоский список без .msng-page-section и без .msng-page-section-head.
    return `<div class="msng-list msng-list--page" id="msng-page-list">${chats.map(c => _chatItem(c, role)).join('')}</div>`;
  }

  /* ═══════════════════
     MOUNT (DOM один раз)
  ═══════════════════ */
  function mount() {
    if (document.getElementById('messenger-panel')) return;
    const ov = document.createElement('div');
    ov.id = 'messenger-overlay';
    document.body.appendChild(ov);

    const panel = document.createElement('div');
    panel.id = 'messenger-panel';
    panel.innerHTML = `
      <div class="msng-handle"></div>
      <div class="msng-header" id="msng-header"></div>
      <div class="msng-body"   id="msng-body"></div>`;
    document.body.appendChild(panel);
  }

  function _panelRoot() {
    let panel = document.getElementById('messenger-panel');
    if (!panel) {
      mount();
      panel = document.getElementById('messenger-panel');
    }
    return panel;
  }

  function _isMessagesRoute() {
    const hash = String(location.hash || '').replace(/^#/, '');
    return hash === 'messages' || hash.startsWith('messages:') || !!document.querySelector('.messages-page');
  }

  function _routeChatId() {
    const raw = String(location.hash || '').replace(/^#/, '');
    if (!raw.startsWith('messages:')) return '';
    let token = raw.slice('messages:'.length);
    if (token.startsWith('chat:')) token = token.slice('chat:'.length);
    try { return decodeURIComponent(token || '').trim(); } catch(_e) { return String(token || '').trim(); }
  }

  function _messagesPageRoot() {
    return document.querySelector('.messages-page');
  }

  function _setMessagesInlineChat(active) {
    const panel = _panelRoot();
    const overlay = document.getElementById('messenger-overlay');
    const page = _messagesPageRoot();
    const win = document.getElementById('msng-page-window') || page?.querySelector('.msng-page-window');
    if (active && page && win && panel) {
      if (panel.parentNode !== win) win.appendChild(panel);
      panel.classList.add('msng-panel-inline');
      panel.classList.add('open');
      panel.setAttribute('data-inline-route', 'messages');
      panel.setAttribute('data-messages-surface', 'chat');
      page.setAttribute('data-message-mode', 'chat');
      page.setAttribute('data-route-surface', 'messages-chat');
      overlay?.classList.remove('vis');
      document.body.classList.remove('chat-fullscreen-open');
      page.classList.add('messages-chat-open');
      return true;
    }
    if (panel?.classList.contains('msng-panel-inline')) {
      panel.classList.remove('open');
      panel.classList.remove('msng-panel-inline');
      panel.removeAttribute('data-inline-route');
      try { document.body.appendChild(panel); } catch(_e) {}
    }
    page?.classList.remove('messages-chat-open');
    overlay?.classList.remove('vis');
    document.body.classList.remove('chat-fullscreen-open');
    return false;
  }

  /* ═══════════════════
     OPEN / CLOSE
  ═══════════════════ */
  function open(chatId) {
    mount();
    if (!chatId) {
      if (_isMessagesRoute()) {
        _setMessagesInlineChat(false);
        _open = false; _view = 'list'; _activeChatId = null;
        _renderListPage();
        return;
      }
      // Нет конкретного чата вне #messages — показываем полноэкранную панель со списком.
      document.getElementById('messenger-overlay')?.classList.add('vis');
      document.getElementById('messenger-panel')?.classList.add('open');
      document.body.classList.add('chat-fullscreen-open');
      _open = true; _view = 'list'; _render();
      return;
    }
    try { window.Notifs?.close?.(); } catch(_e) {}
    if (window.App?.LayerManager && !window.App.LayerManager.open('messenger') && window.App.LayerManager.isOpen('messenger')) return;
    _open = true;
    _activeChatId = chatId;
    _view = 'chat';
    if (_isMessagesRoute() && _setMessagesInlineChat(true)) {
      _render();
      return;
    }
    document.getElementById('messenger-overlay')?.classList.add('vis');
    document.getElementById('messenger-panel')?.classList.add('open');
    document.body.classList.add('chat-fullscreen-open');
    _render();
  }

  function close() {
    _replyState=null;
    const wasInline = document.getElementById('messenger-panel')?.classList.contains('msng-panel-inline');
    _open = false;
    _closeSubPanel();
    _closeFloatingChatWindows();
    if (wasInline) {
      _view = 'list';
      _activeChatId = null;
      _setMessagesInlineChat(false);
      try { if (String(location.hash || '').startsWith('#messages:')) history.pushState({ messengerList:true }, '', '#messages'); } catch(_e) {}
      _renderListPage();
      updateBadge();
      return;
    }
    document.getElementById('messenger-overlay')?.classList.remove('vis');
    document.getElementById('messenger-panel')?.classList.remove('open');
    try{ window.App?.LayerManager?.close('messenger'); }catch(_e){}
    document.body.classList.remove('chat-fullscreen-open');
    document.querySelector('.bnav-item.is-chat-active')?.classList.remove('is-chat-active');
    // закрытие окна чата возвращает URL на список сообщений.
    try { if (String(location.hash || '').startsWith('#messages:')) history.pushState({ messengerList:true }, '', '#messages'); } catch(_e) {}
    updateBadge();
  }

  function toggle(chatId) {
    if (chatId) { open(chatId); return; }
    if (_open) { close(); return; }
    open(null);
  }

  /* ─── Открыть чат по заказу ─── */
  async function openByOrder(orderId) {
    let chat = DB.Chats.getByOrder(orderId);
    if (chat) { open(chat.id); return; }
    const order = window.DB?.Orders?.get?.(orderId) || null;
    if (order && window.DB?.Chats?.createFromOrder) {
      try {
        const master = order.masterId ? (window.DB?.Masters?.get?.(order.masterId) || null) : null;
        chat = await window.DB.Chats.createFromOrder(order, master, { persist:true });
        if (chat) { open(chat.id); return; }
      } catch(_e) {}
    }
    if(window.showToast) window.showToast('Чат по заявке не найден','error');
  }

  function renderPage(options = {}) {
    const u = window._appState?.user;
    // Без авторизации — показываем приглашение войти
    if (!u?.phone) {
      const demoRole = window.getDemoRole?.() || 'client';
      const labels = {
        client: 'Войдите, чтобы переписываться с мастером по вашим заявкам',
        master: 'Войдите, чтобы вести переписку с клиентами',
        sto: 'Войдите, чтобы управлять коммуникациями команды',
      };
      return '<div class="page"><div class="container" style="max-width:480px;padding-top:60px">'
        + '<div class="empty-state">'
        + '<div class="empty-icon">💬</div>'
        + '<div class="empty-t">Чаты</div>'
        + '<div class="empty-d">' + (labels[demoRole] || labels.client) + '</div>'
        + '<button class="btn btn-primary" style="margin-top:20px;padding:12px 28px" onclick="window.requireAuth && requireAuth(&quot;open_cabinet&quot;,{role:&quot;' + demoRole + '&quot;})">Войти</button>'
        + '</div></div></div>';
    }
    const role = _role();
    const allChats = _myChats();
    const open    = allChats.filter(c => ['new','process'].includes(c.status||'new')).length;
    const unread  = allChats.reduce((s,c) => s + (c.unread?.[role]||0), 0);
    const done    = allChats.filter(c => c.status==='done').length;
    const total   = allChats.length;

    const roleLabels = { client:'Мои чаты', master:'Рабочие чаты', sto:'Чаты СТО', admin:'Диспетчерская', owner:'Все диалоги' };
    const roleDesc   = {
      client:'История переписки с мастером и администрацией по всем вашим заявкам.',
      master:'Ваши активные диалоги по заявкам. Клиент видит только свой чат.',
      sto:'Диалоги по лидам и заказам СТО, включая назначенных мастеров команды.',
      admin:'Центр коммуникации — все активные диалоги и очередь необработанных обращений.',
      owner:'Полный обзор всех чатов системы в реальном времени.'
    };
    const initials = u ? (u.initials || (u.name||'?').slice(0,2).toUpperCase()) : '?';
    const rColor = window.RBAC?.getRole?.(u)?.color || 'var(--orange)';
    const messagesToolsHtml = window.renderKCatalogTools
      ? window.renderKCatalogTools('messages', { filtersHtml:`<div id="msng-page-filterbar">${_renderPageFilters()}</div>`, placeholder:'Поиск по чату, заявке, клиенту, мастеру...', searchLabel:'Поиск по чатам' })
      : window.renderCatalogTools
      ? window.renderCatalogTools('messages', { filtersHtml:`<div id="msng-page-filterbar">${_renderPageFilters()}</div>`, placeholder:'Поиск по чату, заявке, клиенту, мастеру...', searchLabel:'Поиск по чатам' })
      : `<div class="catalog-tools catalog-tools--messages masters-sticky-tools msng-sticky-tools" id="msng-sticky-tools" data-catalog-tools="messages" data-catalog-render="unified-v2"><div class="catalog-tools__actions" data-catalog-slot="actions" data-tools-scope="messages"><button type="button" class="catalog-tool-btn catalog-tool-btn--sort" aria-label="Сортировка" onclick="window.openMoToolsSort&&openMoToolsSort('messages')"><span class="catalog-tool-btn__ico">↕️</span><b>Сортировка</b></button><button type="button" class="catalog-tool-btn catalog-tool-btn--filters" aria-label="Фильтрация" onclick="window.openMoToolsFilters&&openMoToolsFilters('messages')"><span class="catalog-tool-btn__ico">☰</span><b>Фильтрация</b></button><button type="button" class="catalog-tool-btn catalog-tool-btn--settings" aria-label="Настройки страницы" onclick="window.openMoToolsSettings&&openMoToolsSettings('messages')"><span class="catalog-tool-btn__ico">⚙️</span><b>Настройки страницы</b></button><span class="catalog-tools__state mo-mobile-sort-state" data-sort-scope="messages">Сначала новые</span></div><div class="catalog-tools__inner"><div class="catalog-tools__filters" data-catalog-slot="filters"><div id="msng-page-filterbar">${_renderPageFilters()}</div></div><div class="catalog-tools__search" data-catalog-slot="search">${_renderPageSearchButton()}</div></div></div>`;
    const messagesHeroStats = `<div class="spa-hero-stat messages-stat messages-stat--open"><div class="spa-hero-stat-num">${open}</div><div class="spa-hero-stat-lbl">Открытых</div></div><div class="spa-hero-stat-sep"></div><div class="spa-hero-stat messages-stat messages-stat--unread"><div class="spa-hero-stat-num">${unread}</div><div class="spa-hero-stat-lbl">Непрочит.</div></div><div class="spa-hero-stat-sep"></div><div class="spa-hero-stat messages-stat messages-stat--done"><div class="spa-hero-stat-num">${done}</div><div class="spa-hero-stat-lbl">Завершено</div></div><div class="spa-hero-stat-sep"></div><div class="spa-hero-stat messages-stat messages-stat--total"><div class="spa-hero-stat-num">${total}</div><div class="spa-hero-stat-lbl">Всего</div></div>`;
    const messagesHeroHtml = `<section class="messages-tools-only" data-messages-tools-only="stable" aria-label="Инструменты чатов">${messagesToolsHtml}</section>`;

    const embedded = !!(options && options.embedded);
    const windowHtml = `<section class="msng-page-window" id="msng-page-window" aria-label="Список чатов">
            <div class="msng-page-tools-slot" id="msng-page-tools" data-tools-moved-to-hero="stable"></div>
            <div class="msng-page-dashboard-slot" id="msng-page-chatbox"></div>
            <div id="msng-page-listmount" class="messages-listmount msng-page-listmount"></div>
          </section>`;
    if (embedded) {
      return `<div class="messages-page messages-page--embedded msng-full-page msng-full-page--embedded" data-page-layout="embedded-account" data-message-mode="list" data-route-surface="messages-list" data-messages-contract="stable">
        ${messagesHeroHtml}
        <div class="msng-page-content" data-layout-content="messages">${windowHtml}</div>
      </div>`;
    }
    return `<div class="page active messages-page messages-page--standalone msng-full-page" data-page-layout="standalone" data-message-mode="list" data-route-surface="messages-list" data-messages-contract="stable">
      ${messagesHeroHtml}
      <div class="msng-page-content" data-layout-content="messages">
        ${windowHtml}
      </div>
    </div>`;
  }

  function initPage() {
    // страница #messages всегда держит глобальную панель #messenger-panel в DOM.
    // Пустое состояние/служебные блоки рисуются в #msng-page-chatbox, список чатов — в #msng-page-listmount, конкретный диалог — в #messenger-panel.
    mount();
    if (!String(location.hash || '').startsWith('#messages:')) _setMessagesInlineChat(false);
    if (_isStaffRole(_role()) && (!_pageFilter || _pageFilter === 'all')) _pageFilter = 'open';
    _renderListPage();
    _restorePageToolsState();
    updateBadge();
    // URL hash routing: #messages:chatId → сразу открыть чат
    try {
      const chatId = _routeChatId();
      if (chatId) {
        const page = _messagesPageRoot();
        page?.setAttribute('data-message-mode', 'chat');
        page?.setAttribute('data-route-surface', 'messages-chat');
        setTimeout(() => openChat(chatId, { updateUrl:false }), 80);
      }
    } catch(_e) {}
  }


  function openFirstUrgent() {
    const role = _role();
    const all = _sortChats(_myChats());
    const first = all.find(c => ['overdue','overdue_admin_queue','admin_queue','waiting_staff'].includes(_chatInboxState(c)) || Number(c?.unread?.[role] || 0) > 0) || all[0];
    if (first?.id) {
      openChat(first.id);
      return;
    }
    if (window.showToast) window.showToast('Нет активных чатов для ответа', 'info');
  }

  async function openAdminChat() {
    const u = window._appState?.user || {};
    const phone = String(u.phone || '').replace(/\D/g, '') || 'guest';
    const chatId = 'ch_admin_' + phone;
    let chat = DB.Chats.get(chatId);
    if (!chat && window.DB?.Chats?.createFromOrder) {
      const now = new Date().toISOString();
      const clientName = u.name || u.fullName || 'Клиент';
      const clientPhone = u.phone || '';
      const order = {
        id: 'support_' + phone,
        type: 'support',
        serviceNames: 'Обращение в администрацию',
        orderTitle: 'Чат с администрацией',
        clientId: u.id || phone,
        clientName,
        clientPhone,
        clientCar: u.car || '',
        status: 'new',
        createdAt: now,
        chatId
      };
      try {
        chat = await DB.Chats.createFromOrder(order, null, { persist:false });
      } catch(_e) {}
    }
    if (chat && chat.id) {
      openChat(chat.id);
      return;
    }
    if (window.showToast) window.showToast('Не удалось открыть чат с администрацией', 'error');
  }

  function searchChatsPage(q) {
    _pageQuery = q || '';
    _toolsSave({ q:_pageQuery });
    _renderListPage();
  }

  function setPageFilter(filterId) {
    _pageFilter = String(filterId || 'all').toLowerCase();
    _toolsSave({ filter:_pageFilter });
    _renderListPage();
  }

  function _renderListPage() {
    const role = _role();
    const chats = _getVisibleChats();
    const box = document.getElementById('msng-page-chatbox');
    const listMount = document.getElementById('msng-page-listmount');
    if (!box) return;
    const filterbar = document.getElementById('msng-page-filterbar');
    if (filterbar) filterbar.innerHTML = _renderPageFilters();

    const allChats = _myChats();
    box.className = 'msng-page-dashboard-slot';

    if (!allChats.length && role === 'client') {
      box.hidden = false;
      box.className = 'msng-page-dashboard-slot--empty';
      box.innerHTML = `
        <div class="msng-empty-preview">
          <div class="msng-empty-preview__icon">💬</div>
          <div class="msng-empty-preview__title">Чатов пока нет</div>
          <div class="msng-empty-preview__text">Здесь появится переписка по заявкам. Можно сразу написать администрации и уточнить вопрос.</div>
          <button class="btn btn-primary msng-empty-preview__btn" onclick="Messenger.openAdminChat()">✍️ Написать администрации</button>
        </div>`;
      if (listMount) listMount.innerHTML = '';
      return;
    }

    const allChatsForTools = _myChats();
    const quickDashboard = _renderPageQuickActions(allChatsForTools);
    const staffCards = _renderStaffInboxCards(allChatsForTools);
    const dashboardHtml = quickDashboard + (staffCards || '');
    box.hidden = !dashboardHtml;
    box.innerHTML = dashboardHtml;

    const listHtml = chats.length ? _renderPageList(chats, role) : `
      <div class="msng-empty-preview msng-empty-preview--compact msng-empty-preview--list">
        <div class="msng-empty-preview__icon">💬</div>
        <div class="msng-empty-preview__title">Нет чатов по фильтру</div>
        <div class="msng-empty-preview__text">Смените фильтр или напишите администрации.</div>
        ${role==='client' ? '<button class="btn btn-primary msng-empty-preview__btn" onclick="Messenger.openAdminChat()">✍️ Написать администрации</button>' : ''}
      </div>`;

    // жёстко исключаем старый grouped-render. В #messages не должно быть
    // .msng-page-section и .msng-page-section-head ни при фильтре «Все», ни при любом другом фильтре.
    if (listMount) {
      listMount.innerHTML = listHtml;
      listMount.querySelectorAll('.msng-page-section, .msng-page-section-head').forEach(n => n.remove());
    } else {
      box.hidden = false;
      box.innerHTML = listHtml;
      box.querySelectorAll('.msng-page-section, .msng-page-section-head').forEach(n => n.remove());
    }
    _restorePageToolsState();
  }

  /* ═══════════════════
     RENDER dispatcher
  ═══════════════════ */
  function _render() {
    if (_view === 'chat' && _activeChatId) _renderChat(_activeChatId);
    else _renderList();
  }

  /* ═══════════════════════
     LIST — список чатов
  ═══════════════════════ */
  function _renderList() {
    _view = 'list';
    _activeChatId = null;
    // Возврат к списку — URL без конкретного чата
    try {
      if (location.hash.startsWith('#messages:')) history.pushState({}, '', '#messages');
    } catch(_e) {}
    const role = _role();
    if (_isStaffRole(role) && (!_pageFilter || _pageFilter === 'all')) _pageFilter = 'open';
    const chats = _myChats();
    let header = document.getElementById('msng-header');
    let body   = document.getElementById('msng-body');
    if (!header || !body) {
      mount();
      header = document.getElementById('msng-header');
      body   = document.getElementById('msng-body');
    }
    if (!header || !body) return;

    const titleMap = { client:'Мои чаты', master:'Заявки и чаты', admin:'Все чаты', owner:'Все чаты' };

    header.innerHTML = `
      <div class="msng-hd-row msng-hd-row--list">
        <button class="msng-back-btn msng-back-btn--panel" onclick="Messenger.close()" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="msng-hd-title">${titleMap[role]||'Чаты'}</div>
        ${role==='master'||role==='admin'
          ? `<button class="msng-hd-icon-btn" onclick="Messenger.newChat()" title="Новый чат">✏️</button>`
          : ''}
      </div>
      <div class="msng-search-row">
        <input class="msng-search" id="msng-search-input" placeholder="Поиск по чатам..." oninput="Messenger.searchChats(this.value)"/>
      </div>`;

    if (!chats.length) {
      body.innerHTML = `<div class="msng-empty">
        <div style="font-size:48px;margin-bottom:12px">💬</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">Нет чатов</div>
        <div style="font-size:13px;color:var(--text3)">Чаты появятся после создания заявки</div>
      </div>`;
      return;
    }
    body.innerHTML = `<div class="msng-list" id="msng-list">${chats.map(c => _chatItem(c, role)).join('')}</div>`;
  }

  function _chatItem(c, role) {
    const msgs = DB.Messages.get(c.id);
    const lastMsg = [...msgs].reverse().find(m => m.type !== 'event') || msgs[msgs.length-1];
    const previewRaw = lastMsg
      ? (lastMsg.type==='stage' ? '📍 ' + (lastMsg.stageLabel||'Этап')
       : lastMsg.type==='report'? ('📋 Отчёт '+(lastMsg.actorRole==='sto'||lastMsg.from==='sto'?'СТО':'мастера'))
       : lastMsg.type==='file'  ? (lastMsg.fileType==='image'?'📸 Фото':'📎 Файл')
       : (lastMsg.text||'').slice(0,60)) : '—';
    const unread = c.unread?.[role] || 0;
    const status = _safeText(c.status, 'new');
    const type = _orderType(c);
    const sc = _statusColor(status);
    const sl = _statusLabel(status, type);
    const order = DB.Orders.get(c.orderId);
    const masterName = String(c.masterId||'0') === '0' ? 'Администрация' : _safeText(c.masterName,'Мастер');
    const masterInit = _safeText(c.masterInit,'М');
    const clientName = _safeText(c.clientName,'Клиент');
    const clientInit = _safeText(c.clientInit,'К');
    const carLabel   = _safeText(c.car || (order?.clientCar) || '','');
    const svcLabel   = _safeText(c.orderTitle || (order?.serviceNames) || '','');
    const ordNum     = c.orderId ? '#' + String(c.orderId).slice(-6) : '';
    const isActive   = ['process','done_pending_client'].includes(status);
    // Собеседник зависит от роли
    const partnerName  = role==='client' ? masterName : clientName;
    const partnerInit  = role==='client' ? masterInit : clientInit;
    const partnerColor = role==='client' ? 'rgba(52,211,153,.15)' : 'rgba(255,107,0,.15)';
    const partnerBdr   = role==='client' ? '#34d39966' : '#ff6b0066';

    const inboxState = _chatInboxState(c);
    const preview = _safeText(previewRaw, '—');
    return `<div class="msng-item msng-item--v2${unread?' msng-item--unread':''}${isActive?' msng-item--active':''}" data-chat-state="${_escAttr(inboxState)}" onclick="Messenger.openChat(${_jsArg(c.id)})">
      <div class="msng-item-av-wrap">
        <div class="msng-av2" style="background:${partnerColor};border-color:${partnerBdr}">
          <span>${_escHtml(partnerInit)}</span>
          ${isActive ? '<span class="msng-av2-dot"></span>' : ''}
        </div>
      </div>
      <div class="msng-item-content">
        <!-- Строка 1: имя + время -->
        <div class="msng-item-row1">
          <span class="msng-item-name2">${_escHtml(partnerName)}</span>
          <span class="msng-item-time2">${_escHtml(lastMsg?.time||'')}</span>
        </div>
        <!-- Строка 2: заявка + авто -->
        <div class="msng-item-title-row">
          ${ordNum ? '<span class="msng-order-num">'+_escHtml(ordNum)+'</span>' : ''}
          <span class="msng-item-svc">${_escHtml(svcLabel || 'Обсуждение заявки')}</span>
          <span class="msng-state-chip" data-state="${_escAttr(inboxState)}">${_escHtml(_chatStateLabel(inboxState))}</span>
        </div>
        ${carLabel ? '<div class="msng-item-car2">🚗 '+_escHtml(carLabel)+'</div>' : ''}
        <!-- Строка 3: превью + статус + unread -->
        <div class="msng-item-row3">
          <span class="msng-item-preview2">${_escHtml(preview.length>65?preview.slice(0,65)+'…':preview)}</span>
          <div class="msng-item-right-meta">
            <span class="msng-status-pill-sm" style="border-color:${sc}44;color:${sc};background:${sc}15">${_escHtml(sl)}</span>
            ${unread ? '<span class="msng-unread2">'+_escHtml(unread)+'</span>' : ''}
          </div>
        </div>
      </div>
    </div>`;
  }

  function searchChats(q) {
    const role = _role();
    const query = String(q || '').trim().toLowerCase();
    const base = (_isStaffRole(role) && _pageFilter==='open') ? _myChats().filter(c => ['new','process'].includes(c.status || 'new')) : _myChats();
    const filtered = base.filter(c =>
      _safeText(c.clientName).toLowerCase().includes(query) ||
      _safeText(c.masterName).toLowerCase().includes(query) ||
      _safeText(c.orderTitle).toLowerCase().includes(query) ||
      String(c.orderId||'').toLowerCase().includes(query) ||
      _safeText(c.clientPhone).toLowerCase().includes(query) ||
      _safePhone(c.clientPhone).includes(query.replace(/\D/g,'')) ||
      _safeText(c.car).toLowerCase().includes(query)
    );
    const list = document.getElementById('msng-list');
    if (list) list.innerHTML = filtered.map(c => _chatItem(c,role)).join('') ||
      `<div class="msng-empty" style="padding:40px 20px">Ничего не найдено</div>`;
  }

  /* ═══════════════════════
     CHAT — переписка
  ═══════════════════════ */
  function openChat(chatId, opts) {
    mount();
    _closeSubPanel();
    _closeFloatingChatWindows();
    _activeChatId = chatId;
    _view = 'chat';
    try { document.querySelectorAll('.bnav-item').forEach(el => el.classList.toggle('active', el.dataset.page === 'messages' || el.dataset.page === 'chats')); } catch(_e) {}
    const role = _role();
    _withActionBusy('open', chatId, () => Promise.resolve(DB.Chats.markRead(chatId, role)).catch(()=>{}));
    _ensureChatHistory(chatId);
    updateBadge();
    // конкретный чат — это отдельное URL-состояние.
    // Теперь клик по чату пишет #messages:<chatId>, а прямой URL восстанавливает окно.
    try {
      const nextHash = '#messages:chat:' + encodeURIComponent(String(chatId || ''));
      if (opts?.updateUrl !== false && chatId && location.hash !== nextHash) {
        history.pushState({ messengerChat:true, chatId:String(chatId), route:'messages-chat' }, '', nextHash);
      }
    } catch(_e) {}
    open(chatId);
  }

  function _ensureChatHistory(chatId, opts={}) {
    const cid = String(chatId || '').trim();
    if (!cid || !window.DB?.Messages?.sync) return Promise.resolve(DB.Messages.get(cid));
    const now = Date.now();
    const last = Number(_historySyncedAt.get(cid) || 0);
    const local = DB.Messages.get(cid);
    // не долбим сервер повторными messages.get после клика + db.pull.
    // Если история уже есть и последний sync был недавно, просто рендерим локальные данные.
    if (!opts.force && now - last < 30000) return Promise.resolve(local);
    if (_historySyncing.has(cid)) return Promise.resolve(local);
    _historySyncing.add(cid);
    _historySyncedAt.set(cid, now);
    return Promise.resolve(DB.Messages.sync(cid, { force: !!opts.force }))
      .then((rows) => {
        if (_activeChatId === cid && _view === 'chat') _renderChat(cid);
        if (_routeChatId() === cid) updateBadge();
        return rows;
      })
      .catch((_e) => DB.Messages.get(cid))
      .finally(() => { _historySyncing.delete(cid); });
  }

  function _renderMessagesContent(chat, msgs, role) {
    const chatId = String(chat?.id || chat?.chatId || _activeChatId || '').trim();
    const rows = Array.isArray(msgs) ? msgs : [];
    const isLoading = !!chatId && _historySyncing.has(chatId) && rows.length === 0;
    if (isLoading) {
      return `
        <div class="msng-chat-state msng-chat-state--loading" role="status" aria-live="polite">
          <div class="msng-chat-state__loader"><span></span><span></span><span></span></div>
          <div class="msng-chat-state__title">Загружаем историю чата</div>
          <div class="msng-chat-state__text">Проверяем сохранённые сообщения и вложения по этой заявке.</div>
          <div class="msng-chat-skeleton"><i></i><i></i><i></i></div>
        </div>`;
    }
    if (!rows.length) {
      return `
        <div class="msng-chat-state msng-chat-state--empty">
          <div class="msng-chat-state__icon">💬</div>
          <div class="msng-chat-state__title">Сообщений пока нет</div>
          <div class="msng-chat-state__text">Это новый чат. Напишите первое сообщение, прикрепите фото или видео — история сохранится здесь.</div>
        </div>`;
    }
    return rows.map(m => _renderMsg(m, role)).join('');
  }

  function _renderChat(chatId) {
    const chat = DB.Chats.get(chatId);
    if (!chat) { _renderList(); return; }
    const role = _role();
    const msgs = DB.Messages.get(chatId);
    let header = document.getElementById('msng-header');
    let body   = document.getElementById('msng-body');
    if (!header || !body) {
      mount();
      header = document.getElementById('msng-header');
      body   = document.getElementById('msng-body');
    }
    if (!header||!body) return;

    const type = _orderType(chat);
    const sc = _statusColor(chat.status);
    const sl = _statusLabel(chat.status, type);
    const isDirect = String(chat.chatType || '') === 'direct';
    const interName = isDirect
      ? _safeText(chat.peerName || chat.title, 'Собеседник')
      : _safeText(role==='client' ? chat.masterName : chat.clientName, role==='client' ? 'Мастер' : 'Клиент');
    const interInit = isDirect
      ? _safeText(chat.peerInitials || (interName||'?').slice(0,2).toUpperCase(), 'С')
      : _safeText(role==='client' ? chat.masterInit : chat.clientInit, role==='client' ? 'М' : 'К');
    const loyaltyProfile = _loyaltyProfileByPhone(chat.clientPhone);

    const order = DB.Orders.get(chat.orderId);
    const svcNames = _safeText(order?.serviceNames || order?.notes || chat.orderTitle || '', '');
    const carLabel  = _safeText(order?.clientCar || chat.car || '', '');
    const ordNum    = chat.orderId ? '#' + String(chat.orderId).slice(-6) : '';
    // Услуги чата
    const _cSvcIds = Array.isArray(chat.serviceIds) ? chat.serviceIds : [];
    const _cSvcs = _cSvcIds.map(id => window.DB?.Services?.get?.(id)).filter(Boolean);
    const _cCats = window.getClientHomeCategoryDefs ? window.getClientHomeCategoryDefs() : [];
    const _cCatDef = _cCats.find(x=>x.id===chat.category)||null;
    const _cChips = _cSvcs.map(s=>'<button class="msng-svc-chip" data-svc-id="'+_escAttr(s.id)+'" onclick="openServiceDetailsModal(this.dataset.svcId)" title="Карточка услуги">'+_escHtml(s.icon||'🔧')+' '+_escHtml(s.name||'')+'</button>').join('');
    const _cCatChip = _cCatDef&&!_cChips?'<button class="msng-svc-chip msng-svc-chip--cat" style="--cc:'+_escAttr(_cCatDef.color)+'">'+_escHtml(_cCatDef.icon)+' '+_escHtml(_cCatDef.label)+'</button>':'';
    const _cSvcBar = (_cChips||_cCatChip)?'<div class="msng-svc-bar">'+(_cChips||_cCatChip)+'</div>':'';
    header.innerHTML = `
    <div class="msng-chat-header2">
      <button class="msng-back-btn msng-back-btn2" onclick="Messenger.close()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="msng-chat-av2" style="background:${role==='client'?'rgba(52,211,153,.15)':'rgba(255,107,0,.15)'};border-color:${role==='client'?'#34d39966':'#ff6b0066'}">
        ${_escHtml(interInit)}${chat.status==='process'?'<span class="msng-av2-dot"></span>':''}
      </div>
      <div class="msng-chat-info2">
        <div class="msng-chat-name2">${_escHtml(interName)}</div>
        <div class="msng-chat-sub2">
          ${ordNum?`<span class="msng-order-chip">${_escHtml(ordNum)}</span>`:''}
          ${svcNames?`<span>${_escHtml(svcNames.slice(0,40))}</span>`:''}
          <span class="msng-status-pill" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${_escHtml(sl)}</span>
        </div>
        ${carLabel?`<div class="msng-chat-car2">🚗 ${_escHtml(carLabel)}</div>`:''}
      </div>
      <div class="msng-chat-actions2">
        <button class="msng-hd-btn2" onclick="Messenger.toggleChatSearch()" title="Поиск по сообщениям" aria-label="Поиск по сообщениям">🔎</button>
        ${chat.clientPhone?`<a href="tel:${_escAttr(chat.clientPhone)}" class="msng-hd-btn2" title="Позвонить">📞</a>`:''}
        ${chat.orderId?(role==='master'||role==='sto'||role==='admin'||role==='owner'
          ?`<button class="msng-hd-btn2" onclick="Messenger.showOrderCard(${_jsArg(chatId)})" title="Детали заявки">📋</button>`
          :`<button class="msng-hd-btn2" onclick="window.openClientOrderModal&&openClientOrderModal(${_jsArg(chat.orderId)})" title="Моя заявка">📋</button>`):''}
      </div>
    </div>
    ${chat.orderId ? _renderTracker(chat) : ''}
    ${_cSvcBar}`;
    body.innerHTML = `
      ${_renderChatSearchBar()}
      <div class="msng-messages" id="msng-msgs">${_renderMessagesContent(chat, msgs, role)}</div>
      ${_renderInput(chat,role)}`;

    setTimeout(() => {
      const el = document.getElementById('msng-input-'+chatId);
      if (el) _autoGrow(el);
      _scrollMessagesToBottom();
    }, 50);
  }


  function _renderChatSearchBar() {
    if (!_chatSearch.open) return '';
    const count = _chatSearch.matches.length;
    const pos = count && _chatSearch.index >= 0 ? (_chatSearch.index + 1) + ' из ' + count : (count ? count + ' найдено' : 'Нет совпадений');
    return `<div class="msng-chat-search" role="search">
      <span class="msng-chat-search__ico">🔎</span>
      <input id="msng-chat-search-input" value="${_escAttr(_chatSearch.query)}" placeholder="Поиск в переписке" oninput="Messenger.searchInChat(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Messenger.nextChatSearch(event.shiftKey?-1:1)}if(event.key==='Escape'){Messenger.closeChatSearch()}" />
      <span class="msng-chat-search__count">${_escHtml(pos)}</span>
      <button type="button" onclick="Messenger.nextChatSearch(-1)" ${count?'':'disabled'} aria-label="Предыдущее">↑</button>
      <button type="button" onclick="Messenger.nextChatSearch(1)" ${count?'':'disabled'} aria-label="Следующее">↓</button>
      <button type="button" onclick="Messenger.closeChatSearch()" aria-label="Закрыть поиск">✕</button>
    </div>`;
  }

  function toggleChatSearch() {
    _chatSearch.open = !_chatSearch.open;
    if (!_chatSearch.open) _chatSearch = { open:false, query:'', matches:[], index:-1 };
    _renderChat(_activeChatId);
    setTimeout(() => document.getElementById('msng-chat-search-input')?.focus(), 30);
  }
  function closeChatSearch() {
    _chatSearch = { open:false, query:'', matches:[], index:-1 };
    document.querySelectorAll('.msng-msg.is-search-match,.msng-msg.is-search-current').forEach(el=>el.classList.remove('is-search-match','is-search-current'));
    if (_activeChatId) _renderChat(_activeChatId);
  }
  function searchInChat(query) {
    _chatSearch.query = String(query || '');
    const q = _chatSearch.query.trim().toLowerCase();
    const rows = q ? (DB.Messages.get(_activeChatId)||[]).filter(m => String(m.text || m.fileName || m.replyToText || '').toLowerCase().includes(q) && m.type !== 'deleted') : [];
    _chatSearch.matches = rows.map(m=>String(m.id||'')).filter(Boolean);
    _chatSearch.index = _chatSearch.matches.length ? 0 : -1;
    _applyChatSearchHighlights();
    const countEl=document.querySelector('.msng-chat-search__count');
    if(countEl) countEl.textContent=_chatSearch.matches.length ? '1 из '+_chatSearch.matches.length : 'Нет совпадений';
  }
  function _applyChatSearchHighlights() {
    document.querySelectorAll('.msng-msg.is-search-match,.msng-msg.is-search-current').forEach(el=>el.classList.remove('is-search-match','is-search-current'));
    _chatSearch.matches.forEach(id=>document.getElementById('msng-msg-'+id)?.classList.add('is-search-match'));
    const id=_chatSearch.matches[_chatSearch.index];
    const el=id?document.getElementById('msng-msg-'+id):null;
    if(el){el.classList.add('is-search-current');el.scrollIntoView({behavior:'smooth',block:'center'});}
  }
  function nextChatSearch(direction) {
    const n=_chatSearch.matches.length; if(!n) return;
    _chatSearch.index=(_chatSearch.index+(Number(direction)||1)+n)%n;
    _applyChatSearchHighlights();
    const countEl=document.querySelector('.msng-chat-search__count');
    if(countEl) countEl.textContent=(_chatSearch.index+1)+' из '+n;
  }
  async function copyMessage(messageId) {
    const row=(DB.Messages.get(_activeChatId)||[]).find(m=>String(m.id||'')===String(messageId||''));
    const text=String(row?.text || row?.fileName || '').trim();
    if(!text) return;
    try{await navigator.clipboard.writeText(text);window.showToast?.('Сообщение скопировано','success');}
    catch(_e){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();window.showToast?.('Сообщение скопировано','success');}
  }

  function _renderTracker(chat) {
    const order = DB.Orders.get(chat.orderId);
    if (order?.type === 'parts_request') {
      const status = order.status || chat.status || 'new';
      const label = _statusLabel(status, 'parts_request');
      return `<div class="msng-tracker"><div class="msng-track-step done current"><div class="msng-track-dot">📦</div><div class="msng-track-label">${_escHtml(label)}</div></div></div>`;
    }
    const steps = [
      {id:'accepted',ico:'📝',label:'Принято'},
      {id:'started', ico:'🔧',label:'В работе'},
      {id:'quality', ico:'🔬',label:'Проверка'},
      {id:'done',    ico:'✅',label:'Готово'},
    ];
    const doneIds = (order?.stages||[]).map(s=>s.id);
    const curIdx = steps.reduce((acc,s,i)=>doneIds.includes(s.id)?i:acc,-1);
    return `<div class="msng-tracker">
      ${steps.map((s,i)=>`
        <div class="msng-track-step ${i<=curIdx?'done':''} ${i===curIdx?'current':''}">
          <div class="msng-track-dot">${i<=curIdx?s.ico:'·'}</div>
          <div class="msng-track-label">${s.label}</div>
          ${i<steps.length-1?'<div class="msng-track-line"></div>':''}
        </div>`).join('')}
    </div>`;
  }

  function _renderMsg(m, role) {
    const isMine = _isOwnMessage(m, role);

    if (m.type==='event') return `<div class="msng-msg-event"><span>${_escHtml(m.text || '')}</span></div>`;
    if (m.type==='stage') return `<div class="msng-msg-stage">
      <span class="msng-stage-ico">${_escHtml(_safeText(m.stageIco,'📍'))}</span>
      <div><div class="msng-stage-label">${_escHtml(_safeText(m.stageLabel, m.text || 'Этап обновлён'))}</div><div class="msng-stage-time">${_escHtml(_safeText(m.time,''))}</div></div>
    </div>`;
    if (m.type==='report') return `<div class="msng-msg-report">
      <div class="msng-report-head">📋 Отчёт ${m.actorRole==='sto'||m.from==='sto'?'СТО':'мастера'}</div>
      <div class="msng-report-text">${_escHtml(_safeText(m.text,'Отчёт без текста'))}</div>
      ${m.parts?`<div class="msng-report-parts">🔩 Запчасти: ${_escHtml(m.parts)}</div>`:''}
      ${m.nextStep?`<div class="msng-report-next">→ ${_escHtml(m.nextStep)}</div>`:''}
      <div class="msng-report-time">${_escHtml(m.time || '')}</div>
    </div>`;
    if (m.type==='file') {
      const isImg = m.fileType==='image';
      const isVideo = m.fileType==='video';
      const isAudio = m.fileType==='audio';
      const safeMsgId = _jsArg(m.id || '');
      const safeChatId = _jsArg(_activeChatId || '');
      const safeName = _escHtml(m.fileName || (isImg ? 'Фото' : isVideo ? 'Видео' : isAudio ? 'Голосовое' : 'Файл'));
      if (isAudio) {
        return `<div class="msng-msg ${isMine?'mine':'theirs'}">
          <div class="msng-bubble msng-audio-bubble">
            <div class="msng-audio-row">
              <span class="msng-file-ico">🎙️</span>
              <audio controls src="${_escAttr(_safeMediaSrc(m.fileUrl||m.fileData||''))}"><source src="${_escAttr(_safeMediaSrc(m.fileUrl||m.fileData||''))}" type="audio/webm"></audio>
            </div>
            <div class="msng-file-caption">${safeName}</div>
          </div>
          <div class="msng-msg-time">${_escHtml(m.time||'')}${isMine?' ✓✓':''}</div>
        </div>`;
      }
      if (isImg || isVideo) {
        const mediaSrc = _safeMediaSrc(m.fileUrl || m.fileThumb || m.fileData || '');
        const mediaPreview = isImg
          ? `<img src="${_escAttr(mediaSrc)}" class="msng-img-preview" alt="${_escAttr(m.fileName||'фото')}"/>`
          : `<div class="msng-video-preview"><video muted playsinline preload="metadata" src="${_escAttr(mediaSrc)}"></video><span class="msng-video-play">▶</span></div>`;
        return `<div class="msng-msg ${isMine?'mine':'theirs'}">
          <button type="button" class="msng-bubble file-bubble msng-media-bubble" onclick="Messenger.openFile(${safeMsgId},${safeChatId})" aria-label="Открыть ${isImg?'фото':'видео'}">
            ${mediaPreview}
            <span class="msng-file-caption">${safeName}</span>
          </button>
          <div class="msng-msg-time">${_escHtml(m.time||'')}${isMine?' ✓✓':''}</div>
        </div>`;
      }
      return `<div class="msng-msg ${isMine?'mine':'theirs'}">
        <button type="button" class="msng-bubble file-bubble" onclick="Messenger.openFile(${safeMsgId},${safeChatId})" aria-label="Открыть файл">
          <div class="msng-file-row"><span class="msng-file-ico">📎</span><span class="msng-file-name">${safeName}</span></div>
        </button>
        <div class="msng-msg-time">${_escHtml(m.time||'')}${isMine?' ✓✓':''}</div>
      </div>`;
    }
    if (m.type==='deleted') return `<div class="msng-msg ${isMine?'mine':'theirs'} msng-msg--deleted"><div class="msng-bubble">Сообщение удалено</div><div class="msng-msg-time">${_escHtml(m.time || '')}</div></div>`;
    const reply = m.replyToId ? `<button type="button" class="msng-reply-quote" onclick="Messenger.scrollToMessage(${_jsArg(m.replyToId)})"><strong>${_escHtml(m.replyToAuthor||'Сообщение')}</strong><span>${_escHtml(m.replyToText||'')}</span></button>` : '';
    const edited = m.editedAt ? '<span class="msng-edited">изменено</span>' : '';
    const actions = `<div class="msng-message-actions"><button type="button" onclick="Messenger.replyToMessage(${_jsArg(m.id||'')})" title="Ответить">↩</button><button type="button" onclick="Messenger.copyMessage(${_jsArg(m.id||'')})" title="Копировать">⧉</button>${isMine?`<button type="button" onclick="Messenger.editMessage(${_jsArg(m.id||'')})" title="Изменить">✎</button><button type="button" onclick="Messenger.deleteMessage(${_jsArg(m.id||'')})" title="Удалить">🗑</button>`:''}</div>`;
    return `<div class="msng-msg ${isMine?'mine':'theirs'}" id="msng-msg-${_escAttr(m.id||'')}">
      ${actions}<div class="msng-bubble">${reply}<span class="msng-text-body">${_escHtml(m.text || '')}</span></div>
      <div class="msng-msg-time">${edited}${_escHtml(m.time || '')}${isMine?' ✓✓':''}</div>
    </div>`;
  }

  function _renderInput(chat, role) {
    const type = _orderType(chat);
    const closed = chat.status==='done'&&role!=='admin'&&role!=='owner';
    if (closed) return `<div class="msng-input-area closed">
      <div class="msng-closed-note">✅ ${type==='parts_request'?'Запрос запчастей обработан':'Заявка выполнена'} — чат завершён</div>
      <button class="btn btn-outline" style="font-size:12px;padding:7px 14px" onclick="App.go('${type==='parts_request'?'parts':'booking'}')">${type==='parts_request'?'Новый запрос':'Новая запись'}</button>
    </div>`;

    if (role==='master'||role==='sto'||role==='admin'||role==='owner') {
      return `<div class="msng-input-area">
        <div class="msng-quick-actions">
          ${type==='parts_request' ? `<button class="msng-qa-btn" onclick="Messenger.sendPartsUpdate(${_jsArg(chat.id)})">📦 Обновление</button>` : `<button class="msng-qa-btn" onclick="Messenger.showStagePanel(${_jsArg(chat.id)})">📍 Этап</button><button class="msng-qa-btn" onclick="Messenger.showReportPanel(${_jsArg(chat.id)})">📋 Отчёт</button>`}
          <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachFile(${_jsArg(chat.id)},'image')" title="Фото из галереи">📸 <span>Фото</span></button>
          <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachMedia(${_jsArg(chat.id)},'camera')" title="Сделать фото">📷 <span>Камера</span></button>
          <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachMedia(${_jsArg(chat.id)},'video')" title="Видео">🎥 <span>Видео</span></button>
          <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachFile(${_jsArg(chat.id)},'file')" title="Файл">📎 <span>Файл</span></button>
          <button class="msng-qa-btn msng-qa-voice" onclick="Messenger.startVoice(${_jsArg(chat.id)})" title="Голосовое сообщение">🎙️</button>
        </div>
        <div class="msng-input-row">
          <textarea class="msng-textarea" id="msng-input-${_escAttr(chat.id)}" placeholder="Написать сообщение..." rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Messenger.sendMsg('${_escAttr(chat.id)}')}"
            oninput="Messenger.autoGrow(this);Messenger.saveDraft('${_escAttr(chat.id)}',this.value)"
            onblur="Messenger.saveDraft('${_escAttr(chat.id)}',this.value)">${_escHtml(_loadDraft(chat.id))}</textarea>
          <button class="msng-send-btn" onclick="Messenger.sendMsg(${_jsArg(chat.id)})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>`;
    }
    return `<div class="msng-input-area">
      ${_renderReplyPreview(chat.id)}
      <div class="msng-quick-actions">
        <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachFileClient(${_jsArg(chat.id)},'image')" title="Фото из галереи">📸 <span>Фото</span></button>
        <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachMediaClient(${_jsArg(chat.id)},'camera')" title="Сделать фото">📷 <span>Камера</span></button>
        <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachMediaClient(${_jsArg(chat.id)},'video')" title="Видео">🎥 <span>Видео</span></button>
        <button class="msng-qa-btn msng-qa-btn--media" onclick="Messenger.attachFileClient(${_jsArg(chat.id)},'file')" title="Файл">📎 <span>Файл</span></button>
        <button class="msng-qa-btn msng-qa-voice" onclick="Messenger.startVoiceClient(${_jsArg(chat.id)})" title="Голосовое">🎙️</button>
      </div>
      <div class="msng-input-row">
        <textarea class="msng-textarea" id="msng-input-${_escAttr(chat.id)}" placeholder="Написать мастеру..." rows="1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Messenger.sendMsg('${_escAttr(chat.id)}')}"
          oninput="Messenger.autoGrow(this);Messenger.saveDraft('${_escAttr(chat.id)}',this.value)"
          onblur="Messenger.saveDraft('${_escAttr(chat.id)}',this.value)">${_escHtml(_loadDraft(chat.id))}</textarea>
        <button class="msng-send-btn" onclick="Messenger.sendMsg(${_jsArg(chat.id)})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`;
  }

  function _autoGrow(el) {
    if (!el) return;
    const lh = parseFloat(window.getComputedStyle(el).lineHeight)||20;
    const bx = el.offsetHeight-el.clientHeight;
    const max = Math.round(lh*4+bx+2);
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight,max)+'px';
    el.style.overflowY = el.scrollHeight>max?'auto':'hidden';
  }

  /* ═══════════════════
     SEND MESSAGE
  ═══════════════════ */
  function _renderReplyPreview(chatId){
    if(!_replyState || String(_replyState.chatId)!==String(chatId)) return '';
    return `<div class="msng-reply-preview"><div><strong>Ответ: ${_escHtml(_replyState.author||'Сообщение')}</strong><span>${_escHtml(_replyState.text||'')}</span></div><button type="button" onclick="Messenger.cancelReply()" aria-label="Отменить ответ">×</button></div>`;
  }

  function replyToMessage(messageId){
    const row=DB.Messages.get(_activeChatId).find(m=>String(m.id||'')===String(messageId||''));
    if(!row || row.type==='deleted') return;
    _replyState={chatId:_activeChatId,id:row.id,text:String(row.text||row.fileName||'Вложение').slice(0,180),author:row.authorName||(_isOwnMessage(row,_role())?'Вы':'Собеседник')};
    _renderChat(_activeChatId);
    setTimeout(()=>document.getElementById('msng-input-'+_activeChatId)?.focus(),30);
  }
  function cancelReply(){ _replyState=null; if(_activeChatId) _renderChat(_activeChatId); }
  function scrollToMessage(messageId){ const el=document.getElementById('msng-msg-'+String(messageId||'')); if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('is-highlighted');setTimeout(()=>el.classList.remove('is-highlighted'),1200);} }
  async function editMessage(messageId){
    const row=DB.Messages.get(_activeChatId).find(m=>String(m.id||'')===String(messageId||''));
    if(!row||row.type!=='text') return;
    const value=prompt('Изменить сообщение',String(row.text||''));
    if(value===null||!value.trim()||value.trim()===String(row.text||'')) return;
    try{await DB.Messages.update(_activeChatId,messageId,value.trim());_renderChat(_activeChatId);}catch(e){window.showToast?.(e?.message||'Не удалось изменить сообщение','error');}
  }
  async function deleteMessage(messageId){
    if(!confirm('Удалить это сообщение?')) return;
    try{await DB.Messages.delete(_activeChatId,messageId);_renderChat(_activeChatId);_refreshPageListSoft();}catch(e){window.showToast?.(e?.message||'Не удалось удалить сообщение','error');}
  }

  async function sendMsg(chatId) {
    const input = document.getElementById('msng-input-'+chatId);
    if (!input||!input.value.trim()) return;
    if (input.dataset.sending === '1') return;
    const text = input.value.trim();
    _saveDraft(chatId, text);
    input.value = ''; _autoGrow(input);
    input.dataset.sending = '1';
    const role = _role();
    const from = role==='client' ? 'client' : (role==='sto' ? 'sto' : (role==='admin' ? 'admin' : (role==='owner' ? 'owner' : 'master')));
    try {
      const payload={ from, text, time:_now(), type:'text' };
      if(_replyState && String(_replyState.chatId)===String(chatId)){Object.assign(payload,{replyToId:_replyState.id,replyToText:_replyState.text,replyToAuthor:_replyState.author});}
      const msg = await DB.Messages.add(chatId, payload);
      _replyState=null;
      _clearDraft(chatId);
      window._haptic?.('light');
      _appendMsg(msg, role);
      _scrollMessagesToBottom();
      _refreshPageListSoft();
      // AI auto-reply for client messages
      if (from==='client') {
        setTimeout(async () => {
          _showTyping();
          const reply = await _aiReply(chatId, text);
          _hideTyping();
          const replyMsg = { id:'local_'+Date.now(), chatId, from:'master', text:reply, time:_now(), type:'text', localOnly:true };
          if (_activeChatId===chatId) _appendMsg(replyMsg, role);
        }, 1200);
      }
    } catch (e) {
      input.value = text;
      _autoGrow(input);
      _saveDraft(chatId, text);
      if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось отправить сообщение', 'error');
    } finally {
      delete input.dataset.sending;
    }
  }

  function _appendMsg(msg, role) {
    const msgs = document.getElementById('msng-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.innerHTML = _renderMsg(msg, role);
    while (div.firstChild) msgs.appendChild(div.firstChild);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function _refreshPageListSoft() {
    try {
      const listMount = document.getElementById('msng-page-listmount');
      if (listMount) _renderListPage();
    } catch(_e) {}
  }

  async function _aiReply(chatId, userText) {
    const chat = DB.Chats.get(chatId);
    const history = DB.Messages.get(chatId)
      .filter(m=>m.type==='text'&&(m.from==='client'||m.from==='master'))
      .slice(-6)
      .map(m=>({ role:m.from==='client'?'user':'assistant', content:m.text }));
    const system = `Ты — ИИ-ассистент автосервиса KARETA.KZ (Усть-Каменогорск, ул. Гоголя 36А).
Отвечаешь от лица мастера. Специализация: генераторы, стартеры, электропроводка, сигнализации.
Отвечай коротко (1–2 предложения), по-русски, дружелюбно.
Прайс: диагностика от 3000₸, генератор от 8000₸, стартер от 6000₸, сигнализация от 18000₸.
Не придумывай конкретные сроки. Если вопрос за пределами компетенции — предложи позвонить.`;
    const proxy = window.KARETA_AI_PROXY;
    if (proxy && String(proxy).startsWith('/')) {
      try {
        const resp = await fetch(proxy, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          credentials:'same-origin',
          body:JSON.stringify({ chatId, system, history, userText, orderId: chat?.orderId || '' })
        });
        if (resp.ok) {
          const data = await resp.json();
          const text = data?.reply || data?.text || data?.message || '';
          if (text) return text;
        }
      } catch(_e) {}
    }
    return _fallback(userText);
  }

  function _fallback(t) {
    const lc=t.toLowerCase();
    if(lc.includes('привет')||lc.includes('здравств'))return'Здравствуйте! Чем могу помочь?';
    if(lc.includes('готов')||lc.includes('когда'))return'Ещё немного, сообщу как только будет готово! 🔧';
    if(lc.includes('цен')||lc.includes('стоим')||lc.includes('сколько'))return'Стоимость уточним после диагностики. Всё в рамках согласованной суммы.';
    if(lc.includes('спасиб'))return'Пожалуйста! Рады помочь 🚗';
    return'Принял, спасибо! Продолжаю работу.';
  }

  function _showTyping() {
    const msgs = document.getElementById('msng-msgs'); if(!msgs)return;
    const div = document.createElement('div');
    div.id='msng-typing'; div.className='msng-msg theirs';
    div.innerHTML=`<div class="msng-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
    msgs.appendChild(div); msgs.scrollTop=msgs.scrollHeight;
  }
  function _hideTyping() { document.getElementById('msng-typing')?.remove(); }

  /* ═══════════════════
     ПРИКРЕПИТЬ ФАЙЛ
  ═══════════════════ */
  let _pendingAttachment = null;

  function _formatFileSize(size) {
    const n = Number(size || 0);
    if (!n) return '0 КБ';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' КБ';
    return (n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1).replace('.0','') + ' МБ';
  }

  function _prepareFileForMessage(file, chatId, from, opts) {
    opts = opts || {};
    return new Promise(function(resolve, reject){
      if (!file) return reject(new Error('Файл не выбран'));
      const maxSize = Math.min(Number(opts.maxSize || 2.5 * 1024 * 1024), 2.5 * 1024 * 1024);
      if (file.size > maxSize) return reject(new Error('Файл слишком большой: максимум ' + _formatFileSize(maxSize)));
      const accepted = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mpeg','application/pdf','text/plain'];
      if (!accepted.includes(String(file.type || '').toLowerCase())) return reject(new Error('Этот тип файла не поддерживается'));
      const reader = new FileReader();
      reader.onerror = function(){ reject(new Error('Не удалось прочитать файл')); };
      reader.onload = function(ev) {
        const data = ev.target.result;
        const mime = file.type || '';
        const isVideo = mime.startsWith('video/');
        const isImg = mime.startsWith('image/');
        const isAudio = mime.startsWith('audio/');
        resolve({
          chatId, from,
          fileName: file.name || (isVideo ? 'video' : isImg ? 'photo' : 'file'),
          fileType: isVideo ? 'video' : isImg ? 'image' : isAudio ? 'audio' : 'file',
          fileThumb: isImg ? data : null,
          fileData: data,
          fileMime: mime,
          fileSize: file.size || 0,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  async function _sendPreparedAttachment(payload) {
    if (!payload || !payload.chatId) throw new Error('Нет файла для отправки');
    return DB.Messages.add(payload.chatId, {
      from: payload.from,
      text: '',
      time: _now(),
      type: 'file',
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileThumb: payload.fileThumb,
      fileData: payload.fileData,
      fileMime: payload.fileMime || '',
      fileSize: payload.fileSize || 0,
    });
  }

  // legacy helper: used by older report/stage flows, now sends through prepared payload
  async function _readFileForMessage(file, chatId, from, opts) {
    const prepared = await _prepareFileForMessage(file, chatId, from, opts);
    return _sendPreparedAttachment(prepared);
  }

  function _attachmentPreviewHtml(payload) {
    if (!payload) return '';
    const name = _escHtml(payload.fileName || 'Файл');
    const size = _escHtml(_formatFileSize(payload.fileSize));
    const previewSrc = _escAttr(_safeMediaSrc(payload.fileData));
    if (payload.fileType === 'image') {
      return `<div class="msng-attach-preview-media"><img src="${previewSrc}" alt="${_escAttr(payload.fileName||'фото')}"></div><div class="msng-attach-preview-meta"><b>${name}</b><span>Фото · ${size}</span></div>`;
    }
    if (payload.fileType === 'video') {
      return `<div class="msng-attach-preview-media"><video src="${previewSrc}" controls playsinline preload="metadata"></video></div><div class="msng-attach-preview-meta"><b>${name}</b><span>Видео · ${size}</span></div>`;
    }
    return `<div class="msng-attach-preview-file"><span>📎</span><div><b>${name}</b><em>Файл · ${size}</em></div></div>`;
  }

  function _openAttachmentPreview(payload) {
    _pendingAttachment = payload;
    const old = document.getElementById('msng-attach-preview-modal');
    if (old) old.remove();
    const label = payload.fileType === 'image' ? '📸 Предпросмотр фото' : payload.fileType === 'video' ? '🎥 Предпросмотр видео' : '📎 Предпросмотр файла';
    const ov = document.createElement('div');
    ov.id = 'msng-attach-preview-modal';
    ov.className = 'msng-attach-preview-modal open';
    ov.innerHTML = `
      <div class="msng-attach-preview-card" role="dialog" aria-modal="true" aria-label="Предпросмотр вложения">
        <div class="msng-attach-preview-head">
          <div><b>${label}</b><span>Проверьте файл перед отправкой</span></div>
          <button type="button" class="msng-media-viewer__close" onclick="Messenger.cancelAttachmentPreview()">✕</button>
        </div>
        <div class="msng-attach-preview-body">${_attachmentPreviewHtml(payload)}</div>
        <div class="msng-attach-preview-actions">
          <button type="button" class="btn btn-outline" onclick="Messenger.cancelAttachmentPreview()">Отмена</button>
          <button type="button" class="btn btn-primary" onclick="Messenger.confirmAttachmentPreview()">Отправить</button>
        </div>
      </div>`;
    ov.addEventListener('click', function(e){ if (e.target === ov) cancelAttachmentPreview(); });
    document.body.appendChild(ov);
    document.body.classList.add('modal-open');
  }

  function cancelAttachmentPreview() {
    _pendingAttachment = null;
    document.getElementById('msng-attach-preview-modal')?.remove();
    document.body.classList.remove('modal-open');
  }

  async function confirmAttachmentPreview() {
    const payload = _pendingAttachment;
    if (!payload) return;
    const btn = document.querySelector('#msng-attach-preview-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Отправка...'; }
    try {
      const msg = await _sendPreparedAttachment(payload);
      const chatId = payload.chatId;
      cancelAttachmentPreview();
      if (_activeChatId === chatId) _appendMsg(msg, _role());
      _refreshPageListSoft();
      if (window.showToast) {
        const ft = String(msg.fileType || 'file');
        window.showToast(ft === 'video' ? '🎥 Видео отправлено' : ft === 'image' ? '📸 Фото отправлено' : '📎 Файл отправлен');
      }
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Отправить'; }
      if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось отправить файл','error');
    }
  }

  function _pickAndSendFile(chatId, accept, capture, from) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '*/*';
    if (capture) input.capture = capture;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    document.body.appendChild(input);
    input.onchange = function() {
      const file = input.files && input.files[0];
      setTimeout(function(){ try { input.remove(); } catch(_e){} }, 250);
      if (!file) return;
      _prepareFileForMessage(file, chatId, from)
        .then(_openAttachmentPreview)
        .catch(function(e){ if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось подготовить файл','error'); });
    };
    input.click();
  }

  /* ═══════════════════
     ПРИКРЕПИТЬ ФАЙЛ
  ═══════════════════ */
  function attachFile(chatId, fileType) {
    const from = _role() === 'client' ? 'client' : 'master';
    _pickAndSendFile(chatId, fileType === 'image' ? 'image/*' : '*/*', '', from);
  }

  /* Прикрепить файл — клиент */
  function attachFileClient(chatId, fileType) {
    _pickAndSendFile(chatId, fileType === 'image' ? 'image/*' : '*/*', '', 'client');
  }

  /* ── Камера / Видео (capture) ── */
  function attachMedia(chatId, mediaType) {
    const from = _role() === 'client' ? 'client' : 'master';
    _pickAndSendFile(chatId, mediaType === 'video' ? 'video/*' : 'image/*', 'environment', from);
  }

  function attachMediaClient(chatId, mediaType) {
    _pickAndSendFile(chatId, mediaType === 'video' ? 'video/*' : 'image/*', 'environment', 'client');
  }

  /* ── Голосовое сообщение (MediaRecorder) ── */
  let _voiceRecorder = null, _voiceChunks = [], _voiceChatId = null, _voiceTimer = null;

  function startVoice(chatId) { _startVoiceRecording(chatId, 'master'); }
  function startVoiceClient(chatId) { _startVoiceRecording(chatId, 'client'); }

  function _startVoiceRecording(chatId, from) {
    if (_voiceRecorder && _voiceRecorder.state === 'recording') {
      _voiceRecorder.stop(); return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      if (window.showToast) window.showToast('Запись голоса не поддерживается в браузере', 'error');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      _voiceChatId = chatId;
      _voiceChunks = [];
      _voiceRecorder = new MediaRecorder(stream);
      _voiceRecorder.ondataavailable = function(e) { if (e.data.size > 0) _voiceChunks.push(e.data); };
      _voiceRecorder.onstop = async function() {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(_voiceChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async function(ev) {
          try {
            const msg = await DB.Messages.add(_voiceChatId, {
              from, text: '', time: _now(), type: 'file',
              fileName: 'voice_' + Date.now() + '.webm',
              fileType: 'audio',
              fileData: ev.target.result,
              fileSize: blob.size,
            });
            if (_activeChatId === _voiceChatId) _appendMsg(msg, _role());
            window._haptic?.('success');
            if (window.showToast) window.showToast('🎙️ Голосовое отправлено');
          } catch(e) { if (window.showToast) window.showToast('Ошибка отправки голосового','error'); }
        };
        reader.readAsDataURL(blob);
        _hideVoiceIndicator();
      };
      _voiceRecorder.start();
      _showVoiceIndicator(chatId);
      if (window.showToast) window.showToast('🎙️ Запись... нажмите снова чтобы отправить');
    }).catch(function() {
      if (window.showToast) window.showToast('Нет доступа к микрофону', 'error');
    });
  }

  function _showVoiceIndicator(chatId) {
    const btn = document.querySelector('.msng-qa-voice');
    if (btn) { btn.style.color = '#ef4444'; btn.style.animation = '_karetaPulse 1s ease-in-out infinite'; btn.title = 'Остановить запись'; }
  }
  function _hideVoiceIndicator() {
    const btn = document.querySelector('.msng-qa-voice');
    if (btn) { btn.style.color = ''; btn.style.animation = ''; btn.title = 'Голосовое сообщение'; }
  }

  /* Просмотр файла */
  function openFile(msgId, chatId) {
    const cid = String(chatId || _activeChatId || '');
    const mid = String(msgId || '');
    const msg = (DB.Messages.get(cid) || []).find(m => String(m.id || '') === mid);
    if (!msg) { if (window.showToast) window.showToast('Файл не найден', 'error'); return; }
    const role = _role();
    const isMine = _isOwnMessage(msg, role);
    const isImg = msg.fileType === 'image';
    const isVideo = msg.fileType === 'video';
    const isMedia = isImg || isVideo;
    const name = _escHtml(msg.fileName || (isImg ? 'Фото' : isVideo ? 'Видео' : 'Файл'));
    const src = _safeMediaSrc(msg.fileUrl || msg.fileData || msg.fileThumb || '');
    const old = document.getElementById('msng-media-viewer');
    if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'msng-media-viewer';
    ov.className = 'msng-media-viewer open';
    ov.innerHTML = `
      <div class="msng-media-viewer__card" role="dialog" aria-modal="true">
        <div class="msng-media-viewer__head">
          <div><b>${isImg?'📸 Фото':isVideo?'🎥 Видео':'📎 Файл'}</b><span>${name}</span></div>
          <button type="button" class="msng-media-viewer__close" onclick="Messenger.closeFileViewer()">✕</button>
        </div>
        <div class="msng-media-viewer__body">
          ${isImg ? `<img src="${_escAttr(src)}" alt="${_escAttr(msg.fileName||'фото')}">` : isVideo ? `<video src="${_escAttr(src)}" controls autoplay playsinline></video>` : `<div class="msng-file-open-card"><span>📎</span><b>${name}</b></div>`}
        </div>
        <div class="msng-media-viewer__actions">
          ${src?`<a class="btn btn-primary" href="${_escAttr(src)}" download="${_escAttr(msg.fileName || 'file')}">⬇ Скачать</a>`:''}
          ${isMine && isMedia ? `<button type="button" class="btn btn-outline msng-media-delete" onclick="Messenger.deleteFileMessage(${_jsArg(cid)},${_jsArg(mid)})">🗑 Удалить</button>` : ''}
          <button type="button" class="btn btn-outline" onclick="Messenger.closeFileViewer()">Закрыть</button>
        </div>
      </div>`;
    ov.addEventListener('click', function(e){ if (e.target === ov) closeFileViewer(); });
    document.body.appendChild(ov);
    document.body.classList.add('modal-open');
  }

  function closeFileViewer() {
    document.getElementById('msng-media-viewer')?.remove();
    document.body.classList.remove('modal-open');
  }

  async function deleteFileMessage(chatId, msgId) {
    const cid = String(chatId || _activeChatId || '');
    const mid = String(msgId || '');
    const msg = (DB.Messages.get(cid) || []).find(m => String(m.id || '') === mid);
    if (!msg) return;
    if (!_isOwnMessage(msg, _role())) { if (window.showToast) window.showToast('Можно удалить только свой файл', 'error'); return; }
    try {
      await DB.Messages.remove(cid, mid);
      closeFileViewer();
      if (_activeChatId === cid) _renderChat(cid);
      if (window.showToast) window.showToast('Файл удалён');
    } catch(e) { if (window.showToast) window.showToast(e?.message || 'Не удалось удалить файл', 'error'); }
  }


  /* ═══════════════════
     ПАНЕЛЬ ЭТАПОВ
  ═══════════════════ */
  function showStagePanel(chatId) {
    const chat = DB.Chats.get(chatId); if(!chat) return;
    const order = chat.orderId ? DB.Orders.get(chat.orderId) : null;
    const doneIds = (order?.stages||[]).map(s=>s.id);

    let el = document.getElementById('stage-panel');
    if (!el) { el=document.createElement('div'); el.id='stage-panel'; el.className='msng-subpanel'; _panelRoot()?.appendChild(el); }
    el.innerHTML = `
      <div class="msng-subpanel-head">
        <div class="msng-subpanel-title">📍 Обновить этап заявки</div>
        <button onclick="Messenger.closeSubPanel()" class="msng-close-btn" style="position:static">×</button>
      </div>
      <div class="msng-subpanel-body">
        ${STAGES.map(s=>`
          <div class="msng-stage-row ${doneIds.includes(s.id)?'done':''}" onclick="Messenger.applyStage(${_jsArg(chatId)},${_jsArg(s.id)},${_jsArg(s.ico)},${_jsArg(s.label)})">
            <span class="msng-stage-ico-big">${s.ico}</span>
            <div><div class="msng-stage-row-label">${s.label}</div><div class="msng-stage-row-desc">${s.desc}</div></div>
            ${doneIds.includes(s.id)?'<span class="msng-stage-done-mark">✓</span>':'<span class="msng-stage-arrow">→</span>'}
          </div>`).join('')}
      </div>`;
    _closeSubPanel();
    el.classList.add('open');
  }

  function applyStage(chatId, stageId, ico, label) {
    const chat = DB.Chats.get(chatId); if(!chat) return;
    _withActionBusy('stage', `${chatId}:${stageId}`, async () => {
      if (chat.orderId) {
        await DB.Orders.addStage(chat.orderId, { id:stageId, icon:ico, label });
      }
      _closeSubPanel();
      const msg = await DB.Messages.add(chatId, { from:'system', text:'Этап выполнен: '+label, stageId, stageLabel:label, stageIco:ico, time:_now(), type:'stage' });
      _appendMsg(msg, _role());
      updateBadge();
      if(window.showToast) window.showToast(`📍 Этап «${label}» добавлен`);
      const chat2 = DB.Chats.get(chatId);
      if (chat2) {
        const header = document.getElementById('msng-header');
        if (header&&chat2.orderId) {
          const trackerEl = header.querySelector('.msng-tracker');
          if (trackerEl) trackerEl.outerHTML = _renderTracker(chat2);
          else header.insertAdjacentHTML('beforeend', _renderTracker(chat2));
        }
      }
      return { ok:true };
    }).catch(function(e){ if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось добавить этап','error'); });
  }

  /* ═══════════════════
     ПАНЕЛЬ ОТЧЁТА
  ═══════════════════ */
  function showReportPanel(chatId) {
    const chat = DB.Chats.get(chatId); if(!chat) return;
    const shopParts = chat.masterId ? (DB.Shop.getByMaster(chat.masterId)?.parts||[]) : [];

    let el = document.getElementById('report-panel');
    if (!el) { el=document.createElement('div'); el.id='report-panel'; el.className='msng-subpanel'; _panelRoot()?.appendChild(el); }
    el.innerHTML = `
      <div class="msng-subpanel-head">
        <div class="msng-subpanel-title">📋 Отчёт о работе</div>
        <button onclick="Messenger.closeSubPanel()" class="msng-close-btn" style="position:static">×</button>
      </div>
      <div class="msng-subpanel-body">
        <div style="margin-bottom:10px">
          <label class="msng-label">Что сделано *</label>
          <textarea id="report-text" class="msng-report-input" placeholder="Опишите выполненные работы..." rows="3"></textarea>
        </div>
        <div style="margin-bottom:10px">
          <label class="msng-label">Использованные запчасти</label>
          <input id="report-parts" class="msng-report-input" placeholder="Щётки GEN-001, реле STA-002..."/>
          ${shopParts.length?`<div class="msng-parts-chips" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
            ${shopParts.map(p=>{const label=`${_safeText(p.name,'')} (${_safeText(p.sku,'')})`;return `<button class="msng-part-chip" data-part-label="${_escAttr(label)}" onclick="document.getElementById('report-parts').value+=(document.getElementById('report-parts').value?', ':'')+this.dataset.partLabel">+${_escHtml(_safeText(p.name,'').slice(0,18))}</button>`;}).join('')}
          </div>`:''}
        </div>
        <div style="margin-bottom:16px">
          <label class="msng-label">Следующий шаг</label>
          <select id="report-next" class="msng-report-input">
            <option value="">— выберите —</option>
            <option>Ожидание запчастей</option>
            <option>Продолжение ремонта</option>
            <option>Готово к выдаче</option>
            <option>Требуется согласование стоимости</option>
          </select>
        </div>
        <div style="margin-bottom:10px">
          <label class="msng-label">Прикрепить фото/файл</label>
          <button class="btn btn-outline" style="width:100%;justify-content:center;font-size:13px;min-height:44px" onclick="Messenger.attachFile(${_jsArg(chatId)},'image')">📸 Прикрепить фото</button>
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:4px" onclick="Messenger.sendReport(${_jsArg(chatId)})">
          Отправить отчёт
        </button>
      </div>`;
    _closeSubPanel();
    el.classList.add('open');
    setTimeout(()=>document.getElementById('report-text')?.focus(), 150);
  }

  function sendReport(chatId) {
    const text  = document.getElementById('report-text')?.value.trim();
    const parts = document.getElementById('report-parts')?.value.trim();
    const next  = document.getElementById('report-next')?.value;
    if (!text) { if(window.showToast) window.showToast('Опишите выполненные работы','error'); return; }

    const chat = DB.Chats.get(chatId); if(!chat) return;

    _withActionBusy('report', chatId, async () => {
      if (chat.orderId) {
        const u = _user();
        await DB.Orders.addReport(chat.orderId, { text, parts:parts||'', nextStep:next||'', masterName: u?.name||'Мастер' });
      }
      _closeSubPanel();
      const msg = await DB.Messages.add(chatId, { from:'system', text, parts:parts||'', nextStep:next||'', time:_now(), type:'report' });
      _appendMsg(msg, _role());
      if(window.showToast) window.showToast('📋 Отчёт отправлен клиенту');
      return { ok:true };
    }).catch(function(e){ if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось отправить отчёт','error'); });
  }

  /* ═══════════════════
     КАРТОЧКА ЗАКАЗА
  ═══════════════════ */
  function showOrderCard(chatId) {
    const chat = DB.Chats.get(chatId); if(!chat) return;
    const order = chat.orderId ? DB.Orders.get(chat.orderId) : null;
    const type = _orderType(chat);
    const sc = _statusColor(chat.status);
    const sl = _statusLabel(chat.status, type);
    const phoneDigits = _safePhone(chat.clientPhone);
    const phoneLabel = _escHtml(_safeText(chat.clientPhone,''));
    const rows = [
      [type==='parts_request'?'📦 Запрос':'🔧 Услуга',chat.orderTitle],
      ['🏷 Тип',_typeLabel(type)],['🚗 Авто',chat.car],['👤 Клиент',chat.clientName],
      ['📞 Телефон',phoneDigits?`<a href="tel:${_escAttr(phoneDigits)}" style="color:var(--orange)">${phoneLabel}</a>`:'—',true],
      [type==='parts_request'?'👤 Ответственный':'👨‍🔧 Мастер',chat.masterName],
      ['💰 Сумма',order?Number(order.price||0).toLocaleString('ru')+' ₸':'—'],
    ];

    let el = document.getElementById('order-card-panel');
    if (!el) { el=document.createElement('div'); el.id='order-card-panel'; el.className='msng-subpanel'; _panelRoot()?.appendChild(el); }
    el.innerHTML = `
      <div class="msng-subpanel-head">
        <div class="msng-subpanel-title">📋 Карточка заявки</div>
        <button onclick="Messenger.closeSubPanel()" class="msng-close-btn" style="position:static">×</button>
      </div>
      <div class="msng-subpanel-body">
        ${chat.orderId?`<div class="msng-card-id">${_escHtml(chat.orderId)}</div>`:''}
        ${rows.map(([k,v,trustedHtml])=>`
          <div class="msng-card-row"><div class="msng-card-key">${_escHtml(k)}</div><div class="msng-card-val">${trustedHtml?v:_escHtml(v||'—')}</div></div>`).join('')}
        <div class="msng-card-row">
          <div class="msng-card-key">📊 Статус</div>
          <span class="msng-status-pill" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${sl}</span>
        </div>
        ${type!=='parts_request'&&order?.stages?.length?`
        <div style="margin-top:12px">
          <div class="msng-label">Этапы работы</div>
          ${order.stages.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px"><span>${_escHtml(s.icon||'')}</span><span>${_escHtml(s.label||'')}</span><span style="margin-left:auto;color:var(--text3)">${_escHtml((s.doneAt||'').slice(11,16))}</span></div>`).join('')}
        </div>`:''}
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          ${phoneDigits?`<a href="tel:${_escAttr(phoneDigits)}" class="btn btn-outline" style="font-size:12px;padding:8px 14px">📞 Позвонить</a>`:''}
          ${order&&order.status!=='done'&&type!=='parts_request'?`<button class="btn btn-primary" style="font-size:12px;padding:8px 14px" onclick="Messenger.showStagePanel(${_jsArg(chatId)})">📍 Этап</button>`:''}
        </div>
      </div>`;
    _closeSubPanel();
    el.classList.add('open');
  }

  function sendPartsUpdate(chatId) {
    const chat = DB.Chats.get(chatId); if(!chat) return;
    const order = chat.orderId ? DB.Orders.get(chat.orderId) : null;
    if (!order || order.type !== 'parts_request') return;
    const statusText = _statusLabel(order.status || chat.status || 'new', 'parts_request');
    _withActionBusy('parts', chatId, async () => {
      const msg = await DB.Messages.add(chatId, { from:'system', text:'Обновление по запчастям: ' + statusText, time:_now(), type:'event' });
      _appendMsg(msg, _role());
      updateBadge();
      if(window.showToast) window.showToast('📦 Обновление по запчастям отправлено');
      return { ok:true };
    }).catch(function(e){ if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось отправить обновление','error'); });
  }

  /* ═══════════════════
     НОВЫЙ ЧАТ (мастер/admin)
  ═══════════════════ */
  function newChat() {
    // Показываем список активных заказов без чата
    const allOrders = DB.Orders.getAll({ status:'new' }).concat(DB.Orders.getAll({ status:'process' }));
    const withChats = new Set(DB.Chats.getAll().map(c=>c.orderId));
    const noChat = allOrders.filter(o => !withChats.has(o.id));

    let el = document.getElementById('newchat-panel');
    if (!el) { el=document.createElement('div'); el.id='newchat-panel'; el.className='msng-subpanel'; _panelRoot()?.appendChild(el); }
    el.innerHTML = `
      <div class="msng-subpanel-head">
        <div class="msng-subpanel-title">✏️ Начать чат по заявке</div>
        <button onclick="Messenger.closeSubPanel()" class="msng-close-btn" style="position:static">×</button>
      </div>
      <div class="msng-subpanel-body">
        ${noChat.length===0 ? '<div style="text-align:center;color:var(--text3);padding:20px">Все активные заявки уже имеют чаты</div>'
          : noChat.map(o=>`<div class="msng-stage-row" onclick="Messenger._startChatFromOrder(${_jsArg(o.id)})">
            <div><div style="font-weight:700;font-size:13px">${o.id} — ${o.clientName}</div><div style="font-size:11px;color:var(--text3)">${o.serviceNames} · ${o.clientCar}</div></div>
            <span class="msng-stage-arrow">→</span>
          </div>`).join('')}
      </div>`;
    _closeSubPanel();
    el.classList.add('open');
  }

  async function _startChatFromOrder(orderId) {
    const order = DB.Orders.get(orderId); if(!order) return;
    const master = order.masterId ? DB.Masters.get(order.masterId) : null;
    try {
      const chat = await DB.Chats.createFromOrder(order, master, { persist:false });
      _closeSubPanel();
      if (chat && chat.id) openChat(chat.id);
    } catch (e) {
      if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось открыть чат по заявке','error');
    }
  }

  function _closeFloatingChatWindows() {
    try {
      document.getElementById('msng-attach-preview-modal')?.remove();
      document.getElementById('msng-media-viewer')?.remove();
    } catch(_e) {}
  }

  function _closeSubPanel() {
    document.querySelectorAll('.msng-subpanel').forEach(p=>p.classList.remove('open'));
  }

  function showLoyaltyProfile(chatId) {
    const chat = DB.Chats.get(chatId || _activeChatId);
    if (!chat) return;
    const profile = _loyaltyProfileByPhone(chat.clientPhone);
    _profilePanelChatId = chat.id;
    let el = document.getElementById('loyalty-profile-panel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loyalty-profile-panel';
      el.className = 'msng-subpanel msng-subpanel--profile';
      _panelRoot()?.appendChild(el);
    }
    const clientName = chat.clientName || 'Клиент';
    const clientPhone = chat.clientPhone || '';
    el.innerHTML = `
      <div class="msng-subpanel-head">
        <div class="msng-subpanel-title">👤 Профиль клиента</div>
        <button class="msng-subpanel-close" onclick="Messenger.closeSubPanel()">✕</button>
      </div>
      <div class="msng-subpanel-body msng-subpanel-body--profile">
        <div class="msng-profile-top">
          <div class="msng-profile-avatar">${(clientName||'?').trim().charAt(0).toUpperCase()}</div>
          <div class="msng-profile-meta">
            <div class="msng-profile-name">${clientName}</div>
            <div class="msng-profile-sub">${clientPhone || 'Телефон не указан'}</div>
            ${chat.car ? `<div class="msng-profile-sub">🚗 ${chat.car}</div>` : ''}
          </div>
        </div>
        ${_renderLoyaltyCard(profile, '')}
      </div>`;
    _closeSubPanel();
    el.classList.add('open');
  }


  /* ═══════════════════
     BADGE
  ═══════════════════ */
  function updateBadge() {
    const count = _totalUnread();
    if (window._appState) window._appState.chatUnread = count;
    // Чат-бейдж теперь на кнопке Заявки/Заказы (bnav-chat-badge)
    const chatBadge = document.getElementById('bnav-chat-badge');
    if (chatBadge) {
      chatBadge.textContent = count > 9 ? '9+' : String(count);
      chatBadge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  /* ─── Public API ─── */
  const pub = {
    mount, open, close, toggle, openChat, openByOrder, renderList: _renderList, renderPage, initPage, searchChatsPage, setPageFilter, togglePageSearch, clearPageSearch, openFirstUrgent,
    searchChats, sendMsg, replyToMessage, cancelReply, scrollToMessage, editMessage, deleteMessage, copyMessage, toggleChatSearch, closeChatSearch, searchInChat, nextChatSearch, autoGrow:_autoGrow, saveDraft:_saveDraft, clearDraft:_clearDraft,
    showStagePanel, applyStage, showReportPanel, sendReport, sendPartsUpdate,
    attachFile, attachFileClient, attachMedia, attachMediaClient, cancelAttachmentPreview, confirmAttachmentPreview, startVoice, startVoiceClient, openFile, closeFileViewer, deleteFileMessage, showOrderCard, newChat, openAdminChat, closeSubPanel:_closeSubPanel, showLoyaltyProfile, syncHistory:_ensureChatHistory,
    updateBadge, getMyChats:_myChats,
    _startChatFromOrder,
  };
  window.Messenger = pub;

  // после позднего DB.pull восстанавливаем прямой чат и его историю.
  try {
    window.DB?.on?.('db.pull', () => {
      const hash = String(location.hash || '').replace(/^#/, '');
      if (hash.startsWith('messages:')) {
        const cid = _routeChatId();
        if (cid) {
          _activeChatId = cid;
          _view = 'chat';
          mount();
          if (!(_isMessagesRoute() && _setMessagesInlineChat(true))) {
            document.getElementById('messenger-overlay')?.classList.add('vis');
            document.getElementById('messenger-panel')?.classList.add('open');
            document.body.classList.add('chat-fullscreen-open');
          }
          _ensureChatHistory(cid).then(() => _renderChat(cid)).catch(() => _renderChat(cid));
          return;
        }
      }
      if (_view === 'chat' && _activeChatId) {
        _ensureChatHistory(_activeChatId).then(() => _renderChat(_activeChatId)).catch(() => _renderChat(_activeChatId));
      } else if (hash === 'messages') {
        _renderListPage();
      }
      updateBadge();
    });
  } catch(_e) {}

  return pub;
})();
