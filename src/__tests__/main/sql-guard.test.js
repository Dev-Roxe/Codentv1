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
        expect(assertSafeSql('db-run', 'UPDATE pacientes SET nombre = ? WHERE id = ?', ['Ana', 1]).sql).toMatch(/^UPDATE/i);
        expect(assertSafeSql('db-run', 'DELETE FROM citas WHERE id = ?', [1]).sql).toMatch(/^DELETE/i);
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
