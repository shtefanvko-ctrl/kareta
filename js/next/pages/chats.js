(() => {
  'use strict';

  if (window.__KARETA_CHATS_PAGES_MODULE__) {
    window.__KARETA_CHATS_PAGES_MODULE__.duplicateLoads += 1;
    return;
  }
  window.__KARETA_CHATS_PAGES_MODULE__ = { duplicateLoads:0 };

  const ui=window.KaretaPageUI;
  const api=window.KaretaApiClient;
  if(!ui||!api)throw new Error('Chat page dependencies are required');

  const esc=ui.escHtml;
  const icon=name=>window.KaretaUIIcons?.icon?.(name)||'';
  const state={
    chats:[],activeId:'',messages:[],contacts:[],contactsLoading:false,contactsOpen:false,
    contactQuery:'',listQuery:'',listFilter:'all',loading:true,messageLoading:false,error:'',
    pollTimer:0,listPollTimer:0,realtimeTimer:0,userPinnedToBottom:true,chatsRequest:0,
    messagesRequest:0,refreshing:false,disposed:false,scope:0,replyTo:null,editing:null,
    messageSearchOpen:false,messageQuery:'',messageMatchIndex:0,sendStatus:'',
  };

  function currentUserId(){return Number(window.KaretaNext?.state?.user?.id||window.KaretaRoleAccess?.currentUser?.()?.id||0);}
  function currentRole(){return String(window.KaretaNavigationCore?.interfaceRole?.()||document.documentElement.dataset.userRole||window.KaretaRoleAccess?.currentRole?.()||window.KaretaNext?.state?.user?.role||'client').trim().toLowerCase();}
  function currentScope(){return state.scope;}
  function isCurrent(scope){return !state.disposed&&scope===state.scope;}
  function roleCopy(){
    const role=currentRole();
    if(role==='master')return {title:'Чаты мастера',text:'Клиенты и СТО по назначенным ремонтам.',empty:'Диалог появится после назначения или записи клиента.',action:'#/orders/new',actionLabel:'Записать клиента'};
    if(role==='sto')return {title:'Чаты СТО',text:'Клиенты и мастера вашего автосервиса по заказам.',empty:'Диалог появится после создания заказа или назначения мастера.',action:'#/orders',actionLabel:'Открыть заказы'};
    if(role==='seller')return {title:'Чаты продавца',text:'Покупатели и СТО по товарам и заказам.',empty:'Диалог появится после запроса по товару или заказу.',action:'#/parts',actionLabel:'Открыть товары'};
    if(role==='admin'||role==='owner')return {title:'Все чаты',text:'Рабочая переписка пользователей платформы.',empty:'Активных диалогов пока нет.',action:'#/orders',actionLabel:'Открыть заказы'};
    return {title:'Чаты',text:'Переписка с мастерами и СТО по вашим заявкам.',empty:'Чат создаётся автоматически после заявки или назначения исполнителя.',action:'#/orders/new',actionLabel:'Создать заявку'};
  }
  function unread(chat){const participant=Number(chat?.participantUnread);return Number.isFinite(participant)?participant:Number(chat?.unread?.[currentRole()]??0);}
  function uniqueMessages(rows){const map=new Map();for(const row of Array.isArray(rows)?rows:[]){const key=String(row?.id||row?.clientMessageId||'');if(key)map.set(key,row);}return [...map.values()];}
  function clearChatUnread(chat){if(!chat)return;chat.participantUnread=0;if(chat.unread)chat.unread[currentRole()]=0;}
  function publishUnread(){const total=state.chats.reduce((sum,chat)=>sum+unread(chat),0);window.dispatchEvent(new CustomEvent('kareta:chat-unread',{detail:{count:total,role:currentRole()}}));}
  function deliveryLabel(msg){return msg?.deliveryStatus==='read'?'Прочитано':'Доставлено';}
  function peer(chat){
    if(chat?.peerName)return chat.peerName;
    const role=currentRole();
    if(role==='client')return chat.masterName||chat.stoName||'Сервис KARETA.KZ';
    if(role==='sto')return chat.clientName||chat.masterName||'Участник заказа';
    if(role==='seller')return chat.clientName||chat.stoName||'Покупатель';
    if(role==='master')return chat.clientName||chat.stoName||'Клиент';
    return chat.clientName||chat.masterName||chat.stoName||chat.peerName||'Участник';
  }
  function initials(value){return String(value||'K').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();}
  function roleLabel(role){return ({client:'Клиент',master:'Мастер',sto:'СТО',seller:'Продавец',admin:'Администратор',owner:'Владелец',guest:'Гость'})[role]||'Пользователь';}
  function chatMemoryKey(){const snapshot=window.KaretaIdentity?.snapshot?.()||{},contextId=String(snapshot.context?.id||snapshot.currentContext?.id||snapshot.context?.key||'default');return `kareta.chat.last.${currentRole()}.${contextId}`;}
  function rememberedChatId(){try{return String(sessionStorage.getItem(chatMemoryKey())||'').trim();}catch(_e){return '';}}
  function syncChatHash(id=''){if(!String(location.hash||'').startsWith('#/chats'))return;const hash=id?`#/chats?chatId=${encodeURIComponent(id)}`:'#/chats';if(location.hash===hash)return;try{history.replaceState(null,'',location.pathname+location.search+hash);}catch(_e){location.hash=hash;}}
  function rememberChatId(id){const value=String(id||'').trim();if(!value)return;try{sessionStorage.setItem(chatMemoryKey(),value);}catch(_e){}syncChatHash(value);}
  function messageById(id){return state.messages.find(message=>String(message.id)===String(id))||null;}
  function ownMessage(message){return Number(message?.authorUserId||0)>0&&currentUserId()>0?Number(message.authorUserId)===currentUserId():message?.from===currentRole();}
  function messageSearchText(message){return `${message?.authorName||''} ${message?.text||''} ${message?.fileName||''} ${message?.replyToText||''}`.toLocaleLowerCase('ru');}
  function messageMatches(){const q=state.messageQuery.trim().toLocaleLowerCase('ru');return q?state.messages.filter(message=>messageSearchText(message).includes(q)):[];}
  function currentMatchId(){const matches=messageMatches();if(!matches.length)return '';state.messageMatchIndex=Math.max(0,Math.min(state.messageMatchIndex,matches.length-1));return String(matches[state.messageMatchIndex]?.id||'');}
  function highlighted(value){
    const source=String(value||''),query=state.messageQuery.trim();if(!query)return esc(source);
    const lower=source.toLocaleLowerCase('ru'),needle=query.toLocaleLowerCase('ru');let cursor=0,index=lower.indexOf(needle),html='',count=0;
    while(index>=0&&count<40){html+=esc(source.slice(cursor,index))+`<mark>${esc(source.slice(index,index+query.length))}</mark>`;cursor=index+query.length;index=lower.indexOf(needle,cursor);count+=1;}
    return html+esc(source.slice(cursor));
  }
  function safeSelectorValue(value){return String(value||'').replace(/["\\]/g,'\\$&');}
  function safeAttachmentUrl(value){
    const url=String(value||'').trim();
    if(/^\/api\/chat_attachment\.php\?[A-Za-z0-9%&=_-]+$/i.test(url))return url;
    if(/^\/?uploads\/chat\/[A-Za-z0-9/_-]+\.(?:jpe?g|png|webp|gif|mp4|webm|pdf|txt)$/i.test(url))return url.startsWith('/')?url:'/'+url;
    return '';
  }
  function composerMode(){
    const mode=state.editing||state.replyTo;
    if(!mode)return '';
    const label=state.editing?'Редактирование сообщения':`Ответ: ${mode.author||'сообщение'}`;
    return `<div class="k-chat-composer-mode"><div><strong>${esc(label)}</strong><span>${esc(mode.text||'')}</span></div><button type="button" data-chat-mode-cancel aria-label="Отменить">${icon('close')}</button></div>`;
  }
  function contactsPanel(){
    const q=state.contactQuery.trim().toLowerCase();
    const rows=state.contacts.filter(x=>!q||`${x.name||''} ${x.role||''} ${x.subtitle||''}`.toLowerCase().includes(q));
    return `<dialog class="k-chat-contact-dialog" data-chat-contact-layer><section class="k-chat-contact-sheet"><header><div><span>НОВЫЙ ДИАЛОГ</span><strong>Выберите участника</strong></div><button type="button" data-chat-contact-close aria-label="Закрыть">${icon('close')}</button></header><label class="k-chat-contact-search"><input type="search" data-chat-contact-search placeholder="Поиск по имени или роли" value="${esc(state.contactQuery)}"></label><div class="k-chat-contact-list">${state.contactsLoading?'<div class="k-chat-contact-empty">Загружаем контакты…</div>':rows.length?rows.map(c=>`<button type="button" class="k-chat-contact-row" data-chat-contact-id="${esc(c.id)}"><span class="k-chat-avatar">${esc(c.initials||initials(c.name))}</span><span><strong>${esc(c.name)}</strong><small>${esc(roleLabel(c.role))}${c.subtitle?` · ${esc(c.subtitle)}`:''}</small></span></button>`).join(''):'<div class="k-chat-contact-empty">Подходящих контактов нет</div>'}</div></section></dialog>`;
  }
  function visibleChats(){
    const q=state.listQuery.trim().toLowerCase();
    return state.chats.filter(chat=>{
      if(state.listFilter==='unread'&&unread(chat)<=0)return false;
      if(state.listFilter==='orders'&&chat.chatType==='direct')return false;
      if(state.listFilter==='direct'&&chat.chatType!=='direct')return false;
      return !q||`${peer(chat)} ${chat.orderTitle||''} ${chat.car||''} ${chat.lastMessage||''}`.toLowerCase().includes(q);
    });
  }
  function chatList(){
    if(state.loading)return '<div class="k-chat-empty">Загружаем чаты…</div>';
    if(state.error)return `<div class="k-chat-empty"><strong>Чаты недоступны</strong><span>${esc(state.error)}</span><button class="k-btn k-btn-secondary" data-chat-retry>Повторить</button></div>`;
    if(!state.chats.length){const copy=roleCopy();return `<div class="k-chat-empty"><strong>Диалогов пока нет</strong><span>${esc(copy.empty)}</span><a class="k-btn k-btn-primary" href="${esc(copy.action)}">${esc(copy.actionLabel)}</a></div>`;}
    const chats=visibleChats();
    if(!chats.length)return `<div class="k-chat-empty"><strong>${state.listFilter==='unread'?'Нет непрочитанных':'Ничего не найдено'}</strong><span>${state.listFilter==='unread'?'Все сообщения прочитаны.':'Измените запрос поиска.'}</span></div>`;
    return chats.map(chat=>`<button type="button" class="k-chat-row ${chat.id===state.activeId?'is-active':''}" data-chat-id="${esc(chat.id)}" ${chat.id===state.activeId?'aria-current="true"':''} aria-label="Открыть чат: ${esc(peer(chat))}"><span class="k-chat-avatar">${esc(chat.peerInitials||initials(peer(chat)))}</span><span class="k-chat-row-body"><strong>${esc(peer(chat))}</strong><small>${esc(chat.orderTitle||chat.car||(chat.chatType==='direct'?'Личный диалог':'Диалог по заявке'))}</small><em>${esc(chat.lastMessage||'Откройте чат')}</em></span><span class="k-chat-row-side"><time>${esc(chat.lastTime||'')}</time>${unread(chat)>0?`<b aria-label="Непрочитанных: ${unread(chat)}">${unread(chat)}</b>`:''}</span></button>`).join('');
  }
  function messageAttachment(message){
    const href=safeAttachmentUrl(message.fileUrl||message.fileData||'');
    if(!href)return '';
    if(message.type==='image')return `<a class="k-chat-image" href="${esc(href)}" target="_blank" rel="noopener"><img src="${esc(href)}" alt="${esc(message.fileName||'Изображение')}"></a>`;
    return `<a class="k-chat-file" href="${esc(href)}" target="_blank" rel="noopener">${icon('document')}${esc(message.fileName||'Открыть файл')}</a>`;
  }
  function messageList(){
    if(!state.activeId)return '<div class="k-chat-placeholder"><strong>Выберите диалог</strong><span>Сообщения по заявке будут показаны здесь.</span></div>';
    if(state.messageLoading)return '<div class="k-chat-placeholder">Загружаем сообщения…</div>';
    if(!state.messages.length)return '<div class="k-chat-placeholder"><strong>Сообщений пока нет</strong><span>Напишите первое сообщение по заявке.</span></div>';
    const matches=messageMatches(),matchIds=new Set(matches.map(message=>String(message.id))),activeMatch=currentMatchId();
    return state.messages.map(message=>{
      const own=ownMessage(message);
      const isEvent=message.type==='event';
      const author=message.authorName||(message.from==='client'?'Клиент':message.from==='master'?'Мастер':message.from==='sto'?'СТО':message.from==='seller'?'Продавец':message.from==='admin'?'Администратор':'Система');
      const canReply=!isEvent&&message.type!=='deleted';
      const canEdit=own&&message.type==='text'&&!message.deletedAt;
      const actions=canReply||canEdit?`<div class="k-chat-message-actions">${canReply?`<button type="button" data-chat-reply="${esc(message.id)}" aria-label="Ответить" title="Ответить">${icon('comment')}</button>`:''}${canEdit?`<button type="button" data-chat-edit="${esc(message.id)}" aria-label="Редактировать" title="Редактировать">${icon('edit')}</button>`:''}</div>`:'';
      const quote=message.replyToId?`<button type="button" class="k-chat-reply-quote" data-chat-jump="${esc(message.replyToId)}"><strong>${esc(message.replyToAuthor||'Ответ')}</strong><span>${esc(message.replyToText||'Сообщение')}</span></button>`:'';
      const metadata=['stage','report'].includes(message.type)?`<span class="k-chat-message-kind">${message.type==='stage'?'Этап ремонта':'Отчёт'}</span>`:'';
      const messageId=String(message.id||''),searchClass=matchIds.has(messageId)?' is-search-match':'',currentClass=activeMatch===messageId?' is-current-match':'';
      return `<article class="k-chat-message ${own?'is-own':''} ${isEvent?'is-event':''}${searchClass}${currentClass}" data-message-id="${esc(message.id)}" tabindex="-1">${actions}<div>${message.type!=='event'?`<small>${esc(own?'Вы':author)}</small>`:''}${quote}${metadata}<p>${highlighted(message.text||'')}</p>${messageAttachment(message)}<footer>${message.editedAt?'<span class="k-chat-edited">изменено</span>':''}<time>${esc(message.time||'')}</time>${own&&!isEvent?`<span class="k-chat-delivery ${message.deliveryStatus==='read'?'is-read':''}">${deliveryLabel(message)}</span>`:''}</footer></div></article>`;
    }).join('');
  }
  function activeChat(){return state.chats.find(x=>x.id===state.activeId)||null;}
  function syncMessageSearch(root){
    const panel=root?.querySelector?.('[data-chat-message-search]');if(!panel)return;
    panel.hidden=!state.messageSearchOpen||!state.activeId;
    const input=panel.querySelector('[data-chat-message-search-input]');if(input&&document.activeElement!==input)input.value=state.messageQuery;
    const matches=messageMatches(),counter=panel.querySelector('[data-chat-search-counter]');
    if(counter)counter.textContent=state.messageQuery.trim()?(matches.length?`${state.messageMatchIndex+1} из ${matches.length}`:'Нет совпадений'):'Введите запрос';
    panel.querySelectorAll('[data-chat-search-prev],[data-chat-search-next]').forEach(button=>button.disabled=!matches.length);
  }
  function focusMessageSearch(select=false){requestAnimationFrame(()=>{const input=document.querySelector('[data-chat-message-search-input]');input?.focus();if(select)input?.select();});}
  function jumpMessageSearch(step=1){
    const matches=messageMatches();if(!matches.length)return;
    state.messageMatchIndex=(state.messageMatchIndex+step+matches.length)%matches.length;state.userPinnedToBottom=false;paint();
    requestAnimationFrame(()=>{const id=currentMatchId(),node=document.querySelector(`[data-message-id="${safeSelectorValue(id)}"]`);node?.scrollIntoView({behavior:'smooth',block:'center'});node?.focus?.({preventScroll:true});focusMessageSearch();});
  }
  function closeMessageSearch(){state.messageSearchOpen=false;state.messageQuery='';state.messageMatchIndex=0;paint();document.querySelector('[data-chat-search-toggle]')?.focus();}
  function paint(){
    const root=document.querySelector('.k-chat-layout');
    const list=root?.querySelector('[data-chat-list]');
    const thread=root?.querySelector('[data-chat-thread]');
    const head=root?.querySelector('[data-chat-head]');
    const form=root?.querySelector('[data-chat-form]');
    if(list)list.innerHTML=chatList();
    if(thread){const stick=(state.userPinnedToBottom||state.messageLoading)&&!state.messageSearchOpen;thread.innerHTML=messageList();if(stick)requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight;state.userPinnedToBottom=true;});}
    const chat=activeChat();
    if(head){
      const profileHref=chat?String(chat.peerProfileUrl||''):'';
      head.innerHTML=chat?`<button class="k-chat-mobile-back" type="button" data-chat-mobile-back aria-label="Вернуться к списку чатов">${icon('chevronLeft')}</button><span class="k-chat-head-avatar">${esc(chat.peerInitials||initials(peer(chat)))}</span><div class="k-chat-head-copy"><strong>${esc(peer(chat))}</strong><span>${esc(chat.orderTitle||chat.car||'Диалог по заявке')}</span></div><div class="k-chat-head-actions">${profileHref?`<a href="${profileHref}" class="k-chat-head-link">Профиль</a>`:''}${chat.orderId?`<a href="#/orders/item/${encodeURIComponent(chat.orderId)}" class="k-chat-head-link">Заказ</a>`:''}<button type="button" data-chat-search-toggle aria-label="Поиск в переписке" aria-pressed="${state.messageSearchOpen?'true':'false'}" title="Поиск в переписке">${icon('search')}</button></div>`:'<div class="k-chat-head-empty"><strong>Выберите диалог</strong><span>${esc(roleLabel(currentRole()))}</span></div>';
    }
    if(form){form.hidden=!chat;const mode=form.querySelector('[data-chat-composer-mode]');if(mode)mode.innerHTML=composerMode();const status=form.querySelector('[data-chat-send-status]');if(status){status.textContent=state.sendStatus;status.hidden=!state.sendStatus;}}
    const unreadSummary=root?.querySelector('[data-chat-unread-summary]');if(unreadSummary){const total=state.chats.reduce((sum,item)=>sum+unread(item),0);unreadSummary.textContent=total?`${total} непрочит.`:'Все прочитано';}
    root?.classList.toggle('has-active',!!chat);
    syncMessageSearch(root);
    const contactDialog=document.querySelector('[data-chat-contact-layer]');
    if(contactDialog){
      const q=state.contactQuery.trim().toLowerCase();
      const rows=state.contacts.filter(x=>!q||`${x.name||''} ${x.role||''} ${x.subtitle||''}`.toLowerCase().includes(q));
      const list=contactDialog.querySelector('.k-chat-contact-list');
      if(list)list.innerHTML=state.contactsLoading?'<div class="k-chat-contact-empty">Загружаем контакты…</div>':rows.length?rows.map(c=>`<button type="button" class="k-chat-contact-row" data-chat-contact-id="${esc(c.id)}"><span class="k-chat-avatar">${esc(c.initials||initials(c.name))}</span><span><strong>${esc(c.name)}</strong><small>${esc(roleLabel(c.role))}${c.subtitle?` · ${esc(c.subtitle)}`:''}</small></span></button>`).join(''):'<div class="k-chat-contact-empty">Подходящих контактов нет</div>';
      const search=contactDialog.querySelector('[data-chat-contact-search]');if(search&&document.activeElement!==search)search.value=state.contactQuery;
    }
  }
  function renderChats(context){
    const copy=roleCopy();
    return ui.pageShell(context,copy.title,copy.text,`<section class="k-chat-layout k-chat-layout-r78" data-chat-role="${esc(currentRole())}">
      <aside class="k-chat-sidebar">
        <div class="k-chat-sidebar-head"><div><span>СООБЩЕНИЯ</span><strong>${esc(copy.title)}</strong><small data-chat-unread-summary>Все прочитано</small></div><button type="button" class="k-chat-new" data-chat-new aria-label="Создать чат">${icon('plus')}</button></div>
        <label class="k-chat-list-search"><span class="k-visually-hidden">Поиск по чатам</span><span class="k-chat-search-icon">${icon('search')}</span><input type="search" data-chat-list-search placeholder="Поиск" value="${esc(state.listQuery)}"></label>
        <div class="k-chat-filters" role="group" aria-label="Фильтр чатов"><button type="button" data-chat-filter="all" class="${state.listFilter==='all'?'is-active':''}" aria-pressed="${state.listFilter==='all'?'true':'false'}">Все</button><button type="button" data-chat-filter="unread" class="${state.listFilter==='unread'?'is-active':''}" aria-pressed="${state.listFilter==='unread'?'true':'false'}">Новые</button><button type="button" data-chat-filter="orders" class="${state.listFilter==='orders'?'is-active':''}" aria-pressed="${state.listFilter==='orders'?'true':'false'}">Заказы</button><button type="button" data-chat-filter="direct" class="${state.listFilter==='direct'?'is-active':''}" aria-pressed="${state.listFilter==='direct'?'true':'false'}">Личные</button></div>
        <div class="k-chat-list" data-chat-list aria-label="Список чатов"></div>
      </aside>
      <section class="k-chat-main">
        <header class="k-chat-head" data-chat-head></header>
        <div class="k-chat-message-search" data-chat-message-search hidden><label><span class="k-visually-hidden">Поиск в переписке</span><input type="search" data-chat-message-search-input placeholder="Поиск в переписке" autocomplete="off"></label><output data-chat-search-counter aria-live="polite">Введите запрос</output><button type="button" data-chat-search-prev aria-label="Предыдущее совпадение">↑</button><button type="button" data-chat-search-next aria-label="Следующее совпадение">↓</button><button type="button" data-chat-search-close aria-label="Закрыть поиск">${icon('close')}</button></div>
        <div class="k-chat-thread" data-chat-thread role="log" aria-live="polite" aria-relevant="additions text" aria-label="Сообщения переписки"></div>
        <form class="k-chat-composer k-chat-composer-r78" data-chat-form hidden>
          <div class="k-chat-compose-main"><div data-chat-composer-mode></div><label class="k-visually-hidden" for="k-chat-message-text">Сообщение</label><textarea id="k-chat-message-text" name="text" rows="1" maxlength="4000" placeholder="Сообщение"></textarea><div class="k-chat-attachment-preview" data-chat-attachment-preview hidden></div></div>
          <label class="k-chat-attach" title="Прикрепить файл" aria-label="Прикрепить файл"><input type="file" name="attachment" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden>${icon('image')}</label>
          <button class="k-chat-send" type="submit" aria-label="Отправить сообщение" title="Отправить">${icon('send')}</button>
          <div class="k-chat-send-status" data-chat-send-status role="status" aria-live="polite" hidden></div>
        </form>
      </section>
    </section>${contactsPanel()}`,{page:'chats',eyebrow:'СООБЩЕНИЯ',chromeHeader:false});
  }
  async function loadChats(options={}){
    const quiet=!!options.quiet,request=++state.chatsRequest,scope=currentScope();
    if(!quiet){state.loading=true;state.error='';paint();}
    const result=await api.getChats({cacheTtlMs:0,dedupe:false,force:true});
    if(!isCurrent(scope)||request!==state.chatsRequest)return;
    state.loading=false;
    if(!result.ok){if(!quiet){state.error=result.payload?.message||result.payload?.error||'Не удалось загрузить чаты';paint();}return;}
    state.error='';state.chats=Array.isArray(result.payload?.chats)?result.payload.chats:[];
    if(state.activeId&&!state.chats.some(chat=>chat.id===state.activeId)){state.activeId='';state.messages=[];state.replyTo=null;state.editing=null;syncChatHash('');}
    publishUnread();paint();
  }
  async function openChat(id){
    const request=++state.messagesRequest,scope=currentScope();
    state.activeId=id;rememberChatId(id);state.messageLoading=true;state.userPinnedToBottom=true;state.replyTo=null;state.editing=null;state.messageSearchOpen=false;state.messageQuery='';state.messageMatchIndex=0;paint();
    const result=await api.getMessages(id,{cacheTtlMs:0,dedupe:false,force:true});
    if(!isCurrent(scope)||request!==state.messagesRequest||state.activeId!==id)return;
    state.messageLoading=false;
    if(!result.ok){state.messages=[];state.error=result.payload?.message||'Не удалось загрузить сообщения';paint();return;}
    state.messages=uniqueMessages(result.payload?.messages);
    const marked=await api.markChatRead(id,currentRole()).catch(()=>null);
    if(!isCurrent(scope)||state.activeId!==id)return;
    if(marked?.ok!==false)clearChatUnread(state.chats.find(item=>item.id===id));
    publishUnread();paint();
  }
  async function refreshActiveChat(){
    if(!state.activeId||document.hidden||state.refreshing||state.disposed)return;
    state.refreshing=true;const id=state.activeId,scope=currentScope();
    try{
      const result=await api.getMessages(id,{cacheTtlMs:0,dedupe:false,force:true});
      if(!result.ok||!isCurrent(scope)||state.activeId!==id)return;
      const next=uniqueMessages(result.payload?.messages);
      const signature=JSON.stringify(next.map(message=>[message.id,message.text,message.deliveryStatus,message.editedAt,message.deletedAt]));
      const current=JSON.stringify(state.messages.map(message=>[message.id,message.text,message.deliveryStatus,message.editedAt,message.deletedAt]));
      if(signature!==current){state.messages=next;paint();}
      const marked=await api.markChatRead(id,currentRole()).catch(()=>null);
      if(isCurrent(scope)&&marked?.ok!==false){clearChatUnread(state.chats.find(item=>item.id===id));publishUnread();}
    }finally{if(isCurrent(scope))state.refreshing=false;}
  }
  async function openContacts(){
    const scope=currentScope();state.contactsOpen=true;state.contactsLoading=true;paint();
    const dialog=document.querySelector('[data-chat-contact-layer]');if(dialog&&!dialog.open)dialog.showModal();
    const result=await api.getChatContacts();if(!isCurrent(scope))return;
    state.contactsLoading=false;state.contacts=Array.isArray(result.payload?.contacts)?result.payload.contacts:[];paint();
    setTimeout(()=>{if(isCurrent(scope))document.querySelector('[data-chat-contact-search]')?.focus();},0);
  }
  function closeContacts(){state.contactsOpen=false;state.contactQuery='';const dialog=document.querySelector('[data-chat-contact-layer]');if(dialog?.open)dialog.close();paint();}
  function requestedChatTarget(){
    const raw=String(location.hash||''),query=raw.includes('?')?raw.slice(raw.indexOf('?')+1):'';
    if(!query)return null;
    const params=new URLSearchParams(query),chatId=String(params.get('chatId')||'').trim(),userId=Number(params.get('userId')||0),masterId=String(params.get('masterId')||'').trim(),stoId=String(params.get('stoId')||'').trim();
    if(chatId)return {chatId};if(userId>0)return {userId};if(masterId)return {masterId};if(stoId)return {stoId};return null;
  }
  async function createDirect(target){
    const scope=currentScope(),payload=target&&typeof target==='object'?target:{userId:Number(target)};
    const result=await api.openDirectChat(payload);
    if(!isCurrent(scope))return false;
    if(!result.ok){window.KaretaToast?.error(result.payload?.message||'Не удалось открыть чат');return false;}
    closeContacts();await loadChats();if(!isCurrent(scope))return false;
    const id=result.payload?.chat?.id;if(id)await openChat(id);return !!id;
  }
  function startReply(message){state.editing=null;state.replyTo={id:message.id,text:String(message.text||message.fileName||'Вложение').slice(0,180),author:ownMessage(message)?'Вы':message.authorName||roleLabel(message.from)};paint();document.querySelector('[data-chat-form] textarea')?.focus();}
  function startEdit(message){state.replyTo=null;state.editing={id:message.id,text:String(message.text||'')};paint();const textarea=document.querySelector('[data-chat-form] textarea');if(textarea){textarea.value=message.text||'';textarea.focus();textarea.setSelectionRange(textarea.value.length,textarea.value.length);}}
  function cancelComposerMode(clearText=false){state.replyTo=null;state.editing=null;const textarea=document.querySelector('[data-chat-form] textarea');if(clearText&&textarea)textarea.value='';paint();}
  function mountChats(context={}){
    const root=document.querySelector('.k-chat-layout');if(!root)return;
    if(root.dataset.chatMounted==='1'){
      window.KaretaRuntimeLog?.add?.('chat.mount.skipped',{reason:'already_mounted',scope:state.scope},'warn');
      return;
    }
    root.dataset.chatMounted='1';
    state.scope+=1;const scope=state.scope;
    Object.assign(state,{chats:[],activeId:'',messages:[],contacts:[],contactsOpen:false,contactQuery:'',listQuery:'',listFilter:'all',loading:true,messageLoading:false,error:'',userPinnedToBottom:true,disposed:false,refreshing:false,chatsRequest:0,messagesRequest:0,replyTo:null,editing:null,messageSearchOpen:false,messageQuery:'',messageMatchIndex:0,sendStatus:''});
    const pageRoot=root.closest('.k-page')||document;
    let attachment=null;
    const clearAttachment=()=>{attachment=null;const preview=root.querySelector('[data-chat-attachment-preview]');if(preview){preview.hidden=true;preview.innerHTML='';}const input=root.querySelector('[data-chat-form] input[type=file]');if(input)input.value='';};
    const click=event=>{
      const row=event.target.closest('[data-chat-id]');if(row){openChat(row.dataset.chatId);return;}
      const contact=event.target.closest('[data-chat-contact-id]');if(contact){createDirect(contact.dataset.chatContactId);return;}
      const filter=event.target.closest('[data-chat-filter]');if(filter){state.listFilter=filter.dataset.chatFilter||'all';pageRoot.querySelectorAll('[data-chat-filter]').forEach(button=>{const active=button===filter;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',active?'true':'false');});const list=root.querySelector('[data-chat-list]');if(list)list.innerHTML=chatList();return;}
      const reply=event.target.closest('[data-chat-reply]');if(reply){const message=messageById(reply.dataset.chatReply);if(message)startReply(message);return;}
      const edit=event.target.closest('[data-chat-edit]');if(edit){const message=messageById(edit.dataset.chatEdit);if(message&&ownMessage(message))startEdit(message);return;}
      const jump=event.target.closest('[data-chat-jump]');if(jump){const node=root.querySelector(`[data-message-id="${safeSelectorValue(jump.dataset.chatJump||'')}"]`);node?.scrollIntoView({behavior:'smooth',block:'center'});node?.classList.add('is-highlighted');node?.focus?.({preventScroll:true});setTimeout(()=>node?.classList.remove('is-highlighted'),1300);return;}
      if(event.target.closest('[data-chat-search-toggle]')){state.messageSearchOpen=!state.messageSearchOpen;if(!state.messageSearchOpen){state.messageQuery='';state.messageMatchIndex=0;}paint();if(state.messageSearchOpen)focusMessageSearch(true);return;}
      if(event.target.closest('[data-chat-search-close]')){closeMessageSearch();return;}
      if(event.target.closest('[data-chat-search-prev]')){jumpMessageSearch(-1);return;}
      if(event.target.closest('[data-chat-search-next]')){jumpMessageSearch(1);return;}
      if(event.target.closest('[data-chat-mode-cancel]')){cancelComposerMode(state.editing!==null);return;}
      if(event.target.closest('[data-chat-attachment-clear]')){clearAttachment();return;}
      if(event.target.closest('[data-chat-new]')){openContacts();return;}
      if(event.target.closest('[data-chat-contact-close]')){closeContacts();return;}
      if(event.target.closest('[data-chat-retry]')){state.error='';loadChats();return;}
      if(event.target.closest('[data-chat-mobile-back]')){state.activeId='';state.messages=[];state.replyTo=null;state.editing=null;state.messageSearchOpen=false;state.messageQuery='';state.messageMatchIndex=0;syncChatHash('');paint();}
    };
    const change=async event=>{
      const input=event.target.closest('[data-chat-form] input[type=file]');if(!input)return;
      const file=input.files?.[0];if(!file)return clearAttachment();
      const max=2.5*1024*1024;if(file.size>max){window.KaretaToast?.error('Файл слишком большой. Максимум 2,5 МБ.');return clearAttachment();}
      const mime=String(file.type||'').toLowerCase(),allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mpeg','application/pdf','text/plain'].includes(mime);
      if(!allowed){window.KaretaToast?.error('Этот тип файла не поддерживается.');return clearAttachment();}
      state.sendStatus='Подготавливаем файл…';paint();
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file);}).catch(()=>'');
      if(!isCurrent(scope))return;if(!data){state.sendStatus='Не удалось подготовить файл.';paint();window.KaretaToast?.error('Не удалось прочитать файл.');return clearAttachment();}
      attachment={fileName:file.name,fileType:file.type||'application/octet-stream',fileData:data,fileSize:file.size};
      state.sendStatus='';paint();
      const preview=root.querySelector('[data-chat-attachment-preview]');if(preview){preview.hidden=false;preview.innerHTML=`<span>${esc(file.name)} · ${Math.max(1,Math.round(file.size/1024))} КБ</span><button type="button" data-chat-attachment-clear aria-label="Удалить файл">${icon('close')}</button>`;}
    };
    const submit=async event=>{
      const form=event.target.closest('[data-chat-form]');if(!form)return;event.preventDefault();
      const text=String(new FormData(form).get('text')||'').trim();if((!text&&!attachment)||!state.activeId)return;
      const button=form.querySelector('button[type=submit]');button.disabled=true;button.setAttribute('aria-busy','true');state.sendStatus=state.editing?'Сохраняем изменения…':'Отправляем сообщение…';paint();
      const chatId=state.activeId,editing=state.editing,reply=state.replyTo;
      let result;
      try{
        if(editing){result=await api.updateMessage(chatId,editing.id,text);}
        else{
          const type=attachment?(String(attachment.fileType).startsWith('image/')?'image':String(attachment.fileType).startsWith('video/')?'video':'file'):'text';
          const payload={id:`msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,clientMessageId:`web_${Date.now()}_${Math.random().toString(16).slice(2)}`,from:currentRole(),type,text:text||attachment?.fileName||'Файл',time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),...(attachment||{}),...(reply?{replyToId:reply.id,replyToText:reply.text,replyToAuthor:reply.author}:{})};
          result=await api.sendMessage(chatId,payload);
        }
      }catch(error){result={ok:false,payload:{message:error?.message||'Ошибка сети'}};
      }finally{if(isCurrent(scope)){button.disabled=false;button.removeAttribute('aria-busy');}}
      if(!isCurrent(scope))return;
      if(!result?.ok){state.sendStatus='Не отправлено. Проверьте соединение и повторите.';paint();window.KaretaToast?.error(result?.payload?.message||(editing?'Сообщение не изменено':'Сообщение не отправлено'));return;}
      form.reset();clearAttachment();state.replyTo=null;state.editing=null;state.sendStatus='';await openChat(chatId);loadChats({quiet:true});
    };
    const inputHandler=event=>{
      if(event.target.matches('[data-chat-list-search]')){state.listQuery=event.target.value;const list=root.querySelector('[data-chat-list]');if(list)list.innerHTML=chatList();return;}
      if(event.target.matches('[data-chat-message-search-input]')){const position=event.target.selectionStart||0;state.messageQuery=event.target.value;state.messageMatchIndex=0;state.userPinnedToBottom=false;paint();requestAnimationFrame(()=>{const input=root.querySelector('[data-chat-message-search-input]');input?.focus();input?.setSelectionRange(position,position);});return;}
      if(event.target.matches('[data-chat-contact-search]')){state.contactQuery=event.target.value;const list=document.querySelector('.k-chat-contact-list');if(list){const q=state.contactQuery.trim().toLowerCase(),rows=state.contacts.filter(item=>!q||`${item.name||''} ${item.role||''} ${item.subtitle||''}`.toLowerCase().includes(q));list.innerHTML=rows.length?rows.map(contact=>`<button type="button" class="k-chat-contact-row" data-chat-contact-id="${esc(contact.id)}"><span class="k-chat-avatar">${esc(contact.initials||initials(contact.name))}</span><span><strong>${esc(contact.name)}</strong><small>${esc(roleLabel(contact.role))}${contact.subtitle?` · ${esc(contact.subtitle)}`:''}</small></span></button>`).join(''):'<div class="k-chat-contact-empty">Подходящих контактов нет</div>';}return;}
      if(event.target.matches('[data-chat-form] textarea')){event.target.style.height='auto';event.target.style.height=Math.min(event.target.scrollHeight,140)+'px';}
    };
    const keydown=event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'&&state.activeId){event.preventDefault();state.messageSearchOpen=true;paint();focusMessageSearch(true);return;}
      if(event.target.matches('[data-chat-message-search-input]')&&event.key==='Enter'){event.preventDefault();jumpMessageSearch(event.shiftKey?-1:1);return;}
      if(event.target.matches('[data-chat-form] textarea')&&event.key==='Enter'&&!event.shiftKey){event.preventDefault();event.target.closest('form')?.requestSubmit();return;}
      if(event.key==='Escape'){if(state.contactsOpen)closeContacts();else if(state.messageSearchOpen)closeMessageSearch();else if(state.replyTo||state.editing)cancelComposerMode(state.editing!==null);}
    };
    const scroll=event=>{if(event.target.matches('[data-chat-thread]'))state.userPinnedToBottom=(event.target.scrollHeight-event.target.scrollTop-event.target.clientHeight)<80;};
    const contactDialog=root.parentElement?.querySelector?.('[data-chat-contact-layer]')||document.querySelector('[data-chat-contact-layer]');const contactCancel=event=>{event.preventDefault();closeContacts();};contactDialog?.addEventListener('cancel',contactCancel);
    const realtime=event=>{const payload=event.detail?.event||{};if(payload.eventType!=='message.new'&&payload.entityType!=='chat')return;window.clearTimeout(state.realtimeTimer);state.realtimeTimer=window.setTimeout(()=>{if(!isCurrent(scope))return;loadChats({quiet:true});if(!payload.entityId||String(payload.entityId)===String(state.activeId))refreshActiveChat();},120);};
    pageRoot.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('submit',submit);pageRoot.addEventListener('input',inputHandler);pageRoot.addEventListener('keydown',keydown);root.addEventListener('scroll',scroll,true);window.addEventListener('kareta:realtime:event',realtime);
    state.pollTimer=window.setInterval(refreshActiveChat,6000);state.listPollTimer=window.setInterval(()=>{if(!document.hidden)loadChats({quiet:true});},12000);
    context.lifecycle?.addCleanup?.(()=>{pageRoot.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('submit',submit);pageRoot.removeEventListener('input',inputHandler);pageRoot.removeEventListener('keydown',keydown);root.removeEventListener('scroll',scroll,true);window.removeEventListener('kareta:realtime:event',realtime);contactDialog?.removeEventListener('cancel',contactCancel);try{if(contactDialog?.open)contactDialog.close();}catch(_e){}delete root.dataset.chatMounted;state.disposed=true;state.scope+=1;state.chatsRequest+=1;state.messagesRequest+=1;window.clearInterval(state.pollTimer);window.clearInterval(state.listPollTimer);window.clearTimeout(state.realtimeTimer);state.pollTimer=0;state.listPollTimer=0;state.realtimeTimer=0;clearAttachment();});
    loadChats().then?.(async()=>{
      if(!isCurrent(scope))return;
      const target=requestedChatTarget();
      if(target){try{sessionStorage.removeItem('kareta.chat.open');}catch(_error){}}
      if(target?.chatId){
        const exists=state.chats.some(chat=>String(chat.id)===String(target.chatId));
        if(exists){await openChat(target.chatId);return;}
        syncChatHash('');window.KaretaToast?.error?.('Чат не найден или у вас нет доступа');return;
      }
      if(target){await createDirect(target);return;}
      try{
        const desired=String(sessionStorage.getItem('kareta.chat.open')||'').trim();
        if(desired){
          sessionStorage.removeItem('kareta.chat.open');
          if(state.chats.some(chat=>String(chat.id)===desired)){await openChat(desired);return;}
        }
      }catch(_error){}
      const desktop=window.matchMedia?.('(min-width:761px)')?.matches===true;
      if(desktop){
        const remembered=rememberedChatId();
        const rememberedExists=remembered&&state.chats.some(chat=>String(chat.id)===remembered);
        const nextId=rememberedExists?remembered:String(state.chats.find(chat=>unread(chat)>0)?.id||state.chats[0]?.id||'');
        if(nextId)await openChat(nextId);
      }
    });
    try{const draft=sessionStorage.getItem('kareta.chat.prefill')||'',textarea=root.querySelector('[data-chat-form] textarea');if(draft&&textarea){textarea.value=draft;sessionStorage.removeItem('kareta.chat.prefill');}}catch(_error){}
  }

  window.KaretaChatsPages=Object.freeze({renderChats,mountChats});
})();
