(() => {
  'use strict';
  // Separate directory: never insert pre-claimed businesses into bookable STO cards.
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role = () => String(window.KaretaRoleAccess?.currentRole?.()
    || window.KaretaNext?.state?.user?.role || '').toLowerCase();
  const safeSource = value => {
    try {
      const url = new URL(String(value || ''));
      return ['https:','http:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  };
  const labels = {pending:'На проверке',approved:'Владелец подтверждён',rejected:'Отклонена',
    withdrawn:'Отозвана',activated:'Привязана к аккаунту'};
  const errors = {
    session_required:'Для подтверждения войдите в KARETA.',
    identity_session_required:'Для подтверждения требуется свежий вход с проверкой телефона.',
    active_account_required:'Не найден активный подтверждённый аккаунт.',
    candidate_not_claimable:'Карточка больше недоступна для подтверждения.',
    claim_retry_cooldown:'Повторная заявка возможна через семь дней.',
    claim_daily_limit:'Лимит заявок: не более трёх в сутки.',
    independent_verification_required:'Укажите независимое доказательство владения.',
    existing_sto_merge_review_required:'Найдена возможная существующая карточка СТО. Требуется ручная проверка.',
    claim_schema_unavailable:'Каталог предварительных карточек ещё не подключён.'
  };
  const message = response => errors[response?.payload?.error] || response?.payload?.message
    || response?.message || 'Операция не выполнена.';
  function mount(root, context = {}) {
    const api = context.api || window.KaretaApiClient;
    const directory = root.querySelector('[data-sto-claim-directory]');
    const mine = root.querySelector('[data-sto-claim-mine]');
    const queue = root.querySelector('[data-sto-claim-admin]');
    if (!api || !directory || !mine || !queue) return;
    let refreshSerial = 0;
    const isSto = () => !!root.querySelector('[data-master-provider-kind="sto"].is-active');
    const selectedSearch = () => String(root.querySelector('[data-master-search]')?.value || '').trim();
    const post = (action, body) => api.request('api/sto_claims.php?action=' + action, {
      method:'POST',headers:{'Content-Type':'application/json','X-Kareta-Claim-Request':'1'},
      body:JSON.stringify(body),cacheTtlMs:0,dedupe:false
    });
    const note = (target, text, type) => {
      let n = target.querySelector('[data-sto-claim-note]');
      if (!n) { n=document.createElement('p'); n.dataset.stoClaimNote=''; target.appendChild(n); }
      n.textContent=text; n.setAttribute('role',type==='error'?'alert':'status');
    };
    async function renderDirectory() {
      const revision=++refreshSerial;
      if (!isSto()) { directory.hidden=true;mine.hidden=true;queue.hidden=true;return; }
      const result=await api.request('api/sto_claims.php?action=list&search='
        + encodeURIComponent(selectedSearch()),{cacheTtlMs:0,force:true,signal:context.lifecycle?.signal});
      if (revision!==refreshSerial || !isSto()) return;
      if (!result?.ok) { directory.hidden=true; return; }
      const rows=Array.isArray(result.payload?.data?.unclaimedStos)
        ? result.payload.data.unclaimedStos : [];
      directory.hidden=!rows.length;
      directory.innerHTML=rows.length
        ? '<h2>Справочник СТО</h2><p>Сведения из открытых источников. Неподтверждённые СТО отмечены отдельно; запись и сообщения недоступны, пока организация не подключена.</p>'
          + rows.map(row => {
            const source=safeSource(row.sourceUrl);
            return '<article class="k-master-reference-card k-master-reference-card--sto" data-sto-claim-card="'
              + escapeHtml(row.id) + '"><div class="k-master-reference-card__main">'
              + '<div class="k-master-reference-avatar"><span>СТО</span></div>'
              + '<div class="k-master-reference-copy"><div class="k-master-reference-sto-head"><h2>'
              + escapeHtml(row.name) + '</h2><strong class="k-master-reference-sto-status is-busy">'
              + (row.accountStatus==='activated'?'Владелец подтверждён · запись не подключена':'Аккаунт не активирован')+'</strong></div>'
              + '<div class="k-master-reference-location"><span>'
              + escapeHtml([row.city,row.address].filter(Boolean).join(', ')) + '</span></div>'
              + '<p>' + escapeHtml(row.description || 'Услуги и часы работы уточняются владельцем') + '</p>'
              + (source ? '<a href="' + escapeHtml(source) + '" target="_blank" rel="noopener noreferrer">Источник сведений</a>' : '')
              + '</div></div><div class="k-master-reference-actions">'
              + '<span class="k-master-reference-action-icon is-disabled" aria-disabled="true">Запись недоступна</span>'
              + (row.accountStatus==='unclaimed' ? '<button type="button" class="k-master-reference-action-secondary" data-sto-claim-open="'
              + escapeHtml(row.id) + '">Это моя организация</button>': '')+'</div>'
              + '<div data-sto-claim-form hidden></div></article>';
          }).join('')
        : '';
    }
    async function renderMine() {
      if (!isSto()) return;
      const result=await api.request('api/sto_claims.php?action=mine',
        {cacheTtlMs:0,force:true,signal:context.lifecycle?.signal});
      const rows=Array.isArray(result?.payload?.data?.claims)?result.payload.data.claims:[];
      mine.hidden=!rows.length;
      mine.innerHTML=rows.length
        ? '<h2>Мои заявки на владение СТО</h2>' + rows.map(row =>
          '<article class="k-master-reference-card"><div class="k-master-reference-copy"><h3>'
          + escapeHtml(row.name) + '</h3><p>' + escapeHtml(labels[row.status] || row.status)
          + '</p>' + (row.status==='approved' && row.directory_status==='claimed_pending_setup'
            ? '<button type="button" class="k-master-reference-action-secondary" data-sto-activate="'
              + escapeHtml(row.candidate_id) + '">Активировать профиль</button>'
            : row.directory_status==='activated' ? '<p>Право на карточку подтверждено. Управление СТО, публикация услуг и запись пока отключены.</p>'
              + '<label>Описание (публичный справочник) <textarea data-sto-draft-description maxlength="1000" required></textarea></label>'
              + '<button type="button" data-sto-draft-save="'+escapeHtml(row.candidate_id)+'">Сохранить описание</button>' : '')
          + '</div></article>').join('')
        : '';
    }
    async function renderQueue() {
      if (!isSto() || !['admin','owner'].includes(role())) {queue.hidden=true;return;}
      const result=await api.request('api/sto_claims.php?action=reviewQueue',
        {cacheTtlMs:0,force:true,signal:context.lifecycle?.signal});
      const rows=Array.isArray(result?.payload?.data?.claims)?result.payload.data.claims:[];
      queue.hidden=!rows.length;
      queue.innerHTML=rows.length?'<h2>Модерация прав владельцев</h2>'
        +rows.map(row=>'<article class="k-master-reference-card" data-sto-review-card="'
          +Number(row.id)+'"><div class="k-master-reference-copy"><h3>'
          +escapeHtml(row.name)+'</h3><p>'+escapeHtml([row.city,row.address].join(' · '))
          +'</p><p>Метод заявителя: '+escapeHtml(row.evidence_method)+'</p><p>Источник: '
          +escapeHtml(row.source_url)+'</p><p>Доказательство заявителя: '
          +escapeHtml(row.evidence_reference)+'</p>'
          +'<label>Независимая проверка <select data-sto-verification-method>'
          +'<option value="registry">Государственный реестр</option>'
          +'<option value="legal_documents">Учредительные документы</option>'
          +'<option value="official_business_contact">Контакт через официальный канал</option>'
          +'<option value="in_person">Личная проверка</option>'
          +'</select></label>'
          +'<label>Ссылка или номер подтверждения <input data-sto-verification-reference maxlength="512" placeholder="Ссылка на реестр / акт проверки"></label>'
          +'<div class="k-master-reference-actions"><button type="button" data-sto-review="approve">Подтвердить владельца</button>'
          +'<button type="button" data-sto-review="reject">Отклонить</button></div></div></article>').join('')
        :'';
    }
    const refresh=async()=>{await renderDirectory();await Promise.all([renderMine(),renderQueue()]);};
    root.addEventListener('click',async event=>{
      const open=event.target.closest('[data-sto-claim-open]');
      if (open) {
        const card=open.closest('[data-sto-claim-card]'),form=card?.querySelector('[data-sto-claim-form]');
        if (!form) return;
        form.hidden=!form.hidden;
        if (!form.hidden) form.innerHTML='<p>Заявка не даёт доступ автоматически. Администратор проверит право представлять организацию.</p>'
          +'<label>Способ подтверждения <select data-sto-evidence-method>'
          +'<option value="registry">Регистрационные данные организации</option>'
          +'<option value="official_website">Официальный сайт компании</option>'
          +'<option value="authorization_letter">Доверенность / письмо организации</option>'
          +'<option value="onsite">Личная проверка</option></select></label>'
          +'<label>Публичная ссылка или номер обращения (без ИИН и личных документов) <input data-sto-evidence-reference maxlength="512" required placeholder="Например: ссылка на официальный реестр"></label>'
          +'<label><input type="checkbox" data-sto-evidence-consent> Подтверждаю, что уполномочен представлять это СТО.</label>'
          +'<button type="button" data-sto-claim-submit>Отправить заявку</button>';
        return;
      }
      const submit=event.target.closest('[data-sto-claim-submit]');
      if (submit) {
        const card=submit.closest('[data-sto-claim-card]'),form=submit.closest('[data-sto-claim-form]');
        if (!form?.querySelector('[data-sto-evidence-consent]')?.checked) { note(form,'Подтвердите свои полномочия.','error');return; }
        submit.disabled=true;
        try {
          const result=await post('submit',{
            candidateId:card?.dataset.stoClaimCard,evidenceMethod:form.querySelector('[data-sto-evidence-method]')?.value,
            evidenceReference:form.querySelector('[data-sto-evidence-reference]')?.value,applicantAttests:true
          });
          if (!result?.ok) throw new Error(message(result));
          note(form,'Заявка отправлена. До проверки вы не получите права на профиль.','ok');
          await renderMine();
        } catch (error) {note(form,error.message,'error');}
        finally {submit.disabled=false;}
        return;
      }
      const activate=event.target.closest('[data-sto-activate]');
      if (activate) {
        if (!window.confirm('Подтверждаете, что сведения о СТО верны? Профиль будет привязан к вашему аккаунту, но пока не опубликован и не сможет принимать заказы.')) return;
        activate.disabled=true;
        try {
          const result=await post('activate',{candidateId:activate.dataset.stoActivate,confirmBusinessDetails:true});
          if (!result?.ok) throw new Error(message(result));
          await renderMine(); await renderDirectory();
        } catch(error) {note(activate.closest('article'),error.message,'error');activate.disabled=false;}
        return;
      }
      const draft=event.target.closest('[data-sto-draft-save]');
      if (draft) {
        const card=draft.closest('article'),description=card?.querySelector('[data-sto-draft-description]')?.value;
        draft.disabled=true;
        try {
          const result=await post('saveDraft',{candidateId:draft.dataset.stoDraftSave,description});
          if (!result?.ok) throw new Error(message(result));
          note(card,'Описание сохранено в каталоге. Публикация услуг и запись не включены.','ok');
          await renderDirectory();
        } catch(error) {note(card,error.message,'error');}
        finally {draft.disabled=false;}
        return;
      }
      const review=event.target.closest('[data-sto-review]');
      if (review) {
        const card=review.closest('[data-sto-review-card]');
        if (!card) return;
        review.disabled=true;
        try {
          const result=await post('review',{
            claimId:Number(card.dataset.stoReviewCard),decision:review.dataset.stoReview,
            verificationMethod:card.querySelector('[data-sto-verification-method]')?.value,
            verificationReference:card.querySelector('[data-sto-verification-reference]')?.value
          });
          if (!result?.ok) throw new Error(message(result));
          await Promise.all([renderQueue(),renderDirectory()]);
        } catch(error) { note(card,error.message,'error');review.disabled=false; }
      }
    },{signal:context.lifecycle?.signal});
    root.querySelectorAll('[data-master-provider-kind]').forEach(btn=>btn.addEventListener('click',
      ()=>{if(btn.dataset.masterProviderKind==='sto') setTimeout(refresh,0);else {++refreshSerial;directory.hidden=true;mine.hidden=true;queue.hidden=true;}},
      {signal:context.lifecycle?.signal}));
    let timer=0;
    root.querySelector('[data-master-search]')?.addEventListener('input',()=>{
      clearTimeout(timer);timer=setTimeout(()=>{if(isSto())renderDirectory();},350);
    },{signal:context.lifecycle?.signal});
    if (isSto()) refresh();
  }
  window.KaretaStoClaimUi=Object.freeze({mount});
})();
