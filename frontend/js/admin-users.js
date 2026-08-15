(function () {
  'use strict';

  var usersCache = [];
  var editingUserId = null;
  var deleteUserId = null;

  function showToast(icon, message, type) {
    if (window.showToast && typeof window.showToast === 'function') {
      window.showToast(icon, message, type);
    } else if (typeof showToast === 'function') {
      showToast(icon, message, type);
    }
  }

  function escape(value) {
    if (window.escapeHtml && typeof window.escapeHtml === 'function') {
      return window.escapeHtml(value);
    }
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      var d = new Date(value);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('es-AR', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return '—';
    }
  }

  async function loadUsers() {
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Cargando usuarios...</td></tr>';

    try {
      var res = await window.adminFetch('/api/admin/users', { method: 'GET' });
      if (!res || !res.ok) throw new Error('No se pudieron cargar los usuarios');
      var users = await res.json();
      usersCache = Array.isArray(users) ? users : [];
      renderUsers(usersCache);
    } catch (err) {
      console.error('[Users] Error:', err);
      tbody.innerHTML = '<tr><td colspan="5" class="error-row">Error: ' + escape(err.message || 'desconocido') + '</td></tr>';
      showToast('❌', 'No se pudieron cargar los usuarios.', 'error');
    }
  }

  function renderUsers(users) {
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    var currentUser = (window.getCurrentUser && window.getCurrentUser()) || { username: '', role: '' };

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay usuarios registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(function (u) {
      var roleLabel = u.role === 'admin' ? 'Admin' : (u.role === 'editor' ? 'Editor' : 'Viewer');
      var roleClass = u.role === 'admin' ? 'badge-admin' : (u.role === 'editor' ? 'badge-editor' : 'badge-viewer');
      var canDelete = u.role !== 'admin' && u.username !== currentUser.username;

      return '<tr>' +
        '<td><strong>' + escape(u.username || '') + '</strong></td>' +
        '<td><span class="badge ' + roleClass + '">' + escape(roleLabel) + '</span></td>' +
        '<td>' + formatDate(u.last_login) + '</td>' +
        '<td>' + (u.active ? '✅ Activo' : '❌ Inactivo') + '</td>' +
        '<td style="text-align:center;">' +
          '<button class="btn btn-secondary btn-sm edit-user-btn" data-user-id="' + u.id + '">' + escape('Editar') + '</button>' +
          (canDelete
            ? '<button class="btn btn-danger btn-sm delete-user-btn" data-user-id="' + u.id + '" style="margin-left:0.25rem;">' + escape('Eliminar') + '</button>'
            : '') +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function openUserModal(user) {
    var overlay = document.getElementById('userModalOverlay');
    var title = document.getElementById('userModalTitle');
    var usernameInput = document.getElementById('userUsername');
    var passwordInput = document.getElementById('userPassword');
    var passwordHint = document.getElementById('userPasswordHint');
    var roleInput = document.getElementById('userRole');
    var activeInput = document.getElementById('userActive');
    var passwordToggle = document.getElementById('userPasswordToggle');

    if (!overlay) return;

    if (user) {
      title.textContent = 'Editar usuario';
      usernameInput.value = user.username || '';
      passwordInput.value = '';
      passwordHint.style.display = 'block';
      roleInput.value = user.role || 'viewer';
      activeInput.value = String(user.active !== false);
      editingUserId = user.id;
    } else {
      title.textContent = 'Nuevo usuario';
      usernameInput.value = '';
      passwordInput.value = '';
      passwordHint.style.display = 'none';
      roleInput.value = 'editor';
      activeInput.value = 'true';
      editingUserId = null;
    }

    if (passwordToggle) passwordToggle.classList.remove('showing');

    overlay.classList.add('active');
    if (usernameInput) usernameInput.focus();
  }

  function closeUserModal() {
    var overlay = document.getElementById('userModalOverlay');
    if (overlay) overlay.classList.remove('active');
    editingUserId = null;
  }

  function toggleUserPassword() {
    var passwordInput = document.getElementById('userPassword');
    var toggleBtn = document.getElementById('userPasswordToggle');
    if (!passwordInput || !toggleBtn) return;
    var showing = toggleBtn.classList.contains('showing');
    if (showing) {
      passwordInput.type = 'password';
      toggleBtn.classList.remove('showing');
      toggleBtn.setAttribute('aria-label', 'Mostrar contraseña');
    } else {
      passwordInput.type = 'text';
      toggleBtn.classList.add('showing');
      toggleBtn.setAttribute('aria-label', 'Ocultar contraseña');
    }
  }

  async function saveUser() {
    var username = document.getElementById('userUsername').value.trim();
    var password = document.getElementById('userPassword').value;
    var role = document.getElementById('userRole').value;
    var active = document.getElementById('userActive').value === 'true';

    if (!username) {
      showToast('⚠️', 'El nombre de usuario es requerido.', 'error');
      return;
    }

    var payload = { username: username, role: role, active: active };
    if (password) payload.password = password;

    var url = editingUserId
      ? '/api/admin/users/' + editingUserId
      : '/api/admin/users';
    var method = editingUserId ? 'PUT' : 'POST';

    try {
      var res = await window.adminFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await res.json().catch(function () { return {}; });

      if (!res || !res.ok) {
        throw new Error(data.error || 'Error guardando usuario');
      }

      showToast('✅', editingUserId ? 'Usuario actualizado' : 'Usuario creado');
      closeUserModal();
      loadUsers();
    } catch (err) {
      console.error('[Users] Error guardando:', err);
      showToast('❌', err.message, 'error');
    }
  }

  function openDeleteModal(user) {
    deleteUserId = user.id;
    var overlay = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var actionBtn = document.getElementById('confirmModalAction');

    if (!overlay || !msg) return;

    msg.textContent = '¿Estás seguro de eliminar al usuario "' + user.username + '"? Esta acción no se puede deshacer.';
    actionBtn.textContent = 'Eliminar';

    overlay.classList.add('active');
  }

  function closeDeleteModal() {
    var overlay = document.getElementById('confirmModalOverlay');
    if (overlay) overlay.classList.remove('active');
    deleteUserId = null;
  }

  function canDeleteCurrentUser() {
    var currentUser = (window.getCurrentUser && window.getCurrentUser()) || { username: '' };
    return currentUser.username;
  }

  async function confirmDelete() {
    if (!deleteUserId) {
      closeDeleteModal();
      return;
    }

    var currentUser = canDeleteCurrentUser();
    var user = usersCache.find(function (u) { return u.id === deleteUserId; });
    if (user && user.username === currentUser) {
      showToast('⚠️', 'No podés eliminarte a vos mismo.', 'error');
      closeDeleteModal();
      return;
    }

    try {
      var res = await window.adminFetch('/api/admin/users/' + deleteUserId, { method: 'DELETE' });
      var data = res ? await res.json().catch(function () { return {}; }) : {};

      if (!res || !res.ok) {
        throw new Error(data.error || 'Error eliminando usuario');
      }

      showToast('✅', 'Usuario eliminado');
      closeDeleteModal();
      loadUsers();
    } catch (err) {
      console.error('[Users] Error eliminando:', err);
      if (err.message && err.message.indexOf('403') !== -1) {
        showToast('❌', 'Acceso denegado. Solo los administradores pueden eliminar usuarios.', 'error');
      } else {
        showToast('❌', err.message, 'error');
      }
      closeDeleteModal();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var addBtn = document.getElementById('addUserBtn');
    var closeBtn = document.getElementById('closeUserModal');
    var cancelBtn = document.getElementById('cancelUserBtn');
    var saveBtn = document.getElementById('saveUserBtn');
    var passwordToggle = document.getElementById('userPasswordToggle');
    var cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    var confirmActionBtn = document.getElementById('confirmModalAction');

    if (addBtn) addBtn.addEventListener('click', function (e) { e.preventDefault(); openUserModal(null); });
    if (closeBtn) closeBtn.addEventListener('click', closeUserModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUserModal);
    if (saveBtn) saveBtn.addEventListener('click', saveUser);
    if (passwordToggle) passwordToggle.addEventListener('click', toggleUserPassword);
    if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', closeDeleteModal);
    if (confirmActionBtn) confirmActionBtn.addEventListener('click', confirmDelete);

    document.getElementById('userModalOverlay')?.addEventListener('click', function (e) {
      if (e.target === this) closeUserModal();
    });
    document.getElementById('confirmModalOverlay')?.addEventListener('click', function (e) {
      if (e.target === this) closeDeleteModal();
    });

    document.getElementById('usersTableBody')?.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.edit-user-btn');
      var deleteBtn = e.target.closest('.delete-user-btn');

      if (editBtn) {
        var userId = Number(editBtn.dataset.userId);
        var user = usersCache.find(function (u) { return u.id === userId; });
        if (user) openUserModal(user);
      }

      if (deleteBtn) {
        var delId = Number(deleteBtn.dataset.userId);
        var delUser = usersCache.find(function (u) { return u.id === delId; });
        if (delUser) openDeleteModal(delUser);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeUserModal();
        closeDeleteModal();
      }
    });

    window.addEventListener('dashboard:section-changed', function (e) {
      if (e.detail && e.detail.section === 'users') {
        loadUsers();
      }
    });
  });

  window.loadUsers = loadUsers;
  window.openUserModal = openUserModal;
  window.openDeleteModal = openDeleteModal;
})();
