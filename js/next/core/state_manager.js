(() => { 'use strict';
 const base=()=>({
  entities:{byRef:{},allRefs:[]}, relations:{byEntityRef:{}}, timelines:{byEntityRef:{}},
  events:[],calendar:[],payments:[],notifications:[],
  requests:{},loading:false,error:null,requestVersion:0,updatedAt:null
 });
 const state=base(); const subs=new Set();
 const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
 const refOf=(type,key)=>`${String(type||'unknown')}:${String(key||'')}`;
 const notify=()=>subs.forEach(fn=>{try{fn(clone(state))}catch(e){console.error('[KARETA state]',e)}});
 const merge=(target,patch)=>{for(const [k,v] of Object.entries(patch||{})){if(v&&typeof v==='object'&&!Array.isArray(v)&&target[k]&&typeof target[k]==='object'&&!Array.isArray(target[k]))merge(target[k],v);else target[k]=v;}return target};
 const set=patch=>{merge(state,patch);state.updatedAt=new Date().toISOString();notify();return clone(state)};
 const begin=(scope='global')=>{const version=state.requestVersion+1;state.requestVersion=version;state.requests[scope]={loading:true,error:null,version};state.loading=true;state.error=null;notify();return {scope,version}};
 const resolve=(token,patch)=>{const row=state.requests[token?.scope||'global'];if(!row||row.version!==token.version)return clone(state);state.requests[token.scope]={loading:false,error:null,version:token.version};merge(state,patch||{});state.loading=Object.values(state.requests).some(x=>x.loading);state.error=null;state.updatedAt=new Date().toISOString();notify();return clone(state)};
 const reject=(token,error)=>{const row=state.requests[token?.scope||'global'];if(!row||row.version!==token.version)return clone(state);const message=String(error?.message||error||'unknown_error');state.requests[token.scope]={loading:false,error:message,version:token.version};state.loading=Object.values(state.requests).some(x=>x.loading);state.error=message;notify();return clone(state)};
 const upsertEntities=list=>{for(const raw of list||[]){const type=raw.type||raw.entityType;const key=raw.key||raw.entityKey||raw.id;if(!type||key===undefined||key===null)continue;const ref=refOf(type,key);state.entities.byRef[ref]={...(state.entities.byRef[ref]||{}),...raw,type,key};if(!state.entities.allRefs.includes(ref))state.entities.allRefs.push(ref);}state.updatedAt=new Date().toISOString();notify();return clone(state)};
 const setEntityGraph=(type,key,{entity,relations=[],timeline=[]}={})=>{const ref=refOf(type,key);if(entity)upsertEntities([{...entity,type,key}]);state.relations.byEntityRef[ref]=relations;state.timelines.byEntityRef[ref]=timeline;notify();return clone(state)};
 const selectors=Object.freeze({
  entity:(type,key)=>clone(state.entities.byRef[refOf(type,key)]||null),
  entities:(type='')=>state.entities.allRefs.map(r=>state.entities.byRef[r]).filter(x=>!type||x.type===type).map(clone),
  relations:(type,key)=>clone(state.relations.byEntityRef[refOf(type,key)]||[]),
  timeline:(type,key)=>clone(state.timelines.byEntityRef[refOf(type,key)]||[]),
  request:scope=>clone(state.requests[scope]||{loading:false,error:null})
 });
 const get=()=>clone(state); const reset=()=>{Object.assign(state,base());notify();return get()};
 const subscribe=fn=>{if(typeof fn!=='function')return()=>{};subs.add(fn);return()=>subs.delete(fn)};
 window.KaretaStateManager=Object.freeze({get,set,begin,resolve,reject,reset,subscribe,upsertEntities,setEntityGraph,selectors,refOf});
})();
