'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const index=read('index.php');
const app=read('js/next/app_next.js');
const deps=read('js/next/runtime_dependencies.js');
const challenge=read('api/identity/challenge_service.php');
const auth=read('api/auth_session.php');
const gateway=read('api/onboarding_code.php');
const onboardingApi=read('js/next/onboarding/onboarding_api.js');
const role=read('js/next/onboarding/pages/role_page.js');
const logger=read('js/next/runtime_logger.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

// One reload owner, phase-aware watchdog, and no stale-worker forced navigation.
expect(index.includes('runtime health is phase-aware'),'phase-aware runtime watchdog missing');
expect(index.includes("['purging','worker-handoff','preflight','loading','offline-cache','recovering'].includes(phase)"),'atomic in-progress phases not protected from watchdog');
expect(index.includes("if(staleWorker)setPhase('worker-handoff','stale_service_worker_controller')"),'stale worker handoff marker missing');
expect(!index.includes("if(staleWorker)return recover('stale_service_worker_controller')"),'stale worker still forces full navigation');
expect((index.match(/__KARETA_BOOT_RECOVERY_IN_FLIGHT__/g)||[]).length>=2,'boot recovery single-flight lock missing');
expect(deps.includes('automaticReload:false')||deps.includes('if(window.__KARETA_BOOT_RECOVERY_IN_FLIGHT__)return false'),'dependency failure contract missing');

const registerBlock=(app.match(/async function registerCurrentServiceWorker\(\)\{([\s\S]*?)\n  \}\n\n  let bootPromise/)||[])[1]||'';
expect(registerBlock.includes("'runtime.sw.controller_changed'")&&registerBlock.includes('reload:false'),'controller handoff logging missing');
expect(!registerBlock.includes('location.reload()'),'controllerchange still reloads the application');
const verifyBlock=(app.match(/async function verifyRuntimeVersion\(\)\{([\s\S]*?)\n  \}\n\n  let serviceWorkerRegistrationFlight/)||[])[1]||'';
expect(verifyBlock.includes('runtime.sw.handoff_pending'),'controller mismatch must become handoff, not recovery');
expect(!verifyBlock.includes("resetServiceWorkerRuntime('controller-app-mismatch'"),'controller mismatch still reloads page');

// OTP transport must explain *why* a webhook failed, without weakening prod security.
expect(challenge.includes('class KaretaOtpDeliveryException'),'typed OTP delivery diagnostics missing');
for(const marker of ['provider_not_configured','provider_dns','provider_connect','provider_tls','provider_timeout','provider_auth','provider_endpoint','provider_rejected_payload','provider_rate_limited','provider_unavailable'])expect(challenge.includes(marker),`OTP category missing: ${marker}`);
expect(challenge.includes("str_ends_with($host,'.example')"),'placeholder provider URL is not rejected');
expect(challenge.includes('X-Kareta-Delivery-Id'),'OTP delivery correlation/idempotency marker missing');
expect(challenge.includes('phoneHash=')&&!challenge.includes("'code='"),'safe provider diagnostics contract missing');
expect(auth.includes('kareta_challenge_http_status($error)')&&gateway.includes('kareta_challenge_http_status($error)'),'OTP gateways do not share status mapping');
expect(onboardingApi.includes('deliveryCategory')&&onboardingApi.includes('providerStatus'),'frontend loses provider failure category');
expect(onboardingApi.includes('Date.now() < Number(lastCodeFailure.until || 0)'),'API failure cooldown does not honor server retryAfter');
expect(role.includes('const existingCooldown = remainingSeconds(draft.read().otpResendAt)'),'initial request ignores retry cooldown');
expect(role.includes('startRequestCooldown'),'profile submit button has no visible cooldown');
expect(logger.includes('expectedOtpFailure')&&logger.includes("console.warn('[KARETA][otp.delivery]'"),'expected OTP transport errors still logged as application crashes');
expect(fs.existsSync(path.join(root,'tools/otp_provider_check.php')),'safe OTP provider checker missing');

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:7[0-9]|[89]\d|\d{3,})$/.test(va)&&vs===va,'84.70+ version mismatch');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
expect(manifest.files['index.php']===crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.php'))).digest('hex'),'Shell Freeze explicit boot exception hash is stale');

if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.70 boot single-pass + SW handoff + OTP root-cause diagnostics: OK');
