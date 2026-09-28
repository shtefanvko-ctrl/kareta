(() => {
  'use strict';

  const client = window.KaretaApiClient;
  if (!client) throw new Error('KaretaApiClient is required before catalog_api.js');

  function asArray(value){ return Array.isArray(value) ? value : []; }
  function text(value){ return String(value ?? '').trim(); }
  function number(value){ const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }

  function normalizeService(row){
    return Object.freeze({
      id:text(row?.id),
      icon:text(row?.icon) || '⚙',
      name:text(row?.name) || 'Услуга',
      category:text(row?.cat) || 'other',
      basePrice:number(row?.basePrice ?? row?.base_price),
      avgTime:text(row?.avgTime ?? row?.avg_time),
      priceLabel:text(row?.priceLabel ?? row?.price_label),
      timeLabel:text(row?.timeLabel ?? row?.time_label),
      shortDesc:text(row?.shortDesc ?? row?.short_desc),
      whyText:text(row?.whyText ?? row?.why_text),
      steps:asArray(row?.steps),
      list:asArray(row?.list),
      sort:number(row?.sort),
      offerCount:number(row?.offerCount),
      minOfferPrice:number(row?.minOfferPrice),
      offerOwners:asArray(row?.offerOwners).map(text).filter(Boolean),
    });
  }


  function normalizeServiceCategory(row){
    return Object.freeze({
      key:text(row?.key ?? row?.category_key) || 'other',
      name:text(row?.name) || 'Другое',
      icon:text(row?.icon) || '🔧',
      sort:number(row?.sort),
      active:row?.active !== false && row?.active !== 0 && String(row?.active) !== '0',
    });
  }

  function normalizeProduct(row){
    return Object.freeze({
      id:text(row?.id),
      name:text(row?.name) || 'Товар',
      sku:text(row?.sku),
      brand:text(row?.brand),
      category:text(row?.cat) || 'other',
      oem:text(row?.oem),
      priceLabel:text(row?.priceLabel ?? row?.price_label),
      stock:row?.stock === true || row?.stock === 1 || String(row?.stock) === '1',
      note:text(row?.note),
      imageUrl:text(row?.imageUrl ?? row?.image_url ?? row?.image),
    });
  }

  async function load(options = {}){
    const response = await client.getServicesCatalog({ force:options.force === true });
    if(!response.ok){const error=new Error(response.payload?.message||response.payload?.error||'Не удалось загрузить каталог услуг');error.status=response.status;throw error;}
    const data=response.payload?.data||{};
    const rawServices=asArray(data.services);
    if(!rawServices.length){const error=new Error('База услуг вернула пустой каталог');error.code='service_catalog_empty';throw error;}
    return Object.freeze({services:rawServices.map(normalizeService),serviceCategories:asArray(data.serviceCategories).map(normalizeServiceCategory).filter(item=>item.active),products:[],serviceSource:text(data.meta?.source||data.source||'services.catalog'),fetchedAt:Date.now()});
  }


  window.KaretaCatalogApi = Object.freeze({ load, normalizeService, normalizeServiceCategory, normalizeProduct });
})();
