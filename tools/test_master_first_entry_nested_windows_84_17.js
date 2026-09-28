const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const page=read('js/next/pages/master_onboarding.js');
const css=read('css/next/master_onboarding.css');
const api=read('api/master_onboarding.php');
const icons=read('js/next/ui_icons.js');
const ver=read('inc/asset_version.php');
const errors=[];const must=(ok,msg)=>{if(!ok)errors.push(msg)};
for(const token of ['KaretaUIIcons','data-kmo-open-price','data-kmo-open="city"','data-kmo-open="address"','data-kmo-open="origin"','data-kmo-open="service-area"','Работаю в СТО','data-kmo-org-location','data-kmo-custom-category','data-kmo-price-save','data-kmo-location-confirm','data-kmo-area-save','nearestCity','aria-modal="true"']) must(page.includes(token),'MASTER nested UI missing '+token);
must(!page.includes('const paths={user:'),'MASTER onboarding must not own a second local icon registry');
for(const icon of ['services','work','location','store','truck','edit','trash']) must(icons.includes(icon+':')||icons.includes("'"+icon+"'"),'shared icon registry missing '+icon);
for(const token of ['kmob_city_options','kmob_organization_locations','organization_location_forbidden','custom_service_category_required',"'options'=>['cities'",'organizationLocations']) must(api.includes(token),'MASTER onboarding API missing '+token);
for(const token of ['kmo-org-options','kmo-map-card','kmo-area-options','kmo-price-mode','kmo-custom-categories','kmo-modal-context']) must(css.includes(token),'MASTER nested CSS missing '+token);
must(/188\.5\.5\.6\.84\.(\d+)/.test(ver)&&Number(/188\.5\.5\.6\.84\.(\d+)/.exec(ver)[1])>=17,'asset version must be 84.17+');
must(!/\[1,2,3,4,5/.test(page),'MASTER must stay four parent steps');
if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log('MASTER First Entry nested windows 84.17 OK');
