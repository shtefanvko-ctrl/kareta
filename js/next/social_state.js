(() => {
  'use strict';
  const EVENT='kareta:social-state',STORAGE='kareta.social.cache.v2',TTL=5*60*1000,listeners=new Set();
  let state=read();
  function read(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'{}');return {following:x.following||{},posts:x.posts||{},saved:Array.isArray(x.saved)?x.saved:[],updatedAt:Number(x.updatedAt||0),serverAt:Number(x.serverAt||0)};}catch(_e){return {following:{},posts:{},saved:[],updatedAt:0,serverAt:0};}}
  function persist(){state.updatedAt=Date.now();try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(_e){}}
  function notify(type,detail={}){const payload={type,...detail,updatedAt:Date.now()};listeners.forEach(fn=>{try{fn(payload);}catch(_e){}});try{window.dispatchEvent(new CustomEvent(EVENT,{detail:payload}));}catch(_e){}}
  const key=(type,id)=>`${String(type||'master')}:${String(id||'')}`;
  function provider(type,id){return state.following[key(type,id)]||null;}
  function isFollowing(type,id){return !!provider(type,id)?.following;}
  function setFollowing(type,id,following,extra={}){if(!id)return;const k=key(type,id);state.following[k]={...(state.following[k]||{}),...extra,type:String(type||'master'),id:String(id),following:!!following};persist();notify('provider.following',{providerType:type,providerId:String(id),following:!!following,provider:state.following[k]});}
  function setProviderSetting(type,id,field,value){if(!id||!field)return;const k=key(type,id);state.following[k]={...(state.following[k]||{}),type:String(type||'master'),id:String(id),following:state.following[k]?.following!==false,[field]:value};persist();notify('provider.setting',{providerType:type,providerId:String(id),field,value,provider:state.following[k]});}
  function replaceFollowing(rows=[]){const next={};rows.forEach(row=>{const type=String(row.type||row.entityType||'master'),id=String(row.id||row.master_id||row.sto_id||'');if(id)next[key(type,id)]={...(row.social_state||{}),type,id,name:row.name||'',following:true};});state.following=next;state.serverAt=Date.now();persist();notify('following.replace',{rows});}
  function followingKeys(){return new Set(Object.entries(state.following).filter(([,x])=>x?.following).map(([k])=>k));}
  function getPost(id){const k=String(id),row=state.posts[k]||{};return {liked:!!row.liked,likes:Number(row.likes||0),comments:Array.isArray(row.comments)?row.comments:[],commentsCount:Number(row.commentsCount||0),saved:state.saved.includes(k),source:row.source||'cache'};}
  function patchPost(id,patch={}){if(!id)return;const k=String(id),cur=getPost(k);state.posts[k]={...cur,...patch,comments:Array.isArray(patch.comments)?patch.comments:cur.comments};persist();notify('post.change',{postId:k,post:getPost(k)});}
  function setSaved(id,saved,_meta={}){const k=String(id);state.saved=state.saved.filter(x=>String(x)!==k);if(saved)state.saved.push(k);state.posts[k]={...(state.posts[k]||{}),saved:!!saved,source:_meta.source||state.posts[k]?.source||'cache'};persist();notify('post.saved',{postId:k,saved:!!saved,post:getPost(k)});}
  function toggleSaved(id){const next=!state.saved.includes(String(id));setSaved(id,next);return next;}
  const isSaved=id=>state.saved.includes(String(id)); const savedKeys=()=>new Set(state.saved.map(String));
  function hydrateServer(payload={}){const posts=payload.posts&&typeof payload.posts==='object'?payload.posts:{};Object.entries(posts).forEach(([id,row])=>{state.posts[id]={...(state.posts[id]||{}),...row,source:'server'};});state.saved=Array.isArray(payload.saved)?Array.from(new Set(payload.saved.map(String))):state.saved;state.serverAt=Date.now();persist();notify('server.hydrate',{count:Object.keys(posts).length});}
  async function sync(options={}){if(!options.force&&Date.now()-state.serverAt<TTL)return state;const api=window.KaretaApiClient;if(!api?.getWorkPostSocialState)return state;try{const r=await api.getWorkPostSocialState({signal:options.signal});if(r?.ok)hydrateServer(r.payload?.data||r.data||{});}catch(e){if(e?.name!=='AbortError')notify('server.error',{message:e?.message||'sync_failed'});}return state;}
  function on(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);} function refreshFromStorage(){state=read();notify('storage.sync');}
  window.addEventListener('storage',e=>{if(e.key===STORAGE)refreshFromStorage();});
  window.KaretaSocialState=Object.freeze({EVENT,on,provider,isFollowing,setFollowing,setProviderSetting,replaceFollowing,followingKeys,getPost,patchPost,setSaved,toggleSaved,isSaved,savedKeys,hydrateServer,sync,refreshFromStorage});
})();
