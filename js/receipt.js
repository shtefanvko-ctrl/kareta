/* ═══════════════════════════════════════════════════════════
   KARETA.KZ — Receipt v1.0
   Электронные чеки клиенту
═══════════════════════════════════════════════════════════ */
const Receipt = (() => {

  function _fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г., ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function _buildHTML(order) {
    const svcs = (order.serviceIds||[])
      .map(id => DB.Services.get(id))
      .filter(Boolean);

    const pricePerSvc = svcs.length
      ? svcs.map(s => ({ name: s.name, price: s.basePrice }))
      : [{ name: order.serviceNames || 'Услуги', price: order.price || 0 }];

    const subtotal = pricePerSvc.reduce((s,r) => s + r.price, 0);
    const discount = Math.max(0, subtotal - (order.price || subtotal));
    const total    = order.price || subtotal;

    const stageRows = (order.stages||[]).map(s =>
      `<tr><td style="color:#888;font-size:12px">${s.doneAt ? _fmtDate(s.doneAt) : '—'}</td>
       <td>${s.icon||''} ${s.label}</td></tr>`
    ).join('');

    const receiptId = 'CHK-' + (order.id||'').replace('ORD-','') + '-' + Date.now().toString(36).toUpperCase().slice(-4);

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Чек ${order.id} — KARETA.KZ</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Mulish',system-ui,sans-serif;background:#f4f4f5;display:flex;justify-content:center;padding:24px 12px}
  .receipt{background:#fff;border-radius:var(--ui-radius-md,10px);max-width:420px;width:100%;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.12)}
  .r-head{background:linear-gradient(135deg,#FF6B00,#ff8c42);color:#fff;padding:28px 24px 20px;text-align:center}
  .r-logo{font-size:28px;font-weight:900;letter-spacing:2px;margin-bottom:4px}
  .r-sub{font-size:13px;opacity:.85}
  .r-status{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);
    border-radius:99px;padding:4px 14px;font-size:13px;font-weight:700;margin-top:10px}
  .r-body{padding:20px 24px}
  .r-section{margin-bottom:18px}
  .r-section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;
    color:#9ca3af;margin-bottom:8px}
  .r-row{display:flex;justify-content:space-between;align-items:flex-start;
    padding:7px 0;border-bottom:1px dashed #f0f0f0;font-size:13px}
  .r-row:last-child{border-bottom:none}
  .r-row-lbl{color:#374151}
  .r-row-val{font-weight:600;color:#111827;text-align:right;max-width:55%}
  .r-divider{border:none;border-top:2px dashed #e5e7eb;margin:16px 0}
  .r-total-row{display:flex;justify-content:space-between;align-items:center;
    background:#fff7ed;border-radius:var(--ui-radius-md,10px);padding:12px 16px;margin-top:4px}
  .r-total-lbl{font-weight:700;font-size:14px}
  .r-total-val{font-weight:900;font-size:20px;color:#FF6B00;font-family:'Oswald',sans-serif}
  .r-discount{color:#22c55e;font-size:12px;font-weight:600}
  table.stages{width:100%;font-size:12px;border-collapse:collapse}
  table.stages td{padding:5px 4px;color:#6b7280;vertical-align:top}
  table.stages td:first-child{width:130px;white-space:nowrap}
  .r-qr{text-align:center;padding:16px 0 8px}
  .r-qr-box{display:inline-block;border:2px dashed #e5e7eb;border-radius:var(--ui-radius-md,10px);padding:14px 20px}
  .r-qr-id{font-family:'Oswald',sans-serif;font-size:18px;letter-spacing:2px;color:#374151}
  .r-qr-hint{font-size:11px;color:#9ca3af;margin-top:4px}
  .r-foot{background:#f9fafb;padding:14px 24px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0;max-width:100%}}
</style>
</head>
<body>
<div class="receipt">
  <div class="r-head">
    <div class="r-logo">⚡ KARETA.KZ</div>
    <div class="r-sub">Автоэлектрика и сигнализации</div>
    <div class="r-status">✅ Работа выполнена</div>
  </div>

  <div class="r-body">
    <!-- Заявка -->
    <div class="r-section">
      <div class="r-section-title">Заявка</div>
      <div class="r-row"><span class="r-row-lbl">Номер заявки</span><span class="r-row-val">${order.id}</span></div>
      <div class="r-row"><span class="r-row-lbl">Дата создания</span><span class="r-row-val">${_fmtDate(order.createdAt)}</span></div>
      ${order.completedAt ? `<div class="r-row"><span class="r-row-lbl">Завершено</span><span class="r-row-val">${_fmtDate(order.completedAt)}</span></div>` : ''}
    </div>

    <!-- Клиент и авто -->
    <div class="r-section">
      <div class="r-section-title">Клиент</div>
      <div class="r-row"><span class="r-row-lbl">Имя</span><span class="r-row-val">${order.clientName||'—'}</span></div>
      <div class="r-row"><span class="r-row-lbl">Телефон</span><span class="r-row-val">${order.clientPhone||'—'}</span></div>
      ${order.clientCar ? `<div class="r-row"><span class="r-row-lbl">Автомобиль</span><span class="r-row-val">🚗 ${order.clientCar}</span></div>` : ''}
    </div>

    <!-- Мастер -->
    <div class="r-section">
      <div class="r-section-title">Исполнитель</div>
      <div class="r-row"><span class="r-row-lbl">Мастер</span><span class="r-row-val">🔧 ${order.masterName||'—'}</span></div>
    </div>

    <hr class="r-divider">

    <!-- Услуги -->
    <div class="r-section">
      <div class="r-section-title">Состав работ</div>
      ${pricePerSvc.map(r => `
        <div class="r-row">
          <span class="r-row-lbl">${r.name}</span>
          <span class="r-row-val">${r.price.toLocaleString('ru')} ₸</span>
        </div>`).join('')}
      ${discount > 0 ? `
        <div class="r-row">
          <span class="r-row-lbl r-discount">Скидка</span>
          <span class="r-row-val r-discount">−${discount.toLocaleString('ru')} ₸</span>
        </div>` : ''}
    </div>

    <!-- Итого -->
    <div class="r-total-row">
      <span class="r-total-lbl">ИТОГО</span>
      <span class="r-total-val">${total.toLocaleString('ru')} ₸</span>
    </div>

    ${stageRows ? `
    <hr class="r-divider">
    <div class="r-section">
      <div class="r-section-title">История этапов</div>
      <table class="stages"><tbody>${stageRows}</tbody></table>
    </div>` : ''}

    <div class="r-qr">
      <div class="r-qr-box">
        <div class="r-qr-id">${receiptId}</div>
        <div class="r-qr-hint">Номер чека · kareta.kz</div>
      </div>
    </div>
  </div>

  <div class="r-foot">
    Спасибо, что выбрали KARETA.KZ!<br>
    Гарантия на работы 30 дней · +7 (707) 298-06-49
  </div>
</div>
</body>
</html>`;
  }

  /* ── show(orderId) — модальный чек ──────────────────────── */
  function show(orderId) {
    if(__RECEIPT_DEBUG__) console.log('[Receipt] show:', orderId);
    const order = DB.Orders.get(orderId);
    if (!order) { console.error('[Receipt] order not found:', orderId); if(window.showToast) showToast('Заявка не найдена', 'error'); return; }
    if(__RECEIPT_DEBUG__) console.log('[Receipt] order:', order.id, order.type, order.status, order.price);

    // Audit
    if (window.Security) Security.Audit.log('receipt.view', window._appState?.user, { orderId });

    // LayerManager — не блокируем открытие
    try { window.App?.LayerManager?.open('receipt'); } catch(_e) {}

    let modal = document.getElementById('receipt-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'receipt-modal';
      modal.style.cssText = `position:fixed;inset:0;z-index:var(--z-cmodal,850);background:rgba(0,0,0,.6);
        display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .25s;
        padding:0`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if(e.target===modal) close(); });
    }

    const html = _buildHTML(order);

    modal.innerHTML = `
      <div style="background:var(--bg,#fff);border-radius:var(--ui-radius-lg,18px) var(--ui-radius-lg,18px) 0 0;width:100%;max-width:520px;
        max-height:90vh;overflow:hidden;display:flex;flex-direction:column;
        transform:translateY(60px);transition:transform .3s cubic-bezier(.34,1.56,.64,1)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;
          border-bottom:1px solid var(--line);flex-shrink:0">
          <div style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700">🧾 Электронный чек</div>
          <div style="display:flex;gap:8px">
            <button onclick="Receipt.print('${orderId}')"
              style="background:var(--orange);color:#fff;border:none;border-radius:var(--ui-radius-sm,5px);padding:7px 14px;
              font-size:12px;font-weight:700;cursor:pointer;font-family:'Mulish',sans-serif">
              🖨️ Печать / PDF
            </button>
            <button onclick="document.getElementById('receipt-modal').style.opacity=0;setTimeout(()=>document.getElementById('receipt-modal').style.display='none',250)"
              style="background:var(--surface);border:none;border-radius:var(--ui-radius-sm,5px);padding:7px 12px;
              font-size:18px;cursor:pointer;line-height:1">×</button>
          </div>
        </div>
        <div style="overflow-y:auto;flex:1">
          <iframe id="receipt-iframe" style="width:100%;height:70vh;border:none"
            srcdoc="${html.replace(/"/g, '&quot;')}"></iframe>
        </div>
      </div>`;

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      modal.querySelector('div').style.transform = 'translateY(0)';
    });
  }

  function close() {
    try{ window.App?.LayerManager?.close('receipt'); }catch(_e){}
    const m = document.getElementById('receipt-modal');
    if (!m) return;
    m.style.opacity = '0';
    m.querySelector('div').style.transform = 'translateY(60px)';
    setTimeout(() => { m.style.display = 'none'; }, 280);
  }

  /* ── print(orderId) — открывает HTML в новом окне для печати ── */
  function print(orderId) {
    if(__RECEIPT_DEBUG__) console.log('[Receipt] print:', orderId);
    const order = DB.Orders.get(orderId);
    if (!order) { console.error('[Receipt] print: order not found:', orderId); return; }
    if(__RECEIPT_DEBUG__) console.log('[Receipt] print order:', order.id, order.type, order.price);
    if (window.Security) Security.Audit.log('receipt.print', window._appState?.user, { orderId });
    const html = _buildHTML(order);
    const win  = window.open('', '_blank', 'width=480,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);
    }
  }

  /* ── sendToClient(orderId) — «отправить» чек в чат ─────── */
  function sendToClient(orderId) {
    const order = DB.Orders.get(orderId);
    if (!order) return;
    const chat = DB.Chats.getByOrder(orderId);
    if (!chat) { if(window.showToast) showToast('Чат не найден', 'error'); return; }
    DB.Messages.add(chat.id, {
      from: 'system',
      type: 'receipt',
      text: `🧾 Чек по заявке ${orderId} готов`,
      orderId,
      time: DB._nowStr(),
    });
    if (window.showToast) showToast('Чек отправлен клиенту в чат');
    if (window.Security) Security.Audit.log('receipt.send', window._appState?.user, { orderId });
  }

  return { show, close, print, sendToClient };
})();

window.Receipt = Receipt;
