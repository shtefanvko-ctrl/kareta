#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeBridge.swift'), 'utf8');
const elm = fs.readFileSync(path.join(root, 'ios/KaretaIOS/NativeELM.swift'), 'utf8');
const project = fs.readFileSync(path.join(root, 'ios/project.yml'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'ios/bridge_contract.json'), 'utf8'));

const commands = [
  'elmStatus',
  'elmDevices',
  'elmConnect',
  'elmReconnectLast',
  'elmDisconnect',
  'elmInit',
  'elmCommand',
  'elmSnapshot',
  'elmLiveSnapshot'
];

const checks = [
  {
    name: 'all_elm_bridge_cases',
    pass: commands.every(command => bridge.includes(`case "${command}"`))
  },
  {
    name: 'all_elm_contracts_implemented',
    pass: commands.every(command => contract.commands[command] === 'implemented')
  },
  {
    name: 'corebluetooth_transport',
    pass: elm.includes('import CoreBluetooth')
      && elm.includes('CBCentralManager')
      && elm.includes('scanForPeripherals')
      && elm.includes('CBPeripheralDelegate')
  },
  {
    name: 'ios_uuid_address',
    pass: elm.includes('peripheral.identifier.uuidString')
      && elm.includes('UUID(uuidString: address)')
  },
  {
    name: 'serial_elm_prompt_protocol',
    pass: elm.includes('(request.command + "\\r")')
      && elm.includes('commandBuffer.contains(">")')
  },
  {
    name: 'elm_initialization_sequence',
    pass: ['ATZ','ATE0','ATL0','ATS0','ATH0','ATSP0','0100','ATDP']
      .every(command => elm.includes(`("${command}",`))
  },
  {
    name: 'snapshot_contract',
    pass: ['010C','010D','0105','ATRV','03','0902']
      .every(command => elm.includes(`("${command}",`))
      && elm.includes('"speedKph"')
      && elm.includes('"coolantC"')
      && elm.includes('"voltageV"')
      && elm.includes('"dtcCodes"')
  },
  {
    name: 'gatt_uart_same_service',
    pass: elm.includes('let localWrite = characteristics.first')
      && elm.includes('let localNotify = characteristics.first')
      && elm.includes('A UART transport must use a coherent GATT service')
  },
  {
    name: 'connect_has_native_timeout',
    pass: elm.includes('withTimeInterval: 12.0')
      && elm.includes('case connectTimeout')
      && elm.includes('BLE ELM connection timed out')
  },
  {
    name: 'bluetooth_permission_description',
    pass: project.includes('NSBluetoothAlwaysUsageDescription')
  },
  {
    name: 'no_android_mac_contract',
    pass: !elm.includes('MAC address')
      && !elm.includes('BluetoothAdapter')
      && !elm.includes('android.bluetooth')
  }
];

const failed = checks.filter(check => !check.pass);
console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
if (failed.length) process.exit(1);
