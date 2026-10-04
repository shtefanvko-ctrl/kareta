'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const role = read('js/next/onboarding/pages/role_page.js');
const runtime = read('js/boot/runtime_onboarding_bundle.js');
const css = read('css/next/onboarding_kflow_reference.css');
const runtimeCss = read('css/runtime_boot_bundle.css');

const checks = [
  ['welcome city question', role.includes('Ваш город?')],
  ['canonical city select', role.includes('data-welcome-city-select')],
  ['find me action', role.includes('data-action="welcome-find-me"')],
  ['automatic welcome geolocation', role.includes("if (step === 'welcome') locateWelcomeCity(false)")],
  ['fresh retry ignores cached coordinates', role.includes('maximumAge:force ? 0 : 900000')],
  ['fresh retry prefers detected city', role.includes('preferDetectedCity:force')],
  ['manual city writes canonical draft', role.includes("patchCity(city, 'manual')") && role.includes('cityName:normalized')],
  ['runtime JS synchronized', runtime.includes('data-action="welcome-find-me"') && runtime.includes("patchCity(city, 'manual')")],
  ['source CSS contains city controls', css.includes('.onb2-welcome-city-select') && css.includes('.onb2-welcome-find-me')],
  ['runtime CSS synchronized', runtimeCss.includes('.onb2-welcome-city-select') && runtimeCss.includes('.onb2-welcome-find-me')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error('FAIL', name);
  process.exit(1);
}

for (const [name] of checks) console.log('PASS', name);
