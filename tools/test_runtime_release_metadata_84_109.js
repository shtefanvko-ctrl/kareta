'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };

const current = '188.5.5.6.84.109';
const sw = read('sw.js');
const asset = read('inc/asset_version.php');
const realtime = read('js/next/core/realtime_client.js');
const ui = read('js/boot/runtime_ui_bundle.js');
const metadata = JSON.parse(read('docs/changelog/runtime_release_history_84_109.json'));

const swRelease = ((/const\s+RELEASE\s*=\s*['"]([^'"]+)['"]/.exec(sw) || [])[1] || '').trim();
const assetRelease = ((/KARETA_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(asset) || [])[1] || '').trim();

assert(swRelease === current, 'sw.js current release mismatch');
assert(assetRelease === current, 'asset_version.php current release mismatch');
assert(swRelease === assetRelease, 'runtime release parity mismatch');

const forbidden = [
  'Historical release markers',
  'r188568450-community-mobile-autoplay',
  'historical-ui-version:',
  '20260806-r188555-runtime-dependency-bootstrap',
];
for (const [name, text] of [
  ['sw.js', sw],
  ['inc/asset_version.php', asset],
  ['js/next/core/realtime_client.js', realtime],
  ['js/boot/runtime_ui_bundle.js', ui],
]) {
  for (const token of forbidden) {
    assert(!text.includes(token), name + ' still contains historical marker: ' + token);
  }
}

const allRuntimeVersionTokens = (sw + '\n' + asset)
  .match(/188\.5\.5\.6\.84\.\d+/g) || [];
assert(allRuntimeVersionTokens.length === 2, 'sw/asset must contain exactly two release tokens total');
assert(allRuntimeVersionTokens.every(token => token === current), 'historical numeric release token remains in sw/asset');

assert(metadata.schema === 'kareta.runtime-release-history.v1', 'metadata schema mismatch');
assert(metadata.currentRelease === current, 'metadata current release mismatch');
assert(typeof metadata.legacyReleaseMarkerChain === 'string' && metadata.legacyReleaseMarkerChain.length > 3000,
  'full legacy release marker chain was not preserved');
assert(typeof metadata.realtimeLegacyMarkerChain === 'string' && metadata.realtimeLegacyMarkerChain.length > 700,
  'realtime legacy marker chain was not preserved');

for (const marker of [
  'r188568449-community-social-platform-v2',
  'r188568450-community-mobile-autoplay',
  'historical-ui-version:188.5.5.6.84.49',
]) {
  assert(metadata.testMarkers?.includes(marker), 'metadata marker missing: ' + marker);
}

console.log('RUNTIME_RELEASE_METADATA_84_109: PASS current=' + current + ' history=migrated');
