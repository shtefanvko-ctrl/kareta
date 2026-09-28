'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const loader=read('js/next/route_asset_loader.js');
const challenge=read('api/identity/challenge_service.php');
const auth=read('api/auth_session.php');
const logger=read('js/next/runtime_logger.js');
const api=read('js/next/onboarding/onboarding_api.js');
const role=read('js/next/onboarding/pages/role_page.js');
const asset=read('inc/asset_version.php'), sw=read('sw.js');
const eagerJs=(registry.match(/'scripts'\s*=>\s*\[([\s\S]*?)\],\s*'images'/)||[])[1]||'';
const eagerCss=(registry.match(/'styles'\s*=>\s*\[([\s\S]*?)\],\s*'scripts'/)||[])[1]||'';

expect(challenge.includes('DELETE FROM auth_challenges WHERE challenge_key=?'),'failed OTP challenge must be deleted');
expect(challenge.includes('Invalidate older codes only after the replacement code was actually delivered'),'previous OTP must survive provider delivery failure');
expect(challenge.includes("otp_delivery_failed')return")&&challenge.includes('KaretaOtpDeliveryException'),'provider failure retry hint missing');
expect(auth.includes('kareta_challenge_http_status($error)')&&challenge.includes("if($code==='otp_delivery_failed')return 502")&&challenge.includes("if($code==='otp_delivery_unavailable')return 503"),'OTP provider HTTP status mapping missing');
expect(logger.includes('DATABASE_FAILURE_CODES')&&!logger.includes("responseMeta.error === 'database_unavailable' || response.status === 503"),'arbitrary 503 must not trigger DB diagnostics');
expect(logger.includes("if(!dbReady) console.error(`[KARETA][DB FAILURE]"),'ready database must not be logged as DB FAILURE');
expect(role.includes("Number(error?.retryAfter || 0) > 0"),'OTP UI must honor any server retryAfter');
expect(role.includes("expectedOtpError?console.warn:console.error"),'expected OTP failures should be warnings');
expect(api.includes("deliveryRetry = code === 'otp_delivery_failed'")&&api.includes("expectedOtpError=['otp_delivery_failed','otp_delivery_unavailable','challenge_rate_limited']"),'clean OTP operational error handling missing');
expect(loader.includes("source:'route_asset_loader'")&&loader.includes('bootPending:true'),'frozen-index watchdog compatibility bridge missing');

const waveJs=['js/next/platform_search.js','js/next/core/domain_model.js','js/next/core/event_bus.js','js/next/core/state_manager.js','js/next/core/domain_repository.js','js/next/pages/platform.js','js/next/pages/core_platform.js','js/next/pages/calendar_booking.js','js/next/pages/finance.js','js/next/pages/market.js','js/next/pages/crm.js','js/next/pages/assistant.js'];
for(const f of waveJs){expect(registry.includes(`'${f}'`),`route plan missing ${f}`);expect(!eagerJs.includes(`'${f}'`),`wave4 JS remains eager ${f}`)}
const waveCss=['css/next/platform.css','css/next/core_platform.css','css/next/calendar_booking.css','css/next/finance.css','css/next/market.css','css/next/crm.css'];
for(const f of waveCss){expect(registry.includes(`'${f}'`),`route plan missing ${f}`);expect(!eagerCss.includes(`'${f}'`),`wave4 CSS remains eager ${f}`)}
for(const b of ['platformSuite','corePlatform','calendarBooking','financeDomain','marketDomain','crmDomain','assistantDomain'])expect(registry.includes(`'${b}' => [`),`wave4 bundle missing ${b}`);
for(const k of ['platform','corePlatform','calendarBooking','finance','market','crm','assistant'])expect(loader.includes(`'${k}'`),`loader key missing ${k}`);
expect(/'mode' => 'route-lazy-v[45]'/.test(registry)&&(registry.includes("'cssMode' => 'route-domain-css-v2'")||registry.includes("'cssMode' => 'boot-css-bundle-v1'")||registry.includes("'cssMode' => 'critical-boot-route-css-v2'")),'wave4+ metadata missing');

try{
 const out=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo json_encode(['bootJs'=>count($r['scripts']),'sourceJs'=>count($r['scriptSources']??$r['scripts']),'eagerCss'=>count($r['styles']),'lazyJs'=>count(kareta_route_asset_paths('scripts')),'lazyCss'=>count(kareta_route_asset_paths('styles'))]);`],{encoding:'utf8'}).trim();
 const d=JSON.parse(out); expect(d.sourceJs===72,`expected 72 eager source modules, got ${d.sourceJs}`);expect(d.bootJs>=1&&d.bootJs<=72,`unexpected boot JS request count ${d.bootJs}`);expect([1,84].includes(d.eagerCss),`expected historical 84 eager CSS or consolidated 1 boot bundle, got ${d.eagerCss}`);expect(d.lazyJs===59||d.lazyJs===60,`unexpected lazy JS count ${d.lazyJs}`);expect(d.lazyCss>=31,`expected at least 31 lazy CSS, got ${d.lazyCss}`);
}catch(e){fail.push(`registry probe failed: ${e.message}`)}
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];expect(/^188\.5\.5\.6\.84\.(?:69|[7-9]\d|\d{3,})$/.test(va)&&vs===va,'84.69+ version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.69 runtime cleanup + route lazy wave 4: OK');
