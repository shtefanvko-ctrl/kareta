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

  const dashboard = options => post('seller.dashboard', {}, options);
  const saveProfile = (profile, options) => post('seller.profile.save', { profile }, options);
  const saveProduct = (product, options) => post('seller.products.save', { product }, options);
  const deleteProduct = (id, options) => post('seller.products.delete', { id }, options);
  const restoreProduct = (id, options) => post('seller.products.restore', { id }, options);
  const updateStock = (id, change = {}, options) => post('seller.products.stock', { id, ...change }, options);
  const updateOrderStatus = (id, status, options) => post('seller.orders.updateStatus', { id, status }, options);

  window.KaretaSellerApi = Object.freeze({ dashboard, saveProfile, saveProduct, deleteProduct, restoreProduct, updateStock, updateOrderStatus });
})();
