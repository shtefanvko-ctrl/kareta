'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const realtime=read('js/next/core/realtime_client.js');
const apiRealtime=read('api/realtime.php');
const apiClient=read('js/next/api_client.js');
const logger=read('js/next/runtime_logger.js');
const index=read('index.php');
const diagnostics=read('api/runtime_diagnostics.php');

const probe=spawnSync('php',['-r',"putenv('KARETA_DB_NAME=k');putenv('KARETA_DB_USER=u');putenv('KARETA_DB_PASS=p');require 'config.php';echo json_encode(KARETA_REALTIME);"],{cwd:root,encoding:'utf8'});
expect(probe.status===0,'PHP realtime config probe failed: '+probe.stderr);
const cfg=JSON.parse(probe.stdout);
expect(cfg.transport==='poll','default realtime transport must be poll');
expect(Number(cfg.poll_interval_ms)>=10000,'poll interval too aggressive');
expect(Number(cfg.request_timeout_ms)>=5000,'realtime request timeout too low');

expect(index.includes('window.KARETA_REALTIME_CONFIG'),'frontend realtime config is not exposed');
expect(realtime.includes("TRANSPORT!=='sse'"),'client still prefers SSE by default');
expect(realtime.includes('POLL_INTERVAL_MS'),'poll interval config missing');
expect(apiRealtime.includes("realtime_stream_disabled"),'server does not reject disabled SSE');
expect(apiClient.includes('DB_READ_MIN_GAP_MS = 650'),'DB read pacing regression');
expect(apiClient.includes('DB_READ_RETRY_DEFAULT_MS = 1500'),'DB retry backoff regression');
expect(apiClient.includes('DB_READ_RETRY_MAX_MS = 8000'),'DB retry max regression');
expect(logger.includes('serverStressUntil'),'runtime logger stress cooldown missing');
expect(logger.includes('markServerStress'),'runtime logger host-pressure detector missing');
expect(diagnostics.includes("'realtimeTransport'"),'runtime diagnostics transport field missing');

console.log('PLESK_RUNTIME_PRESSURE_84_156: PASS');
