'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'storage/catalog/services.json'),'utf8'));
assert.strictEqual(source.services.length,109,'canonical service count');
assert.strictEqual(source.categories.length,20,'canonical category count');

const normalizeService=row=>({
  ...row,
  category:String(row.category||row.cat||'other'),
  stock:Number(row.stock||0),
});
const normalizeCategory=row=>({...row,key:String(row.key||row.category_key||'')});
let apiPayload={
  services:source.services,
  serviceCategories:source.categories,
  products:[],
  serviceSource:'canonical-source'
};
const context={
  console,
  window:{KaretaCatalogApi:{
    load:async()=>apiPayload,
    normalizeService,
    normalizeServiceCategory:normalizeCategory,
    normalizeProduct:row=>({...row,category:String(row.category||'other'),stock:Number(row.stock||0)})
  }},
  Date,
  Set,
  Map,
  Object,
  Array,
  String,
  Number,
};
context.window.window=context.window;
vm.runInNewContext(fs.readFileSync(path.join(root,'js/next/catalog/catalog_state.js'),'utf8'),context,{filename:'catalog_state.js'});
(async()=>{
  const state=context.window.KaretaCatalogState;
  let snapshot=await state.load({force:true});
  assert.strictEqual(snapshot.services.length,109);
  assert.strictEqual(snapshot.serviceCategories.length,20);
  const fetchedAt=snapshot.fetchedAt;
  snapshot=state.hydrate({ok:true,degraded:true,data:{services:[],serviceCategories:[],partsCatalog:[]}});
  assert.strictEqual(snapshot.services.length,109,'empty recovery pull must not erase services');
  assert.strictEqual(snapshot.serviceCategories.length,20,'empty recovery pull must not erase categories');
  assert.strictEqual(snapshot.fetchedAt,fetchedAt,'empty pull should preserve dedicated catalog timestamp');
  snapshot=state.hydrate({ok:true,degraded:true,data:{services:[],partsCatalog:[{id:'p1',category:'parts',stock:3}]}});
  assert.strictEqual(snapshot.services.length,109,'parts-only pull must preserve services');
  assert.strictEqual(snapshot.products.length,1,'parts-only pull may refresh products');
  console.log('R188.5.5.6.11 auto approval/catalog recovery tests OK');
})().catch(error=>{console.error(error);process.exit(1);});
