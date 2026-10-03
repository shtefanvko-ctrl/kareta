(() => {
  'use strict';
  const api=window.KaretaApiClient;
  if(!api) throw new Error('KaretaApiClient is required before community_api.js');
  const text=v=>String(v??'').trim();
  const environment=()=>text(window.KARETA_ENVIRONMENT||'production').toLowerCase()||'production';
  const isProduction=()=>environment()==='production';
  const hasProtectedSession=()=>window.KaretaIdentity?.snapshot?.()?.authenticated===true||String(document.documentElement?.dataset?.identityMode||'')==='legacy-fallback';

  // Development-only fixtures. They are never merged into a production feed.
  const DEV_GROUPS=Object.freeze([
    {id:'toyota-camry',type:'CAR_MODEL',name:'Toyota Camry Club',short:'TC',members:5800,city:'',vehicle:'Toyota Camry',description:'Camry, обслуживание, ремонт и опыт владельцев.',rules:['Без спама','Уважать участников','Продажа только в профильных темах']},
    {id:'toyota-vko',type:'CITY',name:'Toyota VKO',short:'TV',members:2140,city:'Усть-Каменогорск',vehicle:'Toyota',description:'Toyota Восточного Казахстана: встречи, помощь и сервис.'},
    {id:'ukg-auto',type:'CITY',name:'Авто Усть-Каменогорск',short:'УК',members:4260,city:'Усть-Каменогорск',vehicle:'',description:'Локальная автомобильная жизнь города.'},
    {id:'diagnostics',type:'SERVICE',name:'Диагностика и электрика',short:'OBD',members:1780,city:'',vehicle:'',description:'Ошибки, сканеры, электрика, схемы и диагностика.'}
  ]);
  let devLocal=[];
  let serverGroups=[];
  const local=()=>isProduction()?[]:devLocal.slice();
  const saveLocal=rows=>{if(!isProduction())devLocal=rows.slice(0,100);};

  const data=result=>result?.payload?.data&&typeof result.payload.data==='object'?result.payload.data:(result?.payload||{});
  const list=(result,keys)=>{const d=data(result);for(const key of keys){if(Array.isArray(d?.[key]))return d[key];}return Array.isArray(d)?d:[];};
  const avatarLetter=name=>text(name).slice(0,1).toUpperCase()||'K';
  const providerKey=(type,id)=>`${text(type).toLowerCase()}:${text(id)}`;

  function normalizeNews(x){return {id:`news:${x.id||Date.now()}`,sourceId:text(x.id),type:'POST',source:'news',author:{id:text(x.author_id||x.master_id||x.sto_id),contextType:text(x.author_type||'SYSTEM').toUpperCase(),name:text(x.author_name||'KARETA.KZ'),avatar:text(x.avatar_url),verified:false},createdAt:x.published_at||x.created_at||new Date().toISOString(),text:text(x.intro||x.summary||x.body),title:text(x.title||'Новость'),media:(x.image_url||x.cover_url)?[{type:'image',src:x.image_url||x.cover_url}]:[],vehicle:null,category:'NEWS',location:{city:text(x.city)},stats:{likes:0,comments:0,views:Number(x.views||0)},liked:false,saved:false,permissions:{comments:true},route:'#/news'};}
  function normalizeWork(x){const media=(Array.isArray(x.media)?x.media:[]).map(m=>({type:text(m.mediaType||m.type||'image').includes('video')?'video':'image',src:text(m.fileUrl||m.url||m.src),poster:text(m.poster)})).filter(m=>m.src);if(!media.length&&text(x.coverUrl||x.cover_url))media.push({type:'image',src:text(x.coverUrl||x.cover_url)});const isSto=!!text(x.stoId||x.sto_id);const authorId=text(x.masterId||x.master_id||x.stoId||x.sto_id);return {id:`work:${x.id}`,sourceId:text(x.id),type:isSto?'STO_WORK':'MASTER_WORK',source:'workPosts',author:{id:authorId,contextType:isSto?'STO':'MASTER',name:text(x.masterName||x.master_name||x.stoName||x.sto_name||'Мастер KARETA'),avatar:text(x.avatarUrl||x.avatar_url),verified:true},createdAt:x.publishedAt||x.published_at||x.createdAt||new Date().toISOString(),text:text(x.summary||x.description),title:text(x.title||'Выполненная работа'),media,vehicle:x.vehicle||null,category:text(x.category||'SERVICE'),location:{city:text(x.city)},stats:{likes:Number(x.likesCount||0),comments:Number(x.commentsCount||0),views:Number(x.viewsCount||0)},liked:!!(x.likedByMe||x.liked_by_me),saved:!!x.savedByMe,permissions:{comments:true},route:`#/works/item/${encodeURIComponent(x.id)}`,cta:{label:'Записаться',route:authorId?`#/masters/book/master/${encodeURIComponent(authorId)}`:'#/masters'}};}
  function normalizeWall(x){const kind=text(x.kind||'note').toUpperCase();const question=kind==='QUESTION';const media=[];if(text(x.image))media.push({type:'image',src:text(x.image)});if(text(x.videoUrl))media.push({type:'video',src:text(x.videoUrl)});return {id:text(x.entityKey||`wall:${x.id}`),entityKey:text(x.entityKey),sourceId:text(x.id),type:question?'QUESTION':'POST',source:'masterWall',author:{id:text(x.masterId),contextType:'MASTER',name:text(x.masterName||'Мастер KARETA'),avatar:text(x.avatarUrl),verified:true},createdAt:x.publishedAt||x.createdAt||new Date().toISOString(),text:text(x.text),title:text(x.title||x.kindLabel||'Публикация'),media,vehicle:x.vehicle||null,category:kind,location:{city:text(x.city)},stats:{likes:Number(x.likesCount||0),comments:Number(x.commentsCount||0),views:Number(x.viewsCount||0)},liked:!!x.likedByMe,saved:!!x.savedByMe,permissions:{comments:true},route:x.masterId?`#/masters/profile/master/${encodeURIComponent(x.masterId)}?tab=wall`:'#/community'};}
  function normalizeCommunity(x){const role=text(x.authorRole||'client').toUpperCase();const contextType=role==='STO'?'STO':role==='SELLER'?'SELLER':role==='MASTER'?'MASTER':'CLIENT';const vehicle=text(x.vehicleLabel);return {id:`community:${x.id}`,entityKey:text(x.entityKey||`community:${x.id}`),sourceId:text(x.id),groupId:text(x.groupId),type:text(x.type||'POST').toUpperCase(),source:'communityPosts',author:{id:text(x.authorEntityId||x.authorContextId||x.authorUserId),contextType,name:text(x.authorName||'Пользователь'),avatar:'',verified:['MASTER','STO','SELLER'].includes(contextType)},createdAt:x.publishedAt||new Date().toISOString(),text:text(x.text),title:text(x.title),media:[],vehicle:vehicle?{model:vehicle}:null,category:text(x.category),location:{city:text(x.city)},stats:{likes:Number(x.likesCount||0),comments:Number(x.commentsCount||0),views:0},liked:!!x.likedByMe,saved:!!x.savedByMe,permissions:{comments:x.commentsEnabled!==false},route:`#/community/post/${encodeURIComponent(`community:${x.id}`)}`};}

  // Kept only as an explicit non-production fixture hook for old regression contracts.
  function mockRows(){if(isProduction())return[];return [
    {id:'dev:q1',type:'QUESTION',source:'development-fixture',author:{id:'client_dev',contextType:'CLIENT',name:'Тестовый пользователь',avatar:'',verified:false},createdAt:new Date(Date.now()-18*60e3).toISOString(),title:'Тестовый вопрос',text:'Development-only Community fixture.',media:[],vehicle:null,category:'ENGINE',location:{city:'Усть-Каменогорск'},stats:{likes:0,comments:0,views:0},liked:false,saved:false,permissions:{comments:true}}
  ];}
  function mergeUnique(rows){const seen=new Set();return rows.filter(row=>row?.id&&!seen.has(row.id)&&seen.add(row.id));}

  async function serverCity(signal){
    const fromRuntime=text(window.KaretaNext?.state?.user?.city||window.KaretaNext?.state?.user?.location);
    if(fromRuntime)return fromRuntime;
    try{const r=await api.getState({signal});const d=data(r);return text(d?.user?.city||d?.profile?.city||d?.state?.user?.city);}catch(_e){return'';}
  }
  function currentCity(){return text(window.KaretaNext?.state?.user?.city||window.KaretaNext?.state?.user?.location);}

  async function followingKeys(signal){
    if(!hasProtectedSession())return new Set();
    try{
      const r=await api.getFollowingMasters({signal});
      if(!r?.ok)return new Set();
      return new Set(list(r,['items']).map(row=>providerKey(row.type,row.id)));
    }catch(_e){return new Set();}
  }

  async function getFeed({mode='recommended',limit=24,signal,force=false}={}){
    const calls=[
      api.request(`api/db.php?action=communityPosts.list&limit=${Math.min(80,Math.max(24,limit))}`,{method:'GET',cacheTtlMs:8000,force,signal}),
      api.getWorkPosts({limit:20},{signal,force}),
      api.request('api/db.php?action=masterSocialWall.community&limit=30',{method:'GET',cacheTtlMs:12000,force,signal}),
      api.getNews({limit:12},{signal,force})
    ];
    const [community,works,wall,news]=await Promise.allSettled(calls);
    let rows=[];let online=0;
    if(community.status==='fulfilled'&&community.value?.ok){online++;rows.push(...list(community.value,['items']).map(normalizeCommunity));}
    if(works.status==='fulfilled'&&works.value?.ok){online++;rows.push(...list(works.value,['items','posts','works']).map(normalizeWork));}
    if(wall.status==='fulfilled'&&wall.value?.ok){online++;rows.push(...list(wall.value,['items']).map(normalizeWall));}
    if(news.status==='fulfilled'&&news.value?.ok){online++;rows.push(...list(news.value,['items','news']).map(normalizeNews));}
    if(!isProduction())rows.push(...local(),...mockRows());
    rows=mergeUnique(rows).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));

    let city='';
    if(mode==='subscriptions'){
      const following=await followingKeys(signal);
      rows=rows.filter(r=>following.has(providerKey(r.author?.contextType==='MASTER'?'master':r.author?.contextType==='STO'?'sto':'',r.author?.id)));
    }
    if(mode==='nearby'){
      city=await serverCity(signal);
      rows=city?rows.filter(r=>!text(r.location?.city)||text(r.location?.city).toLowerCase()===city.toLowerCase()):[];
    }
    if(!online&&isProduction())return {ok:false,error:'community_sources_unavailable',data:{items:[],hasMore:false,cursor:null,source:'server-unavailable',city}};
    return {ok:true,data:{items:rows.slice(0,limit),hasMore:rows.length>limit,cursor:rows.length>limit?String(limit):null,source:isProduction()?'server':'development',city}};
  }
  async function getPost(id){const feed=await getFeed({limit:100});return {ok:!!feed.ok,data:{post:feed.data?.items?.find(x=>x.id===id)||null}};}
  async function getComments(post){if(post?.source==='workPosts'&&post.sourceId){const r=await api.getWorkPostComments(post.sourceId);return {ok:!!r?.ok,data:{items:r?.payload?.data?.items||[]}};}if(['masterWall','communityPosts'].includes(post?.source)&&post.entityKey){const r=await api.request(`api/db.php?action=masterSocialWall.comments&entityKey=${encodeURIComponent(post.entityKey)}`,{method:'GET',cacheTtlMs:0,dedupe:false});return {ok:!!r?.ok,data:{items:r?.payload?.data?.items||[]}};}return {ok:false,error:'comments_not_supported',data:{items:[]}};}
  async function addComment(post,textValue){if(post?.source==='workPosts'&&post.sourceId)return api.addWorkPostComment(post.sourceId,textValue);if(['masterWall','communityPosts'].includes(post?.source)&&post.entityKey)return api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.comment',entityKey:post.entityKey,text:textValue}),cacheTtlMs:0,dedupe:false});return {ok:false,payload:{error:'comments_not_supported'}};}
  async function likePost(post,value){if(post?.source==='workPosts'&&post.sourceId)return api.likeWorkPost(post.sourceId);if(['masterWall','communityPosts'].includes(post?.source)&&post.entityKey)return api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.like',entityKey:post.entityKey,value}),cacheTtlMs:0,dedupe:false});return {ok:false,payload:{error:'reaction_not_supported'}};}
  async function savePost(post,value){if(post?.source==='workPosts'&&post.sourceId)return api.saveWorkPost(post.sourceId,value);if(['masterWall','communityPosts'].includes(post?.source)&&post.entityKey)return api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocialWall.saveState',entityKey:post.entityKey,value}),cacheTtlMs:0,dedupe:false});return {ok:false,payload:{error:'save_not_supported'}};}
  function getStories(posts=[]){const fromPosts=posts.filter(p=>p.media?.[0]?.src).slice(0,8).map((p,i)=>({id:`story:${p.id}`,author:p.author,title:p.author?.name||'История',seen:i>4,postId:p.id,media:p.media[0],createdAt:p.createdAt,type:p.type}));return [{id:'story:self',self:true,title:'Ваша история',author:{name:'Вы',contextType:'CLIENT'},seen:false},...fromPosts];}
  async function loadGroups({force=false,signal}={}){
    if(!isProduction())return DEV_GROUPS.map(g=>({...g}));
    try{
      const r=await api.request('api/db.php?action=communityGroups.list&limit=60',{method:'GET',cacheTtlMs:15000,force,signal});
      if(r?.ok)serverGroups=list(r,['items']).map(g=>({...g,rules:Array.isArray(g.rules)?g.rules:[]}));
    }catch(_e){}
    return serverGroups.slice();
  }
  function getGroups(){return isProduction()?serverGroups.slice():DEV_GROUPS.map(g=>({...g}));}
  function getGroup(id){return getGroups().find(g=>g.id===id)||null;}
  async function setGroupMembership(groupId,value){
    const id=text(groupId);if(!id)return {ok:false,error:'group_required'};
    if(!isProduction()){const g=DEV_GROUPS.find(x=>x.id===id);if(g)g.joined=!!value;return {ok:true,data:{groupId:id,joined:!!value}};}
    const r=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'communityGroups.join',groupId:id,value:!!value}),cacheTtlMs:0,dedupe:false});
    if(r?.ok){const d=data(r);const g=serverGroups.find(x=>x.id===id);if(g){g.joined=!!d.joined;if(Number.isFinite(Number(d.members)))g.members=Number(d.members);}}
    return r?.ok?{ok:true,data:data(r)}:{ok:false,error:r?.payload?.error||'group_membership_failed'};
  }
  async function loadGroupMembers(groupId,{force=false,signal}={}){
    const id=text(groupId);if(!id)return {ok:false,data:{items:[]}};
    try{
      const r=await api.request(`api/db.php?action=communityGroups.members&groupId=${encodeURIComponent(id)}`,{method:'GET',cacheTtlMs:10000,force,signal});
      return {ok:!!r?.ok,data:{items:list(r,['items'])}};
    }catch(_e){return {ok:false,data:{items:[]}};}
  }
  function createLocal(type,payload){if(isProduction())return {ok:false,error:'community_publish_backend_required'};const row={id:`dev:${type.toLowerCase()}:${Date.now()}`,type,source:'development-local',author:{id:'me',contextType:text(payload.contextType||'CLIENT'),name:text(payload.authorName||'Вы'),avatar:'',verified:false},createdAt:new Date().toISOString(),title:text(payload.title||payload.text).slice(0,80)||'Публикация',text:text(payload.text),media:Array.isArray(payload.media)?payload.media:[],vehicle:payload.vehicle||null,category:text(payload.category),location:{city:text(payload.city)},stats:{likes:0,comments:0,views:0},liked:false,saved:false,permissions:{comments:payload.comments!==false}};saveLocal([row,...local()]);return {ok:true,data:{item:row}};}
  async function createPost(payload){
    const type=text(payload.type||'POST').toUpperCase()==='NEWS'?'NEWS':'POST';
    if(!isProduction())return createLocal(type,payload);
    const r=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'communityPosts.save',post:{type,groupId:text(payload.groupId),title:text(payload.title),text:text(payload.text),category:text(payload.category),city:text(payload.city),vehicleLabel:text(payload.vehicleLabel),comments:payload.comments!==false}}),cacheTtlMs:0,dedupe:false});
    return r?.ok?{ok:true,data:r.payload?.data||r.payload}:{ok:false,error:r?.payload?.error||'community_publish_failed'};
  }
  async function createQuestion(payload){
    if(!isProduction())return createLocal('QUESTION',payload);
    const r=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'communityPosts.save',post:{type:'QUESTION',groupId:text(payload.groupId),title:text(payload.title),text:text(payload.text),category:text(payload.category),city:text(payload.city),vehicleLabel:text(payload.vehicleLabel),comments:true}}),cacheTtlMs:0,dedupe:false});
    return r?.ok?{ok:true,data:r.payload?.data||r.payload}:{ok:false,error:r?.payload?.error||'community_question_publish_failed'};
  }
  async function createStory(payload){return !isProduction()?createLocal('POST',payload):{ok:false,error:'community_story_backend_required'};}
  function search(query,posts=[]){const q=text(query).toLowerCase();const groups=getGroups().filter(g=>!q||[g.name,g.description,g.city,g.vehicle].join(' ').toLowerCase().includes(q));const found=posts.filter(p=>!q||[p.title,p.text,p.author?.name,p.vehicle?.brand,p.vehicle?.model,p.location?.city].join(' ').toLowerCase().includes(q));return {people:[],groups,posts:found.filter(p=>p.type!=='QUESTION'),questions:found.filter(p=>p.type==='QUESTION')};}
  window.KaretaCommunityApi=Object.freeze({getFeed,getPost,getComments,addComment,likePost,savePost,getStories,loadGroups,getGroups,getGroup,setGroupMembership,loadGroupMembers,createPost,createQuestion,createStory,search,avatarLetter,currentCity,isProduction});
})();
