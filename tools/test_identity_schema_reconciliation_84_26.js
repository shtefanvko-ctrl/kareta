'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let pass=0,fail=0;
function expect(name,ok,detail=''){if(ok){pass++;console.log('PASS',name);}else{fail++;console.error('FAIL',name,detail);}}

const migration=read('api/migrations/131_identity_schema_reconciliation.php');
const manifest=JSON.parse(read('api/migration_manifest.json'));
const config=read('config.php');
const bootstrap=read('api/bootstrap.php');
const diagnostics=read('api/runtime_diagnostics.php');
const auth=read('api/auth_session.php');
const logger=read('js/next/runtime_logger.js');

expect('migration 131 exists',migration.includes("'version' => 131"));
expect('migration 131 is explicit reconciliation',migration.includes('schema reconciliation')||migration.includes('reconciliation point'));
expect('migration 131 replays canonical identity core',migration.includes("72 => '072_identity_core_stage1.php'"));
expect('migration 131 replays master first entry',migration.includes("128 => '128_master_first_entry_onboarding.php'"));
expect('migration 131 replays client first entry',migration.includes("129 => '129_client_first_entry_state.php'"));
expect('migration 131 replays account lifecycle',migration.includes("130 => '130_account_type_profile_lifecycle.php'"));
expect('reconciliation validates source migration version',migration.includes("(int)($migration['version'] ?? 0) !== $version"));
expect('reconciliation requires callable source runner',migration.includes("is_callable($migration['run'] ?? null)"));
expect('reconciliation runs final schema contract',migration.includes('KaretaSchemaContract::inspect($pdo)'));
expect('reconciliation refuses incomplete schema',migration.includes('Schema reconciliation incomplete: tables='));
expect('manifest target includes 131',Number(manifest.targetDbVersion)>=131,String(manifest.targetDbVersion));
expect('manifest contains at least 131 entries',Array.isArray(manifest.migrations)&&manifest.migrations.length>=131,String(manifest.migrations?.length));
expect('manifest last migration is reconciliation',manifest.migrations?.[130]?.file==='131_identity_schema_reconciliation.php');
const dbVersion=Number((config.match(/KARETA_DB_VERSION',\s*(\d+)/)||[])[1]||0);
expect('runtime DB version includes 131',dbVersion>=131,String(dbVersion));
expect('schema contract parser exposes missing tables',bootstrap.includes("'missingTables' => array_values(array_unique($missingTables))"));
expect('schema contract parser exposes missing columns',bootstrap.includes("'missingColumns' => array_values(array_unique($missingColumns))"));
expect('runtime diagnostics surface missing schema items',diagnostics.includes("'missingTables'=>$failureMeta['missingTables']")&&diagnostics.includes("'missingColumns'=>$failureMeta['missingColumns']"));
expect('auth 503 surfaces missing schema items',auth.includes("'missingTables'=>$failureMeta['missingTables']")&&auth.includes("'missingColumns'=>$failureMeta['missingColumns']"));
expect('console diagnostics print missing schema items',logger.includes('missingTables: Array.isArray(payload?.missingTables)')&&logger.includes('missingColumns: Array.isArray(payload?.missingColumns)'));
expect('schema reconciliation maps to schema contract reason',bootstrap.includes("str_contains($message, 'schema reconciliation incomplete')"));

console.log(`RESULT ${pass}/${pass+fail}`);
process.exit(fail?1:0);
