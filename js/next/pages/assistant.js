(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  if (!ui) throw new Error('KaretaPageUI is required before pages/assistant.js');
  const esc = ui.escHtml;

  const RULES = Object.freeze([
    { key:'start', test:/не завод|стартер|запуск|схватыва|аккумулятор/i, title:'Диагностика запуска двигателя', serviceName:'Диагностика запуска двигателя', category:'diagnostics', text:'Нужно проверить аккумулятор и питание, сигнал датчика коленвала, искру, давление топлива и разрешение запуска.' },
    { key:'misfire', test:/троит|пропуск|дерга|вибрац|не тянет|плохая тяга/i, title:'Диагностика двигателя', serviceName:'Компьютерная диагностика двигателя', category:'diagnostics', text:'Нужна проверка пропусков, свечей, катушек, форсунок, компрессии, подсоса воздуха и топливных коррекций.' },
    { key:'suspension', test:/стук|подвес|ходов|рул|уводит|гремит/i, title:'Диагностика ходовой части', serviceName:'Диагностика ходовой части', category:'suspension_steering', text:'Рекомендуется осмотр подвески, рулевых соединений, ступиц, опор и тормозных механизмов под нагрузкой.' },
    { key:'errors', test:/ошиб|check|чек|ламп|горит.*панел/i, title:'Компьютерная диагностика', serviceName:'Компьютерная диагностика', category:'diagnostics', text:'Сначала нужно считать коды неисправностей, стоп-кадры и текущие параметры. Не стирайте ошибки до проверки.' },
    { key:'climate', test:/кондиц|не холод|печк|не греет|климат/i, title:'Диагностика климатической системы', serviceName:'Диагностика кондиционера', category:'climate', text:'Нужно проверить давление хладагента, герметичность, компрессор, вентиляторы, датчики и заслонки.' },
    { key:'electrical', test:/электр|провод|предохран|не горит|коротит|утечк/i, title:'Диагностика автоэлектрики', serviceName:'Диагностика автоэлектрики', category:'electrical', text:'Нужна проверка питания, масс, предохранителей, падения напряжения, проводки и потребления тока.' },
    { key:'brakes', test:/тормоз|скрип|педал|биение/i, title:'Диагностика тормозной системы', serviceName:'Диагностика тормозной системы', category:'suspension_steering', text:'Проверьте колодки, диски, суппорты, жидкость и работу ABS. При снижении эффективности не продолжайте движение.' }
  ]);

  const PROMPTS = Object.freeze([
    ['Не заводится','Машина не заводится, стартер крутит'],
    ['Троит','Двигатель троит и плохо тянет'],
    ['Стук в подвеске','Стук в подвеске на неровностях'],
    ['Горит Check','Горит Check Engine'],
    ['Не холодит','Кондиционер не холодит']
  ]);

  function analyze(value){
    return RULES.find(rule => rule.test.test(value)) || {
      key:'general', title:'Первичная диагностика', serviceName:'Комплексная диагностика автомобиля', category:'diagnostics',
      text:'По одному описанию нельзя надёжно определить причину. Зафиксируйте симптомы и начните с первичного осмотра без замены деталей наугад.'
    };
  }

  function saveContext(problem, advice){
    const context = { problem, serviceName:advice.serviceName, category:advice.category, adviceTitle:advice.title, createdAt:Date.now() };
    try {
      sessionStorage.setItem('kareta.assistant.context', JSON.stringify(context));
      sessionStorage.setItem('kareta.services.intent', JSON.stringify({ category:advice.category, search:advice.serviceName }));
    } catch (_) {}
    return context;
  }

  function renderAssistant(){
    return `<section class="k-page k-assistant-page" data-page="assistant">
      <a class="k-detail-back" href="#/home">На главную</a>
      <header class="k-r84-workspace-head k-assistant-head">
        <span>ПОМОЩНИК ПО РЕМОНТУ</span>
        <h1>Опишите проблему с автомобилем</h1>
        <p>Получите предварительное направление, подходящую услугу и готовую форму заявки.</p>
      </header>
      <form class="k-assistant-form" data-assistant-form>
        <label for="k-assistant-problem">Что происходит?</label>
        <textarea id="k-assistant-problem" rows="5" placeholder="Например: двигатель плохо заводится, после запуска троит и горит Check Engine"></textarea>
        <div class="k-assistant-prompts" aria-label="Быстрые симптомы">${PROMPTS.map(([label,value])=>`<button type="button" data-assistant-prompt="${esc(value)}">${esc(label)}</button>`).join('')}</div>
        <div class="k-assistant-form-actions">
          <button class="k-btn k-btn-primary" type="submit">Проанализировать</button>
          <a class="k-btn" href="#/chats" data-assistant-chat>Онлайн-консультант</a>\n          <a class="k-btn" href="#/diagnostics">ELM327 диагностика</a>
        </div>
      </form>
      <div class="k-assistant-result" data-assistant-result hidden></div>
    </section>`;
  }

  function mountAssistant(context={}){
    const form = document.querySelector('[data-assistant-form]');
    const input = document.querySelector('#k-assistant-problem');
    const result = document.querySelector('[data-assistant-result]');
    if (!form || !input || !result) return;

    let lastAdvice = null;
    const submit = event => {
      event?.preventDefault?.();
      const value = input.value.trim();
      if (!value) { input.focus(); return; }
      lastAdvice = analyze(value);
      saveContext(value,lastAdvice);
      result.hidden = false;
      result.innerHTML = `<span>ПРЕДВАРИТЕЛЬНОЕ НАПРАВЛЕНИЕ</span><h2>${esc(lastAdvice.title)}</h2><p>${esc(lastAdvice.text)}</p><div class="k-assistant-result-actions"><button class="k-btn k-btn-primary" type="button" data-assistant-request>Создать заявку</button><a class="k-btn" href="#/services" data-assistant-services>Подобрать услугу</a><a class="k-btn" href="#/chats" data-assistant-chat>Спросить консультанта</a></div>`;
      result.scrollIntoView({ behavior:'smooth', block:'nearest' });
    };
    const click = event => {
      const prompt = event.target.closest('[data-assistant-prompt]');
      if (prompt) { input.value = prompt.dataset.assistantPrompt || ''; input.focus(); return; }
      if (event.target.closest('[data-assistant-request]')) {
        const value=input.value.trim(); const advice=lastAdvice||analyze(value); saveContext(value,advice);
        try { sessionStorage.setItem('kareta.request.prefill',JSON.stringify({serviceName:advice.serviceName,description:value,source:'assistant'})); } catch (_) {}
        if(!window.KaretaRequestWindow?.open?.('#/orders/new'))location.hash='#/orders/new'; return;
      }
      if (event.target.closest('[data-assistant-chat]')) {
        const value=input.value.trim();
        if(value) try { sessionStorage.setItem('kareta.chat.prefill',`Здравствуйте. Нужна консультация: ${value}`); } catch (_) {}
      }
    };
    form.addEventListener('submit', submit);
    document.addEventListener('click',click);

    let pending = '';
    try {
      pending = sessionStorage.getItem('kareta_assistant_problem') || '';
      if (pending) sessionStorage.removeItem('kareta_assistant_problem');
    } catch (_) {}
    if (pending) { input.value = pending; submit(new Event('submit', { cancelable:true })); }

    const cleanup=()=>{form.removeEventListener('submit',submit);document.removeEventListener('click',click);};
    context.lifecycle?.addCleanup?.(cleanup);
    return cleanup;
  }

  window.KaretaAssistantPages = Object.freeze({ renderAssistant, mountAssistant, analyze });
})();
