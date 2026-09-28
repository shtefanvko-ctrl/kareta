'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php');
const challenge=read('api/identity/challenge_service.php');
const context=read('api/identity/context_service.php');
const communityApi=read('js/next/community/community_api.js');
const communityState=read('js/next/community/community_state.js');
const communityPage=read('js/next/pages/community.js');
const profile=read('js/next/pages/profile_relations.js');
const registry=read('inc/asset_registry.php');
const manifest=read('asset_manifest.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

expect(config.includes("$kareta_is_production ? 'admin_review' : 'test_auto'"),'production approval default must be admin_review');
expect(config.includes("$kareta_otp_transport = 'webhook'")&&config.includes("$kareta_otp_test_code = ''")&&config.includes('$kareta_otp_allow_test_fallback = false'),'production OTP config lock missing');
expect((challenge.includes("throw new DomainException('otp_delivery_unavailable')")||challenge.includes("KaretaOtpDeliveryException('otp_delivery_unavailable'"))&&challenge.includes('productionMode()'),'OTP delivery must fail closed in production');
expect(context.includes("KARETA_ENVIRONMENT')?KARETA_ENVIRONMENT:'production')==='production')return 'admin_review'"),'context approval must force admin_review in production');

try{
  const php=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'config.php'))}; echo KARETA_ENVIRONMENT,"|",KARETA_ACCOUNT_TYPE_APPROVAL_MODE,"|",KARETA_OTP["transport"],"|",KARETA_OTP["test_code"],"|",(KARETA_OTP["allow_test_fallback"]?"1":"0");`],{env:{...process.env,KARETA_ENVIRONMENT:'production',KARETA_ACCOUNT_TYPE_APPROVAL_MODE:'test_auto',KARETA_OTP_TRANSPORT:'test_static',KARETA_OTP_TEST_CODE:'0000',KARETA_OTP_ALLOW_TEST_FALLBACK:'1'},encoding:'utf8'}).trim();
  const temporaryCommissioning=config.includes('otp_temp_static_until')&&config.includes("$kareta_otp_test_code = '0000'");
  const expected=temporaryCommissioning?'production|admin_review|test_static|0000|0':'production|admin_review|webhook||0';
  expect(php===expected,`production config override failed: ${php}`);
}catch(e){fail.push(`production config probe failed: ${e.message}`);}

for(const [name,source] of [['community_api',communityApi],['community_state',communityState],['community_page',communityPage],['profile_relations',profile]])expect(!source.includes('localStorage'),`${name} must not use localStorage`);
expect(communityApi.includes('function mockRows(){if(isProduction())return[]'),'production mockRows guard missing');
expect(communityApi.includes("function getGroups(){return isProduction()?[]"),'production development-group guard missing');
expect(communityApi.includes('getFollowingMasters')&&communityApi.includes('serverCity'),'server-backed subscriptions/nearby missing');
expect(communityPage.includes("if(api.isProduction?.())")&&communityPage.includes('community-story-publish'),'production unsupported Community action guard missing');
expect(!profile.includes('Алексей Моторин')&&!profile.includes('demoPublic')&&!profile.includes('kareta.profile.relations.v1'),'fake public profile persistence remains');
expect(profile.includes("getProviderDetail?.('master'")&&profile.includes("getProviderDetail?.('sto'")&&profile.includes('getStoreDetail?.'),'public profiles must resolve through server APIs');
expect(profile.includes('updateMasterSocial')&&profile.includes('updateStoSocial'),'profile following must use backend social APIs');

expect(fs.existsSync(path.join(root,'css/next/client_runtime_consolidated.css')),'consolidated client CSS missing');
const stylesBlock=(registry.match(/'styles'\s*=>\s*\[(.*?)\],\s*'scripts'/s)||[])[1]||'';
expect(stylesBlock.includes("'css/next/client_runtime_consolidated.css'")||stylesBlock.includes("'css/runtime_boot_bundle.css'"),'consolidated/boot CSS not globally registered');
for(const old of ['client_width_guard.css','client_mobile_geometry.css','client_viewport_layers.css','request_5_steps.css','client_legacy_surface_modernization.css','client_surface_modernization_phase2.css','client_surface_modernization_phase3.css','client_work_order_v2.css'])expect(!stylesBlock.includes(`'css/next/${old}'`),`old client layer still globally loaded: ${old}`);
expect(registry.includes('function kareta_route_asset_plan()')&&registry.includes("'community' =>")&&registry.includes("'profile' =>")&&registry.includes("'request' =>"),'route asset plan missing');
expect(manifest.includes("'routeBundles'")&&manifest.includes("'assetMetrics'"),'asset manifest route metadata missing');
try{
  const probe=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo count($r['styles']).'|'.count($r['scripts']).'|'.count($r['scriptSources']??$r['scripts']);`],{encoding:'utf8'}).trim();
  const [styles,scripts,sourceScripts]=probe.split('|').map(Number);expect(styles<=111&&styles>=1,`unexpected global style count after further consolidation: ${styles}`);expect(scripts>=1&&scripts<=130,`unexpected boot script request count ${scripts}`);expect(sourceScripts>=70&&sourceScripts<=130,`unexpected eager source-module count ${sourceScripts}`);
}catch(e){fail.push(`asset registry probe failed: ${e.message}`);}

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1],vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:6[5-9]|[7-9]\d|\d{3,})$/.test(va)&&vs===va,'84.65+ version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.65 production stabilization: OK');
