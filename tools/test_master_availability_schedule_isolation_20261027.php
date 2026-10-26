<?php
declare(strict_types=1);
require_once __DIR__.'/../api/master_workplace.php';

function kareta_table_exists(PDO $pdo,string $table): bool {return $table==='master_schedules';}
function fixtureProfile(PDO $pdo): array {return ['id'=>'qa_master'];}
class CapturedResponse extends RuntimeException {
    public function __construct(public array $payload,public int $http=200){parent::__construct('HTTP '.$http);}
}
function fixtureJson(array $payload,int $code=200): void {throw new CapturedResponse($payload,$code);}
class FakeScheduleStatement extends PDOStatement {
    public array $params=[];
    public function __construct(private FakeSchedulePDO $db,private string $sql){}
    public function execute(?array $params=null): bool {
        $this->params=$params??[];
        $this->db->queries[]=$this->sql;
        if(str_contains($this->sql,'UPDATE masters SET availability=')) {
            $this->db->availability=(string)($this->params[0]??'');
        }
        return true;
    }
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0): mixed {
        if(str_contains($this->sql,'FROM master_schedules'))return $this->db->schedule;
        return false;
    }
    public function fetchColumn(int $column=0): mixed {
        if(str_contains($this->sql,'SELECT availability FROM masters'))return $this->db->availability;
        return false;
    }
}
class FakeSchedulePDO extends PDO {
    public array $schedule=['start_time'=>'10:30:00','end_time'=>'15:45:00','is_day_off'=>0,'note'=>'Индивидуальный график QA'];
    public string $availability='online';
    public array $queries=[];
    public function __construct(){}
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        return new FakeScheduleStatement($this,$query);
    }
}
$source=file_get_contents(__DIR__.'/../api/master_workplace.php');
preg_match('/function kareta_master_availability_save\(PDO \$pdo,array \$b\): void \{[\s\S]*?\n\}(?=\nfunction kareta_master_schedule_preferences)/',$source,$m);
if(empty($m[0]))throw new RuntimeException('Could not extract exact source setter');
$setter=str_replace(
 ['function kareta_master_availability_save(','kareta_master_workplace_profile(','kareta_json('],
 ['function fixtureSaveAvailability(','fixtureProfile(','fixtureJson('],$m[0]);
eval($setter);
$expect=function(bool $truth,string $message):void {if(!$truth)throw new RuntimeException('FAIL: '.$message);};
$db=new FakeSchedulePDO();
$today=date('Y-m-d');
$tomorrow=(new DateTimeImmutable('tomorrow'))->format('Y-m-d');
$baseline=kareta_master_schedule_day_bounds($db,'qa_master',$today);
$expect($baseline['start']->format('H:i')==='10:30','custom start must be retained');
$expect($baseline['end']->format('H:i')==='15:45','custom end must be retained');
$expect($baseline['note']==='Индивидуальный график QA','custom note must be retained');
$original=$db->schedule;
foreach(['busy','lunch','day_off','online'] as $status){
    try{fixtureSaveAvailability($db,['status'=>$status]);throw new RuntimeException('Setter failed to respond');}
    catch(CapturedResponse $response){
        $expect($response->http===200 && $response->payload['status']===$status,'setter response '.$status);
    }
    $expect($db->availability===$status,'master availability is persisted '.$status);
    $bounds=kareta_master_schedule_day_bounds($db,'qa_master',$today);
    $expect((bool)$bounds['isDayOff']===($status==='day_off'),'today day-off overlay '.$status);
    $expect($bounds['note']==='Индивидуальный график QA','today note unchanged '.$status);
    $expect($bounds['start']->format('H:i')==='10:30','start remains unchanged '.$status);
    $expect($db->schedule===$original,'schedule row unchanged '.$status);
    $future=kareta_master_schedule_day_bounds($db,'qa_master',$tomorrow);
    $expect(!$future['isDayOff'],'availability must not close tomorrow '.$status);
}
$db->schedule['is_day_off']=1;
$explicitOff=kareta_master_schedule_day_bounds($db,'qa_master',$today);
$expect($explicitOff['isDayOff']===true,'explicit schedule day off must remain effective');
$db->schedule=$original;
try{fixtureSaveAvailability($db,['status'=>'WRONG']);throw new RuntimeException('Invalid status accepted');}
catch(CapturedResponse $error){$expect($error->http===422,'invalid status rejected');}
$expect($db->availability==='online','invalid status must not change availability');
$expect(count(array_filter($db->queries,fn($sql)=>str_contains($sql,'master_schedules')&&preg_match('/INSERT|UPDATE|DELETE/i',$sql)))===0,'availability must never modify schedule');
echo "PASS master availability: 4 valid states, rollback, custom hours/notes, today-only day_off, explicit day off, invalid status (fake PDO; zero DB writes)\n";
