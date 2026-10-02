#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { parseArgs, assertSha, buildEvidence } = require('./harness_evidence');

assert.deepStrictEqual(
  parseArgs(['--base','abcdef1','--head','1234567','--output','/tmp/x.json']),
  { base: 'abcdef1', head: '1234567', output: '/tmp/x.json' }
);
assert.doesNotThrow(() => assertSha('abcdef1', 'sha'));
assert.throws(() => assertSha('not-a-sha', 'sha'));

const evidence = buildEvidence(
  ['js/next/geo_map.js', 'api/migrations/137_geo_platform_core.php'],
  {
    repository: 'shtefanvko-ctrl/kareta',
    baseSha: 'AAAAAAAA',
    headSha: 'BBBBBBBB',
    ref: 'feature/test',
    workflowRunId: '42'
  }
);

assert.strictEqual(evidence.schema, 'kareta.harness.impact-evidence.v1');
assert.strictEqual(evidence.phase, 'IMPACT_PLANNED');
assert.strictEqual(evidence.baseSha, 'aaaaaaaa');
assert.strictEqual(evidence.headSha, 'bbbbbbbb');
assert(evidence.impact.subsystems.includes('geo'));
assert(evidence.impact.subsystems.includes('db'));
assert(evidence.impact.subsystems.includes('web'));
assert(evidence.impact.checks.includes('geo-platform-core'));
assert(evidence.impact.checks.includes('migration-contract'));
assert(evidence.impact.flags.includes('database-contract'));
assert(evidence.verification.length > 0);
assert(evidence.verification.every(item => item.status === 'NOT_RUN'));
assert(evidence.impact.checks.includes('approval:database-contract'));
assert(evidence.impact.approvalsRequired.some(item => item.boundary === 'database-contract'));

const bridgeApproval = buildEvidence(
  ['js/mobile_native_bridge.js'],
  {repository:'shtefanvko-ctrl/kareta',baseSha:'AAAAAAAA',headSha:'BBBBBBBB'}
);
assert(bridgeApproval.impact.checks.includes('approval:native-bridge-contract'));
assert(bridgeApproval.impact.approvalsRequired.some(item => item.checkId === 'approval:native-bridge-contract'));

console.log('HARNESS_IMPACT_EVIDENCE: PASS');
