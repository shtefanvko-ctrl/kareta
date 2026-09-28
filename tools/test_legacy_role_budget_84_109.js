'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiRoot = path.join(root, 'api');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const st = fs.statSync(file);
    if (st.isDirectory()) out.push(...walk(file));
    else if (file.endsWith('.php')) out.push(file);
  }
  return out;
}

function directRoleGateCount(text) {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/function\s+kareta_require_(?:any_)?role\s*\(/.test(line)) continue;
    count += (line.match(/kareta_require_role\s*\(/g) || []).length;
    count += (line.match(/kareta_require_any_role\s*\(/g) || []).length;
  }
  return count;
}

const before = { total: 108, db: 90 };
const budget = { total: 68, db: 50 };
const counts = {};
let total = 0;

for (const file of walk(apiRoot)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const count = directRoleGateCount(fs.readFileSync(file, 'utf8'));
  if (count) counts[rel] = count;
  total += count;
}

const db = fs.readFileSync(path.join(apiRoot, 'db.php'), 'utf8');
const policy = fs.readFileSync(path.join(apiRoot, 'domains', 'capability_dispatch.php'), 'utf8');
const dbCount = counts['api/db.php'] || 0;

assert(total <= budget.total, 'legacy role budget exceeded: total ' + total + ' > ' + budget.total);
assert(dbCount <= budget.db, 'db.php role budget exceeded: ' + dbCount + ' > ' + budget.db);
assert(total < before.total, 'legacy role debt did not decrease: ' + total + ' >= ' + before.total);
assert(dbCount < before.db, 'db.php role debt did not decrease: ' + dbCount + ' >= ' + before.db);

const registry = fs.readFileSync(path.join(apiRoot, 'identity', 'capability_registry.php'), 'utf8');
assert(registry.includes("'profile.edit_own' => 'profile.manage'"),
  'profile.edit_own canonical alias missing');

const mappings = [
  ['vehicles.issue.save', 'vehicles.update'],
  ['orders.masterClaim', 'requests.respond'],
  ['orders.masterDecline', 'requests.respond'],
  ['orders.update', 'requests.update'],
  ['orders.cancelByClient', 'requests.update'],
  ['orders.clientEdit', 'requests.update'],
  ['orders.returnToAdmin', 'work_orders.update_status'],
  ['orders.confirmHandover', 'requests.update'],
  ['orders.setStatus', 'work_orders.update_status'],
  ['orders.addStage', 'work_orders.update'],
  ['orders.complete', 'work_orders.update_status'],
  ['orders.confirmDone', 'requests.update'],
  ['orders.proposeExtraQuote', 'work_orders.update'],
  ['orders.acceptExtraQuote', 'requests.update'],
  ['orders.declineExtraQuote', 'requests.update'],
  ['sto.reassignMaster', 'work_orders.assign'],
  ['sto.unassignMaster', 'work_orders.assign'],
  ['stoBays.assign', 'work_orders.assign'],
  ['stoBays.release', 'work_orders.assign'],
  ['partsRequest.saveOffer', 'requests.respond'],
  ['chats.create', 'chats.use'],
  ['chats.supportOpen', 'chats.use'],
  ['masterWall.getMine', 'profile.read'],
  ['masterWall.save', 'profile.manage'],
  ['masterWall.delete', 'profile.manage'],
  ['masterPosts.getMine', 'profile.read'],
  ['masterPosts.save', 'profile.manage'],
  ['masterPosts.delete', 'profile.manage'],
  ['masterMetrics.getMine', 'profile.read'],
  ['master.saveProfile', 'profile.manage'],
  ['master.saveGeo', 'profile.manage'],
  ['stoExchange.getLeads', 'work_orders.read'],
  ['stoExchange.acceptLead', 'work_orders.assign'],
  ['stoExchange.assignOrderMaster', 'work_orders.assign'],
  ['stoExchange.hideLead', 'work_orders.assign'],
];

for (const pair of mappings) {
  const action = pair[0], capability = pair[1];
  const token = "case '" + action + "':";
  const at = db.indexOf(token);
  assert(at >= 0, 'action missing: ' + action);
  const lineEnd = db.indexOf('\n', at);
  const line = db.slice(at, lineEnd < 0 ? db.length : lineEnd);
  assert(policy.includes("'" + action + "' => ['POST','" + capability + "'"),
    action + ' policy must require ' + capability);
  assert(!/kareta_require_(?:any_)?role\s*\(/.test(line),
    action + ' still uses direct role gate');
  assert(!/kareta_require_api_capability\s*\(/.test(line),
    action + ' capability must be centralized in domains/capability_dispatch.php');
}

for (const spec of [
  ['news.mine', 'GET', 'profile.read', 1],
  ['news.save', 'POST', 'profile.manage', 2],
  ['news.delete', 'POST', 'profile.manage', 2],
]) {
  const label = spec[0], method = spec[1], capability = spec[2], minDispatches = spec[3];
  assert(policy.includes("'" + label + "' => ['" + method + "','" + capability + "'"),
    label + ' policy migration incomplete');
  const functionToken = label.replace('.', '_');
  const hits = (db.match(new RegExp(functionToken, 'g')) || []).length;
  assert(hits >= minDispatches, label + ' dispatch count too low: ' + hits + '/' + minDispatches);
}
assert(db.includes("kareta_require_migrated_business_capability($pdo,(string)$action,'GET')"),
  'GET capability dispatch guard missing');
assert(db.includes("kareta_require_migrated_business_capability($pdo,$action,'POST')"),
  'POST capability dispatch guard missing');

console.log(
  'LEGACY_ROLE_BUDGET_84_109: PASS ' +
  'total=' + total + '/' + budget.total + ' baseline=' + before.total + ' ' +
  'db=' + dbCount + '/' + budget.db + ' baselineDb=' + before.db + ' ' +
  'migrated=40 files=' + Object.keys(counts).length
);
