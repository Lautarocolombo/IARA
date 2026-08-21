/* ==================== ADMIN ORDERS.JS ==================== */
/* Vista de detalle drill-down por pedido para Artesanía Admin */

(function () {
  'use strict';

  var selectedOrderId = null;
  var ordersList = [];
  var paymentConfig = {};
  var currentReceipt = null;
  var whatsappChecked = false;
  var debounceTimer = null;

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

  function formatCurrency(value) {
    return '$' + Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setLoading(btnId, loadingId, loading, defaultText, loadingText) {
    var btn = document.getElementById(btnId);
    var load = document.getElementById(loadingId);
    if (btn) btn.disabled = loading;
    var textSpan = load ? load.previousElementSibling : null;
    if (textSpan && textSpan.id === btnId + 'Text') {
      textSpan.textContent = loading ? (loadingText || 'Procesando...') : (defaultText || 'Guardar');
      textSpan.classList.toggle('hidden', loading);
    }
    if (load) load.classList.toggle('hidden', !loading);
  }

  function getStatusLabel(status) {
    var map = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      preparing: 'Preparando Envío',
      shipped: 'Enviado',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    };
    return map[status] || status;
  }

  function getCustomerName(order) {
    var customer = typeof order.customer === 'string' ? JSON.parse(order.customer) : (order.customer || {});
    return escapeHtml(customer.name || order.shipping_name || 'Sin nombre');
  }

  function isPaymentValidated(order) {
    var validStatuses = ['confirmed', 'preparing', 'shipped', 'delivered'];
    return validStatuses.includes(order.status);
  }

  function hasReceipt(orderId) {
    return !!currentReceipt && currentReceipt.order_id === orderId;
  }

  function isShippingComplete(order) {
    return !!(order.shipping_name && order.shipping_address && order.shipping_email && order.shipping_phone && order.shipping_city && order.shipping_zip);
  }

  function wizardStepState(step, order) {
    var validated = isPaymentValidated(order);
    var hasComp = hasReceipt(order.id);
    var shipOk = isShippingComplete(order);

    if (step === 1) return { status: 'completed', label: 'Completado' };
    if (step === 2) {
      if (whatsappChecked || shipOk) return { status: 'completed', label: 'Completado' };
      return { status: 'pending', label: 'Pendiente' };
    }
    if (step === 3) {
      if (validated || hasComp) return { status: 'completed', label: 'Completado' };
      return { status: validated ? 'completed' : (hasComp ? 'in-progress' : 'pending'), label: validated ? 'Completado' : (hasComp ? 'En curso' : 'Pendiente') };
    }
    if (step === 4) {
      if (validated && (shipOk || whatsappChecked)) return { status: 'completed', label: 'Completado' };
      if (whatsappChecked && !shipOk) return { status: 'blocked', label: 'Bloqueado' };
      if (validated && !shipOk && !whatsappChecked) return { status: 'pending', label: 'Pendiente' };
      return { status: 'pending', label: 'Pendiente' };
    }
    return { status: 'pending', label: 'Pendiente' };
  }

  function renderWizard(order) {
    var steps = document.querySelectorAll('.wizard-step');
    steps.forEach(function (el) {
      var stepNum = Number(el.getAttribute('data-step'));
      var state = wizardStepState(stepNum, order);
      var iconEl = el.querySelector('.wizard-step-icon');
      var labelEl = el.querySelector('.wizard-step-label');

      el.classList.remove('wizard-completed', 'wizard-inprogress', 'wizard-pending', 'wizard-blocked');
      if (state.status === 'completed') {
        el.classList.add('wizard-completed');
        if (iconEl) iconEl.textContent = '✓';
      } else if (state.status === 'in-progress') {
        el.classList.add('wizard-inprogress');
        if (iconEl) iconEl.textContent = '⏳';
      } else if (state.status === 'blocked') {
        el.classList.add('wizard-blocked');
        if (iconEl) iconEl.textContent = '🔒';
      } else {
        el.classList.add('wizard-pending');
        if (iconEl) iconEl.textContent = '...';
      }
      if (labelEl) {
        var base = labelEl.getAttribute('data-base') || labelEl.textContent;
        labelEl.textContent = base + ' - ' + state.label;
      }
    });
  }

  async function fetchOrders(query) {
    try {
      var q = (query || '').trim();
      var params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('limit', '100');
      var res = await window.adminFetch('/api/admin/orders?' + params.toString(), { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando pedidos');
      var data = await res.json();
      return data.orders || [];
    } catch (err) {
      showToast('❌', err.message || 'Error al cargar pedidos', 'error');
      return [];
    }
  }

  async function fetchOrderDetail(id) {
    try {
      var res = await window.adminFetch('/api/admin/orders/' + id, { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando detalle');
      var data = await res.json();
      return data;
    } catch (err) {
      showToast('❌', err.message || 'Error al cargar detalle del pedido', 'error');
      return null;
    }
  }

  async function fetchPaymentConfig() {
    try {
      var res = await window.adminFetch('/api/admin/payment-config', { method: 'GET' });
      if (!res || !res.ok) return {};
      var data = await res.json();
      return data || {};
    } catch (err) {
      return {};
    }
  }

  async function fetchReceipt(orderId) {
    try {
      var res = await window.adminFetch('/api/admin/orders/' + orderId + '/receipt', { method: 'GET' });
      if (!res || !res.ok) return null;
      var data = await res.json();
      return data;
    } catch (err) {
      return null;
    }
  }

  async function fetchActivities(orderId) {
    try {
      var res = await window.adminFetch('/api/admin/orders/' + orderId + '/activity', { method: 'GET' });
      if (!res || !res.ok) return [];
      var data = await res.json();
      return data.activities || [];
    } catch (err) {
      return [];
    }
  }

  async function postActivity(orderId, action, details) {
    try {
      var res = await window.adminFetch('/api/admin/orders/' + orderId + '/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, details: details || '' })
      });
      if (!res || !res.ok) throw new Error('Error registrando actividad');
      return true;
    } catch (err) {
      showToast('❌', err.message || 'Error registrando actividad', 'error');
      return false;
    }
  }

   function getOrderItemsSummary(order) {
    var items = [];
    try { items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []); } catch (e) { items = []; }
    if (!items.length) return '<span style="color:#94a3b8;font-size:0.8rem;">Sin productos</span>';

    var totalQty = 0;
    var names = [];
    items.forEach(function (item) {
      var qty = Number(item.quantity || 1);
      totalQty += qty;
      var name = item.name || item.title || 'Producto';
      if (names.length < 2) names.push(name);
    });

    var result = names.join(', ');
    if (items.length > 2) result += ' + ' + (items.length - 2) + ' más';
    return '<span title="' + escapeHtml(result) + '" style="font-size:0.8rem;color:#334155;">' +
      escapeHtml(result) +
      (items.length > 1 ? ' <span style="color:#94a3b8;font-size:0.75rem;">(' + totalQty + ' u.)</span>' : '') +
      '</span>';
  }

  function renderOrdersList(orders) {
    var tbody = document.getElementById('ordersTableBody');
    var empty = document.getElementById('ordersEmptyState');
    if (!tbody) return;

    if (!orders.length) {
      selectedOrderId = null;
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      resetOrderDetail();
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    orders.forEach(function (order) {
      var validated = isPaymentValidated(order);
      var selected = order.id === selectedOrderId;
      var name = getCustomerName(order);
      var status = getStatusLabel(order.status);
      html += '<tr class="' + (selected ? 'order-selected' : '') + '" data-order-id="' + order.id + '" style="cursor:pointer;">' +
        '<td><span class="order-status-dot ' + (validated ? 'validated' : 'pending') + '" title="' + (validated ? 'Pago validado' : 'Pendiente de validación') + '"></span></td>' +
        '<td>#' + order.id + '</td>' +
        '<td>' + name + '</td>' +
        '<td><span class="status-badge status-' + order.status + '">' + status + '</span></td>' +
        '<td>' + getOrderItemsSummary(order) + '</td>' +
        '<td style="text-align:right;white-space:nowrap;">' +
          '<button class="btn-delete-order" data-order-id="' + order.id + '" title="Eliminar pedido" style="background:none;border:none;color:#94a3b8;cursor:pointer;padding:0.3rem;border-radius:6px;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          '</button>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll('tr').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.btn-delete-order')) return;
        var id = Number(row.getAttribute('data-order-id'));
        selectOrder(id);
      });
    });

    tbody.querySelectorAll('.btn-delete-order').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = Number(btn.getAttribute('data-order-id'));
        deleteOrder(id);
      });
      btn.addEventListener('mouseenter', function () {
        btn.style.color = '#dc2626';
        btn.style.background = '#fee2e2';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.color = '#94a3b8';
        btn.style.background = 'none';
      });
    });
  }

  function resetOrderDetail() {
    var detailEmpty = document.getElementById('orderDetailEmpty');
    var detailContent = document.getElementById('orderDetailContent');
    if (detailEmpty) detailEmpty.style.display = 'block';
    if (detailContent) detailContent.style.display = 'none';

    var wizardEmpty = document.getElementById('orderWizardEmpty');
    var wizardContent = document.getElementById('orderWizardContent');
    if (wizardEmpty) wizardEmpty.style.display = 'block';
    if (wizardContent) wizardContent.style.display = 'none';

    var infoEmpty = document.getElementById('orderInfoEmpty');
    var infoContent = document.getElementById('orderInfoContent');
    if (infoEmpty) infoEmpty.style.display = 'block';
    if (infoContent) infoContent.style.display = 'none';

    var itemsEmpty = document.getElementById('orderItemsEmpty');
    var itemsContent = document.getElementById('orderItemsContent');
    if (itemsEmpty) itemsEmpty.style.display = 'block';
    if (itemsContent) itemsContent.style.display = 'none';

    var activityEmpty = document.getElementById('activityEmpty');
    var activityContent = document.getElementById('activityContent');
    if (activityEmpty) activityEmpty.style.display = 'block';
    if (activityContent) activityContent.style.display = 'none';
  }

  async function selectOrder(id) {
    selectedOrderId = id;
    renderOrdersList(ordersList);

    var order = await fetchOrderDetail(id);
    if (!order) return;

    currentReceipt = await fetchReceipt(id);
    whatsappChecked = !isShippingComplete(order) && (!order.shipping_name && !order.shipping_email);

    document.getElementById('orderDetailEmpty').style.display = 'none';
    document.getElementById('orderDetailContent').style.display = 'block';
    document.getElementById('orderWizardEmpty').style.display = 'none';
    document.getElementById('orderWizardContent').style.display = 'block';
    document.getElementById('orderInfoEmpty').style.display = 'none';
    document.getElementById('orderInfoContent').style.display = 'block';

    renderWizard(order);
    renderPaymentDetails(order);
    renderShippingInfo(order);
    renderOrderItems(order);
    renderActivityLog(id);
    updateOrderActions(order);
  }

  function renderOrderItems(order) {
    var tbody = document.getElementById('orderItemsTableBody');
    var totalEl = document.getElementById('orderItemsTotal');
    var emptyEl = document.getElementById('orderItemsEmpty');
    var contentEl = document.getElementById('orderItemsContent');
    if (!tbody || !contentEl) return;

    tbody.innerHTML = '';

    var items = [];
    try { items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []); } catch (e) { items = []; }

    var grandTotal = 0;

    items.forEach(function (item) {
      var price = Number(item.price || item.unit_price || 0);
      var qty = Number(item.quantity || 1);
      var subtotal = price * qty;
      grandTotal += subtotal;

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(item.name || item.title || 'Producto') +
          (item.variation ? ' (' + escapeHtml(item.variation) + ')' : '') + '</td>' +
        '<td style="text-align:center;">' + qty + '</td>' +
        '<td style="text-align:right;">' + formatCurrency(price) + '</td>' +
        '<td style="text-align:right;">' + formatCurrency(subtotal) + '</td>';
      tbody.appendChild(tr);
    });

    if (items.length === 0) {
      emptyEl.style.display = 'block';
      contentEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    var orderTotal = Number(order.total || grandTotal);
    if (totalEl) totalEl.textContent = formatCurrency(orderTotal);
  }

  function renderPaymentDetails(order) {
    var alias = paymentConfig.mp_alias || '—';
    var holder = paymentConfig.holder_name || '—';
    var mpEnabled = !!paymentConfig.mp_enabled;

    var aliasEl = document.getElementById('mpAliasDisplay');
    if (aliasEl) {
      if (mpEnabled && alias && alias !== '—') {
        aliasEl.innerHTML = escapeHtml(alias) + ' <span class="badge badge-success">Validado</span>';
      } else {
        aliasEl.textContent = alias;
      }
    }

    var holderNameDisplay = document.getElementById('holderNameDisplay');
    var orderTotalDisplay = document.getElementById('orderTotalDisplay');
    if (holderNameDisplay) holderNameDisplay.textContent = holder;
    if (orderTotalDisplay) orderTotalDisplay.textContent = formatCurrency(order.total);

    var qrContainer = document.getElementById('qrCodeDisplay');
    qrContainer.innerHTML = '';
    try {
      if (typeof QRCode !== 'undefined' && alias && alias !== '—') {
        QRCode.toDataURL(alias, { width: 180, margin: 1 }, function (err, url) {
          if (err) {
            qrContainer.textContent = alias;
            return;
          }
          var img = document.createElement('img');
          img.src = url;
          img.alt = 'QR Alias MP';
          img.style.border = '1px solid var(--border)';
          img.style.borderRadius = '8px';
          qrContainer.appendChild(img);
        });
      } else if (alias && alias !== '—') {
        qrContainer.textContent = alias;
      } else {
        qrContainer.textContent = 'Sin alias configurado';
      }
    } catch (e) {
      qrContainer.textContent = alias && alias !== '—' ? alias : 'Sin alias configurado';
    }

    if (currentReceipt && currentReceipt.url) {
      document.getElementById('viewReceiptBtn').classList.remove('hidden');
      document.getElementById('viewReceiptBtn').onclick = function () {
        window.open(currentReceipt.url, '_blank');
      };
    } else {
      document.getElementById('viewReceiptBtn').classList.add('hidden');
    }

    document.getElementById('trackingLink').href = 'orders.html?order_id=' + order.id;
  }

  function renderShippingInfo(order) {
    var fields = {
      shipping_name: document.getElementById('shipName'),
      shipping_phone: document.getElementById('shipPhone'),
      shipping_email: document.getElementById('shipEmail'),
      shipping_address: document.getElementById('shipAddress'),
      shipping_city: document.getElementById('shipCity'),
      shipping_zip: document.getElementById('shipZip')
    };

    var empty = isShippingComplete(order);
    whatsappChecked = !empty;

    var check = document.getElementById('whatsappCompleteCheck');
    if (check) {
      check.checked = whatsappChecked;
      check.disabled = empty;
    }

    Object.keys(fields).forEach(function (key) {
      var input = fields[key];
      if (!input) return;
      var value = order[key] || '';
      if (whatsappChecked) {
        input.value = '';
        input.placeholder = 'Pendiente por WhatsApp';
        input.disabled = true;
      } else {
        input.value = value;
        input.placeholder = '';
        input.disabled = false;
      }
    });

    var saveBtn = document.getElementById('saveShippingBtn');
    if (saveBtn) saveBtn.style.display = whatsappChecked ? 'none' : 'inline-flex';
  }

  function renderActivityLog(orderId) {
    var timeline = document.getElementById('activityTimeline');
    var empty = document.getElementById('activityEmpty');
    var content = document.getElementById('activityContent');
    if (!timeline) return;

    var items = document.querySelectorAll('.activity-item');
    items.forEach(function (el) { el.remove(); });

    fetchActivities(orderId).then(function (acts) {
      if (!acts.length) {
        if (empty) empty.style.display = 'block';
        if (content) content.style.display = 'none';
        return;
      }
      if (empty) empty.style.display = 'none';
      if (content) content.style.display = 'block';

      acts.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });

      var html = '';
      acts.forEach(function (act) {
        var date = new Date(act.created_at).toLocaleString('es-AR');
        html += '<div class="activity-item">' +
          '<div class="activity-marker"></div>' +
          '<div class="activity-body">' +
            '<div class="activity-title">' + escapeHtml(act.action) + '</div>' +
            '<div class="activity-desc">' + escapeHtml(act.details || '') + '</div>' +
            '<div class="activity-date">' + escapeHtml(date) + '</div>' +
          '</div>' +
        '</div>';
      });
      timeline.innerHTML = html;
    });
  }

  async function updateOrderActions(order) {
    var approveBtn = document.getElementById('approvePaymentBtn');
    var rejectBtn = document.getElementById('rejectPaymentBtn');
    if (!approveBtn || !rejectBtn) return;

    var blocked = whatsappChecked && !isShippingComplete(order);
    if (blocked) {
      approveBtn.disabled = true;
      approveBtn.title = 'Completá los datos de envío antes de aprobar';
    } else {
      approveBtn.disabled = isPaymentValidated(order);
      approveBtn.title = isPaymentValidated(order) ? 'Pago ya validado' : '';
    }
    rejectBtn.disabled = order.status === 'cancelled';
  }

  async function saveShippingInfo() {
    if (!selectedOrderId) return;

    var fields = {
      shipping_name: document.getElementById('shipName'),
      shipping_phone: document.getElementById('shipPhone'),
      shipping_email: document.getElementById('shipEmail'),
      shipping_address: document.getElementById('shipAddress'),
      shipping_city: document.getElementById('shipCity'),
      shipping_zip: document.getElementById('shipZip')
    };

    var payload = {};
    Object.keys(fields).forEach(function (key) {
      var input = fields[key];
      payload[key] = input ? input.value : '';
    });

    setLoading('saveShippingBtn', 'saveShippingBtnLoading', true, 'Guardar', 'Guardando...');

    try {
      var res = await window.adminFetch('/api/admin/orders/' + selectedOrderId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error guardando datos');
      }
      showToast('✅', 'Datos de envío actualizados', 'success');
      var order = await fetchOrderDetail(selectedOrderId);
      if (order) renderShippingInfo(order);
    } catch (err) {
      showToast('❌', err.message || 'Error guardando datos', 'error');
    } finally {
      setLoading('saveShippingBtn', 'saveShippingBtnLoading', false, 'Guardar', 'Guardando...');
    }
  }

  async function approvePayment() {
    if (!selectedOrderId) return;
    var order = await fetchOrderDetail(selectedOrderId);
    if (!order) return;
    if (whatsappChecked && !isShippingComplete(order)) {
      showToast('⚠️', 'Completá los datos de envío antes de aprobar el pago', 'error');
      return;
    }
    if (isPaymentValidated(order)) {
      showToast('ℹ️', 'El pago ya está validado', 'success');
      return;
    }

    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    if (modal) {
      if (msg) msg.textContent = '¿Confirmás la aprobación del pago del pedido #' + selectedOrderId + '?';
      if (actionBtn) {
        actionBtn.textContent = 'Aprobar';
        actionBtn.className = 'btn btn-success';
        actionBtn.onclick = async function () {
          if (modal) modal.classList.add('hidden');
          await processApprove(selectedOrderId);
        };
      }
      modal.classList.remove('hidden');
    }
  }

  async function processApprove(id) {
    var approveBtn = document.getElementById('approvePaymentBtn');
    var rejectBtn = document.getElementById('rejectPaymentBtn');
    if (approveBtn) approveBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;

    try {
      var res = await window.adminFetch('/api/admin/orders/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error aprobando pago');
      }
      await postActivity(id, 'Payment Approved by Admin', 'Pago aprobado por el administrador');
      showToast('✅', 'Pago aprobado correctamente', 'success');
      var order = await fetchOrderDetail(id);
      if (order) {
        currentReceipt = await fetchReceipt(id);
        renderWizard(order);
        renderPaymentDetails(order);
        updateOrderActions(order);
      }
    } catch (err) {
      showToast('❌', err.message || 'Error aprobando pago', 'error');
    } finally {
      if (approveBtn) approveBtn.disabled = false;
      if (rejectBtn) rejectBtn.disabled = false;
    }
  }

  async function rejectPayment() {
    if (!selectedOrderId) return;
    var reason = prompt('Motivo del rechazo (opcional):');
    if (reason === null) return;

    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    if (modal) {
      if (msg) msg.textContent = '¿Confirmás el rechazo del pago del pedido #' + selectedOrderId + '?';
      if (actionBtn) {
        actionBtn.textContent = 'Rechazar';
        actionBtn.className = 'btn btn-danger';
        actionBtn.onclick = async function () {
          if (modal) modal.classList.add('hidden');
          await processReject(selectedOrderId, reason || '');
        };
      }
      modal.classList.remove('hidden');
    }
  }

  async function processReject(id, reason) {
    var approveBtn = document.getElementById('approvePaymentBtn');
    var rejectBtn = document.getElementById('rejectPaymentBtn');
    if (approveBtn) approveBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;

    try {
      var res = await window.adminFetch('/api/admin/orders/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' })
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error rechazando pago');
      }
      await postActivity(id, 'Payment Rejected by Admin', 'Pago rechazado. Motivo: ' + (reason || 'No especificado'));
      showToast('✅', 'Pago rechazado. El pedido volvió a pendiente.', 'success');
      var order = await fetchOrderDetail(id);
      if (order) {
        currentReceipt = await fetchReceipt(id);
        renderWizard(order);
        renderPaymentDetails(order);
        updateOrderActions(order);
      }
    } catch (err) {
      showToast('❌', err.message || 'Error rechazando pago', 'error');
    } finally {
      if (approveBtn) approveBtn.disabled = false;
      if (rejectBtn) rejectBtn.disabled = false;
    }
  }

  async function deleteOrder(id) {
    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    if (modal) {
      if (msg) msg.textContent = '¿Eliminar este pedido #' + id + '? Esta acción no se puede deshacer.';
      if (actionBtn) {
        actionBtn.textContent = 'Eliminar';
        actionBtn.className = 'btn btn-danger';
        actionBtn.onclick = async function () {
          if (modal) modal.classList.add('hidden');
          await processDeleteOrder(id);
        };
      }
      modal.classList.remove('hidden');
    }
  }

  async function processDeleteOrder(id) {
    try {
      var res = await window.adminFetch('/api/admin/orders/' + id, { method: 'DELETE' });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error eliminando pedido');
      }
      showToast('✅', 'Pedido eliminado correctamente', 'success');
      if (selectedOrderId === id) {
        selectedOrderId = null;
        document.getElementById('orderWizardEmpty').style.display = '';
        document.getElementById('orderWizardContent').style.display = 'none';
        document.getElementById('orderInfoEmpty').style.display = '';
        document.getElementById('orderInfoContent').style.display = 'none';
      }
      ordersList = ordersList.filter(function (o) { return o.id !== id; });
      renderOrdersList(ordersList);
      if (window.reloadSales) window.reloadSales();
    } catch (err) {
      showToast('❌', err.message || 'Error eliminando pedido', 'error');
    }
  }

  async function batchDeleteOrders(status) {
    var label = status === 'cancelled' ? 'cancelados' : 'pendientes';
    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    if (modal) {
      if (msg) msg.textContent = '¿Eliminar todos los pedidos ' + label + '? Esta acción no se puede deshacer.';
      if (actionBtn) {
        actionBtn.textContent = 'Eliminar ' + label;
        actionBtn.className = 'btn btn-danger';
        actionBtn.onclick = async function () {
          if (modal) modal.classList.add('hidden');
          await processBatchDelete(status);
        };
      }
      modal.classList.remove('hidden');
    }
  }

  async function processBatchDelete(status) {
    try {
      var res = await window.adminFetch('/api/admin/orders/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error eliminando pedidos en lote');
      }
      var result = await res.json();
      showToast('✅', result.deleted + ' pedidos eliminados', 'success');
      await loadOrders();
      if (window.reloadSales) window.reloadSales();
    } catch (err) {
      showToast('❌', err.message || 'Error eliminando pedidos en lote', 'error');
    }
  }

  function bindEvents() {
    var searchInput = document.getElementById('orderSearch');
    var statusFilter = document.getElementById('orderStatusFilter');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          loadOrders();
        }, 250);
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', function () {
        loadOrders();
      });
    }

    var approveBtn = document.getElementById('approvePaymentBtn');
    if (approveBtn) approveBtn.addEventListener('click', approvePayment);

    var rejectBtn = document.getElementById('rejectPaymentBtn');
    if (rejectBtn) rejectBtn.addEventListener('click', rejectPayment);

    var uploadBtn = document.getElementById('uploadReceiptBtn');
    var fileInput = document.getElementById('receiptFileInput');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        if (!fileInput.files || !fileInput.files[0] || !selectedOrderId) return;
        uploadReceipt(fileInput.files[0]);
      });
    }

    var guideLink = document.getElementById('receiptGuideLink');
    if (guideLink) {
      guideLink.addEventListener('click', function (e) {
        e.preventDefault();
        showReceiptGuide();
      });
    }

    var saveShippingBtn = document.getElementById('saveShippingBtn');
    if (saveShippingBtn) saveShippingBtn.addEventListener('click', saveShippingInfo);

    var batchDeleteCancelledBtn = document.getElementById('batchDeleteCancelledBtn');
    if (batchDeleteCancelledBtn) {
      batchDeleteCancelledBtn.addEventListener('click', function () {
        batchDeleteOrders('cancelled');
      });
    }

    var batchDeletePendingBtn = document.getElementById('batchDeletePendingBtn');
    if (batchDeletePendingBtn) {
      batchDeletePendingBtn.addEventListener('click', function () {
        batchDeleteOrders('pending');
      });
    }

    var shipInputs = document.querySelectorAll('#shipName, #shipPhone, #shipEmail, #shipAddress, #shipCity, #shipZip');
    shipInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        if (window.markDirty) window.markDirty('orders');
      });
    });

    var whatsappCheck = document.getElementById('whatsappCompleteCheck');
    if (whatsappCheck) {
      whatsappCheck.addEventListener('change', function () {
        if (!selectedOrderId) return;
        if (whatsappCheck.disabled) return;
        if (whatsappCheck.checked) {
          whatsappChecked = true;
        } else {
          whatsappChecked = false;
        }
        var order = ordersList.find(function (o) { return o.id === selectedOrderId; }) || null;
        if (!order) return;
        fetchOrderDetail(selectedOrderId).then(function (o) {
          if (!o) return;
          renderShippingInfo(o);
          renderWizard(o);
          updateOrderActions(o);
        });
      });
    }

    var cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    if (cancelConfirmBtn) {
      cancelConfirmBtn.onclick = function () {
        var modal = document.getElementById('confirmModalOverlay');
        if (modal) modal.classList.add('hidden');
      };
    }
  }

  async function uploadReceipt(file) {
    if (!selectedOrderId) return;
    var formData = new FormData();
    formData.append('file', file);
    try {
      var res = await window.adminFetch('/api/admin/orders/' + selectedOrderId + '/receipt', {
        method: 'POST',
        body: formData
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error subiendo comprobante');
      }
      showToast('✅', 'Comprobante subido correctamente', 'success');
      currentReceipt = await fetchReceipt(selectedOrderId);
      var order = await fetchOrderDetail(selectedOrderId);
      if (order) {
        renderPaymentDetails(order);
        renderWizard(order);
        updateOrderActions(order);
      }
    } catch (err) {
      showToast('❌', err.message || 'Error subiendo comprobante', 'error');
    }
  }

  function showReceiptGuide() {
    var modal = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');
    if (modal) {
      if (msg) msg.innerHTML = '<strong>Cómo generar el comprobante desde tu banco:</strong><br>1) Ingresá a la app de tu banco.<br>2) Buscá la transferencia realizada a <strong>' + escapeHtml(paymentConfig.mp_alias || 'el alias configurado') + '</strong>.<br>3) Descargá o capturá el comprobante de la operación.<br>4) Subilo acá con el botón "Subir Comprobante".';
      if (actionBtn) {
        actionBtn.textContent = 'Entendido';
        actionBtn.className = 'btn btn-primary';
        actionBtn.onclick = function () {
          if (modal) modal.classList.add('hidden');
          if (msg) msg.textContent = '¿Estás seguro?';
        };
      }
      modal.classList.remove('hidden');
    }
  }

  async function loadOrders() {
    var search = document.getElementById('orderSearch');
    var status = document.getElementById('orderStatusFilter');
    var q = search ? search.value : '';
    var s = status ? status.value : '';
    ordersList = await fetchOrders(q);
    if (s) {
      ordersList = ordersList.filter(function (o) { return o.status === s; });
    }
    ordersList.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    renderOrdersList(ordersList);
  }

  async function initOrdersPanel() {
    paymentConfig = await fetchPaymentConfig();
    bindEvents();
    await loadOrders();
    resetOrderDetail();

    var saveCloudBtn = document.getElementById('saveOrdersCloudBtn');
    if (saveCloudBtn) {
      saveCloudBtn.addEventListener('click', function () {
        if (window.saveAllOrdersChanges) window.saveAllOrdersChanges();
      });
    }
  }

  window.initOrdersPanel = initOrdersPanel;
  window.loadOrders = loadOrders;
  window.saveAllOrdersChanges = async function () {
    await window.saveToCloud('orders', {
      btnId: 'saveOrdersCloudBtn',
      loadingId: 'saveOrdersCloudBtnLoading',
      action: async function () {
        await loadOrders();
      }
    });
  };
})();
