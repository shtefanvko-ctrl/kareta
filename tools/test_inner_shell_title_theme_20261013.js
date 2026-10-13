'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css/next/mobile_brand_center.css'), 'utf8');
const titleRules = [...css.matchAll(/\.k-shell-page-title\s*\{([^}]*)\}/g)]
  .map(match => match[1])
  .filter(body => body.includes('font-weight:800'));
assert.equal(titleRules.length, 2, 'mobile and desktop inner title rules required');
assert(titleRules.every(body => body.includes('color:var(--k-text,#111827)')),
  'inner page title must use the shared theme text token');
console.log('PASS inner shell title theme token');
