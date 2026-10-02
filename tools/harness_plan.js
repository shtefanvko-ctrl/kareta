#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mapPath = path.join(root, 'harness', 'change-map.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const riskRank = { low: 1, medium: 2, high: 3, critical: 4, review: 3 };

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}

function globToRegex(pattern) {
  const token = '__KARETA_DOUBLE_STAR__';
  const escaped = escapeRegex(pattern)
    .replace(/\\\*\\\*/g, token)
    .replace(/\\\*/g, '[^/]*')
    .replace(new RegExp(token, 'g'), '.*');
  return new RegExp('^' + escaped + '$');
}

function matches(pattern, file) {
  return globToRegex(pattern).test(file);
}

function uniqSorted(values) {
  return [...new Set(values)].sort();
}

function classify(files) {
  const normalized = uniqSorted(files.map(v => String(v || '').trim()).filter(Boolean));
  const matchedRules = [];
  const subsystems = [];
  const checks = [];
  const flags = [];
  let requiresReview = false;
  let risk = 'low';
  let anyMatched = false;

  for (const file of normalized) {
    let fileMatched = false;
    for (const rule of map.rules) {
      if ((rule.include || []).some(pattern => matches(pattern, file))) {
        anyMatched = true;
        fileMatched = true;
        matchedRules.push(rule.id);
        subsystems.push(...(rule.subsystems || []));
        checks.push(...(rule.checks || []));
        flags.push(...(rule.flags || []));
        requiresReview = requiresReview || rule.requiresReview === true;
        if ((riskRank[rule.risk] || 0) > (riskRank[risk] || 0)) risk = rule.risk;
      }
    }
    if (!fileMatched) {
      subsystems.push(...map.default.subsystems);
      checks.push(...map.default.checks);
      requiresReview = true;
      if ((riskRank[map.default.risk] || 0) > (riskRank[risk] || 0)) risk = map.default.risk;
    }
  }

  if (!normalized.length) {
    requiresReview = true;
    risk = 'review';
    subsystems.push(...map.default.subsystems);
    checks.push(...map.default.checks);
  }

  return {
    schema: 'kareta.harness.impact.v1',
    files: normalized,
    matchedRules: uniqSorted(matchedRules),
    subsystems: uniqSorted(subsystems),
    checks: uniqSorted(checks),
    risk,
    requiresReview,
    flags: uniqSorted(flags),
    matched: anyMatched
  };
}

function readFilesFromCli(argv) {
  if (argv.length) return argv;
  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) return [];
  if (stdin.startsWith('[')) {
    const parsed = JSON.parse(stdin);
    if (!Array.isArray(parsed)) throw new Error('stdin JSON must be an array of file paths');
    return parsed;
  }
  return stdin.split(/\r?\n/);
}

if (require.main === module) {
  const result = classify(readFilesFromCli(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = { classify, globToRegex };
