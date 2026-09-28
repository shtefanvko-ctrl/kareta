/* ═══════════════════════════════════════════════════════
   KARETA.KZ — ORDER SYSTEM
   Wizard, Detail Panel, Clients Panel
═══════════════════════════════════════════════════════ */
const OrderSystem = (() => {
  const ALL_STAGES = [
    { id:'accepted',  icon:'📝', label:'Заявка принята' },
    { id:'diagnosed', icon:'🔍', label:'Диагностика завершена' },
    { id:'parts',     icon:'🛒', label:'Запчасти получены' },
    { id:'started',   icon:'🔧', label:'Ремонт начат' },
    { id:'quality',   icon:'🔬', label:'Контроль качества' },
    { id:'done',      icon:'✅', label:'Работа завершена' },
    { id:'delivered', icon:'🚗', label:'Авто выдано клиенту' }
  ];

  const S_LABEL = { new:'Новый', waiting_responses:'Ждёт откликов', process:'В работе', done_pending_client:'Ждёт подтверждения', done:'Выполнен', cancelled:'Отменён', dispute:'Спор' };
  const S_COLOR = { new:'#60a5fa', waiting_responses:'#60a5fa', process:'var(--orange)', done_pending_client:'#f59e0b', done:'#22c55e', cancelled:'#ef4444', dispute:'#ef4444' };
  const LIFECYCLE = () => window.KaretaOrderLifecycle || null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function jsArg(value) {
    return escapeHtml(JSON.stringify(String(value == null ? '' : value)).replace(/[\u2028\u2029]/g, ''));
  }

  function safeAssetUrl(value, allowData = true) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (allowData && /^data:(?:image\/(?:jpeg|png|webp|gif)|video\/(?:mp4|webm)|audio\/(?:webm|ogg|mpeg));base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
    if (/^blob:https?:\/\//i.test(raw)) return raw;
    try {
      const url = new URL(raw, location.origin);
      if (!['http:','https:'].includes(url.protocol)) return '';
      if (url.protocol === 'http:' && url.origin !== location.origin) return '';
      return url.href;
    } catch (_error) { return ''; }
  }

  function safeExternalUrl(value) {
    const raw = String(value == null ? '' : value).trim();
    try { const url = new URL(raw); return ['http:','https:'].includes(url.protocol) ? url.href : ''; }
    catch (_error) { return ''; }
  }

  function safePhone(value) {
    const digits=String(value==null?'':value).replace(/\D/g,'');
    return digits.length>=7&&digits.length<=15?digits:'';
  }

  function safeColor(value) {
    const color=String(value||'').trim();
    return /^(?:#[a-f0-9]{3,8}|(?:rgb|hsl)a?\([0-9.,%\s]+\))$/i.test(color)?color:'#f59e0b';
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
  }

  function fmtPrice(n) {
    return (Number(n)||0).toLocaleString('ru-RU') + ' ₸';
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return d.getDate() + ' ' + months[d.getMonth()] + ', ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function orderTypeLabel(type) {
    return type === 'parts_request' ? 'Запрос запчастей' : 'Обычная заявка';
  }

  function orderStatusLabel(type, status) {
    return LIFECYCLE()?.label?.(status, type) || S_LABEL[status] || status || 'Без статуса';
  }
  function orderStatusColor(status) {
    return LIFECYCLE()?.color?.(status) || S_COLOR[status] || 'var(--text3)';
  }
  function orderStatusIcon(status) {
    return LIFECYCLE()?.icon?.(status) || '📋';
  }
  function orderStatusClass(status) {
    return LIFECYCLE()?.cssClass?.(status) || String(status||'new');
  }
  function isOrderOpen(status) {
    return LIFECYCLE()?.isOpen?.(status) || ['new','waiting_responses'].includes(String(status||''));
  }

  function parsePartsRequestMeta(order) {
    const notes = String(order && order.notes ? order.notes : '');
    const meta = { part:'', comment:'', sku:'', price:'' };
    notes.split(/\r?\n/).forEach(function(line) {
      const row = String(line || '').trim();
      if (!row) return;
      if (row.indexOf('Запрос запчасти:') === 0) meta.part = row.replace('Запрос запчасти:', '').trim();
      else if (row.indexOf('Комментарий:') === 0) meta.comment = row.replace('Комментарий:', '').trim();
      else if (row.indexOf('SKU:') === 0) meta.sku = row.replace('SKU:', '').trim();
      else if (row.indexOf('Цена:') === 0) meta.price = row.replace('Цена:', '').trim();
    });
    if (!meta.part) meta.part = order && order.serviceNames ? String(order.serviceNames).trim() : '';
    return meta;
  }

  function getRole() {
    return (window._appState && window._appState.user && window._appState.user.role) ? window._appState.user.role : 'guest';
  }


  function currentActorId() {
    return Number(window._appState?.user?.id || 0) || 0;
  }

  function adminCanViewOrderPersonal(order, role) {
    if (role === 'owner') return true;
    if (role !== 'admin') return true;
    if (String(order.masterId || '0') !== '0') return true;
    return Number(order.assignedAdminUserId || 0) === currentActorId();
  }

  function maskedOrderValue(order, key, fallback, role) {
    if (adminCanViewOrderPersonal(order, role)) return order[key] || fallback || '—';
    return key === 'clientPhone' ? '' : (fallback || 'Скрыто до взятия заявки в обработку');
  }

  const Wizard = (() => {
    let draft = {};
    let _wizardBusy = false;

    function open(prefill) {
      draft = Object.assign({
        type:'service_order', serviceIds:[], serviceNames:'', date:'', time:'', priority:'normal',
        clientId:'', clientName:'', clientPhone:'', clientCar:'', masterId:'', notes:''
      }, prefill || {});
      ensure();
      render();
      if (window.App?.LayerManager && !window.App.LayerManager.open('order-wizard') && window.App.LayerManager.isOpen('order-wizard')) return;
      const root = document.getElementById('order-wizard');
      if (root) root.classList.add('open');
    }

    function close() {
      if (window.__closeLayeredModal) window.__closeLayeredModal('order-wizard','order-wizard');
      else {
        const root = document.getElementById('order-wizard');
        if (root) root.classList.remove('open');
        try{ window.App?.LayerManager?.close('order-wizard'); }catch(_e){}
      }
    }

    function ensure() {
      if (document.getElementById('order-wizard')) return;
      const el = document.createElement('div');
      el.id = 'order-wizard';
      el.className = 'owiz-overlay';
      el.innerHTML = '<div class="owiz-box"><div id="owiz-inner"></div></div>';
      el.addEventListener('click', function(e){ if (e.target === el) close(); });
      document.body.appendChild(el); setTimeout(()=>{try{window.applyPhoneMasks(el);}catch(_e){}},30);
    }

    function render() {
      const inner = document.getElementById('owiz-inner');
      if (!inner) return;
      const services = (window.DB && DB.Services && DB.Services.getAll) ? DB.Services.getAll() : [];
      inner.innerHTML = `
        <div class="owiz-head">
          <div class="owiz-title">Новая заявка</div>
          <button class="owiz-close" onclick="OrderSystem.Wizard.close()">×</button>
        </div>
        <div class="owiz-form">
          <div class="owiz-field">
            <label>Услуги</label>
            <div class="owiz-svc-grid">
              ${services.map(function(s){
                const on = (draft.serviceIds||[]).indexOf(s.id) !== -1;
                return `<button type="button" class="owiz-svc-chip ${on?'active':''}" onclick="OrderSystem.Wizard.toggleService(${jsArg(s.id)})"><span class="owiz-svc-name">${escapeHtml(s.name)}</span><span class="owiz-svc-price">${fmtPrice(s.basePrice||0)}</span></button>`;
              }).join('') || '<div style="font-size:13px;color:var(--text3)">Услуги не настроены</div>'}
            </div>
          </div>
          <div class="owiz-field"><label>Дата</label><input id="ow-date" class="owiz-input" type="date" value="${escapeHtml(draft.date||'')}"></div>
          <div class="owiz-field"><label>Время</label><input id="ow-time" class="owiz-input" type="time" value="${escapeHtml(draft.time||'')}"></div>
          <div class="owiz-field"><label>Имя</label><input id="ow-client-name" class="owiz-input" type="text" value="${escapeHtml(draft.clientName||'')}"></div>
          <div class="owiz-field"><label>Телефон</label><input id="ow-client-phone" class="owiz-input" type="tel" value="${escapeHtml(draft.clientPhone||'')}" placeholder="+7 (___) ___ __ __" inputmode="numeric" onfocus="if(!this.value)this.value='+7 '" oninput="if(window.App?.phoneInputHandler)App.phoneInputHandler({target:this})"></div>
          <div class="owiz-field"><label>Автомобиль</label><input id="ow-client-car" class="owiz-input" type="text" value="${escapeHtml(draft.clientCar||'')}"></div>
          <div class="owiz-field"><label>Комментарий</label><textarea id="ow-notes" class="owiz-input" rows="3">${escapeHtml(draft.notes||'')}</textarea></div>
        </div>
        <div class="owiz-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn btn-outline" onclick="OrderSystem.Wizard.close()">Отмена</button>
          <button class="btn btn-primary" onclick="OrderSystem.Wizard.submit()">Создать заявку</button>
        </div>`;
    }

    function toggleService(id) {
      const list = Array.isArray(draft.serviceIds) ? draft.serviceIds.slice() : [];
      const idx = list.indexOf(id);
      if (idx === -1) list.push(id); else list.splice(idx,1);
      draft.serviceIds = list;
      render();
    }

    async function submit() {
      if (_wizardBusy) return;
      draft.date = (document.getElementById('ow-date')||{}).value || '';
      draft.time = (document.getElementById('ow-time')||{}).value || '';
      draft.clientName = (document.getElementById('ow-client-name')||{}).value || '';
      draft.clientPhone = window.App?.phoneRaw ? App.phoneRaw((document.getElementById('ow-client-phone')||{}).value||'') : ((document.getElementById('ow-client-phone')||{}).value||'').replace(/[^\d+]/g,'');
      draft.clientCar = (document.getElementById('ow-client-car')||{}).value || '';
      draft.notes = (document.getElementById('ow-notes')||{}).value || '';
      if (!draft.clientName) { if(window.showToast) showToast('Укажите имя клиента','error'); document.getElementById('ow-client-name')?.focus(); return; }
      if (!draft.clientPhone || draft.clientPhone.replace(/\D/g,'').length < 10) { if(window.showToast) showToast('Укажите корректный телефон','error'); document.getElementById('ow-client-phone')?.focus(); return; }
      if (!draft.date) { if(window.showToast) showToast('Укажите дату','error'); document.getElementById('ow-date')?.focus(); return; }
      const submitBtn = document.querySelector('#order-wizard .btn-primary[onclick*="submit"]') || document.querySelector('#owiz-inner .btn-primary:last-child');
      _wizardBusy = true;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Создаём...'; submitBtn.style.pointerEvents = 'none'; }
      try {
        if (!draft.clientId) {
          // Сначала ищем существующего клиента по телефону — не создаём вслепую
          const _existCl = (DB.Clients && DB.Clients.getByPhone) ? DB.Clients.getByPhone(draft.clientPhone) : null;
          if (_existCl && _existCl.id) {
            draft.clientId = _existCl.id;
          } else if (DB.Clients && DB.Clients.create) {
            try {
              const client = await DB.Clients.create({ name:draft.clientName, phone:draft.clientPhone, car:draft.clientCar });
              if (client && client.id) draft.clientId = client.id;
            } catch(_dupE) {
              // race: повторно ищем после ошибки создания
              const _retryC = (DB.Clients && DB.Clients.getByPhone) ? DB.Clients.getByPhone(draft.clientPhone) : null;
              if (_retryC && _retryC.id) draft.clientId = _retryC.id;
            }
          }
        }
        const order = await DB.Orders.create(draft);
        if (order && !order.chatId && window.DB?.Chats?.createFromOrder) {
          try {
            const _master = order.masterId && String(order.masterId||'0') !== '0' ? (DB.Masters.get(order.masterId) || null) : null;
            const _chat = await DB.Chats.createFromOrder(order, _master, { persist:false });
            if (_chat) { order.chatId = _chat.id; order.chat = _chat; }
          } catch(_e) {}
        }
        close();
        if (window.showToast) showToast('✅ Заявка ' + (order?.id||'') + ' создана');
        if (window.Admin) { try { Admin.showPane('orders'); } catch(e){} }
        if (order && order.id && window.OrderSystem && window.OrderSystem.Detail) {
          setTimeout(function(){ try { OrderSystem.Detail.open(order.id); } catch(e){} }, 80);
        }
      } catch (e) {
        if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось создать заявку', 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Создать заявку'; submitBtn.style.pointerEvents = ''; }
      } finally {
        _wizardBusy = false;
      }
    }

    return { open, close, render, toggleService, submit };
  })();

  const Detail = (() => {
    let currentId = '';
    let _statusBusy = false;
    let _assignBusy = false;
    let _stageBusy = false;
    let _reportBusy = false;
    let _deleteBusy = false;

    function _setDetailBusy(kind, state) {
      const root = document.getElementById('odet-panel-inner');
      if (!root) return;
      const selectors = kind === 'status'
        ? ['.odet-status-btns .odet-st-btn']
        : kind === 'assign'
          ? ['.odet-masters-row .odet-master-chip']
          : kind === 'stage'
            ? ['.odet-tl-body .btn.btn-outline[onclick*="Detail.addStage"]']
            : kind === 'report'
              ? ['#odet-toggle-report-btn', '#odet-save-report-btn', '#odet-report-photos']
              : ['.odet-delete-btn'];
      selectors.forEach(function(sel){
        root.querySelectorAll(sel).forEach(function(el){
          if (state) el.classList.add('is-busy');
          else el.classList.remove('is-busy');
          if ('disabled' in el) el.disabled = !!state;
          el.style.pointerEvents = state ? 'none' : '';
          el.style.opacity = state ? '0.65' : '';
        });
      });
    }

    function _resolveOrderForStageWall(orderId) {
      if (!window.DB?.Orders?.get) return null;
      return DB.Orders.get(orderId) || null;
    }

    if (typeof window.openOrderStageWallModal !== 'function') {
      // Стена этапов удалена — заглушка чтобы старые вызовы не падали
      window.openOrderStageWallModal = function() {};
    }

    function ensure() {
      if (document.getElementById('odet-panel')) return;
      const el = document.createElement('div');
      el.id = 'odet-panel';
      el.className = 'owiz-overlay';
      el.innerHTML = '<div class="owiz-box" style="max-width:760px"><div id="odet-panel-inner" class="odet-panel"></div></div>';
      el.addEventListener('click', function(e){ if (e.target === el) close(); });
      document.body.appendChild(el); setTimeout(()=>{try{window.applyPhoneMasks(el);}catch(_e){}},30);
    }

    function open(id) {
      const oid = String(id || '').trim();
      if (!oid) { if (window.showToast) showToast('Не указан номер заявки', 'error'); return; }
      const existing = DB.Orders.get(oid);
      if (!existing && window.DB?.init) {
        try {
          DB.init().then(function(){
            if (DB.Orders.get(oid)) open(oid);
            else if (window.showToast) showToast('Заявка не найдена — обновите список заявок', 'error');
          }).catch(function(){ if (window.showToast) showToast('Не удалось загрузить заявку', 'error'); });
        } catch(_e) { if (window.showToast) showToast('Заявка не найдена', 'error'); }
        return;
      }
      if (!existing) { if (window.showToast) showToast('Заявка не найдена', 'error'); return; }
      currentId = oid;
      ensure();
      render();
      if (window.App?.LayerManager && !window.App.LayerManager.open('order-detail') && window.App.LayerManager.isOpen('order-detail')) return;
      const root = document.getElementById('odet-panel');
      if (root) root.classList.add('open');
      const pendingFocus = window.__odetFocusSection || '';
      if (pendingFocus) {
        setTimeout(function(){
          const el = document.getElementById(pendingFocus);
          if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
          window.__odetFocusSection = '';
        }, 120);
      }
    }

    function openWorkbench(id) {
      window.__odetFocusSection = 'odet-workbench';
      open(id);
    }

    function collectMasterWorkbench(order) {
      const chat = DB.Chats.getByOrder(order.id);
      const messages = chat && DB.Messages ? DB.Messages.get(chat.id) : [];
      const reports = order.reports || [];
      const stages = order.stages || [];
      const partsMeta = (order.type || 'service_order') === 'parts_request' ? parsePartsRequestMeta(order) : null;
      const reportFiles = reports.reduce(function(sum, r){ return sum + ((r.files||[]).length || 0) + ((r.photos||[]).length || 0); }, 0);
      const unread = chat?.unread?.master || 0;
      const lastMessage = messages.slice().reverse().find(function(m){ return (m.type||'text') !== 'event' || (m.text||'').trim(); }) || null;
      const actionItems = [];
      stages.forEach(function(s){ actionItems.push({ type:'stage', at:s.doneAt || s.createdAt || '', label:'Этап: ' + (s.label || s.id || 'этап') }); });
      reports.forEach(function(r){ actionItems.push({ type:'report', at:r.createdAt || '', label:'Отчёт: ' + ((r.text||r.body||'').trim().slice(0,90) || 'добавлен отчёт') }); });
      messages.forEach(function(m){
        if ((m.type||'text') === 'event') return;
        const txt = String(m.text||'').trim();
        actionItems.push({ type:'message', at:m.createdAt || m.time || '', label:(m.from==='master'?'Сообщение мастера':'Сообщение клиента') + (txt ? ': ' + txt.slice(0,90) : '') });
      });
      actionItems.sort(function(a,b){ return String(b.at||'').localeCompare(String(a.at||'')); });
      return { chat, messages, reports, stages, partsMeta, unread, reportFiles, lastMessage, actionItems: actionItems.slice(0,10) };
    }

    function _assignmentStatusLabel(status) {
      const st = String(status || 'active');
      if (st === 'active') return 'Активно';
      if (st === 'superseded') return 'Заменено';
      if (st === 'removed') return 'Снят';
      return st;
    }

    function _assignmentStatusIcon(status) {
      const st = String(status || 'active');
      if (st === 'active') return '✅';
      if (st === 'superseded') return '🔁';
      if (st === 'removed') return '⛔';
      return '•';
    }

    function _assignmentComment(comment) {
      let txt = String(comment || '').trim();
      if (!txt) return '';
      txt = txt.replace(/\[STO-ASSIGN\]\s*/g, '');
      txt = txt.replace(/superseded_by=[^;\n]+;?\s*/g, '');
      txt = txt.replace(/reassign_from=[^;\n]+;?\s*/g, '');
      txt = txt.replace(/unassign_master=[^;\n]+;?\s*/g, '');
      txt = txt.replace(/to=[^;\n]+;?\s*/g, '');
      txt = txt.replace(/sto_exchange_assign|sto_lead_accept_assign|sto_reassign_master|sto_unassign_master/g, '').trim();
      return txt;
    }

    function buildAssignmentHistoryHtml(order, role) {
      const canSee = role === 'sto' || role === 'admin' || role === 'owner' || role === 'master';
      if (!canSee) return '';
      const history = Array.isArray(order.assignmentHistory) ? order.assignmentHistory : [];
      const currentMaster = String(order.masterName || '').trim() || (String(order.masterId || '').trim() ? 'Мастер назначен' : 'Мастер не назначен');
      const currentState = String(order.masterId || '').trim() && String(order.masterId || '') !== '0'
        ? '<span class="odet-assign-state odet-assign-state--active">Активный мастер: ' + escapeHtml(currentMaster) + '</span>'
        : '<span class="odet-assign-state odet-assign-state--empty">Сейчас без мастера</span>';
      const body = history.length ? history.map(function(h, idx){
        const status = String(h.status || 'active');
        const comment = _assignmentComment(h.comment || '');
        const master = String(h.masterName || h.masterId || 'Мастер').trim();
        const by = String(h.assignedByName || '').trim();
        return '<div class="odet-assign-item odet-assign-item--' + escapeHtml(status) + '">'
          + '<div class="odet-assign-dot">' + escapeHtml(_assignmentStatusIcon(status)) + '</div>'
          + '<div class="odet-assign-main">'
            + '<div class="odet-assign-top"><b>' + escapeHtml(master) + '</b><span>' + escapeHtml(_assignmentStatusLabel(status)) + '</span></div>'
            + '<div class="odet-assign-meta">' + escapeHtml(fmtTime(h.assignedAt || h.createdAt || '')) + (by ? ' · ' + escapeHtml(by) : '') + '</div>'
            + (comment ? '<div class="odet-assign-comment">' + nl2br(comment) + '</div>' : '')
          + '</div>'
        + '</div>';
      }).join('') : '<div class="odet-assign-empty">История назначений ещё не зафиксирована. Первое назначение появится после действия СТО.</div>';
      return '<div class="odet-section odet-assignment-history" id="odet-assignment-history">'
        + '<div class="odet-sec-title">👥 История назначений мастеров</div>'
        + '<div class="odet-assign-summary">' + currentState + '<span>Записей: ' + history.length + '</span></div>'
        + '<div class="odet-assign-list">' + body + '</div>'
      + '</div>';
    }


    function _partsOfferItemLine(it){
      return [it.name||'', it.oem||'', it.brand||'', it.supplier||'', it.price||it.priceValue||'', it.deliveryEta||it.eta||'', it.qty||1].map(function(v){ return String(v == null ? '' : v).replace(/\s*\|\s*/g, ' / ').trim(); }).join(' | ');
    }

    function _parsePartsOfferLines(text){
      return String(text || '').split(/\r?\n/).map(function(line){
        const row = String(line || '').trim();
        if(!row) return null;
        const p = row.split('|').map(function(x){ return String(x || '').trim(); });
        const price = Number(String(p[4] || '').replace(/\D+/g,'')) || 0;
        return {
          name:p[0] || 'Запчасть',
          oem:p[1] || '',
          brand:p[2] || '',
          supplier:p[3] || '',
          price:price,
          priceLabel:price ? price.toLocaleString('ru') + ' ₸' : (p[4] || 'цена по запросу'),
          deliveryEta:p[5] || '',
          qty:Number(p[6] || 1) || 1,
          tier:''
        };
      }).filter(Boolean);
    }

    function buildPartsOfferManagerHtml(order, role, canEdit){
      if (!order || String(order.type || 'service_order') !== 'parts_request') return '';
      const req = order.partsRequest && typeof order.partsRequest === 'object' ? order.partsRequest : {};
      const offer = order.partsOffer && typeof order.partsOffer === 'object' ? order.partsOffer : {};
      const items = Array.isArray(offer.items) ? offer.items : [];
      const local = Array.isArray(req.localOffers) ? req.localOffers : [];
      const canManage = !!canEdit && ['master','sto','admin','owner'].includes(String(role || ''));
      const initialLines = items.length
        ? items.map(_partsOfferItemLine).join('\n')
        : local.slice(0,5).map(function(x){ return _partsOfferItemLine({name:x.name,oem:x.oem,brand:x.brand||x.manufacturer,supplier:x.bestSupplierLabel||x.supplierLabel,price:x.price||x.priceValue||'',deliveryEta:x.deliveryEta||'',qty:1}); }).join('\n');
      const total = Number(order.partsOfferTotal || offer.totalPrice || 0) || 0;
      const status = String(order.partsOfferStatus || offer.status || 'draft');
      const statusLabel = status === 'sent' ? 'Предложение отправлено клиенту' : status === 'accepted' ? 'Клиент принял предложение' : status === 'declined' ? 'Клиент отклонил предложение' : 'Черновик предложения';
      const readOnlyItems = items.length ? '<div class="parts-offer-items">' + items.map(function(it){
        const lineTotal = (Number(it.qty)||1) * (Number(it.price)||0);
        return '<div class="parts-offer-item"><div><b>' + escapeHtml(it.name || 'Запчасть') + '</b><span>' + escapeHtml([it.oem?('OEM '+it.oem):'', it.brand||'', it.supplier||'', it.deliveryEta||''].filter(Boolean).join(' · ')) + '</span></div><strong>' + escapeHtml(lineTotal ? lineTotal.toLocaleString('ru') + ' ₸' : (it.priceLabel || 'цена по запросу')) + '</strong></div>';
      }).join('') + '</div>' : '<div class="parts-offer-empty">Предложение клиенту ещё не собрано.</div>';
      if (!canManage) {
        return '<div class="odet-section parts-offer-panel"><div class="odet-sec-title">📨 Предложение по запчастям</div><div class="parts-offer-status">' + escapeHtml(statusLabel) + (total ? ' · ' + total.toLocaleString('ru') + ' ₸' : '') + '</div>' + readOnlyItems + (offer.note ? '<div class="parts-offer-note">' + nl2br(offer.note) + '</div>' : '') + '</div>';
      }
      return '<div class="odet-section parts-offer-panel" id="parts-offer-manager">'
        + '<div class="odet-sec-title">📨 Предложение клиенту по запчастям</div>'
        + '<div class="parts-offer-status">' + escapeHtml(statusLabel) + (total ? ' · ' + total.toLocaleString('ru') + ' ₸' : '') + '</div>'
        + '<div class="parts-offer-help">Формат строки: деталь | OEM | бренд | поставщик | цена | срок | количество. Можно взять локальные совпадения из VIN/OEM-подбора и вручную подтвердить итоговое предложение.</div>'
        + '<div class="parts-offer-grid">'
          + '<label><span>Подтверждённый OEM</span><input id="parts-offer-oem" value="' + escapeHtml(offer.confirmedOem || order.partsOem || req.oemKnown || '') + '" placeholder="27060-0V130"></label>'
          + '<label><span>Комментарий клиенту</span><input id="parts-offer-note" value="' + escapeHtml(offer.note || order.partsOfferNote || '') + '" placeholder="Срок, гарантия, условия оплаты"></label>'
        + '</div>'
        + '<label class="parts-offer-lines"><span>Варианты / позиции предложения</span><textarea id="parts-offer-lines" rows="6" placeholder="Denso генератор | 27060-0V130 | Denso | KARETA склад | 18500 | сегодня | 1">' + escapeHtml(initialLines) + '</textarea></label>'
        + (local.length ? '<div class="parts-offer-local"><b>Локальные совпадения:</b>' + local.slice(0,4).map(function(x){ return '<span>' + escapeHtml([x.name,x.oem,x.brand||x.manufacturer,x.bestSupplierLabel||x.supplierLabel].filter(Boolean).join(' · ')) + '</span>'; }).join('') + '</div>' : '')
        + '<div class="parts-offer-actions"><button class="btn btn-outline" onclick="OrderSystem.Detail.savePartsOffer(\'draft\')">💾 Сохранить черновик</button><button class="btn btn-primary" onclick="OrderSystem.Detail.savePartsOffer(\'sent\')">📨 Отправить клиенту</button></div>'
      + '</div>';
    }

    function buildMasterWorkbenchHtml(order, role) {
      if (!(role === 'master' || role === 'admin' || role === 'owner')) return '';
      const wb = collectMasterWorkbench(order);
      const isParts = (order.type || 'service_order') === 'parts_request';
      const canStart = isOrderOpen(order.status);
      const canFinish = order.status === 'process';
      const ownerPill = String(order.masterId||'0') === '0'
        ? '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:99px;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.22);font-size:12px;color:#60a5fa">⚙️ Администрация ведёт чат</span>'
        : '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:99px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.22);font-size:12px;color:var(--green)">👨‍🔧 Чат закреплён за мастером</span>';
      const kpiCards = [[(wb.reports||[]).length,'Отчётов'],[wb.messages.length,'Сообщений'],[wb.unread,'Непрочитано'],[wb.reportFiles,'Файлов/фото']];
      return `
        <div class="odet-section" id="odet-workbench">
          <div class="odet-sec-title">🧰 Рабочее место мастера</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${ownerPill}${isParts && wb.partsMeta?.part ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:99px;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.22);font-size:12px;color:#a78bfa">📦 ${escapeHtml(wb.partsMeta.part)}</span>` : ''}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px">${kpiCards.map(function(row){ return `<div style="padding:12px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);background:var(--surface)"><div style="font-family:'Oswald',sans-serif;font-size:22px;color:var(--orange);font-weight:700">${row[0]}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${row[1]}</div></div>`; }).join('')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            ${canStart ? `<button class="btn btn-primary" style="font-size:12px;padding:8px 12px" onclick="masterStartOrder(${jsArg(order.id)},this)">▶ Начать работу</button>` : ''}
            ${canFinish ? `<button class="btn btn-outline" style="font-size:12px;padding:8px 12px" onclick="masterFinishOrder(${jsArg(order.id)},this)">✅ Завершить работу</button>` : ''}
            <button class="btn btn-outline" style="font-size:12px;padding:8px 12px" onclick="masterOpenReportModal(${jsArg(order.id)})">📝 Добавить отчёт</button>
            <button class="btn btn-outline" style="font-size:12px;padding:8px 12px" onclick="OrderSystem.Detail.close();Messenger.openByOrder(${jsArg(order.id)})">💬 Открыть чат${wb.unread ? ` (${wb.unread})` : ''}</button>
            ${(wb.partsMeta && wb.partsMeta.partId && window.openShopPartDetail) ? `<button class="btn btn-outline" style="font-size:12px;padding:8px 12px" onclick="openShopPartDetail(${jsArg(wb.partsMeta.partId)},${jsArg(wb.partsMeta.masterId || order.masterId || '')})">📦 Позиция детали</button>` : ''}
            ${safePhone(order.clientPhone) ? `<a class="btn btn-outline" style="font-size:12px;padding:8px 12px;text-decoration:none" href="tel:${safePhone(order.clientPhone)}">📞 Позвонить клиенту</a>` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:12px;align-items:start">
            <div class="card" style="padding:14px">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px">Последние действия</div>
              ${wb.actionItems.length ? `<div style="display:flex;flex-direction:column;gap:8px">${wb.actionItems.map(function(item){ return `<div style="padding:10px 12px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);background:var(--bg2)"><div style="font-size:12px;color:var(--text2);line-height:1.5">${escapeHtml(item.label)}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${escapeHtml(fmtTime(item.at))}</div></div>`; }).join('')}</div>` : `<div style="font-size:12px;color:var(--text3)">По этой заявке ещё нет зафиксированных действий мастера.</div>`}
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="card" style="padding:14px">
                <div style="font-weight:700;font-size:14px;margin-bottom:8px">Последнее сообщение</div>
                ${wb.lastMessage ? `<div style="font-size:12px;color:var(--text2);line-height:1.6">${nl2br(escapeHtml(String(wb.lastMessage.text||'—')))}</div><div style="font-size:11px;color:var(--text3);margin-top:8px">${escapeHtml(wb.lastMessage.from==='master' ? 'От мастера' : wb.lastMessage.from==='client' ? 'От клиента' : 'Системное')} · ${escapeHtml(fmtTime(wb.lastMessage.createdAt || wb.lastMessage.time || ''))}</div>` : `<div style="font-size:12px;color:var(--text3)">В чате пока нет сообщений.</div>`}
              </div>
              <div class="card" style="padding:14px">
                <div style="font-weight:700;font-size:14px;margin-bottom:8px">Контур заявки</div>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--text2)">
                  <div>• Этапов выполнено: <b>${wb.stages.length}</b></div>
                  <div>• Отчётов добавлено: <b>${wb.reports.length}</b></div>
                  <div>• Статус: <b>${escapeHtml(orderStatusLabel(order.type || 'service_order', order.status))}</b></div>
                  <div>• ${isParts ? 'Запрос запчасти' : 'Рабочая заявка'} остаётся в одном контуре: работа → чат → отчёт.</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function close() {
      if (window.__closeLayeredModal) window.__closeLayeredModal('odet-panel','order-detail');
      else {
        const root = document.getElementById('odet-panel');
        if (root) root.classList.remove('open');
        try{ window.App?.LayerManager?.close('order-detail'); }catch(_e){}
      }
    }

    function render() {
      const rawOrder = DB.Orders.get(currentId);
      const order = DB._orderDisplay ? DB._orderDisplay(rawOrder) : rawOrder;
      const panel = document.getElementById('odet-panel-inner');
      if (!panel || !order) return;
      const type = order.type || 'service_order';
      const isParts = type === 'parts_request';
      panel.classList.toggle('odet-panel--parts', isParts);
      panel.classList.toggle('odet-panel--service', !isParts);
      panel.setAttribute('data-order-type', type);
      const rootPanel = document.getElementById('odet-panel');
      if (rootPanel) rootPanel.setAttribute('data-order-type', type);
      const role = getRole();
      const canEdit = role === 'admin' || role === 'owner' || role === 'master' || (role === 'sto' && String(order.stoId || order.sto_id || '') !== '');
      const canPartsEdit = role === 'admin' || role === 'owner' || role === 'master' || (role === 'sto' && String(order.stoId || order.sto_id || '') !== '');
      const canViewPersonal = adminCanViewOrderPersonal(order, role);
      const sc = orderStatusColor(order.status);
      const sl = orderStatusLabel(type, order.status);

      // ── Блок подтверждения приёмки авто (клиент) ──────────────────────────
      const isClient = role === 'client' || (!canEdit);
      const handoverPending = order.carHandoverPending === true && order.carHandoverConfirmed == null;
      const handoverConfirmed = order.carHandoverConfirmed === true;
      const handoverDenied = order.carHandoverConfirmed === false;
      const handoverBlockHtml = (isClient && handoverPending) ? `
        <div style="margin:16px 0;padding:16px;border-radius:var(--ui-radius-md,10px);border:2px solid rgba(245,158,11,.5);background:rgba(245,158,11,.07);animation:_karetaPulse 1.8s ease-in-out infinite">
          <div style="font-size:15px;font-weight:700;color:var(--orange);margin-bottom:6px">🚗 Машина передана мастеру?</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">Мастер <strong>${escapeHtml(order.masterName||'Мастер')}</strong> сообщает, что принял ваш автомобиль. Подтвердите или отклоните передачу.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1;min-width:120px" onclick="OrderSystem.Detail.confirmHandover(${jsArg(order.id)}, true)">✅ Да, передал</button>
            <button class="btn btn-outline" style="flex:1;min-width:120px;color:#ef4444;border-color:rgba(239,68,68,.4)" onclick="OrderSystem.Detail.confirmHandover(${jsArg(order.id)}, false)">❌ Нет, не передавал</button>
          </div>
        </div>` : (handoverConfirmed ? `
        <div style="margin:16px 0;padding:12px 16px;border-radius:var(--ui-radius-md,10px);border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.07);font-size:13px;color:#22c55e;font-weight:600">
          ✅ Клиент подтвердил передачу автомобиля мастеру
        </div>` : (handoverDenied ? `
        <div style="margin:16px 0;padding:12px 16px;border-radius:var(--ui-radius-md,10px);border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);font-size:13px;color:#ef4444;font-weight:600">
          ❌ Клиент не подтвердил передачу — уточните ситуацию
        </div>` : ''));
      const partsMeta = isParts ? parsePartsRequestMeta(order) : null;
      const clientNameView = escapeHtml(maskedOrderValue(order, 'clientName', 'Клиент скрыт', role));
      const clientPhoneValue = maskedOrderValue(order, 'clientPhone', '', role);
      const clientPhoneView = safePhone(clientPhoneValue) ? `<a href="tel:${safePhone(clientPhoneValue)}" style="color:var(--orange)">${escapeHtml(clientPhoneValue)}</a>` : (canViewPersonal ? '—' : 'Доступ после взятия в обработку');
      const clientCarView = escapeHtml(maskedOrderValue(order, 'clientCar', 'Данные скрыты до взятия заявки в обработку', role));
      const infoRows = isParts ? [
        ['🏷 Тип', orderTypeLabel(type)],
        ['📦 Деталь', escapeHtml(partsMeta.part || '—')],
        ['🔎 SKU', escapeHtml(partsMeta.sku || '—')],
        ['💵 Ориентир', escapeHtml(partsMeta.price || (order.price ? fmtPrice(order.price) : '—'))],
        ['📅 Дата', escapeHtml(order.dateTimeText || '—')],
        ['👤 Клиент', clientNameView],
        ['📞 Телефон', clientPhoneView],
        ['🚗 Авто', escapeHtml(maskedOrderValue(order, 'clientCar', 'Данные скрыты до взятия заявки в обработку', role) || order.vehicleLine || '—')],
        ['👨‍🔧 Ответственный', escapeHtml(order.masterName || '—')]
      ] : [
        ['🏷 Тип', orderTypeLabel(type)],
        ['🔧 Услуги', escapeHtml(order.serviceLine || '—')],
        ['📅 Дата', escapeHtml(order.dateTimeText || '—')],
        ['👤 Клиент', clientNameView],
        ['📞 Телефон', clientPhoneView],
        ['🚗 Авто', escapeHtml(maskedOrderValue(order, 'clientCar', 'Данные скрыты до взятия заявки в обработку', role) || order.vehicleLine || '—')],
        ['👨‍🔧 Мастер', escapeHtml(order.masterLine || '—')],
        ['💰 Сумма', `<b style="color:var(--orange)">${fmtPrice(order.price)}</b>`]
      ];
      const clientOffersHtml = (isClient && typeof window._renderClientOrderResponsesForUnifiedDetail === 'function')
        ? (window._renderClientOrderResponsesForUnifiedDetail(order) || '')
        : '';
      const stagesHtml = isParts ? `<div class="odet-row"><span class="odet-key">🧾 Обработка</span><span class="odet-val">Статус, ответственный, чат и комментарий клиента</span></div>` : ALL_STAGES.map(function(s){
        const done = (order.stages||[]).some(function(x){ return x.id === s.id; });
        const sd = (order.stages||[]).find(function(x){ return x.id === s.id; });
        const commentHtml = (sd && sd.comment)
          ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;padding:6px 10px;background:var(--bg2);border-radius:var(--ui-radius-sm,5px);border-left:2px solid rgba(34,197,94,.4);line-height:1.5">${escapeHtml(sd.comment)}</div>`
          : '';
        const photoCount = (sd && sd.photos) ? sd.photos.length : 0;
        const photoBadge = photoCount ? `<span style="font-size:10px;color:var(--text3);margin-left:6px">📷 ${photoCount}</span>` : '';
        // Кнопка «→ Следующий этап» доступна назначенному мастеру или СТО-владельцу scoped-заявки.
        const isMasterOfOrder = role === 'master' && (
          String(order.masterUserId||'') === String(window._appState?.user?.id||'') ||
          String(order.masterId||'') !== '0'
        );
        const isStoOrder = role === 'sto' && String(order.stoId || order.sto_id || '') !== '';
        const isNextStep = !done && (order.stages||[]).length === ALL_STAGES.findIndex(function(x){ return x.id === s.id; });
        const advanceBtn = ((isMasterOfOrder || isStoOrder) && isNextStep)
          ? `<button class="btn btn-primary" style="font-size:11px;padding:5px 10px" onclick="window.masterOpenStageModal && masterOpenStageModal(${jsArg(order.id)})">→ Этап</button>`
          : '';
        return `<div class="odet-tl-item ${done?'done':''}">
          <div class="odet-tl-dot">${done?s.icon:'·'}</div>
          <div class="odet-tl-body">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <div class="odet-tl-label">${escapeHtml(s.label)}${photoBadge}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">${advanceBtn}</div>
            </div>
            ${sd ? `<div class="odet-tl-time">${escapeHtml(fmtTime(sd.doneAt))}</div>` : ''}
            ${commentHtml}
          </div>
        </div>`;
      }).join('');

      panel.innerHTML = `
        <div class="odet-header">
          <div>
            <div class="odet-id">${escapeHtml(order.id)}</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
              <span class="odet-status-badge" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${escapeHtml(sl)}</span>
              <span class="odet-status-badge" style="background:rgba(148,163,184,.14);color:var(--text2);border:1px solid rgba(148,163,184,.24)">${escapeHtml(orderTypeLabel(type))}</span>
            </div>
          </div>
          <button class="owiz-close" onclick="OrderSystem.Detail.close()">×</button>
        </div>
        <div class="odet-body">
          ${handoverBlockHtml}
          <div class="odet-section">
            <div class="odet-sec-title">${isParts ? 'Детали запроса' : 'Детали заявки'}</div>
            ${infoRows.map(function(r){ return `<div class="odet-row"><span class="odet-key">${r[0]}</span><span class="odet-val">${r[1]}</span></div>`; }).join('')}
            ${isParts && partsMeta.comment ? `<div class="odet-row"><span class="odet-key">💬 Комментарий</span><span class="odet-val">${nl2br(partsMeta.comment)}</span></div>` : ''}
            ${!isParts && order.notes ? `<div class="odet-row"><span class="odet-key">💬 Примечание</span><span class="odet-val">${nl2br(order.notes)}</span></div>` : ''}
            ${(role==='admin' && !canViewPersonal && String(order.masterId||'0')==='0') ? `<div style="margin-top:14px;padding:14px;border-radius:var(--ui-radius-md,10px);border:1px solid rgba(245,158,11,.28);background:rgba(245,158,11,.08)"><div style="font-weight:700;color:var(--orange);margin-bottom:6px">Диспетчерский режим</div><div style="font-size:13px;color:var(--text2);line-height:1.55">Пока заявка не взята в обработку вашим администратором, персональные данные клиента скрыты. Возьмите заявку в обработку, чтобы открыть телефон и карточку клиента.</div><button class="btn btn-primary" style="margin-top:10px" onclick="Admin.claimOrder(${jsArg(order.id)});OrderSystem.Detail.close();setTimeout(function(){OrderSystem.Detail.open(${jsArg(order.id)});},120)">Взять в обработку</button></div>` : ''}
          </div>
          ${buildAssignmentHistoryHtml(order, role)}
          ${buildPartsOfferManagerHtml(order, role, canEdit)}
          ${clientOffersHtml ? `<div class="odet-section odet-section--client-offers"><div class="odet-sec-title">Отклики мастеров</div>${clientOffersHtml}</div>` : ''}
          ${canEdit ? (function(){
            const LC = window.KaretaOrderLifecycle;
            const roleForStatus = String((window._appState && window._appState.user && window._appState.user.role) || role || 'client');
            const currentStatus = LC && LC.normalize ? LC.normalize(order.status || 'new') : String(order.status || 'new');
            const matrixActions = LC && LC.getAvailableActions ? LC.getAvailableActions(order, roleForStatus, { canOpenChat: canViewPersonal !== false }) : [];
            const statusActions = matrixActions.filter(function(a){ return a.kind === 'status' && a.targetStatus; });
            if (!statusActions.length) return `<div class="odet-section"><div class="odet-sec-title">Статус</div><div class="odet-status-note">Текущий статус: ${escapeHtml(orderStatusLabel(type, currentStatus))}. Доступных переходов нет.</div></div>`;
            return `<div class="odet-section"><div class="odet-sec-title">Доступные действия по статусу</div><div class="odet-status-note">Показываются только действия из единой матрицы ролей.</div><div class="odet-status-btns">${statusActions.map(function(a){ const st = a.targetStatus; return `<button class="odet-st-btn" style="--sc:${safeColor(orderStatusColor(st))}" onclick="OrderSystem.Detail.setStatus(${jsArg(st)})">${escapeHtml((a.icon ? a.icon + ' ' : '') + orderStatusLabel(type, st))}</button>`; }).join('')}</div></div>`;
          })() : ''}
          ${(role==='admin'||role==='owner') ? `<div class="odet-section"><div class="odet-sec-title">${isParts ? 'Ответственный' : 'Мастер'}</div><div class="odet-masters-row">${DB.Masters.getAll(true).map(function(m){ const act = order.masterId===m.id ? 'active' : '';const color=safeColor(m.color); return `<div class="odet-master-chip ${act}" onclick="OrderSystem.Detail.assignMaster(${jsArg(m.id)})"><div class="odet-mc-av" style="background:${color}22;color:${color}">${escapeHtml(m.initials||'?')}</div>${escapeHtml((m.name||'').split(' ')[0]||m.name||'')}</div>`; }).join('')}<div class="odet-master-chip ${String(order.masterId||'0')==='0'?'active':''}" onclick="OrderSystem.Detail.assignMaster('0')">⚙️ Администрация</div></div></div>` : ''}
          <div class="odet-section"><div class="odet-sec-title">${isParts ? 'Обработка запроса' : 'Этапы выполнения и стенки этапов'}</div><div style="font-size:12px;color:var(--text3);margin-bottom:10px">Мастер отмечает этап и ведёт отдельную стенку комментариев, фото и файлов по каждому этапу. Клиент и администрация видят эти стенки в режиме просмотра.</div><div class="odet-timeline">${stagesHtml}</div></div>
          ${buildMasterWorkbenchHtml(order, role)}

          <!-- PARTS SECTION — запчасти и расходники -->
          ${(function(){
            const orderParts = Array.isArray(order.orderParts) ? order.orderParts : [];
            if (!orderParts.length && !canPartsEdit) return '';
            const total = orderParts.reduce((s,p)=>s+(Number(p.qty)||1)*(Number(p.price)||0),0);
            const typeLabel = {part:'Запчасть',consumable:'Расходник',fluid:'Жидкость/Масло',work:'Работа'};
            const tableHtml = orderParts.length
              ? '<table style="width:100%;border-collapse:collapse;font-size:13px">'
                + '<thead><tr style="border-bottom:2px solid var(--line)">'
                + '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-weight:600">Наименование</th>'
                + '<th style="text-align:center;padding:6px 4px;color:var(--text3);font-weight:600;width:44px">Кол.</th>'
                + '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:600;width:90px">Цена</th>'
                + '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:600;width:90px">Сумма</th>'
                + '</tr></thead><tbody>'
                + orderParts.map(function(p){
                    return '<tr style="border-bottom:1px solid var(--line)">'
                      + '<td style="padding:7px 8px;font-weight:600">'+escapeHtml(p.name||'—')+'<br><span style="font-size:11px;color:var(--text3);font-weight:400">'+(typeLabel[p.type]||p.type||'')+(p.sku?' · '+escapeHtml(p.sku):'')+'</span></td>'
                      + '<td style="text-align:center;padding:7px 4px">'+(Number(p.qty)||1)+'</td>'
                      + '<td style="text-align:right;padding:7px 8px;color:var(--text2)">'+(Number(p.price)||0).toLocaleString('ru')+' ₸</td>'
                      + '<td style="text-align:right;padding:7px 8px;font-family:Oswald,sans-serif;color:var(--orange)">'+((Number(p.qty)||1)*(Number(p.price)||0)).toLocaleString('ru')+' ₸</td>'
                      + '</tr>';
                  }).join('')
                + '</tbody>'
                + '<tfoot><tr>'
                + '<td colspan="3" style="padding:8px;font-weight:700;text-align:right;font-size:13px">Итого запчасти:</td>'
                + '<td style="padding:8px;font-family:Oswald,sans-serif;font-size:16px;color:var(--orange);text-align:right">'+total.toLocaleString('ru')+' ₸</td>'
                + '</tr></tfoot></table>'
              : '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Запчасти и расходники ещё не добавлены</div>';
            return '<div class="odet-section">'
              + '<div class="odet-sec-title">🔩 Запчасти и расходники</div>'
              + '<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);overflow:hidden;margin-top:8px">'
              + tableHtml
              + '</div>'
              + (canPartsEdit ? '<button class="btn btn-outline" style="margin-top:10px;font-size:12px;padding:8px 14px;width:100%;justify-content:center" onclick="if(window.masterOpenPartsModal)masterOpenPartsModal(' + jsArg(order.id) + ')">🔩 Управление запчастями</button>' : '')
              + '</div>';
          })()}

          <!-- REPORTS SECTION — visible for all roles -->
          <div class="odet-section">
            <div class="odet-sec-title">📋 Ход работ</div>
            ${_buildReportsHtml(order)}
            ${_buildLinkedShopSalesHtml(order)}
            <!-- Add report form — only for master/admin/owner -->
            ${canEdit ? `
            <div style="margin-top:12px">
              <button id="odet-toggle-report-btn" class="btn btn-outline" style="font-size:12px;padding:8px 14px;width:100%;justify-content:center" onclick="OrderSystem.Detail.toggleReportForm()">+ Добавить отчёт о работе</button>
              <div id="odet-report-form-section" style="display:none;margin-top:12px" data-open="0">
                <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);padding:14px">
                  <textarea id="odet-report-text" placeholder="Опишите что сделано, какие детали заменены, результат проверки..." rows="4" style="width:100%;background:transparent;border:1px solid var(--line);border-radius:var(--ui-radius-sm,5px);padding:10px 12px;font-size:13px;color:var(--text);font-family:'Mulish',sans-serif;resize:vertical;outline:none;box-sizing:border-box"></textarea>
                  <div style="margin-top:10px">
                    <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">📸 Фото (до 5 шт)</label>
                    <input id="odet-report-photos" type="file" accept="image/*" multiple style="font-size:12px;color:var(--text2)" onchange="_renderReportPreviews(this.files)"/>
                    <div id="odet-photo-previews"></div>
                  </div>
                  <button id="odet-save-report-btn" class="btn btn-primary" style="margin-top:12px;width:100%;justify-content:center" onclick="OrderSystem.Detail.saveReport()">📋 Сохранить отчёт</button>
                </div>
              </div>
            </div>` : ''}
          </div>
          <div class="odet-section">${(role==='admin' && !canViewPersonal && String(order.masterId||'0')==='0') ? `<button class="btn btn-outline" style="width:100%;justify-content:center" disabled>💬 Чат откроется после взятия заявки в обработку</button>` : `<button class="btn btn-outline" style="width:100%;justify-content:center" onclick="OrderSystem.Detail.close();Messenger.openByOrder(${jsArg(order.id)})">💬 Открыть чат${order.chatId ? '' : ' · восстановить связь'}</button>`}</div>
          ${(role==='admin'||role==='owner') ? `<div class="odet-section"><button style="font-size:12px;padding:8px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:var(--ui-radius-sm,5px);cursor:pointer" onclick="OrderSystem.Detail.deleteOrder()">🗑 Удалить заявку</button></div>` : ''}
        </div>`;
    }


    async function savePartsOffer(status) {
      const order = DB.Orders.get(currentId);
      if (!order || String(order.type || 'service_order') !== 'parts_request') return;
      const linesEl = document.getElementById('parts-offer-lines');
      const oemEl = document.getElementById('parts-offer-oem');
      const noteEl = document.getElementById('parts-offer-note');
      const items = _parsePartsOfferLines(linesEl ? linesEl.value : '');
      if (status === 'sent' && !items.length) { if(window.showToast) showToast('Добавьте хотя бы одну позицию предложения','error'); return; }
      const offer = {
        status: status === 'sent' ? 'sent' : 'draft',
        confirmedOem: oemEl ? oemEl.value : '',
        note: noteEl ? noteEl.value : '',
        items: items
      };
      try {
        await DB.Orders.savePartsOffer(currentId, offer);
        render();
        if(window.showToast) showToast(status === 'sent' ? 'Предложение отправлено клиенту' : 'Черновик предложения сохранён');
      } catch(e) {
        if(window.showToast) showToast(e && e.message ? e.message : 'Не удалось сохранить предложение', 'error');
      }
    }

    async function setStatus(status) {
      if (_statusBusy) return;
      _statusBusy = true;
      _setDetailBusy('status', true);
      try {
        await DB.Orders.setStatus(currentId, status);
        render();
        if (window.showToast) showToast('Статус: ' + orderStatusLabel((DB.Orders.get(currentId)||{}).type || 'service_order', status));
      } catch (e) {
        if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось изменить статус', 'error');
      } finally {
        _statusBusy = false;
        _setDetailBusy('status', false);
      }
    }

    async function assignMaster(masterId) {
      if (_assignBusy) return;
      _assignBusy = true;
      _setDetailBusy('assign', true);
      try {
        await DB.Orders.assignMaster(currentId, (masterId==null||masterId==='') ? '0' : masterId);
        render();
        if (window.showToast) showToast(String(masterId||'0')==='0' ? 'Заявка возвращена администрации' : 'Мастер назначен, чат передан');
      } catch (e) {
        if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось назначить мастера', 'error');
      } finally {
        _assignBusy = false;
        _setDetailBusy('assign', false);
      }
    }

    function toggleStagePanel() {}

    async function addStage(id, icon, label) {
      if (_stageBusy) return;
      _stageBusy = true;
      _setDetailBusy('stage', true);
      try {
        await DB.Orders.addStage(currentId, { id, icon, label });
        render();
      } catch (e) {
        if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось добавить этап', 'error');
      } finally {
        _stageBusy = false;
        _setDetailBusy('stage', false);
      }
    }

    function toggleReportForm() {
      const section = document.getElementById('odet-report-form-section');
      if (!section) return;
      const isOpen = section.dataset.open === '1';
      section.dataset.open = isOpen ? '0' : '1';
      section.style.display = isOpen ? 'none' : 'block';
      const btn = document.getElementById('odet-toggle-report-btn');
      if (btn) btn.textContent = isOpen ? '+ Добавить отчёт о работе' : '✕ Скрыть форму';
    }

    async function saveReport() {
      if (_reportBusy) return;
      const text = document.getElementById('odet-report-text')?.value?.trim();
      if (!text) { if(window.showToast) showToast('Напишите текст отчёта','error'); return; }
      const fileInput = document.getElementById('odet-report-photos');
      const photos = [];
      // Process uploaded photos as base64
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        for (const file of Array.from(fileInput.files).slice(0,5)) {
          if (!file.type.startsWith('image/')) continue;
          try {
            const data = await new Promise((res,rej) => {
              const fr = new FileReader();
              fr.onload = () => res(fr.result);
              fr.onerror = () => rej(new Error('read_error'));
              fr.readAsDataURL(file);
            });
            photos.push({ url: data, name: file.name });
          } catch(_e) {}
        }
      }
      const order = DB.Orders.get(currentId);
      const actorInfo = (() => {
        const u = window._appState?.user;
        const role = String(u?.role || getRole() || 'master');
        if (role === 'sto') return { role:'sto', label:(order.stoName || order.sto_name || u?.name || 'СТО') };
        const m = window.DB?.Masters?.getByPhone?.(u?.phone) || window.DB?.Masters?.getAll?.(true)?.find(x=>x.userId===u?.id||x.user_id===u?.id);
        return { role:'master', label:(m?.name || u?.name || 'Мастер') };
      })();
      const report = { text, masterName: actorInfo.label, actorRole: actorInfo.role, actorLabel: actorInfo.label, photos, createdAt: new Date().toISOString() };
      const btn = document.getElementById('odet-save-report-btn');
      _reportBusy = true;
      _setDetailBusy('report', true);
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем...'; btn.style.pointerEvents = 'none'; }
      try {
        await DB.Orders.addReport(currentId, report);
        if(window.showToast) showToast('✅ Отчёт добавлен');
        if (document.getElementById('odet-report-text')) document.getElementById('odet-report-text').value = '';
        if (fileInput) fileInput.value = '';
        _renderReportPreviews([]);
        render(); // refresh panel
      } catch(e) {
        if(window.showToast) showToast(e?.message || 'Не удалось сохранить отчёт', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '📋 Сохранить отчёт'; btn.style.pointerEvents = ''; }
      } finally {
        _reportBusy = false;
        _setDetailBusy('report', false);
      }
    }

    function _buildLinkedShopSalesHtml(order) {
      const sales = (window.DB?.Shop?.getSalesByOrder?.(order.id) || []).slice(0,8);
      if (!sales.length) return '';
      return `<div style="margin-top:12px"><div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">🏪 Товары мастера по этой заявке</div>${sales.map(function(s){
        return `<div style="padding:12px;background:rgba(96,165,250,.08);border-radius:var(--ui-radius-md,10px);border:1px solid rgba(96,165,250,.18);margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><div style="font-weight:700;font-size:13px">${escapeHtml(s.partName||'Товар')}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${escapeHtml(s.createdAt||'')} · ${Number(s.qty||1)} шт.${s.customerName?` · ${escapeHtml(s.customerName)}`:''}${s.vehicleTitle?` · ${escapeHtml(s.vehicleTitle)}`:''}</div></div><div style="text-align:right"><div style="font-family:Oswald,sans-serif;color:var(--orange)">${fmtPrice(s.total||0)}</div><div style="font-size:11px;color:var(--text3)">${fmtPrice(s.unitPrice||s.unit_price||0)} / шт.</div></div></div>${(s.note||'') ? `<div style="font-size:12px;color:var(--text2);margin-top:8px">${nl2br(s.note||'')}</div>` : ''}</div>`;
      }).join('')}</div>`;
    }

    function _renderReportPreviews(files) {
      const wrap = document.getElementById('odet-photo-previews');
      if (!wrap) return;
      if (!files || files.length === 0) { wrap.innerHTML = ''; return; }
      const items = Array.from(files).slice(0,5).map(f => {
        const url = URL.createObjectURL(f);
        return `<div style="width:64px;height:64px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line);flex-shrink:0"><img src="${url}" style="width:100%;height:100%;object-fit:cover"/></div>`;
      }).join('');
      wrap.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${items}</div>`;
    }

    function deleteOrder() {
      if (_deleteBusy) return;
      const run = async function(){
        _deleteBusy = true;
        _setDetailBusy('delete', true);
        try {
          await DB.Orders.delete(currentId);
          close();
          if (window.Admin) { try { Admin.showPane('orders'); } catch(e){} }
          if (window.showToast) showToast('Заявка удалена');
        } catch (e) {
          if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось удалить заявку', 'error');
        } finally {
          _deleteBusy = false;
          _setDetailBusy('delete', false);
        }
      };
      if (window.showConfirmModal) showConfirmModal('Удалить заявку?', 'Это действие нельзя отменить.', run);
      else run();
    }

    function _buildReportsHtml(order) {
      const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const reports = order.reports || [];
      if (!reports.length) return '<div style="padding:12px;background:var(--surface);border-radius:var(--ui-radius-sm,5px);border:1px dashed var(--line);font-size:12px;color:var(--text3);text-align:center">Отчётов пока нет</div>';
      return reports.map(r => {
        const ts = r.createdAt ? new Date(r.createdAt).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
        const photos = (r.photos||[]).slice(0,5);
        const files = (r.files||[]).slice(0,6);
        const links = (r.links||[]).slice(0,6);
        const photoHtml = photos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${photos.map(p=>{const src=safeAssetUrl(p.url||p.data||'');return src?`<div onclick="window._openPhotoViewer&&_openPhotoViewer(${jsArg(src)})" style="width:64px;height:64px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line);cursor:pointer;flex-shrink:0">
            <img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.parentNode.style.display='none'"/>
          </div>`:'';}).join('')}
        </div>` : '';
        const fileHtml = files.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${files.map(f=>{const href=safeAssetUrl(f.url||f.data||'');return href?`<a href="${esc(href)}" download="${esc(f.name||'file')}" style="font-size:11px;padding:6px 8px;border-radius:var(--ui-radius-sm,5px);background:rgba(148,163,184,.12);border:1px solid rgba(148,163,184,.24);color:var(--text2);text-decoration:none">📎 ${esc(f.name||'Файл')}</a>`:'';}).join('')}</div>` : '';
        const linkHtml = links.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${links.map(link=>{const href=safeExternalUrl(link);return href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;padding:6px 8px;border-radius:var(--ui-radius-sm,5px);background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.22);color:#60a5fa;text-decoration:none">🔗 ${esc(href.replace(/^https?:\/\//,''))}</a>`:'';}).join('')}</div>` : '';
        return `<div style="padding:12px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line);margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:26px;height:26px;border-radius:50%;background:rgba(255,107,0,.1);border:1px solid var(--orange-brd,rgba(255,107,0,.25));display:flex;align-items:center;justify-content:center;font-size:12px">🔧</div>
            <div style="flex:1"><div style="font-size:12px;font-weight:700">${esc(r.actorLabel||r.stoName||r.masterName||(r.actorRole==='sto'?'СТО':'Мастер'))}</div><div style="font-size:10px;color:var(--text3)">${ts}${r.actorRole==='sto'?' · СТО':''}</div></div>
            <span style="font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);color:#22c55e">Отчёт</span>
          </div>
          <div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${esc(r.text||r.body||'')}</div>
          ${linkHtml}
          ${photoHtml}
          ${fileHtml}
        </div>`;
      }).join('');
    }

    function _buildLinkedShopSalesHtml(order) {
      const sales = (window.DB?.Shop?.getSalesByOrder?.(order.id) || []).slice(0,8);
      if (!sales.length) return '';
      return `<div style="margin-top:12px"><div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">🏪 Товары мастера по этой заявке</div>${sales.map(function(s){
        return `<div style="padding:12px;background:rgba(96,165,250,.08);border-radius:var(--ui-radius-md,10px);border:1px solid rgba(96,165,250,.18);margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><div style="font-weight:700;font-size:13px">${escapeHtml(s.partName||'Товар')}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${escapeHtml(s.createdAt||'')} · ${Number(s.qty||1)} шт.${s.customerName?` · ${escapeHtml(s.customerName)}`:''}${s.vehicleTitle?` · ${escapeHtml(s.vehicleTitle)}`:''}</div></div><div style="text-align:right"><div style="font-family:Oswald,sans-serif;color:var(--orange)">${fmtPrice(s.total||0)}</div><div style="font-size:11px;color:var(--text3)">${fmtPrice(s.unitPrice||s.unit_price||0)} / шт.</div></div></div>${(s.note||'') ? `<div style="font-size:12px;color:var(--text2);margin-top:8px">${nl2br(s.note||'')}</div>` : ''}</div>`;
      }).join('')}</div>`;
    }

    function _renderReportPreviews(files) {
      const wrap = document.getElementById('odet-photo-previews');
      if (!wrap || !files) return;
      const items = Array.from(files).slice(0,5).map(f => {
        const url = URL.createObjectURL(f);
        return `<div style="width:64px;height:64px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line);flex-shrink:0"><img src="${url}" style="width:100%;height:100%;object-fit:cover"/></div>`;
      }).join('');
      wrap.innerHTML = items ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${items}</div>` : '';
    }
    window._renderReportPreviews = _renderReportPreviews;

    async function confirmHandover(orderId, confirmed) {
      try {
        await DB.Orders.update(orderId, {
          carHandoverConfirmed: confirmed,
          carHandoverPending: false,
        });
        render();
        if (window.showToast) showToast(confirmed ? '✅ Передача подтверждена' : '❌ Передача отклонена — мастер будет уведомлён');
        try { window.App?.updateBadge?.(); } catch(_e) {}
      } catch(e) {
        if (window.showToast) showToast('Не удалось сохранить ответ', 'error');
      }
    }

    return { open, openWorkbench, close, render, setStatus, assignMaster, toggleStagePanel, addStage, toggleReportForm, saveReport, savePartsOffer, deleteOrder, confirmHandover };
  })();

  const ClientsPanel = (() => {
    let q = '';
    let mode = 'all';

    function phoneKey(v) { return String(v || '').replace(/\D/g, ''); }
    function clientInitials(c) {
      const name = String(c?.name || '').trim();
      if (c?.initials) return escapeHtml(c.initials);
      if (!name) return 'КЛ';
      return escapeHtml(name.split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase() || name.slice(0,2).toUpperCase());
    }
    function clientOrders(c) {
      if (!c) return [];
      const cid = String(c.id || '');
      const cp = phoneKey(c.phone || '');
      const base = (DB.Orders?.getAll?.() || []);
      return base.filter(o => {
        if (cid && String(o.clientId || '') === cid) return true;
        if (cp && phoneKey(o.clientPhone || '') === cp) return true;
        return false;
      }).sort((a,b)=>String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
    }
    function orderIsCurrent(o) {
      const st = String(o?.status || 'new');
      return ['new','waiting_responses','process','done_pending_client','dispute'].includes(st);
    }
    function orderIsAgreement(o) {
      const st = String(o?.status || 'new');
      const type = String(o?.type || 'service_order');
      return st === 'waiting_responses' || st === 'done_pending_client' || type === 'parts_request' || !!o?.deferred;
    }
    function orderIsAwaitReview(o) { return String(o?.status || '') === 'done_pending_client'; }
    function orderIsInWork(o) { return ['new','waiting_responses','process','done_pending_client','dispute'].includes(String(o?.status || 'new')); }
    function normalizeClientMode(nextMode) {
      const m = String(nextMode || 'current');
      return ['all','current','agreement','awaiting','history'].includes(m) ? m : 'all';
    }
    function clientModeLabel(nextMode) {
      const m = normalizeClientMode(nextMode);
      if (m === 'agreement') return 'Согласование';
      if (m === 'awaiting') return 'Ждёт клиента';
      if (m === 'history') return 'История';
      if (m === 'current') return 'В работе';
      return 'Все клиенты';
    }
    function clientOrdersForMode(stats, nextMode) {
      const m = normalizeClientMode(nextMode);
      if (m === 'agreement') return stats.agreement;
      if (m === 'awaiting') return stats.review;
      if (m === 'history') return stats.history;
      if (m === 'current') return stats.current;
      return stats.orders;
    }
    function clientMatchesMode(stats, nextMode) {
      const m = normalizeClientMode(nextMode);
      if (m === 'all') return true;
      if (m === 'history') return stats.history.length > 0;
      if (m === 'agreement') return stats.agreement.length > 0;
      if (m === 'awaiting') return stats.review.length > 0;
      return stats.current.length > 0;
    }
    function orderTitle(o) { return o?.serviceNames || o?.notes || orderTypeLabel(o?.type || 'service_order') || 'Заявка'; }
    function orderMeta(o) {
      return [o?.dateLabel || o?.date || (o?.createdAt || '').slice(0,10), o?.time, o?.clientCar || o?.vehicleTitle].filter(Boolean).join(' · ') || 'Дата не указана';
    }
    function orderBadge(o) {
      const st = String(o?.status || 'new');
      const color = orderStatusColor(st);
      return `<span class="crm-order-badge" style="--_badge:${escapeHtml(color)}">${escapeHtml(orderStatusIcon(st))} ${escapeHtml(orderStatusLabel(o?.type || 'service_order', st))}</span>`;
    }
    function fmtCrmDate(v) {
      const raw = String(v || '').trim();
      if (!raw) return '';
      const d = raw.includes('T') ? raw : raw.replace(' ', 'T');
      const parts = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
      if (!parts) return raw.slice(0, 16);
      return `${parts[3]}.${parts[2]}.${parts[1]}${parts[4] ? ' ' + parts[4] + ':' + parts[5] : ''}`;
    }
    function getOrderEvents(orderId) {
      const id = String(orderId || '');
      if (!id) return [];
      try {
        if (window.DB?.OrderEvents?.byOrder) return DB.OrderEvents.byOrder(id) || [];
      } catch(_e) {}
      return [];
    }
    function getOrderChat(order) {
      if (!order) return null;
      try { return DB.Chats?.getByOrder?.(order.id) || (order.chatId ? DB.Chats?.get?.(order.chatId) : null) || null; } catch(_e) { return null; }
    }
    function getOrderMessages(order) {
      const chat = getOrderChat(order);
      if (!chat || !window.DB?.Messages) return [];
      try { return DB.Messages.get(chat.id) || []; } catch(_e) { return []; }
    }
    function lastOrderMessage(order) {
      return getOrderMessages(order).slice().reverse().find(function(m){
        const t = String(m?.text || '').trim();
        return t && String(m?.type || 'text') !== 'event';
      }) || null;
    }

    const _clientHistorySyncing = new Set();
    function orderAttachments(order) {
      return getOrderMessages(order).filter(function(m){
        const t = String(m?.type || '');
        return t === 'file' || t === 'image' || t === 'video' || !!m.fileName || !!m.fileData;
      });
    }
    function renderOrderAttachments(order) {
      const files = orderAttachments(order);
      if (!files.length) return `<div class="crm-order-files is-empty">Вложений пока нет</div>`;
      const thumbs = files.slice(-3).map(function(m){
        const name = escapeHtml(m.fileName || 'Файл');
        const type = String(m.fileType || m.type || 'file');
        const mediaUrl=safeAssetUrl(m.fileUrl||m.fileData||'');
        if ((type === 'image' || /^data:image\//.test(String(m.fileData||''))) && mediaUrl) {
          return `<span class="crm-order-file-thumb crm-order-file-thumb--img" title="${name}"><img src="${escapeHtml(mediaUrl)}" alt="${name}"></span>`;
        }
        if (type === 'video') return `<span class="crm-order-file-thumb" title="${name}">🎥</span>`;
        return `<span class="crm-order-file-thumb" title="${name}">📎</span>`;
      }).join('');
      return `<div class="crm-order-files"><b>${files.length}</b><span>влож.</span>${thumbs}</div>`;
    }
    function renderClientHistorySummary(st) {
      const all = (st.orders || []).slice();
      const filesCount = all.reduce(function(n,o){ return n + orderAttachments(o).length; }, 0);
      const last = all.slice().sort(function(a,b){ return String(b.updatedAt || b.completedAt || b.createdAt || b.date || '').localeCompare(String(a.updatedAt || a.completedAt || a.createdAt || a.date || '')); })[0] || null;
      return `<div class="crm-client-history-summary">
        <div><b>${all.length}</b><span>Всего заявок</span></div>
        <div><b>${st.current.length}</b><span>В работе</span></div>
        <div><b>${st.history.length}</b><span>В истории</span></div>
        <div><b>${filesCount}</b><span>Фото/файлов</span></div>
        <div class="crm-client-history-summary__wide"><b>${last ? escapeHtml(orderTitle(last)) : '—'}</b><span>Последняя активность</span></div>
      </div>`;
    }
    function syncClientHistory(c) {
      if (!c || !window.DB?.Messages?.sync) return;
      const key = String(c.id || c.phone || '').trim();
      if (!key || _clientHistorySyncing.has(key)) return;
      const orders = clientOrders(c).filter(function(o){ return !!getOrderChat(o); });
      if (!orders.length) return;
      _clientHistorySyncing.add(key);
      Promise.all(orders.slice(0, 12).map(function(o){
        const chat = getOrderChat(o);
        return chat ? DB.Messages.sync(chat.id, { force:false }).catch(function(){ return []; }) : Promise.resolve([]);
      })).then(function(){
        const modal = document.getElementById('client-modal');
        if (modal && modal.classList.contains('open') && modal.dataset.clientId === key) {
          try { OrderSystem.ClientsPanel.openClient(c.id, modal.dataset.clientView || 'current'); } catch(_e) {}
        }
      }).finally(function(){ _clientHistorySyncing.delete(key); });
    }
    function orderStageList(order) {
      const own = Array.isArray(order?.stages) ? order.stages : [];
      const events = getOrderEvents(order?.id).filter(function(e){
        const type = String(e?.type || '');
        return type === 'stage_changed' || type === 'order_completed_by_master' || type === 'order_confirmed_by_client';
      });
      const ownItems = own.map(function(s){
        return {
          id: s.id || s.stage_key || s.stage || 'stage',
          label: s.label || s.name || s.stage_label || s.id || 'Этап',
          at: s.doneAt || s.createdAt || s.created_at || '',
          icon: s.icon || s.ico || '✓'
        };
      });
      const eventItems = events.map(function(e){
        return {
          id: e.id || e.type || 'event',
          label: e.label || e.title || (DB.OrderEvents?.label ? DB.OrderEvents.label(e.type) : 'Событие'),
          at: e.createdAt || e.created_at || e.at || '',
          icon: '•'
        };
      });
      return ownItems.concat(eventItems).sort(function(a,b){ return String(b.at || '').localeCompare(String(a.at || '')); }).slice(0, 4);
    }
    function renderOrderStageStrip(order) {
      const items = orderStageList(order);
      if (!items.length) return `<div class="crm-order-stage-strip is-empty">Этапы ещё не зафиксированы</div>`;
      return `<div class="crm-order-stage-strip" aria-label="Последние этапы заявки">${items.map(function(it){
        return `<span title="${escapeHtml(it.label)}"><i>${escapeHtml(it.icon || '•')}</i><b>${escapeHtml(it.label)}</b>${it.at ? `<em>${escapeHtml(fmtCrmDate(it.at))}</em>` : ''}</span>`;
      }).join('')}</div>`;
    }
    function renderOrderLastMessage(order) {
      const msg = lastOrderMessage(order);
      if (!msg) return `<div class="crm-order-last-message is-empty">Сообщений по этапам пока нет</div>`;
      const from = msg.from === 'client' ? 'Клиент' : (msg.from === 'master' ? 'Мастер' : 'Чат');
      return `<div class="crm-order-last-message"><span>${escapeHtml(from)}</span><b>${escapeHtml(String(msg.text || '').slice(0, 120))}</b>${msg.time || msg.createdAt ? `<em>${escapeHtml(fmtCrmDate(msg.createdAt || msg.time))}</em>` : ''}</div>`;
    }
    function renderMiniOrder(o, kind) {
      const isParts = String(o?.type || 'service_order') === 'parts_request';
      const stageHint = isParts ? 'Согласование запчастей/услуг' : (orderIsAwaitReview(o) ? 'Ожидает подтверждения клиента' : 'Работа по этапам');
      const chat = getOrderChat(o);
      const msgCount = getOrderMessages(o).length;
      return `<article class="crm-client-order ${orderIsCurrent(o) ? 'is-current' : 'is-history'}" data-order-id="${escapeHtml(o.id || '')}">
        <div class="crm-client-order__main">
          <div class="crm-client-order__top">
            <b>${escapeHtml(orderTitle(o))}</b>
            ${orderBadge(o)}
          </div>
          <div class="crm-client-order__meta">${escapeHtml(orderMeta(o))}</div>
          <div class="crm-client-order__hint">${escapeHtml(stageHint)}${o.masterName ? ' · мастер: ' + escapeHtml(o.masterName) : ''}${msgCount ? ' · сообщений: ' + escapeHtml(String(msgCount)) : ''}</div>
          ${renderOrderStageStrip(o)}
          ${renderOrderLastMessage(o)}
          ${renderOrderAttachments(o)}
        </div>
        <div class="crm-client-order__actions">
          <button type="button" class="act-btn view" onclick="OrderSystem.Detail.open(${jsArg(o.id || '')})">Открыть</button>
          <button type="button" class="act-btn edit" ${chat ? `onclick="Messenger.openByOrder && Messenger.openByOrder(${jsArg(o.id || '')})"` : 'disabled'}>Чат</button>
        </div>
      </article>`;
    }
    function clientStats(c) {
      const orders = clientOrders(c);
      const current = orders.filter(orderIsCurrent);
      const history = orders.filter(o => !orderIsCurrent(o));
      const agreement = orders.filter(orderIsAgreement);
      const review = orders.filter(orderIsAwaitReview);
      const spent = orders.filter(o => String(o.status || '') === 'done').reduce((sum,o)=>sum + Number(o.price || 0), Number(c.totalSpent || 0));
      return { orders, current, history, agreement, review, spent };
    }
    function renderClientCard(c) {
      const st = clientStats(c);
      const shown = clientOrdersForMode(st, mode);
      const preview = shown.slice(0,2);
      const activeTone = st.current.length ? 'is-active' : '';
      const modeName = clientModeLabel(mode);
      return `<article class="crm-client-card ${activeTone}" data-client-card="1" data-client-search="${escapeHtml([c.name,c.phone,c.car].filter(Boolean).join(' ').toLowerCase())}">
        <div class="crm-client-card__head">
          <div class="crm-client-avatar">${clientInitials(c)}</div>
          <div class="crm-client-title">
            <h3>${escapeHtml(c.name || 'Клиент')}</h3>
            <div>${safePhone(c.phone) ? `<a href="tel:${safePhone(c.phone)}">${escapeHtml(c.phone)}</a>` : 'Телефон не указан'}${c.car ? ' · ' + escapeHtml(c.car) : ''}</div>
          </div>
          <span class="crm-client-state">${st.current.length ? st.current.length + ' в работе' : 'история'}</span>
        </div>
        <div class="crm-client-metrics">
          <div><b>${st.current.length}</b><span>Текущие</span></div>
          <div><b>${st.agreement.length}</b><span>Согласование</span></div>
          <div><b>${st.review.length}</b><span>Ждёт клиента</span></div>
          <div><b>${st.orders.length}</b><span>Всего</span></div>
        </div>
        <div class="crm-client-card__body">
          ${preview.length ? preview.map(o => renderMiniOrder(o, mode)).join('') : `<div class="crm-client-empty">${escapeHtml(modeName)}: заявок нет.</div>`}
        </div>
        <div class="crm-client-card__actions">
          <button type="button" class="btn btn-primary" onclick="OrderSystem.ClientsPanel.openClient(${jsArg(c.id || '')},'current')">Текущие работы</button>
          <button type="button" class="btn btn-outline" onclick="OrderSystem.ClientsPanel.openClient(${jsArg(c.id || '')},'history')">История работ</button>
        </div>
      </article>`;
    }

    function render(containerId, fromServer) {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (fromServer !== false && window.DB?.Clients?.refreshFromServer) {
        const clients0 = DB.Clients.getAll(q);
        if (!clients0.length) {
          el.innerHTML = `<div class="admin-pane active admin-clients-pane" style="padding:0"><div class="admin-page-title">👥 Клиенты</div><div class="crm-client-loading">⏳ Загружаем список клиентов…</div></div>`;
        }
        window.DB.Clients.refreshFromServer(q).then(() => render(containerId, false)).catch(() => render(containerId, false));
        return;
      }
      const clients = DB.Clients.getAll(q);
      const currentRole = String(window.App?.getState?.()?.user?.role || '').toLowerCase();
      const canCreateClient = ['sto','admin','owner'].includes(currentRole);
      const enriched = clients.map(c => ({ c, st: clientStats(c) }));
      const active = enriched.filter(x => x.st.current.length).length;
      const agreement = enriched.reduce((n,x)=>n+x.st.agreement.length,0);
      const awaitingReview = enriched.reduce((n,x)=>n+x.st.review.length,0);
      const historyTotal = enriched.reduce((n,x)=>n+x.st.history.length,0);
      const filtered = enriched.filter(x => clientMatchesMode(x.st, mode)).map(x => x.c);
      const activeModeLabel = clientModeLabel(mode);
      el.innerHTML = `
        <div class="admin-pane active admin-clients-pane">
          <div class="admin-clients-head">
            <div>
              <div class="admin-page-title" style="margin:0">👥 Клиенты <span>(${clients.length})</span></div>
              <div class="admin-clients-sub">Карточка клиента, текущие работы, история, согласование запчастей/услуг и общение по этапам в одном месте.</div>
            </div>
            <div class="admin-clients-tools">
              <input class="admin-search" placeholder="🔍 Клиент, телефон, авто..." value="${escapeHtml(q)}" oninput="OrderSystem.ClientsPanel.search(this.value)">
              ${canCreateClient ? `<button type="button" class="btn btn-primary" onclick="OrderSystem.ClientsPanel.openNew()">+ Клиент</button>` : ''}
            </div>
          </div>
          <div class="crm-client-stats">
            ${[[clients.length,'Клиентов','👥'],[active,'В работе','🔧'],[agreement,'Согласование','🧩'],[awaitingReview,'Ждёт клиента','⭐']].map(([v,l,i])=>`<div class="crm-client-stat"><span>${i}</span><b>${v}</b><em>${l}</em></div>`).join('')}
          </div>
          <div class="crm-client-modebar crm-client-modebar--filters" role="tablist" aria-label="Фильтр клиентов">
            <button type="button" class="${mode === 'all' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.setMode('all')">👥 Все (${clients.length})</button>
            <button type="button" class="${mode === 'current' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.setMode('current')">🔧 В работе (${active})</button>
            <button type="button" class="${mode === 'agreement' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.setMode('agreement')">🧩 Согласование (${agreement})</button>
            <button type="button" class="${mode === 'awaiting' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.setMode('awaiting')">⭐ Ждёт клиента (${awaitingReview})</button>
            <button type="button" class="${mode === 'history' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.setMode('history')">📚 История (${historyTotal})</button>
          </div>
          <div class="crm-client-grid">
            ${filtered.map(renderClientCard).join('') || `<div class="crm-client-empty crm-client-empty--wide">${escapeHtml(activeModeLabel)}: клиентов нет.</div>`}
          </div>
        </div>`;
    }

    function search(nextQ) { q = nextQ || ''; render('admin-panes', false); }
    function setMode(nextMode) { mode = normalizeClientMode(nextMode); render('admin-panes', false); }

    function openClient(id, nextMode) {
      const c = DB.Clients.get(id) || DB.Clients.getAll('').find(x => String(x.id || '') === String(id || ''));
      if (!c) return;
      const view = normalizeClientMode(nextMode);
      const st = clientStats(c);
      const list = clientOrdersForMode(st, view);
      const viewLabel = clientModeLabel(view);
      let el = document.getElementById('client-modal');
      if (!el) {
        el = document.createElement('div');
        el.id = 'client-modal';
        el.className = 'cmodal-overlay';
        el.addEventListener('click', function(e){ if (e.target === el) { window.__closeLayeredModal?.('client-modal','client-modal'); } });
        document.body.appendChild(el);
        setTimeout(()=>{try{window.applyPhoneMasks(el);}catch(_e){}},30);
      }
      el.dataset.clientId = String(c.id || '');
      el.dataset.clientView = view;
      syncClientHistory(c);
      el.innerHTML = `<div class="cmodal-box client-modal-shell crm-client-detail" style="max-width:820px;max-height:88vh;overflow-y:auto">
        <div class="crm-client-detail__head">
          <div class="crm-client-avatar crm-client-avatar--lg">${clientInitials(c)}</div>
          <div>
            <div class="cmodal-title" style="margin:0">${escapeHtml(c.name || 'Клиент')}</div>
            <div class="crm-client-detail__meta">${safePhone(c.phone) ? `<a href="tel:${safePhone(c.phone)}">${escapeHtml(c.phone)}</a>` : 'Телефон не указан'}${c.car ? ' · ' + escapeHtml(c.car) : ''}</div>
          </div>
          <button onclick="window.__closeLayeredModal?.('client-modal','client-modal')" class="owiz-close" style="position:static;margin-left:auto">×</button>
        </div>
        <div class="crm-client-metrics crm-client-metrics--detail">
          <div><b>${st.current.length}</b><span>Текущие</span></div>
          <div><b>${st.agreement.length}</b><span>Запчасти/услуги</span></div>
          <div><b>${st.review.length}</b><span>Ожидание отзыва</span></div>
          <div><b>${fmtPrice(st.spent)}</b><span>История оплат</span></div>
        </div>
        ${renderClientHistorySummary(st)}
        <div class="crm-client-modebar crm-client-modebar--modal">
          <button type="button" class="${view === 'current' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.openClient(${jsArg(c.id || '')},'current')">🔧 Текущие</button>
          <button type="button" class="${view === 'agreement' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.openClient(${jsArg(c.id || '')},'agreement')">🧩 Согласование</button>
          <button type="button" class="${view === 'awaiting' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.openClient(${jsArg(c.id || '')},'awaiting')">⭐ Ждёт клиента</button>
          <button type="button" class="${view === 'history' ? 'active' : ''}" onclick="OrderSystem.ClientsPanel.openClient(${jsArg(c.id || '')},'history')">📚 История</button>
        </div>
        <div class="crm-client-detail__orders">
          ${list.length ? list.map(o => renderMiniOrder(o, view)).join('') : `<div class="crm-client-empty">${escapeHtml(viewLabel)}: заявок нет.</div>`}
        </div>
        <div class="cmodal-actions crm-client-detail__actions">
          <button class="btn btn-primary" onclick="window.__closeLayeredModal?.('client-modal','client-modal');OrderSystem.Wizard.open({clientId:${jsArg(c.id)},clientName:${jsArg(c.name||'')},clientPhone:${jsArg(c.phone||'')},clientCar:${jsArg(c.car||'')},source:'sto_client_card',stoScoped:true,status:'process'})">+ Новая заявка</button>
          ${safePhone(c.phone) ? `<a href="tel:${safePhone(c.phone)}" class="btn btn-outline">📞 Позвонить</a>` : ''}
        </div>
      </div>`;
      if (window.App?.LayerManager && !window.App.LayerManager.open('client-modal') && window.App.LayerManager.isOpen('client-modal')) return;
      el.classList.add('open');
    }
    function openDetail(id) { openClient(id, 'current'); }

    function openNew() {
      let el = document.getElementById('new-client-modal');
      if (!el) {
        el = document.createElement('div');
        el.id = 'new-client-modal';
        el.className = 'cmodal-overlay';
        el.addEventListener('click', function(e){ if (e.target === el) { window.__closeLayeredModal?.('new-client-modal','new-client'); } });
        document.body.appendChild(el); setTimeout(()=>{try{window.applyPhoneMasks(el);}catch(_e){}},30);
      }
      el.innerHTML = `
        <div class="cmodal-box new-client-modal-shell" style="max-width:420px">
          <div class="cmodal-title">+ Новый клиент</div>
          <div class="owiz-form" style="margin-bottom:16px">
            ${[['nc-name','Имя','text','Алексей Иванов'],['nc-phone','Телефон','tel','+7 (___) ___ __ __'],['nc-car','Автомобиль','text','Toyota Camry 2018']].map(function(f){ const isPhone=f[0]==='nc-phone'; return `<div class="owiz-field"><label>${f[1]}</label><input class="owiz-input" id="${f[0]}" type="${f[2]}" placeholder="${f[3]}" ${isPhone?"inputmode='numeric' onfocus=\"if(!this.value)this.value='+7 '\" oninput=\"if(window.App?.phoneInputHandler)App.phoneInputHandler({target:this})\"":''}></div>`; }).join('')}
          </div>
          <div class="cmodal-actions"><button class="btn btn-outline" onclick="window.__closeLayeredModal?.('new-client-modal','new-client')">Отмена</button><button class="btn btn-primary" onclick="OrderSystem.ClientsPanel.saveNew()">Сохранить</button></div>
        </div>`;
      if (window.App?.LayerManager && !window.App.LayerManager.open('new-client') && window.App.LayerManager.isOpen('new-client')) return;
      el.classList.add('open');
    }

    async function saveNew() {
      const name = (document.getElementById('nc-name')||{}).value || '';
      const phone = window.App?.phoneRaw ? App.phoneRaw((document.getElementById('nc-phone')||{}).value||'') : ((document.getElementById('nc-phone')||{}).value||'').replace(/[^\d+]/g,'');
      const car = (document.getElementById('nc-car')||{}).value || '';
      if (!name || !phone) { if(window.showToast) showToast('Заполните имя и телефон','error'); return; }
      try {
        const created = await DB.Clients.create({ name:name, phone:phone, car:car });
        window.__closeLayeredModal?.('new-client-modal','new-client');
        mode = 'all';
        render('admin-panes', false);
        if (window.showToast) showToast('Клиент добавлен');
        if (created && created.id) setTimeout(function(){ try { openClient(created.id, 'all'); } catch(_e) {} }, 80);
      } catch (e) {
        if (window.showToast) showToast(e && e.message ? e.message : 'Не удалось создать клиента', 'error');
      }
    }

    return { render, search, setMode, openClient, openDetail, openNew, saveNew };
  })();

  const api = { Wizard, Detail, ClientsPanel };
  window.OrderSystem = api;
  return api;
})();
