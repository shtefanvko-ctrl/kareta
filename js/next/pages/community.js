(() => {
  'use strict';
  const api=window.KaretaCommunityApi;
  const stateApi=window.KaretaCommunityState;
  const coreApi=window.KaretaApiClient;
  const social=window.KaretaSocialState;
  if(!api||!stateApi||!coreApi) throw new Error('Community dependencies are required before community.js');

  const COMPATIBILITY=Object.freeze({legacyMasterWall:'#/master/wall',legacyReference:'Все новости Автосервисы Клубы Поделиться новостью data-community-reference-tab',legacyNative:'k-community-native-section k-community-group-grid data-community-filter-open data-community-filter-dialog Фильтры сообщества',legacyWall:"masterSocialWall.community Публикации Мастеров socialSource:'masterWall' masterSocialWall.comment masterSocialWall.like masterSocialWall.saveState"});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=v=>String(v??'').trim();
  const icon=name=>window.KaretaUIIcons?.svg?.(name)||window.KaretaUIIcons?.icon?.(name)||'';
  const formatCount=n=>{n=Number(n||0);if(n>=1000000)return `${(n/1000000).toFixed(n>=10000000?0:1)} млн`;if(n>=1000)return `${(n/1000).toFixed(n>=10000?0:1)} тыс.`;return String(n||0);};
  const timeAgo=value=>{const ts=new Date(value||0).getTime();if(!ts)return '';const sec=Math.max(1,Math.floor((Date.now()-ts)/1000));if(sec<60)return 'только что';if(sec<3600)return `${Math.floor(sec/60)} мин назад`;if(sec<86400)return `${Math.floor(sec/3600)} ч назад`;if(sec<604800)return `${Math.floor(sec/86400)} дн назад`;return new Date(ts).toLocaleDateString('ru-RU');};
  const role=()=>{const kind=window.KaretaNavigationCore?.contextKind?.()||'personal';if(kind==='master')return'MASTER';if(kind==='organization_service')return'STO';if(kind==='seller'||kind==='organization_store')return'SELLER';return'CLIENT';};
  const isMasterRole=()=>role()==='MASTER';
  const routeHash=()=>String(location.hash||'#/community').split('?')[0].replace(/\/+$/,'')||'#/community';
  const routeQuery=()=>{try{return new URLSearchParams(String(location.hash||'').split('?')[1]||'');}catch(_e){return new URLSearchParams();}};
  const authorRoute=post=>{const a=post?.author;if(!a?.id)return'';if(a.contextType==='MASTER')return `#/masters/profile/master/${encodeURIComponent(a.id)}`;if(a.contextType==='STO')return `#/masters/profile/sto/${encodeURIComponent(a.id)}`;if(a.contextType==='SELLER')return `#/parts/store/${encodeURIComponent(a.id)}`;if(a.contextType==='COMMUNITY')return `#/community/group/${encodeURIComponent(a.id)}`;return'';};
  const vehicleLabel=v=>v?[v.brand,v.model,v.generation].filter(Boolean).join(' '):'';
  const postTypeLabel=type=>({POST:'Публикация',QUESTION:'Вопрос',NEWS:'Новость',MASTER_WORK:'Работа мастера',STO_WORK:'Работа СТО',POLL:'Опрос',EVENT:'Событие',REVIEW:'Отзыв',SYSTEM_RECOMMENDATION:'Рекомендация'}[type]||'Публикация');
  const isWork=p=>p?.type==='MASTER_WORK'||p?.type==='STO_WORK';

  function parseRoute(){
    const hash=routeHash();let m;
    if(hash==='#/community'||hash==='#/community/feed')return {name:'feed',mode:'recommended'};
    if(hash==='#/community/subscriptions')return {name:'feed',mode:'subscriptions'};
    if(hash==='#/community/nearby')return {name:'feed',mode:'nearby'};
    if(hash==='#/community/help')return {name:'help'};
    if(hash==='#/community/search')return {name:'search'};
    if(hash==='#/community/groups')return {name:'groups'};
    if(hash==='#/community/post/create')return {name:'post-create'};
    if(hash==='#/community/question/create')return {name:'question-create'};
    if(hash==='#/community/story/create')return {name:'story-create'};
    if((m=hash.match(/^#\/community\/story\/([^/]+)$/)))return {name:'story',id:decodeURIComponent(m[1])};
    if((m=hash.match(/^#\/community\/post\/([^/]+)$/)))return {name:'post',id:decodeURIComponent(m[1])};
    if((m=hash.match(/^#\/community\/topic\/([^/]+)$/)))return {name:'topic',id:decodeURIComponent(m[1])};
    if((m=hash.match(/^#\/community\/group\/([^/]+)(?:\/(feed|discussions|media|about|members))?$/)))return {name:'group',id:decodeURIComponent(m[1]),tab:m[2]||'feed'};
    return {name:'feed',mode:'recommended'};
  }

  function routeHeader(title,{back='#/community',actions=''}={}){
    return `<header class="k-community-inner-header"><a href="${esc(back)}" aria-label="Назад">${icon('chevronLeft')}</a><h1>${esc(title)}</h1><div>${actions}</div></header>`;
  }

  function feedTabs(mode){
    const tabs=[['recommended','Для вас','#/community','star'],['subscriptions','Подписки','#/community/subscriptions','heart'],['nearby','Рядом','#/community/nearby','location']];
    return `<nav class="k-community-canon-filters k-community-feed-tabs k-community-reference-tabs" role="tablist" aria-label="Фильтры сообщества">${tabs.map(([value,label,href,glyph])=>`<a role="tab" aria-selected="${mode===value?'true':'false'}" class="k-community-canon-filter is-${value} ${mode===value?'is-active':''}" data-community-feed-mode="${value}" href="${href}"><span class="k-community-canon-filter-glyph">${icon(glyph)}</span><span>${label}</span></a>`).join('')}<button type="button" class="k-community-canon-filter-icon" data-community-filter-open aria-label="Дополнительные фильтры"><span class="k-community-canon-filter-glyph">${icon('filter')||icon('settings')||'⚙'}</span></button></nav>`;
  }

  function communityCanonHeader(view='feed',mode='recommended'){
    const questions=view==='help';
    return `<section class="k-community-canon-shell" data-community-canon-shell>
      <div class="k-community-canon-titlebar"><h1>Сообщество</h1><div class="k-community-canon-kind" role="group" aria-label="Раздел сообщества"><a class="${questions?'':'is-active'}" href="#/community">Сообщество</a><a class="${questions?'is-active':''}" href="#/community/help">Вопросы</a></div></div>
      <form class="k-community-canon-search" data-community-shell-search role="search"><span class="k-community-canon-search-icon">${icon('search')}</span><input type="search" data-community-shell-search-input placeholder="Найти публикацию, вопрос или сообщество…" autocomplete="off" aria-label="Поиск в сообществе"></form>
      ${questions?`<nav class="k-community-canon-filters k-community-repair-filters" aria-label="Фильтр вопросов"><button type="button" class="is-active is-all" data-community-repair-filter="all"><span>Все</span></button><button type="button" class="is-unanswered" data-community-repair-filter="unanswered"><span>Без ответа</span></button><button type="button" class="is-discussed" data-community-repair-filter="discussed"><span>Обсуждаемые</span></button><button type="button" class="k-community-canon-filter-icon" data-community-filter-open aria-label="Дополнительные фильтры"><span class="k-community-canon-filter-glyph">${icon('filter')||icon('settings')||'⚙'}</span></button></nav>`:feedTabs(mode)}
    </section>`;
  }

  function storyItem(story){
    if(story.self)return `<a class="k-story-item k-story-item--self" href="#/community/story/create"><span class="k-story-avatar"><i>+</i></span><span class="k-story-title">Ваша история</span></a>`;
    const letter=api.avatarLetter(story.author?.name);const avatar=story.author?.avatar?`<img src="${esc(story.author.avatar)}" alt="">`:`<b>${esc(letter)}</b>`;
    return `<a class="k-story-item ${story.seen?'is-seen':''}" href="#/community/story/${encodeURIComponent(story.id)}"><span class="k-story-avatar">${avatar}${story.author?.contextType==='MASTER'?'<em>🔧</em>':story.author?.contextType==='STO'?'<em>▣</em>':''}</span><span class="k-story-title">${esc(story.title)}</span></a>`;
  }
  function storiesHtml(stories=[]){return `<section class="k-community-stories" data-community-story-strip aria-label="Истории">${stories.map(storyItem).join('')||Array.from({length:6},()=>'<span class="k-story-skeleton"></span>').join('')}</section>`;}

  function composer(){
    const currentRole=role();const mainLabel=currentRole==='MASTER'?'Покажите работу или поделитесь опытом':currentRole==='STO'?'Новость, работа или акция':'Что у вас происходит?';
    const actions=[['Публикация','#/community/post/create'],['Помощь по ремонту','#/community/help'],['Новость','#/community/post/create?mode=news']];
    return `<section class="k-community-composer k-community-reference-composer"><a class="k-community-composer-main" href="#/community/post/create"><span class="k-community-composer-avatar">${icon('user')||'●'}</span><span>${esc(mainLabel)}</span></a><div class="k-community-composer-actions">${actions.map(([label,href])=>`<a href="${href}">${esc(label)}</a>`).join('')}</div></section>`;
  }

  function postMedia(post){const media=Array.isArray(post.media)?post.media.filter(m=>m?.src):[];if(!media.length)return'';const videoAttrs=`muted playsinline loop preload="none" data-community-autoplay-video`;const first=media[0];if(media.length===1){return `<div class="k-community-post-media is-one">${first.type==='video'?`<video src="${esc(first.src)}" poster="${esc(first.poster||'')}" ${videoAttrs} controls></video>`:`<img src="${esc(first.src)}" alt="" loading="lazy" decoding="async">`}</div>`;}return `<div class="k-community-post-media is-grid count-${Math.min(4,media.length)}">${media.slice(0,4).map((m,i)=>`<div>${m.type==='video'?`<video src="${esc(m.src)}" poster="${esc(m.poster||'')}" ${videoAttrs}></video>`:`<img src="${esc(m.src)}" alt="" loading="lazy" decoding="async">`}${i===3&&media.length>4?`<span>+${media.length-4}</span>`:''}</div>`).join('')}</div>`;}

  function pollHtml(post){if(!post.poll?.options?.length)return'';const total=post.poll.options.reduce((n,x)=>n+Number(x.votes||0),0)||1;return `<div class="k-community-poll">${post.poll.options.map(o=>{const pct=Math.round(Number(o.votes||0)/total*100);return `<button type="button" data-community-poll="${esc(post.id)}" data-community-poll-option="${esc(o.id)}"><span style="--pct:${pct}%"></span><b>${esc(o.label)}</b><i>${pct}%</i></button>`;}).join('')}</div>`;}

  function contextualCta(post){if(!post.cta?.route||!post.cta?.label)return'';return `<div class="k-community-context-cta"><a href="${esc(post.cta.route)}">${esc(post.cta.label)}</a></div>`;}

  function renderCommunityPost(post,{full=false}={}){
    const a=post.author||{};const route=authorRoute(post);const letter=api.avatarLetter(a.name);const avatar=a.avatar?`<img src="${esc(a.avatar)}" alt="">`:`<b>${esc(letter)}</b>`;const likes=Number(post.stats?.likes||0),comments=Number(post.stats?.comments||0),views=Number(post.stats?.views||0);const vehicle=vehicleLabel(post.vehicle);const location=text(post.location?.city);const type=postTypeLabel(post.type);
    return `<article class="k-community-post ${isWork(post)?'k-community-work':''} ${post.type==='QUESTION'?'k-community-question':''}" data-community-post-id="${esc(post.id)}">
      <header class="k-community-post-author"><a class="k-community-avatar" ${route?`href="${esc(route)}"`:'href="#/community"'}>${avatar}</a><div>${route?`<a class="k-community-author-link" href="${esc(route)}"><b>${esc(a.name||'KARETA.KZ')}</b>${a.verified?'<i title="Проверенный профиль">✓</i>':''}</a>`:`<b>${esc(a.name||'KARETA.KZ')}</b>`}<span>${esc([a.contextType==='MASTER'?'Мастер':a.contextType==='STO'?'СТО':a.contextType==='COMMUNITY'?'Сообщество':a.contextType==='SELLER'?'Продавец':'Клиент',location].filter(Boolean).join(' • '))}</span><time>${esc(timeAgo(post.createdAt))}</time></div><div class="k-community-post-author-actions">${['MASTER','STO'].includes(a.contextType)&&a.id?`<button type="button" class="k-community-follow-mini ${social?.isFollowing?.(a.contextType==='MASTER'?'master':'sto',a.id)?'is-following':''}" data-community-follow-author="${esc(post.id)}">${social?.isFollowing?.(a.contextType==='MASTER'?'master':'sto',a.id)?'✓':'+'}</button>`:''}<button type="button" data-community-more="${esc(post.id)}" aria-label="Ещё">⋯</button></div></header>
      <div class="k-community-post-body">${post.type==='QUESTION'?'<small class="k-community-type-chip">❓ Вопрос</small>':post.type==='NEWS'?'<small class="k-community-type-chip">Новость</small>':isWork(post)?'<small class="k-community-type-chip">Работа</small>':post.type==='EVENT'?'<small class="k-community-type-chip">Событие</small>':''}${post.title?`<h2><a href="#/community/post/${encodeURIComponent(post.id)}">${esc(post.title)}</a></h2>`:''}${post.text?`<p>${esc(post.text)}</p>`:''}${vehicle?`<a class="k-community-vehicle-chip" href="#/community/search?q=${encodeURIComponent(vehicle)}">${esc(vehicle)}</a>`:''}</div>
      ${postMedia(post)}${pollHtml(post)}
      <div class="k-community-post-meta"><b>${likes?`${formatCount(likes)} нравится`:''}</b>${comments?`<a href="#/community/post/${encodeURIComponent(post.id)}?comments=1">${formatCount(comments)} комментариев</a>`:''}${views?`<span>${formatCount(views)} просмотров</span>`:''}</div>
      <div class="k-community-post-actions"><button type="button" class="${post.liked?'is-active':''}" data-community-like="${esc(post.id)}" aria-label="Нравится" aria-pressed="${post.liked?'true':'false'}">${icon('heart')||'♡'}<span>${likes||''}</span></button><button type="button" data-community-comments="${esc(post.id)}" aria-label="Комментарии">${icon('comment')||'◯'}<span>${comments||''}</span></button><button type="button" data-community-share="${esc(post.id)}" aria-label="Поделиться">${icon('share')||'↗'}</button><button type="button" class="${post.saved?'is-active':''}" data-community-save="${esc(post.id)}" aria-label="Сохранить" aria-pressed="${post.saved?'true':'false'}">${icon('bookmark')||'⌑'}</button></div>
      ${contextualCta(post)}
      ${full?'<div class="k-community-post-full-marker"></div>':''}
    </article>`;
  }

  function groupsRail(groups=[]){return `<section class="k-community-side-card"><header><h3>Сообщества для вас</h3><a href="#/community/groups">Все</a></header>${groups.slice(0,4).map(g=>`<a class="k-community-side-group" href="#/community/group/${encodeURIComponent(g.id)}"><span>${esc(g.short)}</span><div><b>${esc(g.name)}</b><small>${formatCount(g.members)} участников</small></div></a>`).join('')}</section>`;}
  function groupCardsHtml(groups=[]){return groups.length?groups.map(g=>`<article class="k-community-group-card"><a href="#/community/group/${encodeURIComponent(g.id)}"><span class="k-community-group-avatar">${esc(g.short)}</span><div><h3>${esc(g.name)}</h3><p>${formatCount(g.members)} участников</p><small>${esc(g.description)}</small></div></a><button type="button" class="${g.joined?'is-active':''}" data-community-join="${esc(g.id)}">${g.joined?'Вы участник':'Вступить'}</button></article>`).join(''):'<div class="k-community-empty"><h2>Сообщества загружаются</h2><p>Каталог появится через несколько секунд.</p></div>';}
  function paintCommunityGroups(){const groups=api.getGroups();document.querySelectorAll('[data-community-groups-grid]').forEach(root=>{root.innerHTML=groupCardsHtml(groups);});document.querySelectorAll('[data-community-side-groups]').forEach(root=>{root.innerHTML=groupsRail(groups);});}

  const desktopCommunity=()=>window.matchMedia?.('(min-width: 1180px)')?.matches===true;
  const desktopViewHash=view=>({feed:'#/community',groups:'#/community/groups',search:'#/community/search',help:'#/community/help'}[view]||'#/community');
  function desktopNav(active='feed'){
    const rows=[
      ['feed',icon('community')||'◎','Лента'],
      ['groups',icon('grid')||'▦','Сообщества'],
      ['search',icon('search')||'⌕','Поиск'],
      ['help',icon('comment')||'?','Помочь с ремонтом']
    ];
    return `<aside class="k-community-desktop-nav" aria-label="Разделы сообщества">${rows.map(([key,ico,label])=>`<a class="${active===key?'is-active':''}" href="${desktopViewHash(key)}" data-community-desktop-view="${key}" aria-current="${active===key?'page':'false'}">${ico} ${label}</a>`).join('')}</aside>`;
  }
  function groupsMain(){
    const groups=api.getGroups();
    const body=`<div class="k-community-group-grid" data-community-groups-grid>${groupCardsHtml(groups)}</div>`;
    return `<section class="k-community-subpage k-community-groups k-community-desktop-pane"><header><small>СООБЩЕСТВА</small><h2>Найдите своих</h2><p>Клубы по автомобилю, городу, интересам и ремонту.</p></header><nav class="k-community-group-filter-tabs"><button class="is-active">Для вас</button><button>Рядом</button><button>По автомобилю</button><button>По интересам</button></nav>${body}</section>`;
  }
  function searchMain(){
    const q=routeQuery().get('q')||'';
    return `<section class="k-community-subpage k-community-search k-community-desktop-pane"><header><small>ПОИСК</small><h2>Найти в сообществе</h2><p>Мастера, публикации, вопросы и сообщества.</p></header><label class="k-community-search-field"><span>${icon('search')}</span><input type="search" value="${esc(q)}" data-community-unified-search placeholder="Поиск в сообществе" autofocus><button type="button" data-community-search-clear>${icon('close')}</button></label><nav class="k-community-search-tabs"><button class="is-active">Все</button><button>Люди</button><button>Сообщества</button><button>Публикации</button><button>Вопросы</button></nav><div data-community-search-results><div class="k-community-post-skeleton-list"><article></article><article></article></div></div></section>`;
  }
  function helpMain(){
    return `${communityCanonHeader('help')}<section class="k-community-subpage k-community-desktop-pane k-community-help-pane"><header class="k-community-repair-head"><div><small>ПОМОЩЬ С РЕМОНТОМ</small><h2>Вопросы и обсуждения</h2><p>Реальные вопросы владельцев и мастеров: симптомы, диагностика, ремонт и опыт участников.</p></div><a class="k-community-ask-button" href="#/community/question/create?mode=help">${icon('plus')||'＋'}<span>Задать вопрос</span></a></header><div class="k-community-repair-feed" data-community-repair-feed><div class="k-community-post-skeleton-list"><article></article><article></article><article></article></div></div></section>`;
  }
  function helpPage(){
    return `<main class="k-community-help-mobile">${helpMain()}</main>`;
  }
  function renderRepairQuestion(post){
    const a=post.author||{},route=authorRoute(post),letter=api.avatarLetter(a.name),avatar=a.avatar?`<img src="${esc(a.avatar)}" alt="">`:`<b>${esc(letter)}</b>`;
    const likes=Number(post.stats?.likes||0),comments=Number(post.stats?.comments||0),vehicle=vehicleLabel(post.vehicle),location=text(post.location?.city);
    return `<article class="k-community-post k-community-question k-community-repair-card" data-community-post-id="${esc(post.id)}">
      <header class="k-community-post-author"><a class="k-community-avatar" ${route?`href="${esc(route)}"`:'href="#/community/help"'}>${avatar}</a><div>${route?`<a class="k-community-author-link" href="${esc(route)}"><b>${esc(a.name||'Участник')}</b>${a.verified?'<i title="Проверенный профиль">✓</i>':''}</a>`:`<b>${esc(a.name||'Участник')}</b>`}<span>${esc([a.contextType==='MASTER'?'Мастер':a.contextType==='STO'?'СТО':'Автовладелец',location].filter(Boolean).join(' • '))}</span><time>${esc(timeAgo(post.createdAt))}</time></div><div class="k-community-post-author-actions"><button type="button" data-community-more="${esc(post.id)}" aria-label="Ещё">⋯</button></div></header>
      <div class="k-community-post-body k-community-repair-body"><small class="k-community-type-chip">Вопрос по ремонту</small>${post.title?`<h2><a href="#/community/post/${encodeURIComponent(post.id)}">${esc(post.title)}</a></h2>`:''}<p>${esc(post.text||'')}</p>${vehicle?`<a class="k-community-vehicle-chip" href="#/community/search?q=${encodeURIComponent(vehicle)}">${esc(vehicle)}</a>`:''}</div>
      ${postMedia(post)}
      <div class="k-community-post-actions k-community-repair-actions"><button type="button" class="${post.liked?'is-active':''}" data-community-like="${esc(post.id)}" aria-label="Нравится" aria-pressed="${post.liked?'true':'false'}">${icon('heart')||'♡'}<span>${likes||''}</span></button><button type="button" data-community-comments="${esc(post.id)}" aria-label="Ответы">${icon('comment')||'◯'}<span>${comments||''}</span></button><button type="button" data-community-share="${esc(post.id)}" aria-label="Поделиться">${icon('share')||'↗'}</button><button type="button" class="${post.saved?'is-active':''}" data-community-save="${esc(post.id)}" aria-label="Сохранить" aria-pressed="${post.saved?'true':'false'}">${icon('bookmark')||'⌑'}</button></div>
      <div class="k-community-repair-comments" data-repair-comments-preview="${esc(post.id)}"><button type="button" data-community-comments="${esc(post.id)}">${comments?`Посмотреть обсуждение · ${formatCount(comments)}`:'Ответов пока нет — будьте первым'}</button></div>
      <form class="k-community-repair-reply" data-community-repair-reply="${esc(post.id)}"><input maxlength="1200" placeholder="Ответить…" aria-label="Ответить на вопрос"><button type="submit">Отправить</button></form>
    </article>`;
  }
  function feedMain(mode='recommended'){
    return `${communityCanonHeader('feed',mode)}<div data-community-stories>${storiesHtml([])}</div>${composer()}<section class="k-community-feed" data-community-feed><div class="k-community-post-skeleton-list">${Array.from({length:3},()=>'<article></article>').join('')}</div></section><div class="k-community-feed-sentinel" data-community-feed-sentinel aria-hidden="true"></div>`;
  }
  function desktopMain(view='feed',mode='recommended'){
    if(view==='groups')return groupsMain();
    if(view==='search')return searchMain();
    if(view==='help')return helpMain();
    return feedMain(mode);
  }

  async function switchDesktopView(view,{syncHistory=true}={}){
    const main=document.querySelector('[data-community-desktop-main]');
    const page=document.querySelector('[data-community-page]');
    if(!main||!page||!desktopCommunity())return false;
    stopCommunityVideos();
    observer?.disconnect();observer=null;
    const safe=['feed','groups','search','help'].includes(view)?view:'feed';
    main.dataset.communityDesktopViewActive=safe;
    main.innerHTML=desktopMain(safe,safe==='feed'?(stateApi.snapshot().feedMode||'recommended'):'recommended');
    page.dataset.communityDesktopView=safe;
    page.querySelectorAll('[data-community-desktop-view]').forEach(node=>{
      const active=node.dataset.communityDesktopView===safe;
      node.classList.toggle('is-active',active);
      if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
    });
    if(syncHistory){
      try{history.replaceState(history.state,'',desktopViewHash(safe));}catch(_e){}
    }
    if(safe==='feed')await loadFeed(stateApi.snapshot().feedMode||'recommended');
    else if(safe==='search')await paintSearch();
    else if(safe==='help')await loadRepairQuestions();
    return true;
  }

  function feedShell(mode='recommended',desktopView='feed'){
    return `<div class="k-flow-community-layout k-community-layout-v2">${desktopNav(desktopView)}<main class="k-flow-community-main k-community-feed-column" data-community-desktop-main data-community-desktop-view-active="${esc(desktopView)}">${desktopMain(desktopView,mode)}</main><aside class="k-community-secondary"><div data-community-side-groups>${groupsRail(api.getGroups())}</div><section class="k-community-side-card"><header><h3>Быстрые действия</h3></header><a class="k-community-side-action" href="#/community/help">Помощь по ремонту</a><a class="k-community-side-action" href="#/orders/new">Создать заявку</a></section></aside></div>`;
  }

  function groupsPage(){const groups=api.getGroups();const body=`<div class="k-community-group-grid" data-community-groups-grid>${groupCardsHtml(groups)}</div>`;return `${routeHeader('Сообщества')}<main class="k-community-subpage k-community-groups"><header><h2>Найдите своих</h2><p>Клубы по автомобилю, городу, интересам и ремонту.</p></header><nav class="k-community-group-filter-tabs"><button class="is-active">Для вас</button><button>Рядом</button><button>По автомобилю</button><button>По интересам</button></nav>${body}</main>`;}

  function groupPage(route){const g=api.getGroup(route.id);if(!g)return `${routeHeader('Сообщество')}<div class="k-community-empty"><h2>Сообщество не найдено</h2><a href="#/community/groups">Все сообщества</a></div>`;const tabs=[['feed','Лента'],['discussions','Обсуждения'],['media','Медиа'],['about','О клубе'],['members','Участники']];let body='';if(route.tab==='feed')body=`<section class="k-community-group-feed"><div class="k-community-group-composer">${composer()}</div><div data-community-group-feed><div class="k-community-post-skeleton-list"><article></article><article></article></div></div></section>`;if(route.tab==='discussions')body=`<section class="k-community-discussions"><nav><button class="is-active">Все</button><button>Активные</button><button>Популярные</button></nav><div data-community-group-discussions><div class="k-community-post-skeleton-list"><article></article><article></article></div></div><a class="k-community-topic-fab" href="#/community/question/create?group=${encodeURIComponent(g.id)}">+</a></section>`;if(route.tab==='media')body=`<section class="k-community-group-media"><nav><button class="is-active">Все</button><button>Фото</button><button>Видео</button></nav><div class="k-community-media-grid" data-community-group-media></div></section>`;if(route.tab==='about')body=`<section class="k-community-group-about"><h2>О сообществе</h2><p>${esc(g.description)}</p><h3>Правила</h3><ol>${g.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ol><dl><div><dt>Тип</dt><dd>${esc(g.type)}</dd></div>${g.city?`<div><dt>Город</dt><dd>${esc(g.city)}</dd></div>`:''}${g.vehicle?`<div><dt>Автомобиль</dt><dd>${esc(g.vehicle)}</dd></div>`:''}<div><dt>Участники</dt><dd>${formatCount(g.members)}</dd></div></dl></section>`;if(route.tab==='members')body=`<section class="k-community-members"><label><span>${icon('search')}</span><input type="search" placeholder="Поиск участников"></label><div data-community-group-members><div class="k-community-post-skeleton-list"><article></article><article></article></div></div></section>`;return `${routeHeader(g.name,{back:'#/community/groups',actions:'<button type="button" data-community-share-group="'+esc(g.id)+'">⋯</button>'})}<main class="k-community-group-page"><div class="k-community-group-cover"><span>${esc(g.short)}</span></div><div class="k-community-group-summary"><span class="k-community-group-logo">${esc(g.short)}</span><div><h2>${esc(g.name)}</h2><p>${formatCount(g.members)} участников</p></div><button type="button" class="${g.joined?'is-active':''}" data-community-join="${esc(g.id)}">${g.joined?'Вы участник':'Вступить'}</button></div><nav class="k-community-group-tabs">${tabs.map(([key,label])=>`<a class="${route.tab===key?'is-active':''}" href="#/community/group/${encodeURIComponent(g.id)}/${key}">${label}</a>`).join('')}</nav>${body}</main>`;}
  function memberRow(name,type){return `<article class="k-community-member-row"><span>${esc(name.slice(0,1))}</span><div><b>${esc(name)}</b><small>${esc(type)}</small></div><button type="button">Подписаться</button></article>`;}

  function searchPage(){const q=routeQuery().get('q')||'';return `${routeHeader('Поиск')}<main class="k-community-subpage k-community-search"><label class="k-community-search-field"><span>${icon('search')}</span><input type="search" value="${esc(q)}" data-community-unified-search placeholder="Поиск в сообществе" autofocus><button type="button" data-community-search-clear>${icon('close')}</button></label><nav class="k-community-search-tabs"><button class="is-active">Все</button><button>Люди</button><button>Сообщества</button><button>Публикации</button><button>Вопросы</button></nav><div data-community-search-results><div class="k-community-post-skeleton-list"><article></article><article></article></div></div></main>`;}

  function createPage(kind){const currentRole=role();const isQuestion=kind==='QUESTION';const isNews=kind==='NEWS';const helpMode=isQuestion&&routeQuery().get('mode')==='help';const title=helpMode?'Помоги другу / коллеге':isQuestion?'Новый вопрос':isNews?'Новая новость':'Новая публикация';const helper=helpMode?'<section class="k-community-help-brief"><b>Разберите ремонт вместе</b><p>Укажите автомобиль, симптомы, что уже проверили и где нужна подсказка. Ответы участников пойдут в обсуждение под вопросом.</p></section>':'';const titleField=isNews?'<label class="k-community-editor-title"><span>Заголовок новости</span><input name="title" maxlength="120" required placeholder="Коротко: что произошло"></label>':'';const prompt=helpMode?'Опишите ситуацию: авто, симптомы, выполненные проверки и что нужно подсказать':isQuestion?'Опишите проблему, симптомы и что уже проверяли':isNews?'Расскажите детали новости':'Поделитесь опытом или событием';return `${routeHeader(title,{back:helpMode?'#/community/help':'#/community',actions:`<button type="submit" form="community-create-form" class="k-community-publish-top">Опубликовать</button>`})}<main class="k-community-editor">${helper}<form id="community-create-form" data-community-create="${kind}">${titleField}<label class="k-community-editor-text"><span>${isQuestion?'Ваш вопрос':isNews?'Текст новости':'Что у вас происходит?'}</span><textarea name="text" required maxlength="3000" placeholder="${prompt}"></textarea></label><div class="k-community-editor-media"><button type="button" data-community-add-media>${icon('camera')||'＋'} Добавить фото</button><div data-community-editor-preview></div></div><button class="k-community-editor-row" type="button"><span>Автомобиль</span><i>Не выбран ›</i></button><button class="k-community-editor-row" type="button"><span>${isQuestion?'Категория':'Тема'}</span><i>Выбрать ›</i></button><button class="k-community-editor-row" type="button"><span>Место</span><i>${esc(api.currentCity?.()||'Город не выбран')} ›</i></button>${isQuestion?'<button class="k-community-editor-row" type="button"><span>Кто может ответить</span><i>Все участники ›</i></button>':'<button class="k-community-editor-row" type="button"><span>Кто может видеть</span><i>Все ›</i></button>'}<label class="k-community-editor-switch"><span>${isQuestion?'Уведомлять о новых ответах':'Разрешить комментарии'}</span><input type="checkbox" name="comments" checked></label><button class="k-community-editor-submit" type="submit">Опубликовать</button></form></main>`;}

  function storyCreatePage(){const currentRole=role();const modes=currentRole==='MASTER'?['Обычная','Работа','Совет']:currentRole==='STO'?['Работа','Новость','Акция']:['Обычная','Вопрос'];return `${routeHeader('Новая история')}<main class="k-community-story-editor"><div class="k-community-story-editor-canvas"><span>${icon('camera')||'＋'}</span><b>Добавьте фото или видео</b><p>История будет доступна 24 часа</p></div><div class="k-community-story-modes">${modes.map((m,i)=>`<button class="${i===0?'is-active':''}" type="button">${esc(m)}</button>`).join('')}</div><button type="button" class="k-community-editor-submit" data-community-story-publish>Опубликовать историю</button></main>`;}

  function storyPage(id){return `<div class="k-community-story-overlay" data-community-story-overlay data-story-id="${esc(id)}"><div class="k-community-story-progress"><i></i><i></i><i></i></div><header><div class="k-community-story-author"><span>К</span><div><b>История</b><small>только что</small></div></div><a href="#/community" aria-label="Закрыть">${icon('close')}</a></header><div class="k-community-story-content" data-community-story-content><div class="k-community-story-loading">Загрузка истории…</div></div><footer><input placeholder="Ответить…"><button type="button">♡</button><button type="button">↗</button></footer></div>`;}

  function postPage(id){return `${routeHeader('Публикация')}<main class="k-community-post-page" data-community-post-page="${esc(id)}"><div class="k-community-post-skeleton-list"><article></article></div></main>`;}
  function topicPage(id){return `${routeHeader('Toyota Camry Club')}<main class="k-community-topic"><h1>Какое масло лучше для 2AR-FE?</h1><div class="k-community-topic-author"><span>И</span><div><b>Иван Петров</b><small>Toyota Camry 2014</small></div></div><p>Интересует реальный опыт эксплуатации зимой и летом. Пробег 180 тыс. км.</p><button class="k-community-topic-follow" type="button">Следить за темой</button><h2>32 ответа</h2>${['Использую Shell Helix Ultra 5W-30. На холодном запуске всё нормально, расхода почти нет.','Для исправного 2AR-FE я бы ориентировался на допуск производителя и состояние двигателя.','На пробеге выше 150 тыс. стоит сначала проверить расход и давление масла.'].map((x,i)=>`<article><div><span>${i===0?'А':'М'}</span><div><b>${i===0?'Алексей Морозов':'Мастер KARETA'}</b><small>✓ Мастер</small></div></div><p>${esc(x)}</p><button type="button">♡ ${16-i*3}</button></article>`).join('')}<form class="k-community-topic-reply"><input placeholder="Ответить в теме…"><button>Отправить</button></form></main>`;}

  function renderCommunity(){const route=parseRoute();const desktop=desktopCommunity();let body='';if(desktop&&['feed','groups','search','help'].includes(route.name))body=feedShell(route.mode||'recommended',route.name==='feed'?'feed':route.name);else if(route.name==='feed')body=feedShell(route.mode);else if(route.name==='groups')body=groupsPage();else if(route.name==='group')body=groupPage(route);else if(route.name==='search')body=searchPage();else if(route.name==='help')body=helpPage();else if(route.name==='post-create')body=createPage(routeQuery().get('mode')==='news'?'NEWS':'POST');else if(route.name==='question-create')body=createPage('QUESTION');else if(route.name==='story-create')body=storyCreatePage();else if(route.name==='story')body=storyPage(route.id);else if(route.name==='post')body=postPage(route.id);else if(route.name==='topic')body=topicPage(route.id);else body=feedShell('recommended');return `<section class="k-page${isMasterRole()?' k-master-page k-master-surface-page':''} k-community-page k-community-v2 k-flow-primary-page" data-community-page data-kflow-screen="community" data-community-route="${esc(route.name)}">${body}<div class="k-community-comments-sheet" data-community-comments-sheet role="dialog" aria-modal="true" hidden><div class="k-community-comments-backdrop" data-community-comments-close></div><section class="k-community-comments-panel"><header><span></span><h2 data-community-comments-title>Комментарии</h2><button type="button" data-community-comments-close>${icon('close')}</button></header><div class="k-community-comments-list" data-community-comments-list></div><form data-community-comment-form><input maxlength="1200" placeholder="Напишите комментарий" required><button type="submit">Отправить</button></form></section></div><div class="k-community-filter-sheet-wrap" data-community-filter-dialog hidden><div class="k-community-comments-backdrop" data-community-filter-close></div><section class="k-community-filter-panel"><header><h2>Фильтры сообщества</h2><button type="button" data-community-filter-close>${icon('close')}</button></header><h3>Тип контента</h3>${['Все','Вопросы','Новости','Работы','Публикации','Видео','События'].map((x,i)=>`<label><input type="checkbox" ${i===0?'checked':''}><span>${x}</span></label>`).join('')}<h3>Автор</h3>${['Клиенты','Мастера','СТО','Сообщества'].map(x=>`<label><input type="checkbox"><span>${x}</span></label>`).join('')}<button type="button" class="k-community-editor-submit" data-community-filter-apply>Показать</button></section></div><dialog class="k-community-dialog" data-community-dialog><button type="button" data-community-close>${icon('close')}</button><div></div></dialog></section>`;}

  function patchPosts(posts){stateApi.patch({posts},'posts');}
  function postById(id){return stateApi.snapshot().posts.find(p=>p.id===id)||null;}
  let visibleCount=window.matchMedia?.('(max-width: 767px)')?.matches?6:12;let repairFilter='all';let observer=null;let videoObserver=null;let activeVideo=null;let activeCommentPost=null;let disposed=false;

  function paintStories(){const root=document.querySelector('[data-community-stories]');if(!root)return;const stories=api.getStories(stateApi.snapshot().posts);stateApi.patch({stories},'stories');root.innerHTML=storiesHtml(stories);}
  function filteredPosts(){const st=stateApi.snapshot();let rows=[...st.posts];if(st.feedMode==='subscriptions')rows=rows.filter(p=>{const type=p.author?.contextType==='MASTER'?'master':p.author?.contextType==='STO'?'sto':'';return !!(type&&p.author?.id&&social?.isFollowing?.(type,p.author.id));});if(st.feedMode==='nearby'){const city=text(api.currentCity?.());rows=city?rows.filter(p=>!p.location?.city||p.location.city===city):[];}return rows;}
  function paintFeed(){const root=document.querySelector('[data-community-feed]');if(!root)return;const rows=filteredPosts();root.innerHTML=rows.length?rows.slice(0,visibleCount).map(p=>renderCommunityPost(p)).join(''):`<div class="k-community-empty"><h2>${stateApi.snapshot().feedMode==='subscriptions'?'Ваша лента подписок пока пустая':'Публикаций пока нет'}</h2><p>${stateApi.snapshot().feedMode==='subscriptions'?'Подпишитесь на мастеров, автосервисы и сообщества.':'Попробуйте позже.'}</p><a href="#/community/groups">Найти интересное</a></div>`;setupVideoAutoplay();}
  function stopCommunityVideos(){if(videoObserver){videoObserver.disconnect();videoObserver=null;}document.querySelectorAll('[data-community-autoplay-video]').forEach(video=>{try{video.pause();}catch(_e){}});activeVideo=null;}
  function playCommunityVideo(video){if(!video||document.hidden||document.body.classList.contains('k-community-sheet-open')||document.body.classList.contains('k-community-story-open'))return;document.querySelectorAll('[data-community-autoplay-video]').forEach(other=>{if(other!==video&&!other.paused){try{other.pause();}catch(_e){}}});video.muted=true;video.defaultMuted=true;if(video.preload==='none')video.preload='metadata';const promise=video.play?.();if(promise?.catch)promise.catch(()=>{});activeVideo=video;}
  function setupVideoAutoplay(){if(disposed)return;videoObserver?.disconnect();videoObserver=null;const videos=[...document.querySelectorAll('[data-community-feed] [data-community-autoplay-video], [data-community-repair-feed] [data-community-autoplay-video], [data-community-post-page] [data-community-autoplay-video], [data-community-group-feed] [data-community-autoplay-video]')];if(!videos.length){activeVideo=null;return;}videos.forEach((video,index)=>{video.muted=true;video.defaultMuted=true;video.playsInline=true;video.dataset.communityVideoIndex=String(index);});if(!('IntersectionObserver'in window)){const first=videos[0];if(first)requestAnimationFrame(()=>playCommunityVideo(first));return;}const ratios=new Map();videoObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{const video=entry.target;ratios.set(video,entry.isIntersecting?entry.intersectionRatio:0);if(entry.isIntersecting&&video.preload==='none')video.preload='metadata';if(!entry.isIntersecting&&video===activeVideo){try{video.pause();}catch(_e){}activeVideo=null;}});let best=null,bestRatio=0;ratios.forEach((ratio,video)=>{if(!video.isConnected)return;if(ratio>bestRatio){best=video;bestRatio=ratio;}});if(best&&bestRatio>=.42){playCommunityVideo(best);}else if(activeVideo&&bestRatio<.2){try{activeVideo.pause();}catch(_e){}activeVideo=null;}},{threshold:[0,.15,.25,.42,.55,.7,.85,1],rootMargin:'120px 0px 80px'});videos.forEach(video=>videoObserver.observe(video));requestAnimationFrame(()=>{if(activeVideo)return;const first=videos.find(video=>{const rect=video.getBoundingClientRect();const vh=window.innerHeight||document.documentElement.clientHeight;return rect.bottom>0&&rect.top<vh;})||videos[0];if(first){const rect=first.getBoundingClientRect();const vh=window.innerHeight||document.documentElement.clientHeight;if(rect.top<vh&&rect.bottom>0)playCommunityVideo(first);}});}
  function syncPostReaction(post){document.querySelectorAll('[data-community-post-id]').forEach(article=>{if(String(article.dataset.communityPostId)!==String(post.id))return;const like=article.querySelector('[data-community-like]');if(like){like.classList.toggle('is-active',!!post.liked);const count=like.querySelector('span');if(count)count.textContent=formatCount(post.stats?.likes||0);}const save=article.querySelector('[data-community-save]');if(save)save.classList.toggle('is-active',!!post.saved);});}
  function setCommunityVideoSuspended(suspended){if(suspended){document.querySelectorAll('[data-community-autoplay-video]').forEach(video=>{if(!video.paused){try{video.pause();}catch(_e){}}});return;}setupVideoAutoplay();}

  async function loadFeed(mode){stateApi.setFeedMode(mode||'recommended');stateApi.patch({loading:true,error:''},'loading');const result=await api.getFeed({mode:stateApi.snapshot().feedMode,limit:window.matchMedia?.('(max-width: 767px)')?.matches?48:80});if(disposed)return;if(!result.ok){stateApi.patch({loading:false,error:'Не удалось загрузить публикации'},'error');return;}patchPosts(result.data.items||[]);stateApi.patch({loading:false,error:'',groups:api.getGroups(),pagination:{cursor:result.data.cursor||null,hasMore:!!result.data.hasMore,page:0}},'loaded');paintStories();paintFeed();paintSideGroups();setupSentinel();}
  function paintSideGroups(){const root=document.querySelector('[data-community-side-groups]');if(root)root.innerHTML=groupsRail(api.getGroups());}
  function setupSentinel(){observer?.disconnect();const sentinel=document.querySelector('[data-community-feed-sentinel]');if(!sentinel||!('IntersectionObserver'in window))return;observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;const total=filteredPosts().length;if(visibleCount<total){visibleCount=Math.min(total,visibleCount+8);paintFeed();}},{rootMargin:'500px 0px'});observer.observe(sentinel);}

  async function paintSearch(){const input=document.querySelector('[data-community-unified-search]'),root=document.querySelector('[data-community-search-results]');if(!root)return;if(!stateApi.snapshot().posts.length){const r=await api.getFeed({limit:80});if(r.ok)patchPosts(r.data.items||[]);}const q=text(input?.value||routeQuery().get('q'));const result=api.search(q,stateApi.snapshot().posts);root.innerHTML=`${result.groups.length?`<section><h2>Сообщества</h2>${result.groups.slice(0,5).map(g=>`<a class="k-community-search-result" href="#/community/group/${encodeURIComponent(g.id)}"><span>${esc(g.short)}</span><div><b>${esc(g.name)}</b><small>${formatCount(g.members)} участников</small></div></a>`).join('')}</section>`:''}${result.posts.length?`<section><h2>Публикации</h2>${result.posts.slice(0,8).map(p=>renderCommunityPost(p)).join('')}</section>`:''}${result.questions.length?`<section><h2>Вопросы</h2>${result.questions.slice(0,8).map(p=>renderCommunityPost(p)).join('')}</section>`:''}${!result.groups.length&&!result.posts.length&&!result.questions.length?'<div class="k-community-empty"><h2>Ничего не найдено</h2><p>Попробуйте изменить запрос.</p></div>':''}`;}
  function repairQuestionRows(){
    let rows=stateApi.snapshot().posts.filter(post=>post?.type==='QUESTION');
    if(repairFilter==='unanswered')rows=rows.filter(post=>Number(post.stats?.comments||0)===0);
    if(repairFilter==='discussed')rows=rows.filter(post=>Number(post.stats?.comments||0)>0).sort((a,b)=>Number(b.stats?.comments||0)-Number(a.stats?.comments||0)||new Date(b.createdAt||0)-new Date(a.createdAt||0));
    return rows;
  }
  async function hydrateRepairCommentPreviews(rows){
    await Promise.all(rows.slice(0,8).map(async post=>{
      const host=[...document.querySelectorAll('[data-repair-comments-preview]')].find(node=>node.dataset.repairCommentsPreview===String(post.id));
      if(!host||!host.isConnected)return;
      try{
        const r=await api.getComments(post);
        if(!host.isConnected||!r?.ok)return;
        const comments=Array.isArray(r.data?.items)?r.data.items:[];
        const preview=comments.slice(-2);
        host.innerHTML=`${preview.map(c=>`<div class="k-community-repair-comment-preview"><b>${esc(c.authorName||c.author||'Участник')}</b><span>${esc(c.body||c.text||'')}</span></div>`).join('')}<button type="button" data-community-comments="${esc(post.id)}">${comments.length?`Все ответы · ${formatCount(comments.length)}`:'Ответов пока нет — будьте первым'}</button>`;
      }catch(_e){}
    }));
  }
  function paintRepairQuestions(){
    const root=document.querySelector('[data-community-repair-feed]');
    if(!root)return;
    const rows=repairQuestionRows();
    root.innerHTML=rows.length?rows.map(renderRepairQuestion).join(''):'<div class="k-community-empty k-community-repair-empty"><h2>Вопросов пока нет</h2><p>Задайте первый вопрос — опишите автомобиль, симптомы и что уже проверили.</p><a href="#/community/question/create?mode=help">Задать вопрос</a></div>';
    setupVideoAutoplay();
    hydrateRepairCommentPreviews(rows);
  }
  async function loadRepairQuestions(){
    const root=document.querySelector('[data-community-repair-feed]');
    if(!root)return;
    const r=await api.getFeed({limit:80,force:true});
    if(disposed||!root.isConnected)return;
    if(!r?.ok){root.innerHTML='<div class="k-community-empty"><h2>Не удалось загрузить вопросы</h2><p>Повторите попытку позже.</p></div>';return;}
    patchPosts(r.data?.items||[]);
    paintRepairQuestions();
  }


  async function paintGroup(route){const root=document.querySelector('[data-community-group-feed]');const media=document.querySelector('[data-community-group-media]');if(!root&&!media)return;if(!stateApi.snapshot().posts.length){const r=await api.getFeed({limit:80});if(r.ok)patchPosts(r.data.items||[]);}const group=api.getGroup(route.id),hay=(group?[group.name,group.vehicle,group.city].join(' '):'').toLowerCase();let rows=stateApi.snapshot().posts.filter(p=>p.groupId&&group&&p.groupId===group.id);if(!rows.length)rows=stateApi.snapshot().posts.filter(p=>{const s=[p.title,p.text,p.author?.name,vehicleLabel(p.vehicle),p.location?.city].join(' ').toLowerCase();return !hay||hay.split(/\s+/).filter(Boolean).some(k=>s.includes(k));});if(!rows.length)rows=stateApi.snapshot().posts.slice(0,8);if(root){root.innerHTML=rows.map(p=>renderCommunityPost(p)).join('');setupVideoAutoplay();}if(media){const all=rows.flatMap(p=>(p.media||[]).map(m=>({...m,postId:p.id}))).filter(m=>m.src);media.innerHTML=all.length?all.map(m=>`<a href="#/community/post/${encodeURIComponent(m.postId)}">${m.type==='video'?`<video src="${esc(m.src)}" preload="metadata"></video>`:`<img src="${esc(m.src)}" loading="lazy" alt="">`}</a>`).join(''):'<div class="k-community-empty">Медиа пока нет</div>';}}

  async function groupRows(route){
    if(!api.getGroup(route.id))await api.loadGroups?.({force:false});
    if(!stateApi.snapshot().posts.length){const r=await api.getFeed({limit:100});if(r?.ok)patchPosts(r.data?.items||[]);}
    return stateApi.snapshot().posts.filter(p=>p.groupId===route.id);
  }
  async function paintGroupDiscussions(route){
    const root=document.querySelector('[data-community-group-discussions]');if(!root)return;
    const rows=(await groupRows(route)).filter(p=>p.type==='QUESTION').sort((a,b)=>Number(b.stats?.comments||0)-Number(a.stats?.comments||0)||new Date(b.createdAt||0)-new Date(a.createdAt||0));
    root.innerHTML=rows.length?rows.map(renderRepairQuestion).join(''):'<div class="k-community-empty"><h2>Обсуждений пока нет</h2><p>Задайте первый вопрос участникам этого сообщества.</p></div>';
    hydrateRepairCommentPreviews(rows);setupVideoAutoplay();
  }
  async function paintGroupMembers(route){
    const root=document.querySelector('[data-community-group-members]');if(!root)return;
    const r=await api.loadGroupMembers?.(route.id,{force:true}),rows=r?.data?.items||[];
    if(!r?.ok){root.innerHTML='<div class="k-community-empty">Не удалось загрузить участников</div>';return;}
    const label=v=>({master:'Мастер',sto:'СТО',seller:'Продавец',client:'Автовладелец'}[String(v||'').toLowerCase()]||'Участник');
    const moderators=rows.filter(x=>['owner','moderator'].includes(String(x.memberRole||'')));
    const members=rows.filter(x=>!['owner','moderator'].includes(String(x.memberRole||'')));
    root.innerHTML=`${moderators.length?`<h3>Модераторы</h3>${moderators.map(x=>memberRow(x.name,label(x.role))).join('')}`:''}<h3>Участники</h3>${members.length?members.map(x=>memberRow(x.name,label(x.role)+(x.car?` · ${x.car}`:''))).join(''):'<div class="k-community-empty compact">Участников пока нет</div>'}`;
  }

  async function paintPost(id){const root=document.querySelector('[data-community-post-page]');if(!root)return;let post=postById(id);if(!post){const r=await api.getPost(id);post=r.data?.post;if(post)patchPosts([post,...stateApi.snapshot().posts]);}if(!post){root.innerHTML='<div class="k-community-empty"><h2>Публикация не найдена</h2><a href="#/community">Вернуться в ленту</a></div>';return;}root.innerHTML=renderCommunityPost(post,{full:true})+`<section class="k-community-post-inline-comments"><header><h2>Комментарии</h2><span data-community-inline-count></span></header><div class="k-community-inline-comments-list" data-community-inline-comments-list><div class="k-community-comments-loading">Загрузка…</div></div><form class="k-community-inline-comment-form" data-community-inline-comment-form data-community-post-id="${esc(post.id)}"><input maxlength="1200" placeholder="Напишите комментарий" required><button type="submit">Отправить</button></form></section>`;setupVideoAutoplay();const list=root.querySelector('[data-community-inline-comments-list]'),count=root.querySelector('[data-community-inline-count]');const cr=await api.getComments(post);const rows=cr?.data?.items||[];if(count)count.textContent=rows.length?String(rows.length):'';if(list)list.innerHTML=rows.length?rows.map(c=>`<article class="k-community-comment"><span>${esc((c.authorName||c.author||'К').slice(0,1))}</span><div><b>${esc(c.authorName||c.author||'Пользователь')}</b><p>${esc(c.body||c.text||'')}</p><time>${esc(timeAgo(c.createdAt||c.created_at))}</time></div></article>`).join(''):'<div class="k-community-empty compact">Комментариев пока нет</div>';}
  async function paintStory(id){const root=document.querySelector('[data-community-story-content]');if(!root)return;if(!stateApi.snapshot().posts.length){const r=await api.getFeed({limit:80});if(r.ok)patchPosts(r.data.items||[]);}const stories=api.getStories(stateApi.snapshot().posts),story=stories.find(s=>s.id===id);if(!story||story.self){root.innerHTML='<div class="k-community-story-loading">История недоступна</div>';return;}const p=postById(story.postId);root.innerHTML=`${story.media?.type==='video'?`<video src="${esc(story.media.src)}" autoplay muted playsinline controls></video>`:`<img src="${esc(story.media?.src||'')}" alt="">`}<div class="k-community-story-caption"><small>${esc(postTypeLabel(p?.type))}</small><h2>${esc(p?.title||'История')}</h2><p>${esc(p?.text||'')}</p></div>`;document.body.classList.add('k-community-story-open');}

  async function openComments(id){const post=postById(id);if(!post)return;activeCommentPost=post;const sheet=document.querySelector('[data-community-comments-sheet]'),list=document.querySelector('[data-community-comments-list]');if(!sheet||!list)return;const title=sheet.querySelector('[data-community-comments-title]'),input=sheet.querySelector('[data-community-comment-form] input');if(title)title.textContent=post.type==='QUESTION'?'Обсуждение':'Комментарии';if(input)input.placeholder=post.type==='QUESTION'?'Ответить на вопрос…':'Напишите комментарий';sheet.hidden=false;document.body.classList.add('k-community-sheet-open');setCommunityVideoSuspended(true);list.innerHTML='<div class="k-community-comments-loading">Загрузка…</div>';const r=await api.getComments(post);const rows=r.data?.items||[];list.innerHTML=rows.length?rows.map(c=>`<article class="k-community-comment"><span>${esc((c.authorName||c.author||'К').slice(0,1))}</span><div><b>${esc(c.authorName||c.author||'Пользователь')}</b><p>${esc(c.body||c.text||'')}</p><time>${esc(timeAgo(c.createdAt||c.created_at))}</time></div></article>`).join(''):'<div class="k-community-empty compact">Комментариев пока нет</div>';}
  function closeComments(){const sheet=document.querySelector('[data-community-comments-sheet]');if(sheet)sheet.hidden=true;activeCommentPost=null;document.body.classList.remove('k-community-sheet-open');setCommunityVideoSuspended(false);}
  function toggleFilter(open){const sheet=document.querySelector('[data-community-filter-dialog]');if(sheet)sheet.hidden=!open;document.body.classList.toggle('k-community-sheet-open',open);setCommunityVideoSuspended(!!open);}

  async function sharePost(post){const url=`${location.origin}${location.pathname}#/community/post/${encodeURIComponent(post.id)}`;try{if(navigator.share)await navigator.share({title:post.title,text:post.text?.slice(0,180),url});else{await navigator.clipboard.writeText(url);window.KaretaToast?.success('Ссылка скопирована');}}catch(e){if(e?.name!=='AbortError')window.KaretaToast?.error('Не удалось поделиться');}}
  function openRelated(x){if(!x)return;const target=x.route;if((x.type==='work'||x.type==='product')&&target&&window.KaretaWindowEngine?.descriptor?.(target)){window.KaretaWindowEngine.openEntity(target);return;}if(target)location.hash=target;}

  function closeCommunityMoreMenu(page=document){
    page.querySelectorAll?.('.k-community-more-menu').forEach(node=>node.remove());
  }
  function openCommunityMoreMenu(button,post,page){
    const existing=button.parentElement?.querySelector('.k-community-more-menu');
    if(existing){existing.remove();return;}
    closeCommunityMoreMenu(page);
    const menu=document.createElement('div');
    menu.className='k-community-more-menu';
    menu.dataset.communityMoreMenu=post.id;
    menu.innerHTML=`<button type="button" data-community-more-action="open" data-community-post-id="${esc(post.id)}">Открыть публикацию</button><button type="button" data-community-more-action="share" data-community-post-id="${esc(post.id)}">Поделиться</button><button type="button" data-community-more-action="hide" data-community-post-id="${esc(post.id)}">Скрыть из ленты</button>`;
    button.parentElement?.append(menu);
  }

  function bindSwipeDown(panel,close){if(!panel)return()=>{};let startY=0,current=0,dragging=false;const start=e=>{const y=e.touches?.[0]?.clientY??e.clientY;if(panel.scrollTop>0)return;startY=y;current=0;dragging=true;panel.style.transition='none';};const move=e=>{if(!dragging)return;const y=e.touches?.[0]?.clientY??e.clientY;current=Math.max(0,y-startY);if(current>0)panel.style.transform=`translateY(${Math.min(current,220)}px)`;};const end=()=>{if(!dragging)return;dragging=false;panel.style.transition='transform .18s ease';if(current>90)close();panel.style.transform='';current=0;};panel.addEventListener('touchstart',start,{passive:true});panel.addEventListener('touchmove',move,{passive:true});panel.addEventListener('touchend',end);return()=>{panel.removeEventListener('touchstart',start);panel.removeEventListener('touchmove',move);panel.removeEventListener('touchend',end);};}

  function mountCommunity(ctx={}){
    const page=document.querySelector('[data-community-page]');if(!page)return()=>{};
    disposed=false;visibleCount=window.matchMedia?.('(max-width: 767px)')?.matches?6:12;const route=parseRoute();const routeKey=routeHash();const groupWasMissing=route.name==='group'&&!api.getGroup?.(route.id);const onVisibility=()=>{if(document.hidden)setCommunityVideoSuspended(true);else setCommunityVideoSuspended(false);};document.addEventListener('visibilitychange',onVisibility);
    const onClick=async e=>{
      if(!e.target.closest('[data-community-more],.k-community-more-menu'))closeCommunityMoreMenu(page);
      const desktopView=e.target.closest('[data-community-desktop-view]');
      if(desktopView&&desktopCommunity()){e.preventDefault();await switchDesktopView(desktopView.dataset.communityDesktopView||'feed');return;}
      const repairFilterButton=e.target.closest('[data-community-repair-filter]');
      if(repairFilterButton){repairFilter=String(repairFilterButton.dataset.communityRepairFilter||'all');page.querySelectorAll('[data-community-repair-filter]').forEach(btn=>btn.classList.toggle('is-active',btn===repairFilterButton));paintRepairQuestions();return;}
      const like=e.target.closest('[data-community-like]');if(like){const post=postById(like.dataset.communityLike);if(!post)return;const prev=post.liked;post.liked=!prev;post.stats.likes=Math.max(0,Number(post.stats.likes||0)+(post.liked?1:-1));syncPostReaction(post);const r=await api.likePost(post,post.liked);if(!r?.ok){post.liked=prev;post.stats.likes=Math.max(0,Number(post.stats.likes||0)+(prev?1:-1));syncPostReaction(post);window.KaretaToast?.error('Не удалось поставить отметку');}return;}
      const save=e.target.closest('[data-community-save]');if(save){const post=postById(save.dataset.communitySave);if(!post)return;const prev=post.saved;post.saved=!prev;syncPostReaction(post);const r=await api.savePost(post,post.saved);if(!r?.ok){post.saved=prev;syncPostReaction(post);window.KaretaToast?.error('Не удалось сохранить');}return;}
      const comments=e.target.closest('[data-community-comments]');if(comments){await openComments(comments.dataset.communityComments);return;}
      if(e.target.closest('[data-community-comments-close]')){closeComments();return;}
      const share=e.target.closest('[data-community-share]');if(share){const post=postById(share.dataset.communityShare);if(post)await sharePost(post);return;}
      const follow=e.target.closest('[data-community-follow-author]');if(follow){const post=postById(follow.dataset.communityFollowAuthor),a=post?.author;if(!a?.id||!['MASTER','STO'].includes(a.contextType))return;const providerType=a.contextType==='MASTER'?'master':'sto',next=!social?.isFollowing?.(providerType,a.id),previous=!next;social?.setFollowing?.(providerType,a.id,next,{name:a.name});follow.classList.toggle('is-following',next);follow.textContent=next?'✓':'+';try{const r=providerType==='sto'?await coreApi.updateStoSocial?.(a.id,'following',next):await coreApi.updateMasterSocial?.(a.id,'following',next);if(!r?.ok)throw new Error(r?.payload?.message||'subscription_failed');}catch(_e){social?.setFollowing?.(providerType,a.id,previous,{name:a.name});follow.classList.toggle('is-following',previous);follow.textContent=previous?'✓':'+';window.KaretaToast?.error('Не удалось изменить подписку');}return;}
      const moreAction=e.target.closest('[data-community-more-action]');if(moreAction){const post=postById(moreAction.dataset.communityPostId);if(!post)return;const action=moreAction.dataset.communityMoreAction;if(action==='open'){closeCommunityMoreMenu(page);location.hash=`#/community/post/${encodeURIComponent(post.id)}`;return;}if(action==='share'){closeCommunityMoreMenu(page);await sharePost(post);return;}if(action==='hide'){const card=page.querySelector(`[data-community-more="${CSS.escape(post.id)}"]`)?.closest('.k-community-post,.k-social-post,article');card?.remove();closeCommunityMoreMenu(page);window.KaretaToast?.info?.('Публикация скрыта');return;}}
      const more=e.target.closest('[data-community-more]');if(more){const post=postById(more.dataset.communityMore);if(post)openCommunityMoreMenu(more,post,page);return;}
      if(e.target.closest('[data-community-filter-open]')){toggleFilter(true);return;}
      if(e.target.closest('[data-community-filter-close]')||e.target.closest('[data-community-filter-apply]')){toggleFilter(false);return;}
      const join=e.target.closest('[data-community-join]');if(join){const groupId=join.dataset.communityJoin,g=api.getGroup?.(groupId),next=!(g?.joined||join.classList.contains('is-active'));join.disabled=true;const prevText=join.textContent;join.classList.toggle('is-active',next);join.textContent=next?'Вы участник':'Вступить';try{const r=await api.setGroupMembership?.(groupId,next);if(!r?.ok)throw new Error(r?.error||'group_membership_failed');await api.loadGroups?.({force:true});paintCommunityGroups();}catch(_e){join.classList.toggle('is-active',!next);join.textContent=prevText;window.KaretaToast?.error?.('Не удалось изменить участие в сообществе');}finally{if(join.isConnected)join.disabled=false;}return;}
      const poll=e.target.closest('[data-community-poll]');if(poll){poll.closest('.k-community-poll')?.querySelectorAll('button').forEach(b=>b.classList.remove('is-voted'));poll.classList.add('is-voted');return;}
      if(e.target.closest('[data-community-search-clear]')){const input=page.querySelector('[data-community-unified-search]');if(input){input.value='';paintSearch();input.focus();}return;}
      if(e.target.closest('[data-community-story-publish]')){if(api.isProduction?.()){window.KaretaToast?.info?.('Публикация Stories будет доступна после подключения серверного API');return;}const r=await api.createStory?.({contextType:role(),authorName:'Вы',city:api.currentCity?.()||''});if(r?.ok){window.KaretaToast?.success('История сохранена');location.hash='#/community';}return;}
      const groupShare=e.target.closest('[data-community-share-group]');if(groupShare){const url=`${location.origin}${location.pathname}#/community/group/${encodeURIComponent(groupShare.dataset.communityShareGroup)}`;try{await navigator.clipboard.writeText(url);window.KaretaToast?.success('Ссылка скопирована');}catch(_e){}return;}
      const oldOpen=e.target.closest('[data-community-open]');if(oldOpen){const post=postById(oldOpen.dataset.communityOpen);openRelated(post);return;}
      if(e.target.closest('[data-community-close]'))page.querySelector('[data-community-dialog]')?.close();
    };
    const onInput=e=>{if(e.target.matches('[data-community-unified-search]')){clearTimeout(onInput.t);onInput.t=setTimeout(paintSearch,120);}};
    const onSubmit=async e=>{
      const shellSearch=e.target.closest('[data-community-shell-search]');if(shellSearch){e.preventDefault();const input=shellSearch.querySelector('[data-community-shell-search-input]'),q=text(input?.value);location.hash=q?`#/community/search?q=${encodeURIComponent(q)}`:'#/community/search';return;}
      const repairReply=e.target.closest('[data-community-repair-reply]');if(repairReply){e.preventDefault();const post=postById(repairReply.dataset.communityRepairReply),input=repairReply.querySelector('input'),value=text(input?.value);if(!post||!value)return;const button=repairReply.querySelector('button');if(button)button.disabled=true;try{const r=await api.addComment(post,value);if(!r?.ok)throw new Error(r?.error||r?.payload?.message||'comment_failed');post.stats=post.stats||{};post.stats.comments=Number(post.stats.comments||0)+1;if(input)input.value='';paintRepairQuestions();}catch(_e){window.KaretaToast?.error?.('Не удалось отправить ответ');}finally{if(button?.isConnected)button.disabled=false;}return;}
      const create=e.target.closest('[data-community-create]');if(create){e.preventDefault();const fd=new FormData(create),kind=create.dataset.communityCreate,payload={type:kind,groupId:text(routeQuery().get('group')),title:text(fd.get('title')),text:text(fd.get('text')),comments:fd.get('comments')!==null,contextType:role(),authorName:'Вы',city:api.currentCity?.()||''};if(payload.text.length<3)return;const r=kind==='QUESTION'?await api.createQuestion(payload):await api.createPost(payload);if(r?.ok){window.KaretaToast?.success(kind==='QUESTION'?'Вопрос опубликован':kind==='NEWS'?'Новость опубликована':'Публикация создана');location.hash=kind==='QUESTION'?(payload.groupId?`#/community/group/${encodeURIComponent(payload.groupId)}`:'#/community/help'):'#/community';}else{const msg=kind==='QUESTION'?'Не удалось опубликовать вопрос':kind==='NEWS'?'Не удалось опубликовать новость':'Публикация недоступна для текущего профиля';window.KaretaToast?.error?.(r?.error||r?.payload?.message||msg);}return;}
      const inlineForm=e.target.closest('[data-community-inline-comment-form]');if(inlineForm){e.preventDefault();const post=postById(inlineForm.dataset.communityPostId);const input=inlineForm.querySelector('input'),value=text(input?.value);if(!post||!value)return;input.disabled=true;const button=inlineForm.querySelector('button');if(button)button.disabled=true;const r=await api.addComment(post,value);input.disabled=false;if(button)button.disabled=false;if(r?.ok){post.stats=post.stats||{};post.stats.comments=Number(post.stats.comments||0)+1;input.value='';await paintPost(post.id);}else window.KaretaToast?.error('Не удалось отправить комментарий');return;}
      const form=e.target.closest('[data-community-comment-form]');if(form){e.preventDefault();const input=form.querySelector('input'),value=text(input?.value);if(!activeCommentPost||!value)return;const optimistic={id:`pending_${Date.now()}`,authorName:'Вы',body:value,createdAt:new Date().toISOString()};const list=document.querySelector('[data-community-comments-list]');list?.insertAdjacentHTML('beforeend',`<article class="k-community-comment is-pending"><span>В</span><div><b>Вы</b><p>${esc(value)}</p><time>отправляется…</time></div></article>`);input.value='';const r=await api.addComment(activeCommentPost,value);if(r?.ok){activeCommentPost.stats.comments=Number(activeCommentPost.stats.comments||0)+1;await openComments(activeCommentPost.id);}else window.KaretaToast?.error('Не удалось отправить комментарий');return;}
    };
    page.addEventListener('click',onClick);page.addEventListener('input',onInput);page.addEventListener('submit',onSubmit);const unbindCommentsSwipe=bindSwipeDown(page.querySelector('.k-community-comments-panel'),closeComments);const unbindFilterSwipe=bindSwipeDown(page.querySelector('.k-community-filter-panel'),()=>toggleFilter(false));
    api.loadGroups?.({force:false}).then(()=>{if(disposed||!page.isConnected)return;if(groupWasMissing&&route.name==='group'&&api.getGroup?.(route.id)){window.dispatchEvent(new HashChangeEvent('hashchange'));return;}paintCommunityGroups();if(route.name==='search')paintSearch();});
    if(route.name==='feed')loadFeed(route.mode).then(()=>{const y=stateApi.scrollFor(routeKey);if(y)requestAnimationFrame(()=>window.scrollTo(0,y));});
    else if(route.name==='search')paintSearch();
    else if(route.name==='help')loadRepairQuestions();
    else if(route.name==='group')Promise.all([paintGroup(route),paintGroupDiscussions(route),paintGroupMembers(route)]);
    else if(route.name==='post')paintPost(route.id);
    else if(route.name==='story')paintStory(route.id);
    return()=>{disposed=true;observer?.disconnect();observer=null;stopCommunityVideos();document.removeEventListener('visibilitychange',onVisibility);unbindCommentsSwipe?.();unbindFilterSwipe?.();stateApi.rememberScroll(routeKey,window.scrollY||0);page.removeEventListener('click',onClick);page.removeEventListener('input',onInput);page.removeEventListener('submit',onSubmit);closeComments();toggleFilter(false);document.body.classList.remove('k-community-story-open');};
  }

  window.KaretaCommunityPages=Object.freeze({renderCommunity,mountCommunity,renderCommunityPost});
})();
