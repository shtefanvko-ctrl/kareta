(() => {
  'use strict';
  const DEFAULTS=Object.freeze({
    feedMode:'recommended',
    posts:[],stories:[],groups:[],
    activeStoryId:null,activePostId:null,commentsPostId:null,
    searchQuery:'',filters:{types:[],authors:[],city:'',vehicle:''},
    loading:false,error:'',pagination:{cursor:null,hasMore:true,page:0},
    scrollByRoute:{},
    joinedGroups:[],followingGroups:[],savedPosts:[]
  });
  const clone=v=>JSON.parse(JSON.stringify(v));
  let state={...clone(DEFAULTS)};
  const listeners=new Set();

  // R188.5.5.6.84.65 — Community runtime state is intentionally memory-only.
  // Production social content and relations must come from the server; browser persistence
  // must never become an alternate Community database.
  function emit(type='change',payload={}){
    const snap=snapshot();
    listeners.forEach(fn=>{try{fn({type,payload,state:snap});}catch(_e){}});
  }
  function snapshot(){return state;}
  function patch(values,type='change'){state={...state,...values};emit(type,values);return state;}
  function setFeedMode(mode){return patch({feedMode:['recommended','subscriptions','nearby'].includes(mode)?mode:'recommended'},'feed-mode');}
  function rememberScroll(route,y){state.scrollByRoute={...state.scrollByRoute,[route]:Math.max(0,Number(y)||0)};emit('scroll',{route,y:state.scrollByRoute[route]});}
  function scrollFor(route){return Number(state.scrollByRoute?.[route]||0);}
  function toggleSet(field,id){const values=new Set(Array.isArray(state[field])?state[field]:[]);values.has(id)?values.delete(id):values.add(id);state={...state,[field]:[...values]};emit(field,{id,active:values.has(id)});return values.has(id);}
  function resetRuntime(){state={...state,posts:[],stories:[],groups:[],activeStoryId:null,activePostId:null,commentsPostId:null,loading:false,error:'',pagination:{...DEFAULTS.pagination}};emit('runtime-reset');}
  window.KaretaCommunityState=Object.freeze({snapshot,patch,setFeedMode,rememberScroll,scrollFor,toggleSet,resetRuntime,on(fn){listeners.add(fn);return()=>listeners.delete(fn);}});
})();
