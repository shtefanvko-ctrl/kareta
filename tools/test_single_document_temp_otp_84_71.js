'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),challenge=read('api/identity/challenge_service.php'),index=read('index.php');
const deps=read('js/next/runtime_dependencies.js'),app=read('js/next/app_next.js'),preloader=read('js/next/app_preloader.js'),sw=read('sw.js');
const asset=read('inc/asset_version.php');
// Temporary OTP bridge: exact 0000, production-only commissioning mode, manually disabled when provider is ready.
expect(config.includes("'otp_temp_static_until',\n        ''")||config.includes("'otp_temp_static_until',\r\n        ''"),'temporary OTP manual-off deadline default missing');
expect(config.includes("KARETA_OTP_TEMP_STATIC_ENABLED")&&config.includes("$kareta_otp_temp_static_enabled"),'temporary OTP manual-off switch missing');
expect(config.includes("$kareta_otp_transport = 'test_static'")&&config.includes("$kareta_otp_test_code = '0000'"),'temporary production 0000 not enabled');
expect(config.includes("$kareta_otp_transport = 'webhook'")&&config.includes("$kareta_otp_temp_static_active"),'temporary OTP does not retain fail-closed webhook fallback');
expect(challenge.includes("if($this->temporaryStaticMode())return 'test_static'"),'production challenge service ignores temporary static bridge');
expect(challenge.includes("$this->productionMode() && !$this->temporaryStaticMode()"),'static code guard is too broad or too weak');
expect(config.includes("$kareta_account_type_approval_mode = 'admin_review'"),'role approval production lock regressed');
// No automatic full-document recovery: failure stays in current document.
const headRecover=(index.match(/const recover = async reason => \{([\s\S]*?)\n      \};\n      window\.KaretaBootRecovery/)||[])[1]||'';
expect(headRecover.includes("runtime.failed")&&headRecover.includes('renderBootFailure'),'head recovery does not fail in place');
expect(!headRecover.includes('location.replace')&&!headRecover.includes('location.reload'),'head recovery still auto-navigates');
const atomicRecover=(index.match(/async function recover\(reason\)\{([\s\S]*?)\n      \}\n\n      async function fetchManifestOnce/)||[])[1]||'';
expect(atomicRecover.includes('automaticReload:false'),'atomic failure missing no-reload contract');
expect(!atomicRecover.includes('location.replace')&&!atomicRecover.includes('location.reload'),'atomic recovery still auto-navigates');
expect(index.includes('kareta_retry=${Date.now()}')||index.includes('kareta_retry=${Date.now()}`'),'network script retry missing');
expect(deps.includes("log('failure'")&&deps.includes('automaticReload:false'),'dependency failure still treated as auto recovery');
expect(!deps.includes("url.searchParams.set('kareta_recovery'"),'dependency layer still builds automatic reload URL');
expect(preloader.includes('KaretaBootRecovery?.retry'),'Retry button bypasses explicit manual recovery path');
expect(app.includes('registerCurrentServiceWorker().catch(()=>null);')&&app.includes('setTimeout'),'SW reconciliation is not detached from visible boot');
expect(!app.match(/await registerCurrentServiceWorker\(\)/),'visible boot still waits for SW registration');
expect(sw.includes("const SHELL_URLS = ['/manifest.json'];"),'SW install still fetches duplicate document shells');
expect(!sw.includes('onclick="location.reload()"'),'SW offline fallback still contains inline reload');
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:7[1-9]|[89]\d|\d{3,})$/.test(va)&&vs===va,'84.71+ version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.71+ single-document boot + temporary manual-off OTP 0000: OK');
