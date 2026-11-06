<?php
declare(strict_types=1);

/**
 * STO directory claim workflow. Not a login or an OTP bypass.
 * Production exposure requires migration, RBAC E2E and release approval.
 */
require_once __DIR__.'/identity/auth_resolver.php';

function ksto_text(mixed $value, int $max=512): string {
    if (!is_string($value) && !is_numeric($value)) return '';
    return mb_substr(trim(preg_replace('/[\x00-\x1f\x7f]/u', ' ', (string)$value) ?? ''), 0, $max, 'UTF-8');
}

function ksto_require_schema(PDO $pdo): void {
    foreach (['sto_directory_candidates','sto_directory_claims','sto_directory_claim_audit'] as $table) {
        if (!kareta_table_exists($pdo,$table)) throw new DomainException('claim_schema_unavailable');
    }
}

function ksto_actor(PDO $pdo, bool $administrator=false): array {
    $auth=(new KaretaAuthResolver($pdo))->resolve(true);
    // Require an actual Identity session established via verified authentication,
    // never a client-selected role, target phone, or compatibility-only session.
    if (!$auth->identitySession || (int)$auth->accountId<=0) throw new DomainException('identity_session_required');
    $stmt=$pdo->prepare("SELECT a.id account_id,a.phone,u.id user_id,u.role
        FROM accounts a JOIN users u ON u.phone=a.phone AND u.active=1
        WHERE a.id=? AND a.status='active' LIMIT 1");
    $stmt->execute([(int)$auth->accountId]);
    $row=$stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || (int)$row['user_id']<=0) throw new DomainException('active_account_required');
    if ($administrator && !in_array(strtolower((string)$row['role']),['admin','owner'],true)) {
        throw new DomainException('admin_required');
    }
    return $row;
}

function ksto_audit(PDO $pdo, ?int $claimId, string $candidateId, int $actorId, string $event, array $meta=[]): void {
    $q=$pdo->prepare("INSERT INTO sto_directory_claim_audit
        (claim_id,candidate_id,actor_account_id,event_type,metadata_json) VALUES(?,?,?,?,?)");
    $q->execute([$claimId,$candidateId,$actorId,$event,json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
}

function ksto_public_list(PDO $pdo, array $query): array {
    ksto_require_schema($pdo);
    $where=["status IN ('unclaimed','activated')","directory_visible=1"];
    $args=[];
    $city=ksto_text($query['city']??'',120);
    $search=ksto_text($query['search']??'',100);
    if ($city!=='') { $where[]="city=?"; $args[]=$city; }
    if ($search!=='') {
        $where[]="(name LIKE ? OR address LIKE ? OR description LIKE ?)";
        $like='%'.$search.'%';
        array_push($args,$like,$like,$like);
    }
    $q=$pdo->prepare("SELECT id,name,city,address,description,source_url,source_checked_at,status
        FROM sto_directory_candidates WHERE ".implode(' AND ',$where)." ORDER BY name LIMIT 100");
    $q->execute($args);
    return array_map(static fn(array $row): array=>[
        'id'=>$row['id'],'name'=>$row['name'],'city'=>$row['city'],
        'address'=>$row['address'],'description'=>$row['description']??'',
        'sourceUrl'=>$row['source_url'],'sourceCheckedAt'=>$row['source_checked_at'],
        'accountStatus'=>$row['status'],'canBook'=>false,'canChat'=>false,
        'rating'=>null,'ordersCount'=>null
    ],$q->fetchAll(PDO::FETCH_ASSOC)?:[]);
}

function ksto_mine(PDO $pdo, array $actor): array {
    ksto_require_schema($pdo);
    $q=$pdo->prepare("SELECT c.id,c.candidate_id,c.status,c.created_at,c.reviewed_at,
        d.name,d.city,d.address,d.status AS directory_status,d.linked_sto_id
        FROM sto_directory_claims c JOIN sto_directory_candidates d ON d.id=c.candidate_id
        WHERE c.claimant_account_id=? ORDER BY c.created_at DESC LIMIT 30");
    $q->execute([(int)$actor['account_id']]);
    return $q->fetchAll(PDO::FETCH_ASSOC)?:[];
}

function ksto_request_claim(PDO $pdo, array $actor, array $body): array {
    ksto_require_schema($pdo);
    $id=ksto_text($body['candidateId']??'',64);
    $method=ksto_text($body['evidenceMethod']??'',40);
    $reference=ksto_text($body['evidenceReference']??'',512);
    if (!preg_match('/^[a-zA-Z0-9_-]{3,64}$/D',$id)) throw new DomainException('invalid_candidate');
    if (!in_array($method,['registry','official_website','authorization_letter','onsite'],true)) throw new DomainException('invalid_evidence_method');
    if (mb_strlen($reference,'UTF-8')<10) throw new DomainException('evidence_reference_required');
    if (($body['applicantAttests']??false)!==true) throw new DomainException('applicant_attestation_required');
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare("SELECT id,status,directory_visible FROM sto_directory_candidates WHERE id=? LIMIT 1 FOR UPDATE");
        $q->execute([$id]);$candidate=$q->fetch(PDO::FETCH_ASSOC);
        if (!$candidate || $candidate['status']!=='unclaimed' || (int)$candidate['directory_visible']!==1) {
            throw new DomainException('candidate_not_claimable');
        }
        $q=$pdo->prepare("SELECT id,status,updated_at FROM sto_directory_claims
            WHERE candidate_id=? AND claimant_account_id=? LIMIT 1 FOR UPDATE");
        $q->execute([$id,(int)$actor['account_id']]);$existing=$q->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            if ($existing['status']==='pending') {
                $pdo->commit();
                return ['claimId'=>(int)$existing['id'],'status'=>'pending','alreadySubmitted'=>true];
            }
            if ($existing['status']==='approved') throw new DomainException('already_approved');
            $q=$pdo->prepare("SELECT TIMESTAMPDIFF(DAY,updated_at,NOW()) FROM sto_directory_claims WHERE id=?");
            $q->execute([(int)$existing['id']]);
            if ((int)$q->fetchColumn()<7) throw new DomainException('claim_retry_cooldown');
        }
        $q=$pdo->prepare("SELECT COUNT(*) FROM sto_directory_claims
            WHERE claimant_account_id=? AND created_at>=NOW()-INTERVAL 1 DAY");
        $q->execute([(int)$actor['account_id']]);
        if ((int)$q->fetchColumn()>=3) throw new DomainException('claim_daily_limit');
        if ($existing) {
            $q=$pdo->prepare("UPDATE sto_directory_claims SET evidence_method=?,evidence_reference=?,
                status='pending',reviewer_account_id=NULL,verification_method=NULL,
                verification_reference=NULL,reviewed_at=NULL,created_at=NOW() WHERE id=?");
            $q->execute([$method,$reference,(int)$existing['id']]);
            $claimId=(int)$existing['id'];
        } else {
            $q=$pdo->prepare("INSERT INTO sto_directory_claims
                (candidate_id,claimant_account_id,claimant_user_id,evidence_method,evidence_reference)
                VALUES(?,?,?,?,?)");
            $q->execute([$id,(int)$actor['account_id'],(int)$actor['user_id'],$method,$reference]);
            $claimId=(int)$pdo->lastInsertId();
        }
        ksto_audit($pdo,$claimId,$id,(int)$actor['account_id'],'claim_submitted',['evidenceMethod'=>$method]);
        $pdo->commit();
        return ['claimId'=>$claimId,'status'=>'pending','message'=>'Заявка отправлена на проверку. Права владельца пока не предоставлены.'];
    } catch(Throwable $e) { if($pdo->inTransaction())$pdo->rollBack();throw $e; }
}

function ksto_review_queue(PDO $pdo, array $actor): array {
    ksto_require_schema($pdo);
    $q=$pdo->query("SELECT c.id,c.candidate_id,c.claimant_account_id,c.evidence_method,c.evidence_reference,
        c.created_at,d.name,d.city,d.address,d.source_url
        FROM sto_directory_claims c JOIN sto_directory_candidates d ON d.id=c.candidate_id
        WHERE c.status='pending' AND d.status='unclaimed' ORDER BY c.created_at LIMIT 100");
    return $q->fetchAll(PDO::FETCH_ASSOC)?:[];
}

function ksto_review(PDO $pdo, array $actor, array $body): array {
    ksto_require_schema($pdo);
    $claimId=(int)($body['claimId']??0);
    $decision=ksto_text($body['decision']??'',20);
    $verification=ksto_text($body['verificationMethod']??'',40);
    $reference=ksto_text($body['verificationReference']??'',512);
    if ($claimId<=0 || !in_array($decision,['approve','reject'],true)) throw new DomainException('review_invalid');
    if ($decision==='approve') {
        if (!in_array($verification,['registry','legal_documents','official_business_contact','in_person'],true)
            || mb_strlen($reference,'UTF-8')<12) throw new DomainException('independent_verification_required');
    }
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare("SELECT candidate_id FROM sto_directory_claims WHERE id=? LIMIT 1");
        $q->execute([$claimId]);$candidateId=(string)($q->fetchColumn()?:'');
        if ($candidateId==='') throw new DomainException('claim_not_found');
        $q=$pdo->prepare("SELECT * FROM sto_directory_candidates WHERE id=? FOR UPDATE");
        $q->execute([$candidateId]);$candidate=$q->fetch(PDO::FETCH_ASSOC);
        $q=$pdo->prepare("SELECT * FROM sto_directory_claims WHERE id=? FOR UPDATE");
        $q->execute([$claimId]);$claim=$q->fetch(PDO::FETCH_ASSOC);
        if (!$candidate || !$claim || $claim['candidate_id']!==$candidateId || $claim['status']!=='pending'
            || $candidate['status']!=='unclaimed') throw new DomainException('claim_state_changed');
        if ((int)$actor['account_id']===(int)$claim['claimant_account_id']) throw new DomainException('self_approval_denied');
        if ($decision==='approve') {
            if (trim((string)$candidate['address'])==='') throw new DomainException('candidate_address_required');
            // Never auto-claim an already active provider; escalate potential duplicates.
            $q=$pdo->prepare("SELECT id FROM sto_profiles
                WHERE LOWER(name)=LOWER(?) AND LOWER(city)=LOWER(?) AND LOWER(address)=LOWER(?)
                LIMIT 1");
            $q->execute([$candidate['name'],$candidate['city'],$candidate['address']]);
            if ($q->fetchColumn()) throw new DomainException('existing_sto_merge_review_required');
            $q=$pdo->prepare("UPDATE sto_directory_candidates
                SET status='claimed_pending_setup',approved_owner_account_id=? WHERE id=? AND status='unclaimed'");
            $q->execute([(int)$claim['claimant_account_id'],$candidateId]);
            if ($q->rowCount()!==1) throw new DomainException('claim_state_changed');
        }
        $status=$decision==='approve'?'approved':'rejected';
        $q=$pdo->prepare("UPDATE sto_directory_claims SET status=?,reviewer_account_id=?,
            verification_method=?,verification_reference=?,reviewed_at=NOW() WHERE id=? AND status='pending'");
        $q->execute([$status,(int)$actor['account_id'],$verification?:null,$reference?:null,$claimId]);
        if ($q->rowCount()!==1) throw new DomainException('claim_state_changed');
        if ($decision==='approve') {
            $pdo->prepare("UPDATE sto_directory_claims SET status='rejected',verification_method='other_owner_verified',
                reviewer_account_id=?,reviewed_at=NOW()
                WHERE candidate_id=? AND id<>? AND status='pending'")
                ->execute([(int)$actor['account_id'],$candidateId,$claimId]);
        }
        ksto_audit($pdo,$claimId,$candidateId,(int)$actor['account_id'],'review_'.$status,[
            'verificationMethod'=>$verification, 'reviewReferenceSha256'=>hash('sha256',$reference)
        ]);
        $pdo->commit();
        return ['claimId'=>$claimId,'status'=>$status,'ownerAccessGranted'=>false,
            'message'=>$status==='approved'?'Владелец проверен. Ожидается активация профиля.':'Заявка отклонена.'];
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function ksto_activate(PDO $pdo,array $actor,array $body): array {
    ksto_require_schema($pdo);
    $candidateId=ksto_text($body['candidateId']??'',64);
    $consented=($body['confirmBusinessDetails']??false)===true;
    if (!preg_match('/^[a-zA-Z0-9_-]{3,64}$/D',$candidateId)||!$consented) {
        throw new DomainException('activation_confirmation_required');
    }
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare("SELECT * FROM sto_directory_candidates WHERE id=? FOR UPDATE");
        $q->execute([$candidateId]);$candidate=$q->fetch(PDO::FETCH_ASSOC);
        if (!$candidate || $candidate['status']!=='claimed_pending_setup'
            || (int)$candidate['approved_owner_account_id']!==(int)$actor['account_id']) {
            throw new DomainException('activation_not_authorized');
        }
        $q=$pdo->prepare("SELECT id FROM sto_directory_claims
            WHERE candidate_id=? AND claimant_account_id=? AND status='approved' LIMIT 1 FOR UPDATE");
        $q->execute([$candidateId,(int)$actor['account_id']]);$claimId=(int)$q->fetchColumn();
        if ($claimId<=0) throw new DomainException('approved_claim_required');
        // Auth issue #167: organization.owner currently carries unscoped wildcard '*'.
        // Never issue an organization membership or a legacy STO profile here.
        // Activate ONLY the independently verified owner claim for this directory entry.
        $q=$pdo->prepare("UPDATE sto_directory_candidates
            SET status='activated' WHERE id=? AND status='claimed_pending_setup'
              AND approved_owner_account_id=? AND linked_sto_id IS NULL");
        $q->execute([$candidateId,(int)$actor['account_id']]);
        if ($q->rowCount()!==1) throw new DomainException('activation_state_changed');
        ksto_audit($pdo,$claimId,$candidateId,(int)$actor['account_id'],'directory_claim_activated',[
            'workingAccountCreated'=>false,'publishedOffers'=>false,'bookingEnabled'=>false
        ]);
        $pdo->commit();
        return ['status'=>'activated','candidateId'=>$candidateId,'bookingEnabled'=>false,
            'workingAccountCreated'=>false,'ownerVerified'=>true,
            'message'=>'Владение карточкой подтверждено и активировано. Рабочий кабинет и запись будут доступны после отдельной безопасной привязки СТО.'];
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function ksto_save_own_draft(PDO $pdo,array $actor,array $body): array {
    ksto_require_schema($pdo);
    $candidateId=ksto_text($body['candidateId']??'',64);
    $description=ksto_text($body['description']??'',1000);
    if (!preg_match('/^[a-zA-Z0-9_-]{3,64}$/D',$candidateId)) throw new DomainException('invalid_candidate');
    if (mb_strlen($description,'UTF-8')<10) throw new DomainException('description_required');
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare("SELECT id FROM sto_directory_candidates
            WHERE id=? AND status='activated' AND approved_owner_account_id=? FOR UPDATE");
        $q->execute([$candidateId,(int)$actor['account_id']]);
        if (!$q->fetchColumn()) throw new DomainException('draft_not_authorized');
        // This is directory-only content: it grants no role, workflow access,
        // messaging, booking, services, pricing or public publication.
        $q=$pdo->prepare("UPDATE sto_directory_candidates SET description=?
            WHERE id=? AND approved_owner_account_id=? AND status='activated'");
        $q->execute([$description,$candidateId,(int)$actor['account_id']]);
        ksto_audit($pdo,null,$candidateId,(int)$actor['account_id'],'directory_draft_updated');
        $pdo->commit();
        return ['saved'=>true,'publishedOffers'=>false];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
