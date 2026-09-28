/* KARETA.KZ — RBAC v2  (единый реестр аккаунтов + смена роли) */
const RBAC = (() => {
  const ROLES = {
    guest:  {id:'guest', level:0,label:'Гость',         emoji:'👤', color:'#52525a'},
    client: {id:'client',level:1,label:'Клиент',        emoji:'🙋', color:'#60a5fa'},
    master: {id:'master',level:2,label:'Мастер',        emoji:'🔧', color:'#34d399'},
    sto:    {id:'sto',   level:2,label:'СТО',           emoji:'🏭', color:'#22c55e'},
    admin:  {id:'admin', level:3,label:'Администратор', emoji:'⚙️',  color:'#f59e0b'},
    owner:  {id:'owner', level:4,label:'Владелец',      emoji:'👑',  color:'#FF6B00'},
  };

  const PERMS = {
    'page.home':0,'page.services':0,'page.pricing':0,'page.about':0,'page.reviews':0,'page.contacts':0,
    'page.booking':1,'page.cabinet':1,
    'page.master':2,
    'page.admin':3,
    'page.owner':4,
    'action.book':1,'action.cancel':1,
    'action.change_status':2,'action.view_schedule':2,'action.view_earnings':2,
    'action.manage_orders':3,'action.manage_clients':3,'action.manage_content':3,
    'action.promote_user':2,    /* мастер+ может повышать клиентов */
    'action.view_reports':4,'action.manage_staff':4,'action.manage_roles':4,'action.settings':4,
  };

  /* ── Базовый реестр (seeded) ──────────────────────────────────────── */
  const SEED_USERS = [
    { phone:'+7 700 000 0001', name:'Алексей Иванов',  role:'client', initials:'АИ', car:'Toyota Camry 2018',    spec:'', active:true },
    { phone:'+7 700 000 0002', name:'Артём Сергеев',   role:'master', initials:'АС', car:'',                     spec:'Генераторы, стартеры', active:true },
    { phone:'+7 700 000 0003', name:'Сергей Ахметов',  role:'admin',  initials:'СА', car:'',                     spec:'', active:true },
    { phone:'+7 700 000 0004', name:'Владелец',         role:'owner',  initials:'ВЛ', car:'',                     spec:'', active:true },
    { phone:'+7 702 555 00 99', name:'Руслан Касымов', role:'master', initials:'РК', car:'',                     spec:'Сигнализации, проводка', active:true },
  ];

  const KEY = 'kareta_users_v1';

  /* ── Хранилище аккаунтов ───────────────────────────────────────────── */
  let _users = null;

  function _load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      _users = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(SEED_USERS));
    } catch(_e) {
      _users = JSON.parse(JSON.stringify(SEED_USERS));
    }
    // Убедимся, что все seed-пользователи есть
    SEED_USERS.forEach(su => {
      const exists = _users.find(u => u.phone.replace(/\D/g,'') === su.phone.replace(/\D/g,''));
      if (!exists) _users.push(Object.assign({}, su));
    });
  }

  function _save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(_users)); } catch(_e) {}
  }

  function _normPhone(p) { return String(p||'').replace(/\D/g,''); }

  /* ── API ────────────────────────────────────────────────────────────── */
  const can     = (u,p) => (ROLES[u?.role??'guest']?.level??0) >= (PERMS[p]??0);
  const atLeast = (u,r) => (ROLES[u?.role??'guest']?.level??0) >= (ROLES[r]?.level??0);
  const getRole = (u)   => ROLES[u?.role??'guest'] ?? ROLES.guest;

  /** Получить пользователя по телефону (из реестра или создать дефолтного) */
  function getUser(phone) {
    if (!_users) _load();
    const c = _normPhone(phone);
    const found = _users.find(u => _normPhone(u.phone) === c);
    if (found) return { ...found };
    // Новый клиент — добавляем в реестр
    const parts = phone.replace(/\D/g,'');
    const nu = { phone, name:'Клиент', role:'client',
      initials: parts.slice(-2).toUpperCase(), car:'', spec:'', active:true };
    _users.push(nu);
    _save();
    return { ...nu };
  }

  /** Все аккаунты (для панели управления) */
  function getAllUsers(roleFilter) {
    if (!_users) _load();
    let list = _users.slice();
    if (roleFilter && roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    return list.sort((a,b) => (ROLES[b.role]?.level||0) - (ROLES[a.role]?.level||0));
  }

  /** Зарегистрировать / обновить пользователя (вызывается при логине) */
  function upsertUser(data) {
    if (!_users) _load();
    const c = _normPhone(data.phone);
    const idx = _users.findIndex(u => _normPhone(u.phone) === c);
    if (idx >= 0) {
      // Обновляем только незащищённые поля (роль через setRole)
      const allowed = ['name','car','spec','initials','email','onboarded'];
      allowed.forEach(k => { if (data[k] !== undefined) _users[idx][k] = data[k]; });
      _save();
      return { ..._users[idx] };
    } else {
      const nu = Object.assign({ role:'client', active:true }, data);
      _users.push(nu);
      _save();
      return { ...nu };
    }
  }

  /**
   * Изменить роль пользователя.
   * actor — тот кто меняет (должен быть мастер+ и иметь action.promote_user)
   * targetPhone — кому меняем
   * newRole — новая роль ('client'|'master'|'sto'|'admin'|'owner')
   * Мастер может повышать до master / понижать до client.
   * Админ может делать admin.
   * Owner — любую роль.
   */
  function setRole(actor, targetPhone, newRole) {
    if (!_users) _load();
    if (!can(actor, 'action.promote_user')) return { ok:false, error:'Нет прав' };
    const actorLevel = ROLES[actor?.role]?.level || 0;
    const newLevel   = ROLES[newRole]?.level || 0;
    // Нельзя назначить роль выше своей
    if (newLevel >= actorLevel) return { ok:false, error:'Нельзя назначить роль выше своей' };
    const c = _normPhone(targetPhone);
    const idx = _users.findIndex(u => _normPhone(u.phone) === c);
    if (idx < 0) return { ok:false, error:'Пользователь не найден' };
    // Нельзя менять роль пользователя равного или выше по уровню
    const targetLevel = ROLES[_users[idx].role]?.level || 0;
    if (targetLevel >= actorLevel) return { ok:false, error:'Нельзя изменить роль пользователя с таким же или высшим уровнем' };
    _users[idx].role = newRole;
    _save();
    // Персистим в MySQL (fire-and-forget)
    if (window.RBAC?._persistRole) RBAC._persistRole(targetPhone, newRole);
    return { ok:true, user:{ ..._users[idx] } };
  }

  /** Деактивировать / активировать аккаунт */
  function setActive(actor, targetPhone, active) {
    if (!_users) _load();
    if (!atLeast(actor, 'admin')) return { ok:false, error:'Нет прав' };
    const c = _normPhone(targetPhone);
    const idx = _users.findIndex(u => _normPhone(u.phone) === c);
    if (idx < 0) return { ok:false, error:'Не найден' };
    _users[idx].active = active;
    _save();
    if (window.RBAC?._persistActive) RBAC._persistActive(targetPhone, active);
    return { ok:true };
  }

  /**
   * Синхронизация реестра из MySQL pull.
   * Вызывается из db.js после успешного GET /api/db.php?action=pull
   */
  function _syncFromDB(usersFromDB) {
    if (!_users) _load();
    if (!Array.isArray(usersFromDB) || !usersFromDB.length) return;
    // Мёрджим: данные из MySQL имеют приоритет по роли и active
    usersFromDB.forEach(dbUser => {
      const c   = _normPhone(dbUser.phone);
      const idx = (_users||[]).findIndex(u => _normPhone(u.phone) === c);
      if (idx >= 0) {
        // Обновляем роль и active из БД (они авторитетны)
        _users[idx].role   = dbUser.role   || _users[idx].role;
        _users[idx].active = dbUser.active !== undefined ? dbUser.active : _users[idx].active;
        _users[idx].name   = dbUser.name   || _users[idx].name;
        _users[idx].initials = dbUser.initials || _users[idx].initials;
      } else {
        _users.push(Object.assign({active:true}, dbUser));
      }
    });
    _save();
  }

  /**
   * Персистит смену роли/active в MySQL через DB API
   */
  async function _persistRole(phone, role) {
    try { await fetch('api/db.php',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'users.setRole',phone,role})}); } catch(e){}
  }
  async function _persistActive(phone, active) {
    try { await fetch('api/db.php',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'users.setActive',phone,active})}); } catch(e){}
  }

  _load();
  return { ROLES, PERMS, can, atLeast, getRole, getUser, getAllUsers, upsertUser, setRole, setActive, _syncFromDB, _persistRole, _persistActive };
})();
