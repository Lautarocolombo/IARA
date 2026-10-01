(function () {
  'use strict';

  var state = { page: 1, limit: 10, q: '', role: '', active: '' };
  var currentEditingId = null;

  function safeToast(icon, message, type) {
    if (typeof window.showToast === 'function') { window.showToast(icon, message, type); return; }
    // eslint-disable-next-line no-console
    if (type === 'error') console.error('[admin-users]', message);
    // eslint-disable-next-line no-console
    else console.log('[admin-users]', message);
  }

  function ensureHelpers() {
    if (typeof window.showLoading !== 'function') {
      window.showLoading = function (el, opts) { if (el) el.innerHTML = '<p>' + ((opts && opts.label) || 'Cargando...') + '</p>'; };
    }
    if (typeof window.hideLoading !== 'function') {
      window.hideLoading = function (el) { if (el) el.innerHTML = ''; };
    }
    if (typeof window.renderEmptyState !== 'function') {
      window.renderEmptyState = function (opts) {
        var c = opts && opts.container;
        if (!c) return;
        var div = document.createElement('div');
        div.className = 'admin-page-empty';
        div.innerHTML = '<h3>' + (opts.title || 'Sin datos') + '</h3><p>' + (opts.message || '') + '</p>';
        if (opts.action && opts.action.label) {
          var btn = document.createElement('button');
          btn.className = opts.action.className || 'btn btn-primary btn-sm';
          btn.textContent = opts.action.label;
          btn.addEventListener('click', opts.action.onClick);
          div.appendChild(btn);
        }
        c.appendChild(div);
      };
    }
    if (typeof window.renderPagination !== 'function') {
      window.renderPagination = function (opts) {
        var c = opts && opts.container;
        if (!c) return;
        c.innerHTML = '';
        var page = Number(opts.page || 1);
        var total = Number(opts.totalPages || 1);
        if (total <= 1) return;
        for (var i = 1; i <= total; i++) {
          (function (p) {
            var b = document.createElement('button');
            b.className = 'btn btn-sm' + (p === page ? ' btn-primary' : ' btn-secondary');
            b.textContent = String(p);
            b.addEventListener('click', function () { opts.onChange(p); });
            c.appendChild(b);
          })(i);
        }
      };
    }
    if (typeof window.initSearchBar !== 'function') {
      window.initSearchBar = function (opts) {
        var container = opts && opts.container;
        if (!container) return null;
        var input = container.querySelector('input[type="search"], input');
        if (!input) return null;
        var timer = null;
        input.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { opts.onSearch(input.value); }, opts.debounce || 300);
        });
        return { search: function () { opts.onSearch(''); input.value = ''; } };
      };
    }
    if (typeof window.openModal !== 'function' || typeof window.closeModal !== 'function') {
      window.openModal = window.openModal || function (opts) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = '<div class="modal modal--md"><div class="modal-header"><h3>' + (opts.title || '') + '</h3></div><div class="modal-body"></div><div class="modal-footer"></div></div>';
        var body = overlay.querySelector('.modal-body');
        if (opts.content instanceof Node) body.appendChild(opts.content);
        else body.innerHTML = opts.content || '';
        var footer = overlay.querySelector('.modal-footer');
        (opts.actions || []).forEach(function (a) {
          var b = document.createElement('button');
          b.className = a.className || 'btn btn-secondary';
          b.textContent = a.label || 'Aceptar';
          b.addEventListener('click', function () {
            if (a.onClick) a.onClick();
            if (a.close !== false && document.body.contains(overlay)) document.body.removeChild(overlay);
          });
          footer.appendChild(b);
        });
        document.body.appendChild(overlay);
        window._fallbackModal = overlay;
        return overlay;
      };
      window.closeModal = window.closeModal || function () {
        if (window._fallbackModal && document.body.contains(window._fallbackModal)) document.body.removeChild(window._fallbackModal);
      };
    }
    if (!window.ConfirmDialog) {
      window.ConfirmDialog = { ask: function (opts) { return Promise.resolve(window.confirm((opts && opts.title ? opts.title + '\n' : '') + (opts && opts.message ? opts.message : '¿Confirmar?'))); } };
    }
    if (typeof window.showToast !== 'function') window.showToast = safeToast;
  }
  ensureHelpers();

  function apiUsers(_query) {
    var params = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
    if (state.q) params.set('q', state.q);
    if (state.role) params.set('role', state.role);
    if (state.active !== '') params.set('active', state.active);
    return window.adminPageFetch('/api/users?' + params.toString());
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-AR');
  }

  function appendCell(row, value, className) {
    var cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
    row.appendChild(cell);
  }

  function renderUsers(data) {
    var body = document.getElementById('usersTableBody');
    var root = document.getElementById('usersRoot');
    var empty = document.getElementById('usersEmpty');
    var table = document.getElementById('usersTable');
    var pagination = document.getElementById('usersPagination');
    if (!body) return;
    body.innerHTML = '';
    var users = data && Array.isArray(data.users) ? data.users : [];
    if (!users.length) {
      if (table) table.style.display = 'none';
      if (empty) empty.style.display = '';
      if (root) {
        window.renderEmptyState({
          container: root,
          icon: '⌕',
          title: 'No se encontraron usuarios',
          message: 'Probá cambiar los filtros o creá un nuevo usuario.',
          action: { label: 'Crear usuario', className: 'btn btn-primary btn-sm', onClick: openUserModal }
        });
      }
    } else {
      if (table) table.style.display = '';
      if (empty) empty.style.display = 'none';
      users.forEach(function (user) {
        var row = document.createElement('tr');
        appendCell(row, user.id);
        appendCell(row, user.username);
        appendCell(row, user.email);
        var role = document.createElement('td');
        var roleBadge = document.createElement('span');
        roleBadge.className = 'admin-page-badge';
        roleBadge.textContent = user.role || 'viewer';
        role.appendChild(roleBadge);
        row.appendChild(role);
        var active = document.createElement('td');
        var activeBadge = document.createElement('span');
        activeBadge.className = 'admin-page-badge ' + (user.active ? 'is-active' : 'is-inactive');
        activeBadge.textContent = user.active ? 'Activo' : 'Inactivo';
        active.appendChild(activeBadge);
        row.appendChild(active);
        appendCell(row, formatDate(user.created_at));
        var actions = document.createElement('td');
        actions.className = 'admin-page-table-actions';
        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'btn btn-secondary btn-sm';
        edit.textContent = 'Editar';
        edit.addEventListener('click', function () { openUserModal(user); });
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-danger btn-sm';
        remove.textContent = 'Eliminar';
        remove.addEventListener('click', function () { removeUser(user); });
        actions.appendChild(edit);
        actions.appendChild(remove);
        row.appendChild(actions);
        body.appendChild(row);
      });
    }
    if (pagination) {
      window.renderPagination({
        container: pagination,
        page: Number(data.page || state.page),
        totalPages: Number(data.pages || 1),
        onChange: function (page) { state.page = page; loadUsers(); }
      });
    }
  }

  function setLoading(loading) {
    if (loading) window.showLoading(document.getElementById('usersLoading'), { label: 'Cargando usuarios...' });
    else window.hideLoading(document.getElementById('usersLoading'));
  }

  function loadUsers() {
    var root = document.getElementById('usersRoot');
    if (!root) return;
    setLoading(true);
    apiUsers().then(function (data) {
      renderUsers(data);
    }).catch(function (err) {
      window.renderEmptyState({
        container: root,
        icon: '!',
        title: 'No se pudieron cargar los usuarios',
        message: err.message || 'Intentá nuevamente más tarde.',
        action: { label: 'Reintentar', className: 'btn btn-primary btn-sm', onClick: loadUsers }
      });
      window.showToast('!', err.message || 'Error al cargar usuarios', 'error');
    }).finally(function () { setLoading(false); });
  }

  function openUserModal(user) {
    currentEditingId = user && user.id ? Number(user.id) : null;
    var form = document.createElement('form');
    form.className = 'admin-form-grid';
    [
      ['userUsername', 'Usuario', 'text', 'Nombre de usuario', !currentEditingId],
      ['userPassword', 'Contraseña', 'password', currentEditingId ? 'Dejar en blanco para no cambiarla' : 'Mínimo 6 caracteres', true],
      ['userEmail', 'Email', 'email', 'Opcional', true],
      ['userRole', 'Rol', 'select', 'Permisos de acceso', true]
    ].forEach(function (field) {
      var id = field[0];
      var label = field[1];
      var type = field[2];
      var help = field[3];
      var required = field[4];
      var group = document.createElement('div');
      group.className = 'admin-form-group';
      var labelEl = document.createElement('label');
      labelEl.htmlFor = id;
      labelEl.textContent = label + (required && id !== 'userPassword' ? ' *' : '');
      var input;
      if (type === 'select') {
        input = document.createElement('select');
        ['admin', 'editor', 'viewer'].forEach(function (role) {
          var option = document.createElement('option');
          option.value = role;
          option.textContent = role;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = type;
      }
      input.id = id;
      input.name = id;
      if (required && id !== 'userPassword') input.required = true;
      if (id === 'userPassword' && !currentEditingId) input.required = true;
      if (id === 'userPassword') input.minLength = 6;
      var helpEl = document.createElement('span');
      helpEl.className = 'admin-form-help';
      helpEl.textContent = help;
      group.appendChild(labelEl);
      group.appendChild(input);
      group.appendChild(helpEl);
      form.appendChild(group);
    });
    var roleSelect = form.querySelector('#userRole');
    var emailInput = form.querySelector('#userEmail');
    if (user) {
      form.querySelector('#userUsername').value = user.username || '';
      emailInput.value = user.email || '';
      roleSelect.value = user.role || 'viewer';
    }
    window.openModal({
      title: currentEditingId ? 'Editar usuario' : 'Crear usuario',
      content: form,
      size: 'md',
      actions: [
        { label: 'Cancelar', className: 'btn btn-secondary', close: true },
        { label: currentEditingId ? 'Guardar cambios' : 'Crear usuario', className: 'btn btn-primary', onClick: function () { saveUser(form); } }
      ]
    });
  }

  function saveUser(form) {
    var username = form.querySelector('#userUsername').value.trim();
    var password = form.querySelector('#userPassword').value;
    var email = form.querySelector('#userEmail').value.trim();
    var role = form.querySelector('#userRole').value;
    if (!username || (!currentEditingId && !password) || !role) {
      window.showToast('!', 'Completá los campos obligatorios', 'error');
      return;
    }
    var payload = { username: username, email: email, role: role };
    if (password) payload.password = password;
    var request = currentEditingId
      ? window.adminPageFetch('/api/users/' + currentEditingId, { method: 'PUT', body: JSON.stringify(payload) })
      : window.adminPageFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
    request.then(function () {
      window.closeModal();
      window.showToast('✓', currentEditingId ? 'Usuario actualizado' : 'Usuario creado', 'success');
      loadUsers();
    }).catch(function (err) {
      window.showToast('!', err.message || 'No se pudo guardar el usuario', 'error');
    });
  }

  function removeUser(user) {
    window.ConfirmDialog.ask({
      title: 'Eliminar usuario',
      message: '¿Eliminar a ' + (user.username || 'este usuario') + '? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar'
    }).then(function (confirmed) {
      if (!confirmed) return;
      window.adminPageFetch('/api/users/' + user.id, { method: 'DELETE' }).then(function () {
        window.showToast('✓', 'Usuario eliminado', 'success');
        loadUsers();
      }).catch(function (err) {
        window.showToast('!', err.message || 'No se pudo eliminar el usuario', 'error');
      });
    });
  }

  function init() {
    var search = window.initSearchBar({
      container: document.getElementById('usersSearch'),
      debounce: 300,
      onSearch: function (value) { state.q = value; state.page = 1; loadUsers(); }
    });
    var role = document.getElementById('usersRoleFilter');
    var active = document.getElementById('usersActiveFilter');
    var reset = document.getElementById('usersResetFilters');
    if (role) role.addEventListener('change', function () { state.role = role.value; state.page = 1; loadUsers(); });
    if (active) active.addEventListener('change', function () { state.active = active.value; state.page = 1; loadUsers(); });
    if (reset) reset.addEventListener('click', function () {
      state.q = ''; state.role = ''; state.active = ''; state.page = 1;
      if (search) search.search();
      if (role) role.value = '';
      if (active) active.value = '';
      loadUsers();
    });
    var create = document.getElementById('createUserBtn');
    if (create) create.addEventListener('click', function () { openUserModal(); });
    loadUsers();
  }

  window.initAdminUsers = function () {
    window.adminPageInit({ onReady: init });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.initAdminUsers);
  else window.initAdminUsers();
}());
