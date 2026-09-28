(() => {
  'use strict';
  const api=window.KaretaApiClient;
  const cabinetApi=window.KaretaClientCabinetApi;
  const social=window.KaretaSocialState;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={tab:'posts',profile:null,loading:false,error:''};
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  function routeParts(){return String(location.hash||'').split('?')[0].split('/').filter(Boolean);}
  function routeTarget(){const p=routeParts();if(p[0]==='profile'&&p[1]&&p[2])return {scope:'public',type:p[1],id:decodeURIComponent(p[2])};return {scope:'own',type:'person',id:''};}
  function runtimeIdentity(){
    const context=window.KaretaContextManager?.getState?.().selected||null;
    const user=window.KaretaNext?.state?.user||{};
    const role=String(window.KaretaNavigationCore?.interfaceRole?.()||window.KaretaRoleAccess?.currentRole?.()||user.role||'client').toLowerCase();
    const orgId=text(context?.organizationId||context?.organization_id||(context?.type==='organization'?context?.id:''));
    const masterId=text(context?.masterId||context?.master_id||(role==='master'?context?.entityId||context?.entity_id:''));
    return {context,user,role,orgId,masterId};
  }
  function initials(name){return text(name||'K').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'K';}
  function unique(values){return [...new Set(values.map(text).filter(Boolean))].slice(0,8);}
  function normalizeMedia(row){
    const media=[];const cover=text(row?.coverUrl||row?.cover_url||row?.image_url||row?.imageUrl);
    if(cover)media.push({type:'image',src:cover});
    let photos=row?.photosJson||row?.photos_json||row?.photos;
    if(typeof photos==='string'){try{photos=JSON.parse(photos);}catch(_e){photos=[];}}
    arr(photos).forEach(x=>{const src=text(typeof x==='string'?x:x?.url||x?.src);if(src)media.push({type:'image',src});});
    const video=text(row?.videoUrl||row?.video_url);if(video)media.push({type:'video',src:video});
    return media.slice(0,4);
  }
  function normalizePosts(data){
    const rows=[];
    arr(data.wallPosts).forEach(x=>rows.push({id:`wall:${x.id}`,kind:'Публикация',title:text(x.title),text:text(x.text||x.preview),createdAt:x.publishedAt||x.published_at,media:normalizeMedia(x),views:0,likes:0,comments:0}));
    arr(data.works).forEach(x=>rows.push({id:`work:${x.id}`,kind:'Работа',title:text(x.title),text:text(x.summary||x.serviceLabel||x.service_label),createdAt:x.publishedAt||x.published_at,media:normalizeMedia(x),views:Number(x.viewsCount||x.views_count||0),likes:Number(x.likesCount||x.likes_count||0),comments:Number(x.commentsCount||x.comments_count||0),route:`#/real-works/item/${encodeURIComponent(x.id)}`}));
    arr(data.news).forEach(x=>rows.push({id:`news:${x.id}`,kind:'Новость',title:text(x.title),text:text(x.intro||x.body).slice(0,600),createdAt:x.published_at||x.created_at,media:normalizeMedia(x),views:Number(x.views_count||0),likes:0,comments:0}));
    return rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,30);
  }
  function providerProfile(data,type,id){
    const p=data.provider||{},isSto=type==='sto',offers=arr(data.offers),socialState=data.socialState||{},socialCounts=data.socialCounts||{};
    const name=text(p.name||p.store_name||p.title)||(isSto?'Автосервис':'Мастер');
    const city=text(p.city||p.location||'');
    const subtitle=text(p.spec||p.specialization||p.description_short)||(isSto?'Автосервис':'Автомастер');
    const bio=text(p.bio||p.description||p.about||'');
    const skills=unique(offers.flatMap(o=>[o.service_name,o.service_category_name]).concat(arr(p.specializations),arr(p.skills)));
    const posts=normalizePosts(data);
    return {id:String(id),type:isSto?'organization':'person',providerType:isSto?'sto':'master',name,subtitle,city,bio,verified:p.verified!==false,avatar:text(p.avatar_url||p.avatarUrl||p.photo_url||p.photo),stats:{posts:posts.length,followers:Number(socialCounts.followers||0)},skills,posts,followed:!!socialState.following,own:false};
  }
  function storeProfile(data,id){
    const p=data.profile||{},trust=data.trust||{},products=arr(data.products),name=text(p.store_name||p.legal_name)||'Магазин запчастей';
    return {id:String(id),type:'organization',providerType:'seller',name,subtitle:'Магазин запчастей',city:text(p.city),bio:text(p.description),verified:true,avatar:'',stats:{posts:products.length,followers:null},skills:unique(arr(p.category_labels).concat(arr(p.category_tags))),posts:[],followed:false,own:false,trust};
  }
  async function loadOwn(signal){
    const r=runtimeIdentity();
    if(r.role==='master'&&r.masterId){const res=await api?.getProviderDetail?.('master',r.masterId,{signal});if(res?.ok)return {...providerProfile(res.payload?.data||{},'master',r.masterId),own:true};}
    if(r.role==='sto'&&r.orgId){const res=await api?.getProviderDetail?.('sto',r.orgId,{signal});if(res?.ok)return {...providerProfile(res.payload?.data||{},'sto',r.orgId),own:true};}
    if(r.role==='seller'){
      const sellerId=text(r.user.id||r.context?.sellerId||r.context?.seller_id);if(sellerId){const res=await api?.getStoreDetail?.(sellerId,{signal});if(res?.ok)return {...storeProfile(res.payload?.data||{},sellerId),own:true};}
    }
    let user=r.user||{},metrics={};
    if(r.role==='client'&&cabinetApi?.get){const res=await cabinetApi.get({signal,cacheTtlMs:0});if(res?.ok){user=res.payload?.data?.user||user;metrics=res.payload?.data?.metrics||{};}}
    const name=text(user.name||user.full_name)||'Пользователь KARETA';
    return {id:String(user.id||user.phone||'me'),type:'person',providerType:'client',name,subtitle:'Личный профиль',city:text(user.city),bio:text(user.bio),verified:false,avatar:text(user.avatarUrl||user.avatar_url),stats:{posts:null,followers:null,orders:Number(metrics.orders||0),vehicles:Number(metrics.vehicles||0)},skills:[],posts:[],followed:false,own:true};
  }
  async function loadPublic(target,signal){
    if(target.type==='person'){
      const res=await api?.getProviderDetail?.('master',target.id,{signal});
      if(res?.ok)return providerProfile(res.payload?.data||{},'master',target.id);
      throw new Error(res?.payload?.message||'Публичный профиль не найден');
    }
    if(target.type==='organization'){
      const sto=await api?.getProviderDetail?.('sto',target.id,{signal});if(sto?.ok)return providerProfile(sto.payload?.data||{},'sto',target.id);
      const store=await api?.getStoreDetail?.(target.id,{signal});if(store?.ok)return storeProfile(store.payload?.data||{},target.id);
      throw new Error(sto?.payload?.message||store?.payload?.message||'Организация не найдена');
    }
    throw new Error('Неизвестный тип профиля');
  }
  async function loadProfile(signal){const target=routeTarget();return target.scope==='own'?loadOwn(signal):loadPublic(target,signal);}
  function stat(value,label){return value===null||value===undefined?'':`<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`;}
  function postCard(row,p){const media=arr(row.media);return `<article class="k-profile-post"><header><span class="k-profile-post-avatar">${esc(initials(p.name))}</span><div><b>${esc(p.name)}</b><small>${esc(row.kind||'Публикация')}${row.createdAt?` · ${esc(new Date(row.createdAt).toLocaleDateString('ru-RU'))}`:''}</small></div></header>${row.title?`<h3>${esc(row.title)}</h3>`:''}${row.text?`<p>${esc(row.text)}</p>`:''}${media.length?`<div class="k-profile-post-media">${media.slice(0,2).map(m=>m.type==='video'?`<video src="${esc(m.src)}" controls playsinline preload="metadata"></video>`:`<img src="${esc(m.src)}" alt="" loading="lazy">`).join('')}</div>`:''}<footer><span>♡ ${Number(row.likes||0)}</span><span>◯ ${Number(row.comments||0)}</span><span>◉ ${Number(row.views||0)}</span>${row.route?`<a href="${esc(row.route)}">Открыть</a>`:''}</footer></article>`;}
  function content(p){
    if(state.tab==='about')return `<section class="k-profile-about"><h2>О профиле</h2><dl><div><dt>Тип</dt><dd>${p.type==='organization'?'Организация':'Человек'}</dd></div>${p.city?`<div><dt>Город</dt><dd>${esc(p.city)}</dd></div>`:''}<div><dt>Статус</dt><dd>${p.verified?'Проверенный профиль':'Профиль KARETA'}</dd></div></dl><p>${esc(p.bio||'Описание пока не заполнено.')}</p></section>`;
    if(state.tab==='relations')return `<section class="k-profile-relations"><h2>Связи</h2><div class="k-empty"><p>Подписки и связи хранятся на сервере и управляются в отдельном разделе.</p><a class="k-btn k-btn-primary" href="#/following">Открыть подписки</a></div></section>`;
    return p.posts.length?`<div class="k-profile-feed">${p.posts.map(x=>postCard(x,p)).join('')}</div>`:`<div class="k-empty"><h2>Публикаций пока нет</h2><p>Здесь появятся реальные работы и публикации этого профиля.</p></div>`;
  }
  function renderLoaded(p){
    const canFollow=!p.own&&['master','sto'].includes(p.providerType);const canMessage=!p.own&&['master','sto'].includes(p.providerType);const key=`${p.providerType}:${p.id}`;const follow=p.followed||social?.isFollowing?.(p.providerType,p.id);
    return `<section class="k-page k-profile-page k-profile-ref-v2" data-profile-page data-profile-key="${esc(key)}"><article class="k-profile-hero"><div class="k-profile-cover"></div><div class="k-profile-main">${p.avatar?`<span class="k-profile-avatar"><img src="${esc(p.avatar)}" alt=""></span>`:`<span class="k-profile-avatar">${esc(initials(p.name))}</span>`}<div class="k-profile-copy"><div class="k-profile-title"><h1>${esc(p.name)}</h1>${p.verified?'<span title="Проверенный профиль">✓</span>':''}</div><b>${esc(p.subtitle||'Профиль KARETA')}</b>${p.bio?`<p>${esc(p.bio)}</p>`:''}${p.city?`<small>⌖ ${esc(p.city)}</small>`:''}</div><div class="k-profile-actions">${p.own?'<a class="k-btn k-btn-primary" href="#/cabinet/data">Редактировать профиль</a>':`${canFollow?`<button class="k-btn ${follow?'k-btn-secondary is-following':'k-btn-primary'}" type="button" data-profile-follow data-following="${follow?'1':'0'}">${follow?'Вы подписаны':'Подписаться'}</button>`:''}${canMessage?`<a class="k-btn" href="#/chats?${p.providerType==='sto'?'stoId':'masterId'}=${encodeURIComponent(p.id)}">Сообщение</a>`:''}`}</div></div><div class="k-profile-stats">${stat(p.stats.posts,'публикаций')}${stat(p.stats.followers,'подписчиков')}${p.stats.vehicles!==undefined?stat(p.stats.vehicles,'автомобилей'):''}${p.stats.orders!==undefined?stat(p.stats.orders,'заказов'):''}</div>${p.skills.length?`<div class="k-profile-skills">${p.skills.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}</article><nav class="k-profile-tabs"><button class="${state.tab==='posts'?'is-active':''}" data-profile-tab="posts">Публикации</button><button class="${state.tab==='about'?'is-active':''}" data-profile-tab="about">О профиле</button><button class="${state.tab==='relations'?'is-active':''}" data-profile-tab="relations">Связи</button></nav><div class="k-profile-layout"><main data-profile-content>${content(p)}</main><aside><section><h2>Профиль KARETA</h2><p>${p.type==='organization'?'Публичные данные организации загружены с сервера.':'Публичные данные человека загружены из его реального профиля.'}</p></section><section><h2>Полезные ссылки</h2><a href="#/following">Мои подписки</a><a href="#/works">Сообщество</a><a href="#/cabinet">Кабинет</a></section></aside></div></section>`;
  }
  function renderProfile(){return `<section class="k-page k-profile-page k-profile-ref-v2" data-profile-page><div class="k-profile-runtime-state" data-profile-runtime><div class="k-profile-skeleton"><i></i><i></i><i></i></div><p>Загрузка профиля…</p></div></section>`;}
  function profileHost(context={}){if(context?.lifecycle?.source==='entity-window')return document.querySelector('[data-entity-window-body]');return document.querySelector('#k-page-outlet')||document;}
  function paint(context={}){const host=profileHost(context);if(!host)return;if(state.loading){host.innerHTML=renderProfile();return;}if(state.error){host.innerHTML=`<section class="k-page k-profile-page k-profile-ref-v2" data-profile-page><div class="k-empty"><h1>Профиль недоступен</h1><p>${esc(state.error)}</p><button class="k-btn k-btn-primary" type="button" data-profile-retry>Повторить</button></div></section>`;return;}host.innerHTML=renderLoaded(state.profile);bind(context);}
  async function refresh(context={}){state.loading=true;state.error='';paint(context);try{state.profile=await loadProfile(context?.lifecycle?.signal);state.loading=false;paint(context);}catch(e){if(e?.name==='AbortError')return;state.loading=false;state.error=e?.message||'Не удалось загрузить профиль';paint(context);}}
  function bind(context={}){const host=profileHost(context),root=host?.querySelector?.('[data-profile-page]');if(!root)return;root.addEventListener('click',async e=>{const retry=e.target.closest('[data-profile-retry]');if(retry){await refresh(context);return;}const tab=e.target.closest('[data-profile-tab]');if(tab){state.tab=tab.dataset.profileTab;paint(context);return;}const follow=e.target.closest('[data-profile-follow]');if(follow&&state.profile&&['master','sto'].includes(state.profile.providerType)){const p=state.profile,next=follow.dataset.following!=='1';follow.disabled=true;try{const r=p.providerType==='sto'?await api.updateStoSocial(p.id,'following',next):await api.updateMasterSocial(p.id,'following',next);if(!r?.ok)throw new Error(r?.payload?.message||'Не удалось изменить подписку');p.followed=next;p.stats.followers=Number(r.payload?.counts?.followers??p.stats.followers??0);social?.setFollowing?.(p.providerType,p.id,next,{name:p.name});paint(context);}catch(err){follow.disabled=false;window.KaretaToast?.error?.(err.message||'Не удалось изменить подписку');}}});}
  function mountProfile(context={}){state.tab='posts';refresh(context);}
  window.KaretaProfileRelationsPages=Object.freeze({renderProfile,mountProfile});
})();
