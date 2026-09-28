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
