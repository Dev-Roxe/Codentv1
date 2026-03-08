const g = require('../src/main/sql-guard');
const tests = [
    ['db-all', 'SELECT * FROM pacientes WHERE id = ?', [1], false, 'SELECT allowed'],
    ['db-all', 'SELECT * FROM t UNION SELECT * FROM passwords', [], true, 'UNION blocked'],
    ['db-all', 'SELECT * FROM t -- comment', [], true, 'comment blocked'],
    ['db-run', 'DROP TABLE usuarios', [], true, 'DROP blocked'],
    ['db-run', 'INSERT INTO t (a) VALUES (?)', ['x'], false, 'INSERT allowed'],
    ['db-run', 'ATTACH DATABASE "evil.db" AS evil', [], true, 'ATTACH blocked'],
    ['db-all', 'SELECT CHAR(65)', [], true, 'CHAR() blocked'],
];
let pass = 0, fail = 0;
tests.forEach(([ch, sql, p, shouldFail, label]) => {
    try {
        g.assertSafeSql(ch, sql, p);
        if (shouldFail) { console.log('FAIL (should have blocked):', label); fail++; }
        else { console.log('PASS:', label); pass++; }
    } catch (e) {
        if (shouldFail) { console.log('PASS (blocked correctly):', label); pass++; }
        else { console.log('FAIL (unexpectedly blocked):', label, '-', e.message); fail++; }
    }
});
console.log('\nResults: ' + pass + ' passed, ' + fail + ' failed');
const bs = require('./src/main/backup-service');
console.log('backup-service OK, exports:', Object.keys(bs).join(', '));
