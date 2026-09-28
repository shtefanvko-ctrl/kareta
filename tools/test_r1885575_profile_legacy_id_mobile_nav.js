'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const migration=read('api/migrations/103_person_profile_legacy_id_string.php');
assert(migration.includes("'version' => 103"),'migration 103 is missing');
assert(migration.includes('MODIFY COLUMN `legacy_entity_id` VARCHAR(64) NULL'),'legacy_entity_id is not repaired to VARCHAR(64)');
assert(migration.includes('information_schema.COLUMNS'),'migration is not idempotent');

const config=read('config.php');
const dbVersionMatch=config.match(/define\('KARETA_DB_VERSION',\s*(\d+)\);/);
assert(dbVersionMatch && Number(dbVersionMatch[1]) >= 103,'database version is below 103');

const navigation=read('js/next/navigation_core.js');
const mobileNavigation=navigation.split('// Desktop navigation')[0];
assert(mobileNavigation.includes("personal: Object.freeze(['home','services','works','masters','parts','__more__'])"),'personal mobile template must contain Services as the second CLIENT action');
assert(mobileNavigation.includes("anonymous: Object.freeze(['home','works','masters','parts','__more__'])"),'anonymous mobile template still contains Services');
assert(mobileNavigation.includes("personal: Object.freeze(['home','services'"),'Services is missing from personal k-mobile-nav');

assert(mobileNavigation.includes("master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'])"),'master mobile template does not match the current six-surface contract');
assert(mobileNavigation.includes("organization_service: Object.freeze(['stoDashboard','orders','masters','parts','__more__'])"),'STO mobile template still contains Services');
assert(!mobileNavigation.includes("master: Object.freeze(['home','orders','serviceManagement'"),'serviceManagement remains in master k-mobile-nav');
assert(!mobileNavigation.includes("organization_service: Object.freeze(['stoDashboard','orders','masters','serviceManagement'"),'serviceManagement remains in STO k-mobile-nav');

const css=read('css/next/client_mobile_navigation.css');
assert(css.includes('--k-mobile-nav-count: 6 !important'),'personal mobile navigation does not use six columns');
assert(css.includes('repeat(6, minmax(0, 1fr))'),'six-column CLIENT grid is missing');

const context=read('api/identity/context_service.php');
assert(context.includes("$id='master_user_'"),'master string ID materialization is missing');
assert(context.includes('(string)$legacyId'),'identity profile legacy ID is not passed as a string');
console.log('R188.5.5.6.15 profile legacy ID and mobile nav tests OK');
