const fs=require('fs');
const root=require('path').resolve(__dirname,'..');
const js=fs.readFileSync(root+'/js/next/pages/work_feed.js','utf8');
const css=fs.readFileSync(root+'/css/next/app_next.css','utf8');
const r71=js.includes("MASTER_UI_R71_CONTRACT='R188.5.5.6.71'");
const css71=r71?fs.readFileSync(root+'/css/next/master_ui_exchange_schedule_flattening.css','utf8'):'';
const checks={
  'simple exchange search toolbar': js.includes('k-exchange-production-toolbar k-exchange-search-toolbar'),
  'search uses compact client field': js.includes('k-masters-search k-exchange-search-field') && (js.includes('placeholder="Поиск заявок"')||js.includes('placeholder="Автомобиль, услуга или заявка"')),
  'advanced filters are in panel': js.includes('data-exchange-filter-panel') && js.includes('data-exchange-filter-toggle'),
  'filter reset exists': js.includes('data-exchange-filter-reset'),
  'filter active count exists': js.includes('data-exchange-filter-count') && js.includes('updateToolbarUi'),
  'search clear exists': js.includes('data-exchange-search-clear'),
  'distance retained': js.includes('data-exchange-distance'),
  'price retained': js.includes('data-exchange-price-min') && js.includes('data-exchange-price-max'),
  'urgency retained': js.includes('data-exchange-urgency'),
  'sort retained': js.includes('data-exchange-sort'),
  'client-style 4-control layout': r71?css71.includes('.k-exchange-r71-toolbar'):css.includes('grid-template-columns:minmax(0,1fr) auto auto auto'),
  'mobile filters use overlay': css.includes('.k-exchange-filter-panel{position:fixed'),
};
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
if(bad.length){console.error('FAIL',bad.join(', '));process.exit(1);}
console.log('OK R188.5.5.6.33 exchange client-style search');
