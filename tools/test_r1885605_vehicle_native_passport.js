'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const page=read('js/next/pages/vehicle.js');
const css=read('css/next/vehicle.css');
const api=read('api/vehicle_passport.php');
const db=read('api/db.php');
const vehicleApi=read('js/next/vehicles/vehicle_api.js');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const token of ['k-vehicle-identity-card','k-vehicle-native-metrics','k-vehicle-native-actions','k-vehicle-native-layout','data-vehicle-open-section="history"','data-vehicle-open-section="parts"','data-vehicle-open-section="documents"','data-vehicle-open-section="maintenance"','data-vehicle-action="mileage"','data-vehicle-action="issue"','data-vehicle-create-request'])expect(page.includes(token),`vehicle native token missing: ${token}`);
expect(!page.includes('k-vehicle-tabs'),'horizontal vehicle tabs must be removed');
expect(!page.includes('data-vehicle-tab'),'vehicle tab runtime must be removed');
expect(!page.includes('<select'),'vehicle page must not use dropdown/select controls');
expect(page.includes('k-vehicle-choice-group'),'modal choice cards missing');
expect(page.includes("sessionStorage.setItem('kareta.request.prefill'"),'vehicle request prefill missing');
expect(css.includes('@media(max-width:760px)'),'mobile vehicle breakpoint missing');
expect(css.includes('.k-vehicle-native-actions{grid-template-columns:repeat(2,minmax(0,1fr))'),'mobile 2-column vehicle actions missing');
expect(css.includes('.k-vehicle-modal.is-full .k-vehicle-modal__sheet{height:92dvh}'),'mobile full-screen section modal missing');
for(const shellSelector of ['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'])expect(!css.includes(shellSelector),`vehicle css must not target frozen shell ${shellSelector}`);
for(const token of ['installedParts','work_order_part_reservations','VEHICLE_PARTS_READ_FAIL','kareta_vehicle_mileage_save','mileage_cannot_decrease','Обновлён пробег'])expect(api.includes(token),`vehicle backend missing ${token}`);
expect(db.includes("case 'vehicles.mileage.save'"),'mileage API route missing');
expect(vehicleApi.includes("'vehicles.mileage.save'"),'vehicle frontend mileage API missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('R188.5.5.6.45 vehicle native passport + shell freeze: OK');
