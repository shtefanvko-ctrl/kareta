'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const js=read('js/next/pages/details.js'), api=read('api/catalog_details.php'), catalog=read('api/masters_catalog.php'), css=read('css/next/details.css'), wallCss=read('css/next/masters.css');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const start=js.indexOf('async function mountProvider'),end=js.indexOf('window.KaretaDetailPages',start),provider=js.slice(start,end);
for(const token of ['k-provider-native-profile','k-provider-native-primary-actions','data-provider-follow','data-provider-open="experience"','data-provider-open="services"','data-provider-open="works"','k-provider-review-summary','k-provider-wall-preview','data-provider-dialog="wall-filter"'])expect(provider.includes(token),`provider missing ${token}`);
const hasR53=read('inc/asset_version.php').includes('r1885613-master-reviews-social-contract');expect(hasR53?provider.includes('#/masters/reviews/'):provider.includes('data-provider-open="reviews"'),'provider reviews entry missing');
for(const token of ['window.Swiper','new window.Swiper','k-master-wall-tabs','<select'])expect(!provider.includes(token),`provider native flow forbids ${token}`);
expect(provider.includes('api.updateMasterSocial'),'master follow remains server-backed');
expect(provider.includes('api.likeWorkPost'),'wall work likes remain server-backed');
expect(provider.includes("location.hash='#/orders/new'"),'booking must enter real request flow');
expect(provider.includes("location.hash=`#/chats?"),'message must enter real chat route');
for(const token of ['reviewSummary','socialState','socialCounts','profile_visible','quality_rating','timing_rating','neatness_rating','communication_rating'])expect(api.includes(token),`provider detail API missing ${token}`);
for(const token of ['resume','primary_services','availability','service_address','service_radius_km','profile_visible'])expect(catalog.includes(token),`master public fields missing ${token}`);
expect(catalog.includes("json_decode((string)$row[$jsonField], true)"),'profile JSON fields must be decoded server-side');
for(const token of ['.k-provider-native-primary-actions','.k-provider-native-metrics','.k-provider-specialty-grid','.k-provider-native-dialog','.k-provider-review-breakdown','.k-provider-wall-preview'])expect(css.includes(token),`native profile CSS missing ${token}`);
expect(css.includes('@media(max-width:700px)'),'mobile public profile contract missing');
expect(css.includes('.k-provider-native-primary-actions{grid-template-columns:1fr}'),'mobile primary actions must be vertical');
expect(css.includes('.k-master-work-grid,.k-master-review-grid{grid-template-columns:1fr}'),'mobile work/review cards must be vertical');
expect(wallCss.includes('.k-master-wall-native-actions'),'native wall actions missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('R188.5.5.6.50 public master profile: real data + native mobile + shell freeze OK');
