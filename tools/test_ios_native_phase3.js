#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeBridge.swift'), 'utf8');
const scanner = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeScanner.swift'), 'utf8');
const push = fs.readFileSync(path.join(root, 'ios/KaretaIOS/PushNotifications.swift'), 'utf8');
const app = fs.readFileSync(path.join(root, 'ios/KaretaIOS/KaretaApp.swift'), 'utf8');
const services = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeServices.swift'), 'utf8');

const checks = [
  {
    name: 'scanner_qr',
    pass: scanner.includes('DataScannerViewController')
      && scanner.includes('.barcode(symbologies: [.qr])')
      && bridge.includes('case "scanCode"')
  },
  {
    name: 'scanner_vin',
    pass: scanner.includes('[A-HJ-NPR-Z0-9]{17}')
      && scanner.includes('"vin": vin')
  },
  {
    name: 'scanner_camera_permission',
    pass: bridge.includes('Camera permission is required for scanning')
      && bridge.includes('NativePermissionService.requestCamera')
  },
  {
    name: 'push_app_delegate',
    pass: push.includes('didRegisterForRemoteNotificationsWithDeviceToken')
      && push.includes('didFailToRegisterForRemoteNotificationsWithError')
      && app.includes('@UIApplicationDelegateAdaptor(KaretaAppDelegate.self)')
  },
  {
    name: 'push_timeout_safe',
    pass: push.includes('getNotificationSettings')
      && push.includes('"authorizationPending": true')
      && push.includes('registerForRemoteNotifications()')
  },
  {
    name: 'contact_picker',
    pass: services.includes('CNContactPickerViewController')
      && bridge.includes('case "pickContact"')
  },
  {
    name: 'action_sheet',
    pass: bridge.includes('case "actionSheet"')
      && bridge.includes('UIAlertController')
      && bridge.includes('popoverPresentationController')
  }
];

const failed = checks.filter(check => !check.pass);

console.log(JSON.stringify({
  ok: failed.length === 0,
  checks
}, null, 2));

if (failed.length) process.exit(1);
