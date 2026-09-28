'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const assert = (value, message) => { if (!value) throw new Error(message); };

const contract = JSON.parse(read('tools/contracts/db_monolith_84_109.json'));
const dbPath = contract.monolith;
const db = read(dbPath);
const dbBytes = Buffer.byteLength(db, 'utf8');

function routerActions(source) {
  const out = new Set();
  for (const re of [
    /case\s+['"]([^'"]+)['"]/g,
    /\$action\s*===\s*['"]([^'"]+)['"]/g,
  ]) {
    for (const match of source.matchAll(re)) out.add(match[1]);
  }
  return out;
}

const current = routerActions(db);
const baseline = new Set(contract.baselineActions || []);
const extracted = new Set(contract.extractedActions || []);

assert(dbBytes <= contract.maxBytes,
  'api/db.php grew: ' + dbBytes + ' > max ' + contract.maxBytes + '. New logic/actions must go to api/domains/*.');

const newMonolithActions = [...current].filter(action => !baseline.has(action)).sort();
assert(newMonolithActions.length === 0,
  'new actions added to api/db.php: ' + newMonolithActions.join(', '));

const leakedExtracted = [...extracted].filter(action => current.has(action)).sort();
assert(leakedExtracted.length === 0,
  'extracted actions returned to api/db.php: ' + leakedExtracted.join(', '));

assert(current.size <= contract.baselineActionCount,
  'monolith action count grew: ' + current.size + ' > ' + contract.baselineActionCount);

for (const [file, actions] of Object.entries(contract.domainFiles || {})) {
  assert(exists(file), 'domain file missing: ' + file);
  const source = read(file);
  const cases = routerActions(source);
  for (const action of actions) {
    assert(cases.has(action), 'domain action missing: ' + action + ' in ' + file);
  }
}

for (const file of Object.keys(contract.domainFiles || {})) {
  const requireLiteral = "require_once __DIR__ . '/" + file.replace(/^api\//, '') + "';";
  assert(db.includes(requireLiteral), 'domain require missing from db.php: ' + file);
}

const bodyIndex = db.indexOf("$action = (string)($body['action'] ?? '');");
const identityDispatchIndex = db.indexOf('kareta_identity_admin_dispatch($pdo, $action, $body)');
const configDispatchIndex = db.indexOf('kareta_runtime_config_dispatch($action, $body)');
const switchIndex = db.indexOf('switch ($action) {');
assert(bodyIndex >= 0, 'POST action assignment missing');
assert(identityDispatchIndex > bodyIndex && identityDispatchIndex < switchIndex,
  'identity dispatcher must run before monolith switch');
assert(configDispatchIndex > bodyIndex && configDispatchIndex < switchIndex,
  'runtime config dispatcher must run before monolith switch');

for (const fn of [
  'auth_send_otp','auth_verify_otp','users_getAll','users_setRole','users_setActive',
  'profile_update_mine','app_config_path','app_config_default','app_config_read','app_config_save'
]) {
  assert(!new RegExp('function\\s+' + fn + '\\s*\\(').test(db),
    'extracted handler still defined in api/db.php: ' + fn);
}

const identity = read('api/domains/identity_admin.php');
const config = read('api/domains/runtime_config.php');
for (const fn of ['auth_send_otp','auth_verify_otp','users_getAll','users_setRole','users_setActive','profile_update_mine']) {
  assert(new RegExp('function\\s+' + fn + '\\s*\\(').test(identity),
    'identity handler missing after extraction: ' + fn);
}
for (const fn of ['app_config_path','app_config_default','app_config_read','app_config_save']) {
  assert(new RegExp('function\\s+' + fn + '\\s*\\(').test(config),
    'config handler missing after extraction: ' + fn);
}

const domainActions = new Set([
  ...routerActions(identity),
  ...routerActions(config),
]);
for (const action of extracted) {
  assert(domainActions.has(action), 'extracted action missing from domain dispatchers: ' + action);
}

console.log(
  'DB_MONOLITH_DECOMPOSITION_84_109: PASS ' +
  'bytes=' + dbBytes + '/' + contract.maxBytes + ' ' +
  'monolithActions=' + current.size + '/' + contract.baselineActionCount + ' ' +
  'extracted=' + extracted.size + ' newMonolithActions=0'
);
