const fs = require('fs');

function read(path){ return fs.readFileSync(path,'utf8'); }
function expect(ok,message){ if(!ok){ console.error('FAIL',message); process.exit(1); } }

const config=read('config.php');
const manifest=read('api/migration_manifest.php');
const migration=read('api/migrations/136_obd_remote_control_plane.php');
const api=read('api/obd_jobs.php');
const obd=read('api/obd.php');
const runner=read('js/next/obd_remote_jobs.js');
const index=read('index.php');

expect(config.includes("define('KARETA_DB_VERSION', 136);"),'DB version is not 136');
expect(manifest.includes("'version' => 136"),'migration manifest target is not 136');
expect(manifest.includes("136_obd_remote_control_plane.php"),'migration 136 missing from manifest');
expect(migration.includes('CREATE TABLE IF NOT EXISTS obd_mobile_devices'),'device table missing');
expect(migration.includes('CREATE TABLE IF NOT EXISTS obd_diagnostic_jobs'),'job table missing');
expect(migration.includes('UNIQUE KEY uq_obd_job_request(account_id,request_key)'),'request idempotency key missing');

expect(api.includes("'supportedActions' => ['snapshot']"),'remote action allowlist is not snapshot-only');
expect(api.includes("'rawElmCommands' => false"),'raw ELM commands are not explicitly denied');
expect(api.includes("status='claimed'"),'claim state missing');
expect(api.includes("attempt_count<5"),'delivery retry bound missing');
expect(api.includes("JOB_NOT_CLAIMED_BY_DEVICE"),'device ownership completion guard missing');

expect(obd.includes("$payload['syncKey'] ?? $item['id']"),'deterministic payload syncKey does not take precedence');
expect(obd.includes("obd_diagnostic_jobs"),'OBD sync does not auto-complete remote jobs');

expect(runner.includes("job.action !== 'snapshot'"),'client action allowlist missing');
expect(runner.includes('elmReconnectLast()'),'ELM reconnect orchestration missing');
expect(runner.includes('elmInit()'),'ELM initialization missing');
expect(runner.includes('elmSnapshot()'),'ELM snapshot missing');
expect(runner.includes("kind: 'obd_remote_job'"),'remote result durable queue marker missing');
expect(runner.includes('queuedItemForJob'),'queued result recovery missing');
expect(runner.includes('POLL_MS = 15000'),'poll floor changed unexpectedly');

const bridge=index.indexOf('/js/mobile_native_bridge.js');
const jobs=index.indexOf('/js/next/obd_remote_jobs.js');
expect(bridge>=0 && jobs>bridge,'remote runner must load after native bridge');

console.log('OBD_REMOTE_CONTROL_PLANE: PASS');
