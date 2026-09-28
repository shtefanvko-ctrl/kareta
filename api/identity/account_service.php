<?php
declare(strict_types=1);
final class KaretaAccountService {
  public function __construct(private PDO $pdo) {}
  public function ensure(string $phone, string $fullname=''): array {
    $phone = function_exists('kareta_normalize_phone') ? kareta_normalize_phone($phone) : preg_replace('/\D+/', '', $phone);
    if ($phone==='') throw new InvalidArgumentException('invalid_phone');
    $this->pdo->beginTransaction();
    try {
      $st=$this->pdo->prepare("SELECT a.*,p.id AS person_id,p.fullname FROM accounts a LEFT JOIN persons p ON p.account_id=a.id WHERE a.phone=? LIMIT 1 FOR UPDATE");
      $st->execute([$phone]); $row=$st->fetch(PDO::FETCH_ASSOC);
      if (!$row) {
        $this->pdo->prepare("INSERT INTO accounts(phone,status) VALUES(?,'active')")->execute([$phone]);
        $accountId=(int)$this->pdo->lastInsertId();
        $legacyName=$fullname;
        if ($legacyName==='') { $q=$this->pdo->prepare("SELECT name FROM users WHERE phone=? LIMIT 1"); $q->execute([$phone]); $legacyName=(string)($q->fetchColumn()?:'Клиент'); }
        $this->pdo->prepare("INSERT INTO persons(account_id,fullname,settings,locale,timezone) VALUES(?,?,JSON_OBJECT(),'ru-KZ','Asia/Almaty')")->execute([$accountId,$legacyName?:'Клиент']);
        $personId=(int)$this->pdo->lastInsertId();
      } else {
        if (($row['status']??'active')!=='active') throw new DomainException('account_not_active');
        $accountId=(int)$row['id']; $personId=(int)($row['person_id']??0);
        if ($personId<=0) { $this->pdo->prepare("INSERT INTO persons(account_id,fullname,settings,locale,timezone) VALUES(?,?,JSON_OBJECT(),'ru-KZ','Asia/Almaty')")->execute([$accountId,$fullname?:'Клиент']); $personId=(int)$this->pdo->lastInsertId(); }
        elseif ($fullname!=='' && trim((string)($row['fullname']??''))==='') $this->pdo->prepare("UPDATE persons SET fullname=? WHERE id=?")->execute([$fullname,$personId]);
      }
      $this->pdo->commit();
      return ['id'=>$accountId,'phone'=>$phone,'status'=>'active','personId'=>$personId];
    } catch(Throwable $e) { if($this->pdo->inTransaction())$this->pdo->rollBack(); throw $e; }
  }
}
