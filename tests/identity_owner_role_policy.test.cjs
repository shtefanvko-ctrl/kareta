'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const relative of ['js/next/identity_frontend.js','js/boot/runtime_identity_bundle.js']) {
  test('organization owner wildcard cannot become global admin: '+relative, () => {
    const file = path.join(__dirname, '..', relative);
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf('  function compatibilityRole(');
    const end = source.indexOf('\n  function apply(', start);
    assert.ok(start >= 0 && end > start, 'real compatibilityRole located');
    function role(context, accountTypes, capabilities) {
      const state = JSON.stringify({context, accountTypes, capabilities});
      return vm.runInNewContext('const state = '+state+';\n'+
        source.slice(start,end)+'\ncompatibilityRole();');
    }
    assert.equal(role({id:7,type:'organization',organizationType:'service_station'},[],['*']), 'sto');
    assert.equal(role({id:8,type:'organization',organizationType:'parts_store'},[],['*']), 'seller');
    assert.equal(role({id:9,type:'profile',profileType:'master'},[],['*']), 'master');
    assert.equal(role({id:10,type:'personal'},[],['*']), 'client');
    assert.equal(role({id:10,type:'personal'},
      [{role:'admin',status:'active',contextId:10}],['*']), 'admin');
    assert.equal(role({id:10,type:'personal'},
      [{role:'admin',status:'active',contextId:11}],['*']), 'client');
  });
}
