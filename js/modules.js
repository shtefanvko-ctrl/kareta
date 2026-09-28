/* ══════════════════════════════════════════
   KARETA.KZ — Modules: Booking, Chat, Admin
══════════════════════════════════════════ */

/* ─────────────────────────────────────────
   BOOKING MODULE
───────────────────────────────────────── */
const Booking = (() => {

  let step = 1;
  const data = { services: [], date: null, dateLabel: null, dateIso: null, time: null, timeMode: 'exact', name: '', phone: '', car: '', clientVehicleId: '', comment: '', activeCategoryId: '', showCategoryBrowser: true, _prefillSvc: null, _step4Phase: 'phone', vehicleDraft: { brand: '', model: '', year: '', plate: '', vin: '', color: '' } };

  const SERVICES_FALLBACK = [
    { id: 'gen',    icon: '⌁', name: 'Генераторы', label: 'Генератор', cat: 'electric', active: true, priceLabel: 'от 1 500 ₸', timeLabel: 'от 1 часа', shortDesc: 'Восстанавливаем генераторы любых марок без замены агрегата.' },
    { id: 'start',  icon: '⌁', name: 'Стартеры', label: 'Стартер', cat: 'electric', active: true, priceLabel: 'от 1 500 ₸', timeLabel: 'от 1 часа', shortDesc: 'Ремонт и восстановление стартеров с гарантией на работы.' },
    { id: 'wire',   icon: '🔌', name: 'Автопроводка', label: 'Проводка', cat: 'electric', active: true, priceLabel: 'от 3 000 ₸', timeLabel: 'от 1 часа', shortDesc: 'Диагностика и ремонт любых электрических проблем авто.' },
    { id: 'alarm',  icon: '◌', name: 'Сигнализации', label: 'Сигнализация', cat: 'security', active: true, priceLabel: 'от 8 000 ₸', timeLabel: 'от 2 часов', shortDesc: 'Установка, настройка и ремонт охранных систем.' },
    { id: 'diag',   icon: '⌕', name: 'Диагностика', label: 'Диагностика', cat: 'electric', active: true, priceLabel: 'от 3 000 ₸', timeLabel: '30 мин', shortDesc: 'Компьютерная и ручная диагностика электрики автомобиля.' },
    { id: 'other',  icon: '⌁', name: 'Другое', label: 'Другое', cat: 'other', active: true, priceLabel: 'Уточнить', timeLabel: 'По согласованию', shortDesc: 'Редкие и нестандартные задачи, которые нужно обсудить отдельно.' },
  ];
  const BOOKING_CATEGORY_META = {
    electric: { id:'electric', icon:'⌁', label:'Электрика', color:'#f59e0b', desc:'Генераторы, стартеры, проводка и автоэлектрика.' },
    audio:    { id:'audio', icon:'🎵', label:'Автозвук', color:'#a855f7', desc:'Автозвук, мультимедиа, подключение и настройка.' },
    body:     { id:'body', icon:'▱', label:'Кузов', color:'#3b82f6', desc:'Кузовные элементы, свет и внешнее оборудование.' },
    chassis:  { id:'chassis', icon:'▱', label:'Ходовая', color:'#22c55e', desc:'Подвеска, крепёж и механические узлы.' },
    engine:   { id:'engine', icon:'⌁', label:'Агрегаты', color:'#ef4444', desc:'Агрегаты, навесное и сопутствующий ремонт.' },
    security: { id:'security', icon:'◇', label:'Охрана', color:'#64748b', desc:'Сигнализации, автозапуск и охранные системы.' },
    other:    { id:'other', icon:'⌁', label:'Прочее', color:'#94a3b8', desc:'Редкие и нестандартные задачи, не вошедшие выше.' },
  };
  const BOOKING_CATEGORY_ORDER = ['electric','audio','body','chassis','engine','security','other'];
  const BOOKING_SUBCATEGORY_META = {
    electric: [
      { id:'generator', label:'Генератор', desc:'Ремонт и обслуживание генераторов', serviceIds:['gen'] },
      { id:'starter', label:'Стартер', desc:'Стартеры и пусковые узлы', serviceIds:['start'] },
      { id:'wiring', label:'Проводка', desc:'Жгуты, питание, короткие замыкания', serviceIds:['wire'] },
      { id:'diagnostics', label:'Диагностика', desc:'Проверка и поиск неисправностей', serviceIds:['diag'] },
    ],
    security: [
      { id:'alarm', label:'Сигнализации', desc:'Охранные системы и автозапуск', serviceIds:['alarm'] },
    ],
  };
  function normalizeBookingCategory(cat) {
    return cat === 'electrical' ? 'electric' : (String(cat || 'other').trim() || 'other');
  }
  function getBookingCategoryMeta(cat) {
    return BOOKING_CATEGORY_META[normalizeBookingCategory(cat)] || BOOKING_CATEGORY_META.other;
  }
  function getBookingServicesRaw() {
    const list = window.DB?.Services?.getAll?.() || SERVICES_FALLBACK;
    return list.filter(s => s.active !== false).map(s => {
      const catId = normalizeBookingCategory(s.cat);
      const subMeta = (BOOKING_SUBCATEGORY_META[catId] || []).find(item => (item.serviceIds || []).includes(String(s.id || '')));
      return {
        id: s.id,
        icon: s.icon || '⌁',
        label: s.label || s.name || s.id,
        name: s.name || s.label || s.id,
        cat: catId,
        categoryLabel: getBookingCategoryMeta(catId).label,
        subcategoryId: subMeta?.id || 'general',
        subcategoryLabel: subMeta?.label || 'Общие работы',
        priceLabel: s.priceLabel || (Number(s.basePrice || 0) > 0 ? 'от ' + Number(s.basePrice || 0).toLocaleString('ru-RU') + ' ₸' : 'Уточнить'),
        timeLabel: s.timeLabel || s.avgTime || 'По согласованию',
        shortDesc: s.shortDesc || '',
      };
    });
  }
  function getBookingServices() {
    const activeCategoryId = String(data.activeCategoryId || '').trim();
    return getBookingServicesRaw().filter(s => {
      if (activeCategoryId && s.cat !== activeCategoryId) return false;
      return true;
    });
  }
  function getBookingServicesMap() {
    const map = new Map();
    getBookingServicesRaw().forEach(service => map.set(String(service.id || '').trim(), service));
    return map;
  }
  function getBookingSelectedServicesRaw() {
    const map = getBookingServicesMap();
    return (Array.isArray(data.services) ? data.services : []).map(id => map.get(String(id || '').trim()) || null).filter(Boolean);
  }
  function syncActiveCategoryFromSelection() {
    if (data.activeCategoryId) return;
    const firstSelected = getBookingSelectedServicesRaw()[0] || null;
    if (firstSelected) data.activeCategoryId = firstSelected.cat;
  }
  function getBookingCategoryCards() {
    const services = getBookingServicesRaw();
    return BOOKING_CATEGORY_ORDER.map(catId => {
      const meta = getBookingCategoryMeta(catId);
      return {
        ...meta,
        count: services.filter(s => s.cat === catId).length,
      };
    });
  }
  function getBookingSubcategories(catId) {
    const normalized = normalizeBookingCategory(catId);
    const services = getBookingServicesRaw().filter(s => s.cat === normalized);
    const base = (BOOKING_SUBCATEGORY_META[normalized] || []).map(item => ({ ...item }));
    const known = new Set(base.map(item => item.id));
    services.forEach(service => {
      if (known.has(service.subcategoryId)) return;
      base.push({ id: service.subcategoryId, label: service.subcategoryLabel, desc: 'Услуги выбранного направления', serviceIds: [service.id] });
      known.add(service.subcategoryId);
    });
    return base.filter(item => services.some(service => service.subcategoryId === item.id));
  }

  function getDates() {
    const dates = [];
    const now = new Date();
    const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const monthNames = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    // Получаем все расписания мастеров чтобы определить занятые/выходные дни
    const allMasters = window.DB?.Masters?.getAll?.() || [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      if (d.getDay() === 0) continue; // skip Sunday
      const iso = d.toISOString().slice(0, 10);
      // День считается занятым если у ВСЕХ активных мастеров выходной или нет смены
      let anyAvailable = false;
      if (allMasters.length === 0) {
        anyAvailable = true; // нет данных — показываем все даты
      } else {
        for (const m of allMasters) {
          const sched = window.DB?.MasterSchedules?.forDate?.(m.id, iso);
          if (!sched || !sched.isDayOff) { anyAvailable = true; break; }
        }
      }
      dates.push({
        date: d,
        iso,
        label: d.getDate() + ' ' + monthNames[d.getMonth()],
        day: dayNames[d.getDay()],
        busy: !anyAvailable,
      });
    }
    return dates;
  }

  function getBusyTimesForDate(dateValue) {
    // Получаем реально занятые слоты из заказов на выбранную дату
    const allOrders = window.DB?.Orders?.getAll?.() || [];
    const busy = new Set();
    const meta = (dates_cache || []).find(d => d.label === dateValue || d.iso === dateValue) || null;
    const targetIso = meta?.iso || dateValue || '';
    const targetLabel = meta?.label || dateValue || '';
    allOrders.forEach(o => {
      const orderIso = String(o.date || '').trim();
      const orderLabel = String(o.dateLabel || '').trim();
      if ((targetIso && orderIso === targetIso) || (targetLabel && orderLabel === targetLabel)) {
        if (o.time && o.status !== 'cancelled') {
          // Нормализуем формат «9:00» vs «09:00»
          const t = String(o.time).replace(/^0/, '');
          busy.add(t);
        }
      }
    });
    return busy;
  }
  let dates_cache = [];

  const TIMES = ['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
  // BUSY_TIMES теперь вычисляется динамически через getBusyTimesForDate(), константа оставлена как запасной вариант
  const BUSY_TIMES = [];

  function render(opts) {
    const isStaff = !!(opts && opts.staffMode);
    const staffRole = isStaff && opts.staffRole ? opts.staffRole : null;
    // Render не должен сбрасывать booking-state: это делает только init().
    data._staffMode = isStaff;
    const heroLabel = isStaff ? 'Создать запись клиента' : 'Запись онлайн';
    const heroTitle = isStaff ? 'Новая запись' : 'Записаться на ремонт';
    const heroSub   = isStaff
      ? 'Заполните данные клиента — заявка появится в общей очереди.'
      : 'Выберите услугу, дату и удобный режим записи — мы подтвердим заявку по телефону.';
    const staffBadge = isStaff && staffRole
      ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
           <span class="rbadge ${staffRole.id}">${staffRole.emoji} ${staffRole.label}</span>
           <span style="font-size:12px;color:var(--text3)">Запись от имени сотрудника</span>
         </div>`
      : '';
    return `<div class="page">
      <div class="booking-hero">
        <div class="container">
          ${staffBadge}
          <div class="t-lbl reveal">${heroLabel}</div>
          <h1 class="sec-title t-disp reveal" style="font-size:clamp(32px,5vw,52px);margin:10px 0 12px" data-delay="80">${heroTitle}</h1>
          <div class="sec-line reveal" data-delay="130"></div>
          <p style="font-size:14px;color:var(--text2);margin-top:18px;max-width:480px" class="reveal" data-delay="180">
            ${heroSub}
          </p>
        </div>
      </div>
      <section>
        <div class="container">
          <div id="booking-steps-bar" class="booking-steps reveal"></div>
          <div class="booking-layout">
            <div>
              <div id="booking-form-area"></div>
            </div>
            <div class="booking-summary">
              <div class="bsummary-card card">
                <div class="bsummary-title">▤ Ваша запись</div>
                <div id="booking-summary-content"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>`;
  }

  function isValidPhoneValue(v) {
    if (window.App?.phoneRaw) {
      const raw = window.App.phoneRaw(v);
      return String(raw || '').replace(/\D/g, '').length === 11;
    }
    return String(v || '').replace(/\D/g, '').length >= 11;
  }

  function syncPrefillServiceState() {
    const current = Array.isArray(data.services) ? data.services.filter(Boolean) : [];
    data.services = Array.from(new Set(current.map(v => String(v || '').trim()).filter(Boolean)));
    if (data._prefillSvc && data.services.includes(data._prefillSvc)) data._prefillSvc = null;
    if (!data.activeCategoryId && data.services.length) {
      const firstSelected = getBookingServicesMap().get(String(data.services[0] || '').trim()) || null;
      if (firstSelected) data.activeCategoryId = firstSelected.cat;
    }
  }

  function hasGarageVehicles() {
    try { return (window.DB?.Vehicles?.getMine?.() || []).length > 0; } catch(_e) { return false; }
  }

  function normalizeVehicleDraft() {
    if (!data.vehicleDraft || typeof data.vehicleDraft !== 'object') {
      data.vehicleDraft = { brand: '', model: '', year: '', plate: '', vin: '', color: '' };
    }
    const next = {};
    ['brand','model','year','plate','vin','color'].forEach(key => {
      next[key] = String(data.vehicleDraft[key] || '').trim();
    });
    if (next.plate) next.plate = next.plate.toUpperCase();
    if (next.vin) next.vin = next.vin.toUpperCase();
    data.vehicleDraft = next;
    return next;
  }

  function buildVehicleTitle(vehicle) {
    if (!vehicle) return '';
    const brand = String(vehicle.brand || '').trim();
    const model = String(vehicle.model || '').trim();
    const title = [brand, model].filter(Boolean).join(' ').trim();
    return title || String(vehicle.title || '').trim() || String(vehicle.plate || '').trim();
  }

  function getSelectedVehicle() {
    const vehicleId = String(data.clientVehicleId || '').trim();
    if (!vehicleId) return null;
    try { return window.DB?.Vehicles?.get?.(vehicleId) || null; } catch(_e) { return null; }
  }

  function getEffectiveVehicleTitle() {
    const selectedVehicle = getSelectedVehicle();
    if (selectedVehicle) return buildVehicleTitle(selectedVehicle);
    const draft = normalizeVehicleDraft();
    return [draft.brand, draft.model].filter(Boolean).join(' ').trim() || String(data.car || '').trim();
  }

  function hasVehicleSelection() {
    if (String(data.clientVehicleId || '').trim()) return true;
    const draft = normalizeVehicleDraft();
    return !!(draft.brand && draft.model);
  }

  function canProceedFromStep(targetStep) {
    if (targetStep <= 1) return true;
    syncPrefillServiceState();
    if (targetStep === 2) return data.services.length > 0;
    if (targetStep === 3) return !!(data.dateIso || data.date) && (data.timeMode !== 'exact' || !!data.time);
    if (targetStep === 4) return hasVehicleSelection();
    if (targetStep === 5) {
      const u = window.App?.getState?.()?.user || window._appState?.user || null;
      return hasVehicleSelection() && (!!u || isValidPhoneValue(data.phone));
    }
    return true;
  }

  function findDateMeta(label) {
    return (dates_cache || []).find(function(d){ return d.label === label; }) || null;
  }

  function hydrateClientFields() {
    // In staff mode, fields stay blank for client info entry
    if (data._staffMode) return;
    const currentUser = window.App?.getState?.().user || window._appState?.user || null;
    const stored = window.App?.getStoredProfile?.() || {};
    const rememberedPhone = window.App?.getRememberedPhone?.() || '';

    const resolvedName = (currentUser?.name || stored.name || data.name || '').trim();
    const resolvedVehicle = window.DB?.Vehicles?.getDefault?.() || null;
    const resolvedCar = (buildVehicleTitle(resolvedVehicle) || currentUser?.car || stored.car || data.car || '').trim();
    const resolvedPhone = window.App?.phoneRaw
      ? window.App.phoneRaw(currentUser?.phone || stored.phone || rememberedPhone || data.phone || '')
      : (currentUser?.phone || stored.phone || rememberedPhone || data.phone || '').trim();

    data.name = resolvedName;
    data.car = resolvedCar;
    if (resolvedVehicle?.id && !data.clientVehicleId) {
      data.clientVehicleId = resolvedVehicle.id;
      normalizeVehicleDraft();
      data.vehicleDraft.brand = String(resolvedVehicle.brand || '').trim();
      data.vehicleDraft.model = String(resolvedVehicle.model || '').trim();
      data.vehicleDraft.year = String(resolvedVehicle.year || '').trim();
      data.vehicleDraft.plate = String(resolvedVehicle.plate || '').trim();
      data.vehicleDraft.vin = String(resolvedVehicle.vin || '').trim();
      data.vehicleDraft.color = String(resolvedVehicle.color || '').trim();
    }
    data.phone = resolvedPhone;

    const nameEl = document.getElementById('bf-name');
    if (nameEl && nameEl.value !== data.name) nameEl.value = data.name;

    const phoneEl = document.getElementById('bf-phone');
    if (phoneEl) {
      const formattedPhone = window.App?.formatPhone ? window.App.formatPhone(data.phone) : data.phone;
      if (phoneEl.value !== formattedPhone) phoneEl.value = formattedPhone;
      if (data.phone) {
        phoneEl.removeAttribute('readonly');
        phoneEl.dataset.locked = '0';
      }
    }

    const nextBtn = document.getElementById('bf-next');
    if (nextBtn) {
      const phoneOk = isValidPhoneValue(data.phone);
      nextBtn.disabled = !String(data.name || '').trim() || !phoneOk;
    }
  }

  // Возвращает true если пользователь НЕ авторизован (гость) или у него нет имени/телефона.
  // Для гостей шаг «Данные» обязателен; для авторизованных — пропускается.
  function isGuestMode() {
    if (data._staffMode) return true; // staff всегда заполняет данные клиента вручную
    const u = window.App?.getState?.().user || window._appState?.user || null;
    return !u || !String(u.name || '').trim() || !String(u.phone || '').trim();
  }

  function init(prefill) {
    data.services = []; data.date = null; data.dateLabel = null; data.dateIso = null; data.time = null; data.timeMode = 'exact';
    data.name = ''; data.phone = ''; data.car = ''; data.clientVehicleId = ''; data.comment = '';
    data.vehicleDraft = { brand: '', model: '', year: '', plate: '', vin: '', color: '' };
    data.activeCategoryId = '';
    data.showCategoryBrowser = true;
    data._prefillSvc = null;
    data._step4Phase = 'phone';
    step = 1;
    if (prefill) {
      if (Array.isArray(prefill.services) && prefill.services.length) {
        data.services = prefill.services.map(v => String(v || '').trim()).filter(Boolean);
      }
      if (prefill.svc) {
        data._prefillSvc = String(prefill.svc || '').trim();
        if (data._prefillSvc && !data.services.includes(data._prefillSvc)) data.services = [data._prefillSvc, ...data.services];
      }
      if (prefill.car) data.car = prefill.car;
      if (prefill.vehicleDraft && typeof prefill.vehicleDraft === 'object') {
        data.vehicleDraft = { ...data.vehicleDraft, ...prefill.vehicleDraft };
      }
      if (prefill.clientVehicleId || prefill.vehicleId) data.clientVehicleId = prefill.clientVehicleId || prefill.vehicleId;
      if (prefill.comment) data.comment = prefill.comment;
      if (prefill.serviceCategoryId || prefill.categoryId) data.activeCategoryId = normalizeBookingCategory(prefill.serviceCategoryId || prefill.categoryId || '');
      if (data._prefillSvc) {
        const prefillServiceMeta = getBookingServicesRaw().find(s => s.id === data._prefillSvc) || null;
        if (prefillServiceMeta) {
          data.activeCategoryId = prefillServiceMeta.cat;
        }
      }
      if (data.services.length || data._prefillSvc) {
        step = 2;
        data.showCategoryBrowser = false;
      }
      if (data.services.length && !data.activeCategoryId) {
        const firstSelected = getBookingServicesMap().get(String(data.services[0] || '').trim()) || null;
        if (firstSelected) data.activeCategoryId = firstSelected.cat;
      }
    }
    renderStep();
    hydrateClientFields();
    renderSummary();
  }

  function renderStepsBar() {
    const bar = document.getElementById('booking-steps-bar');
    if (!bar) return;
    // Всегда 4 шага: шаг «Данные» (step=4) удалён
    // Внутренний step=5 отображается как позиция 4 в баре
    const steps = ['Категория и прайс', 'Дата и время', 'Авто', 'Контакты'];
    const barStep = step >= 5 ? 5 : step;
    bar.innerHTML = steps.map((s, i) => {
      const n = i + 1;
      const cls = n < barStep ? 'bstep done' : n === barStep ? 'bstep active' : 'bstep';
      return `${i > 0 ? `<div class="bstep-line"></div>` : ''}
        <div class="${cls}">
          <div class="bstep-num">${n < barStep ? '✓' : n}</div>
          <div class="bstep-label">${s}</div>
        </div>`;
    }).join('');
  }


  function bindBookingAreaEvents(area) {
    if (!area) return;

    area.onclick = function(e) {
      const actionEl = e.target.closest('[data-booking-action]');
      if (!actionEl || !area.contains(actionEl)) return;
      const action = String(actionEl.dataset.bookingAction || '').trim();
      const value = actionEl.dataset.bookingValue;
      if (!action) return;
      e.preventDefault();

      switch (action) {
        case 'clear-services': clearServices(); return;
        case 'remove-service': removeService(value); return;
        case 'back-categories': backToCategories(); return;
        case 'select-category': selectCategory(value); return;
        case 'clear-prefill': _clearPrefillSvc(); return;
        case 'select-priced-service': selectPricedService(value); return;
        case 'open-service-details':
          if (typeof window.openServiceDetailsModal === 'function') window.openServiceDetailsModal(value);
          return;
        case 'next': next(); return;
        case 'prev':
          if (step === 4 && data._step4Phase === 'otp') {
            data._step4Phase = 'phone';
            renderStep();
          } else {
            prev();
          }
          return;
        case 'step4-send-otp':
          data._step4Phase = 'otp';
          renderStep();
          return;
        case 'select-date': selectDate(value); return;
        case 'select-time-mode': selectTimeMode(value); return;
        case 'select-time': selectTime(value); return;
        case 'pick-vehicle': pickVehicle(value); return;
        case 'open-vehicle-modal':
          if (typeof window.openVehicleAddModal === 'function') window.openVehicleAddModal();
          return;
        case 'save-draft-vehicle': saveDraftVehicle(); return;
        default: return;
      }
    };

    area.oninput = function(e) {
      const bookingFieldEl = e.target.closest('[data-booking-field]');
      if (bookingFieldEl && area.contains(bookingFieldEl)) {
        if (bookingFieldEl.dataset.bookingField === 'phone' && window.App?.phoneInputHandler) {
          window.App.phoneInputHandler({ target: bookingFieldEl });
        }
        setField(bookingFieldEl.dataset.bookingField, bookingFieldEl.value);
        return;
      }
      const vehicleFieldEl = e.target.closest('[data-vehicle-field]');
      if (vehicleFieldEl && area.contains(vehicleFieldEl)) {
        setVehicleField(vehicleFieldEl.dataset.vehicleField, vehicleFieldEl.value);
      }
    };

    area.onfocusin = function(e) {
      const phoneEl = e.target.closest('[data-booking-field="phone"]');
      if (phoneEl && area.contains(phoneEl) && !phoneEl.value) {
        phoneEl.value = '+7 ';
      }
    };
  }

  function renderStep() {
    syncPrefillServiceState();
    renderStepsBar();
    const area = document.getElementById('booking-form-area');
    if (!area) return;

    if (step === 1) {
      const _prefillSvc = data._prefillSvc || null;
      const categories = getBookingCategoryCards();
      const selectedCategoryId = String(data.activeCategoryId || '').trim();
      const isBrowsingCategories = !!data.showCategoryBrowser || !selectedCategoryId;
      const selectedCategoryMeta = (!isBrowsingCategories && selectedCategoryId) ? getBookingCategoryMeta(selectedCategoryId) : null;
      const visibleServices = getBookingServices();
      const allServicesRaw = getBookingServicesRaw();
      const selectedServicesRaw = getBookingSelectedServicesRaw();
      area.innerHTML = `
        <div class="bform-card card booking-step-price">
          ${selectedServicesRaw.length ? `<div class="booking-multi-picked"><div class="booking-multi-picked__head"><div class="booking-multi-picked__title">Выбрано услуг: ${selectedServicesRaw.length}</div><button type="button" class="booking-picked-clear" data-booking-action="clear-services">Очистить всё</button></div><div class="booking-multi-picked__list">${selectedServicesRaw.map(s=>`<button type="button" class="booking-picked-chip" title="Убрать услугу" data-booking-action="remove-service" data-booking-value="${s.id}">${s.icon||'⌁'} ${s.label} <span>×</span></button>`).join('')}</div><div class="booking-multi-picked__note">Нажмите на карточку или крестик, чтобы снять ненужную услугу.</div></div>` : ''}

          <div class="bform-section">
            <div class="bform-section-title">Категория ремонта</div>
            ${selectedCategoryMeta ? `<button type="button" class="booking-prefill-note" data-booking-action="back-categories"><span class="booking-prefill-note__emoji">←</span><div><div class="booking-prefill-note__title">Назад к категориям</div><div class="booking-prefill-note__desc">Вернуться к списку категорий и при этом сохранить уже выбранные услуги.</div></div></button>` : ''}
            <div class="svc-cat-nav-grid svc-cat-nav-grid--page booking-categories-grid ${selectedCategoryMeta ? 'is-hidden-by-prefill' : ''}">
              ${categories.map(cat => `<button type="button" class="svc-cat-nav-card ${selectedCategoryId === cat.id ? 'active' : ''} ${cat.count === 0 ? 'is-empty' : ''}" data-svc-cat="${cat.id}" style="--fc:${cat.color}" data-booking-action="select-category" data-booking-value="${cat.id}"><span class="svc-cat-nav-card__emoji">${cat.icon}</span><div class="svc-cat-nav-card__body"><div class="svc-cat-nav-card__title">${cat.label}</div><div class="svc-cat-nav-card__desc">${cat.desc}</div></div><span class="svc-cat-nav-card__count">${cat.count}</span></button>`).join('')}
            </div>
          </div>

          ${selectedCategoryMeta ? `<div class="bform-section">
            <div class="bform-section-title">Прайс и выбор услуг</div>
            ${_prefillSvc ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:var(--ui-radius-md,10px);margin-bottom:12px;font-size:13px"><span style="font-size:18px">${allServicesRaw.find(s=>s.id===_prefillSvc)?.icon||'⌁'}</span><div style="flex:1"><div style="font-weight:700">${allServicesRaw.find(s=>s.id===_prefillSvc)?.label||_prefillSvc}</div><div style="font-size:11px;color:var(--text3)">Услуга выбрана. <button type="button" style="border:none;background:none;color:var(--orange);cursor:pointer;font-size:11px;padding:0" data-booking-action="clear-prefill">Сбросить выбор</button></div></div></div>` : ''}
            ${selectedServicesRaw.length ? `<div class="booking-empty-services" style="margin-bottom:12px">Можно добавить ещё услуги из этой или другой категории. Уже выбранные позиции сохраняются.</div>` : `<div class="booking-empty-services" style="margin-bottom:12px">Можно выбрать несколько услуг в одной заявке.</div>`}
            ${visibleServices.length ? `<div class="svc-cat-nav-grid svc-cat-nav-grid--page booking-service-grid">${visibleServices.map(s => {
              const isSelected = data.services.includes(s.id);
              const countLabel = s.priceLabel || '→';
              const descLabel = s.shortDesc || s.subcategoryLabel || selectedCategoryMeta.desc;
              return `<button type="button" class="svc-cat-nav-card booking-service-card ${isSelected ? 'active' : ''}" id="booking-svc-${s.id}" data-svc-cat="${s.cat}" style="--fc:${selectedCategoryMeta.color}" data-booking-action="select-priced-service" data-booking-value="${s.id}">
                <span class="svc-cat-nav-card__emoji">${s.icon || selectedCategoryMeta.icon}</span>
                <div class="svc-cat-nav-card__body">
                  <div class="svc-cat-nav-card__title">${s.name}</div>
                  <div class="svc-cat-nav-card__desc">${descLabel}</div>
                  <div class="booking-service-card__meta">${s.subcategoryLabel ? `<span>${s.subcategoryLabel}</span>` : ''}<span>⏱ ${s.timeLabel || '—'}</span></div>
                </div>
                <span class="svc-cat-nav-card__count">${isSelected ? '✓' : countLabel}</span>
              </button>
              <div class="booking-service-actions">
                <button class="btn ${isSelected ? 'btn-outline' : 'btn-primary'}" data-booking-action="select-priced-service" data-booking-value="${s.id}">${isSelected ? '✕ Снять' : '+ Добавить'}</button>
                <button class="btn btn-outline" data-booking-action="open-service-details" data-booking-value="${s.id}">Подробнее</button>
              </div>`;
            }).join('')}</div>` : `<div class="booking-empty-services">В выбранной категории пока нет активных услуг.</div>`}
          </div>` : `${selectedServicesRaw.length ? `<div class="booking-empty-services">Можно перейти дальше с уже выбранными услугами или открыть ещё одну категорию.</div>` : `<div class="booking-empty-services">Сначала выберите категорию ремонта.</div>`}`}

          <div class="bform-nav">
            <button class="btn btn-primary" data-booking-action="next" ${data.services.length === 0 ? 'disabled' : ''}>
              Далее →
            </button>
          </div>
        </div>`;
    }

    else if (step === 2) {
      const dates = getDates();
      dates_cache = dates;
      const busySlots = (data.dateIso || data.dateLabel || data.date) ? getBusyTimesForDate(data.dateIso || data.dateLabel || data.date) : new Set();
      const timeModeMeta = {
        exact: { icon: '🕒', title: 'Точное время', desc: 'Выберите конкретный свободный слот записи.' },
        nearest: { icon: '⌁', title: 'Ближайшее доступное', desc: 'Подберём ближайшее свободное время после подтверждения.' },
        call_me: { icon: '○', title: 'Свяжитесь со мной', desc: 'Уточним удобное время по телефону.' },
      };
      const timeMode = String(data.timeMode || 'exact');
      area.innerHTML = `
        <div class="bform-card card">
          <div class="bform-section">
            <div class="bform-section-title">Выберите дату</div>
            <div class="date-grid">
              ${dates.slice(0, 12).map(d => `
                <div class="date-btn ${(data.dateIso === d.iso || data.date === d.label) ? 'selected' : ''} ${d.busy ? 'disabled' : ''}"
                     data-booking-action="select-date" data-booking-value="${d.label}">
                  <div class="date-day">${d.day}</div>
                  <div>${d.label}</div>
                </div>`).join('')}
            </div>
          </div>
          ${data.date ? `
          <div class="bform-section">
            <div class="bform-section-title">Как записать по времени</div>
            <div class="booking-time-mode-grid">
              ${Object.entries(timeModeMeta).map(([mode, meta]) => `
                <button type="button" class="booking-time-mode-card ${timeMode === mode ? 'selected' : ''}" data-booking-action="select-time-mode" data-booking-value="${mode}">
                  <span class="booking-time-mode-card__emoji">${meta.icon}</span>
                  <span class="booking-time-mode-card__body">
                    <span class="booking-time-mode-card__title">${meta.title}</span>
                    <span class="booking-time-mode-card__desc">${meta.desc}</span>
                  </span>
                  <span class="booking-time-mode-card__check">${timeMode === mode ? '✓' : ''}</span>
                </button>`).join('')}
            </div>
          </div>
          ${timeMode === 'exact' ? `
          <div class="bform-section">
            <div class="bform-section-title">Выберите время</div>
            <div class="time-grid">
              ${TIMES.map(t => `
                <div class="time-btn ${data.time === t ? 'selected' : ''} ${busySlots.has(t) ? 'busy' : ''}"
                     data-booking-action="select-time" data-booking-value="${t}">
                  ${t}
                </div>`).join('')}
            </div>
          </div>` : `
          <div class="bform-section">
            <div class="booking-time-mode-note">
              ${timeMode === 'nearest' ? 'Мы подберём ближайшее свободное время и подтвердим его после оформления заявки.' : 'После оформления заявки мы свяжемся с вами и согласуем удобное время записи.'}
            </div>
          </div>`}` : ''}
          <div class="bform-nav">
            <button class="btn btn-ghost" data-booking-action="prev">← Назад</button>
            <button class="btn btn-primary" data-booking-action="next" ${!(data.dateIso || data.date) || (timeMode === 'exact' && !data.time) ? 'disabled' : ''}>
              Далее →
            </button>
          </div>
        </div>`;
    }

    else if (step === 3) {
      const u = window.App?.getState?.()?.user || window._appState?.user || null;
      const cars = window.DB?.Vehicles?.getMine?.() || [];

      // Автовыбор основного авто если ещё не выбрано
      if (cars.length && !data.clientVehicleId) {
        const defV = cars.find(v => v.isDefault) || cars[0];
        if (defV) {
          data.clientVehicleId = String(defV.id || '');
          data.vehicleDraft.brand = String(defV.brand || '').trim();
          data.vehicleDraft.model = String(defV.model || '').trim();
          data.vehicleDraft.year  = String(defV.year  || '').trim();
          data.vehicleDraft.plate = String(defV.plate || '').trim();
          data.car = buildVehicleTitle(defV) || '';
        }
      }
      const esc = (v) => String(v || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const draft = normalizeVehicleDraft();
      const selectedVehicleId = String(data.clientVehicleId || '').trim();
      const draftTitle = [draft.brand, draft.model].filter(Boolean).join(' ');
      const hasDraft = !!(draft.brand || draft.model);

      const renderVehicleMetaPrimary = (v) => [v.year ? String(v.year) + ' г.' : '', v.plate || ''].filter(Boolean).join(' · ');

      /* ── HTML ── */
      area.innerHTML = `
        <div class="bform-card card bstep3-wrap">

          ${(u && !cars.length && !window.DB?.isReady?.()) ? `
            <div class="bv-loading"><span class="bv-loading-dot"></span>Загружаем автомобили…</div>
          ` : cars.length ? `
            <!-- ═══ Есть авто в гараже ═══ -->
            <div class="bform-section">
              <div class="bform-section-title">Выберите автомобиль</div>
              <div class="bstep3-list">
                ${cars.map(v => {
                  const vid = String(v.id || '');
                  const vtitle = esc(buildVehicleTitle(v) || 'Автомобиль');
                  const meta = esc(renderVehicleMetaPrimary(v));
                  const sel = selectedVehicleId === vid;
                  return '<button type="button" class="bstep3-car-btn ' + (sel ? 'selected' : '') + '" data-booking-action="pick-vehicle" data-booking-value="' + esc(vid) + '">'
                    + '<span class="bstep3-car-ico">' + esc(v.icon || '▱') + '</span>'
                    + '<span class="bstep3-car-main">'
                    + '<span class="bstep3-car-title">' + vtitle + '</span>'
                    + (meta ? '<span class="bstep3-car-meta">' + meta + '</span>' : '')
                    + '</span>'
                    + (sel ? '<span class="bstep3-car-check">✓</span>' : (v.isDefault ? '<span class="bstep3-car-badge">Основной</span>' : ''))
                    + '</button>';
                }).join('')}
              </div>
            </div>
            <div class="bstep3-add-row">
              <button type="button" class="btn btn-outline bstep3-add-btn" data-booking-action="open-vehicle-modal">
                ➕ Добавить новый автомобиль
              </button>
            </div>
          ` : `
            <!-- ═══ Нет авто — форма ввода ═══ -->
            <div class="bform-section">
              <div class="bform-section-title">Ваш автомобиль</div>
              <p style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.5">
                ${u ? 'Карточка сохранится в гараже после подтверждения.' : 'Введите марку и модель — карточка создастся после подтверждения номера.'}
              </p>
              <div class="bform-row">
                <div class="bform-group">
                  <label class="bform-label">Марка <span style="color:#ef4444">*</span></label>
                  <input class="bform-input" id="bv-brand" value="${esc(draft.brand)}" placeholder="Toyota" data-vehicle-field="brand" autocomplete="off">
                </div>
                <div class="bform-group">
                  <label class="bform-label">Модель <span style="color:#ef4444">*</span></label>
                  <input class="bform-input" id="bv-model" value="${esc(draft.model)}" placeholder="Camry" data-vehicle-field="model" autocomplete="off">
                </div>
              </div>


              <!-- Живая превью-карточка -->
              <div id="bv-preview" class="bstep3-preview-wrap" style="${hasDraft ? '' : 'display:none'}">
                <div class="bform-section-title" style="margin-top:16px;margin-bottom:8px">Превью карточки</div>
                <div class="bstep3-car-btn selected" style="pointer-events:none">
                  <span class="bstep3-car-ico">▱</span>
                  <span class="bstep3-car-main">
                    <span class="bstep3-car-title" id="bv-prev-title">${esc(draftTitle || '—')}</span>
                    <span class="bstep3-car-meta" id="bv-prev-sub">${esc([draft.year ? draft.year + ' г.' : '', draft.plate].filter(Boolean).join(' · ') || 'Карточка будет создана')}</span>
                  </span>
                  <span class="bstep3-car-check">✓</span>
                </div>
              </div>
            </div>
          `}

          <div class="bform-nav">
            <button class="btn btn-ghost" data-booking-action="prev">← Назад</button>
            <button class="btn btn-primary" data-booking-action="next" ${!hasVehicleSelection() ? 'disabled' : ''}>
              Далее →
            </button>
          </div>
        </div>`;

      /* ── Логика для режима без авто (ввод черновика) ── */
      if (!cars.length) {
        const brandEl = area.querySelector('#bv-brand');
        const modelEl = area.querySelector('#bv-model');
        const yearEl  = area.querySelector('#bv-year');
        const plateEl = area.querySelector('#bv-plate');
        const preview   = area.querySelector('#bv-preview');
        const prevTitle = area.querySelector('#bv-prev-title');
        const prevSub   = area.querySelector('#bv-prev-sub');
        const nextBtn   = area.querySelector('[data-booking-action="next"]');

        const updatePreview = () => {
          const brand = brandEl?.value.trim() || '';
          const model = modelEl?.value.trim() || '';
          const year  = yearEl?.value.trim() || '';
          const plate = plateEl?.value.trim() || '';
          const title = [brand, model].filter(Boolean).join(' ');
          const sub   = [year ? year + ' г.' : '', plate].filter(Boolean).join(' · ') || 'Карточка будет создана';
          if (preview)    preview.style.display = (brand || model) ? '' : 'none';
          if (prevTitle)  prevTitle.textContent  = title || '—';
          if (prevSub)    prevSub.textContent    = sub;
          if (nextBtn)    nextBtn.disabled       = !(brand && model);
        };

        [brandEl, modelEl, yearEl, plateEl].forEach(el => el?.addEventListener('input', updatePreview));
        updatePreview();
      }

      /* ── Ждём db.pull если авто не загрузились ── */
      if (u && !cars.length) {
        let _unsub = null;
        const _retry = () => { _unsub && _unsub(); if (step === 3) renderStep(); };
        _unsub = window.DB?.on?.('db.pull', _retry);
        setTimeout(() => {
          if (step !== 3) { _unsub && _unsub(); return; }
          const fresh = window.DB?.Vehicles?.getMine?.() || [];
          if (fresh.length) { _unsub && _unsub(); renderStep(); }
        }, 2000);
      }
    }
    else if (step === 4) {
      const u = window.App?.getState?.()?.user || window._appState?.user || null;
      const esc4 = v => String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const fmtPh = u?.phone ? (window.App?.formatPhone ? window.App.formatPhone(u.phone) : u.phone) : '';

      /* ── Залогинен — показываем подтверждение ── */
      if (u) {
        area.innerHTML = `
          <div class="bform-card card">
            <div class="bform-section">
              <div class="bform-section-title">Контакты для записи</div>
              <div class="booking-auth-confirmed">
                <div class="booking-auth-confirmed__check">✓</div>
                <div class="booking-auth-confirmed__body">
                  <div class="booking-auth-confirmed__name">${esc4(u.name || 'Клиент')}</div>
                  <div class="booking-auth-confirmed__phone">${esc4(fmtPh)}</div>
                </div>
              </div>
              <p style="font-size:13px;color:var(--text3);margin-top:10px">Заявка будет оформлена на этот номер.</p>
            </div>
            <div class="bform-nav">
              <button class="btn btn-ghost" data-booking-action="prev">← Назад</button>
              <button class="btn btn-primary" data-booking-action="next">Оформить заявку →</button>
            </div>
          </div>`;

      /* ── Гость, фаза OTP ── */
      } else if (data._step4Phase === 'otp') {
        const displayPh = window.App?.formatPhone ? window.App.formatPhone(data.phone) : data.phone;
        area.innerHTML = `
          <div class="bform-card card">
            <div class="bform-section">
              <div class="bform-section-title">Введите код из SMS</div>
              <p style="font-size:13px;color:var(--text2);margin-bottom:16px;line-height:1.5">
                Код отправлен на номер <strong>${esc4(displayPh)}</strong>
              </p>
              <div class="bstep4-otp-row">
                <input class="otp-box" maxlength="1" type="tel" inputmode="numeric" pattern="[0-9]" autocomplete="one-time-code">
                <input class="otp-box" maxlength="1" type="tel" inputmode="numeric" pattern="[0-9]">
                <input class="otp-box" maxlength="1" type="tel" inputmode="numeric" pattern="[0-9]">
                <input class="otp-box" maxlength="1" type="tel" inputmode="numeric" pattern="[0-9]">
                <input class="otp-box" maxlength="1" type="tel" inputmode="numeric" pattern="[0-9]">
                <input class="otp-box" maxlength="1" type="tel" inputmode="numeric" pattern="[0-9]">
              </div>
              <div id="bf4-otp-error" style="display:none;color:#ef4444;font-size:13px;text-align:center;margin-top:4px">
                ❌ Неверный код. Попробуйте ещё раз.
              </div>
            </div>
            <div class="bform-nav">
              <button class="btn btn-ghost" data-booking-action="prev">← Назад</button>
              <button class="btn btn-primary" id="bf4-verify" disabled>Подтвердить →</button>
            </div>
          </div>`;

        /* OTP-логика */
        const boxes = [...area.querySelectorAll('.otp-box')];
        const verifyBtn = area.querySelector('#bf4-verify');
        const errEl = area.querySelector('#bf4-otp-error');

        const getCode = () => boxes.map(b => b.value).join('');
        const checkReady = () => {
          const ready = getCode().length === 6;
          if (verifyBtn) verifyBtn.disabled = !ready;
        };

        boxes.forEach((box, idx) => {
          box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '').slice(-1);
            if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
            checkReady();
          });
          box.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !box.value && idx > 0) boxes[idx - 1].focus();
          });
        });

        verifyBtn?.addEventListener('click', async () => {
          const code = getCode();
          try {
            await window.KaretaOnboardingApi.verifyCode(data.phone, code);
            if (errEl) errEl.style.display = 'none';
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Подождите…';
            // Логин без навигации — создаём/привязываем аккаунт
            try{ if (window._wizLogin) await window._wizLogin(data.phone, data.name); }catch(_e){}
            data._step4Phase = 'phone';
            next();
          } catch (_error) {
            if (errEl) errEl.style.display = 'block';
            boxes.forEach(b => b.value = '');
            boxes[0].focus();
            checkReady();
          }
        });

        setTimeout(() => boxes[0]?.focus(), 60);

      /* ── Гость, фаза phone ── */
      } else {
        const storedPh = data.phone ? (window.App?.formatPhone ? window.App.formatPhone(data.phone) : data.phone) : '';
        area.innerHTML = `
          <div class="bform-card card">
            <div class="bform-section">
              <div class="bform-section-title">Контакты для записи</div>
              <p style="font-size:13px;color:var(--text2);margin-bottom:16px;line-height:1.5">
                Введите номер телефона — пришлём код подтверждения.
              </p>
              <div class="booking-auth-fields">
                <label class="bform-label">Имя</label>
                <input class="bform-input" id="bf4-name" value="${esc4(data.name)}"
                  placeholder="Ваше имя" autocomplete="name" style="margin-bottom:10px">
                <label class="bform-label">Телефон <span style="color:#ef4444">*</span></label>
                <input class="bform-input" id="bf4-phone" value="${esc4(storedPh)}"
                  placeholder="+7 (___) ___ __ __" type="tel" inputmode="numeric" maxlength="18"
                  autocomplete="tel"
                  onfocus="if(!this.value||this.value==='+7 '||this.value==='')this.value='+7 '"
                  oninput="window.phoneInputHandler&&window.phoneInputHandler({target:this})">
              </div>
            </div>
            <div class="bform-nav">
              <button class="btn btn-ghost" data-booking-action="prev">← Назад</button>
              <button class="btn btn-primary" id="bf4-next" data-booking-action="step4-send-otp" disabled>
                Получить код →
              </button>
            </div>
          </div>`;

        const phoneEl = area.querySelector('#bf4-phone');
        const nameEl  = area.querySelector('#bf4-name');
        const nextBtn = area.querySelector('#bf4-next');

        const checkPhone = () => {
          data.name  = nameEl?.value?.trim() || '';
          data.phone = phoneEl?.value || '';
          if (nextBtn) nextBtn.disabled = !isValidPhoneValue(data.phone);
        };

        phoneEl?.addEventListener('input', checkPhone);
        nameEl?.addEventListener('input', checkPhone);

        // Инициализация: ставим +7 если пусто, запускаем проверку
        setTimeout(() => {
          if (phoneEl && !phoneEl.value) phoneEl.value = '+7 ';
          checkPhone();
        }, 30);
      }
    }

    else if (step === 5) {
      // Сохраняем в DB
      const u = window._appState ? window._appState.user : null;
      // In staff mode, only use form data — not staff member's own profile
      const finalPhone = data._staffMode
        ? (window.App?.phoneRaw ? window.App.phoneRaw(data.phone || '') : data.phone || '').trim()
        : (window.App?.phoneRaw ? window.App.phoneRaw(data.phone || (u&&u.phone) || '') : (data.phone || (u&&u.phone) || '')).trim();
      const finalName = data._staffMode
        ? (data.name || '').trim()
        : (data.name || (u&&u.name) || '').trim();
      const finalCar = data._staffMode
        ? getEffectiveVehicleTitle()
        : (getEffectiveVehicleTitle() || (u&&u.car) || '').trim();
      const finalTimeLabel = data.timeMode === 'exact' ? (data.time || '') : (data.timeMode === 'nearest' ? 'Ближайшее доступное' : 'Свяжитесь со мной');
      const existCl = finalPhone ? (DB.Clients.getByPhone(finalPhone) || null) : null;
      const derivedClientId = (existCl && existCl.id) ? existCl.id : ''; // server will upsert client if needed
      // Only update profile when booking as a regular client, not in staff mode
      if (!data._staffMode) {
        if (window.App?.mergeUserPatch) {
          window.App.mergeUserPatch({ name: finalName, phone: finalPhone, car: finalCar });
        }
        if (window.App?.persistServerProfile) {
          setTimeout(()=>{ try{ window.App.persistServerProfile({ name: finalName, phone: finalPhone, car: finalCar }); }catch(_e){} }, 1800);
        }
      }

      // Admin-first ownership: заявка всегда стартует у администрации.
      const autoMasterId = '0';
      const autoMaster = null;

      (async()=>{
      const nextBtn = document.getElementById('bf-next');
      if(nextBtn){ nextBtn.disabled = true; nextBtn.dataset.loading = '1'; }
      const order = await DB.Orders.create({
        type: 'service_order',
        source: 'booking_wizard',
        appointmentRequired: true,
        scheduleRequired: true,
        clientId: derivedClientId, clientName: finalName, clientPhone: finalPhone,
        clientCar: finalCar, clientVehicleId: data.clientVehicleId || '', vehicleTitle: finalCar,
        serviceIds: data.services,
        serviceNames: getBookingSelectedServicesRaw().map(s => s.label || s.name || s.id).filter(Boolean).join(', '),
        masterId: '0',
        date: data.dateIso || (data.date||'').split(',')[0].trim(),
        dateLabel: data.dateLabel || data.date || '',
        timeMode: data.timeMode || 'exact',
        time: (data.timeMode || 'exact') === 'exact' ? (data.time || '') : '',
        notes: data.comment||'',
      });

      // Авто-создание: откладываем на 3 сек чтобы не перегружать API после создания заказа
      if (!data.clientVehicleId) {
        const _draft = Object.assign({}, data.vehicleDraft || {});
        const _finalPhone = finalPhone;
        const _finalCar = finalCar;
        const _order = order;
        setTimeout(() => {
          if (_draft.brand && _draft.model && typeof window._saveBookingVehicleDraft === 'function') {
            window._saveBookingVehicleDraft(_draft, _finalPhone).catch(() => {});
          } else if (_finalCar && typeof window._autoCreateVehicleFromOrder === 'function') {
            window._autoCreateVehicleFromOrder(_order).catch(() => {});
          }
        }, 3000);
      }

      // Чат теперь создаётся сервером вместе с заявкой; fallback оставляем только из локального кэша
      const chat = order?.chat || (order?.chatId ? DB.Chats.get(order.chatId) : DB.Chats.getByOrder(order?.id || '')) || null;

      const svcLabels = getBookingSelectedServicesRaw().map(s => s.label || s.name || s.id).join(', ');
      area.innerHTML = `
        <div class="booking-success">
          <div class="bs-icon">✓</div>
          <div class="bs-title">Заявка принята!</div>
          <div class="bs-sub">Заявка <b>${order.id}</b> создана. Сначала её ведёт администрация: можно сразу писать вопросы в чат по заявке.</div>
          <div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:var(--ui-radius-md,10px);padding:10px 14px;margin:12px 0;font-size:13px"><div style="width:34px;height:34px;border-radius:50%;background:#f59e0b22;border:1px solid #f59e0b;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;font-weight:700;color:#f59e0b;flex-shrink:0">А</div><div><div style="font-weight:700">Администрация</div><div style="font-size:11px;color:var(--text3)">Ответит на вопросы и передаст заявку мастеру после назначения</div></div></div>
          <div class="bs-detail">
            <div class="bs-detail-row"><span class="k">Имя</span><span class="v">${finalName}</span></div>
            <div class="bs-detail-row"><span class="k">Телефон</span><span class="v">${finalPhone}</span></div>
            <div class="bs-detail-row"><span class="k">Дата</span><span class="v">${data.dateLabel || data.date}</span></div>
            <div class="bs-detail-row"><span class="k">Время</span><span class="v">${finalTimeLabel || '—'}</span></div>
            <div class="bs-detail-row"><span class="k">${data.services.length > 1 ? 'Услуги' : 'Услуга'}</span><span class="v">${svcLabels}</span></div>
            ${finalCar ? `<div class="bs-detail-row"><span class="k">Автомобиль</span><span class="v">${finalCar}</span></div>` : ''}
          </div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="window._servicesWizardClose?.();App.go('myorders')">▤ Мои заявки</button>
            ${chat ? `<button class="btn btn-outline" onclick="window._servicesWizardClose?.();Messenger.openByOrder('${order.id}')">◌ Чат по заявке</button>` : ''}
            <button class="btn btn-ghost" onclick="window._servicesWizardClose?.();App.go('home')">На главную</button>
          </div>
        </div>`;
      // Fire push notifications after successful booking
      if (window.PushNotifs) {
        PushNotifs.scheduleOrderNotifs(svcLabels, finalCar);
      }
      })().catch((err)=>{
        console.error('[Booking]', err);
        area.innerHTML = `<div class="booking-success"><div class="bs-icon">!</div><div class="bs-title">Ошибка записи</div><div class="bs-sub">${err?.message || 'Не удалось завершить оформление заявки'}</div></div>`;
      });
    }

    bindBookingAreaEvents(area);
    renderSummary();
  }

  function renderSummary() {
    const el = document.getElementById('booking-summary-content');
    if (!el) return;
    const selectedServices = getBookingSelectedServicesRaw();
    const selectedCats = Array.from(new Set(selectedServices.map(s => s.cat).filter(Boolean)));
    if (!data.activeCategoryId && selectedCats.length === 1) data.activeCategoryId = selectedCats[0];
    const svcNames = selectedServices.map(s => s.icon + ' ' + s.label).filter(Boolean);

    if (!svcNames.length && !(data.dateLabel || data.dateIso || data.date)) {
      el.innerHTML = `<div class="bsum-empty">Заполните форму слева — здесь появятся детали записи.</div>`;
      return;
    }

    // Считаем итоговую базовую стоимость
    const totalBase = selectedServices.reduce((sum, s) => {
      const raw = window.DB?.Services?.getAll?.()?.find(x => x.id === s.id);
      return sum + (Number(raw?.basePrice || 0));
    }, 0);
    const priceLabels = selectedServices.map(s => s.priceLabel).filter(Boolean);
    const allUточнить = priceLabels.every(p => p === 'Уточнить');
    const priceRow = selectedServices.length
      ? `<div class="bsum-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">
           <span class="k" style="font-weight:700">Итого от</span>
           <span class="v orange" style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700">
             ${allUточнить ? 'Уточнить' : (totalBase > 0 ? totalBase.toLocaleString('ru') + ' ₸' : priceLabels[0] || 'Уточнить')}
           </span>
         </div>`
      : '';

    const phoneView = window.App?.formatPhone ? window.App.formatPhone(data.phone) : data.phone;
    el.innerHTML = `
      ${selectedCats.length ? `<div class="bsum-row"><span class="k">Категория</span><span class="v">${selectedCats.length > 1 ? 'Несколько категорий' : getBookingCategoryMeta(selectedCats[0]).label}</span></div>` : ''}
      ${svcNames.length ? `<div class="bsum-row"><span class="k">${svcNames.length > 1 ? 'Услуги' : 'Услуга'}</span><span class="v orange">${svcNames.join(', ')}</span></div>` : ''}
      ${priceRow}
      ${(data.dateLabel || data.date) ? `<div class="bsum-row"><span class="k">Дата</span><span class="v">${data.dateLabel || data.date}</span></div>` : ''}
      ${(data.timeMode || 'exact') === 'exact' && data.time ? `<div class="bsum-row"><span class="k">Время</span><span class="v">${data.time}</span></div>` : ''}
      ${(data.dateLabel || data.date) && (data.timeMode || 'exact') !== 'exact' ? `<div class="bsum-row"><span class="k">Режим</span><span class="v">${(data.timeMode || 'exact') === 'nearest' ? 'Ближайшее доступное' : 'Свяжитесь со мной'}</span></div>` : ''}
      ${data.name ? `<div class="bsum-row"><span class="k">Имя</span><span class="v">${data.name}</span></div>` : ''}
      ${phoneView ? `<div class="bsum-row"><span class="k">Телефон</span><span class="v">${phoneView}</span></div>` : ''}
      ${getEffectiveVehicleTitle() ? `<div class="bsum-row"><span class="k">Авто</span><span class="v">${getEffectiveVehicleTitle()}</span></div>` : ''}
      <div class="bsum-row" style="margin-top:4px"><span class="k">СТО</span><span class="v orange">8 (707) 298 06 49</span></div>
    `;
    // Синхронизируем FAB корзины
    try { updateCartFab(); } catch(_e) {}
  }

  function next() {
    if (step >= 5) return;
    const targetStep = step + 1;
    if (!canProceedFromStep(targetStep)) { renderStep(); return; }
    if (targetStep === 5) hydrateClientFields();
    step = targetStep;
    renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function prev() {
    if (step > 1) {
      step = step - 1;
      if (step === 4) data._step4Phase = 'phone';
      renderStep();
    }
  }
  function selectCategory(catId) {
    data.activeCategoryId = normalizeBookingCategory(catId || '');
    data.showCategoryBrowser = false;
    renderStep();
    renderSummary();
  }
  function selectSubcategory(_subId) {
    renderStep();
    renderSummary();
  }
  function selectPricedService(id) {
    const sid = String(id || '').trim();
    if (!sid) return;
    const svc = getBookingServicesMap().get(sid) || null;
    if (!svc) return;
    const current = Array.isArray(data.services) ? data.services.slice() : [];
    if (current.includes(sid)) data.services = current.filter(x => x !== sid);
    else data.services = current.concat([sid]);
    data._prefillSvc = null;
    data.activeCategoryId = svc.cat;
    data.showCategoryBrowser = false;
    renderStep();
    renderSummary();
  }
  function toggleService(id) {
    selectPricedService(id);
  }
  function hasService(id) {
    const sid = String(id || '').trim();
    if (!sid) return false;
    const current = Array.isArray(data.services) ? data.services : [];
    return current.includes(sid);
  }
  function addService(id, opts) {
    const sid = String(id || '').trim();
    if (!sid) return { ok:false, reason:'empty_id', added:false, exists:false, count:(Array.isArray(data.services)?data.services.length:0) };
    const svc = getBookingServicesMap().get(sid) || null;
    if (!svc) return { ok:false, reason:'not_found', added:false, exists:false, count:(Array.isArray(data.services)?data.services.length:0) };
    const current = Array.isArray(data.services) ? data.services.slice() : [];
    const exists = current.includes(sid);
    if (!exists) current.push(sid);
    data.services = current;
    data._prefillSvc = null;
    data.activeCategoryId = svc.cat;
    if (opts && opts.keepBrowserOpen) {
      data.showCategoryBrowser = true;
    } else {
      data.showCategoryBrowser = false;
    }
    renderStep();
    renderSummary();
    try { updateCartFab(); } catch(_e) {}
    return { ok:true, reason: exists ? 'exists' : 'added', added: !exists, exists, count: current.length, service: svc };
  }
  function removeService(id) {
    const sid = String(id || '').trim();
    if (!sid) return;
    const current = Array.isArray(data.services) ? data.services.slice() : [];
    if (!current.includes(sid)) return;
    data.services = current.filter(x => x !== sid);
    data._prefillSvc = null;
    if (!data.services.length) {
      data.showCategoryBrowser = true;
      data.activeCategoryId = '';
    }
    renderStep();
    renderSummary();
    try { updateCartFab(); } catch(_e) {}
  }
  function clearServices() {
    data.services = [];
    data._prefillSvc = null;
    data.activeCategoryId = '';
    data.showCategoryBrowser = true;
    renderStep();
    renderSummary();
    try { updateCartFab(); } catch(_e) {}
  }
  function selectDate(d) {
    const dateMeta = findDateMeta(d);
    if (dateMeta && dateMeta.busy) return;
    data.date = d;
    data.dateLabel = dateMeta?.label || d;
    data.dateIso = dateMeta?.iso || null;
    data.time = null;
    if (!data.timeMode) data.timeMode = 'exact';
    renderStep();
    renderSummary();
  }
  function selectTime(t) {
    if (!(data.dateIso || data.date)) return;
    const normalizedTime = String(t || '').replace(/^0/, '');
    const busySlots = getBusyTimesForDate(data.dateIso || data.dateLabel || data.date);
    if (busySlots.has(normalizedTime) || busySlots.has(t)) return;
    data.time = normalizedTime;
    renderStep();
    renderSummary();
  }
  function selectTimeMode(mode) {
    const normalized = ['exact','nearest','call_me'].includes(String(mode || '')) ? String(mode) : 'exact';
    data.timeMode = normalized;
    if (normalized !== 'exact') data.time = null;
    renderStep();
    renderSummary();
  }
  function setField(key, val) {
    if (key === 'phone') {
      const phoneEl = document.getElementById('bf-phone');
      const rawPhone = window.App?.phoneRaw ? window.App.phoneRaw(val) : String(val || '').trim();
      data[key] = rawPhone;
      const formattedPhone = window.App?.formatPhone ? window.App.formatPhone(rawPhone) : rawPhone;
      if (phoneEl && phoneEl.value !== formattedPhone) phoneEl.value = formattedPhone;
    } else {
      data[key] = val;
    }
    renderSummary();
    const nextBtn = document.getElementById('bf-next');
    if (nextBtn) {
      const phoneOk = isValidPhoneValue(data.phone);
      nextBtn.disabled = !String(data.name || '').trim() || !phoneOk;
    }
  }



  function setVehicleField(key, val) {
    normalizeVehicleDraft();
    data.clientVehicleId = '';
    const nextVal = String(val || '').trimStart();
    data.vehicleDraft[key] = key === 'plate' || key === 'vin' ? nextVal.toUpperCase() : nextVal;
    data.car = getEffectiveVehicleTitle();
    renderSummary();
    if (step === 3) {
      const nextBtn = document.querySelector('.bform-nav .btn.btn-primary');
      if (nextBtn) nextBtn.disabled = !hasVehicleSelection();
    }
  }

  async function saveDraftVehicle() {
    const draft = normalizeVehicleDraft();
    if (!draft.brand) { if (window.showToast) showToast('Укажите марку', 'error'); return; }
    if (!draft.model) { if (window.showToast) showToast('Укажите модель', 'error'); return; }
    const payload = {
      id: '', icon: '▱', title: buildVehicleTitle(draft), brand: draft.brand, model: draft.model,
      year: draft.year, plate: draft.plate, vin: draft.vin, color: draft.color,
      photoUrl: '', mileageKm: 0, serviceAt: '', serviceNote: '', note: '', isDefault: !hasGarageVehicles()
    };
    try {
      const saved = await window.DB?.Vehicles?.upsert?.(payload);
      if (!saved?.id) throw new Error('vehicle_not_saved');
      data.clientVehicleId = saved.id;
      data.car = buildVehicleTitle(saved);
      normalizeVehicleDraft();
      data.vehicleDraft.brand = String(saved.brand || '').trim();
      data.vehicleDraft.model = String(saved.model || '').trim();
      data.vehicleDraft.year = String(saved.year || '').trim();
      data.vehicleDraft.plate = String(saved.plate || '').trim();
      data.vehicleDraft.vin = String(saved.vin || '').trim();
      data.vehicleDraft.color = String(saved.color || '').trim();
      if (window.showToast) showToast('Автомобиль сохранён и выбран');
      renderStep();
      renderSummary();
    } catch (e) {
      if (window.showToast) showToast((e && e.message) || 'Не удалось сохранить автомобиль', 'error');
    }
  }

  function pickVehicle(vehicleId) {
    const v = vehicleId ? (window.DB?.Vehicles?.get?.(vehicleId) || null) : null;
    data.clientVehicleId = vehicleId || '';
    normalizeVehicleDraft();
    if (v) {
      data.vehicleDraft.brand = String(v.brand || '').trim();
      data.vehicleDraft.model = String(v.model || '').trim();
      data.vehicleDraft.year = String(v.year || '').trim();
      data.vehicleDraft.plate = String(v.plate || '').trim();
      data.vehicleDraft.vin = String(v.vin || '').trim();
      data.vehicleDraft.color = String(v.color || '').trim();
    }
    data.car = v ? buildVehicleTitle(v) : getEffectiveVehicleTitle();
    const area = document.getElementById('booking-form-area');
    if (area) renderStep();
    renderSummary();
  }

  // Called after vehicle added from + button in booking
  window._refreshBookingVehicleSelect = function() {
    const area = document.getElementById('booking-form-area');
    if (area && step === 3) renderStep();
  };

  function _clearPrefillSvc() {
    data._prefillSvc = null;
    data.showCategoryBrowser = true;
    if (!data.services.length) {
      data.activeCategoryId = '';
      step = 1;
    }
    renderStep();
    renderSummary();
  }
  function backToCategories() {
    data._prefillSvc = null;
    data.showCategoryBrowser = true;
    data.activeCategoryId = '';
    if (step !== 1) step = 1;
    renderStep();
    renderSummary();
    requestAnimationFrame(() => {
      const grid = document.querySelector('.booking-categories-grid');
      if (grid) {
        grid.classList.remove('is-hidden-by-prefill');
        try { grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_e) {}
      }
    });
  }
  /* ── Корзина на мобиле ──────────────────────────────────────────
     Показывает/скрывает кнопку-корзину рядом с notifs-fab и открывает
     информационную модалку с содержимым сводки.
     ─────────────────────────────────────────────────────────────── */
  function updateCartFab() {
    const fab   = document.getElementById('booking-cart-fab');
    const badge = document.getElementById('booking-cart-count');
    if (!fab) return;
    const onBookingPage = location.hash === '#booking' || location.hash.startsWith('#booking:');
    const count = (Array.isArray(data.services) ? data.services : []).length;
    // Показываем FAB только на странице записи и только на мобиле (CSS скрывает на десктопе)
    const visible = onBookingPage && count > 0;
    fab.style.display = visible ? 'flex' : 'none';
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function openCartModal() {
    const selected = getBookingSelectedServicesRaw();
    const esc = v => String(v||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const totalBase = selected.reduce((sum, s) => {
      const raw = window.DB?.Services?.getAll?.()?.find(x => x.id === s.id);
      return sum + (Number(raw?.basePrice || 0));
    }, 0);
    const priceLabels = selected.map(s => s.priceLabel).filter(Boolean);
    const allUточнить = priceLabels.every(p => p === 'Уточнить');
    const totalLabel = allUточнить ? 'Уточнить' :
      (totalBase > 0 ? 'от ' + totalBase.toLocaleString('ru') + ' ₸' : (priceLabels[0] || 'Уточнить'));

    const svcRows = selected.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">${esc(s.icon||'⌁')}</span>
          <div>
            <div style="font-size:14px;font-weight:600">${esc(s.label||s.name)}</div>
            <div style="font-size:12px;color:var(--text3)">${esc(s.priceLabel||'')} · ${esc(s.timeLabel||'')}</div>
          </div>
        </div>
        <button style="width:28px;height:28px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--text3);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center"
          onclick="window.Booking?.removeService?.('${esc(s.id)}');document.getElementById('cart-modal-list')?.closest('.cmodal-overlay')?.remove();window.Booking?.openCartModal?.()">×</button>
      </div>`).join('');

    const meta = data.date ? `
      <div style="margin-top:16px;padding:12px 14px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line)">
        ${data.date ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span style="color:var(--text3)">Дата</span><span style="font-weight:600">${esc(data.dateLabel||data.date)}</span></div>` : ''}
        ${data.time && data.timeMode === 'exact' ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span style="color:var(--text3)">Время</span><span style="font-weight:600">${esc(data.time)}</span></div>` : ''}
      </div>` : '';

    let ov = document.getElementById('booking-cart-modal');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'booking-cart-modal';
    ov.className = 'cmodal-overlay open';
    ov.innerHTML = `
      <div class="cmodal-card" style="max-width:420px;width:min(94vw,420px);border-radius:var(--ui-radius-lg,18px);padding-bottom:env(safe-area-inset-bottom,0)">
        <div class="cmodal-head">
          <h3>▣ Ваша запись <span style="font-size:12px;color:var(--text3);font-weight:400">${selected.length} услуг</span></h3>
          <button class="cmodal-close" onclick="document.getElementById('booking-cart-modal')?.remove()">✕</button>
        </div>
        <div class="cmodal-body">
          <div id="cart-modal-list">${svcRows || '<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Услуги не выбраны</div>'}</div>
          ${meta}
          ${selected.length ? `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
            <span style="font-size:13px;font-weight:700;color:var(--text)">Итого от</span>
            <span style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:var(--orange)">${esc(totalLabel)}</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn btn-outline" style="flex:1"
              onclick="document.getElementById('booking-cart-modal')?.remove()">Продолжить</button>
            ${step >= 3 ? `<button class="btn btn-primary" style="flex:1"
              onclick="document.getElementById('booking-cart-modal')?.remove();document.querySelector('[data-booking-action=next]')?.click()">
              Далее →</button>` : ''}
          </div>` : `
          <div style="margin-top:14px">
            <button class="btn btn-primary" style="width:100%"
              onclick="document.getElementById('booking-cart-modal')?.remove()">← Выбрать услуги</button>
          </div>`}
        </div>
      </div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  return { render, init, next, prev, toggleService, hasService, addService, removeService, clearServices, selectDate, selectTime, selectTimeMode, setField, setVehicleField, saveDraftVehicle, pickVehicle, selectCategory, selectSubcategory, selectPricedService, _clearPrefillSvc, backToCategories, renderSummary, openCartModal, updateCartFab };
})();


/* ─────────────────────────────────────────
   CHAT MODULE
───────────────────────────────────────── */
const Chat = (() => {
  let open = false;
  let initialized = false;
  let unreadCount = 0;

  const BOT_REPLIES = {
    'цена':      'Цены зависят от вида работ. Посмотрите наш <a href="#" onclick="App.go(\'pricing\')">прайс-лист</a> или позвоните: <b>8 (707) 298 06 49</b>.',
    'генератор': 'Ремонт генератора — от 3 000 ₸. Диагностика занимает 30 минут. Хотите записаться?',
    'стартер':   'Ремонт стартера — от 3 000 ₸. Чаще всего достаточно заменить бендикс или щётки.',
    'сигнализ':  'Установка сигнализации с автозапуском — от 15 000 ₸. Выезд к вам не делаем, нужно приехать к нам.',
    'адрес':     '⌖ Мы находимся по адресу: <b>ул. Гоголя 36А, Усть-Каменогорск</b>.',
    'время':     '🕐 Работаем: Пн–Пт 9:00–19:00, Сб 10:00–17:00, Вс — выходной.',
    'запись':    'Записаться можно онлайн на нашем сайте или по телефону <b>8 (707) 298 06 49</b>.',
    'гарантия':  'Мы даём гарантию на все виды выполненных работ. Срок зависит от вида ремонта.',
  };
  const DEFAULT_REPLY = 'Спасибо за вопрос! Для точного ответа лучше позвоните нам: <b>8 (707) 298 06 49</b>. Работаем Пн–Пт 9:00–19:00.';
  const QUICK_REPLIES = ['Цены на ремонт', 'Адрес и время работы', 'Записаться на ремонт', 'Гарантия на работы'];

  function mount() {
    if (document.getElementById('chat-window')) return;

    // Overlay
    const ov = document.createElement('div');
    ov.id = 'chat-overlay';
    ov.onclick = () => toggle();
    document.body.appendChild(ov);

    // Window (bottom sheet on mobile)
    const win = document.createElement('div');
    win.id = 'chat-window';
    win.className = 'chat-window';
    win.innerHTML = `
      <div class="chat-head">
        <div class="chat-handle"></div>
        <div class="chat-head-inner">
          <div class="chat-head-av">⌁</div>
          <div>
            <div class="chat-head-name">KARETA.KZ</div>
            <div class="chat-head-status"><span class="chat-online-dot"></span>Онлайн</div>
          </div>
          <button class="chat-head-close" onclick="Chat.toggle()" aria-label="Закрыть чат">×</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-msgs"></div>
      <div class="chat-quick-replies" id="chat-qr">
        ${QUICK_REPLIES.map(q => `<button class="qr-btn" onclick="Chat.sendQuick('${q}')">${q}</button>`).join('')}
      </div>
      <div class="chat-input-row">
        <input class="chat-input" id="chat-input" placeholder="Написать сообщение..."
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Chat.send();}"
          inputmode="text" autocomplete="off"/>
        <button class="chat-send" onclick="Chat.send()" id="chat-send-btn" aria-label="Отправить">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>`;
    document.body.appendChild(win);

    // Swipe down to close
    let startY = 0;
    win.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    win.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - startY > 80) toggle();
    }, { passive: true });
  }

  function toggle() {
    open = !open;
    const win = document.getElementById('chat-window');
    const ov  = document.getElementById('chat-overlay');
    const btn = document.querySelector('.bnav-item[data-page="chat"]');
    if (!win) return;

    win.classList.toggle('open', open);
    if (ov) ov.classList.toggle('vis', open);
    if (btn) btn.classList.toggle('active', open);
    document.body.style.overflow = open ? 'hidden' : '';

    if (open) {
      // Clear chat badge
      unreadCount = 0;
      if (window._appState) { window._appState.chatUnread = 0; }
      if (window.App_updateBadge) window.App_updateBadge();
      const w = btn?.querySelector('.bnav-icon-wrap');
      if (w) w.querySelector('.bnav-badge')?.remove();

      if (!initialized) {
        initialized = true;
        setTimeout(() => addMsg('bot', 'Здравствуйте! 👋 Я помогу ответить на вопросы о наших услугах. Можете спросить о ценах, адресе или записи.'), 400);
      }
      setTimeout(() => document.getElementById('chat-input')?.focus(), 350);
    }
  }

  function addMsg(type, html) {
    const msgs = document.getElementById('chat-msgs');
    if (!msgs) return;
    const now = new Date();
    const time = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.innerHTML = `<div class="chat-bubble">${html}</div><div class="chat-time">${time}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;

    // If bot replies while chat is closed — show badge
    if (type === 'bot' && !open) {
      unreadCount++;
      if (window._appState) window._appState.chatUnread = unreadCount;
      if (window.App_updateBadge) window.App_updateBadge();
    }
  }

  function showTyping() {
    const msgs = document.getElementById('chat-msgs'); if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'chat-msg bot'; div.id = 'typing-indicator';
    div.innerHTML = `<div class="chat-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() { document.getElementById('typing-indicator')?.remove(); }

  function getBotReply(msg) {
    const lc = msg.toLowerCase();
    for (const [key, reply] of Object.entries(BOT_REPLIES)) { if (lc.includes(key)) return reply; }
    return DEFAULT_REPLY;
  }

  function send() {
    const input = document.getElementById('chat-input'); if (!input) return;
    const text = input.value.trim(); if (!text) return;
    addMsg('user', text);
    input.value = '';
    const qr = document.getElementById('chat-qr');
    if (qr) qr.style.display = 'none';
    showTyping();
    setTimeout(() => { hideTyping(); addMsg('bot', getBotReply(text)); }, 900 + Math.random() * 600);
  }

  function sendQuick(text) {
    const input = document.getElementById('chat-input');
    if (input) input.value = text;
    send();
  }

  return { mount, toggle, send, sendQuick };
})();


/* ─────────────────────────────────────────
   NOTIFICATIONS MODULE
───────────────────────────────────────── */
const Notifs = (() => {
  let open = false;

  function getItems() {
    try {
      if (window.DB?.Notifications?.getMine) return DB.Notifications.getMine();
    } catch(_e){}
    return [];
  }

  function formatType(n){
    const eventType = String(n?.eventType || '');
    if (eventType.startsWith('order.')) return 'info';
    if (eventType.startsWith('message.')) return 'info';
    if (eventType.startsWith('parts.')) return 'warning';
    return n?.type || 'info';
  }

  function formatIco(n){
    const map = {
      'order.created':'▤',
      'order.assigned':'👨‍⌁',
      'order.status':'🔄',
      'parts.created':'▣',
      'parts.deferred':'⏸️',
      'parts.found':'▣',
      'message.new':'◌',
    };
    return map[String(n?.eventType || '')] || '○';
  }

  function mount() {
    if (document.getElementById('notifs-panel')) return;
    const ov = document.createElement('div');
    ov.id = 'notifs-overlay'; ov.onclick = () => toggle();
    document.body.appendChild(ov);

    const panel = document.createElement('div');
    panel.id = 'notifs-panel';
    panel.innerHTML = `
      <div class="notifs-handle"></div>
      <div class="notifs-head">
        <div class="notifs-title">○ Уведомления</div>
        <button class="notifs-close" onclick="Notifs.toggle()">×</button>
      </div>
      <div class="notifs-body" id="notifs-body"></div>
      <div class="notifs-footer">
        <button class="notifs-clear-btn" onclick="Notifs.markAllRead()">Отметить все как прочитанные</button>
      </div>`;
    document.body.appendChild(panel);

    let startY = 0;
    panel.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    panel.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - startY > 80) toggle(); }, { passive: true });
  }

  function itemAction(n){
    const url = String(n?.actionUrl || '');
    const metaTab = n?.meta?.tab || n?.meta?.pane || '';
    const metaChatId = String(n?.meta?.chatId || n?.entityId || '');
    const metaOrderId = String(n?.meta?.orderId || ((n?.entityType === 'order') ? (n?.entityId || '') : '') || '');
    if ((n?.entityType === 'chat' || metaChatId) && window.Messenger?.openById) {
      try { window.Messenger.openById(String(metaChatId || n.entityId)); return; } catch(_e){}
    }
    if ((n?.entityType === 'order' || metaOrderId) && window.OrderSystem?.Detail?.open) {
      try { window.OrderSystem.Detail.open(String(metaOrderId || n.entityId)); return; } catch(_e){}
    }
    if (url.startsWith('#')) {
      const target = url.slice(1);
      if (target === 'master' && metaTab && window.navMaster) { try{ window.App?.go?.('master'); setTimeout(()=>window.navMaster(metaTab),220); return; }catch(_e){} }
      if (target === 'admin' && metaTab && window.navAdmin) { try{ window.App?.go?.('admin'); setTimeout(()=>window.navAdmin(metaTab),220); return; }catch(_e){} }
      if (window.App?.go) App.go(target || 'home');
      return;
    }
  }

  function renderList() {
    const el = document.getElementById('notifs-body'); if (!el) return;
    const items = getItems();
    el.innerHTML = items.map(n => `
      <div class="notif-item card ${n.isRead ? '' : 'unread'}" id="nitem-${n.id}" onclick="Notifs.read('${n.id}')">
        ${!n.isRead ? '<div class="notif-dot"></div>' : '<div style="width:8px;flex-shrink:0"></div>'}
        <div class="notif-ico ${formatType(n)}">${formatIco(n)}</div>
        <div class="notif-content">
          <div class="notif-title">${n.title || 'Уведомление'}</div>
          <div class="notif-text">${n.body || ''}</div>
          <div class="notif-time">${n.createdAtLabel || n.timeLabel || n.createdAt || ''}</div>
        </div>
      </div>`).join('') ||
      `<div style="text-align:center;padding:48px 20px;color:var(--text3)">
        <div style="font-size:40px;margin-bottom:12px">○</div>
        <div style="font-size:14px;font-weight:600">Нет уведомлений</div>
        <div style="font-size:12px;margin-top:6px">Новые события по заявкам, чатам и запчастям появятся здесь</div>
       </div>`;
  }

  function openPanel() {
    if (window.App?.LayerManager && !window.App.LayerManager.open('notifs') && window.App.LayerManager.isOpen('notifs')) return;
    open = true;
    const panel = document.getElementById('notifs-panel');
    const ov    = document.getElementById('notifs-overlay');
    const btn   = document.querySelector('.bnav-item[data-page="notifs"]');
    const fab   = document.getElementById('notifs-fab');
    if (!panel) return;
    try { window.Messenger?.close?.(); } catch(_e) {}
    panel.classList.add('open');
    if (ov) ov.classList.add('vis');
    if (btn) btn.classList.add('active');
    if (fab) fab.classList.add('is-active');
    renderList();
    if (window.App?.updateNotifsFab) window.App.updateNotifsFab();
  }

  function close() {
    open = false;
    const panel = document.getElementById('notifs-panel');
    const ov    = document.getElementById('notifs-overlay');
    const btn   = document.querySelector('.bnav-item[data-page="notifs"]');
    const fab   = document.getElementById('notifs-fab');
    if (panel) panel.classList.remove('open');
    if (ov) ov.classList.remove('vis');
    if (btn) btn.classList.remove('active');
    if (fab) fab.classList.remove('is-active');
    try{ window.App?.LayerManager?.close('notifs'); }catch(_e){}
    if (window.App?.updateNotifsFab) window.App.updateNotifsFab();
  }

  function toggle() {
    if (open) { close(); return; }
    openPanel();
  }

  async function read(id) {
    const item = getItems().find(x => String(x.id) === String(id));
    if (!item) return;
    try { await window.DB?.Notifications?.markRead?.(id); } catch(_e) {}
    renderList();
    if (window.App?.getState) window.App.updateNotifsFab?.();
    itemAction(item);
  }

  async function markAllRead() {
    try { await window.DB?.Notifications?.markAllRead?.(); } catch(_e) {}
    renderList();
    if (window.App?.getState) window.App.updateNotifsFab?.();
  }

  return { mount, toggle, open: openPanel, close, read, markAllRead, renderList };
})();
;


/* ─────────────────────────────────────────
   ADMIN MODULE
───────────────────────────────────────── */
const Admin = (() => {

  // legacy demo ORDERS/MESSAGES removed: admin now works only from DB.* sources

  let currentFilter = 'all';
  let currentTypeFilter = 'all';
  const _adminOrderActionBusy = new Set();
  let currentMsgId = null;
  let activePane = 'dashboard';

  const statusMap = { new: 'Новый', waiting_responses:'Ждёт откликов', process: 'В работе', done_pending_client:'Ждёт клиента', done: 'Выполнен', cancelled: 'Отменён', dispute:'Спор' };
  const orderStatusLabelSafe = (status, type) => window.KaretaOrderLifecycle?.label?.(status, type) || statusMap[status] || status || '—';
  const orderStatusShortSafe = (status, type) => window.KaretaOrderLifecycle?.shortLabel?.(status, type) || orderStatusLabelSafe(status, type);
  const orderStatusClassSafe = (status) => window.KaretaOrderLifecycle?.cssClass?.(status) || String(status||'new');
  const orderStatusIsActive = (status) => window.KaretaOrderLifecycle?.isActive?.(status) || ['new','waiting_responses','process','done_pending_client'].includes(String(status||''));

  function render() {
    return `<div class="page">
      <div class="admin-layout">
        <!-- Sidebar -->
        <aside class="admin-sidebar">
          ${(()=>{
            const _rawH = (typeof location!=='undefined'?location.hash:'').replace('#','');
            const _activeNow = _rawH.startsWith('admin:') ? _rawH.slice(6) : (activePane||'dashboard');
            return (window.App?.getAdminNavGroups?.() || []).map(group => `
              <div class="admin-nav-label">${group.label}</div>
              ${(group.items||[]).map(item => `
                <div class="admin-nav-item ${item.id === _activeNow ? 'active' : ''}" onclick="Admin.showPane('${item.id}')" data-admin-pane="${item.id}">
                  <span class="admin-nav-icon">${item.icon}</span>
                  <span>${item.label}</span>
                  ${item.badgeValue ? `<span class="admin-nav-badge">${item.badgeValue}</span>` : ''}
                </div>`).join('')}
            `).join('');
          })()}
          <div style="margin-top:auto;padding:14px 16px;border-top:1px solid var(--line)">
            ${(()=>{
              const u=window._appState?.user; const r=window.RBAC?.getRole(u);
              return u
                ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                     <div style="width:32px;height:32px;border-radius:50%;background:${r?.color||'var(--orange)'}22;border:1px solid ${r?.color||'var(--orange)'}44;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;font-size:13px;font-weight:700;color:${r?.color||'var(--orange)'};">${u.initials}</div>
                     <div><div style="font-size:13px;font-weight:600">${u.name}</div>
                     <span class="rbadge ${r?.id||'admin'}" style="margin-top:2px">${r?.emoji||'◇'} ${r?.label||'Администратор'}</span></div>
                   </div>`
                : `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Администратор</div>`;
            })()}
            <button onclick="window._quickSearch?.open?.()" style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);transition:.2s;padding:5px 0;margin-bottom:6px" onmouseover="this.style.color='var(--text2)'" onmouseout="this.style.color='var(--text3)'">
              ⌕ Поиск <kbd style="font-size:9px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-sm,5px);padding:1px 4px;margin-left:auto">Ctrl+K</kbd>
            </button>
            <button onclick="App.go('home')" style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);transition:.2s;padding:5px 0" onmouseover="this.style.color='var(--text2)'" onmouseout="this.style.color='var(--text3)'">← На сайт</button>
            ${(()=>{const u=window._appState?.user;return window.RBAC?.atLeast(u,'owner')?`<button onclick="App.go('owner')" style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--orange);margin-top:6px;transition:.2s;padding:5px 0">◇ Панель владельца</button>`:'';})()}
          </div>
        </aside>
        <!-- Content -->
        <main class="admin-content">
          <div id="admin-panes"></div>
        </main>
      </div>
    </div>`;
  }

  function init() {
    const _h = (typeof location !== 'undefined' ? location.hash : '').replace('#','');
    const _initPane = _h.startsWith('admin:') ? _h.slice(6) : 'dashboard';
    activePane = _initPane;
    window.KaretaLogger?.log('router', 'Admin.init → ' + _initPane, { hash: location.hash });
    setTimeout(() => showPane(_initPane), 0);
  }

  function showPane(id) {
    if (['staff','history','messages'].includes(String(id||''))) id = 'dashboard';
    window.KaretaLogger?.log('router', 'showPane: ' + (activePane||'—') + ' → ' + id, { hash: location.hash });
    if (id === 'orders' && activePane !== 'orders') { currentFilter = 'all'; currentTypeFilter = 'all'; }
    activePane = id;
    window.KaretaUrlSync?.replace ? window.KaretaUrlSync.replace('admin:' + id, 'admin-showPane') : history.replaceState(null, '', '#admin:' + id);
    document.querySelectorAll('[data-admin-pane]').forEach(el => {
      el.classList.toggle('active', el.dataset.adminPane === id);
    });
    const content = document.getElementById('admin-panes');
    if (!content) return;

    if (id === 'clients') { OrderSystem.ClientsPanel.render('admin-panes', true); window.KaretaUrlSync?.replace ? window.KaretaUrlSync.replace('admin:clients', 'admin-clients') : history.replaceState(null,'','#admin:clients'); return; }

    const panes = {
      dashboard:    renderDashboard,
      orders:       renderOrders,
      masters:      renderMasters,
      roles:        renderRoles,
      calendar:     renderCalendar,
      shop:         renderAdminShop,
      services_cfg: renderServicesCfg,
      pricing_cfg:  renderPricingCfg,
      site_cms:     renderSiteCms,
    };
    content.innerHTML = (panes[id] || renderDashboard)();
    content.querySelector('.admin-pane')?.classList.add('active');

    if (id === 'orders')   initOrders();
    if (id === 'calendar') initCalendar();
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isPartsDeferred(order) {
    return !!order?.deferred;
  }

  function partsSubject(order) {
    return order?.serviceNames || order?.notes || 'Запрос запчастей';
  }

  function queueStatusLabel(kind) {
    return ({ new:'Новые запросы', process:'В подборе', hold:'Отложенные' })[kind] || 'Запчасти';
  }

  function getAdminMasterRows() {
    const dbMasters = (DB.Masters?.getAll?.(true) || []).map(m => Object.assign({ __source:'masters', __orphan:false }, m));
    const stateUsers = Array.isArray(window.DB?.state?.().users) ? window.DB.state().users : [];
    const appUsers = Array.isArray(window._appState?.users) ? window._appState.users : [];
    const users = (stateUsers.length ? stateUsers : appUsers) || [];
    const roleMasters = users.filter(u => String(u.role||'') === 'master');
    const byUserId = new Map(dbMasters.filter(m => Number(m.userId||m.user_id||0)>0).map(m => [String(Number(m.userId||m.user_id||0)), m]));
    const byPhone = new Map(dbMasters.map(m => [String(m.phone||m.userPhone||'').replace(/\D/g,''), m]).filter(x => x[0]));
    const out = dbMasters.slice();
    roleMasters.forEach(u => {
      const uid = String(Number(u.id||0));
      const phone = String(u.phone||'').replace(/\D/g,'');
      if ((uid && byUserId.has(uid)) || (phone && byPhone.has(phone))) return;
      out.push({
        id: 'user_master_' + String(u.id||Date.now()),
        userId: u.id || 0,
        user_id: u.id || 0,
        userPhone: u.phone || '',
        user_phone: u.phone || '',
        name: u.name || 'Мастер',
        phone: u.phone || '',
        initials: u.initials || (String(u.name||'М').trim().slice(0,1).toUpperCase()),
        color: '#60a5fa',
        spec: u.spec || 'Требует привязки к реестру мастеров',
        active: u.active !== false,
        __source: 'users',
        __orphan: true,
      });
    });
    return out.sort((a,b)=> Number(b.active!==false)-Number(a.active!==false) || String(a.name||'').localeCompare(String(b.name||''),'ru'));
  }

  function getAdminMasterStats(masterRow) {
    if (!masterRow) return { total:0, done:0, active:0, revenue:0, serviceTotal:0, partsTotal:0, serviceDone:0, partsDone:0 };
    if (!masterRow.__orphan) return DB.Masters.stats(masterRow.id);
    const userId = Number(masterRow.userId||masterRow.user_id||0);
    const list = (DB.Orders?.getAll?.({}) || []).filter(o => Number(o.masterUserId||o.master_user_id||0) === userId);
    const service = list.filter(o => (o.type||'service_order') === 'service_order');
    const parts = list.filter(o => (o.type||'service_order') === 'parts_request');
    return {
      total:list.length,
      done:list.filter(o=>o.status==='done').length,
      active:list.filter(o=>o.status==='process').length,
      revenue:list.filter(o=>o.status==='done').reduce((sum,o)=>sum+(Number(o.price)||0),0),
      serviceTotal:service.length,
      partsTotal:parts.length,
      serviceDone:service.filter(o=>o.status==='done').length,
      partsDone:parts.filter(o=>o.status==='done').length,
    };
  }

  function getPartsQueue(kind) {
    const all = DB.Orders.getAll().filter(o => (o.type || 'service_order') === 'parts_request' && o.status !== 'done' && o.status !== 'cancelled');
    if (kind === 'hold') return all.filter(isPartsDeferred);
    if (kind === 'new') return all.filter(o => o.status === 'new' && !isPartsDeferred(o));
    if (kind === 'process') return all.filter(o => o.status === 'process' && !isPartsDeferred(o));
    return all;
  }

  function renderPartsQueueSection() {
    const groups = [
      { key:'new', ico:'🆕', color:'#60a5fa', items:getPartsQueue('new') },
      { key:'process', ico:'▣', color:'var(--orange)', items:getPartsQueue('process') },
      { key:'hold', ico:'⏸', color:'#a78bfa', items:getPartsQueue('hold') },
    ];
    return `<div style="margin:20px 0 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text2)">Очередь запросов запчастей</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="act-btn edit" onclick="Admin.openPartsQueue('new')">Новые</button>
          <button class="act-btn edit" onclick="Admin.openPartsQueue('process')">В подборе</button>
          <button class="act-btn edit" onclick="Admin.openPartsQueue('hold')">Отложенные</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
        ${groups.map(group => `
          <div class="card" style="padding:16px;border:1px solid rgba(255,255,255,.06)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
              <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px"><span>${group.ico}</span><span>${queueStatusLabel(group.key)}</span></div>
              <span class="order-status ${group.key === 'hold' ? 'cancelled' : (group.key === 'process' ? 'process' : 'new')}" style="font-size:10px;background:${group.color};color:#fff;border:none">${group.items.length}</span>
            </div>
            ${group.items.length ? group.items.slice(0,4).map(o => `
              <div style="padding:10px 0;border-top:1px solid var(--line)">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
                  <div>
                    <div style="font-weight:700;font-size:13px">${escapeHtml(o.clientName || 'Клиент')}</div>
                    <div style="font-size:11px;color:var(--text3)">${escapeHtml(o.clientPhone || '')}</div>
                  </div>
                  <div style="font-size:11px;color:var(--text3);white-space:nowrap">${escapeHtml(o.date || '—')}${o.time ? ' · ' + escapeHtml(o.time) : ''}</div>
                </div>
                <div style="font-size:12px;color:var(--text2);line-height:1.45;margin-bottom:8px">${escapeHtml(partsSubject(o)).slice(0,120)}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${group.key !== 'process' ? `<button class="act-btn edit" onclick="Admin.partsQueueAction('${o.id}','process')">В подбор</button>` : `<button class="act-btn view" onclick="Admin.partsQueueAction('${o.id}','done')">Готово</button>`}
                  <button class="act-btn ${group.key === 'hold' ? 'view' : 'edit'}" onclick="Admin.partsQueueAction('${o.id}','${group.key === 'hold' ? 'resume' : 'hold'}')">${group.key === 'hold' ? 'Вернуть' : 'Отложить'}</button>
                  <button class="act-btn view" onclick="OrderSystem.Detail.open('${o.id}')">Открыть</button>
                </div>
              </div>`).join('') : `<div style="font-size:12px;color:var(--text3);padding:6px 0 2px">Очередь пуста</div>`}
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* ══════════════════════════════════════════════
     ADMIN: РАЗДЕЛ МАСТЕРА
  ══════════════════════════════════════════════ */
  function renderMasters() {
    const masters = getAdminMasterRows();
    const stoProfiles = (window.DB?.STO?.profiles?.() || window.DB?.StoProfiles?.getAll?.() || []);
    const allOrders = window.DB?.Orders?.getAll?.() || [];
    const DAY_NAMES = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const base = new Date(); base.setHours(0,0,0,0);
    const weekDays = Array.from({length:7}, (_, i) => { const d = new Date(base); d.setDate(d.getDate()+i); return d; });
    const todayIso = base.toISOString().slice(0,10);
    const linkedMastersCount = masters.filter(m => !m.__orphan && String(m.stoId||m.sto_id||'').trim()).length;
    const activeMastersCount = masters.filter(m => m.active !== false && !m.__orphan).length;
    const orphanMastersCount = masters.filter(m => !!m.__orphan).length;
    const busyMastersCount = masters.filter(m => {
      const mid = String(m.id||'');
      return allOrders.some(o => String(o.masterId||'0')===mid && ['new','process'].includes(String(o.status||'')));
    }).length;
    const noScheduleCount = masters.filter(m => !m.__orphan && !(window.DB?.MasterSchedules?.upcoming?.(m.id,7)||[]).length).length;

    function masterWeekGrid(m) {
      if (m.__orphan) return `<div class="card" style="padding:12px 14px;color:var(--text3);font-size:12px">Этот мастер есть как пользователь, но ещё не привязан к реестру мастеров. График появится после привязки записи мастера.</div>`;
      return weekDays.map(d => {
        const iso = d.toISOString().slice(0,10);
        const sched = window.DB?.MasterSchedules?.forDate?.(m.id, iso);
        const dayOrders = allOrders.filter(o=>String(o.masterId||'0')===String(m.id||'') && o.date===iso && o.status!=='cancelled');
        const isToday = iso === todayIso;
        let hoursHtml, cellBg, borderColor;
        if (!sched) {
          hoursHtml = `<div style="font-size:9px;color:var(--text3);margin-top:2px">—</div>`;
          cellBg = 'var(--bg2)'; borderColor = 'var(--line)';
        } else if (sched.isDayOff) {
          hoursHtml = `<div style="font-size:9px;color:#ef4444;font-weight:600;margin-top:2px">Вых.</div>`;
          cellBg = 'rgba(239,68,68,.07)'; borderColor = 'rgba(239,68,68,.28)';
        } else {
          hoursHtml = `<div style="font-size:9px;color:var(--green);font-weight:600;margin-top:2px;white-space:nowrap">${escapeHtml(sched.startTime||'09:00')}–${escapeHtml(sched.endTime||'18:00')}</div>`;
          cellBg = 'rgba(52,211,153,.07)'; borderColor = 'rgba(52,211,153,.32)';
        }
        const badge = dayOrders.length ? `<div style="margin-top:3px"><span style="font-size:9px;background:var(--orange-dim,rgba(255,107,0,.12));color:var(--orange);border-radius:99px;padding:1px 5px;font-weight:700">${dayOrders.length}</span></div>` : '';
        return `<div onclick="window.masterEditDay && masterEditDay('${escapeHtml(m.id)}','${iso}')"
          title="Ред. ${iso}" style="background:${cellBg};border:1.5px solid ${borderColor};border-radius:var(--ui-radius-sm,5px);padding:7px 4px 5px;text-align:center;cursor:pointer;transition:box-shadow .15s;flex:1;min-width:0"
          onmouseenter="this.style.boxShadow='0 0 0 2px var(--orange)'" onmouseleave="this.style.boxShadow=''">
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">${DAY_NAMES[d.getDay()]}</div>
          <div style="font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;color:${isToday?'var(--orange)':'var(--text1)'}">${d.getDate()}</div>
          ${hoursHtml}${badge}
        </div>`;
      }).join('');
    }

    function masterStoBlock(m, safeId) {
      const activeLink = window.DB?.STO?.linkForMaster?.(m.id);
      const activeSto = activeLink ? (window.DB?.STO?.profile?.(activeLink.stoId || activeLink.sto_id) || null) : null;
      const activeStoId = activeSto?.id || activeLink?.stoId || activeLink?.sto_id || '';
      return `<div class="card" style="padding:12px 14px;margin-bottom:12px;border:1px solid var(--line)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-weight:800;font-size:13px">🏭 Привязка к СТО</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">${activeSto ? `Прикреплён к: ${escapeHtml(activeSto.name||'СТО')}${activeSto.city?(' · '+escapeHtml(activeSto.city)):''}` : 'Мастер работает самостоятельно или ещё не прикреплён к СТО.'}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="admin-search" id="adm-sto-${safeId}" style="min-width:190px" onchange="Admin.linkMasterSto('${escapeHtml(m.id)}',this.value,this)">
              <option value="">Без СТО</option>
              ${stoProfiles.map(s=>`<option value="${escapeHtml(s.id)}" ${String(s.id)===String(activeStoId)?'selected':''}>${escapeHtml(s.name||'СТО')}${s.city?(' · '+escapeHtml(s.city)):''}</option>`).join('')}
            </select>
          </div>
        </div>
        ${stoProfiles.length ? '' : '<div style="font-size:11px;color:var(--text3);margin-top:8px">СТО-профилей пока нет. Они появятся после регистрации роли СТО или через профиль автосервиса.</div>'}
      </div>`;
    }

    function masterOrdersBlock(m, safeId) {
      const mid = String(m.id||'');
      const assigned = allOrders.filter(o=>String(o.masterId||'0')===mid || (String(o.masterName||'') && String(o.masterName||'')===String(m.name||'')));
      const attachable = allOrders.filter(o=>String(o.masterId||'0')==='0' && String(o.status||'new')!=='cancelled');
      const recent = assigned.slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,5);
      return `<div class="card" style="padding:12px 14px;margin-bottom:14px;border:1px solid var(--line)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <div>
            <div style="font-weight:800;font-size:13px">▤ Заявки мастера</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">Назначено: ${assigned.length}. Админ может прикрепить свободную заявку к этому мастеру.</div>
          </div>
          <button class="btn btn-outline" style="font-size:11px;padding:7px 11px" onclick="Admin.openMasterOrders('${escapeHtml(m.id)}')">Открыть все</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <select class="admin-search" id="adm-order-${safeId}" style="min-width:240px">
            <option value="">Выберите свободную заявку</option>
            ${attachable.map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.id)} · ${escapeHtml(o.clientName||'Клиент')} · ${escapeHtml(o.serviceNames||o.notes||'Заявка')}</option>`).join('')}
          </select>
          <button class="btn btn-primary" style="font-size:12px;padding:8px 12px" onclick="Admin.assignOrderToMasterFromCard('${escapeHtml(m.id)}')">Прикрепить заказ</button>
        </div>
        ${recent.length ? `<div style="display:grid;gap:7px">${recent.map(o=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding-top:7px">
          <div style="min-width:0"><div style="font-weight:700;font-size:12px">${escapeHtml(o.id)} · ${escapeHtml(o.clientName||'Клиент')}</div><div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.date||o.createdAt?.slice(0,10)||'—')} · ${escapeHtml(o.serviceNames||o.notes||'Заявка')}</div></div>
          <div style="display:flex;gap:6px;align-items:center"><span class="order-status ${escapeHtml(o.status||'new')}" style="font-size:10px">${escapeHtml(statusMap[o.status]||o.status||'Новый')}</span><button class="act-btn view" onclick="OrderSystem.Detail.open('${escapeHtml(o.id)}')">Открыть</button></div>
        </div>`).join('')}</div>` : '<div style="font-size:12px;color:var(--text3);padding:8px 0">Назначенных заявок пока нет.</div>'}
      </div>`;
    }

    function masterStatRow(m) {
      const safeId = String(m.id||'').replace(/[^a-zA-Z0-9_-]/g,'_');
      const st = getAdminMasterStats(m);
      const reviews = (DB.PublicReviews?.getAll?.() || []).filter(r => r.masterId === m.id || r.masterName === m.name);
      const avgStars = reviews.length ? (reviews.reduce((s,r)=>s+(Number(r.stars)||5),0)/reviews.length).toFixed(1) : null;
      const activeLink = window.DB?.STO?.linkForMaster?.(m.id);
      const rowStoId = String(activeLink?.stoId || activeLink?.sto_id || m.stoId || m.sto_id || '').trim();
      const rowStatus = m.__orphan ? 'orphan' : (m.active === false ? 'inactive' : 'active');
      const rowAssigned = allOrders.filter(o=>String(o.masterId||'0')===String(m.id||''));
      const rowActiveOrders = rowAssigned.filter(o=>['new','process'].includes(String(o.status||''))).length;
      const rowSchedule = !m.__orphan && (window.DB?.MasterSchedules?.upcoming?.(m.id,7)||[]).length ? 'has' : 'none';
      const rowSearch = [m.name,m.phone,m.spec,m.stoName,m.sto_name,m.userPhone,m.user_phone].filter(Boolean).join(' ').toLowerCase();
      return `
        <div class="cmodal-card master-schedule-shell" data-admin-master-row="1" data-master-search="${escapeHtml(rowSearch)}" data-master-sto-id="${escapeHtml(rowStoId||'none')}" data-master-status="${escapeHtml(rowStatus)}" data-master-orders="${rowAssigned.length?'has':'none'}" data-master-active-orders="${rowActiveOrders?'has':'none'}" data-master-schedule="${escapeHtml(rowSchedule)}" style="margin-bottom:18px;max-width:100%">
          <div class="cmodal-head" style="padding:14px 20px;flex-wrap:wrap;gap:10px">
            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
              <div style="width:40px;height:40px;border-radius:50%;background:${escapeHtml(m.color||'#34d399')}22;color:${escapeHtml(m.color||'#34d399')};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;border:2px solid ${escapeHtml(m.color||'#34d399')}44;flex-shrink:0">${escapeHtml(m.initials||'М')}</div>
              <div>
                <div style="font-weight:700;font-size:15px;font-family:'Oswald',sans-serif">${escapeHtml(m.name||'Мастер')}</div>
                <div style="font-size:11px;color:var(--text3)">${escapeHtml(m.spec||'')}${m.phone?(' · ○ '+escapeHtml(m.phone)):''}${m.__orphan?' · ! Нет master-карточки':''}${m.active===false?' · ⛔ Неактивен':''}</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              ${avgStars ? `<span style="font-size:13px;font-weight:700;color:#f59e0b">★ ${avgStars} <span style="font-size:11px;font-weight:400;color:var(--text3)">(${reviews.length})</span></span>` : ''}
              <span class="order-status ${m.active===false?'cancelled':(st.active>0?'process':'done')}" style="font-size:10px">${m.active===false?'Неактивен':(st.active+' в работе')}</span>
              ${m.__orphan ? `<button class="btn btn-outline" style="font-size:11px;padding:6px 12px" onclick="Admin.showPane('roles')">🔗 Привязать</button>` : `<button class="btn btn-outline" style="font-size:11px;padding:6px 12px" onclick="openMasterScheduleModal('${escapeHtml(m.id)}')">✎ График</button>`}
              <button class="btn btn-primary" style="font-size:11px;padding:6px 12px" onclick="Admin.openMasterOrders('${escapeHtml(m.id)}')">▤ Заявки</button>
            </div>
          </div>

          <div class="cmodal-body" style="padding:14px 20px 18px">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
              ${[
                [st.total,'Всего заявок','var(--text2)'],
                [st.serviceDone,'Ремонтов','var(--green)'],
                [st.revenue.toLocaleString('ru')+' ₸','Выручка','var(--orange)'],
                [st.partsTotal,'Запчастей','#a78bfa'],
              ].map(([n,l,c])=>`<div class="card" style="padding:12px 14px;text-align:center">
                <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:${c}">${n}</div>
                <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">${l}</div>
              </div>`).join('')}
            </div>
            ${masterStoBlock(m, safeId)}
            ${masterOrdersBlock(m, safeId)}
            <div style="margin-bottom:14px">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">График на неделю · <span style="font-weight:400;text-transform:none">нажмите на день для редактирования</span></div>
              <div style="display:flex;gap:5px">${masterWeekGrid(m)}</div>
              <div style="display:flex;gap:12px;margin-top:7px;font-size:10px;color:var(--text3)">
                <span><span style="color:var(--green)">●</span> Рабочий</span>
                <span><span style="color:#ef4444">●</span> Выходной</span>
                <span style="opacity:.5">○ Не задан</span>
              </div>
              <div class="admin-master-load-strip">
                ${Array.from({length:7},(_,i)=>{ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+i); const iso=d.toISOString().slice(0,10); const cnt=allOrders.filter(o=>String(o.masterId||'0')===String(m.id||'') && String(o.date||'').slice(0,10)===iso && !['cancelled','closed'].includes(String(o.status||''))).length; return `<span class="admin-master-load-pill ${cnt>=3?'is-full':''}">${iso.slice(5)} · ${cnt}/3</span>`; }).join('')}
              </div>
            </div>
            ${(()=>{
              if (!reviews.length) return '<div style="font-size:12px;color:var(--text3)">Отзывов пока нет</div>';
              return `<div style="margin-top:4px"><div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Последние отзывы</div>
                ${reviews.slice(-3).reverse().map(r=>`<div style="padding:8px 10px;background:var(--bg2);border-radius:var(--ui-radius-sm,5px);margin-bottom:6px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="color:#f59e0b;font-size:12px">${'★'.repeat(Math.min(5,Number(r.stars)||5))}</span><span style="font-size:11px;font-weight:600">${escapeHtml(r.author||r.clientName||'Клиент')}</span><span style="font-size:10px;color:var(--text3);margin-left:auto">${escapeHtml(r.date||r.createdAt||'')}</span></div><div style="font-size:12px;color:var(--text2);line-height:1.5">${escapeHtml((r.text||r.body||'').slice(0,160))}</div></div>`).join('')}</div>`;
            })()}
          </div>
        </div>`;
    }

    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px">
        <div><div class="admin-page-title" style="margin:0">⌁ Наши мастера</div><div style="font-size:12px;color:var(--text3);margin-top:5px">Привязка мастеров к СТО, заявки мастера и графики смен в одном разделе.</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" style="font-size:12px;padding:8px 14px" onclick="showAddUserModal();setTimeout(()=>{const r=document.getElementById('au-role');if(r)r.value='master';},30)">+ Добавить мастера</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
        ${[
          [masters.length,'Всего','⌁','var(--orange)'],
          [activeMastersCount,'Активных','✅','#22c55e'],
          [linkedMastersCount,'Прикреплены к СТО','🏭','#60a5fa'],
          [busyMastersCount,'С активными заявками','▤','#f59e0b'],
          [noScheduleCount,'Без графика 7 дней','🗓','#ef4444'],
          [orphanMastersCount,'Требуют привязки','!','#a78bfa'],
        ].map(([v,l,i,c])=>`<div class="card" style="padding:12px 14px;border-left:3px solid ${c}"><div style="font-size:20px;margin-bottom:4px">${i}</div><div style="font-family:'Oswald',sans-serif;font-size:21px;font-weight:700;color:${c}">${v}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${l}</div></div>`).join('')}
      </div>
      <div class="card" style="padding:12px 14px;margin-bottom:16px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="admin-master-search" class="admin-search" placeholder="⌕ Поиск: имя, телефон, специализация..." style="min-width:220px;flex:1" oninput="Admin.applyMasterFilters()">
          <select id="admin-master-sto-filter" class="admin-search" style="width:190px" onchange="Admin.applyMasterFilters()">
            <option value="all">Все СТО</option>
            <option value="none">Без СТО</option>
            ${stoProfiles.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.name||'СТО')}${s.city?(' · '+escapeHtml(s.city)):''}</option>`).join('')}
          </select>
          <select id="admin-master-status-filter" class="admin-search" style="width:160px" onchange="Admin.applyMasterFilters()">
            <option value="all">Все статусы</option><option value="active">Активные</option><option value="inactive">Неактивные</option><option value="orphan">Без master-карточки</option>
          </select>
          <select id="admin-master-orders-filter" class="admin-search" style="width:170px" onchange="Admin.applyMasterFilters()">
            <option value="all">Любые заявки</option><option value="active">Есть активные</option><option value="has">Есть любые</option><option value="none">Без заявок</option>
          </select>
          <select id="admin-master-schedule-filter" class="admin-search" style="width:150px" onchange="Admin.applyMasterFilters()">
            <option value="all">Любой график</option><option value="has">Есть график</option><option value="none">Без графика</option>
          </select>
          <button class="btn btn-outline" style="font-size:12px;padding:8px 12px" onclick="Admin.resetMasterFilters()">Сброс</button>
        </div>
        <div id="admin-master-filter-count" style="font-size:11px;color:var(--text3);margin-top:8px">Показаны все мастера</div>
      </div>
      ${masters.length
        ? `<div id="admin-masters-list">${masters.map(m => masterStatRow(m)).join('')}</div><div id="admin-masters-empty-filter" style="display:none;text-align:center;padding:34px 0;color:var(--text3)"><div style="font-size:34px;margin-bottom:8px">⌕</div><div style="font-weight:700">По фильтрам ничего не найдено</div><div style="font-size:12px;margin-top:4px">Сбросьте фильтры или измените запрос.</div></div>`
        : `<div style="text-align:center;padding:60px 0;color:var(--text3)"><div style="font-size:48px;margin-bottom:12px">⌁</div><div style="font-size:16px;font-weight:700;margin-bottom:6px">Мастеров пока нет</div><div style="font-size:13px">Добавьте мастеров через раздел «Роли и доступ»</div></div>`}
    </div>`;
  }

  function applyMasterFilters() {
    const rows = Array.from(document.querySelectorAll('#admin-masters-list [data-admin-master-row="1"]'));
    const q = String(document.getElementById('admin-master-search')?.value || '').trim().toLowerCase();
    const sto = String(document.getElementById('admin-master-sto-filter')?.value || 'all');
    const status = String(document.getElementById('admin-master-status-filter')?.value || 'all');
    const orders = String(document.getElementById('admin-master-orders-filter')?.value || 'all');
    const schedule = String(document.getElementById('admin-master-schedule-filter')?.value || 'all');
    let visible = 0;
    rows.forEach(r => {
      const textOk = !q || String(r.dataset.masterSearch || r.textContent || '').toLowerCase().includes(q);
      const stoId = String(r.dataset.masterStoId || 'none');
      const stoOk = sto === 'all' || (sto === 'none' ? (!stoId || stoId === 'none') : stoId === sto);
      const statusOk = status === 'all' || String(r.dataset.masterStatus || '') === status;
      const ordersOk = orders === 'all' || (orders === 'active' ? String(r.dataset.masterActiveOrders||'none') === 'has' : String(r.dataset.masterOrders||'none') === orders);
      const scheduleOk = schedule === 'all' || String(r.dataset.masterSchedule || 'none') === schedule;
      const show = textOk && stoOk && statusOk && ordersOk && scheduleOk;
      r.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const count = document.getElementById('admin-master-filter-count');
    if (count) count.textContent = 'Показано: ' + visible + ' из ' + rows.length;
    const empty = document.getElementById('admin-masters-empty-filter');
    if (empty) empty.style.display = rows.length && !visible ? 'block' : 'none';
  }

  function resetMasterFilters() {
    ['admin-master-search','admin-master-sto-filter','admin-master-status-filter','admin-master-orders-filter','admin-master-schedule-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = id === 'admin-master-search' ? '' : 'all';
    });
    applyMasterFilters();
  }

  function _filterMasters(q) {
    const input = document.getElementById('admin-master-search');
    if (input) input.value = q || '';
    applyMasterFilters();
  }

  async function linkMasterSto(masterId, stoId, sel) {
    if (sel) { sel.disabled = true; }
    try {
      await window.DB?.STO?.assignMaster?.(stoId, masterId);
      window.showToast?.(stoId ? 'Мастер прикреплён к СТО' : 'Мастер отвязан от СТО');
      showPane('masters');
    } catch(e) {
      window.showToast?.((e && e.message) || 'Не удалось изменить привязку к СТО', 'error');
    } finally {
      if (sel) { sel.disabled = false; }
    }
  }

  async function assignOrderToMasterFromCard(masterId) {
    const safeId = String(masterId||'').replace(/[^a-zA-Z0-9_-]/g,'_');
    const el = document.getElementById('adm-order-' + safeId);
    const orderId = el?.value || '';
    if (!orderId) { window.showToast?.('Выберите свободную заявку', 'error'); return; }
    try {
      await window.DB?.Orders?.assignMaster?.(orderId, masterId);
      window.showToast?.('Заявка прикреплена к мастеру');
      showPane('masters');
    } catch(e) {
      window.showToast?.((e && e.message) || 'Не удалось прикрепить заявку', 'error');
    }
  }

  function openMasterOrders(masterId) {
    const m = (window.DB?.Masters?.get?.(masterId) || {});
    showPane('orders');
    setTimeout(()=>{
      try {
        currentFilter = 'all';
        currentTypeFilter = 'all';
        const q = masterId || m.name || '';
        const input = document.querySelector('.admin-search');
        if (input) input.value = q;
        searchOrders(q);
      } catch(_e) {}
    }, 80);
  }


  function renderAdminShop() {
    const parts = (DB.PartsCatalog?.getAll?.() || window.DB?.state?.()?.partsCatalog || []).filter(Boolean);
    const sales = (window.DB?.Shop?.sales?.() || window.DB?.state?.()?.shopSales || []).filter(Boolean);
    const partOrders = DB.Orders.getAll().filter(o => (o.type || 'service_order') === 'parts_request');
    const lowStock = parts.filter(p => Number(p.qty ?? p.stock ?? p.count ?? 0) <= 2).length;
    const revenue = sales.reduce((sum,s)=>sum + Number(s.total || s.amount || 0), 0);
    const rows = parts.slice(0,80);
    const shopState = window.KaretaToolsState?.load?.('admin-shop') || {};
    const shopFilterNames = ['Все','Масла','Аккумуляторы','Фильтры','Ходовая','Электрика'];
    const shopFiltersHtml = `<div class="mo-filter-bar admin-shop-filter-bar"><div class="mo-filter-tabs">
      ${shopFilterNames.map((x,i)=>`<button class="mo-filter-tab ${((shopState.filter || '')===(x==='Все'?'':x) || (!shopState.filter && i===0))?'active':''}" data-filter="${escapeHtml(x==='Все'?'':x)}" onclick="Admin.filterShop('${x==='Все'?'':x}',this)"><span class="mo-filter-tab-ico">${i===0?'☰':x==='Масла'?'▱':x==='Аккумуляторы'?'▱':x==='Фильтры'?'▣':x==='Ходовая'?'▱':'⌁'}</span>${escapeHtml(x)}</button>`).join('')}
    </div></div>`;
    const shopToolsHtml = window.renderCatalogTools
      ? window.renderCatalogTools('admin-shop', { filtersHtml: shopFiltersHtml })
      : `<div class="catalog-tools catalog-tools--admin-shop masters-sticky-tools admin-shop-tools" data-catalog-tools="admin-shop" data-catalog-render="unified-v2" id="admin-shop-sticky-tools"><div class="catalog-tools__actions" data-catalog-slot="actions" data-tools-scope="admin-shop"><button type="button" class="catalog-tool-btn catalog-tool-btn--sort" aria-label="Сортировка" onclick="window.openMoToolsSort&&openMoToolsSort('admin-shop')"><span class="catalog-tool-btn__ico">↕</span><b>Сортировка</b></button><button type="button" class="catalog-tool-btn catalog-tool-btn--filters" aria-label="Фильтрация" onclick="window.openMoToolsFilters&&openMoToolsFilters('admin-shop')"><span class="catalog-tool-btn__ico">☰</span><b>Фильтрация</b></button><button type="button" class="catalog-tool-btn catalog-tool-btn--settings" aria-label="Настройки страницы" onclick="window.openMoToolsSettings&&openMoToolsSettings('admin-shop')"><span class="catalog-tool-btn__ico">◇</span><b>Настройки страницы</b></button><span class="catalog-tools__state mo-mobile-sort-state" data-sort-scope="admin-shop">Сначала новые</span></div><div class="catalog-tools__inner"><div class="catalog-tools__filters" data-catalog-slot="filters">${shopFiltersHtml}</div><div class="catalog-tools__search" data-catalog-slot="search"><div class="mo-search-action open" data-search-scope="admin-shop"><button type="button" class="mo-search-toggle" aria-expanded="true" aria-controls="mo-search-panel-admin-shop" onclick="window.toggleMoSearch&&toggleMoSearch('admin-shop')"><span class="mo-search-ico">⌕</span><b>Поиск товара</b></button><div class="mo-search-panel" id="mo-search-panel-admin-shop" data-search-panel="admin-shop"><input id="admin-shop-search" class="mo-search-input" data-search-input="admin-shop" type="search" value="${escapeHtml(shopState.q || '')}" placeholder="Найти товар, артикул, категорию..." oninput="window.applyMoSearch?applyMoSearch('admin-shop',this.value):Admin.applyShopSearch()" onkeydown="if(event.key==='Enter'){event.preventDefault();window.runMoSearch?runMoSearch('admin-shop'):Admin.applyShopSearch()}"><button type="button" class="mo-search-clear" aria-label="Очистить поиск" onclick="window.clearMoSearch?clearMoSearch('admin-shop'):(document.getElementById('admin-shop-search').value='',Admin.applyShopSearch())">✕</button><button type="button" class="mo-search-submit" onclick="window.runMoSearch?runMoSearch('admin-shop'):Admin.applyShopSearch()" aria-label="Начать поиск"><span>⌕</span><b>Найти</b></button></div></div></div></div></div>`;
    const shopHeroStats = `<div class="spa-hero-stat"><div class="spa-hero-stat-num">${parts.length}</div><div class="spa-hero-stat-lbl">Позиции</div></div><div class="spa-hero-stat-sep"></div><div class="spa-hero-stat"><div class="spa-hero-stat-num">${partOrders.length}</div><div class="spa-hero-stat-lbl">Запросы</div></div><div class="spa-hero-stat-sep"></div><div class="spa-hero-stat"><div class="spa-hero-stat-num" style="color:#ef4444">${lowStock}</div><div class="spa-hero-stat-lbl">Мало</div></div><div class="spa-hero-stat-sep"></div><div class="spa-hero-stat"><div class="spa-hero-stat-num" style="color:#22c55e;font-size:16px">${revenue.toLocaleString('ru')} ₸</div><div class="spa-hero-stat-lbl">Продажи</div></div>`;
    const shopHeroHtml = window.renderSpaPageHero
      ? window.renderSpaPageHero('admin-shop', {
          id:'hero-admin-shop', className:'spa-page-hero--admin-shop spa-page-hero--compact', icon:'▣',
          label:'Админ-панель', title:'Магазин и запчасти', sub:'Склад, заявки на запчасти и быстрые показатели магазина.',
          mobileTitle:'Магазин', mobileBadge:`${parts.length} позиций`,
          stats:shopHeroStats,
          actions:`<button class="btn btn-primary" onclick="Admin.openPartsQueue('new')">▣ Очередь запчастей</button>`,
          toolsHtml:shopToolsHtml
        })
      : `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:18px"><div><div class="admin-page-title" style="margin:0">▣ Магазин и запчасти</div><div style="font-size:12px;color:var(--text3);margin-top:5px">Админ видит склад, заявки на запчасти и быстрые показатели магазина.</div></div><button class="btn btn-primary" style="font-size:12px;padding:8px 14px" onclick="Admin.openPartsQueue('new')">▣ Открыть очередь запчастей</button></div>`;
    return `<div class="admin-pane admin-shop-pane spa-page">
      ${shopHeroHtml}
      <div class="admin-shop-grid">
        ${[
          [parts.length,'Позиции','▣','var(--orange)'],
          [partOrders.length,'Запросы клиентов','▤','#60a5fa'],
          [lowStock,'Мало на складе','!','#ef4444'],
          [revenue.toLocaleString('ru')+' ₸','Продажи','▥','#22c55e'],
        ].map(([v,l,i,c])=>`<div class="card admin-shop-stat"><div>${i}</div><b style="color:${c}">${v}</b><span>${l}</span></div>`).join('')}
      </div>
      ${window.renderSpaPageHero ? '' : shopToolsHtml}
      <div id="admin-shop-list" class="admin-shop-list">
        ${rows.map(p=>{
          const qty = Number(p.qty ?? p.stock ?? p.count ?? 0);
          const cat = String(p.category || p.cat || 'Прочее');
          return `<div class="card admin-shop-item" data-shop-row="1" data-shop-cat="${escapeHtml(cat)}" data-shop-search="${escapeHtml([p.name,p.title,cat,p.sku].filter(Boolean).join(' ').toLowerCase())}">
            <div class="admin-shop-icon">${qty<=2?'!':'▣'}</div>
            <div style="min-width:0;flex:1"><div class="admin-shop-title">${escapeHtml(p.name||p.title||'Запчасть')}</div><div class="admin-shop-sub">${escapeHtml(cat)}${p.sku?' · '+escapeHtml(p.sku):''}</div></div>
            <div class="admin-shop-meta"><b>${Number(p.price||0).toLocaleString('ru')} ₸</b><span class="${qty<=2?'warn':''}">${qty||0} шт.</span></div>
          </div>`;
        }).join('')}
      </div>
      ${renderPartsQueueSection()}
    </div>`;
  }

  function filterShop(cat, btn) {
    try { window.KaretaToolsState?.save?.('admin-shop', { filter:cat || '' }); } catch(_e){}
    document.querySelectorAll('.admin-shop-tools .mo-filter-tab').forEach(b=>b.classList.toggle('active', b===btn));
    document.querySelectorAll('[data-shop-row]').forEach(r=>{ r.dataset.shopFilter = cat || ''; });
    applyShopSearch();
  }
  function toggleShopSearch(btn) {
    const wrap = btn?.closest?.('.mo-search-action');
    const panel = wrap?.querySelector?.('.mo-search-panel');
    if(!wrap || !panel) return;
    const isHidden = panel.hasAttribute('hidden');
    if(isHidden) panel.removeAttribute('hidden'); else panel.setAttribute('hidden','');
    try { window.KaretaToolsState?.save?.('admin-shop', { searchOpen: !!isHidden }); } catch(_e){}
    wrap.classList.toggle('open', isHidden);
    btn?.setAttribute?.('aria-expanded', isHidden ? 'true' : 'false');
    // admin-shop fallback search panel opens without autofocus; keyboard only on manual input tap.
  }
  function applyShopSearch() {
    const q = String(document.getElementById('admin-shop-search')?.value || document.querySelector('.mo-search-input[data-search-input="admin-shop"]')?.value || '').toLowerCase().trim();
    try { window.KaretaToolsState?.save?.('admin-shop', { q }); } catch(_e){}
    const active = document.querySelector('.admin-shop-tools .mo-filter-tab.active')?.textContent?.trim() || 'Все';
    const cat = active === 'Все' ? '' : active;
    document.querySelectorAll('[data-shop-row]').forEach(r=>{
      const okCat = !cat || String(r.dataset.shopCat||'').toLowerCase().includes(cat.toLowerCase());
      const okQ = !q || String(r.dataset.shopSearch||'').includes(q);
      r.style.display = okCat && okQ ? '' : 'none';
    });
  }

  function renderDashboard() {
    const st = DB.Orders.stats();
    const serviceSt = st.byType?.service_order || { total:0, new:0, process:0, done:0, revenue:0 };
    const partsSt = st.byType?.parts_request || { total:0, new:0, process:0, done:0, revenue:0 };
    const recent = DB.Orders.getAll().slice(0,5);
    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <div class="admin-page-title" style="margin:0">▥ Дэшборд</div>
        <button class="btn btn-primary" style="font-size:13px" onclick="OrderSystem.Wizard.open()">+ Новая заявка</button>
      </div>
      <div class="admin-stats-grid">
        ${[
          { label:'Заявок сегодня', num:st.today, change:st.new+' новых' },
          { label:'В работе', num:st.process, change:'активных' },
          { label:'Обычные заявки', num:serviceSt.total, change:serviceSt.process+' в работе' },
          { label:'Запросы запчастей', num:partsSt.total, change:partsSt.process+' в подборе' },
          { label:'Выручка (ремонт)', num:serviceSt.revenue.toLocaleString('ru')+' ₸', change:serviceSt.done+' выполн.' },
          { label:'Всего заявок', num:st.total, change:'в базе' },
        ].map(s => `
          <div class="astat-card card">
            <div class="astat-label">${s.label}</div>
            <div class="astat-num">${s.num}</div>
            <div class="astat-change up">↑ ${s.change}</div>
          </div>`).join('')}
      </div>
      <div class="admin-quick-actions">
        <div class="aqa-card card" onclick="OrderSystem.Wizard.open()">
          <div class="aqa-ico">▤</div><div><div class="aqa-t">Новая заявка</div><div class="aqa-d">Создать вручную</div></div>
        </div>
        <div class="aqa-card card" onclick="Admin.showPane('calendar')">
          <div class="aqa-ico">□</div><div><div class="aqa-t">Расписание</div><div class="aqa-d">Просмотр записей</div></div>
        </div>
        <div class="aqa-card card" onclick="Admin.openPartsQueue('new')">
          <div class="aqa-ico">▣</div><div><div class="aqa-t">Очередь запчастей</div><div class="aqa-d">${getPartsQueue('new').length} новых / ${getPartsQueue('hold').length} отложено</div></div>
        </div>
        <div class="aqa-card card" onclick="Admin.showPane('shop')">
          <div class="aqa-ico">▣</div><div><div class="aqa-t">Магазин</div><div class="aqa-d">Запчасти, продажи, заявки</div></div>
        </div>
        <div class="aqa-card card" onclick="Admin.showPane('orders')">
          <div class="aqa-ico">◎</div><div><div class="aqa-t">Клиенты в заявках</div><div class="aqa-d">${DB.Clients.getAll().length} клиентов</div></div>
        </div>
        <div class="aqa-card card" onclick="Admin.showPane('masters')">
          <div class="aqa-ico">⌁</div><div><div class="aqa-t">Мастера</div><div class="aqa-d">${(DB.Masters?.getAll?.(true)||[]).length} всего</div></div>
        </div>
        <div class="aqa-card card" onclick="window._quickSearch?.open?.()">
          <div class="aqa-ico">⌕</div><div><div class="aqa-t">Поиск</div><div class="aqa-d">Ctrl+K быстрый поиск</div></div>
        </div>
        <div class="aqa-card card" onclick="window.exportOrdersCSV?.()">
          <div class="aqa-ico">↓</div><div><div class="aqa-t">Экспорт CSV</div><div class="aqa-d">Скачать заявки</div></div>
        </div>
        <div class="aqa-card card" onclick="window.openBusinessHealthModal?.()">
          <div class="aqa-ico">🩺</div><div><div class="aqa-t">Business Health</div><div class="aqa-d">Проверка заявок, чатов, СТО и отзывов</div></div>
        </div>
      </div>
      ${renderPartsQueueSection()}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text2)">Последние заявки</div>
        <button class="act-btn edit" onclick="Admin.showPane('orders')">Все заявки →</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Тип</th><th>Клиент</th><th>Услуга / Деталь</th><th>Дата</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            ${recent.map(o => `
              <tr>
                <td style="color:var(--text3);font-family:'Oswald',sans-serif;font-size:12px">${o.id}</td>
                <td><span class="order-status ${(o.type||'service_order')==='parts_request'?'process':'done'}" style="font-size:10px">${(o.type||'service_order')==='parts_request'?'Запчасти':'Ремонт'}</span></td>
                <td><div style="font-weight:600;font-size:13px">${o.clientName}</div><div style="font-size:11px;color:var(--text3)">${o.clientPhone}</div></td>
                <td style="font-size:13px">${o.serviceNames || o.notes || '—'}</td>
                <td style="color:var(--text2);font-size:12px">${(o.type||'service_order')==='parts_request' ? 'Без записи · запрос запчастей' : ((o.date||'—') + (o.time?' · '+o.time:''))}</td>
                <td style="font-family:'Oswald',sans-serif;font-size:14px;color:var(--orange)">${(o.price||0).toLocaleString('ru')} ₸</td>
                <td><span class="order-status ${o.status}">${statusMap[o.status]}</span></td>
                <td><button class="act-btn view" onclick="OrderSystem.Detail.open('${o.id}')">Открыть</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }


  function orderTypeLabel(type) {
    return type === 'parts_request' ? 'Запчасти' : 'Услуга';
  }

  function currentAdminUserId() {
    return Number(window._appState?.user?.id || 0) || 0;
  }

  function adminCanSeeOrderPersonal(order) {
    const role = String(window._appState?.user?.role || 'guest');
    if (role === 'owner') return true;
    if (role !== 'admin') return true;
    if (String(order.masterId || '0') !== '0') return true;
    return Number(order.assignedAdminUserId || 0) === currentAdminUserId();
  }

  function orderClientLabel(order) {
    return adminCanSeeOrderPersonal(order) ? (order.clientName || '—') : 'Клиент скрыт';
  }

  function orderPhoneLabel(order) {
    return adminCanSeeOrderPersonal(order) ? (order.clientPhone || '—') : 'Доступ после взятия в обработку';
  }

  function orderVehicleLabel(order) {
    return adminCanSeeOrderPersonal(order) ? (order.clientCar || '—') : 'Данные скрыты';
  }

  function orderAdminQueueKey(order) {
    if (String(order.masterId || '0') !== '0') return (order.status === 'process' ? 'queue_work' : 'queue_assigned');
    return Number(order.assignedAdminUserId || 0) > 0 ? 'queue_admin_claimed' : 'queue_new_unassigned';
  }

  function orderAssignedAdminName(order) {
    const uid = Number(order.assignedAdminUserId || 0);
    if (!uid) return 'Свободная очередь';
    const users = window.DB?.Users?.getAll?.() || [];
    const user = users.find(u => Number(u.id || 0) === uid);
    return user?.name || ('Администратор #' + uid);
  }

  function renderAdminOrderCard(order, masters) {
    // Биржевая модель: admin только наблюдает, мастера сами берут заявки
    const isUnassigned = String(order.masterId || '0') === '0';
    const serviceLine  = order.type === 'parts_request'
      ? (order.serviceNames || order.notes || 'Запрос запчастей')
      : (order.serviceNames || '—');

    // Статус в контуре исполнения
    const contourLabel = isUnassigned
      ? '🟡 В бирже — ждёт мастера'
      : (order.status === 'process'
          ? `🟢 В работе · ${order.masterName || 'Мастер'}`
          : `🔵 Назначен · ${order.masterName || 'Мастер'}`);
    const contourColor = isUnassigned ? 'var(--orange)' : (order.status === 'process' ? 'var(--green)' : '#a78bfa');

    // Последние отчёты (до 2 штук)
    const reports = Array.isArray(order.reports) ? order.reports.slice(-2) : [];
    const reportsHtml = reports.length ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Последние отчёты</div>
        ${reports.map(r => `<div style="font-size:12px;color:var(--text2);padding:6px 10px;background:var(--surface);border-radius:var(--ui-radius-sm,5px);margin-bottom:4px">
          📝 ${escapeHtml(r.text ? String(r.text).slice(0,120) : 'Без текста')}
          <span style="font-size:10px;color:var(--text3);margin-left:6px">${escapeHtml(String(r.createdAt||'').slice(0,16).replace('T',' '))}</span>
        </div>`).join('')}
      </div>` : '';


    return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <div style="font-family:'Oswald',sans-serif;font-size:14px;color:var(--text2)">${escapeHtml(order.id)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <span class="order-status ${orderStatusClassSafe(order.status)}" style="font-size:10px">${escapeHtml(orderStatusLabelSafe(order.status, order.type || 'service_order'))}</span>
            <span class="order-status done" style="font-size:10px">${escapeHtml(orderTypeLabel(order.type || 'service_order'))}</span>
            <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:${contourColor}22;color:${contourColor};border:1px solid ${contourColor}44;font-size:10px;font-weight:600">${contourLabel}</span>
          </div>
        </div>
        <div style="text-align:right;min-width:110px">
          <div style="font-family:'Oswald',sans-serif;font-size:20px;color:var(--orange)">${(order.price||0).toLocaleString('ru')} ₸</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">${escapeHtml(order.date || 'Без даты')}${order.time ? ' · ' + escapeHtml(order.time) : ''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px">
        <div style="padding:10px 12px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);background:var(--surface)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Клиент</div>
          <div style="font-weight:700;font-size:13px">${escapeHtml(orderClientLabel(order))}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">
            ${order.clientPhone ? `<a href="tel:${escapeHtml(order.clientPhone)}" style="color:var(--orange)">${escapeHtml(order.clientPhone)}</a>` : '—'}
          </div>
        </div>
        <div style="padding:10px 12px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);background:var(--surface)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Авто / услуга</div>
          <div style="font-weight:700;font-size:13px">${escapeHtml(orderVehicleLabel(order))}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">${escapeHtml(serviceLine)}</div>
        </div>
        <div style="padding:10px 12px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);background:var(--surface)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Отчётов / этапов</div>
          <div style="font-weight:700;font-size:16px;font-family:'Oswald',sans-serif">${(order.reports||[]).length} / ${(order.stages||[]).length}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${isUnassigned ? 'Ждёт исполнителя' : (order.masterName || 'Мастер')}</div>
        </div>
      </div>
      ${reportsHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="act-btn view" onclick="OrderSystem.Detail.open('${order.id}')">📄 Карточка</button>
        <select class="order-status-sel ${order.status}" onchange="Admin.changeStatusDirect('${order.id}',this.value,this)">
          ${(function(){
            const LC = window.KaretaOrderLifecycle;
            const current = LC && LC.normalize ? LC.normalize(order.status || 'new') : String(order.status || 'new');
            const next = LC && LC.allowedNext ? LC.allowedNext(current, 'admin') : [];
            const opts = [current].concat(next.filter(x => x !== current));
            return opts.map(s=>`<option value="${s}" ${s===current?'selected':''}>${orderStatusLabelSafe(s, order.type || 'service_order')}</option>`).join('');
          })()}
        </select>
      </div>
    </div>`;
  }

  function renderOrders() {
    const allOrders = DB.Orders.getAll();
    const counts = {
      all: allOrders.length,
      queue_free: allOrders.filter(o => String(o.masterId||'0') === '0' && orderStatusIsActive(o.status)).length,
      queue_taken: allOrders.filter(o => String(o.masterId||'0') !== '0' && orderStatusIsActive(o.status)).length,
      new: allOrders.filter(o => ['new','waiting_responses'].includes(String(o.status||''))).length,
      process: allOrders.filter(o => o.status === 'process').length,
      done_pending_client: allOrders.filter(o => o.status === 'done_pending_client').length,
      done: allOrders.filter(o => o.status === 'done').length,
      cancelled: allOrders.filter(o => o.status === 'cancelled').length,
      parts_new: getPartsQueue('new').length,
      parts_process: getPartsQueue('process').length,
      parts_hold: getPartsQueue('hold').length,
    };
    const labels = { all:'Все', queue_free:'В бирже', queue_taken:'У мастеров', new:'Новые/отклики', process:'В работе', done_pending_client:'Ждут клиента', done:'Выполнены', cancelled:'Отменены' };
    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div class="admin-page-title" style="margin:0">▤ Заявки</div>
        <button class="btn btn-primary" style="font-size:13px" onclick="OrderSystem.Wizard.open()">+ Новая заявка</button>
      </div>
      <div class="admin-filters">
        ${['all','unassigned','assigned','new','process','done_pending_client','done','cancelled'].map(f =>
          `<button class="admin-filter-btn ${currentFilter===f?'active':''}" data-order-filter="${f}" onclick="Admin.filterOrders('${f}')">${labels[f]} <span style="font-size:10px;opacity:.7">${counts[f]}</span></button>`
        ).join('')}
        <input class="admin-search" placeholder="⌕ Поиск..." oninput="Admin.searchOrders(this.value)">
      </div>
      <div class="admin-filters" style="margin-top:10px">
        ${['all','service_order','parts_request'].map(t =>
          `<button class="admin-filter-btn ${currentTypeFilter===t?'active':''}" data-order-type-filter="${t}" onclick="Admin.filterOrdersType('${t}')">${t==='all'?'Все типы':(t==='parts_request'?'Запчасти':'Обычные заявки')}</button>`
        ).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px;margin-bottom:8px">
        ${[
          ['queue_free','🟡 В бирже','Ожидают мастера — никем не взяты','rgba(245,158,11,.12)','var(--orange)'],
          ['queue_taken','🔵 У мастеров','Взяты мастерами, в процессе выполнения','rgba(167,139,250,.12)','#a78bfa'],
          ['queue_work','🟢 В работе','Статус process — ремонт идёт прямо сейчас','rgba(52,211,153,.12)','var(--green)'],
          ['queue_work','◇ В работе','Активно выполняются мастерами сейчас','rgba(52,211,153,.12)','var(--green)'],
        ].map(([key,title,sub,bg,color])=>`<button class="card" style="text-align:left;padding:16px;border:1px solid var(--line);background:${bg};cursor:pointer" onclick="Admin.filterOrders('${key}')"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-weight:800;font-size:15px">${title}</div><div style="font-size:12px;color:var(--text3);margin-top:4px">${sub}</div></div><div style="font-family:'Oswald',sans-serif;font-size:28px;color:${color};font-weight:700">${counts[key]||0}</div></div></button>`).join('')}
      </div>
      <div class="admin-filters" style="margin-top:10px">
        <button class="admin-filter-btn ${currentTypeFilter==='parts_request' && currentFilter==='all' ? 'active' : ''}" onclick="Admin.openPartsQueue('all')">Все запросы <span style="font-size:10px;opacity:.7">${allOrders.filter(o => (o.type || 'service_order') === 'parts_request').length}</span></button>
        <button class="admin-filter-btn ${currentTypeFilter==='parts_request' && currentFilter==='new' ? 'active' : ''}" onclick="Admin.openPartsQueue('new')">Новые <span style="font-size:10px;opacity:.7">${counts.parts_new}</span></button>
        <button class="admin-filter-btn ${currentTypeFilter==='parts_request' && currentFilter==='process' ? 'active' : ''}" onclick="Admin.openPartsQueue('process')">В подборе <span style="font-size:10px;opacity:.7">${counts.parts_process}</span></button>
        <button class="admin-filter-btn ${currentFilter==='parts_hold' ? 'active' : ''}" onclick="Admin.openPartsQueue('hold')">Отложенные <span style="font-size:10px;opacity:.7">${counts.parts_hold}</span></button>
      </div>
      <div id="admin-orders-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:14px"></div>
    </div>`;
  }


  function initOrders() {
    renderOrdersBody(getFilteredOrders(currentFilter));
  }

  function getFilteredOrders(filter, q='') {
    let orders = DB.Orders.getAll();
    if (filter === 'unassigned') orders = orders.filter(o => String(o.masterId||'0') === '0');
    else if (filter === 'assigned') orders = orders.filter(o => String(o.masterId||'0') !== '0');
    if (filter === 'queue_free')  orders = orders.filter(o => String(o.masterId||'0') === '0' && orderStatusIsActive(o.status));
    else if (filter === 'queue_taken') orders = orders.filter(o => String(o.masterId||'0') !== '0' && orderStatusIsActive(o.status));
    else if (filter === 'queue_work')  orders = orders.filter(o => o.status === 'process' && String(o.masterId||'0') !== '0');
    else if (filter === 'queue_work') orders = orders.filter(o => o.status === 'process' && String(o.masterId||'0') !== '0');
    else if (filter === 'parts_hold') orders = orders.filter(o => (o.type || 'service_order') === 'parts_request' && isPartsDeferred(o));
    else if (filter && filter !== 'all') orders = orders.filter(o => o.status === filter);
    if (currentTypeFilter !== 'all') orders = orders.filter(o => (o.type || 'service_order') === currentTypeFilter);
    if (q) {
      const needle = String(q).toLowerCase();
      orders = orders.filter(o => [o.id, o.clientName, o.clientPhone, o.clientCar, o.serviceNames, o.masterName, o.masterId, o.masterUserId, o.notes, o.type].join(' ').toLowerCase().includes(needle));
    }
    return orders;
  }

  function renderOrdersBody(orders) {
    const root = document.getElementById('admin-orders-body');
    if (!root) return;
    const masters = DB.Masters.getAll(true);
    root.innerHTML = orders.map(function(o){ return renderAdminOrderCard(o, masters); }).join('') || '<div class="card" style="padding:30px;text-align:center;color:var(--text3)">Заявок нет</div>';
  }

  async function claimOrder(id) {
    const key = 'claim:' + String(id||'');
    if (_adminOrderActionBusy.has(key)) return;
    _adminOrderActionBusy.add(key);
    try {
      await DB.Orders.claim(id);
      renderOrdersBody(getFilteredOrders(currentFilter, document.querySelector('.admin-search')?.value || ''));
      window.showToast?.('Заявка взята в обработку. Данные клиента открыты вам.');
    } catch (_e) {
      window.showToast?.((_e && _e.message) || 'Не удалось взять заявку в обработку');
    } finally {
      _adminOrderActionBusy.delete(key);
    }
  }

  async function releaseOrderClaim(id) {
    const key = 'release:' + String(id||'');
    if (_adminOrderActionBusy.has(key)) return;
    _adminOrderActionBusy.add(key);
    try {
      await DB.Orders.releaseClaim(id);
      renderOrdersBody(getFilteredOrders(currentFilter, document.querySelector('.admin-search')?.value || ''));
      window.showToast?.('Заявка возвращена в общую административную очередь');
    } catch (_e) {
      window.showToast?.((_e && _e.message) || 'Не удалось вернуть заявку в очередь');
    } finally {
      _adminOrderActionBusy.delete(key);
    }
  }

  function filterOrders(f) {
    currentFilter = f;
    document.querySelectorAll('[data-order-filter]').forEach(b => b.classList.toggle('active', b.dataset.orderFilter === f));
    renderOrdersBody(getFilteredOrders(f, document.querySelector('.admin-search')?.value || ''));
  }
  function filterOrdersType(type) {
    currentTypeFilter = type;
    document.querySelectorAll('[data-order-type-filter]').forEach(b => b.classList.toggle('active', b.dataset.orderTypeFilter === type));
    renderOrdersBody(getFilteredOrders(currentFilter, document.querySelector('.admin-search')?.value || ''));
  }
  function openPartsQueue(mode='all') {
    currentTypeFilter = 'parts_request';
    currentFilter = mode === 'hold' ? 'parts_hold' : (mode || 'all');
    showPane('orders');
  }
  const _partsQueueBusy = new Map();
  const _orderStatusBusy = new Map();
  const _assignMasterBusy = new Map();
  async function partsQueueAction(id, action) {
    const order = DB.Orders.get(id);
    if (!order || (order.type || 'service_order') !== 'parts_request') return;
    const key = String(id||'') + ':' + String(action||'');
    if (_partsQueueBusy.get(key)) return;
    _partsQueueBusy.set(key, true);
    try {
      if (action === 'process') {
        await DB.Orders.setStatus(id, 'process');
        if (isPartsDeferred(order)) {
          await DB.Orders.update(id, { deferred: false });
        }
        window.showToast?.('Запрос переведён в подбор');
      } else if (action === 'done') {
        await DB.Orders.setStatus(id, 'done');
        window.showToast?.('Запрос запчастей обработан');
      } else if (action === 'hold') {
        await DB.Orders.update(id, { deferred: true });
        window.showToast?.('Запрос отложен');
      } else if (action === 'resume') {
        await DB.Orders.update(id, { deferred: false });
        if (order.status === 'new') await DB.Orders.setStatus(id, 'process');
        window.showToast?.('Запрос возвращён в работу');
      }
      if (activePane === 'dashboard') showPane('dashboard');
      else if (activePane === 'orders') showPane('orders');
    } catch (_e) {
      window.showToast?.('Не удалось обновить очередь запчастей');
    } finally {
      _partsQueueBusy.delete(key);
    }
  }

  function searchOrders(q) { renderOrdersBody(getFilteredOrders(currentFilter, q)); }
  async function changeStatus(id) {
    const key = String(id||'') + ':flow';
    if (_orderStatusBusy.get(key)) return;
    const o = DB.Orders.get(id); if (!o) return;
    const LC = window.KaretaOrderLifecycle;
    const next = LC && LC.nextStatus ? LC.nextStatus(o.status || 'new', 'admin') : null;
    if (!next) return;
    _orderStatusBusy.set(key, true);
    try {
      await DB.Orders.setStatus(id, next);
      renderOrdersBody(getFilteredOrders(currentFilter, document.querySelector('.admin-search')?.value || ''));
    } catch (_e) {
      window.showToast?.((_e && _e.message) ? _e.message : 'Не удалось изменить статус');
    } finally {
      _orderStatusBusy.delete(key);
    }
  }
  async function assignMaster(id, masterId) {
    const key = String(id||'');
    if (_assignMasterBusy.get(key)) return;
    _assignMasterBusy.set(key, true);
    try {
      await DB.Orders.assignMaster(id, masterId || '0');
      renderOrdersBody(getFilteredOrders(currentFilter, document.querySelector('.admin-search')?.value || ''));
      window.showToast?.(String(masterId||'0') !== '0' ? 'Мастер назначен и чат передан' : 'Заявка возвращена администрации');
    } catch (_e) {
      window.showToast?.((_e && _e.message) ? _e.message : 'Ошибка назначения мастера');
    } finally {
      _assignMasterBusy.delete(key);
    }
  }
  async function changeStatusDirect(id, status, sel) {
    const key = String(id||'') + ':direct:' + String(status||'');
    if (_orderStatusBusy.get(key)) return;
    _orderStatusBusy.set(key, true);
    if (sel) { sel.disabled = true; sel.style.pointerEvents = 'none'; }
    try {
      await DB.Orders.setStatus(id, status);
      if (sel) sel.className = 'order-status-sel ' + orderStatusClassSafe(status);
      if (window.showToast) showToast('Статус: ' + orderStatusLabelSafe(status));
    } catch (_e) {
      window.showToast?.((_e && _e.message) ? _e.message : 'Не удалось изменить статус');
    } finally {
      if (sel) { sel.disabled = false; sel.style.pointerEvents = ''; }
      _orderStatusBusy.delete(key);
    }
  }


  function blocksToText(list){
    return (Array.isArray(list)?list:[]).map(item=>`${item.title||''}
${item.text||''}`.trim()).filter(Boolean).join('\n\n');
  }
  function textToBlocks(text){
    return String(text||'').split(/\n\s*\n/).map(block=>block.trim()).filter(Boolean).map(block=>{
      const lines = block.split(/\n/);
      return { title:(lines.shift()||'').trim(), text:lines.join('\n').trim() };
    }).filter(item=>item.title || item.text);
  }
  function faqToText(list){
    return (Array.isArray(list)?list:[]).map(item=>`${item.q||item.question||''}\n${item.a||item.answer||''}`.trim()).filter(Boolean).join('\n\n');
  }
  function textToFaq(text){
    return String(text||'').split(/\n\s*\n/).map(block=>block.trim()).filter(Boolean).map(block=>{
      const lines = block.split(/\n/);
      return { q:(lines.shift()||'').trim(), a:lines.join('\n').trim() };
    }).filter(item=>item.q || item.a);
  }

  function renderSiteCms() {
    const navRow = window.DB?.Content?.get?.('nav_main') || { body:{ items:[] } };
    const contacts = window.getContactsContent ? window.getContactsContent() : {};
    const home = (window.getHomeContent ? window.getHomeContent() : { body:{} }).body || {};
    const aboutPage = window.getAboutPageContent ? window.getAboutPageContent() : {};
    const reviewsPage = window.getReviewsPageContent ? window.getReviewsPageContent() : {};
    const footerPage = window.getFooterContent ? window.getFooterContent() : {};
    const faqPage = window.getFaqPageContent ? window.getFaqPageContent() : {};
    const privacyPage = window.getLegalPageContent ? window.getLegalPageContent('privacy') : {};
    const termsPage = window.getLegalPageContent ? window.getLegalPageContent('terms') : {};
    const pageMeta = window.getPageMetaContent ? window.getPageMetaContent() : { pages:{} };
    const servicesFaq = window.DB?.Content?.get?.('services_faq')?.body || [];
    const aboutIntro = window.DB?.Content?.get?.('about_intro')?.body || {};
    const navItems = Array.isArray(navRow?.body?.items) && navRow.body.items.length ? navRow.body.items : [
      { key:'home', label:'Главная', sort:10, active:1 },
      { key:'services', label:'Услуги', sort:20, active:1 },
      { key:'pricing', label:'Прайс', sort:30, active:1 },
      { key:'parts', label:'Запчасти', sort:40, active:1 },
      { key:'booking', label:'Запись', sort:50, active:1 },
      { key:'about', label:'О нас', sort:60, active:1 },
      { key:'reviews', label:'Отзывы', sort:70, active:1 },
      { key:'contacts', label:'Контакты', sort:80, active:1 },
    ];
    return `<div class="admin-pane">
      <div class="admin-page-title">○ Сайт и меню</div>
      <div class="p-note" style="margin-bottom:18px">CMS-контур публичных страниц: навигация, главная, FAQ, правовые страницы, отзывы, контакты и footer/meta.</div>

      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">Главное меню</div>
        <div style="display:grid;gap:10px">
          ${navItems.map((item, idx)=>`
            <div style="display:grid;grid-template-columns:140px 1fr 70px 90px;gap:10px;align-items:center">
              <input class="admin-search" data-nav-key value="${escapeHtml(item.key||'')}" placeholder="route key">
              <input class="admin-search" data-nav-label value="${escapeHtml(item.label||'')}" placeholder="Подпись">
              <input class="admin-search" data-nav-sort value="${escapeHtml(item.sort ?? (idx+1)*10)}" placeholder="sort">
              <label style="font-size:12px;color:var(--text2);display:flex;align-items:center;gap:6px"><input type="checkbox" data-nav-active ${item.active!==false && item.active!==0 ? 'checked':''}> Активно</label>
            </div>`).join('')}
        </div>
      </div>

      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">Главная страница</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Badge / локация</label>
          <input id="site-home-location" class="admin-search" value="${escapeHtml(home.locationBadge || '')}" placeholder="Усть-Каменогорск · Гоголя 36А">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Заголовок hero</label>
          <textarea id="site-home-title" class="admin-search" style="min-height:80px">${escapeHtml(home.titleHtml || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Описание hero</label>
          <textarea id="site-home-desc" class="admin-search" style="min-height:96px">${escapeHtml(home.descHtml || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Заголовок CTA</label>
          <input id="site-home-cta-title" class="admin-search" value="${escapeHtml(home.ctaTitle || '')}" placeholder="Есть вопросы по ремонту?">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подзаголовок CTA</label>
          <textarea id="site-home-cta-sub" class="admin-search" style="min-height:72px">${escapeHtml(home.ctaSubtitle || '')}</textarea>
        </div>
      </div>

      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">О нас</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Метка hero</label>
          <input id="site-about-hero-label" class="admin-search" value="${escapeHtml(aboutPage.heroLabel || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Заголовок hero</label>
          <input id="site-about-hero-title" class="admin-search" value="${escapeHtml(aboutPage.heroTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подзаголовок hero</label>
          <textarea id="site-about-hero-sub" class="admin-search" style="min-height:72px">${escapeHtml(aboutPage.heroSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Лид абзац</label>
          <textarea id="site-about-lead" class="admin-search" style="min-height:90px">${escapeHtml(aboutIntro.lead || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Основной текст</label>
          <textarea id="site-about-text" class="admin-search" style="min-height:110px">${escapeHtml(aboutIntro.text || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Строка адреса</label>
          <input id="site-about-address" class="admin-search" value="${escapeHtml(aboutIntro.address || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Заголовок команды</label>
          <input id="site-about-team-title" class="admin-search" value="${escapeHtml(aboutPage.teamTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Вакансия — заголовок</label>
          <input id="site-about-vacancy-title" class="admin-search" value="${escapeHtml(aboutPage.vacancyTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Вакансия — текст</label>
          <input id="site-about-vacancy-text" class="admin-search" value="${escapeHtml(aboutPage.vacancyText || '')}">
        </div>
      </div>

      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">Отзывы</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Метка hero</label>
          <input id="site-reviews-hero-label" class="admin-search" value="${escapeHtml(reviewsPage.heroLabel || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Заголовок hero</label>
          <input id="site-reviews-hero-title" class="admin-search" value="${escapeHtml(reviewsPage.heroTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подзаголовок hero</label>
          <textarea id="site-reviews-hero-sub" class="admin-search" style="min-height:72px">${escapeHtml(reviewsPage.heroSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подпись статистики</label>
          <input id="site-reviews-stats-label" class="admin-search" value="${escapeHtml(reviewsPage.statsLabel || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">CTA заголовок</label>
          <input id="site-reviews-cta-title" class="admin-search" value="${escapeHtml(reviewsPage.ctaTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">CTA подзаголовок</label>
          <textarea id="site-reviews-cta-sub" class="admin-search" style="min-height:72px">${escapeHtml(reviewsPage.ctaSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Текст формы</label>
          <input id="site-reviews-form-title" class="admin-search" value="${escapeHtml(reviewsPage.formTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подпись формы</label>
          <input id="site-reviews-form-sub" class="admin-search" value="${escapeHtml(reviewsPage.formSubtitle || '')}">
        </div>
      </div>



      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">FAQ и правовые страницы</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:start">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">FAQ — метка hero</label>
          <input id="site-faq-hero-label" class="admin-search" value="${escapeHtml(faqPage.heroLabel || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">FAQ — заголовок</label>
          <input id="site-faq-hero-title" class="admin-search" value="${escapeHtml(faqPage.heroTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">FAQ — подзаголовок</label>
          <textarea id="site-faq-hero-sub" class="admin-search" style="min-height:72px">${escapeHtml(faqPage.heroSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">FAQ — CTA</label>
          <input id="site-faq-cta-title" class="admin-search" value="${escapeHtml(faqPage.ctaTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">FAQ — CTA подпись</label>
          <textarea id="site-faq-cta-sub" class="admin-search" style="min-height:72px">${escapeHtml(faqPage.ctaSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Вопросы и ответы</label>
          <textarea id="site-services-faq" class="admin-search" style="min-height:220px" placeholder="Вопрос
Ответ

Следующий вопрос
Следующий ответ">${escapeHtml(faqToText(servicesFaq))}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Privacy — заголовок</label>
          <input id="site-privacy-title" class="admin-search" value="${escapeHtml(privacyPage.heroTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Privacy — описание</label>
          <textarea id="site-privacy-sub" class="admin-search" style="min-height:72px">${escapeHtml(privacyPage.heroSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Privacy — обновлено</label>
          <input id="site-privacy-updated" class="admin-search" value="${escapeHtml(privacyPage.updatedAt || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Privacy — блоки</label>
          <textarea id="site-privacy-blocks" class="admin-search" style="min-height:220px" placeholder="Заголовок раздела
Текст раздела

Следующий раздел
Текст">${escapeHtml(blocksToText(privacyPage.sections))}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Terms — заголовок</label>
          <input id="site-terms-title" class="admin-search" value="${escapeHtml(termsPage.heroTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Terms — описание</label>
          <textarea id="site-terms-sub" class="admin-search" style="min-height:72px">${escapeHtml(termsPage.heroSubtitle || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Terms — обновлено</label>
          <input id="site-terms-updated" class="admin-search" value="${escapeHtml(termsPage.updatedAt || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Terms — блоки</label>
          <textarea id="site-terms-blocks" class="admin-search" style="min-height:220px" placeholder="Заголовок раздела
Текст раздела

Следующий раздел
Текст">${escapeHtml(blocksToText(termsPage.sections))}</textarea>
        </div>
      </div>
      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">Footer сайта</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Brand HTML</label>
          <input id="site-footer-brand" class="admin-search" value="${escapeHtml(footerPage.brandHtml || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Copy</label>
          <input id="site-footer-copy" class="admin-search" value="${escapeHtml(footerPage.copyText || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подпись</label>
          <input id="site-footer-note" class="admin-search" value="${escapeHtml(footerPage.note || '')}">
        </div>
      </div>

      <div class="card" style="padding:18px;margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">Meta / SEO</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Default title</label>
          <input id="site-meta-default-title" class="admin-search" value="${escapeHtml(pageMeta.defaultTitle || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Title suffix</label>
          <input id="site-meta-title-suffix" class="admin-search" value="${escapeHtml(pageMeta.titleSuffix || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Default description</label>
          <textarea id="site-meta-default-desc" class="admin-search" style="min-height:90px">${escapeHtml(pageMeta.defaultDescription || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Home title</label>
          <input id="site-meta-home-title" class="admin-search" value="${escapeHtml(pageMeta.pages?.home?.title || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Home description</label>
          <textarea id="site-meta-home-desc" class="admin-search" style="min-height:72px">${escapeHtml(pageMeta.pages?.home?.description || '')}</textarea>
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Contacts title</label>
          <input id="site-meta-contacts-title" class="admin-search" value="${escapeHtml(pageMeta.pages?.contacts?.title || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Contacts description</label>
          <textarea id="site-meta-contacts-desc" class="admin-search" style="min-height:72px">${escapeHtml(pageMeta.pages?.contacts?.description || '')}</textarea>
        </div>
      </div>
      <div class="card" style="padding:18px">
        <div style="font-weight:800;font-size:16px;margin-bottom:12px">Контакты сайта</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Название сервиса</label>
          <input id="site-contacts-name" class="admin-search" value="${escapeHtml(contacts.name || 'KARETA.KZ — Автосервис')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Телефон</label>
          <input id="site-contacts-phone" class="admin-search" value="${escapeHtml(contacts.phone || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подпись телефона</label>
          <input id="site-contacts-phone-label" class="admin-search" value="${escapeHtml(contacts.phoneLabel || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Адрес</label>
          <input id="site-contacts-address" class="admin-search" value="${escapeHtml(contacts.address || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Email</label>
          <input id="site-contacts-email" class="admin-search" value="${escapeHtml(contacts.email || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Instagram URL</label>
          <input id="site-contacts-instagram" class="admin-search" value="${escapeHtml(contacts.instagram || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Instagram label</label>
          <input id="site-contacts-instagram-label" class="admin-search" value="${escapeHtml(contacts.instagramLabel || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Подсказка карты</label>
          <input id="site-contacts-map-hint" class="admin-search" value="${escapeHtml(contacts.mapHint || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Map URL</label>
          <input id="site-contacts-map-url" class="admin-search" value="${escapeHtml(contacts.mapUrl || '')}">
          <label style="font-size:12px;color:var(--text3);text-transform:uppercase">Map embed HTML</label>
          <textarea id="site-contacts-map-embed" class="admin-search" style="min-height:120px">${escapeHtml(contacts.mapEmbed || '')}</textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-primary" onclick="Admin.saveSiteCms(this)">Сохранить сайт</button>
          <button class="btn btn-outline" onclick="Admin.showPane('site_cms')">↻ Обновить форму</button>
        </div>
      </div>
    </div>`;
  }

  async function saveSiteCms(btn) {
    const navRows = Array.from(document.querySelectorAll('[data-nav-key]')).map((keyInput, idx) => {
      const row = keyInput.parentElement;
      return {
        key: String(keyInput.value || '').trim(),
        label: String(row.querySelector('[data-nav-label]')?.value || '').trim(),
        sort: Number(row.querySelector('[data-nav-sort]')?.value || ((idx+1)*10)) || ((idx+1)*10),
        active: row.querySelector('[data-nav-active]')?.checked ? 1 : 0,
      };
    }).filter(row => row.key);
    const contactsExisting = window.DB?.Content?.get?.('contacts_page') || { title:'Контакты KARETA', body:{} };
    const contactsBody = Object.assign({}, contactsExisting.body || {}, {
      name: document.getElementById('site-contacts-name')?.value?.trim() || 'KARETA.KZ — Автосервис',
      phone: document.getElementById('site-contacts-phone')?.value?.trim() || '',
      phoneLabel: document.getElementById('site-contacts-phone-label')?.value?.trim() || '',
      address: document.getElementById('site-contacts-address')?.value?.trim() || '',
      email: document.getElementById('site-contacts-email')?.value?.trim() || '',
      instagram: document.getElementById('site-contacts-instagram')?.value?.trim() || '',
      instagramLabel: document.getElementById('site-contacts-instagram-label')?.value?.trim() || '',
      mapHint: document.getElementById('site-contacts-map-hint')?.value?.trim() || '',
      mapUrl: document.getElementById('site-contacts-map-url')?.value?.trim() || '',
      mapEmbed: document.getElementById('site-contacts-map-embed')?.value?.trim() || '',
    });
    const homeExisting = window.DB?.Content?.get?.('home_page') || { title:'Главная страница', body:{} };
    const homeBody = Object.assign({}, homeExisting.body || {}, {
      locationBadge: document.getElementById('site-home-location')?.value?.trim() || '',
      titleHtml: document.getElementById('site-home-title')?.value?.trim() || '',
      descHtml: document.getElementById('site-home-desc')?.value?.trim() || '',
      ctaTitle: document.getElementById('site-home-cta-title')?.value?.trim() || '',
      ctaSubtitle: document.getElementById('site-home-cta-sub')?.value?.trim() || '',
    });
    const aboutExisting = window.DB?.Content?.get?.('about_page') || { title:'О нас', body:{} };
    const aboutBody = Object.assign({}, aboutExisting.body || {}, {
      heroLabel: document.getElementById('site-about-hero-label')?.value?.trim() || '',
      heroTitle: document.getElementById('site-about-hero-title')?.value?.trim() || '',
      heroSubtitle: document.getElementById('site-about-hero-sub')?.value?.trim() || '',
      teamTitle: document.getElementById('site-about-team-title')?.value?.trim() || '',
      vacancyTitle: document.getElementById('site-about-vacancy-title')?.value?.trim() || '',
      vacancyText: document.getElementById('site-about-vacancy-text')?.value?.trim() || '',
      vacancyButton: aboutExisting.body?.vacancyButton || 'Позвонить',
    });
    const aboutIntroExisting = window.DB?.Content?.get?.('about_intro') || { title:'О компании', body:{} };
    const aboutIntroBody = Object.assign({}, aboutIntroExisting.body || {}, {
      lead: document.getElementById('site-about-lead')?.value?.trim() || '',
      text: document.getElementById('site-about-text')?.value?.trim() || '',
      address: document.getElementById('site-about-address')?.value?.trim() || '',
    });
    const reviewsExisting = window.DB?.Content?.get?.('reviews_page') || { title:'Отзывы', body:{} };
    const reviewsBody = Object.assign({}, reviewsExisting.body || {}, {
      heroLabel: document.getElementById('site-reviews-hero-label')?.value?.trim() || '',
      heroTitle: document.getElementById('site-reviews-hero-title')?.value?.trim() || '',
      heroSubtitle: document.getElementById('site-reviews-hero-sub')?.value?.trim() || '',
      statsLabel: document.getElementById('site-reviews-stats-label')?.value?.trim() || '',
      ctaTitle: document.getElementById('site-reviews-cta-title')?.value?.trim() || '',
      ctaSubtitle: document.getElementById('site-reviews-cta-sub')?.value?.trim() || '',
      formTitle: document.getElementById('site-reviews-form-title')?.value?.trim() || '',
      formSubtitle: document.getElementById('site-reviews-form-sub')?.value?.trim() || '',
    });
    const faqExisting = window.DB?.Content?.get?.('faq_page') || { title:'FAQ', body:{} };
    const faqBody = Object.assign({}, faqExisting.body || {}, {
      heroLabel: document.getElementById('site-faq-hero-label')?.value?.trim() || '',
      heroTitle: document.getElementById('site-faq-hero-title')?.value?.trim() || '',
      heroSubtitle: document.getElementById('site-faq-hero-sub')?.value?.trim() || '',
      ctaTitle: document.getElementById('site-faq-cta-title')?.value?.trim() || '',
      ctaSubtitle: document.getElementById('site-faq-cta-sub')?.value?.trim() || '',
      ctaButton: faqExisting.body?.ctaButton || '□ Создать заявку',
    });
    const servicesFaqBody = textToFaq(document.getElementById('site-services-faq')?.value || '');
    const privacyExisting = window.DB?.Content?.get?.('privacy_page') || { title:'Политика конфиденциальности', body:{} };
    const privacyBody = Object.assign({}, privacyExisting.body || {}, {
      heroLabel: privacyExisting.body?.heroLabel || 'Правовая информация',
      heroTitle: document.getElementById('site-privacy-title')?.value?.trim() || '',
      heroSubtitle: document.getElementById('site-privacy-sub')?.value?.trim() || '',
      updatedAt: document.getElementById('site-privacy-updated')?.value?.trim() || '',
      sections: textToBlocks(document.getElementById('site-privacy-blocks')?.value || ''),
    });
    const termsExisting = window.DB?.Content?.get?.('terms_page') || { title:'Правила сервиса', body:{} };
    const termsBody = Object.assign({}, termsExisting.body || {}, {
      heroLabel: termsExisting.body?.heroLabel || 'Правовая информация',
      heroTitle: document.getElementById('site-terms-title')?.value?.trim() || '',
      heroSubtitle: document.getElementById('site-terms-sub')?.value?.trim() || '',
      updatedAt: document.getElementById('site-terms-updated')?.value?.trim() || '',
      sections: textToBlocks(document.getElementById('site-terms-blocks')?.value || ''),
    });
    const footerExisting = window.DB?.Content?.get?.('footer_page') || { title:'Footer сайта', body:{} };
    const footerBody = Object.assign({}, footerExisting.body || {}, {
      brandHtml: document.getElementById('site-footer-brand')?.value?.trim() || '',
      copyText: document.getElementById('site-footer-copy')?.value?.trim() || '',
      note: document.getElementById('site-footer-note')?.value?.trim() || '',
    });
    const pageMetaExisting = window.DB?.Content?.get?.('page_meta') || { title:'Page meta', body:{ pages:{} } };
    const pageMetaBody = Object.assign({}, pageMetaExisting.body || {}, {
      defaultTitle: document.getElementById('site-meta-default-title')?.value?.trim() || '',
      titleSuffix: document.getElementById('site-meta-title-suffix')?.value?.trim() || '',
      defaultDescription: document.getElementById('site-meta-default-desc')?.value?.trim() || '',
      pages: Object.assign({}, pageMetaExisting.body?.pages || {}, {
        home: Object.assign({}, pageMetaExisting.body?.pages?.home || {}, {
          title: document.getElementById('site-meta-home-title')?.value?.trim() || '',
          description: document.getElementById('site-meta-home-desc')?.value?.trim() || '',
        }),
        contacts: Object.assign({}, pageMetaExisting.body?.pages?.contacts || {}, {
          title: document.getElementById('site-meta-contacts-title')?.value?.trim() || '',
          description: document.getElementById('site-meta-contacts-desc')?.value?.trim() || '',
        }),
        faq: Object.assign({}, pageMetaExisting.body?.pages?.faq || {}, {
          title: 'FAQ — KARETA.KZ',
          description: 'Ответы на частые вопросы по ремонту, диагностике и записи в KARETA.KZ.',
        }),
        privacy: Object.assign({}, pageMetaExisting.body?.pages?.privacy || {}, {
          title: 'Конфиденциальность — KARETA.KZ',
          description: 'Политика конфиденциальности KARETA.KZ.',
        }),
        terms: Object.assign({}, pageMetaExisting.body?.pages?.terms || {}, {
          title: 'Правила сервиса — KARETA.KZ',
          description: 'Правила и порядок работы сервиса KARETA.KZ.',
        }),
      }),
    });
    try{
      if(btn) btn.disabled = true;
      await window.DB.Content.save('nav_main', { title:'Главное меню сайта', body:{ items: navRows } });
      await window.DB.Content.save('contacts_page', { title: contactsExisting.title || 'Контакты KARETA', body: contactsBody });
      await window.DB.Content.save('home_page', { title: homeExisting.title || 'Главная страница', body: homeBody });
      await window.DB.Content.save('about_page', { title: aboutExisting.title || 'О нас', body: aboutBody });
      await window.DB.Content.save('about_intro', { title: aboutIntroExisting.title || 'О компании', body: aboutIntroBody });
      await window.DB.Content.save('reviews_page', { title: reviewsExisting.title || 'Отзывы', body: reviewsBody });
      await window.DB.Content.save('faq_page', { title: faqExisting.title || 'FAQ', body: faqBody });
      await window.DB.Content.save('services_faq', { title: 'FAQ по услугам', body: servicesFaqBody });
      await window.DB.Content.save('privacy_page', { title: privacyExisting.title || 'Политика конфиденциальности', body: privacyBody });
      await window.DB.Content.save('terms_page', { title: termsExisting.title || 'Правила сервиса', body: termsBody });
      await window.DB.Content.save('footer_page', { title: footerExisting.title || 'Footer сайта', body: footerBody });
      await window.DB.Content.save('page_meta', { title: pageMetaExisting.title || 'Page meta', body: pageMetaBody });
      window.showToast?.('Сайт сохранён');
      try{ window.App?.rebuildNav?.(); window.App?.refreshSiteChrome?.(); }catch(_e){}
      Admin.showPane('site_cms');
    }catch(e){
      window.showToast?.((e && e.message) || 'Не удалось сохранить настройки сайта', 'error');
    }finally{
      if(btn) btn.disabled = false;
    }
  }

  function openOrder(id) { OrderSystem.Detail.open(id); }

  // Кэш пользователей для renderRoles — заполняется из MySQL
  let _rolesUsersCache = null;
  let _rolesLoadingPromise = null;

  function _loadAllUsersFromServer() {
    if (_rolesLoadingPromise) return _rolesLoadingPromise;
    const _fetchStart = Date.now();
    window.KaretaLogger?.log('fetch', 'request_start: users.getAll', { pane: activePane });
    _rolesLoadingPromise = fetch('api/db.php', {
      method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'users.getAll'})
    }).then(r=>r.json()).then(d=>{
      window.KaretaLogger?.log('fetch', `request_done: users.getAll (${Date.now()-_fetchStart}ms)`, { ok: d.ok, count: d.users?.length });
      if (d.ok && Array.isArray(d.users)) {
        _rolesUsersCache = d.users;
        try { window.RBAC?._syncFromDB?.(d.users); } catch(_e) {}
      }
      return _rolesUsersCache || [];
    }).catch(()=>{ return _rolesUsersCache || []; })
    .finally(()=>{ _rolesLoadingPromise = null; });
    return _rolesLoadingPromise;
  }

  function renderRoles() {
    // Инициируем загрузку с сервера и перерисовываем после получения
    _loadAllUsersFromServer().then(serverUsers => {
      if (serverUsers.length && activePane === 'roles') {
        const panes = document.getElementById('admin-panes');
        if (panes) {
          panes.innerHTML = _renderRolesContent(serverUsers);
          panes.querySelector('.admin-pane')?.classList.add('active');
        }
      }
    });

    // Первый рендер: используем кэш (если есть) или локальные данные
    const initialUsers = _rolesUsersCache || _buildLocalUsersList();
    window.KaretaLogger?.log('render', 'renderRoles', { users: initialUsers.length, from_cache: !!_rolesUsersCache });
    const html = _renderRolesContent(initialUsers);
    // Если кэш пустой — показываем строку загрузки в таблице
    if (!_rolesUsersCache) {
      setTimeout(() => {
        const tbody = document.querySelector('#roles-table tbody');
        if (tbody && !tbody.querySelector('tr')) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">⏳ Загружаем список аккаунтов…</td></tr>';
        }
      }, 50);
    }
    return html;
  }

  function _buildLocalUsersList() {
    // Объединяем RBAC sessionStorage + мастеров из DB (fallback до загрузки сервера)
    const rbacUsers = window.RBAC?.getAllUsers?.('all') || [];
    // Также добавляем клиентов из DB.Clients которых нет в RBAC
    const dbClients = window.DB?.Clients?.getAll?.() || [];
    const allUsers = rbacUsers.slice();
    dbClients.forEach(c => {
      const phone = (c.phone||'').replace(/\D/g,'');
      if (!phone) return;
      const inList = allUsers.find(u => (u.phone||'').replace(/\D/g,'') === phone);
      if (!inList) allUsers.push({
        phone: c.phone, name: c.name||'Клиент', role: 'client',
        initials: c.initials||(c.name||'К').slice(0,2), active: c.active!==false,
        _fromClients: true
      });
    });
    const dbMasters = (window.DB?.Masters?.getAll?.(true) || []);
    dbMasters.forEach(m => {
      const phone = (m.phone||'').replace(/\D/g,'');
      const inList = allUsers.find(u => (u.phone||'').replace(/\D/g,'') === phone);
      if (!inList && phone) allUsers.push({
        phone: m.phone, name: m.name, role: 'master',
        initials: m.initials||'М', active: m.active !== false, _masterOnly: true
      });
    });
    return allUsers;
  }

  function _renderRolesContent(allUsers) {

    const actor = window._appState?.user || null;
    const actorLevel = window.RBAC?.getRole(actor)?.level || 0;
    const ROLE_COLORS = {guest:'#52525a',client:'#60a5fa',master:'#34d399',admin:'#f59e0b',owner:'#FF6B00'};
    const ROLE_EMOJI  = {guest:'○',client:'○',master:'⌁',admin:'◇',owner:'◇'};

    // Group by role
    const byRole = {owner:[],admin:[],master:[],client:[],guest:[]};
    allUsers.forEach(u => { (byRole[u.role] || byRole.guest).push(u); });
    const sorted = [...byRole.owner,...byRole.admin,...byRole.master,...byRole.client,...byRole.guest];

    const roleCounts = Object.fromEntries(Object.entries(byRole).map(([r,arr])=>[r,arr.length]));

    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px">
        <div class="admin-page-title" style="margin:0">◌ Роли и доступ</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="admin-search" placeholder="⌕ Поиск..." style="width:180px" oninput="Admin._rolesSearch(this.value)">
          <button class="btn btn-outline" style="font-size:12px;padding:7px 14px" onclick="Admin.showPane('roles')">↻ Обновить</button>
        </div>
      </div>

      <!-- Role summary chips -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        ${Object.entries(roleCounts).filter(([,c])=>c>0).map(([r,c])=>`
          <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;background:${ROLE_COLORS[r]||'#666'}18;border:1px solid ${ROLE_COLORS[r]||'#666'}33;border-radius:99px;font-size:12px;font-weight:600;color:${ROLE_COLORS[r]||'var(--text2)'}">
            ${ROLE_EMOJI[r]||'?'} ${r} <span style="font-size:11px;opacity:.7">${c}</span>
          </div>`).join('')}
        <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:99px;font-size:12px;color:var(--text3)">
          ◎ Всего ${allUsers.length}
        </div>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table" id="roles-table">
          <thead><tr>
            <th>Пользователь</th>
            <th>Телефон</th>
            <th>Роль</th>
            <th>Изменить роль</th>
            <th>Статус</th>
            <th>Заявок</th>
          </tr></thead>
          <tbody>
            ${sorted.map(u => {
              const level  = window.RBAC?.getRole(u)?.level || (u.role==='master'?2:u.role==='admin'?3:1);
              const locked = level >= actorLevel;
              const color  = ROLE_COLORS[u.role] || '#666';
              const ordCnt = (window.DB?.Orders?.getAll?.()||[]).filter(o =>
                (o.clientPhone||'').replace(/\D/g,'') === (u.phone||'').replace(/\D/g,'') ||
                (o.masterPhone||'').replace(/\D/g,'') === (u.phone||'').replace(/\D/g,'')
              ).length;
              const assignable = ['client','master','admin'].filter(r =>
                (window.RBAC?.ROLES?.[r]?.level||0) < actorLevel
              );
              return `<tr data-role-row="${u.role}" data-name="${(u.name||'').toLowerCase()}">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:50%;background:${color}20;border:1.5px solid ${color}44;display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;color:${color};flex-shrink:0">${escapeHtml(u.initials||u.name?.[0]||'?')}</div>
                    <div>
                      <div style="font-weight:600;font-size:13px">${escapeHtml(u.name||'—')}${u._masterOnly?'<span style="font-size:10px;color:var(--text3);margin-left:6px">(только мастер)</span>':''}</div>
                      <div style="font-size:10px;color:var(--text3)">${escapeHtml(u.car||u.spec||'')}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:12px"><a href="tel:${escapeHtml(u.phone||'')}" style="color:var(--orange)">${escapeHtml(u.phone||'—')}</a></td>
                <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${color};background:${color}15;padding:3px 10px;border-radius:99px">${ROLE_EMOJI[u.role]||'?'} ${u.role}</span></td>
                <td>
                  ${!locked && assignable.length
                    ? `<select class="admin-search" style="font-size:12px;padding:5px 8px;min-width:110px" onchange="Admin.changeUserRole('${escapeHtml(u.phone)}', this.value)">
                        ${assignable.map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${ROLE_EMOJI[r]} ${r}</option>`).join('')}
                       </select>`
                    : `<span style="font-size:11px;color:var(--text3)">—</span>`}
                </td>
                <td>
                  ${!locked
                    ? `<button onclick="Admin.toggleUserActive('${escapeHtml(u.phone)}',${u.active===false})"
                        style="font-size:11px;padding:4px 10px;border-radius:var(--ui-radius-sm,5px);border:1px solid ${u.active!==false?'#22c55e':'#ef4444'}33;background:${u.active!==false?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};color:${u.active!==false?'#22c55e':'#ef4444'};cursor:pointer;font-weight:600">
                        ${u.active!==false ? '✓ Активен' : '✗ Заблокирован'}
                       </button>`
                    : `<span style="font-size:11px;color:${u.active!==false?'var(--green)':'#ef4444'}">${u.active!==false?'Активен':'Заблокирован'}</span>`}
                </td>
                <td style="font-family:'Oswald',sans-serif;font-size:14px;color:var(--orange)">${ordCnt}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function _rolesSearch(q) {
    const rows = document.querySelectorAll('#roles-table tbody tr');
    const ql = q.toLowerCase();
    rows.forEach(r => {
      r.style.display = !q || r.dataset.name?.includes(ql) || r.textContent.toLowerCase().includes(ql) ? '' : 'none';
    });
  }

  function changeUserRole(phone, role) {
    const actor = window._appState?.user || null;
    const res = window.RBAC?.setRole?.(actor, phone, role);
    if (res?.ok) {
      window.showToast?.('✅ Роль обновлена');
      // Also persist to server
      if (window.DB?._dbOk || window.DB?.isOnline?.()) {
        fetch('api/db.php', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'users.setRole',phone,role})}).catch(()=>{});
      }
    } else {
      window.showToast?.(res?.error || 'Ошибка смены роли', 'error');
    }
    if (activePane === 'roles') showPane('roles');
  }
  function toggleUserActive(phone, active) {
    const actor = window._appState?.user || null;
    const res = window.RBAC?.setActive?.(actor, phone, active);
    if (res?.ok) {
      window.showToast?.(active ? '✅ Аккаунт активирован' : '× Аккаунт заблокирован');
      if (window.DB?._dbOk || window.DB?.isOnline?.()) {
        fetch('api/db.php', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'users.setActive',phone,active})}).catch(()=>{});
      }
    } else {
      window.showToast?.(res?.error || 'Ошибка изменения статуса', 'error');
    }
    if (activePane === 'roles') showPane('roles');
  }
  function calendarStatusClass(status) {
    return window.KaretaOrderLifecycle?.cssClass?.(status) || ({ new:'new', waiting_responses:'waiting_responses', process:'process', done_pending_client:'done_pending_client', done:'done', cancelled:'cancelled', dispute:'dispute' })[status] || 'new';
  }

  function getCalendarOrdersForMonth(year, month) {
    const all = (window.DB?.Orders?.getAll?.() || []).filter(o => (o?.type || 'service_order') === 'service_order' && String(o?.status || '') !== 'cancelled');
    const map = {};
    for (const o of all) {
      const raw = String(o?.date || '').trim();
      if (!raw) continue;
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) continue;
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      if (y !== year || mo !== month) continue;
      (map[d] ||= []).push(o);
    }
    Object.values(map).forEach(list => list.sort((a,b)=> String(a.time||'').localeCompare(String(b.time||''), 'ru')));
    return map;
  }

  function renderCalendar() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    const monthOrders = getCalendarOrdersForMonth(calYear, calMonth);
    const month = now.toLocaleString('ru', { month: 'long', year: 'numeric' });
    const firstDay = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    let startDow = firstDay.getDay(); if (startDow === 0) startDow = 7;

    let cells = '';
    for (let i = 1; i < startDow; i++) {
      const prevDay = new Date(calYear, calMonth, -(startDow-i-1)).getDate();
      cells += `<div class="cal-cell other-month"><div class="cal-cell-num" style="color:var(--text3)">${prevDay}</div><div class="cal-cell-dot"></div></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === now.getDate();
      const count = (monthOrders[d] || []).length;
      cells += `<div class="cal-cell ${isToday?'today selected':''} ${count?'has-orders':''}" onclick="Admin.selectCalDay(${d})">
        <div class="cal-cell-num">${d}</div>
        <div class="cal-cell-dot">${count ? `<span style="min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--orange);color:#101010;font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:700">${count}</span>` : ''}</div>
      </div>`;
    }

    return `<div class="admin-pane">
      <div class="admin-page-title">□ Расписание</div>
      <div class="admin-calendar">
        <div>
          <div class="cal-header">
            <div class="cal-month">${month.charAt(0).toUpperCase() + month.slice(1)}</div>
            <div class="cal-nav">
              <div class="cal-nav-btn">‹</div>
              <div class="cal-nav-btn">›</div>
            </div>
          </div>
          <div class="cal-days-header">
            ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="cal-day-name">${d}</div>`).join('')}
          </div>
          <div class="cal-grid">${cells}</div>
        </div>
        <div class="cal-day-orders" id="cal-day-orders"></div>
      </div>
    </div>`;
  }

  var calYear = new Date().getFullYear();
  var calMonth = new Date().getMonth();
  var STAT_LABELS = { new:'Новый', waiting_responses:'Ждёт откликов', process:'В работе', done_pending_client:'Ждёт клиента', done:'Выполнен', cancelled:'Отменён', dispute:'Спор' };

  function renderCalendarGrid() {
    const now = new Date();
    const monthOrders = getCalendarOrdersForMonth(calYear, calMonth);
    const monthStr = new Date(calYear,calMonth,1).toLocaleString('ru',{month:'long',year:'numeric'});
    const firstDow = new Date(calYear,calMonth,1).getDay()||7;
    const days = new Date(calYear,calMonth+1,0).getDate();
    const masters = (window.DB?.Masters?.getAll?.(true) || []); // admin: all
    let cells='';
    for(let i=1;i<firstDow;i++){
      const d=new Date(calYear,calMonth,-(firstDow-i-1)).getDate();
      cells+=`<div class="cal-cell other-month"><div class="cal-cell-num" style="color:var(--text3)">${d}</div><div class="cal-cell-dot"></div></div>`;
    }
    for(let d=1;d<=days;d++){
      const isToday=d===now.getDate()&&calMonth===now.getMonth()&&calYear===now.getFullYear();
      const count=(monthOrders[d]||[]).length;
      const iso=new Date(calYear,calMonth,d).toISOString().slice(0,10);
      // Индикатор доступности мастеров: зелёный если хоть один работает, красный если все выходные
      let schedDot='';
      if(masters.length){
        const scheds = masters.map(m=>window.DB?.MasterSchedules?.forDate?.(m.id,iso));
        const anyWork = scheds.some(s=>s && !s.isDayOff);
        const anySet  = scheds.some(s=>!!s);
        if(anySet) schedDot=`<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${anyWork?'var(--green)':'#ef4444'};margin-left:2px;vertical-align:middle;opacity:.8"></span>`;
      }
      cells+=`<div class="cal-cell ${isToday?'today selected':''} ${count?'has-orders':''}" onclick="Admin.selectCalDay(${d})">
        <div class="cal-cell-num">${d}${schedDot}</div>
        <div class="cal-cell-dot">${count?`<span style="min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--orange);color:#101010;font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:700">${count}</span>`:''}</div>
      </div>`;
    }
    const hdr=document.querySelector('.cal-month'); if(hdr) hdr.textContent=monthStr.charAt(0).toUpperCase()+monthStr.slice(1);
    const grid=document.querySelector('.cal-grid'); if(grid) grid.innerHTML=cells;
  }

  function initCalendar() {
    const prev=document.querySelector('.cal-nav-btn:first-child');
    const next=document.querySelector('.cal-nav-btn:last-child');
    if(prev) prev.onclick=()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendarGrid(); selectCalDay(1);};
    if(next) next.onclick=()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendarGrid(); selectCalDay(1);};
    selectCalDay(new Date().getDate());
  }

  function selectCalDay(d) {
    document.querySelectorAll('.cal-cell').forEach(c=>c.classList.remove('selected'));
    const cells=[...document.querySelectorAll('.cal-cell:not(.other-month)')];
    if(cells[d-1]) cells[d-1].classList.add('selected');
    const panel=document.getElementById('cal-day-orders'); if(!panel) return;
    const monthOrders = getCalendarOrdersForMonth(calYear, calMonth);
    const orders = monthOrders[d] || [];
    const dateObj = new Date(calYear,calMonth,d);
    const iso = dateObj.toISOString().slice(0,10);
    const dayStr=`${d} ${dateObj.toLocaleString('ru',{month:'long'})}`;
    const dow=dateObj.toLocaleString('ru',{weekday:'long'});

    // Собираем сводку по мастерам на этот день
    const masters = (window.DB?.Masters?.getAll?.(true) || []); // admin: all
    const masterScheds = masters.map(m => {
      const s = window.DB?.MasterSchedules?.forDate?.(m.id, iso);
      return { master: m, sched: s };
    });
    const masterSummaryHtml = masterScheds.length ? `
      <div style="margin-bottom:14px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);overflow:hidden">
        <div style="padding:8px 12px;background:var(--bg2);font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Мастера</div>
        ${masterScheds.map(({master:m, sched:s})=>{
          const status = !s ? ['⬜','var(--text3)','Не задан'] : s.isDayOff ? ['🔴','#ef4444','Выходной'] : ['🟢','var(--green)',(s.startTime||'09:00')+'–'+(s.endTime||'18:00')];
          const editBtn = `<button onclick="openMasterScheduleModal('${escapeHtml(m.id)}')" style="font-size:10px;padding:3px 8px;border-radius:var(--ui-radius-sm,5px);background:var(--bg3,var(--bg2));border:1px solid var(--line);cursor:pointer;color:var(--text2)">✎</button>`;
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-top:1px solid var(--line)">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:26px;height:26px;border-radius:50%;background:${escapeHtml(m.color||'#f59e0b')}22;color:${escapeHtml(m.color||'#f59e0b')};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:'Oswald',sans-serif">${escapeHtml(m.initials||'М')}</div>
              <span style="font-size:12px;font-weight:600">${escapeHtml(m.name||'Мастер')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:12px;color:${status[1]};font-weight:600">${status[0]} ${escapeHtml(status[2])}</span>
              ${editBtn}
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    panel.innerHTML=`<div class="cal-day-title">${dow.charAt(0).toUpperCase()+dow.slice(1)}, ${dayStr}</div>
      ${masterSummaryHtml}
      ${orders.length ? orders.map(ord => `
        <div class="cal-order-item" style="cursor:pointer;border-radius:var(--ui-radius-sm,5px);padding:8px;transition:.2s" onclick="OrderSystem.Detail.open('${escapeHtml(ord.id)}')">
          <div class="cal-order-time">${escapeHtml(ord.time || '—')}</div>
          <div class="cal-order-name">${escapeHtml(ord.clientName || ord.clientPhone || 'Клиент')}</div>
          <div class="cal-order-svc">${escapeHtml(ord.serviceNames || ord.notes || 'Заявка')}</div>
          <span class="order-status ${calendarStatusClass(ord.status)}" style="margin-top:4px;display:inline-block">${escapeHtml(STAT_LABELS[ord.status] || ord.status || 'Новый')}</span>
        </div>`).join('')
      : `<div style="text-align:center;padding:28px 0;color:var(--text3)">
          <div style="font-size:28px;margin-bottom:8px">□</div>
          <div style="font-size:13px">Нет записей на этот день</div>
          <button class="btn btn-outline" style="margin-top:12px;font-size:12px" onclick="OrderSystem.Wizard.open({ date:'${dateObj.toISOString().slice(0,10)}', type:'service_order' })">+ Добавить запись</button>
        </div>`}`;
  }

  function renderMessages() {
    // Используем DB.Chats для актуальных чатов
    const allChats = DB.Chats.getAll().filter(c => c.status !== 'cancelled');
    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div class="admin-page-title" style="margin:0">◌ Все чаты</div>
        <button class="btn btn-outline" style="font-size:12px;padding:7px 14px" onclick="Messenger.toggle()">Открыть мессенджер →</button>
      </div>
      <div class="admin-msg-layout">
        <div class="msg-list">
          ${allChats.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text3)">Чатов нет</div>' :
            allChats.map(c => {
              const msgs = DB.Messages.get(c.id);
              const last = [...msgs].reverse().find(m=>m.type!=='event')||msgs[msgs.length-1];
              const preview = last ? (last.type==='stage'?'⌖ '+last.stageLabel : last.type==='report'?'▤ Отчёт' : last.type==='file'?'⌁ Файл' : (last.text||'').slice(0,40)) : '—';
              const unread = (c.unread?.admin||0)+(c.unread?.master||0);
              const sc = {done:'#22c55e',process:'var(--orange)',new:'var(--text3)'}[c.status]||'var(--text3)';
              return `<div class="msg-list-item ${c.id===currentMsgId?'active':''}" onclick="Admin.selectMsg('${c.id}')">
                <div class="msg-av" style="background:rgba(255,107,0,.15);color:var(--orange)">${c.clientInit}</div>
                <div class="msg-info">
                  <div class="msg-name">${c.clientName}</div>
                  <div class="msg-preview">${c.orderTitle.slice(0,30)} · ${preview.slice(0,25)}</div>
                </div>
                <div class="msg-meta">
                  <span class="msng-status-dot" style="background:${sc}"></span>
                  ${unread?`<div class="msg-unread-badge">${unread}</div>`:''}
                </div>
              </div>`;
            }).join('')}
        </div>
        <div class="msg-chat-area">
          <div id="admin-chat-content" style="display:flex;flex-direction:column;height:100%">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text3)">
              <div style="font-size:36px">◌</div>
              <div style="font-size:14px">Выберите чат слева</div>
              <button class="btn btn-primary" style="margin-top:8px" onclick="Messenger.toggle()">Открыть мессенджер</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function initMessages() {
    const body = document.getElementById('admin-chat-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  function selectMsg(id) {
    currentMsgId = id;
    // Открываем в мессенджере
    if (typeof id === 'string' && id.startsWith('ch_')) {
      Messenger.openChat(id);
    } else {
      showPane('messages');
    }
  }

  async function sendReply() {
    const input = document.getElementById('admin-reply-input');
    if(!input||!input.value.trim()) return;
    if(currentMsgId && typeof currentMsgId === 'string') {
      const text = input.value.trim();
      input.value='';
      try {
        await DB.Messages.add(currentMsgId, {from:'master',text,time:DB._nowStr(),type:'text'});
        if(window.showToast) window.showToast('Ответ отправлен в чат');
      } catch(e) {
        if(window.showToast) window.showToast(e&&e.message?e.message:'Не удалось отправить ответ','error');
      }
    }
  }
  function renderServicesCfg() {
    const svcs = (window.DB?.Services?.getAll?.() || []).map(s => ({
      id: s.id,
      e: s.icon || '⌁',
      t: s.name || s.label || s.id,
      d: s.shortDesc || s.whyText || '',
      price: s.priceLabel || ((Number(s.basePrice)||0).toLocaleString('ru') + ' ₸'),
      time: s.timeLabel || s.avgTime || '',
      vis: s.active !== false,
    }));
    return `<div class="admin-pane">
      <div class="admin-page-title">⌁ Управление услугами</div>
      <div class="p-note" style="margin-bottom:20px">Редактируйте услуги — данные уже идут из MySQL и отображаются на странице «Услуги» и в прайсе.</div>
      <div id="svc-cfg-list">
      ${svcs.map(s=>`
      <div class="card svc-cfg-row" id="svc-${s.id}" data-visible="${s.vis}" style="padding:16px 18px;margin-bottom:10px">
        <div class="svc-cfg-view" style="display:flex;align-items:center;gap:14px">
          <span style="font-size:24px">${s.e}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${s.t} ${!s.vis?'<span style="font-size:11px;color:var(--text3);font-weight:400">(скрыто)</span>':''}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">${s.d || '—'}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:6px">⏱ ${s.time || '—'} · ▥ ${s.price || '—'}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="act-btn edit" onclick="svcCfgEdit('${s.id}')">✎ Редактировать</button>
            <button class="act-btn ${s.vis?'view':'go'}" onclick="svcCfgToggle('${s.id}')">${s.vis?'👁 Скрыть':'👁 Показать'}</button>
          </div>
        </div>
      </div>`).join('')}
      </div>
    </div>`;
  }
  window.svcCfgEdit = function(id){
    const svc = window.DB?.Services?.get?.(id); if(!svc) return;
    const row=document.getElementById('svc-'+id); if(!row) return;
    row.querySelector('.svc-cfg-view').innerHTML=`
      <span style="font-size:24px">${svc.icon || '⌁'}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <input id="svc-t-${id}" class="admin-search" value="${svc.name || ''}" placeholder="Название"/>
        <input id="svc-d-${id}" class="admin-search" value="${svc.shortDesc || ''}" placeholder="Краткое описание"/>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input id="svc-time-${id}" class="admin-search" value="${svc.timeLabel || svc.avgTime || ''}" placeholder="Время"/>
          <input id="svc-price-${id}" class="admin-search" value="${svc.priceLabel || ''}" placeholder="Цена"/>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="act-btn go" onclick="svcCfgSave('${id}')">✓ Сохранить</button>
        <button class="act-btn view" onclick="Admin.showPane('services_cfg')">Отмена</button>
      </div>`;
  };
  window.svcCfgSave = async function(id){
    const svc = window.DB?.Services?.get?.(id); if(!svc) return;
    const patch = {
      name: document.getElementById('svc-t-'+id)?.value.trim() || svc.name,
      shortDesc: document.getElementById('svc-d-'+id)?.value.trim() || '',
      timeLabel: document.getElementById('svc-time-'+id)?.value.trim() || '',
      priceLabel: document.getElementById('svc-price-'+id)?.value.trim() || '',
    };
    if(!patch.name){window.showToast('Введите название','error');return;}
    await window.DB.Services.update(id, patch);
    window.showToast('✅ Услуга сохранена в БД');
    Admin.showPane('services_cfg');
  };
  window.svcCfgToggle = async function(id){
    if (!id) return;
    const svc = window.DB?.Services?.get?.(id); if(!svc) return;
    try {
      await window.DB.Services.update(id, { active: !(svc.active !== false) });
    } catch(e) { window._showToast?.(e?.message || 'Ошибка обновления', 'error'); return; }
    window.showToast((svc.active !== false) ? 'Услуга скрыта' : 'Услуга видима');
    Admin.showPane('services_cfg');
  };

  function openOrder(id) { OrderSystem.Detail.open(id); }

  function renderPricingCfg() {
    const rows = window.DB?.Services?.getAll?.() || [];
    return `<div class="admin-pane">
      <div class="admin-page-title">▥ Управление прайсом</div>
      <div class="p-note" style="margin-bottom:20px">Цены теперь читаются из MySQL таблицы услуг.</div>
      <div id="price-cfg-list">
      ${rows.map(row=>`
      <div class="card price-cfg-row" id="${row.id}" style="padding:14px 18px;margin-bottom:8px">
        <div class="price-view" style="display:grid;grid-template-columns:1fr 100px 140px auto;gap:12px;align-items:center">
          <div style="font-size:13px">${row.name}</div>
          <div style="font-size:12px;color:var(--text3)">${row.timeLabel || row.avgTime || '—'}</div>
          <div style="font-family:'Oswald',sans-serif;color:var(--orange)">${row.priceLabel || ((Number(row.basePrice)||0).toLocaleString('ru') + ' ₸')}</div>
          <div style="display:flex;gap:6px">
            <button class="act-btn edit" onclick="priceCfgEdit('${row.id}')">✎</button>
          </div>
        </div>
      </div>`).join('')}
      </div>
    </div>`;
  }
  window.priceCfgEdit = function(id){
    const row=document.getElementById(id); if(!row) return;
    const pd=window.DB?.Services?.get?.(id); if(!pd) return;
    row.querySelector('.price-view').innerHTML=`
      <input id="${id}-s" class="admin-search" value="${pd.name || ''}" style="font-size:12px"/>
      <input id="${id}-t" class="admin-search" value="${pd.timeLabel || pd.avgTime || ''}" style="font-size:12px"/>
      <input id="${id}-p" class="admin-search" value="${pd.priceLabel || ''}" style="font-size:12px"/>
      <div style="display:flex;gap:6px">
        <button class="act-btn go" onclick="priceCfgSave('${id}')">✓</button>
        <button class="act-btn view" onclick="Admin.showPane('pricing_cfg')">✕</button>
      </div>`;
  };
  window.priceCfgSave = async function(id){
    const patch={
      name:document.getElementById(id+'-s')?.value.trim()||'',
      timeLabel:document.getElementById(id+'-t')?.value.trim()||'',
      priceLabel:document.getElementById(id+'-p')?.value.trim()||'',
    };
    if(!patch.name||!patch.priceLabel){window.showToast('Заполните название и цену','error');return;}
    await window.DB.Services.update(id, patch);
    window.showToast('✅ Цена сохранена в БД');
    Admin.showPane('pricing_cfg');
  };
  window.priceCfgDelete = function(){ window.showToast('Удаление прайс-строк отключено: источник истины — таблица услуг','error'); };
  window.priceCfgAdd = function(){ window.showToast('Добавление новых услуг отдельным шагом', 'error'); };
  function openOrder(id) {
    const live = window.DB?.Orders?.get?.(id);
    const o = live ? {
      id: live.id,
      name: live.clientName,
      phone: live.clientPhone,
      car: live.clientCar,
      service: live.serviceNames || (live.type==='parts_request' ? 'Запрос запчастей' : 'Заявка'),
      date: [live.date, live.time].filter(Boolean).join(' '),
      price: (live.price || 0) + ' ₸',
      status: live.status
    } : null;
    if (!o) return;
    let el = document.getElementById('order-modal');
    if (!el) {
      el = document.createElement('div'); el.id = 'order-modal'; el.className = 'cmodal-overlay';
      document.body.appendChild(el);
      el.onclick = e => { if (e.target === el) window.__closeLayeredModal?.('order-modal','order-modal'); };
    }
    el.innerHTML = `<div class="cmodal-box" style="max-width:440px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="cmodal-title" style="margin:0">Заказ ${o.id}</div>
        <button onclick="window.__closeLayeredModal?.('order-modal','order-modal')"
          style="width:32px;height:32px;border-radius:50%;background:var(--surface);color:var(--text3);font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer">×</button>
      </div>
      <div style="display:grid;gap:10px">
        ${[['○ Клиент',o.name],['○ Телефон',`<a href="tel:${o.phone}" style="color:var(--orange)">${o.phone}</a>`],['▱ Автомобиль',o.car],['⌁ Услуга',o.service],['□ Дата/время',o.date],['▥ Стоимость',o.price]].map(([k,v])=>`
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)">
          <div style="font-size:12px;color:var(--text3);min-width:120px">${k}</div>
          <div style="font-size:13px;font-weight:600">${v}</div>
        </div>`).join('')}
        <div style="display:flex;gap:12px;padding:8px 0">
          <div style="font-size:12px;color:var(--text3);min-width:120px">▥ Статус</div>
          <span class="order-status ${o.status}">${statusMap[o.status]}</span>
        </div>
      </div>
      <div class="cmodal-actions" style="margin-top:16px">
        <a href="tel:${o.phone}" class="btn btn-outline" style="font-size:13px">○ Позвонить</a>
        <button class="btn btn-primary" style="font-size:13px" onclick="Admin.changeStatus('${o.id}');window.__closeLayeredModal?.('order-modal','order-modal')">→ Следующий статус</button>
      </div>
    </div>`;
    el.classList.add('open');
  }

  async function changeStatusDirect(id, newStatus, sel) {
    const live = window.DB?.Orders?.get?.(id);
    if (live && window.DB?.Orders?.setStatus) {
      try {
        await window.DB.Orders.setStatus(id, newStatus);
        if (sel) { sel.className = `order-status-sel ${newStatus}`; }
        window.showToast(`Статус изменён: ${statusMap[newStatus]||newStatus}`);
        if (activePane === 'orders') showPane('orders');
        return;
      } catch(e) {
        window.showToast(e && e.message ? e.message : 'Не удалось изменить статус','error');
        return;
      }
    }
    if (window.showToast) window.showToast('Локальный demo-fallback статусов отключён','error');
  }

  function renderHistory() {
    const allOrders = DB.Orders.getAll({}).slice().sort((a,b)=>
      String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));

    const today = new Date().toISOString().slice(0,10);
    const thisMonth = new Date().toISOString().slice(0,7);
    const todayO = allOrders.filter(o=>(o.createdAt||o.date||'').startsWith(today));
    const monthO = allOrders.filter(o=>(o.createdAt||o.date||'').startsWith(thisMonth));
    const doneO  = allOrders.filter(o=>o.status==='done');

    // Группируем по дате
    const byDate = {};
    allOrders.slice(0,100).forEach(o=>{
      const d=(o.createdAt||o.date||'—').slice(0,10);
      if(!byDate[d]) byDate[d]=[];
      byDate[d].push(o);
    });
    const sortedDates = Object.keys(byDate).sort().reverse();
    const statusLabels = {new:'Новая',process:'В работе',done:'Выполнена',cancelled:'Отменена'};
    const statusColors = {new:'var(--text3)',process:'var(--orange)',done:'#22c55e',cancelled:'#ef4444'};

    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <div class="admin-page-title" style="margin:0">□ История операций</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" style="font-size:12px;padding:7px 12px" onclick="window.exportOrdersCSV?.()">↓ CSV</button>
          <button class="btn btn-primary" style="font-size:13px" onclick="OrderSystem.Wizard.open()">+ Заявка</button>
        </div>
      </div>

      <!-- Сводка -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px">
        ${[
          [todayO.length,'□','Сегодня','var(--orange)'],
          [monthO.length,'🗓','Этот месяц','#60a5fa'],
          [doneO.length,'✅','Выполнено','#22c55e'],
          [allOrders.length,'▤','Всего','var(--text2)'],
        ].map(([v,i,l,c])=>`<div class="card" style="padding:14px 16px;border-left:3px solid ${c}">
          <div style="font-size:18px;margin-bottom:4px">${i}</div>
          <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;color:${c}">${v}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${l}</div>
        </div>`).join('')}
      </div>

      <!-- Лента по датам -->
      <div class="owner-block">
        <div class="owner-block-title">▤ Лента заявок по датам</div>
        <div style="display:flex;flex-direction:column;gap:0;margin-top:14px">
          ${sortedDates.map(date=>`
            <div>
              <div style="padding:10px 0 6px;font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--line);margin-bottom:4px">
                ${date===today?'🔴 Сегодня · ':''}${date}
                <span style="font-weight:400;margin-left:8px">${byDate[date].length} заявок</span>
              </div>
              ${byDate[date].map(o=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid var(--line);transition:background .1s;cursor:pointer" onclick="OrderSystem.Detail.open('${escapeHtml(o.id||'')}')">
                <div style="font-family:'Oswald',sans-serif;font-size:12px;color:var(--text3);min-width:72px">${escapeHtml(o.id||'—')}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.clientName||'Клиент')}</div>
                  <div style="font-size:11px;color:var(--text3);margin-top:2px">${escapeHtml(o.serviceNames||o.notes||'Заявка')} · ${escapeHtml(o.clientCar||'')}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-family:'Oswald',sans-serif;font-size:14px;color:var(--orange)">${Number(o.price||0).toLocaleString('ru')} ₸</div>
                  <span style="font-size:10px;padding:2px 7px;border-radius:99px;background:${statusColors[o.status]||'var(--text3)'}18;color:${statusColors[o.status]||'var(--text3)'};">${statusLabels[o.status]||o.status||'—'}</span>
                </div>
              </div>`).join('')}
            </div>
          `).join('')}
          ${sortedDates.length===0?'<div style="color:var(--text3);font-size:13px;padding:30px 0;text-align:center">История пуста</div>':''}
        </div>
      </div>
    </div>`;
  }
  function _initHistoryPane() {}

    function _renderStaffContent(allUsers) {
    window.KaretaLogger?.log('render', 'renderStaff', { users: allUsers.length, pane: activePane });
    const actor = window._appState?.user;
    const actorLevel = window.RBAC?.getRole(actor)?.level || 0;
    const ROLE_COLORS = {guest:'#52525a',client:'#60a5fa',master:'#34d399',admin:'#f59e0b',owner:'#FF6B00'};

    const staffUsers = allUsers.filter(u => ['master','admin','owner'].includes(String(u.role||'')));
    const clientUsers = allUsers.filter(u => String(u.role||'') === 'client');

    return `<div class="admin-pane">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <div class="admin-page-title" style="margin:0">◎ Сотрудники</div>
        <div style="display:flex;gap:8px">
          <input id="staff-search" placeholder="⌕ Поиск…" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-sm,5px);padding:8px 12px;font-size:13px;color:var(--text);outline:none;width:180px" oninput="adminSearchStaff(this.value)">
        </div>
      </div>

      <!-- Сотрудники -->
      <div class="owner-block" style="margin-bottom:20px">
        <div class="owner-block-title">⌁ Персонал (${staffUsers.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:14px" id="staff-grid">
          ${staffUsers.map(u => {
            const role = String(u.role||'client');
            const rc = ROLE_COLORS[role] || 'var(--orange)';
            const master = (window.DB?.Masters?.getAll?.(true)||[]).find(m=>(m.phone||'').replace(/\D/g,'')===(u.phone||'').replace(/\D/g,''));
            const userOrders = (window.DB?.Orders?.getAll?.({})||[]).filter(o=>{
              if(role==='master' && master) return o.masterId===master.id;
              return false;
            });
            return `<div class="card staff-card" style="padding:16px 18px;border-left:3px solid ${rc}" data-name="${escapeHtml((u.name||'').toLowerCase())}" data-phone="${escapeHtml(u.phone||'')}">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <div style="width:44px;height:44px;border-radius:var(--ui-radius-md,10px);background:${rc}22;color:${rc};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;flex-shrink:0">${escapeHtml(u.initials||u.name?.slice(0,2)||'?')}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(u.name||'—')}</div>
                  <div style="font-size:11px;color:var(--text3);margin-top:3px"><a href="tel:${escapeHtml(u.phone||'')}" style="color:${rc}">${escapeHtml(u.phone||'—')}</a></div>
                </div>
                <span style="font-size:11px;padding:3px 8px;border-radius:99px;background:${rc}18;color:${rc};border:1px solid ${rc}33;flex-shrink:0">${role==='owner'?'◇':role==='admin'?'◇':'⌁'} ${role}</span>
              </div>
              ${master ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
                <div style="text-align:center;padding:6px;background:var(--surface);border-radius:var(--ui-radius-sm,5px)"><div style="font-family:'Oswald',sans-serif;font-size:15px;color:var(--orange)">${userOrders.length}</div><div style="font-size:9px;color:var(--text3)">заявок</div></div>
                <div style="text-align:center;padding:6px;background:var(--surface);border-radius:var(--ui-radius-sm,5px)"><div style="font-family:'Oswald',sans-serif;font-size:15px;color:#22c55e">${userOrders.filter(o=>o.status==='done').length}</div><div style="font-size:9px;color:var(--text3)">выполнено</div></div>
                <div style="text-align:center;padding:6px;background:var(--surface);border-radius:var(--ui-radius-sm,5px)"><div style="font-family:'Oswald',sans-serif;font-size:15px;color:#60a5fa">${userOrders.filter(o=>['new','process'].includes(o.status||'')).length}</div><div style="font-size:9px;color:var(--text3)">в работе</div></div>
              </div>` : ''}
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${actorLevel > (window.RBAC?.getRole({role})?.level||0) ? `
                  <select style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-sm,5px);padding:5px 8px;font-size:12px;color:var(--text);outline:none" onchange="Admin.changeUserRole('${escapeHtml(u.phone||'')}',this.value);setTimeout(()=>Admin.showPane('masters'),300)">
                    ${['client','master','admin'].filter(r=>r!==role).map(r=>`<option value="${r}">${r}</option>`).join('')}
                    <option value="${role}" selected>${role}</option>
                  </select>
                ` : ''}
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:5px 8px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-sm,5px)">
                  <input type="checkbox" ${u.active!==false?'checked':''} onchange="Admin.toggleUserActive('${escapeHtml(u.phone||'')}',this.checked)"> Активен
                </label>
                ${master ? `<button class="btn btn-outline" style="font-size:11px;padding:5px 9px" onclick="openMasterScheduleModal('${escapeHtml(master.id)}')">🗓</button>` : ''}
              </div>
            </div>`;
          }).join('') || '<div style="color:var(--text3);font-size:13px;padding:20px 0">Сотрудников нет</div>'}
        </div>
      </div>

      <!-- Клиенты (краткая сводка) -->
      <div class="owner-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="owner-block-title" style="margin:0">○ Клиенты (${clientUsers.length})</div>
          <button class="btn btn-outline" style="font-size:12px;padding:7px 12px" onclick="Admin.showPane('clients')">Все клиенты →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
          ${[
            [clientUsers.length,'◎','Всего','var(--orange)'],
            [clientUsers.filter(u=>u.active!==false).length,'✅','Активных','#34d399'],
            [(window.DB?.Clients?.getAll?.()||[]).filter(c=>c.ordersCount>0).length,'▤','С заявками','#60a5fa'],
            [(window.DB?.Clients?.getAll?.()||[]).filter(c=>c.ordersCount===0).length,'🆕','Без заявок','#f59e0b'],
          ].map(([v,i,l,c])=>`<div class="card" style="padding:14px 16px;border-left:3px solid ${c}">
            <div style="font-size:20px;margin-bottom:4px">${i}</div>
            <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:${c}">${v}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${l}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  }
  function renderStaff() {
    // Первый рендер — из кэша или локального списка (без сетевого запроса)
    const initialUsers = _rolesUsersCache || _buildLocalUsersList();
    // Запускаем загрузку с сервера ОДИН РАЗ — без рекурсии
    // При ответе патчим DOM напрямую (не вызываем renderStaff снова!)
    if (!_rolesUsersCache) {
      _loadAllUsersFromServer().then(serverUsers => {
        if (!serverUsers.length) return;
        // Обновляем только если этот pane всё ещё активен
        if (activePane !== 'staff') return;
        const p = document.getElementById('admin-panes');
        if (!p) return;
        p.innerHTML = _renderStaffContent(serverUsers);
        p.querySelector('.admin-pane')?.classList.add('active');
        _initStaffPane();
      });
    }
    return _renderStaffContent(initialUsers);
  }

  function _initStaffPane() {
    window.adminSearchStaff = function(q){
      const ql=(q||'').toLowerCase();
      document.querySelectorAll('.staff-card').forEach(c=>{
        const n=c.dataset.name||'', p=c.dataset.phone||'';
        c.style.display=(!ql||n.includes(ql)||p.includes(ql))?'':'none';
      });
    };
  }

  return { render, init, showPane, filterOrders, filterOrdersType, openPartsQueue, partsQueueAction, searchOrders, changeStatus, changeStatusDirect, assignMaster, claimOrder, releaseOrderClaim, changeUserRole, toggleUserActive, openOrder, selectCalDay, selectMsg, sendReply, saveSiteCms, linkMasterSto, assignOrderToMasterFromCard, openMasterOrders, applyMasterFilters, resetMasterFilters, filterShop, toggleShopSearch, applyShopSearch, _filterMasters, _rolesSearch };
})();
