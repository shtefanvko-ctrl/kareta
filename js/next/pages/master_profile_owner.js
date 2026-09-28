(() => {
  'use strict';

  const ui=window.KaretaPageUI;
  if(!ui) throw new Error('KaretaPageUI is required before pages/master_profile_owner.js');
  const esc=ui.escHtml;
  const icon=name=>window.KaretaUIIcons?.svg?.(name,{className:'k-master-dialog-icon'})||'';
  const money=n=>`${new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(n||0)))} ₸`;
  const list=value=>Array.isArray(value)?value.filter(Boolean):[];
  const lines=value=>list(value).join('\n');
  const certLines=value=>list(value).map(item=>[item?.title,item?.issuer,item?.year].filter(Boolean).join(' | ')).join('\n');
  const initials=name=>String(name||'М').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'М';
  const workModeLabel=value=>({shop:'В мастерской',mobile:'Выезд',both:'Мастерская + выезд'}[String(value||'').toLowerCase()]||'В мастерской');
  const locationLabel=value=>({hidden:'Не показывать',city:'Только город',district:'Город и район',exact:'Точный адрес'}[String(value||'').toLowerCase()]||'Только город');
  let current=null;

  function renderMasterProfileOwner(){
    return `<section class="k-page k-master-page k-master-surface-page k-master-owner-profile-page"><div id="k-master-owner-profile" class="k-master-owner-profile" data-state="loading"><section class="k-empty"><h2>Загружаем профиль Мастера</h2><p>Получаем данные публичной карточки, опыт и показатели.</p></section></div></section>`;
  }

  function stat(label,value,extra=''){
    return `<article class="k-master-owner-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong>${extra?`<span>${esc(extra)}</span>`:''}</article>`;
  }
  function sectionCard(key,title,summary,body,action='Редактировать'){
    return `<article class="k-master-owner-section-card" data-owner-section="${esc(key)}"><div class="k-master-owner-section-head"><div><small>${esc(summary)}</small><h2>${esc(title)}</h2></div><button class="k-btn k-btn-secondary" type="button" data-owner-open="${esc(key)}">${esc(action)}</button></div>${body}</article>`;
  }
  function tags(values,empty='Пока не заполнено'){
    const rows=list(values);return rows.length?`<div class="k-master-owner-tags">${rows.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:`<p class="k-master-owner-empty">${esc(empty)}</p>`;
  }
  function dialog(name,title,body){
    return `<dialog class="k-master-owner-dialog" data-owner-dialog="${esc(name)}"><form class="k-master-owner-dialog-panel" data-owner-form="${esc(name)}"><header><div><small>МОЙ ПРОФИЛЬ</small><h2>${esc(title)}</h2></div><button type="button" data-owner-close aria-label="Закрыть">${icon('close')}</button></header>${body}<footer><button class="k-btn k-btn-secondary" type="button" data-owner-close>Отмена</button><button class="k-btn k-btn-primary" type="submit">Сохранить</button></footer></form></dialog>`;
  }
  function radioCards(name,options,currentValue){
    return `<div class="k-master-owner-choice-grid">${options.map(([value,label,text])=>`<label class="k-master-owner-choice"><input type="radio" name="${esc(name)}" value="${esc(value)}" ${String(currentValue)===value?'checked':''}><span><b>${esc(label)}</b>${text?`<small>${esc(text)}</small>`:''}</span></label>`).join('')}</div>`;
  }

  function view(data){
    current=data;const p=data.profile||{},counts=data.counts||{},ready=data.readiness||{};
    const publicUrl=data.publicUrl||`#/masters/profile/master/${encodeURIComponent(p.id||'')}`;
    const avatar=p.avatarUrl?`<img src="${esc(p.avatarUrl)}" alt="${esc(p.name||'Мастер')}">`:`<span>${esc(initials(p.name))}</span>`;
    const services=list(p.primaryServices),brands=list(p.brands),equipment=list(p.equipment),skills=list(p.skills),certs=list(p.certificates);
    const root=document.querySelector('#k-master-owner-profile');if(!root)return;
    root.dataset.state='ready';
    root.innerHTML=`
      <header class="k-master-owner-hero k-master-page-header">
        <button class="k-master-owner-avatar" type="button" data-owner-open="avatar" aria-label="Изменить фотографию">${avatar}<i>Изменить</i></button>
        <div class="k-master-owner-identity"><small>ПУБЛИЧНАЯ КАРТОЧКА МАСТЕРА</small><h1>${esc(p.name||'Мастер')}</h1><p>${esc(p.spec||'Специализация не указана')}</p><div class="k-master-owner-visibility ${p.profileVisible?'is-public':'is-hidden'}"><span></span>${p.profileVisible?'Профиль виден клиентам':'Профиль скрыт от клиентов'}</div></div>
        <div class="k-master-owner-hero-actions">${p.profileVisible?`<a class="k-btn k-btn-primary" href="${esc(publicUrl)}">Посмотреть как клиент</a>`:`<button class="k-btn k-btn-secondary" type="button" data-owner-open="publicity">Профиль скрыт</button>`}<a class="k-btn k-btn-secondary" href="#/services/manage">Мои услуги</a></div>
      </header>

      <section class="k-master-owner-readiness"><div><small>ГОТОВНОСТЬ ПРОФИЛЯ</small><strong>${Number(ready.percent||0)}%</strong><p>${Number(ready.completed||0)} из ${Number(ready.total||0)} ключевых блоков заполнено</p></div><div class="k-master-owner-progress" aria-label="Готовность ${Number(ready.percent||0)}%"><span style="width:${Math.max(0,Math.min(100,Number(ready.percent||0)))}%"></span></div></section>

      <section class="k-master-owner-stats">${stat('Активные услуги',String(counts.services||0),'управляются в прайсе')}${stat('Опубликованные работы',String(counts.works||0),'формируют портфолио')}${stat('Отзывы',String(counts.reviews||0),'репутация по заказам')}${stat('Опыт',p.experienceLabel||'Не указан')}</section>

      <section class="k-master-owner-sections">
        ${sectionCard('basic','Основные данные','КАК ВИДИТ КЛИЕНТ',`<p class="k-master-owner-lead">${esc(p.description||'Добавьте описание подхода к работе и сильных сторон.')}</p><div class="k-master-owner-facts"><span><small>Город</small><b>${esc(p.city||'Не указан')}</b></span><span><small>Район</small><b>${esc(p.district||'Не указан')}</b></span><span><small>Формат</small><b>${esc(workModeLabel(p.workMode))}</b></span><span><small>Адрес</small><b>${esc(p.serviceAddress||'Не указан')}</b></span></div>`)}
        ${sectionCard('specialties','Специализации','НАПРАВЛЕНИЯ РАБОТЫ',tags(services,'Добавьте направления, по которым принимаете заявки.'))}
        ${sectionCard('experience','Опыт и обучение','ПРОФЕССИОНАЛЬНЫЙ ОПЫТ',`<div class="k-master-owner-facts"><span><small>Стаж</small><b>${esc(p.experienceLabel||'Не указан')}</b></span><span><small>Языки</small><b>${esc(list(p.languages).join(', ')||'Не указаны')}</b></span></div>${p.education?`<p>${esc(p.education)}</p>`:''}`)}
        ${sectionCard('expertise','Марки, навыки и оборудование','ЭКСПЕРТНОСТЬ',`<h3>Марки</h3>${tags(brands)}<h3>Навыки</h3>${tags(skills)}<h3>Оборудование</h3>${tags(equipment)}<div class="k-master-owner-cert-count"><b>${certs.length}</b><span>сертификатов указано</span></div>`)}
        ${sectionCard('publicity','Публичность','КТО ВИДИТ ПРОФИЛЬ',`<div class="k-master-owner-public-state ${p.profileVisible?'is-on':'is-off'}"><b>${p.profileVisible?'Профиль опубликован':'Профиль скрыт'}</b><span>${p.profileVisible?'Клиенты видят карточку, услуги, работы и отзывы.':'Карточка недоступна в публичном каталоге.'}</span></div>`,'Настроить')}
      </section>

      <section class="k-master-owner-linked"><div><small>СВЯЗАННЫЕ РАЗДЕЛЫ</small><h2>Контент публичного профиля</h2><p>Эти данные редактируются в своих рабочих разделах и автоматически отображаются клиентам.</p></div><div class="k-master-owner-linked-grid"><a href="#/services/manage"><b>Мои услуги</b><span>${Number(counts.services||0)} активных</span></a><a href="#/master/wall"><b>Публикации</b><span>Стена Мастера</span></a><a href="#/master/works"><b>Мои работы</b><span>${Number(counts.works||0)} опубликовано</span></a><a href="#/master/reviews"><b>Отзывы</b><span>${Number(counts.reviews||0)} отзывов</span></a></div></section>

      ${dialog('avatar','Фотография профиля',`<div class="k-master-owner-avatar-editor"><div class="k-master-owner-avatar-preview" data-avatar-preview>${avatar}</div><label class="k-btn k-btn-secondary">Выбрать фото<input type="file" name="avatarFile" accept="image/jpeg,image/png,image/webp" hidden></label><input type="hidden" name="avatarUrl" value=""><p>JPEG, PNG или WebP. Изображение сохраняется в профиле аккаунта.</p></div>`)}
      ${dialog('basic','Основные данные',`<label>Имя<input name="name" maxlength="191" value="${esc(p.name||'')}" required></label><label>Основная специализация<input name="spec" maxlength="191" value="${esc(p.spec||'')}" placeholder="Например: автоэлектрик-диагност"></label><label>Короткое предложение<input name="offerText" maxlength="1000" value="${esc(p.offerText||'')}" placeholder="Что клиент получит от обращения к вам"></label><label>О себе<textarea name="description" maxlength="2500" rows="5" placeholder="Опыт, подход, сильные стороны">${esc(p.description||'')}</textarea></label><div class="k-master-owner-form-grid"><label>Город<input name="city" maxlength="120" value="${esc(p.city||'')}"></label><label>Район<input name="district" maxlength="120" value="${esc(p.district||'')}"></label></div><fieldset><legend>Формат работы</legend>${radioCards('workMode',[['shop','В мастерской','Клиент приезжает к вам'],['mobile','Выезд','Работа на территории клиента'],['both','Оба варианта','Мастерская и выезд']],p.workMode||'shop')}</fieldset><label>Адрес мастерской<input name="serviceAddress" maxlength="255" value="${esc(p.serviceAddress||'')}"></label><label>Радиус выезда, км<input type="number" name="serviceRadiusKm" min="0" max="500" value="${Number(p.serviceRadiusKm||0)}"></label><fieldset><legend>Показывать местоположение</legend>${radioCards('locationVisibility',[['hidden','Скрыто','Без географии'],['city','Город','Без точного района'],['district','Город + район','Без точного адреса'],['exact','Точный адрес','Показывать мастерскую']],p.locationVisibility||'city')}</fieldset>`)}
      ${dialog('specialties','Специализации',`<label>Направления работы<textarea name="primaryServices" rows="8" placeholder="Каждое направление с новой строки">${esc(lines(services))}</textarea></label><p class="k-master-owner-hint">Например: автоэлектрика, диагностика двигателя, сигнализации, кодирование. Эти данные участвуют в публичной карточке и подборе заявок.</p>`)}
      ${dialog('experience','Опыт и обучение',`<label>Стаж / уровень опыта<input name="experienceLabel" maxlength="120" value="${esc(p.experienceLabel||'')}" placeholder="Например: 8 лет"></label><label>Образование<textarea name="education" rows="4" maxlength="1500">${esc(p.education||'')}</textarea></label><label>Курсы и обучение<textarea name="courses" rows="4" maxlength="2000">${esc(p.courses||'')}</textarea></label><label>Достижения<textarea name="awards" rows="3" maxlength="1500">${esc(p.awards||'')}</textarea></label><label>Языки<textarea name="languages" rows="3" placeholder="Русский&#10;Қазақша">${esc(lines(p.languages))}</textarea></label>`)}
      ${dialog('expertise','Марки, навыки и оборудование',`<label>Марки автомобилей<textarea name="brands" rows="5" placeholder="Toyota&#10;Lexus&#10;BMW">${esc(lines(brands))}</textarea></label><label>Навыки<textarea name="skills" rows="5" placeholder="CAN-диагностика&#10;Осциллограф&#10;Кодирование блоков">${esc(lines(skills))}</textarea></label><label>Оборудование<textarea name="equipment" rows="5" placeholder="Launch X431&#10;Autel&#10;J2534">${esc(lines(equipment))}</textarea></label><label>Сертификаты<textarea name="certificates" rows="6" placeholder="Название | Организация | 2026">${esc(certLines(certs))}</textarea></label><p class="k-master-owner-hint">Один сертификат на строку. Формат: название | организация | год.</p>`)}
      ${dialog('publicity','Публичность профиля',`<fieldset><legend>Статус карточки</legend>${radioCards('profileVisible',[['1','Опубликован','Клиенты видят профиль в каталоге'],['0','Скрыт','Карточка недоступна клиентам']],p.profileVisible?'1':'0')}</fieldset><div class="k-master-owner-warning"><b>Что остаётся рабочим при скрытии</b><p>Рабочее место, заказы, календарь и внутренние данные Мастера не отключаются. Скрывается только публичная карточка.</p></div>`)}
    `;
    wire();
  }

  function toList(value){return String(value||'').split(/[\r\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function toCertificates(value){return String(value||'').split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean).map(line=>{const [title='',issuer='',year='']=line.split('|').map(x=>x.trim());return {title,issuer,year};}).filter(x=>x.title);}
  function formData(form,section){
    const fd=new FormData(form);const get=name=>String(fd.get(name)||'').trim();
    if(section==='avatar')return {avatarUrl:get('avatarUrl')};
    if(section==='basic')return {name:get('name'),spec:get('spec'),offerText:get('offerText'),description:get('description'),city:get('city'),district:get('district'),workMode:get('workMode'),serviceAddress:get('serviceAddress'),serviceRadiusKm:Number(get('serviceRadiusKm')||0),locationVisibility:get('locationVisibility')};
    if(section==='specialties')return {primaryServices:toList(get('primaryServices'))};
    if(section==='experience')return {experienceLabel:get('experienceLabel'),education:get('education'),courses:get('courses'),awards:get('awards'),languages:toList(get('languages'))};
    if(section==='expertise')return {brands:toList(get('brands')),skills:toList(get('skills')),equipment:toList(get('equipment')),certificates:toCertificates(get('certificates'))};
    if(section==='publicity')return {profileVisible:get('profileVisible')==='1'};
    return {};
  }
  async function reload(){
    const api=window.KaretaApiClient;const response=await api.request('api/db.php?action=masterProfile.get',{cacheTtlMs:0,force:true});
    if(!response?.ok)throw new Error(response?.payload?.message||response?.message||'Не удалось загрузить профиль');
    view(response.payload?.data||response.payload||response.data||{});
  }
  async function save(form,section){
    const submit=form.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Сохраняем…';}
    try{
      const response=await window.KaretaApiClient.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'masterProfile.save',section,data:formData(form,section)}),cacheTtlMs:0,dedupe:false});
      if(!response?.ok)throw new Error(response?.payload?.message||response?.message||'Не удалось сохранить профиль');
      form.closest('dialog')?.close();window.KaretaToast?.success?.('Профиль обновлён');await reload();
    }catch(error){window.KaretaToast?.error?.(error?.message||'Не удалось сохранить профиль');}
    finally{if(submit){submit.disabled=false;submit.textContent='Сохранить';}}
  }
  function wire(){
    const root=document.querySelector('#k-master-owner-profile');if(!root)return;
    root.querySelectorAll('[data-owner-open]').forEach(btn=>btn.addEventListener('click',()=>root.querySelector(`[data-owner-dialog="${CSS.escape(btn.dataset.ownerOpen||'')}"]`)?.showModal()));
    root.querySelectorAll('[data-owner-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog')?.close()));
    root.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',event=>{if(event.target===d)d.close();}));
    root.querySelectorAll('[data-owner-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();save(form,form.dataset.ownerForm||'');}));
    const file=root.querySelector('input[name="avatarFile"]');
    file?.addEventListener('change',()=>{const chosen=file.files?.[0];if(!chosen)return;if(chosen.size>1500000){window.KaretaToast?.error?.('Фото должно быть не больше 1,5 МБ');file.value='';return;}const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||'');const hidden=root.querySelector('input[name="avatarUrl"]');if(hidden)hidden.value=value;const preview=root.querySelector('[data-avatar-preview]');if(preview)preview.innerHTML=`<img src="${esc(value)}" alt="Предпросмотр">`;};reader.readAsDataURL(chosen);});
  }

  async function mountMasterProfileOwner(){
    const snapshot=window.KaretaIdentity?.snapshot?.()||{};const profileType=String(snapshot.context?.profileType||snapshot.context?.profile_type||'').toLowerCase();const legacyRole=String(window.KaretaRoleAccess?.currentRole?.()||'').toLowerCase();
    if(snapshot.mode==='identity'&&profileType!=='master'&&!['admin','owner'].includes(String(snapshot.compatibilityRole||'').toLowerCase())){
      const root=document.querySelector('#k-master-owner-profile');if(root){root.dataset.state='denied';root.innerHTML='<section class="k-empty"><h2>Выберите тип аккаунта «Мастер»</h2><p>Управление публичной карточкой доступно только в контексте Мастера.</p><a class="k-btn k-btn-primary" href="#/cabinet">Открыть аккаунт</a></section>';}return;
    }
    if(snapshot.mode!=='identity'&&!['master','admin','owner'].includes(legacyRole))return;
    try{await reload();}catch(error){const root=document.querySelector('#k-master-owner-profile');if(root){root.dataset.state='error';root.innerHTML=`<section class="k-empty"><h2>Не удалось загрузить профиль</h2><p>${esc(error?.message||'Повторите загрузку.')}</p><button class="k-btn k-btn-primary" type="button" data-owner-retry>Повторить</button></section>`;root.querySelector('[data-owner-retry]')?.addEventListener('click',reload);}}
  }

  window.KaretaMasterProfileOwnerPages=Object.freeze({renderMasterProfileOwner,mountMasterProfileOwner});
})();
