#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'harness', 'approval-policy.json'), 'utf8'));

function normalizeSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error('subject SHA must be hexadecimal');
  return sha;
}

function buildApproval(input) {
  const boundary = String(input.boundary || '').trim();
  const entry = policy.boundaries && policy.boundaries[boundary];
  if (!entry) throw new Error('unsupported approval boundary: ' + boundary);
  const reason = String(input.reason || '').trim();
  if (reason.length < 5) throw new Error('approval reason must contain at least 5 characters');
  const actor = String(input.actor || '').trim();
  if (!actor) throw new Error('approval actor is required');
  return {
    schema: 'kareta.harness.approval.v1',
    id: entry.checkId,
    boundary,
    subjectSha: normalizeSha(input.subjectSha),
    status: 'PASS',
    actor,
    reason,
    repository: String(input.repository || ''),
    workflow: String(input.workflow || 'Harness approval'),
    runId: String(input.runId || ''),
    runAttempt: String(input.runAttempt || ''),
    source: 'manual-workflow-dispatch'
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--boundary','--subject-sha','--reason','--output'].includes(arg)) {
      if (!argv[i + 1]) throw new Error(arg + ' requires a value');
      out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.boundary || !args.subjectSha || !args.reason || !args.output) {
    throw new Error('usage: harness_approval.js --boundary <name> --subject-sha <sha> --reason <text> --output <path>');
  }
  const approval = buildApproval({
    boundary: args.boundary,
    subjectSha: args.subjectSha,
    reason: args.reason,
    actor: process.env.GITHUB_ACTOR || '',
    repository: process.env.GITHUB_REPOSITORY || '',
    workflow: process.env.GITHUB_WORKFLOW || 'Harness approval',
    runId: process.env.GITHUB_RUN_ID || '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || ''
  });
  fs.writeFileSync(args.output, JSON.stringify(approval, null, 2) + '\n');
  console.log('HARNESS_APPROVAL: ' + approval.id + '=PASS@' + approval.subjectSha);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error('HARNESS_APPROVAL_FAIL:', error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = { normalizeSha, buildApproval };
