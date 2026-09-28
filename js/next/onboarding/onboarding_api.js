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
