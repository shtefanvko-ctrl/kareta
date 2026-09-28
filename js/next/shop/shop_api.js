(() => {
  'use strict';
  const client = window.KaretaApiClient;
  if (!client) throw new Error('KaretaApiClient is required before shop_api.js');

  function buildError(response, fallback){
    const error = new Error(response.payload?.message || response.payload?.error || fallback);
    error.code = response.payload?.error || 'shop_request_failed';
    error.status = response.status;
    error.retryAfter = Number(response.retryAfter || 0);
    return error;
  }

  async function catalog(filters = {}, options = {}){
    const response = await client.getShopCatalog({
      search:String(filters.search || ''),
      category:String(filters.category || 'all'),
      limit:Math.max(1, Math.min(100, Number(filters.limit || 60))),
    }, options);
    if (!response.ok) throw buildError(response, 'Не удалось загрузить каталог запчастей');
    return response.payload;
  }

  async function createOrder(order, options = {}){
    const idempotencyKey = String(options.idempotencyKey || `shop-order-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const response = await client.request('api/db.php', {
      method:'POST',
      ...options,
      headers:{ 'Content-Type':'application/json', 'X-Idempotency-Key':idempotencyKey, ...(options.headers || {}) },
      body:JSON.stringify({ action:'shop.order.create', order, idempotencyKey })
    });
    if (!response.ok) throw buildError(response, 'Не удалось оформить заказ');
    client.invalidate('shop.catalog');
    return response.payload;
  }

  window.KaretaShopApi = Object.freeze({ catalog, createOrder });
})();
