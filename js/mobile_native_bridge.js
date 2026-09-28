(() => {
  const pending = new Map();
  let seq = 0;

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
    else item.reject(new Error(String(data?.error || "KARETA_NATIVE_ERROR")));
  }

  function attach() {
    if (!nativeAvailable()) return false;
    try { window.KaretaNative.onmessage = onNativeMessage; } catch (_error) {}
    document.documentElement.classList.add("kareta-native-app");
    window.dispatchEvent(new CustomEvent("kareta:mobile-ready"));
    return true;
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
    scanCode: mode => call("scanCode", { mode: mode || "qr" }, 60000),
    scanQr: () => call("scanCode", { mode: "qr" }, 60000),
    scanVin: () => call("scanCode", { mode: "vin" }, 60000),
    actionSheet: (title, actions) => call("actionSheet", { title, actions }, 60000),
    elmStatus: () => call("elmStatus"),
    elmDevices: () => call("elmDevices"),
    elmConnect: address => call("elmConnect", { address }, 20000),
    elmReconnectLast: () => call("elmReconnectLast", {}, 20000),
    elmDisconnect: () => call("elmDisconnect"),
    elmInit: () => call("elmInit", {}, 20000),
    elmCommand: (command, timeoutMs) => call("elmCommand", { command, timeoutMs: timeoutMs || 2500 }, Math.max(5000, (timeoutMs || 2500) + 3000)),
    elmSnapshot: () => call("elmSnapshot", {}, 30000),
    elmLiveSnapshot: () => call("elmLiveSnapshot", {}, 10000),
    openBluetoothSettings: () => call("openBluetoothSettings"),
    offlineState: () => call("offlineState"),
    offlineEnqueue: payload => call("offlineEnqueue", { payload }),
    offlineDrain: () => call("offlineDrain"),
    offlineRestore: items => call("offlineRestore", { items }),
    offlineClear: () => call("offlineClear"),
    share: text => call("share", { text }),
    copy: text => call("copy", { text }),
    openPhone: phone => call("openPhone", { phone }),
    openMap: (query, lat, lng) => call("openMap", { query, lat, lng }),
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
