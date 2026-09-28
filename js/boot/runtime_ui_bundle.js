/* KARETA R188.5.5.6.84.85 GENERATED BOOT BUNDLE — source order preserved. */
window.KaretaBootProfiler?.bundleStart?.("runtime_ui_bundle","js/boot/runtime_ui_bundle.js");

/* SOURCE: js/next/page_ui.js */
(() => {
  'use strict';

  function escHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;',
    })[ch]);
  }

  function panelMetric(value, label, attrs = ''){
    return `<div class="k-db-metric" ${attrs}><b>${escHtml(value)}</b><span>${escHtml(label)}</span></div>`;
  }

  function databasePanel(options = {}){
    const eyebrow = escHtml(options.eyebrow || 'ДАННЫЕ ПЛАТФОРМЫ');
    const title = escHtml(options.title || 'Рабочая база');
    const text = escHtml(options.text || 'Здесь отображаются актуальные данные из базы KARETA.KZ.');
    const metrics = Array.isArray(options.metrics) && options.metrics.length
      ? options.metrics.map(metric => panelMetric(metric.value ?? '—', metric.label || '', metric.attrs || '')).join('')
      : panelMetric('—', 'Загрузка', 'data-db-default-metric');
    const actions = options.actions || '';
    const status = escHtml(options.status || 'Данные обновляются автоматически');

    return `<aside class="k-panel k-context-panel k-database-panel" ${options.attrs || ''}>
      
      <h2 class="k-section-title">${title}</h2>
      <p class="k-subtitle">${text}</p>
      <div class="k-db-metrics">${metrics}</div>
      <div class="k-db-status" data-db-panel-status>${status}</div>
      ${actions ? `<div data-layout="actions-row" class="k-context-actions">${actions}</div>` : ''}
    </aside>`;
  }

  function contextPanel(options = {}){
    const items = Array.isArray(options.items) ? options.items : [];
    return `<aside class="k-panel k-context-panel" ${options.attrs || ''}>
      
      <h2 class="k-section-title">${escHtml(options.title || 'Что здесь доступно')}</h2>
      <p class="k-subtitle">${escHtml(options.text || 'Основные действия и актуальная информация страницы.')}</p>
      ${items.length ? `<ul class="k-context-list">${items.map(item => `<li><span>${escHtml(item.icon || '✓')}</span><div><b>${escHtml(item.title || '')}</b><small>${escHtml(item.text || '')}</small></div></li>`).join('')}</ul>` : ''}
      ${options.actions ? `<div data-layout="actions-row" class="k-context-actions">${options.actions}</div>` : ''}
    </aside>`;
  }

  function masterPageHeader(title, subtitle = '', opts = {}){
    const eyebrow = opts.eyebrow || 'МАСТЕР';
    const actions = opts.actions || '';
    const attrs = opts.attrs || '';
    return `<header class="k-master-page-header" ${attrs}>
      <div class="k-master-page-header__copy">
        ${eyebrow ? `<small>${escHtml(eyebrow)}</small>` : ''}
        <h1>${escHtml(title)}</h1>
        ${subtitle ? `<p>${escHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="k-master-page-header__actions" data-layout="actions-row">${actions}</div>` : ''}
    </header>`;
  }

  function pageShell(context, title, subtitle, body, opts = {}){
    const eyebrow = opts.eyebrow || 'KARETA.KZ';
    const actions = opts.actions || '';
    const page = String(opts.page || 'page');
    const publicLike = /^(about|rules|help|privacy|contacts|info|platform|core-platform)(?:\s|$)/.test(page);
    const workspace = opts.workspace !== false && !publicLike;
    const rootRole=String(document.documentElement?.dataset?.userRole || '').toLowerCase();
    const navContext=String(document.documentElement?.dataset?.navigationContext || '').toLowerCase();
    const masterSurface = workspace && (rootRole === 'master' || navContext === 'master');
    const masterPageClass = masterSurface ? ' k-master-page k-master-surface-page' : '';
    const chromeHeader = opts.chromeHeader !== false;
    const chromeClass = chromeHeader ? '' : ' k-page-shell--chromeless';
    const masterHeadClass = masterSurface ? ' k-master-page-header' : '';

    if (workspace) {
      const header = !chromeHeader ? '' : masterSurface
        ? masterPageHeader(title, subtitle, { eyebrow, actions })
        : `<header class="k-workspace-head${masterHeadClass}"><div class="k-workspace-head__copy"><small>${escHtml(eyebrow)}</small><h1>${escHtml(title)}</h1>${subtitle ? `<p>${escHtml(subtitle)}</p>` : ''}</div>${actions ? `<div class="k-workspace-head__actions" data-layout="actions-row">${actions}</div>` : ''}</header>`;
      return `<section class="k-page k-page-shell--workspace${chromeClass}${masterPageClass}" data-page="${escHtml(page)}">
        ${header}
        ${body}
      </section>`;
    }

    const sidePanel = opts.panel || contextPanel({
      eyebrow:'РАБОЧАЯ ОБЛАСТЬ',
      title:'Следующее действие',
      text:'Выберите нужный раздел или продолжите работу с данными на этой странице.',
      items:[
        { icon:'✓', title:'Актуальные данные', text:'Информация загружается из серверной базы.' },
        { icon:'→', title:'Без лишних экранов', text:'Основные действия доступны прямо в текущем разделе.' },
      ],
    });

    return `<section class="k-page" data-page="${escHtml(page)}">
      <div class="k-page-hero k-hero">
        <div class="k-panel k-primary-panel">
          <h1 class="k-title">${escHtml(title)}</h1>
          <p class="k-subtitle">${escHtml(subtitle)}</p>
          ${actions ? `<div data-layout="actions-row" style="margin-top:18px">${actions}</div>` : ''}
        </div>
        ${sidePanel}
      </div>
      ${body}
    </section>`;
  }

  function card(icon, title, text, action = ''){
    return `<article class="k-card" data-layout="card">
      <div data-layout="card-layout">
        <span class="k-card-icon" aria-hidden="true">${escHtml(icon)}</span>
        <div>
          <h3>${escHtml(title)}</h3>
          <p>${escHtml(text)}</p>
        </div>
      </div>
      ${action ? `<div data-layout="actions-row">${action}</div>` : ''}
    </article>`;
  }

  function placeholderPage(context, title, page, text, icon){
    return pageShell(
      context,
      title,
      text,
      `<section class="k-empty">
        <h2 class="k-section-title">${escHtml(icon)} ${escHtml(title)}</h2>
        <p>Раздел подключён к новому каркасу и будет наполняться данными своего домена.</p>
      </section>`,
      {
        page,
        eyebrow:'РАЗДЕЛ ПЛАТФОРМЫ',
        panel:contextPanel({
          eyebrow:'НАЗНАЧЕНИЕ',
          title,
          text,
          items:[
            { icon, title:'Отдельный домен', text:'Страница не управляет общей оболочкой приложения.' },
            { icon:'↻', title:'Готово к данным', text:'API и состояние подключаются без перерисовки меню.' },
          ],
        }),
      }
    );
  }

  window.KaretaPageUI = Object.freeze({
    escHtml,
    masterPageHeader,
    pageShell,
    card,
    placeholderPage,
    databasePanel,
    contextPanel,
    panelMetric,
  });
})();
;

/* SOURCE: js/next/catalog_cards.js */
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
;

/* SOURCE: js/next/social_cards.js */
(() => {
  'use strict';
  const uiIcon=name=>window.KaretaUIIcons?.icon(name)||'';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  const number = value => new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(value || 0)));

  function initials(name){
    const parts=String(name||'KARETA').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0,2).map(part=>part[0]).join('').toUpperCase() || 'K';
  }

  function media(item={}){
    const src=item.image||item.imageUrl||item.coverUrl||item.cover_url||item.image_url||'';
    const alt=esc(item.title||item.name||'Публикация');
    if(!src) return `<div class="k-social-card-v2__placeholder" aria-hidden="true"><span>K</span><small>KARETA.KZ</small></div>`;
    return `<img src="${esc(src)}" alt="${alt}" loading="lazy" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add('is-placeholder')">`;
  }

  function render(item={}, options={}){
    const type=options.type||item.type||'post';
    const author=item.author||item.authorName||item.sellerName||item.category_name||'KARETA.KZ';
    const eyebrow=item.eyebrow||item.category||item.vehicleLabel||item.vehicle_label||options.eyebrow||'Публикация';
    const title=item.title||item.name||'Без названия';
    const summary=item.summary||item.intro||item.description||'';
    const href=options.href||item.href||'#';
    const likes=number(item.likesCount||item.likes_count||item.likes);
    const comments=number(item.commentsCount||item.comments_count||item.comments);
    const views=number(item.viewsCount||item.views_count||item.views);
    const price=Number(item.price||0);
    const meta=price>0?`${number(price)} ₸`:(item.meta||`${likes} нравится · ${views} просмотров`);

    return `<article class="k-social-card-v2 k-social-card-v2--${esc(type)}">
      <header class="k-social-card-v2__header">
        <span class="k-social-card-v2__avatar" aria-hidden="true">${esc(initials(author))}</span>
        <span class="k-social-card-v2__identity"><b>${esc(author)}</b><small>${esc(eyebrow)}</small></span>
        <button class="k-social-card-v2__more" type="button" aria-label="Дополнительные действия">•••</button>
      </header>
      <a class="k-social-card-v2__media" href="${esc(href)}" tabindex="-1">${media(item)}</a>
      <div class="k-social-card-v2__body">
        <small class="k-social-card-v2__eyebrow">${esc(eyebrow)}</small>
        <h3><a href="${esc(href)}">${esc(title)}</a></h3>
        ${summary?`<p>${esc(summary)}</p>`:''}
        <div class="k-social-card-v2__meta"><b>${esc(meta)}</b><span>${comments} комментариев</span></div>
      </div>
      <footer class="k-social-card-v2__actions">
        <button type="button" class="k-social-action" aria-label="Нравится" aria-pressed="false">${uiIcon('heart')}<span>Нравится</span><small>${likes}</small></button>
        <a href="${esc(href)}" aria-label="Комментарии"><span>◌</span><small>${comments}</small></a>
        <button type="button" aria-label="Поделиться"><span>↗</span><small>Поделиться</small></button>
        <button type="button" aria-label="Сохранить"><span>⌑</span></button>
      </footer>
    </article>`;
  }

  window.KaretaSocialCards=Object.freeze({render,esc,initials});
})();
;

/* SOURCE: js/next/workflow_engine.js */
(() => {
  'use strict';
  const STAGES = Object.freeze([
    {key:'draft',label:'Черновик',progress:5},
    {key:'new',label:'Опубликована',progress:14},
    {key:'waiting_responses',label:'Отклики',progress:28},
    {key:'accepted',label:'Исполнитель выбран',progress:42},
    {key:'assigned',label:'Диагностика',progress:55},
    {key:'in_progress',label:'В работе',progress:72},
    {key:'completed',label:'Готово',progress:90},
    {key:'paid',label:'Оплачено',progress:96},
    {key:'closed',label:'Закрыто',progress:100}
  ]);
  const aliases=Object.freeze({cancelled:'closed',warranty_return:'in_progress'});
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const stageIndex=status=>Math.max(0,STAGES.findIndex(s=>s.key===(aliases[status]||status)));
  const stageFor=status=>STAGES[stageIndex(status)]||STAGES[1];
  const progressFor=status=>stageFor(status).progress;
  function renderPipeline(status,{compact=false}={}){
    const current=stageIndex(status);
    return `<div class="k-workflow-pipeline ${compact?'is-compact':''}" aria-label="Этапы заявки">${STAGES.map((s,i)=>`<div class="k-workflow-step ${i<current?'is-done':i===current?'is-current':''}"><span>${i<current?'✓':i+1}</span><small>${esc(s.label)}</small></div>`).join('')}</div>`;
  }
  function timelineFromOrder(order={}){
    const created=order.createdAt||order.created_at||'Сегодня';
    const status=aliases[order.status]||order.status||'new';
    const current=stageIndex(status);
    return STAGES.slice(0,current+1).map((s,i)=>({
      key:s.key,label:s.label,date:i===0?created:(i===current?'Текущий этап':'Завершено'),active:i===current
    })).reverse();
  }
  function renderTimeline(order={}){
    return `<ol class="k-workflow-timeline">${timelineFromOrder(order).map(item=>`<li class="${item.active?'is-active':''}"><span></span><div><strong>${esc(item.label)}</strong><small>${esc(item.date)}</small></div></li>`).join('')}</ol>`;
  }
  window.KaretaWorkflowEngine=Object.freeze({STAGES,stageFor,stageIndex,progressFor,renderPipeline,timelineFromOrder,renderTimeline});
})();
;

/* SOURCE: js/next/core/ui_kit.js */
(() => { 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const attrs=obj=>Object.entries(obj||{}).filter(([,v])=>v!==false&&v!==null&&v!==undefined).map(([k,v])=>v===true?esc(k):`${esc(k)}="${esc(v)}"`).join(' ');
 const badge=(text,tone='neutral')=>`<span class="k-ui-badge k-ui-badge--${esc(tone)}">${esc(text)}</span>`;
 const button=(text,{tone='secondary',icon='',attributes={}}={})=>`<button class="k-btn k-btn--${esc(tone)}" ${attrs(attributes)}>${icon?`<span aria-hidden="true">${esc(icon)}</span>`:''}<span>${esc(text)}</span></button>`;
 const card=({title='',meta='',body='',actions='',className='',eyebrow=''})=>`<article class="k-ui-card ${esc(className)}"><header>${eyebrow?`<span class="k-ui-card__eyebrow">${esc(eyebrow)}</span>`:''}<div><h3>${esc(title)}</h3>${meta?`<p>${esc(meta)}</p>`:''}</div></header><div class="k-ui-card__body">${body}</div>${actions?`<footer>${actions}</footer>`:''}</article>`;
 const empty=(title='Пока нет данных',text='')=>`<div class="k-ui-empty"><strong>${esc(title)}</strong>${text?`<p>${esc(text)}</p>`:''}</div>`;
 const error=(title='Не удалось загрузить',text='')=>`<div class="k-ui-error"><strong>${esc(title)}</strong>${text?`<p>${esc(text)}</p>`:''}</div>`;
 const skeleton=(rows=3)=>`<div class="k-ui-skeleton" aria-busy="true">${Array.from({length:rows},()=>'<span></span>').join('')}</div>`;
 const avatar=(name='',src='')=>src?`<img class="k-ui-avatar" src="${esc(src)}" alt="${esc(name)}">`:`<span class="k-ui-avatar k-ui-avatar--fallback">${esc(String(name).trim().charAt(0).toUpperCase()||'K')}</span>`;
 const money=(amount,currency='KZT')=>`${Number(amount||0).toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:2})} ${esc(currency)}`;
 const timeline=items=>`<ol class="k-ui-timeline">${(items||[]).map(x=>`<li><span class="k-ui-timeline__dot"></span><div><strong>${esc(x.title||x.eventType||'Событие')}</strong><p>${esc(x.text||x.meta||'')}</p><time>${esc(x.time||x.occurredAt||'')}</time></div></li>`).join('')}</ol>`;
 const tabs=(items,active='')=>`<div class="k-ui-tabs" role="tablist">${(items||[]).map(x=>`<button role="tab" aria-selected="${String(x.id===active)}" data-tab="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div>`;
 window.KaretaUIKit=Object.freeze({esc,attrs,badge,button,card,empty,error,skeleton,avatar,money,timeline,tabs});
})();
;

/* SOURCE: js/next/api_client.js */
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
  const PERSIST_PREFIX='kareta.api.cache.v2:';

  // Shared safe-request gate for the monolithic DB endpoint. Some production hosts
  // answer concurrent PHP bursts with HTTP 429 before db.php itself runs.
  // GET reads enter automatically. POST calls enter only when a wrapper explicitly
  // marks the operation dbSafeReplay=true (read-like or idempotent mutation).
  const DB_READ_MIN_GAP_MS = 300;
  const DB_READ_RETRY_DEFAULT_MS = 900;
  const DB_READ_RETRY_MAX_MS = 3000;
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
      if (dedupe && result.ok && cacheTtlMs > 0) { const record={ at:Date.now(), result }; memoryCache.set(key,record); writePersistent(key,record); }
      if(dedupe && !result.ok){const stale=memoryCache.get(key)||readPersistent(key);if(stale?.result)return cloneResult(stale.result,{fromCache:true,stale:true});}
      return result;
    }).catch(error=>{const stale=dedupe?(memoryCache.get(key)||readPersistent(key)):null;if(stale?.result)return cloneResult(stale.result,{fromCache:true,stale:true,networkError:String(error?.message||error)});throw error;}).finally(() => {
      if (dedupe) inFlight.delete(key);
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
;

/* SOURCE: js/next/core/realtime_client.js */
(function(){
  'use strict';
  const RELEASE=String(window.KARETA_NEXT_ASSET_VERSION||'dev');
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
    if(document.hidden||!navigator.onLine)return schedulePoll(10000);
    setStatus('polling');channel?.postMessage({type:'status',userId,contextId,mode:'polling'});
    try{
      const res=await fetch(`/api/realtime.php?mode=poll&cursor=${cursor()}&clientId=${encodeURIComponent(clientId)}`,{credentials:'same-origin',cache:'no-store'});
      if(res.status===401)return stop();
      const json=await res.json();if(!res.ok||!json?.ok)throw new Error('poll_failed');
      const data=json.data||{};(data.events||[]).forEach(e=>deliver(e,{unreadCount:data.unreadCount,source:'poll'}));
      if(Number(data.cursor||0)>cursor())setCursor(data.cursor);failures=0;schedulePoll(10000);
    }catch(_e){failures++;setStatus('offline',{failures});schedulePoll(Math.min(60000,5000*Math.max(1,failures)));}
  }
  function connect(){
    if(!started||!isLeader()||document.hidden||!navigator.onLine)return;
    stopTransport();
    if(!('EventSource' in window))return poll();
    setStatus('connecting');channel?.postMessage({type:'status',userId,contextId,mode:'connecting'});
    source=new EventSource(`/api/realtime.php?cursor=${cursor()}&clientId=${encodeURIComponent(clientId)}`);
    source.addEventListener('open',()=>{failures=0;setStatus('live');channel?.postMessage({type:'status',userId,contextId,mode:'live'});});
    source.addEventListener('domain',e=>{try{const d=JSON.parse(e.data||'{}');deliver(d.event,{unreadCount:d.unreadCount,source:'sse'});}catch(_e){}});
    source.addEventListener('heartbeat',e=>{try{const d=JSON.parse(e.data||'{}');if(Number(d.cursor||0)>cursor())setCursor(d.cursor);setStatus('live',{unreadCount:Number(d.unreadCount||0)});}catch(_e){}});
    source.onerror=()=>{try{source?.close();}catch(_e){}source=null;failures++;if(failures>=2)return poll();setStatus('reconnecting',{failures});reconnectTimer=setTimeout(connect,Math.min(20000,3000*failures));};
  }
  function start(event){
    const identity=window.KaretaIdentity?.snapshot?.()||{};
    const legacyConfirmed=event?.detail?.legacy===true;
    if(!identity.authenticated&&!legacyConfirmed){setStatus('waiting',{reason:'session_not_verified'});return;}
    const nextUserId=Number(identity.account?.id||event?.detail?.user?.id||window.KaretaAppState?.user?.id||0);
    const nextContextId=Number(identity.context?.id||0);
    const nextRevision=Number(identity.revision||0);
    if(!nextUserId)return;
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
;

/* SOURCE: js/next/social_state.js */
(() => {
  'use strict';
  const EVENT='kareta:social-state',STORAGE='kareta.social.cache.v2',TTL=5*60*1000,listeners=new Set();
  let state=read();
  function read(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'{}');return {following:x.following||{},posts:x.posts||{},saved:Array.isArray(x.saved)?x.saved:[],updatedAt:Number(x.updatedAt||0),serverAt:Number(x.serverAt||0)};}catch(_e){return {following:{},posts:{},saved:[],updatedAt:0,serverAt:0};}}
  function persist(){state.updatedAt=Date.now();try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(_e){}}
  function notify(type,detail={}){const payload={type,...detail,updatedAt:Date.now()};listeners.forEach(fn=>{try{fn(payload);}catch(_e){}});try{window.dispatchEvent(new CustomEvent(EVENT,{detail:payload}));}catch(_e){}}
  const key=(type,id)=>`${String(type||'master')}:${String(id||'')}`;
  function provider(type,id){return state.following[key(type,id)]||null;}
  function isFollowing(type,id){return !!provider(type,id)?.following;}
  function setFollowing(type,id,following,extra={}){if(!id)return;const k=key(type,id);state.following[k]={...(state.following[k]||{}),...extra,type:String(type||'master'),id:String(id),following:!!following};persist();notify('provider.following',{providerType:type,providerId:String(id),following:!!following,provider:state.following[k]});}
  function setProviderSetting(type,id,field,value){if(!id||!field)return;const k=key(type,id);state.following[k]={...(state.following[k]||{}),type:String(type||'master'),id:String(id),following:state.following[k]?.following!==false,[field]:value};persist();notify('provider.setting',{providerType:type,providerId:String(id),field,value,provider:state.following[k]});}
  function replaceFollowing(rows=[]){const next={};rows.forEach(row=>{const type=String(row.type||row.entityType||'master'),id=String(row.id||row.master_id||row.sto_id||'');if(id)next[key(type,id)]={...(row.social_state||{}),type,id,name:row.name||'',following:true};});state.following=next;state.serverAt=Date.now();persist();notify('following.replace',{rows});}
  function followingKeys(){return new Set(Object.entries(state.following).filter(([,x])=>x?.following).map(([k])=>k));}
  function getPost(id){const k=String(id),row=state.posts[k]||{};return {liked:!!row.liked,likes:Number(row.likes||0),comments:Array.isArray(row.comments)?row.comments:[],commentsCount:Number(row.commentsCount||0),saved:state.saved.includes(k),source:row.source||'cache'};}
  function patchPost(id,patch={}){if(!id)return;const k=String(id),cur=getPost(k);state.posts[k]={...cur,...patch,comments:Array.isArray(patch.comments)?patch.comments:cur.comments};persist();notify('post.change',{postId:k,post:getPost(k)});}
  function setSaved(id,saved,_meta={}){const k=String(id);state.saved=state.saved.filter(x=>String(x)!==k);if(saved)state.saved.push(k);state.posts[k]={...(state.posts[k]||{}),saved:!!saved,source:_meta.source||state.posts[k]?.source||'cache'};persist();notify('post.saved',{postId:k,saved:!!saved,post:getPost(k)});}
  function toggleSaved(id){const next=!state.saved.includes(String(id));setSaved(id,next);return next;}
  const isSaved=id=>state.saved.includes(String(id)); const savedKeys=()=>new Set(state.saved.map(String));
  function hydrateServer(payload={}){const posts=payload.posts&&typeof payload.posts==='object'?payload.posts:{};Object.entries(posts).forEach(([id,row])=>{state.posts[id]={...(state.posts[id]||{}),...row,source:'server'};});state.saved=Array.isArray(payload.saved)?Array.from(new Set(payload.saved.map(String))):state.saved;state.serverAt=Date.now();persist();notify('server.hydrate',{count:Object.keys(posts).length});}
  async function sync(options={}){if(!options.force&&Date.now()-state.serverAt<TTL)return state;const api=window.KaretaApiClient;if(!api?.getWorkPostSocialState)return state;try{const r=await api.getWorkPostSocialState({signal:options.signal});if(r?.ok)hydrateServer(r.payload?.data||r.data||{});}catch(e){if(e?.name!=='AbortError')notify('server.error',{message:e?.message||'sync_failed'});}return state;}
  function on(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);} function refreshFromStorage(){state=read();notify('storage.sync');}
  window.addEventListener('storage',e=>{if(e.key===STORAGE)refreshFromStorage();});
  window.KaretaSocialState=Object.freeze({EVENT,on,provider,isFollowing,setFollowing,setProviderSetting,replaceFollowing,followingKeys,getPost,patchPost,setSaved,toggleSaved,isSaved,savedKeys,hydrateServer,sync,refreshFromStorage});
})();
;

/* SOURCE: js/next/runtime_integrity.js */
(() => {
  'use strict';
  const VERSION = String(window.KARETA_NEXT_ASSET_VERSION || 'r168');
  const endpoint = '/api/client_error.php';
  let sent = 0;
  let healthPromise = null;
  let healthCachedAt = 0;
  let healthCachedValue = null;
  const HEALTH_CACHE_MS = 60000;

  function currentRole(){
    try { return window.KaretaRoleAccess?.currentRole?.() || window.KaretaNext?.state?.user?.role || ''; }
    catch (_error) { return ''; }
  }

  function report(payload){
    if (sent >= 10) return;
    sent += 1;
    const body = JSON.stringify({ ...payload, url:location.href, role:currentRole(), version:VERSION });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type:'application/json' }));
        return;
      }
    } catch (_error) {}
    fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true, cache:'no-store' }).catch(() => {});
  }

  if (!window.__KARETA_ERROR_BOUNDARY__) {
    window.__KARETA_ERROR_BOUNDARY__ = 'runtime_integrity';
    window.addEventListener('error', event => {
      const target = event.target;
      if (target && target !== window && (target.src || target.href)) {
        report({ message:'resource_load_failed', source:target.src || target.href });
        return;
      }
      report({ message:event.message || 'window_error', source:event.filename || '', line:event.lineno || 0, column:event.colno || 0, stack:event.error?.stack || '' });
    }, true);
    window.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      report({ message:String(reason?.message || reason || 'unhandled_rejection'), stack:String(reason?.stack || '') });
    });
  }

  async function readJsonResponse(response){
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch (_error) {
      const error = new Error('runtime_health_invalid_json');
      error.status = response.status;
      error.preview = text.slice(0, 180);
      throw error;
    }
    if (!response.ok && !data) throw Object.assign(new Error('runtime_health_http_error'), { status:response.status });
    return data || { ok:false, error:'empty_response' };
  }

  function health(options = {}){
    const force = options.force === true;
    if (!force && healthCachedValue && (Date.now() - healthCachedAt) < HEALTH_CACHE_MS) {
      return Promise.resolve(healthCachedValue);
    }
    if (healthPromise) return healthPromise;
    healthPromise = (async () => {
      try {
        const response = await fetch('/api/runtime_health.php', { cache:'no-store', credentials:'same-origin', headers:{ Accept:'application/json' } });
        const data = await readJsonResponse(response);
        healthCachedAt = Date.now();
        healthCachedValue = data;
        window.KaretaRuntimeHealth = data;
        window.dispatchEvent(new CustomEvent('kareta:runtime-health', { detail:data }));
        return data;
      } catch (error) {
        // Runtime health is diagnostic only. It must never block onboarding or application boot.
        report({ message:'runtime_health_request_failed', stack:error?.stack || String(error), source:error?.preview || '' });
        return null;
      }
    })().finally(() => { healthPromise = null; });
    return healthPromise;
  }

  window.KaretaRuntimeIntegrity = Object.freeze({ health, report });
})();
;

/* SOURCE: js/next/toast.js */
(() => {
  'use strict';
  let host=null;
  function ensure(){ if(host&&host.isConnected)return host; host=document.createElement('div');host.className='k-toast-host';host.setAttribute('aria-live','polite');document.body.appendChild(host);return host;}
  function show(message,type='info',timeout=3200){const text=String(message||'').trim();if(!text)return;const el=document.createElement('div');el.className=`k-toast k-toast--${type}`;el.innerHTML=`<span>${text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span><button type="button" aria-label="Закрыть">×</button>`;ensure().appendChild(el);const close=()=>{el.classList.add('is-leaving');setTimeout(()=>el.remove(),180)};el.querySelector('button').addEventListener('click',close);setTimeout(close,Math.max(1200,timeout));}
  window.KaretaToast=Object.freeze({show,success:m=>show(m,'success'),error:m=>show(m,'error'),info:m=>show(m,'info')});
})();
;

/* SOURCE: js/next/native_dialogs.js */
(() => {
  'use strict';

  if (window.__KARETA_NATIVE_DIALOGS__) return;
  window.__KARETA_NATIVE_DIALOGS__ = { version:'R188.5.5.6.84' };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let dialog = null;
  let resolver = null;
  let trigger = null;

  function ensure(){
    if (dialog?.isConnected) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'k-native-confirm';
    dialog.setAttribute('data-kareta-native-confirm','');
    dialog.innerHTML = `<form method="dialog" class="k-native-confirm__surface">
      <header><div><small data-native-confirm-eyebrow>ПОДТВЕРЖДЕНИЕ</small><h2 data-native-confirm-title>Подтвердить действие</h2></div><button type="button" data-native-confirm-close aria-label="Закрыть">×</button></header>
      <div class="k-native-confirm__body"><p data-native-confirm-message></p><div class="k-native-confirm__detail" data-native-confirm-detail hidden></div></div>
      <footer><button type="button" class="k-btn k-btn-secondary" data-native-confirm-cancel>Отмена</button><button type="button" class="k-btn k-btn-primary" data-native-confirm-accept>Продолжить</button></footer>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    dialog.addEventListener('click',event=>{if(event.target===dialog || event.target.closest('[data-native-confirm-close],[data-native-confirm-cancel]'))finish(false);});
    dialog.querySelector('[data-native-confirm-accept]')?.addEventListener('click',()=>finish(true));
    return dialog;
  }

  function finish(value){
    if (!dialog) return;
    if (dialog.open) { try { dialog.close(); } catch (_e) {} }
    const done = resolver; resolver = null;
    const node = trigger; trigger = null;
    try { node?.focus?.({preventScroll:true}); } catch (_e) {}
    if (done) done(Boolean(value));
  }

  function confirm(options = {}){
    const d = ensure();
    if (resolver) finish(false);
    trigger = options.trigger || document.activeElement;
    d.querySelector('[data-native-confirm-eyebrow]').textContent = String(options.eyebrow || 'ПОДТВЕРЖДЕНИЕ');
    d.querySelector('[data-native-confirm-title]').textContent = String(options.title || 'Подтвердить действие');
    d.querySelector('[data-native-confirm-message]').textContent = String(options.message || 'Продолжить?');
    const detail = d.querySelector('[data-native-confirm-detail]');
    if (detail) {
      const text = String(options.detail || '').trim();
      detail.hidden = !text;
      detail.textContent = text;
    }
    const accept = d.querySelector('[data-native-confirm-accept]');
    accept.textContent = String(options.confirmLabel || 'Продолжить');
    accept.classList.toggle('is-danger', options.danger === true);
    if (!d.open) d.showModal();
    requestAnimationFrame(()=>accept?.focus?.({preventScroll:true}));
    return new Promise(resolve => { resolver = resolve; });
  }

  window.KaretaNativeDialogs = Object.freeze({ confirm, close:()=>finish(false), isOpen:()=>Boolean(dialog?.open) });
})();
;

/* SOURCE: js/next/swiper_loader.js */
(() => {
  'use strict';

  const CSS_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
  const JS_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
  let started = false;

  function injectCss() {
    if (document.querySelector('link[data-kareta-swiper]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    link.dataset.karetaSwiper = '1';
    link.media = 'print';
    link.onload = () => { link.media = 'all'; };
    link.onerror = () => { link.remove(); };
    document.head.appendChild(link);
  }

  function load() {
    if (typeof window.Swiper === 'function') return Promise.resolve(window.Swiper);
    if (window.KaretaSwiperReady) return window.KaretaSwiperReady;

    window.KaretaSwiperReady = new Promise(resolve => {
      if (started) { resolve(null); return; }
      started = true;
      injectCss();
      const script = document.createElement('script');
      script.src = JS_URL;
      script.async = true;
      script.dataset.karetaSwiper = '1';
      const done = value => resolve(value || null);
      script.onload = () => done(typeof window.Swiper === 'function' ? window.Swiper : null);
      script.onerror = () => { script.remove(); done(null); };
      document.head.appendChild(script);
      window.setTimeout(() => done(typeof window.Swiper === 'function' ? window.Swiper : null), 7000);
    });
    return window.KaretaSwiperReady;
  }

  window.KaretaSwiperLoader = Object.freeze({ load });
  if ('requestIdleCallback' in window) requestIdleCallback(() => load(), { timeout:1500 });
  else window.setTimeout(load, 0);
})();
;

/* SOURCE: js/next/slider_runtime.js */
(() => {
  'use strict';

  const BASE = Object.freeze({
    cssMode: false,
    simulateTouch: true,
    allowTouchMove: true,
    grabCursor: true,
    threshold: 5,
    touchRatio: 1,
    resistance: true,
    resistanceRatio: 0.85,
    touchStartPreventDefault: false,
    touchMoveStopPropagation: false,
    passiveListeners: true,
    nested: true,
    preventClicks: true,
    preventClicksPropagation: true,
    watchOverflow: true,
    observer: true,
    observeParents: true,
    observeSlideChildren: true,
    updateOnWindowResize: true,
    resizeObserver: true
  });

  const instances = new WeakMap();
  const dragCleanup = new WeakMap();
  const resizeCleanup = new WeakMap();
  const diagnostics = new WeakMap();

  function options(extra = {}) {
    return Object.assign({}, BASE, extra);
  }

  function sliderNodes(root, selector) {
    const result = [];
    if (!root) return result;
    if (root.nodeType === 1 && root.matches?.(selector)) result.push(root);
    root.querySelectorAll?.(selector).forEach(node => result.push(node));
    return result;
  }

  function clearSwiperInlineState(slider) {
    if (!slider) return;
    slider.style.removeProperty('overflow');
    slider.style.removeProperty('touch-action');
    const wrapper = slider.querySelector(':scope > .swiper-wrapper, .swiper-wrapper');
    if (wrapper) {
      wrapper.style.removeProperty('transform');
      wrapper.style.removeProperty('transition-duration');
      wrapper.style.removeProperty('transition-delay');
      wrapper.style.removeProperty('height');
    }
    slider.querySelectorAll('.swiper-slide').forEach(slide => {
      slide.style.removeProperty('width');
      slide.style.removeProperty('margin-right');
      slide.style.removeProperty('margin-left');
      slide.style.removeProperty('transform');
    });
  }

  function bindResize(slider, instance) {
    resizeCleanup.get(slider)?.();
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!document.contains(slider) || instance.destroyed) return;
        try {
          instance.updateSize?.();
          instance.updateSlides?.();
          instance.updateProgress?.();
          instance.updateSlidesClasses?.();
          instance.update?.();
        } catch (_) {}
      });
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    ro?.observe(slider);
    window.addEventListener('orientationchange', update, { passive: true });
    resizeCleanup.set(slider, () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener('orientationchange', update);
      resizeCleanup.delete(slider);
    });
  }

  function destroy(slider, cleanStyles = true) {
    if (!slider) return;
    const instance = instances.get(slider) || slider.swiper;
    resizeCleanup.get(slider)?.();
    if (instance && !instance.destroyed) {
      try { instance.destroy(true, cleanStyles); } catch (_) {}
    }
    instances.delete(slider);
    slider.classList.remove('is-swiper-ready', 'is-ready');
    delete slider.dataset.sliderReady;
  }

  function activateFallback(slider, root = document) {
    if (!slider) return;
    destroy(slider, true);
    clearSwiperInlineState(slider);
    slider.classList.add('is-native-fallback');
    slider.classList.remove('is-swiper-ready', 'is-ready');
    slider.setAttribute('data-native-horizontal-slider', '1');
    slider.dataset.sliderReady = 'fallback';
    enableNativeDrag(root || slider.parentElement || slider);
  }

  function deactivateFallback(slider) {
    if (!slider) return;
    slider.classList.remove('is-native-fallback', 'is-pointer-down');
    slider.removeAttribute('data-native-horizontal-slider');
    if (slider.dataset.sliderReady === 'fallback') delete slider.dataset.sliderReady;
  }

  function enableNativeDrag(root = document) {
    const selector = '.is-native-fallback,.services-home-slider,[data-native-horizontal-slider]';

    sliderNodes(root, selector).forEach(slider => {
      if (dragCleanup.has(slider)) return;

      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let dragging = false;
      let moved = false;

      const finish = event => {
        if (pointerId !== null && event?.pointerId != null && event.pointerId !== pointerId) return;
        if (pointerId !== null) {
          try { slider.releasePointerCapture(pointerId); } catch (_) {}
        }
        dragging = false;
        pointerId = null;
        slider.classList.remove('is-pointer-down');
        if (moved) {
          slider.dataset.karetaDragMoved = '1';
          window.setTimeout(() => delete slider.dataset.karetaDragMoved, 120);
        }
      };

      const down = event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = slider.scrollLeft;
        dragging = true;
        moved = false;
        slider.classList.add('is-pointer-down');
        try { slider.setPointerCapture(pointerId); } catch (_) {}
      };

      const move = event => {
        if (!dragging || event.pointerId !== pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if (!moved && Math.abs(dy) > Math.abs(dx)) {
          finish(event);
          return;
        }
        moved = true;
        slider.scrollLeft = startLeft - dx;
        if (event.cancelable) event.preventDefault();
      };

      const click = event => {
        if (slider.dataset.karetaDragMoved === '1') {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      slider.addEventListener('pointerdown', down);
      slider.addEventListener('pointermove', move, { passive: false });
      slider.addEventListener('pointerup', finish);
      slider.addEventListener('pointercancel', finish);
      slider.addEventListener('lostpointercapture', finish);
      slider.addEventListener('click', click, true);
      slider.dataset.karetaDragReady = '1';

      dragCleanup.set(slider, () => {
        slider.removeEventListener('pointerdown', down);
        slider.removeEventListener('pointermove', move);
        slider.removeEventListener('pointerup', finish);
        slider.removeEventListener('pointercancel', finish);
        slider.removeEventListener('lostpointercapture', finish);
        slider.removeEventListener('click', click, true);
        slider.classList.remove('is-pointer-down');
        delete slider.dataset.karetaDragReady;
        dragCleanup.delete(slider);
      });
    });
  }

  function create(slider, config = {}, fallbackRoot = null) {
    if (!slider) return null;
    destroy(slider, true);
    deactivateFallback(slider);
    if (typeof window.Swiper !== 'function') {
      activateFallback(slider, fallbackRoot || slider.parentElement || slider);
      return null;
    }
    try {
      const instance = new window.Swiper(slider, options(config));
      instances.set(slider, instance);
      slider.classList.add('is-swiper-ready');
      slider.dataset.sliderReady = '1';
      bindResize(slider, instance);
      requestAnimationFrame(() => update(slider));
      return instance;
    } catch (_) {
      activateFallback(slider, fallbackRoot || slider.parentElement || slider);
      return null;
    }
  }

  function update(slider) {
    if (!slider) return false;
    const instance = instances.get(slider) || slider.swiper;
    if (!instance || instance.destroyed) return false;
    try {
      instance.updateSize?.();
      instance.updateSlides?.();
      instance.updateProgress?.();
      instance.updateSlidesClasses?.();
      instance.update?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadAndCreate(slider, config = {}, fallbackRoot = null) {
    if (!slider) return Promise.resolve(null);
    if (typeof window.Swiper === 'function') return Promise.resolve(create(slider, config, fallbackRoot));
    const loader = window.KaretaSwiperLoader?.load;
    if (typeof loader !== 'function') {
      activateFallback(slider, fallbackRoot || slider.parentElement || slider);
      return Promise.resolve(null);
    }
    return loader.call(window.KaretaSwiperLoader)
      .then(() => document.contains(slider) ? create(slider, config, fallbackRoot) : null)
      .catch(() => {
        if (document.contains(slider)) activateFallback(slider, fallbackRoot || slider.parentElement || slider);
        return null;
      });
  }


  function audit(root = document, { repair = true } = {}) {
    const selector = '.swiper,[data-native-horizontal-slider],.services-home-slider';
    const report = [];
    sliderNodes(root, selector).forEach(slider => {
      const wrapper = slider.querySelector(':scope > .swiper-wrapper, .swiper-wrapper');
      const slides = wrapper ? wrapper.querySelectorAll(':scope > .swiper-slide, .swiper-slide') : [];
      const instance = instances.get(slider) || slider.swiper;
      const fallback = slider.classList.contains('is-native-fallback') || slider.hasAttribute('data-native-horizontal-slider');
      const style = getComputedStyle(slider);
      const item = {
        slider,
        hasWrapper: !!wrapper,
        slideCount: slides.length,
        initialized: !!instance && !instance.destroyed,
        fallback,
        pointerEvents: style.pointerEvents,
        overflowX: style.overflowX
      };
      diagnostics.set(slider, item);
      report.push(item);
      if (!repair || !wrapper || !slides.length) return;
      if (style.pointerEvents === 'none') slider.style.setProperty('pointer-events', 'auto');
      if (fallback) enableNativeDrag(slider);
      else if (instance && !instance.destroyed) update(slider);
    });
    return report;
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        enableNativeDrag(node);
        sliderNodes(node, '.swiper.is-swiper-ready').forEach(update);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1) continue;
        sliderNodes(node, '.swiper,[data-native-horizontal-slider],.services-home-slider').forEach(slider => {
          resizeCleanup.get(slider)?.();
          dragCleanup.get(slider)?.();
          const instance = instances.get(slider) || slider.swiper;
          if (instance && !instance.destroyed) { try { instance.destroy(true, true); } catch (_) {} }
          instances.delete(slider);
        });
      }
    }
  });

  window.KaretaSliderRuntime = {
    options,
    create,
    loadAndCreate,
    update,
    destroy,
    enableNativeDrag,
    activateFallback,
    deactivateFallback,
    audit
  };

  const refreshVisible = () => { if (!document.hidden) audit(document, { repair: true }); };
  const boot = () => {
    enableNativeDrag(document);
    audit(document, { repair: true });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', refreshVisible, { passive: true });
    window.addEventListener('pageshow', refreshVisible, { passive: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
;

window.KaretaBootProfiler?.bundleEnd?.("runtime_ui_bundle");
