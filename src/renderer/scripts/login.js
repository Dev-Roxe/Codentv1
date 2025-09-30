document.addEventListener('DOMContentLoaded', () => {
    // Intentamos obtener los módulos; en caso de no estar disponibles en el renderer moderno, avisamos
    let db;
    let bcrypt;
    try {
        db = require('../../db/database');
        bcrypt = require('bcrypt');
    } catch (e) {
        // Si no se puede require desde el renderer (contextIsolation o preload), asumimos que se provee vía API
        db = window.api && window.api.db;
        bcrypt = window.api && window.api.bcrypt;
    }

    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = form.email.value;
        const password = form.password.value;

        if (!db || !db.get) return alert('Base de datos no disponible');

        db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, row) => {
            if (err) return alert('Error en la base de datos');
            if (!row) return alert('Usuario no encontrado');

            try {
                const match = bcrypt && bcrypt.compareSync ? bcrypt.compareSync(password, row.password) : window.api.comparePassword(password, row.password);
                if (match) {
                    alert('Login exitoso');
                    window.location = 'dashboard.html';
                } else {
                    alert('Contraseña incorrecta');
                }
            } catch (err) {
                alert('Error verificando contraseña');
            }
        });
    });
});
