/* ==================== ADMIN SHIPPING ==================== */

/* global loadDashboardMetrics */

let shippingZones = [];

async function loadShippingZones() {
  try {
    const res = await adminFetch('/api/admin/shipping/zones');
    if (!res) return;
    shippingZones = await res.json();
    renderShippingZones();
  } catch (e) {
    console.error('[admin] Error cargando zonas de envío:', e);
  }
}

function renderShippingZones() {
  const container = document.getElementById('shippingZonesContainer');
  if (!container) return;
  if (!shippingZones.length) {
    container.innerHTML = '<p style="color:var(--text-muted);">No hay zonas configuradas.</p>';
    return;
  }
  container.innerHTML = shippingZones.map((z, i) => `
    <div class="form-grid-2" style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border); border-radius:8px;">
      <div class="form-group">
        <label>Provincia</label>
        <input type="text" value="${window.escapeHtml(z.province || '')}" onchange="updateShippingZone(${i}, 'province', this.value)" />
      </div>
      <div class="form-group">
        <label>Costo de envío ($)</label>
        <input type="number" value="${z.cost || 0}" step="0.01" onchange="updateShippingZone(${i}, 'cost', this.value)" />
      </div>
      <div class="form-group">
        <label>Envío gratis desde ($)</label>
        <input type="number" value="${z.freeFrom || 0}" step="0.01" onchange="updateShippingZone(${i}, 'freeFrom', this.value)" />
      </div>
      <div class="form-group">
        <label>Prefijos de CP (separados por coma)</label>
        <input type="text" value="${(z.zipPatterns || []).join(', ')}" onchange="updateShippingZone(${i}, 'zipPatterns', this.value)" />
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <button class="btn btn-danger btn-sm" onclick="deleteShippingZone(${i})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function updateShippingZone(index, field, value) {
  if (!shippingZones[index]) return;
  if (field === 'zipPatterns') {
    shippingZones[index][field] = value.split(',').map(s => s.trim()).filter(Boolean);
  } else if (field === 'cost' || field === 'freeFrom') {
    shippingZones[index][field] = Number(value) || 0;
  } else {
    shippingZones[index][field] = value;
  }
}

function addShippingZone() {
  shippingZones.push({
    province: 'Nueva Provincia',
    zipPatterns: [],
    cost: 0,
    freeFrom: 0
  });
  renderShippingZones();
}

function deleteShippingZone(index) {
  shippingZones.splice(index, 1);
  renderShippingZones();
}

async function saveShippingZones() {
  try {
    const res = await adminFetch('/api/admin/shipping/zones', {
      method: 'PUT',
      body: JSON.stringify(shippingZones)
    });
    if (!res) return;
    const data = await res.json();
    if (data.ok) {
      showToast('', 'Zonas de envío guardadas correctamente', 'success');
    } else {
      showToast('', data.error || 'Error guardando zonas', 'error');
    }
  } catch (e) {
    showToast('', 'Error guardando zonas de envío', 'error');
  }
}

window.addShippingZone = addShippingZone;
window.deleteShippingZone = deleteShippingZone;
window.saveShippingZones = saveShippingZones;
window.updateShippingZone = updateShippingZone;
window.renderShippingZones = renderShippingZones;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadShippingZones === 'function') loadShippingZones();
  if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics();
});
