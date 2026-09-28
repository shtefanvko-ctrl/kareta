(function(){
  'use strict';

  function normalizeRole(role) {
    return window.KaretaOnboardingRoleDefinitions?.normalizeRole?.(role || 'client') || 'client';
  }

  function markInvalid(scope, id, message) {
    const element = scope?.querySelector('#' + id);
    if (!element) return;
    element.classList.add('is-invalid');
    element.setAttribute('aria-invalid', 'true');
    const label = element.closest('label');
    if (!label) return;
    label.classList.add('is-invalid');
    let hint = label.querySelector('.onb2-ref-error');
    if (!hint) {
      hint = document.createElement('em');
      hint.className = 'onb2-ref-error';
      label.appendChild(hint);
    }
    hint.textContent = message || 'Заполните поле';
  }

  function clear(scope) {
    scope?.querySelectorAll('.is-invalid').forEach(element => {
      element.classList.remove('is-invalid');
      element.removeAttribute('aria-invalid');
    });
    scope?.querySelectorAll('.onb2-ref-error').forEach(element => element.remove());
  }

  function focusFirst(scope) {
    const element = scope?.querySelector('.onb2-ref-input.is-invalid');
    if (!element) return;
    try { element.focus({ preventScroll:false }); } catch (_error) { element.focus?.(); }
    element.scrollIntoView?.({ behavior:'smooth', block:'center' });
  }

  function validate(payload, options = {}) {
    const role = normalizeRole(payload?.role || options.role || 'client');
    const phoneValid = typeof options.isPhoneValid === 'function' ? options.isPhoneValid : value => !!String(value || '').trim();
    const errors = [];
    if (!String(payload?.name || payload?.accountName || '').trim()) {
      errors.push(['onb2-ref-name', role === 'seller' ? 'Укажите название магазина' : role === 'sto' ? 'Укажите название СТО' : 'Укажите имя']);
    }
    if (!phoneValid(payload?.phone || '')) errors.push(['onb2-ref-phone', 'Укажите телефон в формате +7 (___) ___-__-__']);
    if (!String(payload?.city || '').trim()) errors.push(['onb2-ref-city', 'Выберите город']);

    if (role === 'master') {
      if (!String(payload?.specialization || '').trim()) errors.push(['onb2-ref-specialization', 'Выберите специализацию']);
    }
    if (role === 'sto') {
      if (!String(payload?.address || '').trim()) errors.push(['onb2-ref-address', 'Укажите адрес СТО']);
      if (!String(payload?.specialization || '').trim()) errors.push(['onb2-ref-specialization', 'Выберите направление СТО']);
    }
    if (role === 'seller') {
      const bin = String(payload?.binIin || '').replace(/\D/g, '');
      if (bin.length !== 12) errors.push(['onb2-ref-bin', 'Укажите БИН / ИИН из 12 цифр']);
      if (!String(payload?.warehouseAddress || payload?.address || '').trim()) errors.push(['onb2-ref-address', 'Укажите склад или пункт выдачи']);
      if (!String(payload?.specialization || '').trim()) errors.push(['onb2-ref-specialization', 'Выберите основной ассортимент']);
    }
    return { ok:errors.length === 0, errors };
  }

  function validateRegistration(payload, options = {}) {
    const phoneValid = typeof options.isPhoneValid === 'function' ? options.isPhoneValid : value => !!String(value || '').trim();
    const errors = [];
    if (options.requireName !== false && !String(payload?.name || payload?.accountName || '').trim()) errors.push(['onb2-ref-name', 'Укажите имя']);
    if (!phoneValid(payload?.phone || '')) errors.push(['onb2-ref-phone', 'Укажите телефон в формате +7 (___) ___-__-__']);
    return { ok:errors.length === 0, errors };
  }

  window.KaretaOnboardingFormValidation = Object.freeze({ markInvalid, clear, focusFirst, validate, validateRegistration });
})();
