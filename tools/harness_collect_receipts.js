#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.resolve(__dirname, '..');
const approvalPolicy = JSON.parse(
  fs.readFileSync(path.join(root, 'harness', 'approval-policy.json'), 'utf8')
);
const releaseEvidencePolicy = JSON.parse(
  fs.readFileSync(path.join(root, 'harness', 'release-evidence-policy.json'), 'utf8')
);

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
  'staging-verifier-syntax': { workflow: 'verify', receiptId: 'verification-gate' },
  'server-package': { workflow: 'Server package', receiptId: 'server-package' }
};

function isApprovalCheck(checkId) {
  return /^approval:[a-z0-9-]+$/.test(String(checkId || ''));
}

function isExternalEvidenceCheck(checkId) {
  return /^external:[a-z0-9-]+$/.test(String(checkId || ''));
}

function parseApprovalLine(line) {
  const cfg = approvalPolicy.commentApproval || {};
  const prefix = String(cfg.prefix || 'HARNESS_APPROVE').trim();
  const text = String(line || '').trim();
  if (!text.startsWith(prefix + ' ')) return null;

  const parts = text.slice(prefix.length).trim().split(/\s+/);
  if (parts.length < 3) return null;

  const boundary = String(parts.shift() || '').toLowerCase();
  const subjectSha = String(parts.shift() || '').toLowerCase();
  const reason = parts.join(' ').trim();

  if (!/^[a-z0-9-]+$/.test(boundary)) return null;
  if (!/^[0-9a-f]{40}$/.test(subjectSha)) return null;
  if (reason.length < 5) return null;

  return { boundary, subjectSha, reason };
}

function parseExternalEvidenceLine(line) {
  const cfg = releaseEvidencePolicy.evidenceComment || {};
  const prefix = String(cfg.prefix || 'HARNESS_EVIDENCE').trim();
  const text = String(line || '').trim();
  if (!text.startsWith(prefix + ' ')) return null;

  const parts = text.slice(prefix.length).trim().split(/\s+/);
  if (parts.length < 4) return null;

  const checkId = String(parts.shift() || '').toLowerCase();
  const subjectSha = String(parts.shift() || '').toLowerCase();
  const status = String(parts.shift() || '').toUpperCase();
  const evidence = parts.join(' ').trim();

  if (!/^external:[a-z0-9-]+$/.test(checkId)) return null;
  if (!/^[0-9a-f]{40}$/.test(subjectSha)) return null;
  if (status !== 'PASS') return null;
  if (evidence.length < 5) return null;

  return { checkId, subjectSha, status, evidence };
}

function findCommentApproval(checkId, headSha, comments) {
  const cfg = approvalPolicy.commentApproval || {};
  if (cfg.enabled !== true) return null;

  const boundary = String(checkId || '').slice('approval:'.length);
  const actors = new Set(
    (cfg.authorizedActors || []).map(v => String(v || '').toLowerCase())
  );
  const ordered = [...(comments || [])]
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

  for (const comment of ordered) {
    const actor = String(
      comment && comment.user && comment.user.login || ''
    ).toLowerCase();
    if (!actors.has(actor)) continue;

    for (const line of String(comment.body || '').split(/\r?\n/)) {
      const parsed = parseApprovalLine(line);
      if (!parsed) continue;
      if (parsed.boundary !== boundary) continue;
      if (parsed.subjectSha !== headSha) continue;

      return {
        schema: 'kareta.harness.receipt.v1',
        id: checkId,
        subjectSha: headSha,
        status: 'PASS',
        actor,
        reason: parsed.reason,
        source: 'github-pr-comment',
        commentId: String(comment.id || ''),
        commentUrl: String(comment.html_url || '')
      };
    }
  }

  return null;
}

function findCommentExternalEvidence(checkId, headSha, comments) {
  const cfg = releaseEvidencePolicy.evidenceComment || {};
  if (cfg.enabled !== true) return null;

  const actors = new Set(
    (cfg.authorizedActors || []).map(v => String(v || '').toLowerCase())
  );
  const ordered = [...(comments || [])]
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

  for (const comment of ordered) {
    const actor = String(
      comment && comment.user && comment.user.login || ''
    ).toLowerCase();
    if (!actors.has(actor)) continue;

    for (const line of String(comment.body || '').split(/\r?\n/)) {
      const parsed = parseExternalEvidenceLine(line);
      if (!parsed) continue;
      if (parsed.checkId !== checkId) continue;
      if (parsed.subjectSha !== headSha) continue;

      return {
        schema: 'kareta.harness.receipt.v1',
        id: checkId,
        subjectSha: headSha,
        status: 'PASS',
        actor,
        evidence: parsed.evidence,
        source: 'github-pr-external-evidence',
        commentId: String(comment.id || ''),
        commentUrl: String(comment.html_url || '')
      };
    }
  }

  return null;
}

function readPullRequestNumber() {
  const eventPath = process.env.GITHUB_EVENT_PATH || '';
  if (!eventPath || !fs.existsSync(eventPath)) return null;

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const value = event && event.pull_request && event.pull_request.number;
  return Number.isInteger(value) && value > 0 ? value : null;
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

function githubGet(repo, apiPath, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/' + repo + apiPath,
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
          reject(new Error(
            'GitHub API ' + res.statusCode + ': ' + body.slice(0, 500)
          ));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function latestRun(runs, workflowName, headSha) {
  const exact = (runs || [])
    .filter(run =>
      run &&
      run.name === workflowName &&
      String(run.head_sha || '').toLowerCase() === headSha
    )
    .sort((a, b) => Number(b.run_number || 0) - Number(a.run_number || 0));
  return exact[0] || null;
}

async function fetchIssueComments(repo, prNumber, token, maxPages) {
  if (!prNumber) return [];
  const pages = Math.max(1, Math.min(20, Number(maxPages || 10)));
  const comments = [];

  for (let page = 1; page <= pages; page += 1) {
    const batch = await githubGet(
      repo,
      '/issues/' + prNumber + '/comments?per_page=100&page=' + page,
      token
    );
    if (!Array.isArray(batch)) {
      throw new Error('GitHub comments response is not an array');
    }
    comments.push(...batch);
    if (batch.length < 100) break;
  }

  return comments;
}

async function waitForReceipt(checkId, repo, headSha, token, deadline) {
  const source = CHECK_SOURCES[checkId];
  if (!source) {
    throw new Error('no workflow mapping for required check ' + checkId);
  }

  const artifactName =
    'harness-receipt-' + source.receiptId + '-' + headSha;

  while (Date.now() < deadline) {
    const data = await githubGet(
      repo,
      '/actions/runs?head_sha=' + encodeURIComponent(headSha) + '&per_page=100',
      token
    );
    const run = latestRun(data.workflow_runs, source.workflow, headSha);

    if (run && run.status === 'completed') {
      const artifacts = await githubGet(
        repo,
        '/actions/runs/' + run.id + '/artifacts?per_page=100',
        token
      );
      const artifact = (artifacts.artifacts || [])
        .find(item => item.name === artifactName && !item.expired);

      if (artifact) {
        return {
          schema: 'kareta.harness.receipt.v1',
          id: checkId,
          subjectSha: headSha,
          status: conclusionToStatus(run.conclusion),
          workflow: source.workflow,
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

  throw new Error(
    'timed out waiting for exact-head receipt: ' + checkId + '@' + headSha
  );
}

async function waitForApproval(
  checkId,
  repo,
  headSha,
  token,
  deadline,
  prNumber
) {
  const boundary = String(checkId).slice('approval:'.length);
  const artifactName = 'harness-approval-' + boundary + '-' + headSha;

  while (Date.now() < deadline) {
    const data = await githubGet(
      repo,
      '/actions/artifacts?name=' +
        encodeURIComponent(artifactName) +
        '&per_page=100',
      token
    );
    const artifact = (data.artifacts || [])
      .filter(item =>
        item &&
        item.name === artifactName &&
        !item.expired
      )
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];

    if (artifact) {
      return {
        schema: 'kareta.harness.receipt.v1',
        id: checkId,
        subjectSha: headSha,
        status: 'PASS',
        workflow: 'Harness approval',
        runId: String(
          artifact.workflow_run && artifact.workflow_run.id || ''
        ),
        repository: repo,
        ref: String(
          artifact.workflow_run && artifact.workflow_run.head_branch || ''
        ),
        source: 'github-actions-approval-artifact-index',
        receiptArtifactId: String(artifact.id),
        receiptArtifactName: artifact.name
      };
    }

    if (prNumber) {
      const comments = await fetchIssueComments(
        repo,
        prNumber,
        token,
        (approvalPolicy.commentApproval || {}).maxPages
      );
      const approval = findCommentApproval(checkId, headSha, comments);
      if (approval) {
        approval.repository = repo;
        approval.pullRequest = prNumber;
        return approval;
      }
    }

    await sleep(5000);
  }

  throw new Error(
    'timed out waiting for protected-boundary approval: ' +
      checkId + '@' + headSha
  );
}

async function collectExternalEvidence(
  checkId,
  repo,
  headSha,
  token,
  prNumber
) {
  if (!prNumber) {
    return {
      schema: 'kareta.harness.receipt.v1',
      id: checkId,
      subjectSha: headSha,
      status: 'NOT_RUN',
      repository: repo,
      source: 'external-evidence-missing',
      reason: 'pull-request-context-missing'
    };
  }

  const comments = await fetchIssueComments(
    repo,
    prNumber,
    token,
    (releaseEvidencePolicy.evidenceComment || {}).maxPages
  );
  const evidence = findCommentExternalEvidence(checkId, headSha, comments);

  if (evidence) {
    evidence.repository = repo;
    evidence.pullRequest = prNumber;
    return evidence;
  }

  return {
    schema: 'kareta.harness.receipt.v1',
    id: checkId,
    subjectSha: headSha,
    status: 'NOT_RUN',
    repository: repo,
    pullRequest: prNumber,
    source: 'external-evidence-missing',
    reason: 'no-authorized-exact-sha-evidence'
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--impact', '--output', '--timeout-seconds'].includes(arg)) {
      if (!argv[i + 1]) throw new Error(arg + ' requires a value');
      out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] =
        argv[++i];
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.impact || !args.output) {
    throw new Error(
      'usage: harness_collect_receipts.js --impact <impact.json> ' +
      '--output <receipts.json> [--timeout-seconds 600]'
    );
  }

  const impact = JSON.parse(fs.readFileSync(args.impact, 'utf8'));
  const headSha = String(impact.headSha || '').toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(headSha)) {
    throw new Error('impact headSha is invalid');
  }

  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GITHUB_TOKEN || '';
  if (!repo || !token) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  }

  const required = Array.from(
    new Set(((impact.impact || {}).checks || []).map(String))
  ).sort();
  const timeoutSeconds = Math.max(10, Number(args.timeoutSeconds || 600));
  const deadline = Date.now() + timeoutSeconds * 1000;
  const receipts = [];
  const prNumber = readPullRequestNumber();

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
      ref: process.env.GITHUB_HEAD_REF ||
        process.env.GITHUB_REF_NAME ||
        '',
      source: 'harness-impact-local'
    });
  }

  const internalChecks = required.filter(
    id => id !== 'harness-self-test' && !isExternalEvidenceCheck(id)
  );
  const externalChecks = required.filter(isExternalEvidenceCheck);

  for (const checkId of internalChecks) {
    if (isApprovalCheck(checkId)) {
      receipts.push(
        await waitForApproval(
          checkId,
          repo,
          headSha,
          token,
          deadline,
          prNumber
        )
      );
      continue;
    }

    if (!CHECK_SOURCES[checkId]) {
      throw new Error('unmapped required check: ' + checkId);
    }

    receipts.push(
      await waitForReceipt(checkId, repo, headSha, token, deadline)
    );
  }

  for (const checkId of externalChecks) {
    receipts.push(
      await collectExternalEvidence(
        checkId,
        repo,
        headSha,
        token,
        prNumber
      )
    );
  }

  fs.writeFileSync(
    args.output,
    JSON.stringify({
      schema: 'kareta.harness.receipts.v1',
      subjectSha: headSha,
      receipts
    }, null, 2) + '\n'
  );

  console.log(
    'HARNESS_RECEIPTS: ' +
      receipts.map(r => r.id + '=' + r.status).join(',')
  );
}

if (require.main === module) {
  main().catch(error => {
    console.error(
      'HARNESS_RECEIPTS_FAIL:',
      error && error.message ? error.message : error
    );
    process.exit(1);
  });
}

module.exports = {
  CHECK_SOURCES,
  isApprovalCheck,
  isExternalEvidenceCheck,
  parseApprovalLine,
  parseExternalEvidenceLine,
  findCommentApproval,
  findCommentExternalEvidence,
  readPullRequestNumber,
  conclusionToStatus,
  latestRun,
  collectExternalEvidence
};
