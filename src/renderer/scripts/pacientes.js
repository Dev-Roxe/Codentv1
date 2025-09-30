let db;
try {
    db = require('../../db/database');
} catch (e) {
    db = window.api && window.api.db;
}

function cargarPacientes() {
    const tabla = document.getElementById('tablaPacientes');
    if (!tabla) return; // evita errores si la página no tiene la tabla
    tabla.innerHTML = '';

    if (!db || !db.all) return console.error('DB no disponible');

    db.all("SELECT * FROM pacientes", [], (err, rows) => {
        if (err) return console.error(err);
        rows.forEach(p => {
            const fila = `<tr>
                                <td>${p.id}</td>
                                <td>${p.nombre}</td>
                                <td>${p.apellido}</td>
                                <td>${p.telefono || ''}</td>
                                <td>${p.email || ''}</td>
                        </tr>`;
            tabla.innerHTML += fila;
        });
    });
}

document.addEventListener('DOMContentLoaded', cargarPacientes);
