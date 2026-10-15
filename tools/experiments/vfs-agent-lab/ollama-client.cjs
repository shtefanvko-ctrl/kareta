'use strict';

// Developer-only Ollama adapter. No remote URLs, automatic model pulls or production data.
const LOCAL_ENDPOINT = 'http://127.0.0.1:11434/api/generate';
const MAX_INPUT_BYTES = 8 * 1024;
const MAX_HTTP_BYTES = 64 * 1024;
const MAX_TEXT_BYTES = 8 * 1024;
const MODEL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/;

class OllamaLabError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OllamaLabError';
    this.code = code;
  }
}

function checkLimit(value, name, ceiling) {
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) {
    throw new TypeError('Invalid ' + name);
  }
}

function createOllamaAdapter({
  enabled = false,
  model,
  endpoint = LOCAL_ENDPOINT,
  fetchImpl = globalThis.fetch,
  timeoutMs = 60000,
  maxInputBytes = MAX_INPUT_BYTES,
  maxHttpBytes = MAX_HTTP_BYTES,
  maxTextBytes = MAX_TEXT_BYTES
} = {}) {
  if (endpoint !== LOCAL_ENDPOINT) throw new OllamaLabError('NON_LOOPBACK_ENDPOINT');
  if (enabled !== true && enabled !== false) throw new TypeError('Invalid enabled flag');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch unavailable');
  checkLimit(timeoutMs, 'timeoutMs', 60000);
  checkLimit(maxInputBytes, 'maxInputBytes', MAX_INPUT_BYTES);
  checkLimit(maxHttpBytes, 'maxHttpBytes', MAX_HTTP_BYTES);
  checkLimit(maxTextBytes, 'maxTextBytes', MAX_TEXT_BYTES);
  if (enabled && (typeof model !== 'string' || !MODEL_NAME.test(model))) {
    throw new OllamaLabError('MODEL_REQUIRED');
  }

  let busy = false;
  async function generate({ prompt, synthetic } = {}) {
    if (!enabled) throw new OllamaLabError('DISABLED');
    if (busy) throw new OllamaLabError('CONCURRENT_REQUEST');
    if (synthetic !== true) throw new OllamaLabError('SYNTHETIC_ONLY');
    if (typeof prompt !== 'string' || !prompt.trim() ||
        Buffer.byteLength(prompt, 'utf8') > maxInputBytes) {
      throw new OllamaLabError('INVALID_PROMPT');
    }

    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // No dynamic URL, redirects, tool calling, or persistent context. Never log input/output.
      const response = await fetchImpl(LOCAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          keep_alive: 0,
          options: { num_ctx: 2048, num_predict: 128 }
        })
      });
      if (!response || !Number.isInteger(response.status)) throw new OllamaLabError('INVALID_HTTP_RESPONSE');
      if (response.status >= 300 && response.status < 400) throw new OllamaLabError('REDIRECT_BLOCKED');
      if (response.status === 404) throw new OllamaLabError('MODEL_NOT_FOUND');
      if (!response.ok) throw new OllamaLabError('OLLAMA_HTTP_ERROR');

      const contentLength = response.headers && response.headers.get('content-length');
      if (contentLength !== null && contentLength !== undefined) {
        const length = Number(contentLength);
        if (!Number.isFinite(length) || length > maxHttpBytes) {
          throw new OllamaLabError('RESPONSE_TOO_LARGE');
        }
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new OllamaLabError('INVALID_HTTP_BODY');
      }
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!(value instanceof Uint8Array)) throw new OllamaLabError('INVALID_HTTP_BODY');
          total += value.byteLength;
          if (total > maxHttpBytes) throw new OllamaLabError('RESPONSE_TOO_LARGE');
          chunks.push(value);
        }
      } finally {
        // Cancellation is best-effort; release the reader even after oversized input.
        try { await reader.cancel(); } catch (_) { /* ignore cleanup failure */ }
        reader.releaseLock();
      }
      let json;
      try {
        json = JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
      } catch (_) {
        throw new OllamaLabError('INVALID_JSON');
      }
      if (!json || typeof json !== 'object' || Array.isArray(json) ||
          json.done !== true || typeof json.response !== 'string') {
        throw new OllamaLabError('INVALID_MODEL_RESPONSE');
      }
      if (Buffer.byteLength(json.response, 'utf8') > maxTextBytes) {
        throw new OllamaLabError('TEXT_TOO_LARGE');
      }
      return Object.freeze({
        status: 'unverified_model_output',
        model,
        text: json.response,
        synthetic: true
      });
    } catch (error) {
      if (error instanceof OllamaLabError) throw error;
      if (controller.signal.aborted || (error && error.name === 'AbortError')) {
        throw new OllamaLabError('TIMEOUT');
      }
      throw new OllamaLabError('LOCAL_OLLAMA_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  }

  return Object.freeze({ generate });
}

module.exports = { createOllamaAdapter, OllamaLabError, LOCAL_ENDPOINT };
