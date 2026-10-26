const sessionDetailsCache = new Map();

document.addEventListener('DOMContentLoaded', () => {
  fetchHistory();
});

async function fetchHistory() {
  const container = document.getElementById('history-sessions-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div class="skeleton" style="width: 100%; height: 80px; margin-bottom: 12px; border-radius: 12px;"></div>
      <div class="skeleton" style="width: 100%; height: 80px; margin-bottom: 12px; border-radius: 12px;"></div>
    </div>
  `;

  try {
    const res = await fetch('/api/history', {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error('Error al obtener el historial');
    const data = await res.json();

    renderHistory(data.sessions || []);
  } catch (err) {
    console.error('Error:', err);
    container.innerHTML = '<div class="text-danger text-center" style="padding: 24px;">Error al cargar el historial</div>';
  }
}

function renderHistory(sessions) {
  const container = document.getElementById('history-sessions-container');
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 40px 16px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted" style="margin-bottom: 12px;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <h3>No hay entrenamientos registrados aún</h3>
        <p class="text-muted" style="margin-top: 8px;">Las sesiones que registres en BilboAG aparecerán organizadas aquí cronológicamente.</p>
        <div style="margin-top: 16px;">
          <a href="/training" class="btn btn-primary">Registrar mi primer entreno</a>
        </div>
      </div>
    `;
    return;
  }

  // Group sessions by Month-Year
  const months = {};
  for (const s of sessions) {
    const [year, month] = s.date.split('-');
    const monthKey = `${year}-${month}`;
    if (!months[monthKey]) {
      months[monthKey] = [];
    }
    months[monthKey].push(s);
  }

  let html = '';
  for (const [monthKey, monthSessions] of Object.entries(months)) {
    const [year, month] = monthKey.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 1rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          🗓️ ${capitalizedMonth} (${monthSessions.length} ${monthSessions.length === 1 ? 'sesión' : 'sesiones'})
        </h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${monthSessions.map(s => renderSessionRow(s)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderSessionRow(s) {
  const parts = s.date.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
  const dayNum = parts[2];

  return `
    <div class="card card-lift session-card" id="session-card-${s.date}" style="margin-bottom: 0; padding: 14px 16px; cursor: pointer;" onclick="toggleSessionDetail('${s.date}')">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; background: var(--color-primary-light); color: var(--color-primary-dark); border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700;">
            <span style="font-size: 0.6875rem; text-transform: uppercase; line-height: 1;">${dayName}</span>
            <span style="font-size: 1.125rem; line-height: 1;">${dayNum}</span>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9375rem;">Entrenamiento del ${formatDateSpanish(s.date)}</div>
            <div style="font-size: 0.8125rem;" class="text-muted">
              ${s.exercise_count} ${s.exercise_count === 1 ? 'ejercicio' : 'ejercicios'} &bull; ${s.set_count} series
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          ${s.best_1rm ? `<span class="badge badge-primary">Mejor 1RM: ${s.best_1rm} kg</span>` : ''}
          ${s.total_volume ? `<span class="badge badge-neutral" title="Volumen total">Vol: ${s.total_volume} kg</span>` : ''}
          <span class="chevron-icon" id="chevron-${s.date}" style="color: var(--color-text-muted); font-size: 0.875rem; transition: transform var(--transition);">▼</span>
        </div>
      </div>

      <!-- Detail container -->
      <div id="session-detail-${s.date}" class="session-detail" style="display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--color-border);" onclick="event.stopPropagation()">
        <div class="skeleton" style="width: 100%; height: 40px;"></div>
      </div>
    </div>
  `;
}

async function toggleSessionDetail(date) {
  const detailEl = document.getElementById(`session-detail-${date}`);
  const chevron = document.getElementById(`chevron-${date}`);
  if (!detailEl) return;

  const isOpen = detailEl.style.display === 'block';

  if (isOpen) {
    detailEl.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    return;
  }

  detailEl.style.display = 'block';
  if (chevron) chevron.style.transform = 'rotate(180deg)';

  // If already loaded in memory cache
  if (sessionDetailsCache.has(date)) {
    renderSessionDetailContent(detailEl, sessionDetailsCache.get(date));
    return;
  }

  try {
    const res = await fetch(`/api/history/${date}`);
    if (!res.ok) throw new Error('Error al cargar detalle');
    const data = await res.json();
    sessionDetailsCache.set(date, data);
    renderSessionDetailContent(detailEl, data);
  } catch (err) {
    console.error('Error cargando detalle:', err);
    detailEl.innerHTML = '<div class="text-danger" style="font-size: 0.875rem;">Error al cargar detalle del entrenamiento</div>';
  }
}

function renderSessionDetailContent(container, data) {
  if (!data.exercises || data.exercises.length === 0) {
    container.innerHTML = '<div class="text-muted" style="font-size: 0.875rem;">No se encontraron series en esta sesión.</div>';
    return;
  }

  const html = data.exercises.map(ex => `
    <div style="margin-bottom: 14px;">
      <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 6px; display: flex; justify-content: space-between;">
        <span>🏋️ ${escapeHtml(ex.name)}</span>
        <span class="text-muted" style="font-size: 0.75rem;">${escapeHtml(ex.body_part || '')}</span>
      </div>
      <div class="table-responsive">
        <table class="table" style="font-size: 0.8125rem;">
          <thead>
            <tr>
              <th>Serie</th>
              <th>Peso</th>
              <th>${ex.measure_type === 'time' ? 'Tiempo' : 'Reps'}</th>
              <th>1RM Estimado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            ${ex.sets.map(s => `
              <tr>
                <td><strong>#${s.set_number}</strong></td>
                <td>${s.weight_kg} kg</td>
                <td>${s.reps ? `${s.reps} reps` : `${s.duration_seconds}s`}</td>
                <td>${s.one_rm ? `<span class="badge badge-primary">${s.one_rm} kg</span>` : '-'}</td>
                <td><small class="text-muted">${s.notes ? escapeHtml(s.notes) : '-'}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    ${html}
    <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
      <a href="/training?date=${data.date}" class="btn btn-outline btn-sm">Editar / Añadir series a este día</a>
    </div>
  `;
}

function formatDateSpanish(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.toggleSessionDetail = toggleSessionDetail;
