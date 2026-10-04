(() => {
  'use strict';

  const base=window.KaretaAssistantPages;
  if(!base?.renderAssistant||!base?.mountAssistant)throw new Error('KaretaAssistantPages is required before electrician assistant runtime');

  const FLOWS=Object.freeze({
    no_start:Object.freeze({
      title:'Не запускается двигатель',
      summary:'Питание → разрешение запуска → CKP/CMP → искра/впрыск → связь ECU.',
      steps:Object.freeze([
        Object.freeze({title:'Питание',check:'Зафиксируйте напряжение АКБ и просадку во время прокрутки.',expected:'Питание стабильно; нет аномальной просадки.',bad:'Сначала локализуйте АКБ, клеммы, массу и силовую цепь стартера.'}),
        Object.freeze({title:'Связь ECU',check:'Проверьте, выходит ли ECU на диагностику и есть ли связанные U-коды.',expected:'ECU отвечает; критических ошибок связи нет.',bad:'Проверьте питание ECU, массы и CAN до замены блока.'}),
        Object.freeze({title:'Синхронизация',check:'Сопоставьте RPM при прокрутке и DTC по CKP/CMP.',expected:'ECU видит обороты и синхронизацию.',bad:'Локализуйте CKP/CMP, питание датчика, проводку и задающий диск.'}),
        Object.freeze({title:'Исполнительные цепи',check:'После подтверждения питания и синхронизации проверяйте управление зажиганием/впрыском по схеме.',expected:'Команды ECU и питание исполнительных цепей присутствуют.',bad:'Отделите отсутствие питания от отсутствия управляющего сигнала.'})
      ])
    }),
    charging:Object.freeze({
      title:'Нет зарядки / нестабильное напряжение',
      summary:'АКБ → силовая линия → генератор → управление → масса → потребители.',
      steps:Object.freeze([
        Object.freeze({title:'Базовое напряжение',check:'Сравните напряжение при заглушенном и работающем двигателе.',expected:'После запуска напряжение меняется ожидаемо для системы зарядки.',bad:'Не переходите к замене генератора до проверки силовой линии и массы.'}),
        Object.freeze({title:'Падение напряжения',check:'Проверьте силовые соединения и массу под нагрузкой.',expected:'Нет значимого падения на соединениях.',bad:'Локализуйте окисление, нагрев, слабое соединение или повреждённый провод.'}),
        Object.freeze({title:'Управление',check:'Проверьте DTC и управляющую линию/шину генератора, если она предусмотрена автомобилем.',expected:'Команда и обратная связь согласованы.',bad:'Разделите неисправность генератора, управления и сетевой связи.'})
      ])
    }),
    drain:Object.freeze({
      title:'Утечка тока / разряд АКБ',
      summary:'Состояние АКБ → режим сна → ток покоя → ветка предохранителя → конкретный потребитель.',
      steps:Object.freeze([
        Object.freeze({title:'Состояние АКБ',check:'Сначала подтвердите, что АКБ заряжен и способен удерживать заряд.',expected:'АКБ исправен и заряжен.',bad:'Иначе измерение утечки будет вводить в заблуждение.'}),
        Object.freeze({title:'Сон автомобиля',check:'Дождитесь штатного перехода блоков в сон без нарушения условий автомобиля.',expected:'Ток после сна стабилизируется.',bad:'Определите блок или событие, которое не даёт сети заснуть.'}),
        Object.freeze({title:'Изоляция ветви',check:'Локализуйте потребляющую ветвь по безопасной методике и штатной схеме предохранителей.',expected:'После отключения проблемной ветви ток нормализуется.',bad:'Продолжайте вниз по ветви до конкретного потребителя/модуля.'})
      ])
    }),
    can:Object.freeze({
      title:'Нет связи с блоком / CAN',
      summary:'Питание ECU → физическая линия → терминаторы → активность шины → конкретный узел.',
      steps:Object.freeze([
        Object.freeze({title:'Питание блока',check:'Подтвердите питание и массы недоступного ECU.',expected:'Питание и массы присутствуют.',bad:'Сначала восстановите локальное питание блока.'}),
        Object.freeze({title:'Состояние сети',check:'Сопоставьте список доступных ECU и U-коды.',expected:'Остальные узлы сети видны согласованно.',bad:'Определите, локальный это отказ или падение сегмента сети.'}),
        Object.freeze({title:'Физический слой',check:'Проверяйте CAN-H/CAN-L только по документации автомобиля и подходящим измерительным оборудованием.',expected:'Физический слой соответствует документации.',bad:'Ищите обрыв, короткое, повреждение разъёма или проблемный узел, не замыкая линии для проверки.'})
      ])
    }),
    sensor5v:Object.freeze({
      title:'Проблема опорных 5 V / датчиков',
      summary:'Источник 5 V → общая ветвь → датчики → сигнальная линия → ECU.',
      steps:Object.freeze([
        Object.freeze({title:'Подтверждение',check:'Проверьте, действительно ли опорное питание отклонено на контрольной точке.',expected:'Опорное питание соответствует документации.',bad:'Если 5 V просажены, ищите общую ветвь и подключённые потребители.'}),
        Object.freeze({title:'Изоляция ветви',check:'По схеме определите датчики, сидящие на общей опорной линии.',expected:'После локализации видно, какой участок изменяет опорное напряжение.',bad:'Не подавайте внешнее напряжение в цепь ECU; локализуйте отключением штатных разъёмов по схеме.'}),
        Object.freeze({title:'Сигнал',check:'После восстановления опорной линии сравните сигнал датчика с ожидаемым диапазоном.',expected:'Сигнал меняется логично относительно физического параметра.',bad:'Проверяйте датчик, массу сигнала, провод и вход ECU.'})
      ])
    }),
    general:Object.freeze({
      title:'Электрическая диагностика',
      summary:'Симптом → схема → контрольная точка → измерение → сравнение → локализация.',
      steps:Object.freeze([
        Object.freeze({title:'Симптом',check:'Зафиксируйте точное условие появления неисправности и связанные DTC.',expected:'Симптом воспроизводим или подтверждён данными.',bad:'Соберите факты до разборки и замены деталей.'}),
        Object.freeze({title:'Цепь',check:'Определите питание, массу, вход, выход и сетевые связи проблемного узла.',expected:'Есть понятная электрическая цепочка проверки.',bad:'Не измеряйте случайные точки без схемы и цели.'}),
        Object.freeze({title:'Контрольная точка',check:'Сделайте одно измерение, которое разделяет две гипотезы.',expected:'Результат однозначно сужает область поиска.',bad:'Выберите следующую точку ближе к источнику или нагрузке.'})
      ])
    })
  });

  const SAFE_BLOCK=/\b(srs|airbag)\b|подушк|пиропатрон|преднатяж|высоковольт|high\s*voltage|hybrid|гибрид|оранжев(?:ый|ая|ые)?\s+кабел/i;

  function classify(text){
    const value=String(text||'');
    if(/не\s*завод|не\s*запуск|стартер|ckp|cmp|коленвал|распредвал/i.test(value))return 'no_start';
    if(/заряд|генератор|перезаряд|напряжен.*плавает/i.test(value))return 'charging';
    if(/утеч|разряж|садит.*акб|ток\s+покоя/i.test(value))return 'drain';
    if(/\bcan\b|u\d{4}|нет\s+связ|шина|ecu.*не\s+вид/i.test(value))return 'can';
    if(/5\s*v|5в|опорн|reference|датчик.*питан/i.test(value))return 'sensor5v';
    return 'general';
  }

  function panel(){
    return `<section class="k-electrician-mode" data-electrician-mode>
      <div class="k-electrician-hero">
        <div><span>РЕЖИМ МАСТЕРА · АВТОЭЛЕКТРИКА</span><h2>Схема → измерение → сравнение → вывод</h2><p>Помощник ведёт по контрольным точкам и сохраняет доказательства. ELM327 используется как источник фактов, а не как автоматический диагноз.</p></div>
        <a class="k-btn k-btn-primary" href="#/diagnostics">Открыть ELM327</a>
      </div>
      <div class="k-electrician-method">
        <article><b>1. Наблюдение</b><small>симптом · DTC · условия</small></article>
        <article><b>2. Изоляция</b><small>цепь · узел · ветвь</small></article>
        <article><b>3. Измерение</b><small>контрольная точка</small></article>
        <article><b>4. Сравнение</b><small>ожидаемое / фактическое</small></article>
        <article><b>5. Вывод</b><small>следующий безопасный тест</small></article>
      </div>
      <div class="k-electrician-quick" aria-label="Типовые электрические сценарии">
        <button type="button" data-electrician-prompt="Не запускается двигатель, стартер крутит">Нет запуска</button>
        <button type="button" data-electrician-prompt="Нет зарядки аккумулятора, проверить генератор и силовую цепь">Нет зарядки</button>
        <button type="button" data-electrician-prompt="Аккумулятор разряжается за ночь, нужна диагностика утечки тока">Утечка тока</button>
        <button type="button" data-electrician-prompt="Нет связи с одним из блоков ECU, есть U-коды CAN">CAN / нет связи</button>
        <button type="button" data-electrician-prompt="Просажено опорное питание 5 V датчиков">Опорные 5 V</button>
      </div>
      <div class="k-electrician-workflow" data-electrician-workflow hidden></div>
    </section>`;
  }

  function renderAssistant(){
    let html=base.renderAssistant();
    html=html
      .replace('ПОМОЩНИК ПО РЕМОНТУ','ПОМОЩНИК ЭЛЕКТРИКА')
      .replace('Опишите проблему с автомобилем','Опишите электрическую неисправность')
      .replace('Получите предварительное направление, подходящую услугу и готовую форму заявки.','Постройте проверяемую диагностическую цепочку и переходите к измерениям без замены деталей наугад.');
    return html.replace('<form class="k-assistant-form"',panel()+'<form class="k-assistant-form"');
  }

  function mountAssistant(context={}){
    const baseCleanup=base.mountAssistant(context);
    const root=document.querySelector('[data-page="assistant"]');
    const input=root?.querySelector('#k-assistant-problem');
    const workflow=root?.querySelector('[data-electrician-workflow]');
    const form=root?.querySelector('[data-assistant-form]');
    if(!root||!input||!workflow||!form)return baseCleanup;

    let flowKey='general';
    let stepIndex=0;
    let evidence=[];

    const esc=value=>window.KaretaPageUI?.escHtml?.(value)??String(value||'');
    const persist=()=>{
      try{sessionStorage.setItem('kareta.electrician.session',JSON.stringify({flowKey,stepIndex,evidence,problem:input.value.trim(),updatedAt:Date.now()}));}catch(_){}
    };
    const renderStep=()=>{
      const flow=FLOWS[flowKey]||FLOWS.general;
      const step=flow.steps[Math.min(stepIndex,flow.steps.length-1)];
      const done=stepIndex>=flow.steps.length;
      workflow.hidden=false;
      if(done){
        workflow.innerHTML=`<div class="k-electrician-flow-head"><span>ДИАГНОСТИЧЕСКАЯ ЦЕПОЧКА</span><h3>${esc(flow.title)}</h3><p>${esc(flow.summary)}</p></div>
          <div class="k-electrician-complete"><b>Цепочка первичной проверки пройдена.</b><p>Сверьте измерения со схемой конкретного автомобиля и сохраните вывод в заказ-наряде. Если факты расходятся — вернитесь к последней подтверждённой контрольной точке.</p><a class="k-btn" href="#/diagnostics">Снять данные ELM327</a></div>`;
        persist();
        return;
      }
      workflow.innerHTML=`<div class="k-electrician-flow-head"><span>ШАГ ${stepIndex+1} / ${flow.steps.length}</span><h3>${esc(flow.title)}</h3><p>${esc(flow.summary)}</p></div>
        <article class="k-electrician-step"><b>${esc(step.title)}</b><p>${esc(step.check)}</p><small>Ожидаемо: ${esc(step.expected)}</small>
          <div class="k-electrician-step-actions"><button type="button" class="k-btn k-btn-primary" data-electrician-outcome="ok">Норма</button><button type="button" class="k-btn" data-electrician-outcome="bad">Не норма</button></div>
        </article>
        <div class="k-electrician-evidence">${evidence.slice(-3).map(item=>`<div><b>${esc(item.title)}</b><span>${esc(item.result)}</span></div>`).join('')}</div>`;
      persist();
    };
    const startFlow=()=>{
      const problem=input.value.trim();
      flowKey=classify(problem);
      stepIndex=0;
      evidence=[];
      if(SAFE_BLOCK.test(problem)){
        workflow.hidden=false;
        workflow.innerHTML='<div class="k-electrician-safety"><b>Высокорисковая система</b><p>Помощник не выдаёт пошаговые действия для SRS/пиротехнических или высоковольтных гибридных цепей. Используйте заводскую процедуру, изоляцию энергии и квалифицированное оборудование.</p></div>';
        persist();
        return;
      }
      renderStep();
    };

    const submit=()=>window.setTimeout(startFlow,0);
    const click=event=>{
      const quick=event.target.closest('[data-electrician-prompt]');
      if(quick){
        input.value=quick.dataset.electricianPrompt||'';
        form.requestSubmit?.();
        if(!form.requestSubmit)startFlow();
        return;
      }
      const outcome=event.target.closest('[data-electrician-outcome]');
      if(!outcome)return;
      const flow=FLOWS[flowKey]||FLOWS.general;
      const step=flow.steps[stepIndex];
      const ok=outcome.dataset.electricianOutcome==='ok';
      evidence.push({title:step.title,result:ok?'Норма':step.bad,at:Date.now()});
      stepIndex+=1;
      renderStep();
    };

    form.addEventListener('submit',submit);
    root.addEventListener('click',click);

    try{
      const pending=JSON.parse(sessionStorage.getItem('kareta.electrician.session')||'null');
      if(pending?.problem&&pending.problem===input.value.trim()&&FLOWS[pending.flowKey]){
        flowKey=pending.flowKey;stepIndex=Number(pending.stepIndex||0);evidence=Array.isArray(pending.evidence)?pending.evidence:[];renderStep();
      }else if(/^Код OBD-II\s+/i.test(input.value.trim()))startFlow();
    }catch(_){}

    const cleanup=()=>{
      form.removeEventListener('submit',submit);
      root.removeEventListener('click',click);
      if(typeof baseCleanup==='function')baseCleanup();
    };
    context.lifecycle?.addCleanup?.(cleanup);
    return cleanup;
  }

  window.KaretaElectricianAssistant=Object.freeze({FLOWS,classify});
  window.KaretaAssistantPages=Object.freeze({...base,renderAssistant,mountAssistant});
})();