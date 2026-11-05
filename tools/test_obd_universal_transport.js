'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('js/next/pages/diagnostics.js');
const bridge=read('js/mobile_native_bridge.js');
const api=read('api/obd.php');
const css=read('css/next/diagnostics.css');
for(const f of ['js/next/pages/diagnostics.js','js/mobile_native_bridge.js']) {
  execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
}
for(const [name,marker] of Object.entries({
  classicBinding:'elmConnect: address',
  bleScanner:'elmScanBle: () => call("elmScanBle"',
  bleConnector:'elmConnectBle: address',
  wifiConnector:'elmConnectWifi: (host, port = 35000)',
  reconnect:'elmReconnectLast: ()',
  offlineQueue:'offlineAcknowledge: items',
}))assert(bridge.includes(marker),name+' missing from bridge');
for(const [name,marker] of Object.entries({
  scanButton:'data-obd-scan-ble',
  classicButton:'data-obd-devices',
  wifiConnect:'data-obd-wifi-connect',
  wifiHost:'data-obd-wifi-host',
  wifiPort:'data-obd-wifi-port',
  statusGuard:'status?.supportedTransports',
  wifiNetwork:'wifi_tcp',
  connectBle:'mobile.elmConnectBle(address)',
  connectWifi:'mobile.elmConnectWifi(parts[0],Number(parts[1]||35000))',
  acceptedAcks:'accepted.has(String(item?.id',
}))assert(ui.includes(marker),name+' missing from diagnostics UI');
assert(!ui.includes('await mobile.offlineAcknowledge(items);'),
  'Only server-accepted sync IDs may be removed');
assert(css.includes('.k-obd-wifi-connect'),
  'Responsive Wi-Fi controls require scoped CSS');
assert(api.includes("'transports'=>['bluetooth_classic_spp','ble_gatt','wifi_tcp']"),
  'Backend contract must advertise implemented transports');
assert(api.includes("'usbSupported'=>false"),
  'Unsupported USB must not be advertised as implemented');
console.log('ELM universal SPA Native API 6 + UI + backend contracts: PASS');
