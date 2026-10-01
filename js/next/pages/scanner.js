(() => {
  'use strict';
  const role = () => window.KaretaNavigationCore?.interfaceRole?.() || window.KaretaRoleAccess?.currentRole?.() || 'client';
  const home = () => role() === 'master' ? '#/master' : '#/home';
  const mode = () => window.KaretaRouteRegistry.keyFromHash(location.hash);
  // QR navigation is limited to existing, role-accessible KARETA entity routes.
  function qrTarget(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 2048) throw new Error('Неверный QR-код.');
    let hash = text;
    if (!text.startsWith('#/')) {
      let url;
      try { url = new URL(text); } catch (_) { throw new Error('Это не ссылка KARETA.'); }
      if (url.protocol !== 'https:' || !['kareta.kz','www.kareta.kz','s.kareta.kz'].includes(url.hostname) || url.username || url.password || url.port || url.pathname !== '/' || url.search) throw new Error('Это не ссылка KARETA.');
      hash = url.hash;
    }
    if (hash.includes('?') || !/^#\/(?:works\/item|parts\/item|services\/item|masters\/profile\/(?:master|sto)|garage\/car|orders\/item)\/[A-Za-z0-9_-]{1,128}$/.test(hash)) throw new Error('Этот формат QR пока не поддерживается.');
    const key = window.KaretaRouteRegistry.keyFromHash(hash);
    if (!key || !window.KaretaRoleAccess.canAccess(key)) throw new Error('Карточка недоступна в текущей роли.');
    return hash;
  }
  function render() {
    const key = mode(), documentMode = key === 'scannerDocument';
    const back = key === 'scanner' ? home() : '#/scan';
    const title = key === 'scanner' ? 'Сканировать' : documentMode ? 'Техпаспорт автомобиля' : 'QR KARETA';
    const content = key === 'scanner'
      ? '<div class="k-scan-choices"><a class="k-btn k-btn-secondary" href="#/scan/qr">QR KARETA</a><a class="k-btn k-btn-secondary" href="#/scan/document">Техпаспорт автомобиля</a></div>'
      : `${documentMode ? '<p>Можно проверить наличие QR на документе камерой или по фото. Автоматическое распознавание полей техпаспорта пока недоступно. Поддержка всех образцов не подтверждена.</p>' : '<p>Наведите камеру на QR KARETA или выберите изображение кода.</p>'}<div class="k-scan-controls"><button class="k-btn k-btn-primary" type="button" data-scan-start>Открыть камеру</button><button class="k-btn k-btn-secondary" type="button" data-scan-stop hidden>Остановить</button><label class="k-btn k-btn-secondary">Выбрать фото<input data-scan-file type="file" accept="image/*"></label></div><video data-scan-video playsinline muted hidden aria-label="Камера для сканирования QR"></video><form data-scan-form><label for="k-scan-value">${documentMode ? 'Содержимое QR документа' : 'Ссылка из QR KARETA'}</label><textarea id="k-scan-value" data-scan-value maxlength="2048" rows="3"></textarea><button class="k-btn k-btn-secondary" type="submit">Проверить</button></form><p data-scan-status role="status" aria-live="polite"></p><a class="k-btn k-btn-primary" data-scan-target hidden>Открыть карточку</a>`;
    return `<section class="k-page k-scan-page" data-page="scanner"><a class="k-btn k-btn-secondary" href="${back}">Назад</a><h1>${title}</h1>${content}</section>`;
  }
  function mount(context) {
    const root = document.querySelector('[data-page="scanner"]');
    if (!root || mode() === 'scanner') return;
    const documentMode = mode() === 'scannerDocument';
    const lifecycle = context.lifecycle;
    let disposed = false, stream = null, cameraRun = 0, fileRun = 0, timer = null;
    const video = root.querySelector('[data-scan-video]');
    const start = root.querySelector('[data-scan-start]');
    const stopButton = root.querySelector('[data-scan-stop]');
    const status = root.querySelector('[data-scan-status]');
    const input = root.querySelector('[data-scan-value]');
    const target = root.querySelector('[data-scan-target]');
    const active = () => !disposed && lifecycle?.isActive?.() !== false && root.isConnected;
    function stop() {
      cameraRun++;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
      video.srcObject = null;
      video.hidden = true;
      stopButton.hidden = true;
      start.disabled = false;
    }
    function clearTarget() { target.hidden = true; target.removeAttribute('href'); }
    function show(value) {
      if (!active()) return;
      stop(); clearTarget(); input.value = String(value || '').slice(0, 2048);
      if (documentMode) { status.textContent = 'QR прочитан. Формат документа и его поля ещё не подтверждены; данные не сохранены.'; return; }
      try { target.href = qrTarget(value); target.hidden = false; status.textContent = 'Ссылка KARETA распознана. Откройте карточку для проверки.'; }
      catch (error) { status.textContent = error.message; }
    }
    async function detector() {
      if (!window.BarcodeDetector || !(await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) throw new Error('Сканирование камерой и по фото недоступно в этом браузере. Можно вставить содержимое QR вручную.');
      return new window.BarcodeDetector({ formats:['qr_code'] });
    }
    function listen(node, event, handler) { lifecycle.listen(node, event, handler); }
    listen(input, 'input', clearTarget);
    listen(root.querySelector('[data-scan-form]'), 'submit', event => { event.preventDefault(); show(input.value); });
    listen(stopButton, 'click', () => { stop(); status.textContent = 'Сканирование остановлено.'; });
    listen(start, 'click', async () => {
      stop(); fileRun++; clearTarget(); const run = cameraRun;
      start.disabled = true; status.textContent = 'Открываем камеру…';
      try {
        const reader = await detector();
        if (!active() || run !== cameraRun) return;
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Камера недоступна. Используйте HTTPS и разрешите доступ к камере.');
        const opened = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
        if (!active() || run !== cameraRun) { opened.getTracks().forEach(track => track.stop()); return; }
        stream = opened; video.srcObject = stream; video.hidden = false; stopButton.hidden = false;
        await video.play();
        if (!active() || run !== cameraRun) return;
        status.textContent = 'Наведите камеру на QR.';
        const tick = async () => {
          if (!active() || run !== cameraRun) return;
          try {
            const codes = await reader.detect(video);
            if (!active() || run !== cameraRun) return;
            if (codes[0]) { show(codes[0].rawValue); return; }
            timer = window.setTimeout(tick, 250);
          } catch (_) { if (active() && run === cameraRun) { stop(); status.textContent = 'Не удалось прочитать изображение камеры.'; } }
        };
        tick();
      } catch (error) {
        if (!active() || run !== cameraRun) return;
        stop(); status.textContent = error.name === 'NotAllowedError' ? 'Доступ к камере запрещён. Разрешите его в настройках или выберите фото.' : error.message;
      }
    });
    listen(root.querySelector('[data-scan-file]'), 'change', async event => {
      stop(); clearTarget(); const run = ++fileRun; const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { status.textContent = 'Выберите изображение до 10 МБ.'; return; }
      status.textContent = 'Проверяем фото…'; let bitmap;
      try {
        const reader = await detector();
        if (!active() || run !== fileRun) return;
        bitmap = await createImageBitmap(file);
        const codes = await reader.detect(bitmap);
        if (!active() || run !== fileRun) return;
        if (codes[0]) show(codes[0].rawValue);
        else status.textContent = documentMode ? 'QR на фото не найден. Распознавание текста техпаспорта пока недоступно.' : 'QR на фото не найден. Сделайте более чёткий снимок.';
      } catch (error) { if (active() && run === fileRun) status.textContent = error.message; }
      finally { bitmap?.close(); event.target.value = ''; }
    });
    const cleanup = () => { disposed = true; fileRun++; stop(); };
    lifecycle.addCleanup(cleanup);
    return cleanup;
  }
  window.KaretaScannerPages = Object.freeze({ render, mount, qrTarget });
})();
