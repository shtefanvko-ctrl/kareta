'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const spec = read('docs/design/KARETA_KFLOW_ONBOARDING_FULL_SPEC.md');
const commands = read('docs/design/KARETA_KFLOW_HTML_IMPLEMENTATION_COMMANDS.md');
const audit = read('docs/operations/KFLOW_ONBOARDING_DOCUMENTATION_AUDIT.md');
const runtimeCss = read('css/next/kflow_windows.css');
const welcomeCss = read('css/next/welcome_background.css');
const rolePage = read('js/next/onboarding/pages/role_page.js');

assert(spec.includes('Версия спецификации: 1.2'), 'Onboarding spec version mismatch');
assert(spec.includes('Основной интерфейсный шрифт: **Manrope**'), 'Spec must use Manrope');
assert(spec.includes('строго `50 px`'), 'Spec must preserve compact 50px fields');
assert(spec.includes('assets/onboarding/backgrounds/welcome/manifest.json'), 'Spec must use the existing welcome manifest');
assert(commands.includes('## 0. Команда для существующей сборки `188.5.5.6.84.8`'), 'Implementation command is not mapped to the current project');
assert(commands.includes('нижнее меню и shell-файлы не изменять'), 'Protected shell boundary is missing');
assert(commands.includes('поставочный ZIP формировать без `assets`'), 'No-assets delivery contract is missing');
assert(audit.includes('Горизонтальный планшет: две колонки | Реализовано'), 'Tablet wide-layout status is missing');
assert(audit.includes('ПК: широкая двухколоночная композиция | Реализовано'), 'Desktop wide-layout status is missing');

assert(runtimeCss.includes('font-family:"Manrope"'), 'Runtime font and documentation disagree');
assert(runtimeCss.includes('height:50px!important;min-height:50px!important;max-height:50px!important'), 'Runtime field height and documentation disagree');
assert(welcomeCss.includes('height:58px !important'), 'Runtime welcome CTA and documentation disagree');
assert(rolePage.includes('<h1>Добро<br>пожаловать!</h1>'), 'Runtime welcome copy and documentation disagree');

console.log('K-Flow onboarding documentation contract: OK');
