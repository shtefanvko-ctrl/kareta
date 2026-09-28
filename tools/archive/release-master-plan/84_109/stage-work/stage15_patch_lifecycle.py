from pathlib import Path
p=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/js/order_lifecycle.js')
s=p.read_text(encoding='utf-8')
old="""  function canTransition(from, to, role){
    const a = normalize(from);
    const b = normalize(to);
    const r = normalizeRole(role || actorRole() || 'client');
    if (a === b) return { ok:true, skipped:true, from:a, to:b, role:r };
    const allowed = ((TRANSITIONS[a] && TRANSITIONS[a][b]) || []).map(normalizeRole);
    if (!allowed.length) return { ok:false, error:'invalid_transition', from:a, to:b, role:r };
    // role-level comparison was too permissive: master/sto could inherit client transitions.
    // Frontend must mirror backend intent: transition is allowed only for explicitly listed roles.
    const ok = allowed.includes(r);
    return ok ? { ok:true, from:a, to:b, role:r } : { ok:false, error:'role_not_allowed', from:a, to:b, role:r };
  }

  function allowedNext(from, role){
    const a = normalize(from);
    const r = String(role || actorRole() || 'client');
    return Object.keys(TRANSITIONS[a] || {}).filter(function(to){ return canTransition(a, to, r).ok; });
  }
"""
if old not in s: raise SystemExit('transition block not found')
new="""  function uiCanTransition(from, to, role){
    const a = normalize(from);
    const b = normalize(to);
    const r = normalizeRole(role || actorRole() || 'client');
    if (a === b) return { ok:true, skipped:true, from:a, to:b, role:r, uiOnly:true };
    const uiRoles = ((TRANSITIONS[a] && TRANSITIONS[a][b]) || []).map(normalizeRole);
    if (!uiRoles.length) return { ok:false, error:'invalid_transition', from:a, to:b, role:r, uiOnly:true };
    return uiRoles.includes(r)
      ? { ok:true, from:a, to:b, role:r, uiOnly:true }
      : { ok:false, error:'ui_role_hidden', from:a, to:b, role:r, uiOnly:true };
  }

  function canTransition(from, to, role){
    const a = normalize(from);
    const b = normalize(to);
    const r = normalizeRole(role || actorRole() || 'client');
    if (a === b) return { ok:true, skipped:true, from:a, to:b, role:r, authorizationSource:'server/capabilities' };
    const uiRoles = ((TRANSITIONS[a] && TRANSITIONS[a][b]) || []).map(normalizeRole);
    if (!uiRoles.length) return { ok:false, error:'invalid_transition', from:a, to:b, role:r, authorizationSource:'state-machine' };
    // Browser roles only shape UI. Backend capability/ownership checks decide whether the transition is authorized.
    return { ok:true, from:a, to:b, role:r, uiRoles, authorizationSource:'server/capabilities' };
  }

  function allowedNext(from, role){
    const a = normalize(from);
    const r = String(role || actorRole() || 'client');
    return Object.keys(TRANSITIONS[a] || {}).filter(function(to){ return uiCanTransition(a, to, r).ok; });
  }
"""
s=s.replace(old,new,1)
s=s.replace("      backendRoles: []","      uiRoles: [],\n      serverAuthoritative: true",1)
s=s.replace("backendRoles:", "uiRoles:")
s=s.replace("    actorRole, canTransition, allowedNext, nextStatus,","    actorRole, canTransition, uiCanTransition, allowedNext, nextStatus,",1)
p.write_text(s,encoding='utf-8')
print('ORDER_LIFECYCLE_ROLE_UI_ONLY',s.count('uiRoles:'),s.count('backendRoles:'))
