// src/main/accounting-service.js
// Módulo de Contabilidad: Gastos, Nómina, Compras de productos

'use strict';

const cashService = require('./cash-service');
const catalogService = require('./catalog-service');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function createDbHelpers(db) {
    return {
        run(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function onRun(err) {
                    if (err) return reject(err);
                    resolve({ lastID: this.lastID, changes: this.changes });
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
        all(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            });
        },
    };
}

// ─── Schema ───────────────────────────────────────────────────────────────────

async function ensureAccountingSchema(dbHelpers) {
    // Categorías de gastos
    await dbHelpers.run(`
        CREATE TABLE IF NOT EXISTS gastos_categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6B7280',
            icono TEXT DEFAULT 'tag',
            activa INTEGER DEFAULT 1,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insertar categorías por defecto si no existen
    const defaults = [
        ['Renta / Local', '#3B82F6', 'building'],
        ['Servicios (Agua, Luz, Gas)', '#F59E0B', 'bolt'],
        ['Sueldos y Salarios', '#10B981', 'users'],
        ['Material e Insumos', '#8B5CF6', 'box'],
        ['Equipos y Herramientas', '#EF4444', 'wrench'],
        ['Marketing / Publicidad', '#EC4899', 'megaphone'],
        ['Impuestos y Contabilidad', '#F97316', 'document'],
        ['Mantenimiento', '#6366F1', 'cog'],
        ['Otros Gastos', '#6B7280', 'dots'],
    ];
    for (const [nombre, color, icono] of defaults) {
        await dbHelpers.run(
            `INSERT OR IGNORE INTO gastos_categorias (nombre, color, icono) VALUES (?, ?, ?)`,
            [nombre, color, icono]
        );
    }

    // Gastos / Egresos generales
    await dbHelpers.run(`
        CREATE TABLE IF NOT EXISTS gastos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id INTEGER,
            concepto TEXT NOT NULL,
            descripcion TEXT,
            monto REAL NOT NULL DEFAULT 0,
            metodo_pago TEXT DEFAULT 'efectivo',
            estado TEXT DEFAULT 'pagado',
            fecha_gasto TEXT NOT NULL,
            fecha_vencimiento TEXT,
            proveedor TEXT,
            referencia TEXT,
            notas TEXT,
            registrado_por INTEGER,
            caja_movimiento_id INTEGER, -- Link a movimientos_caja
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(categoria_id) REFERENCES gastos_categorias(id)
        )
    `);
    await dbHelpers.run(`CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha_gasto)`);
    await dbHelpers.run(`CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria_id)`);

    // Empleados / Colaboradores para nómina
    await dbHelpers.run(`
        CREATE TABLE IF NOT EXISTS nomina_empleados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            puesto TEXT,
            tipo TEXT DEFAULT 'empleado',
            salario_base REAL DEFAULT 0,
            frecuencia_pago TEXT DEFAULT 'mensual',
            telefono TEXT,
            email TEXT,
            rfc TEXT,
            activo INTEGER DEFAULT 1,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Pagos de nómina
    await dbHelpers.run(`
        CREATE TABLE IF NOT EXISTS nomina_pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empleado_id INTEGER NOT NULL,
            periodo_inicio TEXT NOT NULL,
            periodo_fin TEXT NOT NULL,
            monto_bruto REAL NOT NULL DEFAULT 0,
            deducciones REAL DEFAULT 0,
            monto_neto REAL NOT NULL DEFAULT 0,
            metodo_pago TEXT DEFAULT 'transferencia',
            estado TEXT DEFAULT 'pagado',
            fecha_pago TEXT,
            notas TEXT,
            registrado_por INTEGER,
            caja_movimiento_id INTEGER, -- Link a movimientos_caja
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(empleado_id) REFERENCES nomina_empleados(id)
        )
    `);
    await dbHelpers.run(`CREATE INDEX IF NOT EXISTS idx_nomina_pagos_empleado ON nomina_pagos(empleado_id)`);
    await dbHelpers.run(`CREATE INDEX IF NOT EXISTS idx_nomina_pagos_fecha ON nomina_pagos(fecha_pago)`);

    // Compras / Entradas de productos
    await dbHelpers.run(`
        CREATE TABLE IF NOT EXISTS compras_productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_nombre TEXT NOT NULL,
            categoria TEXT DEFAULT 'insumo',
            proveedor TEXT,
            cantidad REAL NOT NULL DEFAULT 1,
            unidad TEXT DEFAULT 'pieza',
            costo_unitario REAL NOT NULL DEFAULT 0,
            costo_total REAL NOT NULL DEFAULT 0,
            metodo_pago TEXT DEFAULT 'efectivo',
            fecha_compra TEXT,
            numero_factura TEXT,
            notas TEXT,
            registrado_por INTEGER,
            catalogo_id INTEGER,   -- Link a medicamentos/miscelanea
            catalogo_tipo TEXT,    -- 'medicamento' o 'miscelaneo'
            caja_movimiento_id INTEGER, -- Link a movimientos_caja
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dbHelpers.run(`CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras_productos(fecha_compra)`);

    // Intentar agregar columnas si ya existen las tablas (Migración simple)
    const tablesToAlter = [
        ['gastos', 'caja_movimiento_id', 'INTEGER'],
        ['nomina_pagos', 'caja_movimiento_id', 'INTEGER'],
        ['compras_productos', 'caja_movimiento_id', 'INTEGER'],
        ['compras_productos', 'catalogo_id', 'INTEGER'],
        ['compras_productos', 'catalogo_tipo', 'TEXT'],
    ];
    for (const [table, col, type] of tablesToAlter) {
        try {
            await dbHelpers.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        } catch (e) {
            // Probablemente ya existe la columna
        }
    }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function getDashboard(dbHelpers, { fechaInicio, fechaFin } = {}) {
    const hoy = new Date();
    const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const inicio = fechaInicio || primerDiaMes;
    const fin = fechaFin || hoy.toISOString().slice(0, 10);

    // Total gastos del período
    const gastosPeriodo = await dbHelpers.get(
        `SELECT COALESCE(SUM(monto), 0) as total FROM gastos
         WHERE fecha_gasto BETWEEN ? AND ? AND estado != 'cancelado'`,
        [inicio, fin]
    );

    // Total nómina del período
    const nominaPeriodo = await dbHelpers.get(
        `SELECT COALESCE(SUM(monto_neto), 0) as total FROM nomina_pagos
         WHERE (fecha_pago BETWEEN ? AND ?) AND estado = 'pagado'`,
        [inicio, fin]
    );

    // Total compras del período
    const comprasPeriodo = await dbHelpers.get(
        `SELECT COALESCE(SUM(costo_total), 0) as total FROM compras_productos
         WHERE fecha_compra BETWEEN ? AND ?`,
        [inicio, fin]
    );

    // Gastos pendientes
    const gastosPendientes = await dbHelpers.get(
        `SELECT COALESCE(SUM(monto), 0) as total, COUNT(*) as count FROM gastos
         WHERE estado = 'pendiente'`
    );

    // Gastos por categoría
    const gastosPorCategoria = await dbHelpers.all(
        `SELECT gc.nombre, gc.color, COALESCE(SUM(g.monto), 0) as total
         FROM gastos_categorias gc
         LEFT JOIN gastos g ON g.categoria_id = gc.id AND g.fecha_gasto BETWEEN ? AND ? AND g.estado != 'cancelado'
         WHERE gc.activa = 1
         GROUP BY gc.id
         ORDER BY total DESC`,
        [inicio, fin]
    );

    // Gastos mensuales (últimos 6 meses)
    const gastosMensuales = await dbHelpers.all(
        `SELECT strftime('%Y-%m', fecha_gasto) as mes,
                COALESCE(SUM(monto), 0) as gastos
         FROM gastos
         WHERE fecha_gasto >= date('now', '-6 months') AND estado != 'cancelado'
         GROUP BY mes ORDER BY mes ASC`
    );

    // Nómina por empleado (mes actual)
    const nominaEmpleados = await dbHelpers.all(
        `SELECT ne.nombre || ' ' || ne.apellido as nombre, ne.puesto,
                COALESCE(SUM(np.monto_neto), 0) as total_pagado
         FROM nomina_empleados ne
         LEFT JOIN nomina_pagos np ON np.empleado_id = ne.id
             AND np.fecha_pago BETWEEN ? AND ? AND np.estado = 'pagado'
         WHERE ne.activo = 1
         GROUP BY ne.id ORDER BY total_pagado DESC LIMIT 5`,
        [inicio, fin]
    );

    const totalGastos = roundMoney(gastosPeriodo.total);
    const totalNomina = roundMoney(nominaPeriodo.total);
    const totalCompras = roundMoney(comprasPeriodo.total);
    const totalEgresos = roundMoney(totalGastos + totalNomina + totalCompras);

    return {
        periodo: { inicio, fin },
        resumen: {
            totalGastos,
            totalNomina,
            totalCompras,
            totalEgresos,
            gastosPendientes: roundMoney(gastosPendientes.total),
            gastosPendientesCount: gastosPendientes.count || 0,
        },
        gastosPorCategoria,
        gastosMensuales,
        nominaEmpleados,
    };
}

// ─── Gastos ───────────────────────────────────────────────────────────────────

async function listGastos(dbHelpers, filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.fechaInicio) { conditions.push('g.fecha_gasto >= ?'); params.push(filters.fechaInicio); }
    if (filters.fechaFin) { conditions.push('g.fecha_gasto <= ?'); params.push(filters.fechaFin); }
    if (filters.categoriaId) { conditions.push('g.categoria_id = ?'); params.push(filters.categoriaId); }
    if (filters.estado) { conditions.push('g.estado = ?'); params.push(filters.estado); }
    if (filters.busqueda) {
        conditions.push('(g.concepto LIKE ? OR g.proveedor LIKE ? OR g.referencia LIKE ?)');
        const q = `%${filters.busqueda}%`;
        params.push(q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await dbHelpers.all(
        `SELECT g.*, gc.nombre as categoria_nombre, gc.color as categoria_color
         FROM gastos g
         LEFT JOIN gastos_categorias gc ON gc.id = g.categoria_id
         ${where}
         ORDER BY g.fecha_gasto DESC, g.id DESC
         LIMIT 500`,
        params
    );
    return rows;
}

async function saveGasto(dbHelpers, payload, userId, db) {
    const {
        id, categoria_id, concepto, descripcion, monto, metodo_pago,
        estado, fecha_gasto, fecha_vencimiento, proveedor, referencia, notas,
        deducir_caja, // Nuevo flag
    } = payload;

    if (!concepto || !monto || !fecha_gasto) {
        throw new Error('Concepto, monto y fecha son requeridos');
    }

    const safeMonto = roundMoney(monto);
    if (safeMonto <= 0) throw new Error('El monto debe ser mayor a 0');

    let resultId = id;

    if (id) {
        await dbHelpers.run(
            `UPDATE gastos SET categoria_id=?, concepto=?, descripcion=?, monto=?, metodo_pago=?,
             estado=?, fecha_gasto=?, fecha_vencimiento=?, proveedor=?, referencia=?, notas=?
             WHERE id=?`,
            [categoria_id || null, concepto, descripcion || null, safeMonto,
             metodo_pago || 'efectivo', estado || 'pagado', fecha_gasto,
             fecha_vencimiento || null, proveedor || null, referencia || null,
             notas || null, id]
        );
    } else {
        const result = await dbHelpers.run(
            `INSERT INTO gastos (categoria_id, concepto, descripcion, monto, metodo_pago,
             estado, fecha_gasto, fecha_vencimiento, proveedor, referencia, notas, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [categoria_id || null, concepto, descripcion || null, safeMonto,
             metodo_pago || 'efectivo', estado || 'pagado', fecha_gasto,
             fecha_vencimiento || null, proveedor || null, referencia || null,
             notas || null, userId || null]
        );
        resultId = result.lastID;
    }

    // Integración con Caja
    if (deducir_caja && (estado === 'pagado' || !estado) && !id) {
        try {
            const movement = await cashService.recordMovement(db, {
                user_id: userId,
                tipo: 'egreso',
                monto: safeMonto,
                concepto: `GASTO: ${concepto}`,
                metodo: metodo_pago || 'efectivo',
                origen: 'manual'
            });
            if (movement?.movimiento_id) {
                await dbHelpers.run(`UPDATE gastos SET caja_movimiento_id = ? WHERE id = ?`, [movement.movimiento_id, resultId]);
            }
        } catch (err) {
            console.error('[accounting] Error deduciendo de caja:', err.message);
        }
    }

    return { id: Number(resultId) };
}

async function deleteGasto(dbHelpers, id) {
    if (!id) throw new Error('ID requerido');
    await dbHelpers.run(`DELETE FROM gastos WHERE id = ?`, [id]);
    return { success: true };
}

// ─── Categorías ───────────────────────────────────────────────────────────────

async function listCategorias(dbHelpers) {
    return dbHelpers.all(`SELECT * FROM gastos_categorias WHERE activa = 1 ORDER BY nombre ASC`);
}

async function saveCategoria(dbHelpers, payload) {
    const { id, nombre, color, icono } = payload;
    if (!nombre) throw new Error('El nombre es requerido');

    if (id) {
        await dbHelpers.run(
            `UPDATE gastos_categorias SET nombre=?, color=?, icono=? WHERE id=?`,
            [nombre, color || '#6B7280', icono || 'tag', id]
        );
        return { id: Number(id) };
    }
    const result = await dbHelpers.run(
        `INSERT INTO gastos_categorias (nombre, color, icono) VALUES (?, ?, ?)`,
        [nombre, color || '#6B7280', icono || 'tag']
    );
    return { id: result.lastID };
}

async function deleteCategoria(dbHelpers, id) {
    if (!id) throw new Error('ID requerido');
    // Soft delete
    await dbHelpers.run(`UPDATE gastos_categorias SET activa = 0 WHERE id = ?`, [id]);
    return { success: true };
}

// ─── Empleados ────────────────────────────────────────────────────────────────

async function listEmpleados(dbHelpers, soloActivos = true) {
    const where = soloActivos ? 'WHERE activo = 1' : '';
    return dbHelpers.all(`SELECT * FROM nomina_empleados ${where} ORDER BY nombre ASC`);
}

async function saveEmpleado(dbHelpers, payload) {
    const { id, nombre, apellido, puesto, tipo, salario_base, frecuencia_pago, telefono, email, rfc, activo } = payload;
    if (!nombre || !apellido) throw new Error('Nombre y apellido son requeridos');

    if (id) {
        await dbHelpers.run(
            `UPDATE nomina_empleados SET nombre=?, apellido=?, puesto=?, tipo=?, salario_base=?,
             frecuencia_pago=?, telefono=?, email=?, rfc=?, activo=? WHERE id=?`,
            [nombre, apellido, puesto || null, tipo || 'empleado', roundMoney(salario_base || 0),
             frecuencia_pago || 'mensual', telefono || null, email || null, rfc || null,
             activo !== false ? 1 : 0, id]
        );
        return { id: Number(id) };
    }
    const result = await dbHelpers.run(
        `INSERT INTO nomina_empleados (nombre, apellido, puesto, tipo, salario_base, frecuencia_pago, telefono, email, rfc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre, apellido, puesto || null, tipo || 'empleado', roundMoney(salario_base || 0),
         frecuencia_pago || 'mensual', telefono || null, email || null, rfc || null]
    );
    return { id: result.lastID };
}

async function deleteEmpleado(dbHelpers, id) {
    if (!id) throw new Error('ID requerido');
    await dbHelpers.run(`UPDATE nomina_empleados SET activo = 0 WHERE id = ?`, [id]);
    return { success: true };
}

// ─── Pagos de Nómina ─────────────────────────────────────────────────────────

async function listNominaPagos(dbHelpers, filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.empleadoId) { conditions.push('np.empleado_id = ?'); params.push(filters.empleadoId); }
    if (filters.fechaInicio) { conditions.push('np.fecha_pago >= ?'); params.push(filters.fechaInicio); }
    if (filters.fechaFin) { conditions.push('np.fecha_pago <= ?'); params.push(filters.fechaFin); }
    if (filters.estado) { conditions.push('np.estado = ?'); params.push(filters.estado); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return dbHelpers.all(
        `SELECT np.*, ne.nombre || ' ' || ne.apellido as empleado_nombre, ne.puesto
         FROM nomina_pagos np
         JOIN nomina_empleados ne ON ne.id = np.empleado_id
         ${where}
         ORDER BY np.fecha_pago DESC, np.id DESC
         LIMIT 500`,
        params
    );
}

async function saveNominaPago(dbHelpers, payload, userId, db) {
    const {
        id, empleado_id, periodo_inicio, periodo_fin, monto_bruto,
        deducciones, monto_neto, metodo_pago, estado, fecha_pago, notas,
        deducir_caja, // Nuevo flag
    } = payload;

    if (!empleado_id || !periodo_inicio || !periodo_fin) {
        throw new Error('Empleado y período son requeridos');
    }

    const safeBruto = roundMoney(monto_bruto || 0);
    const safeDeducciones = roundMoney(deducciones || 0);
    const safeNeto = monto_neto != null ? roundMoney(monto_neto) : roundMoney(safeBruto - safeDeducciones);

    let resultId = id;

    if (id) {
        await dbHelpers.run(
            `UPDATE nomina_pagos SET empleado_id=?, periodo_inicio=?, periodo_fin=?,
             monto_bruto=?, deducciones=?, monto_neto=?, metodo_pago=?,
             estado=?, fecha_pago=?, notas=? WHERE id=?`,
            [empleado_id, periodo_inicio, periodo_fin, safeBruto, safeDeducciones,
             safeNeto, metodo_pago || 'transferencia', estado || 'pagado',
             fecha_pago || null, notas || null, id]
        );
    } else {
        const result = await dbHelpers.run(
            `INSERT INTO nomina_pagos (empleado_id, periodo_inicio, periodo_fin, monto_bruto,
             deducciones, monto_neto, metodo_pago, estado, fecha_pago, notas, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [empleado_id, periodo_inicio, periodo_fin, safeBruto, safeDeducciones,
             safeNeto, metodo_pago || 'transferencia', estado || 'pagado',
             fecha_pago || null, notas || null, userId || null]
        );
        resultId = result.lastID;
    }

    // Integración con Caja
    if (deducir_caja && (estado === 'pagado' || !estado) && !id) {
        try {
            const emp = await dbHelpers.get(`SELECT nombre, apellido FROM nomina_empleados WHERE id=?`, [empleado_id]);
            const movement = await cashService.recordMovement(db, {
                user_id: userId,
                tipo: 'egreso',
                monto: safeNeto,
                concepto: `NÓMINA: ${emp?.nombre || ''} ${emp?.apellido || ''}`,
                metodo: metodo_pago || 'transferencia',
                origen: 'manual'
            });
            if (movement?.movimiento_id) {
                await dbHelpers.run(`UPDATE nomina_pagos SET caja_movimiento_id = ? WHERE id = ?`, [movement.movimiento_id, resultId]);
            }
        } catch (err) {
            console.error('[accounting] Error deduciendo nómina de caja:', err.message);
        }
    }

    return { id: Number(resultId) };
}

async function deleteNominaPago(dbHelpers, id) {
    if (!id) throw new Error('ID requerido');
    await dbHelpers.run(`DELETE FROM nomina_pagos WHERE id = ?`, [id]);
    return { success: true };
}

// ─── Compras ─────────────────────────────────────────────────────────────────

async function listCompras(dbHelpers, filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.fechaInicio) { conditions.push('fecha_compra >= ?'); params.push(filters.fechaInicio); }
    if (filters.fechaFin) { conditions.push('fecha_compra <= ?'); params.push(filters.fechaFin); }
    if (filters.proveedor) { conditions.push('proveedor LIKE ?'); params.push(`%${filters.proveedor}%`); }
    if (filters.busqueda) {
        conditions.push('(producto_nombre LIKE ? OR proveedor LIKE ? OR numero_factura LIKE ?)');
        const q = `%${filters.busqueda}%`;
        params.push(q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return dbHelpers.all(
        `SELECT * FROM compras_productos ${where} ORDER BY fecha_compra DESC, id DESC LIMIT 500`,
        params
    );
}

async function saveCompra(dbHelpers, payload, userId, db) {
    const {
        id, producto_nombre, categoria, proveedor, cantidad, unidad,
        costo_unitario, costo_total, metodo_pago, fecha_compra, numero_factura, notas,
        actualizar_inventario, catalogo_id, catalogo_tipo, // Nuevos flags
        deducir_caja, // Nuevo flag
    } = payload;

    if (!producto_nombre || !fecha_compra) {
        throw new Error('Producto y fecha son requeridos');
    }

    const safeCantidad = Number(cantidad) || 1;
    const safeUnitario = roundMoney(costo_unitario || 0);
    const safeTotal = costo_total != null ? roundMoney(costo_total) : roundMoney(safeCantidad * safeUnitario);

    let resultId = id;

    if (id) {
        await dbHelpers.run(
            `UPDATE compras_productos SET producto_nombre=?, categoria=?, proveedor=?,
             cantidad=?, unidad=?, costo_unitario=?, costo_total=?,
             metodo_pago=?, fecha_compra=?, numero_factura=?, notas=? WHERE id=?`,
            [producto_nombre, categoria || 'insumo', proveedor || null, safeCantidad,
             unidad || 'pieza', safeUnitario, safeTotal,
             metodo_pago || 'efectivo', fecha_compra, numero_factura || null, notas || null, id]
        );
    } else {
        const result = await dbHelpers.run(
            `INSERT INTO compras_productos (producto_nombre, categoria, proveedor, cantidad, unidad,
             costo_unitario, costo_total, metodo_pago, fecha_compra, numero_factura, notas, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [producto_nombre, categoria || 'insumo', proveedor || null, safeCantidad,
             unidad || 'pieza', safeUnitario, safeTotal,
             metodo_pago || 'efectivo', fecha_compra, numero_factura || null, notas || null, userId || null]
        );
        resultId = result.lastID;
    }

    // Integración con Inventario
    if (actualizar_inventario && catalogo_id && !id) {
        try {
            const table = catalogo_tipo === 'medicamento' ? 'medicamentos' : 'miscelanea';
            await dbHelpers.run(
                `UPDATE ${table} SET stock = stock + ?, precio = ?, proveedor = ? WHERE id = ?`,
                [safeCantidad, safeUnitario, proveedor || null, catalogo_id]
            );
            // Guardar el link en la compra
            await dbHelpers.run(
                `UPDATE compras_productos SET catalogo_id = ?, catalogo_tipo = ? WHERE id = ?`,
                [catalogo_id, catalogo_tipo, resultId]
            );
        } catch (err) {
            console.error('[accounting] Error actualizando inventario:', err.message);
        }
    }

    // Integración con Caja
    if (deducir_caja && !id) {
        try {
            const movement = await cashService.recordMovement(db, {
                user_id: userId,
                tipo: 'egreso',
                monto: safeTotal,
                concepto: `COMPRA: ${producto_nombre}`,
                metodo: metodo_pago || 'efectivo',
                origen: 'manual'
            });
            if (movement?.movimiento_id) {
                await dbHelpers.run(`UPDATE compras_productos SET caja_movimiento_id = ? WHERE id = ?`, [movement.movimiento_id, resultId]);
            }
        } catch (err) {
            console.error('[accounting] Error deduciendo compra de caja:', err.message);
        }
    }

    return { id: Number(resultId) };
}

async function deleteCompra(dbHelpers, id) {
    if (!id) throw new Error('ID requerido');
    await dbHelpers.run(`DELETE FROM compras_productos WHERE id = ?`, [id]);
    return { success: true };
}

// ─── Register ─────────────────────────────────────────────────────────────────

function registerAccountingHandlers(ipcMain, db, assertAuthorizedAppSession) {
    const h = createDbHelpers(db);

    // Initialize schema once at startup
    ensureAccountingSchema(h).catch(err =>
        console.error('[accounting] Error inicializando esquema:', err)
    );

    function handle(channel, fn) {
        ipcMain.handle(channel, async (event, ...args) => {
            const session = assertAuthorizedAppSession(event);
            return fn(h, ...args, session?.user?.id);
        });
    }

    // Dashboard
    handle('accounting-get-dashboard', (h, filters) => getDashboard(h, filters || {}));

    // Gastos
    handle('accounting-list-gastos', (h, filters) => listGastos(h, filters || {}));
    handle('accounting-save-gasto', (h, payload, userId) => saveGasto(h, payload || {}, userId, db));
    handle('accounting-delete-gasto', (h, id) => deleteGasto(h, id));

    // Categorías
    handle('accounting-list-categorias', (h) => listCategorias(h));
    handle('accounting-save-categoria', (h, payload) => saveCategoria(h, payload || {}));
    handle('accounting-delete-categoria', (h, id) => deleteCategoria(h, id));

    // Empleados
    handle('accounting-list-empleados', (h, soloActivos) => listEmpleados(h, soloActivos !== false));
    handle('accounting-save-empleado', (h, payload) => saveEmpleado(h, payload || {}));
    handle('accounting-delete-empleado', (h, id) => deleteEmpleado(h, id));

    // Nómina pagos
    handle('accounting-list-nomina-pagos', (h, filters) => listNominaPagos(h, filters || {}));
    handle('accounting-save-nomina-pago', (h, payload, userId) => saveNominaPago(h, payload || {}, userId, db));
    handle('accounting-delete-nomina-pago', (h, id) => deleteNominaPago(h, id));

    // Compras
    handle('accounting-list-compras', (h, filters) => listCompras(h, filters || {}));
    handle('accounting-save-compra', (h, payload, userId) => saveCompra(h, payload || {}, userId, db));
    handle('accounting-delete-compra', (h, id) => deleteCompra(h, id));
}

module.exports = { registerAccountingHandlers, ensureAccountingSchema };
