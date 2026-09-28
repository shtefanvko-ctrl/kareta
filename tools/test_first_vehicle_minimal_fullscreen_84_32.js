'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const flow = read('js/next/client/first_vehicle_flow.js');
const cabinet = read('js/next/pages/cabinet.js');
const notifications = read('js/next/pages/notifications.js');
const css = read('css/next/first_vehicle_flow.css');
const version = read('inc/asset_version.php');
const sw = read('sw.js');

const checks = [];
const expect = (name, ok) => {
  checks.push([name, Boolean(ok)]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
};

expect(
  'minimal flow has only 2 stages',
  flow.includes("['1','Старт']") &&
    flow.includes("['2','Автомобиль']") &&
    !flow.includes("['3','Гараж']") &&
    !flow.includes('Проверьте автомобиль')
);

expect(
  'old details window removed',
  !flow.includes('function details(draft)') &&
    !flow.includes('data-first-vehicle-form="details"') &&
    !flow.includes('validateDetails()') &&
    !flow.includes('syncDetails(')
);

expect(
  'basic flow is brand model year',
  flow.includes('name="brandName"') &&
    flow.includes('name="modelName"') &&
    flow.includes('name="year"')
);

expect(
  'new first vehicle omits advanced payload',
  flow.includes("vin:editing?draft.vin:''") &&
    flow.includes("plate:editing?draft.plateNumber:''") &&
    flow.includes("mileageKm:editing?Number(draft.mileage||0):0")
);

expect(
  'garage has advanced passport editor',
  cabinet.includes('data-vehicle-passport-form') &&
    cabinet.includes('name="vin"') &&
    cabinet.includes('name="plate"') &&
    cabinet.includes('name="mileageKm"') &&
    cabinet.includes('name="engineVolume"') &&
    cabinet.includes('name="fuelType"')
);

expect(
  'notification links directly to first vehicle',
  notifications.includes('Заполните ваш первый автомобиль') &&
    notifications.includes('#/cabinet/garage?firstVehicle=1') &&
    notifications.includes("actionLabel:'Заполнить авто'")
);

expect(
  'garage consumes direct notification link',
  cabinet.includes('firstVehicle=1') &&
    cabinet.includes('startStep:directFirstVehicle?2:1')
);

expect(
  'fullscreen root beats cabinet gutters',
  css.includes('html[data-user-role="client"] #k-page-outlet > .k-page.k-client-cabinet-page.k-first-vehicle-page') &&
    css.includes('max-width:none!important') &&
    css.includes('padding:0!important')
);

expect(
  'tablet and desktop K-Flow layouts',
  css.includes('@media(min-width:761px) and (max-width:1099px)') &&
    css.includes('@media(min-width:1100px)') &&
    css.includes('grid-template-columns:minmax(190px,260px)')
);

expect(
  'release bumped',
  version.includes('188.5.5.6.84.33') && sw.includes('188.5.5.6.84.33')
);

const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
