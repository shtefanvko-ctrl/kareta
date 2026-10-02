#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');

const CHECK_SOURCES = {
  'verification-gate': { workflow: 'verify', receiptId: 'verification-gate' },
  'application-gates': { workflow: 'Application gates', receiptId: 'application-gates' },
  'php-syntax': { workflow: 'verify', receiptId: 'verification-gate' },
  'js-syntax': { workflow: 'Application gates', receiptId: 'application-gates' },
  'lazy-route': { workflow: 'Application gates', receiptId: 'application-gates' },
  'asset-url-hygiene': { workflow: 'Application gates', receiptId: 'application-gates' },
  'api-contract': { workflow: 'Application gates', receiptId: 'application-gates' },
  'migration-contract': { workflow: 'verify', receiptId: 'verification-gate' },
  'release-migration-manifest': { workflow: 'Application gates', receiptId: 'application-gates' },
  'geo-platform-core': { workflow: 'Application gates', receiptId: 'application-gates' },
  'obd-remote-control-plane': { workflow: 'Application gates', receiptId: 'application-gates' },
  'android-native-api6-contract': { workflow: 'verify', receiptId: 'verification-gate' },
  'current-release': { workflow: 'verify', receiptId: 'verification-gate' },
  'provenance': { workflow: 'Application gates', receiptId: 'application-gates' },
  'staging-verifier-syntax': { workflow: 'verify', receiptId: 'verification-gate' }
};

function isApprovalCheck(checkId) {
  return /^approval:[a-z0-9-]+$/.test(String(checkId || ''));
}

function conclusionToStatus(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'success') return 'PASS';
  if (v === 'failure' || v === 'timed_out') return 'FAIL';
  return 'BLOCKED';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function githubGet(repo, path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/' + repo + path,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'User-Agent': 'kareta-harness',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('GitHub API ' + res.statusCode + ': ' + body.slice(0, 500)));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function latestRun(runs, workflowName, headSha) {
  const exact = (runs || [])
    .filter(run => run && run.name === workflowName && String(run.head_sha || '').toLowerCase() === headSha)
    .sort((a, b) => Number(b.run_number || 0) - Number(a.run_number || 0));
  return exact[0] || null;
}

async function waitForReceipt(checkId, repo, headSha, token, deadline) {
  const source = CHECK_SOURCES[checkId];
  if (!source) throw new Error('no workflow mapping for required check ' + checkId);
  const workflowName = source.workflow;
  const artifactName = 'harness-receipt-' + source.receiptId + '-' + headSha;

  while (Date.now() < deadline) {
    const data = await githubGet(repo, '/actions/runs?head_sha=' + encodeURIComponent(headSha) + '&per_page=100', token);
    const run = latestRun(data.workflow_runs, workflowName, headSha);
    if (run && run.status === 'completed') {
      const artifacts = await githubGet(repo, '/actions/runs/' + run.id + '/artifacts?per_page=100', token);
      const artifact = (artifacts.artifacts || []).find(item => item.name === artifactName && !item.expired);
      if (artifact) {
        return {
          schema: 'kareta.harness.receipt.v1',
          id: checkId,
          subjectSha: headSha,
          status: conclusionToStatus(run.conclusion),
          workflow: workflowName,
          runId: String(run.id),
          runAttempt: String(run.run_attempt || ''),
          repository: repo,
          ref: String(run.head_branch || ''),
          source: 'github-actions-artifact-index',
          receiptArtifactId: String(artifact.id),
          receiptArtifactName: artifact.name
        };
      }
    }
    await sleep(5000);
  }
  throw new Error('timed out waiting for exact-head receipt: ' + checkId + '@' + headSha);
}

async function waitForApproval(checkId, repo, headSha, token, deadline) {
  const boundary = String(checkId).slice('approval:'.length);
  const artifactName = 'harness-approval-' + boundary + '-' + headSha;

  while (Date.now() < deadline) {
    const data = await githubGet(
      repo,
      '/actions/artifacts?name=' + encodeURIComponent(artifactName) + '&per_page=100',
      token
    );
    const artifact = (data.artifacts || [])
      .filter(item => item && item.name === artifactName && !item.expired)
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
    if (artifact) {
      return {
        schema: 'kareta.harness.receipt.v1',
        id: checkId,
        subjectSha: headSha,
        status: 'PASS',
        workflow: 'Harness approval',
        runId: String((artifact.workflow_run && artifact.workflow_run.id) || ''),
        repository: repo,
        ref: String((artifact.workflow_run && artifact.workflow_run.head_branch) || ''),
        source: 'github-actions-approval-artifact-index',
        receiptArtifactId: String(artifact.id),
        receiptArtifactName: artifact.name
      };
    }
    await sleep(5000);
  }
  throw new Error('timed out waiting for protected-boundary approval: ' + checkId + '@' + headSha);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--impact','--output','--timeout-seconds'].includes(arg)) {
      if (!argv[i + 1]) throw new Error(arg + ' requires a value');
      out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.impact || !args.output) {
    throw new Error('usage: harness_collect_receipts.js --impact <impact.json> --output <receipts.json> [--timeout-seconds 600]');
  }
  const impact = JSON.parse(fs.readFileSync(args.impact, 'utf8'));
  const headSha = String(impact.headSha || '').toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(headSha)) throw new Error('impact headSha is invalid');
  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GITHUB_TOKEN || '';
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  const required = Array.from(new Set(((impact.impact || {}).checks || []).map(String))).sort();
  const timeoutSeconds = Math.max(10, Number(args.timeoutSeconds || 600));
  const deadline = Date.now() + timeoutSeconds * 1000;
  const receipts = [];

  if (required.includes('harness-self-test')) {
    receipts.push({
      schema: 'kareta.harness.receipt.v1',
      id: 'harness-self-test',
      subjectSha: headSha,
      status: 'PASS',
      workflow: process.env.GITHUB_WORKFLOW || 'Harness impact',
      job: process.env.GITHUB_JOB || 'impact',
      runId: process.env.GITHUB_RUN_ID || '',
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || '',
      repository: repo,
      ref: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '',
      source: 'harness-impact-local'
    });
  }

  for (const checkId of required) {
    if (checkId === 'harness-self-test') continue;
    if (isApprovalCheck(checkId)) {
      receipts.push(await waitForApproval(checkId, repo, headSha, token, deadline));
      continue;
    }
    if (!CHECK_SOURCES[checkId]) throw new Error('unmapped required check: ' + checkId);
    receipts.push(await waitForReceipt(checkId, repo, headSha, token, deadline));
  }

  fs.writeFileSync(args.output, JSON.stringify({
    schema: 'kareta.harness.receipts.v1',
    subjectSha: headSha,
    receipts
  }, null, 2) + '\n');
  console.log('HARNESS_RECEIPTS: ' + receipts.map(r => r.id + '=' + r.status).join(','));
}

if (require.main === module) {
  main().catch(error => {
    console.error('HARNESS_RECEIPTS_FAIL:', error && error.message ? error.message : error);
    process.exit(1);
  });
}

module.exports = { CHECK_SOURCES, isApprovalCheck, conclusionToStatus, latestRun };
