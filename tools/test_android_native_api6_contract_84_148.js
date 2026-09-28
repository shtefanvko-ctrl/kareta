'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const obd=read('api/obd.php');
const bridge=read('js/mobile_native_bridge.js');
const diagnostics=read('js/next/pages/diagnostics.js');

expect(obd.includes("'nativeApiVersion'=>6"),'OBD API is not Native API 6');
for(const cmd of ["'ATI'","'ATDP'","'0100'"]){
  expect(obd.includes(cmd),'OBD API 6 command missing: '+cmd);
}
expect(!obd.includes('CREATE TABLE IF NOT EXISTS obd_diagnostic_sessions'),'OBD runtime DDL returned; schema must remain migration-owned');

expect(bridge.includes('offlineAcknowledge'),'native bridge durable offline acknowledgement missing');
expect(bridge.includes('error.code = code'),'native bridge structured error code missing');
expect(bridge.includes('elmConnect: address => call("elmConnect", { address }, 30000)'),'ELM connect timeout is not API 6 contract');
expect(bridge.includes('elmInit: () => call("elmInit", {}, 30000)'),'ELM init timeout is not API 6 contract');

expect(diagnostics.includes('setDiagnosticReady'),'diagnostics does not separate adapter connected from ECU ready');
expect(diagnostics.includes('mobile.offlineAcknowledge(items)'),'diagnostics does not durably acknowledge synced offline items');
expect(diagnostics.includes('status.lastError'),'diagnostics does not expose native adapter readiness errors');

console.log('ANDROID_NATIVE_API6_84_148: PASS');
