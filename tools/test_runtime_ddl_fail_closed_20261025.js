'use strict';

// Execute the actual bootstrap function against a PDO test double. No database
// connection, configuration file, HTTP bootstrap or real DDL is involved.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'api/bootstrap.php'),'utf8');
const start=source.indexOf('function kareta_bootstrap_runtime(PDO $pdo): void');
const end=source.indexOf('\nfunction kareta_log_error(',start);
assert.ok(start>=0&&end>start,'bootstrap function boundaries missing');
const bootstrap=source.slice(start,end);

function probe(options){
  const setup=`
    $options=json_decode(base64_decode('${Buffer.from(JSON.stringify(options)).toString('base64')}'),true);
    foreach (['environment'=>'KARETA_ENVIRONMENT','migrate'=>'KARETA_DB_AUTO_MIGRATE','window'=>'KARETA_DB_RUNTIME_MIGRATION_WINDOW'] as $key=>$constant) {
        if (array_key_exists($key,$options)) define($constant,$options[$key]);
    }
    define('KARETA_DB',['database'=>'isolated_fake']);
    define('KARETA_DB_VERSION',144);
    define('KARETA_DB_AUTO_UPGRADE',true);
    $events=[]; $failureContext='';
    class FakeStatement extends PDOStatement {
        private string $sql;
        public function __construct(string $sql) {$this->sql=$sql;}
        public function execute(?array $params=null): bool {
            $GLOBALS['events'][]=str_contains($this->sql,'GET_LOCK')?'lock':'unlock';
            return true;
        }
        public function fetchColumn(int $column=0): mixed {return 1;}
    }
    class FakePDO extends PDO {
        public function __construct() {}
        public function prepare(string $query,array $options=[]): PDOStatement|false {return new FakeStatement($query);}
    }
    function kareta_schema_bootstrap_required(PDO $pdo): bool {return $GLOBALS['options']['required']??true;}
    function kareta_db_set_failure_context(string $stage): void {$GLOBALS['failureContext']=$stage;}
    function kareta_db_clear_failure_context(): void {$GLOBALS['failureContext']='';}
    function kareta_db_runtime_schema_version(PDO $pdo): int {return 144;}
    function kareta_db_auto_upgrade_log(string $status,int $from,int $to,string $detail=''): void {$GLOBALS['events'][]='audit:'.$status;}
    function kareta_create_schema(PDO $pdo): void {$GLOBALS['events'][]='create';}
    function kareta_migrate(PDO $pdo): void {$GLOBALS['events'][]='migrate';}
    function kareta_ensure_schema_columns(PDO $pdo): void {$GLOBALS['events'][]='ensure';}
    function kareta_runtime_maintenance(PDO $pdo): void {$GLOBALS['events'][]='maintenance';}
  `;
  const result=spawnSync('php',['-r',setup+bootstrap+`
    $error=null;
    try {kareta_bootstrap_runtime(new FakePDO());} catch (RuntimeException $e) {$error=$e->getMessage();}
    echo json_encode(['error'=>$error,'events'=>$events,'context'=>$failureContext,'held'=>isset($GLOBALS['KARETA_SCHEMA_BOOTSTRAP_LOCK_HELD'])]);
  `],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.error?.message||result.stderr);
  return JSON.parse(result.stdout);
}

const denied=[
  {},
  {environment:'production'},
  {environment:'production',migrate:false,window:true},
  {environment:'production',migrate:true,window:false},
  {environment:'production',migrate:true},
  {environment:'production',window:true},
  {migrate:true,window:false}
];
for(const options of denied){
  const result=probe(options);
  assert.equal(result.error,'Database migration required outside runtime maintenance window',JSON.stringify(options));
  assert.equal(result.context,'bootstrap.migration_required');
  assert.deepEqual(result.events,['lock','unlock'],'rejection must precede all DDL and release lock');
  assert.equal(result.held,false);
}
for(const options of [
  {environment:'production',migrate:true,window:true},
  {environment:'staging',migrate:true},
  {environment:'development',migrate:true},
  {environment:'test',migrate:true}
]){
  const result=probe(options);
  assert.equal(result.error,null);
  assert.deepEqual(result.events,['lock','audit:START','create','migrate','ensure','audit:PASS','unlock','maintenance']);
  assert.equal(result.context,'');
  assert.equal(result.held,false);
}
const ready=probe({environment:'production',required:false,migrate:false,window:false});
assert.equal(ready.error,null,'ready production schema must not require a migration window');
assert.deepEqual(ready.events,['lock','unlock','maintenance']);
assert.equal(ready.held,false);

const maintenanceStart=source.indexOf('function kareta_runtime_maintenance(PDO $pdo): void');
const maintenanceEnd=source.indexOf('\nfunction kareta_db_auto_upgrade_log(',maintenanceStart);
assert.ok(maintenanceStart>=0&&maintenanceEnd>maintenanceStart);
for(const [demo,due,expected] of [
  [undefined,true,['BOOTSTRAP_RELATIONS','relations']],
  [false,true,['BOOTSTRAP_RELATIONS','relations']],
  [true,true,['BOOTSTRAP_SEED','seed','BOOTSTRAP_RELATIONS','relations']],
  [true,false,[]]
]){
  const code=`
    ${demo===undefined?'':`define('KARETA_DEMO_SEED',${demo?'true':'false'});`}
    $events=[];
    class FakePDO extends PDO {public function __construct() {}}
    function kareta_runtime_maintenance_due(): bool {return ${due?'true':'false'};}
    function kareta_safe_step(PDO $pdo,string $stage,callable $step): void {$GLOBALS['events'][]=$stage;$step($pdo);}
    function kareta_seed(PDO $pdo): void {$GLOBALS['events'][]='seed';}
    function kareta_backfill_relations(PDO $pdo): void {$GLOBALS['events'][]='relations';}
    ${source.slice(maintenanceStart,maintenanceEnd)}
    kareta_runtime_maintenance(new FakePDO());
    echo json_encode($events);
  `;
  const result=spawnSync('php',['-r',code],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.error?.message||result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),expected,'maintenance must gate seed and run one relation chain');
}
console.log('RUNTIME_DDL_FAIL_CLOSED: PASS (7 rejection, 4 permitted, ready-schema, lock release, 4 maintenance scenarios)');
