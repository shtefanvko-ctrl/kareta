(() => {
  'use strict';
  const VERSION = String(window.KARETA_NEXT_ASSET_VERSION || '20260726-used-market-runtime-r170');
  const ENDPOINT = '/api/runtime_log.php';
  const DIAGNOSTICS_ENDPOINT = '/api/runtime_diagnostics.php';
  // R188.5.5.6.84.85: low-overhead cold-boot profiler. It is initialized inside
  // runtime_logger.js (the first executable boot module), so the profiler adds no
  // extra startup request. Earlier HTML/CSS/manifest timings are backfilled from
  // the Navigation/Resource Timing buffers.
  const bootProfiler = (() => {
    if (window.KaretaBootProfiler) return window.KaretaBootProfiler;
    const createdAt = performance.now();
    const marks = [];
    const spans = [];
    const openBundles = new Map();
    const once = new Set();
    const longTasks = [];
    let reportScheduled = false;

    const round = value => Math.max(0, Math.round(Number(value) || 0));
    const cleanMeta = value => {
      if (!value || typeof value !== 'object') return {};
      const out = {};
      Object.keys(value).slice(0, 20).forEach(key => {
        const item = value[key];
        if (/password|token|cookie|authorization|otp|code/i.test(key)) return;
        if (item == null || ['string','number','boolean'].includes(typeof item)) out[key] = typeof item === 'string' ? item.slice(0, 180) : item;
      });
      return out;
    };
    const safeName = name => String(name || 'stage').replace(/[^a-z0-9_.:-]+/gi, '_').slice(0, 120);
    const perfMark = name => {
      try { performance.mark(`kareta:${safeName(name)}`); } catch (_error) {}
    };

    function mark(name, meta = {}) {
      const item = { name:safeName(name), at:performance.now(), meta:cleanMeta(meta) };
      marks.push(item);
      if (marks.length > 120) marks.splice(0, marks.length - 120);
      perfMark(item.name);
      return item;
    }

    function markOnce(name, meta = {}) {
      const key = safeName(name);
      if (once.has(key)) return marks.find(item => item.name === key) || null;
      once.add(key);
      return mark(key, meta);
    }

    function start(name, meta = {}) {
      const token = { name:safeName(name), startedAt:performance.now(), meta:cleanMeta(meta), ended:false };
      mark(`${token.name}:start`, token.meta);
      return token;
    }

    function end(token, meta = {}) {
      if (!token || token.ended) return null;
      token.ended = true;
      const endedAt = performance.now();
      const item = {
        name:token.name,
        start:token.startedAt,
        end:endedAt,
        duration:Math.max(0, endedAt - token.startedAt),
        meta:{...token.meta, ...cleanMeta(meta)},
      };
      spans.push(item);
      if (spans.length > 120) spans.splice(0, spans.length - 120);
      mark(`${token.name}:end`, {durationMs:round(item.duration), ...item.meta});
      try { performance.measure(`kareta:${token.name}`, `kareta:${token.name}:start`, `kareta:${token.name}:end`); } catch (_error) {}
      return item;
    }

    function timePromise(name, promise, meta = {}) {
      const token = start(name, meta);
      return Promise.resolve(promise).then(
        value => { end(token, {ok:true}); return value; },
        error => { end(token, {ok:false,error:String(error?.message || error || 'error').slice(0,180)}); throw error; }
      );
    }

    function bundleStart(name, source = '') {
      const key = safeName(name);
      const token = start(`bundle.${key}`, {source:String(source || '').slice(0,180)});
      openBundles.set(key, token);
      return token;
    }

    function bundleEnd(name) {
      const key = safeName(name);
      const token = openBundles.get(key);
      openBundles.delete(key);
      return end(token, {ok:true});
    }

    try {
      if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes?.('longtask')) {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            longTasks.push({start:entry.startTime,duration:entry.duration,name:String(entry.name || 'longtask')});
            if (longTasks.length > 40) longTasks.splice(0, longTasks.length - 40);
          }
        });
        observer.observe({type:'longtask', buffered:true});
      }
    } catch (_error) {}

    const resourceRows = () => {
      try {
        return performance.getEntriesByType('resource').map(entry => {
          let url = '';
          try {
            const parsed = new URL(entry.name, location.href);
            url = `${parsed.pathname}${parsed.search}`;
          } catch (_error) { url = String(entry.name || ''); }
          return {
            url,
            initiatorType:String(entry.initiatorType || ''),
            start:round(entry.startTime),
            duration:round(entry.duration),
            responseEnd:round(entry.responseEnd),
            transferSize:Number(entry.transferSize || 0),
            encodedBodySize:Number(entry.encodedBodySize || 0),
          };
        });
      } catch (_error) { return []; }
    };

    function snapshot(extra = {}) {
      const nav = performance.getEntriesByType?.('navigation')?.[0] || null;
      const paintEntries = performance.getEntriesByType?.('paint') || [];
      const paints = Object.fromEntries(paintEntries.map(entry => [entry.name, round(entry.startTime)]));
      const resources = resourceRows();
      const bootJsPattern = /\/(?:js\/boot\/runtime_[^/?]+_bundle\.js|js\/next\/(?:runtime_logger|runtime_dependencies|recovery_manager|diagnostics_snapshot|app_preloader|app_next)\.js)(?:\?|$)/;
      const bootJs = resources.filter(item => bootJsPattern.test(item.url));
      const criticalCss = resources.filter(item => /\/css\/runtime_boot_bundle\.css(?:\?|$)/.test(item.url));
      const manifests = resources.filter(item => /\/asset_manifest\.php(?:\?|$)/.test(item.url));
      const apiReads = resources.filter(item => /\/api\/(?:db\.php|identity_session\.php|auth_session\.php|context\.php)(?:\?|$)/.test(item.url));
      const milestone = name => {
        const item = marks.find(entry => entry.name === name);
        return item ? round(item.at) : 0;
      };
      const bundleSpans = spans.filter(item => item.name.startsWith('bundle.')).map(item => ({
        name:item.name.replace(/^bundle\./,''),
        start:round(item.start),
        duration:round(item.duration),
      }));
      const stageSpans = spans.filter(item => !item.name.startsWith('bundle.')).map(item => ({
        name:item.name,
        start:round(item.start),
        duration:round(item.duration),
        meta:item.meta,
      }));
      const firstRender = milestone('first-render');
      const interactive = milestone('interactive');
      return {
        version:VERSION,
        route:String(extra.route || location.hash || '#/home'),
        status:String(extra.status || 'ok').slice(0,40),
        error:String(extra.error || '').slice(0,180),
        navigation:{
          responseStart:round(nav?.responseStart),
          responseEnd:round(nav?.responseEnd),
          domInteractive:round(nav?.domInteractive),
          domContentLoaded:round(nav?.domContentLoadedEventEnd),
          loadEventEnd:round(nav?.loadEventEnd),
        },
        paint:{
          firstPaint:Number(paints['first-paint'] || 0),
          firstContentfulPaint:Number(paints['first-contentful-paint'] || 0),
          firstRender,
          firstFrame:milestone('first-frame'),
          interactive,
        },
        milestones:marks.map(item => ({name:item.name,at:round(item.at),meta:item.meta})),
        stages:stageSpans,
        bundles:bundleSpans,
        transport:{
          criticalCss,
          manifests,
          bootJs,
          apiReads,
          bootJsRequests:bootJs.length,
          bootJsTransfer:bootJs.reduce((sum,item)=>sum+Number(item.transferSize||0),0),
        },
        mainThread:{
          longTaskCount:longTasks.length,
          longTaskTotalMs:round(longTasks.reduce((sum,item)=>sum+Number(item.duration||0),0)),
          longestLongTaskMs:round(longTasks.reduce((max,item)=>Math.max(max,Number(item.duration||0)),0)),
          longTasks:longTasks.map(item=>({start:round(item.start),duration:round(item.duration),name:item.name})),
        },
        totalMs:interactive || firstRender || round(performance.now()),
        capturedAt:new Date().toISOString(),
      };
    }

    function report(meta = {}) {
      const data = snapshot(meta);
      window.KaretaBootProfile = data;
      try { sessionStorage.setItem('kareta_boot_profile_v1', JSON.stringify(data)); } catch (_error) {}
      try {
        console.groupCollapsed(`[KARETA][boot.profile] ${data.totalMs}ms · ${data.route}`);
        console.table([
          {stage:'HTML response',ms:data.navigation.responseEnd},
          {stage:'Critical CSS',ms:data.transport.criticalCss.reduce((max,item)=>Math.max(max,item.responseEnd||0),0)},
          {stage:'Manifest',ms:data.transport.manifests.reduce((max,item)=>Math.max(max,item.responseEnd||0),0)},
          {stage:'First render',ms:data.paint.firstRender},
          {stage:'First frame',ms:data.paint.firstFrame},
          {stage:'Interactive',ms:data.paint.interactive},
          {stage:'FCP',ms:data.paint.firstContentfulPaint},
          {stage:'Long tasks total',ms:data.mainThread.longTaskTotalMs},
        ]);
        if (data.bundles.length) console.table(data.bundles);
        console.info('Boot transport:', data.transport);
        console.info('Full profile:', data);
        console.groupEnd();
      } catch (_error) {}
      try { window.KaretaRuntimeLog?.add?.('boot.profile', data, 'info'); } catch (_error) {}
      try { window.dispatchEvent(new CustomEvent('kareta:boot-profile',{detail:data})); } catch (_error) {}
      return data;
    }

    function scheduleReport(meta = {}) {
      if (reportScheduled) return false;
      reportScheduled = true;
      const run = () => window.setTimeout(() => report(meta), 0);
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => window.requestAnimationFrame(run));
      else run();
      return true;
    }

    const api = Object.freeze({
      mark, markOnce, start, end, timePromise, bundleStart, bundleEnd, snapshot, report, scheduleReport,
      export:() => JSON.stringify(snapshot(), null, 2),
      startedAt:createdAt,
    });
    window.KaretaBootProfiler = api;
    markOnce('runtime-logger-execute', {version:VERSION});
    return api;
  })();

  let diagnosticRequest = null;
  let diagnosticLastAt = 0;
  let diagnosticLastPayload = null;
  window.__KARETA_ERROR_BOUNDARY__ = window.__KARETA_ERROR_BOUNDARY__ || 'runtime_logger';
  const MAX_BUFFER = 80;
  const STORAGE_KEY = 'kareta_runtime_log_v1';
  const sessionId = (() => {
    try {
      const old = sessionStorage.getItem('kareta_trace_session');
      if (old) return old;
      const id = `ks_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
      sessionStorage.setItem('kareta_trace_session', id);
      return id;
    } catch (_) { return `ks_${Date.now().toString(36)}`; }
  })();
  let sequence = 0;
  let flushing = false;
  let timer = null;
  let retryDelayMs = 1200;
  let serverStressUntil = 0;
  const buffer = [];

  const clean = (value, depth = 0) => {
    if (depth > 3) return '[depth]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.slice(0, 2000);
    if (value instanceof Error) return { name:value.name, message:value.message, stack:String(value.stack || '').slice(0,8000) };
    if (Array.isArray(value)) return value.slice(0,30).map(v => clean(v, depth + 1));
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).slice(0,50).forEach(key => {
        if (/password|token|code_hash|authorization|cookie/i.test(key)) out[key] = '[redacted]';
        else if (key === 'code' && String(value[key]).length <= 8) out[key] = '[redacted]';
        else out[key] = clean(value[key], depth + 1);
      });
      return out;
    }
    return String(value).slice(0,1000);
  };

  function persist(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX_BUFFER))); } catch (_) {}
  }

  function add(type, data = {}, level = 'info'){
    const entry = {
      time:new Date().toISOString(),
      perf:Math.round(performance.now()),
      seq:++sequence,
      sessionId,
      version:VERSION,
      level,
      type:String(type || 'event'),
      route:String(location.hash || location.pathname || ''),
      online:navigator.onLine,
      visibility:document.visibilityState,
      data:clean(data)
    };
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
    persist();
    schedule();
    return entry;
  }

  function schedule(){
    if (timer) return;
    const delay=Math.max(retryDelayMs,serverStressUntil>Date.now()?serverStressUntil-Date.now():0);
    timer = setTimeout(() => { timer = null; flush(); }, delay);
  }

  function markServerStress(ms=30000){
    const delay=Math.max(5000,Number(ms)||30000);
    serverStressUntil=Math.max(serverStressUntil,Date.now()+delay);
    retryDelayMs=Math.max(retryDelayMs,Math.min(60000,delay));
    if(timer){clearTimeout(timer);timer=null;}
    schedule();
  }

  async function flush(useBeacon = false){
    if (flushing || !buffer.length) return;
    if (!navigator.onLine && !useBeacon) { retryDelayMs = Math.min(60000, Math.max(5000, retryDelayMs * 2)); schedule(); return; }
    if (!useBeacon && Date.now()<serverStressUntil) { schedule(); return; }
    const batch = buffer.splice(0, Math.min(buffer.length, 30));
    persist();
    const body = JSON.stringify({ sessionId, version:VERSION, url:location.href, events:batch });
    if (useBeacon && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], {type:'application/json'}));
      if (!ok) buffer.unshift(...batch);
      persist();
      return;
    }
    flushing = true;
    try {
      const response = await fetch(ENDPOINT, {
        method:'POST', credentials:'same-origin', cache:'no-store', keepalive:true,
        headers:{'Content-Type':'application/json','X-Kareta-Logger':'1'}, body
      });
      if (!response.ok) throw new Error(`logger_http_${response.status}`);
      retryDelayMs = 1200;
    } catch (_) {
      buffer.unshift(...batch);
      if (buffer.length > MAX_BUFFER) buffer.length = MAX_BUFFER;
      persist();
      retryDelayMs = Math.min(60000, Math.max(5000, retryDelayMs * 2));
      schedule();
    } finally { flushing = false; }
  }

  async function loadServerDiagnostics(reason = 'manual'){
    if (diagnosticRequest) return diagnosticRequest;
    if (diagnosticLastPayload && Date.now()-diagnosticLastAt<30000) return diagnosticLastPayload;
    diagnosticLastAt=Date.now();
    diagnosticRequest = (async () => {
      try {
        const response = await originalFetch(DIAGNOSTICS_ENDPOINT, {credentials:'same-origin', cache:'no-store', headers:{'X-Kareta-Diagnostics':'1'}});
        const payload = await response.json();
        const diagnostic = payload?.diagnostic || {};
        const publicState=String(payload?.databaseState||'');
        const publicMessages={
          configuration_missing:'Не переданы приватные параметры подключения к БД.',
          pdo_mysql_missing:'В PHP не включён драйвер pdo_mysql.',
          credentials_rejected:'MySQL отклонил пользователя, пароль или права.',
          database_not_found:'Указанная база данных не найдена.',
          server_unreachable:'Сервер MySQL недоступен по заданному адресу или порту.',
          schema_initialization_failed:'Соединение с MySQL установлено, но миграция или проверка схемы завершилась ошибкой.',
          connection_failed:'Не удалось установить или подготовить соединение с БД.'
        };
        const publicHints={
          configuration_missing:'Восстановить config.private.php или переменные KARETA_DB_*.',
          pdo_mysql_missing:'Включить расширение pdo_mysql для выбранной версии PHP.',
          credentials_rejected:'Проверить пользователя, пароль и его права на production БД.',
          database_not_found:'Проверить точное имя production БД в Plesk.',
          server_unreachable:'Проверить DB host, порт, MySQL и firewall.',
          schema_initialization_failed:'Исправить неприменённую миграцию и повторить readiness check.',
          connection_failed:'Открыть авторизованную серверную диагностику.'
        };
        const dbReady=payload?.dbReady===true && publicState==='ready';
        console.group(`%c[KARETA][SERVER DIAGNOSTICS] ${dbReady?'ready':(diagnostic.category || publicState || 'unknown')}`, dbReady?'font-weight:bold;color:#15803d':'font-weight:bold;color:#b91c1c');
        const diagnosticMessage=diagnostic.message || publicMessages[publicState] || (dbReady?'База данных готова':'Диагностика не вернула сообщение');
        (dbReady?console.info:console.error)('Причина:', diagnosticMessage);
        if (diagnostic.hint || publicHints[publicState]) console.info('Что проверить:', diagnostic.hint || publicHints[publicState]);
        if(!dbReady) console.error(`[KARETA][DB FAILURE] stage=${payload?.failureStage || diagnostic.failureContext?.stage || '-'} migration=${payload?.failedMigrationVersion || diagnostic.failureContext?.migrationVersion || 0} diagnostic=${payload?.diagnosticCode || diagnostic.diagnosticCode || '-'} sqlState=${payload?.failureSqlState || diagnostic.exception?.sqlState || '-'} driver=${payload?.failureDriverCode || diagnostic.exception?.driverCode || '-'}`);
        const hasAuthorizedDiagnostic=!!payload?.diagnostic;
        const hidden='[not exposed]';
        console.table({
          dbReady: !!payload?.dbReady,
          databaseState: payload?.databaseState || '',
          runtimeState: payload?.runtimeState || '',
          configurationSource: payload?.configurationSource || '',
          missingConfigurationFields: Array.isArray(payload?.missingConfigurationFields) ? payload.missingConfigurationFields.join(',') : '',
          failureStage: payload?.failureStage || diagnostic.failureContext?.stage || '',
          failedMigrationVersion: payload?.failedMigrationVersion || diagnostic.failureContext?.migrationVersion || 0,
          failedMigrationFile: payload?.failedMigrationFile || diagnostic.failureContext?.migrationFile || '',
          diagnosticCode: payload?.diagnosticCode || diagnostic.diagnosticCode || '',
          failureCategory: payload?.failureCategory || diagnostic.category || '',
          failureSqlState: payload?.failureSqlState || diagnostic.exception?.sqlState || '',
          failureDriverCode: payload?.failureDriverCode || diagnostic.exception?.driverCode || '',
          phase: hasAuthorizedDiagnostic ? (diagnostic.phase || '') : hidden,
          category: hasAuthorizedDiagnostic ? (diagnostic.category || '') : hidden,
          host: hasAuthorizedDiagnostic ? (diagnostic.config?.host || '') : hidden,
          port: hasAuthorizedDiagnostic ? (diagnostic.config?.port || '') : hidden,
          database: hasAuthorizedDiagnostic ? (diagnostic.config?.database || '') : hidden,
          username: hasAuthorizedDiagnostic ? (diagnostic.config?.username || '') : hidden,
          passwordConfigured: hasAuthorizedDiagnostic ? (diagnostic.config?.passwordConfigured ?? false) : hidden,
          passwordLength: hasAuthorizedDiagnostic ? (diagnostic.config?.passwordLength ?? 0) : hidden,
          pdoMysqlDriver: hasAuthorizedDiagnostic ? (diagnostic.pdoMysqlDriver ?? '') : hidden,
          phpVersion: hasAuthorizedDiagnostic ? (diagnostic.php?.version || '') : hidden,
          requestId: hasAuthorizedDiagnostic ? (diagnostic.requestId || '') : hidden,
          traceId: hasAuthorizedDiagnostic ? (diagnostic.traceId || '') : hidden,
          reason
        });
        if (diagnostic.exception) {
          console.error('PDO/MySQL:', diagnostic.exception.message || diagnostic.message || 'unknown');
          console.table({
            exceptionType: diagnostic.exception.type || '',
            exceptionCode: diagnostic.exception.code || '',
            sqlState: diagnostic.exception.sqlState || '',
            driverCode: diagnostic.exception.driverCode || '',
            driverMessage: diagnostic.exception.driverMessage || '',
            file: diagnostic.exception.file || '',
            line: diagnostic.exception.line || ''
          });
        }
        console.info('Полный безопасный отчёт:', payload);
        console.groupEnd();
        add('server.diagnostics', {reason, payload}, payload?.dbReady ? 'info' : 'error');
        diagnosticLastPayload=payload;
        return payload;
      } catch (error) {
        console.error('[KARETA][SERVER DIAGNOSTICS] Не удалось получить диагностику', error);
        return {ok:false,error:String(error?.message || error)};
      } finally {
        diagnosticRequest = null;
      }
    })();
    return diagnosticRequest;
  }

  const DATABASE_FAILURE_CODES=new Set(['database_unavailable','configuration_missing','pdo_mysql_missing','credentials_rejected','database_not_found','server_unreachable','schema_initialization_failed','connection_failed']);

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init = {}){
    const url = typeof input === 'string' ? input : String(input?.url || '');
    if (url.includes('/api/runtime_log.php') || url.includes('/api/runtime_diagnostics.php')) return originalFetch(input, init);
    const method = String(init.method || input?.method || 'GET').toUpperCase();
    const traceId = `kt_${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2,7)}`;
    const started = performance.now();
    const headers = new Headers(init.headers || input?.headers || {});
    headers.set('X-Kareta-Trace-Id', traceId);
    headers.set('X-Kareta-Client-Version', VERSION);
    let action = '';
    try {
      if (typeof init.body === 'string' && init.body[0] === '{') action = String(JSON.parse(init.body)?.action || '');
    } catch (_) {}
    add('fetch.start', {traceId, method, url, action});
    try {
      const response = await originalFetch(input, {...init, headers});
      let responseMeta = {};
      if (/\/api\//.test(url)) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          const payload = text && text[0] === '{' ? JSON.parse(text) : null;
          responseMeta = {
            error:payload?.error || '',
            requestId:payload?.requestId || response.headers.get('X-Kareta-Request-Id') || '',
            serverTraceId:response.headers.get('X-Kareta-Trace-Id') || '',
            contentType:response.headers.get('content-type') || '',
            ok:payload?.ok,
            deliveryCategory:payload?.deliveryCategory || '',
            providerStatus:Number(payload?.providerStatus || 0),
            retryAfter:Number(payload?.retryAfter || response.headers.get('Retry-After') || 0),
            bodyPreview:text.slice(0,1200)
          };
        } catch (_) {}
      }
      const expectedAnonymousContext = response.status === 401 && /\/api\/organizations\.php(?:\?|$)/.test(url) && /(?:^|[?&])action=contexts(?:&|$)/.test(url);
      const authLifecycleFailure = [401,403,409].includes(response.status) && /\/api\/(?:identity_session|identity\/session|context\.php|context\/)/.test(url);
      const expectedOtpFailure = ['otp_delivery_failed','otp_delivery_unavailable','challenge_rate_limited'].includes(String(responseMeta.error||''))
        && /\/api\/(?:auth_session\.php|onboarding_code\.php)/.test(url);
      const applicationFailed = responseMeta.ok === false || !!responseMeta.error;
      const failed = !response.ok || applicationFailed;
      const expectedFailure = expectedAnonymousContext || authLifecycleFailure || expectedOtpFailure;
      const details = {traceId, method, url, action, status:response.status, ok:response.ok, applicationOk:responseMeta.ok, expected:expectedFailure, authLifecycleFailure, expectedOtpFailure, durationMs:Math.round(performance.now()-started), ...responseMeta};
      if([429,502,503,504].includes(response.status)){
        markServerStress(Math.max(30000,Number(responseMeta.retryAfter||0)*1000));
      }
      add('fetch.end', details, failed && !expectedFailure ? 'error' : failed ? 'warn' : 'info');
      if (failed && !expectedAnonymousContext && /\/api\//.test(url)) {
        if(authLifecycleFailure){
          console.warn('[KARETA][auth.lifecycle]', details);
          try{window.dispatchEvent(new CustomEvent('kareta:api-auth-failure',{detail:details}));}catch(_error){}
        }else if(expectedOtpFailure){
          console.warn('[KARETA][otp.delivery]', details);
        }else console.error('[KARETA][api.failure]', details);
        if (DATABASE_FAILURE_CODES.has(String(responseMeta.error||''))) loadServerDiagnostics(`${action || method} ${url}`);
      }
      return response;
    } catch (error) {
      markServerStress(30000);
      add('fetch.error', {traceId, method, url, action, durationMs:Math.round(performance.now()-started), error}, 'error');
      throw error;
    }
  };

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      add('resource.error', {source:target.src || target.href, tag:target.tagName || ''}, 'error');
      return;
    }
    add('window.error', {message:event.message, source:event.filename, line:event.lineno, column:event.colno, error:event.error}, 'error');
  }, true);
  window.addEventListener('unhandledrejection', event => add('promise.unhandled', {reason:event.reason}, 'error'));
  window.addEventListener('online', () => { retryDelayMs = 1200; add('network.online'); flush(); });
  window.addEventListener('offline', () => add('network.offline', {}, 'warn'));
  window.addEventListener('hashchange', () => add('route.hashchange', {hash:location.hash}));
  document.addEventListener('click', event => {
    const el = event.target?.closest?.('button,a,[role="button"],input[type="submit"]');
    if (!el) return;
    add('ui.click', {tag:el.tagName, id:el.id, className:String(el.className || '').slice(0,300), text:String(el.textContent || el.value || '').trim().slice(0,160), disabled:!!el.disabled});
  }, true);
  document.addEventListener('submit', event => add('ui.submit', {id:event.target?.id || '', className:String(event.target?.className || '').slice(0,300)}), true);
  document.addEventListener('visibilitychange', () => add('page.visibility', {state:document.visibilityState}));
  window.addEventListener('pagehide', () => flush(true));

  window.KaretaRuntimeLog = Object.freeze({
    add, flush,
    snapshot:() => buffer.slice(),
    export:() => JSON.stringify({sessionId, version:VERSION, url:location.href, events:buffer}, null, 2),
    clear:() => { buffer.length = 0; persist(); },
    diagnostics:loadServerDiagnostics
  });
  window.KaretaDiagnostics = Object.freeze({ run:loadServerDiagnostics });
  add('logger.ready', {userAgent:navigator.userAgent, screen:`${screen.width}x${screen.height}`, serviceWorker:!!navigator.serviceWorker});
})();
