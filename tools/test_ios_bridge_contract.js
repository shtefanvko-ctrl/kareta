#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridgeJs = fs.readFileSync(path.join(root, 'js/mobile_native_bridge.js'), 'utf8');
const nativeSwift = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeBridge.swift'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'ios/bridge_contract.json'), 'utf8'));

const emitted = new Set(
  [...bridgeJs.matchAll(/\bcall\("([^"]+)"/g)].map(match => match[1])
);

const declared = new Set(Object.keys(contract.commands || {}));
const swiftCases = new Set(
  [...nativeSwift.matchAll(/case\s+"([^"]+)"/g)].map(match => match[1])
);

const missingContract = [...emitted].filter(command => !declared.has(command));
const staleContract = [...declared].filter(command => !emitted.has(command));

const mustHaveCase = Object.entries(contract.commands || {})
  .filter(([, status]) => ['implemented', 'degraded', 'stub'].includes(status))
  .map(([command]) => command);

const missingSwiftCase = mustHaveCase.filter(command => !swiftCases.has(command));

if (missingContract.length || staleContract.length || missingSwiftCase.length) {
  console.error(JSON.stringify({
    ok: false,
    missingContract,
    staleContract,
    missingSwiftCase
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  emittedCommands: emitted.size,
  declaredCommands: declared.size,
  nativeCasesRequired: mustHaveCase.length,
  pendingCommands: Object.values(contract.commands).filter(v => v === 'pending').length
}, null, 2));
