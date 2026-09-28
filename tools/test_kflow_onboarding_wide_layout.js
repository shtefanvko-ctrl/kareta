'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const css = read('css/next/kflow_windows.css');
const welcome = read('css/next/welcome_background.css');
const role = read('js/next/onboarding/pages/role_page.js');
const qa = read('docs/operations/KFLOW_ONBOARDING_VIEWPORT_QA.md');
const version = read('inc/asset_version.php');
const sw = read('sw.js');

assert(version.includes("'188.5.5.6.84.14'"), 'Asset version mismatch');
assert(sw.includes("const RELEASE = '188.5.5.6.84.14';"), 'Service Worker version mismatch');
assert(css.includes('@media(min-width:701px) and (max-width:899px)'), 'Portrait tablet breakpoint missing');
assert(css.includes('@media(min-width:900px)'), 'Wide onboarding breakpoint missing');
assert(css.includes('grid-template-columns:minmax(240px,.85fr) minmax(360px,1.15fr)!important'), 'Two-column onboarding grid missing');
assert(css.includes('width:min(calc(100vw - 64px),1180px)!important'), '1180px desktop surface missing');
assert(css.includes('max-width:1280px!important'), '1280px wide desktop surface missing');
assert(css.includes('.k-flow-trust--intro{display:flex'), 'Wide privacy block missing');
assert(role.includes("trustHtml('k-flow-trust--intro')"), 'Profile intro privacy markup missing');
assert(welcome.includes('@media (min-width:701px) and (max-width:899px)'), 'Welcome portrait tablet breakpoint missing');
assert(welcome.includes('grid-template-columns:minmax(300px,38%) minmax(0,62%)'), 'Welcome wide hero grid missing');
assert(qa.includes('всего 20 комбинаций'), 'Viewport QA coverage is missing');
assert(qa.includes('documentOverflowX = false'), 'Viewport overflow result is missing');

for (const file of [
  'phone_390x844.png',
  'tablet_portrait_768x1024.png',
  'tablet_landscape_1024x768.png',
  'desktop_1440x900.png',
  'desktop_wide_1920x1080.png'
]) {
  assert(fs.existsSync(path.join(root, 'docs/previews/kflow_onboarding', file)), `Preview missing: ${file}`);
}

console.log('K-Flow onboarding wide-layout contract: OK');
