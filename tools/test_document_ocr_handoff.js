'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let role='client';
const memory=new Map();
const window={
  KaretaClientCabinetApi:{},
  KaretaNavigationCore:{interfaceRole:()=>role},
  KaretaIdentity:{snapshot:()=>({authenticated:false,account:{id:'sample-account'}})},
  addEventListener:()=>{},setTimeout:()=>0
};
const sandbox={window,Date,
  location:{hash:'#/cabinet/garage'},
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,val)=>memory.set(key,val),removeItem:key=>memory.delete(key)},
  sessionStorage:{getItem:()=>null,setItem:()=>{}}
};
vm.runInNewContext(fs.readFileSync('js/next/client/first_vehicle_flow.js','utf8'),sandbox);
const flow=window.KaretaFirstVehicleFlow;
assert.equal(typeof flow.offerDocumentPrefill,'function');
const fields={brandName:'Peugeot',modelName:'308',year:'2018',vin:'VF3LRHNYWJS123456',plateNumber:'777AAA01'};
assert.equal(flow.offerDocumentPrefill(fields),true);
assert.equal(memory.size,0,'OCR candidate must remain in memory until user opens wizard');
role='master';
assert.equal(flow.offerDocumentPrefill(fields),false,'non-client role must not receive a personal garage draft');
role='client';
assert.equal(flow.offerDocumentPrefill({vin:'123456789012345678'}),false,'overlong VIN must not be truncated and accepted');
assert.equal(flow.offerDocumentPrefill({year:'1940'}),false);
assert.equal(flow.offerDocumentPrefill({brandName:'Some unknown OCR text'}),false);
const cabinet=fs.readFileSync('js/next/pages/cabinet.js','utf8');
assert.match(cabinet,/fromRequest\|\|directFirstVehicle\|\|/,'existing garages must support scanner handoff');
const scanner=fs.readFileSync('js/next/pages/scanner.js','utf8');
assert.match(scanner,/KaretaDocumentOCR\.recognize\(files\)/);
assert.match(scanner,/data-doc-review-field/,'OCR review fields must be editable');
assert.match(scanner,/validateCandidate/,'review must validate before handoff');
assert.match(scanner,/revision\+\+;step=action/,'leave/retry must invalidate in-flight OCR');
assert.match(scanner,/root\.removeEventListener\('input',onReviewInput\)/,'destroy must remove review listener');

assert.match(scanner,/offerDocumentPrefill/);
assert.match(scanner,/button\('recognize',ocr\.run/);
console.log('PASS OCR handoff: client role, privacy, validation, existing-car garage and scanner integration');
