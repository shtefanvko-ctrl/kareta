(() => {
  'use strict';
  const api = window.KaretaApiClient;
  const access = window.KaretaRoleAccess;
  if (!api || !access) throw new Error('API client and role access are required before pages/news.js');

  const uiIcon = name => window.KaretaUIIcons?.icon(name) || '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const date = value => { const d = new Date(String(value || '')); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'}); };
  const categoryLabel = key => ({platform:'Платформа',service:'Сервис',parts:'Запчасти',tips:'Советы',auto:'Авто',diagnostics:'Диагностика'})[key] || 'Новости';
  const isMaster = () => access.currentRole() === 'master';
  const routeId = () => decodeURIComponent((location.hash.match(/^#\/master\/news\/edit\/([^/?]+)/)||[])[1] || '');

  function renderNews(){
    const masterAction=isMaster()?'<a class="k-btn k-btn-secondary" href="#/master/news">Мои новости</a>':'';
    return `<section class="k-page k-news-page" data-page="news-compat"><header class="k-r84-workspace-head"><div><small>СОВМЕСТИМОСТЬ</small><h1>Новости теперь в Сообществе</h1><p>Единая лента публикаций, работ, новостей и групп находится в разделе «Сообщество».</p></div><div class="k-r84-workspace-actions"><a class="k-btn k-btn-primary" href="#/works">Открыть Сообщество</a>${masterAction}</div></header></section>`;
  }


  function masterEditorForm(){
    return `<form data-master-news-form>
      <input type="hidden" name="id">
      <label class="k-news-admin-wide">Заголовок<input name="title" maxlength="180" required placeholder="Например: Выполнил сложную диагностику"></label>
      <div class="k-r84-choice-block"><span>Категория</span><input type="hidden" name="category" value="service"><div class="k-r84-choice-grid">${[['service','Сервис'],['diagnostics','Диагностика'],['tips','Советы'],['parts','Запчасти'],['auto','Авто']].map(([v,l],i)=>`<button type="button" data-master-news-category="${v}" class="${i===0?'is-active':''}">${l}</button>`).join('')}</div></div>
      <label>Дата публикации<input name="publishedAt" type="date"></label>
      <label class="k-news-admin-wide">Краткое описание<textarea name="intro" maxlength="600" required></textarea></label>
      <label class="k-news-admin-wide">Полный текст<textarea name="body" maxlength="12000" required></textarea></label>
      <label class="k-news-admin-wide">Изображение<input name="coverUrl" maxlength="500" placeholder="https://... или assets/img/..."></label>
      <label class="k-news-check"><input type="checkbox" name="active" value="1" checked> Опубликовать сразу</label>
      <div class="k-news-admin-actions"><button class="k-btn k-btn-primary" type="submit" data-master-news-submit>Опубликовать</button><button class="k-btn" type="button" data-master-news-editor-close>Отмена</button><span data-master-news-status></span></div>
    </form>`;
  }

  function renderMasterNews(){
    return `<section class="k-page k-news-page k-master-news-page" data-page="master-news">
      <header class="k-r84-workspace-head"><div><small>ПУБЛИКАЦИИ МАСТЕРА</small><a class="k-page-back" href="#/works">← Сообщество</a><h1>Мои новости</h1><p>Ваши публикации, черновики и управление видимостью.</p></div><button class="k-btn k-btn-primary" type="button" data-master-news-create>＋ Создать новость</button></header>
      <div class="k-master-news-summary" data-master-news-summary></div>
      <div class="k-news-grid" data-master-news-grid><div class="k-news-loading">Загружаем ваши новости…</div></div>
      <dialog class="k-r84-work-dialog k-master-news-editor-dialog" data-master-news-editor-dialog>
        <div class="k-r84-work-dialog__surface">
          <header class="k-r84-work-dialog__header"><div><small>РЕДАКТОР ПУБЛИКАЦИИ</small><h2 data-master-news-editor-title>Создать новость</h2><p>Публикация сохраняется от имени текущего мастера.</p></div><button type="button" class="k-r84-work-dialog__close" data-master-news-editor-close aria-label="Закрыть">×</button></header>
          <div class="k-r84-work-dialog__body"><section class="k-news-admin">${masterEditorForm()}</section></div>
        </div>
      </dialog>
    </section>`;
  }

  // Direct editor URLs remain valid, but render the same workspace with its native work-dialog.
  const renderMasterNewsCreate = () => renderMasterNews();
  const renderMasterNewsEdit = () => renderMasterNews();

  function mountNews(){
    if(String(location.hash||'').split('?')[0]==='#/news')setTimeout(()=>{location.hash='#/works';},0);
  }

  async function getMine(){ return api.request('api/db.php?action=news.mine',{method:'GET'}); }
  async function mountMasterNews(context={}, initialEditor=null){
    const page=document.querySelector('.k-master-news-page'), grid=page?.querySelector('[data-master-news-grid]'), summary=page?.querySelector('[data-master-news-summary]');
    const dialog=page?.querySelector('[data-master-news-editor-dialog]'), form=dialog?.querySelector('[data-master-news-form]');
    if(!page||!grid||!dialog||!form)return;
    let items=[];
    const setCategory=value=>{const next=String(value||'service');form.elements.category.value=next;form.querySelectorAll('[data-master-news-category]').forEach(button=>button.classList.toggle('is-active',button.dataset.masterNewsCategory===next));};
    const closeEditor=()=>{if(dialog.open)dialog.close();if(/^#\/master\/news\/(?:create|edit\/)/.test(location.hash))location.hash='#/master/news';};
    const openEditor=item=>{
      form.reset();
      form.elements.id.value=item?.id||'';
      form.elements.title.value=item?.title||'';
      form.elements.intro.value=item?.intro||item?.summary||'';
      form.elements.body.value=item?.body||item?.content||'';
      form.elements.coverUrl.value=item?.cover_url||item?.coverUrl||'';
      form.elements.publishedAt.value=String(item?.published_at||item?.publishedAt||new Date().toISOString()).slice(0,10);
      form.elements.active.checked=item?!!Number(item.active):true;
      setCategory(item?.category||'service');
      dialog.querySelector('[data-master-news-editor-title]').textContent=item?'Редактировать новость':'Создать новость';
      dialog.querySelector('[data-master-news-submit]').textContent=item?'Сохранить изменения':'Опубликовать';
      dialog.querySelector('[data-master-news-status]').textContent='';
      if(!dialog.open)dialog.showModal();
      requestAnimationFrame(()=>form.elements.title?.focus?.({preventScroll:true}));
    };
    const loadMine=async()=>{
      const result=await getMine();items=Array.isArray(result.payload?.news)?result.payload.news:[];
      if(!result.ok){grid.innerHTML='<div class="k-empty"><h2>Не удалось загрузить новости</h2><p>Проверьте авторизацию мастера.</p></div>';return false;}
      if(summary)summary.innerHTML=`<div><b>${items.length}</b><span>Всего</span></div><div><b>${items.filter(x=>Number(x.active)).length}</b><span>Опубликовано</span></div><div><b>${items.filter(x=>!Number(x.active)).length}</b><span>Черновики</span></div>`;
      grid.innerHTML=items.length?items.map(masterCard).join(''):'<div class="k-empty"><h2>У вас пока нет новостей</h2><p>Создайте первую публикацию для клиентов.</p><button class="k-btn k-btn-primary" type="button" data-master-news-create>Создать новость</button></div>';
      return true;
    };
    const click=async e=>{
      if(e.target.closest('[data-master-news-create]')){openEditor(null);return;}
      const edit=e.target.closest('[data-master-news-edit]');if(edit){const item=items.find(x=>String(x.id)===String(edit.dataset.masterNewsEdit));if(item)openEditor(item);return;}
      if(e.target===dialog||e.target.closest('[data-master-news-editor-close]')){closeEditor();return;}
      const category=e.target.closest('[data-master-news-category]');if(category){setCategory(category.dataset.masterNewsCategory);return;}
      const del=e.target.closest('[data-master-news-delete]');if(del){const approved=await window.KaretaNativeDialogs?.confirm?.({title:'Удалить новость?',message:'Публикация будет удалена без переноса в черновики.',confirmLabel:'Удалить',danger:true,trigger:del});if(!approved)return;const r=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'news.delete',id:del.dataset.masterNewsDelete})});if(r.ok)await loadMine();return;}
      const toggle=e.target.closest('[data-master-news-toggle]');if(toggle){const item=items.find(x=>String(x.id)===String(toggle.dataset.masterNewsToggle));if(!item)return;const r=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'news.save',article:{...item,active:Number(toggle.dataset.nextActive),coverUrl:item.cover_url,authorUserId:undefined}})});if(r.ok)await loadMine();}
    };
    const submit=async e=>{e.preventDefault();const status=form.querySelector('[data-master-news-status]');status.textContent='Сохраняем…';const fd=new FormData(form);const article={id:fd.get('id')||'',title:fd.get('title'),category:fd.get('category'),intro:fd.get('intro'),body:fd.get('body'),coverUrl:fd.get('coverUrl'),publishedAt:fd.get('publishedAt'),active:form.elements.active.checked?1:0};const result=await api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'news.save',article})});if(!result.ok){status.textContent=result.payload?.message||result.payload?.error||'Ошибка сохранения';return;}dialog.close();window.KaretaToast?.success?.(article.id?'Новость обновлена':'Новость опубликована');await loadMine();if(/^#\/master\/news\/(?:create|edit\/)/.test(location.hash))location.hash='#/master/news';};
    page.addEventListener('click',click);form.addEventListener('submit',submit);dialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
    const ok=await loadMine();
    if(ok&&initialEditor){const item=initialEditor.mode==='edit'?items.find(x=>String(x.id)===String(initialEditor.id)):null;if(initialEditor.mode!=='edit'||item)openEditor(item);else window.KaretaToast?.error?.('Новость не найдена');}
    const cleanup=()=>{page.removeEventListener('click',click);form.removeEventListener('submit',submit);};context.lifecycle?.addCleanup?.(cleanup);return cleanup;
  }

  function mountMasterNewsEditor(context={}){
    const id=routeId();return mountMasterNews(context,{mode:id?'edit':'create',id});
  }

  window.KaretaNewsPages=Object.freeze({renderNews,mountNews,renderMasterNews,mountMasterNews,renderMasterNewsCreate,renderMasterNewsEdit,mountMasterNewsEditor});
})();
