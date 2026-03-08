const fs = require('fs');
const path = require('path');
const db = require('./database');

const sqlPath = path.join(__dirname, 'insert_default_templates.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Simple split by semicolon might fail if strings contain semicolons, but for this specific file it should be fine.
// The file seems to use semicolons at end of statements.
const statements = sql.split(';').filter(s => s.trim() !== '');

db.serialize(() => {
    statements.forEach(stmt => {
        if (stmt.trim()) {
            db.run(stmt, (err) => {
                if (err) {
                    console.error('Error executing statement:', err);
                } else {
                    console.log('Executed statement successfully');
                }
            });
        }
    });
});
