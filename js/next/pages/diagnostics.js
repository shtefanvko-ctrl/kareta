(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  if (!ui) throw new Error('KaretaPageUI is required before pages/diagnostics.js');
  const esc = ui.escHtml;

  // Shared page-language signal: the main SPA updates <html lang> without rebuilding the route.
  // BLE and Wi-Fi are roadmap modes until native transport adapters are actually verified.
  const OBD_TRANSPORT_COPY=Object.freeze({
    ru:{title:'Подключение к автомобилю',intro:'Выберите способ связи со сканером',classic:'Bluetooth Classic',classicHint:'ELM327 (Android)',ble:'Bluetooth BLE',wifi:'Wi-Fi OBD-II',planned:'Пока недоступно',permission:'Разрешение Bluetooth',adapter:'Подключение адаптера',ecu:'Ответ электронного блока',choose:'Разрешите Bluetooth, затем выберите ELM327.',paired:'Разрешение есть. Выберите сопряжённый ELM327.',linked:'Адаптер подключён. Дождитесь ответа ЭБУ.',ready:'ЭБУ отвечает. Можно начинать диагностику.',browser:'Подключение через ELM327 доступно только в Android-приложении KARETA.',status:'Состояние подключения'},
    kk:{title:'Автокөлікке қосылу',intro:'Сканермен байланыс түрін таңдаңыз',classic:'Bluetooth Classic',classicHint:'ELM327 (Android)',ble:'Bluetooth BLE',wifi:'Wi-Fi OBD-II',planned:'Әзірге қолжетімсіз',permission:'Bluetooth рұқсаты',adapter:'Адаптерге қосылу',ecu:'Электрондық блоктың жауабы',choose:'Bluetooth рұқсатын беріп, ELM327 таңдаңыз.',paired:'Рұқсат берілді. Жұптастырылған ELM327 таңдаңыз.',linked:'Адаптер қосылды. ЭБУ жауабын күтіңіз.',ready:'ЭБУ жауап берді. Диагностиканы бастауға болады.',browser:'ELM327 арқылы қосылу тек KARETA Android қолданбасында қолжетімді.',status:'Қосылу күйі'},
    en:{title:'Connect to your vehicle',intro:'Choose the scanner connection type',classic:'Bluetooth Classic',classicHint:'ELM327 (Android)',ble:'Bluetooth BLE',wifi:'Wi-Fi OBD-II',planned:'Not available yet',permission:'Bluetooth permission',adapter:'Adapter connection',ecu:'ECU response',choose:'Allow Bluetooth, then choose your ELM327.',paired:'Permission granted. Select a paired ELM327.',linked:'Adapter connected. Waiting for the ECU.',ready:'ECU responding. You can start diagnostics.',browser:'ELM327 connection is available only in the KARETA Android app.',status:'Connection status'}
  });
  const obdTransportCopy=()=>{
    const lang=String(document.documentElement?.lang||'ru').slice(0,2).toLowerCase();
    return OBD_TRANSPORT_COPY[lang]||OBD_TRANSPORT_COPY.ru;
  };
  function obdTransportGuide(){
    const t=obdTransportCopy();
    return `<section class="k-obd-transport-guide" data-obd-transport-guide>
      <header class="k-obd-transport-intro"><strong data-obd-transport-title>${t.title}</strong><span data-obd-transport-intro>${t.intro}</span></header>
      <div class="k-obd-transport-choices">
        <span class="k-obd-transport-choice is-supported" data-obd-transport="classic"><b data-obd-classic-title>${t.classic}</b><small data-obd-classic-hint>${t.classicHint}</small><i aria-hidden="true">✓</i></span>
        <span class="k-obd-transport-choice is-planned" data-obd-transport="ble"><b data-obd-ble-title>${t.ble}</b><small data-obd-ble-hint>${t.planned}</small></span>
        <span class="k-obd-transport-choice is-planned" data-obd-transport="wifi"><b data-obd-wifi-title>${t.wifi}</b><small data-obd-wifi-hint>${t.planned}</small></span>
      </div>
      <ol class="k-obd-connection-steps" aria-label="${t.status}" data-obd-steps-label>
        <li data-obd-step="permission" data-state="pending"><span class="k-obd-step-count">1</span><span data-obd-step-permission>${t.permission}</span></li>
        <li data-obd-step="adapter" data-state="pending"><span class="k-obd-step-count">2</span><span data-obd-step-adapter>${t.adapter}</span></li>
        <li data-obd-step="ecu" data-state="pending"><span class="k-obd-step-count">3</span><span data-obd-step-ecu>${t.ecu}</span></li>
      </ol>
      <p role="status" aria-live="polite" class="k-obd-transport-status" data-obd-transport-status>${t.choose}</p>
    </section>`;
  }

  const OBD_SCREEN_COPY=Object.freeze({
  "ru": {
    "eyebrow": "ДИАГНОСТИКА АВТОМОБИЛЯ",
    "titleMain": "Диагностика ЭБУ · ELM327",
    "description": "Подключение адаптера, чтение основных параметров и кодов неисправностей. Сессии сохраняются офлайн и синхронизируются с KARETA.KZ после появления сети.",
    "app": "Приложение",
    "bluetooth": "Bluetooth",
    "offline": "Офлайн",
    "offlineDesc": "Несинхронизированные диагностические сессии.",
    "vehicle": "Автомобиль",
    "garage": "Мой гараж",
    "liveTitle": "Параметры двигателя",
    "reconnect": "Переподключить",
    "start": "Старт",
    "stop": "Стоп",
    "rpm": "ОБОРОТЫ",
    "speed": "СКОРОСТЬ",
    "coolant": "ОЖ",
    "voltageUpper": "НАПРЯЖЕНИЕ",
    "rpmUnit": "об/мин",
    "speedUnit": "км/ч",
    "pairHint": "Сначала выполните сопряжение ELM327 в настройках Android. KARETA показывает уже сопряжённые Bluetooth-устройства.",
    "chooseElm": "Выбрать ELM327",
    "initialize": "Инициализировать",
    "disconnect": "Отключить",
    "diagnostics": "Диагностика",
    "network": "Сеть",
    "quickScan": "Быстрая диагностика",
    "quickDetail": "RPM · скорость · температура · напряжение · DTC · VIN",
    "errors": "Ошибки DTC",
    "savedCodes": "Mode 03 · сохранённые коды",
    "voltage": "Напряжение",
    "adapterVoltage": "Напряжение питания адаптера",
    "clearDtc": "Сбросить ошибки",
    "clearNote": "Только с подтверждением; может обнулить мониторы готовности",
    "send": "Отправить",
    "result": "Результат",
    "sync": "Синхронизировать",
    "findParts": "Найти запчасти",
    "findMaster": "Найти мастера",
    "findSto": "Найти СТО",
    "partCaution": "Код ошибки не доказывает необходимость замены детали. Сначала проверьте возможные причины и совместимость.",
    "noCarResult": "Диагностика выполнена без автомобиля. Результат доступен в текущем сеансе, но пока не сохранён в историю гаража.",
    "saveCar": "Сохранить для выбранного автомобиля",
    "history": "История",
    "refresh": "Обновить",
    "commandPlaceholder": "OBD / AT команда, например 010C",
    "noGarage": "Диагностика доступна без автомобиля. Для сохранения результата в гараже сначала добавьте автомобиль.",
    "openGarage": "Открыть мой гараж",
    "unbound": "Диагностика без автомобиля",
    "boundHint": "Отчёт будет связан с выбранным автомобилем",
    "unboundHint": "Сканирование доступно без гаража. Выберите автомобиль только для сохранения истории.",
    "change": "Изменить",
    "selectVehicle": "Выбрать автомобиль",
    "missingCar": "Запрошенный автомобиль не найден или недоступен. История не будет привязана автоматически.",
    "withoutVehicle": "Без автомобиля",
    "noAutoSave": "Не сохранять результат в гараж автоматически",
    "vehicleFromGarage": "Автомобиль из гаража",
    "selected": "Выбрано",
    "select": "Выбрать",
    "failedGarage": "Не удалось загрузить гараж. Диагностика доступна без автомобиля; сохранение истории недоступно до подтверждённого выбора.",
    "foundCodes": "Найдены коды неисправностей",
    "explainError": "Разобрать ошибку",
    "askMasters": "Спросить мастеров",
    "powertrain": "Силовой агрегат",
    "chassis": "Шасси",
    "body": "Кузов",
    "networkDtc": "Сеть/связь"
  },
  "kk": {
    "eyebrow": "АВТОКӨЛІК ДИАГНОСТИКАСЫ",
    "titleMain": "ЭБУ диагностикасы · ELM327",
    "description": "Адаптерді қосу, негізгі параметрлер мен ақау кодтарын оқу. Сеанстар офлайн сақталады және желі қосылғанда KARETA.KZ-пен синхрондалады.",
    "app": "Қолданба",
    "bluetooth": "Bluetooth",
    "offline": "Офлайн",
    "offlineDesc": "Синхрондалмаған диагностикалық сеанстар.",
    "vehicle": "Автокөлік",
    "garage": "Менің гаражым",
    "liveTitle": "Қозғалтқыш параметрлері",
    "reconnect": "Қайта қосылу",
    "start": "Бастау",
    "stop": "Тоқтату",
    "rpm": "АЙНАЛЫМ",
    "speed": "ЖЫЛДАМДЫҚ",
    "coolant": "САЛҚЫНДАТҚЫШ",
    "voltageUpper": "КЕРНЕУ",
    "rpmUnit": "айн/мин",
    "speedUnit": "км/сағ",
    "pairHint": "Алдымен Android баптауларында ELM327 құрылғысын жұптастырыңыз. KARETA жұптастырылған Bluetooth құрылғыларын көрсетеді.",
    "chooseElm": "ELM327 таңдау",
    "initialize": "Іске қосу",
    "disconnect": "Ажырату",
    "diagnostics": "Диагностика",
    "network": "Желі",
    "quickScan": "Жедел диагностика",
    "quickDetail": "RPM · жылдамдық · температура · кернеу · DTC · VIN",
    "errors": "DTC қателері",
    "savedCodes": "Mode 03 · сақталған кодтар",
    "voltage": "Кернеу",
    "adapterVoltage": "Адаптер қорегінің кернеуі",
    "clearDtc": "Қателерді өшіру",
    "clearNote": "Тек растаумен; дайындық мониторлары нөлденуі мүмкін",
    "send": "Жіберу",
    "result": "Нәтиже",
    "sync": "Синхрондау",
    "findParts": "Қосалқы бөлшектерді табу",
    "findMaster": "Шеберді табу",
    "findSto": "Автосервисті табу",
    "partCaution": "Қате коды бөлшекті ауыстыру қажеттігін дәлелдемейді. Алдымен ықтимал себептер мен үйлесімділікті тексеріңіз.",
    "noCarResult": "Диагностика автокөліксіз орындалды. Нәтиже ағымдағы сеанста қолжетімді, бірақ гараж тарихына сақталмады.",
    "saveCar": "Таңдалған автокөлікке сақтау",
    "history": "Тарих",
    "refresh": "Жаңарту",
    "commandPlaceholder": "OBD / AT командасы, мысалы 010C",
    "noGarage": "Автокөліксіз диагностика жасауға болады. Нәтижені гаражға сақтау үшін алдымен көлік қосыңыз.",
    "openGarage": "Гаражды ашу",
    "unbound": "Автокөлік таңдалмаған",
    "boundHint": "Есеп таңдалған автокөлікке тіркеледі",
    "unboundHint": "Гаражсыз сканерлеуге болады. Тарихқа сақтау үшін автокөлікті таңдаңыз.",
    "change": "Өзгерту",
    "selectVehicle": "Автокөлікті таңдау",
    "missingCar": "Сұралған автокөлік табылмады немесе қолжетімсіз. Тарих автоматты түрде тіркелмейді.",
    "withoutVehicle": "Автокөліксіз",
    "noAutoSave": "Нәтижені гаражға автоматты сақтамау",
    "vehicleFromGarage": "Гараждағы автокөлік",
    "selected": "Таңдалды",
    "select": "Таңдау",
    "failedGarage": "Гараж жүктелмеді. Автокөліксіз диагностика қолжетімді; тарихты сақтау үшін көлікті таңдаңыз.",
    "foundCodes": "Табылған ақау кодтары",
    "explainError": "Қатені түсіндіру",
    "askMasters": "Шеберлерден сұрау",
    "powertrain": "Күштік агрегат",
    "chassis": "Шасси",
    "body": "Шанақ",
    "networkDtc": "Желі/байланыс"
  },
  "en": {
    "eyebrow": "VEHICLE DIAGNOSTICS",
    "titleMain": "ECU diagnostics · ELM327",
    "description": "Connect the adapter and read key values and trouble codes. Sessions are saved offline and synchronized with KARETA.KZ when online.",
    "app": "App",
    "bluetooth": "Bluetooth",
    "offline": "Offline",
    "offlineDesc": "Unsynchronized diagnostic sessions.",
    "vehicle": "Vehicle",
    "garage": "My garage",
    "liveTitle": "Engine live data",
    "reconnect": "Reconnect",
    "start": "Start",
    "stop": "Stop",
    "rpm": "RPM",
    "speed": "SPEED",
    "coolant": "COOLANT",
    "voltageUpper": "VOLTAGE",
    "rpmUnit": "rpm",
    "speedUnit": "km/h",
    "pairHint": "First pair ELM327 in Android settings. KARETA lists already paired Bluetooth devices.",
    "chooseElm": "Choose ELM327",
    "initialize": "Initialize",
    "disconnect": "Disconnect",
    "diagnostics": "Diagnostics",
    "network": "Network",
    "quickScan": "Quick scan",
    "quickDetail": "RPM · speed · temperature · voltage · DTC · VIN",
    "errors": "DTC codes",
    "savedCodes": "Mode 03 · stored codes",
    "voltage": "Voltage",
    "adapterVoltage": "Adapter supply voltage",
    "clearDtc": "Clear trouble codes",
    "clearNote": "Confirmation required; may reset readiness monitors",
    "send": "Send",
    "result": "Result",
    "sync": "Synchronize",
    "findParts": "Find parts",
    "findMaster": "Find a mechanic",
    "findSto": "Find a service center",
    "partCaution": "A trouble code does not prove a part needs replacing. Check possible causes and compatibility first.",
    "noCarResult": "Scan completed without a selected vehicle. Results are available in this session but have not been saved to garage history.",
    "saveCar": "Save for selected vehicle",
    "history": "History",
    "refresh": "Refresh",
    "commandPlaceholder": "OBD / AT command, e.g. 010C",
    "noGarage": "You can scan without a vehicle. Add a car to save the results to your garage.",
    "openGarage": "Open my garage",
    "unbound": "Diagnostics without a vehicle",
    "boundHint": "The report will be associated with the selected vehicle",
    "unboundHint": "Scan without a garage. Select a vehicle only to save diagnostics history.",
    "change": "Change",
    "selectVehicle": "Choose a vehicle",
    "missingCar": "The requested vehicle was not found or is unavailable. History will not be linked automatically.",
    "withoutVehicle": "Without a vehicle",
    "noAutoSave": "Do not automatically save results to the garage",
    "vehicleFromGarage": "Garage vehicle",
    "selected": "Selected",
    "select": "Select",
    "failedGarage": "The garage could not be loaded. You can scan without a car, but history cannot be saved until a vehicle is selected.",
    "foundCodes": "Trouble codes found",
    "explainError": "Explain code",
    "askMasters": "Ask mechanics",
    "powertrain": "Powertrain",
    "chassis": "Chassis",
    "body": "Body",
    "networkDtc": "Network/communication"
  }
});
  const obdScreenCopy=()=>OBD_SCREEN_COPY[String(document.documentElement?.lang||'ru').slice(0,2).toLowerCase()]||OBD_SCREEN_COPY.ru;

  function renderDiagnostics(){
    return `<section class="k-page k-diagnostics-page" data-page="diagnostics">
      <header class="k-r84-workspace-head k-diagnostics-head">
        <span data-obd-i18n="eyebrow">ДИАГНОСТИКА АВТОМОБИЛЯ</span>
        <h1 data-obd-i18n="titleMain">Диагностика ЭБУ · ELM327</h1>
        <p data-obd-i18n="description">Подключение адаптера, чтение основных параметров и кодов неисправностей. Сессии сохраняются офлайн и синхронизируются с KARETA.KZ после появления сети.</p>
      </header>

      <div class="k-obd-status-grid">
        <article class="k-obd-card">
          <div class="k-obd-card-head"><strong data-obd-i18n="app">Приложение</strong><span data-obd-native class="k-obd-chip">Проверка…</span></div>
          <p data-obd-native-text>Проверяем Native API.</p>
        </article>
        <article class="k-obd-card">
          <div class="k-obd-card-head"><strong data-obd-i18n="bluetooth">Bluetooth</strong><span data-obd-bt class="k-obd-chip">—</span></div>
          <p data-obd-device>Адаптер не выбран.</p>
        </article>
        <article class="k-obd-card">
          <div class="k-obd-card-head"><strong data-obd-i18n="offline">Офлайн</strong><span data-obd-offline class="k-obd-chip">0</span></div>
          <p data-obd-i18n="offlineDesc">Несинхронизированные диагностические сессии.</p>
        </article>
      </div>

      <article class="k-obd-panel k-obd-vehicle-panel">
        <div class="k-obd-panel-head">
          <div><span>0</span><h2 data-obd-i18n="vehicle">Автомобиль</h2></div>
          <a class="k-btn" href="#/cabinet/garage" data-obd-i18n="garage">Мой гараж</a>
        </div>
        <div class="k-obd-vehicle-current" data-obd-vehicle-current>
          <p class="k-obd-muted">Загружаем автомобили…</p>
        </div>
        <div class="k-obd-vehicle-list" data-obd-vehicle-list hidden></div>
      </article>

      <article class="k-obd-panel k-obd-live-panel">
        <div class="k-obd-panel-head">
          <div><span>LIVE</span><h2 data-obd-i18n="liveTitle">Параметры двигателя</h2></div>
          <div class="k-obd-actions">
            <button type="button" class="k-btn" data-obd-reconnect data-obd-i18n="reconnect">Переподключить</button>
            <button type="button" class="k-btn k-btn-primary" data-obd-live-start data-obd-i18n="start" disabled>Старт</button>
            <button type="button" class="k-btn" data-obd-live-stop data-obd-i18n="stop" disabled>Стоп</button>
          </div>
        </div>
        <div class="k-obd-live-grid">
          <article><small data-obd-i18n="rpm">ОБОРОТЫ</small><strong data-obd-live-rpm>—</strong><span data-obd-i18n="rpmUnit">об/мин</span></article>
          <article><small data-obd-i18n="speed">СКОРОСТЬ</small><strong data-obd-live-speed>—</strong><span data-obd-i18n="speedUnit">км/ч</span></article>
          <article><small data-obd-i18n="coolant">ОЖ</small><strong data-obd-live-coolant>—</strong><span>°C</span></article>
          <article><small data-obd-i18n="voltageUpper">НАПРЯЖЕНИЕ</small><strong data-obd-live-voltage>—</strong><span>V</span></article>
        </div>
        <p class="k-obd-live-state" data-obd-live-state>Live-режим остановлен.</p>
      </article>

      <div class="k-obd-layout">
        <article class="k-obd-panel">
          <div class="k-obd-panel-head">
            <div><span>1</span><h2>ELM327</h2></div>
            <button type="button" class="k-btn" data-obd-settings>Bluetooth</button>
          </div>
          ${obdTransportGuide()}
          <p class="k-obd-muted" data-obd-i18n="pairHint">Сначала выполните сопряжение ELM327 в настройках Android. KARETA показывает уже сопряжённые Bluetooth-устройства.</p>
          <div class="k-obd-actions">
            <button type="button" class="k-btn k-btn-primary" data-obd-devices data-obd-i18n="chooseElm">Выбрать ELM327</button>
            <button type="button" class="k-btn" data-obd-init data-obd-i18n="initialize" disabled>Инициализировать</button>
            <button type="button" class="k-btn" data-obd-disconnect data-obd-i18n="disconnect" disabled>Отключить</button>
          </div>
          <div class="k-obd-devices" data-obd-device-list hidden></div>
        </article>

        <article class="k-obd-panel">
          <div class="k-obd-panel-head"><div><span>2</span><h2 data-obd-i18n="diagnostics">Диагностика</h2></div><span data-obd-online class="k-obd-chip">Сеть</span></div>
          <div class="k-obd-diagnostic-grid">
            <button type="button" class="k-obd-action" data-obd-snapshot disabled><b data-obd-i18n="quickScan">Быстрая диагностика</b><small data-obd-i18n="quickDetail">RPM · скорость · температура · напряжение · DTC · VIN</small></button>
            <button type="button" class="k-obd-action" data-obd-command="03" disabled><b data-obd-i18n="errors">Ошибки DTC</b><small data-obd-i18n="savedCodes">Mode 03 · сохранённые коды</small></button>
            <button type="button" class="k-obd-action" data-obd-command="0902" disabled><b>VIN</b><small>Mode 09 PID 02</small></button>
            <button type="button" class="k-obd-action" data-obd-command="ATRV" disabled><b data-obd-i18n="voltage">Напряжение</b><small data-obd-i18n="adapterVoltage">Напряжение питания адаптера</small></button>
            <button type="button" class="k-obd-action" data-obd-clear disabled><b data-obd-i18n="clearDtc">Сбросить ошибки</b><small data-obd-i18n="clearNote">Только с подтверждением; может обнулить мониторы готовности</small></button>
          </div>

          <div class="k-obd-command">
            <input type="text" maxlength="32" placeholder="OBD / AT команда, например 010C" data-obd-i18n-placeholder="commandPlaceholder" data-obd-custom>
            <button type="button" class="k-btn" data-obd-send data-obd-i18n="send" disabled>Отправить</button>
          </div>
        </article>
      </div>

      <article class="k-obd-panel k-obd-result-panel">
        <div class="k-obd-panel-head">
          <div><span>3</span><h2 data-obd-i18n="result">Результат</h2></div>
          <button type="button" class="k-btn" data-obd-sync data-obd-i18n="sync">Синхронизировать</button>
        </div>
        <div class="k-obd-dtc-list" data-obd-dtc-list hidden></div>
        <nav class="k-obd-actions k-obd-repair-actions" aria-label="Дальнейшие действия по результатам диагностики" data-obd-repair-actions hidden>
          <a class="k-btn" href="#/parts" data-obd-repair-parts data-obd-i18n="findParts">Найти запчасти</a>
          <a class="k-btn" href="#/masters" data-obd-repair-master data-obd-i18n="findMaster">Найти мастера</a>
          <a class="k-btn" href="#/masters?type=sto" data-obd-repair-sto data-obd-i18n="findSto">Найти СТО</a>
          <p class="k-obd-muted" data-obd-i18n="partCaution">Код ошибки не доказывает необходимость замены детали. Сначала проверьте возможные причины и совместимость.</p>
        </nav>
        <div class="k-obd-pending-save" data-obd-pending-save hidden>
          <p class="k-obd-muted" data-obd-i18n="noCarResult">Диагностика выполнена без автомобиля. Результат доступен в текущем сеансе, но пока не сохранён в историю гаража.</p>
          <button type="button" class="k-btn k-btn-primary" data-obd-save-current data-obd-i18n="saveCar" disabled>Сохранить для выбранного автомобиля</button>
          <a class="k-btn" href="#/cabinet/garage" data-obd-i18n="garage">Мой гараж</a>
        </div>
        <pre class="k-obd-result" data-obd-result>Подключите ELM327 и запустите диагностику.</pre>
      </article>

      <article class="k-obd-panel">
        <div class="k-obd-panel-head"><div><span>4</span><h2 data-obd-i18n="history">История</h2></div><button type="button" class="k-btn" data-obd-history-refresh data-obd-i18n="refresh">Обновить</button></div>
        <div class="k-obd-history" data-obd-history><p class="k-obd-muted">История загружается…</p></div>
      </article>
    </section>`;
  }

  function mountDiagnostics(context={}){
    const root=document.querySelector('[data-page="diagnostics"]');
    if(!root)return;

    const mobile=window.KaretaMobile;
    const q=s=>root.querySelector(s);
    const qa=s=>Array.from(root.querySelectorAll(s));
    const nativeChip=q('[data-obd-native]');
    const nativeText=q('[data-obd-native-text]');
    const btChip=q('[data-obd-bt]');
    const deviceText=q('[data-obd-device]');
    const offlineChip=q('[data-obd-offline]');
    const onlineChip=q('[data-obd-online]');
    const result=q('[data-obd-result]');
    const deviceList=q('[data-obd-device-list]');
    const initBtn=q('[data-obd-init]');
    const disconnectBtn=q('[data-obd-disconnect]');
    const snapshotBtn=q('[data-obd-snapshot]');
    const sendBtn=q('[data-obd-send]');
    const custom=q('[data-obd-custom]');
    const vehicleCurrent=q('[data-obd-vehicle-current]');
    const vehicleList=q('[data-obd-vehicle-list]');
    const dtcList=q('[data-obd-dtc-list]');
    const repairActions=q('[data-obd-repair-actions]');
    const clearBtn=q('[data-obd-clear]');
    const pendingSave=q('[data-obd-pending-save]');
    const liveStart=q('[data-obd-live-start]');
    const liveStop=q('[data-obd-live-stop]');
    const liveState=q('[data-obd-live-state]');
    const liveRpm=q('[data-obd-live-rpm]');
    const liveSpeed=q('[data-obd-live-speed]');
    const liveCoolant=q('[data-obd-live-coolant]');
    const liveVoltage=q('[data-obd-live-voltage]');
    let permissionOk=false;
    let connected=false;
    let ready=false;
    let currentAdapter=null;
    let selectedVehicle=null;
    let vehicles=[];
    let launchVehicleMissing=false;
    let pendingSnapshot=null;
    let pendingCapturedAt=0;
    let liveTimer=0;
    let liveBusy=false;
    let liveFailures=0;
    let liveRevision=0;
    let clearBusy=false;
    let disposed=false;

    const setResult=value=>{
      result.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
    };
    const vehicleTitle=v=>String(v?.title||[v?.brand,v?.model,v?.year_label||v?.year].filter(Boolean).join(' ')||'Автомобиль');
    const vehicleMeta=v=>[v?.vin,v?.plate||v?.plate_number,v?.mileage_km?String(v.mileage_km)+' км':''].filter(Boolean).join(' · ');

    function updateRepairLinks(){
      // Parts already accepts vehicleId; never pass a DTC as OEM or a privately guessed car.
      const authorized=selectedVehicle&&vehicles.some(v=>String(v.id)===String(selectedVehicle.id));
      const parts=q('[data-obd-repair-parts]');
      if(parts)parts.href=authorized?'#/parts?vehicleId='+encodeURIComponent(String(selectedVehicle.id)):'#/parts';
    }

    function refreshPendingSave(){
      pendingSave.hidden=!pendingSnapshot;
      const saveButton=pendingSave.querySelector('[data-obd-save-current]');
      if(saveButton)saveButton.disabled=!selectedVehicle;
    }

    function renderVehicleChoice(){
      const t=obdScreenCopy();
      updateRepairLinks();
      if(!vehicles.length){
        vehicleCurrent.innerHTML=`<p class="k-obd-muted">${esc(t.noGarage)}</p><a class="k-btn" href="#/cabinet/garage">${esc(t.openGarage)}</a>`;
        vehicleList.hidden=true;
        refreshPendingSave();
        return;
      }
      vehicleCurrent.innerHTML=`<button type="button" class="k-obd-selected-vehicle" data-obd-vehicle-toggle>
        <span><b>${selectedVehicle?esc(vehicleTitle(selectedVehicle)):esc(t.unbound)}</b><small>${selectedVehicle?esc(vehicleMeta(selectedVehicle)||t.boundHint):esc(t.unboundHint)}</small></span>
        <em>${selectedVehicle?esc(t.change):esc(t.selectVehicle)}</em>
      </button>${launchVehicleMissing?`<p class="k-obd-muted" role="alert">${esc(t.missingCar)}</p>`:''}`;
      vehicleList.innerHTML=`<button type="button" class="k-obd-vehicle-option ${!selectedVehicle?'is-active':''}" data-obd-vehicle-unbind><span><b>${esc(t.withoutVehicle)}</b><small>${esc(t.noAutoSave)}</small></span></button>`+
        vehicles.map(v=>`<button type="button" class="k-obd-vehicle-option ${String(v.id)===String(selectedVehicle?.id)?'is-active':''}" data-obd-vehicle-id="${esc(v.id||'')}">
        <span><b>${esc(vehicleTitle(v))}</b><small>${esc(vehicleMeta(v)||t.vehicleFromGarage)}</small></span>
        <em>${String(v.id)===String(selectedVehicle?.id)?esc(t.selected):esc(t.select)}</em>
      </button>`).join('');
      refreshPendingSave();
    }

    async function loadVehicles(){
      // The garage vehicle page hands off its vehicleId once. Home entry stays unbound.
      let launchVehicleId='';
      try{
        launchVehicleId=sessionStorage.getItem('kareta.obd.vehicleId')||'';
        sessionStorage.removeItem('kareta.obd.vehicleId');
      }catch(_){}
      try{
        const api=window.KaretaClientCabinetApi;
        if(!api?.get){renderVehicleChoice();return;}
        const response=await api.get({cacheTtlMs:0,force:true,dedupe:false});
        const payload=response?.payload?.data||response?.payload||{};
        vehicles=Array.isArray(payload.vehicles)?payload.vehicles.filter(v=>String(v?.status||'active')!=='archived'):[];
        selectedVehicle=launchVehicleId?vehicles.find(v=>String(v.id)===launchVehicleId)||null:null;
        launchVehicleMissing=!!launchVehicleId&&!selectedVehicle;
        renderVehicleChoice();
      }catch(_){
        vehicleCurrent.innerHTML=`<p class="k-obd-muted">${esc(obdScreenCopy().failedGarage)}</p>`;
      }
    }

    const dtcSystem=code=>{
      const c=String(code||'').charAt(0),t=obdScreenCopy();
      return c==='P'?t.powertrain:c==='C'?t.chassis:c==='B'?t.body:c==='U'?t.networkDtc:'OBD-II';
    };
    let lastDtcCodes=[];
    function renderDtc(codes){
      lastDtcCodes=Array.isArray(codes)?codes:[];
      const t=obdScreenCopy();
      const list=Array.isArray(codes)?Array.from(new Set(codes.map(c=>String(c||'').trim().toUpperCase()).filter(c=>/^[PCBU][0-9A-F]{4}$/.test(c)))):[];
      repairActions.hidden=!list.length;
      if(!list.length){dtcList.hidden=true;dtcList.innerHTML='';return;}
      dtcList.hidden=false;
      dtcList.innerHTML=`<div class="k-obd-dtc-head"><b>${esc(t.foundCodes)}</b><span>${list.length}</span></div>
        <div class="k-obd-dtc-grid">${list.map(code=>`<article><strong>${esc(code)}</strong><span>${esc(dtcSystem(code))}</span><a href="#/assistant" data-obd-dtc-help="${esc(code)}">${esc(t.explainError)}</a><a href="#/community/question/create?mode=help" data-obd-dtc-question="${esc(code)}">${esc(t.askMasters)}</a></article>`).join('')}</div>`;
    }

    function renderLive(data={}){
      const fmt=(v,d=0)=>v===null||v===undefined||Number.isNaN(Number(v))?'—':Number(v).toFixed(d);
      liveRpm.textContent=fmt(data.rpm,0);
      liveSpeed.textContent=fmt(data.speedKph,0);
      liveCoolant.textContent=fmt(data.coolantC,0);
      liveVoltage.textContent=fmt(data.voltageV,1);
      liveState.textContent='Обновлено '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }

    async function pollLive(){
      if(!ready||!mobile?.available?.()||liveBusy||disposed)return;
      const revision=liveRevision;
      liveBusy=true;
      try{
        const data=await mobile.elmLiveSnapshot();
        if(revision!==liveRevision||!ready||disposed)return;
        liveFailures=0;
        renderLive(data||{});
      }catch(error){
        if(revision!==liveRevision||!ready||disposed)return;
        liveFailures+=1;
        liveState.textContent='Live: '+(error.message||String(error));
        if(liveFailures>=3)stopLive();
      }finally{
        if(revision===liveRevision)liveBusy=false;
      }
    }

    function startLive(){
      if(!ready||liveTimer)return;
      liveFailures=0;
      liveRevision++;
      liveStart.disabled=true;
      liveStop.disabled=false;
      liveState.textContent='Live-режим запущен…';
      pollLive();
      liveTimer=window.setInterval(pollLive,1600);
    }

    function stopLive(){
      liveRevision++; // Invalidates unresolved Native Bridge reads after Stop/disconnect/unmount.
      if(liveTimer){window.clearInterval(liveTimer);liveTimer=0;}
      liveBusy=false;
      [liveRpm,liveSpeed,liveCoolant,liveVoltage].forEach(node=>{if(node)node.textContent='—';});
      liveStart.disabled=!ready;
      liveStop.disabled=true;
      liveState.textContent='Live-режим остановлен.';
    }


    function updateScreenCopy(){
      const t=obdScreenCopy();
      qa('[data-obd-i18n]').forEach(node=>{
        const translated=t[node.dataset.obdI18n];
        if(typeof translated==='string')node.textContent=translated;
      });
      const placeholder=q('[data-obd-i18n-placeholder]');
      if(placeholder&&t.commandPlaceholder)placeholder.setAttribute('placeholder',t.commandPlaceholder);
    }

    function updateTransportGuide(){
      updateScreenCopy();
      const t=obdTransportCopy();
      const labelPairs=[
        ['[data-obd-transport-title]',t.title],['[data-obd-transport-intro]',t.intro],
        ['[data-obd-classic-title]',t.classic],['[data-obd-classic-hint]',t.classicHint],
        ['[data-obd-ble-title]',t.ble],['[data-obd-ble-hint]',t.planned],
        ['[data-obd-wifi-title]',t.wifi],['[data-obd-wifi-hint]',t.planned],
        ['[data-obd-step-permission]',t.permission],['[data-obd-step-adapter]',t.adapter],['[data-obd-step-ecu]',t.ecu]
      ];
      labelPairs.forEach(([selector,label])=>{const element=q(selector);if(element)element.textContent=label;});
      const stages={permission:permissionOk,adapter:connected,ecu:ready};
      Object.entries(stages).forEach(([name,isDone])=>{
        const step=q('[data-obd-step="'+name+'"]');
        if(step)step.dataset.state=isDone?'done':name==='permission'?'active':name==='adapter'&&permissionOk?'active':name==='ecu'&&connected?'active':'pending';
      });
      const state=q('[data-obd-transport-status]');
      if(state)state.textContent=!mobile?.available?.()?t.browser:ready?t.ready:connected?t.linked:permissionOk?t.paired:t.choose;
      const steps=q('[data-obd-steps-label]');
      if(steps)steps.setAttribute('aria-label',t.status);
    }

    const setDiagnosticReady=value=>{
      ready=!!value;
      snapshotBtn.disabled=!ready;
      sendBtn.disabled=!ready;
      liveStart.disabled=!ready||!!liveTimer;
      qa('[data-obd-command]').forEach(button=>button.disabled=!ready);
      clearBtn.disabled=!ready;
      if(!ready)stopLive();
      updateTransportGuide();
    };
    const setConnected=value=>{
      connected=!!value;
      initBtn.disabled=!connected;
      disconnectBtn.disabled=!connected;
      if(!connected)setDiagnosticReady(false);
      btChip.textContent=ready?'Готово':connected?'Адаптер':'Не подключено';
      btChip.classList.toggle('is-ok',connected);
      updateTransportGuide();
    };
    const updateNetwork=()=>{
      const online=navigator.onLine;
      onlineChip.textContent=online?'Онлайн':'Офлайн';
      onlineChip.classList.toggle('is-ok',online);
      onlineChip.classList.toggle('is-warn',!online);
    };
    const updateOffline=async()=>{
      if(!mobile?.available?.())return;
      try{
        const state=await mobile.offlineState();
        offlineChip.textContent=String(state.count||0);
        offlineChip.classList.toggle('is-warn',Number(state.count||0)>0);
      }catch(_){}
    };

    async function refreshStatus(){
      updateNetwork();
      if(!mobile?.available?.()){
        permissionOk=false;
        nativeChip.textContent='Только Android';
        nativeChip.classList.add('is-warn');
        nativeText.textContent='ELM327 доступен в приложении KARETA.KZ - Автосервис. В обычном браузере раздел работает только как история диагностики.';
        setConnected(false);
        return;
      }
      nativeChip.textContent='Native API';
      nativeChip.classList.add('is-ok');
      nativeText.textContent='Bluetooth и офлайн-хранилище доступны.';
      try{
        const status=await mobile.elmStatus();
        permissionOk=!!status.permission;
        if(!status.permission){
          try{
            const permission=await mobile.requestPermission('bluetooth');
            permissionOk=permission?.granted===true;
            if(permission?.granted===false){
              btChip.textContent='Нужно разрешение';
              btChip.classList.add('is-warn');
            }
          }catch(_){}
        }
        setConnected(!!status.connected);
        setDiagnosticReady(!!status.ready);
        btChip.textContent=status.ready?'Готово':status.connected?'Адаптер':'Не подключено';
        if(status.lastError&&!status.ready) nativeText.textContent='ELM327: '+status.lastError;
        updateTransportGuide();
        if(status.address){
          currentAdapter={name:status.name||'ELM327',address:status.address};
          deviceText.textContent=`${currentAdapter.name} · ${currentAdapter.address}`;
        }else{
          deviceText.textContent=status.enabled?'Адаптер не выбран.':'Bluetooth выключен.';
        }
      }catch(error){setResult(error.message||String(error));}
      await updateOffline();
    }

    async function listDevices(){
      if(!mobile?.available?.())return;
      try{
        try{
          const permission=await mobile.requestPermission('bluetooth');
          if(permission?.granted===false){
            permissionOk=false;
            updateTransportGuide();
            setResult('Подтвердите системное разрешение Bluetooth, затем снова нажмите «Выбрать ELM327».');
            return;
          }
          if(permission?.granted===true){permissionOk=true;updateTransportGuide();}
        }catch(_){}
        const payload=await mobile.elmDevices();
        const devices=Array.isArray(payload.devices)?payload.devices:[];
        deviceList.hidden=false;
        if(!devices.length){
          deviceList.innerHTML='<p class="k-obd-muted">Нет сопряжённых устройств. Откройте Bluetooth и выполните сопряжение ELM327.</p>';
          return;
        }
        devices.sort((a,b)=>Number(!!b.likelyElm)-Number(!!a.likelyElm));
        deviceList.innerHTML=devices.map(d=>`<button type="button" class="k-obd-device-row" data-obd-address="${esc(d.address||'')}" data-obd-name="${esc(d.name||'Bluetooth')}"><span><b>${esc(d.name||'Bluetooth')}</b><small>${esc(d.address||'')}</small></span><em>${d.likelyElm?'ELM/OBD':'Bluetooth'}</em></button>`).join('');
      }catch(error){setResult(error.message||String(error));}
    }

    async function connect(address,name){
      setResult('Подключение к '+name+'…');
      try{
        await mobile.elmConnect(address);
        currentAdapter={address,name};
        deviceText.textContent=`${name} · ${address}`;
        setConnected(true);
        deviceList.hidden=true;
        setResult('Соединение установлено. Выполняется инициализация ELM327…');
        const init=await mobile.elmInit();
        setDiagnosticReady(!!init?.vehicleConnected);
        btChip.textContent=init?.vehicleConnected?'Готово':'Адаптер';
        setResult({connected:true,ready:!!init?.vehicleConnected,adapter:currentAdapter,initialization:init});
      }catch(error){
        setConnected(false);
        setResult('Ошибка подключения: '+(error.message||String(error)));
      }
    }

    function parseVin(raw){
      const hex=String(raw||'').replace(/[^0-9A-F]/gi,'');
      const idx=hex.indexOf('4902');
      if(idx<0)return '';
      let data=hex.slice(idx+4).replace(/^01/,'');
      let out='';
      for(let i=0;i+1<data.length;i+=2){
        const n=parseInt(data.slice(i,i+2),16);
        if(n>=32&&n<=126)out+=String.fromCharCode(n);
      }
      return out.replace(/[^A-HJ-NPR-Z0-9]/gi,'').slice(0,17);
    }

    const queuedVehicleId=item=>String(
      item?.payload?.vehicleId ?? item?.payload?.carId ?? item?.payload?.autoId ?? item?.payload?.elmVehicleId ?? ''
    ).trim();

    async function saveOffline(snapshot,capturedAt=Date.now()){
      if(!mobile?.available?.())return {skipped:true,code:'NATIVE_UNAVAILABLE'};
      const vehicleId=String(selectedVehicle?.id||'').trim();
      if(!vehicleId){
        return {skipped:true,code:'VEHICLE_ID_REQUIRED'};
      }
      const payload={
        kind:'obd_session',
        capturedAt,
        adapter:currentAdapter||{},
        vehicleId,
        vin:snapshot?.vin||parseVin(snapshot?.vinRaw),
        dtc:{raw:snapshot?.dtcRaw||'',codes:Array.isArray(snapshot?.dtcCodes)?snapshot.dtcCodes:[]},
        snapshot
      };
      const item=await mobile.offlineEnqueue(payload);
      await updateOffline();
      return item;
    }

    async function syncOffline(){
      if(!navigator.onLine || !mobile?.available?.())return false;
      try{
        const state=await mobile.offlineState();
        if(!Number(state.count||0))return true;
        const drained=await mobile.offlineDrain();
        const items=Array.isArray(drained.items)?drained.items:[];
        if(!items.length)return true;
        const eligible=items.filter(item=>queuedVehicleId(item)!=='');
        const blocked=items.length-eligible.length;
        if(!eligible.length){
          if(blocked) setResult(blocked+' локальных диагностических сессий не синхронизированы: отсутствует vehicleId. Привяжите автомобиль и повторите диагностику.');
          return false;
        }
        const response=await fetch('/api/obd.php?action=sync',{
          method:'POST',credentials:'same-origin',
          headers:{'Content-Type':'application/json','Accept':'application/json'},
          body:JSON.stringify({items:eligible})
        });
        const payload=await response.json();
        if(!response.ok||!payload.ok)throw new Error(payload.code||'SYNC_FAILED');
        await mobile.offlineAcknowledge(eligible);
        await updateOffline();
        await loadHistory();
        if(blocked){
          setResult('Синхронизировано '+eligible.length+' сессий. '+blocked+' старых локальных записей без vehicleId оставлены на устройстве.');
        }
        return blocked===0;
      }catch(error){
        await updateOffline();
        setResult('Сессия сохранена офлайн. Синхронизация будет повторена: '+(error.message||String(error)));
        return false;
      }
    }

    async function runSnapshot(){
      if(!ready)return;
      snapshotBtn.disabled=true;
      setResult('Читаем основные параметры автомобиля…');
      try{
        const snapshot=await mobile.elmSnapshot();
        const capturedAt=Date.now();
        const saved=await saveOffline(snapshot,capturedAt);
        renderLive(snapshot);
        renderDtc(snapshot?.dtcCodes||[]);
        if(saved?.skipped){
          pendingSnapshot=snapshot;
          pendingCapturedAt=capturedAt;
          setResult({snapshot,warning:'Диагностика выполнена без привязки к гаражу. Для сохранения выберите автомобиль и подтвердите действие.'});
        }else{
          pendingSnapshot=null;
          pendingCapturedAt=0;
          setResult(snapshot);
          if(navigator.onLine)await syncOffline();
        }
        refreshPendingSave();
      }catch(error){setResult(error.message||String(error));}
      finally{snapshotBtn.disabled=!ready;}
    }

    async function clearDtcWithConsent(){
      if(!ready||!mobile?.available?.()||clearBusy||disposed)return;
      clearBusy=true;
      clearBtn.disabled=true;
      try{
      const confirmAction=typeof window.confirm==='function'
        ? message=>window.confirm(message)
        : ()=>false; // Fail closed if this WebView cannot request user consent.
      if(!confirmAction('Сброс DTC может удалить сохранённые ошибки и стоп-кадры, а также обнулить мониторы готовности. Сначала нужно сохранить результаты. Продолжить?'))return;
      stopLive();
      let evidencePreserved=false;
      let evidenceProblem='';
      try{
        const snapshot=await mobile.elmSnapshot();
        if(!snapshot||typeof snapshot!=='object')throw new Error('EMPTY_SNAPSHOT');
        const capturedAt=Date.now();
        const saved=await saveOffline(snapshot,capturedAt);
        if(saved?.skipped){
          pendingSnapshot=snapshot;
          pendingCapturedAt=capturedAt;
          refreshPendingSave();
          evidenceProblem='Снимок показаний доступен только в текущем сеансе, не сохранён в гараж.';
        }else{
          evidencePreserved=true; // Queued locally; server synchronization is a separate operation.
        }
      }catch(error){
        evidenceProblem='Не удалось получить и сохранить снимок до сброса: '+String(error?.message||error);
      }
      if(!evidencePreserved&&!confirmAction(evidenceProblem+'\nПосле сброса часть диагностической информации может стать недоступной. Выполнить сброс без сохранённой истории?'))return;
      if(disposed||!ready)return;
      try{
        const response=await mobile.elmCommand('04',5000);
        setResult({command:'04',adapterResponse:response,warning:'Команда сброса отправлена. Повторно прочитайте DTC и готовность систем для подтверждения результата.'});
      }catch(error){
        setResult('Сброс не подтверждён: '+String(error?.message||error));
      }
      }finally{
        clearBusy=false;
        clearBtn.disabled=!ready||disposed;
      }
    }

    async function runCommand(command){
      if(!ready||!command)return;
      const normalized=String(command).trim().replace(/\s+/g,'').toUpperCase();
      // Never let the raw command field silently bypass confirmation for service 04.
      if(normalized==='04'){await clearDtcWithConsent();return;}
      if(/^04[0-9A-F]+$/.test(normalized)){
        setResult('Для сброса DTC используйте только отдельную кнопку с подтверждением.');
        return;
      }
      // UDS/OBD actuator, write, reset and security-access services do not belong in this basic UI.
      if(/^(?:08|10|11|14|27|28|2E|2F|31|34|35|36|37|3D|85)[0-9A-F]*$/.test(normalized)){
        setResult('Команда управления или изменения ЭБУ не разрешена в обычной диагностике.');
        return;
      }
      setResult('Команда '+command+'…');
      try{setResult(await mobile.elmCommand(command,3500));}
      catch(error){setResult(error.message||String(error));}
    }

    async function loadHistory(){
      try{
        const vehicleQuery=selectedVehicle?.id?'&vehicleId='+encodeURIComponent(selectedVehicle.id):'';
        const response=await fetch('/api/obd.php?action=history&limit=30'+vehicleQuery,{credentials:'same-origin',headers:{Accept:'application/json'}});
        const payload=await response.json();
        const rows=Array.isArray(payload.sessions)?payload.sessions:[];
        q('[data-obd-history]').innerHTML=rows.length?rows.map(row=>`<article class="k-obd-history-row"><div><b>${esc(row.vin||'Диагностическая сессия')}</b><small>${esc(row.adapterName||'ELM327')} · ${esc(row.capturedAt||'')}</small></div><button type="button" class="k-btn" data-obd-history-id="${esc(row.id||'')}">Данные</button><script type="application/json" data-obd-history-json="${esc(row.id||'')}">${JSON.stringify(row).replace(/</g,'\\u003c')}</script></article>`).join(''):'<p class="k-obd-muted">Синхронизированных сессий пока нет.</p>';
      }catch(_){
        q('[data-obd-history]').innerHTML='<p class="k-obd-muted">История недоступна без сети.</p>';
      }
    }

    const click=async event=>{
      const vehicleToggle=event.target.closest('[data-obd-vehicle-toggle]');
      if(vehicleToggle){vehicleList.hidden=!vehicleList.hidden;return;}
      if(event.target.closest('[data-obd-vehicle-unbind]')){
        selectedVehicle=null;
        launchVehicleMissing=false;
        vehicleList.hidden=true;
        renderVehicleChoice();
        await loadHistory();
        return;
      }
      if(event.target.closest('[data-obd-save-current]')){
        if(!selectedVehicle||!pendingSnapshot)return;
        const scannedVin=String(pendingSnapshot?.vin||parseVin(pendingSnapshot?.vinRaw)||'').trim().toUpperCase();
        const garageVin=String(selectedVehicle?.vin||'').trim().toUpperCase();
        if(scannedVin&&garageVin&&scannedVin!==garageVin&&!window.confirm('VIN считанного автомобиля отличается от VIN в гараже. Подтвердить сохранение для выбранного автомобиля?'))return;
        const button=pendingSave.querySelector('[data-obd-save-current]');
        if(button)button.disabled=true;
        try{
          const saved=await saveOffline(pendingSnapshot,pendingCapturedAt);
          if(saved?.skipped)throw new Error(saved.code||'SAVE_NOT_AVAILABLE');
          pendingSnapshot=null;
          pendingCapturedAt=0;
          refreshPendingSave();
          setResult('Диагностическая сессия добавлена в офлайн-очередь выбранного автомобиля.');
          if(navigator.onLine)await syncOffline();
        }catch(error){
          setResult('Не удалось сохранить диагностику: '+(error.message||String(error)));
          refreshPendingSave();
        }
        return;
      }
      const vehicleOption=event.target.closest('[data-obd-vehicle-id]');
      if(vehicleOption){
        selectedVehicle=vehicles.find(v=>String(v.id)===String(vehicleOption.dataset.obdVehicleId||''))||selectedVehicle;
        launchVehicleMissing=false;
        vehicleList.hidden=true;
        renderVehicleChoice();
        await loadHistory();
        return;
      }
      if(event.target.closest('[data-obd-live-start]')){startLive();return;}
      if(event.target.closest('[data-obd-live-stop]')){stopLive();return;}
      if(event.target.closest('[data-obd-reconnect]')){
        if(!mobile?.available?.())return;
        stopLive();
        setResult('Переподключение к последнему ELM327…');
        try{
          const status=await mobile.elmReconnectLast();
          currentAdapter={name:status?.name||'ELM327',address:status?.address||''};
          setConnected(true);
          deviceText.textContent=[currentAdapter.name,currentAdapter.address].filter(Boolean).join(' · ');
          const init=await mobile.elmInit();
          setDiagnosticReady(!!init?.vehicleConnected);
          btChip.textContent=init?.vehicleConnected?'Готово':'Адаптер';
          setResult({connected:true,ready:!!init?.vehicleConnected,reconnected:true,adapter:currentAdapter,initialization:init});
        }catch(error){setConnected(false);setResult('Не удалось переподключиться: '+(error.message||String(error)));}
        return;
      }
      const dtcHelp=event.target.closest('[data-obd-dtc-help]');
      if(dtcHelp){
        try{sessionStorage.setItem('kareta_assistant_problem','Код OBD-II '+String(dtcHelp.dataset.obdDtcHelp||'')+'. Объясни возможные причины и порядок диагностики.');}catch(_){}
        location.hash='#/assistant';
        return;
      }
      const question=event.target.closest('[data-obd-dtc-question]');
      if(question){
        const code=String(question.dataset.obdDtcQuestion||'').trim().toUpperCase();
        if(!/^[PCBU][0-9A-F]{4}$/.test(code))return;
        const car=selectedVehicle?[selectedVehicle.brand,selectedVehicle.model,selectedVehicle.year_label||selectedVehicle.year].filter(Boolean).map(v=>String(v).trim()).join(' '):'';
        const draft=['Считан код OBD-II '+code+'.',car?'Автомобиль: '+car+'.':'','Подскажите, какие проверки выполнить перед заменой деталей?'].filter(Boolean).join('\n');
        try{sessionStorage.setItem('kareta.obd.communityDraft',draft);}catch(_){}
        location.hash='#/community/question/create?mode=help';
        return;
      }
      const device=event.target.closest('[data-obd-address]');
      if(device){await connect(device.dataset.obdAddress||'',device.dataset.obdName||'ELM327');return;}
      if(event.target.closest('[data-obd-devices]')){await listDevices();return;}
      if(event.target.closest('[data-obd-settings]')){try{await mobile?.openBluetoothSettings?.();}catch(_){}return;}
      if(event.target.closest('[data-obd-init]')){
        try{
          const init=await mobile.elmInit();
          setDiagnosticReady(!!init?.vehicleConnected);
          btChip.textContent=init?.vehicleConnected?'Готово':'Адаптер';
          setResult(init);
        }catch(e){setDiagnosticReady(false);setResult(e.message||String(e));}
        return;
      }
      if(event.target.closest('[data-obd-disconnect]')){try{await mobile.elmDisconnect();}catch(_){}setConnected(false);deviceText.textContent='Адаптер отключён.';return;}
      if(event.target.closest('[data-obd-snapshot]')){await runSnapshot();return;}
      if(event.target.closest('[data-obd-clear]')){await clearDtcWithConsent();return;}
      const command=event.target.closest('[data-obd-command]');
      if(command){await runCommand(command.dataset.obdCommand||'');return;}
      if(event.target.closest('[data-obd-send]')){await runCommand((custom.value||'').trim());return;}
      if(event.target.closest('[data-obd-sync]')){await syncOffline();return;}
      if(event.target.closest('[data-obd-history-refresh]')){await loadHistory();return;}
      const history=event.target.closest('[data-obd-history-id]');
      if(history){
        const node=root.querySelector(`[data-obd-history-json="${CSS.escape(history.dataset.obdHistoryId||'')}"]`);
        try{setResult(JSON.parse(node?.textContent||'{}'));}catch(_){}
      }
    };

    root.addEventListener('click',click);
    const transportObserver=typeof MutationObserver==='function'?new MutationObserver(()=>{
      updateTransportGuide();
      renderVehicleChoice();
      if(lastDtcCodes.length)renderDtc(lastDtcCodes);
    }):null;
    transportObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    updateTransportGuide();
    const online=()=>{updateNetwork();syncOffline();};
    const offline=()=>updateNetwork();
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);

    loadVehicles().then(loadHistory);
    refreshStatus();
    if(navigator.onLine)syncOffline();

    const cleanup=()=>{
      disposed=true;
      stopLive();
      transportObserver?.disconnect();
      root.removeEventListener('click',click);
      window.removeEventListener('online',online);
      window.removeEventListener('offline',offline);
    };
    context.lifecycle?.addCleanup?.(cleanup);
    return cleanup;
  }

  window.KaretaDiagnosticsPages=Object.freeze({renderDiagnostics,mountDiagnostics});
})();
