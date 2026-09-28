'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const css = read('css/next/kflow_windows.css');
const request = read('js/next/pages/request.js');
const requestWindow = read('js/next/request_window.js');
const routes = read('js/next/route_registry.js');
const app = read('js/next/app_next.js');
const version = read('inc/asset_version.php');
const sw = read('sw.js');

assert(version.includes("'188.5.5.6.84.14'"), 'Asset version mismatch');
assert(sw.includes("const RELEASE = '188.5.5.6.84.14';"), 'Service Worker version mismatch');

for (const panel of ['vehicle-service', 'problem', 'conditions', 'review']) {
  assert(request.includes(`data-request-panel="${panel}"`), `Request panel missing: ${panel}`);
}
for (const oldPanel of ['data-request-panel="services"','data-request-panel="extras"','data-request-panel="schedule"','data-request-panel="confirm"']) {
  assert(!request.includes(oldPanel), `Legacy seven-step panel returned: ${oldPanel}`);
}
assert(request.includes("id: 'vehicle-service'") && request.includes("id: 'review'"), 'Four-step parent map missing');
assert(request.includes('aria-label="Шаг ${current + 1} из 4"'), 'Four-dot stepper contract missing');
assert(request.includes('assets/onboarding/kareta_logo_full.png'), 'Full brand logo missing');
assert(request.includes("view = 'success'") && request.includes('stepsHtml(3, true)'), 'Success must remain inside step four');
assert(request.includes('schemaVersion: 2') && request.includes('localStorage.setItem(REQUEST_DRAFT_KEY'), 'Versioned persistent draft missing');
assert(request.includes('customServices.push') && request.includes("source: 'custom'"), 'Custom service flow missing');
assert(request.includes('services.map(item => item.name).join') && request.includes('effectiveServices()'), 'Review does not preserve all services');
assert(request.includes('agreementAccepted: true') && request.includes('idempotencyKey: draft.idempotencyKey'), 'Validated idempotent payload missing');
assert(request.includes("response?.ok || !requestId") && request.includes('api.createOrder(payload, { idempotencyKey'), 'Application-level submit validation missing');

assert(css.includes('@media(max-width:599px)'), 'Phone breakpoint missing');
assert(css.includes('@media(min-width:600px) and (max-width:1023px)'), 'Tablet breakpoint missing');
assert(css.includes('@media(min-width:1024px)'), 'Desktop breakpoint missing');
assert(css.includes('width:min(100%,1180px)!important'), '1180px request container missing');
assert(css.includes('.k-request-layout--step1,.k-request-layout--step2{grid-template-columns:repeat(2,minmax(0,1fr))'), 'Two-column request composition missing');
assert(css.includes('height:50px;min-height:50px;max-height:50px'), 'Compact 50px field contract missing');
assert(css.includes('.k-request-primary,.k-request-secondary,.k-request-back-action,.k-request-location-action{min-height:52px'), '52px action contract missing');
assert(css.includes('bottom:calc(var(--existing-bottom-nav-height,72px) + env(safe-area-inset-bottom))'), 'Existing bottom navigation clearance missing');
assert(!css.includes('.k-request-flow .k-mobile-nav') && !css.includes('.k-request-flow #k-mobile-nav'), 'Request layer must not override bottom navigation');

assert(routes.includes("requestNew:Object.freeze({ path:'#/orders/new'"), 'Real request route is not registered');
assert(app.includes('requestNew:requestPages.renderRequest') && app.includes('requestNew:requestPages.mountRequest'), 'Real request route is not connected to render/mount');
assert(requestWindow.includes("matches=hash=>/^#\\/orders\\/new"), 'Request window route matcher missing');
assert(requestWindow.includes("currentRoute()==='requestNew'"), 'Direct deployed-route fallback missing');

console.log('K-Flow request wide-layout and real-route contract: OK');
