'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/next/api_client.js'), 'utf8');

function loadClient(fetcher) {
  const handlers = new Map();
  const storage = new Map();
  const sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    key: index => Array.from(storage.keys())[index] ?? null,
    get length() { return storage.size; },
  };
  const window = {
    addEventListener(name, callback) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(callback);
    },
  };
  const context = {
    window, sessionStorage, fetch: fetcher, Headers, AbortController,
    URL, URLSearchParams, console, setTimeout, clearTimeout,
    location: { href: 'https://kareta.kz/', origin: 'https://kareta.kz' },
  };
  vm.runInNewContext(source, context, { filename: 'js/next/api_client.js' });
  return { client: window.KaretaApiClient, emit: name => handlers.get(name)?.forEach(fn => fn()), storage };
}

function response(status, payload) {
  return {
    status, ok: status >= 200 && status < 300, url: 'https://kareta.kz/api/test',
    headers: { get: key => key.toLowerCase() === 'content-type' ? 'application/json' : null },
    async json() { return payload; },
    async text() { return JSON.stringify(payload); },
  };
}

(async function main() {
  let count = 0;
  let fetcher = async () => (++count === 1
    ? response(200, { ok: true, authenticated: true, account: { id: 7 } })
    : response(401, { ok: false, error: 'session_required' }));
  let { client } = loadClient(fetcher);
  assert.equal(client.normalizePayload({ error: 'failed' }, response(200, {})).ok, false, 'HTTP 200 with an explicit error is not success');
  assert.equal(client.normalizePayload({ ok: true, errors: ['bad'] }, response(200, {})).ok, false, 'errors array blocks false success');
  assert.equal(client.normalizePayload(null, response(200, null)).ok, false, 'empty HTTP 200 must fail');
  assert.equal(client.normalizePayload({ ok: true }, response(200, {})).ok, true, 'valid JSON success remains valid');
  assert.equal(client.normalizePayload(null, response(204, null)).ok, true, 'empty 204 remains valid');

  let first = await client.getSession();
  let second = await client.getSession();
  assert.equal(first.ok, true);
  assert.equal(second.status, 401, 'the real authorization failure must survive the cache');
  assert.equal(second.ok, false, 'a cached authenticated response must not mask 401');
  assert.equal(second.fromCache, false);
  assert.equal(count, 2);
  console.log('PASS auth-session 200->401, no stale success');

  count = 0;
  fetcher = async () => (++count === 1
    ? response(200, { ok: true, news: [{ id: 'n' }] })
    : response(503, { ok: false, error: 'unavailable' }));
  ({ client } = loadClient(fetcher));
  first = await client.getNews({}, { force: true });
  second = await client.getNews({}, { force: true });
  assert.equal(first.ok, true);
  assert.equal(second.status, 503, 'force refresh must show actual server error');
  assert.equal(second.ok, false);
  console.log('PASS force-GET 200->503, no stale masking');

  count = 0;
  fetcher = async () => (++count === 1
    ? response(200, { ok: true, news: [] })
    : response(503, { ok: false, error: 'temporary' }));
  ({ client } = loadClient(fetcher));
  first = await client.getNews();
  second = await client.getNews({}, { cacheTtlMs: 0 });
  assert.equal(first.ok, true);
  assert.equal(second.fromCache, true);
  assert.equal(second.stale, true, 'non-sensitive non-forced catalogue retains offline failsoft');
  console.log('PASS non-sensitive stale fallback preserved');

  count = 0;
  fetcher = async () => (++count === 1
    ? response(200, { ok: true, news: [] })
    : response(503, { ok: false, error: 'temporary' }));
  let loaded = loadClient(fetcher);
  client = loaded.client;
  first = await client.getNews();
  loaded.emit('kareta:identity-anonymous');
  second = await client.getNews();
  assert.equal(second.ok, false, 'anonymous event must purge cached data');
  assert.equal(second.status, 503);
  assert.equal(loaded.storage.size, 0, 'persistent cache must be cleared on logout');
  console.log('PASS identity-anonymous purges cached results');

  count = 0;
  fetcher = async () => (++count === 1
    ? response(200, { ok: true, news: [] })
    : response(403, { ok: false, error: 'forbidden' }));
  ({ client } = loadClient(fetcher));
  first = await client.getNews();
  second = await client.getNews({}, { cacheTtlMs: 0 });
  assert.equal(second.status, 403, '403 may never fall back to cached success');
  assert.equal(second.ok, false);
  assert.equal(client.audit().cacheEntries, 0);
  console.log('PASS 403 fails closed and clears cached results');
  console.log('P0 API CACHE REGRESSION: PASS 5/5');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
