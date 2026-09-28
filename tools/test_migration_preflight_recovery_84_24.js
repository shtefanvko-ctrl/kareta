const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const bootstrap=read('api/bootstrap.php');
const diagnostics=read('api/runtime_diagnostics.php');
const logger=read('js/next/runtime_logger.js');
let ok=0; function expect(name,cond){if(!cond){console.error('FAIL',name);process.exitCode=1;}else{ok++;console.log('PASS',name);}}
expect('metadata schema helper exists',bootstrap.includes('function kareta_prepare_migration_metadata_schema'));
expect('db_migrations checksum repair is explicit',bootstrap.includes("'migration.meta_schema.' . $column")&&bootstrap.includes("kareta_migration_column_exists($pdo, 'db_migrations', $column)"));
expect('migration metadata ALTER errors are not swallowed',bootstrap.includes('Migration metadata repair failed for db_migrations.')&&!bootstrap.includes("try { $pdo->exec($sql); } catch (Throwable $_ignored) {}"));
expect('checksum audit key uses ascii checksums',bootstrap.includes('CHAR(64) CHARACTER SET ascii COLLATE ascii_bin')&&bootstrap.includes('migration.checksum_audit_schema'));
expect('bootstrap lock suppresses nested migration lock',bootstrap.includes('KARETA_SCHEMA_BOOTSTRAP_LOCK_HELD')&&bootstrap.includes('$bootstrapOwnsLock'));
for(const stage of ['migration.lock','migration.meta_schema','migration.compatibility.82','migration.discovery','migration.history.read','migration.history.verify','migration.schema_contract']) expect('stage '+stage,bootstrap.includes(stage));
expect('public failure meta exposes safe migration file',bootstrap.includes("'failedMigrationFile' => basename")&&diagnostics.includes("'failedMigrationFile'"));
expect('public failure meta exposes reason code',bootstrap.includes("'failureReason' => $reason")&&diagnostics.includes("'failureReason'"));
expect('runtime logger prints file and reason',logger.includes('file=${payload?.failedMigrationFile')&&logger.includes('reason=${payload?.failureReason'));
expect('runtime logger does not fake missing private config',logger.includes("diagnostic.config ?")&&logger.includes("'hidden'"));
console.log(`Migration preflight recovery: ${ok} checks passed`);
if(process.exitCode)process.exit(process.exitCode);
