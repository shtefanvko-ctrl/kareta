'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'api/bootstrap.php'),'utf8');
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const legacyStart=src.indexOf('function kareta_idempotency_legacy_actor_hash');
const actorStart=src.indexOf('function kareta_idempotency_actor_hash');
const actorEnd=src.indexOf('function kareta_idempotency_request_hash',actorStart);
const beginStart=src.indexOf('function kareta_idempotency_begin');
const beginEnd=src.indexOf('function kareta_idempotency_complete',beginStart);
expect(legacyStart>=0&&actorStart>legacyStart&&actorEnd>actorStart,'idempotency actor helpers must exist');
expect(beginStart>=0&&beginEnd>beginStart,'idempotency begin must exist');

const actor=src.slice(actorStart,actorEnd);
const begin=src.slice(beginStart,beginEnd);

expect(actor.includes("|account|")&&actor.includes("|context|"),'Identity actor scope must use Account+Context');
expect(actor.includes("|legacy|"),'legacy authenticated actor scope must be stable');
expect(actor.includes("|anonymous|"),'anonymous actor scope must remain isolated');
const legacyReturn=actor.indexOf("if ($legacyId > 0 || $phone !== '')");
const sessionUse=actor.indexOf("session_id()");
expect(legacyReturn>=0&&sessionUse>legacyReturn,'session_id must be used only after authenticated stable scopes return');
expect(actor.includes("SELECT s.account_id,s.current_context_id"),'Identity scope must observe auth_sessions directly');
expect(actor.includes("SELECT id FROM accounts WHERE phone=? AND status='active'"),'legacy identity should resolve stable Account when possible');

expect(begin.includes('$actorHash = kareta_idempotency_actor_hash($action, $pdo);'),'begin must use stable actor scope');
expect(begin.includes('$legacyActorHash = kareta_idempotency_legacy_actor_hash($action);'),'begin must retain old-scope compatibility lookup');
expect(begin.includes('$foundLegacyScope'),'begin must track legacy-scope fallback');

const conflict=begin.indexOf("!hash_equals($storedRequestHash, $requestHash)");
const migrate=begin.indexOf("SET \`actor_hash\`=?");
const replay=begin.indexOf("X-Idempotency-Replayed: 1");
expect(conflict>=0,'request-hash mismatch guard missing');
expect(migrate>conflict,'legacy actor scope may migrate only after request-hash equality is proven');
expect(replay>migrate,'scope migration/revalidation must occur before completed response replay');
expect(begin.includes('$stableRequestHash'),'concurrent stable-row migration collision must revalidate request hash');

if(fail.length){
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('IDEMPOTENCY_SCOPE_84_154: PASS');
