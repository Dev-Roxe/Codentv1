const db = require('./database');
const bcrypt = require('bcrypt');

const password = 'admin123'; // Contraseña inicial
const salt = bcrypt.genSaltSync(10);
const hashedPassword = bcrypt.hashSync(password, salt);

db.run(
    `INSERT OR IGNORE INTO usuarios (nombre, email, password, rol)
     VALUES (?, ?, ?, ?)`,
    ['Admin', 'admin@clinica.com', hashedPassword, 'admin'],
    function(err) {
        if (err) console.error(err.message);
        else console.log('Usuario admin creado o ya existía.');
        db.close();
    }
);
