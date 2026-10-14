(() => {
  'use strict';

  const HOME = '#/home';
  const ONBOARDING = /^(#(?:\/)?(?:role|profile|entry|onboarding|welcome|benefits|transparency))/i;
  let syncFrame = 0;
  const routeTrail = [];
  const ROUTE_TITLES = Object.freeze({home:'Главная',services:'Услуги',parts:'Запчасти',masters:'Мастера и СТО',community:'Сообщество',chats:'Сообщения',messages:'Сообщения',cart:'Корзина',checkout:'Оформление заказа',market:'Маркет',account:'Аккаунт',diagnostics:'Диагностика ЭБУ',orders:'Заказы',cabinet:'Аккаунт',garage:'Гараж',works:'Работы мастеров',scanner:'Сканер',map:'Карта',seller:'Магазин',notifications:'Уведомления',assistant:'Помощник электрика'});

  function routeTitle(hash) {
    const route = String(hash || HOME).split('?')[0];
    if (/^#\/parts\/item(?:\/|$)/.test(route)) return 'Карточка товара';
    if (/^#\/parts\/store(?:\/|$)/.test(route)) return 'Магазин';
    if (/^#\/services\/item(?:\/|$)/.test(route)) return 'Услуга';
    if (/^#\/masters\/profile(?:\/|$)/.test(route)) return 'Профиль мастера или СТО';
    if (/^#\/orders\/new(?:\/|$)/.test(route)) return 'Новая заявка';
    if (/^#\/orders\/item(?:\/|$)/.test(route)) return 'Детали заказа';
    // Reuse the canonical registry for nested routes, without changing root labels.
    // Explicit detail titles above remain authoritative.
    if (route.slice(2).includes('/')) {
      const registry = window.KaretaRouteRegistry;
      const key = registry?.keyFromHash?.(route);
      const label = key && registry?.has?.(key) ? registry.get(key)?.label : '';
      if (label) return label;
    }
    const segment = route.replace(/^#\//, '').split('/')[0];
    const registry = window.KaretaRouteRegistry;
    return ROUTE_TITLES[segment] || (registry?.has?.(segment) ? registry.get(segment)?.label : '') || 'Раздел';
  }

  function ensurePageTitle(header) {
    if (!header) return null;
    let node = document.getElementById('k-shell-page-title');
    if (!node) {
      node = document.createElement('strong');
      node.id = 'k-shell-page-title';
      node.className = 'k-shell-page-title';
      const brand = header.querySelector(':scope > .k-brand');
      header.insertBefore(node, brand || header.firstChild);
    }
    return node;
  }
  const BACK_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"></path><path d="M9 12h11"></path></svg>';

  function fallbackFor(hashValue) {
    const hash = String(hashValue || location.hash || HOME).split('?')[0];
    if (hash === '#/diagnostics') return '#/services';
    if (/^#\/services\/(?:category|group)\//.test(hash)) return '#/services';
    if (/^#\/parts\/(?:store|used)\//.test(hash)) return '#/parts';
    if (/^#\/community\//.test(hash)) return '#/community';
    if (/^#\/(?:chats|messages)\//.test(hash)) return '#/chats';
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
    const cleanHash = String(hash).split('?')[0];
    if (!routeTrail.length) routeTrail.push(cleanHash);
    else if (routeTrail[routeTrail.length - 1] !== cleanHash) {
      if (routeTrail.length > 1 && routeTrail[routeTrail.length - 2] === cleanHash) routeTrail.pop();
      else routeTrail.push(cleanHash);
    }
    const header = document.getElementById('k-shell-header');
    if (header) {
      const mode = isOnboarding(hash) ? 'onboarding' : shouldShowBack(hash) ? 'inner' : 'home';
      header.dataset.karetaHeaderMode = mode;
      const title = ensurePageTitle(header);
      if (title) title.textContent = mode === 'inner' ? routeTitle(hash) : '';
      header.setAttribute('aria-label', mode === 'inner' ? 'Верхняя панель: ' + routeTitle(hash) : 'Верхняя панель KARETA.KZ');
    }

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
    // Browser history can contain an external page on a direct deep link.
    // Go back only when this SPA has observed a prior in-app route.
    if (routeTrail.length > 1 && history.length > 1) {
      if (window.KaretaNavigationState?.back) window.KaretaNavigationState.back(fallback);
      else history.back();
      return;
    }
    if (location.hash !== fallback) location.hash = fallback;
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

  window.KaretaMobileBack = Object.freeze({ sync, back, fallbackFor, routeTitle });
})();
