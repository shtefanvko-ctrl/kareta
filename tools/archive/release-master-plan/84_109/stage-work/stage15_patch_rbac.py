from pathlib import Path
p=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/js/rbac.js')
s=p.read_text(encoding='utf-8')

start=s.index('  function setRole(actor, targetPhone, newRole) {')
end=s.index('\n  /**', start)
new="""  async function setRole(_actor, targetPhone, newRole) {
    if (!_users) _load();
    const normalizedRole=String(newRole||'').trim().toLowerCase();
    if (!ROLES[normalizedRole] || normalizedRole==='guest') return { ok:false, error:'invalid_role' };
    const server = await _persistRole(targetPhone, normalizedRole);
    if (!server || server.ok !== true) {
      return { ok:false, error:server?.error || server?.code || 'server_authorization_failed', server };
    }
    const c = _normPhone(targetPhone);
    let idx = _users.findIndex(u => _normPhone(u.phone) === c);
    if (idx < 0) {
      _users.push({ phone:targetPhone, name:'', role:normalizedRole, initials:'', car:'', spec:'', active:true });
      idx=_users.length-1;
    } else {
      _users[idx].role = normalizedRole;
    }
    _save();
    return { ok:true, user:{ ..._users[idx] }, serverAuthoritative:true, server };
  }
"""
s=s[:start]+new+s[end:]

start=s.index('  function setActive(actor, targetPhone, active) {')
end=s.index('\n  /**', start)
new="""  async function setActive(_actor, targetPhone, active) {
    if (!_users) _load();
    const server = await _persistActive(targetPhone, Boolean(active));
    if (!server || server.ok !== true) {
      return { ok:false, error:server?.error || server?.code || 'server_authorization_failed', server };
    }
    const c = _normPhone(targetPhone);
    const idx = _users.findIndex(u => _normPhone(u.phone) === c);
    if (idx >= 0) {
      _users[idx].active = Boolean(active);
      _save();
    }
    return { ok:true, serverAuthoritative:true, server };
  }
"""
s=s[:start]+new+s[end:]

old="  return { ROLES, PERMS, can, atLeast, getRole, getUser, getAllUsers, upsertUser, setRole, setActive, _syncFromDB, _persistRole, _persistActive };"
new="  return { ROLES, PERMS, PERM_CAPABILITIES, can, uiCan, atLeast, uiAtLeast, getRole, getUser, getAllUsers, upsertUser, setRole, setActive, _syncFromDB, _persistRole, _persistActive, authorizationSource:'server/capabilities' };"
if old not in s: raise SystemExit('return block not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('RBAC_SECURITY_SOURCE_MIGRATED')
