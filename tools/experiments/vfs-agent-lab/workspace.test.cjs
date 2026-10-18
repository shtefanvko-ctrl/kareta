'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vfs = require('node:vfs');
const { createWorkspace, DEFAULT_MAX_BYTES } = require('./workspace.cjs');

test('isolated fixture documents are distinct per workspace', (t) => {
  const diagnostic = createWorkspace('diagnostic');
  const crm = createWorkspace('crm');
  t.after(() => { diagnostic.close(); crm.close(); });
  diagnostic.setTask({ operation: 'explain_dtc', code: 'P0300', synthetic: true });
  assert.deepEqual(diagnostic.getTask(), { operation: 'explain_dtc', code: 'P0300', synthetic: true });
  assert.throws(() => crm.getTask(), { code: 'ENOENT' });
  crm.setTask({ operation: 'test_booking', synthetic: true });
  assert.deepEqual(crm.getTask(), { operation: 'test_booking', synthetic: true });
  diagnostic.setResult({ status: 'fixture_result' });
  assert.deepEqual(diagnostic.getResult(), { status: 'fixture_result' });
  assert.throws(() => crm.getResult(), { code: 'ENOENT' });
});

test('invalid agent identifiers and document types are rejected', () => {
  for (const id of ['', '../escape', 'bad/name', 'A', 'x'.repeat(49)]) {
    assert.throws(() => createWorkspace(id), TypeError);
  }
  assert.throws(() => createWorkspace('agent', { maxBytes: 0 }), RangeError);
  assert.throws(() => createWorkspace('agent', { maxBytes: DEFAULT_MAX_BYTES + 1 }), RangeError);
  const workspace = createWorkspace('agent');
  try {
    for (const value of [null, false, 1, 'string', []]) {
      assert.throws(() => workspace.setTask(value), TypeError);
    }
    assert.throws(() => workspace.setResult({ payload: 'x'.repeat(DEFAULT_MAX_BYTES) }), RangeError);
    const cyclic = {};
    cyclic.self = cyclic;
    assert.throws(() => workspace.setTask(cyclic), TypeError);
  } finally { workspace.close(); }
});

test('closing is idempotent and blocks future operations', () => {
  const workspace = createWorkspace('verifier');
  workspace.setTask({ stage: 'test' });
  workspace.close();
  workspace.close();
  assert.throws(() => workspace.getTask(), /closed/);
  assert.throws(() => workspace.setResult({ ok: true }), /closed/);
});

test('explicit VFS mount works with node:fs and unmount removes access', () => {
  const filesystem = vfs.create();
  filesystem.writeFileSync('/readme.txt', 'fixture only');
  const mountPath = filesystem.mount();
  try {
    assert.equal(fs.readFileSync(mountPath + '/readme.txt', 'utf8'), 'fixture only');
  } finally {
    filesystem.unmount();
  }
  assert.throws(() => fs.readFileSync(mountPath + '/readme.txt', 'utf8'));
});
