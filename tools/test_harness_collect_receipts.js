#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  CHECK_SOURCES,
  isApprovalCheck,
  isExternalEvidenceCheck,
  parseApprovalLine,
  parseExternalEvidenceLine,
  findCommentApproval,
  findCommentExternalEvidence,
  conclusionToStatus,
  latestRun
} = require('./harness_collect_receipts');

assert.strictEqual(conclusionToStatus('success'), 'PASS');
assert.strictEqual(conclusionToStatus('failure'), 'FAIL');
assert.strictEqual(conclusionToStatus('timed_out'), 'FAIL');
assert.strictEqual(conclusionToStatus('cancelled'), 'BLOCKED');

assert.strictEqual(CHECK_SOURCES['geo-platform-core'].workflow, 'Application gates');
assert.strictEqual(CHECK_SOURCES['migration-contract'].workflow, 'verify');
assert.strictEqual(CHECK_SOURCES['asset-url-hygiene'].receiptId, 'application-gates');
assert.strictEqual(CHECK_SOURCES['server-package'].workflow, 'Server package');
assert.strictEqual(CHECK_SOURCES['server-package'].receiptId, 'server-package');

assert.strictEqual(isApprovalCheck('approval:database-contract'), true);
assert.strictEqual(isApprovalCheck('approval:deployment-sensitive'), true);
assert.strictEqual(isApprovalCheck('verification-gate'), false);
assert.strictEqual(isExternalEvidenceCheck('external:staging-exact-runtime'), true);
assert.strictEqual(isExternalEvidenceCheck('approval:database-contract'), false);

const sha='c21f1f8435a218d7eaca0a0fda21e60c3f8ee084';
const parsed=parseApprovalLine(
  'HARNESS_APPROVE database-contract ' + sha + ' Reviewed migration chain 130-137'
);
assert(parsed);
assert.strictEqual(parsed.boundary,'database-contract');
assert.strictEqual(parsed.subjectSha,sha);
assert.strictEqual(parsed.reason,'Reviewed migration chain 130-137');

assert.strictEqual(parseApprovalLine('HARNESS_APPROVE database-contract badsha reason'),null);
assert.strictEqual(parseApprovalLine('not an approval'),null);

const comments=[
  {
    id: 10,
    user:{login:'someone-else'},
    body:'HARNESS_APPROVE database-contract ' + sha + ' Unauthorized actor approval'
  },
  {
    id: 11,
    user:{login:'shtefanvko-ctrl'},
    body:'HARNESS_APPROVE native-bridge-contract ' + sha + ' Wrong boundary for this check'
  },
  {
    id: 12,
    user:{login:'shtefanvko-ctrl'},
    html_url:'https://github.com/shtefanvko-ctrl/kareta/pull/22#issuecomment-12',
    body:[
      'Release review notes',
      'HARNESS_APPROVE database-contract ' + sha + ' Migration manifests and chain reviewed'
    ].join('\n')
  }
];

const approval=findCommentApproval('approval:database-contract',sha,comments);
assert(approval);
assert.strictEqual(approval.status,'PASS');
assert.strictEqual(approval.actor,'shtefanvko-ctrl');
assert.strictEqual(approval.commentId,'12');
assert.strictEqual(approval.source,'github-pr-comment');

assert.strictEqual(
  findCommentApproval('approval:deployment-sensitive',sha,comments),
  null
);
assert.strictEqual(
  findCommentApproval(
    'approval:database-contract',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    comments
  ),
  null
);

const externalLine =
  'HARNESS_EVIDENCE external:staging-exact-runtime ' + sha +
  ' PASS run:37027129475 staging verifier output';
const parsedExternal = parseExternalEvidenceLine(externalLine);
assert(parsedExternal);
assert.strictEqual(parsedExternal.checkId, 'external:staging-exact-runtime');
assert.strictEqual(parsedExternal.subjectSha, sha);
assert.strictEqual(parsedExternal.status, 'PASS');
assert.strictEqual(
  parseExternalEvidenceLine(
    'HARNESS_EVIDENCE external:staging-exact-runtime ' + sha +
    ' FAIL failed evidence'
  ),
  null
);

const externalComments = [
  {
    id: 20,
    user:{login:'someone-else'},
    body:externalLine
  },
  {
    id: 21,
    user:{login:'shtefanvko-ctrl'},
    body:
      'HARNESS_EVIDENCE external:staging-exact-runtime ' +
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      ' PASS stale evidence'
  },
  {
    id: 22,
    user:{login:'shtefanvko-ctrl'},
    html_url:'https://github.com/shtefanvko-ctrl/kareta/pull/22#issuecomment-22',
    body:externalLine
  }
];
const externalEvidence = findCommentExternalEvidence(
  'external:staging-exact-runtime',
  sha,
  externalComments
);
assert(externalEvidence);
assert.strictEqual(externalEvidence.status, 'PASS');
assert.strictEqual(externalEvidence.actor, 'shtefanvko-ctrl');
assert.strictEqual(externalEvidence.source, 'github-pr-external-evidence');
assert.strictEqual(
  findCommentExternalEvidence(
    'external:deployed-provenance',
    sha,
    externalComments
  ),
  null
);

const runs = [
  {name:'verify',head_sha:'abc1234',run_number:7,id:7},
  {name:'verify',head_sha:'abc1234',run_number:9,id:9},
  {name:'verify',head_sha:'def5678',run_number:10,id:10},
  {name:'Application gates',head_sha:'abc1234',run_number:11,id:11}
];
assert.strictEqual(latestRun(runs,'verify','abc1234').id,9);
assert.strictEqual(latestRun(runs,'Application gates','abc1234').id,11);
assert.strictEqual(latestRun(runs,'verify','fffffff'),null);

console.log('HARNESS_RECEIPT_COLLECTOR: PASS');
