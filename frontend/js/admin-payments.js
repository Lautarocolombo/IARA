(function () {
  'use strict';

  var paymentsChart = null;
  var currentProofPage = 1;
  var currentProofStatus = '';
  var currentProofSearch = '';
  var currentProofLimit = 15;
  var proofData = { proofs: [], total: 0, page: 1, pages: 0 };

  function showToast(icon, message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.innerHTML = '<span style="margin-right:0.5rem;">' + (icon || '') + '</span><span>' + message + '</span>';
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
    }, 3500);
  }

  function setLoading(btnId, loadingId, loading, defaultText, loadingText) {
    var btn = document.getElementById(btnId);
    var load = document.getElementById(loadingId);
    if (btn) btn.disabled = loading;
    if (load) load.classList.toggle('hidden', !loading);
    var textSpan = load ? load.previousElementSibling : null;
    if (textSpan && textSpan.id === btnId + 'Text') {
      textSpan.textContent = loading ? (loadingText || 'Procesando...') : (defaultText || 'Guardar');
    }
  }

  function formatCurrency(value) {
    return '$' + Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function loadPaymentConfig() {
    try {
      var res = await window.adminFetch('/api/admin/payment-config', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando configuración');
      var data = await res.json();

      var aliasEl = document.getElementById('pmAlias');
      var holderEl = document.getElementById('pmHolderName');
      var activeEl = document.getElementById('pmActive');
      if (aliasEl) aliasEl.value = data.transferAlias || data.mpAlias || '';
      if (holderEl) holderEl.value = data.holderName || '';
      if (activeEl) activeEl.checked = data.active !== false;

      var previewAlias = document.getElementById('pmPreviewAlias');
      var previewHolder = document.getElementById('pmPreviewHolder');
      var previewStatus = document.getElementById('pmPreviewStatus');
      if (previewAlias) previewAlias.textContent = data.transferAlias || data.mpAlias || '—';
      if (previewHolder) previewHolder.textContent = data.holderName || '—';
      if (previewStatus) previewStatus.textContent = data.active !== false ? 'Habilitado' : 'Deshabilitado';
    } catch (err) {
      console.error('[Payments] Error cargando config:', err);
      showToast('❌', 'Error al cargar configuración', 'error');
    }
  }

  async function savePaymentConfig() {
    var btnId = 'savePaymentConfigBtn';
    var loadingId = 'savePaymentConfigBtnLoading';
    setLoading(btnId, loadingId, true, 'Guardar en Nube', 'Guardando...');

    try {
      var alias = (document.getElementById('pmAlias')?.value || '').trim();
      var holder = (document.getElementById('pmHolderName')?.value || '').trim();
      var active = document.getElementById('pmActive')?.checked !== false;

      var res = await window.adminFetch('/api/admin/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mpAlias: alias,
          transferAlias: alias,
          holderName: holder,
          active: active,
          notifyAdminNewProof: true,
          notifyClientApproved: true,
          notifyClientRejected: true
        })
      });

      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error guardando configuración');
      }

      var statusEl = document.getElementById('savePaymentStatus');
      if (statusEl) {
        statusEl.textContent = '✅ Guardado en la nube correctamente';
        statusEl.className = 'save-status visible success';
        setTimeout(function () { statusEl.className = 'save-status'; }, 3000);
      }
      showToast('✅', 'Configuración guardada en la nube', 'success');
      loadPaymentConfig();
    } catch (err) {
      var statusEl2 = document.getElementById('savePaymentStatus');
      if (statusEl2) {
        statusEl2.textContent = '❌ ' + (err.message || 'Error al guardar');
        statusEl2.className = 'save-status visible error';
        setTimeout(function () { statusEl2.className = 'save-status'; }, 4000);
      }
      showToast('❌', err.message || 'Error al guardar', 'error');
    } finally {
      setLoading(btnId, loadingId, false, 'Guardar en Nube', 'Guardando...');
    }
  }

  async function loadPaymentProofs() {
    var loadingEl = document.getElementById('pmProofsLoading');
    var tbody = document.getElementById('pmProofsTableBody');
    var emptyEl = document.getElementById('pmProofsEmpty');
    if (loadingEl) loadingEl.style.display = 'block';
    if (tbody) tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
      var params = new URLSearchParams();
      params.set('page', String(currentProofPage));
      params.set('limit', String(currentProofLimit));
      if (currentProofStatus) params.set('status', currentProofStatus);
      if (currentProofSearch) params.set('search', currentProofSearch);

      var res = await window.adminFetch('/api/admin/payment-proofs?' + params.toString(), { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando comprobantes');
      var data = await res.json();
      proofData = data;

      renderProofsTable(data);
      renderProofsPagination(data);
    } catch (err) {
      console.error('[Payments] Error cargando comprobantes:', err);
      showToast('❌', 'Error al cargar comprobantes', 'error');
      if (emptyEl) emptyEl.style.display = 'block';
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  function renderProofsTable(data) {
    var tbody = document.getElementById('pmProofsTableBody');
    var emptyEl = document.getElementById('pmProofsEmpty');
    if (!tbody) return;

    if (!data.proofs || !data.proofs.length) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    data.proofs.forEach(function (p) {
      var statusClass = 'status-' + (p.status || 'pending');
      var statusLabel = p.status === 'pending' ? 'Pendiente' : (p.status === 'approved' ? 'Aprobado' : 'Rechazado');
      var proofUrl = p.proof_url || '';
      var proofLink = proofUrl ? '<a href="' + proofUrl + '" target="_blank" rel="noopener">Ver</a>' : '—';
      html += '<tr>' +
        '<td>#' + escapeHtml(String(p.order_id || '')) + '</td>' +
        '<td>' + (p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—') + '</td>' +
        '<td>' + escapeHtml(p.customer_name || '—') + '</td>' +
        '<td>' + proofLink + '</td>' +
        '<td><span class="order-status ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td>' +
          (p.status === 'pending' ? '<button class="btn btn-success btn-sm" onclick="window.approveProof(' + p.id + ', ' + p.order_id + ')">Aprobar</button>' : '') +
          (p.status === 'pending' ? '<button class="btn btn-danger btn-sm" onclick="window.rejectProof(' + p.id + ', ' + p.order_id + ')" style="margin-left:0.25rem;">Rechazar</button>' : '') +
          (p.status === 'rejected' && p.rejection_reason ? '<div style="font-size:0.75rem;color:#dc2626;margin-top:0.25rem;">' + escapeHtml(p.rejection_reason) + '</div>' : '') +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }

  function renderProofsPagination(data) {
    var el = document.getElementById('pmProofsPagination');
    if (!el) return;
    if (!data.pages || data.pages <= 1) {
      el.innerHTML = '';
      return;
    }

    var pages = data.pages;
    var current = data.page;
    var maxButtons = 7;
    var html = '<div class="pagination">';

    if (pages <= maxButtons) {
      for (var i = 1; i <= pages; i++) {
        html += buildPageBtn(i, current);
      }
    } else {
      html += buildPageBtn(1, current);

      var start = Math.max(2, current - 2);
      var end = Math.min(pages - 1, current + 2);

      if (start > 2) html += '<span class="pagination-ellipsis">…</span>';

      for (var j = start; j <= end; j++) {
        html += buildPageBtn(j, current);
      }

      if (end < pages - 1) html += '<span class="pagination-ellipsis">…</span>';

      html += buildPageBtn(pages, current);
    }

    html += '</div>';
    el.innerHTML = html;

    el.querySelectorAll('.pagination-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentProofPage = Number(btn.getAttribute('data-page') || 1);
        loadPaymentProofs();
      });
    });
  }

  function buildPageBtn(page, current) {
    var cls = 'btn btn-secondary btn-sm pagination-btn' + (page === current ? ' active' : '');
    return '<button class="' + cls + '" data-page="' + page + '">' + page + '</button>';
  }

  async function approveProof(proofId, orderId) {
    var amount = '0';
    var found = proofData.proofs.find(function (p) { return p.id === proofId; });
    if (found) amount = formatCurrency(found.amount || 0);

    var confirmMsg = '¿Confirmás la aprobación del pago de ' + amount + ' para el pedido #' + orderId + '?';
    if (!window.confirm(confirmMsg)) return;

    try {
      var res = await window.adminFetch('/api/admin/payment-proofs/' + proofId + '/approve', { method: 'POST' });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error al aprobar');
      }
      showToast('✅', 'Pago aprobado. Pedido #' + orderId + ' marcado como confirmado.', 'success');
      loadPaymentProofs();
      loadPaymentStats();
      loadActivityLog();
    } catch (err) {
      showToast('❌', err.message || 'Error al aprobar', 'error');
    }
  }

  async function rejectProof(proofId, orderId) {
    var reason = prompt('Motivo del rechazo (opcional):');
    if (reason === null) return;

    try {
      var res = await window.adminFetch('/api/admin/payment-proofs/' + proofId + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error al rechazar');
      }
      showToast('✅', 'Pago rechazado para el pedido #' + orderId + '. Se notificará al cliente para que vuelva a subir el comprobante.', 'success');
      loadPaymentProofs();
      loadPaymentStats();
      loadActivityLog();
    } catch (err) {
      showToast('❌', err.message || 'Error al rechazar', 'error');
    }
  }

  async function loadPaymentStats() {
    try {
      var res = await window.adminFetch('/api/admin/payment-stats', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando estadísticas');
      var data = await res.json();

      var elApprovedCount = document.getElementById('pmKpiApprovedCount');
      var elApprovedTotal = document.getElementById('pmKpiApprovedTotal');
      var elRejected = document.getElementById('pmKpiRejected');
      var elAliasActive = document.getElementById('pmKpiAliasActive');
      if (elApprovedCount) elApprovedCount.textContent = String(data.approvedCount || 0);
      if (elApprovedTotal) elApprovedTotal.textContent = formatCurrency(data.approvedTotal || 0);
      if (elRejected) elRejected.textContent = String(data.rejectedCount || 0);
      if (elAliasActive) {
        elAliasActive.textContent = data.isAliasActive ? 'Sí' : 'No';
        elAliasActive.style.color = data.isAliasActive ? '#16a34a' : '#dc2626';
      }

      var elCountTrend = document.getElementById('pmKpiCountTrend');
      var elTotalTrend = document.getElementById('pmKpiTotalTrend');
      if (elCountTrend) {
        var sign = data.countVariation >= 0 ? '+' : '';
        elCountTrend.textContent = sign + data.countVariation.toFixed(1) + '% vs mes anterior';
        elCountTrend.style.color = data.countVariation >= 0 ? '#16a34a' : '#dc2626';
      }
      if (elTotalTrend) {
        var sign2 = data.totalVariation >= 0 ? '+' : '';
        elTotalTrend.textContent = sign2 + data.totalVariation.toFixed(1) + '% vs mes anterior';
        elTotalTrend.style.color = data.totalVariation >= 0 ? '#16a34a' : '#dc2626';
      }

      renderPaymentsChart(data.chartData || []);
    } catch (err) {
      console.error('[Payments] Error cargando stats:', err);
    }
  }

  function renderPaymentsChart(chartData) {
    var ctx = document.getElementById('pmPaymentsChart');
    if (!ctx) return;
    if (paymentsChart) {
      paymentsChart.destroy();
      paymentsChart = null;
    }

    var labels = [];
    var dataPoints = [];
    chartData.forEach(function (d) {
      labels.push(d.date);
      dataPoints.push(d.count);
    });

    paymentsChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Pagos aprobados',
          data: dataPoints,
          borderColor: 'rgba(212, 112, 144, 1)',
          backgroundColor: 'rgba(212, 112, 144, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  async function loadActivityLog() {
    var loadingEl = document.getElementById('pmActivityLoading');
    var tbody = document.getElementById('pmActivityTableBody');
    var emptyEl = document.getElementById('pmActivityEmpty');
    if (loadingEl) loadingEl.style.display = 'block';
    if (tbody) tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
      var res = await window.adminFetch('/api/admin/activity-log?limit=50', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando actividad');
      var data = await res.json();

      if (!data.logs || !data.logs.length) {
        if (emptyEl) emptyEl.style.display = 'block';
      } else {
        if (emptyEl) emptyEl.style.display = 'none';
        var html = '';
        data.logs.forEach(function (log) {
          html += '<tr>' +
            '<td>' + escapeHtml(log.details || log.action || '—') + '</td>' +
            '<td>' + (log.created_at ? new Date(log.created_at).toLocaleString('es-AR') : '—') + '</td>' +
          '</tr>';
        });
        if (tbody) tbody.innerHTML = html;
      }
    } catch (err) {
      console.error('[Payments] Error cargando activity log:', err);
      if (emptyEl) emptyEl.style.display = 'block';
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  function initPaymentsPanel() {
    loadPaymentConfig();
    loadPaymentProofs();
    loadPaymentStats();
    loadActivityLog();

    var saveBtn = document.getElementById('savePaymentConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', savePaymentConfig);
    }

    var searchInput = document.getElementById('pmProofSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        currentProofSearch = this.value.trim();
        currentProofPage = 1;
        loadPaymentProofs();
      });
    }

    var statusFilter = document.getElementById('pmProofStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', function () {
        currentProofStatus = this.value;
        currentProofPage = 1;
        loadPaymentProofs();
      });
    }

    var limitSelect = document.getElementById('pmProofLimit');
    if (limitSelect) {
      limitSelect.addEventListener('change', function () {
        currentProofLimit = Number(this.value) || 15;
        currentProofPage = 1;
        loadPaymentProofs();
      });
    }

    window.approveProof = approveProof;
    window.rejectProof = rejectProof;
  }

  window.initPaymentsPanel = initPaymentsPanel;
})();
