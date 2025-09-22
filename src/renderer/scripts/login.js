const db = require('../../db/database');
const bcrypt = require('bcrypt');

const form = document.getElementById('loginForm');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.email.value;
    const password = form.password.value;

    db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, row) => {
        if (err) return alert('Error en la base de datos');
        if (!row) return alert('Usuario no encontrado');

        if (bcrypt.compareSync(password, row.password)) {
            alert('Login exitoso');
            window.location = 'dashboard.html';
        } else {
            alert('Contraseña incorrecta');
        }
    });
});
