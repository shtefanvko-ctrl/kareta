(() => {
  'use strict';
  let host=null;
  function ensure(){ if(host&&host.isConnected)return host; host=document.createElement('div');host.className='k-toast-host';host.setAttribute('aria-live','polite');document.body.appendChild(host);return host;}
  function show(message,type='info',timeout=3200){const text=String(message||'').trim();if(!text)return;const el=document.createElement('div');el.className=`k-toast k-toast--${type}`;el.innerHTML=`<span>${text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span><button type="button" aria-label="Закрыть">×</button>`;ensure().appendChild(el);const close=()=>{el.classList.add('is-leaving');setTimeout(()=>el.remove(),180)};el.querySelector('button').addEventListener('click',close);setTimeout(close,Math.max(1200,timeout));}
  window.KaretaToast=Object.freeze({show,success:m=>show(m,'success'),error:m=>show(m,'error'),info:m=>show(m,'info')});
})();
