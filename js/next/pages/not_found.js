(() => {
  'use strict';
  if(window.KaretaNotFoundPages)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);

  function requestedAddress(){
    const serverPath=String(window.KARETA_HTTP_NOT_FOUND_PATH||'').trim();
    if(serverPath)return serverPath;
    const hash=String(location.hash||'').trim();
    if(hash&&hash!=='#/404')return hash;
    return `${location.pathname||'/'}${location.search||''}`;
  }

  function defaultTarget(){
    const navigation=window.KaretaNavigationCore;
    const registry=window.KaretaRouteRegistry;
    const key=String(navigation?.defaultRoute?.()||'home');
    const route=registry?.get?.(key)||registry?.get?.('home')||{path:'#/home',label:'Главная'};
    return {key,path:String(route.path||'#/home'),label:String(route.label||'Главная')};
  }

  function renderNotFound(){
    const target=defaultTarget();
    const requested=requestedAddress();
    return `<section class="k-page k-not-found-page" data-page="not-found" aria-labelledby="k-not-found-title">
      <div class="k-not-found-panel">
        <div class="k-not-found-visual" aria-hidden="true">
          <span class="k-not-found-code">404</span>
          <span class="k-not-found-sign"><svg viewBox="0 0 24 24"><path d="M12 3 3.8 18h16.4L12 3Z"></path><path d="M12 8v4.8"></path><circle cx="12" cy="16" r=".8"></circle></svg></span>
        </div>
        <div class="k-not-found-copy">
          <span class="k-not-found-eyebrow">KARETA.KZ · НАВИГАЦИЯ</span>
          <h1 id="k-not-found-title">Страница не найдена</h1>
          <p>Такого адреса нет в текущей версии приложения. Проверьте ссылку или вернитесь в рабочий раздел.</p>
          <code class="k-not-found-address">${esc(requested)}</code>
          <div class="k-not-found-actions">
            <a class="k-not-found-primary" href="${esc(target.path)}" data-route-link="${esc(target.key)}" data-route-key="${esc(target.key)}">На главную</a>
            <button class="k-not-found-secondary" type="button" data-not-found-back>Назад</button>
          </div>
        </div>
      </div>
      <div class="k-not-found-help">
        <strong>Что можно сделать</strong>
        <span>Откройте меню KARETA.KZ или вернитесь на предыдущую страницу. Ваш аккаунт и данные не затронуты.</span>
      </div>
    </section>`;
  }

  function mountNotFound(){
    const root=document.querySelector('[data-page="not-found"]');
    if(!root)return()=>{};
    const back=root.querySelector('[data-not-found-back]');
    const onBack=()=>{
      if(history.length>1)history.back();
      else location.hash=defaultTarget().path;
    };
    back?.addEventListener('click',onBack);
    return()=>back?.removeEventListener('click',onBack);
  }

  window.KaretaNotFoundPages=Object.freeze({renderNotFound,mountNotFound});
})();