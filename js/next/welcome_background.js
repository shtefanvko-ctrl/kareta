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
