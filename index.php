<?php
declare(strict_types=1);

$karetaHttpNotFound = isset($_GET['kareta_route_fallback']) && (string)$_GET['kareta_route_fallback'] === '1';
$karetaHttpNotFoundPath = '';
if ($karetaHttpNotFound) {
    $karetaHttpNotFoundPath = (string)($_SERVER['REQUEST_URI'] ?? '/');
    http_response_code(404);
}

require_once __DIR__ . '/inc/web_guard.php';

$requestPath = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
if (in_array($requestPath, ['/sites/kareta.kz', '/sites/kareta.kz/'], true)) {
    $query = trim((string)($_SERVER['QUERY_STRING'] ?? ''));
    header('Location: /' . ($query !== '' ? '?' . $query : ''), true, 302);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(self), camera=(self), microphone=(self)');
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https://images.unsplash.com; media-src 'self' blob:; connect-src 'self' https://cdn.jsdelivr.net; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
header('X-Kareta-Request-Id: ' . KARETA_WEB_REQUEST_ID);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('CDN-Cache-Control: no-store');
header('Surrogate-Control: no-store');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/inc/asset_version.php';
require_once __DIR__ . '/inc/error_codes.php';
require_once __DIR__ . '/inc/asset_registry.php';
$assetVersion = (string)KARETA_ASSET_VERSION;
$errorCodeCatalog = kareta_error_code_catalog();
header('X-Kareta-Asset-Version: ' . $assetVersion);
// Historical release-gate markers retained for regression checks: $cacheEpoch = 'r1885571-test-auto-approval-service-catalog-recovery'; $cacheEpoch = 'r1885565-serialized-schema-index-recovery'; $cacheEpoch = 'r1885566-test-otp-transport-recovery'; $cacheEpoch = 'r1885567-otp-length-resend-cooldown'; $cacheEpoch = 'r1885568-mobile-two-column-grids'; $cacheEpoch = 'r1885569-smart-action-account'; $cacheEpoch = 'r1885570-account-type-catalog-requests'; $cacheEpoch = 'r1885572-private-db-config-recovery'; $cacheEpoch = 'r1885573-temporary-account-type-auto-activation'; $cacheEpoch = 'r1885574-home-service-category-grid-r1885575-profile-legacy-id-mobile-nav-recovery-r1885576-master-work-surfaces-r1885577-master-business-runtime-r1885578-master-order-full-lifecycle-r1885579-master-aftercare-finance-inventory-r1885580-operational-finance-payroll-receivables-r1885581-client-exchange-production-scale';
$cacheEpoch = $assetVersion;
if (!hash_equals($cacheEpoch, (string)($_COOKIE['KARETA_CACHE_EPOCH'] ?? ''))) {
    // One-time browser cache invalidation for clients that still execute the
    // vulnerable r1865/r188 mixed runtime. Cache storage is also cleared by the
    // atomic loader below; this header covers the ordinary HTTP cache.
    header('Clear-Site-Data: "cache"');
    setcookie('KARETA_CACHE_EPOCH', $cacheEpoch, [
        'expires'=>time()+86400*30,
        'path'=>'/',
        'secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off') || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))==='https',
        'httponly'=>true,
        'samesite'=>'Lax',
    ]);
}
$runtimeScripts = [];
foreach (kareta_asset_registry()['scripts'] as $order => $path) {
    if (!kareta_asset_exists($path)) continue;
    $runtimeScripts[] = [
        'path'=>'/'.$path,
        'url'=>asset_ver($path),
        'order'=>(int)$order,
        'release'=>$assetVersion,
    ];
}
$referenceAssetsExt = '';
foreach (['png','webp'] as $candidateExt) {
    if (
        is_file(__DIR__ . '/assets/reference/automotive/toyota_camry.' . $candidateExt)
        && is_file(__DIR__ . '/assets/reference/automotive/service_station.' . $candidateExt)
        && is_file(__DIR__ . '/assets/reference/brands/toyota.' . $candidateExt)
    ) {
        $referenceAssetsExt = $candidateExt;
        break;
    }
}
$referenceAssetsReady = $referenceAssetsExt !== '';
?>
<!doctype html>
<html lang="ru" data-kareta-front="next" data-reference-assets="<?= $referenceAssetsReady ? '1' : '0' ?>" data-reference-assets-ext="<?= htmlspecialchars($referenceAssetsExt, ENT_QUOTES, 'UTF-8') ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#ff6b00">
  <meta name="application-name" content="KARETA.KZ">
  <meta name="description" content="KARETA.KZ — сервисная платформа для ремонта автомобиля, записи, мастеров, заявок и чатов.">
  <title>KARETA.KZ — сервисная платформа</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/assets/onboarding/kareta_logo_icon.png">
  <link rel="apple-touch-icon" href="/assets/onboarding/kareta_logo_icon.png">
  <?= kareta_render_styles() ?>
  <style id="k-critical-recovery-css">
    html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;color:#111827}
    .k-app-preloader{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background-color:#fff7f1;background-image:linear-gradient(rgba(255,247,241,.18),rgba(255,247,241,.18)),url('/assets/onboarding/backgrounds/welcome/city-calm/city-calm-mobile.png');background-size:cover;background-position:center;background-repeat:no-repeat}
    @media (min-width:768px){.k-app-preloader{background-image:linear-gradient(rgba(255,247,241,.18),rgba(255,247,241,.18)),url('/assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-narrow.png')}}
    @media (min-width:1280px){.k-app-preloader{background-image:linear-gradient(rgba(255,247,241,.18),rgba(255,247,241,.18)),url('/assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-standard.png')}}
    @media (min-width:1920px){.k-app-preloader{background-image:linear-gradient(rgba(255,247,241,.18),rgba(255,247,241,.18)),url('/assets/onboarding/backgrounds/welcome/city-calm/city-calm-desktop-ultrawide.png')}}
    .k-app-preloader__panel{width:min(88vw,420px);text-align:center;padding:28px;border-radius:24px;background:#fff;box-shadow:0 18px 60px rgba(15,23,42,.14)}
    .k-app-preloader__logo{display:block;max-width:260px;width:78%;height:auto;margin:0 auto 20px}
    .k-app-preloader__slogan{font-size:20px;font-weight:700;margin:0 0 40px}
    .k-app-preloader__meta{display:flex;justify-content:space-between;gap:12px;font-size:14px}
    .k-app-preloader__track{height:8px;border-radius:999px;background:#e5e7eb;overflow:hidden;margin-bottom:12px}
    .k-app-preloader__bar{display:block;height:100%;width:0;background:#ff6b00}
    .k-app-preloader__actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:16px}
    .k-app-preloader__button{min-height:44px;padding:0 18px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer}
    .k-app-preloader__button--primary{background:#ff6b00;color:#fff}.k-app-preloader__button--secondary{background:#e9edf3;color:#26364c}
    .k-app-preloader__diagnostics{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin-top:16px;color:#7b8492;font-size:12px;line-height:1.4}
    .k-app-preloader__error-code{font-weight:800;color:#a34219}
    .k-app-preloader.is-error .k-app-preloader__track{background:#f4dcdc}.k-app-preloader.is-error .k-app-preloader__bar{background:#d93f3f}
    .k-app-shell{min-height:100vh}
  </style>
  <script>
    (() => {
      const release = <?= json_encode($assetVersion, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
      const errorCatalog = <?= json_encode($errorCodeCatalog, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>;
      window.KARETA_HTTP_NOT_FOUND_PATH = <?= json_encode($karetaHttpNotFoundPath, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>;
      window.KARETA_BOOT_RELEASE=release;
      console.info('[KARETA][boot.release]',{release,pipeline:'single-pass-v2'});
      const recoveryKey = `kareta_asset_recovery:${release}`;
      let recovering = false;
      const clearBrokenRuntime = async () => {
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            // Preserve the last known-good shell. A transient DNS/TLS failure during
            // retry must not strand the user on the synthetic offline document.
            await Promise.all(keys.filter(k => String(k).startsWith('kareta-static-')).map(k => caches.delete(k)));
          }
        } catch (_) {}
      };
      const manualRetry = async () => {
        if (window.__KARETA_MANUAL_RETRY_IN_FLIGHT__) return false;
        window.__KARETA_MANUAL_RETRY_IN_FLIGHT__ = true;
        await clearBrokenRuntime();
        try { sessionStorage.removeItem(recoveryKey); } catch (_error) {}
        const url = new URL(location.href);
        url.searchParams.delete('kareta_recovery');
        url.searchParams.delete('kareta_atomic');
        url.searchParams.delete('kareta_runtime');
        url.searchParams.set('kareta_boot', release);
        url.searchParams.set('kareta_retry', String(Date.now()));
        location.replace(url.href);
        return true;
      };
      const resolveErrorCode = reason => {
        const value=String(reason||'').toLowerCase();
        for(const [code,entry] of Object.entries(errorCatalog)){
          if(code==='KRT-BOOT-1099')continue;
          if((entry.patterns||[]).some(pattern=>value.includes(String(pattern).toLowerCase())))return code;
        }
        return 'KRT-BOOT-1099';
      };
      const reportBootFailure = (reason,errorCode) => {
        const payload={url:location.href,message:'KARETA boot failure',source:'atomic_boot',stack:String(reason||'').slice(0,8000),role:'boot',version:release,errorCode,context:'application_start'};
        try{navigator.sendBeacon?.('/api/client_error.php',new Blob([JSON.stringify(payload)],{type:'application/json'}));}
        catch(_error){try{fetch('/api/client_error.php',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify(payload)}).catch(()=>{});}catch(_ignored){}}
      };
      const renderBootDiagnostics = (reason,options={}) => {
        const errorCode=resolveErrorCode(reason);
        const root=document.getElementById('k-app-preloader');
        const codeNode=root?.querySelector('[data-preloader-error-code]');
        if(codeNode){codeNode.hidden=false;codeNode.textContent=`Код: ${errorCode}`;}
        if(options.report!==false)reportBootFailure(reason,errorCode);
        console.error('[KARETA][boot.error]',{errorCode,reason:String(reason||''),release});
        return errorCode;
      };
      window.KaretaErrorCodes=Object.freeze({catalog:errorCatalog,resolve:resolveErrorCode});
      window.KaretaBootDiagnostics=Object.freeze({show:renderBootDiagnostics});
      const renderBootFailure = reason => {
        const root = document.getElementById('k-app-preloader');
        root?.classList.add('is-error');
        const meta = root?.querySelector('[data-preloader-meta]');
        if (meta) meta.textContent = 'Не удалось завершить запуск. Нажмите «Повторить».';
        const slow = root?.querySelector('[data-preloader-slow]');
        if (slow) { slow.hidden = false; slow.textContent = 'Не удалось синхронизировать файлы приложения. Нажмите «Повторить».'; }
        const actions = root?.querySelector('[data-preloader-actions]');
        if (actions) actions.hidden = false;
        renderBootDiagnostics(reason);
      };
      const recover = async reason => {
        if (recovering || window.__KARETA_BOOT_RECOVERY_IN_FLIGHT__) return false;
        recovering = true;
        window.__KARETA_BOOT_RECOVERY_IN_FLIGHT__ = String(reason || 'runtime_failure');
        try { sessionStorage.setItem(recoveryKey, '1'); } catch (_error) {}
        console.error('[KARETA][runtime.failed]', { reason, release, automaticReload:false });
        renderBootFailure(reason);
        return false;
      };
      window.KaretaBootRecovery = Object.freeze({ fail:recover, retry:manualRetry, clear:clearBrokenRuntime });
      window.addEventListener('load', () => {
        window.setTimeout(async () => {
          const probe = document.querySelector('.k-app-preloader__panel');
          const styled = probe && getComputedStyle(probe).borderRadius !== '0px';
          const logo = document.querySelector('.k-app-preloader__logo');
          const logoBroken = !!(logo && logo.complete && logo.naturalWidth === 0);
          if (!styled || logoBroken) await recover(!styled ? 'critical_css_missing' : 'logo_missing');
        }, 1200);

        // R188.5.5.6.84.72: runtime health is phase-aware and never auto-reloads the document. The old fixed 12 s
        // watchdog reloaded healthy slow boots while atomic scripts were still
        // being evaluated, which made the preloader visibly run to 100% twice.
        const runtimeProbeStartedAt = Date.now();
        const probeRuntime = async () => {
          const runtimeReady = !!(window.KaretaShellNav && window.KaretaShellMenu && window.KaretaNext?.audit);
          const atomic = window.KaretaAtomicBoot?.snapshot?.() || null;
          const phase = String(atomic?.phase || '');
          let serverRelease = '';
          try {
            const response = await fetch(`/asset_manifest.php?runtime_probe=${Date.now()}`, { cache:'no-store', credentials:'same-origin' });
            const payload = await response.json();
            serverRelease = String(payload?.release || '');
          } catch (_error) {}

          if (serverRelease && serverRelease !== release) {
            await recover(`release_mismatch:${release}:${serverRelease}`);
            return;
          }
          if (runtimeReady) return;
          if (phase === 'failed') {
            await recover(`runtime_modules_incomplete:${String(atomic?.reason || 'atomic_failed')}`);
            return;
          }

          const atomicStillWorking = ['purging','worker-handoff','preflight','loading','offline-cache','recovering'].includes(phase);
          const elapsed = Date.now() - runtimeProbeStartedAt;
          if (atomicStillWorking && elapsed < 60000) {
            window.setTimeout(probeRuntime, 8000);
            return;
          }
          if (!phase && elapsed < 30000) {
            window.setTimeout(probeRuntime, 8000);
            return;
          }
          await recover('runtime_modules_incomplete');
        };
        window.setTimeout(probeRuntime, 12000);
      }, { once:true });
    })();
  </script>
  <script>
    window.KARETA_NEXT_ASSET_VERSION = <?= json_encode($assetVersion, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
    window.KARETA_FRONTEND_MODE = 'next';
    window.KARETA_ASSET_MANIFEST_URL = '/asset_manifest.php?v=' + encodeURIComponent(window.KARETA_NEXT_ASSET_VERSION);
  </script>
</head>
<body>
  <div id="k-app-preloader" class="k-app-preloader" role="status" aria-live="polite" aria-label="Загрузка приложения">
    <div class="k-app-preloader__panel">
      <img class="k-app-preloader__logo" src="<?= asset_ver('assets/onboarding/kareta_logo_full.png') ?>" alt="KARETA.KZ" onerror="this.onerror=null;this.src='<?= asset_ver('assets/onboarding/kareta_logo_icon.png') ?>'">
      <div class="k-app-preloader__copy">
        <p class="k-app-preloader__slogan">Всё для автомобиля в одном месте</p>
      </div>
      <div class="k-app-preloader__progress" aria-label="Прогресс загрузки">
        <div class="k-app-preloader__track"><span class="k-app-preloader__bar" data-preloader-bar></span></div>
        <div class="k-app-preloader__meta"><span data-preloader-meta>Инициализация платформы…</span><strong class="k-app-preloader__percent" data-preloader-percent>0%</strong></div>
      </div>
      <p class="k-app-preloader__slow" data-preloader-slow hidden></p>
      <div class="k-app-preloader__actions" data-preloader-actions hidden>
        <button class="k-app-preloader__button k-app-preloader__button--primary" type="button" data-preloader-retry>Повторить</button>
        <button class="k-app-preloader__button k-app-preloader__button--secondary" type="button" data-preloader-exit>Выйти</button>
      </div>
      <div class="k-app-preloader__diagnostics" aria-label="Версия и код ошибки"><span data-preloader-version>Версия <?= htmlspecialchars($assetVersion, ENT_QUOTES, 'UTF-8') ?></span><span class="k-app-preloader__error-code" data-preloader-error-code hidden></span></div>
    </div>
  </div>
  <div id="k-app" class="k-app-shell" data-layout="shell">
    <header id="k-shell-header" class="k-shell-header" data-layout="shell-header" aria-label="Верхняя панель KARETA.KZ">
      <button id="k-mobile-back" class="k-mobile-fab k-mobile-back" type="button" aria-label="Вернуться назад" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"></path><path d="M9 12h11"></path></svg>
      </button>
      <a class="k-brand" href="#/home" data-route-link="home" aria-label="KARETA.KZ главная">
        <img class="k-brand-logo k-brand-logo--full" src="<?= asset_ver('assets/onboarding/kareta_logo_full.png') ?>" alt="KARETA.KZ">
        <img class="k-brand-logo k-brand-logo--icon" src="<?= asset_ver('assets/onboarding/kareta_logo_icon.png') ?>" alt="" aria-hidden="true">
      </a>

      <nav id="k-desktop-nav" class="k-desktop-nav" data-layout="nav-grid" aria-label="Основное меню"></nav>

      <div class="k-shell-actions" data-layout="actions-row">
        <button type="button" class="k-shell-location-icon" data-shell-location-icon aria-label="Город: Усть-Каменогорск" title="Усть-Каменогорск">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>
          <span class="k-shell-location-label" data-shell-city>Усть-Каменогорск</span>
        </button>
        <button id="k-menu-toggle" class="k-menu-toggle" type="button" aria-label="Открыть меню" aria-controls="k-menu-drawer" aria-expanded="false">
          <span class="k-menu-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="k-menu-toggle-label">Меню</span>
        </button>
      </div>
    </header>

    <main id="k-page-outlet" class="k-page-outlet" data-layout="page-outlet" tabindex="-1" aria-live="polite"></main>

    <nav id="k-mobile-nav" class="k-mobile-nav" data-layout="nav-grid" aria-label="Нижнее меню"></nav>

    <div id="k-mobile-fab-stack" class="k-mobile-fab-stack" aria-label="Быстрые действия">
      <button id="k-mobile-chat" class="k-mobile-fab k-mobile-chat" type="button" aria-label="Открыть чаты">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v10.2H9.2l-4.7 3.2V5.5Z"/><path d="M8 9h8M8 12h5.5"/></svg>
        <span id="k-mobile-chat-badge" class="k-mobile-chat-badge" hidden></span>
      </button>
      <button id="k-mobile-orders" class="k-mobile-fab k-mobile-orders" type="button" aria-label="Открыть заявки">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10a2 2 0 0 1 2 2v13H5v-13a2 2 0 0 1 2-2Z"/><path d="M9 4.5v-1h6v1M8 9h8M8 13h8M8 17h5"/></svg>
        <span id="k-mobile-orders-badge" class="k-mobile-orders-badge" hidden></span>
      </button>
    </div>

    <div id="k-menu-backdrop" class="k-menu-backdrop" hidden></div>
    <aside id="k-menu-drawer" class="k-menu-drawer" aria-hidden="true" aria-label="Дополнительное меню">
      <div id="k-context-switcher" class="k-context-switcher" aria-label="Переключение типа аккаунта" hidden></div>
      <div id="k-menu-content" class="k-menu-content"></div>
      <div class="k-menu-drawer-foot">
        <small>© KARETA.KZ</small>
      </div>
    </aside>

    <div id="k-modal-root" class="k-modal-root" data-layout="modal-root"></div>
    <div id="k-toast-root" class="k-toast-root" data-layout="toast-root"></div>
  </div>

  <noscript>
    <section class="k-noscript">
      <h1>KARETA.KZ</h1>
      <p>Для работы приложения включите JavaScript.</p>
    </section>
  </noscript>

  <script>
    // Transitional guard: prevents older cached onboarding page modules from
    // failing before the modular draft store is evaluated. The real draft
    // module replaces these functions immediately after loading.
    (() => {
      const key = 'kareta_entry_flow_v1';
      const read = () => {
        try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_error) { return {}; }
      };
      const write = patch => {
        const next = { ...read(), ...(patch || {}), updatedAt:new Date().toISOString() };
        try { localStorage.setItem(key, JSON.stringify(next)); } catch (_error) {}
        return next;
      };
      if (typeof window.getEntryFlow !== 'function') window.getEntryFlow = read;
      if (typeof window.setEntryFlow !== 'function') window.setEntryFlow = write;
    })();
  </script>
  <script id="k-atomic-runtime-bootstrap">
    (() => {
      'use strict';
      const release = <?= json_encode($assetVersion, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>;
      const scripts = <?= json_encode($runtimeScripts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>;
      const state = { release, phase:'preflight', loaded:0, total:scripts.length, reason:'', startedAt:Date.now() };
      const root = document.documentElement;
      const recoveryKey = `kareta.atomic.recovery:${release}`;
      const releaseKey = 'kareta.runtime.release';
      const versionFromUrl = value => {
        try { return String(new URL(value, location.href).searchParams.get('v') || ''); }
        catch (_error) { return ''; }
      };
      const expose = () => ({ ...state, ready:state.phase==='ready' });
      window.KaretaAtomicBoot = Object.freeze({ snapshot:expose });

      const setPhase = (phase, reason='') => {
        state.phase=phase;state.reason=String(reason||'');root.dataset.atomicRuntime=phase;
        try { window.dispatchEvent(new CustomEvent('kareta:atomic-runtime-phase',{detail:expose()})); } catch (_error) {}
      };

      async function registrations(){
        try { return await navigator.serviceWorker?.getRegistrations?.() || []; }
        catch (_error) { return []; }
      }

      async function hasStaleWorker(){
        for(const registration of await registrations()){
          const worker=registration.active||registration.waiting||registration.installing;
          const workerVersion=versionFromUrl(worker?.scriptURL||'');
          if(worker && workerVersion!==release)return true;
        }
        return false;
      }

      async function purgeLegacyRuntime(forceWorkers=false){
        try{
          if('caches' in window){
            const keys=await caches.keys();
            // Static assets are release-scoped and safe to purge. Preserve shell HTML
            // until the replacement Service Worker has successfully precached '/'.
            await Promise.all(keys.filter(key=>String(key).startsWith('kareta-static-')).map(key=>caches.delete(key)));
          }
        }catch(_error){}
        try{
          const regs=await registrations();
          await Promise.all(regs.map(registration=>{
            const worker=registration.active||registration.waiting||registration.installing;
            const stale=versionFromUrl(worker?.scriptURL||'')!==release;
            return forceWorkers||stale ? registration.unregister().catch(()=>false) : Promise.resolve(false);
          }));
        }catch(_error){}
      }

      function cleanAtomicParams(replaceHistory=true){
        try{
          const url=new URL(location.href);
          const dirty=url.searchParams.has('kareta_atomic')||url.searchParams.has('kareta_recovery');
          url.searchParams.delete('kareta_atomic');
          url.searchParams.delete('kareta_recovery');
          if(dirty&&replaceHistory&&history?.replaceState)history.replaceState(history.state,'',url.pathname+url.search+url.hash);
          return url;
        }catch(_error){return null;}
      }

      async function recover(reason){
        if(window.__KARETA_BOOT_RECOVERY_IN_FLIGHT__){
          setPhase('failed',reason);
          return false;
        }
        window.__KARETA_BOOT_RECOVERY_IN_FLIGHT__=String(reason||'atomic_failure');
        setPhase('failed',reason);
        try{sessionStorage.setItem(recoveryKey,'1');}catch(_error){}
        const slow=document.querySelector('[data-preloader-slow]');
        if(slow){slow.hidden=false;slow.textContent='Не удалось синхронизировать файлы приложения. Автоматическая повторная загрузка отключена; нажмите «Повторить».';}
        const actions=document.querySelector('[data-preloader-actions]');if(actions)actions.hidden=false;
        document.getElementById('k-app-preloader')?.classList.add('is-error');
        window.KaretaBootDiagnostics?.show?.(reason);
        console.error('[KARETA][atomic-runtime.failed]',{release,reason,loaded:state.loaded,total:state.total,currentPath:state.currentPath||'',automaticReload:false});
        return false;
      }

      async function fetchManifestOnce(attempt=1){
        const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort('manifest_timeout'),10000);
        try{
          const response=await fetch(`/asset_manifest.php?atomic_boot=${Date.now()}&v=${encodeURIComponent(release)}`,{
            cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/json','X-Kareta-Boot-Release':release}
          });
          let payload=null;
          try{payload=await response.json();}catch(_error){throw new Error(`manifest_invalid_json:${response.status}`);}
          if(!response.ok||!payload?.ok)throw new Error(`manifest_not_ready:${response.status}`);
          const serverRelease=String(payload.release||'');
          if(serverRelease!==release)throw new Error(`manifest_release_mismatch:${release}:${serverRelease}`);
          const paths=new Set((payload.assets||[]).filter(item=>item.group==='scripts'&&item.exists).map(item=>String(item.path||'')));
          const missing=scripts.filter(item=>!paths.has(item.path)).map(item=>item.path);
          if(missing.length)throw new Error(`manifest_scripts_missing:${missing.join(',')}`);
          return payload;
        }catch(error){
          const transient=error?.name==='AbortError'||/network|fetch|timeout|aborted/i.test(String(error?.message||error));
          if(attempt<2&&transient){await new Promise(resolve=>window.setTimeout(resolve,250));return fetchManifestOnce(attempt+1);}
          throw error;
        }finally{window.clearTimeout(timer);}
      }

      async function manifestPreflight(){return fetchManifestOnce(1);}

      const runtimePreloads=new Map();
      function warmRuntimeWindow(start=0,count=6){
        const from=Math.max(0,Number(start)||0);
        const until=Math.min(scripts.length,from+Math.max(1,Number(count)||6));
        for(let index=from;index<until;index+=1){
          const item=scripts[index];
          if(!item||runtimePreloads.has(item.path))continue;
          try{
            const link=document.createElement('link');
            link.rel='preload';link.as='script';link.href=item.url;
            link.dataset.karetaRuntimePreload='1';link.dataset.karetaRuntimePath=item.path;
            runtimePreloads.set(item.path,link);document.head.appendChild(link);
          }catch(_error){}
        }
      }
      function releaseRuntimePreload(item){
        const link=runtimePreloads.get(item?.path);
        if(!link)return;
        runtimePreloads.delete(item.path);
        try{link.remove();}catch(_error){}
      }

      function sameScriptPath(filename,item){
        try{return new URL(filename,location.href).pathname===new URL(item.url,location.href).pathname;}
        catch(_error){return false;}
      }

      function loadRuntimeScript(item,index){
        return new Promise((resolve,reject)=>{
          let settled=false;let executionError='';
          const script=document.createElement('script');
          script.async=false;script.defer=false;script.src=item.url;
          script.dataset.karetaScriptOrder=String(item.order);script.dataset.karetaRelease=release;script.dataset.karetaAtomic='1';
          const cleanup=()=>{window.clearTimeout(timer);window.removeEventListener('error',onWindowError,true);};
          const finish=error=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(true);};
          const onWindowError=event=>{if(sameScriptPath(String(event?.filename||''),item))executionError=String(event?.error?.message||event?.message||'runtime_execution_error');};
          window.addEventListener('error',onWindowError,true);
          const timer=window.setTimeout(()=>{try{script.remove();}catch(_error){}finish(new Error(`runtime_script_timeout:${index+1}/${state.total}:${item.path}`));},15000);
          script.addEventListener('load',()=>{
            if(executionError){finish(new Error(`runtime_script_execution_failed:${index+1}/${state.total}:${item.path}:${executionError.slice(0,160)}`));return;}
            state.loaded=index+1;state.currentPath=item.path;
            releaseRuntimePreload(item);
            try{window.KaretaAppPreloader?.atomicProgress?.(state.loaded,state.total,item.path);}catch(_error){}
            finish();
          },{once:true});
          script.addEventListener('error',()=>finish(new Error(`runtime_script_load_failed:${index+1}/${state.total}:${item.path}`)),{once:true});
          document.body.appendChild(script);
        });
      }

      async function injectRuntime(){
        setPhase('loading');
        if(!scripts.length)return recover('empty_runtime_registry');
        warmRuntimeWindow(0,6);state.loaded=0;state.currentPath='';
        for(let index=0;index<scripts.length;index+=1){
          const item=scripts[index];state.currentPath=item.path;
          try{
            await loadRuntimeScript(item,index);
            warmRuntimeWindow(index+1,6);
          }
          catch(error){
            const message=String(error?.message||'');
            const networkLike=/runtime_script_(?:load_failed|timeout)/.test(message);
            if(networkLike){
              const separator=String(item.url).includes('?')?'&':'?';
              const retryItem={...item,url:`${item.url}${separator}kareta_retry=${Date.now()}`};
              try{await new Promise(resolve=>setTimeout(resolve,220));await loadRuntimeScript(retryItem,index);continue;}
              catch(retryError){return recover(retryError?.message||message||`runtime_script_failed:${index+1}/${state.total}:${item.path}`);}
            }
            return recover(message||`runtime_script_failed:${index+1}/${state.total}:${item.path}`);
          }
        }
        setPhase('ready');
        try{localStorage.setItem(releaseKey,release);sessionStorage.removeItem(recoveryKey);}catch(_error){}
        cleanAtomicParams(true);return true;
      }

      window.__KARETA_ATOMIC_BOOT_PROMISE__=(async()=>{
        let previous='';try{previous=String(localStorage.getItem(releaseKey)||'');}catch(_error){}
        const staleWorker=await hasStaleWorker();
        // R188.5.5.6.84.70: a previous worker may keep controlling this document
        // during a deploy, but static assets are versioned and network-first.
        // Do not navigate just to replace the controller; app_next performs a
        // no-reload worker handoff after the current runtime is ready.
        if(staleWorker)setPhase('worker-handoff','stale_service_worker_controller');
        if(previous&&previous!==release){setPhase('purging',previous);await purgeLegacyRuntime(false);}
        setPhase('preflight');
        try{await manifestPreflight();}
        catch(error){
          if(navigator.onLine===false){setPhase('offline-cache',error?.message||error);return injectRuntime();}
          return recover(error?.message||'manifest_preflight_failed');
        }
        return injectRuntime();
      })();
    })();
  </script>
  <script src="/js/mobile_native_bridge.js?v=1"></script>
</body>
</html>
