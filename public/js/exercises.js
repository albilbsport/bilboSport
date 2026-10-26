let currentPage = 1;
let currentSearch = '';
let currentFilter = 'all';
let currentBodyPart = '';
let searchDebounce = null;

document.addEventListener('DOMContentLoaded', () => {
  initExercisesPage();
});

function initExercisesPage() {
  const searchInput = document.getElementById('exercises-search');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const bodyPartSelect = document.getElementById('body-part-filter');
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');
  const addExerciseForm = document.getElementById('add-exercise-form');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        fetchExercises();
      }, 300);
    });
  }

  if (filterTabs) {
    filterTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter || 'all';
        currentPage = 1;
        fetchExercises();
      });
    });
  }

  if (bodyPartSelect) {
    bodyPartSelect.addEventListener('change', (e) => {
      currentBodyPart = e.target.value;
      currentPage = 1;
      fetchExercises();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchExercises();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage++;
      fetchExercises();
    });
  }

  if (addExerciseForm) {
    addExerciseForm.addEventListener('submit', handleCreateExercise);
  }

  fetchExercises();
}

async function fetchExercises() {
  const grid = document.getElementById('exercises-grid');
  const countEl = document.getElementById('exercises-count');
  const pageInfoEl = document.getElementById('pagination-info');
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');

  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <div class="skeleton" style="width: 100%; height: 120px; border-radius: 12px;"></div>
      </div>
    `;
  }

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      search: currentSearch,
      filter: currentFilter,
      body_part: currentBodyPart
    });

    const res = await fetch(`/api/exercises?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar ejercicios');
    const data = await res.json();

    // Populate body part select once if empty
    const bodyPartSelect = document.getElementById('body-part-filter');
    if (bodyPartSelect && bodyPartSelect.options.length <= 1 && data.bodyParts) {
      data.bodyParts.forEach(bp => {
        const opt = document.createElement('option');
        opt.value = bp;
        opt.textContent = bp.charAt(0).toUpperCase() + bp.slice(1);
        bodyPartSelect.appendChild(opt);
      });
    }

    if (countEl) countEl.textContent = `${data.total} ejercicios`;
    if (pageInfoEl) pageInfoEl.textContent = `Página ${data.page} de ${data.totalPages || 1}`;

    if (prevBtn) prevBtn.disabled = data.page <= 1;
    if (nextBtn) nextBtn.disabled = data.page >= data.totalPages;

    renderExercisesGrid(data.exercises || []);
  } catch (err) {
    console.error('Error:', err);
    if (grid) {
      grid.innerHTML = '<div style="grid-column: 1 / -1;" class="text-danger text-center">Error al cargar ejercicios</div>';
    }
  }
}

function renderExercisesGrid(exercises) {
  const grid = document.getElementById('exercises-grid');
  if (!grid) return;

  if (exercises.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;" class="text-muted">
        <p>No se encontraron ejercicios con los criterios actuales.</p>
        <button class="btn btn-outline btn-sm" onclick="openCreateExerciseModal()" style="margin-top: 12px;">
          + Crear ejercicio personalizado
        </button>
      </div>
    `;
    return;
  }

  const fallbackSvg = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="hsl(220, 90%, 55%)" stroke-width="2">
      <path d="M6 5v14M18 5v14M6 12h12M4 7h4M16 7h4M4 17h4M16 17h4" />
    </svg>
  `;

  grid.innerHTML = exercises.map(ex => {
    const isPersonal = ex.is_global === 0;
    const mediaUrl = ex.gif_url || ex.image_url;

    return `
      <div class="card card-lift" style="display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 0;">
        <div>
          <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;">
            <div style="width: 56px; height: 56px; flex-shrink: 0; background: var(--color-bg-tertiary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${mediaUrl ? `
                <img src="${mediaUrl}" alt="${escapeHtml(ex.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.outerHTML='${fallbackSvg.replace(/'/g, "\\'")}'" />
              ` : fallbackSvg}
            </div>
            <div style="flex: 1; min-width: 0;">
              <h3 style="font-size: 0.9375rem; margin-bottom: 4px; word-break: break-word;">${escapeHtml(ex.name)}</h3>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <span class="badge ${isPersonal ? 'badge-warning' : 'badge-primary'}">${isPersonal ? 'Personal' : 'Global'}</span>
                <span class="badge badge-neutral">${escapeHtml(ex.body_part || 'General')}</span>
                <span class="badge badge-neutral">${ex.measure_type === 'time' ? 'Tiempo' : 'Reps'}</span>
              </div>
            </div>
          </div>

          <div style="font-size: 0.8125rem; color: var(--color-text-muted); margin-bottom: 10px;">
            <div><strong>Músculo:</strong> ${escapeHtml(ex.target || 'General')}</div>
            ${ex.equipment ? `<div><strong>Equipo:</strong> ${escapeHtml(ex.equipment)}</div>` : ''}
          </div>

          ${ex.instructions_es ? `
            <div style="font-size: 0.75rem; color: var(--color-text-muted); max-height: 48px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 12px;">
              ${escapeHtml(ex.instructions_es)}
            </div>
          ` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; pt: 8px; border-top: 1px solid var(--color-border); margin-top: 8px; padding-top: 8px;">
          <a href="/training?exercise_id=${ex.id}" class="btn btn-primary btn-sm">
            Entrenar
          </a>
          ${isPersonal ? `
            <button class="btn btn-danger btn-sm" onclick="deleteCustomExercise(${ex.id})" title="Eliminar ejercicio personal" style="padding: 4px 8px;">
              ✕ Eliminar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openCreateExerciseModal() {
  const modal = document.getElementById('modal-create-exercise');
  if (modal) modal.classList.add('open');
}

function closeCreateExerciseModal() {
  const modal = document.getElementById('modal-create-exercise');
  if (modal) modal.classList.remove('open');
}

async function handleCreateExercise(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  const payload = {
    name: form.name.value.trim(),
    body_part: form.body_part.value.trim(),
    category: form.category.value.trim(),
    equipment: form.equipment.value.trim(),
    target: form.target.value.trim(),
    measure_type: form.measure_type.value,
    instructions_es: form.instructions_es.value.trim()
  };

  if (!payload.name) {
    showToast('El nombre del ejercicio es obligatorio', 'warning');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear el ejercicio');

    showToast('¡Ejercicio personal creado con éxito!', 'success');
    form.reset();
    closeCreateExerciseModal();
    // Switch to "mine" or refresh
    currentFilter = 'mine';
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(t => {
      if (t.dataset.filter === 'mine') t.classList.add('active');
      else t.classList.remove('active');
    });
    currentPage = 1;
    fetchExercises();
  } catch (err) {
    console.error('Error creando ejercicio:', err);
    showToast(err.message, 'danger');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function deleteCustomExercise(id) {
  if (!confirm('¿Estás seguro de eliminar este ejercicio personal? Se eliminarán también las series registradas con él.')) {
    return;
  }

  try {
    const res = await fetch(`/api/exercises/${id}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar ejercicio');

    showToast('Ejercicio eliminado correctamente', 'warning');
    fetchExercises();
  } catch (err) {
    console.error('Error:', err);
    showToast(err.message, 'danger');
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

window.openCreateExerciseModal = openCreateExerciseModal;
window.closeCreateExerciseModal = closeCreateExerciseModal;
window.deleteCustomExercise = deleteCustomExercise;
