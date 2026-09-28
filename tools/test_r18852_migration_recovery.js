'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bootstrap = fs.readFileSync(path.join(root, 'api/bootstrap.php'), 'utf8');
const migrationPath = path.join(root, 'api/migrations/098_role_workspaces_completion.php');
const migration = fs.readFileSync(migrationPath, 'utf8');

assert.strictEqual(
  crypto.createHash('sha256').update(migration).digest('hex'),
  '02a2d591dbc6eb68733177da1b79283f0c0e2b44f66d11ae37f26dd7725c3a0d',
  'historical migration 98 must keep its recorded checksum'
);

const helperStart = bootstrap.indexOf('function kareta_prepare_migration_98_dashboard_layout_compatibility');
const helperEnd = bootstrap.indexOf('\nfunction kareta_migrate', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'migration 98 compatibility helper is missing');
const helper = bootstrap.slice(helperStart, helperEnd);

for (const required of [
  "COLUMN_NAME IN ('context_key','revision')",
  'GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX',
  "$scopeIndex = 'uq_dashboard_layout_scope'",
  "$expectedScope = 'account_id,context_kind,context_key,dashboard_key'",
  'Migration 98 compatibility repair failed'
]) {
  assert(helper.includes(required), `compatibility helper is missing: ${required}`);
}
assert(helper.includes('idx_dashboard_layout_account_fk'),'migration 98 recovery lacks a dedicated FK-supporting account index');
assert(helper.indexOf('idx_dashboard_layout_account_fk')<helper.indexOf('uq_dashboard_layout_scope'),'FK-supporting index must be prepared before the scoped unique index');
assert(helper.includes('DROP FOREIGN KEY'), 'compatibility helper must detach the FK before replacing indexes');
assert(helper.includes('DROP INDEX `uq_dashboard_layout`'), 'compatibility helper must finalize the legacy index transition');
assert(helper.includes('ADD CONSTRAINT'), 'compatibility helper must restore the detached FK');
assert(helper.indexOf('DROP FOREIGN KEY') < helper.indexOf('DROP INDEX `uq_dashboard_layout`'), 'FK must be detached before the legacy index is dropped');
assert(helper.indexOf('DROP INDEX `uq_dashboard_layout`') < helper.indexOf('ADD CONSTRAINT'), 'FK must be restored only after final indexes exist');

const hook = bootstrap.indexOf('kareta_prepare_migration_98_dashboard_layout_compatibility($pdo);');
const apply = bootstrap.indexOf('kareta_apply_migration($pdo, $migration);', hook);
assert(hook >= 0 && apply > hook, 'compatibility helper must run before unapplied migration 98');

const addReplacement = helper.indexOf('ADD UNIQUE KEY `uq_dashboard_layout_scope`');
const historicalDrop = migration.indexOf('DROP INDEX uq_dashboard_layout');
assert(addReplacement >= 0 && historicalDrop >= 0, 'index replacement sequence is incomplete');

console.log('R188.5.2 migration 98 recovery tests OK');
