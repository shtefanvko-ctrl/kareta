from pathlib import Path
p=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/js/app.js')
s=p.read_text(encoding='utf-8')
s=s.replace('RBAC.can(', 'RBAC.uiCan(')
s=s.replace('RBAC.atLeast(', 'RBAC.uiAtLeast(')
s=s.replace('window.toggleUserActive = function(phone, currentlyActive) {','window.toggleUserActive = async function(phone, currentlyActive) {',1)
s=s.replace('const result = RBAC.setActive(actor, phone, !currentlyActive);','const result = await RBAC.setActive(actor, phone, !currentlyActive);',1)
s=s.replace('window.saveAddUser = function() {','window.saveAddUser = async function() {',1)
old="""    // Создать через getUser (добавит дефолт), потом устанавливаем роль
    RBAC.upsertUser({ phone, name, role:'client', initials, spec, car:'', active:true });
    RBAC.setRole(S.user, phone, role);
window.__closeLayeredModal('add-user-modal','add-user');
    showToast(`✅ ${name} добавлен как ${RBAC.ROLES[role]?.label}`);"""
if old not in s:
    # tolerate mojibake comment by targeting statements only
    old2="""    RBAC.upsertUser({ phone, name, role:'client', initials, spec, car:'', active:true });
    RBAC.setRole(S.user, phone, role);
window.__closeLayeredModal('add-user-modal','add-user');
    showToast(`✅ ${name} добавлен как ${RBAC.ROLES[role]?.label}`);"""
    if old2 not in s: raise SystemExit('saveAddUser block not found')
    old=old2
new="""    const roleResult = await RBAC.setRole(S.user, phone, role);
    if (!roleResult?.ok) { showToast(roleResult?.error || 'Сервер отклонил изменение роли', 'error'); return; }
    RBAC.upsertUser({ phone, name, initials, spec, car:'', active:true });
window.__closeLayeredModal('add-user-modal','add-user');
    showToast(`✅ ${name} добавлен как ${RBAC.ROLES[role]?.label}`);"""
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('APP_UI_ROLE_ONLY', s.count('RBAC.uiCan('), s.count('RBAC.uiAtLeast('))
