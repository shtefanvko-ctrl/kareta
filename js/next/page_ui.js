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
