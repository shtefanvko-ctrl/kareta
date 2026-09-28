(function(){
  'use strict';

  const formUI = window.KaretaOnboardingFormUI;
  const validation = window.KaretaOnboardingFormValidation;
  const draft = window.KaretaOnboardingProfileDraft;
  const definitions = window.KaretaOnboardingRoleDefinitions;
  const phone = window.KaretaOnboardingPhoneRuntime;
  const navigation = window.KaretaOnboardingNavigation;
  const router = window.KaretaOnboardingRouter;
  const app = window.KaretaOnboardingApp;
  const api = window.KaretaOnboardingApi;
  if (!formUI || !validation || !draft || !definitions || !phone || !navigation || !router || !app || !api) {
    throw new Error('Onboarding role/profile dependencies are incomplete');
  }

  const state = { overlay:null, selectedRole:'', currentStep:'welcome', submitting:false, resendTimer:null, requestTimer:null, pendingEnter:'neutral', otpCleanup:null };
  const esc = formUI.esc;
  const normalizeRole = value => definitions.normalizeRole(value || 'client');
  window.normalizeEntryRole = normalizeRole;

  const otpLength = value => Math.min(8, Math.max(4, Number(value || 6) || 6));
  const resendSeconds = value => Math.min(3600, Math.max(1, Number(value || 60) || 60));
  const remainingSeconds = timestamp => Math.max(0, Math.ceil((Number(timestamp || 0) - Date.now()) / 1000));

  function clearResendTimer(){
    if (state.resendTimer) clearInterval(state.resendTimer);
    state.resendTimer = null;
  }

  function refreshResendControl(){
    const button = state.overlay?.querySelector('[data-action="resend-code"]');
    if (!button) { clearResendTimer(); return; }
    const remaining = remainingSeconds(draft.read().otpResendAt);
    button.disabled = state.submitting || remaining > 0;
    const countdown = window.KaretaKFlow?.formatCountdown?.(remaining) || `00:${String(remaining).padStart(2,'0')}`;
    button.textContent = remaining > 0 ? `Отправить повторно через ${countdown}` : 'Отправить код повторно';
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
    if (remaining <= 0) clearResendTimer();
  }

  function startResendTimer(){
    clearResendTimer();
    refreshResendControl();
    if (remainingSeconds(draft.read().otpResendAt) <= 0) return;
    state.resendTimer = setInterval(refreshResendControl, 1000);
  }

  function clearRequestTimer(){
    if(state.requestTimer)clearInterval(state.requestTimer);
    state.requestTimer=null;
  }

  function startRequestCooldown(button,defaultLabel='Получить код'){
    clearRequestTimer();
    if(!button)return;
    const tick=()=>{
      const remaining=remainingSeconds(draft.read().otpResendAt);
      button.disabled=state.submitting || remaining>0;
      button.setAttribute('aria-disabled',button.disabled?'true':'false');
      button.textContent=remaining>0 ? `Повторить через ${remaining} сек.` : defaultLabel;
      if(remaining<=0)clearRequestTimer();
    };
    tick();
    if(remainingSeconds(draft.read().otpResendAt)>0)state.requestTimer=setInterval(tick,1000);
  }

  const CITY_POINTS = Object.freeze([
    ['Алматы',43.2389,76.8897],['Астана',51.1694,71.4491],['Шымкент',42.3417,69.5901],
    ['Караганда',49.8064,73.0855],['Усть-Каменогорск',49.9483,82.6285],['Семей',50.4111,80.2275],
    ['Павлодар',52.2873,76.9674],['Риддер',50.3441,83.5129]
  ]);

  function readCookie(name){
    const source = String(document.cookie || '');
    const item = source.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='));
    if (!item) return '';
    try { return decodeURIComponent(item.slice(name.length + 1)); } catch (_error) { return item.slice(name.length + 1); }
  }

  function safeJson(value){
    try { const result = JSON.parse(String(value || '')); return result && typeof result === 'object' ? result : null; }
    catch (_error) { return null; }
  }

  function firstValue(values){
    for (const value of values) {
      const normalized = String(value == null ? '' : value).trim();
      if (normalized) return normalized;
    }
    return '';
  }

  function nearestCity(lat,lng){
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    let best = null;
    for (const row of CITY_POINTS) {
      const distance = Math.pow(lat - row[1], 2) + Math.pow(lng - row[2], 2);
      if (!best || distance < best.distance) best = { city:row[0], distance };
    }
    return best?.city || '';
  }

  function storedProfile(){
    return safeJson(localStorage.getItem('kareta.profile.current'))
      || safeJson(sessionStorage.getItem('kareta.profile.current'))
      || safeJson(localStorage.getItem('kareta.auth.user'))
      || {};
  }

  function storedVehicle(){
    const candidates = [
      safeJson(localStorage.getItem('kareta.vehicle.current')),
      safeJson(localStorage.getItem('kareta.current.vehicle')),
      safeJson(localStorage.getItem('kareta.client.vehicle')),
      safeJson(sessionStorage.getItem('kareta.vehicle.current')),
      safeJson(readCookie('kareta_vehicle')),
      safeJson(readCookie('kareta_car'))
    ].filter(Boolean);
    return candidates[0] || {};
  }

  function collectAutoContext(){
    const flow = draft.read();
    const profile = storedProfile();
    const vehicle = storedVehicle();
    const city = firstValue([
      flow.city, profile.city, localStorage.getItem('kareta.entryCity'), localStorage.getItem('kareta_city'),
      readCookie('kareta_city'), readCookie('kareta_entry_city')
    ]);
    const make = firstValue([flow.vehicleMake, flow.brand, vehicle.make, vehicle.brand, vehicle.vehicleMake, readCookie('kareta_vehicle_make')]);
    const model = firstValue([flow.vehicleModel, flow.model, vehicle.model, vehicle.vehicleModel, readCookie('kareta_vehicle_model')]);
    const year = firstValue([flow.vehicleYear, flow.carYear, vehicle.year, vehicle.year_label, vehicle.vehicleYear, readCookie('kareta_vehicle_year')]);
    const plate = firstValue([flow.vehiclePlate, vehicle.plate, vehicle.number, vehicle.licensePlate, readCookie('kareta_vehicle_plate')]);
    return { city, vehicleMake:make, brand:make, vehicleModel:model, model, vehicleYear:year, carYear:year, vehiclePlate:plate };
  }

  function captureGeo(){
    const existing = draft.read();
    if (existing.geoLat && existing.geoLng && existing.city) return Promise.resolve(existing);
    if (!navigator.geolocation) return Promise.resolve(existing);
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = Number(position.coords?.latitude || 0);
        const lng = Number(position.coords?.longitude || 0);
        const auto = collectAutoContext();
        const city = auto.city || nearestCity(lat,lng);
        const patch = { ...auto, city, geoLat:lat, geoLng:lng, geoAccuracy:Number(position.coords?.accuracy || 0), geoDetectedAt:new Date().toISOString() };
        draft.patch(patch, { source:'onboarding-auto-geo' });
        resolve(draft.read());
      }, () => {
        const auto = collectAutoContext();
        if (Object.values(auto).some(Boolean)) draft.patch(auto, { source:'onboarding-auto-context' });
        resolve(draft.read());
      }, { enableHighAccuracy:false, timeout:4500, maximumAge:900000 });
    });
  }

  function branchIcon(role){
    if(role==='master') return `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M22.5 7.2a8.2 8.2 0 0 0-9.7 10.7L6.7 24a3.1 3.1 0 0 0 4.4 4.4l6.1-6.1A8.2 8.2 0 0 0 28 12.6l-4.2 4.2-4.6-1.1-1.1-4.6 4.4-3.9Z"/></svg>`;
    return `<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="12" cy="10" r="4"/><path d="M5.5 23c.8-4.5 3-7 6.5-7 3.1 0 5.2 2 6.2 5.4"/><path d="M18 24.5h11.5l-1.3-5.1a2.5 2.5 0 0 0-2.4-1.9h-4.9a2.5 2.5 0 0 0-2.3 1.5L16 24.5Z"/><circle cx="20.5" cy="26.5" r="2"/><circle cx="27.2" cy="26.5" r="2"/></svg>`;
  }

  function branchArrow(role){
    const left=role==='master';
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${left?'M19 12H5m6-6-6 6 6 6':'M5 12h14m-6-6 6 6-6 6'}"/></svg>`;
  }

  function roleBranch(role){
    const master=role==='master';
    const title=master?'Мастер':'Клиент';
    const desc=master?'Оказываю услуги':'Ищу услуги';
    return `<div class="k-flow-role-column">
      <button type="button" class="k-flow-role-card" data-role-branch="${role}" data-role="${role}" aria-label="${title}: ${desc}">
        <span class="k-flow-role-icon">${branchIcon(role)}</span>
        <b>${title}</b><small>${desc}</small>
        <span class="k-flow-role-card-direction-wide" aria-hidden="true">${branchArrow(role)}</span>
      </button>
    </div>`;
  }

  function progressHtml(step){
    const map={role:2,profile:3,code:4};
    return window.KaretaKFlow?.renderSteps?.({total:4,current:map[step]||1,label:'Окно'}) || '';
  }

  function flowHeader(step){
    const action=step==='role'?'back-welcome':step==='profile'?'back-role':'back-profile';
    return `<header class="k-flow-header">
      <button type="button" class="k-flow-back" data-action="${action}" aria-label="Назад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg></button>
      <img class="k-flow-logo" src="assets/onboarding/kareta_logo_full.png" alt="KARETA.KZ">
      <span class="k-flow-header-spacer" aria-hidden="true"></span>
    </header>`;
  }

  function sharedModal(title, sub, body, extraClass = '', step = 'role', introExtra = ''){
    return `<div class="onb2-modal onb2-modal--role-compact onb2-modal--registration onb2-flow-shell k-flow-window k-flow-onboarding-window ${extraClass}">
      ${flowHeader(step)}
      ${progressHtml(step)}
      <div class="k-flow-copy"><h1>${esc(title)}</h1><p>${esc(sub)}</p>${introExtra}</div>
      <div class="onb2-modal-body onb2-modal-body--role-compact onb2-flow-body k-flow-body">${body}</div>
    </div>`;
  }


  function welcomeStepHtml(){
    return `<section id="onb2-step-welcome" class="onb2-step active" data-step="welcome">
      <div class="onb2-welcome-card onb2-flow-shell">
        <div class="onb2-flow-brand"><img class="onb2-welcome-logo" src="assets/onboarding/kareta_logo_full.png" alt="KARETA.KZ Автосервис"></div>
        ${progressHtml('welcome')}
        <div class="onb2-welcome-copy">
          <h1>Добро пожаловать!</h1>
          <p>Всё для автомобиля<br>в одном месте</p>
          <div class="onb2-desktop-benefits" aria-label="Возможности KARETA.KZ">
            <div><b>Найти мастера</b><span>Услуги, цены, свободное время и запись в одном сценарии.</span></div>
            <div><b>Контролировать ремонт</b><span>Заявка, чат, этапы работ и история автомобиля остаются в приложении.</span></div>
            <div><b>Запчасти и сообщество</b><span>Подбор деталей, реальные работы, вопросы и помощь других участников.</span></div>
          </div>
        </div>
        <div class="onb2-flow-actions onb2-flow-actions--single"><button type="button" class="onb2-btn onb2-btn--primary onb2-welcome-next" data-action="welcome-next">Начать</button></div>
      </div>
    </section>`;
  }

  function roleStepHtml(){
    return `<section id="onb2-step-role" class="onb2-step active" data-step="role">
      ${sharedModal('Кто вы?','Выберите, как будете пользоваться приложением',`<div class="k-flow-role-grid" role="list" aria-label="Выбор ветки KARETA.KZ">${roleBranch('master')}${roleBranch('client')}</div>`,'','role',`<div class="k-flow-desktop-context"><div><b>Для клиента</b><span>Гараж, заявки на ремонт, выбор мастера, чат, история и запчасти.</span></div><div><b>Для мастера</b><span>Биржа заявок, рабочий график, услуги, клиенты, запчасти и сообщество.</span></div></div>`)}
    </section>`;
  }

  function profileStepHtml(){
    const flow = draft.read();
    const verifiedNew = flow.phoneVerified === true && flow.accountExists === false;
    const title = verifiedNew ? 'Завершите регистрацию' : 'Вход или регистрация';
    const subtitle = verifiedNew ? 'Номер подтверждён. Укажите имя для создания аккаунта' : 'Введите номер телефона. Для зарегистрированного номера имя повторно не требуется';
    const submitLabel = verifiedNew ? 'Создать аккаунт' : 'Получить код';
    return `<section id="onb2-step-profile" class="onb2-step active" data-step="profile">
      ${sharedModal(title,subtitle,`<form class="onb2-compact-profile k-flow-form" data-onb-profile-form novalidate>
        ${formUI.registrationForm({ flow })}
        <div class="onb2-compact-error" data-onb-profile-error hidden></div>
        <div class="k-flow-actions"><button type="submit" class="onb2-btn onb2-btn--primary k-flow-primary" data-action="request-code">${submitLabel}</button><div class="k-flow-trust k-flow-trust--mobile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5.5 5.5v5.8c0 4.2 2.5 7.8 6.5 9.7 4-1.9 6.5-5.5 6.5-9.7V5.5L12 3Z"/><path d="m9.2 12 1.8 1.8 3.8-4"/></svg><span>Мы защищаем ваши данные</span></div></div>
      </form>`,'onb2-modal--profile-match','profile',`<div class="k-flow-trust k-flow-trust--wide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5.5 5.5v5.8c0 4.2 2.5 7.8 6.5 9.7 4-1.9 6.5-5.5 6.5-9.7V5.5L12 3Z"/><path d="m9.2 12 1.8 1.8 3.8-4"/></svg><span>Мы защищаем ваши данные</span></div>`)}
    </section>`;
  }

  // Historical OTP regression markers: legacy UI said `Тестовый режим: SMS не отправляется. Введите код`;
  // its single field used `maxlength="${codeLength}"`. K-Flow renders the same dynamic length as one-cell inputs.
  // Historical resend label: `Повторить через ${remaining} сек.`; K-Flow now renders MM:SS without changing cooldown semantics.
  function codeStepHtml(){
    const flow = draft.read();
    const codeLength = otpLength(flow.otpCodeLength);
    const testMode = flow.otpTestMode === true || flow.otpDeliveryMode === 'test_static';
    const testCode = String(flow.otpTestCode || '0000').replace(/\D/g,'').slice(0, codeLength) || '0000';
    const subtitle = `Код отправлен на ${window.KaretaKFlow?.maskPhone?.(flow.phone || '') || esc(flow.phone || '')}`;
    const resendRemaining = remainingSeconds(flow.otpResendAt);
    const countdown = window.KaretaKFlow?.formatCountdown?.(resendRemaining) || `00:${String(resendRemaining).padStart(2,'0')}`;
    const resendLabel = resendRemaining > 0 ? `Отправить повторно через ${countdown}` : 'Отправить код повторно';
    const cells = Array.from({length:codeLength},(_,index)=>`<input class="k-flow-otp-cell" data-kflow-otp-cell inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Цифра ${index+1} кода" ${index===0?'autocomplete="one-time-code"':''}>`).join('');
    return `<section id="onb2-step-code" class="onb2-step active" data-step="code">
      ${sharedModal('Подтвердите номер',subtitle,`<form class="onb2-code-form k-flow-form" data-onb-code-form novalidate>
        <input type="hidden" id="onb2-ref-code" data-kflow-otp-value value="">
        <div class="k-flow-otp k-flow-otp--${codeLength}" data-otp-length="${codeLength}" role="group" aria-label="Код подтверждения">${cells}</div>
        ${testMode?`<div class="k-flow-code-test">Тестовый режим: код ${esc(testCode)}</div>`:''}
        <div class="onb2-compact-error" data-onb-profile-error hidden></div>
        <div class="k-flow-actions"><button type="submit" class="onb2-btn onb2-btn--primary k-flow-primary" data-action="verify-code">Подтвердить</button>
          <div class="k-flow-code-meta"><button type="button" data-action="resend-code" ${resendRemaining > 0 ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>${esc(resendLabel)}</button><button type="button" class="k-flow-link" data-action="back-profile">Изменить номер</button></div>
        </div>
      </form>`,'onb2-modal--code-match','code')}
    </section>`;
  }

  function overlayHtml(step){ return step === 'welcome' ? welcomeStepHtml() : step === 'code' ? codeStepHtml() : step === 'profile' ? profileStepHtml() : roleStepHtml(); }

  function cleanup(){
    clearResendTimer();
    clearRequestTimer();
    try { state.otpCleanup?.(); } catch (_error) {}
    state.otpCleanup=null;
    const overlay = state.overlay || document.getElementById('onb2-overlay');
    try { overlay?.remove(); } catch (_error) {}
    state.overlay = null;
  }

  function selectRole(value){
    const role = normalizeRole(value);
    state.selectedRole = role;
    draft.patch({ role, entryRole:role, stage:'profile', flowSurface:'overlay', pending:true, roleSetupDone:false, onboardingCompleted:false, serverConfirmed:false, phoneVerified:false }, { source:'registration-role-select' });
    return role;
  }

  function navigateFlow(step, role, options = {}){
    const safeRole=normalizeRole(role || state.selectedRole || draft.currentRole());
    const reverse=options.reverse===true;
    const motion=window.KaretaKFlow?.branch?.(safeRole,reverse) || {enter:'neutral',leave:'left'};
    state.pendingEnter=options.neutral?'neutral':motion.enter;
    const surface=state.overlay?.querySelector('.k-flow-onboarding-window');
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if(surface && !reduce && !options.instant){
      surface.classList.add(`k-flow-leave-${options.neutral?'left':motion.leave}`);
      setTimeout(()=>navigation.to(step,{role:safeRole,source:options.source||`kflow:${step}`}),145);
      return;
    }
    navigation.to(step,{role:safeRole,source:options.source||`kflow:${step}`});
  }

  function render(options = {}){
    cleanup();
    const parsed = router.parse(options.route || location.hash) || { role:draft.currentRole(), step:'welcome' };
    const role = normalizeRole(options.role || parsed.role || draft.currentRole());
    const requestedStep = options.step || parsed.step;
    const step = ['welcome','role','profile','code'].includes(requestedStep) ? requestedStep : 'welcome';
    state.selectedRole = step === 'role' ? '' : role;
    state.currentStep = step;
    const overlay = document.createElement('div');
    overlay.id = 'onb2-overlay';
    overlay.className = 'onb2-overlay onb2-overlay--compact k-onboarding';
    overlay.dataset.step = step;
    overlay.dataset.kflowStep = String({welcome:1,role:2,profile:3,code:4}[step] || 1);
    overlay.dataset.screen = step;
    overlay.dataset.role = step === 'role' ? '' : role;
    overlay.dataset.direction = step === 'profile' ? (role === 'master' ? 'master-left' : 'client-right') : 'forward';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = overlayHtml(step);
    document.body.appendChild(overlay);
    state.overlay = overlay;
    document.documentElement.classList.add('entry-flow-active');
    document.body?.classList.add('entry-flow-active');
    bind(overlay);
    phone.bindMasks({ scope:overlay, selector:'#onb2-ref-phone', onClearError:input => { input.classList.remove('is-invalid'); input.closest('label')?.classList.remove('is-invalid'); } });
    if (step === 'profile') captureGeo().catch(() => null);
    if (step === 'code') {
      startResendTimer();
      try { state.otpCleanup?.(); } catch (_error) {}
      state.otpCleanup = window.KaretaKFlow?.bindOtp?.(overlay,{hiddenSelector:'#onb2-ref-code',cellSelector:'[data-kflow-otp-cell]'}) || null;
    }
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      const surface=overlay.querySelector('.k-flow-onboarding-window');
      if(surface){surface.classList.add(`k-flow-enter-${state.pendingEnter||'neutral'}`);setTimeout(()=>surface.classList.remove('k-flow-enter-left','k-flow-enter-right','k-flow-enter-neutral'),320);}
      state.pendingEnter='neutral';
      if (step === 'code') overlay.querySelector('[data-kflow-otp-cell]')?.focus();
    });
    return overlay;
  }

  function readValue(id){ return String(state.overlay?.querySelector('#' + id)?.value || '').trim(); }
  function showError(message){
    const node = state.overlay?.querySelector('[data-onb-profile-error]');
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || '';
  }

  function collectRegistration(){
    const auto = collectAutoContext();
    const flow = draft.read();
    const rawPhone = readValue('onb2-ref-phone') || String(flow.phone || flow.contactPhone || '');
    const name = readValue('onb2-ref-name') || String(flow.accountName || flow.name || '');
    const role = normalizeRole(state.selectedRole || flow.role);
    return {
      ...auto,
      role, entryRole:role, name, accountName:name,
      storeName:role === 'seller' ? name : '',
      phone:phone.format(rawPhone) || rawPhone,
      stage:'code', flowSurface:'overlay', pending:true, roleSetupDone:true, phoneVerified:false
    };
  }

  async function requestCode(button, options = {}){
    if (state.submitting) return;
    const existingCooldown = remainingSeconds(draft.read().otpResendAt);
    if (existingCooldown > 0) {
      showError(`Повторный код можно запросить через ${existingCooldown} сек.`);
      if(options.resend)startResendTimer();
      else startRequestCooldown(button,button?.dataset?.defaultLabel || 'Получить код');
      return;
    }
    const form = state.overlay?.querySelector('[data-onb-profile-form]');
    const payload = collectRegistration();
    validation.clear(form); showError('');
    const verifiedNew = draft.read().phoneVerified === true && draft.read().accountExists === false;
    const result = validation.validateRegistration(payload, { isPhoneValid:phone.isValid, requireName:verifiedNew });
    if (!result.ok) {
      result.errors.forEach(([id,message]) => validation.markInvalid(form,id,message));
      validation.focusFirst(form); showError(verifiedNew ? 'Укажите имя для создания аккаунта.' : 'Проверьте номер телефона.'); return;
    }
    const verifiedPhone = phone.format(String(draft.read().verifiedPhone || '')) || String(draft.read().verifiedPhone || '');
    const payloadPhone = phone.format(String(payload.phone || '')) || String(payload.phone || '');
    if (verifiedNew && verifiedPhone && payloadPhone === verifiedPhone) {
      draft.patch({ ...payload, stage:'saving', pending:true }, { source:'registration-complete-after-phone-verification' });
      state.submitting = true;
      try { await app.finalize({ button }); }
      catch (error) { showError(error?.message || 'Не удалось создать аккаунт.'); }
      finally { state.submitting = false; }
      return;
    }
    if (verifiedNew && verifiedPhone && payloadPhone !== verifiedPhone) {
      draft.patch({ phoneVerified:false, verifiedPhone:'', accountExists:null, authMode:'' }, { source:'registration-phone-changed-after-verification' });
    }
    state.submitting = true;
    const oldText = button?.textContent || '';
    if(button && !button.dataset.defaultLabel)button.dataset.defaultLabel=oldText || 'Получить код';
    if (button) { button.disabled = true; button.textContent = 'Отправляем…'; button.setAttribute('aria-disabled','true'); }
    try {
      await captureGeo().catch(() => null);
      const codeResult = await api.requestCode(payload.phone);
      draft.patch({ ...payload, ...collectAutoContext() }, { source:'registration-request-code' });
      // The API stores the active verification context in sessionStorage.
      // Navigate only after it has been created so the lifecycle route guard accepts the code step.
      const requestedAt = Date.now();
      const resendAfter = resendSeconds(codeResult?.resendAfter);
      draft.patch({
        accountExists:!!codeResult?.existingAccount,
        authMode:codeResult?.mode || (codeResult?.existingAccount ? 'login' : 'register'),
        otpDeliveryMode:String(codeResult?.deliveryMode || 'webhook'),
        otpCodeLength:otpLength(codeResult?.codeLength),
        otpTestMode:codeResult?.testMode === true,
        otpTestCode:codeResult?.testMode === true ? String(codeResult?.testCode || '') : '',
        otpRequestedAt:requestedAt,
        otpResendAfter:resendAfter,
        otpResendAt:requestedAt + resendAfter * 1000
      }, { source:'registration-code-context-ready' });
      navigation.to('code', { role:payload.role, source:options.resend ? 'registration-resend-code' : 'registration-request-code' });
    } catch (error) {
      // Historical R7 contract generalized: error?.code === 'challenge_rate_limited' is now covered by any server retryAfter.
      if (Number(error?.retryAfter || 0) > 0) {
        const retryAfter = resendSeconds(error?.retryAfter);
        draft.patch({ otpResendAfter:retryAfter, otpResendAt:Date.now() + retryAfter * 1000 }, { source:'registration-code-retry-after' });
        if(options.resend)startResendTimer();
        else startRequestCooldown(button,button?.dataset?.defaultLabel || oldText || 'Получить код');
      }
      const message = error?.message || 'Не удалось отправить код.';
      const expectedOtpError=['otp_delivery_failed','otp_delivery_unavailable','challenge_rate_limited'].includes(String(error?.code||''));
      (expectedOtpError?console.warn:console.error)('[KARETA][onboarding.requestCode.ui]', {message, error});
      window.KaretaRuntimeLog?.add('onboarding.requestCode.ui_error', {
        message, status:error?.status || 0, code:error?.code || '', requestId:error?.requestId || '', rawPreview:error?.rawPreview || ''
      }, expectedOtpError?'warn':'error');
      showError(message);
    }
    finally {
      state.submitting = false;
      const remaining=remainingSeconds(draft.read().otpResendAt);
      if (button) {
        if(remaining>0 && state.currentStep!=='code')startRequestCooldown(button,button?.dataset?.defaultLabel || oldText || 'Получить код');
        else { button.disabled = false; button.textContent = oldText; button.setAttribute('aria-disabled','false'); }
      }
      if (state.currentStep === 'code') startResendTimer();
    }
  }

  async function verifyCode(button){
    if (state.submitting) return;
    const flow = draft.read();
    const codeLength = otpLength(flow.otpCodeLength);
    const code = readValue('onb2-ref-code').replace(/\D/g,'').slice(0,codeLength);
    showError('');
    if (code.length !== codeLength) { showError(`Введите ${codeLength} цифр кода.`); state.overlay?.querySelector('#onb2-ref-code')?.focus(); return; }
    state.submitting = true;
    const oldText = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = 'Проверяем…'; }
    try {
      const verifyResult = await api.verifyCode(flow.phone, code, codeLength, flow.entryRole || flow.role || state.selectedRole || 'client');
      draft.patch({ phoneVerified:true, verificationCode:'', stage:'saving' }, { source:'registration-code-verified' });
      if (verifyResult?.existingAccount && verifyResult?.user) {
        const user = app.synchronizeSession(verifyResult, flow);
        // Existing-account sign-in is a completed onboarding/authentication path too.
        // Without this commit, visibilitychange/pageshow reconciliation treated the
        // authenticated user as an unfinished onboarding draft and reopened role selection.
        window.KaretaOnboardingState?.markComplete?.({
          ...verifyResult,
          role:user.role || flow.role || 'client',
          user,
          existingAccount:true,
          authMode:'login'
        });
        // Do not restart the application-wide 0→100 preloader after OTP.
        // The verification button owns this short auth operation.
        try { if (!window.KaretaRoleAccess?.identityActive?.()) window.KaretaRoleAccess?.refresh?.(user.role); } catch (_error) {}
        await app.refreshNextState();
        cleanup();
        app.setActive(false);
        const target = await app.authoritativeTargetAfterAuth?.(verifyResult,flow,user) || app.targetForRole(user.entry_role || user.role);
        history.replaceState(null, '', target);
        try {
          const routeKey = window.KaretaRouteRegistry?.keyFromHash?.(target) || window.KaretaRoleAccess?.defaultRoute?.(user.role) || 'home';
          window.KaretaRouteRuntime?.transition?.(routeKey, { source:'onboarding-existing-login' });
        } catch (_error) {}
      } else {
        const currentName = String(flow.accountName || flow.name || '').trim();
        draft.patch({
          phoneVerified:true,
          verifiedPhone:String(verifyResult?.phone || flow.phone || ''),
          accountExists:false,
          authMode:'register'
        }, { source:'registration-new-account-phone-verified' });
        if (!currentName) {
          // Phone ownership is already proven. Ask only for the missing registration name;
          // submitting the profile again will call onboarding.complete directly, without
          // creating a second challenge or requesting another SMS/code.
          navigation.to('profile', { role:flow.entryRole || flow.role || 'client', source:'registration-new-account-name-required' });
          return;
        }
        await app.finalize({ button });
        // finalize() owns the successful transition and removes the onboarding surface.
        // Do not run a second cleanup/navigation cycle here.
      }
    } catch (error) {
      if (window.KaretaAppPreloader?.isVisible?.()) window.KaretaAppPreloader.fail(error);
      showError(error?.message || 'Неверный код из SMS.');
    }
    finally { state.submitting = false; if (button && document.body.contains(button)) { button.disabled = false; button.textContent = oldText; } }
  }

  const boundOverlays = new WeakSet();
  function bind(overlay){
    if (!overlay || boundOverlays.has(overlay)) {
      window.KaretaRuntimeLog?.add('onboarding.role.bind_skipped', {reason:!overlay ? 'missing_overlay' : 'already_bound'}, 'warn');
      return;
    }
    boundOverlays.add(overlay);
    window.KaretaRuntimeLog?.add('onboarding.role.bound', {overlayId:overlay.id || ''});
    overlay.addEventListener('click', event => {
      const branch = event.target.closest('[data-role-branch]');
      if (branch) { const role = selectRole(branch.dataset.roleBranch); navigateFlow('profile',role,{source:'registration-role-branch'}); return; }
      const control = event.target.closest('[data-action]');
      const action = control?.dataset.action;
      if (action === 'welcome-next') { state.pendingEnter='neutral'; navigation.to('role', { role:draft.currentRole(), source:'registration-welcome-next' }); }
      if (action === 'back-welcome') { state.pendingEnter='neutral'; navigation.to('welcome', { role:draft.currentRole(), source:'registration-back-welcome' }); }
      if (action === 'back-role') navigateFlow('role', state.selectedRole || draft.currentRole(), {reverse:true,source:'registration-back-role'});
      if (action === 'back-profile') navigateFlow('profile', state.selectedRole || draft.currentRole(), {reverse:true,source:'registration-back-profile'});
      if (action === 'resend-code') requestCode(control, { resend:true });
    });
    overlay.querySelector('[data-onb-profile-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      event.stopPropagation();
      if (state.submitting) return;
      requestCode(event.submitter || overlay.querySelector('[data-action="request-code"]'));
    });
    overlay.querySelector('[data-onb-code-form]')?.addEventListener('submit', event => { event.preventDefault(); verifyCode(event.submitter || overlay.querySelector('[data-action="verify-code"]')); });
  }

  function show(_user, onDone, options = {}){ window._onb2Done = onDone || window._onb2Done || null; return render({ ...options, step:options.step || 'welcome' }); }
  function openFromRoute(raw, options = {}){
    const parsed = router.parse(raw || location.hash) || { role:draft.currentRole(), step:'welcome' };
    if (options.replace !== false) { const canonical = router.canonical(parsed.role, parsed.step); if (location.hash !== canonical) history.replaceState(null,'',canonical); }
    return render({ route:router.canonical(parsed.role, parsed.step), role:parsed.role, step:parsed.step });
  }
  function parseOnboardingRoute(raw){ return router.parse(raw); }
  function buildOnboardingRoute(step, role){ return router.canonical(role, step).replace(/^#/,''); }
  function isOnboardingRoute(raw){ return router.isOnboarding(raw); }
  function closeOverlay(){ cleanup(); }

  window.isOnboardingRoute = isOnboardingRoute;
  window.OnboardingV2 = { show, render, selectRole, openFromRoute, parseOnboardingRoute, buildOnboardingRoute, isOnboardingRoute, closeOverlay, state };
  window.showOnboarding = show;
  window._showOnboarding2 = render;
  window._onb2OpenRoute = openFromRoute;
  window._onb2SelectRole = selectRole;
})();
