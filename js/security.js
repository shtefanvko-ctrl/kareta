/* ═══════════════════════════════════════════════════════════
   KARETA.KZ — Security v2.0
   · Server-backed audit log
   · Session-scoped rate limiting
   · Auth guards
   · Presence in memory/session only
   · Session validation against RBAC registry
═══════════════════════════════════════════════════════════ */
const Security = (() => {
  const RATE_KEY    = 'kareta_rate_v2';
  const PRESENCE_KEY= 'kareta_presence_v2';
  const AUDIT_LIMIT = 200;

  async function api(action, body={}) {
    try {
      const res = await fetch('api/db.php', {
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...body, action }),
      });
      const raw = await res.text();
      let json = null;
      try { json = raw ? JSON.parse(raw) : null; } catch(_e) { json = null; }
      if (json && typeof json === 'object') return json;
      if (!res.ok) return { ok:false, error:'http_'+res.status, status:res.status, raw };
      return { ok:true };
    } catch(_e) {
      return { ok:false, error:'network' };
    }
  }

  /* ── Audit Log (DB source of truth, memory cache on client) ─────── */
  const Audit = (() => {
    let cache = [];
    let loaded = false;

    function _mapServerEntry(e) {
      let meta = e?.meta;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch(_e) { meta = {}; }
      }
      return {
        ts: e?.ts || new Date().toISOString(),
        action: e?.action || 'unknown',
        actor: {
          userId: e?.actorUserId || null,
          phone: e?.actorPhone || '',
          role: e?.actorRole || 'guest',
          name: e?.actorName || '—',
        },
        meta: meta && typeof meta === 'object' ? meta : {},
      };
    }

    async function refresh(limit=100) {
      const res = await api('audit.get', { limit });
      if (res?.ok && Array.isArray(res.entries)) {
        cache = res.entries.map(_mapServerEntry);
        loaded = true;
      }
      return cache.slice();
    }

    async function log(action, actor, meta) {
      const entry = {
        ts: new Date().toISOString(),
        action,
        actor: actor ? {
          userId: actor.id || null,
          phone: actor.phone || '',
          role: actor.role || 'guest',
          name: actor.name || '—',
        } : null,
        meta: meta || {},
      };
      cache.unshift(entry);
      cache = cache.slice(0, AUDIT_LIMIT);
      loaded = true;
      const throttleKey = 'kareta.audit.throttle.' + action + '.' + String(entry.actor?.phone || 'anon');
      try {
        const lastTs = Number(sessionStorage.getItem(throttleKey) || 0) || 0;
        const coolMs = action === 'auth.login' ? 15000 : 3000;
        if (Date.now() - lastTs < coolMs) return true;
        sessionStorage.setItem(throttleKey, String(Date.now()));
      } catch(_e) {}
      if (action === 'auth.login') return true;
      const res = await api('audit.log', {
        eventAction: action,
        actorUserId: entry.actor?.userId || null,
        actorPhone: entry.actor?.phone || '',
        actorRole: entry.actor?.role || 'guest',
        actorName: entry.actor?.name || '—',
        meta: entry.meta,
      });
      if (res?.ok || ['network','http_429','rate_limited'].includes(String(res?.error || ''))) return true;
      return false;
    }

    async function clear() {
      const res = await api('audit.clear');
      if (res?.ok) {
        cache = [];
        loaded = true;
      }
      return !!res?.ok;
    }

    function getLast(n=50) {
      return cache.slice(0, n);
    }

    function isLoaded() { return loaded; }

    return { log, getLast, refresh, clear, isLoaded };
  })();

  /* ── Rate Limiter (session-only, not long-lived localStorage) ───── */
  const RateLimit = (() => {
    const RULES = {
      booking:    { max: 3,  windowMs: 86400000, msg: 'Максимум 3 записи в день' },
      login:      { max: 10, windowMs: 3600000,  msg: 'Слишком много попыток входа. Попробуйте через час' },
      cancel:     { max: 5,  windowMs: 86400000, msg: 'Максимум 5 отмен в день' },
      message:    { max: 50, windowMs: 3600000,  msg: 'Лимит сообщений превышен' },
      roleChange: { max: 20, windowMs: 3600000,  msg: 'Слишком много изменений ролей' },
    };

    function _load()  { try { return JSON.parse(sessionStorage.getItem(RATE_KEY)||'{}'); } catch(_e){ return {}; } }
    function _save(d) { try { sessionStorage.setItem(RATE_KEY, JSON.stringify(d)); } catch(_e){} }

    function check(action, identity) {
      const rule = RULES[action];
      if (!rule) return { ok: true };
      const key  = action + ':' + (identity || 'anon');
      const data = _load();
      const now  = Date.now();
      const entry = data[key] || { count: 0, windowStart: now };

      if (now - entry.windowStart > rule.windowMs) {
        entry.count = 0; entry.windowStart = now;
      }
      if (entry.count >= rule.max) {
        const resetIn = Math.ceil((rule.windowMs - (now - entry.windowStart)) / 60000);
        return { ok: false, msg: rule.msg + ` (сброс через ~${resetIn} мин)` };
      }
      entry.count++;
      data[key] = entry;
      _save(data);
      return { ok: true, remaining: rule.max - entry.count };
    }

    return { check };
  })();

  /* ── Auth Guard ────────────────────────────────────────── */
  const Guard = (() => {
    function check(actor, perm, targetPhone) {
      if (!actor) return { ok: false, error: 'Не авторизован' };
      if (actor.active === false) return { ok: false, error: 'Аккаунт заблокирован' };
      if (!RBAC.can(actor, perm)) {
        return { ok: false, error: `Недостаточно прав (требуется: ${perm})` };
      }
      if (targetPhone) {
        const target = RBAC.getUser(targetPhone);
        const actorLevel  = RBAC.ROLES[actor.role]?.level || 0;
        const targetLevel = RBAC.ROLES[target?.role]?.level || 0;
        if (targetLevel >= actorLevel) {
          return { ok: false, error: 'Нельзя изменять данные пользователя с равным или высшим уровнем' };
        }
      }
      return { ok: true };
    }

    function assert(actor, perm) {
      const r = check(actor, perm);
      if (!r.ok) {
        if (window.showToast) window.showToast('🔒 ' + r.error, 'error');
        throw new Error(r.error);
      }
      return true;
    }

    function requireLogin(returnPage) {
      const s = window._appState;
      if (!s?.user) {
        if (window.App?.showAuth) window.App.showAuth(returnPage);
        return false;
      }
      if (s.user.active === false) {
        if (window.showToast) window.showToast('🔒 Аккаунт заблокирован', 'error');
        if (window.App?.logout) window.App.logout();
        return false;
      }
      return true;
    }

    return { check, assert, requireLogin };
  })();

  /* ── Online Presence (session/in-memory) ───────────────── */
  const Presence = (() => {
    const ONLINE_THRESH = 5 * 60 * 1000;

    function _load()  { try { return JSON.parse(sessionStorage.getItem(PRESENCE_KEY)||'{}'); } catch(_e){ return {}; } }
    function _save(d) { try { sessionStorage.setItem(PRESENCE_KEY, JSON.stringify(d)); } catch(_e){} }

    function ping(phone) {
      if (!phone) return;
      const d = _load();
      d[String(phone).replace(/\D/g,'')] = Date.now();
      _save(d);
      _broadcast();
    }

    function isOnline(phone) {
      const d = _load();
      const t = d[String(phone||'').replace(/\D/g,'')] || 0;
      return Date.now() - t < ONLINE_THRESH;
    }

    function lastSeen(phone) {
      const d = _load();
      const t = d[String(phone||'').replace(/\D/g,'')] || 0;
      if (!t) return 'не заходил';
      const diff = Date.now() - t;
      if (diff < 60000)   return 'только что';
      if (diff < 3600000) return `${Math.floor(diff/60000)} мин назад`;
      if (diff < 86400000)return `${Math.floor(diff/3600000)} ч назад`;
      return `${Math.floor(diff/86400000)} д назад`;
    }

    function dot(phone) {
      const online = isOnline(phone);
      return `<span class="presence-dot ${online?'online':'offline'}" title="${online?'Онлайн':lastSeen(phone)}"></span>`;
    }

    const _listeners = [];
    function _broadcast() { _listeners.forEach(fn => { try { fn(); } catch(_e){} }); }
    function onChange(fn) { _listeners.push(fn); return () => { const i=_listeners.indexOf(fn); if(i>=0)_listeners.splice(i,1); }; }

    let _pingTimer = null;
    function startPinging(phone) {
      if (_pingTimer) clearInterval(_pingTimer);
      ping(phone);
      _pingTimer = setInterval(() => ping(phone), 120000);
    }
    function stopPinging() { if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; } }

    return { ping, isOnline, lastSeen, dot, onChange, startPinging, stopPinging };
  })();

  /* ── Session Validator ─────────────────────────────────── */
  const Session = (() => {
    function validate(user) {
      if (!user) return false;
      const fromRegistry = RBAC.getUser(user.phone);
      if (!fromRegistry) return false;
      if (fromRegistry.active === false) return false;
      return true;
    }

    function refresh(user) {
      if (!user?.phone) return user;
      const fresh = RBAC.getUser(user.phone) || {};
      const levels = { guest:0, client:1, master:2, sto:2, admin:3, owner:4 };
      const currentRole = String(user.role||'client');
      const freshRole = String(fresh.role||currentRole||'client');
      const resolvedRole = (levels[freshRole] ?? 0) >= (levels[currentRole] ?? 0) ? freshRole : currentRole;
      return Object.assign({}, user, { role: resolvedRole, active: fresh.active !== false });
    }

    return { validate, refresh };
  })();

  return { Audit, RateLimit, Guard, Presence, Session };
})();

window.Security = Security;

(function() {
  const style = document.createElement('style');
  style.textContent = `
    .presence-dot {
      display:inline-block;width:8px;height:8px;border-radius:50%;
      vertical-align:middle;margin-left:4px;flex-shrink:0;
    }
    .presence-dot.online  { background:#22c55e; box-shadow:0 0 0 2px rgba(34,197,94,.25); }
    .presence-dot.offline { background:#4b5563; }
    .audit-row { display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:12px; }
    .audit-ts  { color:var(--text3);flex-shrink:0;width:80px; }
    .audit-action { font-weight:600;min-width:130px; }
    .audit-meta { color:var(--text2); }
  `;
  document.head.appendChild(style);
})();
