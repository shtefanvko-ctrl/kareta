'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const bootstrap=fs.readFileSync(path.join(root,'api/bootstrap.php'),'utf8');
const config=fs.readFileSync(path.join(root,'config.php'),'utf8');
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const start=bootstrap.indexOf('function kareta_runtime_maintenance(PDO $pdo): void');
const end=bootstrap.indexOf('function kareta_bootstrap_runtime(PDO $pdo): void',start);
expect(start>=0&&end>start,'runtime maintenance function must exist');
const maintenance=start>=0&&end>start?bootstrap.slice(start,end):'';

expect(!maintenance.includes('kareta_ensure_catalog_content'),'runtime maintenance must not call undefined catalog ensure');
expect(!maintenance.includes('kareta_ensure_public_content'),'runtime maintenance must not call undefined public-content ensure');
expect(!maintenance.includes('kareta_ensure_core_seed_integrity'),'runtime maintenance must not nest relation/stats rebuild through core-seed integrity');
expect((maintenance.match(/kareta_backfill_relations\(\$pdo\)/g)||[]).length===1,'runtime maintenance must run one relation backfill');
expect(!maintenance.includes('kareta_rebuild_user_stats($pdo)'),'runtime maintenance must not rebuild stats separately from relation backfill');
expect(maintenance.includes("defined('KARETA_DEMO_SEED') && KARETA_DEMO_SEED"),'demo seed must be explicitly gated');

const relStart=bootstrap.indexOf('function kareta_backfill_relations(PDO $pdo): void');
const relEnd=bootstrap.indexOf('\nfunction ',relStart+20);
const relationBody=relStart>=0?bootstrap.slice(relStart,relEnd>relStart?relEnd:relStart+30000):'';
expect(relationBody.includes('kareta_rebuild_user_stats($pdo);'),'relation backfill must preserve one stats rebuild');

expect(config.includes("KARETA_DB_RUNTIME_MIGRATION_WINDOW"),'production runtime migration must require explicit maintenance window');
expect(config.includes("KARETA_DB_AUTO_MIGRATE"),'auto-migrate configuration must remain explicit');

if(fail.length){
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('RUNTIME_MAINTENANCE_BOUNDARY_84_154: PASS');
