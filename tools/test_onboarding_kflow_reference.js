'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const role=read('js/next/onboarding/pages/role_page.js');
const css=read('css/next/onboarding_kflow_reference.css');
const reg=read('inc/asset_registry.php');
const form=read('js/next/onboarding/onboarding_form_ui.js');
const kflow=read('js/next/kflow_windows.js');
const version=read('inc/asset_version.php');
const sw=read('sw.js');
expect(reg.includes("'css/next/onboarding_kflow_reference.css'"),'reference CSS not registered');
expect(role.includes('<h1>Добро пожаловать!</h1>'),'welcome title mismatch');
expect(role.includes('Всё для автомобиля<br>в одном месте'),'welcome subtitle mismatch');
expect(role.includes('>Начать</button>'),'welcome CTA mismatch');
expect(role.includes("${roleBranch('master')}${roleBranch('client')}"),'role scene must contain only Master and Client branches');
expect(role.includes("master?'Оказываю услуги':'Ищу услуги'"),'role captions mismatch');
expect(role.includes('k-flow-otp--${codeLength}'),'dynamic OTP layout class missing');
expect(form.includes('placeholder="Ваше имя"'),'name placeholder mismatch');
expect(form.includes('placeholder="+7 (___) ___-__-__"'),'phone placeholder mismatch');
expect(kflow.includes('renderSteps'),'step renderer missing');
for(const token of [
  'min-height:100dvh!important',
  'font-family:Inter,-apple-system',
  'background:var(--kflow-ref-idle)!important',
  'background:var(--kflow-ref-orange)!important',
  'height:72px!important',
  'width:150px!important;height:220px!important',
  'height:60px!important;min-height:60px!important',
  'grid-template-columns:repeat(4,65px)!important',
  'height:76px!important',
  '.k-flow-code-test{display:none!important}',
  '@media(min-width:768px) and (max-width:899px)',
  '@media(min-width:900px)',
  '@media(min-width:1200px)',
  '@media(min-width:1600px)',
  'grid-template-columns:minmax(0,1fr) minmax(420px,1fr)!important',
  'background-position:center center!important;background-size:cover!important'
]) expect(css.includes(token),`reference CSS token missing: ${token}`);
expect(role.includes('k-flow-role-card-direction-wide'),'wide role direction marker missing');
expect(role.includes('k-flow-trust--wide')&&role.includes('k-flow-trust--mobile'),'responsive privacy blocks missing');
expect(role.includes('overlay.dataset.kflowStep')&&role.includes('overlay.dataset.step = step'),'K-Flow numeric step must coexist with lifecycle route step');
expect(css.includes('#onb2-step-role .k-flow-role-grid::before')&&css.includes('content:none!important'),'legacy role neighbor peeks must be disabled');
expect(css.includes('#onb2-step-role .k-flow-role-card-direction-wide{display:none!important}')&&css.includes('display:grid!important;place-items:center!important'),'wide role arrows contract missing');
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav'),'onboarding CSS must not target frozen shell');
const current=(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/.exec(version)||[])[1]||'';
expect(/^188\.5\.5\.6\.84\.\d+$/.test(current),`unexpected short cache token ${current}`);
expect(sw.includes(`const RELEASE = '${current}';`),'service worker parity mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('Onboarding K-Flow reference 01–04: OK');
