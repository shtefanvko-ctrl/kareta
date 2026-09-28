'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const bootstrap=read('api/bootstrap.php');
assert(bootstrap.includes("SELECT GET_LOCK(?, 30)"));
assert(bootstrap.includes('kareta_schema_bootstrap_'));
assert(!bootstrap.includes("kareta_db_set_failure_context('bootstrap.ensure_schema.pre_migration')"));
const create=bootstrap.indexOf("kareta_db_set_failure_context('bootstrap.create_schema')");
const migrate=bootstrap.indexOf("kareta_db_set_failure_context('bootstrap.migrate')");
const post=bootstrap.indexOf("kareta_db_set_failure_context('bootstrap.ensure_schema.post_migration')");
assert(create>=0&&migrate>create&&post>migrate,'bootstrap order');
for(const needle of [
  'function kareta_relax_legacy_blank_unique_indexes',
  "['clients','user_phone'",
  "['masters','user_phone'",
  "['parts_catalog','sku'",
  'idx_clients_user_phone','idx_masters_user_phone','idx_parts_catalog_sku',
  'db_migration_checksum_conflicts','Recorded non-blocking checksum conflict',
  'function kareta_prepare_migration_99_more_menu_compatibility',
  'function kareta_prepare_identity_collation_compatibility'
]) assert(bootstrap.includes(needle),needle);
assert(!bootstrap.includes("throw new RuntimeException('Applied migration checksum mismatch"));
const onboarding=read('js/next/onboarding/onboarding_api.js');
for(const needle of ['diagnosticCode','failureStage','failedMigrationVersion','failureSqlState','failureDriverCode','[KARETA][DB FAILURE]']) assert(onboarding.includes(needle),needle);
const diagnostics=read('api/runtime_diagnostics.php');
for(const needle of ['failureCategory','failureSqlState','failureDriverCode']) assert(diagnostics.includes(needle),needle);
const release='20260806-r188555-runtime-dependency-bootstrap-r188556-security-hardening-r1885561-atomic-runtime-bootstrap-r1885562-identity-db-recovery-r1885563-migration98-onboarding-recovery-r1885564-fk-detach-schema-recovery-r1885565-serialized-schema-index-recovery';
for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js']) assert(read(file).includes(release),file);
assert(read('index.php').includes("r1885565-serialized-schema-index-recovery"));
console.log('R188.5.5.6.5 schema/index recovery tests OK');
