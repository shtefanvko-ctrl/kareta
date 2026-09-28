'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = message => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };

const targets = [
  'js/app.js',
  'js/modules.js',
  'js/rbac.js',
  'js/master_modals.js',
];

const directDbFetch = /fetch\s*\([^\r\n]*(?:\/)?api\/db\.php/gi;
const violations = [];
for (const rel of targets) {
  const source = read(rel);
  const matches = [...source.matchAll(directDbFetch)];
  for (const match of matches) violations.push(`${rel}:${match.index}`);
}
assert(violations.length === 0, 'direct api/db.php fetch remains: ' + violations.join(', '));

const api = read('js/next/api_client.js');
assert(/function\s+dbGet\s*\(/.test(api), 'dbGet() missing');
assert(/function\s+dbPost\s*\(/.test(api), 'dbPost() missing');
assert(/window\.KaretaApiClient\s*=\s*Object\.freeze\([\s\S]*?\bdbGet\s*,[\s\S]*?\bdbPost\s*,/.test(api), 'dbGet/dbPost not exported');
assert(/fetchOptions\.credentials\s*=\s*['"]same-origin['"]/.test(api), 'credentials are not centralized in API client');
assert(/requestId\s*=\s*String\(source\.requestId\|\|response\?\.headers\?\.get\?\.\(['"]x-kareta-request-id['"]\)/.test(api), 'requestId normalization missing');
assert(/if\s*\(result\.status\s*!==\s*429\)\s*return\s+result/.test(api), 'GET 429 retry gate missing');
assert(/const\s+transport\s*=\s*isDbRead\(url,\s*method\)\s*\?\s*executeDbRead/.test(api), 'DB read retry transport not centralized');
assert(/function\s+dbPost[\s\S]*?method\s*:\s*['"]POST['"][\s\S]*?dedupe\s*:\s*false/.test(api), 'dbPost mutation contract invalid');

const app = read('js/app.js');
assert(app.includes("api.dbPost('auth.verifyOtp'"), 'auth.verifyOtp not routed through API client');
assert(app.includes("api.dbGet('ping'"), 'DB ping not routed through API client');
assert(app.includes("api.dbGet('health'"), 'DB health not routed through API client');
assert(app.includes("api.dbPost('config.save'"), 'config.save not routed through API client');

const modules = read('js/modules.js');
assert(modules.includes("api.dbPost('users.getAll'"), 'users.getAll not routed through API client');
assert(!modules.includes("api.dbPost('users.setRole'"), 'modules duplicates users.setRole mutation');
assert(!modules.includes("api.dbPost('users.setActive'"), 'modules duplicates users.setActive mutation');

const rbac = read('js/rbac.js');
assert(rbac.includes("api.dbPost('users.setRole'"), 'RBAC role persistence not routed through API client');
assert(rbac.includes("api.dbPost('users.setActive'"), 'RBAC active persistence not routed through API client');

const modals = read('js/master_modals.js');
const profileCalls = (modals.match(/api\.dbPost\(['"]master\.saveProfile['"]/g) || []).length;
assert(profileCalls >= 2, 'master profile/availability mutations are not both routed through API client');
assert(!/window\.DB\._api\?\.\(['"]master\.saveProfile['"]/.test(modals), 'master.saveProfile still bypasses unified API client');

console.log('DIRECT_DB_API_CLIENT_84_109: PASS targets=4 directFetch=0 auth=central error=central retry=get429 requestId=central duplicateRoleWrites=0');
