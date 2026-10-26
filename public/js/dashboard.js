document.addEventListener('DOMContentLoaded', () => {
  fetchDashboardData();
});

async function fetchDashboardData() {
  try {
    const res = await fetch('/api/dashboard', {
      headers: { 'Accept': 'application/json' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    if (!res.ok) {
      throw new Error(`Error en el servidor: ${res.status}`);
    }

    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('Error cargando el dashboard:', err);
    showToast('Error cargando datos del dashboard', 'danger');
  }
}

function renderDashboard(data) {
  // 1. User greeting & totals
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl && data.user) {
    const hours = new Date().getHours();
    let timeGreeting = '¡Hola';
    if (hours >= 6 && hours < 13) timeGreeting = '¡Buenos días';
    else if (hours >= 13 && hours < 21) timeGreeting = '¡Buenas tardes';
    else timeGreeting = '¡Buenas noches';

    greetingEl.textContent = `${timeGreeting}, ${data.user.username}! 💪`;
  }

  const statWorkoutsEl = document.getElementById('stat-workouts');
  const statSetsEl = document.getElementById('stat-sets');
  if (statWorkoutsEl && data.stats) {
    statWorkoutsEl.textContent = data.stats.totalWorkouts || 0;
  }
  if (statSetsEl && data.stats) {
    statSetsEl.textContent = data.stats.totalSets || 0;
  }

  // 2. Personal records
  renderRecords(data.records || []);

  // 3. Last session
  renderLastSession(data.lastSession);

  // 4. Progress Chart
  drawProgressChart(data.exerciseProgress || [], data.progressExerciseName);
}

function renderRecords(records) {
  const container = document.getElementById('records-container');
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 24px;" class="text-muted">
        <p>Aún no tienes récords registrados.</p>
        <a href="/training" class="btn btn-outline btn-sm" style="margin-top: 10px;">¡Comienza tu primer entreno!</a>
      </div>
    `;
    return;
  }

  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
  container.innerHTML = records.map((rec, index) => `
    <div class="card card-lift" style="margin-bottom: 0; padding: 14px 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 1.5rem; line-height: 1;">${medals[index] || '🏅'}</span>
        <span class="badge badge-primary">1RM: ${rec.best_1rm} kg</span>
      </div>
      <div style="margin-top: 8px;">
        <h4 style="font-size: 0.9375rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${rec.exercise_name}">
          ${rec.exercise_name}
        </h4>
        <small class="text-muted" style="font-size: 0.75rem;">${formatDateSpanish(rec.date)}</small>
      </div>
    </div>
  `).join('');
}

function renderLastSession(lastSession) {
  const container = document.getElementById('last-session-container');
  if (!container) return;

  if (!lastSession) {
    container.innerHTML = `
      <div class="text-center" style="padding: 24px;">
        <p class="text-muted">No has registrado entrenamientos todavía.</p>
        <a href="/training" class="btn btn-primary btn-sm" style="margin-top: 12px;">Comenzar a entrenar</a>
      </div>
    `;
    return;
  }

  const exercisesHtml = lastSession.exercises.map(ex => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border);">
      <div>
        <strong>${ex.name}</strong>
        <div style="font-size: 0.8125rem;" class="text-muted">${ex.sets_count} series completadas</div>
      </div>
      <div>
        ${ex.best_1rm ? `<span class="badge badge-primary">Mejor: ${ex.best_1rm} kg</span>` : '<span class="badge badge-neutral">Tiempo</span>'}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span class="badge badge-success" style="font-size: 0.8125rem; padding: 4px 10px;">
        📅 ${formatDateSpanish(lastSession.date)}
      </span>
      <a href="/history" class="btn btn-outline btn-sm">Ver historial</a>
    </div>
    <div>${exercisesHtml}</div>
  `;
}

function drawProgressChart(progressData, exerciseName) {
  const container = document.getElementById('chart-wrapper');
  const titleEl = document.getElementById('chart-exercise-title');
  if (!container) return;

  if (titleEl) {
    titleEl.textContent = exerciseName ? `Progresión: ${exerciseName}` : 'Progresión de 1RM';
  }

  if (!progressData || progressData.length < 2) {
    container.innerHTML = `
      <div class="text-center text-muted" style="padding: 40px 16px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <p style="font-size: 0.875rem;">Se necesitan al menos 2 sesiones con el mismo ejercicio para trazar la gráfica de progresión.</p>
      </div>
    `;
    return;
  }

  // Calculate coordinates in SVG space
  const svgWidth = 600;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;

  const width = svgWidth - padLeft - padRight;
  const height = svgHeight - padTop - padBottom;

  const values = progressData.map(d => d.one_rm);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - 10);
    maxVal = maxVal + 10;
  } else {
    const margin = (maxVal - minVal) * 0.15;
    minVal = Math.max(0, Math.floor(minVal - margin));
    maxVal = Math.ceil(maxVal + margin);
  }

  const numPoints = progressData.length;
  const points = progressData.map((d, i) => {
    const x = padLeft + (numPoints === 1 ? width / 2 : (i / (numPoints - 1)) * width);
    const y = padTop + height - ((d.one_rm - minVal) / (maxVal - minVal)) * height;
    return { x, y, date: d.date, val: d.one_rm };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Fill gradient path under line
  const fillD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - padBottom} L ${points[0].x} ${svgHeight - padBottom} Z`;

  // Grid lines (3 horizontal levels)
  const gridLevels = 4;
  let gridLinesHtml = '';
  for (let i = 0; i <= gridLevels; i++) {
    const yVal = minVal + ((maxVal - minVal) / gridLevels) * i;
    const yPos = padTop + height - (i / gridLevels) * height;
    gridLinesHtml += `
      <line x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" class="chart-grid-line" />
      <text x="${padLeft - 6}" y="${yPos + 3}" class="chart-axis-text" text-anchor="end">${Math.round(yVal)}</text>
    `;
  }

  // Points and hover circles
  const pointsHtml = points.map((p, idx) => `
    <circle cx="${p.x}" cy="${p.y}" r="4.5" class="chart-point" data-idx="${idx}">
      <title>${p.date}: ${p.val} kg</title>
    </circle>
    <text x="${p.x}" y="${svgHeight - 12}" class="chart-axis-text" text-anchor="middle" font-size="9">
      ${formatDateShort(p.date)}
    </text>
  `).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="hsl(220, 90%, 55%)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="hsl(220, 90%, 55%)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${gridLinesHtml}
      <path d="${fillD}" fill="url(#chartGradient)" />
      <path d="${pathD}" class="chart-line" />
      ${pointsHtml}
    </svg>
    <div id="chart-tooltip" style="position: absolute; display: none; background: #1a1a2e; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; pointer-events: none; z-index: 10;"></div>
  `;

  // Tooltip interaction
  const tooltip = container.querySelector('#chart-tooltip');
  container.querySelectorAll('.chart-point').forEach((c, idx) => {
    c.addEventListener('mouseenter', (e) => {
      const p = points[idx];
      tooltip.innerHTML = `<strong>${p.val} kg</strong><br>${p.date}`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${(p.x / svgWidth) * 100}%`;
      tooltip.style.top = `${(p.y / svgHeight) * 100}%`;
    });
    c.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

function formatDateSpanish(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
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
