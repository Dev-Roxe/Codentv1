const { assertSafeSql, normalizeSql } = require('../../main/sql-guard');

describe('SQL Guard', () => {
    test('normaliza sentencias válidas quitando punto y coma final', () => {
        expect(normalizeSql('SELECT * FROM pacientes;   ')).toBe('SELECT * FROM pacientes');
    });

    test('bloquea múltiples sentencias o comentarios', () => {
        expect(() => assertSafeSql('db-run', 'DELETE FROM pagos; DROP TABLE pagos', [])).toThrow(/bloqueada|permitida/i);
        expect(() => assertSafeSql('db-get', 'SELECT * FROM pacientes -- comentario', [])).toThrow(/bloqueada/i);
    });

    test('permite lecturas y escrituras estándar del renderer', () => {
        expect(assertSafeSql('db-get', 'SELECT * FROM pacientes WHERE id = ?', [1]).sql).toMatch(/^SELECT/i);
        expect(assertSafeSql('db-run', 'UPDATE pacientes SET nombre = ? WHERE id = ?', ['Ana', 1]).sql).toMatch(/^UPDATE/i);
    });

    test('permite mantenimiento acotado de periodontograma', () => {
        expect(assertSafeSql('db-all', 'PRAGMA table_info(periodontograma)', []).sql).toBe('PRAGMA table_info(periodontograma)');
        expect(assertSafeSql('db-run', 'CREATE TABLE IF NOT EXISTS periodontograma(id INTEGER PRIMARY KEY)', []).sql).toMatch(/^CREATE TABLE/i);
        expect(assertSafeSql('db-run', 'ALTER TABLE periodontograma ADD COLUMN dientes_imagenes TEXT', []).sql).toMatch(/^ALTER TABLE/i);
    });

    test('rechaza parámetros no serializables', () => {
        expect(() => assertSafeSql('db-run', 'UPDATE pacientes SET nombre = ?', [{ foo: 'bar' }])).toThrow(/parámetro/i);
    });
});
