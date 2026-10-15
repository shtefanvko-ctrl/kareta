'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOllamaAdapter, LOCAL_ENDPOINT } = require('./ollama-client.cjs');

const valid = { model: 'qwen2.5-coder:1.5b', enabled: true };
const task = { prompt: 'Synthetic test fixture: explain code P0300.', synthetic: true };
function body(text = 'Synthetic response') {
  return JSON.stringify({ response: text, model: valid.model, done: true });
}
function client(fetchImpl, options = {}) {
  return createOllamaAdapter({ ...valid, fetchImpl, ...options });
}
async function rejectsCode(promise, code) {
  await assert.rejects(promise, err => err && err.code === code);
}

test('opt-in defaults to OFF, model and synthetic declaration required', async () => {
  await rejectsCode(createOllamaAdapter().generate(task), 'DISABLED');
  assert.throws(() => createOllamaAdapter({ enabled: true }), { code: 'MODEL_REQUIRED' });
  assert.throws(() => createOllamaAdapter({ enabled: true, model: 'invalid model name' }), { code: 'MODEL_REQUIRED' });
  const mock = client(async () => new Response(body()));
  await rejectsCode(mock.generate({ prompt: task.prompt }), 'SYNTHETIC_ONLY');
  await rejectsCode(mock.generate({ prompt: '  ', synthetic: true }), 'INVALID_PROMPT');
  await rejectsCode(mock.generate({ prompt: 'x'.repeat(8193), synthetic: true }), 'INVALID_PROMPT');
});

test('fixed loopback only, rejects remote endpoint and alternate hostnames', () => {
  for (const endpoint of [
    'https://ollama.com/api/generate',
    'http://127.0.0.2:11434/api/generate',
    'http://localhost:11434/api/generate',
    'http://127.0.0.1:9999/api/generate',
    'http://127.0.0.1:11434/api/pull',
    'http://user@127.0.0.1:11434/api/generate'
  ]) {
    assert.throws(() => client(async () => new Response(body()), { endpoint }), { code: 'NON_LOOPBACK_ENDPOINT' });
  }
});

test('request to exact local generate endpoint; no auto-pull, no redirects, bounded model options', async () => {
  let calls = 0;
  const adapter = client(async (url, options) => {
    ++calls;
    assert.equal(url, LOCAL_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.deepEqual(JSON.parse(options.body), {
      model: valid.model,
      prompt: task.prompt,
      stream: false,
      keep_alive: 0,
      options: { num_ctx: 2048, num_predict: 128 }
    });
    return new Response(body(), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const reply = await adapter.generate(task);
  assert.deepEqual(reply, {
    status: 'unverified_model_output', model: valid.model,
    text: 'Synthetic response', synthetic: true
  });
  assert.equal(calls, 1);
  assert.equal(Object.isFrozen(reply), true);
});

test('404, status failures and unexpected redirect do not masquerade as success', async () => {
  await rejectsCode(client(async () => new Response('not found', { status: 404 })).generate(task), 'MODEL_NOT_FOUND');
  await rejectsCode(client(async () => new Response('error', { status: 500 })).generate(task), 'OLLAMA_HTTP_ERROR');
  await rejectsCode(client(async () => new Response(null, { status: 302 })).generate(task), 'REDIRECT_BLOCKED');
});

test('offline and malformed JSON or incomplete model response fail closed', async () => {
  await rejectsCode(client(async () => { throw new TypeError('connection refused'); }).generate(task), 'LOCAL_OLLAMA_UNAVAILABLE');
  await rejectsCode(client(async () => new Response('<invalid-json>')).generate(task), 'INVALID_JSON');
  await rejectsCode(client(async () => new Response(JSON.stringify({ done: false, response: 'partial' }))).generate(task), 'INVALID_MODEL_RESPONSE');
  await rejectsCode(client(async () => new Response(JSON.stringify({ done: true, response: null }))).generate(task), 'INVALID_MODEL_RESPONSE');
});

test('limits HTTP bytes, output bytes and declared content length', async () => {
  await rejectsCode(client(async () => new Response(body('x'.repeat(9000)))).generate(task), 'TEXT_TOO_LARGE');
  await rejectsCode(client(async () => new Response('x'.repeat(65537))).generate(task), 'RESPONSE_TOO_LARGE');
  await rejectsCode(client(async () => new Response(body(), { headers: { 'Content-Length': '999999' } })).generate(task), 'RESPONSE_TOO_LARGE');
  assert.throws(() => client(async () => new Response(body()), { maxHttpBytes: 70000 }), TypeError);
  assert.throws(() => client(async () => new Response(body()), { maxInputBytes: 9000 }), TypeError);
  assert.throws(() => client(async () => new Response(body()), { maxTextBytes: 9000 }), TypeError);
  assert.throws(() => client(async () => new Response(body()), { timeoutMs: 70000 }), TypeError);
});

test('concurrency is 1; lock clears after response completion', async () => {
  let resolveFetch;
  const gate = new Promise(resolve => { resolveFetch = resolve; });
  let requests = 0;
  const adapter = client(async () => (++requests === 1 ? gate : new Response(body())));
  const first = adapter.generate(task);
  await rejectsCode(adapter.generate(task), 'CONCURRENT_REQUEST');
  resolveFetch(new Response(body()));
  assert.equal((await first).text, 'Synthetic response');
  // A new Response body is needed per request; HTTP response bodies are one-shot.
  assert.equal((await adapter.generate(task)).text, 'Synthetic response');
});

test('timeout aborts pending local fetch and allows recovery', async () => {
  let attempts = 0;
  const adapter = client((_url, init) => {
    ++attempts;
    if (attempts > 1) return Promise.resolve(new Response(body()));
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  }, { timeoutMs: 15 });
  await rejectsCode(adapter.generate(task), 'TIMEOUT');
  assert.equal((await adapter.generate(task)).text, 'Synthetic response');
});
