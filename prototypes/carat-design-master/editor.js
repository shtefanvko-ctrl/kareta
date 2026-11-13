(() => {
  'use strict';

  const widths = { desktop: 1120, tablet: 768, phone: 390 };
  const labels = { desktop: 'ПК', tablet: 'Планшет', phone: 'Телефон' };
  const blocks = {
    heading: { title: 'Заголовок', label: 'Создать аккаунт', visible: { desktop: true, tablet: true, phone: true } },
    progress: { title: 'Шаги регистрации', label: 'Шаг 2 из 3', visible: { desktop: true, tablet: true, phone: true } },
    name: { title: 'Поле «Имя»', label: 'Имя', type: 'text', key: 'name', required: true, visible: { desktop: true, tablet: true, phone: true } },
    phone: { title: 'Поле «Телефон»', label: 'Номер телефона', type: 'tel', key: 'phone', required: true, visible: { desktop: true, tablet: true, phone: true } },
    password: { title: 'Поле «Пароль»', label: 'Пароль', type: 'password', key: 'password', required: true, showPasswordToggle: true, visible: { desktop: true, tablet: true, phone: true } },
    submit: { title: 'Кнопка «Продолжить»', label: 'Продолжить', visible: { desktop: true, tablet: true, phone: true } },
    promo: { title: 'Промо-блок', label: 'Управляйте настройками регистрации в одном месте.', visible: { desktop: true, tablet: true, phone: false } },
    'mobile-help': { title: 'Короткая подсказка', label: 'Данные передаются защищённо.', visible: { desktop: false, tablet: false, phone: true } }
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
  const fieldLabel = document.querySelector('[data-field-label]');
  const fieldType = document.querySelector('[data-field-type]');
  const dataKey = document.querySelector('[data-data-key]');
  const passwordSetting = document.querySelector('[data-password-setting]');
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
    fieldLabel.value = selected.label || selected.title;
    fieldType.value = selected.type || 'text';
    dataKey.value = selected.key || '';
    const isField = ['name', 'phone', 'password'].includes(selectedBlock);
    fieldLabel.disabled = !isField && !['heading', 'progress', 'submit', 'promo', 'mobile-help'].includes(selectedBlock);
    fieldType.disabled = !isField;
    dataKey.disabled = !isField;
    document.querySelector('[data-setting="required"]').classList.toggle('is-on', Boolean(selected.required));
    document.querySelector('[data-setting="required"]').setAttribute('aria-checked', String(Boolean(selected.required)));
    passwordSetting.hidden = selectedBlock !== 'password';
    const showPasswordToggle = Boolean(selected.showPasswordToggle);
    document.querySelector('[data-setting="showPasswordToggle"]').classList.toggle('is-on', showPasswordToggle);
    document.querySelector('[data-setting="showPasswordToggle"]').setAttribute('aria-checked', String(showPasswordToggle));
    const passwordEye = document.querySelector('[data-preview-block="password"] .password-input span:last-child');
    if (passwordEye) passwordEye.hidden = !showPasswordToggle;
    document.querySelector('[data-setting="showPasswordToggle"]').setAttribute('aria-checked', String(Boolean(selected.showPasswordToggle)));
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

  fieldLabel.addEventListener('input', () => {
    const block = blocks[selectedBlock];
    block.label = fieldLabel.value;
    const node = document.querySelector(`[data-preview-block="${selectedBlock}"]`);
    if (selectedBlock === 'heading') node.querySelector('h1').textContent = block.label;
    else if (selectedBlock === 'progress') node.querySelector('small').textContent = block.label;
    else if (selectedBlock === 'submit') node.textContent = block.label;
    else if (selectedBlock === 'promo' || selectedBlock === 'mobile-help') node.textContent = block.label;
    else node.querySelector('.form-field > span')?.replaceChildren(document.createTextNode(block.label));
    if (['name', 'phone', 'password'].includes(selectedBlock)) block.title = `Поле «${block.label}»`;
    selectedTitle.textContent = block.title;
  });

  fieldType.addEventListener('change', () => {
    blocks[selectedBlock].type = fieldType.value;
    announce('Тип поля изменён в локальном макете; API не подключён.');
  });

  dataKey.addEventListener('input', () => {
    blocks[selectedBlock].key = dataKey.value.trim();
  });

  document.querySelectorAll('[data-setting]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.setting;
      blocks[selectedBlock][key] = !blocks[selectedBlock][key];
      render();
    });
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