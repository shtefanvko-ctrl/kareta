'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const orders=read('js/next/pages/orders.js'),workflow=read('js/next/pages/workflow.js'),finance=read('js/next/pages/finance.js'),masters=read('js/next/pages/masters.js'),sto=read('js/next/pages/sto_workplace.js'),css=read('css/next/sto_native_surface_audit.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js');
for(const marker of ['k-sto-r75-orders-list','k-sto-r75-order__facts','k-sto-r75-order__actions'])expect(orders.includes(marker),`STO flat orders missing ${marker}`);
expect(orders.includes("role==='sto'"),'STO orders role branch missing');
for(const marker of ['k-workflow-board--sto-r75','k-sto-r75-workflow-row','Производство СТО'])expect(workflow.includes(marker),`STO workflow flat surface missing ${marker}`);
for(const marker of ['k-fin-r75-dialog','k-fin-r75-summary','k-fin-r75-list','data-order-pay','data-payroll-rule','data-cash-expense'])expect(finance.includes(marker),`Native finance missing ${marker}`);
expect(!finance.includes('prompt('),'Finance still uses browser prompt');
expect(!finance.includes('<select'),'Finance contains active select');
expect(!sto.includes('<select'),'STO workplace contains active select');
for(const marker of ['renderStoTeam','mountStoTeam','k-sto-r75-team-row','data-sto-team'])expect(masters.includes(marker),`STO team route missing ${marker}`);
expect(css.includes('One operational entity = one surface')&&css.includes('#k-sto-workplace select{display:none!important}')&&css.includes('[data-page~=\"orders-sto\"]>.k-page-hero'),'R75 flat/native CSS contract missing');
expect(registry.includes('css/next/sto_native_surface_audit.css'),'R75 stylesheet missing from registry');
expect(asset.includes('r1885635-sto-native-surface-audit'),'R75 asset tag missing');
expect(sw.includes('r1885635-sto-native-surface-audit'),'R75 SW tag missing');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.75 STO native surface audit OK');
