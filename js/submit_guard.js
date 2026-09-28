/* KARETA.KZ r297 — client-side double submit guard
   UX-защита от двойного клика. Не заменяет server-side idempotency и DB constraints. */
(function(){
  if (window.KaretaSubmitGuard) return;
  const locks = new Map();
  const DEFAULT_TTL = 9000;

  function keyOf(key){ return String(key || 'submit').trim() || 'submit'; }

  function isLocked(key){
    const k = keyOf(key);
    const item = locks.get(k);
    if (!item) return false;
    if (item.expiresAt && item.expiresAt < Date.now()) { locks.delete(k); return false; }
    return true;
  }

  function lock(key, opts){
    const k = keyOf(key);
    const ttl = Number(opts && opts.ttl || DEFAULT_TTL);
    if (isLocked(k)) return false;
    const timer = setTimeout(()=>locks.delete(k), ttl);
    locks.set(k, { createdAt:Date.now(), expiresAt:Date.now()+ttl, timer });
    return true;
  }

  function unlock(key){
    const k = keyOf(key);
    const item = locks.get(k);
    if (item && item.timer) clearTimeout(item.timer);
    locks.delete(k);
  }

  function setButtonBusy(btn, busy, text){
    if (!btn || !btn.nodeType) return;
    if (busy) {
      if (!btn.dataset.guardOldText) btn.dataset.guardOldText = btn.textContent || '';
      btn.dataset.submitBusy = '1';
      btn.setAttribute('aria-busy','true');
      btn.disabled = true;
      btn.classList.add('is-loading');
      if (text) btn.textContent = text;
    } else {
      btn.dataset.submitBusy = '0';
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (btn.dataset.guardOldText) {
        btn.textContent = btn.dataset.guardOldText;
        delete btn.dataset.guardOldText;
      }
    }
  }

  async function run(key, btn, runner, opts){
    const k = keyOf(key);
    if (!lock(k, opts)) return { ok:false, skipped:true, reason:'double_submit_guard' };
    if (btn) setButtonBusy(btn, true, opts && opts.loadingText);
    try { return await runner(); }
    finally {
      unlock(k);
      if (btn && !(opts && opts.keepBusy)) setButtonBusy(btn, false);
    }
  }

  function actionKeyFromButton(btn){
    if (!btn) return '';
    if (btn.dataset && btn.dataset.submitGuardKey) return btn.dataset.submitGuardKey;
    const raw = [btn.getAttribute('onclick') || '', btn.id || '', btn.className || '', btn.textContent || ''].join('|');
    let hash = 0;
    for (let i=0;i<raw.length;i++) hash = ((hash<<5)-hash) + raw.charCodeAt(i) | 0;
    return 'dom-click:' + Math.abs(hash).toString(36);
  }

  function isCriticalButton(btn){
    if (!btn || btn.tagName !== 'BUTTON') return false;
    const onclick = String(btn.getAttribute('onclick') || '');
    const cls = String(btn.className || '');
    const id = String(btn.id || '');
    const txt = String(btn.textContent || '').toLowerCase();
    return /submit|создать|отправить|отклик|принять|assignMaster|addStage|masterClaim|submitRequest|submitPartOrder|submitSpecialServiceRequest|submitMasterOrderProposal/i.test(onclick)
      || /submit|create|claim|assign|stage|send/i.test(id)
      || (/btn|action|submit/i.test(cls) && /создать|отправить|отклик|принять|назначить|сохранить|готово/.test(txt));
  }

  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!isCriticalButton(btn)) return;
    const key = actionKeyFromButton(btn);
    if (btn.dataset.submitBusy === '1' || isLocked(key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
    lock(key, {ttl: 2500});
    btn.dataset.submitGuardKey = key;
  }, true);

  window.KaretaSubmitGuard = { isLocked, lock, unlock, run, setButtonBusy, actionKeyFromButton };
})();
