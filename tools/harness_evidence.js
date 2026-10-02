#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { classify } = require('./harness_plan');

const root = path.resolve(__dirname, '..');
const approvalPolicy = JSON.parse(
  fs.readFileSync(path.join(root, 'harness', 'approval-policy.json'), 'utf8')
);
const releaseEvidencePolicy = JSON.parse(
  fs.readFileSync(path.join(root, 'harness', 'release-evidence-policy.json'), 'utf8')
);

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

function addApprovalRequirements(impact) {
  const checks = new Set(impact.checks || []);
  const approvalsRequired = [];

  for (const flag of impact.flags || []) {
    const entry = approvalPolicy.boundaries && approvalPolicy.boundaries[flag];
    if (!entry) continue;
    checks.add(entry.checkId);
    approvalsRequired.push({ boundary: flag, checkId: entry.checkId });
  }

  impact.checks = [...checks].sort();
  impact.approvalsRequired = approvalsRequired
    .sort((a, b) => a.checkId.localeCompare(b.checkId));
  return impact;
}

function releaseRuleMatches(rule, meta) {
  const baseRef = String(meta.baseRef || '');
  const headRef = String(meta.headRef || '');
  if (rule.baseRef && rule.baseRef !== baseRef) return false;
  if (rule.headPrefix && !headRef.startsWith(String(rule.headPrefix))) return false;
  return true;
}

function addReleaseEvidenceRequirements(impact, meta) {
  const checks = new Set(impact.checks || []);
  const required = [];

  for (const rule of releaseEvidencePolicy.rules || []) {
    if (!releaseRuleMatches(rule, meta)) continue;
    for (const item of rule.internalChecks || []) {
      const id = String(item && item.id || '').trim();
      if (id) checks.add(id);
    }
    for (const item of rule.requiredChecks || []) {
      const id = String(item && item.id || '').trim();
      if (!id) continue;
      checks.add(id);
      required.push({
        ruleId: String(rule.id || ''),
        id,
        description: String(item.description || '')
      });
    }
  }

  impact.checks = [...checks].sort();
  impact.releaseEvidenceRequired = required
    .sort((a, b) => a.id.localeCompare(b.id));
  return impact;
}

function buildEvidence(files, meta) {
  let impact = classify(files);
  impact = addApprovalRequirements(impact);
  impact = addReleaseEvidenceRequirements(impact, meta);

  const baseRef = String(meta.baseRef || '');
  const headRef = String(meta.headRef || meta.ref || '');

  return {
    schema: 'kareta.harness.impact-evidence.v1',
    phase: 'IMPACT_PLANNED',
    repository: String(meta.repository || ''),
    baseSha: String(meta.baseSha || '').toLowerCase(),
    headSha: String(meta.headSha || '').toLowerCase(),
    baseRef,
    headRef,
    ref: headRef,
    workflowRunId: String(meta.workflowRunId || ''),
    source: 'git-diff-base-head',
    verification: impact.checks.map(id => ({ id, status: 'NOT_RUN' })),
    impact
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.base || !args.head || !args.output) {
    throw new Error(
      'usage: harness_evidence.js --base <sha> --head <sha> --output <path>'
    );
  }

  assertSha(args.base, 'base');
  assertSha(args.head, 'head');

  const files = gitChangedFiles(args.base, args.head);
  const evidence = buildEvidence(files, {
    repository: process.env.GITHUB_REPOSITORY || '',
    baseSha: args.base,
    headSha: args.head,
    baseRef: process.env.GITHUB_BASE_REF || '',
    headRef: process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      '',
    workflowRunId: process.env.GITHUB_RUN_ID || ''
  });

  fs.writeFileSync(args.output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('HARNESS_IMPACT: ' + evidence.impact.subsystems.join(','));
  console.log('HARNESS_RISK: ' + evidence.impact.risk);
  console.log('HARNESS_REVIEW: ' + String(evidence.impact.requiresReview));
  console.log(
    'HARNESS_RELEASE_EVIDENCE_REQUIRED: ' +
    (evidence.impact.releaseEvidenceRequired || []).map(x => x.id).join(',')
  );
  console.log('HARNESS_EVIDENCE: ' + args.output);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      'HARNESS_EVIDENCE_FAIL:',
      error && error.message ? error.message : error
    );
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  assertSha,
  gitChangedFiles,
  addApprovalRequirements,
  releaseRuleMatches,
  addReleaseEvidenceRequirements,
  buildEvidence
};
