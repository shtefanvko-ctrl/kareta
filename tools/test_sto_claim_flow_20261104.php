<?php
declare(strict_types=1);
error_reporting(E_ALL);
require_once dirname(__DIR__).'/api/sto_claim_service.php';

function kareta_table_exists(PDO $pdo,string $table): bool {
    $q=$pdo->prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
    $q->execute([$table]);return (bool)$q->fetchColumn();
}
function check(bool $condition,string $name): void {
    if (!$condition) throw new RuntimeException('FAIL '.$name);
    echo "PASS ".$name.PHP_EOL;
}
function rejects(callable $action,string $code,string $name): void {
    try{$action();throw new RuntimeException('Unexpected allow: '.$name);}
    catch(DomainException $e){check($e->getMessage()===$code,$name.' ['.$code.']');}
}
class ClaimQaPDO extends PDO {
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $query=preg_replace('/\s+FOR UPDATE\b/i','',$query);
        $query=str_replace('NOW()-INTERVAL 1 DAY',"datetime('now','-1 day')",$query);
        $query=preg_replace('/TIMESTAMPDIFF\(DAY,updated_at,NOW\(\)\)/',"CAST(julianday('now')-julianday(updated_at) AS INTEGER)",$query);
        return parent::prepare($query,$options);
    }
}
$pdo=new ClaimQaPDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->sqliteCreateFunction('NOW',fn()=>date('Y-m-d H:i:s'));
$pdo->exec("CREATE TABLE sto_directory_candidates (
    id TEXT PRIMARY KEY,fingerprint TEXT UNIQUE,name TEXT NOT NULL,city TEXT NOT NULL,
    address TEXT NOT NULL,description TEXT,source_url TEXT NOT NULL,source_checked_at TEXT,
    directory_visible INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'unclaimed',
    linked_sto_id TEXT,approved_owner_account_id INTEGER)");
$pdo->exec("CREATE TABLE sto_directory_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,candidate_id TEXT NOT NULL,
    claimant_account_id INTEGER NOT NULL,claimant_user_id INTEGER NOT NULL,
    evidence_method TEXT,evidence_reference TEXT,status TEXT NOT NULL DEFAULT 'pending',
    reviewer_account_id INTEGER,verification_method TEXT,verification_reference TEXT,
    reviewed_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id,claimant_account_id))");
$pdo->exec("CREATE TABLE sto_directory_claim_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,claim_id INTEGER,candidate_id TEXT,
    actor_account_id INTEGER,event_type TEXT,metadata_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$pdo->exec("CREATE TABLE sto_profiles (id TEXT,name TEXT,city TEXT,address TEXT)");
$pdo->prepare("INSERT INTO sto_directory_candidates
    (id,fingerprint,name,city,address,description,source_url,directory_visible)
    VALUES(?,?,?,?,?,?,?,1)")->execute([
    'sto_test_alpha',str_repeat('a',64),'Тестовое СТО','Усть-Каменогорск','Тестовая, 1',
    'Реальные услуги подтверждаются владельцем','https://example.org/sto'
]);
$owner=['account_id'=>11,'user_id'=>22,'phone'=>'+77000000000'];
$other=['account_id'=>12,'user_id'=>23,'phone'=>'+77000000001'];
$reviewer=['account_id'=>99,'user_id'=>98,'phone'=>'+77000000002'];
$claimData=['candidateId'=>'sto_test_alpha','evidenceMethod'=>'registry',
    'evidenceReference'=>'https://example.org/registry/proof','applicantAttests'=>true];
$public=ksto_public_list($pdo,['city'=>'Усть-Каменогорск']);
check(count($public)===1 && $public[0]['canBook']===false && $public[0]['rating']===null,'unclaimed listing never bookable/rated');
rejects(fn()=>ksto_request_claim($pdo,$owner,array_merge($claimData,['applicantAttests'=>false])),
    'applicant_attestation_required','missing consent forbidden');
rejects(fn()=>ksto_activate($pdo,$owner,['candidateId'=>'sto_test_alpha','confirmBusinessDetails'=>true]),
    'activation_not_authorized','activation before review forbidden');
$created=ksto_request_claim($pdo,$owner,$claimData);
check($created['status']==='pending' && $created['claimId']>0,'claim created pending');
$again=ksto_request_claim($pdo,$owner,$claimData);
check($again['claimId']===$created['claimId'] && $again['alreadySubmitted']===true,'duplicate claim idempotent');
$another=ksto_request_claim($pdo,$other,$claimData);
check($another['claimId']!==$created['claimId'],'competing claim isolated');
rejects(fn()=>ksto_review($pdo,$owner,['claimId'=>$created['claimId'],'decision'=>'approve',
    'verificationMethod'=>'registry','verificationReference'=>'state registry check 123']),
    'self_approval_denied','self approval rejected');
rejects(fn()=>ksto_review($pdo,$reviewer,['claimId'=>$created['claimId'],'decision'=>'approve',
    'verificationMethod'=>'registry','verificationReference'=>'tiny']),
    'independent_verification_required','weak verification rejected');
$approved=ksto_review($pdo,$reviewer,['claimId'=>$created['claimId'],'decision'=>'approve',
    'verificationMethod'=>'registry','verificationReference'=>'state registry verified 123']);
check($approved['status']==='approved' && $approved['ownerAccessGranted']===false,'approval gives no permissions');
$otherClaim=$pdo->query("SELECT status FROM sto_directory_claims WHERE id=".$another['claimId'])->fetchColumn();
check($otherClaim==='rejected','competing claim rejected');
rejects(fn()=>ksto_activate($pdo,$other,['candidateId'=>'sto_test_alpha','confirmBusinessDetails'=>true]),
    'activation_not_authorized','different identity cannot activate');
rejects(fn()=>ksto_activate($pdo,$owner,['candidateId'=>'sto_test_alpha','confirmBusinessDetails'=>false]),
    'activation_confirmation_required','consent required to activate');
$activated=ksto_activate($pdo,$owner,['candidateId'=>'sto_test_alpha','confirmBusinessDetails'=>true]);
check($activated['ownerVerified']===true && $activated['workingAccountCreated']===false
    && $activated['bookingEnabled']===false,'owner claim activated WITHOUT role grants');
$live=$pdo->query("SELECT status,linked_sto_id FROM sto_directory_candidates WHERE id='sto_test_alpha'")->fetch(PDO::FETCH_ASSOC);
check($live['status']==='activated' && $live['linked_sto_id']===null,'no legacy STO account linked');
check((int)$pdo->query('SELECT COUNT(*) FROM sto_profiles')->fetchColumn()===0,'no active or inactive STO profile created');
rejects(fn()=>ksto_activate($pdo,$owner,['candidateId'=>'sto_test_alpha','confirmBusinessDetails'=>true]),
    'activation_not_authorized','double activation denied');
rejects(fn()=>ksto_save_own_draft($pdo,$other,['candidateId'=>'sto_test_alpha',
    'description'=>'Alien profile edit is not allowed']),
    'draft_not_authorized','other user cannot change description');
$saved=ksto_save_own_draft($pdo,$owner,['candidateId'=>'sto_test_alpha',
    'description'=>'Официально подтверждённая независимая организация']);
check($saved['saved']===true && $saved['publishedOffers']===false,'owner can edit only directory description');
$after=ksto_public_list($pdo,['city'=>'Усть-Каменогорск','search'=>'Тестовое']);
check(count($after)===1 && $after[0]['accountStatus']==='activated' && !$after[0]['canBook'],'verified listing still not bookable');
check((int)$pdo->query('SELECT COUNT(*) FROM sto_directory_claim_audit')->fetchColumn()>=4,'audit trail captured');
echo "DONE isolated SQLite functional QA (no production or staging database writes)".PHP_EOL;
