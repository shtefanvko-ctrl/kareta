<?php
declare(strict_types=1);

final class KaretaChallengeRateLimitException extends DomainException {
  private int $retryAfterSeconds;
  public function __construct(int $retryAfterSeconds=60){
    parent::__construct('challenge_rate_limited');
    $this->retryAfterSeconds=max(1,$retryAfterSeconds);
  }
  public function retryAfter(): int { return $this->retryAfterSeconds; }
}

final class KaretaOtpDeliveryException extends DomainException {
  public function __construct(
    string $publicCode='otp_delivery_failed',
    private string $deliveryCategory='provider_failure',
    private int $providerStatus=0,
    private int $retryAfterSeconds=15
  ){
    parent::__construct($publicCode);
  }
  public function deliveryCategory(): string { return $this->deliveryCategory; }
  public function providerStatus(): int { return max(0,$this->providerStatus); }
  public function retryAfter(): int { return max(0,$this->retryAfterSeconds); }
}

function kareta_challenge_retry_after(Throwable $error): int {
  if($error instanceof KaretaChallengeRateLimitException)return $error->retryAfter();
  if($error instanceof KaretaOtpDeliveryException)return $error->retryAfter();
  if($error->getMessage()==='challenge_rate_limited')return 60;
  if($error->getMessage()==='otp_delivery_failed')return 15;
  return 0;
}

function kareta_challenge_http_status(Throwable $error): int {
  $code=$error->getMessage();
  if($code==='challenge_rate_limited')return 429;
  if($code==='otp_delivery_failed')return 502;
  if($code==='otp_delivery_unavailable')return 503;
  return 503;
}

function kareta_challenge_error_payload(Throwable $error,array $extra=[]): array {
  $payload=array_merge(['ok'=>false,'error'=>$error->getMessage()],$extra);
  $retryAfter=kareta_challenge_retry_after($error);
  if($retryAfter>0)$payload['retryAfter']=$retryAfter;
  if($error instanceof KaretaOtpDeliveryException){
    $payload['deliveryCategory']=$error->deliveryCategory();
    if($error->providerStatus()>0)$payload['providerStatus']=$error->providerStatus();
  }
  return $payload;
}

final class KaretaChallengeService {
  public function __construct(private PDO $pdo) {}

  public function create(string $phone,string $purpose='login'): array {
    $phone=kareta_normalize_phone($phone); if($phone==='')throw new InvalidArgumentException('invalid_phone');
    if(!in_array($purpose,['login','phone_change','recovery'],true))throw new InvalidArgumentException('invalid_purpose');
    $lock='kareta_otp_'.substr(hash('sha256',$phone.'|'.$purpose),0,40);
    $lockStmt=$this->pdo->prepare("SELECT GET_LOCK(?,3)");$lockStmt->execute([$lock]);
    if((int)$lockStmt->fetchColumn()!==1)throw new KaretaChallengeRateLimitException(3);
    try {
      $ipHash=hash('sha256',(string)($_SERVER['REMOTE_ADDR']??'unknown'));
      $transport=$this->effectiveTransport();
      $temporaryStatic=$transport==='test_static' && $this->temporaryStaticMode();
      // Commissioning code 0000 is intentionally reusable for rapid logout/relogin testing.
      // Keep the per-phone named lock (above) to prevent concurrent duplicate writes, but do
      // not let historical auth_challenges turn a valid repeated test login into HTTP 429.
      if(!$temporaryStatic){
        $ipMinute=$this->pdo->prepare("SELECT COUNT(*) AS total,COALESCE(TIMESTAMPDIFF(SECOND,MIN(created_at),NOW()),0) AS window_age FROM auth_challenges WHERE request_ip_hash=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE)");
        $ipMinute->execute([$ipHash]);$ipMinuteState=$ipMinute->fetch(PDO::FETCH_ASSOC)?:[];
        if((int)($ipMinuteState['total']??0)>=5)throw new KaretaChallengeRateLimitException(max(1,60-(int)($ipMinuteState['window_age']??0)));
        $ipHour=$this->pdo->prepare("SELECT COUNT(*) AS total,COALESCE(TIMESTAMPDIFF(SECOND,MIN(created_at),NOW()),0) AS window_age FROM auth_challenges WHERE request_ip_hash=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)");
        $ipHour->execute([$ipHash]);$ipHourState=$ipHour->fetch(PDO::FETCH_ASSOC)?:[];
        if((int)($ipHourState['total']??0)>=20)throw new KaretaChallengeRateLimitException(max(1,3600-(int)($ipHourState['window_age']??0)));
        $recent=$this->pdo->prepare("SELECT COALESCE(TIMESTAMPDIFF(SECOND,MAX(created_at),NOW()),60) FROM auth_challenges WHERE phone=? AND purpose=? AND created_at>DATE_SUB(NOW(),INTERVAL 60 SECOND)");
        $recent->execute([$phone,$purpose]);$recentAge=(int)$recent->fetchColumn();
        if($recentAge<60)throw new KaretaChallengeRateLimitException(max(1,60-$recentAge));
        $hourly=$this->pdo->prepare("SELECT COUNT(*) AS total,COALESCE(TIMESTAMPDIFF(SECOND,MIN(created_at),NOW()),0) AS window_age FROM auth_challenges WHERE phone=? AND purpose=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)");
        $hourly->execute([$phone,$purpose]);$hourlyState=$hourly->fetch(PDO::FETCH_ASSOC)?:[];
        if((int)($hourlyState['total']??0)>=5)throw new KaretaChallengeRateLimitException(max(1,3600-(int)($hourlyState['window_age']??0)));
      }
      $code=$transport==='test_static'?$this->configuredTestCode():(string)random_int(100000,999999);
      $key=hash('sha256',random_bytes(32));
      $this->pdo->prepare("INSERT INTO auth_challenges(challenge_key,phone,code_hash,purpose,request_ip_hash,expires_at) VALUES(?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))")->execute([$key,$phone,password_hash($code,PASSWORD_DEFAULT),$purpose,$ipHash]);
      try {
        $this->deliver($phone,$code,$purpose,$transport);
      } catch(Throwable $error) {
        // A provider/configuration failure is not a user rate-limit event. Remove the
        // undelivered challenge completely so retries are not punished with 429.
        $this->pdo->prepare("DELETE FROM auth_challenges WHERE challenge_key=?")->execute([$key]);
        throw $error;
      }
      // Invalidate older codes only after the replacement code was actually delivered.
      $this->pdo->prepare("UPDATE auth_challenges SET consumed_at=NOW() WHERE phone=? AND purpose=? AND challenge_key<>? AND consumed_at IS NULL")->execute([$phone,$purpose,$key]);

      $result=[
        'challengeKey'=>$key,'phone'=>$phone,'expiresIn'=>600,'resendAfter'=>$temporaryStatic?1:60,
        'deliveryMode'=>$transport,'codeLength'=>strlen($code),'testMode'=>$transport==='test_static',
      ];
      if($transport==='test_static'){
        $result['testCode']=$code;
        if($this->temporaryStaticMode()){
          $result['temporaryStatic']=true;
          $result['temporaryStaticUntil']=(string)(KARETA_OTP['temporary_static_until']??'');
        }
      } elseif($this->developmentMode())$result['devCode']=$code;
      return $result;
    } finally {
      try{$release=$this->pdo->prepare("SELECT RELEASE_LOCK(?)");$release->execute([$lock]);}catch(Throwable $_error){}
    }
  }

  public function verify(string $key,string $code): array {
    if(!$this->validCodeFormat($code))throw new InvalidArgumentException('invalid_code_format');
    $this->pdo->beginTransaction(); try {
      $st=$this->pdo->prepare("SELECT *, CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END AS challenge_expired FROM auth_challenges WHERE challenge_key=? LIMIT 1 FOR UPDATE"); $st->execute([$key]); $row=$st->fetch(PDO::FETCH_ASSOC);
      if(!$row)throw new DomainException('challenge_not_found');
      if($row['consumed_at']!==null)throw new DomainException('challenge_consumed');
      if((int)($row['challenge_expired']??0)===1)throw new DomainException('challenge_expired');
      if((int)$row['attempts']>=(int)$row['max_attempts'])throw new DomainException('challenge_attempts_exceeded');
      if(!password_verify($code,(string)$row['code_hash'])) { $this->pdo->prepare("UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?")->execute([(int)$row['id']]); $this->pdo->commit(); throw new DomainException('invalid_code'); }
      $this->pdo->prepare("UPDATE auth_challenges SET consumed_at=NOW() WHERE id=?")->execute([(int)$row['id']]); $this->pdo->commit(); return $row;
    } catch(Throwable $e){ if($this->pdo->inTransaction())$this->pdo->rollBack(); throw $e; }
  }

  private function effectiveTransport(): string {
    $transport=strtolower(trim((string)(KARETA_OTP['transport']??'webhook')));
    $allowFallback=(bool)(KARETA_OTP['allow_test_fallback']??false);
    if($this->productionMode()){
      if($this->temporaryStaticMode())return 'test_static';
      // Outside the explicit commissioning window production is fail-closed:
      // only an HTTPS webhook may deliver OTP.
      $url=trim((string)(KARETA_OTP['webhook_url']??''));
      $host=strtolower((string)(parse_url($url,PHP_URL_HOST)?:''));
      $placeholder=$host==='' || str_ends_with($host,'.example') || in_array($host,['example.com','www.example.com'],true);
      if($transport!=='webhook' || $url==='' || !str_starts_with(strtolower($url),'https://') || $placeholder){
        throw new KaretaOtpDeliveryException('otp_delivery_unavailable','provider_not_configured',0,60);
      }
      return 'webhook';
    }
    if(in_array($transport,['test','static','test_static'],true))return 'test_static';
    if($transport==='disabled' && $allowFallback)return 'test_static';
    if($transport==='webhook' && $allowFallback){
      $url=trim((string)(KARETA_OTP['webhook_url']??''));
      if($url==='' || !str_starts_with(strtolower($url),'https://'))return 'test_static';
    }
    return $transport;
  }

  private function configuredTestCode(): string {
    if($this->productionMode() && !$this->temporaryStaticMode())throw new DomainException('otp_test_mode_forbidden');
    $code=preg_replace('/\D+/','',(string)(KARETA_OTP['test_code']??''))?:'';
    return preg_match('/^\d{4,8}$/',$code)===1?$code:'0000';
  }

  private function validCodeFormat(string $code): bool {
    // Real webhook OTP remains six digits; temporary configured test OTP may
    // use four to eight digits. Keeping both formats avoids coupling verify to
    // a transport value that may be changed between request and confirmation.
    if(preg_match('/^\d{6}$/',$code)===1)return true;
    return preg_match('/^\d{4,8}$/',$code)===1;
  }

  private function deliver(string $phone,string $code,string $purpose,string $transport): void {
    if($transport==='test_static' || $this->developmentMode())return;
    $url=trim((string)(KARETA_OTP['webhook_url']??''));
    $host=strtolower((string)(parse_url($url,PHP_URL_HOST)?:''));
    if($transport!=='webhook' || $url==='' || !str_starts_with(strtolower($url),'https://') || $host==='' || str_ends_with($host,'.example')){
      throw new KaretaOtpDeliveryException('otp_delivery_unavailable','provider_not_configured',0,60);
    }

    $payload=json_encode([
      'phone'=>$phone,
      'code'=>$code,
      'purpose'=>$purpose,
      'sender'=>(string)(KARETA_OTP['sender']??'KARETA')
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if(!is_string($payload))throw new KaretaOtpDeliveryException('otp_delivery_failed','payload_encode',0,60);

    $token=(string)(KARETA_OTP['webhook_token']??'');
    $deliveryId=substr(hash('sha256',$phone.'|'.$purpose.'|'.microtime(true).'|'.random_bytes(8)),0,32);
    $phoneHash=substr(hash('sha256',$phone),0,12);
    $classifyHttp=static function(int $status): array {
      if(in_array($status,[401,403],true))return ['provider_auth',60];
      if($status===404)return ['provider_endpoint',60];
      if(in_array($status,[400,409,415,422],true))return ['provider_rejected_payload',60];
      if($status===408)return ['provider_timeout',15];
      if($status===429)return ['provider_rate_limited',60];
      if($status>=500)return ['provider_unavailable',15];
      return ['provider_http',30];
    };
    $throwDelivery=function(string $category,int $status=0,int $retryAfter=15,int $curlErrno=0) use($phoneHash,$deliveryId): void {
      if(function_exists('kareta_log_error')){
        kareta_log_error('OTP_DELIVERY',
          'delivery='.$deliveryId.
          ' phoneHash='.$phoneHash.
          ' category='.$category.
          ' providerStatus='.$status.
          ' curlErrno='.$curlErrno
        );
      }
      throw new KaretaOtpDeliveryException('otp_delivery_failed',$category,$status,$retryAfter);
    };

    if(function_exists('curl_init')){
      $curl=curl_init($url);
      curl_setopt_array($curl,[
        CURLOPT_POST=>true,
        CURLOPT_POSTFIELDS=>$payload,
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_CONNECTTIMEOUT=>5,
        CURLOPT_TIMEOUT=>10,
        CURLOPT_HTTPHEADER=>array_values(array_filter([
          'Content-Type: application/json',
          'Accept: application/json',
          'X-Kareta-Delivery-Id: '.$deliveryId,
          $token!==''?'Authorization: Bearer '.$token:null
        ]))
      ]);
      $response=curl_exec($curl);
      $status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
      $errno=(int)curl_errno($curl);
      curl_close($curl);

      if($response===false || $errno!==0){
        $category=match($errno){
          6=>'provider_dns',
          7=>'provider_connect',
          28=>'provider_timeout',
          35,51,60=>'provider_tls',
          default=>'provider_network',
        };
        $retry=in_array($category,['provider_timeout','provider_connect','provider_network'],true)?15:60;
        $throwDelivery($category,$status,$retry,$errno);
      }
      if($status<200 || $status>=300){
        [$category,$retry]=$classifyHttp($status);
        $throwDelivery($category,$status,$retry,0);
      }
      return;
    }

    $headers="Content-Type: application/json\r\nAccept: application/json\r\nX-Kareta-Delivery-Id: {$deliveryId}\r\n".($token!==''?"Authorization: Bearer {$token}\r\n":'');
    $context=stream_context_create(['http'=>[
      'method'=>'POST','header'=>$headers,'content'=>$payload,'timeout'=>10,'ignore_errors'=>true
    ]]);
    $response=@file_get_contents($url,false,$context);
    $statusLine=(string)($http_response_header[0]??'');
    $status=0;
    if(preg_match('/\s(\d{3})\s/',$statusLine,$m))$status=(int)$m[1];
    if($response===false && $status===0)$throwDelivery('provider_network',0,15,0);
    if($status<200 || $status>=300){
      [$category,$retry]=$classifyHttp($status);
      $throwDelivery($category,$status,$retry,0);
    }
  }

  private function temporaryStaticMode(): bool {
    if(!(bool)(KARETA_OTP['temporary_static']??false))return false;
    // Manual-off commissioning mode intentionally uses an empty deadline.
    // config.php has already resolved the enabled flag and any optional deadline
    // into KARETA_OTP['temporary_static']; an empty `until` therefore means
    // "active until explicitly disabled", not "expired".
    $until=trim((string)(KARETA_OTP['temporary_static_until']??''));
    if($until==='')return true;
    $deadline=strtotime($until);
    return $deadline!==false && time()<(int)$deadline;
  }

  private function productionMode(): bool {
    return (defined('KARETA_ENVIRONMENT')?KARETA_ENVIRONMENT:'production')==='production';
  }

  private function developmentMode(): bool {
    if((defined('KARETA_ENVIRONMENT')?KARETA_ENVIRONMENT:'production')!=='development')return false;
    $host=strtolower(preg_replace('/:\d+$/','',(string)($_SERVER['HTTP_HOST']??''))??'');
    return $host==='' || !in_array($host,['kareta.kz','www.kareta.kz'],true);
  }
}
