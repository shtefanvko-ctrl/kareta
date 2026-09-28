'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.php');
const manifest = read('asset_manifest.php');
const registry = read('inc/asset_registry.php');

assert(index.includes('manifestTimeoutMs = 20000'), 'Manifest timeout was not raised to 20 seconds');
assert(index.includes("controller.abort('manifest_preflight_timeout')"), 'Manifest abort has no stable reason');
assert(index.includes("if(controller.signal.aborted)throw new Error('manifest_preflight_timeout')"), 'AbortError is not normalized');
assert(index.includes('runtimeIdleTimeoutMs = 30000'), 'Progress idle timeout missing');
assert(index.includes('runtimeHardTimeoutMs = 180000'), 'Runtime hard timeout missing');
assert(index.includes('runtime_load_idle_timeout:'), 'Progressive idle failure reason missing');
assert(index.includes('runtime_load_hard_timeout:'), 'Hard failure reason missing');
assert(!index.includes('runtime_load_timeout:${state.loaded}/${state.total}'), 'Old absolute 20-second runtime timeout returned');
assert(index.includes("'[KARETA][atomic-runtime.manifest-degraded]'"), 'Degraded optional assets are not reported');
assert(index.includes("'[KARETA][atomic-runtime.preflight-bypass]'"), 'Transient preflight bypass is missing');
assert(index.includes('window.__KARETA_ATOMIC_BOOT_PROMISE__'), 'Health check does not wait for atomic boot');
assert(index.includes('const loadNext=index=>') && index.includes('else loadNext(index+1)'), 'Runtime modules are not loaded sequentially');
assert(index.includes("['kareta_boot','kareta_recovery','kareta_atomic']"), 'Recovery parameters are not removed after success');

const scriptBlock = registry.match(/'scripts'\s*=>\s*\[([\s\S]*?)\n\s*\],\n\s*'images'/)?.[1] || '';
const scripts = [...scriptBlock.matchAll(/'([^']+\.js)'/g)].map(match => match[1]);
assert(scripts.length === 123, `Expected 123 runtime modules, got ${scripts.length}`);
for (const file of scripts) assert(fs.existsSync(path.join(root, file)), `Runtime module is missing: ${file}`);
assert(manifest.includes("http_response_code($missing === [] ? 200 : 503)"), 'Manifest deployment-status response changed unexpectedly');

const shellStart = index.indexOf('  <div id="k-app"');
const shellEnd = index.indexOf('    <div id="k-modal-root"', shellStart);
const shellFragment = index.slice(shellStart, shellEnd);
const shellHash = crypto.createHash('sha256').update(shellFragment).digest('hex');
assert(shellHash === '443d123b85ab04f666bc5e15b1869e48ba8b63e56ce12b31a27faad4c803d285', 'Approved R188.5.5.6.84.14 Shell DOM fragment changed unexpectedly');

console.log('Atomic runtime progressive boot: 123/123 modules present, transient timeout recovery and approved persistent Shell OK');
