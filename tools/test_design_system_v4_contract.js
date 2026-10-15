#!/usr/bin/env node
'use strict';

/*
 * Static design-system v4 guard. Deliberately DOES NOT claim actual browser
 * appearance, Android hardware support, authorization or deployment.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'ai/DESIGN_CANON_V4.json'), 'utf8'));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const expectedRoles = ['client', 'master', 'sto', 'seller', 'admin'];
const expectedLanguages = ['ru', 'kk', 'en'];
const expectedWidths = [320, 360, 375, 390, 412, 430];
const expectedBreakpoints = [767, 768, 1199, 1200];
const requiredChecks = [
  'tools/test_design_system_v4_contract.js',
  'tools/test_design_canon_v1.js',
  'tools/test_master_css_ownership.js',
  'tools/test_visual_canon_recovery_v3.js',
  'tools/test_home_scanner_navigation.js',
  'tools/test_mobile_back_bundle_sync.py'
];

function invariant(m) {
  assert.equal(m.schema_version, 1, 'schema version changed without migration');
  assert.equal(m.kind, 'repository-only-design-regression-plan');
  assert.equal(m.runtime_status, 'NOT_VERIFIED', 'static policy cannot assert runtime acceptance');
  assert.equal(m.contract, 'ai/rules/design-system-v4.md');
  assert.deepEqual(m.predecessors, [
    'ai/rules/visual-canon-v3.md',
    'docs/harness/DESIGN_SYSTEM_POLICY_V1.md'
  ]);
  assert.equal(m.token_owner, 'css/next/design_contract.css');
  assert.equal(m.logo_asset, 'assets/logo/main/kareta_logo_full.png');
  assert.deepEqual(m.roles, expectedRoles);
  assert.deepEqual(m.languages, expectedLanguages);
  assert.equal(m.theme_count, 3);
  assert.deepEqual(m.widths_px, expectedWidths);
  assert.deepEqual(m.breakpoint_edges_px, expectedBreakpoints);
  assert.deepEqual(m.required_repository_checks, requiredChecks);
  assert(m.not_proved.includes('real screenshots'));
  assert(m.not_proved.includes('staging or production deployed SHA'));
}

invariant(manifest);

const sources = [
  manifest.contract, ...manifest.predecessors, manifest.token_owner,
  manifest.logo_asset, ...manifest.protected_entry_points,
  ...manifest.required_repository_checks
];
for (const source of sources) {
  assert.match(source, /^[a-zA-Z0-9_./-]+$/, 'unexpected path encoding');
  assert(!path.posix.isAbsolute(source) && !source.split('/').includes('..'), 'unsafe manifest path');
  assert(fs.statSync(path.join(root, source)).isFile(), 'missing v4 source ' + source);
}

const policy = read('docs/harness/DESIGN_SYSTEM_POLICY_V1.md');
assert(policy.includes('Settings -> Primitive Tokens -> Semantic Tokens -> Shared Components -> Role Delta -> Page Layout -> Generated Output.'));
const designContract = read(manifest.token_owner);
for (const token of ['--k-radius-xs:', '--k-radius-control:', '--k-radius-card:', '--k-radius-dialog:',
  '--k-accent:', '--k-z-shell:', '--k-z-nav:', '--k-z-overlay:', '--k-z-modal:']) {
  assert(designContract.includes(token), 'missing canonical design token: ' + token);
}
const router = read('ai/CONTEXT_ROUTER.md');
assert(router.includes('`ai/rules/design-system-v4.md`'), 'v4 rule not routed');
const sourceRule = read(manifest.contract);
for (const token of ['`css/next/design_contract.css`', '`ai/DESIGN_CANON_V4.json`', '320, 360, 375, 390, 412, 430']) {
  assert(sourceRule.includes(token), 'rule missing visible scope: ' + token);
}
const logo = fs.readFileSync(path.join(root, manifest.logo_asset));
assert.deepEqual(logo.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
assert(logo.length > 24 && logo.readUInt32BE(16) > 100 && logo.readUInt32BE(20) > 50);

// Negative-path self-tests: silently broadening roles, widths or changing the
// runtime state would make the contract meaningless; each must fail closed.
const wrong = [
  { ...manifest, roles: ['client', 'master', 'sto', 'admin'] },
  { ...manifest, widths_px: [360, 390, 430] },
  { ...manifest, runtime_status: 'DEPLOYED' },
  { ...manifest, required_repository_checks: requiredChecks.slice(1) }
];
for (const mutated of wrong) assert.throws(() => invariant(mutated), assert.AssertionError);
console.log('DESIGN_SYSTEM_V4: PASS (manifest/source/token/logo checks + 4 negative cases; browser/Android NOT RUN)');
