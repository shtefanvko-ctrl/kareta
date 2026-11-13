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

  let customBlockSequence = 0;

  function selectBlock(id) {
    selectedBlock = id;
    document.querySelectorAll('[data-preview-block]').forEach(node => node.classList.remove('is-selected'));
    document.querySelector(`[data-preview-block="${selectedBlock}"]`)?.classList.add('is-selected');
    render();
  }

  function addBlock(button) {
    const label = button.textContent.replace(/^＋\\s*/, '').trim();
    const isField = label === 'Поле' || label === 'Пароль';
    const isPassword = label === 'Пароль';
    const isButton = label === 'Кнопка';
    const id = `custom-${++customBlockSequence}`;
    const blockLabel = isField ? (isPassword ? 'Новый пароль' : 'Новое поле') : isButton ? 'Новая кнопка' : 'Новый текст';
    blocks[id] = {
      title: isField ? `Поле «${blockLabel.replace(/^Поле «|»$/g, '')}»` : blockLabel,
      label: blockLabel,
      kind: isField ? 'field' : isButton ? 'button' : 'text',
      type: isPassword ? 'password' : 'text',
      key: '',
      required: false,
      showPasswordToggle: isPassword,
      visible: { desktop: true, tablet: true, phone: true }
    };

    const layer = document.createElement('button');
    layer.type = 'button';
    layer.className = 'layer-item';
    layer.dataset.block = id;
    layer.setAttribute('aria-pressed', 'false');
    const glyph = document.createElement('span');
    glyph.className = 'layer-glyph';
    glyph.textContent = isField ? '▱' : isButton ? '▰' : 'T';
    const title = document.createElement('span');
    title.textContent = blockLabel;
    const dots = document.createElement('span');
    dots.className = 'visibility-dots';
    dots.textContent = 'ПК · ПЛ · ТЕЛ';
    layer.append(glyph, title, dots);
    document.querySelector('.layer-list').append(layer);

    let preview;
    if (isField) {
      preview = document.createElement('label');
      preview.className = 'form-field';
      const caption = document.createElement('span');
      caption.textContent = blockLabel;
      preview.append(caption);
      if (isPassword) {
        const mask = document.createElement('span');
        mask.className = 'password-input';
        mask.innerHTML = '<span aria-hidden="true">••••••••</span><span aria-hidden="true">◉</span>';
        preview.append(mask);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = blockLabel;
        input.readOnly = true;
        preview.append(input);
      }
    } else if (isButton) {
      preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'registration-submit';
      preview.textContent = blockLabel;
    } else {
      preview = document.createElement('p');
      preview.className = 'promo-block';
      preview.textContent = blockLabel;
    }
    preview.dataset.previewBlock = id;
    const submit = document.querySelector('[data-preview-block="submit"]');
    document.querySelector('.registration-card').insertBefore(preview, submit);
    selectBlock(id);
    announce('Блок добавлен только в локальный макет; серверное сохранение не подключено.');
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
    const isField = selected.kind === 'field' || ['name', 'phone', 'password'].includes(selectedBlock);
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

  document.querySelector('.layer-list').addEventListener('click', event => {
    const button = event.target.closest('.layer-item[data-block]');
    if (button) selectBlock(button.dataset.block);
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
    else if (selectedBlock === 'submit' || block.kind === 'button') node.textContent = block.label;
    else if (selectedBlock === 'promo' || selectedBlock === 'mobile-help' || block.kind === 'text') node.textContent = block.label;
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
      else if (action === 'add-block') addBlock(button);
      else if (action === 'add-window') announce('Создание окна пока отключено: сначала нужно согласовать модель окна и связь с route registry.');
    });
  });

  render();
})();