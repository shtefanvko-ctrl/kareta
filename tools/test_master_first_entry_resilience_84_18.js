const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const page=read('js/next/pages/master_onboarding.js');
const css=read('css/next/master_onboarding.css');
const api=read('api/master_onboarding.php');
const ver=read('inc/asset_version.php');
const errors=[]; const must=(ok,msg)=>{if(!ok)errors.push(msg)};
for(const token of [
  "avatar-crop","data-kmo-avatar-save","canvas.toDataURL('image/jpeg',.88)","data-kmo-avatar-remove",
  "catalogState:'idle'","catalogSkeleton","data-kmo-catalog-retry","loadCatalog(true)",
  "BroadcastChannel('kareta-master-onboarding')","visibilitychange","pageshow","addEventListener('online'","addEventListener('offline'","addEventListener('storage'",
  "kareta:session-expired","idempotency-reconcile","refreshCurrent('online')","KaretaAddressProvider","data-kmo-address-suggestion"
]) must(page.includes(token),'MASTER 84.18 page missing '+token);
for(const token of ['kmo-avatar-crop','kmo-crop-controls','kmo-network','kmo-service-skeleton','kmo-catalog-error','kmo-address-suggestions','@media (max-width:359px)','@media (min-width:600px)','@media (min-width:1024px)','@media (min-width:1440px)']) must(css.includes(token),'MASTER 84.18 CSS missing '+token);
for(const token of ["$action==='removeAvatar'","UPDATE users SET avatar_url=NULL"]) must(api.includes(token),'MASTER 84.18 API missing '+token);
must(/188\.5\.5\.6\.84\.(\d+)/.test(ver)&&Number(/188\.5\.5\.6\.84\.(\d+)/.exec(ver)[1])>=18,'asset version must be 84.18+');
must(!page.includes('localStorage.setItem(localKey,JSON.stringify({revision:model.revision,draft:model.draft,temp:'),'avatar crop bytes must not be persisted in localStorage');
must(!/\[1,2,3,4,5/.test(page),'MASTER must remain four parent steps');
must(page.includes("[1,2,3,4].map"),'MASTER stepper must remain 1–4');
if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log('MASTER First Entry resilience / adaptive 84.18 OK');
