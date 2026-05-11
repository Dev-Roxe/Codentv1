// cajas.js - Gestión de cajas registradoras
import toast from './toast.js';
import '../components/navbar-component.js';
import { initNavbarListeners, getUserName } from './navigation.js';

let db = (window.api && window.api.db) ? window.api.db : null;
let cajasReportApi = null;

function resolveCajasReportApi() {
  if (window.api?.cajasReport) return window.api.cajasReport;
  if (window.parent && window.parent !== window && window.parent.api?.cajasReport) {
    return window.parent.api.cajasReport;
  }
  return null;
}

function getSessionUser() {
  try {
    const localSession = JSON.parse(localStorage.getItem('sesionActual')) || {};
    if (localSession && typeof localSession === 'object' && Object.keys(localSession).length) {
      return localSession;
    }

    if (window.parent && window.parent !== window) {
      const parentRaw = window.parent.localStorage?.getItem('sesionActual');
      if (parentRaw) {
        const parentSession = JSON.parse(parentRaw) || {};
        if (parentSession && typeof parentSession === 'object') return parentSession;
      }
    }
    return {};
  } catch (e) {
    return {};
  }
}

function getCurrentUserName() {
  const session = getSessionUser();
  return session.nombre || getUserName();
}

function getCurrentUserId() {
  const session = getSessionUser();
  const candidates = [session.id, session.user_id, session.id_usuario, session.usuario_id, session.userId, session.usuarioId];
  for (const raw of candidates) {
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

function getCurrentUserRole() {
  const session = getSessionUser();
  return String(session.rol || session.role || '').trim().toLowerCase();
}

function isAdminUser() {
  const role = getCurrentUserRole();
  return ['admin', 'administrador', 'superadmin', 'gerente'].includes(role);
}

function canManageCaja(caja) {
  const currentUserId = getCurrentUserId();
  if (!currentUserId || !caja) return false;
  return Number(caja.usuario_id) === Number(currentUserId) || isAdminUser();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve([]);
      if (db.all && db.all.length >= 3) {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else if (db.all) {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      } else {
        resolve([]);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve(null);
      if (db.get && db.get.length >= 3) {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        });
      } else if (db.get) {
        db.get(sql, params).then(row => resolve(row || null)).catch(reject);
      } else {
        resolve(null);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return reject(new Error('DB no disponible'));
      if (db.run && db.run.length >= 3) {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve(this);
        });
      } else if (db.run) {
        db.run(sql, params).then(res => resolve(res)).catch(reject);
      } else {
        reject(new Error('DB methods not available'));
      }
    } catch (e) {
      reject(e);
    }
  });
}

async function writeFinanceAudit(action, entity, entityId = null, payload = null, userId = null) {
  if (!db) return;
  const resolvedUserId = Number(userId || getCurrentUserId() || 0) || null;
  try {
    await dbRun(
      `INSERT INTO auditoria_financiera (usuario_id, accion, entidad, entidad_id, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [resolvedUserId, action, entity, entityId, payload ? JSON.stringify(payload) : null]
    );
  } catch (error) {
    console.warn('No se pudo registrar auditoria financiera', error && error.message);
  }
}

let currentTab = 'abiertas';
let searchQuery = '';
let cajas = [];
let charts = {
  movimientos: null,
  comparacion: null
};
let dailyMovements = [];
let usuariosCatalog = [];
const advancedState = {
  filters: {
    fecha: '',
    mes: '',
    caja_id: '',
    tipo: '',
    usuario_id: '',
  },
  movimientos: [],
  resumen: null,
  saldosMetodo: [],
};

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function currentMonthISO() {
  return todayISO().slice(0, 7);
}


document.addEventListener('DOMContentLoaded', async () => {
  cajasReportApi = resolveCajasReportApi();

  // Inicializar navbar
  const navbar = document.querySelector('app-navbar');
  if (navbar) navbar.setAttribute('user-name', getCurrentUserName());

  initNavbarListeners({
    onSearch: (query) => {
      console.log('Buscando:', query);
      filterCajas(query);
    },
    onSearchSubmit: (query) => {
      console.log('Búsqueda:', query);
    },
    onLogout: () => {
      if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.removeItem('sesionActual');
        localStorage.removeItem('userName');
        localStorage.removeItem('userToken');
        localStorage.removeItem('sesionLastLogin');
        sessionStorage.removeItem('notified_appointments');
        sessionStorage.removeItem('notifiedAppointments');
        sessionStorage.removeItem('openAdminMenu');
        window.location.href = '../login.html';
      }
    }
  });

  // Cargar cajas
  await loadCajas();
  await initAdvancedDashboard();

  // Event listeners para tabs
  document.querySelectorAll('.tab-button').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Event listener para búsqueda local
  const searchInput = document.getElementById('searchCaja');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filterCajas(e.target.value);
      }, 300);
    });
  }

  // Event listener para abrir caja
  const btnAbrirCaja = document.getElementById('btnAbrirCaja');
  if (btnAbrirCaja) {
    btnAbrirCaja.addEventListener('click', showAbrirCajaModal);
  }

  // Renderizar tab inicial
  renderCurrentTab();

  // Inicializar gráficas
  createMovimientosChart();
  createComparacionChart();

  // Observador de cambios de tema para actualizar gráficas
  setupThemeObserver();
});

// Cargar cajas desde la base de datos
async function loadCajas() {
  try {
    if (!db) {
      cajas = [];
      dailyMovements = [];
      updateStats();
      createMovimientosChart();
      createComparacionChart();
      return;
    }

    // Cargar movimientos diarios para la grafica
    await loadDailyMovements();

    const sql = `
      SELECT 
        c.*,
        TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, u.apellidos, '')) as usuario_nombre,
        (SELECT COALESCE(SUM(CASE WHEN m.tipo = 'egreso' THEN -m.monto ELSE m.monto END), 0) FROM movimientos_caja m WHERE m.caja_id = c.id) as total_movimientos
      FROM cajas c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.fecha_apertura DESC
    `;

    const rows = await dbAll(sql);
    cajas = (rows || []).map(c => ({
      ...c,
      usuario_nombre: (c.usuario_nombre || 'Usuario').trim() || 'Usuario',
      saldo_inicial: Number(c.saldo_inicial || 0),
      saldo_final: c.saldo_final === null || c.saldo_final === undefined ? null : Number(c.saldo_final),
      total_movimientos: Number(c.total_movimientos || 0)
    }));

    updateStats();
    createMovimientosChart();
    createComparacionChart();
    populateAdvancedCajaFilter();
  } catch (error) {
    console.error('Error cargando cajas:', error);
    cajas = [];
  }
}

async function loadDailyMovements() {
  try {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDateObj = new Date();
    startDateObj.setDate(today.getDate() - 6);
    const startDate = startDateObj.toISOString().split('T')[0];

    const sql = `
      SELECT 
        date(fecha) as fecha,
        SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) as egresos
      FROM movimientos_caja
      WHERE date(fecha) BETWEEN date(?) AND date(?)
      GROUP BY date(fecha)
      ORDER BY date(fecha) ASC
    `;
    
    dailyMovements = await dbAll(sql, [startDate, endDate]);
  } catch (error) {
    console.error('Error cargando movimientos diarios:', error);
    dailyMovements = [];
  }
}

function getAdvancedFiltersFromUI() {
  const fecha = (document.getElementById('adv-filter-day')?.value || '').trim();
  const mes = (document.getElementById('adv-filter-month')?.value || '').trim();
  return {
    fecha,
    mes,
    caja_id: document.getElementById('adv-filter-caja')?.value || '',
    tipo: document.getElementById('adv-filter-tipo')?.value || '',
    usuario_id: document.getElementById('adv-filter-usuario')?.value || '',
  };
}

function setAdvancedLoading(isLoading) {
  const el = document.getElementById('adv-loading');
  if (!el) return;
  el.classList.toggle('hidden', !isLoading);
}

function populateAdvancedCajaFilter() {
  const select = document.getElementById('adv-filter-caja');
  if (!select) return;
  const current = select.value || advancedState.filters.caja_id || '';
  const seen = new Set();
  const options = (cajas || [])
    .filter(item => {
      if (!item?.id || seen.has(String(item.id))) return false;
      seen.add(String(item.id));
      return true;
    })
    .map(item => ({
      value: String(item.id),
      label: `Caja #${item.id} - ${item.usuario_nombre || 'Usuario'}`,
    }));

  select.innerHTML = '<option value="">Todas</option>';
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    select.appendChild(opt);
  });

  if (current && options.some(opt => opt.value === current)) {
    select.value = current;
  }
}

function populateAdvancedUsuarioFilter() {
  const select = document.getElementById('adv-filter-usuario');
  if (!select) return;
  const current = select.value || advancedState.filters.usuario_id || '';
  select.innerHTML = '<option value="">Todos</option>';
  (usuariosCatalog || []).forEach((user) => {
    const opt = document.createElement('option');
    opt.value = String(user.id);
    opt.textContent = user.nombre || `Usuario #${user.id}`;
    select.appendChild(opt);
  });
  if (current && (usuariosCatalog || []).some(user => String(user.id) === String(current))) {
    select.value = String(current);
  }
}

async function loadAdvancedUsersCatalog() {
  if (!db) {
    usuariosCatalog = [];
    populateAdvancedUsuarioFilter();
    return;
  }
  try {
    const rows = await dbAll(`
      SELECT
        id,
        COALESCE(
          NULLIF(
            TRIM(COALESCE(nombre, '') || ' ' || COALESCE(apellido, apellidos, '')),
            ''
          ),
          email,
          ('Usuario #' || id)
        ) AS nombre
      FROM usuarios
      ORDER BY nombre ASC
    `);
    usuariosCatalog = rows || [];
  } catch (error) {
    console.error('Error cargando usuarios para filtro contable', error);
    usuariosCatalog = [];
  }
  populateAdvancedUsuarioFilter();
}

function formatOpenCajaList(openBoxes = []) {
  if (!Array.isArray(openBoxes) || !openBoxes.length) {
    return '<p>No hay cajas abiertas</p>';
  }
  return openBoxes.map((box) => `
    <p><span class="font-semibold">Caja #${box.id}</span> (${escapeHtml(box.usuario_nombre || 'Usuario')}) - ${formatCurrency(box.saldo_actual || 0)} - ${escapeHtml(box.tiempo_abierta_label || '0h 0m')}</p>
  `).join('');
}

function renderAdvancedSummary() {
  const resumen = advancedState.resumen || {};
  const day = resumen.day || {};
  const month = resumen.month || {};

  const dayIncome = document.getElementById('adv-day-income');
  const dayExpense = document.getElementById('adv-day-expense');
  const dayNet = document.getElementById('adv-day-net');
  const monthIncome = document.getElementById('adv-month-income');
  const monthNet = document.getElementById('adv-month-net');
  const monthMovements = document.getElementById('adv-month-movements');
  const openBoxes = document.getElementById('adv-open-boxes');

  if (dayIncome) dayIncome.textContent = `Ingresos: ${formatCurrency(day.ingresos || 0)}`;
  if (dayExpense) dayExpense.textContent = `Egresos: ${formatCurrency(day.egresos || 0)}`;
  if (dayNet) dayNet.textContent = `Neto: ${formatCurrency(day.neto || 0)} (${Number(day.movimientos || 0)} movs)`;
  if (monthIncome) monthIncome.textContent = `Ingresos: ${formatCurrency(month.ingresos || 0)}`;
  if (monthNet) monthNet.textContent = `Neto: ${formatCurrency(month.neto || 0)}`;
  if (monthMovements) monthMovements.textContent = `Movimientos: ${Number(month.movimientos || 0)}`;
  if (openBoxes) openBoxes.innerHTML = formatOpenCajaList(resumen.open_boxes || []);
}

function renderAdvancedMethodBalances() {
  const container = document.getElementById('adv-method-balances');
  if (!container) return;
  const rows = advancedState.saldosMetodo || [];
  if (!rows.length) {
    container.innerHTML = '<span class="px-2 py-1 rounded-lg bg-[#F1F5F9] dark:bg-gray-700 text-[#0F2532] dark:text-gray-200">Sin datos</span>';
    return;
  }
  container.innerHTML = rows.map(item => `
    <span class="px-2 py-1 rounded-lg bg-[#F1F5F9] dark:bg-gray-700 text-[#0F2532] dark:text-gray-200">
      ${escapeHtml(item.metodo)}: ${formatCurrency(item.neto || 0)}
    </span>
  `).join('');
}

function renderAdvancedMovementsTable() {
  const tbody = document.getElementById('adv-mov-table-body');
  const count = document.getElementById('adv-mov-count');
  if (!tbody) return;

  const rows = advancedState.movimientos || [];
  if (count) count.textContent = `${rows.length} registros`;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="px-3 py-6 text-center text-[#0F2532]/60 dark:text-gray-400">Sin movimientos para el filtro seleccionado</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, index) => {
    const isIncome = row.tipo === 'ingreso';
    return `
      <tr>
        <td class="px-3 py-2">${index + 1}</td>
        <td class="px-3 py-2">${escapeHtml(row.hora || '')}</td>
        <td class="px-3 py-2">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${isIncome ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'}">
            ${isIncome ? 'Ingreso' : 'Egreso'}
          </span>
        </td>
        <td class="px-3 py-2">${escapeHtml(row.concepto || '-')}</td>
        <td class="px-3 py-2">${escapeHtml(row.paciente_nombre || '-')}</td>
        <td class="px-3 py-2 font-semibold ${isIncome ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}">${isIncome ? '+' : '-'}${formatCurrency(Math.abs(Number(row.monto || 0)))}</td>
        <td class="px-3 py-2">${escapeHtml(row.metodo || '-')}</td>
        <td class="px-3 py-2">${escapeHtml(row.usuario_nombre || 'Sistema')}</td>
        <td class="px-3 py-2">${escapeHtml(row.caja_nombre || `Caja #${row.caja_id || ''}`)}</td>
      </tr>
    `;
  }).join('');
}

async function refreshAdvancedDashboard() {
  if (!document.getElementById('adv-mov-table-body')) return;
  if (!cajasReportApi) {
    renderAdvancedSummary();
    renderAdvancedMethodBalances();
    renderAdvancedMovementsTable();
    return;
  }

  advancedState.filters = getAdvancedFiltersFromUI();
  setAdvancedLoading(true);
  try {
    const [movementsResult, summaryResult, methodsResult] = await Promise.all([
      cajasReportApi.getMovimientosAvanzado(advancedState.filters),
      cajasReportApi.getResumenContable(advancedState.filters),
      cajasReportApi.getSaldosMetodo(advancedState.filters),
    ]);

    advancedState.movimientos = movementsResult?.rows || [];
    advancedState.resumen = summaryResult || null;
    advancedState.saldosMetodo = methodsResult?.rows || [];

    renderAdvancedSummary();
    renderAdvancedMethodBalances();
    renderAdvancedMovementsTable();
  } catch (error) {
    console.error('Error cargando dashboard contable avanzado', error);
    showNotification('Error cargando movimientos contables', 'error');
  } finally {
    setAdvancedLoading(false);
  }
}

function setupAdvancedDashboardEvents() {
  const btnApply = document.getElementById('adv-apply-filters');
  const btnReset = document.getElementById('adv-reset-filters');
  const btnExportCsv = document.getElementById('adv-export-csv');
  const btnPrint = document.getElementById('adv-print-report');
  btnApply?.addEventListener('click', () => {
    refreshAdvancedDashboard();
  });
  btnReset?.addEventListener('click', () => {
    const dayInput = document.getElementById('adv-filter-day');
    const monthInput = document.getElementById('adv-filter-month');
    const cajaInput = document.getElementById('adv-filter-caja');
    const typeInput = document.getElementById('adv-filter-tipo');
    const userInput = document.getElementById('adv-filter-usuario');

    if (dayInput) dayInput.value = todayISO();
    if (monthInput) monthInput.value = currentMonthISO();
    if (cajaInput) cajaInput.value = '';
    if (typeInput) typeInput.value = '';
    if (userInput) userInput.value = '';
    refreshAdvancedDashboard();
  });
  btnExportCsv?.addEventListener('click', exportAdvancedMovementsCsv);
  btnPrint?.addEventListener('click', printAdvancedReport);
}

async function initAdvancedDashboard() {
  const dayInput = document.getElementById('adv-filter-day');
  const monthInput = document.getElementById('adv-filter-month');
  if (!dayInput || !monthInput) return;

  if (!dayInput.value) dayInput.value = todayISO();
  if (!monthInput.value) monthInput.value = currentMonthISO();

  await loadAdvancedUsersCatalog();
  populateAdvancedCajaFilter();
  setupAdvancedDashboardEvents();
  await refreshAdvancedDashboard();
}
function toCsvCell(value) {
  const str = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 0);
}

function exportAdvancedMovementsCsv() {
  const rows = advancedState.movimientos || [];
  if (!rows.length) {
    showNotification('No hay movimientos para exportar con el filtro actual', 'warning');
    return;
  }

  const summary = advancedState.resumen || {};
  const day = summary.day || {};
  const month = summary.month || {};
  const filters = advancedState.filters || {};

  const lines = [
    ['Reporte', 'Movimientos Contables'].map(toCsvCell).join(','),
    ['Fecha de generacion', new Date().toLocaleString('es-MX')].map(toCsvCell).join(','),
    ['Filtro dia', filters.fecha || ''].map(toCsvCell).join(','),
    ['Filtro mes', filters.mes || ''].map(toCsvCell).join(','),
    ['Filtro caja', filters.caja_id || 'Todas'].map(toCsvCell).join(','),
    ['Filtro tipo', filters.tipo || 'Todos'].map(toCsvCell).join(','),
    ['Filtro usuario', filters.usuario_id || 'Todos'].map(toCsvCell).join(','),
    ['Ingresos dia', day.ingresos || 0].map(toCsvCell).join(','),
    ['Egresos dia', day.egresos || 0].map(toCsvCell).join(','),
    ['Neto dia', day.neto || 0].map(toCsvCell).join(','),
    ['Ingresos mes', month.ingresos || 0].map(toCsvCell).join(','),
    ['Neto mes', month.neto || 0].map(toCsvCell).join(','),
    '',
    ['#', 'Fecha', 'Hora', 'Tipo', 'Concepto', 'Paciente', 'Monto', 'Metodo', 'Usuario', 'Caja', 'Origen'].map(toCsvCell).join(','),
  ];

  rows.forEach((row, index) => {
    lines.push([
      index + 1,
      row.fecha || '',
      row.hora || '',
      row.tipo || '',
      row.concepto || '',
      row.paciente_nombre || '',
      Number(row.monto || 0).toFixed(2),
      row.metodo || '',
      row.usuario_nombre || '',
      row.caja_nombre || `Caja #${row.caja_id || ''}`,
      row.origen || '',
    ].map(toCsvCell).join(','));
  });

  const baseDate = (filters.fecha || filters.mes || todayISO()).replace(/[^0-9-]/g, '');
  const filename = `movimientos_caja_${baseDate || 'reporte'}.csv`;
  downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
  showNotification('CSV exportado correctamente', 'success');
}

function buildAdvancedPrintableReportHtml() {
  const rows = advancedState.movimientos || [];
  const summary = advancedState.resumen || {};
  const day = summary.day || {};
  const month = summary.month || {};
  const filters = advancedState.filters || {};

  const rowsHtml = rows.length
    ? rows.map((row, index) => {
      const isIncome = row.tipo === 'ingreso';
      const amount = `${isIncome ? '+' : '-'}${formatCurrency(Math.abs(Number(row.monto || 0)))}`;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.hora || '')}</td>
          <td>${escapeHtml(isIncome ? 'Ingreso' : 'Egreso')}</td>
          <td>${escapeHtml(row.concepto || '-')}</td>
          <td>${escapeHtml(row.paciente_nombre || '-')}</td>
          <td style="text-align:right; color:${isIncome ? '#047857' : '#BE123C'}; font-weight:700;">${escapeHtml(amount)}</td>
          <td>${escapeHtml(row.metodo || '-')}</td>
          <td>${escapeHtml(row.usuario_nombre || 'Sistema')}</td>
          <td>${escapeHtml(row.caja_nombre || `Caja #${row.caja_id || ''}`)}</td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="9" style="text-align:center; color:#64748B; padding:12px;">Sin movimientos para este filtro</td></tr>';

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte Contable de Cajas</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0F2532; margin: 24px; }
    h1 { margin: 0 0 4px 0; font-size: 22px; color: #1D5D69; }
    p { margin: 2px 0; font-size: 12px; color: #334155; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
    .card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px; }
    .label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: .05em; }
    .value { font-size: 15px; font-weight: 700; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
    th, td { border: 1px solid #E2E8F0; padding: 6px; }
    th { background: #F8FAFC; text-align: left; color: #1D5D69; }
    .muted { color: #64748B; }
  </style>
</head>
<body>
  <h1>Movimientos Contables de Cajas</h1>
  <p class="muted">Generado: ${escapeHtml(new Date().toLocaleString('es-MX'))}</p>
  <p class="muted">Filtros: dia ${escapeHtml(filters.fecha || '-')} | mes ${escapeHtml(filters.mes || '-')} | caja ${escapeHtml(filters.caja_id || 'Todas')} | tipo ${escapeHtml(filters.tipo || 'Todos')} | usuario ${escapeHtml(filters.usuario_id || 'Todos')}</p>

  <div class="grid">
    <div class="card">
      <div class="label">Hoy Ingresos</div>
      <div class="value">${escapeHtml(formatCurrency(day.ingresos || 0))}</div>
      <p>Egresos: ${escapeHtml(formatCurrency(day.egresos || 0))}</p>
      <p>Neto: ${escapeHtml(formatCurrency(day.neto || 0))}</p>
    </div>
    <div class="card">
      <div class="label">Mes Ingresos</div>
      <div class="value">${escapeHtml(formatCurrency(month.ingresos || 0))}</div>
      <p>Movimientos: ${escapeHtml(month.movimientos || 0)}</p>
      <p>Neto: ${escapeHtml(formatCurrency(month.neto || 0))}</p>
    </div>
    <div class="card">
      <div class="label">Registros</div>
      <div class="value">${rows.length}</div>
      <p>Documento interno sin CFDI/SAT</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Hora</th>
        <th>Tipo</th>
        <th>Concepto</th>
        <th>Paciente</th>
        <th>Monto</th>
        <th>Metodo</th>
        <th>Usuario</th>
        <th>Caja</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.print();</script>
</body>
</html>
  `;
}

function printAdvancedReport() {
  const popup = window.open('', '_blank');
  if (!popup) {
    showNotification('No se pudo abrir la vista de impresion', 'error');
    return;
  }

  popup.document.open();
  popup.document.write(buildAdvancedPrintableReportHtml());
  popup.document.close();
}

// Actualizar estadísticas
function updateStats() {
  const cajasAbiertas = cajas.filter(c => c.estado === 'abierta').length;
  const totalDia = cajas
    .filter(c => c.estado === 'abierta')
    .reduce((sum, c) => sum + (c.saldo_inicial + c.total_movimientos), 0);

  const statCajasAbiertas = document.getElementById('statCajasAbiertas');
  const statTotalDia = document.getElementById('statTotalDia');

  if (statCajasAbiertas) statCajasAbiertas.textContent = cajasAbiertas;
  if (statTotalDia) statTotalDia.textContent = formatCurrency(totalDia);
}

// Obtener colores según el tema
function getChartColors() {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    text: isDark ? '#F3F4F6' : '#0F2532',
    grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    tooltipBg: isDark ? '#1F2937' : '#1D5D69',
    tooltipText: '#ffffff'
  };
}

function getCurrencySettings() {
  let currency = 'MXN';

  try {
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    currency = settings.currency || localStorage.getItem('currency') || currency;
  } catch (e) { }

  const localeByCurrency = {
    COP: 'es-CO',
    MXN: 'es-MX',
    EUR: 'es-ES',
    USD: 'en-US',
  };

  return {
    currency,
    locale: localeByCurrency[currency] || 'es-ES',
  };
}

function formatChartCurrency(value) {
  const amount = Number(value || 0);
  const { currency, locale } = getCurrencySettings();

  if (amount === 0) return '$0';

  if (Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(amount / 1000) + 'K';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

// Crear gráfica de movimientos diarios
function createMovimientosChart() {
  const ctx = document.getElementById('movimientosChart');
  if (!ctx) return;

  if (charts.movimientos) {
    charts.movimientos.destroy();
  }

  const colors = getChartColors();

  // Datos reales
  const labels = [];
  const ingresosData = [];
  const egresosData = [];
  
  // Generar ultimos 7 dias
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    
    labels.push(label);
    
    // Buscar datos para este dia
    const dayData = dailyMovements.find(m => m.fecha === dateStr) || { ingresos: 0, egresos: 0 };
    ingresosData.push(dayData.ingresos || 0);
    egresosData.push(dayData.egresos || 0);
  }

  const maxMovementValue = Math.max(...ingresosData, ...egresosData, 0);

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Ingresos',
        data: ingresosData,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      },
      {
        label: 'Egresos',
        data: egresosData,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }
    ]
  };

  charts.movimientos = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: colors.text,
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          padding: 12,
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.text,
            callback: function (value) {
              if (maxMovementValue === 0 && Number(value) !== 0) return '';
              return formatChartCurrency(value);
            }
          },
          grid: {
            color: colors.grid
          }
        },
        x: {
          ticks: { color: colors.text },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Crear gráfica de comparación de cajas
function createComparacionChart() {
  const wrapper = document.getElementById('comparacionChartWrapper');
  if (!wrapper) return;
  let ctx = document.getElementById('comparacionChart');

  if (charts.comparacion) {
    charts.comparacion.destroy();
    charts.comparacion = null;
  }

  const colors = getChartColors();
  const cajasAbiertas = cajas.filter(c => c.estado === 'abierta');

  if (cajasAbiertas.length === 0) {
    wrapper.innerHTML = `
      <div class="flex items-center justify-center h-full text-[#0F2532]/60 dark:text-gray-400">
        <p>No hay cajas abiertas para comparar</p>
      </div>
    `;
    return;
  }

  if (!ctx) {
    wrapper.innerHTML = '<canvas id="comparacionChart"></canvas>';
    ctx = document.getElementById('comparacionChart');
    if (!ctx) return;
  }

  const labels = cajasAbiertas.map(c => c.usuario_nombre.split(' ')[0]);
  const data = cajasAbiertas.map(c => c.saldo_inicial + c.total_movimientos);
  const backgroundColors = [
    'rgba(78, 171, 190, 0.8)',
    'rgba(29, 93, 105, 0.8)',
    'rgba(139, 207, 221, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(251, 191, 36, 0.8)'
  ];

  charts.comparacion = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors.slice(0, cajasAbiertas.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: colors.text,
            padding: 15,
            font: { size: 12 },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          padding: 12,
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return context.label + ': ' + formatCurrency(context.parsed) + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

// Actualizar tema de las gráficas
function updateChartsTheme() {
  createMovimientosChart();
  createComparacionChart();
}

// Configurar observador de cambios de tema
function setupThemeObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        updateChartsTheme();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
}


// Cambiar de tab
function switchTab(tabName) {
  currentTab = tabName;

  // Actualizar clases de botones
  document.querySelectorAll('.tab-button').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  renderCurrentTab();
}

// Renderizar tab actual
function renderCurrentTab() {
  const container = document.getElementById('tabContent');
  if (!container) return;

  let filteredCajas = [];

  switch (currentTab) {
    case 'abiertas':
      filteredCajas = cajas.filter(c => c.estado === 'abierta');
      break;
    case 'cerradas':
      filteredCajas = cajas.filter(c => c.estado === 'cerrada');
      break;
    case 'mi-caja':
      // En producción, filtrar por usuario actual
      const currentUserId = getCurrentUserId();
      filteredCajas = cajas.filter(c =>
        Number(c.usuario_id) === Number(currentUserId) && c.estado === 'abierta'
      );
      break;
  }

  const search = String(searchQuery || '').trim().toLowerCase();
  if (search) {
    filteredCajas = filteredCajas.filter(c =>
      String(c.usuario_nombre || '').toLowerCase().includes(search) ||
      String(c.notas || '').toLowerCase().includes(search) ||
      String(c.id || '').includes(search)
    );
  }

  if (filteredCajas.length === 0) {
    const isSearching = !!search;
    container.innerHTML = `
      <div class="text-center py-16">
        <svg class="w-20 h-20 mx-auto text-[#D9D9D9] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p class="text-[#0F2532]/60 text-lg font-medium">${isSearching ? 'No se encontraron cajas con ese filtro' : `No hay cajas ${currentTab === 'abiertas' ? 'abiertas' : currentTab === 'cerradas' ? 'cerradas' : 'asignadas'}`}</p>
        <p class="text-[#0F2532]/40 text-sm mt-2">
          ${isSearching ? 'Prueba con otro nombre, nota o ID de caja' : currentTab === 'abiertas' ? 'Haz clic en "Abrir Caja" para comenzar' : 'No se encontraron registros'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white">
          <tr>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Usuario</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Apertura</th>
            ${currentTab === 'cerradas' ? '<th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Cierre</th>' : ''}
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Saldo Inicial</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Movimientos</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Total Acumulado</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Estado</th>
            <th class="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-[#E6E6E6]">
          ${filteredCajas.map(caja => renderCajaRow(caja)).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Adjuntar event listeners
  attachRowEventListeners();
}

// Renderizar fila de caja
function renderCajaRow(caja) {
  const totalAcumulado = caja.saldo_inicial + caja.total_movimientos;
  const canManage = canManageCaja(caja);
  const fechaApertura = new Date(caja.fecha_apertura).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let fechaCierre = '';
  if (caja.fecha_cierre) {
    fechaCierre = new Date(caja.fecha_cierre).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return `
    <tr class="caja-card hover:bg-[#F8F7F7] transition" data-caja-id="${caja.id}">
      <td class="px-6 py-4">
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] flex items-center justify-center text-white font-bold mr-3">
            ${escapeHtml(caja.usuario_nombre.charAt(0))}
          </div>
          <div>
            <div class="font-semibold text-[#0F2532]">${escapeHtml(caja.usuario_nombre)}</div>
            ${caja.notas ? `<div class="text-xs text-[#0F2532]/60">${escapeHtml(caja.notas)}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-sm text-[#0F2532]/80">${fechaApertura}</td>
      ${currentTab === 'cerradas' ? `<td class="px-6 py-4 text-sm text-[#0F2532]/80">${fechaCierre}</td>` : ''}
      <td class="px-6 py-4 text-sm font-medium text-[#0F2532]">${formatCurrency(caja.saldo_inicial)}</td>
      <td class="px-6 py-4 text-sm font-medium ${caja.total_movimientos > 0 ? 'text-green-600' : 'text-[#0F2532]/60'}">${formatCurrency(caja.total_movimientos)}</td>
      <td class="px-6 py-4 text-lg font-bold text-[#1D5D69]">${formatCurrency(totalAcumulado)}</td>
      <td class="px-6 py-4">
        <span class="status-badge ${caja.estado === 'abierta' ? 'status-open' : 'status-closed'}">
          ${caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </span>
      </td>
      <td class="px-6 py-4 text-center">
        <button 
          class="btn-ver-detalle inline-flex items-center px-4 py-2 bg-[#4EABBE] text-white rounded-lg hover:bg-[#1D5D69] transition font-medium text-sm"
          data-caja-id="${caja.id}"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          Ver Detalle
        </button>
        ${caja.estado === 'abierta' && canManage ? `
          <button 
            class="btn-cerrar-caja ml-2 inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm"
            data-caja-id="${caja.id}"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            Cerrar Caja
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

// Adjuntar event listeners a las filas
function attachRowEventListeners() {
  // Ver detalle
  document.querySelectorAll('.btn-ver-detalle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cajaId = btn.getAttribute('data-caja-id');
      showDetalleCaja(cajaId);
    });
  });

  // Cerrar caja
  document.querySelectorAll('.btn-cerrar-caja').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cajaId = btn.getAttribute('data-caja-id');
      showCerrarCajaModal(cajaId);
    });
  });
}

// Filtrar cajas por búsqueda
function filterCajas(query) {
  searchQuery = query || '';
  renderCurrentTab();
}

// Modal para abrir caja
function showAbrirCajaModal() {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-in">
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Abrir Nueva Caja</h3>
        <p class="text-white/80 text-sm mt-1">Registra la apertura de caja</p>
      </div>
      <form id="formAbrirCaja" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Saldo Inicial *</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-[#0F2532]/60 dark:text-gray-400 font-medium">$</span>
            <input 
              type="number" 
              id="saldoInicial" 
              required 
              min="0"
              step="0.01"
              placeholder="0.00"
              class="w-full pl-8 pr-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Notas (opcional)</label>
          <textarea 
            id="notasCaja" 
            rows="3"
            placeholder="Ej: Caja principal, Caja 2..."
            class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white"
          ></textarea>
        </div>
        <div class="flex gap-3 pt-4">
          <button 
            type="button" 
            id="btnCancelarAbrir" 
            class="flex-1 py-3 border-2 border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 font-semibold text-[#0F2532] dark:text-white transition"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            class="flex-1 py-3 bg-gradient-to-r from-[#4EABBE] to-[#1D5D69] text-white rounded-xl hover:shadow-lg font-semibold transition"
          >
            Abrir Caja
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.querySelector('#btnCancelarAbrir').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#formAbrirCaja').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saldoInicial = parseFloat(document.getElementById('saldoInicial').value);
    const notas = document.getElementById('notasCaja').value.trim();

    try {
      const usuarioId = getCurrentUserId();
      if (!usuarioId) {
        showNotification('No hay usuario en sesion', 'error');
        return;
      }
      if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
        showNotification('Saldo inicial invalido', 'error');
        return;
      }

      const cajaAbierta = await dbGet(
        'SELECT id FROM cajas WHERE usuario_id = ? AND estado = ? ORDER BY fecha_apertura DESC LIMIT 1',
        [usuarioId, 'abierta']
      );
      if (cajaAbierta) {
        showNotification('Ya tienes una caja abierta. Debes cerrarla antes de abrir otra.', 'warning');
        return;
      }

      const insertResult = await dbRun(
        'INSERT INTO cajas (usuario_id, saldo_inicial, notas, estado) VALUES (?, ?, ?, ?)',
        [usuarioId, saldoInicial, notas || null, 'abierta']
      );
      const nuevaCajaId = Number(insertResult?.lastID || 0) || null;
      await writeFinanceAudit(
        'abrir_caja',
        'caja',
        nuevaCajaId,
        {
          caja_id: nuevaCajaId,
          saldo_inicial: saldoInicial,
          notas: notas || null,
          origen: 'cajas_ui',
        },
        usuarioId
      );

      await loadCajas();
      renderCurrentTab();
      await refreshAdvancedDashboard();

      overlay.remove();

      // Notificacion de exito
      showNotification('Caja abierta exitosamente', 'success');
    } catch (error) {
      console.error('Error abriendo caja:', error);
      const msg = String(error?.message || '');
      if (msg.includes('idx_cajas_open_user_unique') || msg.includes('cajas.usuario_id')) {
        showNotification('Ya existe una caja abierta para este usuario.', 'warning');
      } else {
        showNotification('Error al abrir la caja', 'error');
      }
    }
  });
}

// Modal para cerrar caja
function showCerrarCajaModal(cajaId) {
  const caja = cajas.find(c => c.id == cajaId);
  if (!caja) return;
  if (!canManageCaja(caja)) {
    showNotification('No tienes permisos para cerrar esta caja', 'error');
    return;
  }

  const totalAcumulado = caja.saldo_inicial + caja.total_movimientos;
  const movimientosClass = caja.total_movimientos >= 0 ? 'text-green-600' : 'text-red-600';

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-in">
      <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Cerrar Caja</h3>
        <p class="text-white/80 text-sm mt-1">${escapeHtml(caja.usuario_nombre)}</p>
      </div>
      <div class="p-6 space-y-4">
        <div class="bg-gradient-to-br from-[#4EABBE]/10 to-[#1D5D69]/10 p-4 rounded-xl">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[#0F2532]/60 dark:text-gray-400 text-sm">Saldo Inicial</span>
            <span class="font-bold text-[#0F2532] dark:text-white">${formatCurrency(caja.saldo_inicial)}</span>
          </div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-[#0F2532]/60 dark:text-gray-400 text-sm">Movimientos</span>
            <span class="font-bold ${movimientosClass}">${formatCurrency(caja.total_movimientos)}</span>
          </div>
          <div class="border-t border-[#0F2532]/20 dark:border-gray-600 pt-2 mt-2">
            <div class="flex justify-between items-center">
              <span class="text-[#0F2532] dark:text-white font-semibold">Total Esperado</span>
              <span class="font-bold text-2xl text-[#1D5D69] dark:text-[#4EABBE]">${formatCurrency(totalAcumulado)}</span>
            </div>
          </div>
        </div>
        
        <div class="space-y-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <p class="text-sm font-semibold text-blue-900 dark:text-blue-100">Realiza el arqueo de caja</p>
                <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">Cuenta el efectivo y registra las denominaciones para un cierre preciso</p>
              </div>
            </div>
          </div>

          <button 
            type="button"
            id="btnArqueoCaja"
            class="w-full py-4 bg-gradient-to-r from-[#4EABBE] to-[#1D5D69] text-white rounded-xl hover:shadow-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a22 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            Realizar Arqueo de Caja
          </button>
          
          <div class="flex gap-3">
            <button 
              type="button" 
              id="btnCancelarCerrar" 
              class="flex-1 py-3 border-2 border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 font-semibold text-[#0F2532] dark:text-white transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.querySelector('#btnCancelarCerrar').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Botón de arqueo
  overlay.querySelector('#btnArqueoCaja').addEventListener('click', () => {
    overlay.remove();
    showArqueoCajaModal(cajaId, totalAcumulado);
  });
}

// Modal de Arqueo de Caja con denominaciones
function showArqueoCajaModal(cajaId, totalEsperado) {
  const caja = cajas.find(c => c.id == cajaId);
  if (!caja) return;

  const denominaciones = {
    billetes: [
      { valor: 1000, cantidad: 0 },
      { valor: 500, cantidad: 0 },
      { valor: 200, cantidad: 0 },
      { valor: 100, cantidad: 0 },
      { valor: 50, cantidad: 0 },
      { valor: 20, cantidad: 0 }
    ],
    monedas: [
      { valor: 20, cantidad: 0 },
      { valor: 10, cantidad: 0 },
      { valor: 5, cantidad: 0 },
      { valor: 2, cantidad: 0 },
      { valor: 1, cantidad: 0 },
      { valor: 0.50, cantidad: 0 }
    ]
  };

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in overflow-y-auto p-4';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl my-8 animate-slide-in">
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Arqueo de Caja #${caja.id}</h3>
        <p class="text-white/80 text-sm mt-1">${escapeHtml(caja.usuario_nombre)}</p>
      </div>
      
      <div class="p-6 max-h-[70vh] overflow-y-auto">
        <!-- Resumen esperado -->
        <div class="bg-gradient-to-br from-[#4EABBE]/10 to-[#1D5D69]/10 p-4 rounded-xl mb-6">
          <div class="flex justify-between items-center">
            <span class="text-[#0F2532]/60 dark:text-gray-400 text-sm font-medium">Total Esperado</span>
            <span class="font-bold text-2xl text-[#1D5D69] dark:text-[#4EABBE]">${formatCurrency(totalEsperado)}</span>
          </div>
        </div>

        <!-- Billetes -->
        <div class="mb-6">
          <h4 class="text-lg font-bold text-[#0F2532] dark:text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Billetes
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${denominaciones.billetes.map(d => `
              <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:border-[#4EABBE] transition">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-lg font-bold text-[#1D5D69] dark:text-[#4EABBE]">$${d.valor}</span>
                  <span class="text-xs text-[#0F2532]/60 dark:text-gray-400 font-medium">Cantidad</span>
                </div>
                <div class="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="0" 
                    value="0"
                    data-tipo="billete"
                    data-valor="${d.valor}"
                    class="denominacion-input flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-800 text-[#0F2532] dark:text-white font-semibold text-center"
                  />
                  <span class="subtotal-denominacion text-sm font-bold text-green-600 dark:text-green-400 min-w-[80px] text-right">$0</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Monedas -->
        <div class="mb-6">
          <h4 class="text-lg font-bold text-[#0F2532] dark:text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Monedas
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${denominaciones.monedas.map(d => `
              <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:border-[#4EABBE] transition">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-lg font-bold text-[#1D5D69] dark:text-[#4EABBE]">$${d.valor}</span>
                  <span class="text-xs text-[#0F2532]/60 dark:text-gray-400 font-medium">Cantidad</span>
                </div>
                <div class="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="0" 
                    value="0"
                    data-tipo="moneda"
                    data-valor="${d.valor}"
                    class="denominacion-input flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-800 text-[#0F2532] dark:text-white font-semibold text-center"
                  />
                  <span class="subtotal-denominacion text-sm font-bold text-green-600 dark:text-green-400 min-w-[80px] text-right">$0</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Total contado y diferencia -->
        <div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-600">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400 mb-1">Total Contado</p>
              <p id="totalContado" class="text-3xl font-bold text-[#1D5D69] dark:text-[#4EABBE]">$0.00</p>
            </div>
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400 mb-1">Diferencia</p>
              <p id="diferencia" class="text-3xl font-bold text-gray-500 dark:text-gray-400">$0.00</p>
            </div>
          </div>
          <div id="alertaDiferencia" class="hidden mt-4"></div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 dark:bg-gray-900 p-6 rounded-b-2xl flex gap-3">
        <button 
          id="btnCancelarArqueo" 
          class="flex-1 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold text-[#0F2532] dark:text-white transition"
        >
          Cancelar
        </button>
        <button 
          id="btnConfirmarArqueo" 
          class="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg font-semibold transition"
        >
          Confirmar y Cerrar Caja
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Función para calcular totales
  function calcularTotales() {
    let totalContado = 0;
    const inputs = overlay.querySelectorAll('.denominacion-input');

    inputs.forEach(input => {
      const cantidad = parseInt(input.value) || 0;
      const valor = parseFloat(input.dataset.valor);
      const subtotal = cantidad * valor;

      // Actualizar subtotal de la denominación
      const subtotalElement = input.parentElement.querySelector('.subtotal-denominacion');
      subtotalElement.textContent = formatCurrency(subtotal);

      totalContado += subtotal;
    });

    // Actualizar total contado
    const totalContadoElement = overlay.querySelector('#totalContado');
    totalContadoElement.textContent = formatCurrency(totalContado);

    // Calcular y mostrar diferencia
    const diferencia = totalContado - totalEsperado;
    const diferenciaElement = overlay.querySelector('#diferencia');
    const alertaElement = overlay.querySelector('#alertaDiferencia');

    diferenciaElement.textContent = formatCurrency(Math.abs(diferencia));

    if (Math.abs(diferencia) < 0.01) {
      diferenciaElement.className = 'text-3xl font-bold text-green-600 dark:text-green-400';
      alertaElement.className = 'hidden';
    } else if (diferencia > 0) {
      diferenciaElement.className = 'text-3xl font-bold text-green-600 dark:text-green-400';
      alertaElement.className = 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2';
      alertaElement.innerHTML = `
        <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="text-sm font-medium text-green-800 dark:text-green-200">Sobrante de ${formatCurrency(diferencia)}</span>
      `;
    } else {
      diferenciaElement.className = 'text-3xl font-bold text-red-600 dark:text-red-400';
      alertaElement.className = 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2';
      alertaElement.innerHTML = `
        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="text-sm font-medium text-red-800 dark:text-red-200">Faltante de ${formatCurrency(Math.abs(diferencia))}</span>
      `;
    }

    return { totalContado, diferencia };
  }

  // Event listeners para inputs
  overlay.querySelectorAll('.denominacion-input').forEach(input => {
    input.addEventListener('input', calcularTotales);
  });

  // Cancelar
  overlay.querySelector('#btnCancelarArqueo').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Confirmar arqueo y cerrar caja
  overlay.querySelector('#btnConfirmarArqueo').addEventListener('click', async () => {
    const { totalContado, diferencia } = calcularTotales();

    // Confirmar si hay diferencia significativa
    if (Math.abs(diferencia) > 50) {
      const confirmClose = confirm(
        `Hay una diferencia de ${formatCurrency(Math.abs(diferencia))} ${diferencia > 0 ? 'a favor' : 'en contra'}.\n\n¿Deseas cerrar la caja de todas formas?`
      );
      if (!confirmClose) return;
    }

    // Recopilar arqueo
    const arqueo = {
      billetes: {},
      monedas: {},
      totalContado: totalContado,
      diferencia: diferencia
    };

    overlay.querySelectorAll('.denominacion-input').forEach(input => {
      const tipo = input.dataset.tipo;
      const valor = input.dataset.valor;
      const cantidad = parseInt(input.value) || 0;

      if (cantidad > 0) {
        if (tipo === 'billete') {
          arqueo.billetes[valor] = cantidad;
        } else {
          arqueo.monedas[valor] = cantidad;
        }
      }
    });

    // Cerrar caja con arqueo
    try {
      const usuarioId = getCurrentUserId();
      if (!usuarioId) {
        showNotification('No hay usuario en sesion', 'error');
        return;
      }

      const updateResult = await dbRun(
        `UPDATE cajas
         SET estado = ?, fecha_cierre = CURRENT_TIMESTAMP, saldo_final = ?, arqueo = ?
         WHERE id = ?
           AND estado = 'abierta'
           AND (usuario_id = ? OR ? = 1)`,
        ['cerrada', totalContado, JSON.stringify(arqueo), cajaId, usuarioId, isAdminUser() ? 1 : 0]
      );
      const changes = Number(updateResult?.changes || 0);
      if (!changes) {
        throw new Error('No autorizado o la caja ya fue cerrada');
      }
      await writeFinanceAudit(
        'cerrar_caja',
        'caja',
        Number(cajaId),
        {
          caja_id: Number(cajaId),
          saldo_final: totalContado,
          diferencia,
          arqueo,
          origen: 'cajas_ui',
        },
        usuarioId
      );

      await loadCajas();
      renderCurrentTab();
      await refreshAdvancedDashboard();
      overlay.remove();

      showNotification('Caja cerrada exitosamente con arqueo completo', 'success');
    } catch (error) {
      console.error('Error cerrando caja:', error);
      showNotification('Error al cerrar la caja', 'error');
    }
  });
}


// Ver detalle de caja
async function showDetalleCaja(cajaId) {
  const caja = cajas.find(c => c.id == cajaId);
  if (!caja) return;

  let movimientos = [];
  if (db) {
    try {
      movimientos = await dbAll(`
        SELECT 
          m.id, m.tipo, m.monto, m.concepto, m.fecha,
          TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, u.apellidos, '')) as usuario
        FROM movimientos_caja m
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.caja_id = ?
        ORDER BY m.fecha ASC, m.id ASC
      `, [cajaId]);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      movimientos = [];
    }
  }

  movimientos = (movimientos || []).map(m => ({
    ...m,
    monto: Math.abs(Number(m.monto || 0)),
    usuario: (m.usuario || '').trim() || 'Sistema'
  }));

  const totalAcumulado = caja.saldo_inicial + caja.total_movimientos;
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0);
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0);

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fade-in';
  overlay.innerHTML = `
    <div class="glass-card w-full max-w-5xl mx-4 rounded-2xl shadow-2xl animate-slide-in overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-3xl font-bold">Detalle de Caja #${caja.id}</h3>
            <p class="text-white/80 text-sm mt-1">${escapeHtml(caja.usuario_nombre)}</p>
          </div>
          <button id="btnCloseDetail" class="text-white/80 hover:text-white transition p-2 rounded-lg hover:bg-white/10">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 max-h-[70vh] overflow-y-auto dark:bg-gray-800">
        <!-- Resumen financiero -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Saldo Inicial</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(caja.saldo_inicial)}</p>
          </div>
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Ingresos</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(totalIngresos)}</p>
          </div>
          <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Egresos</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(totalEgresos)}</p>
          </div>
          <div class="bg-gradient-to-br from-[#1D5D69] to-[#4EABBE] rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Total Acumulado</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(totalAcumulado)}</p>
          </div>
        </div>

        <!-- Información de la caja -->
        <div class="bg-white dark:bg-gray-700 rounded-xl p-4 mb-6">
          <h4 class="font-bold text-lg text-[#0F2532] dark:text-white mb-3">Información</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Fecha de apertura</p>
              <p class="font-medium text-[#0F2532] dark:text-white">${new Date(caja.fecha_apertura).toLocaleString('es-ES')}</p>
            </div>
            ${caja.fecha_cierre ? `
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Fecha de cierre</p>
              <p class="font-medium text-[#0F2532] dark:text-white">${new Date(caja.fecha_cierre).toLocaleString('es-ES')}</p>
            </div>
            ` : ''}
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Estado</p>
              <span class="status-badge ${caja.estado === 'abierta' ? 'status-open' : 'status-closed'}">
                ${caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
            ${caja.notas ? `
            <div class="col-span-2">
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Notas</p>
              <p class="font-medium text-[#0F2532] dark:text-white">${escapeHtml(caja.notas)}</p>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Historial de movimientos -->
        <div class="bg-white dark:bg-gray-700 rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <h4 class="font-bold text-lg text-[#0F2532] dark:text-white">Historial de Movimientos</h4>
            ${caja.estado === 'abierta' && canManageCaja(caja) ? `
              <button id="btnNuevoMovimiento" class="action-button text-sm py-2 px-4">
                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Nuevo Movimiento
              </button>
            ` : ''}
          </div>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            ${movimientos.length === 0 ? `
              <p class="text-center text-[#0F2532]/60 dark:text-gray-400 py-8">No hay movimientos registrados</p>
            ` : movimientos.map(mov => `
              <div class="flex items-center justify-between p-3 rounded-lg ${mov.tipo === 'ingreso' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center ${mov.tipo === 'ingreso' ? 'bg-green-500' : 'bg-red-500'}">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      ${mov.tipo === 'ingreso' ?
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m0-16l-4 4m4-4l4 4"/>' :
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20V4m0 16l-4-4m4 4l4-4"/>'}
                    </svg>
                  </div>
                  <div>
                    <p class="font-semibold text-[#0F2532] dark:text-white">${escapeHtml(mov.concepto)}</p>
                    <p class="text-xs text-[#0F2532]/60 dark:text-gray-400">${new Date(mov.fecha).toLocaleString('es-ES')} - ${escapeHtml(mov.usuario)}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-lg font-bold ${mov.tipo === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                    ${mov.tipo === 'ingreso' ? '+' : '-'}${formatCurrency(Math.abs(mov.monto))}
                  </p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 dark:bg-gray-900 p-4 flex justify-between items-center">
        <button id="btnExportarReporte" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium">
          <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Exportar Reporte
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.querySelector('#btnCloseDetail')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnExportarReporte')?.addEventListener('click', () => {
    showNotification('Exportando reporte...', 'info');
    // Simulación de exportación
    setTimeout(() => {
      showNotification('Reporte exportado exitosamente', 'success');
    }, 1500);
  });

  overlay.querySelector('#btnNuevoMovimiento')?.addEventListener('click', () => {
    showNuevoMovimientoModal(cajaId);
  });
}

// Modal para nuevo movimiento
function showNuevoMovimientoModal(cajaId) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 modal-overlay flex items-center justify-center z-[60] animate-fade-in';
  overlay.innerHTML = `
    <div class="glass-card w-full max-w-md mx-4 rounded-2xl shadow-2xl animate-slide-in">
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Nuevo Movimiento</h3>
        <p class="text-white/80 text-sm mt-1">Registra un ingreso o egreso</p>
      </div>
      <form id="formNuevoMovimiento" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Tipo de Movimiento *</label>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" class="tipo-btn ingreso-btn bg-green-500 text-white py-3 rounded-xl font-semibold transition hover:bg-green-600 active" data-tipo="ingreso">
              <svg class="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m0-16l-4 4m4-4l4 4"/>
              </svg>
              Ingreso
            </button>
            <button type="button" class="tipo-btn egreso-btn bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition hover:bg-red-500 hover:text-white" data-tipo="egreso">
              <svg class="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20V4m0 16l-4-4m4 4l4-4"/>
              </svg>
              Egreso
            </button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Monto *</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-[#0F2532]/60 dark:text-gray-400 font-medium">$</span>
            <input type="number" id="montoMovimiento" required min="0" step="0.01" placeholder="0.00"
              class="w-full pl-8 pr-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white"/>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Método</label>
          <select id="metodoMovimiento"
            class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white">
            <option value="">No especificado</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Cheque">Cheque</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Concepto *</label>
          <input type="text" id="conceptoMovimiento" required placeholder="Ej: Pago de consulta, Compra material..."
            class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white"/>
        </div>
        <div class="flex gap-3 pt-4">
          <button type="button" id="btnCancelarMovimiento" class="flex-1 py-3 border-2 border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 font-semibold text-[#0F2532] dark:text-white transition">
            Cancelar
          </button>
          <button type="submit" class="flex-1 py-3 action-button">
            Registrar
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  let tipoSeleccionado = 'ingreso';

  // Event listeners para tipo
  overlay.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.querySelectorAll('.tipo-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.tipo === 'ingreso') {
          b.className = 'tipo-btn ingreso-btn bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition hover:bg-green-500 hover:text-white';
        } else {
          b.className = 'tipo-btn egreso-btn bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition hover:bg-red-500 hover:text-white';
        }
      });
      btn.classList.add('active');
      tipoSeleccionado = btn.dataset.tipo;
      if (tipoSeleccionado === 'ingreso') {
        btn.className = 'tipo-btn ingreso-btn bg-green-500 text-white py-3 rounded-xl font-semibold transition hover:bg-green-600 active';
      } else {
        btn.className = 'tipo-btn egreso-btn bg-red-500 text-white py-3 rounded-xl font-semibold transition hover:bg-red-600 active';
      }
    });
  });

  overlay.querySelector('#btnCancelarMovimiento').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#formNuevoMovimiento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const montoRaw = parseFloat(document.getElementById('montoMovimiento').value);
    const concepto = document.getElementById('conceptoMovimiento').value.trim();
    const metodo = document.getElementById('metodoMovimiento')?.value || null;

    if (!db) {
      showNotification('DB no disponible', 'error');
      return;
    }
    if (!Number.isFinite(montoRaw) || montoRaw <= 0) {
      showNotification('Monto invalido', 'error');
      return;
    }
    if (!concepto) {
      showNotification('Concepto requerido', 'warning');
      return;
    }

    const monto = Math.abs(montoRaw);
    const usuarioId = getCurrentUserId();
    if (!usuarioId) {
      showNotification('No hay usuario en sesion', 'error');
      return;
    }

    try {
      const cajaActual = await dbGet(
        'SELECT id, usuario_id, estado FROM cajas WHERE id = ? LIMIT 1',
        [cajaId]
      );
      if (!cajaActual || cajaActual.estado !== 'abierta') {
        showNotification('La caja esta cerrada', 'error');
        return;
      }
      if (!canManageCaja(cajaActual)) {
        showNotification('No tienes permisos para registrar movimientos en esta caja', 'error');
        return;
      }

      const insertResult = await dbRun(
        `INSERT INTO movimientos_caja
         (caja_id, tipo, monto, concepto, usuario_id, pago_id, paciente_id, metodo, origen)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 'manual')`,
        [cajaId, tipoSeleccionado, monto, concepto, usuarioId, metodo]
      );
      const movimientoId = Number(insertResult?.lastID || 0) || null;
      await writeFinanceAudit(
        'movimiento_caja_manual',
        'movimiento_caja',
        movimientoId,
        {
          movimiento_id: movimientoId,
          caja_id: Number(cajaId),
          tipo: tipoSeleccionado,
          monto,
          concepto,
          metodo: metodo || null,
          origen: 'cajas_ui',
        },
        usuarioId
      );

      await loadCajas();
      renderCurrentTab();
      await refreshAdvancedDashboard();
      overlay.remove();
      showNotification(`${tipoSeleccionado === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado exitosamente`, 'success');

      setTimeout(() => {
        showDetalleCaja(cajaId);
      }, 200);
    } catch (error) {
      console.error('Error registrando movimiento:', error);
      showNotification('Error al registrar movimiento', 'error');
    }
  });
}

// Notificación toast mejorada
function showNotification(message, type = 'info') {
  toast.show(message, type);
}



// Formatear moneda
function formatCurrency(amount) {
    let currency = 'MXN';

    try {
        const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
        currency = settings.currency || localStorage.getItem('currency') || currency;
    } catch (e) { }

    const getLocale = () => {
        if (currency === 'COP') return 'es-CO';
        if (currency === 'MXN') return 'es-MX';
        if (currency === 'EUR') return 'es-ES';
        if (currency === 'USD') return 'en-US';
        return 'es-ES';
    };

    return new Intl.NumberFormat(getLocale(), {
        style: 'currency',
        currency
    }).format(amount);
  }

