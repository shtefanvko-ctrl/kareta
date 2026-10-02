#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildApproval } = require('./harness_approval');

const approval = buildApproval({
  boundary: 'database-contract',
  subjectSha: 'ABCDEF12',
  reason: 'Reviewed migration boundary',
  actor: 'reviewer',
  repository: 'shtefanvko-ctrl/kareta'
});
assert.strictEqual(approval.schema, 'kareta.harness.approval.v1');
assert.strictEqual(approval.id, 'approval:database-contract');
assert.strictEqual(approval.subjectSha, 'abcdef12');
assert.strictEqual(approval.status, 'PASS');
assert.strictEqual(approval.actor, 'reviewer');
assert.throws(() => buildApproval({boundary:'unknown',subjectSha:'abcdef12',reason:'Valid reason',actor:'reviewer'}));
assert.throws(() => buildApproval({boundary:'database-contract',subjectSha:'abcdef12',reason:'x',actor:'reviewer'}));

console.log('HARNESS_APPROVAL_CONTRACT: PASS');
