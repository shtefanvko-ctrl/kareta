'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/121_account_tariffs_master_capacity.php'),tariffs=read('api/account_tariffs.php'),db=read('api/db.php'),sto=read('api/sto_workplace.php'),dispatch=read('api/production_dispatch.php'),schedule=read('api/master_workplace.php');
const routes=read('js/next/route_registry.js'),app=read('js/next/app_next.js'),cabinet=read('js/next/pages/cabinet.js'),css=read('css/next/account_tariffs_master_capacity.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);expect(dbv===121,'R68 expected DB version 121');
for(const t of ["'version'=>121",'account_tariff_plans','account_tariff_assignments','account_tariff_usage_events','client_start','client_plus','master_start','master_pro','"acceptedRequestsPerDay":3','"activeIntakesPerDay":3','"openRepairs":10'])expect(migration.includes(t),`migration missing ${t}`);
for(const t of ['kareta_tariff_master_usage','kareta_tariff_master_guard','kareta_tariff_master_intake_guard','kareta_tariff_record_master_acceptance','kareta_tariff_client_guard','acceptedRequestsPerDay','activeIntakesPerDay','openRepairs','tariff_limit_reached'])expect(tariffs.includes(t),`tariff engine missing ${t}`);
expect(tariffs.includes("'master_start'")&&tariffs.includes("'master_pro'")&&tariffs.includes("'client_start'")&&tariffs.includes("'client_plus'"),'four fallback plans required');
for(const t of ["tariffs.getMine","tariffs.assign","client_exchange_accept","master_claim","order_create_assigned","admin_assign_master","sto_lead_accept_assign","sto_exchange_assign","sto_reassign_master"])expect(db.includes(t),`db integration missing ${t}`);
expect(!db.includes("error'=>'master_day_limit'")&&!db.includes('На этот день у мастера уже 3 машины'),'legacy hardcoded master day cap must be removed');
for(const t of ['kareta_tariff_master_guard','kareta_tariff_record_master_acceptance'])expect(sto.includes(t),`STO workplace missing ${t}`);
for(const t of ['tariffBlocked','kareta_tariff_master_usage','kareta_tariff_master_guard','production_auto_reassign'])expect(dispatch.includes(t),`Production Dispatch missing ${t}`);
for(const t of ['kareta_tariff_master_intake_guard','tariffIntakeFull','tariffIntakesLimit'])expect(schedule.includes(t),`schedule tariff enforcement missing ${t}`);
expect(db.includes("kareta_tariff_client_guard($pdo,'activeRequests'")&&db.includes("kareta_tariff_client_guard($pdo,'vehicles'"),'client request/garage limits must be enforced');
expect(routes.includes("#/cabinet/tariff")&&routes.includes('cabinetTariff'),'tariff route missing');
expect(app.includes('cabinetTariff:cabinetPages.renderTariff')&&app.includes('cabinetTariff:cabinetPages.mountTariff'),'tariff route not mounted');
for(const t of ['renderTariff','mountTariff','Принято заявок сегодня','Активные приёмы на выбранный день','Незакрытые машины в ремонте','Тариф'])expect(cabinet.includes(t),`tariff UI missing ${t}`);
for(const t of ['.k-tariff-host','.k-tariff-metrics','.k-tariff-plan-grid','.k-tariff-rule'])expect(css.includes(t),`R68 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R68 CSS must not alter Shell');
expect(registry.includes('css/next/account_tariffs_master_capacity.css'),'R68 stylesheet missing from registry');
expect(asset.includes('r1885628-account-tariffs-master-capacity')&&sw.includes('r1885628-account-tariffs-master-capacity'),'R68 release suffix missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.68 account tariffs + master capacity + Shell Freeze 2 OK');
