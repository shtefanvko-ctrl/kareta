#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { statusFromJobStatus, buildReceipt } = require('./harness_receipt');

assert.strictEqual(statusFromJobStatus('success'), 'PASS');
assert.strictEqual(statusFromJobStatus('failure'), 'FAIL');
assert.strictEqual(statusFromJobStatus('cancelled'), 'BLOCKED');
assert.strictEqual(statusFromJobStatus('unknown'), 'BLOCKED');

const receipt = buildReceipt({
  id: 'verification-gate',
  subjectSha: 'ABCDEF12',
  jobStatus: 'success',
  workflow: 'verify',
  job: 'verification-gate',
  runId: '123',
  runAttempt: '1',
  repository: 'shtefanvko-ctrl/kareta',
  ref: 'feature/test'
});
assert.strictEqual(receipt.schema, 'kareta.harness.receipt.v1');
assert.strictEqual(receipt.id, 'verification-gate');
assert.strictEqual(receipt.subjectSha, 'abcdef12');
assert.strictEqual(receipt.status, 'PASS');
assert.strictEqual(receipt.source, 'github-actions');

assert.throws(() => buildReceipt({id:'x',subjectSha:'not-sha',jobStatus:'success'}));

console.log('HARNESS_RECEIPT_CONTRACT: PASS');
