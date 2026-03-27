const { createDbHelpers } = require('./db-helpers');
const { normalizeRole } = require('./auth-policy');

const ALLOWED_MOVEMENT_TYPES = new Set(['ingreso', 'egreso']);
const ALLOWED_MOVEMENT_ORIGINS = new Set(['manual', 'receta_rapida', 'receta_medica']);

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeId(value, label) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`${label} invalido`);
    }
    return id;
}

function normalizeOptionalText(value, { maxLength = 2000 } = {}) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
}

function normalizeRequiredText(value, label, { maxLength = 255 } = {}) {
    const normalized = normalizeOptionalText(value, { maxLength });
    if (!normalized) {
        throw new Error(`${label} requerido`);
    }
    return normalized;
}

function normalizeAmount(value, { label = 'Monto', allowZero = false } = {}) {
    const amount = roundMoney(value);
    if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
        throw new Error(`${label} invalido`);
    }
    return amount;
}

function normalizeMovementType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!ALLOWED_MOVEMENT_TYPES.has(normalized)) {
        throw new Error('Tipo de movimiento no soportado');
    }
    return normalized;
}

function normalizeMovementOrigin(value) {
    const normalized = String(value || 'manual').trim().toLowerCase();
    if (!ALLOWED_MOVEMENT_ORIGINS.has(normalized)) {
        throw new Error('Origen de movimiento no soportado');
    }
    return normalized;
}

function sanitizeJsonPayload(value, label = 'Payload') {
    if (value == null) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        throw new Error(`${label} invalido`);
    }
}

function isAdminRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return (
        normalized === 'admin' ||
        normalized === 'administrador' ||
        normalized === 'superadmin' ||
        normalized === 'gerente' ||
        normalizeRole(normalized) === 'Administrador'
    );
}

async function withTransaction(dbHelpers, callback) {
    await dbHelpers.run('BEGIN IMMEDIATE');
    try {
        const result = await callback();
        await dbHelpers.run('COMMIT');
        return result;
    } catch (error) {
        try {
            await dbHelpers.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('ROLLBACK failed', rollbackError);
        }
        throw error;
    }
}

async function recordAudit(dbHelpers, { userId = null, action, entity, entityId = null, payload = null }) {
    await dbHelpers.run(
        `INSERT INTO auditoria_financiera (usuario_id, accion, entidad, entidad_id, payload)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, action, entity, entityId, payload ? JSON.stringify(payload) : null]
    );
}

async function getUserRow(dbHelpers, userId) {
    const row = await dbHelpers.get(
        `SELECT id, rol
         FROM usuarios
         WHERE id = ?
         LIMIT 1`,
        [userId]
    );
    if (!row?.id) {
        throw new Error('Usuario no encontrado');
    }
    return row;
}

async function findOpenCajaByUser(dbHelpers, userId) {
    return dbHelpers.get(
        `SELECT id, usuario_id, estado, saldo_inicial, saldo_final
         FROM cajas
         WHERE usuario_id = ?
           AND estado = 'abierta'
         ORDER BY fecha_apertura DESC, id DESC
         LIMIT 1`,
        [userId]
    );
}

async function getCajaById(dbHelpers, cajaId) {
    return dbHelpers.get(
        `SELECT id, usuario_id, estado, saldo_inicial, saldo_final
         FROM cajas
         WHERE id = ?
         LIMIT 1`,
        [cajaId]
    );
}

async function resolveCajaForActor(dbHelpers, actorUserId, cajaId = null) {
    const actor = await getUserRow(dbHelpers, actorUserId);

    if (!cajaId) {
        const ownOpenCaja = await findOpenCajaByUser(dbHelpers, actor.id);
        if (!ownOpenCaja?.id) {
            throw new Error('Debe abrir una caja propia para registrar el movimiento');
        }
        return { actor, caja: ownOpenCaja };
    }

    const caja = await getCajaById(dbHelpers, cajaId);
    if (!caja?.id) {
        throw new Error('Caja no encontrada');
    }
    if (Number(caja.usuario_id) !== Number(actor.id) && !isAdminRole(actor.rol)) {
        throw new Error('No tienes permisos para gestionar esta caja');
    }
    return { actor, caja };
}

async function openCashBox(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const userId = normalizeId(payload.usuario_id || payload.user_id, 'Usuario');
    const initialBalance = normalizeAmount(payload.saldo_inicial, {
        label: 'Saldo inicial',
        allowZero: true,
    });
    const notes = normalizeOptionalText(payload.notas);

    return withTransaction(dbHelpers, async () => {
        await getUserRow(dbHelpers, userId);

        const existing = await findOpenCajaByUser(dbHelpers, userId);
        if (existing?.id) {
            const error = new Error('Ya existe una caja abierta para este usuario');
            error.code = 'OPEN_BOX_EXISTS';
            error.cajaId = existing.id;
            throw error;
        }

        const insertResult = await dbHelpers.run(
            `INSERT INTO cajas (usuario_id, saldo_inicial, notas, estado)
             VALUES (?, ?, ?, 'abierta')`,
            [userId, initialBalance, notes]
        );

        await recordAudit(dbHelpers, {
            userId,
            action: 'abrir_caja',
            entity: 'caja',
            entityId: insertResult.lastID,
            payload: {
                caja_id: insertResult.lastID,
                saldo_inicial: initialBalance,
                notas: notes,
                origen: 'cash_service',
            },
        });

        return {
            ok: true,
            caja_id: insertResult.lastID,
            usuario_id: userId,
            saldo_inicial: initialBalance,
            notas: notes,
            estado: 'abierta',
        };
    });
}

async function closeCashBox(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const cajaId = normalizeId(payload.caja_id, 'Caja');
    const actorUserId = normalizeId(payload.usuario_id || payload.user_id, 'Usuario');
    const finalBalance = normalizeAmount(payload.saldo_final, {
        label: 'Saldo final',
        allowZero: true,
    });
    const difference = roundMoney(payload.diferencia || 0);
    const arqueo = sanitizeJsonPayload(payload.arqueo, 'Arqueo');

    return withTransaction(dbHelpers, async () => {
        const { actor, caja } = await resolveCajaForActor(dbHelpers, actorUserId, cajaId);
        if (String(caja.estado || '').toLowerCase() !== 'abierta') {
            throw new Error('La caja ya esta cerrada');
        }

        const updateResult = await dbHelpers.run(
            `UPDATE cajas
             SET estado = 'cerrada',
                 fecha_cierre = CURRENT_TIMESTAMP,
                 saldo_final = ?,
                 arqueo = ?
             WHERE id = ?
               AND estado = 'abierta'`,
            [finalBalance, arqueo ? JSON.stringify(arqueo) : null, cajaId]
        );

        if (!Number(updateResult.changes || 0)) {
            throw new Error('No se pudo cerrar la caja');
        }

        await recordAudit(dbHelpers, {
            userId: actor.id,
            action: 'cerrar_caja',
            entity: 'caja',
            entityId: cajaId,
            payload: {
                caja_id: cajaId,
                saldo_final: finalBalance,
                diferencia: difference,
                arqueo,
                origen: 'cash_service',
            },
        });

        return {
            ok: true,
            caja_id: cajaId,
            usuario_id: Number(caja.usuario_id),
            saldo_final: finalBalance,
            diferencia: difference,
            estado: 'cerrada',
        };
    });
}

async function recordMovement(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const actorUserId = normalizeId(payload.usuario_id || payload.user_id, 'Usuario');
    const cajaId = payload.caja_id ? normalizeId(payload.caja_id, 'Caja') : null;
    const movementType = normalizeMovementType(payload.tipo);
    const amount = normalizeAmount(payload.monto, { label: 'Monto' });
    const concept = normalizeRequiredText(payload.concepto, 'Concepto');
    const method = normalizeOptionalText(payload.metodo, { maxLength: 120 });
    const origin = normalizeMovementOrigin(payload.origen);
    const patientId = payload.paciente_id ? normalizeId(payload.paciente_id, 'Paciente') : null;

    return withTransaction(dbHelpers, async () => {
        const { actor, caja } = await resolveCajaForActor(dbHelpers, actorUserId, cajaId);
        if (String(caja.estado || '').toLowerCase() !== 'abierta') {
            throw new Error('La caja esta cerrada');
        }

        const insertResult = await dbHelpers.run(
            `INSERT INTO movimientos_caja
             (caja_id, tipo, monto, concepto, usuario_id, pago_id, paciente_id, metodo, origen)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
            [caja.id, movementType, amount, concept, actor.id, patientId, method, origin]
        );

        await recordAudit(dbHelpers, {
            userId: actor.id,
            action: origin === 'manual' ? 'movimiento_caja_manual' : 'movimiento_caja_operativo',
            entity: 'movimiento_caja',
            entityId: insertResult.lastID,
            payload: {
                movimiento_id: insertResult.lastID,
                caja_id: caja.id,
                tipo: movementType,
                monto: amount,
                concepto: concept,
                metodo: method,
                paciente_id: patientId,
                origen: origin,
            },
        });

        return {
            ok: true,
            movimiento_id: insertResult.lastID,
            caja_id: caja.id,
            usuario_id: actor.id,
            tipo: movementType,
            monto: amount,
            concepto: concept,
            metodo: method,
            paciente_id: patientId,
            origen: origin,
        };
    });
}

module.exports = {
    openCashBox,
    closeCashBox,
    recordMovement,
};
