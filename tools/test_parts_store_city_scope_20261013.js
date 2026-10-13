'use strict';
// Regression: shop carousel must honor the same city filter as catalog products.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/next/pages/parts.js'),'utf8');
function section(start,end){
  const a=source.indexOf(start);
  const b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`Missing parts.js function boundary: ${start}`);
  return source.slice(a,b);
}
const cityMatchSource=section('  function cityMatch(', '  function categoryMatch(');
const directorySource=section('  function storeDirectory(', '  function storeStrip(');
const state={city:''};
const directory=new Function('state','storeMode','storeTrust',
  cityMatchSource+'\n'+directorySource+'\nreturn storeDirectory;')(state,'nearby',new Map());
const products=[
  {seller_user_id:1,store_name:'A',city:'Алматы'},
  {seller_user_id:1,store_name:'A',city:'Астана'},
  {seller_user_id:2,store_name:'B',city:'Астана'},
  {seller_user_id:3,store_name:'C',city:'Алматы'}
];
const listing=city=>{state.city=city;return directory({products}).map(row=>[row.id,row.products]);};
assert.deepEqual(listing('Алматы'),[['1',1],['3',1]],
  'Almaty must not show Astana-only stores or count out-of-city stock');
assert.deepEqual(listing('Астана'),[['1',1],['2',1]],
  'Astana must not show Almaty-only stores or count out-of-city stock');
assert.deepEqual(listing(''),[['1',2],['2',1],['3',1]],
  'No selected city must preserve the complete shop directory');
console.log('PARTS_STORE_CITY_SCOPE: PASS (3 scenarios)');
