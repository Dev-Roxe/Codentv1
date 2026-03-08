const db = require('./database');

db.get('SELECT count(*) as count FROM crm_templates', (err, row) => {
    if (err) {
        console.error('Error counting templates:', err);
    } else {
        console.log('Templates count:', row.count);
    }
    // Close DB connection properly if possible, but for this script process exit is enough
});
