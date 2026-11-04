(() => {
  'use strict';
  const client = window.KaretaApiClient;
  if (!client) throw new Error('KaretaApiClient is required before seller_api.js');

  async function post(action, data = {}, options = {}) {
    const response = await client.request('api/db.php', {
      method:'POST',
      ...options,
      headers:{ 'Content-Type':'application/json', ...(options.headers || {}) },
      body:JSON.stringify({ action, ...data })
    });
    if (!response.ok) {
      const error = new Error(response.payload?.message || response.payload?.error || 'Ошибка магазина');
      error.code = response.payload?.error || 'seller_request_failed';
      error.status = response.status;
      throw error;
    }
    return response.payload;
  }

  async function geoRequest(url, data, options={}) {
    const response=await client.request(url,{
      method:data?'POST':'GET',cacheTtlMs:0,dedupe:false,...options,
      ...(data?{headers:{'Content-Type':'application/json',...(options.headers||{})},body:JSON.stringify(data)}:{})
    });
    if(!response.ok){
      const problem=new Error(response.payload?.message||response.payload?.error||'Не удалось сохранить точку');
      problem.code=response.payload?.error||'seller_geo_failed';
      problem.status=response.status;
      throw problem;
    }
    return response.payload;
  }
  const saveGeoPoint=(point,options)=>geoRequest('api/geo.php?action=upsert',point,options);
  const getPublicGeoPoints=(ownerId,options)=>geoRequest('api/geo.php?action=entity&ownerType=shop&ownerId='+encodeURIComponent(String(ownerId)),null,options);

  const dashboard = options => post('seller.dashboard', {}, options);
  const saveProfile = (profile, options) => post('seller.profile.save', { profile }, options);
  const saveProduct = (product, options) => post('seller.products.save', { product }, options);
  const deleteProduct = (id, options) => post('seller.products.delete', { id }, options);
  const restoreProduct = (id, options) => post('seller.products.restore', { id }, options);
  const updateStock = (id, change = {}, options) => post('seller.products.stock', { id, ...change }, options);
  const updateOrderStatus = (id, status, options) => post('seller.orders.updateStatus', { id, status }, options);

  window.KaretaSellerApi = Object.freeze({ dashboard, saveProfile, saveProduct, deleteProduct, restoreProduct, updateStock, updateOrderStatus, saveGeoPoint, getPublicGeoPoints });
})();
