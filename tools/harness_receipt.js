#!/usr/bin/env node
'use strict';

const fs = require('fs');

function normalizeSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error('subject SHA must be hexadecimal');
  return sha;
}

function statusFromJobStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'success') return 'PASS';
  if (status === 'failure') return 'FAIL';
  if (status === 'cancelled' || status === 'skipped') return 'BLOCKED';
  return 'BLOCKED';
}

function buildReceipt(input) {
  const id = String(input.id || '').trim();
  if (!id) throw new Error('receipt id is required');
  const subjectSha = normalizeSha(input.subjectSha);
  const status = input.status
    ? String(input.status).trim().toUpperCase()
    : statusFromJobStatus(input.jobStatus);
  if (!['PASS','FAIL','BLOCKED','NOT_RUN','NOT_REQUIRED','STALE'].includes(status)) {
    throw new Error('unsupported receipt status: ' + status);
  }
  return {
    schema: 'kareta.harness.receipt.v1',
    id,
    subjectSha,
    status,
    workflow: String(input.workflow || ''),
    job: String(input.job || ''),
    runId: String(input.runId || ''),
    runAttempt: String(input.runAttempt || ''),
    repository: String(input.repository || ''),
    ref: String(input.ref || ''),
    source: 'github-actions'
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--id','--subject-sha','--job-status','--status','--output'].includes(arg)) {
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
  if (!args.id || !args.subjectSha || !args.output) {
    throw new Error('usage: harness_receipt.js --id <id> --subject-sha <sha> --job-status <status> --output <path>');
  }
  const receipt = buildReceipt({
    id: args.id,
    subjectSha: args.subjectSha,
    jobStatus: args.jobStatus,
    status: args.status,
    workflow: process.env.GITHUB_WORKFLOW || '',
    job: process.env.GITHUB_JOB || '',
    runId: process.env.GITHUB_RUN_ID || '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || '',
    repository: process.env.GITHUB_REPOSITORY || '',
    ref: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || ''
  });
  fs.writeFileSync(args.output, JSON.stringify(receipt, null, 2) + '\n');
  console.log('HARNESS_RECEIPT: ' + receipt.id + '=' + receipt.status + '@' + receipt.subjectSha);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error('HARNESS_RECEIPT_FAIL:', error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = { normalizeSha, statusFromJobStatus, buildReceipt };
