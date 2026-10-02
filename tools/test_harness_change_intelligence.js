#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { classify, globToRegex } = require('./harness_plan');

assert(globToRegex('api/**').test('api/geo.php'));
assert(globToRegex('tools/test_geo_*.js').test('tools/test_geo_map_lazy.js'));
assert(!globToRegex('tools/test_geo_*.js').test('tools/test_obd_remote_control_plane.js'));

const geoMap = classify(['js/next/geo_map.js']);
assert(geoMap.subsystems.includes('web'));
assert(geoMap.subsystems.includes('geo'));
assert(geoMap.checks.includes('geo-platform-core'));
assert.strictEqual(geoMap.risk, 'high');
assert.strictEqual(geoMap.requiresReview, true);

const geoMigration = classify(['api/migrations/137_geo_platform_core.php']);
assert(geoMigration.subsystems.includes('api'));
assert(geoMigration.subsystems.includes('db'));
assert(geoMigration.subsystems.includes('geo'));
assert(geoMigration.checks.includes('migration-contract'));
assert(geoMigration.flags.includes('database-contract'));

const obdRunner = classify(['js/next/obd_remote_jobs.js']);
assert(obdRunner.subsystems.includes('web'));
assert(obdRunner.subsystems.includes('obd'));
assert(obdRunner.checks.includes('obd-remote-control-plane'));

const bridge = classify(['js/mobile_native_bridge.js']);
assert(bridge.subsystems.includes('web'));
assert(bridge.subsystems.includes('native-bridge'));
assert(bridge.flags.includes('native-bridge-contract'));
assert(!bridge.flags.includes('database-contract'));
assert(!bridge.flags.includes('deployment-sensitive'));

const harnessOnly = classify(['harness/change-map.json', 'tools/harness_plan.js']);
assert.deepStrictEqual(harnessOnly.subsystems, ['harness']);
assert.deepStrictEqual(harnessOnly.checks, ['harness-self-test']);
assert.strictEqual(harnessOnly.risk, 'low');
assert.strictEqual(harnessOnly.requiresReview, false);

const unknown = classify(['docs/notes/unmapped.md']);
assert(unknown.subsystems.includes('unknown'));
assert(unknown.checks.includes('verification-gate'));
assert.strictEqual(unknown.requiresReview, true);

const mixed = classify(['css/next/geo_map.css', 'api/migrations/137_geo_platform_core.php']);
assert(mixed.subsystems.includes('web'));
assert(mixed.subsystems.includes('api'));
assert(mixed.subsystems.includes('db'));
assert(mixed.subsystems.includes('geo'));
assert.strictEqual(mixed.risk, 'high');

console.log('HARNESS_CHANGE_INTELLIGENCE: PASS');
