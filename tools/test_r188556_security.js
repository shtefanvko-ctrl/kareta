'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function authAndOtp(){
  const auth=read('api/auth_session.php');
  const challenge=read('api/identity/challenge_service.php');
  assert(!auth.includes("$_COOKIE['kareta_phone']"),'client phone cookie still restores a server session');
  assert(!challenge.includes("$code='0000'")&&!challenge.includes("$code = '0000'"),'fixed OTP remains');
  for(const marker of ['random_int(100000,999999)','request_ip_hash','GET_LOCK','password_verify','otp_delivery_unavailable']){
    assert(challenge.includes(marker),`OTP hardening missing: ${marker}`);
  }
  assert(auth.includes('session_regenerate_id(true)'),'session ID is not regenerated after OTP');
  assert(read('api/identity_session.php').includes("throw new DomainException('account_not_active')"),'blocked legacy user can use Identity login');
}

function accessControl(){
  const db=read('api/db.php');
  assert(db.includes("$_GET['action'] ?? 'ping'"),'public GET defaults to a data pull');
  const pull=db.indexOf("if ($action === 'pull')");
  assert(pull>=0&&db.indexOf('kareta_require_any_role',pull)>pull,'pull has no authentication gate');
  assert(db.includes("case 'clients.upsert':    kareta_require_any_role(['sto','admin','owner'])"),'client can still call clients.upsert');
  assert(db.includes("case 'vehicles.upsert':    kareta_assert_vehicle_mutation_scope"),'vehicle ownership guard is missing');
  assert(db.includes("$lockName='kareta_vehicle_'")&&db.includes('SELECT GET_LOCK(?,3)'),'vehicle ownership check has a race window');
  assert(db.includes("if(!$owns)kareta_json(['ok'=>false,'error'=>'not_your_order'],403)"),'legacy order update ownership guard is missing');
  assert(db.includes("case 'chats.create':      kareta_require_any_role"),'chat creation is unauthenticated');
  assert(db.includes("kareta_json(['ok'=>false,'error'=>'account_blocked'],403)"),'legacy OTP accepts a blocked account');
}

function rolesAndIncidentResponse(){
  const bootstrap=read('api/bootstrap.php');
  const migration=read('api/migrations/102_security_hardening.php');
  assert(bootstrap.includes('users.role remains the'),'authoritative role rule is missing');
  assert(migration.includes('role_applications'),'role moderation migration is missing');
  assert(migration.includes('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW())'),'vulnerable sessions are not revoked');
  assert(migration.includes("ELSE 'blocked' END"),'legacy blocks are not synchronized');
  assert(read('api/migrations/043_demo_accounts_and_relations.php').includes('KARETA_DEMO_SEED'),'demo seed is not explicitly gated');
}

function xssUploadsAndDiagnostics(){
  const chat=read('js/next/pages/chats.js');
  const db=read('api/db.php');
  for(const marker of ['const esc=ui.escHtml','function safeAttachmentUrl'])assert(chat.includes(marker),`chat renderer missing ${marker}`);
  for(const marker of ["new finfo(FILEINFO_MIME_TYPE)","KARETA_STORAGE_ROOT.'/uploads/chat/'","$fileUrl='secure-chat/'"]){
    assert(db.includes(marker),`upload hardening missing: ${marker}`);
  }
  assert(read('config.php').includes("dirname(KARETA_ROOT) . '/kareta-storage'"),'private storage defaults inside the public document root');
  const attachment=read('api/chat_attachment.php');
  assert(attachment.includes('chat_participants')&&attachment.includes("if(!$allowed)kareta_json(['ok'=>false,'error'=>'forbidden'],403)"),'attachment endpoint lacks participant authorization');
  assert(attachment.includes("Content-Security-Policy: default-src 'none'"),'attachment response lacks restrictive CSP');
  for(const file of ['runtime_diagnostics.php','readiness.php','release_check.php','deploy_check.php']){
    assert(read(`api/${file}`).includes('kareta_diagnostics_authorized()'),`${file} exposes detailed diagnostics`);
  }
}

authAndOtp();
accessControl();
rolesAndIncidentResponse();
xssUploadsAndDiagnostics();
console.log('R188.5.5.6 security regression tests OK');
