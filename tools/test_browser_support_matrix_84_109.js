'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const matrixPath = path.join(root, 'docs/qa/browser_support_matrix_84_109.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };

assert(matrix.release === '188.5.5.6.84.109', 'release mismatch');
assert(matrix.schema === 'kareta.browser-support-matrix.v1', 'schema mismatch');

const ids = (matrix.targets || []).map(row => row.id);
const requiredIds = [
  'chrome_desktop',
  'edge_desktop',
  'safari_desktop',
  'firefox_desktop',
  'android_chrome',
  'ios_safari',
];
assert(JSON.stringify(ids) === JSON.stringify(requiredIds), 'supported target set/order mismatch');

const target = id => matrix.targets.find(row => row.id === id);
assert(Number(target('chrome_desktop').minimum.browser) >= 105, 'Chrome floor below CSS :has requirement');
assert(Number(target('edge_desktop').minimum.browser) >= 105, 'Edge floor below CSS :has requirement');
assert(Number(target('firefox_desktop').minimum.browser) >= 121, 'Firefox floor below CSS :has requirement');
assert(Number.parseFloat(target('safari_desktop').minimum.browser) >= 15.4, 'Safari floor below CSS :has/dialog requirement');
assert(Number(target('android_chrome').minimum.os) >= 10, 'Android OS floor below current Chrome support policy');
assert(Number(target('android_chrome').minimum.browser) >= 105, 'Android Chrome floor below CSS :has requirement');
assert(Number.parseFloat(target('ios_safari').minimum.os) >= 15.4, 'iOS floor below CSS :has/dialog requirement');
assert(Number.parseFloat(target('ios_safari').minimum.browser) >= 15.4, 'iOS Safari floor below CSS :has/dialog requirement');

const requiredSmoke = matrix.requiredSmoke || [];
assert(requiredSmoke.length >= 8, 'smoke contract is incomplete');
for (const row of matrix.targets) {
  const smoke = row.requiredSmoke || [];
  for (const check of requiredSmoke) {
    assert(smoke.includes(check), `${row.id} missing smoke check: ${check}`);
  }
}
const css = [
  read('css/next/app_next.css'),
  read('css/next/client_runtime_consolidated.css'),
  read('css/next/details.css'),
  read('css/onboarding_bundle.css'),
].join('\n');
const boot = [
  read('js/boot/runtime_core_bundle.js'),
  read('js/boot/runtime_shell_bundle.js'),
  read('js/boot/runtime_ui_bundle.js'),
].join('\n');

assert(css.includes(':has('), 'source no longer uses :has(); review support floor');
assert(boot.includes('showModal'), 'source no longer uses native dialog; review support floor');
assert(boot.includes('?.') && boot.includes('??'), 'modern JS syntax evidence missing');

console.log(
  'BROWSER_SUPPORT_MATRIX_84_109: PASS ' +
  'targets=6 chrome=105 edge=105 safari=15.4 firefox=121 android=10+/chrome105 ios=15.4'
);
