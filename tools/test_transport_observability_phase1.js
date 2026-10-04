#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=[];
const expect=(value,message)=>{if(!value)fail.push(message);};

const api=read('js/next/api_client.js');
const bootstrap=read('api/bootstrap.php');
const db=read('api/db.php');
const logger=read('inc/request_logger.php');

expect(api.includes('const DEFAULT_REQUEST_TIMEOUT_MS = 20000;'),'transport default timeout must be 20s');
expect(api.includes("hasExplicitTimeout ? Math.max(0,Number(timeoutMs)||0) : DEFAULT_REQUEST_TIMEOUT_MS"),'explicit timeout override contract missing');
expect(api.includes("timedOut?'REQUEST_TIMEOUT':(aborted?'REQUEST_ABORTED':'NETWORK_ERROR')"),'stable transport error codes missing');
expect(api.includes("const transport = (isDbRead(requestUrl, method) || dbSafeReplay) ? executeDbRead(requestUrl, fetchOptions) : execute(requestUrl, fetchOptions);"),'retry gate must be GET/dbSafeReplay only');
expect(api.includes('if (result.status !== 429) return result;'),'429-only replay guard missing');
expect(api.includes('Date.parse(retryAfterRaw)'),'Retry-After HTTP-date support missing');

expect(bootstrap.includes("require_once dirname(__DIR__) . '/inc/request_logger.php';"),'bootstrap must attach unified request logger');
expect(bootstrap.includes('X-Kareta-Trace-Id, X-Kareta-Client-Version'),'trace/client headers must be allowed');
expect(bootstrap.includes("defined('KARETA_TRACE_ID') ? KARETA_TRACE_ID"),'API envelope must use canonical trace ID');

expect(logger.includes("'requestId'=>KARETA_REQUEST_ID"),'server request log must contain canonical requestId');
expect(logger.includes("$base['slow'] = $base['durationMs'] > 300;"),'slow request marker >300ms missing');
expect(logger.includes("header('X-Kareta-Request-Id: ' . KARETA_REQUEST_ID);"),'request ID response header missing');

expect(db.includes('$karetaDbRequestId = KARETA_REQUEST_ID;'),'db.php must reuse canonical request ID');
expect(!db.includes("'db_' . date('YmdHis')"),'legacy secondary db request ID still present');
expect(db.includes("kareta_request_log_context(['action'=>$action]);"),'DB action must be attached to request log');

if(fail.length){
  console.error('[phase1 transport/observability] FAIL');
  for(const item of fail) console.error('- '+item);
  process.exit(1);
}
console.log('[phase1 transport/observability] PASS');
