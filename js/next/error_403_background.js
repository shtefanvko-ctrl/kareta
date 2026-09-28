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
