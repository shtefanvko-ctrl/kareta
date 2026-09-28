
/* ONBOARDING-LIVE — diagnostic helpers for r1 chain.
   Does not change onboarding business flow. Adds debug route and console helpers. */
(function(){
  'use strict';
  const W = window;
  const D = document;
  const __ONB_DEV__ = !!(W.__DEV__ || /[?&](debug|dev|onbdebug)=1/.test(location.search) || /(^localhost$|^127\.0\.0\.1$|\.test$|\.local$)/.test(location.hostname));

  const FLOW_KEY = 'kareta_entry_flow_v1';
  const DONE_KEYS = ['kareta_onboarding_done_v1', 'kareta.entry.done.v2', 'kareta_onboarding_completed_at'];

  function q(v){ return String(v == null ? '' : v); }
  function esc(v){
    return q(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function getFlow(){
    try { return JSON.parse(localStorage.getItem(FLOW_KEY) || '{}') || {}; }
    catch(_e){ return {}; }
  }
  function route(){
    return q(location.hash || '#home');
  }
  function bool(v){
    if (v === true) return true;
    return q(v).trim() === '1' || q(v).trim().toLowerCase() === 'true';
  }
  function doneState(){
    return {
      onboarding_done_v1: bool(localStorage.getItem('kareta_onboarding_done_v1')),
      entry_done_v2: bool(localStorage.getItem('kareta.entry.done.v2')),
      completed_at: q(localStorage.getItem('kareta_onboarding_completed_at')),
    };
  }
  function expectedSteps(){
    return [
      ['welcome', 'Приветственный экран'],
      ['benefits', 'Всё для авто'],
      ['transparency', 'Прозрачно и удобно'],
      ['role', 'Выбор роли'],
      ['city', 'Выбор города'],
      ['city-search', 'Поиск города'],
      ['address', 'Адрес и геолокация'],
      ['contact', 'Телефон / e-mail'],
      ['verify', 'Подтверждение кода'],
      ['account', 'Создание аккаунта'],
      ['profile', 'Профиль'],
      ['vehicle', 'Автомобиль'],
      ['permissions', 'Разрешения'],
      ['review', 'Проверка данных'],
      ['done', 'Аккаунт создан']
    ];
  }
  function analyze(){
    const f = getFlow();
    const done = doneState();
    const issues = [];

    if (done.onboarding_done_v1 !== done.entry_done_v2) {
      issues.push('Флаги завершения отличаются: kareta_onboarding_done_v1 и kareta.entry.done.v2');
    }
    if (done.onboarding_done_v1 && !done.completed_at) {
      issues.push('Есть флаг завершения, но нет kareta_onboarding_completed_at');
    }
    if (!f.role && /role:/i.test(route())) {
      issues.push('Открыт role-route, но в flow нет role');
    }
    if ((f.onboardingDone || f.onboardingCompleted) && !done.onboarding_done_v1) {
      issues.push('В flow onboarding завершён, но внешний localStorage флаг не выставлен');
    }
    if (D.querySelector('.onb2-overlay') && /address|contact|verify|account|profile|vehicle|permissions|review|done/i.test(route())) {
      issues.push('На новом onboarding route остался старый .onb2-overlay');
    }

    return {
      route: route(),
      assetVersion: '20260518onboarding-live',
      flow: f,
      done,
      currentOnboardingNode: D.querySelector('[data-onb-step]')?.getAttribute('data-onb-step') || null,
      oldOverlayPresent: !!D.querySelector('.onb2-overlay'),
      issues
    };
  }
  function clearAll(){
    try { localStorage.removeItem(FLOW_KEY); } catch(_e) {}
    DONE_KEYS.forEach(k=>{ try { localStorage.removeItem(k); } catch(_e) {} });
    try { sessionStorage.removeItem('kareta_onb_verify_code'); } catch(_e) {}
    try { sessionStorage.removeItem('kareta_onb_password_entered'); } catch(_e) {}
    console.info('[KARETA onboarding] reset done. Reload #home.');
    location.hash = '#home';
    setTimeout(()=>location.reload(), 80);
  }
  function forceDone(role){
    role = q(role || getFlow().role || 'client') || 'client';
    const completedAt = new Date().toISOString();
    const flow = Object.assign({}, getFlow(), {
      role,
      onboardingCompleted:true,
      onboardingDone:true,
      doneDone:true,
      completedAt,
      onboardingVersion:'20260518onboarding-live'
    });
    try { localStorage.setItem(FLOW_KEY, JSON.stringify(flow)); } catch(_e) {}
    try { localStorage.setItem('kareta_onboarding_done_v1', '1'); } catch(_e) {}
    try { localStorage.setItem('kareta.entry.done.v2', '1'); } catch(_e) {}
    try { localStorage.setItem('kareta_onboarding_completed_at', completedAt); } catch(_e) {}
    console.info('[KARETA onboarding] forced done', flow);
    location.hash = '#home';
    setTimeout(()=>location.reload(), 80);
  }
  function renderDebug(){
    const root = D.getElementById('app') || D.getElementById('root') || D.body;
    const a = analyze();
    const rows = expectedSteps().map(([key,label])=>{
      const active = a.currentOnboardingNode === key || a.route.includes(key);
      return `<div class="onb-live-step ${active ? 'is-active' : ''}">
        <span>${esc(label)}</span>
        <b>${active ? 'текущий' : '—'}</b>
      </div>`;
    }).join('');

    root.innerHTML = `
      <main class="onb-live-screen">
        <section class="onb-live-card">
          <header class="onb-live-head">
            <button type="button" onclick="location.hash='#home'" aria-label="Назад">‹</button>
            <div>
              <div class="onb-live-kicker">ONBOARDING-LIVE</div>
              <h1>Диагностика первого входа</h1>
              <p>Проверка маршрутов, localStorage-флагов и старого overlay без изменения БД/API.</p>
            </div>
          </header>

          <div class="onb-live-summary">
            <div><span>Route</span><b>${esc(a.route)}</b></div>
            <div><span>Asset</span><b>${esc(a.assetVersion)}</b></div>
            <div><span>Current step</span><b>${esc(a.currentOnboardingNode || '—')}</b></div>
            <div><span>Old overlay</span><b>${a.oldOverlayPresent ? 'есть' : 'нет'}</b></div>
          </div>

          ${a.issues.length ? `<div class="onb-live-issues"><b>Проблемы:</b>${a.issues.map(i=>`<span>${esc(i)}</span>`).join('')}</div>` : `<div class="onb-live-ok">Критичных конфликтов в текущем состоянии не найдено.</div>`}

          <section class="onb-live-section">
            <h2>Цепочка r1–r15</h2>
            <div class="onb-live-steps">${rows}</div>
          </section>

          <section class="onb-live-section">
            <h2>Флаги завершения</h2>
            <pre>${esc(JSON.stringify(a.done, null, 2))}</pre>
          </section>

          <section class="onb-live-section">
            <h2>Flow snapshot</h2>
            <pre>${esc(JSON.stringify(a.flow, null, 2))}</pre>
          </section>

          <div class="onb-live-actions">
            <button type="button" onclick="KaretaOnboardingLive.reset()">Сбросить onboarding</button>
            <button type="button" onclick="KaretaOnboardingLive.forceDone()">Принудительно завершить</button>
            <button type="button" onclick="location.hash='#home'">На главную</button>
          </div>
        </section>
      </main>`;
  }
  function isDebugRoute(){
    const h = q(location.hash).replace(/^#/, '');
    return h === 'onboarding-debug' || h === 'debug:onboarding';
  }
  function intercept(){
    if (!isDebugRoute()) return false;
    renderDebug();
    return true;
  }

  W.KaretaOnboardingLive = {
    inspect: analyze,
    reset: clearAll,
    forceDone,
    debug: renderDebug
  };

  W.addEventListener('hashchange', intercept);
  D.addEventListener('DOMContentLoaded', intercept);

  if (__ONB_DEV__) console.info('[KARETA onboarding live]', analyze());
})();


/* ONBOARDING-LIVE — route matrix and self-test helpers */
(function(){
  'use strict';
  const W = window;
  const D = document;

  function q(v){ return String(v == null ? '' : v); }
  function esc(v){
    return q(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function getFlow(){
    try { return JSON.parse(localStorage.getItem('kareta_entry_flow_v1') || '{}') || {}; }
    catch(_e){ return {}; }
  }
  function saveFlow(patch){
    const next = Object.assign({}, getFlow(), patch || {});
    try { localStorage.setItem('kareta_entry_flow_v1', JSON.stringify(next)); } catch(_e) {}
    return next;
  }
  function seed(role){
    role = q(role || 'client') || 'client';
    const seeded = Object.assign({}, getFlow(), {
      role,
      city:'Усть-Каменогорск',
      cityName:'Усть-Каменогорск',
      address:'Тестовый адрес',
      district:'Тестовый ориентир',
      phone:'+77770000000',
      contactPhone:'+77770000000',
      contactMethod:'phone',
      smsVerified:true,
      accountName: role === 'sto' ? 'Тестовое СТО' : (role === 'master' ? 'Тестовый мастер' : 'Тестовый клиент'),
      name: role === 'sto' ? 'Тестовое СТО' : (role === 'master' ? 'Тестовый мастер' : 'Тестовый клиент'),
      accountLogin:'+77770000000',
      profileSpecialization: role === 'client' ? 'Диагностика и ремонт' : 'Диагностика',
      specialization: role === 'client' ? 'Диагностика и ремонт' : 'Диагностика',
      profileArea:'Центр',
      vehicleMake:'Toyota',
      vehicleModel:'Camry',
      vehicleYear:'2020',
      vehicleLabel:'Toyota Camry 2020',
      permissions:{ location:true, notifications:true, files:false, chat:true },
      permissionLocation:true,
      permissionNotifications:true,
      permissionFiles:false,
      permissionChat:true,
      seededForLiveTest:true,
      seededAt:new Date().toISOString()
    });
    try { localStorage.setItem('kareta_entry_flow_v1', JSON.stringify(seeded)); } catch(_e) {}
    try { sessionStorage.setItem('kareta_onb_verify_code', '1111'); } catch(_e) {}
    return seeded;
  }

  const matrix = [
    { key:'home', label:'Start #home', hash:'#home', expected:'welcome или app' },
    { key:'debug', label:'Диагностика', hash:'#onboarding-debug', expected:'debug' },
    { key:'role', label:'Выбор роли', hash:'#role:client', expected:'role' },
    { key:'city', label:'Выбор города', hash:'#role:client:city', expected:'city' },
    { key:'city-search', label:'Поиск города', hash:'#role:client:city-search', expected:'city-search' },
    { key:'address', label:'Адрес', hash:'#role:client:address', expected:'address' },
    { key:'contact', label:'Контакты', hash:'#role:client:contact', expected:'contact' },
    { key:'verify', label:'Код', hash:'#role:client:verify', expected:'verify' },
    { key:'account', label:'Аккаунт', hash:'#role:client:account', expected:'account' },
    { key:'profile', label:'Профиль', hash:'#role:client:profile', expected:'profile' },
    { key:'vehicle', label:'Автомобиль', hash:'#role:client:vehicle', expected:'vehicle' },
    { key:'permissions', label:'Разрешения', hash:'#role:client:permissions', expected:'permissions' },
    { key:'review', label:'Проверка данных', hash:'#role:client:review', expected:'review' },
    { key:'done', label:'Финал', hash:'#role:client:done', expected:'done' }
  ];

  function currentStep(){
    return D.querySelector('[data-onb-step]')?.getAttribute('data-onb-step') || null;
  }

  function openRoute(hash, role){
    seed(role || 'client');
    location.hash = hash;
  }

  async function selfTest(role){
    role = role || 'client';
    seed(role);
    const results = [];
    for (const item of matrix.filter(x => x.key !== 'debug' && x.key !== 'home')) {
      const hash = item.hash.replace(':client', ':' + role);
      location.hash = hash;
      await new Promise(resolve => setTimeout(resolve, 140));
      const step = currentStep();
      const oldOverlay = !!D.querySelector('.onb2-overlay');
      const ok = item.expected === step || (item.key === 'role' && (step === 'role' || D.querySelector('.onb2-overlay')));
      results.push({
        route: hash,
        expected: item.expected,
        actual: step || (oldOverlay ? 'old-overlay' : 'none'),
        oldOverlay,
        ok: !!ok && !(/address|contact|verify|account|profile|vehicle|permissions|review|done/.test(item.key) && oldOverlay)
      });
    }
    try { sessionStorage.setItem('kareta_onb_live_selftest', JSON.stringify(results)); } catch(_e) {}
    console.table(results);
    location.hash = '#onboarding-debug';
    setTimeout(() => {
      try { W.KaretaOnboardingLive?.debug?.(); } catch(_e) {}
    }, 80);
    return results;
  }

  function renderMatrixBlock(){
    const role = q(getFlow().role || 'client') || 'client';
    const last = (() => {
      try { return JSON.parse(sessionStorage.getItem('kareta_onb_live_selftest') || '[]'); }
      catch(_e){ return []; }
    })();
    const rows = matrix.map(item => {
      const hash = item.hash.replace(':client', ':' + role);
      const result = last.find(r => r.route === hash);
      const status = result ? (result.ok ? 'ok' : 'bad') : '';
      const statusText = result ? (result.ok ? 'OK' : `${result.actual}`) : '—';
      return `<button type="button" class="onb-live-route ${status ? 'is-'+status : ''}" data-live-open="${esc(hash)}">
        <span>${esc(item.label)}</span>
        <small>${esc(hash)}</small>
        <b>${esc(statusText)}</b>
      </button>`;
    }).join('');

    return `<section class="onb-live-section onb-live-matrix" data-live-matrix>
      <h2>Route matrix r1–r15</h2>
      <div class="onb-live-role">
        <button type="button" data-live-role="client" class="${role==='client'?'is-active':''}">client</button>
        <button type="button" data-live-role="master" class="${role==='master'?'is-active':''}">master</button>
        <button type="button" data-live-role="sto" class="${role==='sto'?'is-active':''}">sto</button>
      </div>
      <div class="onb-live-routes">${rows}</div>
      <div class="onb-live-actions onb-live-actions--matrix">
        <button type="button" data-live-selftest>Запустить self-test</button>
        <button type="button" data-live-seed>Заполнить test-flow</button>
      </div>
    </section>`;
  }

  function injectMatrix(){
    if (!location.hash || !/onboarding-debug|debug:onboarding/.test(location.hash)) return;
    const card = D.querySelector('.onb-live-card');
    if (!card || D.querySelector('[data-live-matrix]')) return;
    const firstSection = card.querySelector('.onb-live-section');
    if (firstSection) firstSection.insertAdjacentHTML('beforebegin', renderMatrixBlock());
    bindMatrix();
  }

  function bindMatrix(){
    D.querySelectorAll('[data-live-open]').forEach(btn => {
      btn.addEventListener('click', () => openRoute(btn.dataset.liveOpen, getFlow().role || 'client'));
    });
    D.querySelectorAll('[data-live-role]').forEach(btn => {
      btn.addEventListener('click', () => {
        seed(btn.dataset.liveRole || 'client');
        location.hash = '#onboarding-debug';
        setTimeout(() => {
          try { W.KaretaOnboardingLive?.debug?.(); } catch(_e) {}
        }, 80);
      });
    });
    D.querySelector('[data-live-selftest]')?.addEventListener('click', () => selfTest(getFlow().role || 'client'));
    D.querySelector('[data-live-seed]')?.addEventListener('click', () => {
      seed(getFlow().role || 'client');
      location.hash = '#onboarding-debug';
      setTimeout(() => {
        try { W.KaretaOnboardingLive?.debug?.(); } catch(_e) {}
      }, 80);
    });
  }

  const prev = W.KaretaOnboardingLive || {};
  W.KaretaOnboardingLive = Object.assign(prev, {
    seed,
    selfTest,
    routes: matrix,
    openRoute
  });

  D.addEventListener('DOMContentLoaded', () => setTimeout(injectMatrix, 120));
  W.addEventListener('hashchange', () => setTimeout(injectMatrix, 120));

  // Patch debug render after it draws.
  const timer = setInterval(() => {
    if (location.hash && /onboarding-debug|debug:onboarding/.test(location.hash)) injectMatrix();
  }, 600);
  setTimeout(() => clearInterval(timer), 7000);
})();



/* ONBOARDING-LIVE — fallback guard and diagnostic report export */
(function(){
  'use strict';
  const W = window;
  const D = document;

  const ROUTE_TO_RENDERER = {
    address: 'renderOnboardingAddressGeo',
    contact: 'renderOnboardingContact',
    verify: 'renderOnboardingVerify',
    account: 'renderOnboardingAccount',
    profile: 'renderOnboardingProfile',
    vehicle: 'renderOnboardingVehicle',
    permissions: 'renderOnboardingPermissions',
    review: 'renderOnboardingReview',
    done: 'renderOnboardingDone'
  };

  function q(v){ return String(v == null ? '' : v); }
  function esc(v){
    return q(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function getFlow(){
    try { return JSON.parse(localStorage.getItem('kareta_entry_flow_v1') || '{}') || {}; }
    catch(_e){ return {}; }
  }
  function currentRoute(){
    return q(location.hash || '#home');
  }
  function routeStep(){
    const h = currentRoute().replace(/^#/, '');
    const m = h.match(/^role(?::[^:]+)?:(address|contact|verify|account|profile|vehicle|permissions|review|done)$/i);
    return m ? m[1].toLowerCase() : '';
  }
  function currentStep(){
    return D.querySelector('[data-onb-step]')?.getAttribute('data-onb-step') || null;
  }
  function oldOverlayPresent(){
    return !!D.querySelector('.onb2-overlay');
  }
  function clearOldOverlayForNewStep(){
    const step = routeStep();
    if (!step) return;
    D.querySelectorAll('.onb2-overlay').forEach(el => {
      try { el.remove(); } catch(_e) {}
    });
  }
  function showFallback(step, reason){
    const root = D.getElementById('app') || D.getElementById('root') || D.body;
    root.innerHTML = `
      <main class="onb-live-fallback-screen" data-onb-step="fallback">
        <section class="onb-live-fallback-card">
          <div class="onb-live-fallback-kicker">ONBOARDING-LIVE</div>
          <h1>Экран не открылся</h1>
          <p>Маршрут найден, но renderer шага не смог отрисовать экран. Это защитный экран вместо пустой страницы.</p>
          <div class="onb-live-fallback-box">
            <span>Route</span><b>${esc(currentRoute())}</b>
            <span>Step</span><b>${esc(step || 'unknown')}</b>
            <span>Reason</span><b>${esc(reason || 'unknown')}</b>
          </div>
          <button type="button" onclick="location.hash='#onboarding-debug'">Открыть диагностику</button>
          <button type="button" onclick="location.hash='#home'">На главную</button>
        </section>
      </main>`;
  }
  function tryFallbackRender(){
    const step = routeStep();
    if (!step) return false;

    clearOldOverlayForNewStep();

    setTimeout(() => {
      const active = currentStep();
      if (active === step) return;
      if (active && active !== 'fallback') return;

      const rendererName = ROUTE_TO_RENDERER[step];
      const renderer = rendererName && W[rendererName];
      if (typeof renderer === 'function'){
        try {
          renderer();
          setTimeout(() => {
            if (currentStep() !== step) showFallback(step, 'renderer_called_but_step_not_found');
          }, 80);
        } catch(err){
          console.error('[KARETA onboarding fallback] renderer failed', step, err);
          showFallback(step, 'renderer_exception');
        }
      } else {
        console.warn('[KARETA onboarding fallback] missing renderer', step, rendererName);
        showFallback(step, 'missing_renderer_' + rendererName);
      }
    }, 180);

    return true;
  }
  function buildReport(){
    const inspect = W.KaretaOnboardingLive?.inspect?.() || {};
    let selftest = [];
    try { selftest = JSON.parse(sessionStorage.getItem('kareta_onb_live_selftest') || '[]'); }
    catch(_e) { selftest = []; }

    return {
      generatedAt: new Date().toISOString(),
      assetVersion: '20260518onboarding-live',
      userAgent: navigator.userAgent,
      href: location.href,
      route: currentRoute(),
      currentStep: currentStep(),
      oldOverlayPresent: oldOverlayPresent(),
      flow: getFlow(),
      inspect,
      selftest,
      localStorageFlags: {
        kareta_onboarding_done_v1: localStorage.getItem('kareta_onboarding_done_v1'),
        kareta_entry_done_v2: localStorage.getItem('kareta.entry.done.v2'),
        kareta_onboarding_completed_at: localStorage.getItem('kareta_onboarding_completed_at')
      }
    };
  }
  function downloadReport(){
    const report = buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = D.createElement('a');
    a.href = url;
    a.download = 'kareta-onboarding-live-report.json';
    D.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch(_e) {}
      try { a.remove(); } catch(_e) {}
    }, 500);
    return report;
  }
  function copyReport(){
    const text = JSON.stringify(buildReport(), null, 2);
    if (navigator.clipboard?.writeText){
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
  }
  function injectReportButtons(){
    if (!/onboarding-debug|debug:onboarding/.test(currentRoute())) return;
    const actions = D.querySelector('.onb-live-actions');
    if (!actions || D.querySelector('[data-live-report-actions]')) return;
    const wrap = D.createElement('div');
    wrap.className = 'onb-live-report-actions';
    wrap.dataset.liveReportActions = '1';
    wrap.innerHTML = `
      <button type="button" data-live-copy-report>Скопировать отчёт</button>
      <button type="button" data-live-download-report>Скачать JSON-отчёт</button>
      <button type="button" data-live-fallback-check>Проверить fallback</button>
    `;
    actions.parentNode.insertBefore(wrap, actions);

    wrap.querySelector('[data-live-copy-report]')?.addEventListener('click', async () => {
      const ok = await copyReport();
      alert(ok ? 'Отчёт скопирован' : 'Не удалось скопировать. Используй скачать JSON.');
    });
    wrap.querySelector('[data-live-download-report]')?.addEventListener('click', () => downloadReport());
    wrap.querySelector('[data-live-fallback-check]')?.addEventListener('click', () => {
      const step = routeStep();
      if (!step) alert('Текущий route не является новым onboarding-step.');
      else tryFallbackRender();
    });
  }

  const prev = W.KaretaOnboardingLive || {};
  W.KaretaOnboardingLive = Object.assign(prev, {
    fallbackCheck: tryFallbackRender,
    report: buildReport,
    downloadReport,
    copyReport,
    clearOldOverlay: clearOldOverlayForNewStep
  });

  W.addEventListener('hashchange', () => {
    clearOldOverlayForNewStep();
    tryFallbackRender();
    setTimeout(injectReportButtons, 220);
  });
  D.addEventListener('DOMContentLoaded', () => {
    clearOldOverlayForNewStep();
    tryFallbackRender();
    setTimeout(injectReportButtons, 260);
  });
  setInterval(injectReportButtons, 1200);
})();

