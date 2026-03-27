import toast from './toast.js';

let db = null;
if (window.api?.db) db = window.api.db;

const financeApi = window.api?.finance || null;
const XLSX_LIB = window.XLSX || null;

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            if (!db?.get) return resolve(null);
            if (db.get.length >= 3) {
                db.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
                return;
            }
            db.get(sql, params).then(row => resolve(row || null)).catch(reject);
        } catch (error) {
            reject(error);
        }
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            if (!db?.all) return resolve([]);
            if (db.all.length >= 3) {
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
                return;
            }
            db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
        } catch (error) {
            reject(error);
        }
    });
}

function getInitialData() {
    return {
        grossIncome: 0,
        netIncome: 0,
        refunds: 0,
        cashExpenses: 0,
        incomeChange: 0,
        appointments: 0,
        appointmentsChange: 0,
        newPatients: 0,
        totalPatients: 0,
        ticketAverage: 0,
        overdueAmount: 0,
        overduePatientsCount: 0,
        atRiskPatientsCount: 0,
        retentionRate: 100,
        treatments: [],
        overduePatients: [],
        professionals: [],
        atRiskPatients: [],
        monthlyNet: { labels: [], data: [] },
        appointmentStatus: {
            completadas: 0,
            pendientes: 0,
            canceladas: 0,
            noAsistio: 0,
        },
        appointmentInsights: {
            busiestDay: 'Sin datos',
            peakHour: 'Sin datos',
            averagePerDay: 0,
        },
    };
}

const State = {
    startDate: null,
    endDate: null,
    charts: {
        ingresos: null,
        citas: null,
    },
    table: {
        search: '',
        sortBy: 'ingresos',
        sortDir: 'desc',
        page: 1,
        pageSize: 10,
    },
    data: getInitialData(),
};

function showToast(message, type = 'info') {
    toast.show(message, type);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setTextById(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatInputDate(date) {
    const safeDate = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(safeDate.getTime())) return '';
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    const day = String(safeDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function resolveCurrency() {
    let currency = 'MXN';
    try {
        const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
        currency = settings.currency || localStorage.getItem('currency') || currency;
    } catch (error) { }
    return currency;
}

function resolveLocale(currency) {
    if (currency === 'COP') return 'es-CO';
    if (currency === 'MXN') return 'es-MX';
    if (currency === 'EUR') return 'es-ES';
    if (currency === 'USD') return 'en-US';
    return 'es-MX';
}

function formatCurrency(amount) {
    const currency = resolveCurrency();
    return new Intl.NumberFormat(resolveLocale(currency), {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(Number(amount || 0));
}

function formatCompactCurrency(amount) {
    const currency = resolveCurrency();
    try {
        return new Intl.NumberFormat(resolveLocale(currency), {
            style: 'currency',
            currency,
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(Number(amount || 0));
    } catch (error) {
        return formatCurrency(amount);
    }
}

function getChartColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        text: isDark ? '#e2e8f0' : '#0F2532',
        grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 37, 50, 0.08)',
        tooltipBg: isDark ? '#1e293b' : '#1D5D69',
        tooltipText: '#ffffff',
    };
}

function getInclusiveDays(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function resetReportData() {
    State.data = getInitialData();
}

function setDateRange(period) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today.getTime());
    let start = new Date(today.getTime());

    if (period === 'week') {
        const currentDay = (today.getDay() + 6) % 7;
        start.setDate(today.getDate() - currentDay);
    } else if (period === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === 'year') {
        start = new Date(today.getFullYear(), 0, 1);
    }

    State.startDate = formatInputDate(start);
    State.endDate = formatInputDate(end);

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    if (startInput) startInput.value = State.startDate;
    if (endInput) endInput.value = State.endDate;
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
        const label = cursor.toLocaleString('es-MX', {
            month: 'short',
            year: start.getFullYear() !== end.getFullYear() ? '2-digit' : undefined,
        });
        buckets.push({ key, label });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return buckets;
}

function applyFinanceReport(financeReport = {}) {
    const monthlyBuckets = buildMonthBuckets(State.startDate, State.endDate);
    const byMonth = new Map((financeReport.monthlyIncome || []).map(item => [item.key, Number(item.value || 0)]));
    const summary = financeReport.summary || {};
    const insights = financeReport.appointmentInsights || {};

    State.data = {
        grossIncome: Number(summary.gross_income || 0),
        netIncome: Number(summary.net_income || 0),
        refunds: Number(summary.refunds || 0),
        cashExpenses: Number(summary.cash_expenses || 0),
        incomeChange: Number(summary.income_change || 0),
        appointments: Number(summary.appointments || 0),
        appointmentsChange: Number(summary.appointments_change || 0),
        newPatients: Number(summary.new_patients || 0),
        totalPatients: Number(summary.total_patients || 0),
        ticketAverage: Number(summary.ticket_average || 0),
        overdueAmount: Number(summary.overdue_amount || 0),
        overduePatientsCount: Number(summary.overdue_patients || 0),
        atRiskPatientsCount: Number(summary.at_risk_patients || 0),
        retentionRate: Number(summary.retention_rate ?? 100),
        treatments: financeReport.treatments || [],
        overduePatients: financeReport.overdue?.patients || [],
        professionals: financeReport.specialistProduction || [],
        atRiskPatients: financeReport.patientRisk?.patients || [],
        monthlyNet: {
            labels: monthlyBuckets.map(bucket => bucket.label),
            data: monthlyBuckets.map(bucket => byMonth.get(bucket.key) || 0),
        },
        appointmentStatus: financeReport.appointmentStatus || getInitialData().appointmentStatus,
        appointmentInsights: {
            busiestDay: insights.busiest_day || 'Sin datos',
            peakHour: insights.peak_hour || 'Sin datos',
            averagePerDay: Number(insights.average_per_day || 0),
        },
    };
}

function getPreviousPeriodRange() {
    const start = new Date(`${State.startDate}T00:00:00`);
    const days = getInclusiveDays(State.startDate, State.endDate);
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - ((days - 1) * 86400000));
    return [formatInputDate(prevStart), formatInputDate(prevEnd)];
}

async function loadLegacyReportData() {
    resetReportData();

    const [ledgerSummary, appointmentsRow, previousAppointmentsRow, newPatientsRow, treatmentsRows, monthlyRows] = await Promise.all([
        dbGet(
            `SELECT
                COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0) AS ingresos,
                COALESCE(SUM(
                    CASE
                        WHEN m.tipo = 'egreso'
                         AND (
                            lower(COALESCE(p.tipo, '')) = 'devolucion'
                            OR lower(COALESCE(m.origen, '')) LIKE 'devolucion%'
                         )
                        THEN m.monto
                        ELSE 0
                    END
                ), 0) AS devoluciones,
                COALESCE(SUM(
                    CASE
                        WHEN m.tipo = 'egreso'
                         AND NOT (
                            lower(COALESCE(p.tipo, '')) = 'devolucion'
                            OR lower(COALESCE(m.origen, '')) LIKE 'devolucion%'
                         )
                        THEN m.monto
                        ELSE 0
                    END
                ), 0) AS egresos
             FROM movimientos_caja m
             LEFT JOIN pagos p ON p.id = m.pago_id
             WHERE date(m.fecha) BETWEEN date(?) AND date(?)`,
            [State.startDate, State.endDate]
        ),
        dbGet(
            `SELECT COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
               AND estado = 'atendido'`,
            [State.startDate, State.endDate]
        ),
        dbGet(
            `SELECT COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
               AND estado = 'atendido'`,
            getPreviousPeriodRange()
        ),
        dbGet(
            `SELECT COUNT(*) AS total
             FROM pacientes
             WHERE date(COALESCE(created_at, fecha_registro)) BETWEEN date(?) AND date(?)`,
            [State.startDate, State.endDate]
        ),
        dbAll(
            `SELECT nombre, COUNT(*) AS cantidad, SUM(ingresos) AS ingresos
             FROM (
                SELECT
                    CASE
                        WHEN t.procedimiento LIKE 'Receta:%' OR t.procedimiento LIKE 'Receta M%' THEN 'Receta'
                        WHEN t.procedimiento IS NULL OR t.procedimiento = '' THEN 'Tratamiento'
                        ELSE t.procedimiento
                    END AS nombre,
                    COALESCE(t.costo, 0) AS ingresos
                FROM tratamientos t
                WHERE date(t.fecha) BETWEEN date(?) AND date(?)
                UNION ALL
                SELECT
                    COALESCE(NULLIF(tc.nombre, ''), h.descripcion_procedimiento, 'Tratamiento') AS nombre,
                    COALESCE(h.costo_total, 0) AS ingresos
                FROM planes_tratamiento_historial h
                LEFT JOIN tratamientos_catalogo tc ON h.catalogo_id = tc.id
                WHERE date(h.fecha_ejecucion) BETWEEN date(?) AND date(?)
             )
             GROUP BY nombre
             ORDER BY ingresos DESC, cantidad DESC
             LIMIT 10`,
            [State.startDate, State.endDate, State.startDate, State.endDate]
        ),
        dbAll(
            `SELECT
                strftime('%Y-%m', fecha) AS mes,
                COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS neto
             FROM movimientos_caja
             WHERE date(fecha) BETWEEN date(?) AND date(?)
             GROUP BY mes
             ORDER BY mes ASC`,
            [State.startDate, State.endDate]
        ),
    ]);

    const monthlyBuckets = buildMonthBuckets(State.startDate, State.endDate);
    const monthlyMap = new Map((monthlyRows || []).map(row => [row.mes, Number(row.neto || 0)]));
    const grossIncome = Number(ledgerSummary?.ingresos || 0);
    const refunds = Number(ledgerSummary?.devoluciones || 0);
    const extraExpenses = Number(ledgerSummary?.egresos || 0);
    const appointments = Number(appointmentsRow?.total || 0);
    const previousAppointments = Number(previousAppointmentsRow?.total || 0);
    const appointmentsChange = previousAppointments === 0
        ? (appointments > 0 ? 100 : 0)
        : (((appointments - previousAppointments) / previousAppointments) * 100);

    State.data = {
        ...getInitialData(),
        grossIncome,
        netIncome: grossIncome - refunds - extraExpenses,
        refunds,
        cashExpenses: extraExpenses,
        appointments,
        appointmentsChange,
        newPatients: Number(newPatientsRow?.total || 0),
        ticketAverage: appointments > 0 ? grossIncome / appointments : 0,
        treatments: (treatmentsRows || []).map(row => {
            const quantity = Number(row.cantidad || 0);
            const income = Number(row.ingresos || 0);
            return {
                nombre: row.nombre || 'Tratamiento',
                cantidad: quantity,
                ingresos: income,
                promedio: quantity > 0 ? income / quantity : 0,
            };
        }),
        monthlyNet: {
            labels: monthlyBuckets.map(bucket => bucket.label),
            data: monthlyBuckets.map(bucket => monthlyMap.get(bucket.key) || 0),
        },
        appointmentInsights: {
            busiestDay: appointments > 0 ? 'Período actual' : 'Sin datos',
            peakHour: 'Sin datos',
            averagePerDay: appointments > 0 ? appointments / getInclusiveDays(State.startDate, State.endDate) : 0,
        },
    };
}

function updateKPIs() {
    setTextById('totalIngresos', formatCurrency(State.data.netIncome));
    setTextById('totalCitas', String(State.data.appointments || 0));
    setTextById('nuevosPacientes', String(State.data.newPatients || 0));
    setTextById('ticketPromedio', formatCurrency(State.data.ticketAverage));
    setTextById('ingresosChange', `${State.data.incomeChange >= 0 ? '+' : ''}${Number(State.data.incomeChange || 0).toFixed(1)}%`);
    setTextById('citasChange', `${State.data.appointmentsChange >= 0 ? '+' : ''}${Number(State.data.appointmentsChange || 0).toFixed(1)}%`);

    const projectionValues = (State.data.monthlyNet.data || []).filter(value => Number(value) > 0);
    const averageIncome = projectionValues.length
        ? projectionValues.reduce((sum, value) => sum + Number(value || 0), 0) / projectionValues.length
        : State.data.netIncome;

    setTextById('proyeccionMes', formatCurrency(averageIncome));
    setTextById('escenarioOptimista', formatCurrency(averageIncome * 1.1));
    setTextById('escenarioPesimista', formatCurrency(averageIncome * 0.9));
    setTextById('tasaRetencion', `${Number(State.data.retentionRate || 0).toFixed(1)}%`);
    setTextById('pacientesRiesgo', String(State.data.atRiskPatientsCount || 0));
    setTextById('diaMasOcupado', State.data.appointmentInsights.busiestDay || 'Sin datos');
    setTextById('horaPico', State.data.appointmentInsights.peakHour || 'Sin datos');
    setTextById('promedioDia', Number(State.data.appointmentInsights.averagePerDay || 0).toFixed(1));
}

function createIngresosChart() {
    const canvas = document.getElementById('ingresosChart');
    if (!canvas) return;

    if (State.charts.ingresos) State.charts.ingresos.destroy();

    const colors = getChartColors();
    const labels = State.data.monthlyNet.labels.length ? State.data.monthlyNet.labels : ['N/A'];
    const values = State.data.monthlyNet.data.length ? State.data.monthlyNet.data : [0];

    State.charts.ingresos = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Resultado neto',
                data: values,
                backgroundColor: 'rgba(78, 171, 190, 0.12)',
                borderColor: 'rgba(78, 171, 190, 1)',
                borderWidth: 3,
                tension: 0.35,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: colors.tooltipBg,
                    titleColor: colors.tooltipText,
                    bodyColor: colors.tooltipText,
                    callbacks: {
                        label: context => `Neto: ${formatCurrency(context.parsed.y)}`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: colors.text,
                        callback: value => formatCompactCurrency(value),
                    },
                    grid: { color: colors.grid },
                },
                x: {
                    ticks: { color: colors.text },
                    grid: { display: false },
                },
            },
        },
    });
}

function createCitasChart() {
    const canvas = document.getElementById('citasChart');
    if (!canvas) return;

    if (State.charts.citas) State.charts.citas.destroy();

    const colors = getChartColors();
    const status = State.data.appointmentStatus;

    State.charts.citas = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Completadas', 'Pendientes', 'Canceladas', 'No asistió'],
            datasets: [{
                data: [
                    Number(status.completadas || 0),
                    Number(status.pendientes || 0),
                    Number(status.canceladas || 0),
                    Number(status.noAsistio || 0),
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(251, 191, 36, 0.85)',
                    'rgba(239, 68, 68, 0.85)',
                    'rgba(148, 163, 184, 0.85)',
                ],
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: colors.text,
                        padding: 16,
                        usePointStyle: true,
                    },
                },
                tooltip: {
                    backgroundColor: colors.tooltipBg,
                    titleColor: colors.tooltipText,
                    bodyColor: colors.tooltipText,
                    callbacks: {
                        label: context => `${context.label}: ${context.parsed}`,
                    },
                },
            },
        },
    });
}

function updateCharts() {
    createIngresosChart();
    createCitasChart();
}

function updateChartsTheme() {
    updateCharts();
}

function getFilteredTreatments() {
    const search = State.table.search.trim().toLowerCase();
    let rows = [...(State.data.treatments || [])];

    if (search) {
        rows = rows.filter(row => String(row.nombre || '').toLowerCase().includes(search));
    }

    rows.sort((left, right) => {
        const sortBy = State.table.sortBy;
        const direction = State.table.sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'index') return 0;

        const leftValue = left?.[sortBy];
        const rightValue = right?.[sortBy];

        if (typeof leftValue === 'number' || typeof rightValue === 'number') {
            return (Number(leftValue || 0) - Number(rightValue || 0)) * direction;
        }

        return String(leftValue || '').localeCompare(String(rightValue || ''), 'es', { sensitivity: 'base' }) * direction;
    });

    return rows;
}

function updatePaginationControls(totalRows) {
    const pageSize = Math.max(1, Number(State.table.pageSize || 10));
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    State.table.page = Math.min(State.table.page, totalPages);

    const from = totalRows === 0 ? 0 : ((State.table.page - 1) * pageSize) + 1;
    const to = totalRows === 0 ? 0 : Math.min(totalRows, State.table.page * pageSize);

    setTextById('showingFrom', String(from));
    setTextById('showingTo', String(to));
    setTextById('totalRecords', String(totalRows));

    const pagination = document.getElementById('paginationControls');
    if (!pagination) return;

    pagination.innerHTML = '';
    if (totalPages <= 1) return;

    const items = [];
    items.push({ label: 'Anterior', page: Math.max(1, State.table.page - 1), disabled: State.table.page === 1 });
    for (let page = 1; page <= totalPages; page += 1) {
        items.push({ label: String(page), page, current: page === State.table.page });
    }
    items.push({ label: 'Siguiente', page: Math.min(totalPages, State.table.page + 1), disabled: State.table.page === totalPages });

    items.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.page = String(item.page);
        button.disabled = !!item.disabled;
        button.className = [
            'px-3 py-2 rounded-lg text-sm transition',
            item.current ? 'bg-[#4EABBE] text-white' : 'bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-gray-600',
            item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-600',
        ].join(' ');
        button.textContent = item.label;
        pagination.appendChild(button);
    });
}

function updateTratamientosTable() {
    const tbody = document.getElementById('tratamientosTable');
    if (!tbody) return;

    const filteredRows = getFilteredTreatments();
    updatePaginationControls(filteredRows.length);

    const pageSize = Math.max(1, Number(State.table.pageSize || 10));
    const startIndex = (State.table.page - 1) * pageSize;
    const pageRows = filteredRows.slice(startIndex, startIndex + pageSize);

    if (!pageRows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No hay tratamientos para el filtro actual
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageRows.map((row, index) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
            <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">${startIndex + index + 1}</td>
            <td class="px-6 py-4">
                <div class="font-semibold text-[#1D5D69] dark:text-[#4EABBE]">${escapeHtml(row.nombre)}</div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">${Number(row.cantidad || 0)}</td>
            <td class="px-6 py-4 text-sm font-semibold text-green-600 dark:text-green-400">${formatCurrency(row.ingresos)}</td>
            <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">${formatCurrency(row.promedio)}</td>
        </tr>
    `).join('');
}

function updateMorososTable() {
    const tbody = document.getElementById('morososTable');
    if (!tbody) return;

    const rows = State.data.overduePatients || [];
    setTextById('morososCount', `${rows.length} paciente${rows.length === 1 ? '' : 's'}`);

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay pacientes morosos al corte del período
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td class="py-3 pr-4 font-medium text-slate-900 dark:text-white">${escapeHtml(`${row.nombre || ''} ${row.apellido || ''}`.trim())}</td>
            <td class="py-3 pr-4 text-slate-700 dark:text-slate-300">${Number(row.cuotas_vencidas || 0)}</td>
            <td class="py-3 text-rose-600 dark:text-rose-400 font-semibold">${formatCurrency(row.monto_vencido)}</td>
        </tr>
    `).join('');
}

function updateProfesionalesTable() {
    const tbody = document.getElementById('profesionalesTable');
    if (!tbody) return;

    const rows = State.data.professionals || [];
    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay producción registrada en el período actual
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td class="py-3 pr-4 font-medium text-slate-900 dark:text-white">${escapeHtml(row.profesional)}</td>
            <td class="py-3 pr-4 text-slate-700 dark:text-slate-300">${Number(row.tratamientos || 0)}</td>
            <td class="py-3 text-emerald-600 dark:text-emerald-400 font-semibold">${formatCurrency(row.produccion)}</td>
        </tr>
    `).join('');
}

function renderReport() {
    updateKPIs();
    updateCharts();
    updateTratamientosTable();
    updateMorososTable();
    updateProfesionalesTable();
}

async function loadReportData({ showErrors = true } = {}) {
    try {
        if (financeApi?.getReport) {
            const report = await financeApi.getReport({
                startDate: State.startDate,
                endDate: State.endDate,
            });
            applyFinanceReport(report || {});
        } else if (db) {
            await loadLegacyReportData();
            showToast('Cargando reporte desde consulta local', 'warning');
        } else {
            resetReportData();
        }

        renderReport();
        return true;
    } catch (error) {
        console.error('Error cargando reporte:', error);
        resetReportData();
        renderReport();
        if (showErrors) showToast(error.message || 'Error cargando datos del reporte', 'error');
        return false;
    }
}

function toCsvCell(value) {
    const safeValue = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return `"${safeValue.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
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

function downloadWorkbook(filename, sheets) {
    if (!XLSX_LIB) {
        showToast('La librería de Excel no está disponible', 'error');
        return false;
    }

    const workbook = XLSX_LIB.utils.book_new();
    sheets.forEach((sheet) => {
        const worksheet = XLSX_LIB.utils.json_to_sheet(sheet.rows);
        XLSX_LIB.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });

    const arrayBuffer = XLSX_LIB.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
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
    return true;
}

function getTreatmentsExportRows(rows = getFilteredTreatments()) {
    return rows.map(row => ({
        Tratamiento: row.nombre || '',
        Cantidad: Number(row.cantidad || 0),
        Ingresos: Number(row.ingresos || 0),
        Promedio: Number(row.promedio || 0),
    }));
}

async function loadAppointmentsExportRows() {
    if (!db) return [];
    return dbAll(
        `SELECT
            c.id,
            c.fecha_hora,
            TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')) AS paciente,
            c.estado,
            COALESCE(c.monto, 0) AS monto,
            COALESCE(
                NULLIF(TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, u.apellidos, '')), ''),
                e.nombre,
                'Sin asignar'
            ) AS profesional
         FROM citas c
         JOIN pacientes p ON p.id = c.paciente_id
         LEFT JOIN usuarios u ON u.id = c.dentista_id
         LEFT JOIN especialistas e ON e.id = c.especialista_id
         WHERE date(c.fecha_hora) BETWEEN date(?) AND date(?)
         ORDER BY datetime(c.fecha_hora) ASC, c.id ASC`,
        [State.startDate, State.endDate]
    );
}

async function loadPatientsExportRows() {
    if (!db) return [];
    return dbAll(
        `SELECT
            p.id,
            p.nombre,
            p.apellido,
            p.telefono,
            p.email,
            date(COALESCE(p.created_at, p.fecha_registro)) AS fecha_registro,
            MAX(c.fecha_hora) AS ultima_cita,
            COUNT(c.id) AS total_citas
         FROM pacientes p
         LEFT JOIN citas c ON c.paciente_id = p.id
         GROUP BY p.id
         ORDER BY p.apellido ASC, p.nombre ASC`,
        []
    );
}

function buildSummaryRows() {
    return [
        { Indicador: 'Fecha inicio', Valor: State.startDate },
        { Indicador: 'Fecha fin', Valor: State.endDate },
        { Indicador: 'Ingreso bruto', Valor: State.data.grossIncome },
        { Indicador: 'Devoluciones', Valor: State.data.refunds },
        { Indicador: 'Egresos de caja', Valor: State.data.cashExpenses },
        { Indicador: 'Resultado neto', Valor: State.data.netIncome },
        { Indicador: 'Citas realizadas', Valor: State.data.appointments },
        { Indicador: 'Cambio de citas (%)', Valor: State.data.appointmentsChange },
        { Indicador: 'Pacientes nuevos', Valor: State.data.newPatients },
        { Indicador: 'Pacientes totales', Valor: State.data.totalPatients },
        { Indicador: 'Pacientes en riesgo', Valor: State.data.atRiskPatientsCount },
        { Indicador: 'Retención (%)', Valor: State.data.retentionRate },
        { Indicador: 'Morosidad', Valor: State.data.overdueAmount },
        { Indicador: 'Día más ocupado', Valor: State.data.appointmentInsights.busiestDay },
        { Indicador: 'Hora pico', Valor: State.data.appointmentInsights.peakHour },
        { Indicador: 'Promedio por día', Valor: State.data.appointmentInsights.averagePerDay },
    ];
}

function printTableReport({ title, subtitle, columns, rows }) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const tableHead = columns.map(column => `<th>${escapeHtml(column)}</th>`).join('');
    const tableBody = rows.length
        ? rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}">No hay datos para el rango seleccionado</td></tr>`;

    const documentHtml = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0F2532; margin: 24px; }
    h1 { margin: 0 0 6px 0; color: #1D5D69; }
    p { margin: 0 0 18px 0; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: left; }
    th { background: #E2E8F0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(subtitle)}</p>
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
</body>
</html>`;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
        iframe.remove();
        showToast('No se pudo preparar la vista de impresión', 'error');
        return;
    }

    doc.open();
    doc.write(documentHtml);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 1200);
    }, 250);
}

function exportTreatmentsCsv() {
    const rows = getTreatmentsExportRows();
    const headers = ['Tratamiento', 'Cantidad', 'Ingresos', 'Promedio'];
    const lines = [
        headers.map(toCsvCell).join(','),
        ...rows.map(row => [row.Tratamiento, row.Cantidad, row.Ingresos, row.Promedio].map(toCsvCell).join(',')),
    ];
    downloadTextFile(`tratamientos_${State.startDate}_${State.endDate}.csv`, lines.join('\n'));
    showToast('CSV de tratamientos descargado', 'success');
}

function exportTreatmentsExcel() {
    const ok = downloadWorkbook(`tratamientos_${State.startDate}_${State.endDate}.xlsx`, [
        { name: 'Tratamientos', rows: getTreatmentsExportRows() },
    ]);
    if (ok) showToast('Excel de tratamientos generado', 'success');
}

async function exportPatientsCsv({ atRiskOnly = false } = {}) {
    const rows = atRiskOnly
        ? State.data.atRiskPatients.map(row => ({
            Paciente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
            'Última actividad': row.ultima_actividad || '',
            'Días sin actividad': Number(row.dias_sin_actividad || 0),
            Telefono: row.telefono || '',
            Email: row.email || '',
        }))
        : (await loadPatientsExportRows()).map(row => ({
            ID: row.id,
            Nombre: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
            Telefono: row.telefono || '',
            Email: row.email || '',
            Registro: row.fecha_registro || '',
            'Última cita': row.ultima_cita ? formatDateTime(row.ultima_cita) : '',
            'Total citas': Number(row.total_citas || 0),
        }));

    const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos'];
    const lines = [
        headers.map(toCsvCell).join(','),
        ...rows.map(row => headers.map(header => toCsvCell(row[header])).join(',')),
    ];

    const suffix = atRiskOnly ? 'pacientes_riesgo' : 'pacientes';
    downloadTextFile(`${suffix}_${State.startDate}_${State.endDate}.csv`, lines.join('\n'));
    showToast(atRiskOnly ? 'CSV de pacientes en riesgo descargado' : 'CSV de pacientes descargado', 'success');
}

async function exportFinancialWorkbook() {
    const appointments = await loadAppointmentsExportRows();
    const ok = downloadWorkbook(`reporte_financiero_${State.startDate}_${State.endDate}.xlsx`, [
        { name: 'Resumen', rows: buildSummaryRows() },
        {
            name: 'Mensual',
            rows: (State.data.monthlyNet.labels || []).map((label, index) => ({
                Mes: label,
                Neto: Number(State.data.monthlyNet.data[index] || 0),
            })),
        },
        {
            name: 'Morosidad',
            rows: (State.data.overduePatients || []).map(row => ({
                Paciente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
                Cuotas: Number(row.cuotas_vencidas || 0),
                'Monto vencido': Number(row.monto_vencido || 0),
            })),
        },
        {
            name: 'Citas',
            rows: appointments.map(row => ({
                Fecha: formatDateTime(row.fecha_hora),
                Paciente: row.paciente || '',
                Estado: row.estado || '',
                Monto: Number(row.monto || 0),
                Profesional: row.profesional || '',
            })),
        },
    ]);
    if (ok) showToast('Reporte financiero generado', 'success');
}

async function exportGeneralWorkbook() {
    const [appointments, patients] = await Promise.all([
        loadAppointmentsExportRows(),
        loadPatientsExportRows(),
    ]);

    const ok = downloadWorkbook(`reporte_general_${State.startDate}_${State.endDate}.xlsx`, [
        { name: 'Resumen', rows: buildSummaryRows() },
        { name: 'Tratamientos', rows: getTreatmentsExportRows(State.data.treatments) },
        {
            name: 'Profesionales',
            rows: (State.data.professionals || []).map(row => ({
                Profesional: row.profesional || '',
                Tratamientos: Number(row.tratamientos || 0),
                Produccion: Number(row.produccion || 0),
            })),
        },
        {
            name: 'Morosidad',
            rows: (State.data.overduePatients || []).map(row => ({
                Paciente: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
                Cuotas: Number(row.cuotas_vencidas || 0),
                'Monto vencido': Number(row.monto_vencido || 0),
            })),
        },
        {
            name: 'Citas',
            rows: appointments.map(row => ({
                Fecha: formatDateTime(row.fecha_hora),
                Paciente: row.paciente || '',
                Estado: row.estado || '',
                Monto: Number(row.monto || 0),
                Profesional: row.profesional || '',
            })),
        },
        {
            name: 'Pacientes',
            rows: patients.map(row => ({
                ID: row.id,
                Nombre: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
                Telefono: row.telefono || '',
                Email: row.email || '',
                Registro: row.fecha_registro || '',
                'Ultima cita': row.ultima_cita ? formatDateTime(row.ultima_cita) : '',
                'Total citas': Number(row.total_citas || 0),
            })),
        },
    ]);

    if (ok) showToast('Reporte general generado', 'success');
}

async function exportAppointmentsPrintableReport() {
    const rows = await loadAppointmentsExportRows();
    printTableReport({
        title: 'Reporte de citas',
        subtitle: `Rango ${State.startDate} a ${State.endDate}`,
        columns: ['Fecha', 'Paciente', 'Estado', 'Monto', 'Profesional'],
        rows: rows.map(row => [
            formatDateTime(row.fecha_hora),
            row.paciente || '',
            row.estado || '',
            formatCurrency(row.monto),
            row.profesional || '',
        ]),
    });
    showToast('Vista de impresión preparada', 'success');
}

async function exportReport(type) {
    if (type === 'general') {
        await exportGeneralWorkbook();
        return;
    }
    if (type === 'citas') {
        await exportAppointmentsPrintableReport();
        return;
    }
    if (type === 'financiero') {
        await exportFinancialWorkbook();
        return;
    }
    if (type === 'pacientes') {
        await exportPatientsCsv();
    }
}

function handleSort(sortBy) {
    if (State.table.sortBy === sortBy) {
        State.table.sortDir = State.table.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        State.table.sortBy = sortBy;
        State.table.sortDir = sortBy === 'nombre' ? 'asc' : 'desc';
    }
    State.table.page = 1;
    updateTratamientosTable();
}

function setupEventListeners() {
    document.querySelectorAll('.period-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            setDateRange(button.dataset.period);
            await loadReportData();
        });
    });

    document.getElementById('applyFilters')?.addEventListener('click', async () => {
        const startValue = document.getElementById('startDate')?.value || '';
        const endValue = document.getElementById('endDate')?.value || '';

        if (!startValue || !endValue) {
            showToast('Selecciona ambas fechas', 'warning');
            return;
        }

        if (new Date(`${startValue}T00:00:00`) > new Date(`${endValue}T00:00:00`)) {
            showToast('La fecha inicial no puede ser mayor a la final', 'error');
            return;
        }

        State.startDate = startValue;
        State.endDate = endValue;
        await loadReportData();
    });

    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
        const ok = await loadReportData();
        if (ok) showToast('Datos actualizados', 'success');
    });

    document.getElementById('exportBtn')?.addEventListener('click', async () => {
        await exportReport('general');
    });

    document.getElementById('reporteCitas')?.addEventListener('click', async () => {
        await exportReport('citas');
    });

    document.getElementById('reporteIngresos')?.addEventListener('click', async () => {
        await exportReport('financiero');
    });

    document.getElementById('reportePacientes')?.addEventListener('click', async () => {
        await exportReport('pacientes');
    });

    document.getElementById('btnExportCSV')?.addEventListener('click', exportTreatmentsCsv);
    document.getElementById('btnExportExcel')?.addEventListener('click', exportTreatmentsExcel);

    document.getElementById('searchTable')?.addEventListener('input', (event) => {
        State.table.search = event.target.value || '';
        State.table.page = 1;
        updateTratamientosTable();
    });

    document.getElementById('itemsPerPage')?.addEventListener('change', (event) => {
        State.table.pageSize = Number(event.target.value || 10);
        State.table.page = 1;
        updateTratamientosTable();
    });

    document.querySelectorAll('[data-sort]').forEach((header) => {
        header.addEventListener('click', () => {
            handleSort(header.dataset.sort);
        });
    });

    document.getElementById('paginationControls')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-page]');
        if (!button || button.disabled) return;
        State.table.page = Number(button.dataset.page || 1);
        updateTratamientosTable();
    });

    document.getElementById('viewRiskDetailsBtn')?.addEventListener('click', async () => {
        await exportPatientsCsv({ atRiskOnly: true });
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
        attributeFilter: ['class'],
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const itemsPerPage = document.getElementById('itemsPerPage');
    State.table.pageSize = Number(itemsPerPage?.value || 10);
    setDateRange('month');
    setupEventListeners();
    setupThemeObserver();
    await loadReportData({ showErrors: true });
});
