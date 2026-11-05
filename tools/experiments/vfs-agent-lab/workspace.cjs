'use strict';

// Experiment only. node:vfs is NOT a security boundary for untrusted code.
const { create } = require('node:vfs');
const DEFAULT_MAX_BYTES = 64 * 1024;
const AGENT_ID = /^[a-z][a-z0-9_-]{0,47}$/;

function encodeDocument(value, maxBytes) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Document must be a JSON object');
  }
  const json = JSON.stringify(value);
  if (typeof json !== 'string') throw new TypeError('Document is not serializable');
  if (Buffer.byteLength(json, 'utf8') > maxBytes) {
    throw new RangeError('Document exceeds the workspace byte limit');
  }
  return json;
}

function createWorkspace(agentId, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (typeof agentId !== 'string' || !AGENT_ID.test(agentId)) {
    throw new TypeError('Invalid agent identifier');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_MAX_BYTES) {
    throw new RangeError('Invalid document byte limit');
  }

  const filesystem = create();
  filesystem.mkdirSync('/inbox');
  filesystem.mkdirSync('/outbox');
  let closed = false;

  function checkOpen() {
    if (closed) throw new Error('Workspace is closed');
  }
  function put(path, document) {
    checkOpen();
    filesystem.writeFileSync(path, encodeDocument(document, maxBytes), 'utf8');
  }
  function get(path) {
    checkOpen();
    return JSON.parse(filesystem.readFileSync(path, 'utf8'));
  }

  // The restricted API intentionally does not accept arbitrary file paths.
  return Object.freeze({
    agentId,
    setTask(document) { put('/inbox/task.json', document); },
    getTask() { return get('/inbox/task.json'); },
    setResult(document) { put('/outbox/result.json', document); },
    getResult() { return get('/outbox/result.json'); },
    close() {
      if (closed) return;
      closed = true;
      filesystem.unmount();
    }
  });
}

module.exports = { createWorkspace, DEFAULT_MAX_BYTES };
