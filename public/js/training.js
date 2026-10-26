let selectedExercise = null;
let debounceTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  initDatePicker();
  initSearch();
  initFormListeners();
  loadTodaySets();
});

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initDatePicker() {
  const dateInput = document.getElementById('session-date-picker');
  if (dateInput) {
    dateInput.value = getTodayString();
    dateInput.addEventListener('change', () => {
      loadTodaySets();
    });
  }
}

function getSelectedDate() {
  const dateInput = document.getElementById('session-date-picker');
  return (dateInput && dateInput.value) ? dateInput.value : getTodayString();
}

function initSearch() {
  const searchInput = document.getElementById('exercise-search-input');
  const dropdown = document.getElementById('exercise-search-dropdown');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);

    if (query.length < 1) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    debounceTimeout = setTimeout(() => {
      searchExercises(query);
    }, 300);
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length > 0) {
      searchExercises(searchInput.value.trim());
    }
  });
}

async function searchExercises(query) {
  const dropdown = document.getElementById('exercise-search-dropdown');
  if (!dropdown) return;

  try {
    const res = await fetch(`/api/exercises?search=${encodeURIComponent(query)}&limit=10`);
    if (!res.ok) throw new Error('Error buscando ejercicios');
    const data = await res.json();

    if (!data.exercises || data.exercises.length === 0) {
      dropdown.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-muted); font-size: 0.875rem;">No se encontraron ejercicios</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = data.exercises.map(ex => `
      <div class="search-result-item" data-id="${ex.id}" data-name="${escapeHtml(ex.name)}" data-measure="${ex.measure_type}" data-gif="${ex.gif_url || ''}" data-img="${ex.image_url || ''}" data-body="${ex.body_part || ''}">
        <div>
          <strong>${escapeHtml(ex.name)}</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${ex.body_part || 'Fuerza'} &bull; ${ex.target || 'General'}</div>
        </div>
        <span class="badge ${ex.measure_type === 'time' ? 'badge-warning' : 'badge-primary'}">${ex.measure_type === 'time' ? 'Tiempo' : 'Reps'}</span>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const measure = item.dataset.measure;
        const gif = item.dataset.gif;
        const img = item.dataset.img;
        const bodyPart = item.dataset.body;
        selectExercise({ id, name, measure_type: measure, gif_url: gif, image_url: img, body_part: bodyPart });
        dropdown.style.display = 'none';
        document.getElementById('exercise-search-input').value = name;
      });
    });

    dropdown.style.display = 'block';
  } catch (err) {
    console.error('Error en búsqueda:', err);
  }
}

function selectExercise(exercise) {
  selectedExercise = exercise;

  const card = document.getElementById('selected-exercise-card');
  const nameEl = document.getElementById('selected-exercise-name');
  const badgeEl = document.getElementById('selected-exercise-badge');
  const mediaContainer = document.getElementById('selected-exercise-media');
  const formSection = document.getElementById('set-inputs-section');

  if (nameEl) nameEl.textContent = exercise.name;
  if (badgeEl) {
    badgeEl.textContent = `${exercise.body_part || 'Fuerza'} • ${exercise.measure_type === 'time' ? 'Por tiempo' : 'Por repeticiones'}`;
  }

  // Render thumbnail / GIF with SVG fallback
  if (mediaContainer) {
    const fallbackSvg = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(220, 90%, 55%)" stroke-width="2">
        <path d="M6 5v14M18 5v14M6 12h12M4 7h4M16 7h4M4 17h4M16 17h4" />
      </svg>
    `;

    if (exercise.gif_url || exercise.image_url) {
      const url = exercise.gif_url || exercise.image_url;
      mediaContainer.innerHTML = `
        <img src="${url}" alt="${escapeHtml(exercise.name)}" style="width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-border);" onerror="this.outerHTML='${fallbackSvg.replace(/'/g, "\\'")}'" />
      `;
    } else {
      mediaContainer.innerHTML = fallbackSvg;
    }
  }

  // Toggle input fields based on measure_type
  const repsGroup = document.getElementById('reps-input-group');
  const timeGroup = document.getElementById('time-input-group');
  const oneRmEstimateBox = document.getElementById('estimated-1rm-box');

  if (exercise.measure_type === 'time') {
    if (repsGroup) repsGroup.style.display = 'none';
    if (timeGroup) timeGroup.style.display = 'block';
    if (oneRmEstimateBox) oneRmEstimateBox.style.display = 'none';
  } else {
    if (repsGroup) repsGroup.style.display = 'block';
    if (timeGroup) timeGroup.style.display = 'none';
    if (oneRmEstimateBox) oneRmEstimateBox.style.display = 'block';
  }

  if (card) card.style.display = 'block';
  if (formSection) formSection.style.display = 'block';

  // Load last sets for this exercise
  loadHistorySets(exercise.id);
  update1RMPreview();
}

async function loadHistorySets(exerciseId) {
  const container = document.getElementById('exercise-history-container');
  if (!container) return;

  container.innerHTML = '<small class="text-muted">Cargando histórico...</small>';

  try {
    const res = await fetch(`/api/training/history-sets?exercise_id=${exerciseId}&limit=5`);
    const data = await res.json();

    if (!data.history || data.history.length === 0) {
      container.innerHTML = '<small class="text-muted">Sin series previas registradas para este ejercicio.</small>';
      return;
    }

    container.innerHTML = `
      <div style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">Últimas 5 series realizadas:</div>
      <div class="table-responsive">
        <table class="table" style="font-size: 0.8125rem;">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Serie</th>
              <th>Peso</th>
              <th>Reps / Tiempo</th>
              <th>1RM</th>
            </tr>
          </thead>
          <tbody>
            ${data.history.map(s => `
              <tr>
                <td>${s.session_date}</td>
                <td>#${s.set_number}</td>
                <td><strong>${s.weight_kg} kg</strong></td>
                <td>${s.reps ? `${s.reps} reps` : `${s.duration_seconds} seg`}</td>
                <td>${s.one_rm ? `<span class="badge badge-primary">${s.one_rm} kg</span>` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Error cargando historial:', err);
    container.innerHTML = '<small class="text-muted">No se pudo cargar el historial.</small>';
  }
}

function initFormListeners() {
  const form = document.getElementById('add-set-form');
  const weightInput = document.getElementById('set-weight');
  const repsInput = document.getElementById('set-reps');

  if (weightInput && repsInput) {
    weightInput.addEventListener('input', update1RMPreview);
    repsInput.addEventListener('input', update1RMPreview);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      addSet();
    });
  }
}

function calculateEpley(weight, reps) {
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  if (!w || w <= 0 || !r || r <= 0) return null;
  if (r === 1) return Math.round(w * 10) / 10;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

function update1RMPreview() {
  const weightInput = document.getElementById('set-weight');
  const repsInput = document.getElementById('set-reps');
  const previewEl = document.getElementById('estimated-1rm-val');

  if (!previewEl || !weightInput || !repsInput) return;

  const w = parseFloat(weightInput.value);
  const r = parseInt(repsInput.value, 10);
  const val = calculateEpley(w, r);

  previewEl.textContent = val ? `${val} kg` : '-';
}

async function addSet() {
  if (!selectedExercise) {
    showToast('Selecciona primero un ejercicio', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-set');
  const weightInput = document.getElementById('set-weight');
  const repsInput = document.getElementById('set-reps');
  const timeMinutesInput = document.getElementById('set-time-min');
  const timeSecondsInput = document.getElementById('set-time-sec');
  const notesInput = document.getElementById('set-notes');

  const weight_kg = weightInput ? parseFloat(weightInput.value) || 0 : 0;
  let reps = null;
  let duration_seconds = null;

  if (selectedExercise.measure_type === 'time') {
    const mins = timeMinutesInput ? parseInt(timeMinutesInput.value, 10) || 0 : 0;
    const secs = timeSecondsInput ? parseInt(timeSecondsInput.value, 10) || 0 : 0;
    duration_seconds = (mins * 60) + secs;

    if (duration_seconds <= 0) {
      showToast('Introduce un tiempo válido mayor a 0', 'warning');
      return;
    }
  } else {
    reps = repsInput ? parseInt(repsInput.value, 10) : null;
    if (!reps || reps <= 0) {
      showToast('Introduce un número de repeticiones válido', 'warning');
      return;
    }
  }

  const payload = {
    exercise_id: selectedExercise.id,
    session_date: getSelectedDate(),
    weight_kg,
    reps,
    duration_seconds,
    notes: notesInput ? notesInput.value.trim() : ''
  };

  if (btn) {
    btn.disabled = true;
    btn.classList.add('btn-pulse');
  }

  try {
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al guardar la serie');
    }

    // Success feedback
    if (data.one_rm) {
      showToast(`¡Serie guardada! 1RM estimado: ${data.one_rm} kg 🚀`, 'success');
    } else {
      showToast('¡Serie guardada correctamente!', 'success');
    }

    // Refresh today's list & exercise history
    await loadTodaySets();
    loadHistorySets(selectedExercise.id);

    // Keep weight for convenience, reset reps or note if needed
    if (notesInput) notesInput.value = '';
  } catch (err) {
    console.error('Error guardando serie:', err);
    showToast(err.message, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      setTimeout(() => btn.classList.remove('btn-pulse'), 400);
    }
  }
}

async function loadTodaySets() {
  const container = document.getElementById('today-sets-container');
  if (!container) return;

  const targetDate = getSelectedDate();
  container.innerHTML = '<div class="text-center" style="padding: 20px;"><div class="skeleton" style="width: 100%; height: 60px;"></div></div>';

  try {
    const res = await fetch(`/api/training/today?date=${targetDate}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error('Error al cargar series del día');
    const data = await res.json();

    if (!data.sets || data.sets.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 32px 16px;">
          <p>No hay series registradas para el <strong>${targetDate}</strong>.</p>
          <small>Selecciona un ejercicio arriba para comenzar.</small>
        </div>
      `;
      return;
    }

    // Group sets by exercise
    const groups = {};
    for (const s of data.sets) {
      if (!groups[s.exercise_id]) {
        groups[s.exercise_id] = {
          name: s.exercise_name,
          body_part: s.body_part,
          measure_type: s.measure_type,
          sets: []
        };
      }
      groups[s.exercise_id].sets.push(s);
    }

    let html = '';
    for (const [exId, group] of Object.entries(groups)) {
      html += `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-header" style="padding-bottom: 8px; margin-bottom: 8px;">
            <div class="card-title" style="font-size: 1rem;">
              <span>🏋️ ${escapeHtml(group.name)}</span>
              <span class="badge badge-neutral" style="font-size: 0.6875rem;">${group.sets.length} series</span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Peso</th>
                  <th>${group.measure_type === 'time' ? 'Tiempo' : 'Reps'}</th>
                  <th>1RM</th>
                  <th>Notas</th>
                  <th style="width: 40px;"></th>
                </tr>
              </thead>
              <tbody>
                ${group.sets.map(s => `
                  <tr>
                    <td><strong>${s.set_number}</strong></td>
                    <td>${s.weight_kg} kg</td>
                    <td>${s.reps ? `${s.reps} reps` : `${s.duration_seconds}s`}</td>
                    <td>${s.one_rm ? `<span class="badge badge-primary">${s.one_rm} kg</span>` : '-'}</td>
                    <td><small class="text-muted">${s.notes ? escapeHtml(s.notes) : '-'}</small></td>
                    <td class="text-right">
                      <button class="btn btn-danger btn-sm" onclick="deleteSet(${s.id})" title="Eliminar serie" style="padding: 2px 8px; font-size: 0.75rem;">
                        ✕
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    console.error('Error cargando series:', err);
    container.innerHTML = '<div class="text-danger text-center" style="padding: 16px;">Error cargando las series de hoy</div>';
  }
}

async function deleteSet(id) {
  if (!confirm('¿Seguro que deseas eliminar esta serie?')) return;

  try {
    const res = await fetch(`/api/sets/${id}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');

    showToast('Serie eliminada', 'warning');
    loadTodaySets();
    if (selectedExercise) {
      loadHistorySets(selectedExercise.id);
    }
  } catch (err) {
    console.error('Error eliminando serie:', err);
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

// Expose globally for onclick handlers
window.deleteSet = deleteSet;
