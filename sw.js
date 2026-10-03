/* KARETA.KZ Service Worker — boot sequencing r84 */
const RELEASE = '188.5.5.6.84.157'; // canonical UI recovery
// Historical release markers for regression tests only; RELEASE above is the only cache key.
// 20260806-r188555-runtime-dependency-bootstrap-r188556-security-hardening-r1885561-atomic-runtime-bootstrap-r1885562-identity-db-recovery-r1885563-migration98-onboarding-recovery-r1885564-fk-detach-schema-recovery-r1885565-serialized-schema-index-recovery-r1885566-test-otp-transport-recovery-r1885567-otp-length-resend-cooldown-r1885568-mobile-two-column-grids-r1885569-smart-action-account-r1885570-account-type-catalog-requests-r1885571-test-auto-approval-service-catalog-recovery-r1885572-private-db-config-recovery-r1885573-temporary-account-type-auto-activation-r1885574-home-service-category-grid-r1885575-profile-legacy-id-mobile-nav-recovery-r1885576-master-work-surfaces-r1885577-master-business-runtime-r1885578-master-order-full-lifecycle-r1885579-master-aftercare-finance-inventory-r1885580-operational-finance-payroll-receivables-r1885581-client-exchange-production-scale-r1885582-master-mobile-nav-six-surfaces-r1885583-production-dispatch-master-exchange-r1885584-pc-header-session-resume-stability-r1885585-route-session-position-preservation-r1885586-master-surface-header-removal-r1885587-master-mobile-orders-dedup-r1885588-tab-resume-route-authority-r1885589-session-resume-hardening-r1885590-full-page-session-state-r1885591-master-profile-exchange-kpi-r1885592-mobile-workflow-tile-grid-r1885593-exchange-client-search-r1885594-exchange-mobile-card-simplification-r1885595-exchange-card-visual-states-r1885596-png-brand-welcome-restoration-r1885597-desktop-full-width-pages-r1885598-community-group-slide-150-r1885599-community-feed-desktop-grid-r1885600-desktop-card-grid-expansion-r1885601-master-exchange-failsoft-recovery-r1885602-contextual-desktop-navigation-r1885603-role-desktop-menu-completion-r1885604-client-home-native-shell-freeze-r1885605-vehicle-native-passport-r1885606-client-orders-native-r1885607-identity-api-client-garage-recovery-r1885608-client-home-restore-account-native-r1885609-community-native-ui-r1885610-public-master-native-profile-r1885611-master-owner-native-profile-r1885612-master-verified-work-portfolio-r1885613-master-reviews-social-contract-r1885614-master-social-wall-r1885615-master-workplace-native-r1885616-master-service-pricing-native-r1885617-shell-burger-recovery-r1885618-parts-native-marketplace-r1885619-parts-window-lists-product-detail-r1885620-used-market-listing-wizard-r1885621-used-market-owner-management-r1885622-seller-native-workplace-r1885623-seller-profile-storefront-native-r1885624-master-requests-workplace-services-r1885625-master-exchange-acceptance-flow-r1885626-master-order-communication-scheduling-r1885627-master-capacity-reschedule-r1885628-account-tariffs-master-capacity-r1885629-master-shift-breaks-arrival-r18856291-tariff-admin-kareta-pro-r1885630-master-day-operations-auto-recovery-r1885631-master-ui-exchange-schedule-flattening-r1885632-master-auto-recovery-control-center-r1885633-sto-recovery-native-operations-r18856331-master-exchange-runtime-recovery-r1885634-sto-schedule-capacity-command-center-r1885635-sto-native-surface-audit-r1885636-ux-restructure-window-engine-r1885637-work-order-native-lifecycle-r1885638-client-request-garage-window-flow-r1885639-client-account-window-flow-r1885640-social-communication-window-flow-r1885641-master-workspace-window-architecture-r1885642-sto-workspace-window-architecture-r1885643-seller-marketplace-window-architecture-r1885644-global-ux-cleanup-legacy-removal
const CACHE_PREFIX = 'kareta-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${RELEASE}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${RELEASE}`;
const SHELL_URLS = ['/', '/index.php', '/manifest.json'];
const MANIFEST_URL = `/asset_manifest.php?v=${encodeURIComponent(RELEASE)}`;

const canonicalStaticRequest = request => {
  const url = new URL(request.url);
  return new Request(`${url.origin}${url.pathname}`, {
    method: 'GET',
    credentials: 'same-origin',
    mode: 'same-origin',
  });
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    let shellReady = false;
    for (const url of SHELL_URLS) {
      try {
        const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
        if (response && response.ok) {
          await cache.put(url, response.clone());
          if (url === '/' || url === '/index.php') shellReady = true;
        }
      } catch (_error) {}
    }
    // Never replace a working controller with a release that cannot render the shell.
    if (!shellReady) throw new Error('kareta_shell_precache_failed');
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== STATIC_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(client => client.postMessage({type:'KARETA_SW_ACTIVATED',release:RELEASE}));
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'KARETA_SKIP_WAITING') self.skipWaiting();
  if (data.type === 'KARETA_CLEAR_CACHES') {
    // Keep the last known-good HTML shell unless an explicit destructive reset is requested.
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
      .filter(key => data.includeShell === true || !String(key).startsWith('kareta-shell-'))
      .map(key => caches.delete(key)))));
  }
});

function offlinePage() {
  return new Response('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KARETA.KZ</title></head><body><main><h1>Нет соединения</h1><p>Проверьте интернет и повторите загрузку.</p><a href="/">Повторить</a></main></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-store', credentials: 'same-origin' });
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('/index.php', response.clone());
      await cache.put('/', response.clone());
    }
    return response;
  } catch (_error) {
    return (await caches.match('/index.php')) || (await caches.match('/')) || offlinePage();
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request, { cache: 'no-store', credentials: 'same-origin' });
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirstVersioned(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request, { cache: 'no-store', credentials: 'same-origin' });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_error) {
    return Response.error();
  }
}

function expectedStaticType(pathname) {
  if (/\.css$/i.test(pathname)) return 'text/css';
  if (/\.js$/i.test(pathname)) return 'javascript';
  if (/\.(?:png|jpe?g|webp|svg|gif|ico)$/i.test(pathname)) return 'image/';
  if (/\.(?:woff2?|ttf)$/i.test(pathname)) return 'font/';
  return '';
}

function validMime(response, pathname) {
  if (!response || !response.ok) return false;
  const expected = expectedStaticType(pathname);
  if (!expected) return true;
  const actual = (response.headers.get('Content-Type') || '').toLowerCase();
  if (expected === 'javascript') return actual.includes('javascript') || actual.includes('ecmascript');
  return actual.includes(expected);
}

async function cacheFirstReleaseStatic(request) {
  const url = new URL(request.url);
  const cache = await caches.open(STATIC_CACHE);
  const canonical = canonicalStaticRequest(request);
  const cached = await cache.match(canonical);
  if (cached && validMime(cached, url.pathname)) return cached;
  try {
    const response = await fetch(request, { cache: 'no-store', credentials: 'same-origin' });
    if (validMime(response, url.pathname)) {
      await cache.put(canonical, response.clone());
      return response;
    }
    // Never cache 404, HTML returned for CSS/JS, or a response with the wrong MIME.
    return response;
  } catch (_error) {
    return cached && validMime(cached, url.pathname) ? cached : Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    // API-запросы не перехватываем: браузер получает реальный статус сервера,
    // а Service Worker не создаёт искусственные 503 при кратком обрыве сети.
    return;
  }
  if (url.pathname === '/asset_manifest.php') {
    if (url.searchParams.has('route_loader')) {
      event.respondWith(cacheFirstVersioned(request, STATIC_CACHE));
    } else {
      event.respondWith(fetch(request, { cache: 'no-store', credentials: 'same-origin' }));
    }
    return;
  }
  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
  if (/\.(?:js|css|png|jpe?g|webp|svg|gif|ico|woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(cacheFirstReleaseStatic(request));
    return;
  }
  event.respondWith(networkFirst(request, STATIC_CACHE));
});
