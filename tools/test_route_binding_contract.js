#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=message=>{console.error('ROUTE_BINDING_CONTRACT: FAIL — '+message);process.exit(1);};

const app=read('js/next/app_next.js');
const registry=read('js/next/route_registry.js');

function block(text,startNeedle){
  const start=text.indexOf(startNeedle);
  const end=text.indexOf('\n  });',start);
  if(start<0||end<=start) fail('cannot parse '+startNeedle);
  return text.slice(start,end);
}

const routeBlock=block(registry,'const ROUTES = Object.freeze({');
const bindingBlock=block(app,'const PAGE_BINDINGS = Object.freeze({');
const routeKeys=[...routeBlock.matchAll(/^\s*([A-Za-z_$][\w$]*):Object\.freeze\(/gm)].map(m=>m[1]);
const bindingKeys=[...bindingBlock.matchAll(/^\s*([A-Za-z_$][\w$]*):\{/gm)].map(m=>m[1]);

if(!routeKeys.length) fail('no routes parsed');
if(routeKeys.length!==new Set(routeKeys).size) fail('duplicate route key');
if(bindingKeys.length!==new Set(bindingKeys).size) fail('duplicate page binding key');

const missing=routeKeys.filter(key=>!bindingKeys.includes(key));
const extra=bindingKeys.filter(key=>!routeKeys.includes(key));
if(missing.length) fail('routes without page binding: '+missing.join(', '));
if(extra.length) fail('page bindings without route: '+extra.join(', '));

if(app.includes('KaretaNotFoundPages')) fail('legacy KaretaNotFoundPages dependency returned');
if(registry.includes('notFound')) fail('legacy notFound route returned');
if(!registry.includes("return found ? found[0] : '';")) fail('unknown hash must resolve to empty route key before role resolver');
if(!app.includes("const requested=routeRegistry.has(routeKey) ? routeKey : '';")) fail('app route resolver must reject unknown keys');

// Exercise the real vehicle module through the same dispatcher used by the SPA.
// Matching route names alone does not prove that the module exports its methods.
const assert=require('node:assert/strict');
const vm=require('node:vm');
let vehicleRootQueries=0;
const scope={window:{KaretaPageUI:{escapeHtml:String},KaretaVehicleApi:{}},
  document:{querySelector(selector){
    assert.equal(selector,'#k-vehicle-page');vehicleRootQueries++;return null;
  }}};
vm.createContext(scope);
vm.runInContext(read('js/next/pages/vehicle.js'),scope);
const invokeStart=app.indexOf('  function invokePage(');
const invokeEnd=app.indexOf('\n  const PAGE_RENDERERS',invokeStart);
assert.ok(invokeStart>=0&&invokeEnd>invokeStart,'SPA dispatcher boundaries missing');
vm.runInContext(bindingBlock+'\n  });\n'+app.slice(invokeStart,invokeEnd)+'\nthis.dispatch=invokePage;',scope);
const vehicle=scope.window.KaretaVehiclePages;
assert.equal(vehicle.renderVehicle,vehicle.renderers.vehicle,'legacy renderer alias must remain');
assert.equal(vehicle.mountVehicle,vehicle.mounts.vehicle,'legacy mount alias must remain');
assert.match(scope.dispatch('vehicle','render',{}),/id="k-vehicle-page"/);
assert.doesNotThrow(()=>scope.dispatch('vehicle','mount',{}));
assert.equal(vehicleRootQueries,1,'dispatcher must invoke the actual vehicle mount');

console.log(`ROUTE_BINDING_CONTRACT: PASS — ${routeKeys.length} routes / ${bindingKeys.length} bindings; executable vehicle dispatch`);
