const { createDbHelpers } = require('./db-helpers');

const VALID_APPOINTMENT_STATUSES = new Set([
    'pendiente',
    'confirmado',
    'en-sala',
    'atendido',
    'no-asiste',
    'no_asiste',
    'cancelado',
]);

function normalizeId(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizeDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
        return raw.length === 16 ? `${raw}:00` : raw;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const seconds = String(parsed.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeStatus(value) {
    const normalized = String(value || 'pendiente').trim().toLowerCase();
    if (!VALID_APPOINTMENT_STATUSES.has(normalized)) {
        throw new Error(`Estado de cita no soportado: ${value}`);
    }
    return normalized === 'no_asiste' ? 'no-asiste' : normalized;
}

function splitDateTime(value) {
    const [appointmentDate = '', timeWithSeconds = ''] = String(value || '').split(' ');
    return {
        appointmentDate,
        appointmentTime: timeWithSeconds.slice(0, 5),
    };
}

function buildProfessionalName(row) {
    const dentistFullName = [row?.dentista_nombre, row?.dentista_apellido].filter(Boolean).join(' ').trim();
    if (dentistFullName) {
        return `Dr(a). ${dentistFullName}`.trim();
    }
    if (row?.especialista_nombre && row?.especialista_especialidad) {
        return `${row.especialista_nombre} - ${row.especialista_especialidad}`.trim();
    }
    return row?.especialista_nombre || null;
}

async function assertEntityExists(dbHelpers, table, id, label) {
    if (!id) return;
    const row = await dbHelpers.get(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    if (!row?.id) {
        throw new Error(`${label} no encontrado`);
    }
}

async function ensureNoScheduleConflict(dbHelpers, payload = {}, excludeAppointmentId = null) {
    const appointmentId = normalizeId(excludeAppointmentId);
    const patientId = normalizeId(payload.paciente_id);
    const dentistId = normalizeId(payload.dentista_id);
    const specialistId = normalizeId(payload.especialista_id);
    const startDateTime = normalizeDateTime(payload.fecha_hora);
    const duration = Number(payload.duracion_minutos || 0);

    if (!patientId) throw new Error('Paciente invalido');
    if (!startDateTime) throw new Error('Fecha y hora invalidas');
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('La duracion de la cita debe ser mayor a 0');
    }

    const sql = `
        SELECT
            c.id,
            c.paciente_id,
            c.dentista_id,
            c.especialista_id,
            c.fecha_hora,
            c.duracion_minutos,
            p.nombre,
            p.apellido
        FROM citas c
        JOIN pacientes p ON p.id = c.paciente_id
        WHERE (? IS NULL OR c.id <> ?)
          AND datetime(c.fecha_hora) < datetime(?, '+' || ? || ' minutes')
          AND datetime(?) < datetime(c.fecha_hora, '+' || COALESCE(c.duracion_minutos, 30) || ' minutes')
          AND (
                c.paciente_id = ?
                OR (? IS NOT NULL AND c.dentista_id = ?)
                OR (? IS NOT NULL AND c.especialista_id = ?)
          )
        ORDER BY c.fecha_hora
        LIMIT 1
    `;

    const conflict = await dbHelpers.get(sql, [
        appointmentId,
        appointmentId,
        startDateTime,
        duration,
        startDateTime,
        patientId,
        dentistId,
        dentistId,
        specialistId,
        specialistId,
    ]);

    if (!conflict) return;

    const conflictOwner = conflict.paciente_id === patientId
        ? 'el paciente'
        : (dentistId && conflict.dentista_id === dentistId ? 'el profesional' : 'el especialista');
    throw new Error(`Ya existe una cita traslapada para ${conflictOwner}`);
}

async function getNotificationDetails(db, appointmentId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(appointmentId);
    if (!id) return null;

    const row = await dbHelpers.get(
        `SELECT
            c.id,
            c.fecha_hora,
            c.duracion_minutos,
            c.motivo,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido,
            p.email AS paciente_email,
            u.nombre AS dentista_nombre,
            u.apellido AS dentista_apellido,
            e.nombre AS especialista_nombre,
            e.especialidad AS especialista_especialidad
         FROM citas c
         JOIN pacientes p ON p.id = c.paciente_id
         LEFT JOIN usuarios u ON u.id = c.dentista_id
         LEFT JOIN especialistas e ON e.id = c.especialista_id
         WHERE c.id = ?`,
        [id]
    );

    if (!row || !row.paciente_email) return null;
    const { appointmentDate, appointmentTime } = splitDateTime(row.fecha_hora);
    if (!appointmentDate || !appointmentTime) return null;

    return {
        patientEmail: row.paciente_email,
        patientName: `${row.paciente_nombre || ''} ${row.paciente_apellido || ''}`.trim(),
        appointmentDate,
        appointmentTime,
        reason: row.motivo || null,
        dentistName: buildProfessionalName(row),
        duration: Number(row.duracion_minutos || 30),
    };
}

async function listProfessionals(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all(
        'SELECT id, nombre, apellido, rol FROM usuarios ORDER BY nombre COLLATE NOCASE ASC, apellido COLLATE NOCASE ASC, id ASC'
    );
}

async function listSpecialists(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all(
        `SELECT
            id,
            nombre,
            especialidad,
            COALESCE(activo, 1) AS activo
         FROM especialistas
         ORDER BY nombre COLLATE NOCASE ASC, especialidad COLLATE NOCASE ASC, id ASC`
    );
}

async function listPatients(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all(
        'SELECT id, nombre, apellido FROM pacientes ORDER BY nombre COLLATE NOCASE ASC, apellido COLLATE NOCASE ASC, id ASC'
    );
}

async function listDailyAppointments(db, dateValue) {
    const dbHelpers = createDbHelpers(db);
    const date = normalizeText(dateValue);
    if (!date) throw new Error('Fecha invalida');
    return dbHelpers.all(
        `SELECT
            c.id,
            c.paciente_id,
            c.fecha_hora,
            c.duracion_minutos,
            c.motivo,
            c.estado,
            c.dentista_id,
            c.monto,
            c.especialista_id,
            p.nombre,
            p.apellido,
            p.telefono,
            u.nombre AS dentista_nombre,
            u.apellido AS dentista_apellido,
            e.nombre AS especialista_nombre,
            e.especialidad AS especialista_especialidad
         FROM citas c
         JOIN pacientes p ON p.id = c.paciente_id
         LEFT JOIN usuarios u ON u.id = c.dentista_id
         LEFT JOIN especialistas e ON e.id = c.especialista_id
         WHERE date(c.fecha_hora) = ?
         ORDER BY c.fecha_hora`,
        [date]
    );
}

async function listAppointmentsInRange(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    const startDate = normalizeText(filters.startDate);
    const endDate = normalizeText(filters.endDate);
    const dentistId = normalizeId(filters.dentistId);

    if (!startDate || !endDate) {
        throw new Error('Debes indicar el rango de fechas');
    }

    let sql = `
        SELECT
            c.id,
            c.paciente_id,
            c.fecha_hora,
            c.duracion_minutos,
            c.motivo,
            c.estado,
            c.dentista_id,
            c.monto,
            c.especialista_id,
            p.nombre,
            p.apellido,
            u.nombre AS dentista_nombre,
            u.apellido AS dentista_apellido,
            e.nombre AS especialista_nombre,
            e.especialidad AS especialista_especialidad
        FROM citas c
        JOIN pacientes p ON p.id = c.paciente_id
        LEFT JOIN usuarios u ON u.id = c.dentista_id
        LEFT JOIN especialistas e ON e.id = c.especialista_id
        WHERE date(c.fecha_hora) BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (dentistId) {
        sql += ' AND c.dentista_id = ?';
        params.push(dentistId);
    }

    sql += ' ORDER BY c.fecha_hora';
    return dbHelpers.all(sql, params);
}

async function createAppointment(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = normalizeId(payload.paciente_id);
    const dentistId = normalizeId(payload.dentista_id);
    const specialistId = normalizeId(payload.especialista_id);
    const appointmentDateTime = normalizeDateTime(payload.fecha_hora);
    const duration = Number(payload.duracion_minutos || 0);
    const status = normalizeStatus(payload.estado || 'pendiente');

    if (!patientId) throw new Error('Selecciona un paciente');
    if (!appointmentDateTime) throw new Error('Fecha y hora invalidas');
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('La duracion debe ser mayor a 0');

    await assertEntityExists(dbHelpers, 'pacientes', patientId, 'Paciente');
    await assertEntityExists(dbHelpers, 'usuarios', dentistId, 'Profesional');
    await assertEntityExists(dbHelpers, 'especialistas', specialistId, 'Especialista');
    await ensureNoScheduleConflict(dbHelpers, {
        paciente_id: patientId,
        dentista_id: dentistId,
        especialista_id: specialistId,
        fecha_hora: appointmentDateTime,
        duracion_minutos: duration,
    });

    const insert = await dbHelpers.run(
        `INSERT INTO citas (
            paciente_id,
            dentista_id,
            especialista_id,
            fecha_hora,
            duracion_minutos,
            motivo,
            estado,
            monto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            patientId,
            dentistId,
            specialistId,
            appointmentDateTime,
            duration,
            normalizeText(payload.motivo),
            status,
            Number(payload.monto || 0) || 0,
        ]
    );

    return {
        id: insert.lastID,
        notification: await getNotificationDetails(db, insert.lastID),
    };
}

async function updateAppointment(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const appointmentId = normalizeId(payload.id || payload.appointmentId);
    const patientId = normalizeId(payload.paciente_id);
    const dentistId = normalizeId(payload.dentista_id);
    const specialistId = normalizeId(payload.especialista_id);
    const appointmentDateTime = normalizeDateTime(payload.fecha_hora);
    const duration = Number(payload.duracion_minutos || 0);
    const status = normalizeStatus(payload.estado || 'pendiente');

    if (!appointmentId) throw new Error('Cita invalida');
    if (!patientId) throw new Error('Selecciona un paciente');
    if (!appointmentDateTime) throw new Error('Fecha y hora invalidas');
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('La duracion debe ser mayor a 0');

    await assertEntityExists(dbHelpers, 'citas', appointmentId, 'Cita');
    await assertEntityExists(dbHelpers, 'pacientes', patientId, 'Paciente');
    await assertEntityExists(dbHelpers, 'usuarios', dentistId, 'Profesional');
    await assertEntityExists(dbHelpers, 'especialistas', specialistId, 'Especialista');
    await ensureNoScheduleConflict(dbHelpers, {
        paciente_id: patientId,
        dentista_id: dentistId,
        especialista_id: specialistId,
        fecha_hora: appointmentDateTime,
        duracion_minutos: duration,
    }, appointmentId);

    await dbHelpers.run(
        `UPDATE citas
         SET paciente_id = ?,
             dentista_id = ?,
             especialista_id = ?,
             fecha_hora = ?,
             duracion_minutos = ?,
             motivo = ?,
             estado = ?
         WHERE id = ?`,
        [
            patientId,
            dentistId,
            specialistId,
            appointmentDateTime,
            duration,
            normalizeText(payload.motivo),
            status,
            appointmentId,
        ]
    );

    return {
        id: appointmentId,
        notification: await getNotificationDetails(db, appointmentId),
    };
}

async function updateAppointmentStatus(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const appointmentId = normalizeId(payload.appointmentId || payload.id);
    const status = normalizeStatus(payload.status || payload.estado);

    if (!appointmentId) throw new Error('Cita invalida');

    await dbHelpers.run('UPDATE citas SET estado = ? WHERE id = ?', [status, appointmentId]);
    return {
        id: appointmentId,
        notification: await getNotificationDetails(db, appointmentId),
    };
}

async function moveAppointment(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const appointmentId = normalizeId(payload.appointmentId || payload.id);
    const appointmentDateTime = normalizeDateTime(payload.fecha_hora);
    const durationMinutes = payload.duracion_minutos !== undefined && payload.duracion_minutos !== null
        ? Number(payload.duracion_minutos)
        : null;

    if (!appointmentId) throw new Error('Cita invalida');
    if (!appointmentDateTime) throw new Error('Fecha y hora invalidas');

    const current = await dbHelpers.get(
        `SELECT id, paciente_id, dentista_id, especialista_id, duracion_minutos
         FROM citas
         WHERE id = ?`,
        [appointmentId]
    );
    if (!current) {
        throw new Error('Cita no encontrada');
    }

    const finalDuration = durationMinutes !== null ? durationMinutes : Number(current.duracion_minutos || 30);

    if (finalDuration <= 0) {
        throw new Error('La duracion de la cita debe ser mayor a 0');
    }

    await ensureNoScheduleConflict(dbHelpers, {
        paciente_id: current.paciente_id,
        dentista_id: current.dentista_id,
        especialista_id: current.especialista_id,
        fecha_hora: appointmentDateTime,
        duracion_minutos: finalDuration,
    }, appointmentId);

    if (durationMinutes !== null) {
        await dbHelpers.run('UPDATE citas SET fecha_hora = ?, duracion_minutos = ? WHERE id = ?', [appointmentDateTime, finalDuration, appointmentId]);
    } else {
        await dbHelpers.run('UPDATE citas SET fecha_hora = ? WHERE id = ?', [appointmentDateTime, appointmentId]);
    }

    return { ok: true, id: appointmentId };
}

async function deleteAppointment(db, appointmentId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(appointmentId);
    if (!id) throw new Error('Cita invalida');

    const result = await dbHelpers.run('DELETE FROM citas WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

async function listUpcomingAppointments(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    const startDateTime = normalizeDateTime(filters.startDateTime);
    const endDateTime = normalizeDateTime(filters.endDateTime);
    if (!startDateTime || !endDateTime) {
        throw new Error('Rango de fechas invalido');
    }

    return dbHelpers.all(
        `SELECT
            c.id,
            c.paciente_id,
            c.fecha_hora,
            c.motivo,
            c.estado,
            p.nombre,
            p.apellido,
            u.nombre AS dentista_nombre,
            u.apellido AS dentista_apellido,
            e.nombre AS especialista_nombre,
            e.especialidad AS especialista_especialidad
         FROM citas c
         JOIN pacientes p ON p.id = c.paciente_id
         LEFT JOIN usuarios u ON u.id = c.dentista_id
         LEFT JOIN especialistas e ON e.id = c.especialista_id
         WHERE c.fecha_hora BETWEEN ? AND ?
           AND c.estado IN ('pendiente', 'confirmado')
         ORDER BY c.fecha_hora`,
        [startDateTime, endDateTime]
    );
}

module.exports = {
    createAppointment,
    deleteAppointment,
    getNotificationDetails,
    listAppointmentsInRange,
    listDailyAppointments,
    listPatients,
    listProfessionals,
    listSpecialists,
    listUpcomingAppointments,
    moveAppointment,
    updateAppointment,
    updateAppointmentStatus,
};
