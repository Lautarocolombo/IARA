(function () {
  'use strict';

  var editingUserId = null;

  async function loadUsers() {
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Cargando usuarios...</td></tr>';

    try {
      var res = await window.adminFetch('/api/admin/users', { method: 'GET' });
      if (!res || !res.ok) throw new Error('No se pudieron cargar los usuarios');
      var users = await res.json();
      renderUsers(users);
    } catch (err) {
      console.error('[Users] Error:', err);
      tbody.innerHTML = '<tr><td colspan="5" class="error-row">Error: ' + escapeHtml(err.message || 'desconocido') + '</td></tr>';
      window.showToast('❌', 'No se pudieron cargar los usuarios.', 'error');
    }
  }

  function renderUsers(users) {
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay usuarios registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(function (u) {
      var roleBadge = u.role === 'admin' ? 'badge-admin' : (u.role === 'editor' ? 'badge-editor' : 'badge-viewer');
      return '<tr>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td><span class="badge ' + roleBadge + '">' + escapeHtml(u.role) + '</span></td>' +
        '<td>' + (u.active ? '✅ Activo' : '❌ Inactivo') + '</td>' +
        '<td>' + (u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR') : '—') + '</td>' +
        '<td style="text-align:right;">' +
          '<button class="btn btn-secondary btn-sm edit-user-btn" data-user-id="' + u.id + '">Editar</button>' +
          (u.role !== 'admin' ? '<button class="btn btn-danger btn-sm delete-user-btn" data-user-id="' + u.id + '">Eliminar</button>' : '') +
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
      roleInput.value = 'viewer';
      activeInput.value = 'true';
      editingUserId = null;
    }

    overlay.classList.add('active');
  }

  function closeUserModal() {
    var overlay = document.getElementById('userModalOverlay');
    if (overlay) overlay.classList.remove('active');
    editingUserId = null;
  }

  async function saveUser() {
    var username = document.getElementById('userUsername').value.trim();
    var password = document.getElementById('userPassword').value;
    var role = document.getElementById('userRole').value;
    var active = document.getElementById('userActive').value === 'true';

    if (!username) {
      window.showToast('⚠️', 'El usuario es requerido.', 'error');
      return;
    }

    var payload = { username, role, active };
    if (password) payload.password = password;

    var url = editingUserId ? '/api/admin/users/' + editingUserId : '/api/admin/users';
    var method = editingUserId ? 'PUT' : 'POST';

    try {
      var res = await window.adminFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res || !res.ok) {
        var err = await res.json().catch(function () { return { error: 'Error guardando usuario' }; });
        throw new Error(err.error || 'Error guardando usuario');
      }

      window.showToast('✅', editingUserId ? 'Usuario actualizado' : 'Usuario creado');
      closeUserModal();
      loadUsers();
    } catch (err) {
      console.error('[Users] Error guardando:', err);
      window.showToast('❌', err.message, 'error');
    }
  }

  async function deleteUser(id) {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
      var res = await window.adminFetch('/api/admin/users/' + id, { method: 'DELETE' });
      if (!res || !res.ok) {
        var err = await res.json().catch(function () { return { error: 'Error eliminando usuario' }; });
        throw new Error(err.error || 'Error eliminando usuario');
      }
      window.showToast('✅', 'Usuario eliminado');
      loadUsers();
    } catch (err) {
      console.error('[Users] Error eliminando:', err);
      window.showToast('❌', err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var addBtn = document.getElementById('addUserBtn');
    var closeBtn = document.getElementById('closeUserModal');
    var cancelBtn = document.getElementById('cancelUserBtn');
    var saveBtn = document.getElementById('saveUserBtn');

    if (addBtn) addBtn.addEventListener('click', function () { openUserModal(null); });
    if (closeBtn) closeBtn.addEventListener('click', closeUserModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUserModal);
    if (saveBtn) saveBtn.addEventListener('click', saveUser);

    document.getElementById('usersTableBody')?.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.edit-user-btn');
      var deleteBtn = e.target.closest('.delete-user-btn');

      if (editBtn) {
        var userId = Number(editBtn.dataset.userId);
        var user = Array.from(document.querySelectorAll('#usersTableBody tr')).reduce(function (acc, row) {
          var btn = row.querySelector('.edit-user-btn');
          if (btn && Number(btn.dataset.userId) === userId) {
            acc = {
              id: userId,
              username: row.cells[0].textContent.trim(),
              role: row.querySelector('.badge')?.textContent.trim() || 'viewer',
              active: row.cells[2].textContent.includes('Activo')
            };
          }
          return acc;
        }, null);
        if (user) openUserModal(user);
      }

      if (deleteBtn) {
        var delId = Number(deleteBtn.dataset.userId);
        deleteUser(delId);
      }
    });

    window.addEventListener('dashboard:section-changed', function (e) {
      if (e.detail && e.detail.section === 'users') {
        loadUsers();
      }
    });
  });

  window.loadUsers = loadUsers;
})();
