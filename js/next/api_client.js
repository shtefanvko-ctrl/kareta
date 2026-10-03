(() => {
  'use strict';

  const ENDPOINTS = Object.freeze({
    state:'api/db.php?action=pull',
    session:'api/auth_session.php',
    postDeploy:'api/post_deploy_check.php',
    version:'api/version_check.php',
    shopCatalog:'api/db.php?action=shop.catalog',
    servicesCatalog:'api/db.php?action=services.catalog',
    news:'api/db.php?action=news.list',
    mastersCatalog:'api/db.php?action=masters.catalog',
    productDetail:'api/db.php?action=shop.product',
    storeDetail:'api/db.php?action=shop.store',
    serviceDetail:'api/db.php?action=services.detail',
    providerDetail:'api/db.php?action=providers.detail',
    workPosts:'api/db.php?action=workPosts.list',
    workPostDetail:'api/db.php?action=workPosts.detail',
    workPostComments:'api/db.php?action=workPosts.comments',
    bookingSlots:'api/db.php?action=booking.slots',
  });

  function normalizeRequestUrl(value){
    const raw=String(value||'').trim();
    if(/^api\//i.test(raw))return `/${raw}`;
    if(/^sites\/api\//i.test(raw))return `/${raw.replace(/^sites\//i,'')}`;
    return raw;
  }

  const memoryCache = new Map();
  const inFlight = new Map();
  const keyGenerations = new Map();
  let cacheGeneration = 0;
  const PERSIST_PREFIX='kareta.api.cache.v2:';

  // Shared safe-request gate for the monolithic DB endpoint. Some production hosts
  // answer concurrent PHP bursts with HTTP 429 before db.php itself runs.
  // GET reads enter automatically. POST calls enter only when a wrapper explicitly
  // marks the operation dbSafeReplay=true (read-like or idempotent mutation).
  const DB_READ_MIN_GAP_MS = 650;
  const DB_READ_RETRY_DEFAULT_MS = 1500;
  const DB_READ_RETRY_MAX_MS = 8000;
  let dbReadTail = Promise.resolve();
  let dbReadLastStartedAt = 0;
  let dbReadBackoffUntil = 0;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  function isDbRead(url, method){
    return method === 'GET' && /(?:^|\/)api\/db\.php(?:[?#]|$)/i.test(String(url || ''));
  }
  function dbRetryDelayMs(result){
    const retryAfterMs = Math.max(0, Number(result?.retryAfter || 0) * 1000);
    return Math.min(DB_READ_RETRY_MAX_MS, retryAfterMs || DB_READ_RETRY_DEFAULT_MS);
  }
  function executeDbRead(url, fetchOptions){
    const run = async () => {
      const now = Date.now();
      const gapUntil = Math.max(dbReadBackoffUntil, dbReadLastStartedAt + DB_READ_MIN_GAP_MS);
      if (gapUntil > now) await sleep(gapUntil - now);
      dbReadLastStartedAt = Date.now();
      let result = await execute(url, fetchOptions);
      if (result.status !== 429) return result;

      const retryMs = dbRetryDelayMs(result);
      dbReadBackoffUntil = Math.max(dbReadBackoffUntil, Date.now() + retryMs);
      await sleep(retryMs);
      dbReadLastStartedAt = Date.now();
      result = await execute(url, fetchOptions);
      if (result.status === 429) {
        dbReadBackoffUntil = Math.max(dbReadBackoffUntil, Date.now() + dbRetryDelayMs(result));
      }
      return result;
    };
    const scheduled = dbReadTail.then(run, run);
    dbReadTail = scheduled.catch(() => null);
    return scheduled;
  }
  function readPersistent(key){ try{const row=JSON.parse(sessionStorage.getItem(PERSIST_PREFIX+key)||'null');return row&&row.result?row:null;}catch(_e){return null;} }
  function writePersistent(key,record){ try{sessionStorage.setItem(PERSIST_PREFIX+key,JSON.stringify(record));}catch(_e){} }

  function mergeHeaders(base, extra){
    const headers = new Headers(base || {});
    new Headers(extra || {}).forEach((value, key) => headers.set(key, value));
    return headers;
  }

  async function parsePayload(response){
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) return response.json().catch(() => null);
    const text = await response.text().catch(() => '');
    if (!text) return null;
    try { return JSON.parse(text); } catch (_error) { return { raw:text }; }
  }

  function normalizeCode(value, fallback='UNKNOWN_ERROR'){
    const code=String(value||fallback).trim().replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'').toUpperCase();
    return code||fallback;
  }

  function normalizePayload(payload, response){
    const source=(payload&&typeof payload==='object'&&!Array.isArray(payload))?payload:{};
    const status=Number(response?.status||0);
    const legacyStatus=String(source.status||'').toLowerCase();
    const explicitOk=typeof source.ok==='boolean'?source.ok:null;
    const legacyOk=typeof source.success==='boolean'?source.success:(legacyStatus?['ok','success','done'].includes(legacyStatus):null);
    const ok=Boolean(status>=200&&status<400&&(explicitOk??legacyOk??true));
    const code=normalizeCode(source.code||source.error||(ok?'OK':`HTTP_${status||0}`),ok?'OK':'UNKNOWN_ERROR');
    const message=String(source.message||source.msg||source.error_message||(ok?'Операция выполнена':'Не удалось выполнить операцию'));
    const errors=Array.isArray(source.errors)?source.errors:[];
    const requestId=String(source.requestId||response?.headers?.get?.('x-kareta-request-id')||'');
    const data=Object.prototype.hasOwnProperty.call(source,'data')?source.data:source;
    return Object.freeze({...source,ok,code,message,errors,requestId,data,meta:Object.freeze({...((source.meta&&typeof source.meta==='object')?source.meta:{}),httpStatus:status})});
  }

  function makeIdempotencyKey(scope, parts=[]){
    const clean=[scope,...parts].map(v=>String(v??'').trim()).filter(Boolean).join(':').replace(/[^a-zA-Z0-9_.:-]/g,'_');
    const random=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    return `${clean||'mutation'}:${random}`.slice(0,128);
  }

  function requestKey(url, method, customKey = ''){
    return customKey || `${method}:${String(url)}`;
  }

  function cloneResult(result, extra = {}){
    return Object.freeze({ ...result, ...extra });
  }

  async function execute(url, options){
    const response = await fetch(url, options);
    const rawPayload = await parsePayload(response);
    const payload = normalizePayload(rawPayload, response);
    return Object.freeze({
      ok:!!(response.ok && payload.ok),
      status:response.status,
      code:payload.code,
      message:payload.message,
      data:payload.data,
      errors:payload.errors,
      requestId:payload.requestId,
      payload,
      url:String(response.url || url),
      retryAfter:Number(response.headers.get('retry-after') || 0),
      fromCache:false,
    });
  }

  async function request(url, options = {}){
    const requestUrl = normalizeRequestUrl(url);
    const method = String(options.method || 'GET').toUpperCase();
    const cacheTtlMs = Math.max(0, Number(options.cacheTtlMs ?? (method === 'GET' ? 10000 : 0)) || 0);
    const dedupe = options.dedupe !== false && method === 'GET';
    const force = options.force === true;
    const dbSafeReplay = options.dbSafeReplay === true;
    const key = requestKey(requestUrl, method, String(options.cacheKey || ''));
    const generation = cacheGeneration;
    const keyGeneration = keyGenerations.get(key) || 0;
    const currentGeneration = () => generation === cacheGeneration && keyGeneration === (keyGenerations.get(key) || 0);

    const fetchOptions = { ...options };
    delete fetchOptions.cacheTtlMs;
    delete fetchOptions.dedupe;
    delete fetchOptions.force;
    delete fetchOptions.cacheKey;
    delete fetchOptions.dbSafeReplay;
    fetchOptions.method = method;
    fetchOptions.cache = 'no-store';
    fetchOptions.credentials = 'same-origin';
    fetchOptions.headers = mergeHeaders({ Accept:'application/json' }, options.headers);

    if (dedupe) {
      // Shared read requests must not be aborted by one page unmounting.
      delete fetchOptions.signal;
      let cached = memoryCache.get(key);
      if(!cached){const stored=readPersistent(key);if(stored){cached=stored;memoryCache.set(key,stored);}}
      if (!force && cached && (Date.now() - cached.at) < cacheTtlMs) {
        return cloneResult(cached.result, { fromCache:true });
      }
      if (!force && inFlight.has(key)) return inFlight.get(key);
    }

    const transport = (isDbRead(requestUrl, method) || dbSafeReplay) ? executeDbRead(requestUrl, fetchOptions) : execute(requestUrl, fetchOptions);
    const promise = transport.then(result => {
      if (dedupe && currentGeneration() && result.ok && cacheTtlMs > 0) { const record={ at:Date.now(), result }; memoryCache.set(key,record); writePersistent(key,record); }
      if(dedupe && currentGeneration() && !result.ok){const stale=memoryCache.get(key)||readPersistent(key);if(stale?.result)return cloneResult(stale.result,{fromCache:true,stale:true});}
      return result;
    }).catch(error=>{const stale=dedupe&&currentGeneration()?(memoryCache.get(key)||readPersistent(key)):null;if(stale?.result)return cloneResult(stale.result,{fromCache:true,stale:true,networkError:String(error?.message||error)});throw error;}).finally(() => {
      if (dedupe && inFlight.get(key) === promise) inFlight.delete(key);
    });

    if (dedupe) inFlight.set(key, promise);
    return promise;
  }

  function withQuery(base, params = {}){
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });
    const suffix = query.toString();
    return suffix ? `${base}&${suffix}` : base;
  }

  function getState(options = {}){ return request(ENDPOINTS.state, { cacheTtlMs:20000, ...options }); }
  function getSession(options = {}){ return request(ENDPOINTS.session, { cacheTtlMs:5000, ...options }); }
  function postDeploy(options = {}){ return request(ENDPOINTS.postDeploy, options); }
  function version(options = {}){ return request(ENDPOINTS.version, options); }
  function getShopCatalog(params = {}, options = {}){
    return request(withQuery(ENDPOINTS.shopCatalog, params), {
      cacheTtlMs:60000,
      cacheKey:`shop.catalog:${JSON.stringify(params || {})}`,
      ...options,
    });
  }
  function getMastersCatalog(params = {}, options = {}){
    return request(withQuery(ENDPOINTS.mastersCatalog, params), { cacheTtlMs:30000, cacheKey:`masters.catalog:${JSON.stringify(params || {})}`, ...options });
  }
  function getNews(params = {}, options = {}){
    return request(withQuery(ENDPOINTS.news, params), { cacheTtlMs:30000, cacheKey:`news:${JSON.stringify(params || {})}`, ...options });
  }
  function getProductDetail(id, options = {}){ return request(withQuery(ENDPOINTS.productDetail,{id}), { cacheTtlMs:60000, cacheKey:`product.detail:${id}`, ...options }); }
  function getStoreDetail(sellerId, options = {}){ return request(withQuery(ENDPOINTS.storeDetail,{sellerId}), { cacheTtlMs:30000, cacheKey:`shop.store:${sellerId}`, ...options }); }
  function getServiceDetail(id, options = {}){ return request(withQuery(ENDPOINTS.serviceDetail,{id}), { cacheTtlMs:60000, cacheKey:`service.detail:${id}`, ...options }); }
  function getProviderDetail(type,id, options = {}){ return request(withQuery(ENDPOINTS.providerDetail,{type,id}), { cacheTtlMs:60000, cacheKey:`provider.detail:${type}:${id}`, ...options }); }
  function getWorkPosts(params = {}, options = {}){ return request(withQuery(ENDPOINTS.workPosts,params), { cacheTtlMs:30000, cacheKey:`work.posts:${JSON.stringify(params||{})}`, ...options }); }
  function getWorkPost(id, options = {}){ return request(withQuery(ENDPOINTS.workPostDetail,{id}), { cacheTtlMs:30000, cacheKey:`work.post:${id}`, ...options }); }
  function getWorkPostComments(postId, options = {}){ return request(withQuery(ENDPOINTS.workPostComments,{postId}), { cacheTtlMs:5000, cacheKey:`work.post.comments:${postId}`, ...options }); }
  function getWorkPostSocialState(options = {}){ return request('api/db.php?action=workPosts.socialState',{cacheTtlMs:15000,cacheKey:'work.posts.social-state',...options}); }
  async function likeWorkPost(postId){ const result=await request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workPosts.like',postId}),cacheTtlMs:0,dedupe:false}); if(result?.ok){invalidate('work.posts.social-state');invalidate(`work.post:${postId}`);const data=result.payload?.data||result.payload||{};window.KaretaSocialState?.patchPost?.(`work:${postId}`,{liked:!!data.liked,likes:Number(data.likesCount||0),source:'server'});} return result; }
  async function saveWorkPost(postId,value){const result=await request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workPosts.save',postId,value}),cacheTtlMs:0,dedupe:false});if(result?.ok){invalidate('work.posts.social-state');invalidate(`work.post:${postId}`);const data=result.payload?.data||result.payload||{};window.KaretaSocialState?.setSaved?.(`work:${postId}`,!!data.saved,{source:'server'});}return result;}
  function publishWorkPost(payload){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workPosts.publish',...payload})}); }
  async function addWorkPostComment(postId, body, parentId='', options={}){ const idempotencyKey=String(options.idempotencyKey||makeIdempotencyKey('wpc',[postId,parentId])); const result=await request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':idempotencyKey},body:JSON.stringify({action:'workPosts.comment',postId,body,parentId,idempotencyKey}),cacheTtlMs:0,dedupe:false}); if(result?.ok){const item=result.payload?.comment||result.payload?.data?.comment||{authorName:'Вы',body,createdAt:new Date().toISOString()};const key=`work:${postId}`,current=window.KaretaSocialState?.getPost?.(key);window.KaretaSocialState?.patchPost?.(key,{comments:[...(current?.comments||[]),item]});} return result; }
  async function deleteWorkPostComment(commentId){ const result=await request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workPosts.commentDelete',commentId}),cacheTtlMs:0,dedupe:false}); return result; }
  const directChatInFlight=new Map();
  function getChats(options={}){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chats.getAll'}),cacheTtlMs:0,dedupe:false,dbSafeReplay:true,...options}); }
  function getChatContacts(options={}){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chats.contacts'}),cacheTtlMs:0,dedupe:false,dbSafeReplay:true,...options}); }
  function openDirectChat(target, options={}){
    const payload=(target&&typeof target==='object')?{...target}:{userId:target};
    const targetKey=String(payload.userId||payload.masterId||payload.stoId||'unknown');
    const flightKey=[payload.userId||'',payload.masterId||'',payload.stoId||''].join('|');
    if(directChatInFlight.has(flightKey))return directChatInFlight.get(flightKey);
    const idempotencyKey=String(options.idempotencyKey||makeIdempotencyKey('direct',[targetKey]));
    const promise=request('api/db.php',{
      ...options,
      method:'POST',
      headers:{'Content-Type':'application/json','X-Idempotency-Key':idempotencyKey},
      body:JSON.stringify({action:'chats.openDirect',...payload,idempotencyKey}),
      cacheTtlMs:0,
      dedupe:false,
      dbSafeReplay:true,
    }).finally(()=>{if(directChatInFlight.get(flightKey)===promise)directChatInFlight.delete(flightKey);});
    directChatInFlight.set(flightKey,promise);
    return promise;
  }
  function getMessages(chatId, options={}){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'messages.get',chatId}),cacheTtlMs:0,dedupe:false,dbSafeReplay:true,...options}); }
  function sendMessage(chatId,msg, options={}){ const idempotencyKey=String(options.idempotencyKey||makeIdempotencyKey('message',[chatId])); return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':idempotencyKey},body:JSON.stringify({action:'messages.add',chatId,msg,idempotencyKey}),cacheTtlMs:0,dedupe:false,...options}); }
  function updateMessage(chatId,messageId,text,options={}){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'messages.update',chatId,messageId,text}),cacheTtlMs:0,dedupe:false,...options}); }
  function markChatRead(chatId,role){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chats.markRead',chatId,role}),cacheTtlMs:0,dedupe:false,dbSafeReplay:true}); }
  function openSupportChat(message, options={}){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chats.supportOpen',message,idempotencyKey:`support:${Date.now()}`}),cacheTtlMs:0,dedupe:false,...options}); }
  function createOrder(order, options={}){ const idempotencyKey=String(options.idempotencyKey||order?.idempotencyKey||makeIdempotencyKey('order',[order?.clientPhone||order?.phone||''])); const payload={...order}; delete payload.idempotencyKey; return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':idempotencyKey},body:JSON.stringify({action:'orders.create',order:payload,idempotencyKey}),cacheTtlMs:0,dedupe:false}); }
  function getBookingSlots(params={},options={}){return request(withQuery(ENDPOINTS.bookingSlots,params),{cacheTtlMs:15000,cacheKey:`booking.slots:${JSON.stringify(params)}`,...options});}
  function submitProductReview(payload){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'productReviews.submit',...payload,idempotencyKey:`product-review:${payload.productId}:${Date.now()}`})});}
  function submitProductQuestion(payload){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'productQuestions.submit',...payload,idempotencyKey:`product-question:${payload.productId}:${Date.now()}`})});}
  function submitReview(review){ return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publicReviews.submit',review,idempotencyKey:`review:${review.orderId||''}:${Date.now()}`})}); }


  function getUsedMarket(params={},options={}){return request(withQuery('api/db.php?action=usedMarket.list',params),{cacheTtlMs:0,dedupe:false,...options});}
  function getUsedMarketDetail(id,options={}){return request(withQuery('api/db.php?action=usedMarket.detail',{id}),{cacheTtlMs:15000,cacheKey:`used.market.detail:${id}`,...options});}
  function saveUsedMarketListing(listing){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'usedMarket.save',listing,idempotencyKey:`used-market:${listing.id||'new'}:${Date.now()}`}),cacheTtlMs:0,dedupe:false});}
  function deleteUsedMarketListing(id){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'usedMarket.delete',id}),cacheTtlMs:0,dedupe:false});}
  function favoriteUsedMarketListing(id,active){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'usedMarket.favorite',id,active}),cacheTtlMs:0,dedupe:false});}
  function setUsedMarketListingStatus(id,status){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'usedMarket.status',id,status}),cacheTtlMs:0,dedupe:false});}
  function viewUsedMarketListing(id){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'usedMarket.view',id}),cacheTtlMs:0,dedupe:false});}

  function getMasterExchangeFeed(params={},options={}){return request(withQuery('api/db.php?action=masterExchange.feed',params),{cacheTtlMs:10000,cacheKey:`master.exchange.feed:${JSON.stringify(params)}`,...options});}
  function getMasterExchangeState(options={}){return request('api/db.php?action=masterExchange.getMine',{cacheTtlMs:5000,cacheKey:'master.exchange.mine',...options});}
  function saveMasterExchangeResponse(payload){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterExchange.saveResponse',...payload,idempotencyKey:`exchange:${payload.requestId||''}:${Date.now()}`}),cacheTtlMs:0,dedupe:false});}
  function toggleMasterExchangeSaved(requestId,active){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterExchange.toggleSaved',request_id:requestId,active}),cacheTtlMs:0,dedupe:false});}
  function toggleMasterExchangeHidden(requestId,active){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterExchange.toggleHidden',request_id:requestId,active}),cacheTtlMs:0,dedupe:false});}


  async function updateMasterSocial(masterId, field, value){
    const result=await request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterSocial.update',masterId,field,value}),cacheTtlMs:0,dedupe:false});
    if(result?.ok){invalidate('master.social.following');invalidate('masters.catalog');window.KaretaSocialState?.setFollowing?.('master',masterId,field==='following'?!!value:(window.KaretaSocialState?.isFollowing?.('master',masterId)??true),field==='following'?{}:{[field]:value});if(field!=='following')window.KaretaSocialState?.setProviderSetting?.('master',masterId,field,value);}
    return result;
  }
  function getFollowingMasters(options={}){return request('api/db.php?action=masterSocial.following',{cacheTtlMs:0,cacheKey:'master.social.following',...options});}
  async function updateStoSocial(stoId, field, value){
    const result=await request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stoSocial.update',stoId,field,value}),cacheTtlMs:0,dedupe:false});
    if(result?.ok){invalidate('master.social.following');invalidate('masters.catalog');window.KaretaSocialState?.setFollowing?.('sto',stoId,field==='following'?!!value:(window.KaretaSocialState?.isFollowing?.('sto',stoId)??true),field==='following'?{}:{[field]:value});if(field!=='following')window.KaretaSocialState?.setProviderSetting?.('sto',stoId,field,value);}
    return result;
  }

  function getServicesCatalog(options = {}){
    return request(ENDPOINTS.servicesCatalog, {
      cacheTtlMs:60000,
      cacheKey:'services.catalog',
      ...options,
    });
  }
  function domainRequest(action='snapshot',payload=null,options={}){const isWrite=payload!==null;const body=isWrite?{...payload,idempotencyKey:payload.idempotencyKey||makeIdempotencyKey(`domain.${action}`)}:null;return request(`api/domain.php?action=${encodeURIComponent(action)}`,{method:isWrite?'POST':'GET',headers:isWrite?{'Content-Type':'application/json'}:undefined,body:isWrite?JSON.stringify(body):undefined,cacheTtlMs:isWrite?0:5000,dedupe:!isWrite,...options});}
  function getDomainSnapshot(options={}){return domainRequest('snapshot',null,options);}
  function getDomainEntity(type,key,options={}){return request(`/api/domain.php?action=entity.get&type=${encodeURIComponent(type)}&key=${encodeURIComponent(key)}`,{...options,method:'GET'});}
  function listDomainEntities(type='',options={}){return request(`/api/domain.php?action=entities.list${type?`&type=${encodeURIComponent(type)}`:''}`,{...options,method:'GET'});}
  function createDomainEvent(payload,options={}){return domainRequest('event.create',payload,options);}
  function createCalendarEvent(payload,options={}){return domainRequest('calendar.create',payload,options);}
  function getCalendarView(params={},options={}){return request(withQuery('api/domain.php?action=calendar.view',params),{cacheTtlMs:0,dedupe:false,...options});}
  function getBookingAvailability(params={},options={}){return request(withQuery('api/domain.php?action=booking.availability',params),{cacheTtlMs:0,dedupe:false,...options});}
  function createServiceBooking(payload,options={}){return domainRequest('booking.create',payload,options);}
  function cancelServiceBooking(bookingKey,options={}){return domainRequest('booking.cancel',{bookingKey},options);}
  function createPaymentIntent(payload,options={}){return domainRequest('payment.create',payload,options);}

  function getMarketView(options={}){return request('api/domain.php?action=market.view',{cacheTtlMs:0,dedupe:false,...options});}
  function createMarketProduct(payload,options={}){return domainRequest('market.product.create',payload,options);}
  function createWarehouse(payload,options={}){return domainRequest('market.warehouse.create',payload,options);}
  function adjustMarketStock(payload,options={}){return domainRequest('market.stock.adjust',payload,options);}
  function addMarketCartItem(payload,options={}){return domainRequest('market.cart.add',payload,options);}
  function removeMarketCartItem(itemId,options={}){return domainRequest('market.cart.remove',{itemId},options);}
  function checkoutMarket(payload={},options={}){return domainRequest('market.checkout',payload,options);}
  function fulfillMarketOrder(orderKey,options={}){return domainRequest('market.order.fulfill',{orderKey},options);}
  function getCrmView(options={}){return request('api/domain.php?action=crm.view',{cacheTtlMs:0,dedupe:false,...options});}
  function createCrmNote(payload,options={}){return domainRequest('crm.note.create',payload,options);}
  function getFinanceView(options={}){return request('api/domain.php?action=finance.view',{cacheTtlMs:0,dedupe:false,...options});}
  function createEstimate(payload,options={}){return domainRequest('estimate.create',payload,options);}
  function createInvoice(payload,options={}){return domainRequest('invoice.create',payload,options);}
  function sendInvoice(invoiceKey,options={}){return domainRequest('invoice.send',{invoiceKey},options);}
  function recordInvoicePayment(payload,options={}){return domainRequest('payment.record',payload,options);}
  function createRefund(payload,options={}){return domainRequest('refund.create',payload,options);}
  function markDomainNotificationRead(id,options={}){return domainRequest('notification.read',{id},options);}
  function operationalFinanceRequest(action,payload={},options={}){return request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),cacheTtlMs:0,dedupe:false,...options});}
  function getOperationalFinanceDashboard(params={},options={}){return request(withQuery('api/db.php?action=operationalFinance.dashboard',params),{cacheTtlMs:0,dedupe:false,...options});}
  function recordOrderPayment(payload,options={}){return operationalFinanceRequest('operationalFinance.orderPayment.record',payload,options);}
  function recordStoExpense(payload,options={}){return operationalFinanceRequest('operationalFinance.expense.record',payload,options);}
  function savePayrollRule(payload,options={}){return operationalFinanceRequest('operationalFinance.payrollRule.save',payload,options);}
  function closePayrollPeriod(payload,options={}){return operationalFinanceRequest('operationalFinance.payroll.close',payload,options);}
  function payPayroll(payload,options={}){return operationalFinanceRequest('operationalFinance.payroll.pay',payload,options);}
  function updateReceivableDue(payload,options={}){return operationalFinanceRequest('operationalFinance.receivable.due',payload,options);}

  function invalidate(prefix = ''){
    if (!prefix) { cacheGeneration++; keyGenerations.clear(); inFlight.clear(); }
    else Array.from(inFlight.keys()).forEach(key => { if (key.includes(prefix)) { keyGenerations.set(key, (keyGenerations.get(key) || 0) + 1); inFlight.delete(key); } });
    Array.from(memoryCache.keys()).forEach(key => { if (!prefix || key.includes(prefix)) memoryCache.delete(key); });
    try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k&&k.startsWith(PERSIST_PREFIX)&&(!prefix||k.includes(prefix)))sessionStorage.removeItem(k);}}catch(_e){}
  }

  window.KaretaApiClient = Object.freeze({
    request,
    normalizePayload,
    makeIdempotencyKey,
    getDomainSnapshot,
    getDomainEntity,
    listDomainEntities,
    createDomainEvent,
    createCalendarEvent,
    getCalendarView,
    getBookingAvailability,
    createServiceBooking,
    cancelServiceBooking,
    createPaymentIntent,
    getMarketView,
    createMarketProduct,
    createWarehouse,
    adjustMarketStock,
    addMarketCartItem,
    removeMarketCartItem,
    checkoutMarket,
    fulfillMarketOrder,
    getCrmView,
    createCrmNote,
    getFinanceView,
    createEstimate,
    createInvoice,
    sendInvoice,
    recordInvoicePayment,
    createRefund,
    markDomainNotificationRead,
    getOperationalFinanceDashboard,
    recordOrderPayment,
    recordStoExpense,
    savePayrollRule,
    closePayrollPeriod,
    payPayroll,
    updateReceivableDue,
    getState,
    getSession,
    getShopCatalog,
    getServicesCatalog,
    getNews,
    getMastersCatalog,
    getProductDetail,
    getStoreDetail,
    getServiceDetail,
    getProviderDetail,
    getWorkPosts,
    getWorkPost,
    getWorkPostComments,
    getWorkPostSocialState,
    addWorkPostComment,
    getChats,
    getChatContacts,
    openDirectChat,
    getMessages,
    sendMessage,
    updateMessage,
    markChatRead,
    openSupportChat,
    createOrder,
    getUsedMarket,getUsedMarketDetail,saveUsedMarketListing,deleteUsedMarketListing,favoriteUsedMarketListing,setUsedMarketListingStatus,viewUsedMarketListing,
    getMasterExchangeFeed,
    getMasterExchangeState,
    saveMasterExchangeResponse,
    toggleMasterExchangeSaved,
    toggleMasterExchangeHidden,
    getBookingSlots,
    submitProductReview,
    submitProductQuestion,
    submitReview,
    likeWorkPost,
    saveWorkPost,
    publishWorkPost,
    deleteWorkPostComment,
    updateMasterSocial,
    getFollowingMasters,
    updateStoSocial,
    postDeploy,
    version,
    invalidate,
    endpoints:ENDPOINTS,
    audit:() => Object.freeze({ cacheEntries:memoryCache.size, inFlight:inFlight.size, at:Date.now() }),
  });
})();
