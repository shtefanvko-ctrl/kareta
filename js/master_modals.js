/* ══════════════════════════════════════════════════════════════════
   KARETA.KZ — MASTER MODALS & GLOBAL HANDLERS
   Загружается ПОСЛЕ app.js (зависит от escHtml, nav, S, showToast, DB)
   Содержит: Reviews, Vehicle, SpecialServices, MasterModals, OrderDetail
══════════════════════════════════════════════════════════════════ */
/* ── Safe shared helpers ── */
var eh = window.eh || window.escHtml || function(v){
  return String(v ?? '').replace(/[&<>"']/g, function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
};
window.eh = window.eh || eh;
window.escHtml = window.escHtml || eh;
// Локальный fallback для legacy-закрытий: app.js хранит TIMING внутри замыкания.
var TIMING = window.TIMING || {
  MODAL_CLOSE: 260,
  MODAL_OPEN: 80,
  NAV: 120,
  NAV_SETTLE: 220,
  TOAST: 2500,
  SPLASH: 1700,
  SPLASH_ANIM: 780,
  AUTH_TITLE: 80,
  ONBOARDING: 2800
};
window.TIMING = window.TIMING || TIMING;


/* ── Единый пайплайн ремонта: мастер ведёт этапы, клиент видит эти же шаги ── */
const KARETA_REPAIR_PIPELINE = window.KARETA_REPAIR_PIPELINE = window.KARETA_REPAIR_PIPELINE || [
  { id:'accepted',  icon:'📝', label:'Принята',       hint:'Подтвердите, что заявка принята мастером и клиент понимает следующий шаг', steps:['Проверить данные клиента и авто','Открыть рабочий чат','Указать ориентир по времени'] },
  { id:'diagnosed', icon:'⌕', label:'Диагностика',    hint:'Что обнаружено, какова причина неисправности и что требуется дальше', steps:['Осмотреть узел/систему','Зафиксировать причину','Написать рекомендацию клиенту'] },
  { id:'parts',     icon:'▥', label:'Согласование',   hint:'Согласуйте работы, стоимость, запчасти и расходники до выполнения', steps:['Указать работы и материалы','Добавить цену и количество','Сообщить клиенту срок и итоговую сумму'] },
  { id:'started',   icon:'⌁', label:'В работе',       hint:'Что делается прямо сейчас и какой результат ожидается', steps:['Описать выполняемую работу','Прикрепить фото процесса','Указать важные замечания'] },
  { id:'quality',   icon:'🔬', label:'Проверка',       hint:'Проверка результата после ремонта перед передачей клиенту', steps:['Проверить результат','Сделать тестовый запуск/осмотр','Написать итог проверки'] },
  { id:'done',      icon:'✅', label:'Готово',         hint:'Краткий итог: что сделано, результат и рекомендации', steps:['Описать итог работ','Указать рекомендации','Передать клиенту на подтверждение'] },
  { id:'delivered', icon:'🏁', label:'Закрыта',        hint:'Авто передано, цикл работ закрыт', steps:['Подтвердить выдачу авто','Зафиксировать комментарий клиента','Закрыть рабочий цикл'] },
];
function karetaRepairStageById(id){ return (window.KARETA_REPAIR_PIPELINE||[]).find(s=>String(s.id)===String(id)) || null; }

/* ── Reviews ── */
window.rvPickStar = function(n) {
  rvStarSelected = n;
  document.querySelectorAll('.rv-star-btn').forEach((s,i) => {
    s.classList.toggle('active', i < n);
  });
}

window.submitReview = async function() {
  const text = document.getElementById('rv-text')?.value?.trim();
  if (!text || text.length < 10) { showToast('Напишите хотя бы пару слов', 'error'); return; }
  const stars = window.rvStarSelected || 5;
  const u = window._appState?.user;
  const authorName = u?.name || 'Клиент';
  const initials = u?.initials || (authorName[0] || 'К').toUpperCase();
  const now = new Date();
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const dateLabel = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  const review = {
    id: 'rv_' + Date.now().toString(36),
    name: authorName, initials, stars, text, dateLabel,
    sourceLabel: 'KARETA', sort: 99, active: true, reviewType:'service'
  };
  const btn = document.querySelector('.rv-add-wrap .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }
  try {
    if (window.DB?.PublicReviews?.submit) await window.DB.PublicReviews.submit(review);
    else if (window.DB?.PublicReviews?.save) await window.DB.PublicReviews.save(review);
    const toast = document.getElementById('rv-toast');
    if (toast) { toast.textContent = '✅ Отзыв отправлен! Спасибо за обратную связь.'; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 4000); }
    document.getElementById('rv-text').value = '';
    document.querySelectorAll('.rv-star-btn').forEach((s,i) => { s.classList.toggle('active', i < 5); });
    window.rvStarSelected = 5;
    showToast('☆ Отзыв сохранён!');
  } catch(e) {
    showToast((e?.message) || 'Не удалось отправить отзыв', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Отправить отзыв'; }
  }
}

window.openServiceReviewModal = function(orderId){
  if (!orderId) return;
  if (!window.requireAuth?.('write_review', {orderId})) return;
  try { history.pushState({modal:'review',orderId}, '', '#review:'+orderId); } catch(_e) {}
  const order = DB.Orders.get(orderId);
  if(!order) return showToast('Заявка не найдена','error');
  const existing = getServiceOrderReviews(orderId)[0] || null;
  const ov = document.createElement('div');
  ov.id = 'service-review-modal';
  ov.className = 'cmodal-overlay open';
  ov.innerHTML = `<div class="cmodal-card" style="max-width:720px;width:min(96vw,720px);border-radius:var(--ui-radius-lg,18px);max-height:92vh;overflow:auto">
    <div class="cmodal-head"><h3>☆ Отзыв по заявке ${escHtml(order.id)}</h3><button class="cmodal-close" onclick="closeServiceReviewModal()">✕</button></div>
    <div class="cmodal-body">
      <div class="card" style="padding:14px 16px;margin-bottom:14px;background:var(--bg2)">
        <div style="font-weight:700;font-size:14px">${escHtml(order.serviceNames||'Заявка')}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">${escHtml(order.clientCar||'')} · ${escHtml(order.masterName||'Мастер')}</div>
      </div>
      <div class="pf-group"><label class="pf-label">Оценка</label><div class="rv-stars-pick" id="svc-rv-stars">${[1,2,3,4,5].map(s=>`<span class="rv-star-btn ${s <= Number(existing?.stars||5) ? 'active':''}" onclick="pickServiceReviewStar(${s})">★</span>`).join('')}</div></div>
      <div class="pf-group"><label class="pf-label">Текст отзыва</label><textarea id="svc-rv-text" class="pf-input" rows="5" placeholder="Что понравилось, как прошёл ремонт, что можно улучшить">${escHtml(existing?.text||'')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">
        <button class="btn btn-outline" onclick="closeServiceReviewModal()">Отмена</button>
        ${existing ? `<button class="btn btn-outline" onclick="deleteServiceReview('${existing.id}')">Удалить</button>`:''}
        <button class="btn btn-primary" onclick="saveServiceReview('${orderId}','${existing?.id||''}')">Сохранить отзыв</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){}
  try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  window._svcReviewStars = Number(existing?.stars||5);
}

window.closeServiceReviewModal = function(){ document.getElementById('service-review-modal')?.remove(); }

window.pickServiceReviewStar = function(n){
  window._svcReviewStars = n;
  document.querySelectorAll('#svc-rv-stars .rv-star-btn').forEach((s,i)=>s.classList.toggle('active', i < n));
}

window.saveServiceReview = async function(orderId, reviewId=''){
    if (!orderId) return;
  const order = DB.Orders.get(orderId); if(!order) return showToast('Заявка не найдена','error');
  const text = document.getElementById('svc-rv-text')?.value?.trim();
  if(!text || text.length < 10) return showToast('Добавьте содержательный текст отзыва','error');
  const u = window._appState?.user || {};
  const cl = DB.Clients.getByPhone?.(u.phone||'');
  const review = {
    id: reviewId || ('srv_'+Date.now().toString(36)),
    reviewType:'service',
    orderId: order.id,
    masterId: order.masterId || '',
    masterName: order.masterName || '',
    clientId: cl?.id || '',
    name: u.name || order.clientName || 'Клиент',
    initials: u.initials || ((u.name||order.clientName||'К')[0]||'К').toUpperCase(),
    stars: Number(window._svcReviewStars||5),
    text,
    dateLabel: order.date || new Date().toISOString().slice(0,10),
    reviewDate: new Date().toISOString(),
    sourceLabel:'KARETA · service',
    active:true,
    sort: 200,
  };
  try{
    if (window.DB?.PublicReviews?.submit) await window.DB.PublicReviews.submit(review);
    else await window.DB.PublicReviews.save(review);
    showToast('Отзыв по заявке сохранён');
    closeServiceReviewModal();
    App.refresh?.();
  }catch(e){ showToast(e?.message || 'Не удалось сохранить отзыв','error'); }
}

window.deleteServiceReview = async function(id){
  if(!confirm('Удалить отзыв по заявке?')) return;
  try{ await window.DB.PublicReviews.delete(id); closeServiceReviewModal(); showToast('Отзыв удалён'); App.refresh?.(); }
  catch(e){ showToast(e?.message||'Не удалось удалить отзыв','error'); }
}

window.openProductReviewModal = function(productId, productName='Товар'){
  if (!productId) return;
  const existing = getProductReviews(productId)[0] || null;
  const ov = document.createElement('div');
  ov.id='product-review-modal';
  ov.className='cmodal-overlay open';
  ov.innerHTML = `<div class="cmodal-card" style="max-width:680px;width:min(96vw,680px);border-radius:var(--ui-radius-lg,18px)"><div class="cmodal-head"><h3>☆ Отзыв о товаре</h3><button class="cmodal-close" onclick="closeProductReviewModal()">✕</button></div><div class="cmodal-body"><div class="card" style="padding:14px 16px;margin-bottom:14px;background:var(--bg2)"><div style="font-weight:700;font-size:14px">${escHtml(productName||'Товар')}</div><div style="font-size:12px;color:var(--text3);margin-top:4px">ID/артикул: ${escHtml(productId||'—')}</div></div><div class="pf-group"><label class="pf-label">Оценка</label><div class="rv-stars-pick" id="prd-rv-stars">${[1,2,3,4,5].map(s=>`<span class="rv-star-btn ${s <= Number(existing?.stars||5) ? 'active':''}" onclick="pickProductReviewStar(${s})">★</span>`).join('')}</div></div><div class="pf-group"><label class="pf-label">Текст отзыва</label><textarea id="prd-rv-text" class="pf-input" rows="5" placeholder="Как товар показал себя в работе, что понравилось">${escHtml(existing?.text||'')}</textarea></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px"><button class="btn btn-outline" onclick="closeProductReviewModal()">Отмена</button>${existing ? `<button class="btn btn-outline" onclick="deleteProductReview('${existing.id}')">Удалить</button>`:''}<button class="btn btn-primary" onclick="saveProductReview('${escHtml(productId||'')}','${escHtml(productName||'')}','${existing?.id||''}')">Сохранить отзыв</button></div></div></div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){}
  try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  try{ history.pushState({modal:'product-review', productId}, '', '#review:product:' + encodeURIComponent(String(productId))); }catch(_e){}
  window._prdReviewStars = Number(existing?.stars||5);
}

window.closeProductReviewModal = function(){ document.getElementById('product-review-modal')?.remove(); }

window.pickProductReviewStar = function(n){
  window._prdReviewStars = n;
  document.querySelectorAll('#prd-rv-stars .rv-star-btn').forEach((s,i)=>s.classList.toggle('active', i < n));
}

window.saveProductReview = async function(productId, productName='', reviewId=''){
    if (!productId) return;
  const text = document.getElementById('prd-rv-text')?.value?.trim();
  if(!text || text.length < 10) return showToast('Добавьте содержательный текст отзыва','error');
  const u = window._appState?.user || {};
  const cl = DB.Clients.getByPhone?.(u.phone||'');
  const review = {
    id: reviewId || ('prv_'+Date.now().toString(36)),
    reviewType:'product',
    productId: productId,
    productName: productName,
    clientId: cl?.id || '',
    name: u.name || 'Клиент',
    initials: u.initials || ((u.name||'К')[0]||'К').toUpperCase(),
    stars: Number(window._prdReviewStars||5),
    text,
    dateLabel: new Date().toISOString().slice(0,10),
    reviewDate: new Date().toISOString(),
    sourceLabel:'KARETA · product',
    active:true,
    sort: 210,
  };
  try{
    if (window.DB?.PublicReviews?.submit) await window.DB.PublicReviews.submit(review); else await window.DB.PublicReviews.save(review);
    showToast('Отзыв по товару сохранён');
    closeProductReviewModal();
    App.refresh?.();
  }catch(e){ showToast(e?.message || 'Не удалось сохранить отзыв','error'); }
}

window.deleteProductReview = async function(id){
  if(!confirm('Удалить отзыв о товаре?')) return;
  try{ await window.DB.PublicReviews.delete(id); closeProductReviewModal(); showToast('Отзыв удалён'); App.refresh?.(); }
  catch(e){ showToast(e?.message||'Не удалось удалить отзыв','error'); }
}

/* ── Vehicle modals ── */
window.openVehicleAddModal = function(prefill) {
  if (!window.requireAuth?.('open_cabinet', {role:'client'})) return;
  // Обновляем URL если открываем из кабинета
  if (location.hash.startsWith('#cabinet')) {
    try { history.pushState(null, '', '#cabinet:car:new'); } catch(_e) {}
  }
  let el = document.getElementById('vehicle-add-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vehicle-add-modal';
    el.className = 'cmodal-overlay vehicle-add-modal-overlay';
    el.addEventListener('click', function(e) {
      if (e.target === el) {
        if (window.__closeLayeredModal) window.__closeLayeredModal('vehicle-add-modal','vehicle-add-modal');
        else el.classList.remove('open');
        if (location.hash.startsWith('#cabinet:car:new')) { try { history.pushState(null,'','#cabinet:car'); } catch(_e){} }
      }
    });
    document.body.appendChild(el);
  }
  const pf = prefill || {};
  const cars = window.DB?.Vehicles?.getMine?.() || [];
  const hasCars = Array.isArray(cars) && cars.length > 0;
  const eh = window.escHtml || ((v)=>String(v ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch])));
  el.innerHTML = `
  <div class="cmodal-box vehicle-add-modal-box" style="max-width:560px">
    <div class="cmodal-head vehicle-add-modal-head">
      <h3>▱ Новая карточка авто</h3>
      <button class="cmodal-close" onclick="window.closeVehicleAddModal?.()">✕</button>
    </div>
    <div class="cmodal-body vehicle-add-modal-body">
      <div class="vehicle-quick-create-note">${hasCars ? 'Обязательны только марка и модель. Остальные поля можно заполнить позже.' : 'У вас пока нет машин. Сразу заполните два обязательных поля: марка и модель.'}</div>
      <div class="vehicle-quick-create-grid vehicle-add-modal-grid">
        <div class="vehicle-quick-photo-box" ${hasCars ? '' : 'style="display:none"'}>
          <label class="vehicle-quick-photo-label" for="vma-photo-input"><span id="vma-photo-preview" class="vehicle-quick-photo-preview">▱</span><span class="vehicle-quick-photo-text">Добавить фото</span></label>
          <input id="vma-photo-input" type="file" accept="image/*" style="display:none" onchange="previewVehicleModalPhoto(this)">
        </div>
        <div class="profile-form vehicle-add-modal-form" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="pf-group"><label class="pf-label">Марка *</label><input class="pf-input" id="vma-brand" value="${eh(pf.brand||'')}" placeholder="Toyota"></div>
          <div class="pf-group"><label class="pf-label">Модель *</label><input class="pf-input" id="vma-model" value="${eh(pf.model||'')}" placeholder="Camry"></div>
          <div class="pf-group" style="grid-column:1/-1;${hasCars ? '' : 'display:none'}"><label class="pf-label">Название авто</label><input class="pf-input" id="vma-title" value="${eh(pf.title||pf.car||'')}" placeholder="Toyota Camry 70"></div>
          <div class="pf-group" style="${hasCars ? '' : 'display:none'}"><label class="pf-label">Госномер</label><input class="pf-input" id="vma-plate" value="${eh(pf.plate||'')}" placeholder="777 AAA 16" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="pf-group" style="${hasCars ? '' : 'display:none'}"><label class="pf-label">VIN</label><input class="pf-input" id="vma-vin" value="${eh(pf.vin||'')}" placeholder="JTNBF3HK..." oninput="this.value=this.value.toUpperCase()"></div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);grid-column:1/-1"><input type="checkbox" id="vma-default" ${pf.isDefault || !hasCars ? 'checked' : ''}/> Сделать основным автомобилем</label>
          <div class="vehicle-add-modal-actions">
            <button class="btn btn-primary" style="flex:1;justify-content:center" onclick="saveVehicleFromModal(this)">Создать карточку</button>
            <button class="btn btn-outline" style="flex:1;justify-content:center" onclick="window.closeVehicleAddModal?.()">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  el.classList.add('open');
  try { window.App?.LayerManager?.open('vehicle-add-modal'); } catch(_e) {}
  window.__vehicleModalPhotoDataUrl = String(pf.photoUrl || pf.photo_url || '');
  const input = el.querySelector('#vma-brand') || el.querySelector('#vma-model');
  const preview = document.getElementById('vma-photo-preview');
  if (preview && window.__vehicleModalPhotoDataUrl) { preview.className = 'vehicle-quick-photo-preview has-image'; preview.innerHTML = `<img src="${window.__vehicleModalPhotoDataUrl}" alt="Авто">`; }
  if (input) input.focus();
}

window.previewVehicleModalPhoto = function(input){
  const file = input?.files?.[0];
  const preview = document.getElementById('vma-photo-preview');
  if (!preview) return;
  if (!file) { preview.className = 'vehicle-quick-photo-preview'; preview.innerHTML = '▱'; window.__vehicleModalPhotoDataUrl = ''; return; }
  const fr = new FileReader();
  fr.onload = function(){
    window.__vehicleModalPhotoDataUrl = String(fr.result || '');
    preview.className = 'vehicle-quick-photo-preview has-image';
    preview.innerHTML = `<img src="${window.__vehicleModalPhotoDataUrl}" alt="Авто">`;
  };
  fr.readAsDataURL(file);
}

window.closeVehicleAddModal = function(){
  const el = document.getElementById('vehicle-add-modal');
  if (el) {
    if (window.__closeLayeredModal) window.__closeLayeredModal('vehicle-add-modal','vehicle-add-modal');
    else el.classList.remove('open');
  }
  window.__vehicleModalPhotoDataUrl = '';
  const input = document.getElementById('vma-photo-input');
  if (input) input.value = '';
  if (location.hash.startsWith('#cabinet:car:new')) { try { history.pushState(null,'','#cabinet:car:cmodal:cab-pane-modal'); } catch(_e){} }
};

window.saveVehicleFromModal = async function(btn) {
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const rawTitle = g('vma-title');
  const plate   = g('vma-plate');
  const vin     = g('vma-vin').toUpperCase();
  const brand   = g('vma-brand');
  const model   = g('vma-model');
  const title   = rawTitle || [brand, model].filter(Boolean).join(' ') || '';
  // Валидация: нужно хотя бы марка или название
  if (!title.trim()) {
    showToast('Укажите марку автомобиля', 'error');
    document.getElementById('vma-brand')?.focus();
    return;
  }
  const isDefault = !!document.getElementById('vma-default')?.checked;
  const photoUrl = String(window.__vehicleModalPhotoDataUrl || '').trim();

  if (!brand) { showToast('Укажите марку', 'error'); document.getElementById('vma-brand')?.focus(); return; }
  if (!model) { showToast('Укажите модель', 'error'); document.getElementById('vma-model')?.focus(); return; }

  const payload = { id:'', icon:'▱', title, brand, model, year:'', plate, vin, color:'', photoUrl, mileageKm: 0, serviceAt:'', serviceNote:'', note:'', isDefault };

  if (btn) { btn.disabled = true; btn.textContent = 'Создаём...'; }
  try {
    const saved = await window.DB.Vehicles.upsert(payload);
    if (saved?.isDefault && window.App?.mergeUserPatch) window.App.mergeUserPatch({ car: saved.title||'' });
    showToast('Карточка автомобиля создана');
    const modal = document.getElementById('vehicle-add-modal');
    if (modal) { window.closeVehicleAddModal?.(); }
    window.__vehicleModalPhotoDataUrl = '';
    if (typeof window._refreshBookingVehicleSelect === 'function') window._refreshBookingVehicleSelect();
    if (saved?.id && typeof Booking !== 'undefined' && Booking?.pickVehicle) Booking.pickVehicle(saved.id);
    const bookingActive = !!document.getElementById('booking-form-area');
    if (bookingActive) {
      showToast('Автомобиль добавлен и выбран для заявки');
    } else if (window.App?.go && document.getElementById('client-vehicles-grid')) { App.go('cabinet'); if (saved?.id && typeof window.openVehicleCard === 'function') setTimeout(() => window.openVehicleCard(saved.id), 80); } else if (saved?.id && typeof window.openVehicleCard === 'function') { window.openVehicleCard(saved.id); }
  } catch(e) {
    showToast((e&&e.message)||'Не удалось сохранить автомобиль', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Создать карточку'; }
  }
}

window._autoCreateVehicleFromOrder = async function(order) {
  if (!order || !order.clientCar || !order.clientPhone) return;
  const u = window._appState?.user;
  if (!u?.phone) return;
  // Only for current user's own order
  const myPhone = (u.phone||'').replace(/\D/g,'');
  const orderPhone = (order.clientPhone||'').replace(/\D/g,'');
  if (myPhone !== orderPhone) return;
  // Check if already have a vehicle with same title or plate
  const existing = (window.DB?.Vehicles?.getMine?.() || []);
  const carTitle = (order.clientCar||'').trim();
  if (!carTitle || carTitle === '—') return;
  const already = existing.find(v =>
    (v.title||'').toLowerCase() === carTitle.toLowerCase() ||
    (v.plate && order.clientCar && order.clientCar.toLowerCase().includes((v.plate||'').toLowerCase()))
  );
  if (already) return; // already have this car
  // Try to parse brand/model from title like "Toyota Camry 2018"
  const parts = carTitle.split(/\s+/);
  const brand = parts[0] || carTitle;
  const model = parts.slice(1, -1).join(' ') || '';
  const year  = parts.length >= 3 && /^\d{4}$/.test(parts[parts.length-1]) ? parts[parts.length-1] : '';
  try {
    await window.DB.Vehicles.upsert({
      id:'', icon:'▱', title: carTitle, brand, model, year,
      plate: order.clientVehicleId ? '' : '—',
      vin: 'UNKNOWN_' + Date.now().toString(36).toUpperCase(),
      color:'', mileageKm:0, serviceAt:'', serviceNote:'', note:'', isDefault: existing.length === 0,
    });
  } catch(_e) {} // silently fail — don't block the order flow
}

/* ── Special Services (эвакуатор, юрист и т.д.) ── */
window.openEvacModal = function() {
  try { history.pushState({modal:'openEvacModal'}, '', '#special:evacuator'); } catch(_e) {}
  // эвакуатор использует тот же spec-svc-panel и тот же flow создания заявки, что юрист/срочный мастер.
  return window.openSpecialService('evacuator');
}

window.closeEvacModal = function(){
  return window.closeSpecialService();
}

window.sendEvacRequest = async function(){
  // legacy-кнопки старых сборок не должны врать «заявка принята» при ошибке API.
  if (!document.getElementById('special-svc-overlay')) window.openSpecialService('evacuator');
  return window.submitSpecialServiceRequest?.();
}

function _specialServiceConfigs(){
  return {
    evacuator: {
      title: '▰ Вызвать эвакуатор', color: '#ef4444', kind: 'evacuator', priority: 'urgent',
      desc: 'Заберём автомобиль с точки А в точку Б по городу или межгороду. Заявка сразу уходит в общий поток заявок.',
      formTitle: 'Заявка на эвакуатор',
      locationLabel: 'Точка А — где забрать автомобиль',
      locationPlaceholder: 'Улица, дом, ориентир, город',
      targetLabel: 'Точка Б — куда доставить',
      targetPlaceholder: 'Адрес сервиса, дома или стоянки',
      noteLabel: 'Причина эвакуации / комментарий',
      notePlaceholder: 'ДТП, не заводится, пробито колесо, заблокировано колесо...',
      items: [
        {ico:'▰', label:'По городу', sub:'Перевозка автомобиля внутри города', price:'срочно · 24/7', action:'evacuator_city'},
        {ico:'▱', label:'Межгород', sub:'Доставка авто между населёнными пунктами', price:'расчёт по маршруту', action:'evacuator_intercity'},
        {ico:'!', label:'После ДТП', sub:'Нужна аккуратная погрузка и помощь на месте', price:'приоритет', action:'evacuator_accident'},
      ],
    },
    diagnostics: {
      title: '⌕ Диагностика', color: '#22c55e', kind: 'service_category', priority: 'normal', kicker: 'Сервисная категория',
      desc: 'Выберите, что именно нужно проверить. После выбора откроется отдельная форма заявки по выбранному типу диагностики.',
      formTitle: 'Заявка на диагностику',
      locationLabel: 'Адрес / сервис', locationPlaceholder: 'Адрес выезда или сервис, куда готовы приехать',
      targetLabel: 'Что проверить', targetPlaceholder: 'Симптомы, ошибки, поведение автомобиля',
      noteLabel: 'Комментарий', notePlaceholder: 'Опишите проблему, когда проявляется, есть ли ошибки на панели...',
      items: [
        {ico:'▣', label:'Компьютерная диагностика', sub:'Ошибки, датчики, Check Engine, электронные блоки', price:'от 3 000 ₸', action:'diagnostics_computer', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Какие ошибки / симптомы', targetPlaceholder:'Check Engine, ошибка ABS, коробка, датчики...', submitText:'⌕ Создать заявку на диагностику'}},
        {ico:'⌁', label:'Диагностика двигателя', sub:'Троит, дымит, не заводится, потеря тяги', price:'от 5 000 ₸', action:'diagnostics_engine', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Симптом двигателя', targetPlaceholder:'Не заводится / троит / дымит / перегрев...', submitText:'⌁ Создать заявку по двигателю'}},
        {ico:'▱', label:'Диагностика ходовой', sub:'Стуки, скрипы, люфт, вибрация, подвеска', price:'от 4 000 ₸', action:'diagnostics_chassis', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Что беспокоит', targetPlaceholder:'Стук спереди, вибрация, уводит в сторону...', submitText:'▱ Создать заявку по ходовой'}},
        {ico:'⌁', label:'Диагностика электрики', sub:'Стартер, генератор, свет, проводка, ошибки', price:'от 4 000 ₸', action:'diagnostics_electric', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Электрическая проблема', targetPlaceholder:'Не крутит стартер, не горит свет, разряд АКБ...', submitText:'⌁ Создать заявку электрику'}},
        {ico:'▱', label:'Предпокупочная проверка', sub:'Осмотр автомобиля перед покупкой', price:'от 8 000 ₸', action:'diagnostics_prebuy', formMeta:{visitMode:true, defaultVisitMode:'self', locationLabel:'Где осмотреть автомобиль', locationPlaceholder:'Адрес продавца или сервис осмотра', targetLabel:'Автомобиль на проверку', targetPlaceholder:'Марка, модель, год, пробег, ссылка на объявление', submitText:'▱ Создать заявку на осмотр'}},
        {ico:'▤', label:'Комплексная диагностика', sub:'Проверить несколько систем за один визит', price:'от 10 000 ₸', action:'diagnostics_full', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Что включить в проверку', targetPlaceholder:'Двигатель, ходовая, тормоза, электрика...', submitText:'▤ Создать комплексную заявку'}},
      ],
    },
    engine: {
      title: '⌁ Двигатель', color: '#fb7185', kind: 'service_category', priority: 'normal', kicker: 'Сервисная категория',
      desc: 'Заявки по запуску, работе, перегреву, ГРМ, течам и ремонту двигателя. Выберите конкретную проблему.',
      formTitle: 'Заявка по двигателю',
      locationLabel: 'Адрес автомобиля / сервис', locationPlaceholder: 'Где находится автомобиль или куда готовы приехать',
      targetLabel: 'Проблема двигателя', targetPlaceholder: 'Что произошло с двигателем',
      noteLabel: 'Подробности', notePlaceholder: 'Когда началось, на ходу или после стоянки, какие звуки/ошибки...',
      items: [
        {ico:'×', label:'Не заводится', sub:'Стартер крутит/не крутит, запуск невозможен', price:'от 5 000 ₸', action:'engine_no_start', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Как ведёт себя при запуске', targetPlaceholder:'Крутит стартер, щёлкает, молчит, схватывает и глохнет...', submitText:'⌁ Создать заявку: не заводится'}},
        {ico:'💨', label:'Троит / дымит', sub:'Неровная работа, вибрация, дым из выхлопа', price:'от 5 000 ₸', action:'engine_misfire_smoke', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Симптом', targetPlaceholder:'Троит на холодную, белый/синий/чёрный дым...', submitText:'💨 Создать заявку по работе двигателя'}},
        {ico:'▱', label:'Перегрев', sub:'Температура растёт, вентилятор, антифриз, радиатор', price:'от 6 000 ₸', action:'engine_overheat', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Когда перегревается', targetPlaceholder:'В пробке, на трассе, сразу после запуска...', submitText:'▱ Создать заявку по перегреву'}},
        {ico:'▱', label:'ГРМ / цепь / ремень', sub:'Шум цепи, замена ремня, метки, ролики, помпа', price:'от 15 000 ₸', action:'engine_timing', formMeta:{visitMode:false, targetLabel:'Что требуется', targetPlaceholder:'Замена ремня/цепи, шум, пробег, комплект деталей...', submitText:'▱ Создать заявку по ГРМ'}},
        {ico:'💧', label:'Течь масла / антифриза', sub:'Потеки, запах, снижение уровня жидкостей', price:'от 5 000 ₸', action:'engine_leak', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Что течёт и где видно', targetPlaceholder:'Масло под авто, антифриз, мокрый двигатель...', submitText:'💧 Создать заявку по течи'}},
        {ico:'⌁', label:'Капремонт / консультация', sub:'Оценка ремонта, подбор мастера, расчёт работ', price:'по оценке', action:'engine_overhaul', formMeta:{visitMode:false, targetLabel:'Что хотите оценить', targetPlaceholder:'Компрессия, расход масла, стук, капиталка...', submitText:'⌁ Создать заявку на оценку ремонта'}},
      ],
    },
    chassis: {
      title: '▱ Ходовая', color: '#60a5fa', kind: 'service_category', priority: 'normal', kicker: 'Сервисная категория',
      desc: 'Подвеска, рулевое, ступицы, амортизаторы, развал-схождение и поиск стуков.',
      formTitle: 'Заявка по ходовой',
      locationLabel: 'Адрес / сервис', locationPlaceholder: 'Адрес выезда или удобный сервис',
      targetLabel: 'Проблема ходовой', targetPlaceholder: 'Стук, люфт, вибрация, уводит в сторону',
      noteLabel: 'Комментарий', notePlaceholder: 'На какой скорости, с какой стороны, после ямы или постоянно...',
      items: [
        {ico:'⌁', label:'Стук в подвеске', sub:'Поиск причины стука, скрипа или люфта', price:'от 4 000 ₸', action:'chassis_noise', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Где и когда стучит', targetPlaceholder:'Спереди/сзади, на кочках, при торможении...', submitText:'▱ Создать заявку по стуку'}},
        {ico:'◯', label:'Амортизаторы / стойки', sub:'Диагностика и замена стоек, опор, пыльников', price:'от 8 000 ₸', action:'chassis_struts', formMeta:{visitMode:false, targetLabel:'Что нужно заменить', targetPlaceholder:'Передние стойки, опоры, пыльники, свои запчасти...', submitText:'◯ Создать заявку по стойкам'}},
        {ico:'🦾', label:'Рычаги / шаровые / сайлентблоки', sub:'Замена элементов подвески', price:'от 6 000 ₸', action:'chassis_arms', formMeta:{visitMode:false, targetLabel:'Какие детали', targetPlaceholder:'Рычаг, шаровая, сайлентблок, сторона...', submitText:'🦾 Создать заявку по подвеске'}},
        {ico:'🎯', label:'Рулевое управление', sub:'Тяги, наконечники, рейка, люфт руля', price:'от 5 000 ₸', action:'chassis_steering', formMeta:{visitMode:false, targetLabel:'Что с рулём', targetPlaceholder:'Люфт, стук рейки, тугой руль, течь...', submitText:'🎯 Создать заявку по рулевому'}},
        {ico:'◇', label:'Ступица / подшипник', sub:'Гул, люфт, замена ступичного подшипника', price:'от 7 000 ₸', action:'chassis_bearing', formMeta:{visitMode:false, targetLabel:'Сторона и симптом', targetPlaceholder:'Гул справа, люфт, после диагностики...', submitText:'◇ Создать заявку по ступице'}},
        {ico:'📐', label:'Развал-схождение', sub:'Уводит, ест резину, после ремонта подвески', price:'от 5 000 ₸', action:'chassis_alignment', formMeta:{visitMode:false, targetLabel:'Причина обращения', targetPlaceholder:'После замены рычагов, тянет вправо, ест резину...', submitText:'📐 Создать заявку на развал'}},
      ],
    },
    electric: {
      title: '⌁ Электрика', color: '#34d399', kind: 'service_category', priority: 'normal', kicker: 'Сервисная категория',
      desc: 'Стартер, генератор, проводка, свет, датчики, ошибки, сигнализация и автоэлектроника.',
      formTitle: 'Заявка автоэлектрику',
      locationLabel: 'Адрес автомобиля / сервис', locationPlaceholder: 'Где находится автомобиль или куда готовы приехать',
      targetLabel: 'Что не работает', targetPlaceholder: 'Стартер, генератор, свет, сигнализация, ошибка',
      noteLabel: 'Комментарий', notePlaceholder: 'Когда проявляется, что уже проверяли, есть ли код ошибки...',
      items: [
        {ico:'▱', label:'Стартер / генератор', sub:'Не крутит, нет зарядки, свист, просадка напряжения', price:'от 5 000 ₸', action:'electric_starter_generator', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Симптом', targetPlaceholder:'Не крутит стартер, нет зарядки, горит аккумулятор...', submitText:'⌁ Создать заявку электрику'}},
        {ico:'🧠', label:'Ошибки / датчики', sub:'Check Engine, ABS, ESP, датчики и блоки', price:'от 4 000 ₸', action:'electric_errors_sensors', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Какая ошибка', targetPlaceholder:'Check Engine, ABS, ESP, код ошибки если есть...', submitText:'🧠 Создать заявку по ошибкам'}},
        {ico:'💡', label:'Свет / проводка', sub:'Фары, стопы, предохранители, короткое замыкание', price:'от 4 000 ₸', action:'electric_lights_wiring', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Что не работает', targetPlaceholder:'Ближний свет, стопы, габариты, проводка...', submitText:'💡 Создать заявку по свету'}},
        {ico:'◌', label:'Сигнализация / автозапуск', sub:'Брелок, центральный замок, автозапуск', price:'от 5 000 ₸', action:'electric_alarm_remote', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Система и проблема', targetPlaceholder:'Не открывает, не заводит, срабатывает сама...', submitText:'◌ Создать заявку по сигнализации'}},
        {ico:'🎵', label:'Магнитола / камера / CarPlay', sub:'Мультимедиа, камера, парктроники, подключение', price:'от 5 000 ₸', action:'electric_media', formMeta:{visitMode:false, targetLabel:'Что установить или починить', targetPlaceholder:'Магнитола, камера, Android, CarPlay, парктроник...', submitText:'🎵 Создать заявку по мультимедиа'}},
        {ico:'🧯', label:'Поиск утечки тока', sub:'Аккумулятор садится за ночь или за несколько дней', price:'от 6 000 ₸', action:'electric_drain', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Как быстро садится АКБ', targetPlaceholder:'За ночь, за 2-3 дня, после установки оборудования...', submitText:'🧯 Создать заявку на поиск утечки'}},
      ],
    },
    brakes: {
      title: '🛑 Тормозная система', color: '#f97316', kind: 'service_category', priority: 'normal', kicker: 'Сервисная категория',
      desc: 'Колодки, диски, суппорты, ABS, тормозная жидкость, ручник и диагностика тормозов.',
      formTitle: 'Заявка по тормозам',
      locationLabel: 'Адрес / сервис', locationPlaceholder: 'Адрес выезда или сервис',
      targetLabel: 'Проблема тормозов', targetPlaceholder: 'Скрип, биение, мягкая педаль, ABS, ручник',
      noteLabel: 'Комментарий', notePlaceholder: 'Когда проявляется, есть ли свои запчасти, какая ось...',
      items: [
        {ico:'🧱', label:'Колодки / диски', sub:'Замена передних или задних колодок и дисков', price:'от 5 000 ₸', action:'brakes_pads_discs', formMeta:{visitMode:false, targetLabel:'Что менять', targetPlaceholder:'Передние/задние колодки, диски, свои запчасти...', submitText:'🛑 Создать заявку по колодкам'}},
        {ico:'⌁', label:'Скрип / биение', sub:'Диагностика шума, вибрации и биения при торможении', price:'от 4 000 ₸', action:'brakes_noise_vibration', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Когда проявляется', targetPlaceholder:'При лёгком торможении, на скорости, после прогрева...', submitText:'⌁ Создать заявку на диагностику тормозов'}},
        {ico:'⌁', label:'Суппорт / направляющие', sub:'Заклинило колесо, греется диск, ремонт суппорта', price:'от 6 000 ₸', action:'brakes_caliper', formMeta:{visitMode:true, defaultVisitMode:'field', targetLabel:'Что происходит', targetPlaceholder:'Греется колесо, клинит, потёк суппорт...', submitText:'⌁ Создать заявку по суппорту'}},
        {ico:'🧠', label:'ABS / ESP', sub:'Горит ошибка, датчики ABS, кольца, проводка', price:'от 5 000 ₸', action:'brakes_abs', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Какая ошибка', targetPlaceholder:'ABS/ESP горит постоянно или периодически...', submitText:'🧠 Создать заявку по ABS'}},
        {ico:'💧', label:'Жидкость / прокачка', sub:'Замена тормозной жидкости, прокачка системы', price:'от 5 000 ₸', action:'brakes_fluid', formMeta:{visitMode:false, targetLabel:'Что требуется', targetPlaceholder:'Замена жидкости, прокачка после ремонта...', submitText:'💧 Создать заявку на жидкость'}},
        {ico:'P', label:'Ручник', sub:'Регулировка, тросы, колодки стояночного тормоза', price:'от 5 000 ₸', action:'brakes_handbrake', formMeta:{visitMode:false, targetLabel:'Проблема ручника', targetPlaceholder:'Не держит, закис трос, ошибка EPB...', submitText:'P Создать заявку по ручнику'}},
      ],
    },
    body: {
      title: '▱ Кузовные работы', color: '#f59e0b', kind: 'service_category', priority: 'normal', kicker: 'Сервисная категория',
      desc: 'Оценка повреждений, рихтовка, покраска, бамперы, сварка, вмятины и работы после ДТП.',
      formTitle: 'Заявка по кузову',
      locationLabel: 'Адрес осмотра / сервис', locationPlaceholder: 'Где показать автомобиль или куда готовы приехать',
      targetLabel: 'Что повреждено', targetPlaceholder: 'Бампер, дверь, крыло, порог, после ДТП',
      noteLabel: 'Комментарий', notePlaceholder: 'Есть ли фото, страховой случай, нужна ли оценка стоимости...',
      items: [
        {ico:'📸', label:'Оценка повреждений после ДТП', sub:'Первичная оценка, список работ, ориентир по стоимости', price:'от 5 000 ₸', action:'body_accident_estimate', formMeta:{visitMode:true, defaultVisitMode:'self', targetLabel:'Какие элементы повреждены', targetPlaceholder:'Бампер, крыло, дверь, фара, геометрия...', submitText:'📸 Создать заявку на оценку'}},
        {ico:'🔨', label:'Рихтовка', sub:'Восстановление геометрии и повреждённых элементов', price:'по оценке', action:'body_straightening', formMeta:{visitMode:false, targetLabel:'Что нужно рихтовать', targetPlaceholder:'Крыло, дверь, порог, капот, после удара...', submitText:'🔨 Создать заявку на рихтовку'}},
        {ico:'🎨', label:'Покраска', sub:'Локальная или полная покраска элемента', price:'от 25 000 ₸', action:'body_paint', formMeta:{visitMode:false, targetLabel:'Что красить', targetPlaceholder:'Бампер, крыло, дверь, код цвета если есть...', submitText:'🎨 Создать заявку на покраску'}},
        {ico:'▱', label:'Бампер / пластик', sub:'Ремонт, пайка, замена, крепления', price:'от 10 000 ₸', action:'body_bumper_plastic', formMeta:{visitMode:false, targetLabel:'Что с пластиком', targetPlaceholder:'Трещина, крепление, пайка, замена...', submitText:'▱ Создать заявку по бамперу'}},
        {ico:'◇', label:'Сварка / пороги', sub:'Пороги, арки, днище, коррозия', price:'по оценке', action:'body_welding', formMeta:{visitMode:false, targetLabel:'Зона ремонта', targetPlaceholder:'Порог, арка, днище, коррозия, фото есть/нет...', submitText:'◇ Создать заявку на сварку'}},
        {ico:'✦', label:'Вмятины / полировка', sub:'Удаление вмятин, полировка, косметика кузова', price:'от 8 000 ₸', action:'body_dents_polish', formMeta:{visitMode:false, targetLabel:'Что сделать', targetPlaceholder:'Вмятина без покраски, полировка, царапины...', submitText:'✦ Создать заявку по косметике'}},
      ],
    },
    tires: {
      title: '◯ Шиномонтаж', color: '#38bdf8', kind: 'field_service', priority: 'normal',
      desc: 'Сезонная замена, балансировка, ремонт проколов и отдельный сценарий выездной помощи.',
      formTitle: 'Заявка по шиномонтажу',
      locationLabel: 'Адрес или сервис', locationPlaceholder: 'Адрес выезда или удобный сервис',
      targetLabel: 'Желаемый формат', targetPlaceholder: 'В сервисе / выезд / срочно',
      noteLabel: 'Комментарий', notePlaceholder: 'Размер колёс, проблема, количество колёс...',
      items: [
        {ico:'▣', label:'Сезонная замена в сервисе', sub:'Снять/поставить 4 колеса с балансировкой', price:'от 8 000 ₸', action:'tires_service'},
        {ico:'🩹', label:'Ремонт прокола', sub:'Жгут или заплатка без лишнего ожидания', price:'от 3 000 ₸', action:'tires_repair'},
        {ico:'⚖', label:'Балансировка', sub:'Устранение вибрации и биения на скорости', price:'от 3 000 ₸', action:'tires_balance'},
        {ico:'🚐', label:'Выездной шиномонтаж', sub:'Адрес и срочность обязательны для заявки', price:'от 10 000 ₸', action:'tires_field'},
        {ico:'SOS', label:'Экстренная помощь на дороге', sub:'Когда нужна срочная помощь с колесом на месте', price:'от 10 000 ₸ + выезд', action:'tires_emergency'},
      ],
    },
    battery: {
      title: '▱ Аккумуляторы', color: '#14b8a6', kind: 'field_service', priority: 'normal',
      desc: 'Отдельный сценарий под прикурить, проверить аккумулятор, доставить новый и заменить на месте.',
      formTitle: 'Заявка по аккумулятору',
      locationLabel: 'Адрес автомобиля', locationPlaceholder: 'Где стоит автомобиль',
      targetLabel: 'Что нужно сделать', targetPlaceholder: 'Прикурить / проверить / доставить АКБ',
      noteLabel: 'Комментарий', notePlaceholder: 'Марка АКБ, симптомы, срочность...',
      items: [
        {ico:'⌁', label:'Прикурить', sub:'Выезд и запуск автомобиля от внешнего источника', price:'от 4 000 ₸', action:'battery_jump', formPreset:'battery_address'},
        {ico:'⌕', label:'Проверить аккумулятор', sub:'Диагностика состояния АКБ и пускового тока', price:'от 5 000 ₸', action:'battery_check', formPreset:'battery_diagnostic'},
        {ico:'▣', label:'Доставить новый', sub:'Подбор и доставка аккумулятора под ваше авто', price:'от 5 000 ₸', action:'battery_delivery', formPreset:'battery_address'},
        {ico:'⌁', label:'Подобрать и заменить', sub:'Если не знаете параметры — подберём по машине', price:'от 5 000 ₸ + установка', action:'battery_replace', formPreset:'battery_address'},
        {ico:'🔌', label:'Проверить зарядку', sub:'Проверка генератора и цепи зарядки', price:'от 5 000 ₸', action:'battery_charge', formPreset:'battery_diagnostic'},
      ],
    },
    emergency: {
      title: 'SOS Срочные услуги', color: '#ef4444', kind: 'urgent_service', priority: 'urgent',
      desc: 'Быстрые аварийные сценарии, когда нужно решить ситуацию здесь и сейчас.',
      formTitle: 'Срочная заявка',
      locationLabel: 'Где находится автомобиль', locationPlaceholder: 'Адрес / район / ориентир',
      targetLabel: 'Что требуется', targetPlaceholder: 'Выезд мастера / запуск / вскрытие / топливо',
      noteLabel: 'Описание ситуации', notePlaceholder: 'Что произошло и как срочно нужна помощь...',
      items: [
        {ico:'▰', label:'Эвакуатор', sub:'Эвакуация по городу и области', price:'от 8 000 ₸', action:'emergency_tow'},
        {ico:'▱', label:'Прикурить АКБ', sub:'Выезд и запуск от внешнего источника', price:'от 4 000 ₸', action:'emergency_jump'},
        {ico:'⌁', label:'Выезд мастера', sub:'Диагностика и мелкий ремонт на месте', price:'от 5 000 ₸ + выезд', action:'emergency_mobile'},
        {ico:'🔓', label:'Вскрытие авто', sub:'Если заперли ключи в машине', price:'от 5 000 ₸', action:'emergency_unlock'},
        {ico:'⛽', label:'Подвоз топлива', sub:'Минимальный выездной сценарий на дороге', price:'от 4 000 ₸', action:'emergency_fuel'},
      ],
    },
    emergency_master: {
      title: 'SOS Срочно нужен мастер на выезд', color: '#ef4444', kind: 'urgent_master', priority: 'urgent',
      desc: 'Для ситуации, когда клиент не уверен в точной категории, но нужна помощь на месте как можно быстрее.',
      formTitle: 'Заявка на выезд мастера',
      locationLabel: 'Адрес выезда', locationPlaceholder: 'Где находится автомобиль',
      targetLabel: 'Авто может ехать?', targetPlaceholder: 'Да / нет / не знаю',
      noteLabel: 'Что случилось', notePlaceholder: 'Опишите симптомы: не заводится, шум, ошибка, течь, ДТП...',
      items: [
        {ico:'🧭', label:'Не знаю точную поломку', sub:'Система подберёт ближайшего мастера или откроет приоритетную заявку', price:'Приоритетный сценарий', action:'urgent_unknown'},
        {ico:'🚐', label:'Машина на ходу', sub:'Можно приехать мастеру для диагностики и решения на месте', price:'от 5 000 ₸ + выезд', action:'urgent_driveable'},
        {ico:'▰', label:'Машина не на ходу', sub:'Сразу дадим выбор: эвакуатор или срочный выезд мастера', price:'По ситуации', action:'urgent_not_driveable'},
      ],
    },
    legal: {
      title: '⚖ Вызвать юриста', color: '#8b5cf6', kind: 'legal', priority: 'urgent',
      desc: 'Юридическая помощь по ДТП, страховым вопросам и спорным авто-ситуациям с отдельным сценарием.',
      formTitle: 'Заявка юристу',
      locationLabel: 'Место ситуации', locationPlaceholder: 'Город, адрес ДТП или где нужна помощь',
      targetLabel: 'Тема обращения', targetPlaceholder: 'ДТП / страховая / спор / консультация',
      noteLabel: 'Кратко опишите ситуацию', notePlaceholder: 'Что произошло, кто участвует, какие документы есть...',
      items: [
        {ico:'▤', label:'Юрист при ДТП', sub:'Выезд юриста на место и помощь с оформлением', price:'от 10 000 ₸', action:'legal_dtc'},
        {ico:'◇', label:'Помощь со страховой', sub:'Сопровождение выплат ОСАГО / КАСКО', price:'Консультация', action:'legal_insurance'},
        {ico:'📸', label:'Оформление ситуации', sub:'Фиксация, схема, документы и пояснения', price:'от 10 000 ₸', action:'legal_docs'},
        {ico:'⌕', label:'Независимая экспертиза', sub:'Оценка ущерба и сопровождение спора', price:'от 25 000 ₸', action:'legal_expert'},
        {ico:'◌', label:'Онлайн-консультация', sub:'Быстрый разбор ситуации и следующие шаги', price:'от 10 000 ₸', action:'legal_consult'},
      ],
    },
  };
}

function _specialFallbackServiceId(){
  const list = window.DB?.Services?.getAll?.() || [];
  if (!Array.isArray(list) || !list.length) return '';
  const preferred = list.find(s => String(s.id||'') === 'other')
    || list.find(s => /проч|друг|консульт|диаг/i.test(String(s.name||s.label||'')))
    || list[0];
  return String(preferred?.id || '').trim();
}

function _todayIso(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

// сценарии аккумулятора используют разные формы, а не одну общую заявку.
function _specialScenarioFormMeta(cfg, selected){
  const action = String(selected?.action || '');
  const preset = String(selected?.formPreset || '');
  const base = {
    modalTitle: selected?.label || cfg?.formTitle || 'Быстрая заявка',
    formTitle: selected?.label || cfg?.formTitle || 'Быстрая заявка',
    locationLabel: cfg?.locationLabel || 'Адрес',
    locationPlaceholder: cfg?.locationPlaceholder || 'Адрес или ориентир',
    locationRequired: true,
    targetLabel: cfg?.targetLabel || 'Уточнение',
    targetPlaceholder: cfg?.targetPlaceholder || 'Что требуется',
    targetRequired: false,
    noteLabel: cfg?.noteLabel || 'Комментарий',
    notePlaceholder: cfg?.notePlaceholder || 'Коротко опишите ситуацию',
    submitText: '🚀 Создать срочную заявку',
    visitMode: false,
    defaultVisitMode: 'field'
  };

  const customMeta = selected && typeof selected.formMeta === 'object' && selected.formMeta ? selected.formMeta : null;
  if (customMeta) {
    return Object.assign({}, base, customMeta, {
      modalTitle: customMeta.modalTitle || selected?.label || base.modalTitle,
      formTitle: customMeta.formTitle || selected?.label || base.formTitle,
      locationRequired: customMeta.locationRequired !== undefined ? !!customMeta.locationRequired : base.locationRequired,
      visitMode: !!customMeta.visitMode,
      defaultVisitMode: customMeta.defaultVisitMode || base.defaultVisitMode
    });
  }

  if (preset === 'battery_address' || ['battery_jump','battery_delivery','battery_replace'].includes(action)) {
    const map = {
      battery_jump: {
        modalTitle:'Прикурить автомобиль', formTitle:'⌁ Прикурить автомобиль',
        locationLabel:'Адрес автомобиля', locationPlaceholder:'Где стоит автомобиль: улица, дом, двор, парковка',
        targetLabel:'Где припаркован автомобиль', targetPlaceholder:'Двор / паркинг / подъезд / ориентир',
        noteLabel:'Симптомы', notePlaceholder:'Как давно стоит, есть ли доступ к капоту, АКБ под капотом/в багажнике...',
        submitText:'⌁ Создать заявку на прикурить'
      },
      battery_delivery: {
        modalTitle:'Доставить новый аккумулятор', formTitle:'▣ Доставить новый аккумулятор',
        locationLabel:'Адрес доставки и установки', locationPlaceholder:'Куда привезти аккумулятор',
        targetLabel:'Параметры или авто', targetPlaceholder:'Марка авто / объём двигателя / старый АКБ, если знаете',
        noteLabel:'Комментарий', notePlaceholder:'Нужна только доставка или доставка с установкой, срочность...',
        submitText:'▣ Создать заявку на доставку АКБ'
      },
      battery_replace: {
        modalTitle:'Подобрать и заменить АКБ', formTitle:'⌁ Подобрать и заменить АКБ',
        locationLabel:'Адрес автомобиля', locationPlaceholder:'Где выполнить замену',
        targetLabel:'Автомобиль', targetPlaceholder:'Марка, модель, год, двигатель — если знаете',
        noteLabel:'Что известно по АКБ', notePlaceholder:'Не знаете параметры — напишите модель авто и симптомы...',
        submitText:'⌁ Создать заявку на подбор и замену'
      }
    };
    return Object.assign({}, base, map[action] || {});
  }

  if (preset === 'battery_diagnostic' || ['battery_check','battery_charge'].includes(action)) {
    const title = action === 'battery_charge' ? 'Проверить зарядку' : 'Проверить аккумулятор';
    return Object.assign({}, base, {
      modalTitle:title,
      formTitle:(action === 'battery_charge' ? '🔌 ' : '⌕ ') + title,
      visitMode:true,
      defaultVisitMode:'field',
      locationLabel:'Адрес выезда',
      locationPlaceholder:'Адрес нужен только если выбираете выезд мастера',
      targetLabel:'Удобное время / сервис',
      targetPlaceholder:'Когда удобно или в какой сервис готовы приехать',
      noteLabel:'Симптомы и что проверить',
      notePlaceholder:'Садится АКБ, не крутит стартер, горит ошибка, подозрение на генератор...',
      submitText:'⌕ Создать заявку на диагностику'
    });
  }

  return base;
}

function _specialVisitModeLabel(mode){
  return String(mode || 'field') === 'self' ? 'Приеду сам' : 'Выезд мастера';
}

function _specialLocationRequiredFor(action, visitMode){
  const a = String(action || '');
  const cur = window._specialServiceCurrent || {};
  const selected = cur.selected || ((cur.cfg && Array.isArray(cur.cfg.items)) ? cur.cfg.items.find(x => String(x.action||'') === a) : null) || {};
  const meta = (selected && typeof selected.formMeta === 'object') ? selected.formMeta : null;
  if (meta && meta.locationRequired === false) return false;
  if ((meta && meta.visitMode) || ['battery_check','battery_charge'].includes(a)) return String(visitMode || 'field') !== 'self';
  return true;
}

function _specialVehicleTitle(v){
  if(!v || typeof v !== 'object') return '';
  return String(v.title || [v.brand, v.model, v.year].filter(Boolean).join(' ') || [v.brand, v.model, v.plate].filter(Boolean).join(' · ') || v.plate || '').trim();
}

function _specialAccountSnapshot(){
  const user = window.App?.getState?.()?.user || window._appState?.user || null;
  let vehicle = null;
  try { vehicle = window.DB?.Vehicles?.getDefault?.() || (window.DB?.Vehicles?.getMine?.() || [])[0] || null; } catch(_e) { vehicle = null; }
  const rawPhone = user?.phone ? (window.App?.phoneRaw ? window.App.phoneRaw(user.phone) : String(user.phone).replace(/\D+/g,'')) : '';
  const phoneText = rawPhone ? (window.App?.formatPhone ? window.App.formatPhone(rawPhone) : String(user?.phone || rawPhone)) : '';
  const car = String(user?.car || _specialVehicleTitle(vehicle) || '').trim();
  const name = String(user?.name || '').trim();
  return {
    user,
    name,
    phone: rawPhone,
    phoneText,
    car,
    vehicleId: String(vehicle?.id || '').trim(),
    vehicle
  };
}

function _specialAccountStripHtml(account){
  const esc = eh;
  const chips = [];
  if (account?.name) chips.push('<span>'+esc(account.name)+'</span>');
  if (account?.phoneText) chips.push('<span>'+esc(account.phoneText)+'</span>');
  if (account?.car) chips.push('<span>'+esc(account.car)+'</span>');
  return '<div class="spec-svc-account-source">'
    + '<div class="spec-svc-account-title">Данные клиента будут взяты из карточки аккаунта</div>'
    + '<div class="spec-svc-account-note">Имя, телефон и автомобиль не заполняются в этой форме вручную.</div>'
    + (chips.length ? '<div class="spec-svc-account-chips">'+chips.join('')+'</div>' : '<div class="spec-svc-account-warn">Войдите и заполните профиль/автомобиль перед созданием заявки.</div>')
  + '</div>';
}

function _specialFormHtml(cfg, selected){
  const esc = eh;
  const account = _specialAccountSnapshot();
  const meta = _specialScenarioFormMeta(cfg, selected);
  const visitModeHtml = meta.visitMode ? (
    '<div class="spec-svc-mode spec-svc-field--wide" role="radiogroup" aria-label="Формат диагностики">'
      + '<div class="spec-svc-mode-title">Формат диагностики <b>*</b></div>'
      + '<label class="spec-svc-mode-option"><input type="radio" name="ssvc-visit-mode" value="field" '+(meta.defaultVisitMode !== 'self' ? 'checked' : '')+' onchange="window.toggleSpecialServiceVisitMode()"><span>🚐 Выезд мастера</span></label>'
      + '<label class="spec-svc-mode-option"><input type="radio" name="ssvc-visit-mode" value="self" '+(meta.defaultVisitMode === 'self' ? 'checked' : '')+' onchange="window.toggleSpecialServiceVisitMode()"><span>▣ Могу приехать сам</span></label>'
    + '</div>'
  ) : '<input type="hidden" name="ssvc-visit-mode" value="field">';
  const locationRequired = _specialLocationRequiredFor(selected?.action, meta.defaultVisitMode || 'field');
  return '<div class="spec-svc-request" id="special-svc-request" style="--ssc:'+esc(cfg.color || '#ff6b00')+'">'
    + '<div class="spec-svc-request-head">'
      + '<div><div class="spec-svc-request-title">'+esc(meta.formTitle || cfg.formTitle || 'Быстрая заявка')+'</div>'
      + '<div class="spec-svc-request-sub">Выбран сценарий: <b id="special-svc-selected-label">'+esc(selected?.label || '—')+'</b></div></div>'
      + '<span class="spec-svc-request-badge">заявка</span>'
    + '</div>'
    + '<input type="hidden" id="ssvc-type" value="'+esc(window._specialServiceCurrent?.type || cfg.kind || '')+'">'
    + '<input type="hidden" id="ssvc-action" value="'+esc(selected?.action || '')+'">'
    + '<input type="hidden" id="ssvc-name" value="'+esc(account.name || '')+'">'
    + '<input type="hidden" id="ssvc-phone" value="'+esc(account.phone || '')+'">'
    + '<input type="hidden" id="ssvc-car" value="'+esc(account.car || '')+'">'
    + '<input type="hidden" id="ssvc-vehicle-id" value="'+esc(account.vehicleId || '')+'">'
    + _specialAccountStripHtml(account)
    + '<div class="spec-svc-form-grid">'
      + visitModeHtml
      + '<label class="spec-svc-field" data-ssvc-location-wrap><span>'+esc(meta.locationLabel || cfg.locationLabel || 'Адрес')+' <b data-ssvc-location-required '+(!locationRequired?'style="display:none"':'')+'>*</b></span><input id="ssvc-location" data-required="'+(locationRequired?'1':'0')+'" placeholder="'+esc(meta.locationPlaceholder || cfg.locationPlaceholder || 'Адрес или ориентир')+'"></label>'
      + '<label class="spec-svc-field"><span>'+esc(meta.targetLabel || cfg.targetLabel || 'Уточнение')+(meta.targetRequired?' <b>*</b>':'')+'</span><input id="ssvc-target" placeholder="'+esc(meta.targetPlaceholder || cfg.targetPlaceholder || 'Что требуется')+'"></label>'
      + '<label class="spec-svc-field spec-svc-field--wide"><span>'+esc(meta.noteLabel || cfg.noteLabel || 'Комментарий')+'</span><textarea id="ssvc-note" rows="3" placeholder="'+esc(meta.notePlaceholder || cfg.notePlaceholder || 'Коротко опишите ситуацию')+'"></textarea></label>'
    + '</div>'
    + '<div class="spec-svc-submit-row">'
      + '<button type="button" class="btn btn-primary spec-svc-submit" onclick="window.submitSpecialServiceRequest(this)">'+esc(meta.submitText || '🚀 Создать срочную заявку')+'</button>'
      + '<button type="button" class="btn btn-outline" onclick="window.closeSpecialServiceRequest()">← К сценариям</button>'
    + '</div>'
    + '<div class="spec-svc-hint">После создания будет показан номер заявки. Она попадёт в общий поток с приоритетом и тегом сценария.</div>'
  + '</div>';
}

function _collectSpecialPayload(){
  const cur = window._specialServiceCurrent || {};
  const type = document.getElementById('ssvc-type')?.value || cur.type || cur.cfg?.kind || '';
  const action = document.getElementById('ssvc-action')?.value || cur.selected?.action || '';
  const configs = _specialServiceConfigs();
  const cfg = Object.values(configs).find(x => String(x.kind||'') === String(type||'')) || configs[type] || cur.cfg || {};
  const selected = (cfg.items || []).find(x => String(x.action||'') === String(action||'')) || cur.selected || {};
  const account = _specialAccountSnapshot();
  const phoneInput = account.phone || document.getElementById('ssvc-phone')?.value || '';
  const phone = window.App?.phoneRaw ? window.App.phoneRaw(phoneInput) : String(phoneInput).replace(/\D+/g,'');
  const name = account.name || document.getElementById('ssvc-name')?.value?.trim() || '';
  const car = account.car || document.getElementById('ssvc-car')?.value?.trim() || '';
  const vehicleId = account.vehicleId || document.getElementById('ssvc-vehicle-id')?.value?.trim() || '';
  const rawLocation = document.getElementById('ssvc-location')?.value?.trim() || '';
  const target = document.getElementById('ssvc-target')?.value?.trim() || '';
  const note = document.getElementById('ssvc-note')?.value?.trim() || '';
  const visitMode = document.querySelector('input[name="ssvc-visit-mode"]:checked')?.value || document.querySelector('input[name="ssvc-visit-mode"]')?.value || 'field';
  const formMeta = _specialScenarioFormMeta(cfg, selected);
  const locationRequired = _specialLocationRequiredFor(action, visitMode);
  const location = locationRequired ? rawLocation : '';
  return { cfg, selected, type, action, phone, name, car, vehicleId, account, location, target, note, visitMode, formMeta, locationRequired };
}

window.toggleSpecialServiceVisitMode = function(){
  const mode = document.querySelector('input[name="ssvc-visit-mode"]:checked')?.value || 'field';
  const action = document.getElementById('ssvc-action')?.value || '';
  const required = _specialLocationRequiredFor(action, mode);
  const wrap = document.querySelector('[data-ssvc-location-wrap]');
  const mark = document.querySelector('[data-ssvc-location-required]');
  const input = document.getElementById('ssvc-location');
  if (wrap) wrap.style.display = required ? '' : 'none';
  if (mark) mark.style.display = required ? '' : 'none';
  if (input) input.dataset.required = required ? '1' : '0';
};

window.selectSpecialScenario = function(action){
  const cur = window._specialServiceCurrent || {};
  const cfg = cur.cfg || {};
  const selected = (cfg.items || []).find(x => String(x.action||'') === String(action||'')) || (cfg.items || [])[0] || null;
  if (!selected) return;
  window._specialServiceCurrent = Object.assign({}, cur, { selected });
  try {
    const cat = String(window._specialServiceCurrent.cat || '').trim();
    const act = String(selected.action || '').trim();
    if (cat && act && window.getServicesCategoryUrl && location.hash.startsWith('#services')) {
      const nextHash = '#' + window.getServicesCategoryUrl(cat, act);
      if (location.hash !== nextHash) history.pushState({ serviceScenario:true, cat, action:act }, '', nextHash);
    }
  } catch(_e) {}
  document.querySelectorAll('.spec-svc-item[data-special-action]').forEach(btn => {
    btn.classList.toggle('active', String(btn.getAttribute('data-special-action')||'') === String(selected.action||''));
  });
};

window.openSpecialServiceRequest = function(action){
  if (action) window.selectSpecialScenario(action);
  const cur = window._specialServiceCurrent || {};
  const cfg = cur.cfg || {};
  const selected = cur.selected || (cfg.items || [])[0] || null;
  if (!cfg || !selected) return;
  const esc = eh;
  document.getElementById('special-svc-request-overlay')?.remove();
  document.getElementById('special-svc-result-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'special-svc-request-overlay';
  el.className = 'spec-svc-request-overlay';
  el.onclick = e => { if(e.target === el) window.closeSpecialServiceRequest(); };
  const meta = _specialScenarioFormMeta(cfg, selected);
  el.innerHTML = '<div class="spec-svc-request-modal" role="dialog" aria-modal="true" aria-label="Форма заявки" style="--ssc:'+esc(cfg.color || '#ff6b00')+'">'
    + '<div class="spec-svc-request-modal-head">'
      + '<div>'
        + '<div class="spec-svc-kicker">'+esc(cfg.kicker || 'Специальный сценарий')+' → заявка</div>'
        + '<div class="spec-svc-request-modal-title">'+esc(meta.modalTitle || cfg.formTitle || 'Быстрая заявка')+'</div>'
      + '</div>'
      + '<button type="button" class="spec-svc-close" onclick="window.closeSpecialServiceRequest()" aria-label="Назад к сценариям">✕</button>'
    + '</div>'
    + _specialFormHtml(cfg, selected)
  + '</div>';
  document.body.appendChild(el);
  setTimeout(()=>{try{window.applyPhoneMasks(el);}catch(_e){} try{window.toggleSpecialServiceVisitMode?.();}catch(_e){}},30);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.querySelector('.spec-svc-request-modal').style.transform = 'translateY(0)'; });
};

window.closeSpecialServiceRequest = function(opts){
  const el = document.getElementById('special-svc-request-overlay');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => { try{ el.remove(); }catch(_e){} }, opts?.fast ? 0 : TIMING.MODAL_CLOSE);
};

function _openSpecialServiceResult(order, p){
  const esc = eh;
  const number = String(order?.id || '—');
  document.getElementById('special-svc-result-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'special-svc-result-overlay';
  el.className = 'spec-svc-result-overlay';
  el.onclick = e => { if(e.target === el) window.closeSpecialServiceResult(); };
  el.innerHTML = '<div class="spec-svc-result-modal" role="dialog" aria-modal="true" aria-label="Заявка создана" style="--ssc:'+esc(p?.cfg?.color || '#ff6b00')+'">'
    + '<button type="button" class="spec-svc-close spec-svc-result-close" onclick="window.closeSpecialServiceResult()" aria-label="Закрыть">✕</button>'
    + '<div class="spec-svc-result-icon">✅</div>'
    + '<div class="spec-svc-result-title">Заявка создана</div>'
    + '<div class="spec-svc-result-number">№ '+esc(number)+'</div>'
    + '<div class="spec-svc-result-sub">'+esc(p?.selected?.label || p?.cfg?.formTitle || 'Специальный сценарий')+'</div>'
    + '<div class="spec-svc-result-actions">'
      + '<button type="button" class="btn btn-primary" onclick="window.openSpecialCreatedOrder(&quot;'+esc(number)+'&quot;)">Открыть заявку</button>'
      + '<button type="button" class="btn btn-outline" onclick="window.closeSpecialServiceResult(); window.App?.go&amp;&amp;App.go(&quot;myorders&quot;)">Мои заявки</button>'
    + '</div>'
  + '</div>';
  document.body.appendChild(el);
  try{ document.body.style.overflow = 'hidden'; }catch(_e){}
  requestAnimationFrame(() => { el.style.opacity = '1'; el.querySelector('.spec-svc-result-modal').style.transform = 'translateY(0)'; });
}

window.closeSpecialServiceResult = function(){
  const el = document.getElementById('special-svc-result-overlay');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => { try{ el.remove(); }catch(_e){} try{ if(!document.getElementById('special-svc-overlay') && !document.getElementById('special-svc-request-overlay')) document.body.style.overflow = ''; }catch(_e){} }, TIMING.MODAL_CLOSE);
};

window.openSpecialCreatedOrder = function(orderId){
  window.closeSpecialServiceResult();
  if (window.App?.go) window.App.go('myorders');
  if (orderId && orderId !== '—' && window.OrderSystem?.Detail) setTimeout(()=>{ try{ window.OrderSystem.Detail.open(orderId); }catch(_e){} }, 180);
};

window.forwardSpecialToBooking = function(){
  const p = _collectSpecialPayload();
  const notes = [
    'Спецсценарий: ' + (p.cfg.title || ''),
    'Вариант: ' + (p.selected.label || ''),
    p.location ? 'Адрес/точка: ' + p.location : '',
    p.target ? 'Уточнение: ' + p.target : '',
    p.note ? 'Комментарий: ' + p.note : '',
  ].filter(Boolean).join('\n');
  window._pendingSpecialService = { action:p.action, label:p.selected.label || '', type:p.type, notes };
  window.closeSpecialService();
  if (window.App?.startServiceBooking) window.App.startServiceBooking({ comment: notes, car: p.car || '', specialAction: p.action, specialLabel: p.selected.label || '' });
  else window.App?.go?.('booking');
};

window.submitSpecialServiceRequest = async function(btn){
  const p = _collectSpecialPayload();
  const user = p.account?.user || window.App?.getState?.()?.user || window._appState?.user || null;
  if (!user) {
    window._pendingSpecialService = { action:p.action, label:p.selected.label || '', type:p.type };
    window._showToast?.('Для отправки заявки войдите по телефону', 'error');
    window.App?.showAuth?.();
    return;
  }
  if (!p.name) { window._showToast?.('В карточке аккаунта не указано имя', 'error'); return; }
  if (!p.phone || String(p.phone).replace(/\D/g,'').length < 10) { window._showToast?.('В карточке аккаунта не указан корректный телефон', 'error'); return; }
  if (!p.car) { window._showToast?.('Укажите автомобиль в карточке аккаунта', 'error'); try{ location.hash = '#cabinet:car'; }catch(_e){} return; }
  if (p.locationRequired && !p.location) { window._showToast?.('Укажите адрес или точку выезда', 'error'); document.getElementById('ssvc-location')?.focus(); return; }
  const serviceId = _specialFallbackServiceId();
  if (!serviceId) { window._showToast?.('Список услуг ещё не загружен. Повторите через пару секунд.', 'error'); return; }
  const title = String((p.cfg.title || 'Спецзаявка') + (p.selected.label ? ' — ' + p.selected.label : '')).replace(/^[^А-ЯA-Z0-9]+/i,'').trim() || 'Спецзаявка';
  const notes = [
    'Источник: spec-svc-panel',
    'Тип: ' + (p.type || 'special'),
    'Сценарий: ' + (p.cfg.title || ''),
    'Вариант: ' + (p.selected.label || ''),
    p.formMeta?.visitMode ? 'Формат: ' + _specialVisitModeLabel(p.visitMode) : '',
    p.location ? (p.formMeta?.locationLabel || 'Адрес/точка') + ': ' + p.location : '',
    p.target ? (p.formMeta?.targetLabel || 'Уточнение') + ': ' + p.target : '',
    p.note ? 'Комментарий: ' + p.note : '',
  ].filter(Boolean).join('\n');
  if (btn) { btn.disabled = true; btn.dataset.oldText = btn.textContent; btn.textContent = '⏳ Создаём заявку...'; }
  try {
    const order = await window.DB.Orders.create({
      type:'service_order',
      priority: p.cfg.priority || 'urgent',
      serviceIds:[serviceId],
      serviceNames:title,
      clientName:p.name,
      clientPhone:p.phone,
      clientCar:p.car || '',
      vehicleTitle:p.car || '',
      clientVehicleId:p.vehicleId || '',
      vehicleId:p.vehicleId || '',
      masterId:'0',
      date:_todayIso(),
      timeMode:'nearest',
      time:'',
      notes,
      specTag:p.action || p.type || 'special',
      specialType:p.type || '',
      visitMode:p.visitMode || '',
      source:'special_svc_panel'
    });
    window.closeSpecialServiceRequest({fast:true});
    window.closeSpecialService({keepResult:true});
    _openSpecialServiceResult(order, p);
    window._showToast?.('✅ Заявка ' + (order?.id || '') + ' создана');
  } catch(e) {
    console.error('[special-service-submit]', e);
    window._showToast?.((e && e.message) || 'Не удалось создать заявку', 'error');
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.oldText || '🚀 Создать срочную заявку'; }
  }
};

window.openSpecialService = function(type, opts) {
  const esc = eh;
  const options = (opts && typeof opts === 'object') ? opts : {};
  const configs = _specialServiceConfigs();
  const cfg = configs[type] || configs[String(type||'').trim()] || null;
  if (!cfg) return;
  const requestedAction = String(options.action || '').trim();
  const selected = (cfg.items || []).find(x => String(x.action||'') === requestedAction) || (cfg.items || [])[0] || null;
  window._specialServiceCurrent = { type, cfg, selected, cat: options.cat || type, from: options.from || '' };

  document.getElementById('special-svc-overlay')?.remove();
  document.getElementById('special-svc-request-overlay')?.remove();
  document.getElementById('special-svc-result-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'special-svc-overlay';
  el.className = 'spec-svc-overlay';
  el.onclick = e => { if(e.target===el) window.closeSpecialService(); };

  el.innerHTML = '<div class="spec-svc-panel" style="--ssc:'+esc(cfg.color)+'">'
    + '<div class="spec-svc-head">'
      + '<div class="spec-svc-headcopy">'
        + '<div class="spec-svc-kicker">'+esc(cfg.kicker || 'Специальный сценарий')+'</div>'
        + '<div class="spec-svc-title">'+esc(cfg.title)+'</div>'
        + '<div class="spec-svc-desc">'+esc(cfg.desc)+'</div>'
      + '</div>'
      + '<button type="button" class="spec-svc-close" onclick="window.closeSpecialService()" aria-label="Закрыть сценарий">✕</button>'
    + '</div>'
    + '<div class="spec-svc-items" aria-label="Выбор сценария">'
      + (cfg.items || []).map((item, idx) =>
          '<button type="button" class="spec-svc-item '+(idx===0?'active':'')+'" data-special-action="'+esc(item.action)+'" onclick="window.openSpecialServiceRequest(&quot;'+esc(item.action)+'&quot;)">'
            + '<span class="spec-svc-ico">'+item.ico+'</span>'
            + '<span class="spec-svc-body">'
              + '<span class="spec-svc-label">'+esc(item.label)+'</span>'
              + '<span class="spec-svc-sub">'+esc(item.sub)+'</span>'
            + '</span>'
            + '<span class="spec-svc-price">'+esc(item.price)+'</span>'
          + '</button>'
        ).join('')
    + '</div>'
    + '</div>';

  document.body.appendChild(el);
  try{ window.App?.LayerManager?.open?.('special-service'); }catch(_e){}
  requestAnimationFrame(() => { el.style.opacity='1'; el.querySelector('.spec-svc-panel')?.classList.add('open'); });
  try {
    const th = '#special:' + encodeURIComponent(String(type||''));
    if (location.hash !== th) history.pushState({specialModal:true, type}, '', th);
  } catch(_e) {}
  if (requestedAction) setTimeout(()=>{ try{ window.openSpecialServiceRequest(requestedAction); }catch(_e){} }, 80);
}

window.closeSpecialService = function(opts) {
  window.closeSpecialServiceRequest?.({fast:true});
  if (!opts?.keepResult) window.closeSpecialServiceResult?.();
  const el = document.getElementById('special-svc-overlay');
  if (!el) { try{ window.App?.LayerManager?.close?.('special-service'); }catch(_e){} return; }
  el.style.opacity = '0';
  try{ window.App?.LayerManager?.close?.('special-service'); }catch(_e){}
  setTimeout(() => el.remove(), TIMING.MODAL_CLOSE);
}

window._bookSpecialAction = function(action, label) {
  window._pendingSpecialService = { action, label };
  window._showToast?.('Выбрано: ' + label + ' — заполните заявку');
  if (window.App?.startServiceBooking) window.App.startServiceBooking({ comment: 'Спецсценарий: '+(label||action||'') });
  else App.go('booking');
}

window._homeQuickBook = function(category, label) {
  window._pendingQuickCategory = category;
  window._showToast?.('Выбрано: ' + label);
  App.go('services');
}

/* ── Master Modals & Profile ── */
window.masterOpenWorkbench = function(orderId) {
  if (!orderId) return;
  const _actorRole = String(window._appState?.user?.role || 'master');
    if (!window.requireAuth?.('open_order', {role:_actorRole === 'sto' ? 'sto' : 'master', orderId})) return;
  const o = window.DB?.Orders?.get?.(orderId);
  if (!o) return showToast('Заявка не найдена', 'error');
  try { history.pushState({masterModal:'workbench',orderId}, '', '#master:order:'+orderId+':workbench'); } catch(_e) {}
  const esc = eh;

  const PIPELINE = [
    { id:'accepted',  icon:'📝', label:'Заявка принята' },
    { id:'diagnosed', icon:'⌕', label:'Диагностика' },
    { id:'parts',     icon:'▣', label:'Запчасти' },
    { id:'started',   icon:'⌁', label:'Ремонт' },
    { id:'quality',   icon:'🔬', label:'Контроль качества' },
    { id:'done',      icon:'✅', label:'Завершено' },
    { id:'delivered', icon:'▱', label:'Авто выдано' },
  ];
  const doneIds = new Set((o.stages||[]).map(s => s.id));
  const currentStage = PIPELINE.slice().reverse().find(s => doneIds.has(s.id)) || null;
  const nextStage = PIPELINE.find(s => !doneIds.has(s.id));
  const progress = Math.round((doneIds.size / PIPELINE.length) * 100);

  // Прогресс-бар
  const stagesCompact = PIPELINE.map(s => {
    const done = doneIds.has(s.id);
    const active = nextStage && s.id === nextStage.id;
    return `<div title="${esc(s.label)}" style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${done?'14':'10'}px;
      background:${done?'rgba(34,197,94,.2)':active?'rgba(255,107,0,.15)':'var(--surface)'};
      border:2px solid ${done?'rgba(34,197,94,.5)':active?'var(--orange)':'var(--line)'};
      flex-shrink:0">
      ${done ? s.icon : active ? '→' : '·'}
    </div>`;
  }).join('<div style="flex:1;height:2px;background:var(--line);margin:auto 2px;min-width:4px"></div>');

  // Авто
  const vehicleId = o.clientVehicleId || '';
  const vehicle = vehicleId ? (window.DB?.Vehicles?.get?.(vehicleId) || null) : null;
  const car = esc(vehicle
    ? [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || vehicle.title || o.clientCar
    : (o.clientCar || o.vehicleTitle || '—'));
  const plate = vehicle?.plate ? `<div class="t-meta">🔢 ${esc(vehicle.plate)}</div>` : '';
  const vin = vehicle?.vin ? `<div class="t-meta">VIN: ${esc(vehicle.vin)}</div>` : '';
  const knownIssues = vehicle?.knownIssues ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;padding:8px 10px;background:rgba(239,68,68,.07);border-radius:var(--ui-radius-sm,5px);border-left:3px solid #ef4444">! ${esc(vehicle.knownIssues)}</div>` : '';

  // Текущий этап с комментарием
  const curSd = currentStage ? (o.stages||[]).find(s => s.id === currentStage.id) : null;
  const curComment = curSd?.comment ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;padding:8px 10px;background:var(--bg2);border-radius:var(--ui-radius-sm,5px);border-left:3px solid rgba(34,197,94,.4)">${esc(curSd.comment)}</div>` : '';

  let ov = document.getElementById('master-workbench-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'master-workbench-modal'; ov.className = 'cmodal-overlay'; document.body.appendChild(ov); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){} }
  ov.classList.add('open'); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  ov.innerHTML = `
    <div class="cmodal-card" style="max-width:560px;width:min(94vw,560px);max-height:90vh;overflow-y:auto;border-radius:var(--ui-radius-lg,18px)">
      <div class="cmodal-head" data-modal-order-id="${esc(orderId)}">
        <h3>▣ Рабочее место · ${esc(o.id)}</h3>
        <button class="cmodal-close" onclick="window._closeMasterModal('master-workbench-modal')">✕</button>
      </div>
      <div class="cmodal-body" style="display:flex;flex-direction:column;gap:16px">

        <!-- Прогресс -->
        <div>
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:8px">${stagesCompact}</div>
          <div class="t-meta">Выполнено ${doneIds.size} из ${PIPELINE.length} этапов · ${progress}%</div>
        </div>

        <!-- Авто -->
        <div style="padding:14px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">▱ Автомобиль</div>
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">${car}</div>
          ${plate}${vin}${knownIssues}
        </div>

        <!-- Задача -->
        <div style="padding:14px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">⌁ Задача</div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${esc(o.serviceNames || o.notes || 'Не указано')}</div>
          ${o.notes && o.serviceNames ? `<div style="font-size:12px;color:var(--text3);margin-top:6px">${esc(o.notes)}</div>` : ''}
        </div>

        <!-- Текущий этап -->
        <div style="padding:14px;background:${currentStage ? 'rgba(34,197,94,.07)' : 'rgba(255,107,0,.07)'};border-radius:var(--ui-radius-md,10px);border:1px solid ${currentStage ? 'rgba(34,197,94,.25)' : 'rgba(255,107,0,.25)'}">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">⌖ Текущий этап</div>
          <div style="font-size:14px;font-weight:700;color:${currentStage ? '#22c55e' : 'var(--orange)'}">
            ${currentStage ? `${currentStage.icon} ${esc(currentStage.label)}` : '— Ещё не начат'}
          </div>
          ${curComment}
          ${nextStage ? `<div style="font-size:12px;color:var(--text3);margin-top:6px">Следующий: ${nextStage.icon} ${esc(nextStage.label)}</div>` : '<div style="font-size:12px;color:#22c55e;margin-top:6px">✅ Все этапы выполнены</div>'}
        </div>

        <div class="flex-wrap-8">
          ${nextStage ? `<button class="btn btn-primary" style="flex:1" onclick="window._closeMasterModal('master-workbench-modal');masterOpenStageModal('${esc(orderId)}')">📌 Следующий этап</button>` : ''}
          <button class="btn btn-outline" onclick="window._closeMasterModal('master-workbench-modal')">Закрыть</button>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) window._closeMasterModal('master-workbench-modal'); };
};

window.masterOpenOrderCard = function(orderId) {
  if (!orderId) return;
  const _actorRole = String(window._appState?.user?.role || 'master');
    if (!window.requireAuth?.('open_order', {role:_actorRole === 'sto' ? 'sto' : 'master', orderId})) return;
  const o = window.DB?.Orders?.get?.(orderId);
  if (!o) return showToast('Заявка не найдена', 'error');
  // Проверяем что мастер имеет право видеть полную карточку
  const _myMasterId = window.DB?.Masters?.myId?.() || '';
  const _isMine = _myMasterId && String(o.masterId||'') === String(_myMasterId);
  const _isAdmin = ['admin','owner'].includes(window._appState?.user?.role || '');
  const _isStoOrder = String(window._appState?.user?.role || '') === 'sto' && String(o.stoId || o.sto_id || '') !== '';
  if (!_isMine && !_isAdmin && !_isStoOrder) {
    return showToast('Карточка доступна после принятия заявки', 'warn');
  }
  try { history.pushState({masterModal:'card',orderId}, '', '#master:order:'+orderId+':card'); } catch(_e) {}
  const esc = eh;
  const fmt = d => d ? new Date(d).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';

  const PIPELINE = [
    { id:'accepted',icon:'📝',label:'Заявка принята' },{ id:'diagnosed',icon:'⌕',label:'Диагностика' },
    { id:'parts',icon:'▣',label:'Запчасти' },{ id:'started',icon:'⌁',label:'Ремонт' },
    { id:'quality',icon:'🔬',label:'Контроль качества' },{ id:'done',icon:'✅',label:'Завершено' },
    { id:'delivered',icon:'▱',label:'Авто выдано' },
  ];

  const timelineHtml = PIPELINE.map((s, i) => {
    const sd = (o.stages||[]).find(x => x.id === s.id);
    const done = !!sd;
    const photos = sd?.photos || [];
    const photoRow = photos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${photos.map(p=>`<div style="width:52px;height:52px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line);cursor:pointer" onclick="_openPhotoViewer('${esc(p.url||p.data||'')}')"><img src="${esc(p.url||p.data||'')}" style="width:100%;height:100%;object-fit:cover"></div>`).join('')}</div>` : '';
    return `<div style="display:flex;gap:10px;padding:8px 0;${i<PIPELINE.length-1?'border-bottom:1px dashed var(--line)':''}">
      <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${done?'13':'9'}px;
        background:${done?'rgba(34,197,94,.15)':'var(--surface)'};border:2px solid ${done?'rgba(34,197,94,.4)':'var(--line)'};color:${done?'#22c55e':'var(--text3)'};margin-top:2px">
        ${done ? s.icon : '·'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:${done?'700':'400'};color:${done?'var(--text)':'var(--text3)'}">
          ${esc(s.label)}
          ${sd?.doneAt ? `<span style="font-size:10px;font-weight:400;color:var(--text3);margin-left:8px">${fmt(sd.doneAt)}</span>` : ''}
        </div>
        ${sd?.comment ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;padding:5px 9px;background:var(--bg2);border-radius:var(--ui-radius-sm,5px);border-left:2px solid rgba(34,197,94,.4)">${esc(sd.comment)}</div>` : ''}
        ${photoRow}
      </div>
      ${done ? '<div style="color:#22c55e;font-size:13px;padding-top:4px;flex-shrink:0">✓</div>' : ''}
    </div>`;
  }).join('');

  const chat = window.DB?.Chats?.getByOrder?.(orderId);
  const sc = {new:'#60a5fa',process:'var(--orange)',done:'#22c55e',cancelled:'#94a3b8'}[o.status] || 'var(--text3)';

  let ov = document.getElementById('master-ordercard-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'master-ordercard-modal'; ov.className = 'cmodal-overlay'; document.body.appendChild(ov); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){} }
  ov.classList.add('open'); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  ov.innerHTML = `
    <div class="cmodal-card" style="max-width:580px;width:min(94vw,580px);max-height:90vh;overflow-y:auto;border-radius:var(--ui-radius-lg,18px)">
      <div class="cmodal-head" data-modal-order-id="${esc(orderId)}">
        <h3>▤ ${esc(o.id)} <span style="font-size:12px;padding:3px 8px;border-radius:99px;background:${sc}22;color:${sc};border:1px solid ${sc}44;font-weight:600;margin-left:8px">${esc({new:'Новая',process:'В работе',done:'Выполнена',cancelled:'Отменена'}[o.status]||o.status)}</span></h3>
        <button class="cmodal-close" onclick="window._closeMasterModal('master-ordercard-modal')">✕</button>
      </div>
      <div class="cmodal-body" style="display:flex;flex-direction:column;gap:14px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px)">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Клиент</div>
            <div style="font-weight:700;font-size:13px">${esc(o.clientName||'—')}</div>
            ${o.clientPhone ? `<div style="font-size:12px;color:var(--text3);margin-top:3px"><a href="tel:${esc(o.clientPhone)}" style="color:var(--orange)">${esc(o.clientPhone)}</a></div>` : ''}
          </div>
          <div style="padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px)">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Дата · Сумма</div>
            <div style="font-size:13px;font-weight:600">${esc(o.date||'—')}${o.time?' · '+esc(o.time):''}</div>
            <div style="font-size:13px;color:var(--orange);font-family:'Oswald',sans-serif">${(Number(o.price)||0).toLocaleString('ru')} ₸</div>
          </div>
        </div>

        <div style="padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Услуги · Авто</div>
          <div style="font-size:13px;font-weight:600">${esc(o.serviceNames||o.notes||'—')}</div>
${(()=>{if(!Array.isArray(o.serviceIds))return '';var _ids=o.serviceIds.filter(function(id){return id&&id!=='general';});if(!_ids.length)return '';var _btns=_ids.map(function(id){var s=window.DB&&window.DB.Services?window.DB.Services.get&&window.DB.Services.get(id):null;return s?'<button class="msng-svc-chip" data-svc-id="'+id+'" onclick="openServiceDetailsModal(this.dataset.svcId)">'+( s.icon||'⌁')+' '+esc(s.name)+'</button>':''}).join('');return _btns?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">'+_btns+'</div>':'';})()}
          <div style="font-size:12px;color:var(--text3);margin-top:3px">▱ ${esc(o.clientCar||'—')}</div>
        </div>

        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">История этапов</div>
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);padding:4px 14px">
            ${timelineHtml}
          </div>
        </div>

        <div class="flex-wrap-8">
          ${chat
            ? `<button class="btn btn-primary" style="flex:2" onclick="window._closeMasterModal('master-ordercard-modal');Messenger.openByOrder('${esc(orderId)}')">◌ Обсудить заявку</button>`
            : ['process','done_pending_client'].includes(o.status)
              ? `<button class="btn btn-outline" style="flex:2" onclick="Messenger.openByOrder('${esc(orderId)}');window._closeMasterModal('master-ordercard-modal')">◌ Написать клиенту</button>`
              : ''}
          ${o.status==='process'?`<button class="btn btn-outline" onclick="window._closeMasterModal('master-ordercard-modal');masterSaveStageModal('${esc(orderId)}',null,null,null)">◇ Этап</button>`:''}
          <button class="btn btn-ghost" onclick="window._closeMasterModal('master-ordercard-modal')">Закрыть</button>
        </div>
        <!-- СТАРЫЕ КНОПКИ УДАЛЕНЫ — заменены выше -->
        <div style="display:none">
          ${chat ? `<button class="btn btn-primary" style="flex:1" onclick="window._closeMasterModal('master-ordercard-modal');Messenger.openByOrder('${esc(orderId)}')">◌ Открыть чат</button>` : ''}
          <button class="btn btn-outline" onclick="window._closeMasterModal('master-ordercard-modal')">Закрыть</button>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) window._closeMasterModal("master-ordercard-modal"); };
};

window.masterOpenReportsModal = function(orderId) {
    if (!orderId) return;
  const o = window.DB?.Orders?.get?.(orderId);
  if (!o) return showToast('Заявка не найдена', 'error');
  try { history.pushState({masterModal:'reports',orderId}, '', '#master:order:'+orderId+':reports'); } catch(_e) {}
  const esc = eh;
  const reports = Array.isArray(o.reports) ? o.reports : [];

  const reportsList = reports.length ? reports.slice().reverse().map(r => {
    const ts = r.createdAt ? new Date(r.createdAt).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    const photos = r.photos || [];
    const photoRow = photos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${photos.map(p=>`<div style="width:64px;height:64px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line);cursor:pointer" onclick="_openPhotoViewer('${esc(p.url||p.data||'')}')"><img src="${esc(p.url||p.data||'')}" style="width:100%;height:100%;object-fit:cover"></div>`).join('')}</div>` : '';
    return `<div style="padding:12px 14px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line);margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="font-size:12px;font-weight:700;color:var(--text)">${esc(r.masterName||'Мастер')}</div>
        <div class="t-meta">${ts}</div>
      </div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${esc(r.text||r.body||'')}</div>
      ${photoRow}
    </div>`;
  }).join('') : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px dashed var(--line)">Отчётов пока нет. Добавьте первый.</div>`;

  let ov = document.getElementById('master-reports-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'master-reports-modal'; ov.className = 'cmodal-overlay'; document.body.appendChild(ov); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){} }
  ov.classList.add('open'); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  ov.innerHTML = `
    <div class="cmodal-card" style="max-width:600px;width:min(94vw,600px);max-height:90vh;overflow-y:auto;border-radius:var(--ui-radius-lg,18px)">
      <div class="cmodal-head" data-modal-order-id="${esc(orderId)}">
        <h3>📝 Отчёты · ${esc(o.id)} <span style="font-size:12px;color:var(--text3);font-weight:400">${reports.length} шт.</span></h3>
        <button class="cmodal-close" onclick="window._closeMasterModal('master-reports-modal')">✕</button>
      </div>
      <div class="cmodal-body" style="display:flex;flex-direction:column;gap:14px">

        ${reportsList}

        <!-- Форма нового отчёта -->
        <div style="padding:14px;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);background:rgba(255,107,0,.04)">
          <div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:10px">+ Добавить отчёт</div>
          <div class="pf-group">
            <label class="pf-label">Текст отчёта <span style="color:#ef4444;font-size:11px">* обязателен</span></label>
            <textarea class="pf-input" id="mreport-text" rows="4" placeholder="Что сделано, что выявлено, что нужно ещё..."></textarea>
          </div>
          <div class="pf-group" style="margin-top:10px">
            <label class="pf-label">Фото <span style="font-size:11px;color:var(--text3);font-weight:400">— по желанию</span></label>
            <input class="pf-input" id="mreport-files" type="file" accept="image/*" multiple onchange="masterRenderReportFiles(this.files)">
            <div id="mreport-files-preview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn btn-primary" id="mreport-save-btn" onclick="masterSaveReportModal('${esc(orderId)}')">💾 Сохранить отчёт</button>
          </div>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) window._closeMasterModal("master-reports-modal"); };
  setTimeout(() => document.getElementById('mreport-text')?.focus(), 80);
};

window.masterRenderReportFiles = function(files) {
  const wrap = document.getElementById('mreport-files-preview'); if (!wrap) return; wrap.innerHTML = '';
  Array.from(files||[]).slice(0, 8).forEach(f => {
    if (!String(f.type||'').startsWith('image/')) return;
    const card = document.createElement('div');
    card.style.cssText = 'width:64px;height:64px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line)';
    card.innerHTML = `<img src="${URL.createObjectURL(f)}" style="width:100%;height:100%;object-fit:cover">`;
    wrap.appendChild(card);
  });
};

window.masterSaveReportModal = async function(orderId) {
  const text = document.getElementById('mreport-text')?.value?.trim();
  if (!text) { document.getElementById('mreport-text')?.focus(); return showToast('Напишите текст отчёта', 'error'); }
  const btn = document.getElementById('mreport-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем...'; }

  const photos = [];
  for (const file of Array.from(document.getElementById('mreport-files')?.files||[]).slice(0, 8)) {
    if (!String(file.type||'').startsWith('image/')) continue;
    try {
      const data = await (window._compressImage ? window._compressImage(file) : new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('')); fr.readAsDataURL(file); }));
      if (data) photos.push({ url: data, name: file.name.replace(/\.\w+$/, '.jpg'), type: 'image/jpeg' });
    } catch(_e) {}
  }

  const u = window._appState?.user;
  const m = window.DB?.Masters?.getByPhone?.(u?.phone||'') || window.DB?.Masters?.getAll?.(true)?.find(x => x.userId===u?.id||x.user_id===u?.id);
  try {
    await window.DB?.Orders?.addReport?.(orderId, {
      text, photos, files: [],
      masterName: m?.name || u?.name || 'Мастер',
      masterId: m?.id || null,
      createdAt: new Date().toISOString(),
    });
    showToast('📝 Отчёт добавлен');
    window._closeMasterModal('master-reports-modal');
    try { window.OrderSystem?.Detail?.render?.(); } catch(_e) {}
    if (location.hash.startsWith('#master')) navMaster('work');
  } catch(e) {
    showToast(e?.message || 'Не удалось сохранить отчёт', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить отчёт'; }
  }
};

window.masterOpenReportModal = function(orderId) {
  masterOpenReportsModal(orderId);
};

window.masterOpenResumeEditor = function(masterId) {
  const el = document.getElementById('master-resume-editor');
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

window.masterSaveResume = async function(masterId) {
  const fields = ['bio','experience','spec','businessType','orgName','address','city','education','courses','awards','skills','languages'];
  const resume = {};
  fields.forEach(k => {
    const el = document.getElementById('mre-'+k);
    if (el) resume[k] = el.value?.trim() || '';
  });
  const btn = document.querySelector('#master-resume-editor .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем...'; }
  try {
    const master = window.DB?.Masters?.get?.(masterId) || window.DB?.Masters?.getMine?.();
    if (!master) throw new Error('Мастер не найден');
    await DB.Masters.save(Object.assign({}, master, { resume }));
    showToast('✅ Анкета сохранена');
    document.getElementById('master-resume-editor').style.display = 'none';
    if (window._karetaPage === 'master') navMaster('cabinet');
  } catch(e) {
    showToast(e?.message || 'Ошибка сохранения', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить анкету'; }
  }
};

window.masterSaveFullProfile = async function(masterId) {
  const btn = document.querySelector('[onclick*="masterSaveFullProfile"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем...'; }
  try {
    const pfKeys = ['offerText','workMode','district','primaryServices','startingPrice','responseTimeLabel','guarantee','minCheck','paymentMethods'];
    const profileData = {};
    pfKeys.forEach(k => {
      const el = document.getElementById('mpf-'+k+'-'+masterId);
      if (el) profileData[k] = el.value?.trim() || '';
    });
    const resumeKeys = ['bio','experience','spec','city','address','education','courses','skills','awards'];
    const resumeData = {};
    resumeKeys.forEach(k => {
      const el = document.getElementById('mpr-'+k+'-'+masterId);
      if (el) resumeData[k] = el.value?.trim() || '';
    });
    const visibleEl = document.getElementById('profile-visible-'+masterId);
    const primaryServices = (profileData.primaryServices||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
    const payload = {
      offerText:      profileData.offerText,
      workMode:       profileData.workMode,
      district:       profileData.district,
      primaryServices,
      profileVisible: visibleEl ? visibleEl.checked : true,
      availability:   document.querySelector(`[data-avail].avail-btn--active`)?.dataset?.avail || 'online',
      resume: Object.assign({}, resumeData, {
        startingPrice:     profileData.startingPrice,
        responseTimeLabel: profileData.responseTimeLabel,
        guarantee:         profileData.guarantee,
        minCheck:          profileData.minCheck,
        paymentMethods:    profileData.paymentMethods,
        workMode:          profileData.workMode,
        district:          profileData.district,
        offer:             profileData.offerText,
      }),
    };
    if (window.DB?._dbOk) {
      const r = await window.DB._api?.('master.saveProfile', payload) || await fetch('/api/db.php', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({action:'master.saveProfile', ...payload})
      }).then(r=>r.json());
      if (r && !r.ok) throw new Error(r.message || r.error || 'save_failed');
    }
    // Обновляем локальный объект
    const master = window.DB?.Masters?.get?.(masterId) || window.DB?.Masters?.getMine?.();
    if (master) {
      Object.assign(master, {
        offer_text: payload.offerText, offer: payload.offerText,
        work_mode: payload.workMode, workMode: payload.workMode,
        district: payload.district, primaryServices,
        availability: payload.availability, availabilityStatus: payload.availability,
        profile_visible: payload.profileVisible,
        resume: Object.assign({}, master.resume || {}, payload.resume),
      });
    }
    window._showToast?.('✅ Профиль сохранён');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить профиль'; }
  } catch(e) {
    window._showToast?.(e?.message || 'Ошибка сохранения', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить профиль'; }
  }
};

window.masterSetAvailability = function(masterId, status) {
  document.querySelectorAll('[data-avail]').forEach(b => {
    const active = b.dataset.avail === status;
    b.classList.toggle('avail-btn--active', active);
    b.style.borderColor = active ? 'var(--orange)' : 'var(--line)';
    b.style.background  = active ? 'rgba(255,107,0,.1)' : 'var(--bg)';
  });
  const master = window.DB?.Masters?.get?.(masterId) || window.DB?.Masters?.getMine?.();
  if (master) { master.availability = status; master.availabilityStatus = status; }
  if (window.DB?._dbOk) {
    fetch('/api/db.php', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'master.saveProfile', availability: status})
    }).then(r=>r.json()).then(j=>{ if(!j.ok) window._showToast?.('Ошибка сохранения статуса','error'); })
      .catch(()=>{ window._showToast?.('Нет связи — статус не сохранён','warn'); });
  }
  window._showToast?.('Статус обновлён', 'success');
};

window.masterToggleVisibility = function(masterId, visible) {
  const master = window.DB?.Masters?.get?.(masterId) || window.DB?.Masters?.getMine?.();
  if (master) { master.profile_visible = visible; master.profileVisible = visible; }
};

window.masterFilterPosts = function(btn, masterId, status) {
  const container = document.getElementById('posts-list-'+masterId);
  if (!container) return;
  container.querySelectorAll('.posts-mgr-card').forEach(card => {
    const s = card.dataset.postStatus || '';
    card.style.display = (status === 'all' || s === status) ? '' : 'none';
  });
  btn.closest('div')?.querySelectorAll('[data-posts-filter]').forEach(b => {
    const active = b.dataset.postsFilter === status;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-outline', !active);
  });
};

window.masterPublishPost = async function(masterId, postId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    await window.DB?.MasterPosts?.publish?.(postId);
    // Update card badge
    const card = btn?.closest('.posts-mgr-card');
    if (card) {
      card.dataset.postStatus = 'published';
      const statusEl = card.querySelector('[style*="color:"]');
    }
    window._showToast?.('🚀 Опубликовано');
    // Refresh pane
    setTimeout(() => masterSwitchSubtab('cabinet','posts'), 300);
    if (window._karetaPage === 'master') navMaster('cabinet');
  } catch(e) {
    window._showToast?.(e?.message || 'Ошибка публикации', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Опубликовать'; }
  }
};

window.masterArchivePost = async function(masterId, postId, btn) {
  if (!confirm('Переместить публикацию в архив?')) return;
  if (btn) { btn.disabled = true; }
  try {
    await window.DB?.MasterPosts?.archive?.(postId);
    btn?.closest('.posts-mgr-card')?.remove();
    window._showToast?.('📁 Перемещено в архив');
  } catch(e) {
    window._showToast?.(e?.message || 'Ошибка', 'error');
    if (btn) btn.disabled = false;
  }
};

window.masterOpenPostEditor = function(masterId, postId) {
  const esc = eh;
  const post = postId ? (window.DB?.MasterPosts?.get?.(postId) || window.DB?.MasterWall?.get?.(postId)) : null;
  const TYPES = window.DB?.MasterPosts?.TYPES || {case:{label:'Кейс',icon:'⌁'},tip:{label:'Совет',icon:'💡'},warning:{label:'Предупреждение',icon:'!'},breakdown:{label:'Разбор',icon:'⌕'},report:{label:'Фотоотчёт',icon:'📸'},article:{label:'Статья',icon:'📝'}};

  document.getElementById('master-post-editor-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'master-post-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:970;background:rgba(7,17,27,.8);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };

  overlay.innerHTML = `<div style="width:min(720px,100%);max-height:92dvh;background:var(--bg2);border-radius:var(--ui-radius-lg,18px) var(--ui-radius-lg,18px) 0 0;border:1px solid var(--line);border-bottom:none;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:18px 20px 0;flex-shrink:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-family:'Oswald',sans-serif;font-size:18px;font-weight:700">${post?'✎ Редактировать':'+ Новая публикация'}</div>
        <button onclick="document.getElementById('master-post-editor-overlay')?.remove()" style="width:34px;height:34px;border-radius:var(--ui-radius-md,10px);background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:16px;cursor:pointer">✕</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:0 20px 20px">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">📂 Тип публикации</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="post-type-btns">
            ${Object.entries(TYPES).map(([k,t])=>`<button data-type="${esc(k)}"
              style="padding:7px 14px;border-radius:var(--ui-radius-md,10px);font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--line);background:${(post?.type||'case')===k?'var(--orange)':'var(--surface)'};color:${(post?.type||'case')===k?'#07111b':'var(--text2)'}"
              onclick="document.querySelectorAll('#post-type-btns [data-type]').forEach(b=>{b.style.background=b.dataset.type===this.dataset.type?'var(--orange)':'var(--surface)';b.style.color=b.dataset.type===this.dataset.type?'#07111b':'var(--text2)'})">${t.icon||''} ${t.label}</button>`).join('')}
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">📝 Заголовок</label>
          <input class="pf-input" id="pe-title" style="font-size:14px" placeholder="Замена ремня ГРМ на Toyota..." value="${esc(post?.title||'')}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">◌ Краткое описание (превью)</label>
          <input class="pf-input" id="pe-preview" style="font-size:13px" placeholder="Короткое описание для каталога..." value="${esc(post?.preview||'')}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">📄 Текст публикации</label>
          <textarea class="pf-input" id="pe-body" rows="6" placeholder="Подробное описание: что было, что сделал, какой результат..." style="resize:vertical;font-size:13px">${esc(post?.body||post?.text||'')}</textarea>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">🏷 Теги (через запятую)</label>
          <input class="pf-input" id="pe-tags" style="font-size:13px" placeholder="Toyota, ремень ГРМ, двигатель..." value="${esc(post?.tags||'')}">
        </div>
        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="btn btn-outline" style="flex:1;padding:11px" onclick="masterSavePostDraft('${esc(masterId)}','${esc(postId||'')}')">💾 Черновик</button>
          <button class="btn btn-primary" style="flex:2;padding:11px" onclick="masterSavePostPublish('${esc(masterId)}','${esc(postId||'')}')">🚀 Опубликовать</button>
        </div>
      </div>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.style.opacity = '1');
};

window.masterSavePostDraft = async function(masterId, postId) {
  if (!masterId) return;
  try { await _masterSavePostCore(masterId, postId, 'draft'); }
  catch(e) { window._showToast?.(e?.message || 'Ошибка сохранения черновика', 'error'); }
};

window.masterSavePostPublish = async function(masterId, postId) {
  if (!masterId) return;
  try { await _masterSavePostCore(masterId, postId, 'published'); }
  catch(e) { window._showToast?.(e?.message || 'Ошибка публикации', 'error'); }
};

window._masterStatsPaneInit = async function(masterId) {
  const el = document.getElementById('master-profile-metrics-'+masterId);
  if (!el) return;
  try {
    const data = await window.DB?.MasterMetrics?.loadMine?.();
    if (data?.totals) {
      const t = data.totals;
      el.innerHTML = `
        <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;margin-bottom:14px">👁 Метрики профиля (30 дней)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">
          ${[
            [t.profile_views||0,  'Просмотров профиля', '#60a5fa'],
            [t.modal_opens||0,    'Открыто модалок',    '#a78bfa'],
            [t.profile_clicks||0, 'Кликов по кнопкам',  'var(--orange)'],
            [t.wa_clicks||0,      'Переходов в WA',     '#22c55e'],
            [t.order_proposals||0,'Предложено заказов', '#f59e0b'],
          ].map(([v,l,c])=>`<div style="padding:12px;background:var(--bg);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);text-align:center">
            <div style="font-size:22px;font-weight:700;color:${c}">${v}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px">${l}</div>
          </div>`).join('')}
        </div>`;
    } else {
      el.innerHTML = `<div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;margin-bottom:10px">👁 Метрики профиля</div><div style="font-size:13px;color:var(--text3)">Данные накапливаются по мере посещений профиля.</div>`;
    }
  } catch(e) {
    el.innerHTML = `<div style="font-size:13px;color:var(--text3)">Метрики недоступны</div>`;
  }
};

window._masterPostsPaneInit = async function(masterId) {
  try { await window.DB?.MasterPosts?.loadMine?.(); } catch(e) {}
};

window._closeMasterModal = function(modalId) {
  document.getElementById(modalId)?.remove();
  if (location.hash.startsWith('#master:order:')) {
    try { history.back(); } catch(_e) {}
  }
};

/* ── Order Detail, Stage, Parts, Utils ── */
window.openClientOrderModal = function(orderId) {
  // единая точка открытия деталей заявки.
  // Старый client-modal больше не создаётся как отдельная карточка: все вызовы ведут в OrderSystem.Detail.
  const _user = window._appState?.user || window.S?.user;
  if (!_user?.phone) {
    window.requireAuth?.('open_myorders', { role: 'client' });
    return;
  }
  const oid = String(orderId || '').trim();
  if (!oid) return;
  const openUnified = function(){
    try { history.pushState({modal:'OrderSystem.Detail', orderId: oid}, '', '#order:' + encodeURIComponent(oid)); } catch(_e) {}
    try { window.OrderSystem?.Detail?.open?.(oid); } catch(_e) { window._showToast?.('Не удалось открыть заявку', 'error'); }
  };
  let o = window.DB?.Orders?.get?.(oid);
  if (!o) {
    window.DB?.init?.().then(function(){
      const o2 = window.DB?.Orders?.get?.(oid);
      if (o2) openUnified();
      else window._showToast?.('Заявка не найдена — попробуйте обновить страницу', 'error');
    }).catch(function(){ window._showToast?.('Не удалось загрузить заявку', 'error'); });
    return;
  }
  const phone = String(_user.phone || '').replace(/\D/g,'');
  const orderPhone = String(o.clientPhone || o.client_phone || '').replace(/\D/g,'');
  const isPrivileged = ['admin','owner','master','sto'].includes(String(_user.role||''));
  if (!isPrivileged && phone && orderPhone && phone !== orderPhone) {
    window._showToast?.('Это не ваша заявка', 'error');
    return;
  }
  openUnified();
};

window.closeClientOrderModal = function() {
  // совместимый alias закрытия единой карточки заявки.
  try { window.OrderSystem?.Detail?.close?.(); } catch(_e) {}
  document.body.style.overflow = '';
  const legacy = document.getElementById('client-order-modal');
  if (legacy) legacy.remove();
};



function _clientOrderCompletionHtml(o){
  const esc = eh;
  const attr = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const st = String(o?.status || '');
  if (st === 'done_pending_client') {
    const finalPrice = Number(o.finalPrice || o.final_price || o.price || 0);
    const stages = Array.isArray(o.stages) ? o.stages : [];
    const lastStage = stages[stages.length-1] || {};
    return `<div class="client-completion-card client-completion-card--pending">
      <div class="client-completion-ico">✅</div>
      <div class="client-completion-main">
        <div class="client-completion-title">Мастер завершил работу</div>
        <div class="client-completion-text">Проверьте результат, итоговую сумму и подтвердите завершение. Если есть проблема — откройте спор.</div>
        <div class="client-completion-meta">
          <span>Итог: <b>${finalPrice ? finalPrice.toLocaleString('ru') + ' ₸' : 'не указан'}</b></span>
          ${lastStage?.comment ? `<span>Комментарий: ${esc(lastStage.comment)}</span>` : ''}
        </div>
      </div>
      <div class="client-completion-actions">
        <button class="btn btn-primary" onclick="ClientExchange.confirmOrderDone('${attr(o.id)}',this)">✅ Подтвердить</button>
        <button class="btn btn-outline" onclick="ClientExchange.reportProblem('${attr(o.id)}')">! Есть проблема</button>
      </div>
    </div>`;
  }
  if (st === 'done') {
    return `<div class="client-completion-card client-completion-card--done">
      <div class="client-completion-ico">🏁</div>
      <div class="client-completion-main">
        <div class="client-completion-title">Заявка завершена</div>
        <div class="client-completion-text">Можно оставить отзыв или повторить заявку на основе этой услуги.</div>
      </div>
      <div class="client-completion-actions">
        <button class="btn btn-primary" onclick="closeClientOrderModal();openServiceReviewModal('${attr(o.id)}')">☆ Отзыв</button>
        <button class="btn btn-outline" onclick="repeatClientOrder('${attr(o.id)}')">🔁 Повторить</button>
      </div>
    </div>`;
  }
  if (st === 'dispute') {
    return `<div class="client-completion-card client-completion-card--dispute">
      <div class="client-completion-ico">!</div>
      <div class="client-completion-main">
        <div class="client-completion-title">Открыт спор по заявке</div>
        <div class="client-completion-text">Администратор рассмотрит обращение. Все сообщения по спору сохраняются в истории заявки.</div>
      </div>
    </div>`;
  }
  return '';
}

function _clientOrderExtraQuotesHtml(o){
  try {
    if (typeof window._renderExtraQuotesBlock === 'function') return window._renderExtraQuotesBlock(o.id) || '';
  } catch(_e) {}
  return '';
}

function _clientOrderModalResponsesHtml(o){
  const esc = eh;
  const attr = function(v){ return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); };
  let rows = [];
  try { rows = window.DB?.ClientExchangeStore?.responsesForOrder?.(o.id) || []; } catch(_e) { rows = []; }
  const active = rows.filter(r => String(r.response_status||r.status||'pending') !== 'declined');
  const all = active.length ? active : rows;
  if (!all.length) {
    const wait = ['new','waiting_responses'].includes(String(o.status||''));
    return `<div class="client-order-offers client-order-offers--empty">
      <div class="client-order-offers-head"><b>👨‍⌁ Отклики мастеров</b><span>0</span></div>
      <div class="client-order-offers-empty">
        <div class="client-order-offers-empty-ico">👨‍⌁</div>
        <div><b>${wait ? 'Мастера ещё не откликнулись' : 'Откликов по заявке нет'}</b><p>${wait ? 'Мы покажем предложения здесь, как только мастера отправят свои условия.' : 'Информация по предложениям будет доступна в этой карточке заявки.'}</p></div>
      </div>
    </div>`;
  }
  // Находим принятый отклик
  const acceptedRow = all.find(r => String(r.response_status||r.status||'pending') === 'accepted');
  const isProcessStatus = ['process','done_pending_client','done'].includes(String(o.status||''));
  const executorBlock = (acceptedRow && isProcessStatus) ? `
    <div class="client-executor-block">
      <div class="client-executor-av" style="background:${esc(acceptedRow.masterColor||'#34d399')}22;color:${esc(acceptedRow.masterColor||'#34d399')}">${esc(acceptedRow.masterInitials||'М')}</div>
      <div class="client-executor-info">
        <div class="client-executor-label">✅ Исполнитель выбран</div>
        <div class="client-executor-name">${esc(acceptedRow.masterName||'Мастер')}</div>
        <div class="client-executor-spec">${esc(acceptedRow.masterSpec||acceptedRow.work_format||'')}</div>
      </div>
      <button type="button" class="btn btn-primary" onclick="closeClientOrderModal();Messenger.openByOrder('${attr(o.id)}')">◌ Чат</button>
    </div>` : '';

  return `<div class="client-order-offers">
    ${executorBlock}
    <div class="client-order-offers-head"><b>${isProcessStatus && acceptedRow ? 'Все предложения' : '👨‍⌁ Отклики мастеров'}</b><span>${all.length}</span></div>
    <div class="client-order-offers-list">
      ${all.map(r => {
        const st = String(r.response_status||r.status||'pending');
        const accepted = st === 'accepted';
        const declined = st === 'declined';
        const cancelled = st === 'cancelled';
        const statusText = accepted ? 'Принят' : declined ? 'Отклонён' : cancelled ? 'Отменён' : 'Ожидает выбора';
        const initials = esc(r.masterInitials||'М');
        const color = esc(r.masterColor||'#34d399');
        const from = Number(r.price_from||r.priceFrom||0);
        const to = Number(r.price_to||r.priceTo||0);
        const price = from && to && from !== to ? `${from.toLocaleString('ru')}–${to.toLocaleString('ru')} ₸` : from ? `${from.toLocaleString('ru')} ₸` : to ? `${to.toLocaleString('ru')} ₸` : 'Цена в отклике';
        return `<div class="client-order-offer ${accepted?'is-accepted':''} ${declined||cancelled?'is-muted':''}">
          <div class="client-order-offer-av" style="background:${color}22;color:${color}">${initials}</div>
          <div class="client-order-offer-main">
            <div class="client-order-offer-top"><b>${esc(r.masterName||'Мастер')}</b><span>${statusText}</span></div>
            <div class="client-order-offer-meta">${esc(r.masterSpec||r.work_format||'Мастер')} · ${esc(price)}${r.start_time?` · ${esc(r.start_time)}`:''}${r.warranty?` · ${esc(r.warranty)}`:''}</div>
            ${r.comment?`<div class="client-order-offer-comment">${esc(r.comment)}</div>`:''}
          </div>
          <div class="client-order-offer-actions">
            ${accepted ? `<button class="btn btn-primary" onclick="closeClientOrderModal();Messenger.openByOrder('${attr(o.id)}')">◌ Чат</button>` : (!declined && !cancelled && ['new','waiting_responses'].includes(String(o.status||'')) ? `<button class="btn btn-primary" onclick="ClientExchange.acceptResponse('${attr(o.id)}','${attr(r.id)}')">Принять</button><button class="btn btn-outline" onclick="ClientExchange.declineResponse('${attr(o.id)}','${attr(r.id)}')">Отказать</button>` : '')}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}


window._renderClientOrderResponsesForUnifiedDetail = function(order) {
  try { return _clientOrderModalResponsesHtml(order); }
  catch(_e) { return ''; }
};

// legacy _renderClientOrderModal removed. All client-order detail entry points use OrderSystem.Detail via openClientOrderModal().


window.masterOpenStageModal = function(orderId) {
    if (!orderId) return;
    const _actorRole = String(window._appState?.user?.role || 'master');
    if (!window.requireAuth?.('open_order', {role:_actorRole === 'sto' ? 'sto' : 'master', orderId})) return;
    try { history.pushState({masterModal:'stage',orderId}, '', '#master:order:'+orderId+':stage'); } catch(_e) {}
  const order = window.DB?.Orders?.get?.(orderId);
  if (!order) return showToast('Заявка не найдена', 'error');
  if (order.status === 'done') return showToast('Заявка уже завершена', 'error');

  // ── Лимит: не более 3 машин в работе (status='process') ──
  if (String(window._appState?.user?.role || 'master') === 'master' && order.status === 'new') {
    const actor = window._appState?.user;
    const masterId = actor?.masterId || actor?.id;
    const inProcess = (window.DB?.Orders?.getAll?.({})||[]).filter(o =>
      o.status === 'process' && String(o.masterId||'0') !== '0' &&
      window.DB?.Orders?.isAttachedToMaster?.(o, {id: masterId})
    );
    if (inProcess.length >= 3) {
      let ov = document.getElementById('master-limit-modal');
      if (!ov) { ov = document.createElement('div'); ov.id = 'master-limit-modal'; ov.className = 'cmodal-overlay'; document.body.appendChild(ov); }
      ov.classList.add('open');
      ov.innerHTML = `
        <div class="cmodal-card" style="max-width:400px;width:min(92vw,400px);border-radius:var(--ui-radius-lg,18px);text-align:center">
          <div style="font-size:48px;margin-bottom:12px">▱▱▱</div>
          <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;margin-bottom:8px">Максимум 3 машины в работе</div>
          <div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:20px">
            Сейчас у вас <strong>${inProcess.length}</strong> из <strong>3</strong> разрешённых машин в ремонте.<br>
            Завершите одну из текущих машин, чтобы запустить в работу следующую.
          </div>
          <div style="flex-col-8">
            ${inProcess.map(o=>`
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line);text-align:left">
                <div>
                  <div style="font-weight:700;font-size:13px">${escHtml(o.clientName||'Клиент')}</div>
                  <div class="t-meta">▱ ${escHtml(o.clientCar||'—')} · ${escHtml(o.id)}</div>
                </div>
                <button class="btn btn-outline" style="font-size:11px;padding:5px 10px;flex-shrink:0" onclick="document.getElementById('master-limit-modal')?.remove();masterOpenStageModal('${escHtml(o.id)}')">📌 Этапы</button>
              </div>`).join('')}
          </div>
          <button class="btn btn-ghost" style="margin-top:16px;width:100%" onclick="document.getElementById('master-limit-modal')?.remove()">Понятно</button>
        </div>`;
      ov.onclick = e => { if (e.target === ov) ov.remove(); };
      try { history.back(); } catch(_e) {}
      return;
    }
  }

  try { history.pushState({masterModal:'stage',orderId}, '', '#master:order:'+orderId+':stage'); } catch(_e) {}

  const doneIds = new Set((order.stages||[]).map(s => s.id));
  const nextStage = MASTER_PIPELINE.find(s => !doneIds.has(s.id));
  if (!nextStage) return showToast('Все этапы пройдены', 'error');

  const esc = eh;

  // Линейка прогресса
  const timelineHtml = MASTER_PIPELINE.map((s, i) => {
    const done   = doneIds.has(s.id);
    const active = s.id === nextStage.id;
    const sd     = (order.stages||[]).find(x => x.id === s.id);
    const ts     = sd?.doneAt ? new Date(sd.doneAt).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    const commentPrev = sd?.comment ? `<div style="font-size:11px;color:var(--text2);margin-top:3px;line-height:1.4">${esc(sd.comment)}</div>` : '';
    const photoCount = (sd?.photos||[]).length;
    const photoBadge = photoCount ? `<span style="font-size:10px;color:var(--text3);margin-left:6px">📷 ${photoCount}</span>` : '';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;${i<MASTER_PIPELINE.length-1?'border-bottom:1px dashed var(--line)':''}">
      <div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:${done?'14':'11'}px;
        background:${done?'rgba(34,197,94,.15)':active?'rgba(255,107,0,.15)':'var(--surface)'};
        border:2px solid ${done?'rgba(34,197,94,.5)':active?'var(--orange)':'var(--line)'};
        color:${done?'#22c55e':active?'var(--orange)':'var(--text3)'}">
        ${done ? s.icon : active ? '→' : String(i+1)}
      </div>
      <div style="flex:1;min-width:0;padding-top:4px">
        <div style="font-size:13px;font-weight:${done||active?'700':'400'};color:${done?'var(--text)':active?'var(--orange)':'var(--text3)'}">
          ${esc(s.label)}
          ${done ? `<span style="font-size:10px;font-weight:400;color:var(--text3);margin-left:6px">${ts}</span>${photoBadge}` : ''}
          ${active ? '<span style="font-size:10px;background:var(--orange);color:#fff;padding:2px 6px;border-radius:99px;margin-left:6px">следующий</span>' : ''}
        </div>
        ${commentPrev}
      </div>
      ${done ? '<div style="color:#22c55e;font-size:14px;padding-top:4px;flex-shrink:0">✓</div>' : ''}
    </div>`;
  }).join('');

  let ov = document.getElementById('master-stage-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'master-stage-modal'; ov.className = 'cmodal-overlay'; document.body.appendChild(ov); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){} }
  ov.classList.add('open'); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  ov.innerHTML = `
    <div class="cmodal-card" style="max-width:640px;width:min(94vw,640px);max-height:92vh;overflow-y:auto;border-radius:var(--ui-radius-lg,18px)">
      <div class="cmodal-head">
        <h3>${esc(nextStage.icon)} Следующий этап: ${esc(nextStage.label)}</h3>
        <button class="cmodal-close" onclick="closeMasterStageModal()">✕</button>
      </div>
      <div class="cmodal-body" style="display:flex;flex-direction:column;gap:16px">

        <!-- Прогресс -->
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Прогресс по заявке ${esc(order.id)}</div>
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);padding:4px 14px">
            ${timelineHtml}
          </div>
        </div>

        <!-- Форма этапа -->
        <div style="background:rgba(255,107,0,.06);border:1px solid rgba(255,107,0,.2);border-radius:var(--ui-radius-md,10px);padding:16px">
          <div style="font-size:13px;font-weight:700;color:var(--orange);margin-bottom:4px">${esc(nextStage.icon)} ${esc(nextStage.label)}</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:12px">${esc(nextStage.hint)}</div>
          ${Array.isArray(nextStage.steps)&&nextStage.steps.length?`<div class="repair-stage-steps repair-stage-steps--master">${nextStage.steps.map((step,idx)=>`<label><input type="checkbox" class="stage-step-check" value="${esc(step)}"> <span>${idx+1}. ${esc(step)}</span></label>`).join('')}</div>`:''}

          ${nextStage.id === 'accepted' ? `
          <div class="pf-group" style="margin-bottom:12px">
            <label class="pf-label">⏱ Оценка времени ремонта</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div>
                <label class="pf-label" style="font-size:11px;margin-bottom:4px">Часов на работу</label>
                <input class="pf-input" id="stage-estimated-hours" type="number" min="0.5" max="720" step="0.5" placeholder="напр. 4" style="font-size:13px">
              </div>
              <div>
                <label class="pf-label" style="font-size:11px;margin-bottom:4px">Начало работ</label>
                <input class="pf-input" id="stage-scheduled-start" type="date" style="font-size:13px">
              </div>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:6px">💡 Укажите примерное время — клиент увидит когда ждать авто</div>
          </div>` : ''}
          <div class="pf-group">
            <label class="pf-label" style="display:flex;align-items:center;gap:6px">
              Комментарий <span style="color:#ef4444;font-size:11px">* обязателен</span>
            </label>
            <textarea class="pf-input" id="stage-comment" rows="4"
              placeholder="${esc(nextStage.hint)}..." style="resize:vertical"></textarea>
          </div>

          ${nextStage.id === 'parts' ? `
          <div class="pf-group" style="margin-top:12px">
            <label class="pf-label">▱ Запчасти / материалы</label>
            <div id="stage-parts-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px"></div>
            <div style="display:grid;grid-template-columns:1fr 80px 90px auto;gap:6px;align-items:center">
              <input class="pf-input" id="stage-part-name" placeholder="Название детали" style="font-size:13px">
              <input class="pf-input" id="stage-part-qty" type="number" min="1" value="1" placeholder="Кол" style="font-size:13px">
              <input class="pf-input" id="stage-part-price" type="number" min="0" placeholder="Цена ₸" style="font-size:13px">
              <button type="button" class="btn btn-outline" style="padding:8px 12px;white-space:nowrap" onclick="masterAddStagePart()">+ Добавить</button>
            </div>
          </div>` : ''}
          <div class="pf-group" style="margin-top:12px">
            <label class="pf-label" style="display:flex;align-items:center;gap:6px">
              Фото <span style="font-size:11px;color:var(--text3);font-weight:400">— по желанию</span>
            </label>
            <input class="pf-input" id="stage-photos" type="file" accept="image/*" multiple
              onchange="masterRenderStagePhotos(this.files)">
            <div id="stage-photos-preview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="closeMasterStageModal()">Отмена</button>
          <button class="btn btn-primary" id="stage-save-btn"
            onclick="masterSaveStageModal('${esc(orderId)}','${esc(nextStage.id)}','${esc(nextStage.icon)}','${esc(nextStage.label)}')">
            ${esc(nextStage.icon)} Подтвердить этап
          </button>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) closeMasterStageModal(); };
  setTimeout(() => document.getElementById('stage-comment')?.focus(), 80);
};

window.closeMasterStageModal = function() {
  document.getElementById('master-stage-modal')?.remove();
  if (location.hash.includes(':stage')) try { history.back(); } catch(_e) {}
};

window.masterAddStagePart = function() {
  const name  = document.getElementById('stage-part-name')?.value?.trim();
  const qty   = parseInt(document.getElementById('stage-part-qty')?.value || '1', 10) || 1;
  const price = parseInt(document.getElementById('stage-part-price')?.value || '0', 10) || 0;
  if (!name) { document.getElementById('stage-part-name')?.focus(); showToast?.('Укажите название детали', 'error'); return; }
  const list = document.getElementById('stage-parts-list');
  if (!list) return;
  const id = 'part-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.dataset.name  = name;
  div.dataset.qty   = String(qty);
  div.dataset.price = String(price);
  div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);font-size:13px';
  div.innerHTML = `<div style="flex:1"><b>${escHtml?.(name)||name}</b> × ${qty}</div>`
    + `<div style="color:var(--orange);font-family:'Oswald',sans-serif;font-weight:700">${price > 0 ? price.toLocaleString('ru') + ' ₸' : '—'}</div>`
    + `<button type="button" style="color:#ef4444;background:none;border:none;cursor:pointer;font-size:14px;padding:0 4px" onclick="document.getElementById('${id}')?.remove()">✕</button>`;
  list.appendChild(div);
  // Очищаем поля
  const nameEl = document.getElementById('stage-part-name');
  const priceEl = document.getElementById('stage-part-price');
  if (nameEl) nameEl.value = '';
  if (priceEl) priceEl.value = '';
  nameEl?.focus();
};

window.masterGetStageParts = function() {
  const list = document.getElementById('stage-parts-list');
  if (!list) return [];
  return Array.from(list.children).map(el => ({
    name:  el.dataset.name  || '',
    qty:   parseInt(el.dataset.qty   || '1', 10),
    price: parseInt(el.dataset.price || '0', 10),
  })).filter(p => p.name);
};

window.masterRenderStagePhotos = function(files) {
  const wrap = document.getElementById('stage-photos-preview');
  if (!wrap) return;
  wrap.innerHTML = '';
  Array.from(files||[]).slice(0, 8).forEach(f => {
    if (!String(f.type||'').startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    const size = f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+'MB' : Math.round(f.size/1024)+'KB';
    const card = document.createElement('div');
    card.style.cssText = 'position:relative;width:72px;height:72px;border-radius:var(--ui-radius-sm,5px);overflow:hidden;border:1px solid var(--line);flex-shrink:0';
    card.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:9px;text-align:center;padding:2px">${size}</div>`;
    wrap.appendChild(card);
  });
};

window._compressImage = async function(file, maxSide, quality) {
  if (!file || !(file instanceof Blob)) return null;
  maxSide = Math.max(100, Math.min(4000, Number(maxSide) || 1200));
  quality = Math.max(0.5, Math.min(1, Number(quality) || 0.82));
  return new Promise(function(resolve) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxSide || h > maxSide) {
        if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
        else { w = Math.round(w * maxSide / h); h = maxSide; }
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
};

window.masterSaveStageModal = async function(orderId, stageId, stageIcon, stageLabel) {
  // Глобальный guard — не допускаем двойного вызова
  const _guardKey = 'stage:' + orderId + ':' + stageId;
  if (window._stageSaving && window._stageSaving === _guardKey) return;
  // ТЗ 7.2: pending extra_quote блокирует переход к следующему этапу
  try {
    const order = window.DB?.Orders?.get?.(orderId);
    if (order && !['accepted','diagnosed'].includes(stageId)) {
      const pendingQuotes = (order.extraQuotes||order.extra_quotes||[]).filter(q=>q.status==='pending');
      if (pendingQuotes.length > 0) {
        window._showToast?.('Клиент ещё не принял допработу. Подождите решения клиента перед переходом к следующему этапу.','warn');
        return;
      }
    }
  } catch(_qe) {}
  window._stageSaving = _guardKey;

  const comment = document.getElementById('stage-comment')?.value?.trim();
  if (!comment) {
    window._stageSaving = null;
    document.getElementById('stage-comment')?.focus();
    return showToast('Комментарий обязателен', 'error');
  }
  const btn = document.getElementById('stage-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем...'; }

  // Сбор фото
  const photos = [];
  const filesInput = document.getElementById('stage-photos');
  for (const file of Array.from(filesInput?.files||[]).slice(0, 8)) {
    if (!String(file.type||'').startsWith('image/')) continue;
    try {
      // Сжимаем перед сохранением — не больше 1200px, JPEG 82%
      const data = await (window._compressImage ? window._compressImage(file) : new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('')); fr.readAsDataURL(file);
      }));
      if (data) photos.push({ url: data, name: file.name.replace(/\.\w+$/, '.jpg'), type: 'image/jpeg' });
    } catch(_e) {}
  }

  try {
    // Оценка времени (для этапа 'accepted')
  const estimatedHoursVal = stageId === 'accepted'
    ? (parseFloat(document.getElementById('stage-estimated-hours')?.value || '0') || null)
    : null;
  const scheduledStartVal = stageId === 'accepted'
    ? (document.getElementById('stage-scheduled-start')?.value || null)
    : null;

    const parts = window.masterGetStageParts?.() || [];
    const steps = Array.from(document.querySelectorAll('.stage-step-check:checked')).map(x=>x.value).filter(Boolean);
    await DB.Orders.addStage(orderId, {
      id: stageId, icon: stageIcon, label: stageLabel,
      comment, photos, parts, steps,
      estimatedHours: estimatedHoursVal,
      scheduledStart: scheduledStartVal,
    });

    // ── При этапе «Заявка принята» — добавляем в расписание + запрашиваем подтверждение ──
    if (stageId === 'accepted') {
      // Авто-распределение по дням работ
      if (scheduledStartVal && estimatedHoursVal) {
        try {
          const masterId = window.resolveCurrentMaster?.()?.id || '';
          if (masterId && window.DB?.MasterSchedules) {
            // Проверяем/создаём день в расписании
            const existing = await window.DB.MasterSchedules.getByDate?.(masterId, scheduledStartVal);
            if (!existing) {
              await window.DB.MasterSchedules.save?.({
                masterId,
                workDate: scheduledStartVal,
                startTime: '09:00',
                endTime:   '18:00',
                isDayOff:  false,
                note: `Заявка ${orderId} · ~${estimatedHoursVal}ч`,
              });
            }
            // Сохраняем estimatedHours + scheduledEnd в заявку
            const startDt = new Date(scheduledStartVal + 'T09:00');
            const endDt = new Date(startDt.getTime() + estimatedHoursVal * 3600000);
            const endDate = endDt.toISOString().slice(0,10);
            const endTime = endDt.toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'});
            await window.DB?.Orders?.update?.(orderId, {
              estimatedHours: estimatedHoursVal,
              scheduledStart: scheduledStartVal,
              scheduledEnd: endDate === scheduledStartVal ? endTime : endDate + ' ' + endTime,
              startedAt: new Date().toISOString(),
            });
          }
        } catch(_se) { /* не блокируем основной флоу */ }
      }
      try {
        await DB.Orders.update(orderId, { carHandoverPending: true, carHandoverConfirmed: null });
        // Уведомление клиенту
        const _ho = DB.Orders.get(orderId);
        if (_ho) {
          try {
            await window._api?.('notifications.insert', {
              recipientPhone: _ho.clientPhone || _ho.phone || '',
              recipientRole: 'client',
              eventType: 'order.handover_request',
              entityType: 'order',
              entityId: orderId,
              title: `Заявка ${orderId}: машина у мастера`,
              body: `Мастер ${_ho.masterName||''} сообщает, что принял ваш автомобиль. Подтвердите передачу в карточке заявки.`,
              actionUrl: '#myorders',
              meta: { orderId, masterName: _ho.masterName || '' },
            });
          } catch(_ne) {}
          try { window.App?.updateBadge?.(); } catch(_e) {}
        }
      } catch(_ue) {}
    }

    window._haptic?.('medium');
    showToast(`${stageIcon} Этап «${stageLabel}» отмечен`);
    closeMasterStageModal();
    try { window.OrderSystem?.Detail?.render?.(); } catch(_e) {}
    Messenger.updateBadge();
    try { window.App?.updateBadge?.(); } catch(_e) {}
    // Всегда перерисовываем рабочий таб — чтобы статусы и бакеты обновились
    if (location.hash.startsWith('#master')) {
      setTimeout(() => navMaster('work'), 80);
    }
  } catch(e) {
    showToast(e?.message || 'Не удалось сохранить этап', 'error');
    if (btn) { btn.disabled = false; btn.textContent = `${stageIcon} Подтвердить этап`; }
  } finally {
    window._stageSaving = null;
  }
};

window.masterOpenPartsModal = function(orderId) {
  if (!orderId) return;
  const _actorRole = String(window._appState?.user?.role || 'master');
  if (!window.requireAuth?.('open_order', {role:_actorRole === 'sto' ? 'sto' : 'master', orderId})) return;
  const o = window.DB?.Orders?.get?.(orderId);
  if (!o) return showToast('Заявка не найдена', 'error');
  try { history.pushState({masterModal:'parts',orderId}, '', '#master:order:'+orderId+':parts'); } catch(_e) {}

  const esc = eh;
  const fmt = n => (Number(n)||0).toLocaleString('ru');
  const TYPE_LABEL = {part:'Запчасть',consumable:'Расходник',fluid:'Жидкость',work:'Работа'};
  const TYPE_ICON  = {part:'▱',consumable:'🧴',fluid:'▱',work:'⌁'};
  const isStoPartsActor = _actorRole === 'sto';
  let _activeTab = 'list';

/* ═══════════════════════════════════════════════════════════════
   CLIENT ORDER DETAIL ENTRY — openClientOrderModal(id) -> OrderSystem.Detail
   Полная информация о заявке для клиента:
   • Статус и прогресс этапов
   • Информация о мастере
   • Отчёты мастера с фотографиями
   • Действия (чат, чек, отмена)
═══════════════════════════════════════════════════════════════ */
/* ── Пайплайн этапов — мастер двигает заявку по шагам ───────────────
   Правила:
   · Этапы фиксированы, порядок менять нельзя
   · Назад нельзя, только вперёд
   · Комментарий обязателен, фото по желанию
   ─────────────────────────────────────────────────────────────────── */
const MASTER_PIPELINE = window.KARETA_REPAIR_PIPELINE || [];

/* Сжатие изображения перед сохранением — макс 1200px, JPEG 82% */
  function _switchTab(tab) {
    _activeTab = tab;
    ['list','add','catalog'].forEach(t => {
      const btn = document.getElementById('mpt-btn-'+t);
      const pane = document.getElementById('mpt-pane-'+t);
      if (btn)  { btn.classList.toggle('active', t===tab); btn.classList.toggle('btn-primary', t===tab); btn.classList.toggle('btn-ghost', t!==tab); }
      if (pane) pane.style.display = t===tab ? 'block' : 'none';
    });
    if (tab === 'add') setTimeout(()=>document.getElementById('mp-name')?.focus(), 80);
    if (tab === 'catalog') setTimeout(()=>document.getElementById('mp-search')?.focus(), 80);
  }

  function _renderModal() {
    const parts = Array.isArray(o.orderParts) ? o.orderParts : [];
    const allCatalog = (window.DB?.Shop?.getAllParts?.() || []);
    const total = parts.reduce((s,p)=>s+(Number(p.qty)||1)*(Number(p.price)||0), 0);
    const cnt = parts.length;

    /* ── Вкладка 1: Прикреплённые запчасти ── */
    const listHtml = parts.length ? parts.map(p => {
      const sum = (Number(p.qty)||1)*(Number(p.price)||0);
      return `<div style="display:flex;align-items:stretch;gap:0;background:var(--bg);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);overflow:hidden;margin-bottom:10px">
        <div style="width:4px;flex-shrink:0;background:var(--orange)"></div>
        <div style="flex:1;padding:12px 14px;min-width:0">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14px;line-height:1.3">${esc(p.name||'—')}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:3px">${TYPE_ICON[p.type]||'▱'} ${TYPE_LABEL[p.type]||''}${p.sku?' · '+esc(p.sku):''}</div>
            </div>
            <button onclick="masterRemoveOrderPart('${esc(orderId)}','${esc(p.id)}')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:var(--ui-radius-sm,5px);color:#ef4444;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:16px">✕</button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
            <div style="flex-ac-12">
              <span class="t-sub">${fmt(p.price)} ₸ × ${Number(p.qty)||1} шт.</span>
            </div>
            <div style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;color:var(--orange)">${fmt(sum)} ₸</div>
          </div>
        </div>
      </div>`;
    }).join('') + `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(255,107,0,.07);border:1px solid rgba(255,107,0,.2);border-radius:var(--ui-radius-md,10px);margin-top:4px">
        <span style="font-weight:700;font-size:14px">Итого запчасти:</span>
        <span style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:var(--orange)">${fmt(total)} ₸</span>
      </div>`
    : `<div style="padding:40px 20px;text-align:center;color:var(--text3)">
        <div style="font-size:48px;margin-bottom:12px">▱</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:6px">Пока ничего нет</div>
        <div style="font-size:13px;line-height:1.6">Добавьте запчасти из каталога<br>или введите вручную</div>
        <button class="btn btn-primary" style="margin-top:16px;padding:10px 24px" onclick="masterPartsTab('add')">+ Добавить</button>
      </div>`;

    /* ── Вкладка 2: Добавить вручную ── */
    const addHtml = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Наименование *</label>
          <input class="pf-input" id="mp-name" placeholder="Фильтр масляный, тормозные колодки, масло 5W-40..." style="font-size:15px;padding:12px 14px"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Артикул</label>
            <input class="pf-input" id="mp-sku" placeholder="OC115, 5W-40..." style="font-size:14px;padding:11px 12px"/>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Тип</label>
            <select class="pf-input" id="mp-type" style="font-size:14px;padding:11px 12px">
              <option value="part">▱ Запчасть</option>
              <option value="consumable">🧴 Расходник</option>
              <option value="fluid">▱ Жидкость</option>
              <option value="work">⌁ Работа</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Количество</label>
            <div style="display:flex;align-items:center;gap:0;border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);overflow:hidden;background:var(--surface)">
              <button onclick="const el=document.getElementById('mp-qty');el.value=Math.max(1,(+el.value||1)-1)" style="background:none;border:none;border-right:1px solid var(--line);padding:0 14px;height:44px;font-size:18px;color:var(--text2);cursor:pointer;flex-shrink:0">−</button>
              <input id="mp-qty" type="number" min="1" value="1" style="border:none;background:transparent;text-align:center;font-size:16px;font-weight:700;width:100%;height:44px;outline:none;color:var(--text)"/>
              <button onclick="const el=document.getElementById('mp-qty');el.value=(+el.value||0)+1" style="background:none;border:none;border-left:1px solid var(--line);padding:0 14px;height:44px;font-size:18px;color:var(--text2);cursor:pointer;flex-shrink:0">+</button>
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Цена ₸</label>
            <input class="pf-input" id="mp-price" type="number" min="0" value="" placeholder="0" style="font-size:15px;padding:11px 14px;font-weight:700"/>
          </div>
        </div>
        ${isStoPartsActor ? `<div style="padding:12px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);border-radius:var(--ui-radius-md,10px);font-size:12px;color:var(--text2);line-height:1.45">СТО добавляет позицию только в эту заявку. Склад/каталог СТО будет отдельным этапом.</div>` : `<label style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);cursor:pointer">
          <input type="checkbox" id="mp-save-catalog" style="width:18px;height:18px;accent-color:var(--orange);flex-shrink:0">
          <div>
            <div style="font-size:13px;font-weight:600">Сохранить в каталог магазина</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">Товар появится в разделе «Магазин» для будущих заявок</div>
          </div>
        </label>`}
        <button class="btn btn-primary" style="width:100%;padding:14px;font-size:15px;font-weight:700;border-radius:var(--ui-radius-md,10px)" onclick="masterAddManualPart('${esc(orderId)}')">✅ Добавить к заявке</button>
      </div>`;

    /* ── Вкладка 3: Каталог ── */
    const catalogItemsHtml = allCatalog.length ? allCatalog.slice(0,60).map(p=>`
      <div class="mp-cat-item" data-name="${esc((p.name||'').toLowerCase())}" data-sku="${esc((p.sku||'').toLowerCase())}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px)">
        <div style="width:38px;height:38px;border-radius:var(--ui-radius-md,10px);background:rgba(255,107,0,.1);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${TYPE_ICON[p.cat]||'▱'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;line-height:1.3">${esc(p.name||'—')}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(p.shopName||'')}${p.sku?' · '+esc(p.sku):''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <div style="font-family:'Oswald',sans-serif;font-size:14px;color:var(--orange);font-weight:700">${fmt(p.price)} ₸</div>
          <button class="btn btn-primary" style="font-size:11px;padding:5px 12px;border-radius:var(--ui-radius-sm,5px)" onclick="masterAttachCatalogPart('${esc(orderId)}','${esc(p.id)}')">+ В заявку</button>
        </div>
      </div>`).join('')
    : `<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">Каталог пуст — добавьте товары через раздел «Магазин»</div>`;

    const catalogHtml = `
      <div style="flex-col-8">
        <div style="position:sticky;top:0;z-index:2;background:var(--bg);padding-bottom:8px">
          <input class="pf-input" id="mp-search" placeholder="⌕ Поиск по каталогу..." oninput="masterFilterCatalog(this.value)" style="font-size:14px;padding:11px 14px;width:100%;box-sizing:border-box"/>
        </div>
        <div id="mp-catalog" style="flex-col-8">
          ${catalogItemsHtml}
        </div>
        ${allCatalog.length ? '' : ''}
      </div>`;

    /* ── Собираем модалку ── */
    let ov = document.getElementById('master-parts-modal');
    if (!ov) { ov = document.createElement('div'); ov.id='master-parts-modal'; ov.className='cmodal-overlay'; document.body.appendChild(ov); }
    ov.classList.add('open');
    ov.innerHTML = `
      <div style="position:fixed;bottom:0;left:0;right:0;max-height:94vh;background:var(--bg);border-radius:var(--ui-radius-lg,18px) var(--ui-radius-lg,18px) 0 0;display:flex;flex-direction:column;box-shadow:0 -4px 32px rgba(0,0,0,.18);max-width:680px;margin:0 auto">

        <!-- Ручка -->
        <div style="display:flex;justify-content:center;padding:10px 0 0">
          <div style="width:40px;height:4px;border-radius:var(--ui-radius-sm,5px);background:var(--line)"></div>
        </div>

        <!-- Заголовок -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px 0;flex-shrink:0">
          <div>
            <div style="font-family:'Oswald',sans-serif;font-size:18px;font-weight:700">▱ ${isStoPartsActor ? 'Запчасти СТО' : 'Запчасти'}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(orderId)} · ${esc(o.clientCar||o.serviceNames||'Заявка')}</div>
          </div>
          <button onclick="window._closeMasterModal('master-parts-modal')" style="background:var(--surface);border:1px solid var(--line);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:18px">✕</button>
        </div>

        <!-- Табы -->
        <div style="display:flex;gap:6px;padding:12px 18px;flex-shrink:0;border-bottom:1px solid var(--line)">
          <button id="mpt-btn-list" class="btn btn-primary" onclick="masterPartsTab('list')" style="flex:1;padding:9px 4px;font-size:12px;font-weight:700;border-radius:var(--ui-radius-md,10px)">
            ▤ Список${cnt ? ' <span style="background:rgba(255,255,255,.25);border-radius:99px;padding:1px 6px;font-size:10px">'+cnt+'</span>' : ''}
          </button>
          <button id="mpt-btn-add" class="btn btn-ghost" onclick="masterPartsTab('add')" style="flex:1;padding:9px 4px;font-size:12px;font-weight:700;border-radius:var(--ui-radius-md,10px)">
            ➕ Добавить
          </button>
          <button id="mpt-btn-catalog" class="btn btn-ghost" onclick="masterPartsTab('catalog')" style="flex:1;padding:9px 4px;font-size:12px;font-weight:700;border-radius:var(--ui-radius-md,10px)">
            ▣ Каталог${allCatalog.length ? ' <span style="background:var(--surface);border-radius:99px;padding:1px 6px;font-size:10px;color:var(--text3)">'+allCatalog.length+'</span>' : ''}
          </button>
        </div>

        <!-- Контент (прокручиваемый) -->
        <div style="overflow-y:auto;flex:1;padding:16px 18px 24px">
          <div id="mpt-pane-list" style="display:block">${listHtml}</div>
          <div id="mpt-pane-add"  style="display:none">${addHtml}</div>
          <div id="mpt-pane-catalog" style="display:none">${catalogHtml}</div>
        </div>

      </div>`;

    ov.onclick = e => { if (e.target === ov) window._closeMasterModal('master-parts-modal'); };

    // Активируем нужный таб
    _switchTab(_activeTab);
    window.masterPartsTab = function(tab){ _activeTab=tab; _switchTab(tab); };
  }

  _renderModal();
  window._masterPartsRender = _renderModal;
};

window.masterAddManualPart = async function(orderId) {
  const name = document.getElementById('mp-name')?.value?.trim();
  if (!name) { showToast('Укажите наименование', 'error'); return; }
  const sku   = document.getElementById('mp-sku')?.value?.trim() || '';
  const type  = document.getElementById('mp-type')?.value || 'part';
  const qty   = Math.max(1, Number(document.getElementById('mp-qty')?.value)||1);
  const price = Math.max(0, Number(document.getElementById('mp-price')?.value)||0);
  const actorRole = String(window._appState?.user?.role || 'master');
  const saveToCatalog = actorRole !== 'sto' && document.getElementById('mp-save-catalog')?.checked;

  try {
    const actor = window._appState?.user;
    const masterId = actor?.masterId || actor?.id || '';
    if (saveToCatalog && masterId) {
      await DB.Shop.addPart(masterId, { name, sku, price, cat: type, stockQty: qty, stock: qty > 0 });
    }
    await DB.Orders.addPart(orderId, { name, sku, type, qty, price });
    showToast('✅ Добавлено: ' + name);
    ['mp-name','mp-sku','mp-qty','mp-price'].forEach(id => { const el = document.getElementById(id); if(el) el.value = id === 'mp-qty' ? '1' : id === 'mp-price' ? '0' : ''; });
    window._masterPartsRender?.();
    try { window.OrderSystem?.Detail?.render?.(); } catch(_e) {}
  } catch(e) { showToast(e?.message || 'Ошибка', 'error'); }
};

window.masterAttachCatalogPart = async function(orderId, partId) {
  const part = (window.DB?.Shop?.getAllParts?.() || []).find(p => p.id === partId);
  if (!part) return showToast('Товар не найден', 'error');
  try {
    await DB.Orders.addPart(orderId, { name: part.name, sku: part.sku||'', type: part.cat||'part', qty: 1, price: Number(part.price)||0, catalogPartId: partId });
    showToast('✅ ' + part.name + ' прикреплён');
    window._masterPartsRender?.();
    try { window.OrderSystem?.Detail?.render?.(); } catch(_e) {}
  } catch(e) { showToast(e?.message || 'Ошибка', 'error'); }
};

window.masterRemoveOrderPart = async function(orderId, partItemId) {
  try {
    await DB.Orders.removePart(orderId, partItemId);
    showToast('Удалено');
    window._masterPartsRender?.();
    try { window.OrderSystem?.Detail?.render?.(); } catch(_e) {}
  } catch(e) { showToast(e?.message || 'Ошибка', 'error'); }
};

window.masterFilterCatalog = function(query) {
  const q = String(query||'').toLowerCase().trim();
  const all = document.getElementById('mp-catalog');
  if (!all) return;
  all.querySelectorAll('div[style*="border:1px"]').forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
};

window.masterOpenQueuePreview = function(orderId) {
  const o = window.DB?.Orders?.get?.(orderId);
  if (!o) return showToast('Заявка не найдена', 'error');
  const esc = eh;
  const isParts = (o.type||'service_order') === 'parts_request';
  const isFree = String(o.masterId||'0') === '0' && o.status === 'new';

  // Детали — клиент скрыт пока не взята
  const rows = isParts ? [
    ['🏷 Тип',     'Запрос запчастей'],
    ['⌁ Деталь',  esc(o.serviceNames||o.notes||'—')],
    ['□ Дата',    esc(o.date||o.dateLabel||'—') + (o.time ? ' · ' + esc(o.time) : '')],
    ['▱ Авто',    esc(o.clientCar||o.vehicleTitle||'Скрыто до взятия')],
    ['▥ Ориентир', (Number(o.price)||0).toLocaleString('ru') + ' ₸'],
    ['⌖ Статус',  'Свободна — в бирже'],
  ] : [
    ['🏷 Тип',    'Ремонт / Услуга'],
    ['⌁ Услуги', esc(o.serviceNames||o.notes||'—')],
    ['□ Дата',   esc(o.date||o.dateLabel||'—') + (o.time ? ' · ' + esc(o.time) : '')],
    ['▱ Авто',   esc(o.clientCar||o.vehicleTitle||'Скрыто до взятия')],
    ['▥ Сумма',  (Number(o.price)||0).toLocaleString('ru') + ' ₸'],
    ['⌖ Статус', 'Свободна — в бирже'],
  ];

  const rowsHtml = rows.map(([k,v]) =>
    `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">
      <div style="font-size:12px;color:var(--text3);width:100px;flex-shrink:0;padding-top:1px">${k}</div>
      <div style="font-size:13px;color:var(--text);font-weight:500;flex:1">${v}</div>
    </div>`
  ).join('');

  const full = window._masterWorkBucketsProcess >= 3;

  let ov = document.getElementById('master-queue-preview');
  if (!ov) { ov = document.createElement('div'); ov.id='master-queue-preview'; ov.className='cmodal-overlay'; document.body.appendChild(ov); }
  ov.classList.add('open');
  ov.innerHTML = `
    <div class="cmodal-card" style="max-width:440px;width:min(94vw,440px);border-radius:var(--ui-radius-lg,18px);overflow:hidden">
      <div class="cmodal-head" style="border-bottom:1px solid var(--line)">
        <div>
          <div style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700">
            ${isParts ? '▣' : '⌁'} ${esc((o.serviceNames||o.notes||'Заявка').slice(0,50))}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(o.id)} · Предпросмотр из биржи</div>
        </div>
        <button onclick="document.getElementById('master-queue-preview')?.remove()" style="background:var(--surface);border:1px solid var(--line);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0">✕</button>
      </div>
      <div class="cmodal-body">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Детали ${isParts?'запроса':'заявки'}</div>
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);padding:4px 14px;margin-bottom:16px">
          ${rowsHtml}
          <div style="padding:8px 0;font-size:11px;color:var(--text3);font-style:italic">
            ○ Контакты клиента и полные данные откроются после взятия заявки
          </div>
        </div>
        <div style="display:flex;gap:8px">
          ${isFree
            ? (full
              ? `<button class="btn btn-outline" style="flex:1;opacity:.5;cursor:not-allowed" disabled>◌ Слот занят 3/3</button>`
              : `<button class="btn btn-primary" style="flex:1;padding:11px" onclick="document.getElementById('master-queue-preview')?.remove();requireAuth('master_claim',{role:'master',orderId:'${esc(o.id)}'})">⌁ Взять заявку</button>`)
            : `<button class="btn btn-outline" style="flex:1" disabled>Уже назначен мастер</button>`}
          <button class="btn btn-outline" style="padding:11px 16px" onclick="document.getElementById('master-queue-preview')?.remove();requireAuth('master_discuss',{role:'master',orderId:'${esc(o.id)}'})">◌ Обсудить</button>
          <button class="btn btn-ghost" style="padding:11px 16px" onclick="document.getElementById('master-queue-preview')?.remove()">Закрыть</button>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
};

window.masterOpenDayOrders = function(masterId, dateIso) {
  const allOrders = (window.DB?.Orders?.getAll?.({})||[]);
  const dayOrders = allOrders.filter(o => {
    const d = String(o.date||o.dateLabel||o.createdAt||'').slice(0,10);
    return d === dateIso && String(o.masterId||'0') !== '0' && window.DB?.Orders?.isAttachedToMaster?.(o, {id: masterId});
  });
  const esc = eh;
  const dateLabel = new Date(dateIso+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'2-digit',month:'long'});
  const statusLabel = {new:'Новая',process:'В работе',done:'Выполнена',cancelled:'Отменена'};
  const statusColor = {new:'#60a5fa',process:'var(--orange)',done:'#22c55e',cancelled:'#94a3b8'};

  const cardsHtml = dayOrders.length
    ? dayOrders.map(o => {
        const sc = statusColor[o.status] || 'var(--text3)';
        return `<div class="card" style="padding:14px 16px;border:1px solid var(--line);border-left:3px solid ${sc}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="min-width:0;flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${sc}22;color:${sc};border:1px solid ${sc}44;font-weight:600">${statusLabel[o.status]||o.status}</span>
                <span class="t-meta">${esc(o.id)}</span>
              </div>
              <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700">${esc(o.clientName||'Клиент')}</div>
              <div style="font-size:13px;color:var(--text2);margin-top:3px">${esc(o.serviceNames||o.notes||'Заявка')}</div>
              <div style="font-size:12px;color:var(--text3);margin-top:6px">▱ ${esc(o.clientCar||'—')} ${o.time?'· 🕐 '+esc(o.time):''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'Oswald',sans-serif;font-size:16px;color:var(--orange)">${(Number(o.price)||0).toLocaleString('ru')} ₸</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <button class="btn btn-outline" style="font-size:12px;padding:7px 10px" onclick="masterOpenPartsModal('${esc(o.id)}')">▣ Рабочее место</button>
            <button class="btn btn-outline" style="font-size:12px;padding:7px 10px" onclick="masterOpenOrderCard('${esc(o.id)}')">▤ Карточка</button>
            ${o.status==='process'?`<button class="btn btn-outline" style="font-size:12px;padding:7px 10px" onclick="masterOpenStageModal('${esc(o.id)}')">📌 Этап</button>`:''}
          </div>
        </div>`;
      }).join('')
    : `<div style="padding:32px;text-align:center;color:var(--text3)">
        <div style="font-size:36px;margin-bottom:10px">□</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:6px">На этот день заказов нет</div>
        <div style="font-size:13px">Заказы появятся здесь после записи клиента или назначения из биржи.</div>
      </div>`;

  let ov = document.getElementById('master-dayorders-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'master-dayorders-modal'; ov.className = 'cmodal-overlay'; document.body.appendChild(ov); }
  ov.classList.add('open');
  ov.innerHTML = `
    <div class="cmodal-card" style="max-width:600px;width:min(94vw,600px);max-height:90vh;overflow-y:auto;border-radius:var(--ui-radius-lg,18px)">
      <div class="cmodal-head">
        <h3>▤ Заказы · ${esc(dateLabel)}</h3>
        <button class="cmodal-close" onclick="document.getElementById('master-dayorders-modal')?.remove()">✕</button>
      </div>
      <div class="cmodal-body" style="display:flex;flex-direction:column;gap:10px">
        ${cardsHtml}
        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:4px">
          <button class="btn btn-outline" style="font-size:12px;padding:7px 14px" onclick="document.getElementById('master-dayorders-modal')?.remove()">Закрыть</button>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
};

window._openPhotoViewer = function(src) {
  if (!src) return;
  let ov = document.getElementById('photo-viewer-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'photo-viewer-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(6px)';
    ov.addEventListener('click', () => ov.remove());
    document.body.appendChild(ov); try{ window.bindOnboardingOverlayDismiss && window.bindOnboardingOverlayDismiss(); }catch(_e){} try{ window.armOnboardingOverlayAutoHide && window.armOnboardingOverlayAutoHide(); }catch(_e){}
  }
  ov.innerHTML = `<img src="${src}" style="max-width:92vw;max-height:92vh;border-radius:var(--ui-radius-md,10px);box-shadow:0 32px 64px rgba(0,0,0,.8)" alt="Фото"/>
    <button style="position:absolute;top:18px;right:18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:50%;width:38px;height:38px;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('photo-viewer-overlay').remove()">×</button>`;
};

window._saveProfileSetup = async function(role) {
  const get = id => { const el = document.getElementById(id); return el ? String(el.value||'').trim() : ''; };
  const FIELD_MAP = {
    client: ['ps-name:name','ps-car:car','ps-city:city'],
    master: ['ps-name:name','ps-spec:spec','ps-city:city','ps-mode:workMode','ps-radius:serviceRadius'],
    sto:    ['ps-name:name','ps-city:city','ps-addr:address','ps-phone:contactPhone','ps-hours:workHours'],
  };
  const rk = normalizeEntryRole(role);
  const patch = {};
  (FIELD_MAP[rk] || FIELD_MAP.client).forEach(pair => {
    const [id, key] = pair.split(':');
    const val = get(id);
    if (val) patch[key] = val;
  });

  if (!patch.name && !patch.city) { window._showToast?.('Заполните хотя бы имя и город', 'error'); return; }

  const btn = document.querySelector('#profile-setup-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем…'; }

  try {
    // Общий профиль
    const profilePatch = { name: patch.name, car: patch.car, spec: patch.spec, city: patch.city };
    window.App?.mergeUserPatch?.(profilePatch);
    await window.App?.persistServerProfile?.(profilePatch).catch(e => { console.warn('[Profile] server sync failed:', e?.message); });

    // Гео мастера
    if (rk === 'master' && (patch.workMode || patch.city || patch.serviceRadius)) {
      await window.DB?._api?.('master.saveGeo', {
        workMode: patch.workMode || 'shop',
        city: patch.city || '',
        serviceAddress: patch.address || '',
        serviceRadiusKm: parseInt(patch.serviceRadius||'0', 10),
        locationVisibility: 'city',
        locationSource: 'manual',
      }).catch(()=>{});
    }

    // СТО
    if (rk === 'sto') {
      await window.DB?._api?.('sto.saveProfile', {
        name: patch.name, city: patch.city,
        address: patch.address, contactPhone: patch.contactPhone, workHours: patch.workHours,
      }).catch(()=>{});
    }

    window._showToast?.('✅ Профиль сохранён');
    document.getElementById('profile-setup-overlay')?.remove();
  } catch(e) {
    window._showToast?.('Ошибка сохранения: ' + (e?.message || ''), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить'; }
  }
};

window._haptic = function(type) {
    if (!navigator.vibrate) return;
    const patterns = { light: 8, medium: 18, success: [10, 50, 10], error: [30, 80, 30] };
    try { navigator.vibrate(patterns[type] || patterns.light); } catch(_e) {}
  };

window.cancelOrder = function(btn, orderId) {
    const actor = window._appState?.user;
    if (!Security.Guard.requireLogin('myorders')) return;
    const rl = Security.RateLimit.check('cancel', actor?.phone);
    if (!rl.ok) { showToast('⛔ ' + rl.msg, 'error'); return; }
    Security.Audit.log('order.cancel', actor, { orderId });
    if (_origCancel) _origCancel(btn, orderId);
  };

window.setUserRole = function(phone, newRole, selectEl) {
    const actor = window._appState?.user;
    const guard = Security.Guard.check(actor, 'action.promote_user', phone);
    if (!guard.ok) { showToast('◌ ' + guard.error, 'error'); if(selectEl) selectEl.value = RBAC.getUser(phone).role; return; }
    const rl = Security.RateLimit.check('roleChange', actor?.phone);
    if (!rl.ok) { showToast('⛔ ' + rl.msg, 'error'); return; }
    Security.Audit.log('user.roleChange', actor, { targetPhone: phone, newRole });
    if (_origSetRole) _origSetRole(phone, newRole, selectEl);
  };

/* ── Master News Posts ── */
window.openMasterPostDetail = function(postId, masterId) {
  try { history.pushState({modal:'openMasterPostDetail'}, '', '#master:post:{id}'); } catch(_e) {}
  const post = window.DB?.MasterWall?.get?.(postId);
  const master = window.DB?.Masters?.get?.(masterId);
  if (!post) return;
  const esc = eh;
  const catMeta = NEWS_CATS()[post.category||'repair_story'] || {label:'История ремонта',icon:'▱',color:'#34d399'};
  const photos = (post.photos||post.photosJson||[]);
  const parts = (post.parts||[]);

  let ov = document.getElementById('master-post-detail');
  if (!ov) { ov = document.createElement('div'); ov.id='master-post-detail'; ov.className='cmodal-overlay'; document.body.appendChild(ov); }
  ov.classList.add('open');
  ov.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--ui-radius-lg,18px);max-width:640px;width:min(96vw,640px);max-height:90vh;overflow-y:auto;margin:auto">
      <div style="position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:1">
        <div>
          <div style="font-size:10px;color:${esc(catMeta.color)};font-weight:700;text-transform:uppercase">${catMeta.icon} ${esc(catMeta.label)}</div>
          <div style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;margin-top:2px">${esc((post.title||post.text||'Ремонт').slice(0,80))}</div>
        </div>
        <button onclick="document.getElementById('master-post-detail')?.remove()" style="background:var(--surface);border:1px solid var(--line);border-radius:50%;width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2)">✕</button>
      </div>
      <div style="padding:18px">
        <!-- Мастер -->
        ${master ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px 14px;background:var(--surface);border-radius:var(--ui-radius-md,10px);border:1px solid var(--line)">
          <div style="width:38px;height:38px;border-radius:50%;background:${esc(master.color||'#34d399')}22;border:2px solid ${esc(master.color||'#34d399')};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;color:${esc(master.color||'#34d399')};flex-shrink:0">${esc(master.initials||'М')}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${esc(master.name||'Мастер')}</div>
            <button onclick="document.getElementById('master-post-detail')?.remove();window.openMasterPublicProfile('${esc(masterId||'')}')" style="font-size:11px;color:var(--orange);background:none;border:none;cursor:pointer;padding:0">Профиль мастера →</button>
          </div>
          <div style="margin-left:auto;font-size:11px;color:var(--text3)">${post.createdAt ? new Date(post.createdAt).toLocaleDateString('ru',{day:'2-digit',month:'short',year:'numeric'}) : ''}</div>
        </div>` : ''}
        <!-- Фото галерея -->
        ${photos.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-bottom:16px">
          ${photos.map(src=>`<img src="${esc(src)}" style="width:100%;height:120px;object-fit:cover;border-radius:var(--ui-radius-md,10px);cursor:zoom-in" loading="lazy" onclick="window.open(this.src,'_blank')">`).join('')}
        </div>` : ''}
        <!-- Текст -->
        ${post.text ? `<div style="font-size:14px;color:var(--text2);line-height:1.7;margin-bottom:16px;white-space:pre-wrap">${esc(post.text)}</div>` : ''}
        <!-- Шаги -->
        ${(post.steps||[]).length ? `<div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Этапы работ</div>
          <div style="flex-col-8">
            ${(post.steps||[]).map((s,i)=>`<div style="display:flex;gap:10px;align-items:flex-start">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px">${i+1}</div>
              <div style="flex:1">
                ${s.label ? `<div style="font-weight:700;font-size:13px">${esc(s.label)}</div>` : ''}
                ${s.comment ? `<div style="font-size:13px;color:var(--text2);margin-top:2px">${esc(s.comment)}</div>` : ''}
                ${(s.photos||[]).length ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">${(s.photos||[]).map(ph=>`<img src="${esc(ph)}" style="width:80px;height:60px;object-fit:cover;border-radius:var(--ui-radius-sm,5px);cursor:zoom-in" onclick="window.open(this.src,'_blank')">`).join('')}</div>` : ''}
              </div>
            </div>`).join('')}
          </div>
        </div>` : ''}
        <!-- Запчасти -->
        ${parts.length ? `<div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">▱ Использованные запчасти</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${parts.map(p=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--surface);border-radius:var(--ui-radius-sm,5px);border:1px solid var(--line)">
              <span style="font-size:13px">${esc(p.name||'Запчасть')} ${p.qty>1?`x${p.qty}`:''}</span>
              ${p.price ? `<span style="font-size:13px;font-weight:700;color:var(--orange)">${(Number(p.price)*Number(p.qty||1)).toLocaleString('ru')} ₸</span>` : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}
        <button class="btn btn-primary" style="width:100%;padding:11px" onclick="App.go('booking')">□ Записаться к мастеру</button>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
};

window.masterCreateNewsPost = async function(orderId) {
  const order = window.DB?.Orders?.get?.(orderId);
  if (!order) return showToast('Заявка не найдена', 'error');
  const master = window.DB?.Masters?.getMine?.();
  const esc = eh;

  // Автозаполнение — тянем фото из отчётов и запчасти из заказа
  const reportPhotos = (order.reports||[]).flatMap(r=>(r.photos||[])).slice(0,12);
  const stagePhotos = (order.stages||[]).flatMap(s=>(s.photos||[])).slice(0,12);
  const allPhotos = [...new Set([...reportPhotos, ...stagePhotos])];
  const orderParts = Array.isArray(order.orderParts) ? order.orderParts : [];
  const stagesForPost = (order.stages||[]).filter(s=>s.comment).map(s=>({
    label: s.label||s.icon||'Этап',
    comment: s.comment||'',
    photos: (s.photos||[]).slice(0,3),
  }));
  const cats = NEWS_CATS();
  const catOpts = Object.entries(cats).filter(([k])=>k!=='all').map(([k,v])=>`<option value="${esc(k)}">${v.icon} ${esc(v.label)}</option>`).join('');

  let ov = document.getElementById('master-create-post');
  if (!ov) { ov = document.createElement('div'); ov.id='master-create-post'; ov.className='cmodal-overlay'; document.body.appendChild(ov); }
  ov.classList.add('open');
  ov.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--ui-radius-lg,18px);max-width:620px;width:min(96vw,620px);max-height:92vh;overflow-y:auto;margin:auto">
      <div style="position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;z-index:1">
        <div style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700">📝 Создать историю ремонта</div>
        <button onclick="document.getElementById('master-create-post')?.remove()" style="background:var(--surface);border:1px solid var(--line);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2)">✕</button>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px">
        <!-- Авто + услуги (автозаполнение) -->
        <div style="padding:12px 14px;background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.2);border-radius:var(--ui-radius-md,10px);font-size:13px;color:var(--text2)">
          ▱ <strong>${esc(order.clientCar||'Авто')}</strong> · ${esc(order.serviceNames||order.notes||'Ремонт')}
        </div>
        <!-- Категория -->
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Категория</label>
          <select class="pf-input" id="npost-cat" style="font-size:13px">${catOpts}</select>
        </div>
        <!-- Заголовок -->
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Заголовок *</label>
          <input class="pf-input" id="npost-title" placeholder="Замена генератора на Toyota Camry 2018" value="${esc(order.serviceNames||order.notes||'')}" style="font-size:13px"/>
        </div>
        <!-- Превью / вступление -->
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Превью (краткое вступление)</label>
          <textarea class="pf-input" id="npost-preview" rows="2" placeholder="Клиент обратился с проблемой запуска двигателя..." style="resize:vertical;font-size:13px"></textarea>
        </div>
        <!-- Тело статьи -->
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Описание работы</label>
          <textarea class="pf-input" id="npost-body" rows="4" placeholder="Опишите выполненную работу подробно..." style="resize:vertical;font-size:13px"></textarea>
        </div>
        <!-- Этапы из отчётов — автозаполнены -->
        ${stagesForPost.length ? `<div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Шаги (из этапов заявки)</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${stagesForPost.map((s,i)=>`<div style="padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--ui-radius-md,10px);display:flex;gap:10px;align-items:flex-start">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--orange);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px">${esc(s.label)}</div>
                <div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(s.comment)}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>` : ''}
        <!-- Фото (автотянем из отчётов) -->
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Фотографии (из отчётов заявки)</label>
          ${allPhotos.length ? `<div id="npost-photos-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;margin-bottom:8px">
            ${allPhotos.map((src,i)=>`<div style="position:relative">
              <img src="${esc(src)}" style="width:100%;height:80px;object-fit:cover;border-radius:var(--ui-radius-sm,5px);border:2px solid var(--orange)" data-selected="1" onclick="this.dataset.selected=this.dataset.selected==='1'?'0':'1';this.style.opacity=this.dataset.selected==='1'?'1':'.3';this.style.border=this.dataset.selected==='1'?'2px solid var(--orange)':'2px solid var(--line)'" id="npost-photo-${i}">
            </div>`).join('')}
          </div>` : '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Фото из отчётов не найдены</div>'}
          <label style="font-size:12px;color:var(--text3);cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px dashed var(--line);border-radius:var(--ui-radius-md,10px)">
            <span>📸 Добавить фото</span>
            <input type="file" accept="image/*" multiple style="display:none" id="npost-extra-photos" onchange="masterPostAddPhotos(this)">
          </label>
        </div>
        <!-- Запчасти — автозаполнены -->
        ${orderParts.length ? `<div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">▱ Запчасти из заявки</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${orderParts.map(p=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 10px;background:var(--surface);border-radius:var(--ui-radius-sm,5px);border:1px solid var(--line)">
              <span style="font-size:13px">${esc(p.name||'Запчасть')}</span>
              ${p.price ? `<span style="font-size:13px;color:var(--orange);font-weight:600">${(Number(p.price)||0).toLocaleString('ru')} ₸</span>` : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}
        <!-- Кнопки -->
        <div style="display:flex;gap:10px;padding-top:4px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('master-create-post')?.remove()">Отмена</button>
          <button class="btn btn-primary" id="npost-save-btn" style="flex:2;padding:11px" onclick="masterSaveNewsPost('${esc(orderId)}',this)">🚀 Опубликовать историю</button>
        </div>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
};

window.masterPostAddPhotos = function(input) {
  const grid = document.getElementById('npost-photos-grid') || (() => {
    const g = document.createElement('div'); g.id='npost-photos-grid';
    g.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;margin-bottom:8px';
    input.parentElement.parentElement.insertBefore(g, input.parentElement);
    return g;
  })();
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const div = document.createElement('div'); div.style.position='relative';
      const img = document.createElement('img');
      img.src = ev.target.result; img.dataset.selected='1'; img.dataset.extra='1';
      img.style.cssText='width:100%;height:80px;object-fit:cover;border-radius:var(--ui-radius-sm,5px);border:2px solid var(--orange);cursor:pointer';
      img.onclick = function() { this.dataset.selected=this.dataset.selected==='1'?'0':'1'; this.style.opacity=this.dataset.selected==='1'?'1':'.3'; this.style.border=this.dataset.selected==='1'?'2px solid var(--orange)':'2px solid var(--line)'; };
      div.appendChild(img); grid.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
};

window.masterSaveNewsPost = async function(orderId, btn) {
  const title = document.getElementById('npost-title')?.value?.trim();
  if (!title) { document.getElementById('npost-title')?.focus(); return showToast('Заголовок обязателен','error'); }
  if (btn) { btn.disabled=true; btn.textContent='⏳ Публикуем...'; }
  try {
    const order = window.DB?.Orders?.get?.(orderId);
    const master = window.DB?.Masters?.getMine?.();
    const cat = document.getElementById('npost-cat')?.value || 'repair_story';
    const preview = document.getElementById('npost-preview')?.value?.trim() || '';
    const body = document.getElementById('npost-body')?.value?.trim() || '';
    const selectedPhotos = Array.from(document.querySelectorAll('#npost-photos-grid img[data-selected="1"]')).map(img=>img.src).filter(Boolean);
    const stages = (order?.stages||[]).filter(s=>s.comment).map(s=>({label:s.label||'',comment:s.comment||'',photos:(s.photos||[]).slice(0,3)}));
    const parts = Array.isArray(order?.orderParts) ? order.orderParts : [];
    const post = {
      id: 'wp_'+Date.now().toString(36),
      masterId: master?.id || '',
      masterName: master?.name || '',
      orderId,
      category: cat,
      title,
      preview,
      text: body,
      steps: stages,
      photos: selectedPhotos,
      parts,
      postType: 'repair_story',
      createdAt: new Date().toISOString(),
    };
    await window.DB?.MasterWall?.save?.(post);
    window._haptic?.('success');
    showToast('✅ История ремонта опубликована');
    document.getElementById('master-create-post')?.remove();
    // Переход на страницу мастера
    setTimeout(()=>window.openMasterPublicProfile(master?.id||''), 500);
  } catch(e) {
    showToast(e?.message||'Ошибка публикации','error');
    if (btn) { btn.disabled=false; btn.textContent='🚀 Опубликовать историю'; }
  }
};

/* ── Алиасы для обратной совместимости ── */
window.masterWallOpenPost = function(postId) {
  if (!postId) return;
  window.openMasterPostDetail?.(postId, '');
};