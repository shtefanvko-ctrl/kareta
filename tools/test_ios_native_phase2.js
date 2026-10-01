#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeBridge.swift'), 'utf8');
const services = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeServices.swift'), 'utf8');
const diagnostics = fs.readFileSync(path.join(root, 'js/next/pages/diagnostics.js'), 'utf8');

const checks = [
  {
    name: 'logout_server_endpoint',
    pass: bridge.includes('https://kareta.kz/api/auth_session.php')
      && bridge.includes('["action": "logout"]')
      && bridge.includes('serverRevoked')
  },
  {
    name: 'logout_uses_webview_cookie_store',
    pass: bridge.includes('websiteDataStore.httpCookieStore')
      && bridge.includes('HTTPCookie.requestHeaderFields')
  },
  {
    name: 'offline_drain_is_non_destructive',
    pass: /func drain\(\) -> \[String: Any\][\s\S]*?return \["items": loadUnlocked\(\)\]/.test(services)
      && !/func drain\(\) -> \[String: Any\][\s\S]*?saveUnlocked\(/.test(
        services.match(/func drain\(\)[\s\S]*?\n    }/)?.[0] || ''
      )
  },
  {
    name: 'offline_ack_removes_by_id',
    pass: services.includes('ids.contains(id)')
      && services.includes('try saveUnlocked(items)')
  },
  {
    name: 'diagnostics_ack_after_server_sync',
    pass: diagnostics.indexOf("fetch('/api/obd.php?action=sync'") >= 0
      && diagnostics.indexOf('await mobile.offlineAcknowledge(items)') >
        diagnostics.indexOf("fetch('/api/obd.php?action=sync'")
  },
  {
    name: 'media_native_services',
    pass: services.includes('PHPickerViewController')
      && services.includes('UIImagePickerController')
      && bridge.includes('case "pickImage"')
      && bridge.includes('case "takePhoto"')
  },
  {
    name: 'location_native_service',
    pass: services.includes('CLLocationManager')
      && bridge.includes('case "getLocation"')
      && bridge.includes('case "requestPermission"')
  }
];

const failed = checks.filter(check => !check.pass);

console.log(JSON.stringify({
  ok: failed.length === 0,
  checks
}, null, 2));

if (failed.length) process.exit(1);
