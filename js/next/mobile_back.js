(() => {
  'use strict';

  const HOME = '#/home';
  const ONBOARDING = /^(#(?:\/)?(?:role|profile|entry|onboarding|welcome|benefits|transparency))/i;
  let syncFrame = 0;
  const BACK_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"></path><path d="M9 12h11"></path></svg>';

  function fallbackFor(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    if (/^#\/works\/item\//.test(hash)) return '#/works';
    if (/^#\/parts\/item\//.test(hash)) return '#/parts';
    if (/^#\/services\/item\//.test(hash)) return '#/services';
    if (/^#\/masters\/profile\//.test(hash)) return '#/masters';
    if (/^#\/orders\/item\//.test(hash) || hash === '#/orders/new') return '#/orders';
    if (/^#\/garage\/car\//.test(hash)) return '#/cabinet/garage';
    if (/^#\/cabinet\//.test(hash)) return '#/cabinet';
    return HOME;
  }

  function isOnboarding(hashValue) {
    return ONBOARDING.test(String(hashValue || location.hash || HOME));
  }

  function shouldShowBack(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    return hash !== HOME && !isOnboarding(hash);
  }

  function shouldShowChat(hashValue) {
    return !isOnboarding(hashValue);
  }

  function shouldShowOrders(hashValue) {
    return !isOnboarding(hashValue);
  }

  function isOrdersSurface(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    return /^#\/orders(?:$|[/?])/.test(hash) || hash === '#/workflow';
  }

  function isProtectedContentSurface(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    return /^#\/(?:parts(?:\/|$)|masters(?:\/|$)|cabinet\/garage(?:\/|$))/.test(hash);
  }

  function hideZeroBadge(id) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const value = Number(String(badge.textContent || '').trim());
    if (!Number.isFinite(value) || value <= 0) {
      badge.hidden = true;
      badge.textContent = '';
    }
  }


  function setChatBadge(count) {
    const badge = document.getElementById('k-mobile-chat-badge');
    if (!badge) return;
    const next = Math.max(0, Number(count) || 0);
    badge.hidden = next < 1;
    badge.textContent = next > 99 ? '99+' : String(next);
    const button = document.getElementById('k-mobile-chat');
    if (button) button.setAttribute('aria-label', next > 0 ? `Открыть чаты, непрочитанных: ${next}` : 'Открыть чаты');
  }

  function syncNow() {
    const backButton = document.getElementById('k-mobile-back');
    const chatButton = document.getElementById('k-mobile-chat');
    const ordersButton = document.getElementById('k-mobile-orders');
    const stack = document.getElementById('k-mobile-fab-stack');
    const hash = location.hash || HOME;
    const protectContent = isProtectedContentSurface(hash);

    if (backButton) {
      backButton.hidden = !shouldShowBack(hash);
      backButton.dataset.fallback = fallbackFor(hash);
    }
    if (chatButton) {
      chatButton.hidden = protectContent || !shouldShowChat(hash);
      chatButton.setAttribute('aria-current', /^#\/chats(?:$|[/?])/.test(hash) ? 'page' : 'false');
    }
    if (ordersButton) {
      ordersButton.hidden = protectContent || !shouldShowOrders(hash);
      ordersButton.setAttribute('aria-current', isOrdersSurface(hash) ? 'page' : 'false');
    }
    hideZeroBadge('k-mobile-chat-badge');
    hideZeroBadge('k-mobile-orders-badge');
    if (stack) stack.hidden = isOnboarding(hash) || protectContent;
  }

  function sync() {
    if (syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      syncNow();
    });
  }

  function back() {
    const button = document.getElementById('k-mobile-back');
    const fallback = button?.dataset.fallback || HOME;
    if (window.KaretaNavigationState?.back) {
      window.KaretaNavigationState.back(fallback);
      return;
    }
    if (history.length > 1) history.back();
    else location.hash = fallback;
  }

  function openOrders() {
    const button=document.getElementById('k-mobile-orders');
    const target=button?.dataset.actionRoute || window.KaretaNavigationCore?.primaryAction?.().key || 'orders';
    if (window.KaretaRouteRuntime?.navigate) {
      window.KaretaRouteRuntime.navigate(target, { source:'mobile-primary-action' });
      return;
    }
    location.hash = window.KaretaRouteRegistry?.get?.(target)?.path || '#/orders';
  }

  function openChats() {
    if (window.KaretaRouteRuntime?.navigate) {
      window.KaretaRouteRuntime.navigate('chats', { source:'mobile-chat-fab' });
      return;
    }
    location.hash = '#/chats';
  }

  function ensureHeaderPlacement() {
    const backButton = document.getElementById('k-mobile-back');
    const header = document.getElementById('k-shell-header');
    if (!backButton || !header) return backButton;
    if (backButton.parentElement !== header) {
      const brand = header.querySelector(':scope > .k-brand');
      header.insertBefore(backButton, brand || header.firstChild);
    }
    if (backButton.dataset.iconVersion !== '84.75') {
      backButton.innerHTML = BACK_ICON_SVG;
      backButton.dataset.iconVersion = '84.75';
    }
    return backButton;
  }

  function boot() {
    const backButton = ensureHeaderPlacement();
    const chatButton = document.getElementById('k-mobile-chat');
    const ordersButton = document.getElementById('k-mobile-orders');

    if (backButton && backButton.dataset.bound !== '1') {
      backButton.dataset.bound = '1';
      backButton.addEventListener('click', back);
    }
    if (chatButton && chatButton.dataset.bound !== '1') {
      chatButton.dataset.bound = '1';
      chatButton.addEventListener('click', openChats);
    }
    if (ordersButton && ordersButton.dataset.bound !== '1') {
      ordersButton.dataset.bound = '1';
      ordersButton.addEventListener('click', openOrders);
    }

    if (document.documentElement.dataset.mobileFabBound !== '1') {
      document.documentElement.dataset.mobileFabBound = '1';
      window.addEventListener('hashchange', sync);
      window.addEventListener('popstate', sync);
      window.addEventListener('pageshow', sync);
      window.addEventListener('kareta:routechange', sync);
      window.addEventListener('kareta:chat-unread', event => setChatBadge(event.detail?.count));
      window.addEventListener('kareta:primary-action-changed', sync);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    }
    setChatBadge(window.KaretaShellNav?.getState?.().unreadChats || 0);
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.KaretaMobileBack = Object.freeze({ sync, fallbackFor });
})();
