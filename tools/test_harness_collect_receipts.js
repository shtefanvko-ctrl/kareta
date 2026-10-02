#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { CHECK_SOURCES, conclusionToStatus, latestRun } = require('./harness_collect_receipts');

assert.strictEqual(conclusionToStatus('success'), 'PASS');
assert.strictEqual(conclusionToStatus('failure'), 'FAIL');
assert.strictEqual(conclusionToStatus('timed_out'), 'FAIL');
assert.strictEqual(conclusionToStatus('cancelled'), 'BLOCKED');
assert.strictEqual(CHECK_SOURCES['geo-platform-core'].workflow, 'Application gates');
assert.strictEqual(CHECK_SOURCES['migration-contract'].workflow, 'verify');
assert.strictEqual(CHECK_SOURCES['asset-url-hygiene'].receiptId, 'application-gates');

const runs = [
  {name:'verify',head_sha:'abc1234',run_number:7,id:7},
  {name:'verify',head_sha:'abc1234',run_number:9,id:9},
  {name:'verify',head_sha:'def5678',run_number:10,id:10},
  {name:'Application gates',head_sha:'abc1234',run_number:11,id:11}
];
assert.strictEqual(latestRun(runs,'verify','abc1234').id,9);
assert.strictEqual(latestRun(runs,'Application gates','abc1234').id,11);
assert.strictEqual(latestRun(runs,'verify','fffffff'),null);

console.log('HARNESS_RECEIPT_COLLECTOR: PASS');
