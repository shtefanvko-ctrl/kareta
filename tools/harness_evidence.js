#!/usr/bin/env node
'use strict';

const fs = require('fs');
const cp = require('child_process');
const { classify } = require('./harness_plan');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base' || arg === '--head' || arg === '--output') {
      if (!argv[i + 1]) throw new Error(arg + ' requires a value');
      out[arg.slice(2)] = argv[++i];
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

function assertSha(value, label) {
  if (!/^[0-9a-f]{7,40}$/i.test(String(value || ''))) {
    throw new Error(label + ' must be a 7-40 character hexadecimal git SHA');
  }
}

function gitChangedFiles(baseSha, headSha) {
  assertSha(baseSha, 'base');
  assertSha(headSha, 'head');
  const stdout = cp.execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRD', baseSha + '...' + headSha, '--'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  return stdout.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
}

function buildEvidence(files, meta) {
  const impact = classify(files);
  return {
    schema: 'kareta.harness.impact-evidence.v1',
    phase: 'IMPACT_PLANNED',
    repository: String(meta.repository || ''),
    baseSha: String(meta.baseSha || '').toLowerCase(),
    headSha: String(meta.headSha || '').toLowerCase(),
    ref: String(meta.ref || ''),
    workflowRunId: String(meta.workflowRunId || ''),
    source: 'git-diff-base-head',
    verification: impact.checks.map(id => ({ id, status: 'NOT_RUN' })),
    impact
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.base || !args.head || !args.output) {
    throw new Error('usage: harness_evidence.js --base <sha> --head <sha> --output <path>');
  }
  assertSha(args.base, 'base');
  assertSha(args.head, 'head');
  const files = gitChangedFiles(args.base, args.head);
  const evidence = buildEvidence(files, {
    repository: process.env.GITHUB_REPOSITORY || '',
    baseSha: args.base,
    headSha: args.head,
    ref: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '',
    workflowRunId: process.env.GITHUB_RUN_ID || ''
  });
  fs.writeFileSync(args.output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('HARNESS_IMPACT: ' + evidence.impact.subsystems.join(','));
  console.log('HARNESS_RISK: ' + evidence.impact.risk);
  console.log('HARNESS_REVIEW: ' + String(evidence.impact.requiresReview));
  console.log('HARNESS_EVIDENCE: ' + args.output);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error('HARNESS_EVIDENCE_FAIL:', error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = { parseArgs, assertSha, gitChangedFiles, buildEvidence };
