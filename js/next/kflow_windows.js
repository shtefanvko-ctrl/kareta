(() => {
  'use strict';
  if (window.KaretaKFlow) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clamp = (value,min,max) => Math.max(min,Math.min(max,Number(value)||min));

  function renderSteps(options = {}) {
    const total = clamp(options.total || 1,1,12);
    const current = clamp(options.current || 1,1,total);
    const label = String(options.label || 'Окно');
    const nodes = [];
    const completed = options.completed === true;
    for (let index=1; index<=total; index+=1) {
      const state = completed ? 'is-done' : index < current ? 'is-done' : index === current ? 'is-active' : 'is-idle';
      const dot = completed && index === total ? '✓' : String(index);
      nodes.push(`<li class="k-flow-step ${state}" data-kflow-step="${index}"><span class="k-flow-step__dot" ${!completed&&index===current?'aria-current="step"':''}>${dot}</span><span class="k-flow-step__sr">${esc(label)} ${index}${!completed&&index===current?' — текущее':''}${completed&&index===total?' — завершено':''}</span></li>`);
    }
    return `<ol class="k-flow-steps" aria-label="${esc(label)} ${current} из ${total}">${nodes.join('')}</ol>`;
  }

  function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g,'');
    const local = (digits.length >= 11 && (digits[0] === '7' || digits[0] === '8')) ? digits.slice(1,11) : digits.slice(0,10);
    if (!local) return '+7 ••• ••• •• ••';
    const a=local.slice(0,3).padEnd(3,'•');
    const tail=local.slice(-2).padStart(2,'•');
    return `+7 ${a} ••• •• ${tail}`;
  }

  function formatCountdown(seconds) {
    const value=Math.max(0,Number(seconds)||0);
    return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  }

  function bindOtp(root, options = {}) {
    if (!root) return () => {};
    const hidden = root.querySelector(options.hiddenSelector || '[data-kflow-otp-value]');
    const cells = [...root.querySelectorAll(options.cellSelector || '[data-kflow-otp-cell]')];
    if (!hidden || !cells.length) return () => {};
    const limit = cells.length;
    const clean = value => String(value || '').replace(/\D/g,'').slice(0,limit);
    const sync = (value, focusIndex = null) => {
      const digits=clean(value);
      cells.forEach((cell,index)=>{cell.value=digits[index]||'';});
      hidden.value=digits;
      hidden.dispatchEvent(new Event('input',{bubbles:true}));
      if (focusIndex !== null) cells[Math.max(0,Math.min(limit-1,focusIndex))]?.focus({preventScroll:true});
      return digits;
    };
    const onInput = event => {
      const cell=event.target.closest('[data-kflow-otp-cell]');
      if (!cell) return;
      const index=cells.indexOf(cell);
      const value=clean(cell.value);
      if (value.length > 1) { sync(value,Math.min(value.length,limit-1)); return; }
      cell.value=value.slice(-1);
      const joined=cells.map(item=>clean(item.value)).join('').slice(0,limit);
      hidden.value=joined;
      hidden.dispatchEvent(new Event('input',{bubbles:true}));
      if (cell.value && index < limit-1) cells[index+1].focus({preventScroll:true});
    };
    const onKeydown = event => {
      const cell=event.target.closest('[data-kflow-otp-cell]');
      if (!cell) return;
      const index=cells.indexOf(cell);
      if (event.key === 'Backspace' && !cell.value && index>0) {event.preventDefault();cells[index-1].value='';cells[index-1].focus({preventScroll:true});hidden.value=cells.map(item=>clean(item.value)).join('');hidden.dispatchEvent(new Event('input',{bubbles:true}));}
      if (event.key === 'ArrowLeft' && index>0) {event.preventDefault();cells[index-1].focus({preventScroll:true});}
      if (event.key === 'ArrowRight' && index<limit-1) {event.preventDefault();cells[index+1].focus({preventScroll:true});}
    };
    const onPaste = event => {
      const text=event.clipboardData?.getData('text') || '';
      const digits=clean(text);
      if (!digits) return;
      event.preventDefault();
      sync(digits,Math.min(digits.length,limit)-1);
    };
    root.addEventListener('input',onInput);
    root.addEventListener('keydown',onKeydown);
    root.addEventListener('paste',onPaste);
    if (hidden.value) sync(hidden.value);
    return () => {root.removeEventListener('input',onInput);root.removeEventListener('keydown',onKeydown);root.removeEventListener('paste',onPaste);};
  }

  function branch(role, reverse = false) {
    const master = String(role || '').toLowerCase() === 'master';
    if (master) return reverse ? {enter:'right',leave:'left'} : {enter:'left',leave:'right'};
    return reverse ? {enter:'left',leave:'right'} : {enter:'right',leave:'left'};
  }

  window.KaretaKFlow = Object.freeze({version:'1',renderSteps,maskPhone,formatCountdown,bindOtp,branch});
})();
