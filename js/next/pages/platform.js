(() => {
  'use strict';
  const ui=window.KaretaPageUI;
  const searchEngine=window.KaretaPlatformSearch;
  if(!ui||!searchEngine) throw new Error('Platform dependencies are required');
  const esc=ui.escHtml;
  function renderPlatform(context){
    return ui.pageShell(context,'KARETA Platform 1.0','Единая точка доступа к ремонту, запчастям, специалистам, заявкам и событиям.',`
      <section class="k-platform-hero">
        <form class="k-platform-search" data-platform-search-form>
          <label for="k-platform-query">Поиск по всей платформе</label>
          <div><input id="k-platform-query" type="search" autocomplete="off" placeholder="Услуга, мастер, запчасть, заявка…"><button class="k-btn k-btn-primary" type="submit">Найти</button></div>
        </form>
        <div class="k-platform-metrics">
          <article><strong data-platform-count="services">—</strong><span>услуг</span></article>
          <article><strong data-platform-count="masters">—</strong><span>исполнителей</span></article>
          <article><strong data-platform-count="parts">—</strong><span>товаров</span></article>
          <article><strong data-platform-count="orders">—</strong><span>заявок</span></article>
        </div>
      </section>
      <section class="k-platform-grid">
        <a href="#/workflow"><span>▦</span><div><h2>Workflow</h2><p>Все этапы ремонта на одной доске.</p></div></a>
        <a href="#/orders/new"><span>＋</span><div><h2>Новая заявка</h2><p>Создайте запрос на ремонт или диагностику.</p></div></a>
        <a href="#/masters"><span>◉</span><div><h2>Исполнители</h2><p>Мастера и СТО с профилями и работами.</p></div></a>
        <a href="#/parts"><span>▣</span><div><h2>Marketplace</h2><p>Запчасти, аксессуары и предложения магазинов.</p></div></a>
        <a href="#/chats"><span>✉</span><div><h2>Сообщения</h2><p>Переговоры по заявкам и заказам.</p></div></a>
        <a href="#/cabinet"><span>☻</span><div><h2>Кабинет</h2><p>Профиль, автомобили, документы и история.</p></div></a>
      </section>
      <section class="k-platform-results" data-platform-results hidden></section>
    `,{page:'platform',eyebrow:'ЕДИНАЯ ЭКОСИСТЕМА'});
  }
  function resultCard(row){return `<a class="k-platform-result" href="${esc(row.href)}"><span>${esc(row.icon)}</span><div><small>${esc(row.group)}</small><h3>${esc(row.title)}</h3><p>${esc(row.text||'Открыть раздел')}</p></div><b>→</b></a>`;}
  function mountPlatform(context={}){
    const form=document.querySelector('[data-platform-search-form]');
    const input=document.querySelector('#k-platform-query');
    const results=document.querySelector('[data-platform-results]');
    if(!form||!input||!results)return()=>{};
    const snapshot=()=>context.state?.apiSnapshot||window.KaretaNext?.state?.apiSnapshot||{};
    const data=()=>{const p=snapshot()?.payload||{};return p.data&&typeof p.data==='object'?p.data:p;};
    const updateCounts=()=>['services','masters','parts','orders'].forEach(k=>{const el=document.querySelector(`[data-platform-count="${k}"]`);if(el)el.textContent=Array.isArray(data()[k])?data()[k].length:0;});
    const run=()=>{const q=input.value.trim();const rows=searchEngine.search(snapshot(),q);results.hidden=false;results.innerHTML=`<header><div><small>РЕЗУЛЬТАТЫ</small><h2>${rows.length?`Найдено: ${rows.length}`:'Совпадений нет'}</h2></div><button type="button" data-platform-close>Закрыть</button></header>${rows.map(resultCard).join('')||'<div class="k-empty-card"><p>Попробуйте изменить запрос или открыть нужный раздел выше.</p></div>'}`;};
    const submit=e=>{e.preventDefault();run();};
    const click=e=>{if(e.target.closest('[data-platform-close]')){results.hidden=true;results.innerHTML='';input.focus();}};
    form.addEventListener('submit',submit);document.addEventListener('click',click);updateCounts();
    const snap=()=>updateCounts();window.addEventListener('kareta:api-snapshot',snap);
    context.lifecycle?.addCleanup?.(()=>{form.removeEventListener('submit',submit);document.removeEventListener('click',click);window.removeEventListener('kareta:api-snapshot',snap);});
  }
  window.KaretaPlatformPages=Object.freeze({renderPlatform,mountPlatform});
})();
