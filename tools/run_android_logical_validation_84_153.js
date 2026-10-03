#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const cp=require('child_process');

const root=path.resolve(__dirname,'..');
const output=process.argv[2]||path.join(root,'artifacts','android-logical-84.153.json');
const exactSha=String(process.env.KARETA_SUBJECT_SHA||process.env.GITHUB_SHA||'').trim();

const checks=[
  ['native-api6','node',['tools/test_android_native_api6_contract_84_148.js']],
  ['two-account-logout-garage','node',['tools/test_webview_logout_garage_84_151.js']],
  ['first-vehicle-account-isolation','node',['tools/test_first_vehicle_account_isolation_84_151.js']],
  ['cabinet-session-isolation','node',['tools/test_cabinet_session_isolation_84_151.js']],
  ['route-session-preservation','node',['tools/test_r1885585_route_session_preservation.js']],
  ['tab-resume-route-authority','node',['tools/test_r1885588_tab_resume_route_authority.js']],
  ['master-route-revisit-cascade','node',['tools/test_android_logical_warm_route_84_153.js']],
  ['lazy-route-runtime','node',['tools/test_route_lazy_runtime_84_68.js']],
  ['route-loading-state','node',['tools/test_route_loading_state_84_109.js']]
];

const results=[];
let failed=false;
for(const [id,bin,args] of checks){
  const run=cp.spawnSync(bin,args,{cwd:root,encoding:'utf8'});
  const status=run.status===0?'PASS':'FAIL';
  if(status==='FAIL') failed=true;
  results.push({
    id,
    status,
    exitCode:run.status,
    stdout:String(run.stdout||'').trim(),
    stderr:String(run.stderr||'').trim()
  });
  process.stdout.write(`[${status}] ${id}\n`);
  if(run.stdout) process.stdout.write(run.stdout);
  if(run.stderr) process.stderr.write(run.stderr);
}

const report={
  schema:'kareta.android.logical-validation.v1',
  release:'188.5.5.6.84.153',
  subjectSha:exactSha||null,
  generatedAt:new Date().toISOString(),
  scope:{
    evidenceType:'logical-ci',
    physicalDevice:false,
    emulator:false,
    deployedStaging:false
  },
  logicalEvidence:{
    androidNativeApi6:results.find(x=>x.id==='native-api6')?.status||'NOT_RUN',
    twoAccountIsolation:[
      'two-account-logout-garage',
      'first-vehicle-account-isolation',
      'cabinet-session-isolation'
    ].every(id=>results.find(x=>x.id===id)?.status==='PASS')?'PASS':'FAIL',
    warmRouteTwoPassLogic:[
      'route-session-preservation',
      'tab-resume-route-authority',
      'master-route-revisit-cascade',
      'lazy-route-runtime',
      'route-loading-state'
    ].every(id=>results.find(x=>x.id===id)?.status==='PASS')?'PASS':'FAIL'
  },
  externalEvidence:{
    stagingExactRuntime:'NOT_RUN',
    deployedProvenance:'NOT_RUN',
    physicalAndroidTwoAccountSmoke:'NOT_RUN',
    physicalAndroidWarmRouteTwoPass:'NOT_RUN',
    androidWebViewVisualEvidence:'NOT_RUN'
  },
  harnessEligibility:{
    canSatisfyPhysicalAndroidRequirement:false,
    canReplaceExternalEvidence:false,
    note:'This report is supplementary logical evidence only. It must not be used as physical Android or deployed staging evidence.'
  },
  checks:results,
  status:failed?'FAIL':'PASS'
};

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('ANDROID_LOGICAL_VALIDATION_84_153:',report.status,'report='+path.relative(root,output));
process.exit(failed?1:0);
