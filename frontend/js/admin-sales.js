/* ==================== ADMIN SALES.JS ==================== */
/* KPIs, gráfico Chart.js, toggle weekly/monthly, venta manual */

(function () {
  'use strict';

  var salesChart = null;
  var salesDonut = null;
  var currentView = 'weekly';
  var salesData = null;
  var productsForSale = [];

  /* ===== CARGA DE DATOS ===== */

  async function loadSalesSummary(view) {
    if (view === '6months' || view === 'custom') view = 'monthly';
    view = view || 'weekly';
    currentView = view;

    var syncBtn = document.getElementById('syncSalesBtn');
    var syncText = document.getElementById('syncSalesBtnText');
    var syncLoading = document.getElementById('syncSalesBtnLoading');
    if (syncBtn) syncBtn.disabled = true;
    if (syncText) syncText.style.display = 'none';
    if (syncLoading) syncLoading.classList.remove('hidden');

    try {
      var res = await window.adminFetch('/api/admin/reports/summary?view=' + view, { method: 'GET' });
      if (!res || !res.ok) {
        throw new Error('No se pudieron cargar los reportes');
      }
      salesData = await res.json();

      renderKPIs({
        total_revenue: salesData.total || 0,
        total_orders: salesData.count || 0,
        avg_order_value: salesData.ticketPromedio || 0
      });

      updateChart(salesData);
      renderRangeToggle(view);
    } catch (err) {
      console.error('[Sales] Error:', err);
      window.showToast('❌', 'No se pudieron cargar los reportes.', 'error');
    } finally {
      if (syncBtn) syncBtn.disabled = false;
      if (syncText) syncText.style.display = '';
      if (syncLoading) syncLoading.classList.add('hidden');
    }
  }

  async function loadProductsForSale() {
    try {
      var res = await window.adminFetch('/api/products?limit=100', { method: 'GET' });
      if (res && res.ok) {
        var data = await res.json();
        productsForSale = Array.isArray(data) ? data : (data.products || []);
        renderSaleProductOptions();
      }
    } catch (err) {
      console.warn('[Sales] No se pudieron cargar productos:', err);
      productsForSale = [];
    }
  }

  async function loadTransactions() {
    var tbody = document.getElementById('transactionsTableBody');
    var emptyState = document.getElementById('transactionsEmptyState');
    if (!tbody) return;

    try {
      var res = await window.adminFetch('/api/admin/earnings', { method: 'GET' });
      if (!res || !res.ok) {
        throw new Error('No se pudieron cargar las transacciones');
      }
      var data = await res.json();
      var transactions = Array.isArray(data.transactions) ? data.transactions : [];

      tbody.innerHTML = '';

      if (transactions.length === 0) {
        if (emptyState) emptyState.style.display = '';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

transactions.forEach(function (t) {
        var tr = document.createElement('tr');
        var dateStr = t.date ? new Date(t.date).toLocaleDateString('es-AR') : '-';
        var statusLabel = t.status === 'completed' ? 'Completada' : (t.status || 'Pendiente');
        var statusClass = t.status === 'completed' ? 'status-completed' : 'status-pending';
        var rawId = String(t.id || '');
        var txId = rawId;
        var isManual = rawId.startsWith('V-');
        if (isManual) txId = rawId.slice(2);

        tr.innerHTML =
          '<td>' + escapeAttr(txId) + '</td>' +
          '<td>' + escapeAttr(dateStr) + '</td>' +
          '<td>' + escapeAttr(t.customer || '-') + '</td>' +
          '<td style="text-align:center;"><span class="' + escapeAttr(statusClass) + '">' + escapeAttr(statusLabel) + '</span></td>' +
          '<td style="text-align:right;">$' + Number(t.total || 0).toLocaleString('es-AR') + '</td>' +
          '<td style="text-align:center;">' +
            '<button type="button" class="btn-delete-tx" data-tx-id="' + escapeAttr(rawId) + '" data-tx-type="' + (isManual ? 'manual' : 'order') + '" title="Eliminar transacción" style="background:none;border:none;color:#94a3b8;cursor:pointer;padding:0.3rem;border-radius:6px;">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
            '</button>' +
          '</td>';

        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-delete-tx').forEach(function (btn) {
        btn.addEventListener('mouseenter', function () {
          btn.style.color = '#dc2626';
          btn.style.background = '#fee2e2';
        });
        btn.addEventListener('mouseleave', function () {
          btn.style.color = '#94a3b8';
          btn.style.background = 'none';
        });
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var txId = btn.getAttribute('data-tx-id');
          var txType = btn.getAttribute('data-tx-type');
          deleteTransaction(txId, txType);
        });
      });
    } catch (err) {
      console.error('[Sales] Error cargando transacciones:', err);
    }
  }

  function deleteTransaction(txId, txType) {
    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    var cancelBtn = document.getElementById('cancelConfirmBtn');
    if (modal) {
      if (msg) msg.textContent = '¿Eliminar esta transacción (' + txId + ')? Esta acción no se puede deshacer.';
      if (actionBtn) {
        actionBtn.textContent = 'Eliminar';
        actionBtn.className = 'btn btn-danger';
        actionBtn.onclick = async function () {
          if (modal) modal.classList.remove('active');
          await processDeleteTransaction(txId, txType);
        };
      }
      if (cancelBtn) {
        cancelBtn.onclick = function () {
          if (modal) modal.classList.remove('active');
        };
      }
      modal.classList.add('active');
    }
  }

  async function processDeleteTransaction(txId, txType) {
    var numericId = txId.replace(/^V-/, '');
    var url = txType === 'manual'
      ? '/api/admin/sales/' + numericId
      : '/api/admin/orders/' + numericId;

    try {
      var res = await window.adminFetch(url, { method: 'DELETE' });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error eliminando transacción');
      }
      window.showToast('✅', 'Transacción eliminada', 'success');
      await loadTransactions();
      await loadSalesSummary(currentView);
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sync', { detail: { event: 'transactions_updated' } }));
      }
    } catch (err) {
      window.showToast('❌', err.message || 'Error eliminando transacción', 'error');
    }
  }

  /* ===== RENDER KPIs ===== */

  function renderKPIs(kpis) {
    var kpiRevenue = document.getElementById('metricRevenue');
    var kpiNet = document.getElementById('metricNetRevenue');
    var kpiOrders = document.getElementById('metricOrders');
    var kpiAvg = document.getElementById('metricAvg');

    var gross = Number(kpis.total_revenue || 0);
    if (kpiRevenue) kpiRevenue.textContent = '$' + gross.toLocaleString('es-AR');
    if (kpiNet) kpiNet.textContent = '$' + gross.toLocaleString('es-AR');
    if (kpiOrders) kpiOrders.textContent = Number(kpis.total_orders || 0).toLocaleString('es-AR');
    if (kpiAvg) kpiAvg.textContent = '$' + Number(kpis.avg_order_value || 0).toLocaleString('es-AR');
  }

  /* ===== RANGE TOGGLE ===== */

  function renderRangeToggle(view) {
    var rangeSelect = document.getElementById('sales_range');
    if (rangeSelect) {
      rangeSelect.value = view;
    }
  }

  /* ===== CHART.JS ===== */

  function updateChart(data) {
    var groups = Array.isArray(data.groups) ? data.groups : [];
    var labels = groups.map(function (g) { return g.label || g.date || ''; });
    var revenue = groups.map(function (g) { return Number(g.total || 0); });
    var orders = groups.map(function (g) { return Number(g.count || 0); });
    var viewLabel = currentView === 'monthly'
      ? 'Ingresos mensuales'
      : currentView === '6months'
        ? 'Ingresos por mes'
        : 'Ingresos semanales';

    /* Bar chart (principal) */
    var ctx = document.getElementById('salesChart');
    if (ctx) {
      if (salesChart) salesChart.destroy();

      salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: viewLabel,
              data: revenue,
              backgroundColor: 'rgba(228, 160, 181, 0.85)',
              borderColor: 'rgba(158, 74, 96, 1)',
              borderWidth: 1,
              borderRadius: 6,
              barThickness: 32,
              yAxisID: 'y'
            },
            {
              label: 'Órdenes',
              data: orders,
              type: 'line',
              backgroundColor: 'rgba(212, 112, 144, 0.2)',
              borderColor: 'rgba(158, 74, 96, 1)',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: 'rgba(212, 112, 144, 1)',
              fill: true,
              tension: 0.3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { font: { size: 11 }, usePointStyle: true }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  var label = context.dataset.label || '';
                  if (label) label += ': ';
                  if (context.dataset.type === 'line') {
                    label += context.parsed.y + ' órdenes';
                  } else {
                    label += '$' + Number(context.parsed.y).toLocaleString('es-AR');
                  }
                  return label;
                }
              }
            }
          },
          scales: {
            y: {
              type: 'linear',
              position: 'left',
              ticks: {
                callback: function (v) { return '$' + Number(v).toLocaleString('es-AR'); },
                font: { size: 10 }
              },
              grid: { drawBorder: false },
              beginAtZero: true
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawBorder: false },
              ticks: {
                callback: function (v) { return Number(v).toLocaleString('es-AR'); },
                font: { size: 10 }
              },
              beginAtZero: true
            }
          }
        }
      });
    }

    /* Donut chart (categorías) */
    renderDonut(data);
  }

  function renderDonut(data) {
    var donutCtx = document.getElementById('salesDonut');
    if (!donutCtx) return;

    if (salesDonut) salesDonut.destroy();

    var categoryData = buildCategoryBreakdown(data);
    if (!categoryData.labels.length) {
      donutCtx.parentNode.style.display = 'none';
      return;
    }
    donutCtx.parentNode.style.display = 'block';

    salesDonut = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: categoryData.labels,
        datasets: [{
          data: categoryData.values,
          backgroundColor: [
            'rgba(228, 160, 181, 0.85)',
            'rgba(212, 112, 144, 0.85)',
            'rgba(158, 74, 96, 0.85)',
            'rgba(255, 178, 200, 0.85)',
            'rgba(229, 183, 204, 0.85)'
          ],
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 10 }, padding: 8 }
          }
        }
      }
    });
  }

  function buildCategoryBreakdown(data) {
    /* Si el backend provee category_breakdown, usarlo; si no, vacío */
    var breakdown = (data && data.category_breakdown) ? data.category_breakdown : null;
    if (breakdown && typeof breakdown === 'object') {
      var labels = Object.keys(breakdown);
      var values = labels.map(function (k) { return Number(breakdown[k] || 0); });
      return { labels: labels, values: values };
    }
    return { labels: [], values: [] };
  }

  /* ===== PRODUCTOS PARA VENTA MANUAL ===== */

  function renderSaleProductOptions() {
    var select = document.getElementById('sale_product_id');
    if (!select) return;

    var options = productsForSale
      .filter(function (p) { return p.active && !p.deleted; })
      .map(function (p) {
        return '<option value="' + p.id + '" data-price="' + (p.price || 0) + '">' +
          escapeAttr(p.name) + ' — $' + Number(p.price || 0).toLocaleString('es-AR') +
        '</option>';
      });

    select.innerHTML = '<option value="">Seleccionar producto...</option>' + options.join('');
  }

  /* ===== VENTA MANUAL ===== */

  function attachManualSaleHandlers() {
    var productSelect = document.getElementById('sale_product_id');
    var quantityInput = document.getElementById('sale_quantity');
    var unitPriceEl = document.getElementById('sale_unit_price');
    var totalEl = document.getElementById('sale_total');
    var form = document.getElementById('manualSaleForm');

    function updateTotals() {
      var selected = productSelect?.options[productSelect?.selectedIndex || 0];
      var unitPrice = selected ? parseFloat(selected.getAttribute('data-price') || '0') : 0;
      var qty = parseInt(quantityInput?.value || '0', 10);
      var total = unitPrice * qty;

      if (unitPriceEl) unitPriceEl.value = unitPrice > 0 ? '$' + unitPrice.toLocaleString('es-AR') : '';
      if (totalEl) totalEl.value = total > 0 ? '$' + total.toLocaleString('es-AR') : '';
    }

    productSelect?.addEventListener('change', updateTotals);
    quantityInput?.addEventListener('input', updateTotals);

    form?.addEventListener('submit', async function (e) {
      e.preventDefault();
      await submitManualSale();
    });
  }

  async function submitManualSale() {
    var productId = document.getElementById('sale_product_id')?.value;
    var quantity = parseInt(document.getElementById('sale_quantity')?.value || '0', 10);

    if (!productId) {
      window.showToast('❌', 'Seleccioná un producto.', 'error');
      return;
    }
    if (!quantity || quantity <= 0) {
      window.showToast('❌', 'La cantidad debe ser mayor a 0.', 'error');
      document.getElementById('sale_quantity')?.focus();
      return;
    }

    var btn = document.getElementById('saveSaleBtn');
    var btnText = document.getElementById('saveSaleBtnText');
    var btnLoading = document.getElementById('saveSaleBtnLoading');

    if (btn) btn.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnLoading) btnLoading.classList.remove('hidden');

    try {
      var res = await window.adminFetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: parseInt(productId, 10),
          quantity: quantity
        })
      });

      if (!res || !res.ok) {
        var errMsg = 'Error al registrar la venta.';
        if (res) {
          var errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      window.showToast('✅', 'Venta registrada correctamente.', 'success');

      var form = document.getElementById('manualSaleForm');
      if (form) form.reset();

      var unitPriceEl = document.getElementById('sale_unit_price');
      var totalEl = document.getElementById('sale_total');
      if (unitPriceEl) unitPriceEl.value = '';
      if (totalEl) totalEl.value = '';

      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sync', { detail: { event: 'sales_updated' } }));
      }

      await loadSalesSummary(currentView);
    } catch (err) {
      console.error('[Sales] Error registrando venta:', err);
      window.showToast('❌', err.message || 'Error al registrar la venta.', 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) {
        btnText.classList.remove('hidden');
        btnText.textContent = 'Guardar venta';
      }
      if (btnLoading) btnLoading.classList.add('hidden');
    }
  }

  function openResetModal() {
    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    var cancelBtn = document.getElementById('cancelConfirmBtn');
    if (modal) {
      if (msg) msg.textContent = '¿Estás seguro? Se eliminarán todos los datos de ventas actuales para empezar de cero. Esta acción no se puede deshacer';
      if (actionBtn) {
        actionBtn.textContent = 'Sí, reiniciar';
        actionBtn.className = 'btn btn-danger';
        actionBtn.onclick = async function () {
          if (modal) modal.classList.remove('active');
          await confirmReset();
        };
      }
      if (cancelBtn) {
        cancelBtn.onclick = function () {
          if (modal) modal.classList.remove('active');
        };
      }
      modal.classList.add('active');
    }
  }

  async function confirmReset() {
    var btn = document.getElementById('resetMetricsBtn');
    var btnText = document.getElementById('resetMetricsBtnText');
    var btnLoading = document.getElementById('resetMetricsBtnLoading');

    if (btn) btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.classList.remove('hidden');

    try {
      var res = await window.adminFetch('/api/admin/reports/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error al reiniciar las métricas.');
      }
      window.showToast('✅', 'Métricas reiniciadas correctamente.', 'success');
      await loadSalesSummary(currentView);
      await loadTransactions();
    } catch (err) {
      console.error('[Sales] Error reiniciando métricas:', err);
      window.showToast('❌', err.message || 'Error al reiniciar las métricas.', 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.style.display = '';
      if (btnLoading) btnLoading.classList.add('hidden');
    }
  }

  /* ===== HELPERS GLOBALES ===== */

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/[&'"<>]/g, function (c) {
      var m = { '&': '&amp;', '"': '&quot;', '\'': '&#39;', '<': '&lt;', '>': '&gt;' };
      return m[c] || c;
    });
  }

  /* ===== INIT ===== */

  function initSalesPanel() {
    var rangeSelect = document.getElementById('sales_range');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', function () {
        var val = rangeSelect.value || 'weekly';
        loadSalesSummary(val);
      });
    }

    var syncBtn = document.getElementById('syncSalesBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        loadSalesSummary(currentView);
      });
    }

    var resetBtn = document.getElementById('resetMetricsBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        openResetModal();
      });
    }

    var resetSalesBtn = document.getElementById('resetSalesBtn');
    if (resetSalesBtn) {
      resetSalesBtn.addEventListener('click', function () {
        openResetModal();
      });
    }

    var confirmOverlay = document.getElementById('confirmModalOverlay');
    if (confirmOverlay) {
      confirmOverlay.addEventListener('click', function (e) {
        if (e.target === confirmOverlay) {
          confirmOverlay.classList.remove('active');
        }
      });
    }

    attachManualSaleHandlers();

    Promise.all([
      loadSalesSummary('weekly'),
      loadProductsForSale(),
      loadTransactions()
    ]);
  }

  /* EXPORTS for admin-sync.js */
  window.initSalesPanel = initSalesPanel;
  window.reloadSales = function () {
    return loadSalesSummary(currentView);
  };
})();
