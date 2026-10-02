#!/usr/bin/env node
'use strict';

const fs = require('fs');

const ALLOWED = new Set(['PASS','FAIL','BLOCKED','NOT_RUN','NOT_REQUIRED','STALE']);

function normalizeSha(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeReceipt(receipt) {
  const id = String((receipt && (receipt.id || receipt.check)) || '').trim();
  const subjectSha = normalizeSha(receipt && (receipt.subjectSha || receipt.headSha || receipt.sha));
  const status = String((receipt && receipt.status) || '').trim().toUpperCase();
  if (!id) throw new Error('receipt check id is required');
  if (!subjectSha) throw new Error('receipt subjectSha is required for ' + id);
  if (!ALLOWED.has(status)) throw new Error('invalid receipt status for ' + id + ': ' + status);
  return { id, subjectSha, status };
}

function resolveCheck(checkId, currentSha, receipts) {
  const candidates = receipts.filter(r => r.id === checkId);
  const exact = candidates.filter(r => r.subjectSha === currentSha);

  if (exact.length) {
    if (exact.some(r => r.status === 'FAIL')) return { id: checkId, status: 'FAIL', subjectSha: currentSha };
    if (exact.some(r => r.status === 'BLOCKED')) return { id: checkId, status: 'BLOCKED', subjectSha: currentSha };
    if (exact.some(r => r.status === 'PASS')) return { id: checkId, status: 'PASS', subjectSha: currentSha };
    if (exact.some(r => r.status === 'NOT_REQUIRED')) return { id: checkId, status: 'NOT_REQUIRED', subjectSha: currentSha };
    if (exact.some(r => r.status === 'STALE')) return { id: checkId, status: 'STALE', subjectSha: currentSha };
    return { id: checkId, status: 'NOT_RUN', subjectSha: currentSha };
  }

  if (candidates.length) {
    const newest = candidates[candidates.length - 1];
    return {
      id: checkId,
      status: 'STALE',
      subjectSha: currentSha,
      staleEvidenceSha: newest.subjectSha,
      staleEvidenceStatus: newest.status
    };
  }

  return { id: checkId, status: 'NOT_RUN', subjectSha: currentSha };
}

function buildVerdict(impactEvidence, rawReceipts) {
  if (!impactEvidence || impactEvidence.schema !== 'kareta.harness.impact-evidence.v1') {
    throw new Error('unsupported impact evidence schema');
  }
  const currentSha = normalizeSha(impactEvidence.headSha);
  if (!currentSha) throw new Error('impact evidence headSha is required');
  const required = Array.from(new Set(((impactEvidence.impact || {}).checks || []).map(String))).sort();
  const receipts = (rawReceipts || []).map(normalizeReceipt);
  const checks = required.map(id => resolveCheck(id, currentSha, receipts));

  let status = 'PASS';
  if (!checks.length) status = 'BLOCKED';
  else if (checks.some(item => item.status === 'FAIL')) status = 'FAIL';
  else if (checks.some(item => ['BLOCKED','NOT_RUN','STALE'].includes(item.status))) status = 'BLOCKED';

  return {
    schema: 'kareta.harness.verdict.v1',
    subjectSha: currentSha,
    status,
    checks
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--impact' || arg === '--receipts' || arg === '--output') {
      if (!argv[i + 1]) throw new Error(arg + ' requires a value');
      out[arg.slice(2)] = argv[++i];
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.impact || !args.receipts || !args.output) {
    throw new Error('usage: harness_verdict.js --impact <impact.json> --receipts <receipts.json> --output <verdict.json>');
  }
  const impact = JSON.parse(fs.readFileSync(args.impact, 'utf8'));
  const loaded = JSON.parse(fs.readFileSync(args.receipts, 'utf8'));
  const receipts = Array.isArray(loaded) ? loaded : (loaded.receipts || []);
  const verdict = buildVerdict(impact, receipts);
  fs.writeFileSync(args.output, JSON.stringify(verdict, null, 2) + '\n');
  console.log('HARNESS_VERDICT: ' + verdict.status);
  for (const check of verdict.checks) {
    console.log('HARNESS_CHECK: ' + check.id + '=' + check.status);
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error('HARNESS_VERDICT_FAIL:', error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = { normalizeReceipt, resolveCheck, buildVerdict };
