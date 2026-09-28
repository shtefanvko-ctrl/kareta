#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.php'),catalog=read('inc/error_codes.php'),clientError=read('api/client_error.php');
const css=read('css/next/app_preloader.css')+'\n'+read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php'),sw=read('sw.js'),gate=read('tools/release_gate.php');
const fail=[];const expect=(ok,label)=>{if(!ok)fail.push(label);};
for(const code of ['KRT-BOOT-1001','KRT-BOOT-1002','KRT-BOOT-1003','KRT-BOOT-1004','KRT-BOOT-1005','KRT-BOOT-1006','KRT-BOOT-1007','KRT-BOOT-1008','KRT-BOOT-1009','KRT-BOOT-1010','KRT-BOOT-1099'])expect(catalog.includes(code),`missing catalog code ${code}`);
expect(index.includes("require_once __DIR__ . '/inc/error_codes.php'"),'index does not load canonical error catalog');
expect(index.includes('data-preloader-version')&&index.includes('Версия <?= htmlspecialchars($assetVersion'),'boot screen does not render server asset version');
expect(index.includes('data-preloader-error-code hidden'),'error code is not hidden before failure');
expect(index.includes('window.KaretaBootDiagnostics')&&index.includes('resolveErrorCode'),'early boot diagnostics API missing');
expect(index.includes("navigator.sendBeacon?.('/api/client_error.php'")&&index.includes('errorCode,context:\'application_start\''),'boot failure is not reported with public code');
expect(clientError.includes("'errorCode'=>")&&clientError.includes("'context'=>"),'client error log omits code/context');
expect(css.includes('.k-app-preloader__diagnostics')&&css.includes('.k-app-preloader__error-code'),'preloader diagnostics styling missing');
const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
const sv=(sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
expect(Number(av)>=89,'asset version .84.89+ missing');
expect(Number(sv)>=89&&sv===av,'service worker release .84.89+ parity missing');
expect(gate.includes("'84.89' => 'tools/test_boot_error_codes_84_89.js'"),'release gate does not run .84.89 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.89] Visible boot version + stable error codes regression passed.');
