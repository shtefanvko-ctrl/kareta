(() => { 'use strict';
 const listeners=new Map();
 const on=(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);return()=>listeners.get(type)?.delete(fn)};
 const emit=(type,payload={})=>{listeners.get(type)?.forEach(fn=>{try{fn(payload)}catch(e){console.error('[KARETA event]',e)}});window.dispatchEvent(new CustomEvent(`kareta:${type}`,{detail:payload}));};
 window.KaretaEventBus=Object.freeze({on,emit});
})();
