(() => {
  'use strict';

  const BASE = Object.freeze({
    cssMode: false,
    simulateTouch: true,
    allowTouchMove: true,
    grabCursor: true,
    threshold: 5,
    touchRatio: 1,
    resistance: true,
    resistanceRatio: 0.85,
    touchStartPreventDefault: false,
    touchMoveStopPropagation: false,
    passiveListeners: true,
    nested: true,
    preventClicks: true,
    preventClicksPropagation: true,
    watchOverflow: true,
    observer: true,
    observeParents: true,
    observeSlideChildren: true,
    updateOnWindowResize: true,
    resizeObserver: true
  });

  const instances = new WeakMap();
  const dragCleanup = new WeakMap();
  const resizeCleanup = new WeakMap();
  const diagnostics = new WeakMap();

  function options(extra = {}) {
    return Object.assign({}, BASE, extra);
  }

  function sliderNodes(root, selector) {
    const result = [];
    if (!root) return result;
    if (root.nodeType === 1 && root.matches?.(selector)) result.push(root);
    root.querySelectorAll?.(selector).forEach(node => result.push(node));
    return result;
  }

  function clearSwiperInlineState(slider) {
    if (!slider) return;
    slider.style.removeProperty('overflow');
    slider.style.removeProperty('touch-action');
    const wrapper = slider.querySelector(':scope > .swiper-wrapper, .swiper-wrapper');
    if (wrapper) {
      wrapper.style.removeProperty('transform');
      wrapper.style.removeProperty('transition-duration');
      wrapper.style.removeProperty('transition-delay');
      wrapper.style.removeProperty('height');
    }
    slider.querySelectorAll('.swiper-slide').forEach(slide => {
      slide.style.removeProperty('width');
      slide.style.removeProperty('margin-right');
      slide.style.removeProperty('margin-left');
      slide.style.removeProperty('transform');
    });
  }

  function bindResize(slider, instance) {
    resizeCleanup.get(slider)?.();
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!document.contains(slider) || instance.destroyed) return;
        try {
          instance.updateSize?.();
          instance.updateSlides?.();
          instance.updateProgress?.();
          instance.updateSlidesClasses?.();
          instance.update?.();
        } catch (_) {}
      });
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    ro?.observe(slider);
    window.addEventListener('orientationchange', update, { passive: true });
    resizeCleanup.set(slider, () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener('orientationchange', update);
      resizeCleanup.delete(slider);
    });
  }

  function destroy(slider, cleanStyles = true) {
    if (!slider) return;
    const instance = instances.get(slider) || slider.swiper;
    resizeCleanup.get(slider)?.();
    if (instance && !instance.destroyed) {
      try { instance.destroy(true, cleanStyles); } catch (_) {}
    }
    instances.delete(slider);
    slider.classList.remove('is-swiper-ready', 'is-ready');
    delete slider.dataset.sliderReady;
  }

  function activateFallback(slider, root = document) {
    if (!slider) return;
    destroy(slider, true);
    clearSwiperInlineState(slider);
    slider.classList.add('is-native-fallback');
    slider.classList.remove('is-swiper-ready', 'is-ready');
    slider.setAttribute('data-native-horizontal-slider', '1');
    slider.dataset.sliderReady = 'fallback';
    enableNativeDrag(root || slider.parentElement || slider);
  }

  function deactivateFallback(slider) {
    if (!slider) return;
    slider.classList.remove('is-native-fallback', 'is-pointer-down');
    slider.removeAttribute('data-native-horizontal-slider');
    if (slider.dataset.sliderReady === 'fallback') delete slider.dataset.sliderReady;
  }

  function enableNativeDrag(root = document) {
    const selector = '.is-native-fallback,.services-home-slider,[data-native-horizontal-slider]';

    sliderNodes(root, selector).forEach(slider => {
      if (dragCleanup.has(slider)) return;

      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let dragging = false;
      let moved = false;

      const finish = event => {
        if (pointerId !== null && event?.pointerId != null && event.pointerId !== pointerId) return;
        if (pointerId !== null) {
          try { slider.releasePointerCapture(pointerId); } catch (_) {}
        }
        dragging = false;
        pointerId = null;
        slider.classList.remove('is-pointer-down');
        if (moved) {
          slider.dataset.karetaDragMoved = '1';
          window.setTimeout(() => delete slider.dataset.karetaDragMoved, 120);
        }
      };

      const down = event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = slider.scrollLeft;
        dragging = true;
        moved = false;
        slider.classList.add('is-pointer-down');
        try { slider.setPointerCapture(pointerId); } catch (_) {}
      };

      const move = event => {
        if (!dragging || event.pointerId !== pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if (!moved && Math.abs(dy) > Math.abs(dx)) {
          finish(event);
          return;
        }
        moved = true;
        slider.scrollLeft = startLeft - dx;
        if (event.cancelable) event.preventDefault();
      };

      const click = event => {
        if (slider.dataset.karetaDragMoved === '1') {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      slider.addEventListener('pointerdown', down);
      slider.addEventListener('pointermove', move, { passive: false });
      slider.addEventListener('pointerup', finish);
      slider.addEventListener('pointercancel', finish);
      slider.addEventListener('lostpointercapture', finish);
      slider.addEventListener('click', click, true);
      slider.dataset.karetaDragReady = '1';

      dragCleanup.set(slider, () => {
        slider.removeEventListener('pointerdown', down);
        slider.removeEventListener('pointermove', move);
        slider.removeEventListener('pointerup', finish);
        slider.removeEventListener('pointercancel', finish);
        slider.removeEventListener('lostpointercapture', finish);
        slider.removeEventListener('click', click, true);
        slider.classList.remove('is-pointer-down');
        delete slider.dataset.karetaDragReady;
        dragCleanup.delete(slider);
      });
    });
  }

  function create(slider, config = {}, fallbackRoot = null) {
    if (!slider) return null;
    destroy(slider, true);
    deactivateFallback(slider);
    if (typeof window.Swiper !== 'function') {
      activateFallback(slider, fallbackRoot || slider.parentElement || slider);
      return null;
    }
    try {
      const instance = new window.Swiper(slider, options(config));
      instances.set(slider, instance);
      slider.classList.add('is-swiper-ready');
      slider.dataset.sliderReady = '1';
      bindResize(slider, instance);
      requestAnimationFrame(() => update(slider));
      return instance;
    } catch (_) {
      activateFallback(slider, fallbackRoot || slider.parentElement || slider);
      return null;
    }
  }

  function update(slider) {
    if (!slider) return false;
    const instance = instances.get(slider) || slider.swiper;
    if (!instance || instance.destroyed) return false;
    try {
      instance.updateSize?.();
      instance.updateSlides?.();
      instance.updateProgress?.();
      instance.updateSlidesClasses?.();
      instance.update?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadAndCreate(slider, config = {}, fallbackRoot = null) {
    if (!slider) return Promise.resolve(null);
    if (typeof window.Swiper === 'function') return Promise.resolve(create(slider, config, fallbackRoot));
    const loader = window.KaretaSwiperLoader?.load;
    if (typeof loader !== 'function') {
      activateFallback(slider, fallbackRoot || slider.parentElement || slider);
      return Promise.resolve(null);
    }
    return loader.call(window.KaretaSwiperLoader)
      .then(() => document.contains(slider) ? create(slider, config, fallbackRoot) : null)
      .catch(() => {
        if (document.contains(slider)) activateFallback(slider, fallbackRoot || slider.parentElement || slider);
        return null;
      });
  }


  function audit(root = document, { repair = true } = {}) {
    const selector = '.swiper,[data-native-horizontal-slider],.services-home-slider';
    const report = [];
    sliderNodes(root, selector).forEach(slider => {
      const wrapper = slider.querySelector(':scope > .swiper-wrapper, .swiper-wrapper');
      const slides = wrapper ? wrapper.querySelectorAll(':scope > .swiper-slide, .swiper-slide') : [];
      const instance = instances.get(slider) || slider.swiper;
      const fallback = slider.classList.contains('is-native-fallback') || slider.hasAttribute('data-native-horizontal-slider');
      const style = getComputedStyle(slider);
      const item = {
        slider,
        hasWrapper: !!wrapper,
        slideCount: slides.length,
        initialized: !!instance && !instance.destroyed,
        fallback,
        pointerEvents: style.pointerEvents,
        overflowX: style.overflowX
      };
      diagnostics.set(slider, item);
      report.push(item);
      if (!repair || !wrapper || !slides.length) return;
      if (style.pointerEvents === 'none') slider.style.setProperty('pointer-events', 'auto');
      if (fallback) enableNativeDrag(slider);
      else if (instance && !instance.destroyed) update(slider);
    });
    return report;
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        enableNativeDrag(node);
        sliderNodes(node, '.swiper.is-swiper-ready').forEach(update);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1) continue;
        sliderNodes(node, '.swiper,[data-native-horizontal-slider],.services-home-slider').forEach(slider => {
          resizeCleanup.get(slider)?.();
          dragCleanup.get(slider)?.();
          const instance = instances.get(slider) || slider.swiper;
          if (instance && !instance.destroyed) { try { instance.destroy(true, true); } catch (_) {} }
          instances.delete(slider);
        });
      }
    }
  });

  window.KaretaSliderRuntime = {
    options,
    create,
    loadAndCreate,
    update,
    destroy,
    enableNativeDrag,
    activateFallback,
    deactivateFallback,
    audit
  };

  const refreshVisible = () => { if (!document.hidden) audit(document, { repair: true }); };
  const boot = () => {
    enableNativeDrag(document);
    audit(document, { repair: true });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', refreshVisible, { passive: true });
    window.addEventListener('pageshow', refreshVisible, { passive: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
