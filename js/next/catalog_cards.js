(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₸`;

  const UI_ICONS = Object.freeze({"heart": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z\"></path></svg>", "comment": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z\"></path></svg>", "share": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3v12m0-12 4 4m-4-4L8 7\"></path><path d=\"M5 12v7h14v-7\"></path></svg>", "bookmark": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 3h12v18l-6-4-6 4V3Z\"></path></svg>", "message": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 5h16v12H8l-4 3V5Z\"></path><path d=\"M8 9h8M8 13h5\"></path></svg>", "user": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"4\"></circle><path d=\"M5 21a7 7 0 0 1 14 0\"></path></svg>", "star": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z\"></path></svg>", "cart": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 5h2l2 11h10l3-8H6\"></path><circle cx=\"9\" cy=\"20\" r=\"1.5\"></circle><circle cx=\"17\" cy=\"20\" r=\"1.5\"></circle></svg>", "image": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"></rect><circle cx=\"9\" cy=\"10\" r=\"2\"></circle><path d=\"m4 18 5-5 4 4 3-3 4 4\"></path></svg>"});
  const uiIcon=name=>`<span class="k-ui-icon" aria-hidden="true">${UI_ICONS[name]||''}</span>`;
  const date = value => { const d=new Date(String(value||'')); return Number.isNaN(d.getTime())?'':d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}); };

  function product(product, category={}){
    const href = `#/parts/item/${encodeURIComponent(product.id)}`;
    const title=product.name||'Товар';
    const source=product.store_name||product.seller_name||'KARETA.KZ';
    const initials=String(source).trim().split(/\s+/).slice(0,2).map(v=>v.charAt(0)).join('').toUpperCase();
    const stock=Number(product.stock_qty??product.stock??0);
    return `<article class="k-catalog-card k-catalog-card-product k-social-commerce-card" role="link" tabindex="0" data-product-href="${href}" aria-label="Открыть товар: ${esc(title)}">
      <header class="k-social-commerce-card__author"><span class="k-social-commerce-card__avatar">${esc(initials||'K')}</span><span class="k-social-commerce-card__author-copy"><b>${esc(source)}</b><small>${esc(category.name||'Запчасти и товары')}</small></span><button type="button" class="k-social-more" aria-label="Дополнительные действия"><span class="k-ui-more"><i></i><i></i><i></i></span></button></header>
      <a class="k-social-commerce-card__media" href="${href}" tabindex="-1">${product.image_url?`<img src="${esc(product.image_url)}" alt="${esc(title)}" loading="lazy" decoding="async" onerror="this.hidden=true"><span class="k-social-commerce-card__badge">${esc(category.name||'Товар')}</span>`:`<span class="k-social-card__placeholder">${uiIcon('image')}<small>Фото товара пока нет</small></span><span class="k-social-commerce-card__badge">${esc(category.name||'Товар')}</span>`}</a>
      <div class="k-social-commerce-card__body"><h3><a href="${href}">${esc(title)}</a></h3><p>${esc(product.brand||'')}${product.oem_number?` · OEM ${esc(product.oem_number)}`:''}</p><span class="k-social-commerce-card__source">${stock>0?'В наличии':'Уточнить наличие'}</span></div>
      <div class="k-social-commerce-card__price"><b>${money(product.price)}</b><small>${stock>0?`Остаток: ${esc(stock)}`:'Доступность у продавца'}</small></div>
      <footer class="k-social-commerce-card__actions"><button type="button" aria-label="Нравится">${uiIcon('heart')}</button><a href="${href}#comments" aria-label="Комментарии">${uiIcon('comment')}</a><span></span><button type="button" class="k-social-commerce-card__cart" data-shop-add="${esc(product.id)}">${uiIcon('cart')}<span>В корзину</span></button></footer>
    </article>`;
  }
  function service(service, meta={}){
    const price=service.minOfferPrice>0?`от ${money(service.minOfferPrice)}`:(service.priceLabel||money(service.basePrice));
    const time=service.timeLabel||service.avgTime||'По согласованию';
    const href=`#/services/item/${encodeURIComponent(service.id)}`;
    const iconKey=window.KaretaUIIcons?.categoryIcon?.(`${service.category||''} ${meta.name||''}`,meta.icon||'services')||meta.icon||'services';
    const iconMarkup=window.KaretaUIIcons?.svg?.(iconKey)||'';
    return `<article class="k-services-ref-card k-services-ref-card--service">
      <a class="k-services-ref-card__main" href="${href}" aria-label="Открыть услугу: ${esc(service.name)}">
        <span class="k-services-ref-card__service-icon" aria-hidden="true">${iconMarkup}</span>
        <span class="k-services-ref-card__copy"><small class="k-services-ref-card__category">${esc(meta.name||service.category||'Услуга')}</small><b>${esc(service.name)}</b><span>${esc(service.shortDesc||service.whyText||'Стоимость и объём работ подтверждаются перед началом ремонта.')}</span></span>
      </a>
      <div class="k-services-ref-card__facts"><span><small>Стоимость</small><b>${esc(price)}</b></span><span><small>Время</small><b>${esc(time)}</b></span></div>
      <footer class="k-services-ref-card__actions"><a href="${href}">Подробнее</a><button type="button" data-next-action="service-booking" data-service-id="${esc(service.id)}" data-service-name="${esc(service.name)}">Выбрать</button></footer>
    </article>`;
  }
  function news(item, options={}){
    const label=options.label||'Новости';
    return `<article class="k-catalog-card k-catalog-card-news ${item.featured?'is-featured':''}"><div class="k-catalog-card-media">${item.image_url?`<img src="${esc(item.image_url)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('is-placeholder');this.remove()">`:'<img class="k-catalog-brand-icon" src="assets/onboarding/kareta_logo_icon.png" alt="KARETA.KZ" loading="lazy">'}</div><div class="k-catalog-card-content"><div class="k-catalog-card-meta"><span>${esc(label)}</span><time>${esc(date(item.published_at||item.created_at))}</time></div><h3>${esc(item.title)}</h3><p>${esc(item.summary||item.content||'')}</p>${item.content?`<details><summary>Читать</summary><div>${esc(item.content).replace(/\n/g,'<br>')}</div></details>`:''}${options.admin||''}</div></article>`;
  }
  function work(item){
    const media=Array.isArray(item.media)?item.media:[]; const cover=item.coverUrl||media[0]?.fileUrl||'';
    const author=item.masterName||item.stoName||'KARETA.KZ';
    const href=`#/works/item/${encodeURIComponent(item.id)}`;
    const likes=Number(item.likesCount||0), comments=Number(item.commentsCount||0), views=Number(item.viewsCount||0);
    return `<article class="k-social-card k-social-work-card" data-work-post="${esc(item.id)}"><header class="k-social-card__author"><span class="k-social-avatar">${esc(author).slice(0,1).toUpperCase()}</span><span><b>${esc(author)}</b><small>${esc(item.serviceLabel||item.vehicleLabel||'Автосервис')}</small></span><time>${esc(date(item.publishedAt))}</time><button class="k-social-more" type="button" aria-label="Меню публикации"><span class="k-ui-more"><i></i><i></i><i></i></span></button></header><a class="k-social-card__media" href="${href}">${cover?`<img src="${esc(cover)}" alt="${esc(item.title)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="k-social-card__placeholder" hidden>${uiIcon('image')}<small>Фотография недоступна</small></span>`:`<span class="k-social-card__placeholder">${uiIcon('image')}<small>Фотография пока не добавлена</small></span>`}</a><div class="k-social-card__actions"><div class="k-social-card__actions-left"><button type="button" data-work-like="${esc(item.id)}" class="${Number(item.likedByMe)?'is-liked':''}" aria-label="Нравится">${uiIcon('heart')}</button><a href="${href}#comments" aria-label="Комментарии">${uiIcon('comment')}</a><button type="button" data-work-share="${esc(item.id)}" aria-label="Поделиться">${uiIcon('share')}</button></div><button type="button" class="k-social-save ${Number(item.savedByMe||item.saved_by_me)?'is-active':''}" data-work-save="${esc(item.id)}" aria-label="Сохранить">${uiIcon('bookmark')}</button></div><div class="k-social-card__metrics"><b data-work-like-count>${likes} нравится</b><span>${comments} комментариев</span><span>${views} просмотров</span></div><div class="k-social-card__body"><h3><a href="${href}">${esc(item.title)}</a></h3><p>${esc(item.summary||'Работа выполнена и подтверждена заказ-нарядом.')}</p><a class="k-social-card__comments-link" href="${href}#comments">Открыть обсуждение</a></div></article>`;
  }

  window.KaretaCatalogCards=Object.freeze({product,service,news,work,esc,money,date});
})();
