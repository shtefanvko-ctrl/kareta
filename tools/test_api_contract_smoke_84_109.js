'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };
const checks = [];

async function check(domain, scenario, fn) {
  try {
    await fn();
    checks.push({ domain, scenario, ok: true });
    console.log('PASS ' + domain + '.' + scenario);
  } catch (error) {
    checks.push({ domain, scenario, ok: false, error: String(error && error.message || error) });
    console.error('FAIL ' + domain + '.' + scenario + ' - ' + String(error && error.message || error));
  }
}

function phpInline(code) {
  const result = spawnSync('php', ['-r', code], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('php inline failed: ' + (result.stderr || result.stdout || ('exit ' + result.status)).trim());
  }
  return (result.stdout || '').trim();
}

function phpFile(rel) {
  const result = spawnSync('php', [rel], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(rel + ' failed: ' + (result.stderr || result.stdout || ('exit ' + result.status)).trim());
  }
  return (result.stdout || '').trim();
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body == null ? null : String(options.body);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        ...(body != null ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
      timeout: options.timeoutMs || 10000,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          text,
          json,
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

function requestRemote(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? require('https') : http;
    const body = options.body == null ? null : String(options.body);
    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        ...(body != null ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
      timeout: options.timeoutMs || 15000,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode || 0, headers: res.headers, text, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(err => err ? reject(err) : resolve(port));
    });
  });
}

async function waitHttp(url, tries = 40) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try { return await request(url, { timeoutMs: 1000 }); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 100)); }
  }
  throw last || new Error('server did not start');
}

async function runLocal() {
  await check('schema', 'happy', () => {
    const out = phpInline("require 'api/identity/schema_contract.php'; echo json_encode(KaretaSchemaContract::contracts(), JSON_UNESCAPED_SLASHES);");
    const data = JSON.parse(out);
    for (const table of ['accounts','persons','person_profiles','contexts','context_members','auth_sessions','capabilities']) {
      assert(Array.isArray(data[table]), 'schema contract missing table ' + table);
      assert(data[table].length > 0, 'schema contract columns missing for ' + table);
    }
  });

  await check('schema', 'error', () => {
    const out = phpFile('tools/test_schema_contract_diagnostics_84_26.php');
    assert(/RESULT\s+\d+\/\d+/.test(out), 'schema error diagnostics did not execute');
    assert(!/^FAIL /m.test(out), 'schema error diagnostics contain FAIL');
  });

  const port = await freePort();
  const server = spawn('php', ['-S', '127.0.0.1:' + port, '-t', root], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverErr = '';
  server.stderr.on('data', chunk => { serverErr += chunk.toString('utf8'); });

  try {
    await waitHttp('http://127.0.0.1:' + port + '/api/runtime_health.php');

    await check('status', 'happy', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/runtime_health.php');
      assert(res.status === 200, 'runtime_health HTTP ' + res.status);
      assert(res.json && typeof res.json === 'object', 'runtime_health must return JSON');
      assert(['ready','degraded'].includes(String(res.json.status || '')), 'runtime_health status contract invalid');
      assert(typeof res.json.version === 'string', 'runtime_health version missing');
    });

    await check('status', 'error', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/release_status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert(res.status === 405, 'release_status POST must be 405, got ' + res.status);
      assert(res.json && res.json.ok === false, 'release_status error envelope missing');
      assert(String(res.json.code || '') === 'METHOD_NOT_ALLOWED', 'release_status error code mismatch');
    });

    await check('auth', 'happy', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/auth_session.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      assert(res.status === 200, 'auth logout HTTP ' + res.status);
      assert(res.json && res.json.ok === true && res.json.loggedOut === true, 'auth logout contract mismatch');
    });

    await check('auth', 'error', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/auth_session.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert(res.status === 405, 'auth unsupported method must be 405, got ' + res.status);
      assert(res.json && res.json.ok === false, 'auth error envelope missing');
      assert(String(res.json.code || '') === 'METHOD_NOT_ALLOWED', 'auth error code mismatch');
    });
  } finally {
    server.kill('SIGTERM');
  }

  await check('error', 'happy', () => {
    const out = phpInline("require 'api/bootstrap.php'; echo json_encode(kareta_api_envelope(['ok'=>false,'error'=>'auth_required'],401), JSON_UNESCAPED_SLASHES);");
    const data = JSON.parse(out);
    assert(data.ok === false, 'known error must stay false');
    assert(data.code === 'AUTH_REQUIRED', 'known error code mismatch');
    assert(typeof data.message === 'string' && data.message.length > 0, 'known error message missing');
    assert(data.meta && data.meta.httpStatus === 401, 'known error httpStatus missing');
    assert(typeof data.meta.requestId === 'string' && data.meta.requestId.length > 0, 'known error requestId missing');
  });

  await check('error', 'error', () => {
    const out = phpInline("require 'api/bootstrap.php'; echo json_encode(kareta_api_envelope([],500), JSON_UNESCAPED_SLASHES);");
    const data = JSON.parse(out);
    assert(data.ok === false, 'fallback 500 must be false');
    assert(data.code === 'HTTP_500', 'fallback error code mismatch');
    assert(Array.isArray(data.errors), 'fallback errors array missing');
    assert(data.meta && data.meta.httpStatus === 500, 'fallback error httpStatus missing');
  });

  await check('idempotency', 'happy', () => {
    const out = phpInline("require 'api/bootstrap.php'; $_SERVER['HTTP_X_IDEMPOTENCY_KEY']='smoke:key'; $key=kareta_idempotency_extract_key(['idempotencyKey'=>'body-key']); $a=kareta_idempotency_request_hash(['x'=>1,'idempotencyKey'=>'a']); $b=kareta_idempotency_request_hash(['x'=>1,'idempotencyKey'=>'b']); echo json_encode(['key'=>$key,'same'=>$a===$b]);");
    const data = JSON.parse(out);
    assert(data.key === 'smoke:key', 'idempotency header key must win');
    assert(data.same === true, 'idempotency request hash must ignore idempotency key');
  });

  await check('idempotency', 'error', () => {
    const src = read('api/bootstrap.php');
    const conflict = src.indexOf("!hash_equals($storedRequestHash, $requestHash)");
    const code = src.indexOf("'IDEMPOTENCY_CONFLICT'", conflict);
    const status = src.indexOf('], 409);', code);
    const replay = src.indexOf("X-Idempotency-Replayed: 1");
    assert(conflict >= 0, 'idempotency payload mismatch comparison missing');
    assert(code > conflict, 'IDEMPOTENCY_CONFLICT code missing');
    assert(status > code, 'idempotency conflict HTTP 409 missing');
    assert(replay > status, 'idempotency conflict must be checked before replay');
  });

  const failed = checks.filter(x => !x.ok);
  const domains = {};
  for (const row of checks) {
    domains[row.domain] = domains[row.domain] || { happy: false, error: false };
    domains[row.domain][row.scenario] = row.ok;
  }
  for (const domain of ['schema','status','auth','error','idempotency']) {
    assert(domains[domain] && domains[domain].happy && domains[domain].error,
      domain + ' must have happy+error smoke PASS');
  }

  console.log('API_CONTRACT_SMOKE_84_109: ' + (failed.length ? 'FAIL' : 'PASS') +
    ' checks=' + (checks.length - failed.length) + '/' + checks.length +
    ' domains=5 happyError=5/5');
  if (failed.length) process.exitCode = 1;
}

async function runRemote(baseUrl, jsonPath) {
  baseUrl = String(baseUrl || '').replace(/\/$/, '');
  assert(/^https?:\/\//.test(baseUrl), '--base-url must be http(s) URL');
  const probes = [];

  async function probe(name, method, urlPath, expectedStatus, validate, body) {
    const started = Date.now();
    try {
      const res = await requestRemote(baseUrl + urlPath, {
        method,
        headers: body != null ? { 'Content-Type': 'application/json' } : {},
        body: body == null ? null : JSON.stringify(body),
      });
      let ok = res.status === expectedStatus;
      let reason = '';
      try {
        if (ok && validate) validate(res);
      } catch (e) {
        ok = false; reason = String(e && e.message || e);
      }
      probes.push({
        name, method, path: urlPath, expectedStatus, actualStatus: res.status,
        ok, reason, json: res.json,
        requestId: String(res.headers['x-kareta-request-id'] || (res.json && (res.json.requestId || (res.json.meta && res.json.meta.requestId))) || ''),
        ms: Date.now() - started,
      });
    } catch (e) {
      probes.push({
        name, method, path: urlPath, expectedStatus, actualStatus: 0,
        ok: false, reason: String(e && e.message || e), ms: Date.now() - started,
      });
    }
  }

  await probe('schema.happy','GET','/api/schema_health.php',200,res => {
    assert(res.json && res.json.ok === true && res.json.status === 'ready', 'schema not ready');
  });
  await probe('status.happy','GET','/api/runtime_health.php',200,res => {
    assert(res.json && ['ready','degraded'].includes(String(res.json.status || '')), 'runtime status contract invalid');
  });
  await probe('status.error','POST','/api/release_status.php',405,res => {
    assert(res.json && res.json.ok === false && res.json.code === 'METHOD_NOT_ALLOWED', 'status error contract mismatch');
  }, {});
  await probe('auth.happy','POST','/api/auth_session.php',200,res => {
    assert(res.json && res.json.ok === true && res.json.loggedOut === true, 'logout contract mismatch');
  }, { action: 'logout' });
  await probe('auth.error','PUT','/api/auth_session.php',405,res => {
    assert(res.json && res.json.ok === false && res.json.code === 'METHOD_NOT_ALLOWED', 'auth error contract mismatch');
  }, {});
  await probe('error.happy','GET','/api/release_status.php',403,res => {
    assert(res.json && res.json.ok === false && res.json.code === 'DIAGNOSTICS_AUTHORIZATION_REQUIRED', 'diagnostics auth error contract mismatch');
  });

  const report = {
    schema: 'kareta.api-contract-smoke.staging.v1',
    baseline: 'R188.5.5.6.84.109',
    baseUrl,
    checkedAt: new Date().toISOString(),
    probes,
    passed: probes.filter(x => x.ok).length,
    failed: probes.filter(x => !x.ok).length,
    status: probes.every(x => x.ok) ? 'PASS' : 'FAIL',
    note: 'idempotency happy/error is verified locally in the release gate because remote mutation smoke must not create business data.',
  };
  if (jsonPath) fs.writeFileSync(path.resolve(jsonPath), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}

(async () => {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf('--base-url');
  if (baseIndex >= 0) {
    const jsonIndex = args.indexOf('--json');
    await runRemote(args[baseIndex + 1], jsonIndex >= 0 ? args[jsonIndex + 1] : '');
  } else {
    await runLocal();
  }
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
