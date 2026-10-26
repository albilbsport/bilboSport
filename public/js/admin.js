let allUsers = [];
let targetPasswordUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check which page we are on
  if (document.getElementById('admin-users-page')) {
    initUsersPage();
  }
  if (document.getElementById('admin-backup-page')) {
    initBackupPage();
  }
});

/* ========================================================
   USERS MANAGEMENT PAGE
======================================================== */
function initUsersPage() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabTarget = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      const targetEl = document.getElementById(`tab-${tabTarget}`);
      if (targetEl) targetEl.style.display = 'block';
    });
  });

  const passwordForm = document.getElementById('change-password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordSubmit);
  }

  fetchAdminUsers();
}

async function fetchAdminUsers() {
  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Accept': 'application/json' }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = '/login';
      return;
    }

    if (!res.ok) throw new Error('Error al obtener usuarios');
    const data = await res.json();
    allUsers = data.users || [];
    renderUsersTables();
  } catch (err) {
    console.error('Error:', err);
    showToast('Error cargando la lista de usuarios', 'danger');
  }
}

function renderUsersTables() {
  const pending = allUsers.filter(u => u.is_approved === 0);
  const active = allUsers.filter(u => u.is_approved === 1);

  // Update badge counts
  const pendingBadge = document.getElementById('badge-pending-count');
  const activeBadge = document.getElementById('badge-active-count');
  if (pendingBadge) pendingBadge.textContent = pending.length;
  if (activeBadge) activeBadge.textContent = active.length;

  // 1. Render Pending Users
  const pendingContainer = document.getElementById('pending-users-list');
  if (pendingContainer) {
    if (pending.length === 0) {
      pendingContainer.innerHTML = `
        <div class="text-center text-muted" style="padding: 32px 16px;">
          <p>No hay solicitudes de registro pendientes de aprobación.</p>
        </div>
      `;
    } else {
      pendingContainer.innerHTML = `
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Fecha Registro</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${pending.map(u => `
                <tr>
                  <td><strong>${escapeHtml(u.username)}</strong></td>
                  <td>${escapeHtml(u.email)}</td>
                  <td>${u.created_at}</td>
                  <td class="text-right">
                    <button class="btn btn-primary btn-sm" onclick="approveUser(${u.id}, '${escapeHtml(u.username)}')">
                      ✓ Aprobar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="rejectUser(${u.id}, '${escapeHtml(u.username)}')" style="margin-left: 6px;">
                      ✕ Rechazar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // 2. Render Active Users
  const activeContainer = document.getElementById('active-users-list');
  if (activeContainer) {
    if (active.length === 0) {
      activeContainer.innerHTML = '<div class="text-center text-muted" style="padding: 24px;">No hay usuarios activos</div>';
    } else {
      activeContainer.innerHTML = `
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Series</th>
                <th>Registro</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${active.map(u => `
                <tr>
                  <td><strong>${escapeHtml(u.username)}</strong></td>
                  <td>${escapeHtml(u.email)}</td>
                  <td>
                    <span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-neutral'}">
                      ${u.role}
                    </span>
                  </td>
                  <td>${u.total_sets || 0}</td>
                  <td>${u.created_at}</td>
                  <td class="text-right">
                    <button class="btn btn-outline btn-sm" onclick="openPasswordModal(${u.id}, '${escapeHtml(u.username)}')">
                      🔑 Contraseña
                    </button>
                    ${u.role !== 'admin' ? `
                      <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" style="margin-left: 6px;">
                        ✕ Eliminar
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }
}

async function approveUser(id, username) {
  try {
    const res = await fetch(`/api/admin/users/${id}/approve`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al aprobar usuario');

    showToast(`Usuario ${username} aprobado`, 'success');
    fetchAdminUsers();
  } catch (err) {
    console.error('Error:', err);
    showToast(err.message, 'danger');
  }
}

async function rejectUser(id, username) {
  if (!confirm(`¿Rechazar y eliminar la solicitud de ${username}?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}/reject`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al rechazar usuario');

    showToast(`Solicitud de ${username} rechazada`, 'warning');
    fetchAdminUsers();
  } catch (err) {
    console.error('Error:', err);
    showToast(err.message, 'danger');
  }
}

function openPasswordModal(id, username) {
  targetPasswordUserId = id;
  const usernameEl = document.getElementById('modal-password-username');
  if (usernameEl) usernameEl.textContent = username;
  const input = document.getElementById('new-password-input');
  if (input) input.value = '';

  const modal = document.getElementById('modal-change-password');
  if (modal) modal.classList.add('open');
}

function closePasswordModal() {
  targetPasswordUserId = null;
  const modal = document.getElementById('modal-change-password');
  if (modal) modal.classList.remove('open');
}

async function handlePasswordSubmit(e) {
  e.preventDefault();
  if (!targetPasswordUserId) return;

  const input = document.getElementById('new-password-input');
  const newPassword = input ? input.value : '';

  if (!newPassword || newPassword.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${targetPasswordUserId}/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ newPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');

    showToast('Contraseña actualizada correctamente', 'success');
    closePasswordModal();
  } catch (err) {
    console.error('Error:', err);
    showToast(err.message, 'danger');
  }
}

async function deleteUser(id, username) {
  if (!confirm(`¿Eliminar al usuario ${username} y TODOS sus entrenamientos? Esta acción es irreversible.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');

    showToast(`Usuario ${username} eliminado`, 'warning');
    fetchAdminUsers();
  } catch (err) {
    console.error('Error:', err);
    showToast(err.message, 'danger');
  }
}

/* ========================================================
   BACKUP & RESTORE PAGE
======================================================== */
function initBackupPage() {
  const dropzone = document.getElementById('backup-dropzone');
  const fileInput = document.getElementById('restore-file-input');
  const restoreForm = document.getElementById('restore-form');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    });
  }

  if (restoreForm) {
    restoreForm.addEventListener('submit', handleRestoreSubmit);
  }
}

function handleFileSelected(file) {
  const label = document.getElementById('selected-file-label');
  const submitBtn = document.getElementById('btn-restore-submit');
  if (label) {
    label.innerHTML = `<strong>Archivo seleccionado:</strong> ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)`;
    label.style.display = 'block';
  }
  if (submitBtn) {
    submitBtn.disabled = false;
  }
}

async function handleRestoreSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('restore-file-input');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Selecciona primero un archivo .db para restaurar', 'warning');
    return;
  }

  const file = fileInput.files[0];
  if (!confirm(`⚠️ ATENCIÓN: Se reemplazará la base de datos actual con "${file.name}". Se generará una copia de seguridad automática de la actual. ¿Deseas continuar?`)) {
    return;
  }

  const submitBtn = document.getElementById('btn-restore-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Restaurando base de datos...';
  }

  const formData = new FormData();
  formData.append('database_file', file);

  try {
    const res = await fetch('/api/admin/restore', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al restaurar base de datos');

    showToast(data.message || 'Restauración completada con éxito', 'success');

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (err) {
    console.error('Error en restore:', err);
    showToast(err.message, 'danger');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Restaurar Base de Datos';
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'primary') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.openPasswordModal = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.deleteUser = deleteUser;
