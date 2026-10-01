#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeBridge.swift'), 'utf8');
const push = fs.readFileSync(path.join(root, 'ios/KaretaIOS/PushNotifications.swift'), 'utf8');
const project = fs.readFileSync(path.join(root, 'ios/project.yml'), 'utf8');
const registerApi = fs.readFileSync(path.join(root, 'api/mobile_push.php'), 'utf8');
const sendApi = fs.readFileSync(path.join(root, 'api/mobile_push_send.php'), 'utf8');
const authApi = fs.readFileSync(path.join(root, 'api/auth_session.php'), 'utf8');

const checks = [
  {
    name: 'native_apns_registration',
    pass: push.includes('registerForRemoteNotifications()')
      && push.includes('didRegisterForRemoteNotificationsWithDeviceToken')
      && project.includes('aps-environment')
  },
  {
    name: 'native_token_server_sync',
    pass: bridge.includes('api/mobile_push.php?action=\\(action)')
      && bridge.includes('"platform": "ios"')
      && bridge.includes('pushTokenDidUpdate')
      && bridge.includes('identifierForVendor')
  },
  {
    name: 'server_registration_is_platform_aware',
    pass: registerApi.includes("['android','ios']")
      && registerApi.includes("$body['platform'] ?? 'android'")
      && registerApi.includes('$deviceId,$platform,$appVersion')
      && !registerApi.includes("$deviceId,'android',$appVersion")
  },
  {
    name: 'apns_token_never_sent_to_fcm',
    pass: sendApi.includes("if ($platform === 'ios')")
      && sendApi.includes('$iosPending++')
      && sendApi.indexOf("if ($platform === 'ios')") <
        sendApi.indexOf('kareta_fcm_send(' , sendApi.indexOf('foreach ($devices'))
  },
  {
    name: 'logout_disables_only_current_push_token',
    pass: bridge.includes('logoutBody["pushToken"] = token')
      && authApi.includes("hash('sha256', $pushToken)")
      && authApi.includes('WHERE account_id=? AND token_hash=?')
      && authApi.includes("'pushDisabled' => $pushDisabled")
  }
];

const failed = checks.filter(check => !check.pass);
console.log(JSON.stringify({ok: failed.length === 0, checks}, null, 2));
if (failed.length) process.exit(1);
