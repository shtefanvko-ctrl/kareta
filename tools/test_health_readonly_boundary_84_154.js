'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const runtime=read('api/runtime_health.php');
const schema=read('api/schema_health.php');
const identity=read('api/identity_health.php');

for(const [file,content] of [['api/runtime_health.php',runtime],['api/schema_health.php',schema]]){
  expect(!content.includes("require_once __DIR__.'/bootstrap.php'")&&!content.includes("require_once __DIR__ . '/bootstrap.php'"),file+' must not load bootstrap.php');
}

expect(schema.includes('KaretaSchemaContract::inspect($pdo)'),'schema_health must inspect schema contract');
expect(!schema.includes('KaretaSchemaContract::record('),'schema_health must not record audit rows');
expect(!/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b\s+/i.test(schema),'schema_health must not contain SQL mutations');
expect(schema.includes("'readOnly'=>true"),'detailed schema health must declare readOnly');
expect(schema.includes("session_start(['read_and_close'=>true])"),'admin diagnostics session must be opened read-only');

expect(identity.includes("require_once __DIR__.'/bootstrap.php'"),'identity_health remains explicitly unresolved and must not be silently treated as read-only');
expect(identity.includes('KaretaAuthResolver'),'identity_health still resolves Identity runtime and requires separate refactor');

if(fail.length){
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('HEALTH_READONLY_BOUNDARY_84_154: PASS');
