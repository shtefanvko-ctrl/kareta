(() => {
  'use strict';

  function asArray(value){
    return Array.isArray(value) ? value : [];
  }

  function cleanText(value, fallback = ''){
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function toNumber(value){
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeOrder(raw, index){
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = cleanText(source.id, `order-${index + 1}`);
    const status = cleanText(source.status, 'new');
    const serviceNames = cleanText(
      source.serviceNames ?? source.service_names ?? source.orderTitle ?? source.title,
      source.type === 'parts_request' ? 'Запрос запчастей' : 'Заявка на ремонт'
    );
    const clientName = cleanText(source.clientName ?? source.client_name, 'Клиент');
    const car = cleanText(source.clientCar ?? source.client_car ?? source.car, 'Автомобиль не указан');
    const createdAt = cleanText(source.createdAt ?? source.created_at);
    const price = toNumber(source.totalPrice ?? source.total_price ?? source.price);

    return Object.freeze({
      id,
      number:toNumber(source.num),
      status,
      serviceNames,
      clientName,
      car,
      createdAt,
      price,
      masterName:cleanText(source.masterName ?? source.master_name),
      stoName:cleanText(source.stoName ?? source.sto_name),
      phone:cleanText(source.clientPhone ?? source.client_phone ?? source.phone),
      address:cleanText(source.address ?? source.service_address),
      currentStage:cleanText(source.currentStage ?? source.current_stage),
      estimatedEnd:cleanText(source.estimatedEnd ?? source.estimated_end),
      warrantyDays:toNumber(source.warrantyDays ?? source.warranty_days),
      description:cleanText(source.description),
      vehicleId:cleanText(source.vehicleId ?? source.vehicle_id),
      masterId:cleanText(source.masterId ?? source.master_id ?? source.master_user_id),
      stoId:cleanText(source.stoId ?? source.sto_id),
      chatId:cleanText(source.chatId ?? source.chat_id),
      raw:source,
    });
  }

  function extractOrders(result){
    const payload = result && result.payload ? result.payload : null;
    const directRows = payload ? asArray(payload.orders) : [];
    if (directRows.length || (payload && Array.isArray(payload.orders))) return directRows.map(normalizeOrder);
    const data = payload && payload.data && typeof payload.data === 'object' ? payload.data : null;
    const rows = data ? asArray(data.orders) : [];
    return rows.map(normalizeOrder);
  }

  async function list(api, options = {}){
    if (!api || typeof api.request !== 'function') {
      throw new Error('Orders API requires KaretaApi.request');
    }

    const result = await api.request('api/db.php', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'orders.getAll' }),
      cacheTtlMs:0,
      dedupe:false,
      signal:options.signal,
    });
    if (!result || !result.ok) {
      const payload = result ? result.payload : null;
      const message = payload && (payload.message || payload.error)
        ? String(payload.message || payload.error)
        : 'Не удалось загрузить заказы';
      const error = new Error(message);
      error.status = result ? result.status : 0;
      error.payload = payload;
      throw error;
    }

    return Object.freeze({
      orders:Object.freeze(extractOrders(result)),
      receivedAt:Date.now(),
      source:'api/db.php:orders.getAll',
    });
  }


  async function exchangeRequest(api, action, body = {}, options = {}){
    if (!api || typeof api.request !== 'function') throw new Error('Exchange API requires KaretaApi.request');
    const result = await api.request('api/db.php', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({action},body)), cacheTtlMs:0, dedupe:false, signal:options.signal,
    });
    if(!result || !result.ok){const payload=result&&result.payload||{};const error=new Error(String(payload.message||payload.error||'Операция биржи не выполнена'));error.status=result?result.status:0;error.payload=payload;throw error;}
    return result.payload||{};
  }
  function exchangeDashboard(api, options={}){return exchangeRequest(api,'clientExchange.dashboard',{page:options.page||1,limit:options.limit||20,status:options.status||'all'},options);}
  function previewExchangeSchedule(api, orderId, responseId, options={}){return exchangeRequest(api,'clientExchange.schedulePreview',{orderId,responseId},options);}
  function acceptExchangeResponse(api, orderId, responseId, options={}){return exchangeRequest(api,'clientExchange.acceptResponse',{orderId,responseId,confirmScheduleConflict:options.confirmScheduleConflict===true},options);}
  function declineExchangeResponse(api, orderId, responseId, options={}){return exchangeRequest(api,'clientExchange.declineResponse',{orderId,responseId},options);}
  function republishExchangeOrder(api, orderId, options={}){return exchangeRequest(api,'clientExchange.republish',{orderId,days:options.days||3,maxResponses:options.maxResponses||20},options);}
  function rescheduleProposals(api, options={}){return exchangeRequest(api,'clientSchedule.reschedule.list',{},options);}
  function respondReschedule(api, proposalId, decision, options={}){return exchangeRequest(api,'clientSchedule.reschedule.respond',{proposalId,decision,note:options.note||''},options);}
  function arrivalStates(api, options={}){return exchangeRequest(api,'clientSchedule.arrival.list',{},options);}
  function setArrival(api, orderId, status, options={}){return exchangeRequest(api,'clientSchedule.arrival.set',{orderId,status,etaMinutes:Number(options.etaMinutes||0),note:options.note||''},options);}

  window.KaretaOrdersApi = Object.freeze({
    list,
    normalizeOrder,
    extractOrders,
    exchangeDashboard,
    previewExchangeSchedule,
    acceptExchangeResponse,
    declineExchangeResponse,
    republishExchangeOrder,
    rescheduleProposals,
    respondReschedule,
    arrivalStates,
    setArrival,
  });
})();
