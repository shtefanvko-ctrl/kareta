(function(){
  'use strict';
  const RELEASE=String(window.KARETA_NEXT_ASSET_VERSION||'dev');
  const CFG=window.KARETA_REALTIME_CONFIG||{};
  const TRANSPORT=String(CFG.transport||'poll').toLowerCase()==='sse'?'sse':'poll';
  const POLL_INTERVAL_MS=Math.max(10000,Number(CFG.pollIntervalMs||15000));
  const FAILURE_BASE_MS=Math.max(5000,Number(CFG.failureBaseMs||10000));
  const FAILURE_MAX_MS=Math.max(30000,Number(CFG.failureMaxMs||60000));
  // Historical release markers for regression tests only; runtime uses KARETA_NEXT_ASSET_VERSION above.
  // 20260806-r188555-runtime-dependency-bootstrap-r188556-security-hardening-r1885561-atomic-runtime-bootstrap-r1885562-identity-db-recovery-r1885563-migration98-onboarding-recovery-r1885564-fk-detach-schema-recovery-r1885565-serialized-schema-index-recovery-r1885566-test-otp-transport-recovery-r1885567-otp-length-resend-cooldown-r1885568-mobile-two-column-grids-r1885569-smart-action-account-r1885570-account-type-catalog-requests-r1885571-test-auto-approval-service-catalog-recovery-r1885572-private-db-config-recovery-r1885573-temporary-account-type-auto-activation-r1885574-home-service-category-grid-r1885575-profile-legacy-id-mobile-nav-recovery-r1885576-master-work-surfaces-r1885577-master-business-runtime-r1885578-master-order-full-lifecycle
  const CLIENT_KEY='kareta.realtime.client';
  const LEADER_KEY='kareta.realtime.leader';
  const LEADER_TTL=15000;
  const clientId=sessionStorage.getItem(CLIENT_KEY)||`rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  sessionStorage.setItem(CLIENT_KEY,clientId);

  let source=null,pollTimer=0,reconnectTimer=0,leaderTimer=0,started=false,mode='idle',failures=0,userId=0,contextId=0,contextRevision=0,lastDelivered=0;
  const channel=('BroadcastChannel' in window)?new BroadcastChannel('kareta-realtime'):null;
  const cursorKey=()=>`kareta.realtime.cursor.${userId||'anonymous'}.${contextId||'legacy'}`;
  const cursor=()=>Math.max(0,Number(localStorage.getItem(cursorKey())||0));
  const setCursor=id=>{id=Number(id||0);if(id>cursor())localStorage.setItem(cursorKey(),String(id));};

  const readLeader=()=>{try{return JSON.parse(localStorage.getItem(LEADER_KEY)||'null');}catch(_e){return null;}};
  const leaderAlive=leader=>leader&&Number(leader.userId)===userId&&Number(leader.contextId||0)===contextId&&Number(leader.expiresAt)>Date.now();
  const isLeader=()=>{const leader=readLeader();return leaderAlive(leader)&&leader.clientId===clientId;};
  const claimLeadership=()=>{
    if(!started||!userId)return false;
    const current=readLeader();
    if(leaderAlive(current)&&current.clientId!==clientId)return false;
    const claim={clientId,userId,contextId,expiresAt:Date.now()+LEADER_TTL};
    localStorage.setItem(LEADER_KEY,JSON.stringify(claim));
    const verified=readLeader();
    return !!verified&&verified.clientId===clientId&&Number(verified.userId)===userId&&Number(verified.contextId||0)===contextId;
  };
  const renewLeadership=()=>{
    clearInterval(leaderTimer);
    leaderTimer=setInterval(()=>{
      if(!started)return;
      if(isLeader()){
        localStorage.setItem(LEADER_KEY,JSON.stringify({clientId,userId,contextId,expiresAt:Date.now()+LEADER_TTL}));
      }else if(!leaderAlive(readLeader())&&claimLeadership()){
        connect();
      }
    },5000);
  };
  const releaseLeadership=()=>{
    clearInterval(leaderTimer);leaderTimer=0;
    const current=readLeader();
    if(current?.clientId===clientId)localStorage.removeItem(LEADER_KEY);
  };

  const ensureIndicator=()=>{if(!document.querySelector('.k-realtime-indicator')){const el=document.createElement('span');el.className='k-realtime-indicator';el.setAttribute('aria-hidden','true');document.body.appendChild(el);}};
  const setStatus=(next,detail={})=>{ensureIndicator();mode=next;document.documentElement.dataset.realtime=next;window.dispatchEvent(new CustomEvent('kareta:realtime:status',{detail:{mode:next,release:RELEASE,...detail}}));};
  const invalidate=event=>{
    const api=window.KaretaApiClient; const type=String(event?.eventType||'');
    api?.invalidate?.('domain'); api?.invalidate?.('notifications');
    if(type.startsWith('booking.')||type.startsWith('calendar.')) api?.invalidate?.('calendar');
    if(type.startsWith('payment.')||type.startsWith('invoice.')||type.startsWith('refund.')) api?.invalidate?.('finance');
    if(type.startsWith('market.')) api?.invalidate?.('market');
    if(type.startsWith('crm.')) api?.invalidate?.('crm');
  };
  const dispatchEvent=(event,detail)=>{
    invalidate(event);
    window.dispatchEvent(new CustomEvent('kareta:realtime:event',{detail}));
    window.dispatchEvent(new CustomEvent(`kareta:realtime:${String(event.eventType||'event').replace(/[^a-zA-Z0-9_.:-]/g,'_')}`,{detail}));
  };
  const deliver=(event,meta={})=>{
    if(!event||!event.id)return;
    const eventId=Number(event.id||0);
    const sourceName=meta.source||mode;
    if(eventId<=lastDelivered)return;
    if(sourceName!=='broadcast'&&eventId<=cursor())return;
    lastDelivered=eventId;setCursor(eventId);
    const detail={event,unreadCount:Number(meta.unreadCount||0),source:sourceName};
    dispatchEvent(event,detail);
    if(sourceName!=='broadcast')channel?.postMessage({type:'event',userId,contextId,detail});
  };
  channel?.addEventListener('message',e=>{
    const msg=e.data||{};
    if(Number(msg.userId||0)!==userId||Number(msg.contextId||0)!==contextId)return;
    if(msg.type==='event')deliver(msg.detail?.event,{...msg.detail,source:'broadcast'});
    if(msg.type==='status'&&!isLeader())setStatus(msg.mode||'idle',{leader:false});
  });

  const stopTransport=()=>{try{source?.close();}catch(_e){}source=null;clearTimeout(pollTimer);clearTimeout(reconnectTimer);pollTimer=reconnectTimer=0;};
  const schedulePoll=ms=>{clearTimeout(pollTimer);if(started&&isLeader())pollTimer=setTimeout(poll,ms);};
  async function poll(){
    if(!started||!isLeader())return;
    if(document.hidden||!navigator.onLine)return schedulePoll(POLL_INTERVAL_MS);
    setStatus('polling');channel?.postMessage({type:'status',userId,contextId,mode:'polling'});
    try{
      const res=await fetch(`/api/realtime.php?mode=poll&cursor=${cursor()}&clientId=${encodeURIComponent(clientId)}`,{credentials:'same-origin',cache:'no-store'});
      if(res.status===401)return stop();
      const json=await res.json();if(!res.ok||!json?.ok)throw new Error('poll_failed');
      const data=json.data||{};(data.events||[]).forEach(e=>deliver(e,{unreadCount:data.unreadCount,source:'poll'}));
      if(Number(data.cursor||0)>cursor())setCursor(data.cursor);failures=0;schedulePoll(POLL_INTERVAL_MS);
    }catch(_e){failures++;setStatus('offline',{failures});schedulePoll(Math.min(FAILURE_MAX_MS,FAILURE_BASE_MS*Math.max(1,failures)));}
  }
  function connect(){
    if(!started||!isLeader()||document.hidden||!navigator.onLine)return;
    stopTransport();
    if(TRANSPORT!=='sse'||!('EventSource' in window))return poll();
    setStatus('connecting');channel?.postMessage({type:'status',userId,contextId,mode:'connecting'});
    source=new EventSource(`/api/realtime.php?cursor=${cursor()}&clientId=${encodeURIComponent(clientId)}`);
    source.addEventListener('open',()=>{failures=0;setStatus('live');channel?.postMessage({type:'status',userId,contextId,mode:'live'});});
    source.addEventListener('domain',e=>{try{const d=JSON.parse(e.data||'{}');deliver(d.event,{unreadCount:d.unreadCount,source:'sse'});}catch(_e){}});
    source.addEventListener('heartbeat',e=>{try{const d=JSON.parse(e.data||'{}');if(Number(d.cursor||0)>cursor())setCursor(d.cursor);setStatus('live',{unreadCount:Number(d.unreadCount||0)});}catch(_e){}});
    source.onerror=()=>{try{source?.close();}catch(_e){}source=null;failures++;if(failures>=2)return poll();setStatus('reconnecting',{failures});reconnectTimer=setTimeout(connect,Math.min(20000,3000*failures));};
  }
  function start(event){
    const identity=window.KaretaIdentity?.snapshot?.()||{};
    // Realtime is context-scoped. Do not open SSE from a temporary legacy PHP
    // session: realtime.php requires a resolved Identity account + context and
    // otherwise responds with an auth/context conflict.
    const nextUserId=Number(identity.account?.id||0);
    const nextContextId=Number(identity.context?.id||0);
    const nextRevision=Number(identity.revision||0);
    if(identity.authenticated!==true||nextUserId<=0||nextContextId<=0){setStatus('waiting',{reason:'identity_context_not_ready'});return;}
    if(started&&userId===nextUserId&&contextId===nextContextId&&contextRevision===nextRevision)return;
    stop();userId=nextUserId;contextId=nextContextId;contextRevision=nextRevision;lastDelivered=0;started=true;failures=0;
    renewLeadership();
    if(claimLeadership())connect();else setStatus('follower',{leader:false,contextId});
  }
  function stop(){started=false;stopTransport();releaseLeadership();userId=0;contextId=0;contextRevision=0;lastDelivered=0;setStatus('idle');}
  document.addEventListener('visibilitychange',()=>{
    if(!started)return;
    if(document.hidden){if(isLeader()){stopTransport();releaseLeadership();}setStatus('idle');}
    else if(isLeader()||claimLeadership())connect();
  });
  window.addEventListener('online',()=>{if(started&&(isLeader()||claimLeadership()))connect();});
  window.addEventListener('offline',()=>{stopTransport();setStatus('offline');});
  window.addEventListener('storage',e=>{if(e.key===LEADER_KEY&&started&&!leaderAlive(readLeader())&&claimLeadership())connect();});
  window.addEventListener('beforeunload',()=>{if(isLeader())releaseLeadership();});
  window.addEventListener('kareta:session-confirmed',start);
  window.addEventListener('kareta:identity-ready',event=>{if(event.detail?.authenticated||window.KaretaIdentity?.snapshot?.()?.authenticated)start(event);});
  window.addEventListener('kareta:session-anonymous',stop);
  window.addEventListener('kareta:context-changed',()=>{const identity=window.KaretaIdentity?.snapshot?.()||{};const next=Number(identity.context?.id||0);const revision=Number(identity.revision||0);if(next===contextId&&revision===contextRevision)return;stopTransport();releaseLeadership();contextId=next;contextRevision=revision;lastDelivered=0;if(started&&userId){setStatus('reconnecting',{reason:'context_changed',contextId});setTimeout(()=>{if(claimLeadership())connect();},50);}});
  
  window.KaretaRealtime=Object.freeze({start,stop,reconnect:()=>{if(isLeader()||claimLeadership())connect();},getState:()=>({started,mode,cursor:cursor(),clientId,userId,contextId,contextRevision,leader:isLeader(),failures,release:RELEASE})});
})();
