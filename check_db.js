const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(require('os').homedir() + '/AppData/Roaming/sonalia/consultorio.db');
db.get('SELECT dientes_imagenes, datos FROM periodontograma WHERE dientes_imagenes IS NOT NULL LIMIT 1', (err, row) => {
    if (err) console.error(err);
    else if (row && row.dientes_imagenes) {
        try {
            const data = JSON.parse(row.dientes_imagenes);
            console.log("Teeth keys with images:", Object.keys(data).filter(k => {
                const entry = data[k];
                return (entry.imagen_v && entry.imagen_v.length > 50) || 
                       (entry.imagen_p && entry.imagen_p.length > 50) || 
                       (entry.imagen_url && entry.imagen_url.length > 50);
            }));
            const examples = Object.keys(data).slice(0, 3).map(k => {
                const entry = data[k];
                return `${k}: v=${entry.imagen_v ? entry.imagen_v.substring(0,25) : 'none'}..., p=${entry.imagen_p ? entry.imagen_p.substring(0,25) : 'none'}..., url=${entry.imagen_url ? entry.imagen_url.substring(0,25) : 'none'}...`;
            });
            console.log(examples);
        } catch(e) { console.log("JSON Parse error", e); }
    } else console.log("NO DATA in dientes_imagenes");
});
