const sqlite3 = require('sqlite3');
['Codent', 'sonalia'].forEach(d => {
  const p = 'C:/Users/neric/AppData/Roaming/'+d+'/consultorio.db';
  const db = new sqlite3.Database(p);
  db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
    if (err) return;
    const tables = rows.map(r=>r.name);
    console.log(d, "tables:", tables.includes('odontograma') ? 'HAS odontograma' : 'NO odontograma');
    console.log(d, "tables:", tables.includes('periodontograma') ? 'HAS periodontograma' : 'NO periodontograma');
    console.log(d, "tables:", tables.includes('odontograma_dientes_imagenes') ? 'HAS odontograma_dientes_imagenes' : 'NO odontograma_dientes_imagenes');
    
    if (tables.includes('periodontograma')) {
        db.all('SELECT * FROM periodontograma LIMIT 1', (err, rows) => {
            console.log(d, 'periodontograma sample:', rows && rows.length ? Object.keys(rows[0]) : 'empty');
        });
    }
  });
});
