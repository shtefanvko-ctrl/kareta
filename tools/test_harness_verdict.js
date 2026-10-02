#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildVerdict } = require('./harness_verdict');

function impact(headSha, checks) {
  return {
    schema: 'kareta.harness.impact-evidence.v1',
    headSha,
    impact: { checks }
  };
}

const current = 'bbbbbbbb';
const old = 'aaaaaaaa';

const stale = buildVerdict(impact(current, ['verify']), [
  { id: 'verify', subjectSha: old, status: 'PASS' }
]);
assert.strictEqual(stale.status, 'BLOCKED');
assert.strictEqual(stale.checks[0].status, 'STALE');
assert.strictEqual(stale.checks[0].staleEvidenceSha, old);

const exactPass = buildVerdict(impact(current, ['verify']), [
  { id: 'verify', subjectSha: old, status: 'PASS' },
  { id: 'verify', subjectSha: current, status: 'PASS' }
]);
assert.strictEqual(exactPass.status, 'PASS');
assert.strictEqual(exactPass.checks[0].status, 'PASS');

const missing = buildVerdict(impact(current, ['verify','application-gates']), [
  { id: 'verify', subjectSha: current, status: 'PASS' }
]);
assert.strictEqual(missing.status, 'BLOCKED');
assert.strictEqual(missing.checks.find(x => x.id === 'application-gates').status, 'NOT_RUN');

const failed = buildVerdict(impact(current, ['verify']), [
  { id: 'verify', subjectSha: current, status: 'FAIL' }
]);
assert.strictEqual(failed.status, 'FAIL');
assert.strictEqual(failed.checks[0].status, 'FAIL');

const notRequired = buildVerdict(impact(current, ['android-build']), [
  { id: 'android-build', subjectSha: current, status: 'NOT_REQUIRED' }
]);
assert.strictEqual(notRequired.status, 'PASS');

console.log('HARNESS_STALE_POLICY: PASS');
