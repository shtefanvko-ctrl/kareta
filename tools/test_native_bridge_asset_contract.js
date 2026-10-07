#!/usr/bin/env node
'use strict';

const fs = require('fs');
const registry = fs.readFileSync('inc/asset_registry.php','utf8');
const manifest = fs.readFileSync('asset_manifest.php','utf8');
const index = fs.readFileSync('index.php','utf8');

if (!registry.includes("'standaloneScripts' => [") || !registry.includes("'js/mobile_native_bridge.js'")) {
  throw new Error('asset registry does not own mobile_native_bridge.js as a standalone script');
}
if (!registry.includes("$registry['standaloneScripts'] ?? []")) {
  throw new Error('standalone bridge is missing from asset existence inventory');
}
if (!manifest.includes("foreach (['styles', 'scripts', 'standaloneScripts', 'images'] as $group)")) {
  throw new Error('full asset manifest does not expose standalone scripts');
}
if (!manifest.includes("'standaloneScriptCount' => count($registry['standaloneScripts'] ?? [])")) {
  throw new Error('full asset manifest does not report standalone script count');
}
if (!index.includes('/js/mobile_native_bridge.js?v=')) {
  throw new Error('index no longer loads the standalone native bridge');
}

console.log('NATIVE_BRIDGE_ASSET_CONTRACT: PASS');
