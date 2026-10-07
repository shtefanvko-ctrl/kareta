#!/usr/bin/env node
'use strict';

const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const bridge = read('js/mobile_native_bridge.js');
const scanner = read('js/next/pages/scanner.js');
const diagnostics = read('js/next/pages/diagnostics.js');
const cabinet = read('js/next/pages/cabinet.js');

function must(text, token, label) {
  if (!text.includes(token)) throw new Error(label + ': missing ' + token);
}
function mustNot(text, token, label) {
  if (text.includes(token)) throw new Error(label + ': stale contract remains: ' + token);
}

must(bridge, 'const MIN_NATIVE_API_VERSION = 6;', 'bridge');
must(bridge, 'const CAPABILITY_BY_COMMAND = Object.freeze({', 'bridge');
must(bridge, 'function probeNative()', 'bridge');
must(bridge, 'const info = await probeNative();', 'bridge');
must(bridge, 'KARETA_NATIVE_API_UNSUPPORTED', 'bridge');
must(bridge, 'KARETA_NATIVE_CAPABILITY_UNAVAILABLE', 'bridge');
must(bridge, 'ready: () => probeNative()', 'bridge');

const webCommands = [...bridge.matchAll(/call\("([^"]+)"/g)].map(match => match[1]);
const expectedCommands = [
  'requestPermission','getLocation','openMap','ping','appInfo','network','pushToken',
  'registerPush','unregisterPush','logout','pickImage','takePhoto','pickContact',
  'scanCode','actionSheet','elmStatus','elmDevices','elmConnect','elmReconnectLast',
  'elmDisconnect','elmInit','elmCommand','elmSnapshot','elmLiveSnapshot',
  'openBluetoothSettings','offlineState','offlineEnqueue','offlineDrain',
  'offlineAcknowledge','offlineRestore','offlineClear','share','copy','openPhone',
  'openExternal','openSettings','vibrate','reload','openRoute'
];
const missingCommands = expectedCommands.filter(command => !webCommands.includes(command));
if (missingCommands.length) throw new Error('bridge: missing Native API 6 commands: ' + missingCommands.join(', '));

must(scanner, 'await mobile.scanQr()', 'scanner');
must(scanner, 'const reader = await detector();', 'scanner');
if (scanner.indexOf('await mobile.scanQr()') > scanner.indexOf('const reader = await detector();')) {
  throw new Error('scanner: browser detector runs before native QR scanner');
}

must(cabinet, 'data-vehicle-scan-vin', 'garage');
must(cabinet, 'await mobile.scanVin()', 'garage');
must(cabinet, '/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)', 'garage');

must(diagnostics, "return {skipped:true,code:'VEHICLE_ID_REQUIRED'};", 'diagnostics');
must(diagnostics, "const eligible=items.filter(item=>queuedVehicleId(item)!=='');", 'diagnostics');
must(diagnostics, 'await mobile.offlineAcknowledge(eligible);', 'diagnostics');
must(diagnostics, 'старых локальных записей без vehicleId оставлены на устройстве', 'diagnostics');
mustNot(diagnostics, 'Диагностику можно выполнить без привязки.</p>', 'diagnostics');

console.log('SPA_ANDROID_BRIDGE_CONTRACT: PASS');
console.log(JSON.stringify({
  nativeApiMinimum: 6,
  webCommands: webCommands.length,
  nativeFirstQr: true,
  nativeVin: true,
  vehicleBoundObdSync: true
}, null, 2));
