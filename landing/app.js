(function(){
  "use strict";
  var config=window.KARETA_LANDING_CONFIG||{};
  var dict=null;
  var lang="ru";

  function saved(){
    try{var v=localStorage.getItem("kareta.landing.lang");return ["ru","kk","en"].includes(v)?v:"ru";}catch(_){return"ru";}
  }
  function tr(key){return dict&&dict[lang]&&dict[lang][key]||"";}
  function apply(next){
    if(!dict||!dict[next])return;
    lang=next;document.documentElement.lang=next;
    document.querySelectorAll("[data-i18n]").forEach(function(node){
      var value=dict[next][node.getAttribute("data-i18n")];
      if(typeof value==="string")node.textContent=value;
    });
    document.querySelectorAll("[data-lang]").forEach(function(btn){
      var active=btn.dataset.lang===next;btn.classList.toggle("is-active",active);btn.setAttribute("aria-pressed",active?"true":"false");
    });
    var meta=dict[next]._meta||{};if(meta.title)document.title=meta.title;
    var desc=document.querySelector('meta[name="description"]');if(desc&&meta.description)desc.content=meta.description;
    try{localStorage.setItem("kareta.landing.lang",next);}catch(_){}
    bindLinks();
  }
  function store(link,url){
    var status=link.querySelector("[data-status]");
    if(url){link.href=url;link.removeAttribute("aria-disabled");link.target="_blank";link.rel="noopener noreferrer";if(status){status.textContent=tr("available");status.classList.add("is-ready");}}
    else{link.href="#download";link.setAttribute("aria-disabled","true");if(status){status.textContent=tr("comingSoon")||"Скоро";status.classList.remove("is-ready");}}
  }
  function bindLinks(){
    document.querySelectorAll("[data-web-link]").forEach(function(a){a.href=String(config.webUrl||"../");});
    document.querySelectorAll('[data-download="android"]').forEach(function(a){store(a,String(config.androidUrl||""));});
    document.querySelectorAll('[data-download="ios"]').forEach(function(a){store(a,String(config.iosUrl||""));});
  }
  document.addEventListener("click",function(e){
    var disabled=e.target.closest('[data-download][aria-disabled="true"]');if(disabled)e.preventDefault();
  });
  document.querySelectorAll("[data-lang]").forEach(function(btn){btn.addEventListener("click",function(){apply(btn.dataset.lang);});});
  var menu=document.querySelector("[data-menu]"),mobile=document.querySelector("[data-mobile-nav]");
  if(menu&&mobile){
    menu.addEventListener("click",function(){var open=mobile.hidden;mobile.hidden=!open;menu.setAttribute("aria-expanded",open?"true":"false");});
    mobile.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){mobile.hidden=true;menu.setAttribute("aria-expanded","false");});});
  }
  var header=document.querySelector("[data-header]");
  if(header){var scroll=function(){header.classList.toggle("is-scrolled",window.scrollY>10);};scroll();window.addEventListener("scroll",scroll,{passive:true});}
  var year=document.querySelector("[data-year]");if(year)year.textContent=String(new Date().getFullYear());
  bindLinks();
  fetch("./i18n.json",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("i18n_"+r.status);return r.json();}).then(function(json){dict=json;apply(saved());}).catch(function(err){console.warn("[KARETA landing] i18n fallback RU",err);});
})();