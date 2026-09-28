<?php
declare(strict_types=1);
final class KaretaProfileService {
  public function __construct(private PDO $pdo) {}
  public function ensureClient(int $personId): array {
    $st=$this->pdo->prepare("INSERT INTO person_profiles(person_id,profile_type,status,payload_json) VALUES(?,'client','active',JSON_OBJECT('source','session_core')) ON DUPLICATE KEY UPDATE status=IF(status='archived','active',status),updated_at=CURRENT_TIMESTAMP");
    $st->execute([$personId]);
    $q=$this->pdo->prepare("SELECT * FROM person_profiles WHERE person_id=? AND profile_type='client' LIMIT 1"); $q->execute([$personId]);
    return $q->fetch(PDO::FETCH_ASSOC)?:[];
  }
}
