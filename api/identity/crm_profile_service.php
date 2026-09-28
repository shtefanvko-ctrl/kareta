<?php
declare(strict_types=1);
final class KaretaCrmProfileService {
 public function __construct(private PDO $pdo){}
 public function profiles(int $personId):array{
  $s=$this->pdo->prepare("SELECT profile_type AS type,status,legacy_entity_type AS legacyType,legacy_entity_id AS legacyId FROM person_profiles WHERE person_id=? ORDER BY FIELD(profile_type,'client','master','seller'),profile_type");
  $s->execute([$personId]);return $s->fetchAll(PDO::FETCH_ASSOC)?:[];
 }
 public function legacyUserIds(int $personId):array{
  $s=$this->pdo->prepare("SELECT legacy_user_id FROM identity_crm_person_links WHERE person_id=? ORDER BY legacy_user_id");$s->execute([$personId]);return array_map('intval',$s->fetchAll(PDO::FETCH_COLUMN)?:[]);
 }
}
