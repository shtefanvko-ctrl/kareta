'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let passed=0;
function expect(name,ok){if(!ok){console.error('FAIL',name);process.exitCode=1;}else{passed++;console.log('PASS',name);}}

const migration=read('api/migrations/130_account_type_profile_lifecycle.php');
const schema=read('api/identity/schema_contract.php');
const context=read('api/identity/context_service.php');
const identityMigration=read('api/identity/identity_migration_service.php');
const onboarding=read('api/master_onboarding.php');
const workplace=read('api/master_workplace.php');
const bootstrap=read('api/bootstrap.php');
const db=read('api/db.php');
const catalog=read('api/masters_catalog.php');
const caps=read('api/identity/capability_service.php');
const manager=read('js/next/context_manager.js');

expect('migration 130 exists',migration.includes("'version' => 130")&&migration.includes('account_types'));
expect('account type existence has unique account/type key',migration.includes('UNIQUE KEY `uq_account_type` (`account_id`,`account_type`)'));
expect('profile lifecycle has independent columns',migration.includes('onboarding_status')&&migration.includes('publication_status')&&migration.includes('verification_status'));
expect('approved applications are one-time migration only',migration.includes('migration_130_approved_application')&&migration.includes('workflow history, not identity authority'));
expect('MASTER first entry activates account type directly',context.includes("upsertAccountType($accountId,$personId,'master','onboarding_first_entry'")&&!context.includes("VALUES(?,'master','approved'"));
expect('MASTER account type request needs no approval',context.includes("'approvalMode'=>'not_required'")&&context.includes("'activatedImmediately'=>true"));
expect('test auto approval no longer approves MASTER',context.includes("ra.requested_role IN ('sto','seller')"));
expect('reconciliation authorizes from account_types',context.includes('activeAccountTypeRolesByUser')&&context.includes("SELECT at.account_type FROM account_types"));
expect('migration service reads account_types first',identityMigration.includes('account_types is the Identity authority')&&identityMigration.includes("elseif ($this->tableExists('role_applications'))"));
expect('onboarding profile creation no longer creates MASTER application',bootstrap.includes("in_array($requestedRole, ['sto','seller'], true)"));
expect('workplace does not authorize approved MASTER application',!workplace.includes("requested_role='master' AND status='approved'")&&workplace.includes('master_context_required'));
expect('draft transition updates lifecycle column',onboarding.includes("onboarding_status='in_progress'")&&onboarding.includes("publication_status=IF(publication_status='active','active','pending_onboarding')"));
expect('completion updates independent lifecycle columns',onboarding.includes("onboarding_status='completed',publication_status='active'")&&onboarding.includes("verification_status=COALESCE(NULLIF(verification_status,''),'unverified')"));
expect('capability guard uses explicit onboarding lifecycle',caps.includes('SELECT profile_type,onboarding_status FROM person_profiles'));
expect('contexts expose profile lifecycle',context.includes("'onboardingStatus'")&&context.includes("'publicationStatus'")&&context.includes("'verificationStatus'"));
expect('public master catalog requires published completed profile',catalog.includes("pp_lc.publication_status='active'")&&catalog.includes("pp_lc.onboarding_status='completed'"));
expect('db public master catalog requires lifecycle too',db.includes("$where[]=\"pp_lc.publication_status='active'\"")&&db.includes("$where[]=\"pp_lc.onboarding_status='completed'\""));
expect('legacy primary role does not revoke other account types',db.includes('legacy primary surface')&&!db.includes("SET pp.status='suspended' WHERE a.phone=? AND pp.profile_type IN ('master','seller')"));
expect('professional legacy role activates account_types',db.includes("INSERT INTO account_types(account_id,person_id,account_type,status,source"));
expect('frontend understands direct account type activation',manager.includes('activatedImmediately')&&manager.includes('добавлен и включён'));
expect('schema contract requires account_types',schema.includes("'account_types' => ['id','account_id','person_id','account_type','status']"));
expect('schema contract requires first-entry lifecycle',schema.includes("'onboarding_status','publication_status','verification_status'")&&schema.includes("'master_onboarding_state'")&&schema.includes("'client_first_entry_state'"));

console.log(`\n${passed}/22 checks passed`);
if(process.exitCode)process.exit(process.exitCode);
