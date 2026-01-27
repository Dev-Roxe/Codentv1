// reportes.js - Sistema de reportes y análisis
import toast from './toast.js';

let db;
if (window.api && window.api.db) db = window.api.db;

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

/* ============================================================================
   STATE
============================================================================ */
const State = {
    startDate: null,
    endDate: null,
    charts: {
        ingresos: null,
        citas: null
    },
    data: {
        ingresos: 0,
        citas: 0,
        pacientes: 0,
        tratamientos: [],
        ingresosMensuales: { labels: [], data: [] },
        usaMovimientos: false,
        citasEstado: {
            completadas: 0,
            pendientes: 0,
            canceladas: 0,
            noAsistio: 0
        }
    }
};

/* ============================================================================
   UTILITIES
============================================================================ */
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
    }).format(amount || 0);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function showToast(message, type = 'info') {
    toast.show(message, type);
}

function setDateRange(period) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date();

    switch (period) {
        case 'week':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            break;
    }

    State.startDate = start.toISOString().split('T')[0];
    State.endDate = end.toISOString().split('T')[0];

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    if (startInput) startInput.value = State.startDate;
    if (endInput) endInput.value = State.endDate;
}

function getChartColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        text: isDark ? '#e2e8f0' : '#0F2532',
        grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        tooltipBg: isDark ? '#1e293b' : '#1D5D69',
        tooltipText: '#ffffff'
    };
}

/* ============================================================================
   DATA LOADING
============================================================================ */
async function loadReportData() {
    if (!db) {
        // Mock data para testing
        loadMockData();
        return;
    }

    try {
        const ingresosQuery = `
            SELECT COUNT(*) as total_citas, SUM(COALESCE(monto, 0)) as total_ingresos
            FROM citas
            WHERE date(fecha_hora) BETWEEN ? AND ?
            AND estado = 'atendido'
        `;
        const recetasQuery = `
            SELECT SUM(COALESCE(costo, 0)) as total_recetas
            FROM tratamientos
            WHERE date(fecha) BETWEEN ? AND ?
            AND (procedimiento LIKE 'Receta:%' OR procedimiento LIKE 'Receta M%')
        `;
        const movimientosQuery = `
            SELECT SUM(CASE WHEN tipo = 'ingreso' THEN 1 ELSE 0 END) as total_ingresos_count,
                   SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) as total_ingresos
            FROM movimientos_caja
            WHERE date(fecha) BETWEEN ? AND ?
        `;

        const ingresosResult = await dbGet(ingresosQuery, [State.startDate, State.endDate]);
        const recetasResult = await dbGet(recetasQuery, [State.startDate, State.endDate]);
        const movimientosResult = await dbGet(movimientosQuery, [State.startDate, State.endDate]);
        const legacyIngresos = Number(ingresosResult?.total_ingresos || 0) + Number(recetasResult?.total_recetas || 0);
        const movimientosIngresos = Number(movimientosResult?.total_ingresos || 0);
        const movimientosCount = Number(movimientosResult?.total_ingresos_count || 0);

        State.data.usaMovimientos = movimientosCount > 0;
        State.data.ingresos = State.data.usaMovimientos ? movimientosIngresos : legacyIngresos;
        State.data.citas = Number(ingresosResult?.total_citas || 0);

        const pacientesQuery = `
            SELECT COUNT(*) as total
            FROM pacientes
            WHERE date(created_at) BETWEEN ? AND ?
        `;
        const pacientesResult = await dbGet(pacientesQuery, [State.startDate, State.endDate]);
        State.data.pacientes = Number(pacientesResult?.total || 0);

        State.data.tratamientos = await loadTratamientosResumen();
        State.data.ingresosMensuales = await loadIngresosMensuales();
        State.data.citasEstado = await loadCitasEstado();

        updateKPIs();
        updateCharts();
        updateTratamientosTable();

    } catch (err) {
        console.error('Error cargando datos:', err);
        showToast('Error cargando datos del reporte', 'error');
        loadMockData();
    }
}

function loadMockData() {
    State.data = {
        ingresos: 125400,
        citas: 87,
        pacientes: 23,
        tratamientos: getMockTratamientos(),
        ingresosMensuales: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            data: [45000, 52000, 48000, 61000, 58000, 67000, 72000, 68000, 75000, 82000, 79000, 85000]
        },
        usaMovimientos: false,
        citasEstado: {
            completadas: 65,
            pendientes: 20,
            canceladas: 10,
            noAsistio: 5
        }
    };

    updateKPIs();
    updateCharts();
    updateTratamientosTable();
}

function getMockTratamientos() {
    return [
        { nombre: 'Limpieza Dental', cantidad: 45, ingresos: 22500, promedio: 500 },
        { nombre: 'Blanqueamiento', cantidad: 18, ingresos: 27000, promedio: 1500 },
        { nombre: 'Ortodoncia', cantidad: 12, ingresos: 48000, promedio: 4000 },
        { nombre: 'Endodoncia', cantidad: 8, ingresos: 16000, promedio: 2000 },
        { nombre: 'Extracción', cantidad: 15, ingresos: 7500, promedio: 500 }
    ];
}

function buildMonthBuckets(startDate, endDate) {
    if (!startDate || !endDate) return [];
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const buckets = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const label = cursor.toLocaleString('es-MX', { month: 'short' });
        buckets.push({ key, label });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
}

async function loadIngresosMensuales() {
    const buckets = buildMonthBuckets(State.startDate, State.endDate);
    if (!buckets.length) {
        return { labels: ['N/A'], data: [0] };
    }
    let rows = [];
    if (State.data.usaMovimientos) {
        rows = await dbAll(`
            SELECT strftime('%Y-%m', fecha) as mes, SUM(COALESCE(monto, 0)) as total
            FROM movimientos_caja
            WHERE date(fecha) BETWEEN ? AND ?
            AND tipo = 'ingreso'
            GROUP BY mes
            ORDER BY mes
        `, [State.startDate, State.endDate]);
    } else {
        rows = await dbAll(`
            SELECT strftime('%Y-%m', fecha) as mes, SUM(ingreso) as total
            FROM (
                SELECT fecha_hora as fecha, COALESCE(monto, 0) as ingreso
                FROM citas
                WHERE date(fecha_hora) BETWEEN ? AND ?
                AND estado = 'atendido'
                UNION ALL
                SELECT fecha as fecha, COALESCE(costo, 0) as ingreso
                FROM tratamientos
                WHERE date(fecha) BETWEEN ? AND ?
                AND (procedimiento LIKE 'Receta:%' OR procedimiento LIKE 'Receta M%')
            )
            GROUP BY mes
            ORDER BY mes
        `, [State.startDate, State.endDate, State.startDate, State.endDate]);
    }

    const totalsByMonth = new Map(rows.map(r => [r.mes, Number(r.total || 0)]));
    return {
        labels: buckets.map(b => b.label),
        data: buckets.map(b => totalsByMonth.get(b.key) || 0)
    };
}

async function loadCitasEstado() {
    const rows = await dbAll(`
        SELECT estado, COUNT(*) as total
        FROM citas
        WHERE date(fecha_hora) BETWEEN ? AND ?
        GROUP BY estado
    `, [State.startDate, State.endDate]);

    const buckets = {
        completadas: 0,
        pendientes: 0,
        canceladas: 0,
        noAsistio: 0
    };

    rows.forEach(row => {
        const estado = String(row.estado || '').toLowerCase();
        const total = Number(row.total || 0);
        if (estado === 'atendido') {
            buckets.completadas += total;
        } else if (estado === 'cancelado') {
            buckets.canceladas += total;
        } else if (estado === 'no-asiste') {
            buckets.noAsistio += total;
        } else if (estado === 'pendiente' || estado === 'confirmado' || estado === 'en-sala') {
            buckets.pendientes += total;
        }
    });

    return buckets;
}

async function loadTratamientosResumen() {
    const rows = await dbAll(`
        SELECT nombre, COUNT(*) as cantidad, SUM(ingresos) as ingresos
        FROM (
            SELECT
                CASE
                    WHEN t.procedimiento LIKE 'Receta:%' OR t.procedimiento LIKE 'Receta M%' THEN 'Receta'
                    WHEN t.procedimiento IS NULL OR t.procedimiento = '' THEN 'Tratamiento'
                    ELSE t.procedimiento
                END as nombre,
                COALESCE(t.costo, 0) as ingresos
            FROM tratamientos t
            WHERE date(t.fecha) BETWEEN ? AND ?
            UNION ALL
            SELECT
                COALESCE(NULLIF(tc.nombre, ''), h.descripcion_procedimiento, 'Tratamiento') as nombre,
                COALESCE(h.costo_total, 0) as ingresos
            FROM planes_tratamiento_historial h
            LEFT JOIN tratamientos_catalogo tc ON h.catalogo_id = tc.id
            WHERE date(h.fecha_ejecucion) BETWEEN ? AND ?
        )
        GROUP BY nombre
        ORDER BY ingresos DESC, cantidad DESC
        LIMIT 10
    `, [State.startDate, State.endDate, State.startDate, State.endDate]);

    return rows.map(row => {
        const cantidad = Number(row.cantidad || 0);
        const ingresos = Number(row.ingresos || 0);
        return {
            nombre: row.nombre || 'Tratamiento',
            cantidad,
            ingresos,
            promedio: cantidad ? ingresos / cantidad : 0
        };
    });
}

/* ============================================================================
   UI UPDATES
============================================================================ */
function updateKPIs() {
    const els = {
        ingresos: document.getElementById('totalIngresos'),
        citas: document.getElementById('totalCitas'),
        pacientes: document.getElementById('nuevosPacientes'),
        ticket: document.getElementById('ticketPromedio'),
        ingresosChange: document.getElementById('ingresosChange'),
        citasChange: document.getElementById('citasChange')
    };

    if (els.ingresos) els.ingresos.textContent = formatCurrency(State.data.ingresos);
    if (els.citas) els.citas.textContent = State.data.citas;
    if (els.pacientes) els.pacientes.textContent = State.data.pacientes;

    const ticketPromedio = State.data.citas > 0 ? State.data.ingresos / State.data.citas : 0;
    if (els.ticket) els.ticket.textContent = formatCurrency(ticketPromedio);

    // Calcular cambios (mock - en producción comparar con período anterior)
    if (els.ingresosChange) els.ingresosChange.textContent = '+12.5%';
    if (els.citasChange) els.citasChange.textContent = '+8.3%';
}

function updateCharts() {
    createIngresosChart();
    createCitasChart();
}

function createIngresosChart() {
    const ctx = document.getElementById('ingresosChart');
    if (!ctx) return;

    if (State.charts.ingresos) {
        State.charts.ingresos.destroy();
    }

    const colors = getChartColors();

    const series = State.data.ingresosMensuales || { labels: [], data: [] };
    const labels = series.labels && series.labels.length ? series.labels : ['N/A'];
    const values = series.data && series.data.length ? series.data : [0];

    const data = {
        labels,
        datasets: [{
            label: 'Ingresos',
            data: values,
            backgroundColor: 'rgba(78, 171, 190, 0.1)',
            borderColor: 'rgba(78, 171, 190, 1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
        }]
    };

    State.charts.ingresos = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                    labels: { color: colors.text }
                },
                tooltip: {
                    backgroundColor: colors.tooltipBg,
                    titleColor: colors.tooltipText,
                    bodyColor: colors.tooltipText,
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function (context) {
                            return 'Ingresos: ' + formatCurrency(context.parsed.y);
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
                            return '$' + (value / 1000) + 'K';
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

function createCitasChart() {
    const ctx = document.getElementById('citasChart');
    if (!ctx) return;

    if (State.charts.citas) {
        State.charts.citas.destroy();
    }

    const colors = getChartColors();
    const estado = State.data.citasEstado || {};

    const data = {
        labels: ['Completadas', 'Pendientes', 'Canceladas', 'No Asistió'],
        datasets: [{
            data: [
                Number(estado.completadas || 0),
                Number(estado.pendientes || 0),
                Number(estado.canceladas || 0),
                Number(estado.noAsistio || 0)
            ],
            backgroundColor: [
                'rgba(16, 185, 129, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(156, 163, 175, 0.8)'
            ],
            borderWidth: 0
        }]
    };

    State.charts.citas = new Chart(ctx, {
        type: 'doughnut',
        data: data,
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
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            }
        }
    });
}

function updateChartsTheme() {
    // Recrear gráficos para aplicar nuevos colores
    createIngresosChart();
    createCitasChart();
}

function updateTratamientosTable() {
    const tbody = document.getElementById('tratamientosTable');
    if (!tbody) return;

    if (!State.data.tratamientos.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No hay datos de tratamientos para mostrar
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = State.data.tratamientos.map((t, i) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
            <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">${i + 1}</td>
            <td class="px-6 py-4">
                <div class="font-semibold text-[#1D5D69] dark:text-[#4EABBE]">${t.nombre}</div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">${t.cantidad}</td>
            <td class="px-6 py-4 text-sm font-semibold text-green-600 dark:text-green-400">${formatCurrency(t.ingresos)}</td>
            <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">${formatCurrency(t.promedio)}</td>
        </tr>
    `).join('');
}

/* ============================================================================
   EXPORT FUNCTIONS
============================================================================ */
async function exportReport(type) {
    showToast('Generando reporte...', 'info');

    // Simular generación de reporte
    setTimeout(() => {
        const filename = `reporte_${type}_${State.startDate}_${State.endDate}.pdf`;
        showToast(`Reporte "${filename}" generado exitosamente`, 'success');

        // En producción, aquí se generaría el PDF/Excel/CSV real
        console.log('Exportando reporte:', { type, filename, data: State.data });
    }, 1500);
}

function exportToCSV() {
    const headers = ['Tratamiento', 'Cantidad', 'Ingresos', 'Promedio'];
    const rows = State.data.tratamientos.map(t => [
        t.nombre,
        t.cantidad,
        t.ingresos,
        t.promedio
    ]);

    const csv = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tratamientos_${State.startDate}_${State.endDate}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('CSV descargado exitosamente', 'success');
}

/* ============================================================================
   EVENT LISTENERS
============================================================================ */
function setupEventListeners() {
    // Botones de período
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.dataset.period;
            setDateRange(period);
            loadReportData();
        });
    });

    // Aplicar filtros
    document.getElementById('applyFilters')?.addEventListener('click', () => {
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        State.startDate = startInput.value;
        State.endDate = endInput.value;

        if (!State.startDate || !State.endDate) {
            showToast('Selecciona ambas fechas', 'warning');
            return;
        }

        if (new Date(State.startDate) > new Date(State.endDate)) {
            showToast('La fecha inicial no puede ser mayor a la final', 'error');
            return;
        }

        loadReportData();
    });

    // Refresh
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadReportData();
        showToast('Datos actualizados', 'success');
    });

    // Exportar reporte principal
    document.getElementById('exportBtn')?.addEventListener('click', () => {
        exportReport('general');
    });

    // Reportes rápidos
    document.getElementById('reporteCitas')?.addEventListener('click', () => {
        exportReport('citas');
    });

    document.getElementById('reporteIngresos')?.addEventListener('click', () => {
        exportReport('financiero');
    });

    document.getElementById('reportePacientes')?.addEventListener('click', () => {
        exportToCSV();
    });
}

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

/* ============================================================================
   INITIALIZATION
============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Establecer rango de fecha por defecto (este mes)
    setDateRange('month');

    // Configurar event listeners
    setupEventListeners();

    // Configurar observador de tema
    setupThemeObserver();

    // Cargar datos iniciales
    loadReportData();
});
