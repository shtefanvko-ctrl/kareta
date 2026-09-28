(() => {
  'use strict';

  if (window.__KARETA_NATIVE_DIALOGS__) return;
  window.__KARETA_NATIVE_DIALOGS__ = { version:'R188.5.5.6.84' };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let dialog = null;
  let resolver = null;
  let trigger = null;

  function ensure(){
    if (dialog?.isConnected) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'k-native-confirm';
    dialog.setAttribute('data-kareta-native-confirm','');
    dialog.innerHTML = `<form method="dialog" class="k-native-confirm__surface">
      <header><div><small data-native-confirm-eyebrow>ПОДТВЕРЖДЕНИЕ</small><h2 data-native-confirm-title>Подтвердить действие</h2></div><button type="button" data-native-confirm-close aria-label="Закрыть">×</button></header>
      <div class="k-native-confirm__body"><p data-native-confirm-message></p><div class="k-native-confirm__detail" data-native-confirm-detail hidden></div></div>
      <footer><button type="button" class="k-btn k-btn-secondary" data-native-confirm-cancel>Отмена</button><button type="button" class="k-btn k-btn-primary" data-native-confirm-accept>Продолжить</button></footer>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    dialog.addEventListener('click',event=>{if(event.target===dialog || event.target.closest('[data-native-confirm-close],[data-native-confirm-cancel]'))finish(false);});
    dialog.querySelector('[data-native-confirm-accept]')?.addEventListener('click',()=>finish(true));
    return dialog;
  }

  function finish(value){
    if (!dialog) return;
    if (dialog.open) { try { dialog.close(); } catch (_e) {} }
    const done = resolver; resolver = null;
    const node = trigger; trigger = null;
    try { node?.focus?.({preventScroll:true}); } catch (_e) {}
    if (done) done(Boolean(value));
  }

  function confirm(options = {}){
    const d = ensure();
    if (resolver) finish(false);
    trigger = options.trigger || document.activeElement;
    d.querySelector('[data-native-confirm-eyebrow]').textContent = String(options.eyebrow || 'ПОДТВЕРЖДЕНИЕ');
    d.querySelector('[data-native-confirm-title]').textContent = String(options.title || 'Подтвердить действие');
    d.querySelector('[data-native-confirm-message]').textContent = String(options.message || 'Продолжить?');
    const detail = d.querySelector('[data-native-confirm-detail]');
    if (detail) {
      const text = String(options.detail || '').trim();
      detail.hidden = !text;
      detail.textContent = text;
    }
    const accept = d.querySelector('[data-native-confirm-accept]');
    accept.textContent = String(options.confirmLabel || 'Продолжить');
    accept.classList.toggle('is-danger', options.danger === true);
    if (!d.open) d.showModal();
    requestAnimationFrame(()=>accept?.focus?.({preventScroll:true}));
    return new Promise(resolve => { resolver = resolve; });
  }

  window.KaretaNativeDialogs = Object.freeze({ confirm, close:()=>finish(false), isOpen:()=>Boolean(dialog?.open) });
})();
