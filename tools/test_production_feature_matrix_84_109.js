'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const matrixPath = path.join(root, 'docs/qa/production_feature_matrix_84_109.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const routeSource = fs.readFileSync(path.join(root,'js/next/route_registry.js'),'utf8');
const sandbox = { window:{}, location:{hash:'#/home'}, console };
vm.runInNewContext(routeSource,sandbox,{filename:'route_registry.js'});
const registry = sandbox.window.KaretaRouteRegistry;

const fail = message => { throw new Error(message); };
const assert = (value,message) => { if (!value) fail(message); };
const allowed = new Set(['READY','BETA','DISABLED','INTERNAL']);

assert(matrix.schema === 'kareta.production-feature-matrix.v1','schema mismatch');
assert(matrix.release === '188.5.5.6.84.109','release mismatch');
assert(Array.isArray(matrix.modules),'modules missing');

const routeEntries = Object.entries(registry.routes);
assert(routeEntries.length === 67,'unexpected route count: '+routeEntries.length);
assert(matrix.modules.length === routeEntries.length,'matrix must cover every route key');

const byKey = new Map(matrix.modules.map(row=>[row.key,row]));
assert(byKey.size === matrix.modules.length,'duplicate matrix key');
for (const [key,route] of routeEntries) {
  const row = byKey.get(key);
  assert(row,'missing module: '+key);
  assert(row.path === route.path,'path drift for '+key);
  assert(row.label === route.label,'label drift for '+key);
  assert(allowed.has(row.status),'invalid status for '+key+': '+row.status);
  assert(typeof row.reason === 'string' && row.reason.trim().length >= 12,'reason missing for '+key);
  assert(row.surface === registry.surfaceForKey(key),'surface drift for '+key);
  assert(row.publicReady === (row.status === 'READY'),'publicReady mismatch for '+key);
  assert(row.betaBadgeRequired === (row.status === 'BETA'),'beta badge mismatch for '+key);
  if (row.surface === 'deep-link-fallback') assert(row.status !== 'READY','deep-link fallback cannot be READY: '+key);
  if (row.status === 'DISABLED') assert(row.exposure === 'hidden-redirect','disabled exposure mismatch: '+key);
  if (row.status === 'INTERNAL') assert(!row.publicReady,'internal cannot be publicReady: '+key);
}
const requiredInternal = [
  'corePlatform','identityMigration','adminUsers','adminOrganizations',
  'adminMonitoring','adminManagement','workflow','notifications',
  'cabinetData','cabinetDocuments','cabinetTariff','cabinetSettings'
];
for (const key of requiredInternal) {
  assert(byKey.get(key)?.status === 'INTERNAL',key+' must remain INTERNAL until explicitly promoted');
}

const requiredBeta = [
  'platform','calendarBooking','finance','market','crm',
  'masterNews','masterNewsCreate','masterNewsEdit','stoDashboard',
  'parts','usedParts','seller','sellerProducts','sellerOrders',
  'cabinetPromos','assistant','lawyer','towTruck','productDetail'
];
for (const key of requiredBeta) {
  assert(byKey.get(key)?.status === 'BETA',key+' must remain BETA until its evidence gap is closed');
}

assert(byKey.get('news')?.status === 'DISABLED','standalone news route must remain DISABLED');
assert(byKey.get('news')?.path === '#/news','news route identity drift');

const counts = matrix.modules.reduce((acc,row)=>{
  acc[row.status]=(acc[row.status]||0)+1;
  return acc;
},{READY:0,BETA:0,DISABLED:0,INTERNAL:0});
for (const state of allowed) {
  assert(matrix.summary?.[state] === counts[state],'summary mismatch: '+state);
}
assert(matrix.summary?.total === matrix.modules.length,'summary total mismatch');
assert(counts.READY === 35 && counts.BETA === 19 && counts.DISABLED === 1 && counts.INTERNAL === 12,
  'baseline counts changed: '+JSON.stringify(counts));

console.log('PRODUCTION_FEATURE_MATRIX_84_109: PASS total='+matrix.modules.length+' READY='+counts.READY+' BETA='+counts.BETA+' DISABLED='+counts.DISABLED+' INTERNAL='+counts.INTERNAL);
