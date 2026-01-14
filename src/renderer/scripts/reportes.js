// reportes.js - Sistema de reportes y análisis
import toast from './toast.js';

let db;
if (window.api && window.api.db) db = window.api.db;

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
        tratamientos: []
    }
};

/* ============================================================================
   UTILITIES
============================================================================ */
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
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
        // Cargar ingresos (simulado desde citas - en producción vendría de pagos)
        const ingresosQuery = `
            SELECT COUNT(*) as total_citas, SUM(COALESCE(monto, 0)) as total_ingresos
            FROM citas
            WHERE date(fecha_hora) BETWEEN ? AND ?
            AND estado = 'atendido'
        `;

        const ingresosResult = await db.get(ingresosQuery, [State.startDate, State.endDate]);
        State.data.ingresos = ingresosResult?.total_ingresos || 0;
        State.data.citas = ingresosResult?.total_citas || 0;

        // Cargar nuevos pacientes
        const pacientesQuery = `
            SELECT COUNT(*) as total
            FROM pacientes
            WHERE date(created_at) BETWEEN ? AND ?
        `;

        const pacientesResult = await db.get(pacientesQuery, [State.startDate, State.endDate]);
        State.data.pacientes = pacientesResult?.total || 0;

        // Cargar tratamientos (mock data)
        State.data.tratamientos = getMockTratamientos();

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
        tratamientos: getMockTratamientos()
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

    // Datos mock por mes
    const data = {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        datasets: [{
            label: 'Ingresos',
            data: [45000, 52000, 48000, 61000, 58000, 67000, 72000, 68000, 75000, 82000, 79000, 85000],
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

    const data = {
        labels: ['Completadas', 'Pendientes', 'Canceladas', 'No Asistió'],
        datasets: [{
            data: [65, 20, 10, 5],
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