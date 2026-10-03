#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { authorize } = require('./harness_authorize');

const observerRead = authorize({role:'observer', action:'read', files:[]});
assert.strictEqual(observerRead.authorized, true);

const observerWrite = authorize({role:'observer', action:'write', files:['js/next/pages/core.js']});
assert.strictEqual(observerWrite.authorized, false);
assert.strictEqual(observerWrite.reason, 'action-not-allowed');

const analystDocs = authorize({role:'analyst', action:'write', files:['docs/architecture/HARNESS.md']});
assert.strictEqual(analystDocs.authorized, true);

const analystRuntime = authorize({role:'analyst', action:'write', files:['js/next/pages/core.js']});
assert.strictEqual(analystRuntime.authorized, false);
assert.strictEqual(analystRuntime.reason, 'path-not-allowed');

const fixerRuntime = authorize({role:'fixer', action:'write', files:['js/next/pages/core.js']});
assert.strictEqual(fixerRuntime.authorized, true);

const fixerHarness = authorize({role:'fixer', action:'write', files:['harness/change-map.json']});
assert.strictEqual(fixerHarness.authorized, false);
assert.strictEqual(fixerHarness.reason, 'path-not-allowed');

const fixerDb = authorize({role:'fixer', action:'write', files:['api/migrations/137_geo_platform_core.php']});
assert.strictEqual(fixerDb.authorized, false);
assert.strictEqual(fixerDb.reason, 'protected-boundary-role-denied');
assert(fixerDb.requiredApprovals.includes('database-contract'));

const verifierHarness = authorize({role:'verifier', action:'write', files:['harness/change-map.json','tools/test_harness_verdict.js']});
assert.strictEqual(verifierHarness.authorized, true);

const verifierNative = authorize({role:'verifier', action:'write', files:['js/mobile_native_bridge.js']});
assert.strictEqual(verifierNative.authorized, false);
assert.strictEqual(verifierNative.reason, 'protected-boundary-role-denied');

const releaseDbBlocked = authorize({role:'release', action:'write', files:['api/migrations/137_geo_platform_core.php']});
assert.strictEqual(releaseDbBlocked.authorized, false);
assert.strictEqual(releaseDbBlocked.reason, 'protected-boundary-approval-required');

const releaseDbApproved = authorize({
  role:'release',
  action:'write',
  files:['api/migrations/137_geo_platform_core.php'],
  approvedBoundaries:['database-contract']
});
assert.strictEqual(releaseDbApproved.authorized, true);
assert.strictEqual(releaseDbApproved.reason, 'protected-boundary-approved');

const releaseDeploymentBlocked = authorize({role:'release', action:'write', files:['.github/workflows/staging-verify.yml']});
assert.strictEqual(releaseDeploymentBlocked.authorized, false);
assert(releaseDeploymentBlocked.requiredApprovals.includes('deployment-sensitive'));

const releaseDeploymentApproved = authorize({
  role:'release',
  action:'write',
  files:['.github/workflows/staging-verify.yml'],
  approvedBoundaries:['deployment-sensitive']
});
assert.strictEqual(releaseDeploymentApproved.authorized, true);

const unknownRole = authorize({role:'root', action:'write', files:['index.php']});
assert.strictEqual(unknownRole.authorized, false);
assert.strictEqual(unknownRole.reason, 'unknown-role');

console.log('HARNESS_PERMISSION_MATRIX: PASS');
