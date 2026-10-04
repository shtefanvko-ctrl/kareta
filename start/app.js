(function () {
  "use strict";

  var translations = {
    ru: {
      navAbout:"О проекте", navFeatures:"Возможности", navDownload:"Скачать", openWeb:"Веб-версия",
      eyebrow:"Автомобильная платформа нового поколения", heroTitle1:"Всё для автомобиля", heroTitle2:"в одном месте",
      heroLead:"Найдите мастера или СТО, создайте заявку, подберите запчасти, общайтесь с автомобильным сообществом и управляйте своим авто из одного приложения.",
      downloadFor:"Скачать для", soon:"Скоро", openInBrowser:"Открыть в браузере", webVersion:"Веб-версия", available:"Доступно",
      meta1:"Клиенты, мастера и СТО", meta2:"Один аккаунт — разные роли", meta3:"Работает на телефоне и ПК",
      phoneHello:"Ваш автомобиль. Ваш город. Ваш сервис.", phoneSearch:"Что нужно автомобилю?", service:"Сервис", masters:"Мастера", parts:"Запчасти", community:"Сообщество",
      nearby:"Рядом с вами", nearbyText:"СТО и мастера вашего города", geo:"Поиск рядом", fastOrder:"Быстрая заявка", reviews:"Отзывы и рейтинг",
      strip1:"Сервис", strip2:"Мастера", strip3:"СТО", strip4:"Запчасти", strip5:"Сообщество",
      aboutKicker:"О проекте", aboutTitle:"KARETA объединяет автомобильную экосистему в одной платформе",
      aboutLead:"Вместо десятков чатов, звонков и отдельных сервисов — понятный путь от проблемы с автомобилем до готового результата.",
      roleClientTitle:"Для автовладельца", roleClientText:"Заявки на ремонт, поиск мастеров и СТО, запчасти, гараж, история обслуживания и общение.",
      roleMasterTitle:"Для мастера", roleMasterText:"Биржа заказов, профиль специалиста, услуги, график, рабочие заявки и собственная аудитория.",
      roleStoTitle:"Для СТО и бизнеса", roleStoText:"Команда, рабочие посты, расписание, заказы, точки на карте, каталог услуг и управление загрузкой.",
      tryWeb:"Открыть платформу", featuresKicker:"Возможности", featuresTitle:"От поиска мастера до истории автомобиля",
      featuresLead:"Функции KARETA связаны между собой: город, автомобиль, заявка, исполнитель, запчасти и результат остаются в одном контексте.",
      f1Title:"Мастера и СТО рядом", f1Text:"Поиск по городу, специализации, статусу и расстоянию. Смотрите профиль, услуги, цены и отзывы до обращения.",
      cityLabel:"Ваш город", f2Title:"Заявка без лишних звонков", f2Text:"Опишите задачу, приложите фото, выберите город и получите отклики подходящих исполнителей.",
      f3Title:"Запчасти и магазины", f3Text:"Категории товаров, предложения продавцов и привязка к автомобильному сценарию внутри платформы.",
      f4Title:"Гараж автомобиля", f4Text:"Храните данные автомобиля, историю обращений и используйте их повторно в новых заявках.",
      f5Title:"Автосообщество", f5Text:"Вопросы, опыт владельцев, публикации мастеров и профессиональное общение в одном пространстве.",
      downloadKicker:"KARETA с вами", downloadTitle:"Откройте веб-версию сейчас. Мобильные приложения — следующим этапом.",
      downloadLead:"Лендинг уже подготовлен под прямые ссылки App Store и Android. После публикации сборок достаточно заполнить два URL в одном конфигурационном файле.",
      openPlatform:"Открыть KARETA.KZ", downloadApps:"Приложения", footerText:"Единая автомобильная платформа для Казахстана."
    },
    kk: {
      navAbout:"Жоба туралы", navFeatures:"Мүмкіндіктер", navDownload:"Жүктеу", openWeb:"Веб-нұсқа",
      eyebrow:"Жаңа буындағы автомобиль платформасы", heroTitle1:"Автокөлікке қажеттінің бәрі", heroTitle2:"бір жерде",
      heroLead:"Шеберді немесе СТО-ны табыңыз, өтінім жасаңыз, бөлшектерді таңдаңыз, автокөлік қауымдастығымен байланысыңыз және көлігіңізді бір қолданбадан басқарыңыз.",
      downloadFor:"Жүктеу", soon:"Жақында", openInBrowser:"Браузерде ашу", webVersion:"Веб-нұсқа", available:"Қолжетімді",
      meta1:"Клиенттер, шеберлер және СТО", meta2:"Бір аккаунт — бірнеше рөл", meta3:"Телефонда да, компьютерде де",
      phoneHello:"Сіздің көлігіңіз. Сіздің қалаңыз. Сіздің сервисіңіз.", phoneSearch:"Көлікке не қажет?", service:"Сервис", masters:"Шеберлер", parts:"Бөлшектер", community:"Қауымдастық",
      nearby:"Сізге жақын", nearbyText:"Қалаңыздағы СТО мен шеберлер", geo:"Жақыннан іздеу", fastOrder:"Жылдам өтінім", reviews:"Пікірлер мен рейтинг",
      strip1:"Сервис", strip2:"Шеберлер", strip3:"СТО", strip4:"Бөлшектер", strip5:"Қауымдастық",
      aboutKicker:"Жоба туралы", aboutTitle:"KARETA автомобиль экожүйесін бір платформада біріктіреді",
      aboutLead:"Ондаған чаттар, қоңыраулар мен бөлек сервистердің орнына — көлік мәселесінен дайын нәтижеге дейінгі түсінікті жол.",
      roleClientTitle:"Көлік иесіне", roleClientText:"Жөндеуге өтінімдер, шеберлер мен СТО іздеу, бөлшектер, гараж, қызмет тарихы және байланыс.",
      roleMasterTitle:"Шеберге", roleMasterText:"Тапсырыстар биржасы, маман профилі, қызметтер, кесте, жұмыс өтінімдері және өз аудиториясы.",
      roleStoTitle:"СТО және бизнеске", roleStoText:"Команда, жұмыс орындары, кесте, тапсырыстар, картадағы нүктелер, қызметтер каталогы және жүктемені басқару.",
      tryWeb:"Платформаны ашу", featuresKicker:"Мүмкіндіктер", featuresTitle:"Шебер іздеуден көлік тарихына дейін",
      featuresLead:"KARETA функциялары өзара байланысқан: қала, көлік, өтінім, орындаушы, бөлшектер және нәтиже бір контексте қалады.",
      f1Title:"Жақын шеберлер мен СТО", f1Text:"Қала, мамандану, мәртебе және қашықтық бойынша іздеу. Байланыспай тұрып профильді, қызметтерді, бағаларды және пікірлерді қараңыз.",
      cityLabel:"Сіздің қалаңыз", f2Title:"Артық қоңыраусыз өтінім", f2Text:"Міндетті сипаттаңыз, фото қосыңыз, қаланы таңдаңыз және лайықты орындаушылардан жауап алыңыз.",
      f3Title:"Бөлшектер мен дүкендер", f3Text:"Тауар санаттары, сатушылар ұсыныстары және платформаның автомобиль сценарийімен байланыс.",
      f4Title:"Көлік гаражы", f4Text:"Көлік деректерін және өтінімдер тарихын сақтап, жаңа өтінімдерде қайта пайдаланыңыз.",
      f5Title:"Автоқауымдастық", f5Text:"Сұрақтар, көлік иелерінің тәжірибесі, шеберлер жарияланымдары және кәсіби қарым-қатынас.",
      downloadKicker:"KARETA әрдайым қасыңызда", downloadTitle:"Веб-нұсқаны қазір ашыңыз. Мобильді қолданбалар — келесі кезеңде.",
      downloadLead:"Лендинг App Store және Android үшін тікелей сілтемелерге дайын. Жинақтар жарияланғаннан кейін бір конфигурация файлында екі URL енгізу жеткілікті.",
      openPlatform:"KARETA.KZ ашу", downloadApps:"Қолданбалар", footerText:"Қазақстанға арналған бірыңғай автомобиль платформасы."
    },
    en: {
      navAbout:"About", navFeatures:"Features", navDownload:"Download", openWeb:"Web version",
      eyebrow:"A next-generation automotive platform", heroTitle1:"Everything for your car", heroTitle2:"in one place",
      heroLead:"Find a mechanic or service center, create a request, shop for parts, join the automotive community and manage your car from one app.",
      downloadFor:"Download for", soon:"Coming soon", openInBrowser:"Open in browser", webVersion:"Web version", available:"Available",
      meta1:"Drivers, mechanics and service centers", meta2:"One account — multiple roles", meta3:"Works on mobile and desktop",
      phoneHello:"Your car. Your city. Your service.", phoneSearch:"What does your car need?", service:"Service", masters:"Mechanics", parts:"Parts", community:"Community",
      nearby:"Near you", nearbyText:"Service centers and mechanics in your city", geo:"Nearby search", fastOrder:"Quick request", reviews:"Reviews and ratings",
      strip1:"Service", strip2:"Mechanics", strip3:"Service centers", strip4:"Parts", strip5:"Community",
      aboutKicker:"About the project", aboutTitle:"KARETA brings the automotive ecosystem into one platform",
      aboutLead:"Instead of scattered chats, calls and separate services, KARETA gives you a clear path from a car problem to a completed result.",
      roleClientTitle:"For drivers", roleClientText:"Repair requests, mechanic and service-center search, parts, garage, service history and communication.",
      roleMasterTitle:"For mechanics", roleMasterText:"Job marketplace, professional profile, services, schedule, work requests and your own audience.",
      roleStoTitle:"For service centers and business", roleStoText:"Team, work bays, schedule, orders, map locations, service catalog and workload management.",
      tryWeb:"Open platform", featuresKicker:"Features", featuresTitle:"From finding a mechanic to your vehicle history",
      featuresLead:"KARETA keeps city, vehicle, request, provider, parts and outcome connected in one working context.",
      f1Title:"Nearby mechanics and service centers", f1Text:"Search by city, specialization, status and distance. Review profiles, services, pricing and ratings before contacting.",
      cityLabel:"Your city", f2Title:"Requests without extra calls", f2Text:"Describe the job, attach photos, choose your city and receive responses from suitable providers.",
      f3Title:"Parts and stores", f3Text:"Product categories, seller offers and integration with the automotive workflow inside the platform.",
      f4Title:"Vehicle garage", f4Text:"Keep vehicle data and request history and reuse them when creating new service requests.",
      f5Title:"Automotive community", f5Text:"Questions, owner experience, mechanic posts and professional conversations in one space.",
      downloadKicker:"KARETA goes with you", downloadTitle:"Open the web version now. Mobile apps are the next release step.",
      downloadLead:"The landing page is ready for direct App Store and Android links. Once builds are published, only two URLs need to be filled in one config file.",
      openPlatform:"Open KARETA.KZ", downloadApps:"Apps", footerText:"A unified automotive platform for Kazakhstan."
    }
  };

  var config = window.KARETA_START_CONFIG || {};
  var savedLang = "";
  try { savedLang = localStorage.getItem("kareta.start.lang") || ""; } catch (_error) {}
  var lang = translations[savedLang] ? savedLang : "ru";

  function applyLanguage(nextLang) {
    if (!translations[nextLang]) return;
    lang = nextLang;
    document.documentElement.lang = nextLang;
    var dict = translations[nextLang];
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (dict[key]) node.textContent = dict[key];
    });
    document.querySelectorAll("[data-lang]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-lang") === nextLang);
    });
    try { localStorage.setItem("kareta.start.lang", nextLang); } catch (_error) {}
  }

  function bindDownload(platform, url) {
    var links = document.querySelectorAll('[data-download="' + platform + '"]');
    links.forEach(function (link) {
      if (url) {
        link.href = url;
        link.removeAttribute("aria-disabled");
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        var status = link.querySelector('[data-status="' + platform + '"]');
        if (status) {
          status.textContent = translations[lang].available;
          status.classList.add("is-ready");
        }
      } else {
        link.href = "#download";
        link.setAttribute("aria-disabled", "true");
        link.addEventListener("click", function (event) { event.preventDefault(); });
      }
    });
  }

  document.querySelectorAll("[data-lang]").forEach(function (button) {
    button.addEventListener("click", function () {
      applyLanguage(button.getAttribute("data-lang"));
      bindDownload("android", String(config.androidUrl || ""));
      bindDownload("ios", String(config.iosUrl || ""));
    });
  });

  document.querySelectorAll("[data-web-link]").forEach(function (link) {
    link.href = String(config.webUrl || "../");
  });

  var year = document.querySelector("[data-current-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  applyLanguage(lang);
  bindDownload("android", String(config.androidUrl || ""));
  bindDownload("ios", String(config.iosUrl || ""));
})();
