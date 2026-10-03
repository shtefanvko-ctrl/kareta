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

for(const [file,content] of [['api/runtime_health.php',runtime],['api/schema_health.php',schema],['api/identity_health.php',identity]]){
  expect(!content.includes("require_once __DIR__.'/bootstrap.php'")&&!content.includes("require_once __DIR__ . '/bootstrap.php'"),file+' must not load bootstrap.php');
}

expect(schema.includes('KaretaSchemaContract::inspect($pdo)'),'schema_health must inspect schema contract');
expect(!schema.includes('KaretaSchemaContract::record('),'schema_health must not record audit rows');
expect(!/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b\s+/i.test(schema),'schema_health must not contain SQL mutations');
expect(schema.includes("'readOnly'=>true"),'detailed schema health must declare readOnly');
expect(schema.includes("session_start(['read_and_close'=>true])"),'admin diagnostics session must be opened read-only');

expect(identity.includes('KaretaSchemaContract::inspect($pdo)'),'identity_health must inspect schema contract');
expect(!identity.includes('KaretaSchemaContract::record('),'identity_health must not record audit rows');
expect(!identity.includes('KaretaAuthResolver'),'identity_health must not invoke mutating AuthResolver');
expect(!identity.includes('KaretaSessionService'),'identity_health must not touch or rotate Identity sessions');
expect(!/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b\s+/i.test(identity),'identity_health must not contain SQL mutations');
expect(identity.includes("session_start(['read_and_close'=>true])"),'identity health legacy-session observation must be read-only');
expect(identity.includes("'readOnly'=>true"),'detailed identity health must declare readOnly');
expect(identity.includes('SELECT s.id,s.account_id,s.current_context_id'),'identity health must observe auth_sessions directly');
expect(identity.includes("selected_context_unavailable"),'identity health must report invalid selected context instead of repairing it');
expect(runtime.includes('mysql:unix_socket='),'runtime health must support configured MySQL socket');
expect(schema.includes('mysql:unix_socket='),'schema health must support configured MySQL socket');
expect(identity.includes('mysql:unix_socket='),'identity health must support configured MySQL socket');

if(fail.length){
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('HEALTH_READONLY_BOUNDARY_84_154: PASS');
