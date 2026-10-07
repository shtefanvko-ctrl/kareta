(function(){
  'use strict';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function normalizeRole(role) {
    const definitions = window.KaretaOnboardingRoleDefinitions;
    if (definitions?.normalizeRole) return definitions.normalizeRole(role || 'client');
    return ['master','sto','seller'].includes(role) ? role : 'client';
  }

  function modalHeader(options = {}) {
    const roleIcon = options.roleIcon ? `<div class="onb2-modal-role-ico">${esc(options.roleIcon)}</div>` : '';
    return `<div class="onb2-modal-head onb2-modal-head--compact">
      <div class="onb2-headbar"><div class="onb2-brandbox onb2-brandbox--official"><img class="onb2-brand-logo onb2-brand-logo--full" src="/assets/logo/main/kareta_logo_full.png" alt="KARETA.KZ Автосервис"></div></div>
      ${roleIcon}
      <div class="onb2-modal-title">${esc(options.title || '')}</div>
      <div class="onb2-modal-sub">${esc(options.sub || '')}</div>
    </div>`;
  }


  function field(label, html, options = {}) {
    const required = options.required ? ' <b>*</b>' : '';
    const wide = options.wide ? ' onb2-ref-wide' : '';
    return `<label class="onb2-ref-field${wide}"><span>${esc(label)}${required}</span>${html}</label>`;
  }

  function input(id, value, attributes = '') {
    return `<input class="onb2-ref-input" id="${esc(id)}" value="${esc(value || '')}" ${attributes}>`;
  }


  function registrationForm(options = {}) {
    const flow = options.flow || {};
    const name = flow.accountName || flow.storeName || flow.name || '';
    const phone = flow.phone || flow.contactPhone || '';
    return `<div class="onb2-ref-profile-form onb2-ref-profile-form--compact onb2-registration-form k-flow-form">
      <label class="k-flow-field"><span>Имя</span>${input('onb2-ref-name', name, 'autocomplete="name" placeholder="Ваше имя" required')}</label>
      <label class="k-flow-field"><span>Телефон</span>${input('onb2-ref-phone', phone, 'type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required')}</label>
    </div>`;
  }

  function stepDots(){ return ''; }
  function serviceChecks(){ return ''; }

  window.KaretaOnboardingFormUI = Object.freeze({
    esc, modalHeader, registrationForm, stepDots, serviceChecks
  });
})();
