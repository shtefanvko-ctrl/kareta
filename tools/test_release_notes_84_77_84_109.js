'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

const jsonPath = 'docs/changelog/release_notes_84_77_84_109.json';
const mdPath = 'docs/changelog/RELEASE_NOTES_R188_5_5_6_84_77_TO_84_109.md';
const data = JSON.parse(read(jsonPath));
const md = read(mdPath);
const migrationManifest = read('api/migration_manifest.php');

assert(data.schema === 'kareta.release-notes.v1', 'schema mismatch');
assert(data.baseline === '188.5.5.6.84.109', 'baseline mismatch');
assert(data.range?.from === '188.5.5.6.84.77', 'range start mismatch');
assert(data.range?.to === '188.5.5.6.84.109', 'range end mismatch');
assert(data.range?.count === 33, 'range count mismatch');
assert(Array.isArray(data.releases) && data.releases.length === 33, 'expected 33 release entries');

const expected = Array.from({length:33}, (_,i)=>77+i);
const actual = data.releases.map(r=>r.n);
assert(JSON.stringify(actual) === JSON.stringify(expected), 'release sequence must cover 77..109 without gaps');

const counts = data.releases.reduce((acc,row)=>{
  acc[row.type] = (acc[row.type] || 0) + 1;
  return acc;
},{});
assert(counts.patch === 30, 'standalone patch doc count mismatch');
assert(counts.queue === 1, 'queue evidence count mismatch');
assert(counts.recovery === 1, 'recovery evidence count mismatch');
assert(counts.gap === 1, 'documentation gap count mismatch');

for (const row of data.releases) {
  assert(row.release === '188.5.5.6.84.' + row.n, 'release id mismatch: ' + row.n);
  assert(typeof row.summary === 'string' && row.summary.length >= 8, 'summary missing: ' + row.n);
  if (row.type !== 'gap') {
    assert(typeof row.source === 'string' && row.source.length > 0, 'source missing: ' + row.n);
    assert(fs.existsSync(path.join(root, row.source)), 'source file not found: ' + row.source);
  }
}
const gap = data.releases.find(r=>r.n===90);
assert(gap?.type === 'gap' && gap.source === null, '84.90 must remain explicit documentation gap');

assert(data.migrationPolicy?.version === 129, 'release note migration version mismatch');
assert(data.migrationPolicy?.files === 129, 'release note migration file count mismatch');
assert(data.migrationPolicy?.releaseNumbersIndependentFromMigrationNumbers === true, 'release/migration numbering distinction missing');
assert(data.migrationPolicy?.runtimeMigrationFailClosed === true, 'fail-closed runtime migration policy missing');
assert(data.migrationPolicy?.maintenanceFlag === 'KARETA_DB_RUNTIME_MIGRATION_WINDOW=1', 'maintenance flag mismatch');
assert(data.migrationPolicy?.messagingAutoSchemaDefault === false, 'messaging auto-schema policy mismatch');
assert(data.migrationPolicy?.privateConfigPackaged === false, 'private config packaging policy mismatch');
assert(data.migrationPolicy?.genericDownMigrationContract === false, 'rollback/down migration policy mismatch');

assert(/['"]version['"]\s*=>\s*129/.test(migrationManifest), 'actual migration manifest is not version 129');
const manifestFiles = [...migrationManifest.matchAll(/\d+\s*=>\s*\['file'\s*=>\s*'\d+_[^']+\.php'/g)];
assert(manifestFiles.length === 129, 'actual migration manifest must contain 129 files');

for (const heading of [
  '## DB migrations и schema policy',
  '## Known limitations / operational notes',
  '## Rollback notes',
  '## Pre-release / post-release checklist',
  '## Source coverage',
]) {
  assert(md.includes(heading), 'required release-note section missing: ' + heading);
}
for (const token of [
  'KARETA_DB_RUNTIME_MIGRATION_WINDOW=1',
  'php tools/messaging_schema_install.php',
  'KARETA_OTP_TEMP_STATIC_ENABLED=0',
  'config.private.php',
  'MySQL snapshot/backup',
  '84.90 documentation gap',
]) {
  assert(md.includes(token), 'required operational/rollback note missing: ' + token);
}

console.log('RELEASE_NOTES_84_77_84_109: PASS releases=33 patch=30 queue=1 recovery=1 gap=1 migrations=129');
