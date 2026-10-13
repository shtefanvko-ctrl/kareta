#!/usr/bin/env node
'use strict';

// Isolated regression of the route_loader cache contract in the real sw.js.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const release = source.match(/^const RELEASE = '([^']+)'/m)?.[1];
assert.ok(release, 'SW release must be defined');
const start = source.indexOf('async function cacheFirstVersioned(');
const guard = source.indexOf('async function validRouteManifestResponse(');
const end = source.indexOf('function expectedStaticType(', start);
assert.ok(start > 0 && end > start, 'SW cache function must exist');
const body = source.slice(guard >= 0 && guard < start ? guard : start, end);

function response(type, version = release, validJson = true) {
  return {
    ok: true,
    headers: { get: key => key.toLowerCase() === 'content-type' ? type : null },
    clone() { return this; },
    async json() {
      if (!validJson) throw new Error('invalid JSON');
      return { release: version, assets: [], routeBundles: {} };
    }
  };
}

async function scenario(initial, network) {
  const stored = new Map();
  if (initial) stored.set('route', initial);
  let fetched = 0;
  const cache = {
    match: async key => stored.get(key) || null,
    put: async (key, value) => { stored.set(key, value); },
    delete: async key => stored.delete(key)
  };
  const load = new Function('caches', 'fetch', 'Response', 'RELEASE',
    body + '\nreturn cacheFirstVersioned;')(
    { open: async () => cache },
    async () => {
      fetched++;
      if (network === null) throw new Error('offline');
      return network;
    },
    { error: () => ({ error: true }) },
    release
  );
  const result = await load('route', 'kareta-static-' + release);
  return { result, cached: stored.get('route') || null, fetched };
}

(async () => {
  const valid = response('application/json');
  const html = response('text/html');
  const badJson = response('application/json', release, false);
  const stale = response('application/json', 'outdated-release');

  let r = await scenario(valid, null);
  assert.equal(r.result, valid, 'valid offline cache must be reused');
  assert.equal(r.fetched, 0);

  r = await scenario(html, valid);
  assert.equal(r.result, valid, 'cached HTML must be replaced');
  assert.equal(r.cached, valid);

  r = await scenario(null, html);
  assert.equal(r.result, html, 'surface the server response');
  assert.equal(r.cached, null, 'HTML must not be cached');

  r = await scenario(stale, valid);
  assert.equal(r.result, valid, 'stale release must be replaced');

  r = await scenario(badJson, valid);
  assert.equal(r.result, valid, 'malformed JSON must be replaced');

  r = await scenario(null, valid);
  assert.equal(r.cached, valid, 'valid manifest must be cached');

  r = await scenario(null, null);
  assert.equal(r.result.error, true, 'offline without cache must fail');

  console.log('PASS: 7 SW route-manifest cache scenarios');
})().catch(error => {
  console.error('FAIL: SW route-manifest cache regression:', error.message);
  process.exitCode = 1;
});
