(() => {
  const pending = new Map();
  let seq = 0;
  let geoMapModulePromise = null;

  function nativeAvailable() {
    return !!window.KaretaNative?.postMessage;
  }

  function nextId() {
    seq += 1;
    return "km_" + Date.now().toString(36) + "_" + seq.toString(36);
  }

  function call(command, payload = {}, timeoutMs = 8000) {
    if (!nativeAvailable()) {
      return Promise.reject(new Error("KARETA_NATIVE_UNAVAILABLE"));
    }
    const id = nextId();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error("KARETA_NATIVE_TIMEOUT"));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      window.KaretaNative.postMessage(JSON.stringify({ id, command, payload }));
    });
  }

  function onNativeMessage(event) {
    let data = event?.data;
    try {
      if (typeof data === "string") data = JSON.parse(data);
    } catch (_error) {
      return;
    }
    const id = String(data?.id || "");
    if (!id || !pending.has(id)) return;
    const item = pending.get(id);
    pending.delete(id);
    window.clearTimeout(item.timer);
    if (data?.ok) item.resolve(data.data || {});
    else {
      const code = String(data?.error || "KARETA_NATIVE_ERROR");
      const error = new Error(String(data?.message || code));
      error.code = code;
      item.reject(error);
    }
  }

  function attach() {
    if (!nativeAvailable()) return false;
    try { window.KaretaNative.onmessage = onNativeMessage; } catch (_error) {}
    document.documentElement.classList.add("kareta-native-app");
    window.dispatchEvent(new CustomEvent("kareta:mobile-ready"));
    return true;
  }

  function browserLocation(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error("GEOLOCATION_UNAVAILABLE");
        error.code = "GEOLOCATION_UNAVAILABLE";
        reject(error);
        return;
      }
      navigator.geolocation.getCurrentPosition(position => {
        const latitude=Number(position.coords?.latitude), longitude=Number(position.coords?.longitude);
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){
          const error=new Error("GEOLOCATION_INVALID"); error.code="GEOLOCATION_INVALID"; reject(error); return;
        }
        resolve({latitude,longitude,accuracy:Number(position.coords?.accuracy || 0),source:"browser"});
      }, error => {
        const wrapped = new Error(error?.message || "GEOLOCATION_FAILED");
        wrapped.code = Number(error?.code || 0) === 1 ? "GEOLOCATION_PERMISSION_DENIED" : "GEOLOCATION_FAILED";
        reject(wrapped);
      }, {
        enableHighAccuracy:options.enableHighAccuracy === true,
        timeout:Math.max(1000, Number(options.timeout || 8000)),
        maximumAge:Math.max(0, Number(options.maximumAge ?? 300000))
      });
    });
  }

  async function bestLocation(options = {}) {
    if (nativeAvailable()) {
      try { await call("requestPermission", { permission:"location" }, 12000); } catch (_error) {}
      try {
        const result = await call("getLocation", {}, 20000);
        const latitude = Number(result?.latitude ?? result?.lat);
        const longitude = Number(result?.longitude ?? result?.lng);
        if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180) {
          return { ...result, latitude, longitude, accuracy:Number(result?.accuracy || 0), source:"native" };
        }
      } catch (_error) {}
    }
    return browserLocation(options);
  }

  async function bestMap(query, lat, lng) {
    const latitude=Number(lat),longitude=Number(lng);
    if(nativeAvailable()){
      try { return await call("openMap", { query:String(query||''), lat:latitude, lng:longitude }, 15000); }
      catch(_error) {}
    }
    const hasCoords=Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180;
    const target=hasCoords
      ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=16/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`
      : `https://www.openstreetmap.org/search?query=${encodeURIComponent(String(query||''))}`;
    window.open(target,'_blank','noopener,noreferrer');
    return { opened:true, source:"browser", url:target };
  }

  function loadGeoMap() {
    if (window.KaretaGeoMap?.open) return Promise.resolve(window.KaretaGeoMap);
    if (geoMapModulePromise) return geoMapModulePromise;
    geoMapModulePromise = new Promise((resolve, reject) => {
      const release = String(window.KARETA_NEXT_ASSET_VERSION || 'next');
      const wantedPath = '/js/next/geo_map.js';
      const existing = Array.from(document.querySelectorAll('script[src]')).find(node => {
        try { return new URL(node.src, location.href).pathname === wantedPath; } catch (_error) { return false; }
      });
      const done = () => {
        if (window.KaretaGeoMap?.open) resolve(window.KaretaGeoMap);
        else reject(new Error('GEO_MAP_MODULE_INVALID'));
      };
      if (existing) {
        if (window.KaretaGeoMap?.open) { resolve(window.KaretaGeoMap); return; }
        existing.addEventListener('load', done, { once:true });
        existing.addEventListener('error', () => reject(new Error('GEO_MAP_MODULE_LOAD_FAILED')), { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = wantedPath + '?v=' + encodeURIComponent(release);
      script.async = true;
      script.dataset.karetaGeoMap = '1';
      script.dataset.karetaRelease = release;
      script.addEventListener('load', done, { once:true });
      script.addEventListener('error', () => {
        geoMapModulePromise = null;
        reject(new Error('GEO_MAP_MODULE_LOAD_FAILED'));
      }, { once:true });
      document.body.appendChild(script);
    }).catch(error => {
      geoMapModulePromise = null;
      throw error;
    });
    return geoMapModulePromise;
  }

  const api = {
    available: nativeAvailable,
    attach,
    call,
    ping: () => call("ping"),
    appInfo: () => call("appInfo"),
    deviceInfo: () => call("appInfo"),
    network: () => call("network"),
    pushToken: () => call("pushToken"),
    registerPush: () => call("registerPush"),
    unregisterPush: () => call("unregisterPush"),
    logout: () => call("logout", {}, 15000),
    requestPermission: permission => call("requestPermission", { permission }),
    pickImage: () => call("pickImage", {}, 60000),
    takePhoto: () => call("takePhoto", {}, 60000),
    pickContact: () => call("pickContact", {}, 60000),
    getLocation: () => call("getLocation", {}, 20000),
    bestLocation: options => bestLocation(options),
    scanCode: mode => call("scanCode", { mode: mode || "qr" }, 60000),
    scanQr: () => call("scanCode", { mode: "qr" }, 60000),
    scanVin: () => call("scanCode", { mode: "vin" }, 60000),
    actionSheet: (title, actions) => call("actionSheet", { title, actions }, 60000),
    elmStatus: () => call("elmStatus"),
    elmDevices: () => call("elmDevices"),
    elmConnect: address => call("elmConnect", { address }, 30000),
    elmReconnectLast: () => call("elmReconnectLast", {}, 30000),
    elmDisconnect: () => call("elmDisconnect"),
    elmInit: () => call("elmInit", {}, 30000),
    elmCommand: (command, timeoutMs) => call("elmCommand", { command, timeoutMs: timeoutMs || 2500 }, Math.max(5000, (timeoutMs || 2500) + 3000)),
    elmSnapshot: () => call("elmSnapshot", {}, 30000),
    elmLiveSnapshot: () => call("elmLiveSnapshot", {}, 10000),
    openBluetoothSettings: () => call("openBluetoothSettings"),
    offlineState: () => call("offlineState"),
    offlineEnqueue: payload => call("offlineEnqueue", { payload }),
    offlineDrain: () => call("offlineDrain"),
    offlineAcknowledge: items => call("offlineAcknowledge", { items: Array.isArray(items) ? items : [] }),
    offlineRestore: items => call("offlineRestore", { items }),
    offlineClear: () => call("offlineClear"),
    share: text => call("share", { text }),
    copy: text => call("copy", { text }),
    openPhone: phone => call("openPhone", { phone }),
    openMap: (query, lat, lng) => call("openMap", { query, lat, lng }),
    openBestMap: (query, lat, lng) => bestMap(query, lat, lng),
    loadGeoMap: () => loadGeoMap(),
    openExternal: url => call("openExternal", { url }),
    openSettings: () => call("openSettings"),
    vibrate: ms => call("vibrate", { ms }),
    haptic: ms => call("vibrate", { ms: ms || 40 }),
    reload: () => call("reload"),
    openRoute: path => call("openRoute", { path }),
  };

  window.KaretaMobile = Object.freeze(api);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }

  window.addEventListener("kareta:native", event => {
    const detail = event?.detail || {};
    if (detail.type === "ready") attach();
    window.dispatchEvent(new CustomEvent("kareta:mobile-event", {
      detail
    }));
  });
})();
