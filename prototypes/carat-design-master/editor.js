(() => {
  'use strict';

  const widths = { desktop: 1120, tablet: 768, phone: 390 };
  const labels = { desktop: 'ПК', tablet: 'Планшет', phone: 'Телефон' };
  const blocks = {
    heading: { title: 'Заголовок', visible: { desktop: true, tablet: true, phone: true } },
    progress: { title: 'Шаги регистрации', visible: { desktop: true, tablet: true, phone: true } },
    name: { title: 'Поле «Имя»', visible: { desktop: true, tablet: true, phone: true } },
    phone: { title: 'Поле «Телефон»', visible: { desktop: true, tablet: true, phone: true } },
    password: { title: 'Поле «Пароль»', visible: { desktop: true, tablet: true, phone: true } },
    submit: { title: 'Кнопка «Продолжить»', visible: { desktop: true, tablet: true, phone: true } },
    promo: { title: 'Промо-блок', visible: { desktop: true, tablet: true, phone: false } },
    'mobile-help': { title: 'Короткая подсказка', visible: { desktop: false, tablet: false, phone: true } }
  };

  let currentDevice = 'phone';
  let selectedBlock = 'password';
  let statusTimer = 0;

  const frame = document.querySelector('[data-preview-frame]');
  const caption = document.querySelector('[data-device-caption]');
  const deviceLabel = document.querySelector('[data-current-device]');
  const visibilityToggle = document.querySelector('[data-visibility-toggle]');
  const visibilityLabel = document.querySelector('[data-visibility-label]');
  const selectedTitle = document.querySelector('[data-selected-title]');
  const status = document.querySelector('[data-status-message]');

  function announce(message) {
    status.textContent = message;
    status.classList.add('is-visible');
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove('is-visible'), 3500);
  }

  function render() {
    frame.dataset.device = currentDevice;
    frame.style.width = `min(100%, ${widths[currentDevice]}px)`;
    caption.textContent = `${labels[currentDevice]} · ${widths[currentDevice]} px`;
    deviceLabel.textContent = labels[currentDevice];

    Object.entries(blocks).forEach(([id, block]) => {
      const node = document.querySelector(`[data-preview-block="${id}"]`);
      if (node) node.classList.toggle('is-hidden', !block.visible[currentDevice]);
    });

    const selected = blocks[selectedBlock];
    selectedTitle.textContent = selected.title;
    visibilityToggle.classList.toggle('is-on', selected.visible[currentDevice]);
    visibilityToggle.setAttribute('aria-checked', String(selected.visible[currentDevice]));
    visibilityLabel.textContent = selected.visible[currentDevice] ? 'Показывается' : 'Скрыт';

    document.querySelectorAll('.layer-item').forEach(button => {
      const active = button.dataset.block === selectedBlock;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });

    document.querySelectorAll('[data-device]').forEach(button => {
      if (!button.matches('.preview-frame')) {
        const active = button.dataset.device === currentDevice;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
    });
  }

  document.querySelectorAll('.device-switch [data-device]').forEach(button => {
    button.addEventListener('click', () => {
      currentDevice = button.dataset.device;
      render();
    });
  });

  document.querySelectorAll('.layer-item[data-block]').forEach(button => {
    button.addEventListener('click', () => {
      selectedBlock = button.dataset.block;
      document.querySelectorAll('[data-preview-block]').forEach(node => node.classList.remove('is-selected'));
      document.querySelector(`[data-preview-block="${selectedBlock}"]`)?.classList.add('is-selected');
      render();
    });
  });

  visibilityToggle.addEventListener('click', () => {
    blocks[selectedBlock].visible[currentDevice] = !blocks[selectedBlock].visible[currentDevice];
    render();
  });

  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'save') announce('Демо: сохранение не подключено. Настройки остаются только в этой вкладке.');
      else if (action === 'publish') announce('Публикация отключена: сначала требуется подключить защищённый PHP API.');
      else if (action === 'preview') announce('Вы уже видите предпросмотр. Отправка формы отключена.');
      else if (action === 'add-window' || action === 'add-block') announce('Добавление блока пока показано как элемент интерфейса прототипа.');
    });
  });

  render();
})();