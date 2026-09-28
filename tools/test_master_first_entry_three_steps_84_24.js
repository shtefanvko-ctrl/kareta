'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(ok,msg)=>{if(!ok)fail.push(msg)};
const page=read('js/next/pages/master_onboarding.js');
const gate=read('js/next/master_onboarding_gate.js');
const api=read('api/master_onboarding.php');
const bridge=read('api/identity/onboarding_identity_bridge.php');
const postAuth=read('js/next/onboarding/post_auth_first_entry_resolver.js');
const mig=read('api/migrations/131_master_first_entry_three_steps.php');
const config=read('config.php');
const version=read('inc/asset_version.php');
const boot=read('index.php');

expect(page.includes('[1,2,3].map')&&!page.includes('[1,2,3,4].map'),'MASTER stepper must render exactly 3 parent circles');
expect(page.includes('Настройка профиля мастера: 3 шага'),'MASTER 3-step accessible label missing');
for(const title of ['Расскажите о себе','Выберите услуги','Где вы работаете?'])expect(page.includes(title),'missing parent step title '+title);
expect(page.includes('Проверьте профиль')&&page.includes('function isReviewView()'),'review must exist as an internal view');
expect(page.includes("return {step:3,view:'review'}")&&page.includes("rawStep>=4||rawView==='review'||rawView==='master-review'"),'legacy step 4 URL/draft must normalize to step 3 review');
expect(page.includes("Number(step)===1?'profile':Number(step)===2?'services':'work-place'")&&!page.includes("['','profile','services','work-place','review']"),'review must not be a fourth parent view');
expect(page.includes("from<3")&&page.includes("model.draft.currentStep=3;model.draft.currentView='review'"),'step 3 Continue must enter review without creating step 4');
expect(page.includes("if(isReviewView()){complete();return;}")&&page.includes("if(isReviewView()){model.draft.currentStep=3;model.draft.currentView='work-place'"),'review submit/back contract missing');
expect(page.includes("model.draft.returnTarget='review'")&&page.includes("model.draft.returnTarget=null"),'review sectional edit return target missing');
expect(page.includes("agreementError?'review':viewForStep(step)"),'agreement validation must stay on step 3 review');

expect(gate.includes('Math.min(3')&&gate.includes("state.step=3;state.view='review'")&&!gate.includes('Math.min(4'),'MASTER gate must own only steps 1..3');
expect(api.includes('function kmob_normalize_navigation')&&api.includes("if($step>=4||in_array($rawView,['review','master-review'],true))return [3,'master-review']"),'API legacy navigation normalizer missing');
expect(api.includes("SET status='completed',current_step=3,current_view='master-review'")&&!api.includes("SET status='completed',current_step=4"),'completion must persist step 3 review');
expect(api.includes("[$step,$view]=kmob_normalize_navigation")&&api.includes("$draft['currentStep']=$step"),'saveDraft must normalize to 3-step model');
expect(bridge.includes('$review=$rawStep>=4')&&bridge.includes('$step=$review?3:max(1,min(3,$rawStep))'),'Identity bridge must normalize legacy step 4');
expect(postAuth.includes('const review=rawStep>=4')&&postAuth.includes('const step=review?3:Math.max(1,Math.min(3,rawStep))'),'PostAuth resolver must normalize legacy step 4');
expect(mig.includes("'version' => 131")&&mig.includes('current_step=3')&&mig.includes("'$.currentView','review'"),'migration 131 normalization missing');
expect((()=>{const m=/KARETA_DB_VERSION',\s*(\d+)/.exec(config);return m&&Number(m[1])>=131})(),'DB version must be 131+');
expect(/188\.5\.5\.6\.84\.(2[4-9]|[3-9]\d|\d{3,})/.test(version),'asset version must be 84.24+');
expect(boot.includes("url.searchParams.delete('kareta_boot')"),'successful atomic boot must remove stale kareta_boot query token');
if(fail.length){console.error(fail.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log('MASTER First Entry 84.24: 3 parent steps + review inside step 3 + legacy step4 normalization OK');
