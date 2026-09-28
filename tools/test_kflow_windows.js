'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const registry=read('inc/asset_registry.php');
const css=read('css/next/kflow_windows.css');
const engine=read('js/next/kflow_windows.js');
const role=read('js/next/onboarding/pages/role_page.js');
const form=read('js/next/onboarding/onboarding_form_ui.js');
const request=read('js/next/pages/request.js');
const version=read('inc/asset_version.php');
const sw=read('sw.js');

assert(registry.includes("'css/next/kflow_windows.css'"),'K-Flow CSS is not registered');
assert(registry.includes("'js/next/kflow_windows.js'"),'K-Flow JS is not registered');
assert(!/['\"](?:css|js)\/[^'\"]*r188/i.test(registry),'Versioned public runtime asset detected');
assert(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.[0-9]+'/.test(version),'Unexpected short asset version');
const current=(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/.exec(version)||[])[1]||''; assert(sw.includes(`const RELEASE = '${current}';`),'Service Worker version mismatch');

assert(css.includes('--k-orange-brand:#FC6505'),'Logo orange token is missing');
assert(css.includes('width:28px;height:28px'),'28px K-Flow steps are missing');
assert(css.includes('height:52px'),'52px primary action is missing');
assert(css.includes('height:50px'),'50px field contract is missing');
assert(css.includes('100dvh'),'100dvh contract is missing');
assert(css.includes('max-width:342px'),'342px content contract is missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'Reduced-motion handling is missing');
assert(engine.includes('function bindOtp'),'OTP component is missing');
assert(engine.includes("enter:'left',leave:'right'"),'Master left branch animation is missing');
assert(engine.includes("enter:'right',leave:'left'"),'Client right branch animation is missing');

assert(role.includes("sharedModal('Кто вы?','Выберите, как будете пользоваться приложением'"),'Role window copy mismatch');
assert(role.includes("${roleBranch('master')}${roleBranch('client')}"),'Role window must contain exactly master/client branches');
assert(role.includes("master?'Оказываю услуги':'Ищу услуги'"),'Role descriptions mismatch');
assert(!role.includes('k-flow-role-direction')&&!role.includes('k-flow-direction-button'),'Removed second-screen role-direction controls returned');
assert(role.includes("sharedModal('Давайте познакомимся','Введите имя и номер телефона'"),'Profile window copy mismatch');
assert(role.includes("sharedModal('Подтвердите номер',subtitle"),'OTP window copy mismatch');
assert(role.includes('data-kflow-otp-cell'),'OTP cells are missing');
assert(role.includes("autocomplete=\"one-time-code\""),'OTP autocomplete is missing');
assert(role.includes('Отправить код повторно'),'OTP resend action is missing');
assert(role.includes('Изменить номер'),'Change-phone action is missing');
assert(form.includes('placeholder="Ваше имя"'),'Name placeholder mismatch');
assert(form.includes('placeholder="+7 (___) ___-__-__"'),'Phone mask placeholder mismatch');

const welcomeMatch=role.match(/  function welcomeStepHtml\(\)\{[\s\S]*?\n  \}\n\n  function roleStepHtml/);
assert(welcomeMatch,'Welcome function not found');
const welcome=welcomeMatch[0].replace(/\n\n  function roleStepHtml$/,'');
assert(welcome.includes('<h1>Добро пожаловать!</h1>'),'Welcome title must match K-Flow reference');
assert(welcome.includes('Всё для автомобиля<br>в одном месте'),'Welcome subtitle must match K-Flow reference');
assert(welcome.includes('>Начать</button>'),'Welcome CTA must be Начать');

for(const panel of ['vehicle','offer','schedule','problem','review']){
  assert(request.includes(`data-request-panel="${panel}"`),`Request K-Flow step missing: ${panel}`);
}
assert((request.match(/data-request-panel=/g)||[]).length===5,'Request must have exactly five user steps');
assert(!/data-step-index="[5-9]"/.test(request),'Request must not render a sixth user step');
assert(request.includes('${[1,2,3,4,5].map'),'Request progress must contain five round steps');
assert(request.includes('data-request-problem-choice="services"')&&request.includes('data-request-problem-choice="custom"'),'Problem mode switch is missing');
assert(request.includes('Выбрать услуги'),'Selected-services action is missing');
assert(request.includes('data-request-services-list'),'Selected-services state is missing');
assert(request.includes('data-request-media'),'Request media input is missing');
assert(request.includes('Фото и видео <span>(по желанию)</span>')&&request.includes('k-request-ref-add-media'),'Problem media guidance is missing');
assert(request.includes('data-request-offer-choice="exchange"'),'Master-offers mode is missing');
assert(request.includes('data-request-offer-choice="own_price"'),'Own-price offer mode is missing');
assert(request.includes('data-request-address'),'Field-service address is missing');
assert(request.includes("status:isExchange?'waiting_responses':'new'"),'Offer mode is not connected to existing order status contract');
assert(request.includes('data-request-open-created'),'Explicit result/open-order window is missing');
assert(!request.includes('setTimeout(()=>{window.KaretaRequestWindow?.close'),'Request still auto-closes after create');
assert(!/<select\b/i.test(request),'Legacy select returned to request flow');

console.log('K-Flow Windows contract: OK');
