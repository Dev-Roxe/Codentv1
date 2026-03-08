function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function clampMoney(value, min = 0, max = Number.POSITIVE_INFINITY) {
    return Math.min(max, Math.max(min, roundMoney(value)));
}

function createDbHelpers(db) {
    return {
        all(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            });
        },
        get(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
            });
        },
    };
}

function formatDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return raw;
}

function formatMonth(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function getMonthRange(monthKey) {
    const safeMonth = formatMonth(monthKey) || formatDate(new Date()).slice(0, 7);
    const [yearStr, monthStr] = safeMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const startDate = `${safeMonth}-01`;
    const endDateObj = new Date(year, month, 0);
    const endDate = formatDate(endDateObj);
    return { month: safeMonth, startDate, endDate };
}

function getDateRangeForMovements(filters = {}) {
    const day = formatDate(filters.fecha || filters.day);
    if (day) {
        return { startDate: day, endDate: day, scope: 'day' };
    }
    const month = formatMonth(filters.mes || filters.month);
    if (month) {
        const range = getMonthRange(month);
        return { startDate: range.startDate, endDate: range.endDate, scope: 'month' };
    }
    const today = formatDate(new Date());
    return { startDate: today, endDate: today, scope: 'day' };
}

function parseNumericId(value) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : null;
}

function normalizeTypeFilter(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'todos' || raw === 'all') return null;
    if (raw === 'ingreso' || raw === 'ingresos') return 'ingreso';
    if (raw === 'egreso' || raw === 'egresos') return 'egreso';
    if (raw === 'gasto' || raw === 'gastos') return 'gasto';
    return null;
}

function buildMovementWhere(filters = {}, { useType = true } = {}) {
    const where = [];
    const params = [];

    const cajaId = parseNumericId(filters.caja_id || filters.cajaId);
    if (cajaId) {
        where.push('m.caja_id = ?');
        params.push(cajaId);
    }

    const userId = parseNumericId(filters.usuario_id || filters.usuarioId);
    if (userId) {
        where.push('m.usuario_id = ?');
        params.push(userId);
    }

    if (useType) {
        const type = normalizeTypeFilter(filters.tipo);
        if (type === 'ingreso' || type === 'egreso') {
            where.push('m.tipo = ?');
            params.push(type);
        } else if (type === 'gasto') {
            where.push("m.tipo = 'egreso'");
            where.push("lower(COALESCE(m.concepto, '')) LIKE '%gasto%'");
        }
    }

    return { where, params };
}

function formatOpenDuration(minutes) {
    const safeMinutes = Math.max(0, Number(minutes || 0));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hours}h ${mins}m`;
}

async function getMovimientosAvanzado(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    const range = getDateRangeForMovements(filters);
    const movementScope = buildMovementWhere(filters, { useType: true });

    const where = [
        'date(m.fecha) BETWEEN date(?) AND date(?)',
        ...movementScope.where,
    ];
    const params = [range.startDate, range.endDate, ...movementScope.params];
    const limit = Math.min(5000, Math.max(100, Number(filters.limit || 1000)));

    const rows = await dbHelpers.all(
        `SELECT
            m.id,
            m.fecha,
            strftime('%H:%M', m.fecha) AS hora,
            m.tipo,
            m.concepto,
            ROUND(COALESCE(m.monto, 0), 2) AS monto,
            COALESCE(
                NULLIF(TRIM(m.metodo), ''),
                NULLIF(TRIM(p.metodo), ''),
                'No especificado'
            ) AS metodo,
            COALESCE(m.paciente_id, p.paciente_id) AS paciente_id,
            COALESCE(
                NULLIF(
                    TRIM(COALESCE(pa.nombre, '') || ' ' || COALESCE(pa.apellido, '')),
                    ''
                ),
                '-'
            ) AS paciente_nombre,
            m.usuario_id,
            COALESCE(
                NULLIF(
                    TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, u.apellidos, '')),
                    ''
                ),
                'Sistema'
            ) AS usuario_nombre,
            m.caja_id,
            ('Caja #' || m.caja_id) AS caja_nombre,
            COALESCE(NULLIF(TRIM(m.origen), ''), CASE WHEN p.id IS NOT NULL THEN 'pago' ELSE 'manual' END) AS origen
         FROM movimientos_caja m
         LEFT JOIN pagos p ON p.id = m.pago_id
         LEFT JOIN pacientes pa ON pa.id = COALESCE(m.paciente_id, p.paciente_id)
         LEFT JOIN usuarios u ON u.id = m.usuario_id
         WHERE ${where.join(' AND ')}
         ORDER BY datetime(m.fecha) DESC, m.id DESC
         LIMIT ?`,
        [...params, limit]
    );

    return {
        filters: {
            ...filters,
            range,
        },
        total: rows.length,
        rows: rows.map((row, index) => ({
            index: index + 1,
            id: row.id,
            fecha: row.fecha,
            hora: row.hora || '',
            tipo: row.tipo,
            concepto: row.concepto || '',
            monto: roundMoney(row.monto || 0),
            metodo: row.metodo || 'No especificado',
            paciente_id: row.paciente_id || null,
            paciente_nombre: row.paciente_nombre || '-',
            usuario_id: row.usuario_id || null,
            usuario_nombre: row.usuario_nombre || 'Sistema',
            caja_id: row.caja_id,
            caja_nombre: row.caja_nombre,
            origen: row.origen || 'manual',
        })),
    };
}

async function getResumenContable(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    const day = formatDate(filters.fecha || filters.day) || formatDate(new Date());
    const monthRange = getMonthRange(filters.mes || filters.month || day.slice(0, 7));
    const scope = buildMovementWhere(filters, { useType: false });

    const dayWhere = ['date(m.fecha) = date(?)', ...scope.where];
    const dayParams = [day, ...scope.params];
    const monthWhere = ['date(m.fecha) BETWEEN date(?) AND date(?)', ...scope.where];
    const monthParams = [monthRange.startDate, monthRange.endDate, ...scope.params];

    const daySummary = await dbHelpers.get(
        `SELECT
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0), 2) AS ingresos,
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'egreso' THEN m.monto ELSE 0 END), 0), 2) AS egresos,
            COUNT(*) AS movimientos
         FROM movimientos_caja m
         WHERE ${dayWhere.join(' AND ')}`,
        dayParams
    );

    const monthSummary = await dbHelpers.get(
        `SELECT
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0), 2) AS ingresos,
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'egreso' THEN m.monto ELSE 0 END), 0), 2) AS egresos,
            COUNT(*) AS movimientos
         FROM movimientos_caja m
         WHERE ${monthWhere.join(' AND ')}`,
        monthParams
    );

    const openBoxScope = [];
    const openBoxParams = [];
    const cajaId = parseNumericId(filters.caja_id || filters.cajaId);
    if (cajaId) {
        openBoxScope.push('c.id = ?');
        openBoxParams.push(cajaId);
    }
    const userId = parseNumericId(filters.usuario_id || filters.usuarioId);
    if (userId) {
        openBoxScope.push('c.usuario_id = ?');
        openBoxParams.push(userId);
    }

    const openBoxes = await dbHelpers.all(
        `SELECT
            c.id,
            c.usuario_id,
            c.fecha_apertura,
            c.saldo_inicial,
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'egreso' THEN -m.monto ELSE m.monto END), 0), 2) AS movimientos_neto,
            COALESCE(
                NULLIF(
                    TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, u.apellidos, '')),
                    ''
                ),
                'Usuario'
            ) AS usuario_nombre
         FROM cajas c
         LEFT JOIN movimientos_caja m ON m.caja_id = c.id
         LEFT JOIN usuarios u ON u.id = c.usuario_id
         WHERE c.estado = 'abierta'
           ${openBoxScope.length ? `AND ${openBoxScope.join(' AND ')}` : ''}
         GROUP BY c.id
         ORDER BY datetime(c.fecha_apertura) DESC, c.id DESC`,
        openBoxParams
    );

    const openBoxesMapped = openBoxes.map((box) => {
        const openedAt = new Date(box.fecha_apertura);
        const openMinutes = Number.isNaN(openedAt.getTime())
            ? 0
            : Math.max(0, Math.floor((Date.now() - openedAt.getTime()) / 60000));
        const saldoActual = roundMoney((box.saldo_inicial || 0) + (box.movimientos_neto || 0));
        return {
            id: box.id,
            usuario_id: box.usuario_id,
            usuario_nombre: box.usuario_nombre || 'Usuario',
            fecha_apertura: box.fecha_apertura,
            saldo_inicial: roundMoney(box.saldo_inicial || 0),
            movimientos_neto: roundMoney(box.movimientos_neto || 0),
            saldo_actual: saldoActual,
            tiempo_abierta_minutos: openMinutes,
            tiempo_abierta_label: formatOpenDuration(openMinutes),
        };
    });

    const dayIncome = roundMoney(daySummary?.ingresos || 0);
    const dayExpense = roundMoney(daySummary?.egresos || 0);
    const monthIncome = roundMoney(monthSummary?.ingresos || 0);
    const monthExpense = roundMoney(monthSummary?.egresos || 0);

    return {
        day: {
            date: day,
            ingresos: dayIncome,
            egresos: dayExpense,
            neto: roundMoney(dayIncome - dayExpense),
            movimientos: Number(daySummary?.movimientos || 0),
        },
        month: {
            month: monthRange.month,
            startDate: monthRange.startDate,
            endDate: monthRange.endDate,
            ingresos: monthIncome,
            egresos: monthExpense,
            neto: roundMoney(monthIncome - monthExpense),
            movimientos: Number(monthSummary?.movimientos || 0),
        },
        open_boxes: openBoxesMapped,
    };
}

async function getSaldosPorMetodo(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    const range = getDateRangeForMovements(filters);
    const scope = buildMovementWhere(filters, { useType: false });
    const metodoExpr = `COALESCE(
                NULLIF(TRIM(m.metodo), ''),
                NULLIF(TRIM(p.metodo), ''),
                'No especificado'
            )`;

    const where = ['date(m.fecha) BETWEEN date(?) AND date(?)', ...scope.where];
    const params = [range.startDate, range.endDate, ...scope.params];

    const rows = await dbHelpers.all(
        `SELECT
            ${metodoExpr} AS metodo,
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0), 2) AS ingresos,
            ROUND(COALESCE(SUM(CASE WHEN m.tipo = 'egreso' THEN m.monto ELSE 0 END), 0), 2) AS egresos,
            COUNT(*) AS movimientos
         FROM movimientos_caja m
         LEFT JOIN pagos p ON p.id = m.pago_id
         WHERE ${where.join(' AND ')}
         GROUP BY ${metodoExpr}
         ORDER BY ingresos DESC, metodo ASC`,
        params
    );

    const mapped = rows.map((row) => {
        const ingresos = roundMoney(row.ingresos || 0);
        const egresos = roundMoney(row.egresos || 0);
        return {
            metodo: row.metodo || 'No especificado',
            ingresos,
            egresos,
            neto: roundMoney(ingresos - egresos),
            movimientos: Number(row.movimientos || 0),
        };
    });

    return {
        filters: {
            ...filters,
            range,
        },
        rows: mapped,
    };
}

module.exports = {
    getMovimientosAvanzado,
    getResumenContable,
    getSaldosPorMetodo,
    roundMoney,
    clampMoney,
};
