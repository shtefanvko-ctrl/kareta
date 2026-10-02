'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const version=read('inc/asset_version.php');
const sw=read('sw.js');
const current=JSON.parse(read('docs/release/current.json'));
const index=read('index.php');
const verify=read('.github/workflows/verify.yml');

const release=(version.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const swRelease=(sw.match(/const RELEASE = '([^']+)'/)||[])[1]||'';

const releaseRevision=Number(String(release).split('.').pop()||0);
expect(/^188\\.5\\.5\\.6\\.84\\.\\d+$/.test(release)&&releaseRevision>=152,'84.152+ asset token missing');
expect(swRelease===release,'84.152+ service worker token mismatch');
expect(current.release===release,'84.152+ release metadata mismatch');
expect(typeof current.sourceBranch==='string'&&current.sourceBranch.length>0,'current source branch missing');
expect(/^NOT_VERIFIED_AFTER_84_\\d+$/.test(String(current.verification?.stagingStatus||'')),'staging verification state must remain explicit before deploy');
expect(current.branchState?.reconciliationMergeCommit==='a7df986cee0d1e05895bbb93290dbc03111b9dac','reconciliation merge SHA mismatch');
expect(current.branchState?.mainHeadAtReconciliation==='d2873bbde16ec985ad14e8ff892df5ccbd7cf3b4','current main SHA mismatch');
expect(current.branchState?.candidate84_151==='6685ad9e02531dfa653aacd1f1eaf1c7c5a4cecc','84.151 candidate SHA mismatch');
expect(current.branchState?.mainAncestor===true&&Number(current.branchState?.behindBy)===0,'candidate must contain current main');
expect(index.includes('/assets/onboarding/backgrounds/welcome/city-calm/city-calm-mobile.png'),'city-calm preloader lost');
expect(index.includes('http_response_code(404);'),'runtime 404 contract lost');
expect(verify.includes('test_webview_logout_garage_84_151.js'),'84.151 WebView gate missing');
expect(verify.includes('test_android_native_api6_contract_84_148.js'),'Native API 6 gate missing');

console.log('RECONCILIATION_84_152: PASS baseline=84.152 current='+release);
