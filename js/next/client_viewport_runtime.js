(() => {
  'use strict';

  if (window.__KARETA_CLIENT_VIEWPORT_RUNTIME__) return;
  window.__KARETA_CLIENT_VIEWPORT_RUNTIME__ = { version:'188.5.5.6.84.63' };

  const root = document.documentElement;
  let frame = 0;
  let blurTimer = 0;
  let navResizeObserver = null;
  let navMutationObserver = null;
  let observedNav = null;

  const editable = node => !!node && (
    /^(INPUT|TEXTAREA|SELECT)$/i.test(node.tagName || '') ||
    node.isContentEditable === true ||
    node.closest?.('[contenteditable="true"]')
  );

  function schedule(){
    if(frame) return;
    frame=requestAnimationFrame(()=>{frame=0;sync();});
  }

  function ensureFocusedVisible({keyboardOpen=false,navHeight=0,viewportHeight=0,viewportTop=0}={}){
    const node=document.activeElement;
    if(!editable(node) || typeof node.getBoundingClientRect!=='function') return;
    const rect=node.getBoundingClientRect();
    const topLimit=Math.max(8,viewportTop+10);
    const bottomInset=keyboardOpen?14:Math.max(14,navHeight+14);
    const bottomLimit=Math.max(topLimit+44,viewportTop+viewportHeight-bottomInset);
    if(rect.top>=topLimit && rect.bottom<=bottomLimit) return;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    try{node.scrollIntoView({block:'center',inline:'nearest',behavior:reduce?'auto':'smooth'});}catch(_error){node.scrollIntoView?.();}
  }

  function sync(){
    const vv=window.visualViewport;
    const layoutHeight=Math.max(1,window.innerHeight||document.documentElement.clientHeight||1);
    const layoutWidth=Math.max(1,window.innerWidth||document.documentElement.clientWidth||1);
    const height=Math.max(1,Math.round(vv?.height||layoutHeight));
    const width=Math.max(1,Math.round(vv?.width||layoutWidth));
    const top=Math.max(0,Math.round(vv?.offsetTop||0));
    const left=Math.max(0,Math.round(vv?.offsetLeft||0));
    const bottom=Math.max(0,Math.round(layoutHeight-height-top));
    const focused=editable(document.activeElement);
    const keyboardOpen=focused && (bottom>=88 || height/layoutHeight<0.82);
    const mobile=window.matchMedia?.('(max-width: 900px)')?.matches !== false;
    const nav=document.getElementById('k-mobile-nav');
    const navVisible=mobile && nav && getComputedStyle(nav).display!=='none' && getComputedStyle(nav).visibility!=='hidden';
    const navHeight=navVisible?Math.max(0,Math.ceil(nav.getBoundingClientRect().height)):0;
    const safeNavHeight=navHeight || (mobile?72:0);

    root.style.setProperty('--k-visual-viewport-height',`${height}px`);
    root.style.setProperty('--k-visual-viewport-width',`${width}px`);
    root.style.setProperty('--k-visual-viewport-top',`${top}px`);
    root.style.setProperty('--k-visual-viewport-left',`${left}px`);
    root.style.setProperty('--k-keyboard-inset',`${keyboardOpen?bottom:0}px`);
    root.style.setProperty('--k-mobile-nav-live-height',`${safeNavHeight}px`);
    root.style.setProperty('--k-client-active-bottom-space',keyboardOpen?'0px':`${safeNavHeight}px`);
    root.style.setProperty('--k-client-nav-clearance',`${keyboardOpen?16:safeNavHeight+18}px`);
    document.body?.classList.toggle('k-client-keyboard-open',keyboardOpen);
    if(focused){
      window.setTimeout(()=>ensureFocusedVisible({keyboardOpen,navHeight:safeNavHeight,viewportHeight:height,viewportTop:top}), keyboardOpen?40:0);
    }
  }


  function observeNavigation(){
    const nav=document.getElementById('k-mobile-nav');
    if(!nav || nav===observedNav) return;
    navResizeObserver?.disconnect?.();
    navMutationObserver?.disconnect?.();
    observedNav=nav;
    if('ResizeObserver' in window){
      navResizeObserver=new ResizeObserver(schedule);
      navResizeObserver.observe(nav);
    }
    navMutationObserver=new MutationObserver(schedule);
    navMutationObserver.observe(nav,{attributes:true,childList:true,subtree:true,attributeFilter:['class','style','aria-current','aria-expanded']});
    schedule();
  }

  function onFocus(){
    clearTimeout(blurTimer);
    schedule();
    setTimeout(schedule,70);
    setTimeout(schedule,220);
  }
  function onBlur(){
    clearTimeout(blurTimer);
    blurTimer=setTimeout(schedule,80);
  }

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,80),{passive:true});
  document.addEventListener('focusin',onFocus,true);
  document.addEventListener('focusout',onBlur,true);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',schedule,{passive:true});
    window.visualViewport.addEventListener('scroll',schedule,{passive:true});
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){observeNavigation();schedule();}});
  ['kareta:navigation-changed','kareta:navigation-core-ready','kareta:interface-context-changed','kareta:route-rendered'].forEach(name=>window.addEventListener(name,()=>{observeNavigation();schedule();}));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeNavigation,{once:true});else observeNavigation();
  sync();
})();
