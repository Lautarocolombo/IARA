const API_BASE = CONFIG.API.BASE;

function getTransferApiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function loadTransferPayments(status = 'all') {
  const tbody = document.getElementById('transferTableBody');
  const container = document.getElementById('transferPaymentsSection');
  if (!tbody || !container) return;

  try {
    const url = getTransferApiUrl(`/api/admin/transfer-payments?status=${encodeURIComponent(status)}`);
    const res = await window.adminFetch(url);
    const data = await res.json();

    if (!data.receipts || data.receipts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay comprobantes para mostrar</td></tr>';
      return;
    }

    tbody.innerHTML = data.receipts.map(r => {
      const statusClass = r.status === 'verified' ? 'status-confirmed' : (r.status === 'rejected' ? 'status-rejected' : 'status-pending');
      const statusLabel = r.status === 'verified' ? 'Verificado' : (r.status === 'rejected' ? 'Rechazado' : 'Pendiente');
      const fileUrl = r.url || '#';
      const amountDiff = r.amount_paid > 0 ? Math.abs(r.order_total - r.amount_paid) : null;
      const amountWarning = amountDiff !== null && amountDiff > 0.01 ? ' ⚠️' : '';

      return `
        <tr>
          <td>#${r.order_id}</td>
          <td>${r.customer_name || '—'}<br><small style='color:var(--text-muted)'>${r.customer_email || ''}</small></td>
          <td>${formatARS(r.order_total)}</td>
          <td>${r.amount_paid > 0 ? formatARS(r.amount_paid) + amountWarning : '—'}</td>
          <td>${new Date(r.created_at).toLocaleString('es-AR')}</td>
          <td><a href='${fileUrl}' target='_blank' class='btn btn-secondary btn-sm'>Ver comprobante</a></td>
          <td><span class='order-status ${statusClass}'>${statusLabel}</span></td>
          <td>
            ${r.status === 'pending' ? `
              <button class='btn btn-primary btn-sm' onclick='verifyReceipt(${r.id})'>Confirmar</button>
              <button class='btn btn-danger btn-sm' onclick='rejectReceipt(${r.id})' style='margin-left:0.25rem;'>Rechazar</button>
            ` : `<small>${r.verified_by || ''}</small>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error cargando transferencias:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#dc2626;">Error al cargar</td></tr>';
  }
}

async function verifyReceipt(receiptId) {
  const reason = prompt('Motivo de verificación (opcional):');
  try {
    const res = await window.adminFetch(getTransferApiUrl(`/api/admin/transfer-payments/${receiptId}/verify`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || '' })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    showToast('', 'Pago verificado y stock descontado', 'success');
    loadTransferPayments(getCurrentTransferFilter());
  } catch (err) {
    showToast('', err.message || 'Error al verificar', 'error');
  }
}

async function rejectReceipt(receiptId) {
  const reason = prompt('Motivo del rechazo (requerido):');
  if (!reason || !reason.trim()) {
    showToast('', 'El motivo de rechazo es requerido', 'error');
    return;
  }
  try {
    const res = await window.adminFetch(getTransferApiUrl(`/api/admin/transfer-payments/${receiptId}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    showToast('', 'Pago rechazado y stock liberado', 'success');
    loadTransferPayments(getCurrentTransferFilter());
  } catch (err) {
    showToast('', err.message || 'Error al rechazar', 'error');
  }
}

function getCurrentTransferFilter() {
  const select = document.getElementById('transferStatusFilter');
  return select ? select.value : 'all';
}

function setupTransferPayments() {
  const filterSelect = document.getElementById('transferStatusFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => loadTransferPayments(filterSelect.value));
  }
  loadTransferPayments();
}

window.verifyReceipt = verifyReceipt;
window.rejectReceipt = rejectReceipt;
window.loadTransferPayments = loadTransferPayments;
window.setupTransferPayments = setupTransferPayments;
