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
      if (url.protocol !== 'https:' || !['kareta.kz','www.kareta.kz','m.kareta.kz','s.kareta.kz'].includes(url.hostname) || url.username || url.password || url.port || url.pathname !== '/' || url.search) throw new Error('Это не ссылка KARETA.');
      hash = url.hash;
    }
    if (hash.includes('?') || !/^#\/(?:works\/item|parts\/item|services\/item|masters\/profile\/(?:master|sto)|garage\/car|orders\/item)\/[A-Za-z0-9_-]{1,128}$/.test(hash)) throw new Error('Этот формат QR пока не поддерживается.');
    const key = window.KaretaRouteRegistry.keyFromHash(hash);
    if (!key || !window.KaretaRoleAccess.canAccess(key)) throw new Error('Карточка недоступна в текущей роли.');
    return hash;
  }

  // Two-sided local capture only. No document OCR, storage or upload is implied.
  const DOC_COPY={
    ru:['Назад в гараж','Сканирование техпаспорта','Добавление авто в гараж','Автоматическое распознавание полей техпаспорта пока недоступно. Фото остаются на устройстве и удаляются при закрытии экрана.','Сфотографируйте обе стороны документа или введите данные вручную.','Сканировать техпаспорт','Ввести вручную','Выбор способа','Лицевая сторона','Обратная сторона','Шаг','Сделать фото','Из галереи','Далее','Переснять','Фотографии сделаны','Фото не отправлены на сервер. Для сохранения автомобиля введите и подтвердите данные в форме гаража.','Перейти к заполнению','Начать заново','Выберите изображение до 10 МБ.','Не удалось открыть фото.','Добавление в гараж доступно только клиенту.'],
    kk:['Гаражға оралу','Техпаспортты сканерлеу','Автокөлікті гаражға қосу','Техпаспорт деректерін автоматты тану әзірге қолжетімсіз. Суреттер құрылғыда қалады және экран жабылғанда жойылады.','Құжаттың екі жағын түсіріңіз немесе деректерді қолмен енгізіңіз.','Техпаспортты сканерлеу','Қолмен енгізу','Қосу тәсілін таңдау','Алдыңғы беті','Артқы беті','Қадам','Фото түсіру','Галереядан','Келесі','Қайта түсіру','Суреттер дайын','Суреттер серверге жіберілген жоқ. Көлікті сақтау үшін гараж нысанында деректерді енгізіп, растаңыз.','Толтыруға өту','Қайта бастау','10 МБ дейінгі суретті таңдаңыз.','Суретті ашу мүмкін болмады.','Гаражға тек клиент автокөлік қоса алады.'],
    en:['Back to garage','Registration document scan','Add a car to your garage','Automatic document OCR is not yet available. Photos stay on the device and are released when you leave this screen.','Photograph both sides or enter the details manually.','Scan document','Enter manually','Choose an option','Front side','Back side','Step','Take photo','From gallery','Continue','Retake','Photos captured','No photos were uploaded. Enter and confirm vehicle details using the garage form to save the car.','Enter details','Start again','Select an image up to 10 MB.','Could not open the image.','Only clients can add a car to the garage.']
  };
  const docCopy=()=>DOC_COPY[String(document.documentElement?.lang||'ru').slice(0,2).toLowerCase()]||DOC_COPY.ru;

  const DOC_OCR_COPY=Object.freeze({
    ru:{review:'Проверка данных',check:'Проверьте значения перед сохранением в гараж.',run:'Распознать данные на устройстве',progress:'Распознаём документ…',apply:'Заполнить форму',error:'Не удалось распознать документ. Переснимите его или введите данные вручную.',empty:'Ни одно поле автомобиля не определено. Заполните данные вручную.',unavailable:'Распознавание на устройстве недоступно в этом браузере. Ручной ввод работает.',handoff:'Не удалось передать данные в форму гаража.',local:'Распознавание выполняется на устройстве, фотографии не передаются на сервер.',back:'Вернуться к фото'},
    kk:{review:'Деректерді тексеру',check:'Гаражға сақтамас бұрын мәндерді тексеріңіз.',run:'Құрылғыда тану',progress:'Құжат танылуда…',apply:'Нысанды толтыру',error:'Құжат танылмады. Қайта түсіріңіз немесе қолмен енгізіңіз.',empty:'Автокөлік өрістері анықталмады. Қолмен енгізіңіз.',unavailable:'Бұл браузерде тану қолжетімсіз. Қолмен енгізуге болады.',handoff:'Деректерді гаражға жіберу мүмкін емес.',local:'Деректер құрылғыда танылады, фото серверге жіберілмейді.',back:'Фотоға оралу'},
    en:{review:'Review recognized details',check:'Check each field before saving it in your garage.',run:'Recognize on device',progress:'Recognizing document…',apply:'Fill vehicle form',error:'Recognition failed. Retake the photo or enter details manually.',empty:'No vehicle fields were identified. Please enter details manually.',unavailable:'On-device recognition is unavailable in this browser. Manual entry is available.',handoff:'Could not transfer the details into the garage form.',local:'Recognition runs on your device. Photos are not uploaded.',back:'Back to photos'}
  });
  const docOcrCopy=()=>DOC_OCR_COPY[String(document.documentElement?.lang||'ru').slice(0,2).toLowerCase()]||DOC_OCR_COPY.ru;


  const DOC_REVIEW_COPY=Object.freeze({
    ru:{invalid:'Проверьте выделенные поля: VIN — 17 символов без I, O, Q; год от 1950; госномер до 24 символов.',empty:'Введите хотя бы одно поле или воспользуйтесь ручным вводом.',note:'Неопределённые марку и модель можно выбрать в гараже.'},
    kk:{invalid:'Белгіленген өрістерді тексеріңіз: VIN — I, O, Q жоқ 17 таңба; жыл 1950 жылдан; нөмір 24 таңбаға дейін.',empty:'Кемінде бір өрісті енгізіңіз немесе қолмен толтырыңыз.',note:'Анықталмаған марка мен модельді гаражда таңдауға болады.'},
    en:{invalid:'Check highlighted fields: VIN requires 17 characters excluding I, O, Q; year 1950 onward; plate up to 24 characters.',empty:'Enter at least one field or use manual entry.',note:'You can choose an unidentified make or model later in the garage.'}
  });
  const reviewCopy=()=>DOC_REVIEW_COPY[String(document.documentElement?.lang||'ru').slice(0,2).toLowerCase()]||DOC_REVIEW_COPY.ru;

  function renderDocument(){
    const t=docCopy(),client=role()==='client';
    return '<section class="k-page k-scan-page k-document-capture" data-page="scanner">'
      +'<header class="k-document-head"><a data-doc-back-link class="k-btn k-btn-secondary" href="'+(client?'#/cabinet/garage':'#/scan')+'">'+t[0]+'</a><small>'+t[2]+'</small><h1 data-doc-title>'+t[1]+'</h1></header>'
      +(client?'<div data-doc-stage aria-live="polite"></div><input hidden type="file" data-doc-camera accept="image/*" capture="environment"><input hidden type="file" data-doc-gallery accept="image/*"><p data-doc-status role="status" aria-live="polite"></p>':'<p>'+t[21]+'</p>')
      +'</section>';
  }
  function mountDocument(root,context={}){
    const target=root.querySelector('[data-doc-stage]');if(!target)return ()=>{};
    const camera=root.querySelector('[data-doc-camera]'),gallery=root.querySelector('[data-doc-gallery]'),status=root.querySelector('[data-doc-status]');
    const life=context.lifecycle||{},photo={front:'',rear:''},files={front:null,rear:null};let step='intro',disposed=false,revision=0,recognized=null,busy=false;
    const alive=()=>!disposed&&life.isActive?.()!==false&&root.isConnected;
    const release=k=>{if(photo[k]){URL.revokeObjectURL(photo[k]);photo[k]='';}files[k]=null;};
    const button=(key,title,primary=false)=>'<button type="button" class="k-btn '+(primary?'k-btn-primary':'k-btn-secondary')+'" data-doc-next="'+key+'">'+title+'</button>';
    const manual=title=>'<a class="k-btn k-btn-secondary" href="#/cabinet/garage?firstVehicle=1">'+title+'</a>';
    const block=(title,text)=>'<h2>'+title+'</h2><p>'+text+'</p>';
    const escape=v=>String(v||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function draw(){
      if(!alive())return;const t=docCopy(),ocr=docOcrCopy();let out='';
      root.querySelector('[data-doc-title]').textContent=t[1];root.querySelector('[data-doc-back-link]').textContent=t[0];
      if(step==='intro')out=block(t[1],t[4])+button('choose',t[5],true)+manual(t[6]);
      if(step==='choose')out=block(t[7],t[4])+button('front',t[5],true)+manual(t[6])+button('intro',t[0]);
      if(step==='front'||step==='rear'){
        const first=step==='front',src=photo[step];out='<div class="k-document-step">'+t[10]+' '+(first?'1':'2')+' / 2</div>'+block(first?t[8]:t[9],first?t[8]:t[9])
          +'<div class="k-document-preview">'+(src?'<img src="'+src+'" alt="'+(first?t[8]:t[9])+'">':'<span aria-hidden="true">▣</span>')+'</div>'
          +button('camera',src?t[14]+' · '+t[11]:t[11],true)+button('gallery',t[12])+(src?button(first?'rear':'ready',t[13],true):'')+button(first?'choose':'front',t[0]);
      }
      if(step==='ready')out=block(t[15],t[16])+'<div class="k-document-review"><img src="'+photo.front+'" alt="'+t[8]+'"><img src="'+photo.rear+'" alt="'+t[9]+'"></div>'
        +(window.KaretaDocumentOCR?.available?.()?button('recognize',ocr.run,true):'<p>'+ocr.unavailable+'</p>')
        +manual(t[17])+button('rear',t[14])+button('reset',t[18]);
      if(step==='review'){
        const labels={
          ru:{brandName:'Марка',modelName:'Модель',year:'Год выпуска',vin:'VIN',plateNumber:'Госномер'},
          kk:{brandName:'Марка',modelName:'Модель',year:'Шығарылған жылы',vin:'VIN',plateNumber:'Мемлекеттік нөмір'},
          en:{brandName:'Make',modelName:'Model',year:'Year',vin:'VIN',plateNumber:'Plate'}
        };
        const lang=String(document.documentElement?.lang||'ru').slice(0,2).toLowerCase();
        const names=labels[lang]||labels.ru;
        const limits={brandName:80,modelName:80,year:4,vin:17,plateNumber:24};
        out=block(ocr.review,ocr.check)+'<div class="k-document-fields">'+Object.keys(names).map(key=>
          '<label class="k-document-field"><span>'+names[key]+'</span><input data-doc-review-field="'+key+'" type="text" autocomplete="off" spellcheck="false" maxlength="'+limits[key]+'" value="'+escape(recognized?.[key]||'')+'"></label>'
        ).join('')+'</div><p class="k-document-note">'+reviewCopy().note+'</p>'
          +button('apply',ocr.apply,true)+manual(t[6])+button('ready',ocr.back);
      }
            target.innerHTML='<div class="k-document-card">'+out+'</div><p class="k-document-notice">'+(window.KaretaDocumentOCR?.available?.()?ocr.local:t[3])+'</p>';
    }
    const onClick=async e=>{
      const b=e.target.closest?.('[data-doc-next]');if(!b||!alive())return;
      const action=b.dataset.docNext;
      if(action==='camera'||action==='gallery'){status.textContent='';(action==='camera'?camera:gallery).click();return;}
      if(action==='recognize'){
        if(busy||!files.front||!files.rear||!window.KaretaDocumentOCR?.available?.())return;
        busy=true;
        const seq=++revision;
        status.textContent=docOcrCopy().progress;
        const trigger=target.querySelector('[data-doc-next="recognize"]');
        if(trigger)trigger.disabled=true;
        try{
          const result=await window.KaretaDocumentOCR.recognize(files);
          if(!alive()||seq!==revision)return;
          if(!result?.fields||!Object.keys(result.fields).length){status.textContent=docOcrCopy().empty;return;}
          recognized=result.fields;
          step='review';
          status.textContent='';
          draw();
        }catch(_error){if(alive()&&seq===revision)status.textContent=docOcrCopy().error;}
        finally{busy=false;if(trigger&&trigger.isConnected)trigger.disabled=false;}
        return;
      }
      if(action==='apply'){
        if(!recognized)return;
        const inputs=Array.from(target.querySelectorAll('[data-doc-review-field]'));
        const values=Object.fromEntries(inputs.map(el=>[el.dataset.docReviewField,el.value]));
        const checked=window.KaretaDocumentOCR?.validateCandidate?.(values);
        for(const el of inputs)el.classList.toggle('is-invalid',Boolean(checked?.errors?.[el.dataset.docReviewField]));
        if(!checked?.ok){
          status.textContent=checked?.errors?._form?reviewCopy().empty:reviewCopy().invalid;
          inputs.find(el=>checked?.errors?.[el.dataset.docReviewField])?.focus?.();
          return;
        }
        if(!window.KaretaFirstVehicleFlow?.offerDocumentPrefill?.(checked.fields)){
          status.textContent=docOcrCopy().handoff;return;
        }
        recognized=null;revision++;
        location.hash='#/cabinet/garage?firstVehicle=1';
        return;
      }
      if(action==='reset'){revision++;recognized=null;release('front');release('rear');step='intro';}
      else if(['intro','choose','front','rear','ready'].includes(action)){if(action==='ready'&&(!photo.front||!photo.rear))return;revision++;step=action;}
      status.textContent='';draw();
    };
    const onFile=e=>{
      if(!alive())return;const file=e.target.files?.[0];e.target.value='';if(!file)return;
      if(!file.type.startsWith('image/')||file.size<=0||file.size>10*1024*1024){status.textContent=docCopy()[19];return;}
      let url='';try{url=URL.createObjectURL(file);}catch(_){status.textContent=docCopy()[20];return;}
      if(!alive()||!['front','rear'].includes(step)){URL.revokeObjectURL(url);return;}
      revision++;recognized=null;release(step);photo[step]=url;files[step]=file;status.textContent='';draw();
    };
    const onReviewInput=e=>{const el=e.target.closest?.('[data-doc-review-field]');if(el&&recognized)recognized[el.dataset.docReviewField]=el.value;};
    root.addEventListener('click',onClick);root.addEventListener('input',onReviewInput);camera.addEventListener('change',onFile);gallery.addEventListener('change',onFile);
    const observer=typeof MutationObserver==='function'?new MutationObserver(draw):null;
    observer?.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    const cleanup=()=>{if(disposed)return;disposed=true;revision++;recognized=null;root.removeEventListener('click',onClick);root.removeEventListener('input',onReviewInput);camera.removeEventListener('change',onFile);gallery.removeEventListener('change',onFile);observer?.disconnect();release('front');release('rear');};
    life.addCleanup?.(cleanup);draw();return cleanup;
  }

  function render() {
    if (mode() === 'scannerDocument') return renderDocument();
    if (mode() === 'masterQr') return '<section class="k-page k-scan-page" data-page="scanner"><a class="k-btn k-btn-secondary" href="#/master">Назад</a><h1>Мой QR</h1><p>Клиент или мастер сканирует код, открывает ваш профиль и переходит к записи.</p><div class="k-master-qr-identity" hidden data-master-qr-identity><h2 data-master-qr-name></h2><p data-master-qr-detail></p></div><div data-master-qr-code></div><p data-master-qr-status role="status" aria-live="polite">Загружаем ваш профиль…</p><a class="k-btn k-btn-secondary" data-master-qr-link hidden>Открыть мой профиль</a><button class="k-btn k-btn-secondary" type="button" data-master-qr-copy hidden>Скопировать ссылку</button><a class="k-btn k-btn-secondary" data-master-qr-save hidden>Сохранить QR</a><button class="k-btn k-btn-secondary" type="button" data-master-qr-share hidden>Поделиться</button></section>';
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
    if (mode() === 'masterQr') return mountMasterQr(root, context);
    if (mode() === 'scannerDocument') return mountDocument(root, context);
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
      start.disabled = true; status.textContent = 'Открываем сканер…';
      try {
        const mobile = window.KaretaMobile;
        if (mobile?.available?.() && typeof mobile.scanQr === 'function') {
          try {
            const scanned = await mobile.scanQr();
            if (!active() || run !== cameraRun) return;
            const rawValue = String(scanned?.rawValue ?? scanned?.displayValue ?? '').trim();
            if (rawValue) { show(rawValue); return; }
          } catch (nativeError) {
            if (!active() || run !== cameraRun) return;
            if (nativeError?.code === 'CANCELLED') {
              stop(); status.textContent = 'Сканирование отменено.'; return;
            }
            status.textContent = 'Нативный сканер недоступен. Открываем камеру…';
          }
        }
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
  function masterQrUrl(data) {
    const id = String(data?.profile?.id || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Профиль мастера ещё не готов. Заполните профиль и повторите попытку.');
    if (data.profile.profileVisible === false) throw new Error('Публичный профиль скрыт. Включите его показ в настройках профиля.');
    return 'https://kareta.kz/#/masters/profile/master/' + id;
  }
  function mountMasterQr(root, context) {
    const life = context.lifecycle;
    let disposed = false, imageUrl = '';
    const active = () => !disposed && life.isActive() && root.isConnected && role() === 'master';
    life.addCleanup(() => { disposed = true; if(imageUrl) URL.revokeObjectURL(imageUrl); });
    const status = root.querySelector('[data-master-qr-status]');
    const link = root.querySelector('[data-master-qr-link]');
    const copy = root.querySelector('[data-master-qr-copy]');
    const save = root.querySelector('[data-master-qr-save]');
    const share = root.querySelector('[data-master-qr-share]');
    (async () => {
      try {
        if (role() !== 'master') throw new Error('Выберите контекст мастера.');
        const response = await window.KaretaApiClient.request('api/db.php?action=masterProfile.get', { cacheTtlMs:0, force:true, signal:life.signal });
        if (!active()) return;
        if (!response?.ok) throw new Error('Не удалось загрузить ваш профиль. Откройте страницу ещё раз.');
        const data = response.payload?.data || response.payload || response.data || {};
        const url = masterQrUrl(data);
        const name = String(data.profile.name || 'Мастер');
        root.querySelector('[data-master-qr-name]').textContent = name;
        root.querySelector('[data-master-qr-detail]').textContent = [data.profile.spec,data.profile.city].filter(Boolean).join(' · ');
        root.querySelector('[data-master-qr-identity]').hidden = false;
        const qr = new window.KaretaQRCode(-1, 1); // L correction; byte payload is an ASCII URL.
        qr.addData(url); qr.make();
        const size = qr.getModuleCount(), canvas = document.createElement('canvas'), scale = 6;
        canvas.width = canvas.height = (size + 8) * scale;
        canvas.setAttribute('role','img'); canvas.setAttribute('aria-label','Личный QR мастера для записи');
        const paint = canvas.getContext('2d');
        paint.fillStyle = '#fff'; paint.fillRect(0,0,canvas.width,canvas.height);
        paint.fillStyle = '#000';
        for (let y=0;y<size;y++) for (let x=0;x<size;x++) if(qr.isDark(y,x)) paint.fillRect((x+4)*scale,(y+4)*scale,scale,scale);
        root.querySelector('[data-master-qr-code]').replaceChildren(canvas);
        link.href = url; link.hidden = false; copy.hidden = false;
        status.textContent = 'Ваш личный QR готов. Покажите его для сканирования.';
        canvas.toBlob(blob => {
          if (!blob || !active()) return;
          imageUrl = URL.createObjectURL(blob);
          save.href = imageUrl; save.download = 'kareta-master-' + data.profile.id + '-qr.png'; save.hidden = false;
        },'image/png');
        if (typeof navigator.share === 'function') {
          share.hidden = false;
          life.listen(share,'click',async () => {
            if (!active()) return;
            try { await navigator.share({title:'Запись к мастеру ' + name,text:'Мой профиль KARETA',url}); }
            catch(error) { if(active() && error.name !== 'AbortError') status.textContent='Не удалось поделиться. Скопируйте ссылку или сохраните QR.'; }
          });
        }
        life.listen(copy,'click',async () => {
          if (!active()) return;
          try { await navigator.clipboard.writeText(url); if(active()) status.textContent='Ссылка скопирована.'; }
          catch (_) { if(active()) status.textContent='Не удалось скопировать. Используйте ссылку «Открыть мой профиль».'; }
        });
      } catch(error) { if(active()) status.textContent=error.message; }
    })();
  }
  window.KaretaScannerPages = Object.freeze({ render, mount, qrTarget, masterQrUrl });
})();
