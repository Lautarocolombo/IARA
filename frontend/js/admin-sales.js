/* ==================== ADMIN SALES.JS ==================== */
/* Métricas de ganancias, ventas manuales y sincronización */

(function () {
  'use strict';

  var salesChart = null;
  var currentRange = 'weekly';
  var currentCategory = '';
  var syncing = false;

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

  function getRangeDates(range) {
    var end = new Date();
    var start = new Date();
    if (range === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (range === 'monthly') {
      start.setMonth(end.getMonth() - 1);
    } else if (range === 'annual') {
      start.setFullYear(end.getFullYear() - 1);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
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
    } else if (range === 'annual') {
      end.setFullYear(end.getFullYear() - 1);
      start.setFullYear(end.getFullYear() - 1);
      start.setMonth(start.getMonth() - 12);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  async function fetchSales(start, end, category) {
    var params = new URLSearchParams();
    params.set('start_date', start);
    params.set('end_date', end);
    if (category) params.set('category', category);
    params.set('limit', '1000');
    var res = await window.adminFetch('/api/admin/sales?' + params.toString(), { method: 'GET' });
    if (!res || !res.ok) throw new Error('Error cargando ventas');
    var data = await res.json();
    return data.sales || [];
  }

  async function loadSalesSummary() {
    var rangeSelect = document.querySelector('input[name="sales_view"]:checked');
    currentRange = rangeSelect ? rangeSelect.value : 'weekly';

    var catSelect = document.getElementById('sales_category_filter');
    if (catSelect) currentCategory = catSelect.value;

    var dates = getRangeDates(currentRange);
    var prevDates = getPreviousRangeDates(currentRange);

    try {
      var [sales, prevSales] = await Promise.all([
        fetchSales(dates.start, dates.end, currentCategory),
        fetchSales(prevDates.start, prevDates.end, currentCategory)
      ]);

      renderMetrics(sales, prevSales);
      renderChart(sales, dates);
      renderTopProducts(sales);
    } catch (err) {
      console.error('[Sales] Error:', err);
      showToast('❌', err.message || 'Error al cargar métricas', 'error');
    }
  }

  function renderMetrics(sales, prevSales) {
    var total = sales.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
    var count = sales.length;
    var avg = count > 0 ? total / count : 0;

    var prevTotal = prevSales.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
    var variation = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

    var topProduct = null;
    var byProduct = {};
    sales.forEach(function (s) {
      var key = s.product_id || s.product_name;
      if (!byProduct[key]) byProduct[key] = { name: s.product_name || 'Desconocido', qty: 0, total: 0 };
      byProduct[key].qty += Number(s.quantity || 0);
      byProduct[key].total += Number(s.total || 0);
    });
    var maxQty = 0;
    Object.keys(byProduct).forEach(function (k) {
      if (byProduct[k].qty > maxQty) {
        maxQty = byProduct[k].qty;
        topProduct = byProduct[k];
      }
    });

    document.getElementById('metricTotal').textContent = formatCurrency(total);
    document.getElementById('metricCount').textContent = count;
    document.getElementById('metricAvg').textContent = formatCurrency(avg);
    document.getElementById('metricTopProduct').textContent = topProduct ? topProduct.name : '-';
    document.getElementById('metricVariation').textContent = (variation >= 0 ? '+' : '') + variation.toFixed(1) + '%';
    document.getElementById('metricVariation').style.color = variation >= 0 ? '#16a34a' : '#dc2626';
    document.getElementById('metricVariationIcon').textContent = variation >= 0 ? '↑' : '↓';
  }

  function renderChart(sales, dates) {
    var ctx = document.getElementById('salesChart');
    if (!ctx) return;

    if (salesChart) {
      salesChart.destroy();
      salesChart = null;
    }

    var labels = [];
    var dataPoints = [];
    var byDate = {};

    sales.forEach(function (s) {
      var d = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at).toISOString().split('T')[0] : 'N/A';
      byDate[d] = (byDate[d] || 0) + Number(s.total || 0);
    });

    var start = new Date(dates.start);
    var end = new Date(dates.end);
    var cursor = new Date(start);
    while (cursor <= end) {
      var key = cursor.toISOString().split('T')[0];
      labels.push(key.substring(5));
      dataPoints.push(byDate[key] || 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Facturación',
          data: dataPoints,
          backgroundColor: 'rgba(212, 112, 144, 0.2)',
          borderColor: 'rgba(212, 112, 144, 1)',
          borderWidth: 1,
          borderRadius: 4
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

  function renderTopProducts(sales) {
    var tbody = document.getElementById('topProductsTableBody');
    if (!tbody) return;

    var byProduct = {};
    sales.forEach(function (s) {
      var key = s.product_id;
      if (!byProduct[key]) byProduct[key] = { name: s.product_name || 'Desconocido', qty: 0, total: 0 };
      byProduct[key].qty += Number(s.quantity || 0);
      byProduct[key].total += Number(s.total || 0);
    });

    var sorted = Object.keys(byProduct).map(function (k) { return { id: k, name: byProduct[k].name, qty: byProduct[k].qty, total: byProduct[k].total }; });
    sorted.sort(function (a, b) { return b.total - a.total; });
    var top5 = sorted.slice(0, 5);

    var html = '';
    top5.forEach(function (p) {
      html += '<tr>' +
        '<td>' + escapeHtml(p.name) + '</td>' +
        '<td style="text-align:center;">' + p.qty + '</td>' +
        '<td style="text-align:right;">' + formatCurrency(p.total) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="3" style="text-align:center;color:#64748b;">Sin datos</td></tr>';
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function syncSales() {
    if (syncing) return;
    syncing = true;
    var btn = document.getElementById('syncSalesBtn');
    if (btn) btn.disabled = true;

    try {
      await loadSalesSummary();
      showToast('✅', 'Métricas sincronizadas', 'success');
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

    var rangeRadios = document.querySelectorAll('input[name="sales_view"]');
    rangeRadios.forEach(function (r) {
      r.addEventListener('change', loadSalesSummary);
    });

    var catFilter = document.getElementById('sales_category_filter');
    if (catFilter) {
      catFilter.addEventListener('change', loadSalesSummary);
    }

    var syncBtn = document.getElementById('syncSalesBtn');
    if (syncBtn) syncBtn.addEventListener('click', syncSales);

    var saleForm = document.getElementById('manualSaleForm');
    if (saleForm) {
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
  }

  window.initSalesPanel = initSalesPanel;
})();
