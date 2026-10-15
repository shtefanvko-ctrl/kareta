'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bridge=fs.readFileSync('js/mobile_native_bridge.js','utf8');
assert.match(bridge,/recognizeDocumentImage:"documentOcr"/);
assert.match(bridge,/recognizeDocumentImage:.*call\("recognizeDocumentImage"/);
let closes=0,requests=[];
const win={
  KaretaFirstVehicleFlow:{CATALOG:[{name:'Peugeot',models:[{name:'308'}]}]},
  KaretaMobile:{available:()=>true,supports:cap=>cap==='documentOcr',
    recognizeDocumentImage:async(image,catalog)=>{
      assert.equal(image,'QUJD');
      requests.push(catalog);
      return {fields:requests.length===1?{brandName:'Peugeot',modelName:'308',vin:'VF3LRHNYWJS123456',owner:'PRIVATE'}:
        {year:'2018',plateNumber:'777AAA01',vin:'VF3LRHNYWJS123456',owner:'PRIVATE'}};}
  }
};
const sandbox={window:win,document:{createElement:()=>({getContext:()=>({drawImage:()=>{}}),toDataURL:()=> 'data:image/jpeg;base64,QUJD'})},createImageBitmap:async()=>({width:1000,height:700,close:()=>{closes++;}}),Date};
vm.runInNewContext(fs.readFileSync('js/next/document_ocr.js','utf8'),sandbox);
const ocr=win.KaretaDocumentOCR;
assert.equal(ocr.available(),true);
(async()=>{
  const result=await ocr.recognize({front:{},rear:{}});
  assert.equal(result.engine,'native-mlkit-latin');
  assert.equal(result.fields.brandName,'Peugeot');
  assert.equal(result.fields.modelName,'308');
  assert.equal(result.fields.vin,'VF3LRHNYWJS123456');
  assert.equal(result.fields.year,'2018');
  assert.equal(result.fields.plateNumber,'777AAA01');
  assert.equal(result.fields.owner,undefined);
  assert.equal(requests.length,2);assert.equal(closes,2);
  assert.equal(ocr.available(),true);
  win.KaretaMobile.supports=()=>false;
  assert.equal(ocr.available(),false,'API 6 without documentOcr must preserve manual fallback');
  console.log('PASS Android OCR bridge opt-in, two-sided merge, no raw owner data, bitmap disposal and API 6 fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
