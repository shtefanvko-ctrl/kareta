/* KARETA r56 — route design activation.
   Adds stable body route classes so reference CSS applies to real hash pages,
   not only to services-app classes. */
(function(){
  'use strict';
  var ROUTES = ['home','services','myorders','messages','masters','cabinet','parts'];
  function cleanToken(raw){
    raw = String(raw || '').replace(/^#/, '').trim();
    if(!raw) return 'home';
    var first = raw.split(':')[0].split('?')[0].split('/')[0] || 'home';
    if(first === 'role') return 'role';
    return first;
  }
  function applyRouteClass(){
    var token = cleanToken(location.hash);
    var body = document.body;
    if(!body) return;
    ROUTES.concat(['role']).forEach(function(r){ body.classList.remove('kr-route-' + r); });
    body.classList.add('kr-route-' + token);
    body.setAttribute('data-kareta-route', token);
    var app = document.getElementById('app');
    if(app) app.setAttribute('data-kareta-route', token);
  }
  var _push = history.pushState;
  var _replace = history.replaceState;
  history.pushState = function(){
    var r = _push.apply(this, arguments);
    setTimeout(applyRouteClass, 0);
    return r;
  };
  history.replaceState = function(){
    var r = _replace.apply(this, arguments);
    setTimeout(applyRouteClass, 0);
    return r;
  };
  window.addEventListener('hashchange', applyRouteClass);
  window.addEventListener('popstate', applyRouteClass);
  document.addEventListener('DOMContentLoaded', applyRouteClass);
  setTimeout(applyRouteClass, 0);
  window.KaretaRouteStyle = { apply: applyRouteClass };
})();
