(function(){
  'use strict';

  function rawDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function nationalDigits(value) {
    const raw = String(value || '');
    let valueDigits = rawDigits(raw);
    if (!valueDigits) return '';

    // Explicit +7 and the old 8XXXXXXXXXX notation contain a country prefix.
    if (/^\s*\+7/.test(raw)) valueDigits = valueDigits.slice(1);
    else if (valueDigits.length >= 11 && (valueDigits[0] === '7' || valueDigits[0] === '8')) valueDigits = valueDigits.slice(1);
    else if (/^\s*8/.test(raw) && valueDigits.length > 0) valueDigits = valueDigits.slice(1);

    return valueDigits.slice(0, 10);
  }

  function digits(value) {
    const local = nationalDigits(value);
    return local ? '7' + local : '';
  }

  function normalize(value) {
    const valueDigits = digits(value);
    return valueDigits ? '+' + valueDigits : '';
  }

  function isValid(value) {
    return nationalDigits(value).length === 10;
  }

  function format(value) {
    const local = nationalDigits(value);
    if (!local) return '';

    let result = '+7';
    if (local.length > 0) result += ' (' + local.slice(0, 3);
    if (local.length >= 3) result += ')';
    if (local.length > 3) result += ' ' + local.slice(3, 6);
    if (local.length > 6) result += '-' + local.slice(6, 8);
    if (local.length > 8) result += '-' + local.slice(8, 10);
    return result;
  }

  function caretForDigitCount(formatted, count) {
    if (count <= 0) return 0;
    let seen = 0;
    for (let index = 0; index < formatted.length; index += 1) {
      if (/\d/.test(formatted[index])) seen += 1;
      if (seen >= count + 1) return index + 1; // +1 skips the fixed country-code digit.
    }
    return formatted.length;
  }

  function bindMasks(options) {
    const root = (options && options.scope) || document;
    const selector = (options && options.selector) || 'input[type="tel"]';
    const onClearError = options && options.onClearError;

    root.querySelectorAll(selector).forEach(function(input){
      if (input.dataset.phoneMaskBound === '1') return;
      input.dataset.phoneMaskBound = '1';
      input.setAttribute('placeholder', '+7 (___) ___-__-__');
      input.setAttribute('maxlength', '18');

      input.addEventListener('keydown', function(event){
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        const start = input.selectionStart == null ? 0 : input.selectionStart;
        const end = input.selectionEnd == null ? start : input.selectionEnd;
        if (start !== end) return;

        const value = String(input.value || '');
        if (event.key === 'Backspace') {
          if (start <= 3) {
            event.preventDefault();
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles:true }));
            return;
          }
          if (start > 0 && /\D/.test(value[start - 1] || '')) {
            let digitIndex = start - 1;
            while (digitIndex > 0 && /\D/.test(value[digitIndex])) digitIndex -= 1;
            if (digitIndex > 1 && /\d/.test(value[digitIndex])) {
              event.preventDefault();
              input.setRangeText('', digitIndex, digitIndex + 1, 'end');
              input.dispatchEvent(new Event('input', { bubbles:true }));
            }
          }
        } else if (/\D/.test(value[start] || '')) {
          let digitIndex = start;
          while (digitIndex < value.length && /\D/.test(value[digitIndex])) digitIndex += 1;
          if (digitIndex < value.length) {
            event.preventDefault();
            input.setRangeText('', digitIndex, digitIndex + 1, 'end');
            input.dispatchEvent(new Event('input', { bubbles:true }));
          }
        }
      });

      input.addEventListener('input', function(){
        const source = String(input.value || '');
        if (!rawDigits(source)) {
          input.value = '';
          if (typeof onClearError === 'function') onClearError(input);
          return;
        }

        const caret = input.selectionStart == null ? source.length : input.selectionStart;
        const beforeCaret = source.slice(0, caret);
        let localCount = nationalDigits(beforeCaret).length;
        const formatted = format(source);
        input.value = formatted;

        // Keep the caret near the digit being edited instead of always jumping unpredictably.
        const nextCaret = caretForDigitCount(formatted, localCount);
        try { input.setSelectionRange(nextCaret, nextCaret); } catch (_) {}
        if (typeof onClearError === 'function') onClearError(input);
      });

      input.addEventListener('blur', function(){
        input.value = format(input.value);
      });

      if (String(input.value || '').trim()) input.value = format(input.value);
    });
  }

  window.KaretaOnboardingPhoneRuntime = Object.freeze({
    digits,
    normalize,
    isValid,
    format,
    bindMasks,
    audit: function(){ return { countryCode:'+7', maxLength:18, liveMask:true }; }
  });
})();
