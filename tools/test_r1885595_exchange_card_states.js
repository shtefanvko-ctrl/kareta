const fs=require('fs');
const js=fs.readFileSync('js/next/pages/work_feed.js','utf8');
const css=fs.readFileSync('css/next/app_next.css','utf8');
const r71=js.includes("MASTER_UI_R71_CONTRACT='R188.5.5.6.71'");
const css71=r71?fs.readFileSync('css/next/master_ui_exchange_schedule_flattening.css','utf8'):'';
const checks={
  'semantic card state':js.includes("const cardState=accepted?'won':responded?'responded':urgent?'urgent':'normal'"),
  'state labels':r71?js.includes("accepted?'Принята':responded?'Отклик отправлен':urgent?'Срочная':'Новая'"):js.includes("accepted?'Выиграна':responded?'Вы откликнулись':urgent?'Срочная заявка':'Новая заявка'"),
  'state data marker':js.includes('data-exchange-card-state="${cardState}"'),
  'inline semantic icons':r71?(js.includes("function exchangeStateIcon(cardState)")&&js.includes("uiSvg('car')")&&js.includes("uiSvg('services')")):(js.includes("function exchangeCardIcon(name)")&&js.includes("vehicle:'<svg")&&js.includes("service:'<svg")),
  'vehicle icon':r71?js.includes("uiSvg('car')"):js.includes("exchangeCardIcon('vehicle')"),
  'service icon':r71?js.includes("uiSvg('services')"):js.includes("exchangeCardIcon('service')"),
  'state colors mobile':css.includes('.k-exchange-card--dispatch.is-urgent::before')&&css.includes('.k-exchange-card--dispatch.is-responded::before')&&css.includes('.k-exchange-card--dispatch.is-won::before'),
  'one row quick response':r71?css71.includes('.k-exchange-quick-response--r71'):css.includes('@media(min-width:390px) and (max-width:700px)')&&css.includes('grid-template-columns:minmax(92px,1fr) minmax(110px,1fr) auto!important'),
  'narrow fallback':r71?css71.includes('@media(max-width:480px)'):css.includes('@media(max-width:389px)')&&css.includes('.k-exchange-quick-response>button{grid-column:1/-1!important}'),
  'desktop untouched by state colors':css.indexOf('.k-exchange-card--dispatch.is-urgent{border-color:#fed7aa')>css.indexOf('@media(max-width:700px)'),
};
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
if(bad.length){console.error('FAIL '+bad.join(', '));process.exit(1)}
console.log('OK R188.5.5.6.35 exchange card visual states');
