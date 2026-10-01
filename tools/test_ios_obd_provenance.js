#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeBridge.swift'), 'utf8');
const obd = fs.readFileSync(path.join(root, 'api/obd.php'), 'utf8');
const diagnostics = fs.readFileSync(path.join(root, 'js/next/pages/diagnostics.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'api/migrations/134_obd_elm327_diagnostics.php'), 'utf8');

const checks = [
  {
    name: 'ios_offline_payload_provenance',
    pass: bridge.includes('itemPayload["source"] = "ios"')
      && bridge.includes('itemPayload["platform"] = "ios"')
  },
  {
    name: 'server_accepts_ios_source',
    pass: obd.includes("['android','ios','web']")
      && obd.includes("$payload['source'] ?? $payload['platform'] ?? 'android'")
      && /json_encode\(\$payload[\s\S]*?\$source,[\s\S]*?\$capturedAt/.test(obd)
  },
  {
    name: 'legacy_android_default_preserved',
    pass: obd.includes("?? 'android'")
      && obd.includes("$source = 'android'")
  },
  {
    name: 'ios_uuid_fits_existing_schema_without_migration',
    pass: migration.includes('adapter_address VARCHAR(32)')
      && obd.includes("if ($source === 'ios' && preg_match")
      && obd.includes("str_replace('-', '', strtolower($adapterAddress))")
      && obd.includes('substr($adapterAddress,0,32)')
  },
  {
    name: 'diagnostics_is_cross_platform',
    pass: diagnostics.includes('на iPhone — совместимые BLE-адаптеры')
      && diagnostics.includes("nativeChip.textContent='Нужно приложение'")
      && !diagnostics.includes("nativeChip.textContent='Только Android'")
      && !diagnostics.includes('сопряжение ELM327 в настройках Android')
  }
];

const failed = checks.filter(check => !check.pass);
console.log(JSON.stringify({ok: failed.length === 0, checks}, null, 2));
if (failed.length) process.exit(1);
