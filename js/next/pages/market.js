(() => {
'use strict';
const api=()=>window.KaretaApiClient,ui=()=>window.KaretaUIKit,esc=v=>ui()?.esc?.(v)??String(v??'');
const money=v=>ui().money(v,'KZT');
const empty=text=>`<div class="k-empty"><p>${esc(text)}</p></div>`;
let snapshot={products:[],cart:[],orders:[],warehouses:[]};

function workDialog(key,eyebrow,title,body){return `<dialog class="k-r84-work-dialog k-market-r84-dialog" data-market-dialog="${esc(key)}"><div class="k-r84-work-dialog__surface"><header><div><small>${esc(eyebrow)}</small><h2>${esc(title)}</h2></div><button type="button" data-market-close aria-label="Закрыть">×</button></header><div class="k-r84-work-dialog__body">${body}</div><footer><button class="k-btn k-btn-secondary" type="button" data-market-close>Закрыть</button></footer></div></dialog>`;}
function renderMarket(){return `<section class="k-page k-market k-market-r84" data-page="market">
  <header class="k-r84-workspace-head"><div><small>СКЛАД МАГАЗИНА</small><h1>Склад и товарный контур</h1><p>Остатки — на рабочей поверхности. Корзина, отгрузки, склады и создание товара открываются отдельными рабочими окнами.</p></div><div data-layout="actions-row"><button class="k-btn k-btn-secondary" type="button" data-market-refresh>Обновить</button><button class="k-btn k-btn-secondary" type="button" data-market-open="cart">Корзина</button><button class="k-btn k-btn-secondary" type="button" data-market-open="orders">Отгрузки</button><button class="k-btn k-btn-secondary" type="button" data-market-open="warehouses">Склады</button><button class="k-btn k-btn-primary" type="button" data-market-open="product">Новый товар</button></div></header>
  <section class="k-market-r84-kpis" data-market-kpis aria-label="Сводка склада"></section>
  <section class="k-r84-flat-surface k-market-r84-stock"><header><div><small>ОСТАТКИ</small><h2>Товары склада</h2></div><a class="k-btn k-btn-ghost" href="#/seller/products">Каталог магазина</a></header><div class="k-market-r84-list" data-market-products></div></section>
  <div class="k-market-message" data-market-message aria-live="polite"></div>
  ${workDialog('cart','КОРЗИНА','Резерв и оформление','<div data-market-cart></div><div class="k-market-r84-dialog-actions"><button class="k-btn k-btn-primary" type="button" data-market-checkout>Оформить заказ</button></div>')}
  ${workDialog('orders','ОТГРУЗКИ','Заказы склада','<div data-market-orders></div>')}
  ${workDialog('warehouses','СКЛАДЫ','Точки хранения','<div data-market-warehouses></div><form class="k-market-r84-form" data-market-warehouse-form><label>Название<input name="title" required maxlength="180" placeholder="Название склада"></label><label>Адрес<input name="address" maxlength="255" placeholder="Адрес"></label><button class="k-btn k-btn-primary" type="submit">Создать склад</button></form>')}
  ${workDialog('product','ТОВАР','Новый товар склада','<form class="k-market-r84-form" data-market-product-form><label>Название<input name="title" required maxlength="255" placeholder="Название"></label><label>SKU<input name="sku" maxlength="128" placeholder="SKU"></label><label>Цена, ₸<input name="price" type="number" min="0" step="0.01" placeholder="Цена"></label><button class="k-btn k-btn-primary" type="submit">Добавить товар</button></form>')}
</section>`;}
function productRow(p){return `<article class="k-market-r84-row"><div><small>${esc([p.brand,p.sku,p.oemNumber].filter(Boolean).join(' · ')||'ТОВАР')}</small><b>${esc(p.title||'Товар')}</b></div><span><small>Цена</small><strong>${money(p.price)}</strong></span><span><small>Доступно</small><strong>${esc(p.available||0)}</strong></span><button class="k-btn k-btn-secondary" type="button" data-cart-add="${esc(p.productKey)}">В корзину</button></article>`;}
function orderRow(o){return `<article class="k-market-r84-row"><div><small>${esc(o.status||'Заказ')}</small><b>${esc(o.orderKey)}</b></div><span><small>Сумма</small><strong>${money(o.totalAmount)}</strong></span><span><small>Счёт</small><strong>${esc(o.invoiceKey||'—')}</strong></span>${o.status==='reserved'?`<button class="k-btn k-btn-primary" type="button" data-order-fulfill="${esc(o.orderKey)}">Отгрузить</button>`:'<span></span>'}</article>`;}
function paint(){const root=document.querySelector('.k-market-r84');if(!root)return;const products=snapshot.products||[],cart=snapshot.cart||[],orders=snapshot.orders||[],warehouses=snapshot.warehouses||[];const low=products.filter(p=>Number(p.available||0)<=3).length;
  root.querySelector('[data-market-kpis]').innerHTML=`<span><small>Товаров</small><b>${products.length}</b></span><span><small>Низкий остаток</small><b>${low}</b></span><span><small>В корзине</small><b>${cart.length}</b></span><span><small>Отгрузок</small><b>${orders.length}</b></span><span><small>Складов</small><b>${warehouses.length}</b></span>`;
  root.querySelector('[data-market-products]').innerHTML=products.map(productRow).join('')||empty('Товаров на складе пока нет.');
  root.querySelector('[data-market-cart]').innerHTML=cart.map(i=>`<article class="k-market-r84-line"><div><b>${esc(i.title)}</b><small>${esc(i.quantity)} × ${money(i.unitPrice)}</small></div><button type="button" data-cart-remove="${esc(i.itemId)}" aria-label="Удалить">×</button></article>`).join('')||empty('Корзина пуста.');
  root.querySelector('[data-market-orders]').innerHTML=orders.map(orderRow).join('')||empty('Заказов нет.');
  root.querySelector('[data-market-warehouses]').innerHTML=warehouses.map(w=>`<article class="k-market-r84-line"><div><b>${esc(w.title)}</b><small>${esc(w.address||'Адрес не указан')}</small></div></article>`).join('')||empty('Складов нет.');
}
function openDialog(root,key,trigger){const d=root.querySelector(`[data-market-dialog="${CSS.escape(key)}"]`);if(!d)return;d.__trigger=trigger||null;if(!d.open)d.showModal();}
function closeDialog(dialog){if(!dialog?.open)return;try{dialog.close();}catch(_e){}try{dialog.__trigger?.focus?.({preventScroll:true});}catch(_e){}dialog.__trigger=null;}
async function mountMarket(){const root=document.querySelector('.k-market-r84');if(!root)return;const msg=t=>{const el=root.querySelector('[data-market-message]');if(el)el.textContent=t||'';};
  const load=async()=>{root.querySelector('[data-market-products]').innerHTML=ui().skeleton(4);try{snapshot=await api().getMarketView();paint();}catch(e){root.querySelector('[data-market-products]').innerHTML=ui().error(e.message||'Не удалось загрузить склад');}};
  root.addEventListener('click',async e=>{try{
    const open=e.target.closest('[data-market-open]');if(open){openDialog(root,open.dataset.marketOpen||'',open);return;}
    const close=e.target.closest('[data-market-close]');if(close){closeDialog(close.closest('dialog'));return;}
    if(e.target.closest('[data-market-refresh]')){await load();return;}
    const add=e.target.closest('[data-cart-add]');if(add){await api().addMarketCartItem({productKey:add.dataset.cartAdd,quantity:'1'});await load();msg('Товар добавлен в корзину');return;}
    const rem=e.target.closest('[data-cart-remove]');if(rem){await api().removeMarketCartItem(rem.dataset.cartRemove);await load();return;}
    if(e.target.closest('[data-market-checkout]')){await api().checkoutMarket({deliveryMethod:'pickup'});await load();msg('Заказ создан, товар зарезервирован');return;}
    const f=e.target.closest('[data-order-fulfill]');if(f){await api().fulfillMarketOrder(f.dataset.orderFulfill);await load();msg('Отгрузка подтверждена');return;}
  }catch(err){msg(err.message||'Операция не выполнена');window.KaretaToast?.error?.(err.message||'Операция не выполнена');}});
  root.addEventListener('submit',async e=>{try{
    const wh=e.target.closest('[data-market-warehouse-form]');if(wh){e.preventDefault();const fd=new FormData(wh);await api().createWarehouse({title:String(fd.get('title')||''),address:String(fd.get('address')||'')});wh.reset();await load();msg('Склад создан');return;}
    const product=e.target.closest('[data-market-product-form]');if(product){e.preventDefault();const fd=new FormData(product);await api().createMarketProduct({title:String(fd.get('title')||''),sku:String(fd.get('sku')||''),price:String(fd.get('price')||'')});product.reset();await load();msg('Товар добавлен');return;}
  }catch(err){e.preventDefault();msg(err.message||'Операция не выполнена');window.KaretaToast?.error?.(err.message||'Операция не выполнена');}});
  root.querySelectorAll('dialog[data-market-dialog]').forEach(d=>{d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d);});d.addEventListener('click',e=>{if(e.target===d)closeDialog(d);});});
  await load();
}
window.KaretaMarketPages=Object.freeze({renderMarket,mountMarket});
})();
