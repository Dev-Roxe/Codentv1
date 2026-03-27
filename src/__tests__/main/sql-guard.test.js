const { assertSafeSql, normalizeSql } = require('../../main/sql-guard');

describe('SQL Guard', () => {
    test('normaliza sentencias validas quitando punto y coma final', () => {
        expect(normalizeSql('SELECT * FROM pacientes;   ')).toBe('SELECT * FROM pacientes');
    });

    test('bloquea multiples sentencias o comentarios', () => {
        expect(() => assertSafeSql('db-run', 'DELETE FROM pagos; DROP TABLE pagos', [])).toThrow(/bloqueada|permitida/i);
        expect(() => assertSafeSql('db-get', 'SELECT * FROM pacientes -- comentario', [])).toThrow(/bloqueada/i);
    });

    test('permite lecturas y solo escrituras no protegidas del renderer', () => {
        expect(assertSafeSql('db-get', 'SELECT * FROM pacientes WHERE id = ?', [1]).sql).toMatch(/^SELECT/i);
        expect(assertSafeSql('db-run', 'UPDATE report_cache SET valor = ? WHERE id = ?', ['ok', 1]).sql).toMatch(/^UPDATE/i);
        expect(() => assertSafeSql('db-run', 'UPDATE pacientes SET nombre = ? WHERE id = ?', ['Ana', 1])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'DELETE FROM citas WHERE id = ?', [1])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE especialistas SET activo = ? WHERE id = ?', [0, 3])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO tratamientos (paciente_id, procedimiento) VALUES (?, ?)', [4, 'Diagnostico'])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE tratamientos_catalogo SET nombre = ? WHERE id = ?', ['Limpieza', 2])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO medicamentos \(nombre\) VALUES \(\?\)', ['Ibuprofeno'])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'DELETE FROM miscelanea WHERE id = ?', [9])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE antecedentes_clinicos SET observaciones = ? WHERE paciente_id = ?', ['ok', 4])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO padecimientos_default \(nombre\) VALUES \(\?\)', ['Bruxismo'])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'DELETE FROM radiografias_paciente WHERE id = ? AND paciente_id = ?', [3, 4])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE periodontograma SET datos = ? WHERE paciente_id = ?', ['{}', 4])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT OR REPLACE INTO admin_config \(clave, valor\) VALUES \(\?, \?\)', ['foo', 'bar'])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO cajas (usuario_id, saldo_inicial) VALUES (?, ?)', [3, 100])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE movimientos_caja SET concepto = ? WHERE id = ?', ['ajuste', 9])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO auditoria_financiera (accion, entidad) VALUES (?, ?)', ['foo', 'bar'])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE planes_tratamiento SET estado = ? WHERE id = ?', ['pendiente', 2])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'DELETE FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?', [7])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO pagos (plan_tratamiento_id, monto) VALUES (?, ?)', [4, 150])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'DELETE FROM facturas_simuladas WHERE plan_tratamiento_id = ?', [4])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE crm_templates SET nombre = ? WHERE id = ?', ['Promo Abril', 6])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO crm_campaigns (nombre, tipo) VALUES (?, ?)', ['Campana abril', 'email'])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'DELETE FROM crm_recordatorios WHERE paciente_id = ?', [4])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'INSERT INTO crm_encuestas (titulo, link, destinatarios) VALUES (?, ?, ?)', ['Encuesta NPS', 'https://encuesta.test', 15])).toThrow(/IPC tipado/i);
        expect(() => assertSafeSql('db-run', 'UPDATE crm_encuestas_plantillas SET activo = 0 WHERE id = ?', [3])).toThrow(/IPC tipado/i);
    });

    test('bloquea escrituras directas sobre tablas de autenticacion', () => {
        expect(() => assertSafeSql('db-run', 'INSERT INTO usuarios (nombre) VALUES (?)', ['Ana'])).toThrow(/auth|autenticacion/i);
        expect(() => assertSafeSql('db-run', 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [1])).toThrow(/auth|autenticacion/i);
    });

    test('permite mantenimiento acotado de periodontograma', () => {
        expect(assertSafeSql('db-all', 'PRAGMA table_info(periodontograma)', []).sql).toBe('PRAGMA table_info(periodontograma)');
        expect(assertSafeSql('db-run', 'CREATE TABLE IF NOT EXISTS periodontograma(id INTEGER PRIMARY KEY)', []).sql).toMatch(/^CREATE TABLE/i);
        expect(assertSafeSql('db-run', 'ALTER TABLE periodontograma ADD COLUMN dientes_imagenes TEXT', []).sql).toMatch(/^ALTER TABLE/i);
    });

    test('permite mantenimiento acotado de radiografias_paciente', () => {
        expect(assertSafeSql('db-all', 'PRAGMA table_info(radiografias_paciente)', []).sql).toBe('PRAGMA table_info(radiografias_paciente)');
        expect(assertSafeSql('db-run', 'CREATE TABLE IF NOT EXISTS radiografias_paciente(id INTEGER PRIMARY KEY)', []).sql).toMatch(/^CREATE TABLE/i);
        expect(assertSafeSql('db-run', 'ALTER TABLE radiografias_paciente ADD COLUMN imagen_data TEXT', []).sql).toMatch(/^ALTER TABLE/i);
    });

    test('rechaza parametros no serializables', () => {
        expect(() => assertSafeSql('db-run', 'UPDATE pacientes SET nombre = ?', [{ foo: 'bar' }])).toThrow(/parametro/i);
    });
});
