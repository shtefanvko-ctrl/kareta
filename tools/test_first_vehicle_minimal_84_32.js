const fs=require('fs');
const flow=fs.readFileSync('js/next/client/first_vehicle_flow.js','utf8');
const css=fs.readFileSync('css/next/first_vehicle_flow.css','utf8');
const notifications=fs.readFileSync('js/next/pages/notifications.js','utf8');
const version=fs.readFileSync('inc/asset_version.php','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(flow.includes("['1','Старт'],['2','Автомобиль'],['3','Гараж']"),'3-step minimal progress missing');
ok(!flow.includes('function details(draft)'),'legacy details window still present');
ok(!flow.includes('validateDetails'),'legacy details validation still present');
ok(!flow.includes('syncDetails'),'legacy details synchronization still present');
ok(flow.includes("document.documentElement.classList.add('k-first-vehicle-active')"),'fullscreen activation missing');
ok(css.includes('html.k-first-vehicle-active #k-shell-header'),'shell fullscreen rule missing');
ok(css.includes('.k-page.k-client-cabinet-page.k-first-vehicle-page'),'full-width first vehicle selector missing');
ok(notifications.includes('Заполните ваше первое авто'),'first vehicle notification missing');
ok(notifications.includes('data-first-vehicle-notification'),'first vehicle notification action missing');
ok(version.includes('188.5.5.6.84.32'),'84.32 asset version missing');
ok(sw.includes("const RELEASE = '188.5.5.6.84.32';"),'84.32 service worker release missing');
console.log('R188.5.5.6.84.32 first vehicle minimal/fullscreen: OK');
