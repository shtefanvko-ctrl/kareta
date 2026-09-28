(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  if (!ui) throw new Error('KaretaPageUI is required before info.js');
  const esc = ui.escHtml;

  const INFO_NAV = Object.freeze([
    ['#/about','О платформе','about'],
    ['#/rules','Правила','rules'],
    ['#/help','Помощь','help'],
    ['#/privacy','Данные','privacy'],
    ['#/contacts','Контакты','contacts'],
  ]);

  const section = (icon, title, text, items = [], tone = '') => `<article class="k-info-ref-section${tone ? ` ${tone}` : ''}">
    <span class="k-info-ref-section__icon" aria-hidden="true">${esc(icon)}</span>
    <div class="k-info-ref-section__copy"><h2>${esc(title)}</h2><p>${esc(text)}</p>
    ${items.length ? `<ul>${items.map(item => `<li><span aria-hidden="true">✓</span><b>${esc(item)}</b></li>`).join('')}</ul>` : ''}</div>
  </article>`;

  function infoPage(title, subtitle, page, eyebrow, cards, options = {}){
    const nav = options.hideInfoNav ? '' : `<nav class="k-info-ref-tabs" aria-label="Информационные разделы">${INFO_NAV.map(([href,label,key])=>`<a href="${href}" class="${key===page?'is-active':''}" ${key===page?'aria-current="page"':''}>${esc(label)}</a>`).join('')}</nav>`;
    const action = options.action || '<a class="k-info-ref-home" href="#/home">На главную</a>';
    return `<section class="k-page k-info-ref-page k-info-ref-v2 k-flow-primary-page ${options.servicePage?'k-info-ref-service-page':''}" data-page="${esc(page)}">
      <header class="k-info-ref-head"><div class="k-info-ref-head__copy"><small>${esc(eyebrow)}</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="k-info-ref-head__actions">${action}</div></header>
      ${nav}
      <section class="k-info-ref-grid">${cards.join('')}</section>
    </section>`;
  }

  function renderAbout(){
    return infoPage('О платформе', 'KARETA.KZ объединяет клиентов, мастеров, СТО и продавцов запчастей в одной рабочей системе.', 'about', 'KARETA.KZ', [
      section('🚗','Для клиента','Запись на услуги, подбор мастера, история заказов и магазин запчастей.', ['Единый профиль автомобиля','Заказы и сообщения в одном месте','Каталог услуг и товаров']),
      section('🧰','Для мастера','Рабочая очередь, собственные предложения услуг и связь с клиентами.', ['Свои цены и сроки','Гарантия и доступность','История выполненных работ']),
      section('🏢','Для СТО','Управление услугами, заказами, командой и клиентским потоком.', ['Каталог услуг СТО','Распределение работ','Контроль статусов']),
      section('🛒','Для продавца','Товары, остатки, цены и заказы интернет-магазина.', ['Свой ассортимент','Управление остатками','Обработка заказов покупателей'])
    ]);
  }

  function renderRules(){
    return infoPage('Правила платформы', 'Коротко о достоверности данных, безопасности, цене и ответственности участников.', 'rules', 'ПРАВИЛА', [
      section('✓','Достоверные данные','Указывайте корректные сведения о себе, автомобиле, услуге или товаре.', ['Не публиковать ложные цены и остатки','Не выдавать чужие работы за свои','Своевременно обновлять статусы']),
      section('🛡','Безопасность','Работы выполняются с соблюдением техники безопасности и требований производителя.', ['Не проводить опасные работы без допуска','Фиксировать выявленные риски','Согласовывать дополнительные работы']),
      section('₸','Цена и согласование','Стоимость, сроки и состав работ подтверждаются до выполнения.', ['Изменения согласуются с клиентом','Цена заказа сохраняется снимком','Возвраты оформляются через статус заказа']),
      section('⚖','Ответственность','Каждый участник отвечает за свои данные, действия и качество услуги или товара.', ['Платформа хранит историю операций','Чужие товары и заказы недоступны','Нарушения могут привести к блокировке'])
    ]);
  }

  function renderHelp(){
    return infoPage('Помощь', 'Основные сценарии приложения без длинной справки и лишних экранов.', 'help', 'ПОДДЕРЖКА', [
      section('🔎','Найти услугу','Откройте «Услуги», выберите категорию и создайте заявку.', ['Используйте поиск','Сравните цену и гарантию','Сохраните договорённость в заявке']),
      section('🛒','Купить запчасть','Выберите категорию, проверьте совместимость и оформите заказ.', ['Проверяйте остаток','Уточняйте OEM и совместимость','Следите за статусом заказа']),
      section('💬','Связаться','Сообщения по заявкам доступны в разделе «Чаты».', ['Не передавайте пароли','Сохраняйте договорённости в чате','Прикладывайте фото и документы']),
      section('↻','Экран не обновился','Проверьте интернет и перезагрузите текущую страницу.', ['Не отправляйте форму много раз','Используйте актуальную версию приложения','При повторной ошибке обратитесь в поддержку'])
    ], {action:'<a class="k-info-ref-home is-primary" href="#/chats">Открыть чаты</a>'});
  }

  function renderPrivacy(){
    return infoPage('Конфиденциальность', 'Какие данные нужны платформе для аккаунта, автомобиля, заказов и безопасной работы.', 'privacy', 'ДАННЫЕ', [
      section('👤','Профиль','Имя, телефон, контекст и город используются для работы аккаунта и связи по заказам.', ['Данные не показываются без необходимости','Доступ зависит от текущего контекста','Сессия защищает личные разделы']),
      section('🚘','Автомобиль','Данные автомобиля нужны для подбора услуг, запчастей и истории обслуживания.', ['Марка и модель','VIN и госномер при необходимости','История обслуживания']),
      section('📦','Заказы','Хранятся состав, цена, статусы и участники заказа.', ['Цена фиксируется на момент заказа','История нужна для гарантий','Чужие заказы недоступны']),
      section('🔐','Безопасность','Код подтверждения и доступ к аккаунту нельзя передавать другим лицам.', ['Используйте личный номер','Выходите на чужих устройствах','Сообщайте о подозрительной активности'])
    ]);
  }

  function renderContacts(){
    return infoPage('Контакты и поддержка', 'Для быстрого разбора вопроса укажите страницу, действие и ожидаемый результат.', 'contacts', 'КОНТАКТЫ', [
      section('📞','Обращение в поддержку','Опишите проблему и приложите снимок экрана.', ['Укажите ожидаемое действие','Укажите текст ошибки','Не отправляйте пароли и коды']),
      section('🧾','Вопрос по заказу','Используйте чат конкретного заказа, чтобы сохранить контекст.', ['Номер заказа','Товар или услуга','Желаемый результат']),
      section('🏪','Для партнёров','Мастера, СТО и продавцы управляют данными через профильный кабинет.', ['Актуализируйте реквизиты','Проверяйте цены и остатки','Соблюдайте правила публикации'])
    ], {action:'<a class="k-info-ref-home is-primary" href="#/chats">Написать</a>'});
  }

  function renderLawyer(){
    return infoPage('Автоюрист', 'Помощь при ДТП, страховых спорах, покупке автомобиля и разногласиях по ремонту.', 'lawyer', 'ПРАВОВАЯ ПОМОЩЬ', [
      `<article class="k-info-ref-service-hero"><span aria-hidden="true">⚖</span><div><small>КОНСУЛЬТАЦИЯ</small><h2>Разберите ситуацию по шагам</h2><p>Опишите, что произошло. Консультант подскажет, какие документы собрать и с чего начать.</p><div class="k-info-ref-service-tags"><span>ДТП</span><span>Страховая</span><span>Ремонт</span><span>Покупка авто</span></div></div></article>`,
      section('1','Подготовьте факты','Коротко опишите событие, даты и участников.', ['Что произошло','Какие документы уже есть','Какой результат вы хотите получить']),
      section('2','Приложите документы','Фото, акт, договор и переписку можно отправить уже в чате.', ['Не публикуйте документы в общей ленте','Закройте лишние персональные данные','Сохраните оригиналы']),
      `<article class="k-info-ref-cta"><div><small>ЗАЩИЩЁННЫЙ ЧАТ</small><h2>Написать автоюристу</h2><p>Новый диалог откроется внутри KARETA.KZ.</p></div><button class="k-info-ref-primary" type="button" data-lawyer-chat>Начать консультацию</button></article>`
    ], {hideInfoNav:true, servicePage:true, action:'<a class="k-info-ref-home" href="#/home">Закрыть</a>'});
  }

  function renderTowTruck(){
    const truck = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h3l4 4v2h-7z"></path><path d="M6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path><path d="M8.5 16h7"></path></svg>`;
    return `<section class="k-page k-tow-ref-page k-flow-primary-page" data-page="tow-truck">
      <header class="k-tow-ref-head">
        <div><small>ПОМОЩЬ В ДОРОГЕ</small><h1>Эвакуатор</h1><p>Передайте только необходимые данные. Геопозиция используется только после вашего разрешения.</p></div>
        <a class="k-tow-ref-close" href="#/home">Закрыть</a>
      </header>
      <section class="k-tow-ref-hero">
        <div class="k-tow-ref-visual">${truck}</div>
        <div class="k-tow-ref-copy"><span>БЫСТРЫЙ ВЫЗОВ</span><h2>Нужна эвакуация автомобиля?</h2><p>Сначала определим точку, затем в чате уточним состояние автомобиля и адрес доставки.</p>
          <div class="k-tow-ref-actions"><button class="k-tow-ref-primary" type="button" data-tow-location>Определить местоположение</button><button class="k-tow-ref-secondary" type="button" data-tow-chat>Указать адрес вручную</button></div>
          <output class="k-tow-ref-status" data-tow-status aria-live="polite">Контакты и координаты не публикуются в общей ленте.</output>
        </div>
      </section>
      <section class="k-tow-ref-facts" aria-label="Что потребуется">
        <article><b>01</b><div><span>Где автомобиль</span><small>Геопозиция или адрес с ориентиром</small></div></article>
        <article><b>02</b><div><span>Что произошло</span><small>Едет ли автомобиль, заблокированы ли колёса</small></div></article>
        <article><b>03</b><div><span>Куда доставить</span><small>СТО, парковка или другой адрес</small></div></article>
      </section>
      <section class="k-tow-ref-bottom">
        <article class="k-tow-ref-scenarios"><div><small>ПОЛЕЗНО УКАЗАТЬ</small><h2>Состояние перед погрузкой</h2></div><div class="k-tow-ref-tags"><span>Авто не едет</span><span>После ДТП</span><span>Колесо заблокировано</span><span>Низкая посадка</span><span>Руль заблокирован</span></div></article>
        <article class="k-tow-ref-privacy"><span aria-hidden="true">✓</span><div><b>Контроль остаётся у вас</b><p>Браузер запросит разрешение на геолокацию. Без разрешения координаты не передаются — можно сразу указать адрес вручную.</p></div></article>
      </section>
    </section>`;
  }

  async function openSupport(message){
    const button = document.activeElement;
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      const result = await window.KaretaApiClient.openSupportChat(message);
      if (!result?.ok) throw new Error(result?.payload?.message || 'Не удалось открыть чат');
      const chatId = String(result.payload?.chatId || result.payload?.chat?.id || '');
      if (chatId) sessionStorage.setItem('kareta.chat.open', chatId);
      location.hash = '#/chats';
    } catch (error) {
      window.KaretaToast?.error(error?.message || 'Не удалось открыть чат');
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  }

  function mountLawyer(){
    const button = document.querySelector('[data-lawyer-chat]');
    if (!button) return () => {};
    const click = () => openSupport('Здравствуйте. Нужна консультация автоюриста. Опишу ситуацию в следующем сообщении.');
    button.addEventListener('click', click);
    return () => button.removeEventListener('click', click);
  }

  function mountTowTruck(){
    const root = document.querySelector('[data-page="tow-truck"]');
    if (!root) return () => {};
    const status = root.querySelector('[data-tow-status]');
    const setStatus = text => { if (status) status.textContent = text; };
    const click = event => {
      const geoButton = event.target.closest('[data-tow-location]');
      const chatButton = event.target.closest('[data-tow-chat]');
      if (chatButton) {
        if (chatButton.disabled) return;
        chatButton.disabled = true;
        setStatus('Открываем чат — укажите адрес и состояние автомобиля.');
        openSupport('Здравствуйте. Нужен эвакуатор. Опишу автомобиль, местоположение и адрес доставки в следующем сообщении.');
        return;
      }
      if (!geoButton || geoButton.disabled) return;
      if (!navigator.geolocation) {
        setStatus('Геолокация недоступна. Укажите адрес вручную.');
        window.KaretaToast?.error('Геолокация не поддерживается. Укажите адрес в чате.');
        return;
      }
      const original = geoButton.textContent;
      geoButton.disabled = true;
      geoButton.setAttribute('aria-busy','true');
      geoButton.textContent = 'Определяем…';
      setStatus('Запрашиваем разрешение браузера на геолокацию…');
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = Number(position.coords.latitude).toFixed(6);
          const lon = Number(position.coords.longitude).toFixed(6);
          setStatus('Координаты получены. Открываем защищённый чат…');
          openSupport(`Здравствуйте. Нужен эвакуатор. Моё местоположение: https://maps.google.com/?q=${lat},${lon}`);
        },
        () => {
          geoButton.disabled = false;
          geoButton.removeAttribute('aria-busy');
          geoButton.textContent = original;
          setStatus('Не удалось определить точку. Укажите адрес вручную.');
          window.KaretaToast?.error('Не удалось получить геопозицию. Укажите адрес вручную.');
        },
        { enableHighAccuracy:true, timeout:10000, maximumAge:60000 }
      );
    };
    root.addEventListener('click', click);
    return () => root.removeEventListener('click', click);
  }

  window.KaretaInfoPages = Object.freeze({ renderAbout, renderRules, renderHelp, renderPrivacy, renderContacts, renderLawyer, renderTowTruck, mountLawyer, mountTowTruck });
})();
