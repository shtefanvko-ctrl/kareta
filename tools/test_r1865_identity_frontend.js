'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeSandbox(responses) {
  let index = 0;
  const events = [];
  class CustomEvent { constructor(name, init={}) { this.type=name; this.detail=init.detail; } }
  const documentElement = { dataset:{} };
  const sandbox = {
    console,
    structuredClone: value => JSON.parse(JSON.stringify(value)),
    CustomEvent,
    document:{ documentElement },
    window:{
      dispatchEvent:event => events.push(event),
      addEventListener:()=>{},
    },
    fetch: async () => {
      const item = responses[index++];
      if (!item) throw new Error('missing mocked response');
      return {
        ok:item.status >= 200 && item.status < 300,
        status:item.status,
        headers:{get:name => name.toLowerCase()==='content-type' ? (item.contentType || 'application/json') : ''},
        text:async()=>item.body,
      };
    },
  };
  sandbox.window.window=sandbox.window;
  return { sandbox, events, documentElement };
}

async function run() {
  const source=fs.readFileSync(__dirname + '/../js/next/identity_frontend.js','utf8');
  {
    const {sandbox}=makeSandbox([
      {status:200,body:JSON.stringify({ok:true,authenticated:true,account:{id:1},session:{id:5}})},
      {status:200,body:JSON.stringify({ok:true,currentContext:{id:10,type:'personal',key:'personal:1'},contexts:[{id:10,type:'personal',key:'personal:1'}],capabilities:['order.read']})},
    ]);
    vm.createContext(sandbox); vm.runInContext(source,sandbox);
    const result=await sandbox.window.KaretaIdentity.load({force:true});
    assert.equal(result.mode,'identity');
    assert.equal(result.authenticated,true);
    assert.equal(result.context.id,10);
    assert.equal(sandbox.window.KaretaIdentity.has('order.read'),true);
  }
  {
    const {sandbox}=makeSandbox([
      {status:200,contentType:'text/html',body:'<html>rewrite fallback</html>'},
      {status:200,body:JSON.stringify({ok:true,authenticated:false})},
    ]);
    vm.createContext(sandbox); vm.runInContext(source,sandbox);
    const result=await sandbox.window.KaretaIdentity.load({force:true});
    assert.equal(result.mode,'anonymous');
    assert.equal(result.authenticated,false);
  }
  {
    const {sandbox}=makeSandbox([
      {status:500,contentType:'text/html',body:'fatal error'},
    ]);
    vm.createContext(sandbox); vm.runInContext(source,sandbox);
    let failed=false;
    try { await sandbox.window.KaretaIdentity.load({force:true}); } catch (e) { failed=true; assert.equal(e.status,500); }
    assert.equal(failed,true,'500 must not be hidden by fallback');
  }
  console.log('Identity frontend tests OK');
}
run().catch(error=>{console.error(error);process.exit(1);});
