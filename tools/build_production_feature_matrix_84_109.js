'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const release = '188.5.5.6.84.109';
const source = fs.readFileSync(path.join(root, 'js/next/route_registry.js'), 'utf8');
const sandbox = { window:{}, location:{ hash:'#/home' }, console };
vm.runInNewContext(source, sandbox, { filename:'route_registry.js' });
const registry = sandbox.window.KaretaRouteRegistry;
if (!registry?.routes) throw new Error('route registry unavailable');

const S = Object.freeze({
  READY:'READY',
  BETA:'BETA',
  DISABLED:'DISABLED',
  INTERNAL:'INTERNAL',
});

const status = Object.freeze({
  home:S.READY,
  platform:S.BETA,
  corePlatform:S.INTERNAL,
  calendarBooking:S.BETA,
  finance:S.BETA,
  market:S.BETA,
  crm:S.BETA,
  identityMigration:S.INTERNAL,
  adminUsers:S.INTERNAL,
  adminOrganizations:S.INTERNAL,
  adminMonitoring:S.INTERNAL,
  adminManagement:S.INTERNAL,
  services:S.READY,
  news:S.DISABLED,
  masterNews:S.BETA,
  masterNewsCreate:S.BETA,
  masterNewsEdit:S.BETA,
  works:S.READY,
  profile:S.READY,
  following:S.READY,
  realWorks:S.READY,
  workDetail:S.READY,
  serviceManagement:S.READY,
  masters:S.READY,
  masterOnboarding:S.READY,
  masterDashboard:S.READY,
  masterSchedule:S.READY,
  masterProfileOwner:S.READY,
  masterWallOwner:S.READY,
  masterWorks:S.READY,
  masterReviews:S.READY,
  masterExchange:S.READY,
  community:S.READY,
  stoDashboard:S.BETA,
  parts:S.BETA,
  usedParts:S.BETA,
  seller:S.BETA,
  sellerProducts:S.BETA,
  sellerOrders:S.BETA,
  orders:S.READY,
  workflow:S.INTERNAL,
  requestNew:S.READY,
  workOrder:S.READY,
  vehicle:S.READY,
  chats:S.READY,
  notifications:S.INTERNAL,
  cabinet:S.READY,
  cabinetGarage:S.READY,
  cabinetData:S.INTERNAL,
  cabinetHistory:S.READY,
  cabinetDocuments:S.INTERNAL,
  cabinetPromos:S.BETA,
  cabinetTariff:S.INTERNAL,
  cabinetSettings:S.INTERNAL,
  about:S.READY,
  rules:S.READY,
  help:S.READY,
  assistant:S.BETA,
  privacy:S.READY,
  contacts:S.READY,
  lawyer:S.BETA,
  towTruck:S.BETA,
  productDetail:S.BETA,
  serviceDetail:S.READY,
  providerDetail:S.READY,
  providerBooking:S.READY,
  providerReviews:S.READY,
});
const notes = Object.freeze({
  platform:'Cross-domain platform search is implemented, but not yet covered by a complete staging E2E smoke.',
  corePlatform:'Architecture/domain-core inspection surface; not a public product feature.',
  calendarBooking:'Operational calendar/booking domain exists, but remains outside completed staging E2E coverage.',
  finance:'Operational finance CRUD/API exists; keep BETA until role/data/permission E2E is complete on staging.',
  market:'Warehouse/market operations exist; keep BETA until role/data/permission E2E is complete on staging.',
  crm:'CRM customer/notes flows exist; keep BETA until role/data/permission E2E is complete on staging.',
  identityMigration:'Administrative migration utility; never advertise as a customer feature.',
  adminUsers:'Administrative surface.',
  adminOrganizations:'Administrative surface.',
  adminMonitoring:'Administrative surface.',
  adminManagement:'Administrative surface.',
  news:'Standalone news route is intentionally replaced by Community/Works and aliases to #/works.',
  masterNews:'Legacy/master publishing surface retained while public news is consolidated into Community.',
  masterNewsCreate:'Master publishing work-dialog; keep BETA until consolidated publishing E2E is complete.',
  masterNewsEdit:'Master publishing work-dialog; keep BETA until consolidated publishing E2E is complete.',
  stoDashboard:'Large operational STO domain; functional UI exists but full staging role/data E2E is not complete.',
  parts:'Marketplace and used-parts flows are implemented, but Stage 6 found missing FULL assets on staging; do not call READY.',
  usedParts:'Used-parts listing CRUD exists; remains BETA with the Parts domain until staging E2E/assets pass.',
  seller:'Seller workplace CRUD exists; keep BETA until seller role/order/product E2E is complete on staging.',
  sellerProducts:'Seller product CRUD is implemented; keep BETA until staging E2E is complete.',
  sellerOrders:'Seller order workflow is implemented; keep BETA until staging E2E is complete.',
  workflow:'Workflow engine/inspection route; internal operational surface.',
  notifications:'Compatibility/deep-link fallback; notifications are surfaced through the shell, not a standalone production page.',
  cabinetData:'Compatibility deep link into account/cabinet windows; not a separate production module.',
  cabinetDocuments:'Compatibility deep link into account/cabinet windows; not a separate production module.',
  cabinetPromos:'User promotions surface exists but lacks completed staging E2E coverage.',
  cabinetTariff:'Compatibility deep link into account/cabinet windows; not a separate production module.',
  cabinetSettings:'Compatibility deep link into account/cabinet windows; not a separate production module.',
  assistant:'Current implementation is deterministic rule-based preliminary guidance, not a model-backed AI diagnostic system.',
  lawyer:'Uses the generic support-chat channel; dedicated legal-provider routing/availability is not proven on staging.',
  towTruck:'Uses support chat/geolocation handoff; dedicated tow-provider dispatch/availability is not proven on staging.',
  productDetail:'Product detail is tied to the Parts marketplace, which remains BETA until staging assets/E2E pass.',
});

const internalKeys = new Set(Object.entries(status).filter(([,v])=>v===S.INTERNAL).map(([k])=>k));
const rolePrefix = key => {
  if (key.startsWith('master') || key === 'serviceManagement') return 'master';
  if (key === 'stoDashboard' || ['finance','market','crm','calendarBooking'].includes(key)) return 'sto';
  if (key.startsWith('seller')) return 'seller';
  if (key.startsWith('admin') || key === 'identityMigration') return 'admin';
  return '';
};
const exposureFor = (key, row, state) => {
  if (state === S.DISABLED) return 'hidden-redirect';
  if (state === S.INTERNAL) return row.nav === false ? 'internal-deeplink' : 'internal-role-gated';
  const role = rolePrefix(key);
  return role ? `role:${role}` : 'public';
};

const modules = Object.entries(registry.routes).map(([key,row]) => {
  const state = status[key];
  if (!state) throw new Error(`missing status for route key: ${key}`);
  const surface = registry.surfaceForKey(key);
  const reason = notes[key] || (
    state === S.READY
      ? 'Active route with implemented runtime/page contract; no known unfinished flag in the production matrix.'
      : state === S.BETA
        ? 'Implemented but not promoted to READY until staging E2E and production-readiness evidence are complete.'
        : state === S.INTERNAL
          ? 'Internal/compatibility route; not a public production feature.'
          : 'Feature is intentionally disabled.'
  );
  return {
    key,
    path:row.path,
    label:row.label,
    status:state,
    surface,
    nav:row.nav !== false,
    exposure:exposureFor(key,row,state),
    betaBadgeRequired:state === S.BETA,
    publicReady:state === S.READY,
    reason,
  };
});
const summary = modules.reduce((acc,row)=>{
  acc[row.status]=(acc[row.status]||0)+1;
  return acc;
},{READY:0,BETA:0,DISABLED:0,INTERNAL:0});

const matrix = {
  schema:'kareta.production-feature-matrix.v1',
  release,
  generatedFrom:'js/next/route_registry.js',
  scope:'Every canonical route key is treated as one production feature module. Compatibility/deep-link routes remain explicit entries.',
  policy:{
    READY:'May be presented as production-ready without a beta marker.',
    BETA:'Implemented, but must be visibly marked/controlled as beta until its stated evidence gap is closed.',
    DISABLED:'Must not be presented as an active standalone feature; redirect/hide only.',
    INTERNAL:'Admin/engine/compatibility surface; must not be marketed as a public product feature.',
  },
  rules:[
    'Every route key must have exactly one status.',
    'No deep-link-fallback route may be READY.',
    'BETA routes require an explicit beta marker or controlled audience.',
    'DISABLED routes must not be exposed as standalone production navigation.',
    'INTERNAL routes must not be listed as public production features.',
    'Promotion to READY requires updating this matrix and passing its contract test.',
  ],
  summary:{ total:modules.length, ...summary },
  modules,
};

const out = path.join(root,'docs/qa/production_feature_matrix_84_109.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(matrix,null,2)+'\n');
const md = [
  '# KARETA.KZ — Production Feature Matrix — R188.5.5.6.84.109',
  '',
  'Статусы: **READY** — можно показывать как production-ready; **BETA** — только с явной beta-маркировкой/ограниченным доступом; **DISABLED** — не показывать как активный модуль; **INTERNAL** — служебный/совместимый контур.',
  '',
  `Итого: ${modules.length} модулей · READY ${summary.READY} · BETA ${summary.BETA} · DISABLED ${summary.DISABLED} · INTERNAL ${summary.INTERNAL}`,
  '',
  '| Route key | Path | Status | Exposure | Reason |',
  '|---|---|---|---|---|',
  ...modules.map(row=>`| ${row.key} | ${row.path} | **${row.status}** | ${row.exposure} | ${row.reason.replace(/\\|/g,'\\\\|')} |`),
  '',
  'Матрица генерируется из `js/next/route_registry.js`. Изменение route registry без обновления статусов блокируется тестом `tools/test_production_feature_matrix_84_109.js`.',
  ''
].join('\n');
fs.writeFileSync(path.join(root,'docs/qa/production_feature_matrix_84_109.md'),md);
console.log(`PRODUCTION_FEATURE_MATRIX_BUILD_84_109: OK total=${modules.length} READY=${summary.READY} BETA=${summary.BETA} DISABLED=${summary.DISABLED} INTERNAL=${summary.INTERNAL}`);
