'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const roleAccess = read('js/next/role_access.js');
const dynamicNav = read('js/next/dynamic_navigation.js');
const navCore = read('js/next/navigation_core.js');
const request = read('js/next/pages/request.js');
const accountWindow = read('js/next/account_window.js');
const rbac = read('js/rbac.js');
const security = read('js/security.js');
const lifecycle = read('js/order_lifecycle.js');
const orders = read('js/orders.js');
const modules = read('js/modules.js');
const db = read('api/db.php');

// Active production navigation: authenticated authorization must be capability-driven.
assert(roleAccess.includes("function authorizationSource(){ return identityActive() ? 'identity-capabilities' : 'server'; }"),
  'role_access authorization source metadata missing');
assert(roleAccess.includes("rolePolicy:'ui-only'"),
  'role_access must declare rolePolicy ui-only');
assert(roleAccess.includes("if (identityActive()) return dynamic()?.canAccess?.(key) === true;"),
  'Identity route access must delegate to dynamic capability navigation');
assert(roleAccess.includes("function uiCanAccess("),
  'legacy route role filtering must be explicitly UI-only');
assert(roleAccess.includes("function hasCapability(capability){ return identityActive() && window.KaretaIdentity?.has?.(capability)===true; }"),
  'frontend capability helper must use Identity capabilities');
assert(dynamicNav.includes("const rawHas = capability => window.KaretaIdentity?.has?.(capability) === true;"),
  'dynamic navigation must use Identity capability source');
assert(dynamicNav.includes("if (item.any?.length && !item.any.some(has)) return false;"),
  'dynamic navigation any-capability gate missing');
assert(navCore.includes("if (window.KaretaIdentity?.has?.('*') === true) return 'admin';"),
  'admin context must be capability-derived when Identity is authenticated');
assert(navCore.includes("navigation.canAccess("),
  'navigation core must resolve routes through capability navigation');

// Active request flow: privileged service-offer data path must not be selected by role.
assert(request.includes("const canManageServices=window.KaretaRoleAccess?.hasCapability?.('services.manage')===true;"),
  'request service management path must use services.manage capability');
assert(!request.includes("(role==='master'||role==='sto')&&window.KaretaServiceOffersApi"),
  'request service data path still trusts frontend role');

// Account tariff role is intentionally presentation-only.
assert(accountWindow.includes("const metrics=role==='master'?"),
  'tariff role UI presentation contract unexpectedly changed');

// Legacy compatibility runtime: role can shape UI, but not authorize.
assert(rbac.includes("const PERM_CAPABILITIES = Object.freeze({"),
  'legacy RBAC capability adapter missing');
assert(rbac.includes("if(!identityAuthoritative()) return true;"),
  'legacy/no-Identity RBAC must defer authorization to server');
assert(rbac.includes("function uiCan(u,p)"),
  'role-level UI helper missing');
assert(rbac.includes("authorizationSource:'server/capabilities'"),
  'legacy RBAC must expose server/capability authority');
assert(rbac.includes("const server = await _persistRole(targetPhone, normalizedRole);"),
  'setRole must wait for server authorization');
assert(rbac.includes("const server = await _persistActive(targetPhone, Boolean(active));"),
  'setActive must wait for server authorization');
assert(!/function setRole\([^)]*\)[\s\S]{0,900}newLevel\s*>=\s*actorLevel/.test(rbac),
  'setRole still authorizes using role hierarchy');
assert(!/function setActive\([^)]*\)[\s\S]{0,500}atLeast\(/.test(rbac),
  'setActive still authorizes using role hierarchy');

assert(security.includes("authorizationSource:'server/capabilities'"),
  'security guard must declare server/capability authority');
assert(!security.includes('targetLevel >= actorLevel'),
  'security guard still denies by frontend role hierarchy');

// Lifecycle roles are UI metadata; backend decides mutations.
assert(lifecycle.includes('function uiCanTransition('),
  'lifecycle UI transition helper missing');
assert(lifecycle.includes("authorizationSource:'server/capabilities'"),
  'lifecycle mutation contract must be server authoritative');
assert(!lifecycle.includes('backendRoles:'),
  'lifecycle still labels frontend roles as backend authorization');
assert(lifecycle.includes('uiRoles:'),
  'lifecycle UI role metadata missing');

// PII visibility follows server masking, never browser role.
for (const [name, text] of [['orders',orders],['modules',modules]]) {
  assert(text.includes('dispatchLocked === true') && text.includes('dispatch_locked'),
    name + ' must honor server dispatch lock for PII');
}
assert(db.includes("$o['dispatchLocked'] = !empty($o['dispatch_locked']);"),
  'backend formatted order must expose dispatchLocked');
assert(db.includes("$row['dispatch_locked'] = 1;"),
  'backend dispatch mask must mark locked personal data');

// No active Next privileged data-path may use the removed master/STO role predicate.
const activeForbidden = [
  "(role==='master'||role==='sto')&&window.KaretaServiceOffersApi",
];
for (const token of activeForbidden) {
  assert(!request.includes(token), 'active Next role security predicate remains: ' + token);
}

console.log(
  'FRONTEND_ROLE_AUTHORIZATION_84_109: PASS ' +
  'rolePolicy=ui-only authorization=server/capabilities ' +
  'identityRoutes=capabilities requestServices=capability pii=server-mask lifecycle=server'
);
