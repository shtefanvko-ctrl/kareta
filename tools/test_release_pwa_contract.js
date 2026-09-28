'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const asset = (/KARETA_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(read('inc/asset_version.php')) || [])[1] || '';
const sw = (/const\s+RELEASE\s*=\s*['"]([^'"]+)['"]/.exec(read('sw.js')) || [])[1] || '';
if (!asset) throw new Error('KARETA_ASSET_VERSION missing');
if (!sw) throw new Error('service worker RELEASE missing');
if (asset !== sw) throw new Error(`release parity mismatch: asset=${asset} sw=${sw}`);
const manifest = JSON.parse(read('manifest.json'));
for (const key of ['name', 'short_name', 'start_url', 'display']) {
  if (!manifest[key]) throw new Error(`manifest field missing: ${key}`);
}
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error('manifest icons missing');
}
console.log(`PWA_CONTRACT: OK (release ${asset})`);
