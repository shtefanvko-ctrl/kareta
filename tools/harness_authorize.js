#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { classify, globToRegex } = require('./harness_plan');

const root = path.resolve(__dirname, '..');
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'harness', 'permission-matrix.json'), 'utf8'));

function uniq(values) {
  return [...new Set(values)].sort();
}

function matchesAny(file, patterns) {
  return (patterns || []).some(pattern => globToRegex(pattern).test(file));
}

function normalizeApprovals(values) {
  return uniq((values || []).map(v => String(v || '').trim()).filter(Boolean));
}

function authorize(input) {
  const roleName = String(input.role || matrix.defaultRole || 'observer').trim();
  const action = String(input.action || '').trim();
  const files = uniq((input.files || []).map(v => String(v || '').trim()).filter(Boolean));
  const approvals = normalizeApprovals(input.approvedBoundaries);
  const role = matrix.roles && matrix.roles[roleName];

  if (!role) {
    return {
      schema: 'kareta.harness.authorization.v1',
      authorized: false,
      role: roleName,
      action,
      files,
      reason: 'unknown-role'
    };
  }

  if (!(role.actions || []).includes(action)) {
    return {
      schema: 'kareta.harness.authorization.v1',
      authorized: false,
      role: roleName,
      action,
      files,
      reason: 'action-not-allowed'
    };
  }

  if (action !== 'write') {
    return {
      schema: 'kareta.harness.authorization.v1',
      authorized: true,
      role: roleName,
      level: role.level,
      action,
      files,
      reason: 'action-allowed',
      requiredApprovals: []
    };
  }

  if (!files.length) {
    return {
      schema: 'kareta.harness.authorization.v1',
      authorized: false,
      role: roleName,
      level: role.level,
      action,
      files,
      reason: 'write-requires-file-list',
      requiredApprovals: []
    };
  }

  const pathDenied = [];
  for (const file of files) {
    const allowed = matchesAny(file, role.writeAllow || []);
    const explicitlyDenied = matchesAny(file, role.writeDeny || []);
    if (!allowed || explicitlyDenied) pathDenied.push(file);
  }

  if (pathDenied.length) {
    return {
      schema: 'kareta.harness.authorization.v1',
      authorized: false,
      role: roleName,
      level: role.level,
      action,
      files,
      reason: 'path-not-allowed',
      deniedFiles: uniq(pathDenied),
      requiredApprovals: []
    };
  }

  const impact = classify(files);
  const protectedFlags = uniq(
    (impact.flags || []).filter(flag => (matrix.protectedFlags || []).includes(flag))
  );

  if (protectedFlags.length) {
    if (role.protectedMode !== 'approval-required') {
      return {
        schema: 'kareta.harness.authorization.v1',
        authorized: false,
        role: roleName,
        level: role.level,
        action,
        files,
        reason: 'protected-boundary-role-denied',
        protectedFlags,
        requiredApprovals: protectedFlags
      };
    }

    const missing = protectedFlags.filter(flag => !approvals.includes(flag));
    if (missing.length) {
      return {
        schema: 'kareta.harness.authorization.v1',
        authorized: false,
        role: roleName,
        level: role.level,
        action,
        files,
        reason: 'protected-boundary-approval-required',
        protectedFlags,
        requiredApprovals: missing
      };
    }
  }

  return {
    schema: 'kareta.harness.authorization.v1',
    authorized: true,
    role: roleName,
    level: role.level,
    action,
    files,
    reason: protectedFlags.length ? 'protected-boundary-approved' : 'write-allowed',
    protectedFlags,
    requiredApprovals: []
  };
}

function parseArgs(argv) {
  const out = { files: [], approvedBoundaries: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--role' || arg === '--action' || arg === '--output') {
      if (!argv[i + 1]) throw new Error(arg + ' requires a value');
      out[arg.slice(2)] = argv[++i];
    } else if (arg === '--file') {
      if (!argv[i + 1]) throw new Error('--file requires a value');
      out.files.push(argv[++i]);
    } else if (arg === '--approved-boundary') {
      if (!argv[i + 1]) throw new Error('--approved-boundary requires a value');
      out.approvedBoundaries.push(argv[++i]);
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.action) throw new Error('--action is required');
  const result = authorize(args);
  const payload = JSON.stringify(result, null, 2) + '\n';
  if (args.output) fs.writeFileSync(args.output, payload);
  process.stdout.write(payload);
  if (!result.authorized) process.exit(2);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error('HARNESS_AUTHORIZATION_FAIL:', error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = { authorize, matchesAny, normalizeApprovals };
