'use strict';

const http = require('http');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const root = require('path').resolve(__dirname, '..');
const assert = (value, message) => { if (!value) throw new Error(message); };
const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log('PASS ' + name);
  } catch (error) {
    checks.push({ name, ok: false, error: String(error && error.message || error) });
    console.error('FAIL ' + name + ' - ' + String(error && error.message || error));
  }
}

function phpInline(code) {
  const result = spawnSync('php', ['-r', code], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'php failed').trim());
  return (result.stdout || '').trim();
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body == null ? null : String(options.body);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        ...(body != null ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
      timeout: 5000,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode || 0, json, text });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitFor(url) {
  for (let i = 0; i < 40; i++) {
    try { return await request(url); } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('local PHP server did not start');
}

(async () => {
  await check('error-envelope', () => {
    const out = phpInline("require 'api/bootstrap.php'; echo json_encode(kareta_api_envelope(['ok'=>false,'error'=>'auth_required'],401), JSON_UNESCAPED_SLASHES);");
    const data = JSON.parse(out);
    assert(data.ok === false, 'error envelope must remain false');
    assert(data.code === 'AUTH_REQUIRED', 'AUTH_REQUIRED code missing');
    assert(data.meta && data.meta.httpStatus === 401, 'HTTP status metadata missing');
  });

  await check('idempotency-hash', () => {
    const out = phpInline("require 'api/bootstrap.php'; $a=kareta_idempotency_request_hash(['x'=>1,'idempotencyKey'=>'a']); $b=kareta_idempotency_request_hash(['x'=>1,'idempotencyKey'=>'b']); $c=kareta_idempotency_request_hash(['x'=>2]); echo json_encode(['same'=>$a===$b,'different'=>$a!==$c]);");
    const data = JSON.parse(out);
    assert(data.same === true, 'idempotency key must not alter request hash');
    assert(data.different === true, 'payload change must alter request hash');
  });

  const port = await freePort();
  const server = spawn('php', ['-S', '127.0.0.1:' + port, '-t', root], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  try {
    await waitFor('http://127.0.0.1:' + port + '/api/runtime_health.php');

    await check('runtime-health', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/runtime_health.php');
      assert(res.status === 200, 'runtime_health HTTP ' + res.status);
      assert(res.json && ['ready','degraded'].includes(String(res.json.status || '')), 'runtime status invalid');
    });

    await check('release-status-method-guard', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/release_status.php', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: '{}',
      });
      assert(res.status === 405, 'release_status POST must be 405');
      assert(res.json && res.json.ok === false, 'method error envelope missing');
    });

    await check('release-status-auth-guard', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/release_status.php');
      assert(res.status === 403, 'release_status GET without diagnostics auth must be 403');
      assert(res.json && res.json.ok === false, 'diagnostics denial envelope missing');
    });

    await check('auth-logout', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/auth_session.php', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ action:'logout' }),
      });
      assert(res.status === 200, 'logout HTTP ' + res.status);
      assert(res.json && res.json.ok === true && res.json.loggedOut === true, 'logout contract mismatch');
    });

    await check('auth-method-guard', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/auth_session.php', {
        method: 'PUT',
        headers: { 'Content-Type':'application/json' },
        body: '{}',
      });
      assert(res.status === 405, 'auth PUT must be 405');
      assert(res.json && res.json.ok === false, 'auth method denial missing');
    });

    await check('provenance-fails-closed-without-manifest', async () => {
      const res = await request('http://127.0.0.1:' + port + '/api/provenance.php');
      assert(res.status === 503, 'missing provenance must be 503');
      assert(res.json && res.json.ok === false && res.json.status === 'provenance_missing', 'provenance missing contract mismatch');
    });
  } finally {
    server.kill('SIGTERM');
  }

  const failed = checks.filter(item => !item.ok);
  console.log('API_CONTRACT_CURRENT: ' + (failed.length ? 'FAIL' : 'PASS') + ' checks=' + (checks.length - failed.length) + '/' + checks.length);
  if (failed.length) process.exit(1);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
