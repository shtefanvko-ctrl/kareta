const fs=require('fs');
const js=fs.readFileSync('js/next/pages/work_feed.js','utf8');
const css=fs.readFileSync('css/next/app_next.css','utf8');
const r71=js.includes("MASTER_UI_R71_CONTRACT='R188.5.5.6.71'");
const css71=r71?fs.readFileSync('css/next/master_ui_exchange_schedule_flattening.css','utf8'):'';
const checks={
  'mobile short tab label':js.includes('k-exchange-tab-label--mobile">Отклики'),
  'primary facts':r71?(js.includes('k-exchange-r71-facts')&&js.includes('Бюджет')&&js.includes('Расстояние')):(js.includes('k-exchange-card__primary-facts')&&js.includes('<small>Бюджет</small>')&&js.includes('<small>Расстояние</small>')),
  'details disclosure':js.includes('k-exchange-card__details')&&(js.includes('<span>Подробнее</span>')||js.includes('Подробнее о заявке')),
  'dispatch metrics in details':r71?(js.includes('Рейтинг')&&js.includes('Загрузка')&&js.includes('Можно начать')&&js.includes('Совпадение')):(js.includes('рейтинг заявки')&&js.includes('загрузка смены')&&js.includes('можно начать')&&js.includes('совпадение услуг')),
  'quick response preserved':js.includes('data-exchange-quick=')&&(js.includes('Быстрый отклик')||js.includes('Откликнуться')),
  'mobile tabs two columns':r71?css71.includes('.k-exchange-r71-tabs'):css.includes('.k-exchange-tabs--production{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'),
  'legacy heavy strips hidden mobile':css.includes('.k-exchange-dispatch-strip,.k-exchange-card__facts{display:none!important}'),
  'mobile details grid':r71?css71.includes('.k-exchange-r71-details{grid-template-columns'):css.includes('.k-exchange-card__details-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'),
};
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
if(bad.length){console.error('FAIL '+bad.join(', '));process.exit(1)}
console.log('OK R188.5.5.6.34 exchange mobile cards');
