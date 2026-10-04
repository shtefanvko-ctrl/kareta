/* KARETA R188.5.5.6.84.85 GENERATED BOOT BUNDLE — source order preserved. */
window.KaretaBootProfiler?.bundleStart?.("runtime_onboarding_bundle","js/boot/runtime_onboarding_bundle.js");

/* SOURCE: js/next/welcome_background.js */
(() => {
  'use strict';

  const DEFAULT_MANIFEST = '/assets/onboarding/backgrounds/welcome/manifest.json';
  const state = {
    manifest:null,
    manifestUrl:'',
    currentImageUrl:'',
    currentSourceKey:'',
    resizeTimer:0,
    resizeBound:false,
  };

  const resolveUrl = (path, base) => new URL(String(path || ''), base).href;
  const viewportSource = selection => {
    const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 1);
    const ratio = width / Math.max(1, height);
    if (width <= Number(selection?.mobileMaxWidth || 767)) return 'mobile';
    if (ratio <= Number(selection?.narrowMaxAspectRatio || 1.45)) return 'desktopNarrow';
    if (ratio >= Number(selection?.ultrawideMinAspectRatio || 2)) return 'desktopUltrawide';
    return 'desktopStandard';
  };

  const preload = url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error(`Welcome background failed: ${url}`));
    image.src = url;
  });

  const activeTheme = manifest => manifest?.themes?.[manifest?.activeTheme] || manifest?.themes?.[manifest?.fallbackTheme] || null;

  async function apply(root = document.documentElement){
    if (!state.manifest) throw new Error('Welcome background manifest is not loaded');
    const theme = activeTheme(state.manifest);
    if (!theme) throw new Error('Welcome background active/fallback theme is missing');
    const sourceKey = viewportSource(state.manifest.selection || {});
    const relative = theme.sources?.[sourceKey] || theme.sources?.desktopStandard || theme.sources?.mobile;
    if (!relative) throw new Error('Welcome background source is missing');
    const imageUrl = resolveUrl(relative, state.manifestUrl);
    const position = theme.position?.[sourceKey] || 'center center';
    if (state.currentImageUrl !== imageUrl) await preload(imageUrl);
    root.style.setProperty('--k-welcome-background-image', `url("${imageUrl}")`);
    root.style.setProperty('--k-welcome-background-position', position);
    root.dataset.welcomeBackgroundTheme = String(state.manifest.activeTheme || state.manifest.fallbackTheme || '');
    root.dataset.welcomeBackgroundSource = sourceKey;
    state.currentImageUrl = imageUrl;
    state.currentSourceKey = sourceKey;
    return imageUrl;
  }

  function bindResize(){
    if (state.resizeBound) return;
    state.resizeBound = true;
    window.addEventListener('resize', () => {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(() => {
        apply().catch(error => console.warn('[KARETA welcome background]', error));
      }, 150);
    }, { passive:true });
  }

  async function init(options = {}){
    const manifestUrl = resolveUrl(options.manifestUrl || DEFAULT_MANIFEST, document.baseURI);
    state.manifestUrl = manifestUrl;
    const response = await fetch(manifestUrl, { cache:'no-cache', credentials:'same-origin' });
    if (!response.ok) throw new Error(`Welcome manifest HTTP ${response.status}`);
    state.manifest = await response.json();
    const imageUrl = await apply(options.root || document.documentElement);
    bindResize();
    window.dispatchEvent(new CustomEvent('kareta:welcome-background-ready', { detail:{ ok:true, imageUrl } }));
    return imageUrl;
  }

  const ready = init().catch(error => {
    document.documentElement.style.setProperty('--k-welcome-background-image', 'none');
    console.warn('[KARETA welcome background]', error);
    window.dispatchEvent(new CustomEvent('kareta:welcome-background-ready', { detail:{ ok:false, error:String(error?.message || error) } }));
    return '';
  });

  window.KaretaWelcomeBackground = Object.freeze({ init, refresh:() => apply(), ready, snapshot:() => ({ ...state }) });
})();
;

/* SOURCE: js/next/error_403_background.js */
(() => {
  'use strict';

  const DEFAULT_MANIFEST = '/assets/errors/403/manifest.json';
  const resolveUrl = (path, base) => new URL(String(path || ''), base).href;
  const preload = url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error(`403 background failed: ${url}`));
    image.src = url;
  });

  async function init(options = {}){
    const root = options.root || document.querySelector('[data-kareta-403]');
    if (!root) return '';
    const manifestUrl = resolveUrl(options.manifestUrl || DEFAULT_MANIFEST, document.baseURI);
    const response = await fetch(manifestUrl, { cache:'no-cache', credentials:'same-origin' });
    if (!response.ok) throw new Error(`403 background manifest HTTP ${response.status}`);
    const manifest = await response.json();
    const key = String(options.background || manifest.activeBackground || '');
    const item = manifest.backgrounds?.[key] || manifest.backgrounds?.[manifest.fallbackBackground];
    if (!item?.path) throw new Error('403 background is missing');
    const imageUrl = resolveUrl(item.path, manifestUrl);
    await preload(imageUrl);
    root.style.setProperty('--k-403-background-image', `url("${imageUrl}")`);
    root.style.setProperty('--k-403-background-position', item.position || 'center center');
    root.style.setProperty('--k-403-background-fit', manifest.fit || 'cover');
    root.dataset.kareta403Background = key;
    return imageUrl;
  }

  window.Kareta403Background = Object.freeze({ init });
  const auto = () => {
    const root = document.querySelector('[data-kareta-403]');
    if (root) init({ root }).catch(error => console.warn('[KARETA 403 background]', error));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto, { once:true });
  else auto();
})();
;

/* SOURCE: js/next/onboarding/onboarding_state.js */
(() => {
  'use strict';

  const FLOW_KEY = 'kareta_entry_flow_v1';
  const DONE_KEYS = Object.freeze(['kareta.entry.done.v2','kareta_onboarding_done_v1','kareta_onb_done']);
  const ROLES = Object.freeze(['client','master','sto','seller']);
  const listeners = new Set();

  function safeParse(value){
    try { return JSON.parse(value || '{}') || {}; } catch (_error) { return {}; }
  }
  function read(){
    try { return safeParse(localStorage.getItem(FLOW_KEY)); } catch (_error) { return {}; }
  }
  function role(value){
    const normalized = String(value || '').toLowerCase();
    return ROLES.includes(normalized) ? normalized : 'client';
  }
  function emit(next, previous){
    listeners.forEach(listener => { try { listener(next, previous); } catch (_error) {} });
    window.dispatchEvent(new CustomEvent('kareta:onboarding-state', { detail:next }));
  }
  function write(patch = {}){
    const previous = read();
    const next = Object.freeze({ ...previous, ...patch, role:role(patch.role || previous.role), updatedAt:new Date().toISOString() });
    try { localStorage.setItem(FLOW_KEY, JSON.stringify(next)); } catch (_error) {}
    emit(next, previous);
    return next;
  }
  function isDone(){
    const flow = read();
    try {
      const marker = DONE_KEYS.some(key => localStorage.getItem(key) === '1');
      if (!marker) return false;
      if (flow.onboardingCompleted === true && flow.serverConfirmed === true) return true;

      // Compatibility for users completed before FLOW_KEY became authoritative.
      // A lone legacy marker is not enough: require persisted confirmed-user evidence.
      const completedAt = String(localStorage.getItem('kareta_onboarding_completed_at') || '');
      const cached = safeParse(localStorage.getItem('kareta.auth.user'));
      const confirmedUser = !!String(cached?.phone || '').replace(/\D/g,'');
      return !!completedAt && confirmedUser;
    } catch (_error) { return false; }
  }
  function markPending(step){
    return write({ pending:true, stage:String(step || 'role'), onboardingCompleted:false, onboardingDone:false, serverConfirmed:false });
  }
  function markComplete(serverResult = {}){
    const completedAt = new Date().toISOString();
    const next = write({ pending:false, stage:'done', onboardingCompleted:true, onboardingDone:true, doneDone:true, serverConfirmed:true, serverConfirmedAt:completedAt, completedAt, serverResult });
    try {
      DONE_KEYS.forEach(key => localStorage.setItem(key, '1'));
      localStorage.setItem('kareta_onboarding_completed_at', completedAt);
      localStorage.setItem('kareta_role', role(next.role));
    } catch (_error) {}
    return next;
  }
  function reset(){
    const previous = read();
    try { localStorage.removeItem(FLOW_KEY); DONE_KEYS.forEach(key => localStorage.removeItem(key)); } catch (_error) {}
    emit({}, previous);
  }
  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.KaretaOnboardingState = Object.freeze({ read, write, role, isDone, markPending, markComplete, reset, subscribe, FLOW_KEY, DONE_KEYS, ROLES });
})();
;

/* SOURCE: js/next/onboarding/onboarding_profile_draft.js */
(() => {
  'use strict';

  const state = window.KaretaOnboardingState;
  if (!state) throw new Error('KaretaOnboardingState is required');

  const listeners = new Set();
  const ARRAY_FIELDS = Object.freeze(['specTags', 'serviceTags']);

  function copy(value){
    if (!value || typeof value !== 'object') return {};
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return { ...value }; }
  }

  function cleanString(value){ return String(value == null ? '' : value).trim(); }

  function cleanList(value){
    const source = Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
    return Array.from(new Set(source.map(cleanString).filter(Boolean)));
  }

  function normalizePatch(patch = {}, previous = state.read()){
    const rawRole = patch.role || patch.entryRole || previous.role || previous.entryRole || 'client';
    const next = { ...patch, role:state.role(rawRole), entryRole:state.role(rawRole) };
    ARRAY_FIELDS.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(patch, field)) next[field] = cleanList(patch[field]);
    });
    if (Object.prototype.hasOwnProperty.call(patch, 'city')) next.city = cleanString(patch.city);
    if (Object.prototype.hasOwnProperty.call(patch, 'brand')) next.brand = cleanString(patch.brand);
    if (Object.prototype.hasOwnProperty.call(patch, 'phone')) next.phone = cleanString(patch.phone);
    if (Object.prototype.hasOwnProperty.call(patch, 'stage')) next.stage = cleanString(patch.stage) || 'role';
    return next;
  }

  function read(){ return copy(state.read()); }

  function emit(next, previous, meta){
    const detail = Object.freeze({ next:copy(next), previous:copy(previous), meta:Object.freeze({ ...(meta || {}) }) });
    listeners.forEach(listener => { try { listener(detail); } catch (_error) {} });
    window.dispatchEvent(new CustomEvent('kareta:onboarding-draft', { detail }));
  }

  function patch(values = {}, meta = {}){
    const previous = state.read();
    const normalized = normalizePatch(values, previous);
    const next = state.write({
      ...normalized,
      draftRevision:Number(previous.draftRevision || 0) + 1,
      draftSource:cleanString(meta.source || normalized.draftSource || 'unknown') || 'unknown',
      draftUpdatedAt:new Date().toISOString()
    });
    emit(next, previous, meta);
    return copy(next);
  }

  function replace(values = {}, meta = {}){
    const previous = state.read();
    const normalized = normalizePatch(values, {});
    const next = state.write({
      ...normalized,
      draftRevision:Number(previous.draftRevision || 0) + 1,
      draftSource:cleanString(meta.source || 'replace') || 'replace',
      draftUpdatedAt:new Date().toISOString()
    });
    emit(next, previous, meta);
    return copy(next);
  }

  function setRole(value, meta = {}){
    const role = state.role(value);
    return patch({ role, entryRole:role, pending:true }, { source:meta.source || 'role-selection' });
  }

  function setStage(stage, meta = {}){
    const values = { stage:cleanString(stage) || 'role', pending:true };
    if (meta.surface) values.flowSurface = cleanString(meta.surface);
    return patch(values, { source:meta.source || 'stage-change' });
  }

  function currentRole(){
    const flow = state.read();
    return state.role(flow.role || flow.entryRole || window._karetaCookieRole || 'client');
  }

  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function audit(){
    const flow = state.read();
    return {
      ok:true,
      role:currentRole(),
      stage:String(flow.stage || 'role'),
      revision:Number(flow.draftRevision || 0),
      source:String(flow.draftSource || ''),
      completed:state.isDone(),
      keys:Object.keys(flow).sort()
    };
  }

  const api = Object.freeze({ read, patch, replace, setRole, setStage, currentRole, subscribe, audit });
  window.KaretaOnboardingProfileDraft = api;

  // Compatibility contract for page modules migrated from the legacy app.js globals.
  window.getEntryFlow = read;
  window.setEntryFlow = function(values){ return patch(values, { source:'legacy-global' }); };
})();
;

/* SOURCE: js/next/onboarding/onboarding_router.js */
(() => {
  'use strict';
  const state = window.KaretaOnboardingState;
  if (!state) throw new Error('KaretaOnboardingState is required');

  const STEPS = Object.freeze(['welcome','role','profile','code']);
  const LEGACY_PREFIXES = Object.freeze(['role','onboarding','entry']);
  const LEGACY_PROFILE_STEPS = new Set(['quick','desc','spec','city','city-search','address','contact','verify','account','vehicle','permissions','review','done']);

  function normalizeStep(value, prefix){
    const step = String(value || 'role').toLowerCase();
    if (STEPS.includes(step)) return step;
    if (step === 'welcome') return 'welcome';
    if (['benefits','transparency'].includes(step)) return 'role';
    if (LEGACY_PROFILE_STEPS.has(step)) return 'profile';
    return 'role';
  }

  function parse(hashValue = location.hash){
    const raw = String(hashValue || '').replace(/^#/,'').replace(/^\//,'').trim();
    if (!raw) return null;
    const parts = raw.split(':').filter(Boolean);
    const prefix = parts.shift()?.toLowerCase();
    if (!LEGACY_PREFIXES.includes(prefix)) return null;
    let role = state.role(parts[0]);
    if (state.ROLES.includes(String(parts[0] || '').toLowerCase())) parts.shift();
    const step = normalizeStep(parts.shift(), prefix);
    return { role, step, raw };
  }

  function isOnboarding(hashValue = location.hash){ return !!parse(hashValue); }
  function canonical(role, step){ return '#role:' + state.role(role) + ':' + normalizeStep(step, 'role'); }
  function navigate(role, step, options = {}) {
    const navigation = window.KaretaOnboardingNavigation;
    if (navigation?.to) return navigation.to(step, { ...options, role, source:options.source || 'router-compat' });
    const target = canonical(role, step);
    history[options.replace ? 'replaceState' : 'pushState'](null, '', target);
    try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (_error) {}
    return target;
  }
  function resumeRoute(){
    const flow = state.read();
    const step = STEPS.includes(flow.stage) ? flow.stage : (flow.roleSetupDone ? 'profile' : 'welcome');
    return canonical(flow.role, step);
  }
  window.KaretaOnboardingRouter = Object.freeze({ STEPS, parse, isOnboarding, canonical, navigate, resumeRoute });
})();
;

/* SOURCE: js/next/onboarding/onboarding_navigation.js */
(() => {
  'use strict';

  const router = window.KaretaOnboardingRouter;
  const draft = window.KaretaOnboardingProfileDraft;
  if (!router || !draft) throw new Error('Onboarding router/draft are required before navigation');

  let navigationCount = 0;
  let lastNavigation = null;

  function currentRole(){ return draft.currentRole(); }
  function surfaceFor(){ return 'overlay'; }

  function commit(step, options = {}){
    const safeStep = router.STEPS.includes(String(step || '').toLowerCase()) ? String(step).toLowerCase() : 'role';
    const role = window.KaretaOnboardingState?.role(options.role || currentRole()) || 'client';
    const surface = surfaceFor(safeStep);
    const target = router.canonical(role, safeStep);

    draft.patch({ role, entryRole:role, stage:safeStep, flowSurface:surface, pending:true }, {
      source:options.source || `navigation:${safeStep}`
    });

    try {
      if (options.replace) history.replaceState(null, '', target);
      else history.pushState(null, '', target);
    } catch (_error) {
      location.hash = target;
      return target;
    }

    navigationCount += 1;
    lastNavigation = Object.freeze({ target, role, step:safeStep, surface, replace:!!options.replace, source:String(options.source || '') });

    const lifecycle = window.KaretaOnboardingLifecycle;
    if (lifecycle?.dispatch) {
      Promise.resolve().then(() => lifecycle.dispatch(target, { source:options.source || `navigation:${safeStep}`, replace:!!options.replace }));
    } else {
      try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (_error) {}
    }
    return target;
  }

  function to(step, options = {}){ return commit(step, options); }
  function replace(step, options = {}){ return commit(step, { ...options, replace:true }); }
  function current(){ return router.parse(location.hash); }
  function audit(){ return { ok:true, navigationCount, lastNavigation, current:current() }; }

  window.KaretaOnboardingNavigation = Object.freeze({ to, replace, current, currentRole, surfaceFor, audit });
})();
;

/* SOURCE: js/next/onboarding/onboarding_api.js */
(() => {
  'use strict';

  async function parseResponse(response){
    const rawText = await response.text();
    let payload = null;
    try { payload = rawText ? JSON.parse(rawText) : null; } catch (_error) {}
    return { payload, rawText };
  }

  function makeError(response, payload){
    const code = String(payload?.error || '');
    const messages = {
      phone_required:'Укажите номер телефона.',
      name_required:'Укажите имя.',
      invalid_phone:'Проверьте номер телефона.',
      invalid_json:'Сервер не принял данные формы.',
      verification_required:'Сначала запросите код ещё раз.',
      verification_expired:'Код устарел. Отправьте новый код.',
      verification_invalid:'Неверный код из SMS.',
      invalid_code:'Неверный код из SMS.',
      invalid_code_format:'Введите код полностью.',
      challenge_rate_limited:'Слишком много запросов. Попробуйте позже.',
      challenge_attempts_exceeded:'Слишком много попыток. Запросите новый код.',
      otp_delivery_unavailable:'Отправка SMS пока не настроена.',
      otp_delivery_failed:'SMS-провайдер временно недоступен.',
      verification_attempts:'Слишком много попыток. Запросите новый код.',
      profile_save_failed:'Не удалось сохранить основной профиль.',
      database_unavailable:'База данных временно недоступна.',
      server_exception:'Сервер не смог создать аккаунт.',
      php_fatal:'Сервер не смог завершить создание аккаунта.',
      invalid_role:'Выбранная роль не поддерживается.',
      account_blocked:'Аккаунт заблокирован.',
      offline:'Нет соединения с сервером. Проверьте интернет.',
      request_timeout:'Сервер долго не отвечает. Повторите попытку.',
      request_in_progress:'Запрос уже выполняется.'
    };
    const databaseMessages = {
      configuration_missing:'На сервере не настроено подключение к базе данных.',
      pdo_mysql_missing:'На сервере не включён модуль PHP pdo_mysql.',
      credentials_rejected:'MySQL отклонил пользователя, пароль или права доступа.',
      database_not_found:'Указанная база данных не существует.',
      server_unreachable:'Сервер MySQL недоступен по указанному адресу или порту.',
      schema_initialization_failed:'Подключение к MySQL установлено, но обновление структуры базы завершилось ошибкой.',
      connection_failed:'Не удалось установить или подготовить соединение с базой данных.'
    };
    const databaseState = String(payload?.databaseState || '');
    const requestId = String(payload?.requestId || response.headers.get('X-Kareta-Request-Id') || '');
    const retryAfter = Math.max(0, Number(payload?.retryAfter || response.headers.get('Retry-After') || 0) || 0);
    const diagnosticCode = String(payload?.diagnosticCode || '');
    const failureStage = String(payload?.failureStage || '');
    const failedMigrationVersion = Number(payload?.failedMigrationVersion || 0);
    const failureCategory = String(payload?.failureCategory || '');
    const failureSqlState = String(payload?.failureSqlState || '');
    const failureDriverCode = String(payload?.failureDriverCode || '');
    const deliveryCategory = String(payload?.deliveryCategory || '');
    const providerStatus = Number(payload?.providerStatus || 0);
    const deliveryMessages = {
      provider_not_configured:'Отправка SMS на сервере не настроена.',
      provider_auth:'SMS-сервис не прошёл авторизацию на сервере.',
      provider_endpoint:'Адрес SMS-сервиса настроен неверно.',
      provider_rejected_payload:'SMS-сервис отклонил формат запроса.',
      provider_dns:'Сервер не может найти SMS-сервис.',
      provider_connect:'Сервер не может подключиться к SMS-сервису.',
      provider_tls:'Не удалось установить защищённое соединение с SMS-сервисом.',
      provider_timeout:'SMS-сервис не ответил вовремя.',
      provider_rate_limited:'SMS-сервис временно ограничил отправку.',
      provider_unavailable:'SMS-сервис временно недоступен.',
      provider_network:'Ошибка соединения с SMS-сервисом.'
    };
    const deliveryRetry = code === 'otp_delivery_failed' && retryAfter > 0;
    const baseMessage = code === 'challenge_rate_limited' && retryAfter > 0
      ? `Повторный код можно запросить через ${Math.ceil(retryAfter)} сек.`
      : code === 'otp_delivery_unavailable' && deliveryMessages[deliveryCategory]
        ? deliveryMessages[deliveryCategory]
        : code === 'otp_delivery_failed' && deliveryMessages[deliveryCategory]
          ? `${deliveryMessages[deliveryCategory]}${retryAfter > 0 ? ` Повторите через ${Math.ceil(retryAfter)} сек.` : ''}`
          : deliveryRetry
            ? `${messages[code]} Повторите через ${Math.ceil(retryAfter)} сек.`
            : ((code === 'database_unavailable' && databaseMessages[databaseState]) || messages[code] || (response.status >= 500
              ? 'Сервер временно не может обработать регистрацию.'
              : 'Не удалось выполнить запрос. Повторите попытку.'));
    const technical = [];
    if (diagnosticCode) technical.push(`диагностика ${diagnosticCode}`);
    if (failureStage) technical.push(`этап ${failureStage}`);
    if (failedMigrationVersion > 0) technical.push(`migration ${failedMigrationVersion}`);
    if (failureSqlState) technical.push(`SQLSTATE ${failureSqlState}`);
    if (failureDriverCode) technical.push(`MySQL ${failureDriverCode}`);
    if (requestId) technical.push(`запрос ${requestId}`);
    const error = new Error(technical.length ? `${baseMessage} (${technical.join(' · ')})` : baseMessage);
    error.code = code || 'request_failed';
    error.status = response.status;
    error.requestId = requestId;
    error.diagnosticCode = diagnosticCode;
    error.failureStage = failureStage;
    error.failedMigrationVersion = failedMigrationVersion;
    error.failureCategory = failureCategory;
    error.failureSqlState = failureSqlState;
    error.failureDriverCode = failureDriverCode;
    error.databaseState = databaseState;
    error.recoveryAction = String(payload?.recoveryAction || '');
    error.retryAfter = retryAfter;
    error.deliveryCategory = deliveryCategory;
    error.providerStatus = providerStatus;
    return error;
  }

  function shouldUseDedicatedGateway(error){
    const status=Number(error?.status||0);
    // A valid API error is authoritative. Retrying a state-changing OTP action
    // against a second endpoint can duplicate challenges or SMS delivery.
    return error?.invalidResponse===true || [404,405,501].includes(status);
  }

  async function postTo(url, body, options = {}){
    let response;
    const ownController = !options.signal && typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutMs = Math.max(3000, Number(options.timeoutMs || 15000));
    const timeoutId = ownController ? setTimeout(() => ownController.abort(), timeoutMs) : null;
    try {
      response = await fetch(url, {
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
      body:JSON.stringify(body),
      signal:options.signal || ownController?.signal
      });
    } catch (networkError) {
      if (networkError?.name === 'AbortError') {
        throw Object.assign(new Error('Сервер долго не отвечает. Повторите попытку.'), { code:'request_timeout', cause:networkError });
      }
      const error = new Error(navigator.onLine === false
        ? 'Нет соединения с сервером. Проверьте интернет.'
        : 'Не удалось связаться с сервером. Повторите попытку.');
      error.code = navigator.onLine === false ? 'offline' : 'network_error';
      error.cause = networkError;
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    const { payload, rawText } = await parseResponse(response);
    if (!response.ok || !payload || payload.ok !== true) {
      const error = makeError(response, payload);
      error.invalidResponse = !payload || typeof payload !== 'object';
      error.url = url;
      error.rawPreview = String(rawText || '').slice(0, 1200);
      const expectedOtpError=['otp_delivery_failed','otp_delivery_unavailable','challenge_rate_limited'].includes(error.code);
      (expectedOtpError?console.warn:console.error)('[KARETA][onboarding.api]', {
        url, status:response.status, statusText:response.statusText,
        contentType:response.headers.get('content-type') || '',
        requestId:error.requestId || '', diagnosticCode:error.diagnosticCode || '', failureCategory:error.failureCategory || '',
        failureStage:error.failureStage || '', failedMigrationVersion:error.failedMigrationVersion || 0,
        failureSqlState:error.failureSqlState || '', failureDriverCode:error.failureDriverCode || '',
        code:error.code || '', payload, rawPreview:error.rawPreview
      });
      if (error.code === 'database_unavailable') {
        console.error(`[KARETA][DB FAILURE] stage=${error.failureStage || '-'} migration=${error.failedMigrationVersion || 0} diagnostic=${error.diagnosticCode || '-'} sqlState=${error.failureSqlState || '-'} driver=${error.failureDriverCode || '-'}`);
      }
      window.KaretaRuntimeLog?.add('onboarding.api.failure', {
        url, status:response.status, statusText:response.statusText,
        contentType:response.headers.get('content-type') || '',
        requestId:error.requestId || '', code:error.code || '',
        payload, rawPreview:error.rawPreview
      }, expectedOtpError?'warn':'error');
      throw error;
    }
    return payload;
  }

  function payloadFromFlow(flow){
    return {
      role:String(flow.role || 'client'),
      name:String(flow.accountName || flow.name || ''),
      phone:String(flow.phone || flow.contactPhone || ''),
      city:String(flow.city || flow.cityName || ''),
      geo:{ lat:Number(flow.geoLat || 0), lng:Number(flow.geoLng || 0), accuracy:Number(flow.geoAccuracy || 0) },
      profile:{
        specialization:String(flow.profileSpecialization || flow.specialization || ''),
        experience:String(flow.profileExperience || flow.experience || ''),
        area:String(flow.profileArea || flow.workArea || flow.address || ''),
        address:String(flow.address || flow.profileArea || flow.workArea || ''),
        price:String(flow.profilePrice || flow.priceFrom || ''),
        about:String(flow.profileAbout || flow.about || '')
      },
      vehicle:{
        make:String(flow.vehicleMake || flow.brand || ''),
        model:String(flow.vehicleModel || flow.model || ''),
        year:String(flow.vehicleYear || flow.carYear || ''),
        plate:String(flow.vehiclePlate || '')
      },
      seller:{
        storeName:String(flow.storeName || flow.accountName || flow.name || ''),
        binIin:String(flow.binIin || ''),
        warehouseAddress:String(flow.warehouseAddress || flow.address || ''),
        description:String(flow.profileAbout || flow.about || ''),
        assortment:String(flow.profileSpecialization || flow.specialization || ''),
        minimumOrder:String(flow.minimumOrder || ''),
        deliveryModes:Array.isArray(flow.deliveryModes) ? flow.deliveryModes : [],
        paymentMethods:Array.isArray(flow.paymentMethods) ? flow.paymentMethods : [],
        returnDays:Number(flow.returnDays || 14),
        categoryTags:Array.isArray(flow.specTags) ? flow.specTags : []
      },
      onboardingVersion:'20260718-request-correlation-r87'
    };
  }

  function normalizePhone(value){
    const digits = String(value || '').replace(/\D/g,'');
    const normalized = digits.length === 10 ? `7${digits}` : digits;
    return normalized.length === 11 && normalized[0] === '7' ? `+${normalized}` : '';
  }

  let requestCodeFlight = null;
  let verifyCodeFlight = null;
  let confirmFlight = null;
  let lastCodeRequest = { phone:'', at:0, result:null };
  let lastCodeFailure = { phone:'', at:0, until:0, error:null };
  const CODE_REQUEST_COOLDOWN_MS = 2500;
  const CODE_FAILURE_COOLDOWN_MS = 1800;
  let requestAttemptSequence = 0;

  async function requestCode(phone){
    window.KaretaRuntimeLog?.add('onboarding.requestCode.enter', {phoneSuffix:String(phone||'').replace(/\D/g,'').slice(-4)});
    const normalized = normalizePhone(phone);
    if (!normalized) throw Object.assign(new Error('Проверьте номер телефона.'), { code:'invalid_phone' });

    if (requestCodeFlight?.phone === normalized) {
      window.KaretaRuntimeLog?.add('onboarding.requestCode.deduped', {reason:'in_flight', phoneSuffix:normalized.slice(-4)});
      return requestCodeFlight.promise;
    }
    if (lastCodeRequest.phone === normalized && Date.now() - lastCodeRequest.at < CODE_REQUEST_COOLDOWN_MS && lastCodeRequest.result) {
      window.KaretaRuntimeLog?.add('onboarding.requestCode.deduped', {reason:'success_cooldown', phoneSuffix:normalized.slice(-4)});
      return lastCodeRequest.result;
    }
    if (lastCodeFailure.phone === normalized && Date.now() < Number(lastCodeFailure.until || 0) && lastCodeFailure.error) {
      window.KaretaRuntimeLog?.add('onboarding.requestCode.deduped', {
        reason:'failure_cooldown',
        phoneSuffix:normalized.slice(-4),
        retryAfter:Math.max(0,Math.ceil((Number(lastCodeFailure.until||0)-Date.now())/1000))
      }, 'warn');
      throw lastCodeFailure.error;
    }
    const attemptId = `onb_req_${Date.now().toString(36)}_${(++requestAttemptSequence).toString(36)}`;
    const promise = (async () => {
      const requestBody = { action:'onboarding.requestCode', phone:normalized, attemptId };
      let result;
      try {
        window.KaretaRuntimeLog?.add('onboarding.requestCode.primary', {attemptId, endpoint:'/api/auth_session.php'});
        result = await postTo('/api/auth_session.php', requestBody);
      } catch (primaryError) {
        const shouldFallback = shouldUseDedicatedGateway(primaryError);
        if (!shouldFallback) throw primaryError;
        window.KaretaRuntimeLog?.add('onboarding.requestCode.fallback', {
          status:primaryError?.status || 0, code:primaryError?.code || '', requestId:primaryError?.requestId || ''
        }, 'warn');
        console.warn('[KARETA][onboarding] requestCode fallback to dedicated gateway', primaryError);
        result = await postTo('/api/onboarding_code.php', requestBody);
        window.KaretaRuntimeLog?.add('onboarding.requestCode.fallback_success', {attemptId, requestId:result?.requestId || ''});
      }
      try {
        sessionStorage.setItem('kareta_onboarding_demo_phone', normalized);
        sessionStorage.setItem('kareta_onboarding_demo_requested_at', String(Date.now()));
        sessionStorage.removeItem('kareta_onboarding_demo_verified');
      } catch (_error) {}
      window.KaretaRuntimeLog?.add('onboarding.requestCode.success', {attemptId, accountExists:!!result?.accountExists, mode:result?.mode, requestId:result?.requestId || ''});
      lastCodeFailure = { phone:'', at:0, until:0, error:null };
      lastCodeRequest = { phone:normalized, at:Date.now(), result };
      return result;
    })().catch(error => {
      const now=Date.now();
      const serverCooldown=Math.max(0,Number(error?.retryAfter||0))*1000;
      lastCodeFailure = {
        phone:normalized,
        at:now,
        until:now + Math.max(CODE_FAILURE_COOLDOWN_MS,serverCooldown),
        error
      };
      window.KaretaRuntimeLog?.add('onboarding.requestCode.failed', {
        attemptId,
        status:error?.status || 0,
        code:error?.code || '',
        requestId:error?.requestId || '',
        deliveryCategory:error?.deliveryCategory || '',
        providerStatus:error?.providerStatus || 0,
        retryAfter:error?.retryAfter || 0,
        rawPreview:error?.rawPreview || ''
      }, ['otp_delivery_failed','otp_delivery_unavailable','challenge_rate_limited'].includes(String(error?.code||''))?'warn':'error');
      throw error;
    });
    requestCodeFlight = { phone:normalized, promise };
    try { return await promise; }
    finally { if (requestCodeFlight?.promise === promise) requestCodeFlight = null; }
  }

  async function verifyCode(phone, code, expectedLength = 6, entryRole = 'client'){
    window.KaretaRuntimeLog?.add('onboarding.verifyCode.enter', {phoneSuffix:String(phone||'').replace(/\D/g,'').slice(-4)});
    const normalized = normalizePhone(phone);
    const codeLength = Math.min(8, Math.max(4, Number(expectedLength || 6) || 6));
    const cleanCode = String(code || '').replace(/\D/g,'').slice(0,codeLength);
    if (!normalized) throw Object.assign(new Error('Проверьте номер телефона.'), { code:'invalid_phone' });
    if (cleanCode.length !== codeLength) throw Object.assign(new Error(`Введите ${codeLength} цифр кода.`), { code:'verification_invalid' });

    const selectedRole = String(entryRole || 'client').toLowerCase() === 'master' ? 'master' : 'client';
    const flightKey = `${normalized}:${cleanCode}:${selectedRole}`;
    if (verifyCodeFlight?.key === flightKey) return verifyCodeFlight.promise;
    const promise = (async () => {
      const requestBody = { action:'onboarding.verifyCode', phone:normalized, code:cleanCode, entryRole:selectedRole };
      let result;
      try {
        result = await postTo('/api/auth_session.php', requestBody);
      } catch (primaryError) {
        const shouldFallback = shouldUseDedicatedGateway(primaryError);
        if (!shouldFallback) throw primaryError;
        window.KaretaRuntimeLog?.add('onboarding.verifyCode.fallback', {
          status:primaryError?.status || 0, code:primaryError?.code || '', requestId:primaryError?.requestId || ''
        }, 'warn');
        console.warn('[KARETA][onboarding] verifyCode fallback to dedicated gateway', primaryError);
        result = await postTo('/api/onboarding_code.php', requestBody);
      }

      try {
        if (!result?.existingAccount) sessionStorage.setItem('kareta_onboarding_demo_verified', normalized);
        else sessionStorage.removeItem('kareta_onboarding_demo_verified');
      } catch (_error) {}
      return result;
    })();
    verifyCodeFlight = { key:flightKey, promise };
    try { return await promise; }
    finally { if (verifyCodeFlight?.promise === promise) verifyCodeFlight = null; }
  }

  async function confirm(flow, options = {}){
    window.KaretaRuntimeLog?.add('onboarding.confirm.enter', {role:String(flow?.role||''), phoneSuffix:String(flow?.phone||flow?.contactPhone||'').replace(/\D/g,'').slice(-4)});
    const profile = payloadFromFlow(flow);
    const confirmKey = `${normalizePhone(profile.phone)}:${String(profile.role || '')}`;
    if (confirmFlight?.key === confirmKey) return confirmFlight.promise;
    const promise = (async () => {
    let demoVerifiedPhone = '';
    try { demoVerifiedPhone = String(sessionStorage.getItem('kareta_onboarding_demo_verified') || ''); } catch (_error) {}
    if (!demoVerifiedPhone || demoVerifiedPhone !== normalizePhone(profile.phone)) {
      throw Object.assign(new Error('Подтвердите номер кодом из SMS.'), { code:'verification_required' });
    }

    const payload = {
      action:'onboarding.complete',
      profile,
      verification:{ mode:'server-session', phone:demoVerifiedPhone }
    };
    try {
      const result = await postTo('/api/auth_session.php', payload, { ...options, timeoutMs:20000 });
      window.KaretaRuntimeLog?.add('onboarding.confirm.success', {requestId:result?.requestId||'', role:result?.user?.role||''});
      try {
        sessionStorage.removeItem('kareta_onboarding_demo_phone');
        sessionStorage.removeItem('kareta_onboarding_demo_requested_at');
        sessionStorage.removeItem('kareta_onboarding_demo_verified');
      } catch (_error) {}
      return result;
    } catch (error) {
      throw error;
    }
    })();
    confirmFlight = { key:confirmKey, promise };
    try { return await promise; }
    finally { if (confirmFlight?.promise === promise) confirmFlight = null; }
  }

  window.KaretaOnboardingApi = Object.freeze({ confirm, requestCode, verifyCode, payloadFromFlow });
})();
;

/* SOURCE: js/next/onboarding/post_auth_first_entry_resolver.js */
(() => {
  'use strict';
  if (window.KaretaPostAuthFirstEntryResolver) return;

  const normalizeRole = value => {
    const role=String(value||'').trim().toLowerCase();
    return ['client','master','sto','seller'].includes(role)?role:'client';
  };

  function role(result={}, flow={}, user={}){
    return normalizeRole(
      result?.selectedRole || result?.entryRole || result?.identity?.selectedRole || result?.identity?.entryRole ||
      flow?.entryRole || flow?.role || user?.entry_role || user?.role || 'client'
    );
  }

  function postAuth(result={}){
    const value=result?.postAuth || result?.identity?.postAuth;
    return value && typeof value==='object' ? value : null;
  }

  function contextRole(result={}){
    const context=result?.identity?.currentContext || result?.identity?.context || null;
    if(!context)return '';
    const type=String(context.type||context.contextType||'').toLowerCase();
    const profile=String(context.profileType||context.profile_type||'').toLowerCase();
    const organization=String(context.organizationType||context.organization_type||'').toLowerCase();
    if(type==='profile'&&profile==='master')return'master';
    if(type==='profile'&&profile==='seller')return'seller';
    if(type==='organization')return organization==='parts_store'?'seller':'sto';
    if(type==='personal')return'client';
    return'';
  }

  function defaultTarget(role){
    return role==='master'?'#/onboarding/master?step=1&view=master-profile':role==='sto'?'#/sto':role==='seller'?'#/seller':'#/home';
  }

  function resolve(result={}, flow={}, user={}){
    const selectedRole=role(result,flow,user);
    const server=postAuth(result);
    const activeContextRole=contextRole(result);
    let target=String(server?.redirectRoute||'').trim() || defaultTarget(selectedRole);
    let firstEntryRequired=server?.firstEntryRequired;

    if(selectedRole==='master'){
      // MASTER must never silently fall back to PERSONAL after role selection.
      // The backend activates/selects the MASTER context before returning success.
      if(activeContextRole && activeContextRole!=='master'){
        return {ok:false,role:selectedRole,contextRole:activeContextRole,target:'#/onboarding/master?step=1&view=master-profile',firstEntryRequired:true,error:'master_context_not_selected'};
      }
      const status=String(server?.onboardingStatus||'not_started');
      if(status!=='completed'){
        const step=Math.max(1,Math.min(4,Number(server?.step||1)||1));
        const view=String(server?.view||({1:'master-profile',2:'master-services',3:'master-work-place',4:'master-review'}[step]));
        target=`#/onboarding/master?step=${step}&view=${encodeURIComponent(view)}`;
        firstEntryRequired=true;
      }else{
        target=target.startsWith('#/onboarding/master')?'#/master':target;
        firstEntryRequired=false;
      }
    }
    if(selectedRole==='client'){
      // CLIENT must own the PERSONAL context. Never render master first-entry UI
      // just because an older MASTER context was active before role selection.
      if(activeContextRole && activeContextRole!=='client'){
        return {ok:false,role:selectedRole,contextRole:activeContextRole,target:'#/home',firstEntryRequired:true,error:'client_context_not_selected'};
      }
      // Vehicle first-entry is resolved by KaretaFirstVehicleFlow after the
      // session-confirmed event, because it must inspect the real Garage state.
      target='#/home';
    }
    return {ok:true,role:selectedRole,contextRole:activeContextRole,target,firstEntryRequired:firstEntryRequired??null,postAuth:server};
  }

  window.KaretaPostAuthFirstEntryResolver=Object.freeze({normalizeRole,role,contextRole,resolve,defaultTarget});
})();
;

/* SOURCE: js/next/onboarding/onboarding_app.js */
(() => {
  'use strict';
  const state = window.KaretaOnboardingState;
  const draft = window.KaretaOnboardingProfileDraft;
  const router = window.KaretaOnboardingRouter;
  const api = window.KaretaOnboardingApi;
  if (!state || !draft || !router || !api) throw new Error('Onboarding modules are incomplete');
  let finalizing = null;

  function setActive(active){
    document.documentElement.classList.toggle('k-onboarding-active', !!active);
    document.body?.classList.toggle('k-onboarding-active', !!active);
    document.documentElement.classList.toggle('entry-flow-active', !!active);
    document.body?.classList.toggle('entry-flow-active', !!active);
  }
  function targetForRole(role){ return role === 'seller' ? '#/seller' : role === 'master' ? '#/onboarding/master?step=1&view=master-profile' : role === 'sto' ? '#/sto' : '#/home'; }
  function identityContextRole(payload){
    const context=payload?.currentContext || payload?.context || null;
    if(!context)return '';
    const type=String(context.type||context.contextType||'').toLowerCase();
    const profile=String(context.profileType||context.profile_type||'').toLowerCase();
    const organization=String(context.organizationType||context.organization_type||'').toLowerCase();
    if(type==='personal')return 'client';
    if(type==='profile'&&profile==='master')return 'master';
    if(type==='profile'&&profile==='seller')return 'seller';
    if(type==='organization')return organization==='parts_store'?'seller':'sto';
    return '';
  }
  function assertEntryContext(role,payload){
    const selected=state.role(role||'client');
    if(!['client','master'].includes(selected)||!payload)return;
    const actual=identityContextRole(payload);
    if(actual&&actual!==selected){
      const error=new Error(selected==='client'?'Не удалось открыть контекст клиента. Повторите вход.':'Не удалось открыть контекст мастера. Повторите вход.');
      error.code=selected==='client'?'client_context_not_selected':'master_context_not_selected';
      error.selectedRole=selected;error.contextRole=actual;
      throw error;
    }
  }
  function targetAfterAuth(result,flow,user){
    const resolved=window.KaretaPostAuthFirstEntryResolver?.resolve?.(result,flow,user);
    if(resolved?.ok===false){const error=new Error(resolved.error||'entry_context_mismatch');error.code=resolved.error||'entry_context_mismatch';throw error;}
    if(resolved?.target)return resolved.target;
    return targetForRole(resolved?.role||user?.entry_role||user?.role||flow?.entryRole||flow?.role||'client');
  }

  async function authoritativeTargetAfterAuth(result,flow,user){
    const role=String(user?.entry_role||user?.role||flow?.entryRole||flow?.role||'').toLowerCase();
    if(role==='client'){
      let target='#/home';
      try{
        let snap=window.KaretaIdentity?.snapshot?.()||null;
        if(!snap?.loaded&&window.KaretaIdentity?.load)snap=await window.KaretaIdentity.load({allowLegacyBridge:true,legacyUser:user});
        const activeRole=identityContextRole({currentContext:snap?.context});
        if(activeRole!=='client'){
          const personal=(snap?.contexts||[]).find(ctx=>String(ctx?.type||ctx?.contextType||'').toLowerCase()==='personal');
          if(personal&&window.KaretaIdentity?.select){
            snap=await window.KaretaIdentity.select(personal.id||personal.key);
          }
        }
        target='#/home';
      }catch(_clientContextError){
        console.warn('[KARETA onboarding] client context self-heal failed',_clientContextError);
      }
      return target;
    }
    const target=targetAfterAuth(result,flow,user);
    if(role!=='master')return target;
    const gate=window.KaretaMasterOnboardingGate;
    if(!gate?.ensureCompleted)return '#/onboarding/master';
    const allowed=await gate.ensureCompleted({redirect:false,source:'post-auth'});
    return allowed?target:'#/onboarding/master';
  }

  function confirmedUser(result, flow){
    const source = result && typeof result.user === 'object' ? result.user : {};
    const legacyRole=state.role(source.role||'client');
    const role = state.role(window.KaretaPostAuthFirstEntryResolver?.role?.(result,flow,source) || result?.selectedRole || result?.entryRole || flow.entryRole || flow.role || source.entry_role || legacyRole);
    return {
      ...source,
      name:String(source.name || flow.accountName || flow.name || (role === 'seller' ? 'Магазин запчастей' : role === 'sto' ? 'Автосервис' : role === 'master' ? 'Мастер' : 'Клиент')),
      phone:String(source.phone || flow.phone || flow.contactPhone || ''),
      role,
      legacy_role:legacyRole,
      entry_role:role,
      city:String(source.city || flow.city || flow.cityName || ''),
      onboarded:true,
      onboarding_stage:'done'
    };
  }

  function synchronizeSession(result, flow){
    const user = confirmedUser(result, flow);
    const identityPayload = result?.identity?.authenticated ? result.identity : null;
    let identity = null;
    const profileCache = {
      name:user.name,
      phone:user.phone,
      role:user.role,
      entry_role:user.entry_role,
      city:user.city,
      onboarded:true,
      onboarding_stage:'done',
      server_confirmed_at:new Date().toISOString()
    };
    try { localStorage.setItem('kareta.last.role.v1', user.role); } catch (_error) {}
    try { localStorage.setItem('kareta.profile.current', JSON.stringify(profileCache)); } catch (_error) {}
    try { sessionStorage.setItem('kareta.profile.current', JSON.stringify(profileCache)); } catch (_error) {}
    try { localStorage.setItem('kareta.auth.user', JSON.stringify(user)); } catch (_error) {}
    try { sessionStorage.setItem('kareta.auth.user', JSON.stringify(user)); } catch (_error) {}
    try {
      if (window.KaretaNext?.state) {
        window.KaretaNext.state.user = user;
        window.KaretaNext.state.session = { ok:true, user, confirmed:true };
      }
    } catch (_error) {}
    try { window._karetaCookieRole = user.role; window._karetaCookieOnbDone = true; } catch (_error) {}
    try {
      if (identityPayload) {
        assertEntryContext(user.role,identityPayload);
        identity = window.KaretaIdentity?.bootstrapSession?.(identityPayload, 'onboarding-session') || identityPayload;
        document.documentElement.dataset.identityMode = 'identity';
        document.documentElement.dataset.userRole = identity.compatibilityRole || user.role;
        if (window.KaretaNext?.state) {
          window.KaretaNext.state.identity = identity;
          window.KaretaNext.state.identityReady = true;
          window.KaretaNext.state.context = identity.context;
          window.KaretaNext.state.capabilities = identity.capabilities || [];
        }
      }
    } catch (error) {
      window.KaretaRuntimeLog?.add('onboarding.identity.bootstrap_failed', {message:error?.message||'identity_bootstrap_failed'}, 'error');
      throw error;
    }
    try { window.dispatchEvent(new CustomEvent('kareta:session-confirmed', { detail:{ user, result, identity, legacy:!identity } })); } catch (_error) {}
    return user;
  }

  async function refreshNextState(){
    const client = window.KaretaApiClient;
    if (!client || !window.KaretaNext?.state) return null;
    const [stateResult, sessionResult] = await Promise.allSettled([
      client.getState?.(),
      client.getSession?.()
    ]);
    if (stateResult.status === 'fulfilled' && stateResult.value) window.KaretaNext.state.apiSnapshot = stateResult.value;
    if (sessionResult.status === 'fulfilled' && sessionResult.value) {
      const sessionPayload = sessionResult.value?.payload || sessionResult.value;
      // Never overwrite an already confirmed local session with a stale or anonymous snapshot.
      if (sessionPayload?.user) {
        const liveIdentity=window.KaretaIdentity?.snapshot?.()||null;
        const interfaceRole=state.role(liveIdentity?.authenticated ? (liveIdentity.compatibilityRole||'client') : (sessionPayload.user.entry_role||sessionPayload.user.role||'client'));
        const sessionUser={...sessionPayload.user,legacy_role:sessionPayload.user.legacy_role||sessionPayload.user.role||'client',role:interfaceRole,entry_role:interfaceRole};
        window.KaretaNext.state.session = {...sessionPayload,user:sessionUser};
        window.KaretaNext.state.user = sessionUser;
      }
    }
    return { state:stateResult, session:sessionResult };
  }

  async function finalize(options = {}){
    if (finalizing) return finalizing;
    const button = options.button || null;
    const previousText = button?.textContent || '';
    if (button) { button.disabled = true; button.setAttribute('aria-busy','true'); button.textContent = 'Сохраняем…'; }
    finalizing = (async () => {
      const flow = draft.read();
      // Profile finalization is an onboarding operation, not a second app boot.
      // Keep progress local to the submit button and never restart the global preloader.
      const result = await api.confirm(flow, options);
      const user = synchronizeSession(result, flow);
      try { if (!window.KaretaRoleAccess?.identityActive?.()) window.KaretaRoleAccess?.refresh?.(user.role); } catch (_error) {}
      const completed = state.markComplete({ ...result, user });
      // The server session is already established by onboarding.complete. Refreshing data is
      // useful but must not block or reset the successful transition into the application.
      try { await refreshNextState(); } catch (_error) {}
      setActive(false);
      try { document.getElementById('onb2-overlay')?.remove(); } catch (_error) {}
      try { document.getElementById('onboarding-welcome')?.remove(); } catch (_error) {}
      const target = await authoritativeTargetAfterAuth(result,flow,user);
      history.replaceState(null, '', target);
      try {
        const routeKey = window.KaretaRouteRegistry?.keyFromHash?.(target) || window.KaretaRoleAccess?.defaultRoute?.(completed.role) || 'home';
        window.KaretaRouteRuntime?.transition?.(routeKey, { source:'onboarding-complete' });
      } catch (_error) {}
      return completed;
    })();
    try { return await finalizing; }
    catch (error) {
      if (window.KaretaAppPreloader?.isVisible?.()) window.KaretaAppPreloader.fail(error);
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = previousText;
      }
      const host = document.querySelector('.onb-done-actions') || button?.parentElement;
      let message = host?.querySelector('[data-onboarding-save-error]');
      if (host && !message) { message = document.createElement('div'); message.dataset.onboardingSaveError = '1'; message.className = 'onb-profile-error'; host.prepend(message); }
      if (message) { message.hidden = false; message.textContent = error?.message || 'Не удалось сохранить профиль. Повторите попытку.'; }
      throw error;
    } finally { finalizing = null; }
  }
  function audit(){ return { ok:!!(state && router && api), done:state.isDone(), route:router.parse(), finalizing:!!finalizing, flow:draft.read(), draft:draft.audit() }; }
  window.KaretaOnboardingApp = Object.freeze({ finalize, setActive, targetForRole, targetAfterAuth, authoritativeTargetAfterAuth, synchronizeSession, refreshNextState, audit });
})();
;

/* SOURCE: js/next/onboarding/onboarding_phone_runtime.js */
(function(){
  'use strict';

  function rawDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function nationalDigits(value) {
    const raw = String(value || '');
    let valueDigits = rawDigits(raw);
    if (!valueDigits) return '';

    // Explicit +7 and the old 8XXXXXXXXXX notation contain a country prefix.
    if (/^\s*\+7/.test(raw)) valueDigits = valueDigits.slice(1);
    else if (valueDigits.length >= 11 && (valueDigits[0] === '7' || valueDigits[0] === '8')) valueDigits = valueDigits.slice(1);
    else if (/^\s*8/.test(raw) && valueDigits.length > 0) valueDigits = valueDigits.slice(1);

    return valueDigits.slice(0, 10);
  }

  function digits(value) {
    const local = nationalDigits(value);
    return local ? '7' + local : '';
  }

  function normalize(value) {
    const valueDigits = digits(value);
    return valueDigits ? '+' + valueDigits : '';
  }

  function isValid(value) {
    return nationalDigits(value).length === 10;
  }

  function format(value) {
    const local = nationalDigits(value);
    if (!local) return '';

    let result = '+7';
    if (local.length > 0) result += ' (' + local.slice(0, 3);
    if (local.length >= 3) result += ')';
    if (local.length > 3) result += ' ' + local.slice(3, 6);
    if (local.length > 6) result += '-' + local.slice(6, 8);
    if (local.length > 8) result += '-' + local.slice(8, 10);
    return result;
  }

  function caretForDigitCount(formatted, count) {
    if (count <= 0) return 0;
    let seen = 0;
    for (let index = 0; index < formatted.length; index += 1) {
      if (/\d/.test(formatted[index])) seen += 1;
      if (seen >= count + 1) return index + 1; // +1 skips the fixed country-code digit.
    }
    return formatted.length;
  }

  function bindMasks(options) {
    const root = (options && options.scope) || document;
    const selector = (options && options.selector) || 'input[type="tel"]';
    const onClearError = options && options.onClearError;

    root.querySelectorAll(selector).forEach(function(input){
      if (input.dataset.phoneMaskBound === '1') return;
      input.dataset.phoneMaskBound = '1';
      input.setAttribute('placeholder', '+7 (___) ___-__-__');
      input.setAttribute('maxlength', '18');

      input.addEventListener('keydown', function(event){
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        const start = input.selectionStart == null ? 0 : input.selectionStart;
        const end = input.selectionEnd == null ? start : input.selectionEnd;
        if (start !== end) return;

        const value = String(input.value || '');
        if (event.key === 'Backspace') {
          if (start <= 3) {
            event.preventDefault();
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles:true }));
            return;
          }
          if (start > 0 && /\D/.test(value[start - 1] || '')) {
            let digitIndex = start - 1;
            while (digitIndex > 0 && /\D/.test(value[digitIndex])) digitIndex -= 1;
            if (digitIndex > 1 && /\d/.test(value[digitIndex])) {
              event.preventDefault();
              input.setRangeText('', digitIndex, digitIndex + 1, 'end');
              input.dispatchEvent(new Event('input', { bubbles:true }));
            }
          }
        } else if (/\D/.test(value[start] || '')) {
          let digitIndex = start;
          while (digitIndex < value.length && /\D/.test(value[digitIndex])) digitIndex += 1;
          if (digitIndex < value.length) {
            event.preventDefault();
            input.setRangeText('', digitIndex, digitIndex + 1, 'end');
            input.dispatchEvent(new Event('input', { bubbles:true }));
          }
        }
      });

      input.addEventListener('input', function(){
        const source = String(input.value || '');
        if (!rawDigits(source)) {
          input.value = '';
          if (typeof onClearError === 'function') onClearError(input);
          return;
        }

        const caret = input.selectionStart == null ? source.length : input.selectionStart;
        const beforeCaret = source.slice(0, caret);
        let localCount = nationalDigits(beforeCaret).length;
        const formatted = format(source);
        input.value = formatted;

        // Keep the caret near the digit being edited instead of always jumping unpredictably.
        const nextCaret = caretForDigitCount(formatted, localCount);
        try { input.setSelectionRange(nextCaret, nextCaret); } catch (_) {}
        if (typeof onClearError === 'function') onClearError(input);
      });

      input.addEventListener('blur', function(){
        input.value = format(input.value);
      });

      if (String(input.value || '').trim()) input.value = format(input.value);
    });
  }

  window.KaretaOnboardingPhoneRuntime = Object.freeze({
    digits,
    normalize,
    isValid,
    format,
    bindMasks,
    audit: function(){ return { countryCode:'+7', maxLength:18, liveMask:true }; }
  });
})();
;

/* SOURCE: js/next/onboarding/onboarding_form_ui.js */
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
      <div class="onb2-headbar"><div class="onb2-brandbox onb2-brandbox--official"><img class="onb2-brand-logo onb2-brand-logo--full" src="assets/onboarding/kareta_logo_full.png" alt="KARETA.KZ Автосервис"></div></div>
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
;

/* SOURCE: js/next/onboarding/onboarding_form_validation.js */
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
;

/* SOURCE: js/next/kflow_windows.js */
(() => {
  'use strict';
  if (window.KaretaKFlow) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clamp = (value,min,max) => Math.max(min,Math.min(max,Number(value)||min));

  function renderSteps(options = {}) {
    const total = clamp(options.total || 1,1,12);
    const current = clamp(options.current || 1,1,total);
    const label = String(options.label || 'Окно');
    const nodes = [];
    const completed = options.completed === true;
    for (let index=1; index<=total; index+=1) {
      const state = completed ? 'is-done' : index < current ? 'is-done' : index === current ? 'is-active' : 'is-idle';
      const dot = completed && index === total ? '✓' : String(index);
      nodes.push(`<li class="k-flow-step ${state}" data-kflow-step="${index}"><span class="k-flow-step__dot" ${!completed&&index===current?'aria-current="step"':''}>${dot}</span><span class="k-flow-step__sr">${esc(label)} ${index}${!completed&&index===current?' — текущее':''}${completed&&index===total?' — завершено':''}</span></li>`);
    }
    return `<ol class="k-flow-steps" aria-label="${esc(label)} ${current} из ${total}">${nodes.join('')}</ol>`;
  }

  function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g,'');
    const local = (digits.length >= 11 && (digits[0] === '7' || digits[0] === '8')) ? digits.slice(1,11) : digits.slice(0,10);
    if (!local) return '+7 ••• ••• •• ••';
    const a=local.slice(0,3).padEnd(3,'•');
    const tail=local.slice(-2).padStart(2,'•');
    return `+7 ${a} ••• •• ${tail}`;
  }

  function formatCountdown(seconds) {
    const value=Math.max(0,Number(seconds)||0);
    return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  }

  function bindOtp(root, options = {}) {
    if (!root) return () => {};
    const hidden = root.querySelector(options.hiddenSelector || '[data-kflow-otp-value]');
    const cells = [...root.querySelectorAll(options.cellSelector || '[data-kflow-otp-cell]')];
    if (!hidden || !cells.length) return () => {};
    const limit = cells.length;
    const clean = value => String(value || '').replace(/\D/g,'').slice(0,limit);
    const sync = (value, focusIndex = null) => {
      const digits=clean(value);
      cells.forEach((cell,index)=>{cell.value=digits[index]||'';});
      hidden.value=digits;
      hidden.dispatchEvent(new Event('input',{bubbles:true}));
      if (focusIndex !== null) cells[Math.max(0,Math.min(limit-1,focusIndex))]?.focus({preventScroll:true});
      return digits;
    };
    const onInput = event => {
      const cell=event.target.closest('[data-kflow-otp-cell]');
      if (!cell) return;
      const index=cells.indexOf(cell);
      const value=clean(cell.value);
      if (value.length > 1) { sync(value,Math.min(value.length,limit-1)); return; }
      cell.value=value.slice(-1);
      const joined=cells.map(item=>clean(item.value)).join('').slice(0,limit);
      hidden.value=joined;
      hidden.dispatchEvent(new Event('input',{bubbles:true}));
      if (cell.value && index < limit-1) cells[index+1].focus({preventScroll:true});
    };
    const onKeydown = event => {
      const cell=event.target.closest('[data-kflow-otp-cell]');
      if (!cell) return;
      const index=cells.indexOf(cell);
      if (event.key === 'Backspace' && !cell.value && index>0) {event.preventDefault();cells[index-1].value='';cells[index-1].focus({preventScroll:true});hidden.value=cells.map(item=>clean(item.value)).join('');hidden.dispatchEvent(new Event('input',{bubbles:true}));}
      if (event.key === 'ArrowLeft' && index>0) {event.preventDefault();cells[index-1].focus({preventScroll:true});}
      if (event.key === 'ArrowRight' && index<limit-1) {event.preventDefault();cells[index+1].focus({preventScroll:true});}
    };
    const onPaste = event => {
      const text=event.clipboardData?.getData('text') || '';
      const digits=clean(text);
      if (!digits) return;
      event.preventDefault();
      sync(digits,Math.min(digits.length,limit)-1);
    };
    root.addEventListener('input',onInput);
    root.addEventListener('keydown',onKeydown);
    root.addEventListener('paste',onPaste);
    if (hidden.value) sync(hidden.value);
    return () => {root.removeEventListener('input',onInput);root.removeEventListener('keydown',onKeydown);root.removeEventListener('paste',onPaste);};
  }

  function branch(role, reverse = false) {
    const master = String(role || '').toLowerCase() === 'master';
    if (master) return reverse ? {enter:'right',leave:'left'} : {enter:'left',leave:'right'};
    return reverse ? {enter:'left',leave:'right'} : {enter:'right',leave:'left'};
  }

  window.KaretaKFlow = Object.freeze({version:'1',renderSteps,maskPhone,formatCountdown,bindOtp,branch});
})();
;

/* SOURCE: js/next/onboarding/pages/role_definitions.js */
(() => {
  'use strict';

  const ROLE_DATA = {
    client: {
      badge: '',
      icon: '👤',
      title: 'Клиент',
      featured: true,
      desc: 'Запись на сервис, история работ и управление автомобилем',
      features: ['Онлайн-запись','История ремонтов','Чат с мастером','Баллы лояльности','Свободный выбор мастера'],
      heroTitle: 'Для клиентов',
      heroSub: 'Запись, контроль заявки и история обслуживания в одном потоке.',
      items: [
        ['📅','Быстрая запись','Каталог услуг, выбор мастера и заявка без лишних шагов.'],
        ['🧾','Прозрачная история','Все ремонты, суммы и заметки хранятся в кабинете.'],
        ['💬','Связь по делу','Чат, уведомления и единая лента статусов по заявке.']
      ],
      cta: 'Продолжить как клиент'
    },
    master: {
      badge: '',
      icon: '🛠️',
      title: 'Мастер',
      featured: false,
      desc: 'Управление заказами, работами и клиентами',
      features: ['Заказы из биржи','Личный профиль','Портфолио работ','Расписание'],
      heroTitle: 'Для мастеров',
      heroSub: 'Рабочий кабинет, поток заявок и точная специализация профиля.',
      items: [
        ['📥','Биржа заявок','Подходящие обращения и быстрый отклик по профилю.'],
        ['🧰','Профиль и специализация','Навыки, услуги, кейсы и понятная карточка мастера.'],
        ['📆','Контроль загрузки','Занятость и рабочий ритм без ручной путаницы.']
      ],
      cta: 'Создать профиль мастера'
    },
    sto: {
      badge: '',
      icon: '🏪',
      title: 'СТО / Автосервис',
      featured: false,
      desc: 'Управление сервисом, мастерами, заказами и услугами',
      features: ['Команда мастеров','Журнал заказов','Профиль сервиса','Контакты и график'],
      heroTitle: 'Для автосервисов',
      heroSub: 'Профиль СТО, команда и операционный контур без дублирования потоков.',
      items: [
        ['🏢','Профиль сервиса','Название, контакты, адрес и точка входа для команды.'],
        ['👥','Командная модель','Отдельная логика СТО и работа с составом мастеров.'],
        ['📊','Операционный слой','Заявки, занятость и аналитика сервиса в одном месте.']
      ],
      cta: 'Создать профиль СТО'
    },
    seller: {
      badge: 'Магазин',
      icon: '🛒',
      title: 'Продавец запчастей',
      featured: false,
      desc: 'Интернет-магазин, товары, остатки, цены и заказы покупателей',
      features: ['Каталог товаров','Управление остатками','Заказы покупателей','Доставка и возвраты'],
      heroTitle: 'Для продавцов запчастей',
      heroSub: 'Отдельный кабинет интернет-магазина с каталогом, остатками и обработкой заказов.',
      items: [
        ['📦','Каталог товаров','Карточки запчастей, SKU, OEM-номера, цены, фотографии и совместимость.'],
        ['📊','Остатки и продажи','Контроль наличия, заказов, выручки и товаров с низким остатком.'],
        ['🚚','Доставка и возвраты','Самовывоз, курьер, транспортные компании и правила возврата.']
      ],
      cta: 'Открыть магазин запчастей'
    }
  };

  const SPEC_MAP = {
    master: [
      ['electric', '⚡', 'Автоэлектрик', 'Генераторы, стартеры, проводка, диагностика'],
      ['chassis', '🔩', 'Ходовая часть', 'Подвеска, тормоза, рулевое, ШРУС'],
      ['engine', '🛢', 'Моторист', 'Двигатель, КПП, сцепление, жидкости'],
      ['audio', '🎵', 'Автозвук', 'Магнитолы, акустика, CarPlay'],
      ['body', '🚗', 'Кузовщик', 'Покраска, рихтовка, стёкла, тонировка'],
      ['tires', '🛞', 'Шиномонтажник', 'Шины, балансировка, сезонная замена'],
      ['evacuator', '🔺', 'Эвакуаторщик', 'Эвакуация автомобилей по городу и области'],
      ['legal', '⚖️', 'Юрист (ДТП)', 'Помощь при ДТП, страховые вопросы'],
      ['diagnostics', '🔍', 'Диагностика', 'Компьютерная и электронная диагностика'],
      ['other', '🔧', 'Другая специализация', 'Укажу в профиле']
    ],
    sto: [
      ['general', '🏭', 'Автосервис (общий)', 'Все виды ремонта и обслуживания'],
      ['electric', '⚡', 'Электрика / диагностика', 'Специализация сервиса на электрике'],
      ['body', '🚗', 'Кузовной цех', 'Кузовной ремонт и покраска'],
      ['tires', '🛞', 'Шиномонтаж', 'Только шины, балансировка и колёса'],
      ['audio', '🎵', 'Автозвук и тюнинг', 'Аудио и дополнительное оборудование'],
      ['detailing', '✨', 'Детейлинг', 'Химчистка, полировка, PPF'],
      ['evacuator', '🔺', 'Эвакуация', 'Служба эвакуации автомобилей'],
      ['legal', '⚖️', 'Правовая помощь', 'Юридические услуги при ДТП'],
      ['other', '🔧', 'Другое', 'Другая специализация']
    ],
    seller: [
      ['original', '🏷️', 'Оригинальные запчасти', 'OEM-каталог и оригинальные детали'],
      ['analogs', '🔁', 'Аналоги', 'Сертифицированные заменители и кроссы'],
      ['used', '♻️', 'Б/у запчасти', 'Контрактные и восстановленные детали'],
      ['electrical', '⚡', 'Автоэлектрика', 'Датчики, стартеры, генераторы, блоки'],
      ['body', '🚘', 'Кузовные детали', 'Оптика, кузов, стёкла и элементы салона'],
      ['tires', '🛞', 'Шины и диски', 'Сезонные шины, диски и крепёж'],
      ['oils', '🛢️', 'Масла и расходники', 'Фильтры, жидкости, ремни и колодки'],
      ['tuning', '🎵', 'Тюнинг и автозвук', 'Аксессуары, мультимедиа и оборудование'],
      ['wholesale', '📦', 'Оптовые поставки', 'Прайс-листы и поставки для СТО'],
      ['other', '🧩', 'Другие категории', 'Дополнительный ассортимент магазина']
    ]
  };

  const ROLE_KEYS = Object.freeze(['client', 'master', 'sto', 'seller']);

  function normalizeRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return ROLE_KEYS.includes(role) ? role : 'client';
  }

  function getRole(value) {
    return ROLE_DATA[normalizeRole(value)];
  }

  function getSpecializations(value) {
    const role = normalizeRole(value);
    return Array.isArray(SPEC_MAP[role]) ? SPEC_MAP[role] : [];
  }

  window.KaretaOnboardingRoleDefinitions = Object.freeze({
    keys: ROLE_KEYS,
    roles: Object.freeze(ROLE_DATA),
    specializations: Object.freeze(SPEC_MAP),
    normalizeRole,
    getRole,
    getSpecializations,
    audit() {
      return {
        ok: ROLE_KEYS.every(key => !!ROLE_DATA[key]),
        roles: ROLE_KEYS.slice(),
        specializationOwners: Object.keys(SPEC_MAP)
      };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/onboarding_selection_catalog.js */
(function(){
  'use strict';

  const cityIcons = Object.freeze({
    'Усть-Каменогорск': '🏔',
    'Риддер': '⛏',
    'Семей': '🌉',
    'Алматы': '🌆',
    'Астана': '🏙',
    'Шымкент': '☀️',
    'Караганда': '⚡',
    'Павлодар': '🌊'
  });

  const cities = Object.freeze([
    'Алматы','Астана','Шымкент','Караганда',
    'Усть-Каменогорск','Семей','Павлодар','Риддер'
  ]);

  // Approximate WGS84 centers are for city browsing only, never user/provider identity.
  const cityCenters=Object.freeze({
    'Алматы':Object.freeze({latitude:43.252,longitude:76.911}),
    'Астана':Object.freeze({latitude:51.180,longitude:71.446}),
    'Шымкент':Object.freeze({latitude:42.310,longitude:69.600}),
    'Караганда':Object.freeze({latitude:49.802,longitude:73.102}),
    'Усть-Каменогорск':Object.freeze({latitude:49.971,longitude:82.606}),
    'Семей':Object.freeze({latitude:50.421,longitude:80.250}),
    'Павлодар':Object.freeze({latitude:52.276,longitude:76.969}),
    'Риддер':Object.freeze({latitude:50.34524,longitude:83.515621})
  });
  const cityAliases=Object.freeze({'өскемен':'Усть-Каменогорск','oskemen':'Усть-Каменогорск','семей':'Семей','semey':'Семей','алматы':'Алматы','almaty':'Алматы','астана':'Астана','astana':'Астана','шымкент':'Шымкент','shymkent':'Шымкент','қарағанды':'Караганда','karaganda':'Караганда','павлодар':'Павлодар','pavlodar':'Павлодар','риддер':'Риддер','ridder':'Риддер'});
  const resolveCityCenter=value=>{
    const name=String(value||'').trim(),lower=name.toLocaleLowerCase('ru-RU');
    const key=cityAliases[lower]||cities.find(city=>city.toLocaleLowerCase('ru-RU')===lower);
    return key&&cityCenters[key]?{...cityCenters[key],city:key,precision:'city',source:'GeoNames'}:null;
  };

  const brands = Object.freeze([
    ['Toyota','TO'],['Hyundai','HY'],['Kia','KI'],['Lexus','LX'],
    ['BMW','BM'],['Mercedes','MB'],['Nissan','NS'],['Mitsubishi','MI'],
    ['Lada','LA'],['Chevrolet','CH'],['Volkswagen','VW'],['Honda','HO'],
    ['Subaru','SU'],['Mazda','MZ'],['Haval','HV'],['Geely','GE'],
    ['Audi','AU'],['Skoda','SK'],['Chery','CR'],['Opel','OP']
  ].map(row => Object.freeze(row.slice())));

  window.KaretaOnboardingSelectionCatalog = Object.freeze({
    cities,
    cityIcons,
    resolveCityCenter,
    brands,
    audit(){
      return {
        cities: cities.length,
        brands: brands.length,
        uniqueCities: new Set(cities).size === cities.length,
        uniqueBrands: new Set(brands.map(row => row[0])).size === brands.length
      };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/pages/role_page.js */
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

  function canonicalCities(){
    const catalog = window.KaretaOnboardingSelectionCatalog?.cities;
    const values = Array.isArray(catalog) && catalog.length ? catalog : CITY_POINTS.map(row => row[0]);
    const current = firstValue([draft.read().city, draft.read().cityName]);
    return Array.from(new Set([...(values || []), current].map(value => String(value || '').trim()).filter(Boolean)));
  }

  function writeCityStorage(city){
    const normalized = String(city || '').trim();
    if (!normalized) return;
    try {
      localStorage.setItem('kareta.entryCity', normalized);
      localStorage.setItem('kareta_city', normalized);
    } catch (_error) {}
  }

  function patchCity(city, source = 'manual'){
    const normalized = String(city || '').trim();
    if (!normalized) return draft.read();
    draft.patch({
      city:normalized,
      cityName:normalized,
      citySelectionSource:String(source || 'manual'),
      citySelectedAt:new Date().toISOString()
    }, { source:`onboarding-city-${String(source || 'manual')}` });
    writeCityStorage(normalized);
    return draft.read();
  }

  function welcomeCityOptions(selected){
    const current = String(selected || '').trim();
    const cities = canonicalCities();
    const ordered = current && !cities.includes(current) ? [current, ...cities] : cities;
    return [
      `<option value="">Выберите город</option>`,
      ...ordered.map(city => `<option value="${esc(city)}" ${city === current ? 'selected' : ''}>${esc(city)}</option>`)
    ].join('');
  }

  function welcomeCityHtml(){
    const auto = collectAutoContext();
    const selected = firstValue([draft.read().city, draft.read().cityName, auto.city]);
    return `<div class="onb2-welcome-city" data-welcome-city-block>
      <div class="onb2-welcome-city-head">
        <span class="onb2-welcome-city-question">Ваш город?</span>
        <span class="onb2-welcome-city-status" data-welcome-city-status aria-live="polite">Определяем местоположение…</span>
      </div>
      <label class="onb2-welcome-city-select-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg>
        <select class="onb2-welcome-city-select" data-welcome-city-select aria-label="Ваш город">
          ${welcomeCityOptions(selected)}
        </select>
        <svg class="onb2-welcome-city-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>
      </label>
      <button type="button" class="onb2-welcome-find-me" data-action="welcome-find-me">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        <span data-welcome-find-label>Найти меня</span>
      </button>
    </div>`;
  }

  function setWelcomeCityStatus(message, stateName = ''){
    const node = state.overlay?.querySelector('[data-welcome-city-status]');
    if (!node) return;
    node.textContent = String(message || '');
    node.dataset.state = String(stateName || '');
  }

  function syncWelcomeCityUi(flow = draft.read()){
    const select = state.overlay?.querySelector('[data-welcome-city-select]');
    if (!select) return;
    const city = firstValue([flow.city, flow.cityName, collectAutoContext().city]);
    if (city && !Array.from(select.options).some(option => option.value === city)) {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      select.appendChild(option);
    }
    select.value = city || '';
  }

  function captureGeo(options = {}){
    const existing = draft.read();
    const force = options.force === true;
    const preferDetectedCity = options.preferDetectedCity === true;
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
    if (!force && existing.geoLat && existing.geoLng && existing.city) {
      onStatus('cached', { city:existing.city });
      return Promise.resolve(existing);
    }
    if (!navigator.geolocation) {
      onStatus('unsupported', {});
      return Promise.resolve(existing);
    }
    onStatus('locating', {});
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = Number(position.coords?.latitude || 0);
        const lng = Number(position.coords?.longitude || 0);
        const auto = collectAutoContext();
        const detectedCity = nearestCity(lat,lng);
        const city = preferDetectedCity ? (detectedCity || auto.city) : (auto.city || detectedCity);
        const patch = {
          ...auto,
          city,
          cityName:city,
          geoLat:lat,
          geoLng:lng,
          geoAccuracy:Number(position.coords?.accuracy || 0),
          geoDetectedAt:new Date().toISOString(),
          geoSource:'gps'
        };
        draft.patch(patch, { source:force ? 'onboarding-refresh-geo' : 'onboarding-auto-geo' });
        if (city) writeCityStorage(city);
        onStatus('success', { city, detectedCity, lat, lng });
        resolve(draft.read());
      }, error => {
        const auto = collectAutoContext();
        if (Object.values(auto).some(Boolean)) draft.patch(auto, { source:'onboarding-auto-context' });
        onStatus('error', { code:Number(error?.code || 0), message:String(error?.message || '') });
        resolve(draft.read());
      }, {
        enableHighAccuracy:options.enableHighAccuracy === true || force,
        timeout:force ? 8000 : 4500,
        maximumAge:force ? 0 : 900000
      });
    });
  }

  async function locateWelcomeCity(force = false){
    const button = state.overlay?.querySelector('[data-action="welcome-find-me"]');
    const label = button?.querySelector('[data-welcome-find-label]');
    const oldLabel = label?.textContent || 'Найти меня';
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy','true');
    }
    if (label) label.textContent = 'Ищем…';
    setWelcomeCityStatus('Определяем местоположение…', 'loading');
    try {
      const flow = await captureGeo({
        force,
        preferDetectedCity:force,
        enableHighAccuracy:force,
        onStatus(kind, detail){
          if (kind === 'cached') setWelcomeCityStatus('Город сохранён', 'cached');
          if (kind === 'unsupported') setWelcomeCityStatus('GPS недоступен — выберите город', 'error');
          if (kind === 'error') setWelcomeCityStatus('Не удалось определить — выберите город', 'error');
          if (kind === 'success') setWelcomeCityStatus(detail?.city ? 'Город определён по геопозиции' : 'Выберите город', detail?.city ? 'success' : 'error');
        }
      });
      syncWelcomeCityUi(flow);
      return flow;
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
      if (label) label.textContent = oldLabel;
    }
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
          ${welcomeCityHtml()}
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
    if (step === 'welcome') locateWelcomeCity(false).catch(() => {
      setWelcomeCityStatus('Не удалось определить — выберите город', 'error');
    });
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
      if (action === 'welcome-find-me') { locateWelcomeCity(true).catch(() => setWelcomeCityStatus('Не удалось определить — выберите город', 'error')); return; }
      if (action === 'welcome-next') { state.pendingEnter='neutral'; navigation.to('role', { role:draft.currentRole(), source:'registration-welcome-next' }); }
      if (action === 'back-welcome') { state.pendingEnter='neutral'; navigation.to('welcome', { role:draft.currentRole(), source:'registration-back-welcome' }); }
      if (action === 'back-role') navigateFlow('role', state.selectedRole || draft.currentRole(), {reverse:true,source:'registration-back-role'});
      if (action === 'back-profile') navigateFlow('profile', state.selectedRole || draft.currentRole(), {reverse:true,source:'registration-back-profile'});
      if (action === 'resend-code') requestCode(control, { resend:true });
    });
    overlay.querySelector('[data-welcome-city-select]')?.addEventListener('change', event => {
      const city = String(event.currentTarget?.value || '').trim();
      if (!city) return;
      const flow = patchCity(city, 'manual');
      syncWelcomeCityUi(flow);
      setWelcomeCityStatus('Город выбран вручную', 'manual');
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
;

/* SOURCE: js/next/onboarding/pages/client_profile_page.js */
(() => {
  'use strict';
  const role = 'client';
  const definitions = window.KaretaOnboardingRoleDefinitions;
  if (!definitions) throw new Error('KaretaOnboardingRoleDefinitions is unavailable');
  const definition = definitions.getRole(role);
  const specializations = definitions.getSpecializations(role);

  function open(step = 'profile') {
    const api = window.OnboardingV2;
    if (!api || typeof api.openFromRoute !== 'function') throw new Error('OnboardingV2 is unavailable');
    return api.openFromRoute(`#role:${role}:${step}`);
  }

  window.KaretaClientProfilePage = Object.freeze({
    role,
    title: 'Клиент',
    defaultStep: 'profile',
    definition,
    specializations,
    open,
    audit() {
      return {
        ok: !!window.OnboardingV2 && !!definition,
        role,
        specializationCount: specializations.length
      };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/pages/master_profile_page.js */
(() => {
  'use strict';
  const role = 'master';
  const definitions = window.KaretaOnboardingRoleDefinitions;
  if (!definitions) throw new Error('KaretaOnboardingRoleDefinitions is unavailable');
  const definition = definitions.getRole(role);
  const specializations = definitions.getSpecializations(role);

  function open(step = 'profile') {
    const api = window.OnboardingV2;
    if (!api || typeof api.openFromRoute !== 'function') throw new Error('OnboardingV2 is unavailable');
    return api.openFromRoute(`#role:${role}:${step}`);
  }

  window.KaretaMasterProfilePage = Object.freeze({
    role,
    title: 'Мастер',
    defaultStep: 'profile',
    definition,
    specializations,
    open,
    audit() {
      return {
        ok: !!window.OnboardingV2 && !!definition,
        role,
        specializationCount: specializations.length
      };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/pages/service_profile_page.js */
(() => {
  'use strict';
  const role = 'sto';
  const definitions = window.KaretaOnboardingRoleDefinitions;
  if (!definitions) throw new Error('KaretaOnboardingRoleDefinitions is unavailable');
  const definition = definitions.getRole(role);
  const specializations = definitions.getSpecializations(role);

  function open(step = 'profile') {
    const api = window.OnboardingV2;
    if (!api || typeof api.openFromRoute !== 'function') throw new Error('OnboardingV2 is unavailable');
    return api.openFromRoute(`#role:${role}:${step}`);
  }

  window.KaretaServiceProfilePage = Object.freeze({
    role,
    title: 'СТО',
    defaultStep: 'profile',
    definition,
    specializations,
    open,
    audit() {
      return {
        ok: !!window.OnboardingV2 && !!definition,
        role,
        specializationCount: specializations.length
      };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/pages/seller_profile_page.js */
(() => {
  'use strict';
  const role = 'seller';
  const definitions = window.KaretaOnboardingRoleDefinitions;
  if (!definitions) throw new Error('KaretaOnboardingRoleDefinitions is unavailable');
  const definition = definitions.getRole(role);
  const specializations = definitions.getSpecializations(role);

  function open(step = 'profile') {
    const api = window.OnboardingV2;
    if (!api || typeof api.openFromRoute !== 'function') throw new Error('OnboardingV2 is unavailable');
    return api.openFromRoute(`#role:${role}:${step}`);
  }

  window.KaretaSellerProfilePage = Object.freeze({
    role,
    title: 'Продавец запчастей',
    defaultStep: 'profile',
    definition,
    specializations,
    open,
    audit() {
      return { ok: !!window.OnboardingV2 && !!definition, role, specializationCount: specializations.length };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/pages/profile_registry.js */
/* r69x: explicit owner registry for role/profile onboarding screens. */
(() => {
  'use strict';
  const api = window.OnboardingV2;
  const roles = Object.freeze({
    client: window.KaretaClientProfilePage,
    master: window.KaretaMasterProfilePage,
    sto: window.KaretaServiceProfilePage,
    seller: window.KaretaSellerProfilePage
  });
  if (!api) throw new Error('OnboardingV2 profile flow failed to initialize');
  Object.entries(roles).forEach(([key, module]) => {
    if (!module || module.role !== key || typeof module.open !== 'function') {
      throw new Error(`Onboarding profile owner is unavailable: ${key}`);
    }
  });
  function openRole(role, step = 'profile') {
    const owner = roles[String(role || '').toLowerCase()];
    if (!owner) throw new Error(`Unsupported onboarding role: ${role}`);
    return owner.open(step);
  }
  window.KaretaOnboardingProfilePages = Object.freeze({
    roles,
    show: typeof api.show === 'function' ? api.show.bind(api) : null,
    render: typeof api.render === 'function' ? api.render.bind(api) : null,
    openFromRoute: typeof api.openFromRoute === 'function' ? api.openFromRoute.bind(api) : null,
    openRole,
    audit(){
      const roleAudit = Object.fromEntries(Object.entries(roles).map(([key, owner]) => [key, owner.audit()]));
      return {
        ok: typeof api.show === 'function' && Object.values(roleAudit).every(item => item.ok),
        overlayMounted: !!document.getElementById('onb2-overlay'),
        activeStep: document.querySelector('#onb2-overlay .onb2-step.active')?.id || null,
        roles: roleAudit
      };
    }
  });
})();
;

/* SOURCE: js/next/onboarding/onboarding_lifecycle.js */
(() => {
  'use strict';

  const state = window.KaretaOnboardingState;
  const draft = window.KaretaOnboardingProfileDraft;
  const router = window.KaretaOnboardingRouter;
  const app = window.KaretaOnboardingApp;
  const profilePages = window.KaretaOnboardingProfilePages;
  const navigation = window.KaretaOnboardingNavigation;
  if (!state || !draft || !router || !app || !profilePages || !navigation) {
    throw new Error('Compact onboarding lifecycle dependencies are incomplete');
  }

  const OVERLAY_STEPS = Object.freeze(['welcome','role','profile','code']);
  let booted = false;
  let listenersBound = false;
  let dispatching = false;
  let dispatchCount = 0;
  let lastSource = '';
  let lastAction = '';

  function sessionRole(flow = {}){
    // During role selection the branch chosen by the user is authoritative.
    // A previously authenticated MASTER/PERSONAL context must never overwrite
    // CLIENT/MASTER while the general onboarding flow is still pending.
    const pendingRole = state.role(flow?.entryRole || flow?.role || 'client');
    if (flow?.pending === true && ['client','master'].includes(pendingRole)) return pendingRole;
    try {
      const identity = window.KaretaIdentity?.snapshot?.() || null;
      if (identity?.authenticated && identity?.compatibilityRole) return state.role(identity.compatibilityRole);
    } catch (_error) {}
    try {
      const user = window.KaretaNext?.state?.user || window.KaretaAppState?.user || null;
      if (user?.entry_role || user?.role) return state.role(user.entry_role || user.role);
    } catch (_error) {}
    return pendingRole;
  }

  function roleOf(flow){ return sessionRole(flow || {}); }

  function normalizePhone(value){
    const digits = String(value || '').replace(/\D/g, '');
    const normalized = digits.length === 10 ? `7${digits}` : digits;
    return normalized.length === 11 && normalized[0] === '7' ? `+${normalized}` : '';
  }

  function hasActiveCodeContext(flow){
    const phone = normalizePhone(flow?.phone || flow?.contactPhone || '');
    if (!phone) return false;
    try {
      const requestedPhone = String(sessionStorage.getItem('kareta_onboarding_demo_phone') || '');
      const requestedAt = Number(sessionStorage.getItem('kareta_onboarding_demo_requested_at') || 0);
      return requestedPhone === phone && requestedAt > 0 && Date.now() - requestedAt <= 10 * 60 * 1000;
    } catch (_error) { return false; }
  }

  function clearTransientVerification(){
    try {
      sessionStorage.removeItem('kareta_onboarding_demo_phone');
      sessionStorage.removeItem('kareta_onboarding_demo_requested_at');
      sessionStorage.removeItem('kareta_onboarding_demo_verified');
    } catch (_error) {}
  }

  function removeSurfaces(){
    ['onboarding-welcome','onb2-overlay','k-onboarding-page-host'].forEach(id => {
      try { document.getElementById(id)?.remove(); } catch (_error) {}
    });
    try { if (window.OnboardingV2?.state) window.OnboardingV2.state.overlay = null; } catch (_error) {}
  }

  function transitionToApp(flow, options = {}){
    const role = roleOf(flow || draft.read());
    const leavingOnboarding = router.isOnboarding() || options.forceRoute === true;
    const target = options.target || app.targetForRole(role);
    removeSurfaces();
    app.setActive(false);
    try { window.KaretaRoleAccess?.refresh?.(role); } catch (_error) {}

    // Once onboarding is complete it must never own normal application routing.
    // visibilitychange/pageshow/session refreshes may clean onboarding UI, but they
    // must preserve the current hash and mounted business surface. Only an actual
    // onboarding URL is allowed to redirect to the role start page.
    if (!leavingOnboarding) {
      const currentHash = String(location.hash || '');
      const currentKey = window.KaretaRouteRegistry?.keyFromHash?.(currentHash) || '';
      try { window.KaretaShellNav?.refresh?.({ role, activeKey:currentKey || undefined }); } catch (_error) {}
      lastAction = 'app-route-preserved';
      return currentHash || target;
    }

    try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; }
    const targetKey = window.KaretaRouteRegistry?.keyFromHash?.(target) || window.KaretaRoleAccess?.defaultRoute?.(role);
    try { window.KaretaShellNav?.refresh?.({ role, activeKey:targetKey }); } catch (_error) {}
    try { window.KaretaRouteRuntime?.transition?.(targetKey, { source:options.source || 'onboarding-lifecycle' }); } catch (_error) {}
    lastAction = 'leave-to-app';
    return target;
  }

  function openOverlay(parsed, context = {}){
    const currentFlow = draft.read();
    if (parsed.step === 'code' && !hasActiveCodeContext(currentFlow)) {
      clearTransientVerification();
      draft.patch({
        role:parsed.role, entryRole:parsed.role, stage:'role', pending:true, flowSurface:'overlay',
        roleSetupDone:false, phoneVerified:false, serverConfirmed:false, accountExists:false, authMode:''
      }, { source:'lifecycle-invalid-code-route-reset' });
      const target = router.canonical(parsed.role, 'role');
      try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; return true; }
      parsed = { ...parsed, step:'role' };
    }

    removeSurfaces();
    const step = OVERLAY_STEPS.includes(parsed.step) ? parsed.step : 'role';
    draft.patch({ role:parsed.role, entryRole:parsed.role, stage:step, pending:true, flowSurface:'overlay' }, { source:`lifecycle-overlay:${step}` });
    app.setActive(true);
    const result = profilePages.openFromRoute?.(router.canonical(parsed.role, step), { replace:context.replace !== false });
    lastAction = `overlay:${step}`;
    return result !== false;
  }

  function dispatch(raw = location.hash, context = {}){
    if (dispatching) return false;
    dispatching = true;
    dispatchCount += 1;
    lastSource = String(context.source || 'unknown');
    try {
      const flow = draft.read();
      const parsed = raw && typeof raw === 'object' ? raw : router.parse(raw);
      if (state.isDone()) {
        if (parsed || context.forceDoneCheck) transitionToApp(flow, { source:lastSource, forceRoute:!!parsed });
        else app.setActive(false);
        return !!parsed;
      }
      if (!parsed) return false;
      return openOverlay(parsed, context);
    } finally { dispatching = false; }
  }

  function hasMeaningfulDraft(flow){
    return !!(flow && typeof flow === 'object' && (flow.pending === true || Number(flow.draftRevision || 0) > 0 || flow.stage || flow.role));
  }

  function resume(options = {}){
    const flow = draft.read();
    if (state.isDone()) return transitionToApp(flow, { source:options.source || 'resume-done', forceRoute:router.isOnboarding() });
    app.setActive(true);
    const parsed = router.parse();
    if (parsed) return dispatch(parsed, { source:options.source || 'resume-route', replace:true });

    // A fresh unauthenticated entry must always begin with the platform welcome screen.
    // Do not resurrect a stale role/profile/code stage from localStorage.
    clearTransientVerification();
    draft.patch({
      stage:'welcome', pending:true, flowSurface:'overlay', roleSetupDone:false,
      phoneVerified:false, serverConfirmed:false, accountExists:false, authMode:''
    }, { source:'lifecycle-fresh-welcome-start' });
    const step = 'welcome';
    const target = router.canonical(roleOf(flow), step);
    try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; return true; }
    return dispatch(target, { source:options.source || 'resume', replace:true });
  }

  function currentSurfaceIsHealthy(){
    const parsed = router.parse();
    if (!parsed) return state.isDone();
    const overlay = document.getElementById('onb2-overlay');
    return !!overlay && String(overlay.dataset.step || '') === parsed.step;
  }

  function reconcile(source, options = {}){
    if (state.isDone()) {
      if (router.isOnboarding()) return transitionToApp(draft.read(), { source, forceRoute:true });
      removeSurfaces();
      app.setActive(false);
      try { window.KaretaRoleAccess?.refresh?.(sessionRole(draft.read())); } catch (_error) {}
      lastAction = 'stable-app-preserve-route';
      return false;
    }
    if (!options.force && currentSurfaceIsHealthy()) return;
    if (router.isOnboarding()) dispatch(location.hash, { source, replace:true });
    else resume({ source });
  }

  function bindListeners(){
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('hashchange', () => dispatch(location.hash, { source:'hashchange', replace:true }));
    window.addEventListener('popstate', () => dispatch(location.hash, { source:'popstate', replace:false }));
    window.addEventListener('pageshow', event => { if (event.persisted) reconcile('pageshow-bfcache', { force:true }); });
    window.addEventListener('storage', event => {
      if (event.key === state.FLOW_KEY || state.DONE_KEYS.includes(event.key)) reconcile('storage-sync');
    });
    window.addEventListener('kareta:session-anonymous', event => {
      const flow=state.read();
      const hadCompletedState=state.isDone() || flow?.serverConfirmed === true || flow?.onboardingCompleted === true;
      if (!hadCompletedState) return;
      // Server/session authority wins over stale localStorage completion markers. Without this,
      // an expired/logout session can keep isDone() true and suppress the login surface forever.
      state.reset();
      clearTransientVerification();
      try { localStorage.removeItem('kareta.auth.user'); } catch (_error) {}
      try { sessionStorage.removeItem('kareta.auth.user'); } catch (_error) {}
      lastAction='session-anonymous-stale-done-reset';
      const target=router.canonical('client','welcome');
      try { history.replaceState(null,'',target); } catch (_error) { location.hash=target; return; }
      app.setActive(true);
      dispatch(target,{source:'session-anonymous-relogin',replace:true,detail:event?.detail||{}});
    });
    window.addEventListener('kareta:session-confirmed', event => {
      const detail=event.detail || {};
      const identity=detail.identity || window.KaretaIdentity?.snapshot?.() || {};
      const user=detail.user || window.KaretaNext?.state?.user || null;
      if (!identity?.authenticated && !user?.phone) return;
      const flow=draft.read();
      const explicitRole=state.role(detail?.result?.selectedRole || detail?.result?.entryRole || user?.entry_role || flow?.entryRole || flow?.role || identity?.compatibilityRole || user?.role || 'client');
      // finalize()/role_page.js own the successful transition while the role picker is active.
      // Completing + routing again from this listener caused CLIENT to inherit a stale MASTER
      // context and open the master questionnaire. Preserve the selected branch and defer.
      if (router.isOnboarding() || flow?.pending === true) {
        state.write({ role:explicitRole, entryRole:explicitRole });
        lastAction='session-confirmed-deferred-to-onboarding-owner';
        return;
      }
      const confirmedRole = state.role(identity?.compatibilityRole || user?.entry_role || user?.role || explicitRole);
      if (state.isDone()) {
        state.write({ role:confirmedRole, entryRole:confirmedRole, pending:false, stage:'done' });
        reconcile('session-confirmed', { force:true });
        return;
      }
      state.write({ role:confirmedRole, entryRole:confirmedRole });
      state.markComplete({
        role:confirmedRole,
        user:user || null,
        identityAccount:identity?.account || null,
        recoveredFromSession:true
      });
      reconcile('session-confirmed', { force:true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reconcile('visibility-resume');
    });
  }

  function installCompatibilityRoute(){
    const api = window.OnboardingV2;
    if (!api || api.__lifecycleRouteOwner) return;
    const coreOpen = profilePages.openFromRoute;
    api.openFromRoute = function(raw, options){
      const parsed = router.parse(raw || location.hash);
      if (!parsed) return coreOpen?.(raw, options || {});
      return dispatch(router.canonical(parsed.role, parsed.step), { source:'legacy-openFromRoute', replace:options?.replace !== false });
    };
    api.__lifecycleRouteOwner = true;
    window._onb2OpenRoute = api.openFromRoute;
  }

  function start(options = {}){
    if (!options.force && state.isDone() && !router.isOnboarding()) return false;
    if (options.force && options.skipWelcome === true && !router.isOnboarding()) {
      const target = router.canonical(draft.currentRole(), 'role');
      try { history.replaceState(null, '', target); } catch (_error) { location.hash = target; return true; }
      return dispatch(target, { source:options.source || 'forced-role-start', replace:true });
    }
    return resume({ source:options.source || 'start' });
  }

  function boot(options = {}){
    if (!booted) { booted = true; bindListeners(); installCompatibilityRoute(); }
    return start({ ...options, source:options.source || 'boot' });
  }

  function audit(){
    const flow = draft.read();
    return {
      ok:booted && listenersBound,
      booted, listenersBound, dispatching, dispatchCount, lastSource, lastAction,
      route:router.parse(), surface:String(flow.flowSurface || ''), stage:String(flow.stage || ''), done:state.isDone(),
      navigation:navigation.audit(), activeSteps:[...OVERLAY_STEPS]
    };
  }

  window.KaretaOnboardingLifecycle = Object.freeze({ boot, start, resume, dispatch, reconcile, transitionToApp, audit });
})();
;

/* SOURCE: js/next/onboarding_bridge.js */
(() => {
  'use strict';
  const state = window.KaretaOnboardingState;
  const router = window.KaretaOnboardingRouter;
  const app = window.KaretaOnboardingApp;
  const lifecycle = window.KaretaOnboardingLifecycle;
  const profilePages = window.KaretaOnboardingProfilePages;
  if (!state || !router || !app || !lifecycle || !profilePages) {
    throw new Error('Modular onboarding lifecycle is required before onboarding_bridge.js');
  }

  function finish(){
    if (!state.isDone()) return false;
    lifecycle.transitionToApp(state.read(), { source:'onboarding-bridge-finish', forceRoute:router.isOnboarding() });
    return true;
  }

  function start(options = {}){
    return lifecycle.start({
      force:options.force === true,
      skipWelcome:options.skipWelcome === true,
      source:options.source || 'onboarding-bridge-start'
    });
  }

  function boot(){ return lifecycle.boot({ source:'onboarding-bridge-boot' }); }

  function audit(){
    return {
      ...app.audit(),
      lifecycle:lifecycle.audit(),
      profile:profilePages.audit()
    };
  }

  window.KaretaOnboardingBridge = Object.freeze({
    boot,
    start,
    finish,
    isDone:state.isDone,
    isOnboardingHash:router.isOnboarding,
    audit
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
;

window.KaretaBootProfiler?.bundleEnd?.("runtime_onboarding_bundle");
