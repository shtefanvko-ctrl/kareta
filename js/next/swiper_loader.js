(() => {
  'use strict';

  const CSS_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
  const JS_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
  let started = false;

  function injectCss() {
    if (document.querySelector('link[data-kareta-swiper]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    link.dataset.karetaSwiper = '1';
    link.media = 'print';
    link.onload = () => { link.media = 'all'; };
    link.onerror = () => { link.remove(); };
    document.head.appendChild(link);
  }

  function load() {
    if (typeof window.Swiper === 'function') return Promise.resolve(window.Swiper);
    if (window.KaretaSwiperReady) return window.KaretaSwiperReady;

    window.KaretaSwiperReady = new Promise(resolve => {
      if (started) { resolve(null); return; }
      started = true;
      injectCss();
      const script = document.createElement('script');
      script.src = JS_URL;
      script.async = true;
      script.dataset.karetaSwiper = '1';
      const done = value => resolve(value || null);
      script.onload = () => done(typeof window.Swiper === 'function' ? window.Swiper : null);
      script.onerror = () => { script.remove(); done(null); };
      document.head.appendChild(script);
      window.setTimeout(() => done(typeof window.Swiper === 'function' ? window.Swiper : null), 7000);
    });
    return window.KaretaSwiperReady;
  }

  window.KaretaSwiperLoader = Object.freeze({ load });
  if ('requestIdleCallback' in window) requestIdleCallback(() => load(), { timeout:1500 });
  else window.setTimeout(load, 0);
})();
