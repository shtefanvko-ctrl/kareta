/* UI — shared line icon helper. Safe optional helper for UI-only icons. */
(function(){
  const ns='http://www.w3.org/2000/svg';
  const paths={
    home:'M5 12l7-6 7 6v7H5v-7Z M9 19v-5h6v5',
    orders:'M7 5h10v14H7V5Z M9 9h6 M9 13h6 M9 17h4',
    chat:'M5 7h14v9H9l-4 3V7Z',
    user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 20c1.5-4 4-6 7-6s5.5 2 7 6',
    parts:'M6 8h12v10H6V8Z M9 5h6v3 M9 18v2 M15 18v2',
    search:'M11 17a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z M16 16l4 4',
    settings:'M12 8v8 M8 12h8 M5 5h14v14H5V5Z',
    calendar:'M6 7h12v12H6V7Z M8 5v4 M16 5v4 M6 11h12',
    team:'M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20c1-4 3-6 6-6s5 2 6 6 M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M15 15c2 .3 3.5 2 4 5',
    service:'M8 17l9-9 M15 5l4 4-3 3-4-4 3-3Z M5 19l4-4 3 3-4 4H5v-3Z'
  };
  function svg(key, cls){
    const d=paths[key]||paths.service;
    return '<svg class="'+(cls||'ui-line-svg')+'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"></path></svg>';
  }
  window.KaretaUIIcon={svg, paths};
})();
