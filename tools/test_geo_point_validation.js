'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync('js/next/geo_map.js','utf8'), {window});
for (const [lat,lng] of [[true,82.6],[49.9,false],[null,82.6],['',82.6],['Infinity',82.6],['0x10',82.6],['1e2',82.6],[91,82.6],[49.9,181]]) {
  assert.throws(() => window.KaretaGeoMap.open({center:{latitude:lat,longitude:lng}}), /GEO_MAP_POINTS_REQUIRED/);
}
console.log('PASS Geo map rejects booleans, null, nondecimal and out-of-range coordinates');
