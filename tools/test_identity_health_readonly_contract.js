'use strict';

// Read-only contract for the public Identity health endpoint.
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'identity_health.php'), 'utf8');
const assertions = [
  ['does not bootstrap runtime migrations or maintenance', !/require(?:_once)?\s+__DIR__\s*\.\s*['"]\/bootstrap\.php['"]/.test(source)],
  ['does not insert schema audit rows', !source.includes('KaretaSchemaContract::record(')],
  ['does not invoke mutating auth resolver', !source.includes('KaretaAuthResolver')],
  ['opens legacy session read-only', source.includes("session_start(['read_and_close'=>true])")],
  ['reports unavailable selected context without repair', source.includes('selected_context_unavailable')],
  ['marks detailed result read-only', source.includes("'readOnly'=>true")],
  ['contains no direct SQL mutations', !/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b\s+/i.test(source)],
];
const failed = assertions.filter(([, ok]) => !ok).map(([label]) => label);
if (failed.length) {
  console.error('IDENTITY_HEALTH_READONLY: FAIL\n' + failed.map(x => '- ' + x).join('\n'));
  process.exitCode = 1;
} else {
  console.log('IDENTITY_HEALTH_READONLY: PASS (' + assertions.length + ' assertions)');
}
