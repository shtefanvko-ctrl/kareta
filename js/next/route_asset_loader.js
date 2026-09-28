(() => {
  'use strict';

  const scriptSource=document.currentScript?.src||'';
  const dependencies=['KaretaRouteRegistry'];
  if(window.KaretaRuntimeDependencies?.missing?.(dependencies).length){
    window.KaretaRuntimeDependencies.deferScript('route_asset_loader',dependencies,scriptSource);
    return;
  }
  if(window.__KARETA_ROUTE_ASSET_LOADER_MODULE__){window.__KARETA_ROUTE_ASSET_LOADER_MODULE__.duplicateLoads+=1;return;}
  window.__KARETA_ROUTE_ASSET_LOADER_MODULE__={duplicateLoads:0};

  const release=String(window.KARETA_NEXT_ASSET_VERSION||'next');
  const manifestUrl=String(window.KARETA_ASSET_MANIFEST_URL||`/asset_manifest.php?v=${encodeURIComponent(release)}`);
  const routeManifestUrl=(()=>{
    try{
      const url=new URL(manifestUrl,location.href);
      url.searchParams.set('v',release);
      url.searchParams.set('route_loader','1');
      return `${url.pathname}${url.search}`;
    }catch(_error){return `/asset_manifest.php?v=${encodeURIComponent(release)}&route_loader=1`;}
  })();
  // Compatibility bridge for the frozen index watchdog. Atomic loading already owns
  // script-failure recovery; expose audit as soon as route infrastructure is alive so
  // a slow sequential boot is not mistaken for a missing runtime after 12 seconds.
  if(!window.KaretaNext?.audit){
    window.KaretaNext=Object.assign(window.KaretaNext||{}, {audit:()=>({ok:false,bootPending:true,release,source:'route_asset_loader'})});
  }
  const KNOWN_LAZY_ROUTE_KEYS=new Set([
    'community',
    'parts','usedParts','productDetail',
    'masters','providerDetail','providerBooking','serviceDetail',
    'stoDashboard',
    'seller','sellerProducts','sellerOrders',
    'identityMigration','adminUsers','adminOrganizations','adminMonitoring','adminManagement',
    'services','serviceManagement','profile','following','requestNew','workOrder',
    'cabinet','cabinetGarage','cabinetData','cabinetHistory','cabinetDocuments','cabinetPromos','cabinetTariff','cabinetSettings',
    'chats','notifications','works','masterExchange','realWorks','workDetail','vehicle','orders','workflow',
    'news','masterNews','masterNewsCreate','masterNewsEdit',
    'about','rules','help','privacy','contacts','lawyer','towTruck',
    'masterOnboarding','masterDashboard','masterSchedule','masterWorkplaceSettings','masterProfileOwner','masterWallOwner','masterWorks','masterReviews','providerReviews',
    'platform','corePlatform','calendarBooking','finance','market','crm','assistant','diagnostics',
  ]);

  const state={
    manifest:null,
    manifestPromise:null,
    loadedBundles:new Set(),
    bundlePromises:new Map(),
    failedBundles:new Map(),
    loadedScripts:new Set(),
    loadedStyles:new Set(),
    routeLoads:0,
    assetLoads:0,
  };

  const normalizePath=value=>{
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      const url=/^[a-z][a-z0-9+.-]*:/i.test(raw)
        ? new URL(raw)
        : new URL('/'+raw.replace(/^\/+/,''),location.origin);
      return url.pathname.replace(/^\/+/, '');
    }catch(_error){return raw.replace(/^\/+/, '').split('?')[0];}
  };
  const assetKey=(group,path)=>`${group}:${normalizePath(path)}`;
  const clampProgress=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  function emitRouteLoad(type,detail={}){
    const payload={release,at:Date.now(),...detail,percent:clampProgress(detail.percent)};
    try{window.dispatchEvent(new CustomEvent(`kareta:route-load-${type}`,{detail:payload}));}catch(_error){}
    return payload;
  }
  function reportRouteProgress(options,detail={}){
    const payload=emitRouteLoad('progress',detail);
    try{if(typeof options?.onProgress==='function')options.onProgress(payload);}catch(_error){}
    return payload;
  }

  function currentAssetPaths(){
    document.querySelectorAll('script[src]').forEach(node=>state.loadedScripts.add(normalizePath(node.src)));
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(node=>state.loadedStyles.add(normalizePath(node.href)));
  }
  currentAssetPaths();

  function isKnownLazy(routeKey){return KNOWN_LAZY_ROUTE_KEYS.has(String(routeKey||''));}

  async function manifest(){
    if(state.manifest)return state.manifest;
    if(state.manifestPromise)return state.manifestPromise;
    state.manifestPromise=(async()=>{
      const response=await fetch(routeManifestUrl,{
        cache:'default',credentials:'same-origin',headers:{Accept:'application/json','X-Kareta-Route-Loader':release}
      });
      let payload=null;
      try{payload=await response.json();}catch(_error){throw new Error(`route_manifest_invalid_json:${response.status}`);}
      if(!payload||typeof payload!=='object'||!Array.isArray(payload.assets)||!payload.routeBundles)throw new Error(`route_manifest_not_ready:${response.status}`);
      // Route loading is scoped to the requested bundle. A degraded global manifest
      // (for example, one unrelated missing image) must not disable otherwise valid routes.
      // assetUrl() still fails closed if an asset required by this route is absent.
      if(String(payload.release||'')!==release)throw new Error(`route_manifest_release_mismatch:${payload.release||''}`);
      state.manifest=payload;
      return payload;
    })().finally(()=>{state.manifestPromise=null;});
    return state.manifestPromise;
  }

  function routeBundles(payload,routeKey){
    const out=[];
    const plan=payload?.routeBundles||{};
    for(const [name,bundle] of Object.entries(plan)){
      if(name.startsWith('_')||!bundle||bundle.lazy!==true)continue;
      const keys=Array.isArray(bundle.routeKeys)?bundle.routeKeys:[];
      if(keys.includes(routeKey))out.push([name,bundle]);
    }
    return out;
  }

  function assetUrl(payload,group,path){
    const wanted=normalizePath(path);
    const match=(payload?.assets||[]).find(item=>item?.group===group&&normalizePath(item?.path||item?.url||'')===wanted);
    if(match?.exists===false)throw new Error(`route_asset_missing:${wanted}`);
    if(match?.url){
      const raw=String(match.url);
      if(/^[a-z][a-z0-9+.-]*:/i.test(raw))return raw;
      return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
    }
    return `/${wanted}?v=${encodeURIComponent(release)}`;
  }

  function loadStyle(payload,path,bundleName){
    const normalized=normalizePath(path);
    if(state.loadedStyles.has(normalized))return Promise.resolve(true);
    let existing=Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).find(node=>normalizePath(node.href)===normalized);
    if(existing?.dataset?.karetaRouteAsset==='1'&&existing.dataset.karetaRouteState!=='loaded'){
      try{existing.remove();}catch(_error){}existing=null;
    }
    if(existing){state.loadedStyles.add(normalized);return Promise.resolve(true);}
    return new Promise((resolve,reject)=>{
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=assetUrl(payload,'styles',normalized);
      link.dataset.karetaRouteBundle=bundleName;link.dataset.karetaRelease=release;link.dataset.karetaRouteAsset='1';link.dataset.karetaRouteState='loading';
      const fail=message=>{link.dataset.karetaRouteState='failed';try{link.remove();}catch(_error){}reject(new Error(message));};
      const timer=window.setTimeout(()=>fail(`route_style_timeout:${normalized}`),12000);
      link.addEventListener('load',()=>{window.clearTimeout(timer);link.dataset.karetaRouteState='loaded';state.loadedStyles.add(normalized);state.assetLoads+=1;resolve(true);},{once:true});
      link.addEventListener('error',()=>{window.clearTimeout(timer);fail(`route_style_load_failed:${normalized}`);},{once:true});
      document.head.appendChild(link);
    });
  }

  function loadScript(payload,path,bundleName){
    const normalized=normalizePath(path);
    if(state.loadedScripts.has(normalized))return Promise.resolve(true);
    let existing=Array.from(document.querySelectorAll('script[src]')).find(node=>normalizePath(node.src)===normalized);
    if(existing?.dataset?.karetaRouteAsset==='1'&&existing.dataset.karetaRouteState!=='loaded'){
      try{existing.remove();}catch(_error){}existing=null;
    }
    if(existing){state.loadedScripts.add(normalized);return Promise.resolve(true);}
    return new Promise((resolve,reject)=>{
      let executionError='';
      const script=document.createElement('script');
      script.async=false;script.defer=false;script.src=assetUrl(payload,'scripts',normalized);
      script.dataset.karetaRouteBundle=bundleName;script.dataset.karetaRelease=release;script.dataset.karetaRouteAsset='1';script.dataset.karetaRouteState='loading';
      const sameFile=filename=>normalizePath(filename)===normalized;
      const onWindowError=event=>{if(sameFile(event?.filename||''))executionError=String(event?.error?.message||event?.message||'runtime_execution_error');};
      window.addEventListener('error',onWindowError,true);
      const cleanup=()=>{window.clearTimeout(timer);window.removeEventListener('error',onWindowError,true);};
      const fail=message=>{script.dataset.karetaRouteState='failed';try{script.remove();}catch(_error){}reject(new Error(message));};
      const timer=window.setTimeout(()=>{cleanup();fail(`route_script_timeout:${normalized}`);},15000);
      script.addEventListener('load',()=>{
        cleanup();
        if(executionError){fail(`route_script_execution_failed:${normalized}:${executionError.slice(0,180)}`);return;}
        script.dataset.karetaRouteState='loaded';state.loadedScripts.add(normalized);state.assetLoads+=1;resolve(true);
      },{once:true});
      script.addEventListener('error',()=>{cleanup();fail(`route_script_load_failed:${normalized}`);},{once:true});
      document.body.appendChild(script);
    });
  }

  function validateGlobals(bundleName,bundle){
    const missing=(Array.isArray(bundle.globals)?bundle.globals:[]).filter(name=>!window[name]);
    if(missing.length)throw new Error(`route_bundle_globals_missing:${bundleName}:${missing.join(',')}`);
    return true;
  }

  function promoteCascadeStyles(bundle){
    if(String(bundle?.cascade||'')!=='last')return;
    for(const style of Array.isArray(bundle.styles)?bundle.styles:[]){
      const normalized=normalizePath(style);
      const node=Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).find(link=>normalizePath(link.href)===normalized);
      if(node?.parentNode)node.parentNode.appendChild(node);
    }
  }

  async function loadBundle(payload,bundleName,bundle,signal,onAssetLoaded){
    if(state.loadedBundles.has(bundleName)){promoteCascadeStyles(bundle);validateGlobals(bundleName,bundle);return true;}
    if(state.bundlePromises.has(bundleName))return state.bundlePromises.get(bundleName);
    const promise=(async()=>{
      if(signal?.aborted)throw new DOMException('Route asset load aborted','AbortError');
      for(const style of Array.isArray(bundle.styles)?bundle.styles:[]){
        if(signal?.aborted)throw new DOMException('Route asset load aborted','AbortError');
        await loadStyle(payload,style,bundleName);
        try{onAssetLoaded?.({bundle:bundleName,type:'style',path:normalizePath(style)});}catch(_error){}
      }
      for(const script of Array.isArray(bundle.scripts)?bundle.scripts:[]){
        if(signal?.aborted)throw new DOMException('Route asset load aborted','AbortError');
        await loadScript(payload,script,bundleName);
        try{onAssetLoaded?.({bundle:bundleName,type:'script',path:normalizePath(script)});}catch(_error){}
      }
      validateGlobals(bundleName,bundle);
      promoteCascadeStyles(bundle);
      state.loadedBundles.add(bundleName);state.failedBundles.delete(bundleName);
      try{window.dispatchEvent(new CustomEvent('kareta:route-bundle-loaded',{detail:{bundle:bundleName,release}}));}catch(_error){}
      return true;
    })().catch(error=>{
      state.failedBundles.set(bundleName,String(error?.message||error));
      throw error;
    }).finally(()=>state.bundlePromises.delete(bundleName));
    state.bundlePromises.set(bundleName,promise);
    return promise;
  }

  async function ensureRoute(routeKey,options={}){
    const key=String(routeKey||'');
    if(!isKnownLazy(key))return {ok:true,lazy:false,bundles:[]};
    let lastPercent=4;
    emitRouteLoad('start',{route:key,phase:'start',percent:lastPercent});
    reportRouteProgress(options,{route:key,phase:'start',percent:lastPercent,loaded:0,total:0});
    try{
      const payload=await manifest();
      lastPercent=16;
      reportRouteProgress(options,{route:key,phase:'manifest',percent:lastPercent,loaded:0,total:0});
      const bundles=routeBundles(payload,key);
      if(!bundles.length)throw new Error(`route_bundle_not_declared:${key}`);
      state.routeLoads+=1;
      const pendingBundles=bundles.filter(([name])=>!state.loadedBundles.has(name));
      const total=pendingBundles.reduce((sum,[,bundle])=>sum+
        (Array.isArray(bundle.styles)?bundle.styles.length:0)+
        (Array.isArray(bundle.scripts)?bundle.scripts.length:0),0);
      let completed=0;
      const loaded=[];
      const onAssetLoaded=meta=>{
        completed+=1;
        lastPercent=total>0?Math.min(94,18+Math.round((completed/total)*76)):94;
        reportRouteProgress(options,{route:key,phase:'assets',percent:lastPercent,loaded:completed,total,...meta});
      };
      for(const [name,bundle] of bundles){
        await loadBundle(payload,name,bundle,options.signal,onAssetLoaded);
        loaded.push(name);
        if(total===0){
          lastPercent=Math.min(94,lastPercent+Math.max(1,Math.floor(76/bundles.length)));
          reportRouteProgress(options,{route:key,phase:'bundle',percent:lastPercent,loaded:loaded.length,total:bundles.length,bundle:name});
        }
      }
      lastPercent=100;
      reportRouteProgress(options,{route:key,phase:'ready',percent:lastPercent,loaded:total||loaded.length,total:total||bundles.length});
      emitRouteLoad('end',{route:key,phase:'ready',percent:100,bundles:loaded});
      return {ok:true,lazy:true,bundles:loaded};
    }catch(error){
      const aborted=options.signal?.aborted||error?.name==='AbortError';
      emitRouteLoad(aborted?'cancel':'error',{route:key,phase:aborted?'cancelled':'error',percent:lastPercent,error:String(error?.message||error)});
      throw error;
    }
  }

  function isRouteReady(routeKey){
    const key=String(routeKey||'');
    if(!isKnownLazy(key))return true;
    if(!state.manifest)return false;
    const bundles=routeBundles(state.manifest,key);
    if(!bundles.length)return false;
    return bundles.every(([name,bundle])=>{
      if(!state.loadedBundles.has(name))return false;
      const missing=(Array.isArray(bundle.globals)?bundle.globals:[]).filter(globalName=>!window[globalName]);
      return missing.length===0;
    });
  }

  function prefetchRoute(routeKey,options={}){
    const key=String(routeKey||'');
    if(!isKnownLazy(key)||isRouteReady(key))return Promise.resolve({ok:true,lazy:isKnownLazy(key),prefetched:false,bundles:[]});
    return ensureRoute(key,options).then(result=>({...result,prefetched:true}));
  }

  function audit(){
    const result={
      ok:state.failedBundles.size===0,
      release,
      manifestLoaded:!!state.manifest,
      knownLazyRoutes:Array.from(KNOWN_LAZY_ROUTE_KEYS),
      loadedBundles:Array.from(state.loadedBundles),
      pendingBundles:Array.from(state.bundlePromises.keys()),
      failedBundles:Object.fromEntries(state.failedBundles),
      loadedRouteScripts:Array.from(state.loadedScripts).filter(path=>document.querySelector(`script[data-kareta-route-asset="1"][src*="${path.split('/').pop()}"]`)),
      routeLoads:state.routeLoads,
      assetLoads:state.assetLoads,
      at:Date.now(),
    };
    window.KaretaRouteAssetAudit=result;
    return result;
  }

  window.KaretaRouteAssetLoader=Object.freeze({ensureRoute,prefetchRoute,isRouteReady,isKnownLazy,audit,manifest:()=>manifest()});
})();
