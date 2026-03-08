const db = require('./database');
const bcrypt = require('bcryptjs');

const adminName = process.env.INIT_ADMIN_NAME || 'Admin';
const adminEmail = process.env.INIT_ADMIN_EMAIL || 'admin@clinica.com';
const password = process.env.INIT_ADMIN_PASSWORD;

if (!password) {
  throw new Error('Define INIT_ADMIN_PASSWORD antes de ejecutar initAdmin.js');
}

if (password.length < 12) {
  throw new Error('INIT_ADMIN_PASSWORD debe tener al menos 12 caracteres');
}

const salt = bcrypt.genSaltSync(10);
const hashedPassword = bcrypt.hashSync(password, salt);

db.run(
  `INSERT OR IGNORE INTO usuarios (nombre, email, password, rol)
   VALUES (?, ?, ?, ?)`,
  [adminName, adminEmail, hashedPassword, 'admin'],
  function (err) {
    if (err) console.error(err.message);
    else console.log('Usuario admin creado o ya existia.');
    db.close();
  }
);
