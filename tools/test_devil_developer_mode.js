#!/usr/bin/env node
'use strict';

const fs = require('fs');

const requiredFiles = [
  'AGENTS.md',
  'ai/DEVIL.md',
  'ai/CONTEXT_ROUTER.md',
  'ai/WORKFLOW.md',
  'ai/SURFACE_MAP.json',
  'ai/CHANGE_LANES.md',
  'MB_MONITORING.md',
  '.github/prompts/devil.prompt.md',
  '.cursor/commands/devil.md',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`DEVIL contract missing required file: ${file}`);
  }
}

const devil = fs.readFileSync('ai/DEVIL.md', 'utf8');
const copilot = fs.readFileSync('.github/prompts/devil.prompt.md', 'utf8');
const cursor = fs.readFileSync('.cursor/commands/devil.md', 'utf8');

const devilMustContain = [
  'AGENTS.md',
  'ai/CONTEXT_ROUTER.md',
  'ai/WORKFLOW.md',
  'ai/SURFACE_MAP.json',
  'ai/CHANGE_LANES.md',
  'MB_MONITORING.md',
  'Web SPA',
  'PHP / API / DB',
  'Android / WebView',
  'ELM327 / OBD',
  'NOT RUN',
  'DEVIL STATUS',
  'IMPLEMENTED',
  'VERIFIED',
  'DEPLOYED',
  'BLOCKED',
];

for (const token of devilMustContain) {
  if (!devil.includes(token)) {
    throw new Error(`ai/DEVIL.md missing required contract token: ${token}`);
  }
}

if (!/^---\n[\s\S]*agent:\s*['"]agent['"][\s\S]*description:[\s\S]*\n---\n/.test(copilot)) {
  throw new Error('Copilot DEVIL prompt is missing supported prompt-file front matter');
}

for (const token of ['AGENTS.md', 'ai/DEVIL.md', 'ai/CONTEXT_ROUTER.md', 'ai/WORKFLOW.md', 'ai/SURFACE_MAP.json', 'ai/CHANGE_LANES.md']) {
  const loose = token.replace(/^ai\//, '');
  if (!copilot.includes(loose) && !copilot.includes(token)) {
    throw new Error(`Copilot DEVIL prompt does not route through ${token}`);
  }
  if (!cursor.includes(token)) {
    throw new Error(`Cursor DEVIL command does not route through ${token}`);
  }
}

for (const adapter of [
  ['Copilot', copilot],
  ['Cursor', cursor],
]) {
  const [name, text] = adapter;
  if (!text.includes('MB_MONITORING.md')) {
    throw new Error(`${name} DEVIL adapter must route release/status claims through MB_MONITORING.md`);
  }
  if (!text.includes('DEVIL STATUS')) {
    throw new Error(`${name} DEVIL adapter must use the canonical DEVIL handoff`);
  }
}

console.log('DEVIL_DEVELOPER_MODE: PASS');
console.log(JSON.stringify({
  adapters: ['github-copilot', 'cursor'],
  kernel: 'AGENTS.md',
  executionProfile: 'ai/DEVIL.md',
  checkedFiles: requiredFiles.length,
}, null, 2));
