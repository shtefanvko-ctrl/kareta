(() => {
  'use strict';

  const ENDPOINT = '/api/obd_jobs.php';
  const POLL_MS = 15000;
  const REGISTER_TTL_MS = 300000;
  let timer = 0;
  let busy = false;
  let device = null;
  let registeredAt = 0;

  const mobile = () => window.KaretaMobile;
  const emit = detail => {
    try {
      window.dispatchEvent(new CustomEvent('kareta:obd-remote-job', { detail }));
    } catch (_error) {}
  };

  function makeError(code, message) {
    const error = new Error(message || code);
    error.code = code;
    return error;
  }

  async function request(action, options = {}) {
    const method = options.method || 'POST';
    const query = new URLSearchParams({ action: String(action || '') });
    Object.entries(options.query || {}).forEach(([key, value]) => query.set(key, String(value)));
    const response = await fetch(ENDPOINT + '?' + query.toString(), {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(options.body || {}) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw makeError(String(payload?.code || ('HTTP_' + response.status)), String(payload?.message || payload?.code || ('HTTP ' + response.status)));
    }
    return payload;
  }

  async function ensureDevice() {
    const api = mobile();
    if (!api?.available?.()) return null;
    if (device && Date.now() - registeredAt < REGISTER_TTL_MS) return device;

    const info = await api.appInfo();
    const deviceId = String(info?.installationId || '').trim();
    if (!/^[A-Za-z0-9._:-]{8,80}$/.test(deviceId)) {
      throw makeError('OBD_DEVICE_ID_UNAVAILABLE', 'Android installation id is unavailable.');
    }

    const capabilities = Array.isArray(info?.nativeCapabilities) ? info.nativeCapabilities : [];
    const registration = await request('register', {
      body: {
        deviceId,
        platform: String(info?.platform || 'android'),
        appVersion: String(info?.versionName || ''),
        nativeApiVersion: Number(info?.nativeApiVersion || 0),
        capabilities,
      },
    });
    device = { id: deviceId, info, registration };
    registeredAt = Date.now();
    emit({ state: 'registered', deviceId });
    return device;
  }

  async function queuedItemForJob(jobId) {
    const api = mobile();
    const drained = await api.offlineDrain();
    const items = Array.isArray(drained?.items) ? drained.items : [];
    return items.find(item => String(item?.payload?.jobId || '') === String(jobId)) || null;
  }

  async function syncQueueItem(item) {
    const response = await fetch('/api/obd.php?action=sync', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [item] }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw makeError(String(payload?.code || 'OBD_SYNC_FAILED'), String(payload?.code || ('HTTP ' + response.status)));
    }
    await mobile().offlineAcknowledge([item]);
    return payload;
  }

  async function executeSnapshot(job) {
    const api = mobile();
    const queued = await queuedItemForJob(job.id);
    if (queued) {
      const syncKey = String(queued?.payload?.syncKey || queued?.id || '');
      await syncQueueItem(queued);
      return { syncKey, reusedQueuedResult: true };
    }

    let status = await api.elmStatus();
    if (!status?.connected) {
      status = await api.elmReconnectLast();
    }
    if (!status?.ready) {
      const initialized = await api.elmInit();
      if (!initialized?.vehicleConnected) {
        throw makeError('ELM_ECU_NOT_READY', 'ELM327 connected, but ECU did not answer.');
      }
      status = await api.elmStatus();
    }

    const snapshot = await api.elmSnapshot();
    const syncKey = ('remote_' + String(job.id || '')).slice(0, 120);
    const item = await api.offlineEnqueue({
      kind: 'obd_remote_job',
      jobId: String(job.id || ''),
      syncKey,
      capturedAt: Date.now(),
      vehicleId: String(job.vehicleId || ''),
      adapter: {
        name: String(status?.name || snapshot?.adapterName || 'ELM327'),
        address: String(status?.address || snapshot?.adapterAddress || ''),
      },
      vin: String(snapshot?.vin || ''),
      protocol: String(snapshot?.protocol || status?.protocol || ''),
      dtc: {
        raw: String(snapshot?.dtcRaw || ''),
        codes: Array.isArray(snapshot?.dtcCodes) ? snapshot.dtcCodes : [],
      },
      snapshot,
    });
    await syncQueueItem(item);
    return { syncKey, snapshot, reusedQueuedResult: false };
  }

  async function execute(job) {
    if (!job || job.action !== 'snapshot') {
      throw makeError('JOB_ACTION_DENIED', 'Unsupported remote OBD action: ' + String(job?.action || ''));
    }
    return executeSnapshot(job);
  }

  function shouldDefer(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    return !navigator.onLine
      || code === 'OBD_SYNC_FAILED'
      || code.startsWith('HTTP_5')
      || /failed to fetch|networkerror|network request failed/i.test(message);
  }

  async function tick() {
    if (busy || !navigator.onLine || document.visibilityState !== 'visible') return;
    if (String(location.hash || '').startsWith('#/diagnostics')) return;
    const api = mobile();
    if (!api?.available?.()) return;

    busy = true;
    let claimedJob = null;
    try {
      const currentDevice = await ensureDevice();
      if (!currentDevice) return;
      const pulled = await request('pull', { body: { deviceId: currentDevice.id } });
      claimedJob = pulled?.job || null;
      if (!claimedJob) return;

      emit({ state: 'claimed', job: claimedJob });
      const result = await execute(claimedJob);
      await request('complete', {
        body: {
          deviceId: currentDevice.id,
          jobId: claimedJob.id,
          status: 'completed',
          resultSyncKey: String(result?.syncKey || ''),
        },
      });
      emit({ state: 'completed', job: claimedJob, result });
    } catch (error) {
      emit({
        state: shouldDefer(error) ? 'deferred' : 'failed',
        job: claimedJob,
        error: { code: String(error?.code || 'OBD_REMOTE_FAILED'), message: String(error?.message || error) },
      });
      if (claimedJob && device && !shouldDefer(error)) {
        try {
          await request('complete', {
            body: {
              deviceId: device.id,
              jobId: claimedJob.id,
              status: 'failed',
              errorCode: String(error?.code || 'OBD_REMOTE_FAILED'),
              errorMessage: String(error?.message || error),
            },
          });
        } catch (_completeError) {}
      }
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer) return;
    timer = window.setInterval(tick, POLL_MS);
    window.setTimeout(tick, 1200);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
  }

  window.KaretaObdRemoteJobs = Object.freeze({
    start,
    stop,
    tick,
    createSnapshotJob: (vehicleId = '', requestKey = '') => request('create', {
      body: {
        jobAction: 'snapshot',
        vehicleId: String(vehicleId || ''),
        requestKey: String(requestKey || ''),
      },
    }),
    list: (limit = 20) => request('list', {
      method: 'GET',
      query: { limit: Math.max(1, Math.min(50, Number(limit) || 20)) },
    }),
  });

  window.addEventListener('kareta:mobile-ready', start);
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
