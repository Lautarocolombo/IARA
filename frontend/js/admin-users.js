(function () {
  'use strict';

  var state = { page: 1, limit: 10, q: '', role: '', active: '' };
  var currentEditingId = null;

  function safeToast(icon, message, type) {
    if (typeof window.showToast === 'function') { window.showToast(icon, message, type); return; }
    if (type === 'error') console.error('[admin-users]', message);
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
            b.textContent = p;
            b.addEventListener('click', function () { state.page = p; loadUsers(); });
            c.appendChild(b);
          })(i);
        }
      };
    }
  }

  function loadUsers() {
    ensureHelpers();
    var loading = document.getElementById('usersLoading');
    var error = document.getElementById('usersError');
    var empty = document.getElementById('usersEmpty');
    var table = document.getElementById('usersTable');
    var body = document.getElementById('usersTableBody');

    if (loading) loading.classList.remove('hidden');
    if (error) { error.classList.add('hidden'); error.textContent = ''; }
    if (empty) empty.classList.add('hidden');
    if (table) table.style.display = 'none';
    if (body) body.innerHTML = '';

    var params = new URLSearchParams();
    params.set('page', state.page);
    params.set('limit', state.limit);
    if (state.q) params.set('q', state.q);
    if (state.role) params.set('role', state.role);
    if (state.active) params.set('active', state.active);

    window.adminFetch('/api/v1/admin/users?' + params.toString())
      .then(function (res) {
        if (loading) loading.classList.add('hidden');
        if (res.users && res.users.length > 0) {
          if (table) table.style.display = 'table';
          res.users.forEach(function (u) {
            var row = document.createElement('tr');
            var roleLabel = u.role === 'admin' ? 'Admin' : (u.role === 'editor' ? 'Editor' : 'Viewer');
            var activeLabel = u.active ? 'Activo' : 'Inactivo';
            var activeClass = u.active ? 'is-active' : 'is-inactive';
            row.innerHTML =
              '<td>' + (u.id || '') + '</td>' +
              '<td>' + escapeHtml(u.username || '') + '</td>' +
              '<td>' + escapeHtml(u.email || '') + '</td>' +
              '<td><span class="admin-page-badge ' + activeClass + '">' + roleLabel + '</span></td>' +
              '<td><span class="admin-page-badge ' + activeClass + '">' + activeLabel + '</span></td>' +
              '<td>' + (u.created_at ? formatDate(u.created_at) : '') + '</td>' +
              '<td class="admin-page-table-actions">' +
                '<button class="btn btn-sm btn-secondary edit-user" data-id="' + u.id + '" aria-label="Editar usuario ' + escapeHtml(u.username) + '">Editar</button>' +
                '<button class="btn btn-sm btn-danger delete-user" data-id="' + u.id + '" aria-label="Eliminar usuario ' + escapeHtml(u.username) + '">Eliminar</button>' +
              '</td>';
            if (body) body.appendChild(row);
          });
          if (res.pagination) {
            window.renderPagination({ container: document.getElementById('usersPagination'), page: state.page, totalPages: res.pagination.totalPages });
          }
        } else {
          if (empty) {
            empty.classList.remove('hidden');
            empty.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: var(--text-muted);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><h3>No hay usuarios</h3><p>Creá el primer usuario con el botón de arriba.</p>';
          }
        }
      })
      .catch(function (err) {
        if (loading) loading.classList.add('hidden');
        if (error) { error.classList.remove('hidden'); error.textContent = err.message || 'Error cargando usuarios.'; }
        safeToast('!', err.message || 'Error cargando usuarios', 'error');
      });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function openCreateModal() {
    if (typeof window.Modal !== 'function') return;
    var modal = new window.Modal({
      title: 'Crear usuario',
      content: '<form id="userForm">' +
        '<div class="form-group"><label for="newUsername">Usuario</label><input id="newUsername" type="text" required /></div>' +
        '<div class="form-group"><label for="newEmail">Email</label><input id="newEmail" type="email" required /></div>' +
        '<div class="form-group"><label for="newPassword">Contraseña</label><input id="newPassword" type="password" required /></div>' +
        '<div class="form-group"><label for="newRole">Rol</label><select id="newRole"><option value="editor">Editor</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></div>' +
        '<div class="form-group"><label for="newActive">Activo</label><select id="newActive"><option value="true">Sí</option><option value="false">No</option></select></div>' +
        '</form>',
      actions: [
        { label: 'Cancelar', className: 'btn btn-secondary', onClick: function () { modal.close(); } },
        { label: 'Crear', className: 'btn btn-primary', onClick: function () { createUser(modal); } }
      ]
    });
    modal.open();
  }

  function createUser(modal) {
    var username = document.getElementById('newUsername').value.trim();
    var email = document.getElementById('newEmail').value.trim();
    var password = document.getElementById('newPassword').value;
    var role = document.getElementById('newRole').value;
    var active = document.getElementById('newActive').value === 'true';
    if (!username || !email || !password) {
      safeToast('!', 'Completá todos los campos', 'error');
      return;
    }
    window.adminFetch('/api/v1/admin/users', { method: 'POST', body: JSON.stringify({ username: username, email: email, password: password, role: role, active: active }) })
      .then(function () {
        modal.close();
        safeToast('✓', 'Usuario creado', 'success');
        loadUsers();
      })
      .catch(function (err) {
        safeToast('!', err.message || 'Error creando usuario', 'error');
      });
  }

  function openEditModal(user) {
    if (typeof window.Modal !== 'function') return;
    currentEditingId = user.id;
    var modal = new window.Modal({
      title: 'Editar usuario',
      content: '<form id="userForm">' +
        '<div class="form-group"><label for="editUsername">Usuario</label><input id="editUsername" type="text" value="' + escapeHtml(user.username) + '" required /></div>' +
        '<div class="form-group"><label for="editEmail">Email</label><input id="editEmail" type="email" value="' + escapeHtml(user.email) + '" required /></div>' +
        '<div class="form-group"><label for="editRole">Rol</label><select id="editRole"><option value="editor"' + (user.role === 'editor' ? ' selected' : '') + '>Editor</option><option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Admin</option><option value="viewer"' + (user.role === 'viewer' ? ' selected' : '') + '>Viewer</option></select></div>' +
        '<div class="form-group"><label for="editActive">Activo</label><select id="editActive"><option value="true"' + (user.active ? ' selected' : '') + '>Sí</option><option value="false"' + (!user.active ? ' selected' : '') + '>No</option></select></div>' +
        '<div class="form-group"><label for="editPassword">Nueva contraseña (opcional)</label><input id="editPassword" type="password" placeholder="Dejá vacío para no cambiar" /></div>' +
        '</form>',
      actions: [
        { label: 'Cancelar', className: 'btn btn-secondary', onClick: function () { modal.close(); } },
        { label: 'Guardar', className: 'btn btn-primary', onClick: function () { saveUser(modal); } }
      ]
    });
    modal.open();
  }

  function saveUser(modal) {
    var username = document.getElementById('editUsername').value.trim();
    var email = document.getElementById('editEmail').value.trim();
    var role = document.getElementById('editRole').value;
    var active = document.getElementById('editActive').value === 'true';
    var password = document.getElementById('editPassword').value;
    if (!username || !email) {
      safeToast('!', 'Completá usuario y email', 'error');
      return;
    }
    var payload = { username: username, email: email, role: role, active: active };
    if (password) payload.password = password;
    window.adminFetch('/api/v1/admin/users/' + currentEditingId, { method: 'PUT', body: JSON.stringify(payload) })
      .then(function () {
        modal.close();
        safeToast('✓', 'Usuario actualizado', 'success');
        loadUsers();
      })
      .catch(function (err) {
        safeToast('!', err.message || 'Error actualizando usuario', 'error');
      });
  }

  function deleteUser(id) {
    if (typeof window.ConfirmDialog !== 'function') {
      if (!confirm('¿Eliminar este usuario?')) return;
      doDelete(id);
      return;
    }
    var dialog = new window.ConfirmDialog({
      title: 'Eliminar usuario',
      message: 'Esta acción no se puede deshacer. ¿Querés continuar?',
      confirmLabel: 'Eliminar',
      confirmClass: 'btn btn-danger',
      onConfirm: function () { doDelete(id); }
    });
    dialog.open();
  }

  function doDelete(id) {
    window.adminFetch('/api/v1/admin/users/' + id, { method: 'DELETE' })
      .then(function () {
        safeToast('✓', 'Usuario eliminado', 'success');
        loadUsers();
      })
      .catch(function (err) {
        safeToast('!', err.message || 'Error eliminando usuario', 'error');
      });
  }

  function init() {
    if (window.adminSidebar && typeof window.adminSidebar.init === 'function') {
      window.adminSidebar.init({
        onLogout: function () {
          if (typeof doLogout === 'function') doLogout();
        }
      });
    }

    var nav = document.getElementById('adminNav');
    if (nav) {
      nav.addEventListener('click', function (e) {
        if (!e.target.closest('a[data-section]')) return;
        if (window.adminSidebar && typeof window.adminSidebar.isDrawerOpen === 'function' && window.adminSidebar.isDrawerOpen()) {
          window.adminSidebar.closeDrawer(true);
        }
      });
    }

    var createBtn = document.getElementById('createUserBtn');
    if (createBtn) createBtn.addEventListener('click', openCreateModal);

    var searchInput = document.getElementById('usersQuery');
    var searchBtn = document.querySelector('#usersSearch .search-bar__submit');
    var searchClear = document.querySelector('#usersSearch .search-bar__clear');
    if (searchInput) {
      searchInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') { state.q = searchInput.value.trim(); state.page = 1; loadUsers(); } });
    }
    if (searchBtn) {
      searchBtn.addEventListener('click', function () { state.q = searchInput.value.trim(); state.page = 1; loadUsers(); });
    }
    if (searchClear) {
      searchClear.addEventListener('click', function () { searchInput.value = ''; state.q = ''; state.page = 1; loadUsers(); searchClear.hidden = true; });
    }
    if (searchInput) {
      searchInput.addEventListener('input', function () { searchClear.hidden = !searchInput.value; });
    }

    var roleFilter = document.getElementById('usersRoleFilter');
    var activeFilter = document.getElementById('usersActiveFilter');
    var resetBtn = document.getElementById('usersResetFilters');
    if (roleFilter) {
      roleFilter.addEventListener('change', function () { state.role = roleFilter.value; state.page = 1; loadUsers(); });
    }
    if (activeFilter) {
      activeFilter.addEventListener('change', function () { state.active = activeFilter.value; state.page = 1; loadUsers(); });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state.q = ''; state.role = ''; state.active = '';
        if (searchInput) searchInput.value = '';
        if (roleFilter) roleFilter.value = '';
        if (activeFilter) activeFilter.value = '';
        if (searchClear) searchClear.hidden = true;
        state.page = 1;
        loadUsers();
      });
    }

    document.getElementById('usersTableBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.edit-user');
      var deleteBtn = e.target.closest('.delete-user');
      if (editBtn) { openEditModal({ id: editBtn.dataset.id, username: editBtn.closest('tr').children[1].textContent, email: editBtn.closest('tr').children[2].textContent, role: editBtn.closest('tr').children[3].textContent.replace('Admin','admin').replace('Editor','editor').replace('Viewer','viewer').toLowerCase(), active: editBtn.closest('tr').children[4].textContent.includes('Activo') }); }
      if (deleteBtn) { deleteUser(deleteBtn.dataset.id); }
    });

    loadUsers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());