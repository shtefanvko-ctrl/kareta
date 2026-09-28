(() => {
  'use strict';

  const root = document.getElementById('k-app-preloader');
  if (!root) return;

  const meta = root.querySelector('[data-preloader-meta]');
  const bar = root.querySelector('[data-preloader-bar]');
  const percent = root.querySelector('[data-preloader-percent]');
  const slow = root.querySelector('[data-preloader-slow]');
  const actions = root.querySelector('[data-preloader-actions]');
  const errorCode = root.querySelector('[data-preloader-error-code]');
  let slowTimer = 0;
  let hideTimer = 0;
  let current = 0;
  let bootWatchdog = 0;
  let atomicBaselineLoaded = 0;

  const roleLabels = Object.freeze({
    master:'Настройка рабочего места мастера…',
    sto:'Загрузка панели СТО…',
    seller:'Подготовка кабинета продавца…',
    client:'Подготовка гаража…',
    admin:'Загрузка панели администратора…',
    owner:'Загрузка панели владельца…'
  });

  function clearTimers(){
    if (slowTimer) window.clearTimeout(slowTimer);
    if (hideTimer) window.clearTimeout(hideTimer);
    if (bootWatchdog) window.clearTimeout(bootWatchdog);
    slowTimer = 0;
    hideTimer = 0;
    bootWatchdog = 0;
  }

  function setSlowTimer(){
    if (slowTimer) window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
      if (!root.classList.contains('is-hidden') && !root.classList.contains('is-error')) {
        slow.hidden = false;
        slow.textContent = 'Соединение немного медленнее обычного. Продолжаем загрузку…';
      }
    }, 3000);
  }


  function update(value, message, options = {}){
    const next = Math.max(current, Math.min(100, Number(value) || 0));
    current = next;
    root.hidden = false;
    root.classList.remove('is-hidden','is-error');
    if (message) meta.textContent = message;
    bar.style.width = `${next}%`;
    percent.textContent = `${Math.round(next)}%`;
  }

  function show(options = {}){
    clearTimers();
    current = 0;
    root.hidden = false;
    root.classList.remove('is-hidden','is-error');
    meta.textContent = options.status || 'Инициализация платформы…';
    slow.hidden = true;
    actions.hidden = true;
    if (errorCode) { errorCode.hidden = true; errorCode.textContent = ''; }
    bar.style.width = '0%';
    percent.textContent = '0%';
    setSlowTimer();
    update(options.progress ?? 4, options.status || 'Инициализация платформы…');
    bootWatchdog = window.setTimeout(() => {
      if (current < 12 && !root.classList.contains('is-hidden')) {
        fail(new Error('Не удалось запустить приложение. Проверьте соединение и нажмите «Повторить».'));
      }
    }, 12000);
  }

  function atomicProgress(loaded,total,path=''){
    const safeTotal=Math.max(1,Number(total)||1);
    const safeLoaded=Math.max(0,Math.min(safeTotal,Number(loaded)||0));
    // R188.5.5.6.84.82: progress starts from the moment the preloader itself
    // becomes executable. Earlier bootstrap files are already complete and must
    // not cause an immediate 4 -> 20/30% jump when boot requests are grouped.
    if(!atomicBaselineLoaded && /(?:^|\/)app_preloader\.js(?:$|[?#])/.test(String(path||''))) atomicBaselineLoaded=safeLoaded;
    const baseline=Math.min(safeTotal,Math.max(0,atomicBaselineLoaded||0));
    const remaining=Math.max(1,safeTotal-baseline);
    const completed=Math.max(0,safeLoaded-baseline);
    const mapped=4+Math.round((completed/remaining)*34);
    const label=safeLoaded>=safeTotal?'Ядро приложения загружено…':'Загрузка ядра приложения…';
    update(Math.min(38,mapped),label,{path});
  }

  function role(roleName){
    const normalized = String(roleName || '').toLowerCase();
    update(72, roleLabels[normalized] || 'Подготовка рабочего пространства…');
  }

  function finishComplete(){
    hideTimer = window.setTimeout(() => {
      root.classList.add('is-hidden');
      window.setTimeout(() => { root.hidden = true; }, 320);
    }, 280);
  }

  function complete(message = 'Добро пожаловать!'){
    if (slowTimer) window.clearTimeout(slowTimer);
    slow.hidden = true;
    actions.hidden = true;
    update(100, message);
    const backgroundReady = window.KaretaWelcomeBackground?.ready;
    if (!backgroundReady || typeof backgroundReady.then !== 'function') {
      finishComplete();
      return;
    }
    Promise.race([
      Promise.resolve(backgroundReady).catch(() => ''),
      new Promise(resolve => window.setTimeout(resolve, 1400)),
    ]).finally(finishComplete);
  }

  function fail(error){
    clearTimers();
    root.hidden = false;
    root.classList.remove('is-hidden');
    root.classList.add('is-error');
    meta.textContent = error?.message || String(error || 'Проверьте соединение и повторите попытку.');
    slow.hidden = true;
    actions.hidden = false;
    window.KaretaBootDiagnostics?.show?.(error?.code || error?.message || error);
  }

  root.querySelector('[data-preloader-retry]')?.addEventListener('click', () => { if(window.KaretaBootRecovery?.retry)window.KaretaBootRecovery.retry(); else location.reload(); });
  root.querySelector('[data-preloader-exit]')?.addEventListener('click', () => {
    try { localStorage.removeItem('kareta_entry_flow_v1'); } catch (_error) {}
    location.hash = '#/onboarding/welcome';
    location.reload();
  });

  window.KaretaAppPreloader = Object.freeze({ show, update, atomicProgress, role, complete, fail, isVisible:() => !root.hidden && !root.classList.contains('is-hidden') });
  show();
})();
