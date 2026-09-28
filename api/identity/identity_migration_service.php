<?php
declare(strict_types=1);

final class KaretaIdentityMigrationService
{
    public function __construct(private PDO $pdo) {}

    public function runBatch(int $afterUserId = 0, int $limit = 100, bool $dryRun = true, ?int $startedByUserId = null): array
    {
        $limit = max(1, min(500, $limit));
        $runKey = $this->uuid();
        $this->pdo->prepare("INSERT INTO identity_migration_runs(run_key,mode,status,started_by_user_id,cursor_user_id,started_at) VALUES(?,?, 'running',?,?,NOW())")
            ->execute([$runKey, $dryRun ? 'dry_run' : 'apply', $startedByUserId, $afterUserId]);
        $runId = (int)$this->pdo->lastInsertId();

        $stats = ['scanned'=>0,'migrated'=>0,'unchanged'=>0,'conflicts'=>0,'failed'=>0,'nextCursor'=>$afterUserId,'hasMore'=>false];
        try {
            $stmt = $this->pdo->prepare("SELECT id,phone,name,role,entry_role,active FROM users WHERE id>? ORDER BY id ASC LIMIT {$limit}");
            $stmt->execute([$afterUserId]);
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($users as $user) {
                $stats['scanned']++;
                $stats['nextCursor'] = (int)$user['id'];
                try {
                    $result = $this->migrateUser($user, $runId, $dryRun);
                    if ($result === 'migrated') $stats['migrated']++;
                    elseif ($result === 'conflict') $stats['conflicts']++;
                    else $stats['unchanged']++;
                } catch (Throwable $e) {
                    $stats['failed']++;
                    $this->recordConflict($runId, 'user', (string)$user['id'], (string)($user['phone'] ?? ''), 'migration_exception', 'blocking', ['message'=>$e->getMessage()]);
                }
            }
            if ($users) {
                $check = $this->pdo->prepare("SELECT 1 FROM users WHERE id>? LIMIT 1");
                $check->execute([$stats['nextCursor']]);
                $stats['hasMore'] = (bool)$check->fetchColumn();
            }
            $this->pdo->prepare("UPDATE identity_migration_runs SET status='completed',cursor_user_id=?,scanned_count=?,migrated_count=?,unchanged_count=?,conflict_count=?,failed_count=?,summary_json=?,finished_at=NOW() WHERE id=?")
                ->execute([$stats['nextCursor'],$stats['scanned'],$stats['migrated'],$stats['unchanged'],$stats['conflicts'],$stats['failed'],json_encode($stats,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$runId]);
            return ['ok'=>true,'runId'=>$runId,'runKey'=>$runKey,'mode'=>$dryRun?'dry_run':'apply'] + $stats;
        } catch (Throwable $e) {
            $this->pdo->prepare("UPDATE identity_migration_runs SET status='failed',error_message=?,finished_at=NOW() WHERE id=?")
                ->execute([mb_substr($e->getMessage(),0,500),$runId]);
            throw $e;
        }
    }

    public function status(): array
    {
        $counts = [];
        foreach (['users','accounts','persons','person_profiles','contexts','identity_legacy_links'] as $table) {
            $counts[$table] = (int)$this->pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
        }
        $counts['openConflicts'] = (int)$this->pdo->query("SELECT COUNT(*) FROM identity_migration_conflicts WHERE status='open'")->fetchColumn();
        $last = $this->pdo->query("SELECT id,run_key AS runKey,mode,status,cursor_user_id AS cursorUserId,scanned_count AS scanned,migrated_count AS migrated,unchanged_count AS unchanged,conflict_count AS conflicts,failed_count AS failed,started_at AS startedAt,finished_at AS finishedAt FROM identity_migration_runs ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC) ?: null;
        return ['ok'=>true,'counts'=>$counts,'lastRun'=>$last];
    }

    private function migrateUser(array $user, int $runId, bool $dryRun): string
    {
        $legacyId = (string)$user['id'];
        $phone = $this->normalizePhone((string)($user['phone'] ?? ''));
        if ($phone === '') {
            $this->recordConflict($runId,'user',$legacyId,'','missing_phone','blocking',['name'=>$user['name'] ?? '']);
            return 'conflict';
        }

        $fingerprint = hash('sha256', json_encode([$phone,(string)($user['name']??''),(string)($user['role']??''),(string)($user['entry_role']??''),(int)($user['active']??1)], JSON_UNESCAPED_UNICODE));
        $existing = $this->pdo->prepare("SELECT fingerprint FROM identity_legacy_links WHERE legacy_type='user' AND legacy_id=? LIMIT 1");
        $existing->execute([$legacyId]);
        if ((string)($existing->fetchColumn() ?: '') === $fingerprint) return 'unchanged';
        if ($dryRun) return 'migrated';

        $this->pdo->beginTransaction();
        try {
            $accountId = $this->ensureAccount($phone, (int)($user['active'] ?? 1));
            $personId = $this->ensurePerson($accountId, trim((string)($user['name'] ?? '')) ?: 'Клиент');
            $clientProfileId = $this->ensureProfile($personId,'client','active','user',$legacyId,['source'=>'stage14a','legacyRole'=>$user['role'] ?? 'client']);
            $personalContextId = $this->ensurePersonalContext($accountId,$personId,$clientProfileId);

            $types = $this->profileTypesForUser($user);
            foreach ($types as $type) {
                if ($type === 'client') continue;
                $status = ((int)($user['active'] ?? 1) === 1) ? 'active' : 'suspended';
                $profileId = $this->ensureProfile($personId,$type,$status,'user',$legacyId,['source'=>'stage14a','legacyRole'=>$user['role'] ?? '']);
                $this->ensureProfileContext($accountId,$personId,$profileId,$type,$status);
            }

            $this->pdo->prepare("INSERT INTO identity_legacy_links(legacy_type,legacy_id,account_id,person_id,profile_id,context_id,fingerprint,migration_revision,migrated_at) VALUES('user',?,?,?,?,?,?,1,NOW()) ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),profile_id=VALUES(profile_id),context_id=VALUES(context_id),fingerprint=VALUES(fingerprint),migration_revision=migration_revision+1,migrated_at=NOW()")
                ->execute([$legacyId,$accountId,$personId,$clientProfileId,$personalContextId,$fingerprint]);
            $this->pdo->commit();
            return 'migrated';
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }

    private function ensureAccount(string $phone, int $active): int
    {
        $q=$this->pdo->prepare("SELECT id,status FROM accounts WHERE phone=? LIMIT 1 FOR UPDATE"); $q->execute([$phone]); $row=$q->fetch(PDO::FETCH_ASSOC);
        $status=$active===1?'active':'blocked';
        if ($row) { $this->pdo->prepare("UPDATE accounts SET status=IF(status='deleted',status,?) WHERE id=?")->execute([$status,(int)$row['id']]); return (int)$row['id']; }
        $this->pdo->prepare("INSERT INTO accounts(phone,status) VALUES(?,?)")->execute([$phone,$status]); return (int)$this->pdo->lastInsertId();
    }

    private function ensurePerson(int $accountId, string $fullname): int
    {
        $q=$this->pdo->prepare("SELECT id,fullname FROM persons WHERE account_id=? LIMIT 1 FOR UPDATE"); $q->execute([$accountId]); $row=$q->fetch(PDO::FETCH_ASSOC);
        if ($row) { if (trim((string)$row['fullname'])==='' && $fullname!=='') $this->pdo->prepare("UPDATE persons SET fullname=? WHERE id=?")->execute([$fullname,(int)$row['id']]); return (int)$row['id']; }
        $this->pdo->prepare("INSERT INTO persons(account_id,fullname,settings,locale,timezone) VALUES(?,?,JSON_OBJECT(),'ru-KZ','Asia/Almaty')")->execute([$accountId,$fullname]); return (int)$this->pdo->lastInsertId();
    }

    private function ensureProfile(int $personId,string $type,string $status,string $legacyType,string $legacyId,array $payload): int
    {
        $this->pdo->prepare("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,legacy_entity_id,payload_json) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=IF(status='archived',status,VALUES(status)),legacy_entity_type=COALESCE(NULLIF(legacy_entity_type,''),VALUES(legacy_entity_type)),legacy_entity_id=COALESCE(legacy_entity_id,VALUES(legacy_entity_id)),payload_json=JSON_MERGE_PATCH(COALESCE(payload_json,JSON_OBJECT()),VALUES(payload_json)),updated_at=CURRENT_TIMESTAMP")
            ->execute([$personId,$type,$status,$legacyType,$legacyId,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $q=$this->pdo->prepare("SELECT id FROM person_profiles WHERE person_id=? AND profile_type=? LIMIT 1"); $q->execute([$personId,$type]); return (int)$q->fetchColumn();
    }

    private function ensurePersonalContext(int $accountId,int $personId,int $profileId): int
    {
        $set=(int)($this->pdo->query("SELECT id FROM capability_sets WHERE code='personal.client' LIMIT 1")->fetchColumn()?:0);
        $key='personal:'.$accountId;
        $this->pdo->prepare("INSERT INTO contexts(context_key,context_type,account_id,person_id,profile_id,capability_set_id,status) VALUES(?,'personal',?,?,?,?, 'active') ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),profile_id=VALUES(profile_id),capability_set_id=COALESCE(contexts.capability_set_id,VALUES(capability_set_id)),status='active'")
            ->execute([$key,$accountId,$personId,$profileId,$set?:null]);
        $q=$this->pdo->prepare("SELECT id FROM contexts WHERE context_key=? LIMIT 1"); $q->execute([$key]); return (int)$q->fetchColumn();
    }

    private function ensureProfileContext(int $accountId,int $personId,int $profileId,string $type,string $status): int
    {
        $setQ=$this->pdo->prepare("SELECT id FROM capability_sets WHERE code=? LIMIT 1"); $setQ->execute(['profile.'.$type]); $set=(int)($setQ->fetchColumn()?:0);
        $key='profile:'.$type.':'.$profileId;
        $this->pdo->prepare("INSERT INTO contexts(context_key,context_type,account_id,person_id,profile_id,capability_set_id,status) VALUES(?,'profile',?,?,?,?,?) ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),profile_id=VALUES(profile_id),capability_set_id=COALESCE(contexts.capability_set_id,VALUES(capability_set_id)),status=VALUES(status)")
            ->execute([$key,$accountId,$personId,$profileId,$set?:null,$status==='active'?'active':'suspended']);
        $q=$this->pdo->prepare("SELECT id FROM contexts WHERE context_key=? LIMIT 1"); $q->execute([$key]); return (int)$q->fetchColumn();
    }

    private function profileTypesForUser(array $user): array
    {
        $types=['client'];
        // entry_role is only an onboarding/UI preference. It is never an
        // authorization source. Professional profiles require an authoritative
        // users.role value or a separately approved role application.
        $role=strtolower(trim((string)($user['role']??'')));
        if (in_array($role,['master','seller','courier'],true)) $types[]=$role;
        $uid=(int)$user['id'];
        if ($this->tableExists('role_applications')) {
            $q=$this->pdo->prepare("SELECT requested_role FROM role_applications WHERE user_id=? AND status='approved'");
            $q->execute([$uid]);
            foreach ($q->fetchAll(PDO::FETCH_COLUMN) ?: [] as $approved) {
                $approved=strtolower(trim((string)$approved));
                if (in_array($approved,['master','seller'],true)) $types[]=$approved;
            }
        }
        if (in_array('master',$types,true) && $this->exists("SELECT 1 FROM masters WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1",[$uid])) $types[]='master';
        if (in_array('seller',$types,true) && $this->tableExists('seller_profiles') && $this->exists("SELECT 1 FROM seller_profiles WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1",[$uid])) $types[]='seller';
        return array_values(array_unique($types));
    }

    private function recordConflict(int $runId,string $legacyType,string $legacyId,string $phone,string $type,string $severity,array $details): void
    {
        $normalized=$this->normalizePhone($phone); $key=hash('sha256',implode('|',[$legacyType,$legacyId,$type,$normalized]));
        $this->pdo->prepare("INSERT INTO identity_migration_conflicts(run_id,conflict_key,legacy_type,legacy_id,normalized_phone,conflict_type,severity,status,details_json,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,'open',?,NOW(),NOW()) ON DUPLICATE KEY UPDATE run_id=VALUES(run_id),severity=VALUES(severity),details_json=VALUES(details_json),last_seen_at=NOW(),status=IF(status='resolved','resolved','open')")
            ->execute([$runId,$key,$legacyType,$legacyId,$normalized,$type,$severity,json_encode($details,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    }

    private function normalizePhone(string $phone): string
    {
        if (function_exists('kareta_normalize_phone')) return (string)kareta_normalize_phone($phone);
        $digits=preg_replace('/\D+/','',$phone)??'';
        if (strlen($digits)===11 && $digits[0]==='8') $digits='7'.substr($digits,1);
        return $digits!==''?'+'.$digits:'';
    }
    private function exists(string $sql,array $params): bool { $q=$this->pdo->prepare($sql);$q->execute($params);return (bool)$q->fetchColumn(); }
    private function tableExists(string $table): bool { $q=$this->pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");$q->execute([$table]);return (int)$q->fetchColumn()>0; }
    private function uuid(): string { $b=random_bytes(16);$b[6]=chr((ord($b[6])&0x0f)|0x40);$b[8]=chr((ord($b[8])&0x3f)|0x80);$h=bin2hex($b);return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20); }
}
