/* ==================== ADMIN SALES.JS ==================== */
/* Métricas de ganancias, ventas manuales y sincronización */

(function () {
  'use strict';

  var salesChart = null;
  var salesDonut = null;
  var currentRange = 'weekly';
  var currentCategory = '';
  var currentPage = 1;
  var syncing = false;
  var earningsCache = null;

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
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
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

  function getRangeDates(range) {
    var end = new Date();
    var start = new Date();
    if (range === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (range === 'monthly') {
      start.setMonth(end.getMonth() - 1);
    } else if (range === '6months') {
      start.setMonth(end.getMonth() - 6);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  async function fetchEarnings() {
    var rangeSelect = document.getElementById('sales_range');
    currentRange = rangeSelect ? rangeSelect.value : 'weekly';

    var catSelect = document.getElementById('sales_category_filter');
    if (catSelect) currentCategory = catSelect.value;

    var dates = getRangeDates(currentRange);
    var startDate = dates.start;
    var endDate = dates.end;

    if (currentRange === 'custom') {
      var customStart = document.getElementById('sales_start_date');
      var customEnd = document.getElementById('sales_end_date');
      if (customStart && customStart.value) startDate = customStart.value;
      if (customEnd && customEnd.value) endDate = customEnd.value;
    }

    var params = new URLSearchParams();
    params.set('start_date', startDate);
    params.set('end_date', endDate);
    if (currentCategory) params.set('category', currentCategory);
    params.set('page', String(currentPage));
    params.set('limit', '15');

    var prevParams = new URLSearchParams();
    var prevDates = getPreviousRangeDates(currentRange);
    prevParams.set('start_date', prevDates.start);
    prevParams.set('end_date', prevDates.end);
    if (currentCategory) prevParams.set('category', currentCategory);

    var res = await window.adminFetch('/api/admin/earnings?' + params.toString(), { method: 'GET' });
    if (!res || !res.ok) throw new Error('Error cargando métricas');
    var data = await res.json();

    var prevRes = await window.adminFetch('/api/admin/earnings?' + prevParams.toString(), { method: 'GET' });
    var prevData = { kpis: {} };
    if (prevRes && prevRes.ok) {
      prevData = await prevRes.json();
    }

    earningsCache = data;
    renderEarnings(data, prevData);
  }

  function getPreviousRangeDates(range) {
    var end = new Date();
    var start = new Date();
    if (range === 'weekly') {
      end.setDate(end.getDate() - 7);
      start.setDate(end.getDate() - 7);
    } else if (range === 'monthly') {
      end.setMonth(end.getMonth() - 1);
      start.setMonth(end.getMonth() - 1);
      start.setDate(start.getDate() - 30);
    } else if (range === '6months') {
      end.setMonth(end.getMonth() - 6);
      start.setMonth(end.getMonth() - 12);
    } else {
      end = new Date(new Date().setDate(end.getDate() - 1));
      start = new Date(new Date().setDate(start.getDate() - 2));
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  function renderEarnings(data, prevData) {
    renderMetrics(data.kpis, prevData ? prevData.kpis : null);
    renderLineChart(data.chart);
    renderDonut(data.categories);
    renderTransactions(data.transactions, data.pagination);
  }

  function renderMetrics(kpis, prevKpis) {
    var elRevenue = document.getElementById('metricRevenue');
    var elNet = document.getElementById('metricNetRevenue');
    var elOrders = document.getElementById('metricOrders');
    var elAvg = document.getElementById('metricAvg');

    var revenue = kpis.totalRevenue || 0;
    var prevRevenue = prevKpis ? (prevKpis.totalRevenue || 0) : 0;
    var netRevenue = revenue - (revenue * 0.21);
    var orders = kpis.totalOrders || 0;
    var prevOrders = prevKpis ? (prevKpis.totalOrders || 0) : 0;
    var avg = kpis.avgOrderValue || 0;
    var prevAvg = prevKpis ? (prevKpis.avgOrderValue || 0) : 0;

    if (elRevenue) {
      elRevenue.textContent = formatCurrency(revenue);
      elRevenue.style.color = '';
    }
    if (elNet) {
      elNet.textContent = formatCurrency(netRevenue);
      elNet.style.color = '';
    }
    if (elOrders) {
      elOrders.textContent = orders;
      elOrders.style.color = '';
    }
    if (elAvg) {
      elAvg.textContent = formatCurrency(avg);
      elAvg.style.color = '';
    }

    if (prevKpis) {
      if (elRevenue && prevRevenue > 0) {
        var revVar = ((revenue - prevRevenue) / prevRevenue) * 100;
        elRevenue.style.color = revVar >= 0 ? '#16a34a' : '#dc2626';
      }
      if (elOrders && prevOrders > 0) {
        var ordVar = ((orders - prevOrders) / prevOrders) * 100;
        elOrders.style.color = ordVar >= 0 ? '#16a34a' : '#dc2626';
      }
      if (elAvg && prevAvg > 0) {
        var avgVar = ((avg - prevAvg) / prevAvg) * 100;
        elAvg.style.color = avgVar >= 0 ? '#16a34a' : '#dc2626';
      }
    }
  }

  function renderLineChart(chartData) {
    var ctx = document.getElementById('salesChart');
    if (!ctx) return;

    if (salesChart) {
      salesChart.destroy();
      salesChart = null;
    }

    var labels = [];
    var dataPoints = [];
    var byMonth = {};
    chartData.forEach(function (item) {
      byMonth[item.month] = Number(item.total || 0);
    });

    var sortedMonths = Object.keys(byMonth).sort();
    sortedMonths.forEach(function (m) {
      labels.push(m.substring(5));
      dataPoints.push(byMonth[m]);
    });

    if (!labels.length) {
      labels.push('Sin datos');
      dataPoints.push(0);
    }

    salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ganancias',
          data: dataPoints,
          borderColor: 'rgba(212, 112, 144, 1)',
          backgroundColor: 'rgba(212, 112, 144, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(212, 112, 144, 1)'
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
            ticks: {
              callback: function (val) { return '$' + val; }
            }
          }
        }
      }
    });
  }

  function renderDonut(categories) {
    var ctx = document.getElementById('salesDonut');
    if (!ctx) return;

    if (salesDonut) {
      salesDonut.destroy();
      salesDonut = null;
    }

    if (!categories || !categories.length) {
      categories = [{ name: 'Sin datos', slug: 'none', total: 0 }];
    }

    var labels = categories.map(function (c) { return c.name; });
    var data = categories.map(function (c) { return Number(c.total || 0); });
    var colors = [
      'rgba(212, 112, 144, 0.8)',
      'rgba(244, 162, 97, 0.8)',
      'rgba(42, 157, 143, 0.8)',
      'rgba(233, 196, 106, 0.8)',
      'rgba(38, 70, 83, 0.8)',
      'rgba(155, 89, 182, 0.8)'
    ];

    salesDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 8,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  function renderTransactions(transactions, pagination) {
    var tbody = document.getElementById('transactionsTableBody');
    var empty = document.getElementById('transactionsEmptyState');
    var container = document.getElementById('transactionsTableContainer');
    if (!tbody) return;

    if (!transactions || !transactions.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    transactions.forEach(function (tx) {
      var statusClass = 'badge-status--pending';
      var statusText = 'Pendiente';
      if (tx.status === 'delivered' || tx.status === 'completed') {
        statusClass = 'badge-status--completed';
        statusText = 'Completado';
      } else if (tx.status === 'cancelled' || tx.status === 'cancelado') {
        statusClass = 'badge-status--cancelled';
        statusText = 'Cancelado';
      } else if (tx.status === 'pending') {
        statusClass = 'badge-status--pending';
        statusText = 'Pendiente';
      } else if (tx.status === 'confirmed' || tx.status === 'preparing' || tx.status === 'shipped') {
        statusClass = 'badge-status--processing';
        statusText = 'Procesando';
      }

      html += '<tr data-id="' + tx.id + '" style="cursor:pointer;" onclick="window.openTransactionDetail(\'' + tx.id + '\', \'' + tx.type + '\')">' +
        '<td>' + escapeHtml(String(tx.id)) + '</td>' +
        '<td>' + escapeHtml((tx.date || '').substring(0, 10)) + '</td>' +
        '<td>' + escapeHtml(tx.customer || '-') + '</td>' +
        '<td style="text-align:center;"><span class="badge ' + statusClass + '">' + escapeHtml(statusText) + '</span></td>' +
        '<td style="text-align:right;">' + formatCurrency(tx.total || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;

    var pagEl = document.getElementById('transactionsPagination');
    if (pagEl && pagination) {
      var totalPages = Math.max(pagination.pages || 1, 1);
      var page = pagination.page || 1;
      var btnHtml = '';
      btnHtml += '<button class="btn btn-secondary btn-sm" ' + (page <= 1 ? 'disabled' : '') + ' onclick="window.goToTransactionPage(' + (page - 1) + ')">Anterior</button>';
      btnHtml += '<span style="margin:0 0.75rem;font-size:0.85rem;">Página ' + page + ' de ' + totalPages + '</span>';
      btnHtml += '<button class="btn btn-secondary btn-sm" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="window.goToTransactionPage(' + (page + 1) + ')">Siguiente</button>';
      pagEl.innerHTML = btnHtml;
    }
  }

  window.openTransactionDetail = async function (id, type) {
    var overlay = document.getElementById('transactionDetailOverlay');
    var content = document.getElementById('transactionDetailContent');
    var title = document.getElementById('transactionDetailTitle');
    if (!overlay || !content) return;

    if (title) title.textContent = 'Detalle de ' + (type === 'order' ? 'Pedido' : 'Venta') + ' #' + id;
    content.innerHTML = '<p style="text-align:center;padding:2rem;">Cargando...</p>';
    overlay.classList.add('active');

    try {
      var url = type === 'order' ? '/api/admin/orders/' + id : '/api/admin/sales/' + id;
      var res = await window.adminFetch(url, { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando detalle');
      var data = await res.json();

      if (type === 'order') {
        var items = data.items || [];
        var html = '<div class="transaction-detail">' +
          '<p><strong>Cliente:</strong> ' + escapeHtml(data.shipping_name || '-') + '</p>' +
          '<p><strong>Email:</strong> ' + escapeHtml(data.shipping_email || '-') + '</p>' +
          '<p><strong>Teléfono:</strong> ' + escapeHtml(data.shipping_phone || '-') + '</p>' +
          '<p><strong>Dirección:</strong> ' + escapeHtml((data.shipping_address || '') + ' ' + (data.shipping_city || '') + ' ' + (data.shipping_zip || '')) + '</p>' +
          '<p><strong>Estado:</strong> ' + escapeHtml(data.status || '-') + '</p>' +
          '<p><strong>Método de pago:</strong> ' + escapeHtml(data.payment_method || '-') + '</p>' +
          '<p><strong>Subtotal:</strong> ' + formatCurrency(data.subtotal || 0) + '</p>' +
          '<p><strong>Envío:</strong> ' + formatCurrency(data.shipping_cost || 0) + '</p>' +
          '<p><strong>Total:</strong> ' + formatCurrency(data.total || 0) + '</p>' +
          '<hr style="margin:1rem 0;border-color:#e2e8f0;" />' +
          '<h4 style="margin-bottom:0.5rem;">Productos</h4>' +
          '<table style="width:100%;font-size:0.9rem;">' +
            '<thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">Subtotal</th></tr></thead>' +
            '<tbody>';

        (items || []).forEach(function (item) {
          var subtotal = Number(item.price || 0) * Number(item.quantity || 0);
          html += '<tr>' +
            '<td>' + escapeHtml(item.name || 'Producto') + '</td>' +
            '<td style="text-align:center;">' + Number(item.quantity || 0) + '</td>' +
            '<td style="text-align:right;">' + formatCurrency(item.price || 0) + '</td>' +
            '<td style="text-align:right;">' + formatCurrency(subtotal) + '</td>' +
          '</tr>';
        });

        html += '</tbody></table></div>';
        content.innerHTML = html;
      } else {
        content.innerHTML = '<div class="transaction-detail">' +
          '<p><strong>Producto:</strong> ' + escapeHtml(data.product_name || '-') + '</p>' +
          '<p><strong>Cantidad:</strong> ' + Number(data.quantity || 0) + '</p>' +
          '<p><strong>Precio unitario:</strong> ' + formatCurrency(data.unit_price || 0) + '</p>' +
          '<p><strong>Total:</strong> ' + formatCurrency(data.total || 0) + '</p>' +
          '<p><strong>Fecha:</strong> ' + escapeHtml((data.sale_date || data.created_at || '').substring(0, 10)) + '</p>' +
        '</div>';
      }
    } catch (err) {
      content.innerHTML = '<p style="text-align:center;color:#dc2626;">Error cargando detalle: ' + escapeHtml(err.message) + '</p>';
    }
  };

  window.closeTransactionDetail = function () {
    var overlay = document.getElementById('transactionDetailOverlay');
    if (overlay) overlay.classList.remove('active');
  };

  window.goToTransactionPage = function (page) {
    currentPage = page;
    fetchEarnings();
  };

  async function loadSalesSummary() {
    currentPage = 1;
    await fetchEarnings();
  }

  async function syncSales() {
    if (syncing) return;
    syncing = true;
    var btn = document.getElementById('syncSalesBtn');
    if (btn) btn.disabled = true;

    try {
      await loadSalesSummary();
      showToast('✅', 'Métricas actualizadas', 'success');
    } catch (err) {
      showToast('❌', 'Error al sincronizar', 'error');
    } finally {
      syncing = false;
      if (btn) btn.disabled = false;
    }
  }

  async function loadProductOptions() {
    try {
      var res = await window.adminFetch('/api/admin/products?limit=100&active=true', { method: 'GET' });
      if (!res || !res.ok) return;
      var data = await res.json();
      var select = document.getElementById('sale_product_id');
      if (!select) return;
      var current = select.value;
      var opts = '<option value="">Seleccionar producto...</option>';
      (data.products || []).forEach(function (p) {
        opts += '<option value="' + p.id + '" data-price="' + p.price + '">' + escapeHtml(p.name) + ' (' + formatCurrency(p.price) + ')</option>';
      });
      select.innerHTML = opts;
      if (current) select.value = current;
    } catch (err) {
      console.error('[Sales] Error cargando productos para venta:', err);
    }
  }

  async function loadCategoryFilter() {
    try {
      var res = await window.adminFetch('/api/admin/categories', { method: 'GET' });
      if (!res || !res.ok) return;
      var data = await res.json();
      var select = document.getElementById('sales_category_filter');
      if (!select) return;
      var current = select.value;
      var opts = '<option value="">Todas las categorías</option>';
      data.forEach(function (c) {
        opts += '<option value="' + escapeHtml(c.slug) + '">' + escapeHtml(c.name) + '</option>';
      });
      select.innerHTML = opts;
      if (current) select.value = current;
    } catch (err) {
      console.error('[Sales] Error cargando categorías:', err);
    }
  }

  function initSalesPanel() {
    loadSalesSummary();
    loadProductOptions();
    loadCategoryFilter();

    var rangeSelect = document.getElementById('sales_range');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', function () {
        var customDiv = document.getElementById('customDateRange');
        if (customDiv) {
          customDiv.style.display = this.value === 'custom' ? 'flex' : 'none';
        }
        loadSalesSummary();
      });
    }

    var syncBtn = document.getElementById('syncSalesBtn');
    if (syncBtn) syncBtn.addEventListener('click', syncSales);

    var saleForm = document.getElementById('manualSaleForm');
    if (saleForm) {
      saleForm.addEventListener('input', function () {
        if (window.markDirty) window.markDirty('sales');
      });
      saleForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var productId = document.getElementById('sale_product_id').value;
        var qty = Number(document.getElementById('sale_quantity').value);
        if (!productId || !qty) {
          showToast('❌', 'Seleccioná producto y cantidad', 'error');
          return;
        }
        var btn = document.getElementById('saveSaleBtn');
        setLoading('saveSaleBtn', 'saveSaleBtnLoading', true, 'Guardar venta', 'Guardando...');
        try {
          var res = await window.adminFetch('/api/admin/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: Number(productId), quantity: qty })
          });
          if (!res || !res.ok) {
            var data = await res.json().catch(function () { return {}; });
            throw new Error(data.error || 'Error guardando venta');
          }
          showToast('✅', 'Venta registrada', 'success');
          saleForm.reset();
          loadSalesSummary();
        } catch (err) {
          showToast('❌', err.message || 'Error al guardar venta', 'error');
        } finally {
          setLoading('saveSaleBtn', 'saveSaleBtnLoading', false, 'Guardar venta', 'Guardando...');
        }
      });
    }

    var productSelect = document.getElementById('sale_product_id');
    if (productSelect) {
      productSelect.addEventListener('change', function () {
        var opt = this.options[this.selectedIndex];
        var price = opt ? opt.getAttribute('data-price') : '';
        document.getElementById('sale_unit_price').value = price ? formatCurrency(Number(price)) : '';
        var qty = Number(document.getElementById('sale_quantity').value) || 0;
        document.getElementById('sale_total').value = price && qty ? formatCurrency(Number(price) * qty) : '';
      });
    }

    var qtyInput = document.getElementById('sale_quantity');
    if (qtyInput) {
      qtyInput.addEventListener('input', function () {
        var opt = productSelect ? productSelect.options[productSelect.selectedIndex] : null;
        var price = opt ? opt.getAttribute('data-price') : '';
        var qty = Number(this.value) || 0;
        document.getElementById('sale_total').value = price && qty ? formatCurrency(Number(price) * qty) : '';
      });
    }

    var closeDetailBtn = document.getElementById('closeTransactionDetail');
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener('click', window.closeTransactionDetail);
    }

    var detailOverlay = document.getElementById('transactionDetailOverlay');
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (e) {
        if (e.target === detailOverlay) window.closeTransactionDetail();
      });
    }
  }

  window.initSalesPanel = initSalesPanel;
  window.loadSalesSummary = loadSalesSummary;
  window.syncSales = syncSales;
  window.reloadSales = loadSalesSummary;
})();
