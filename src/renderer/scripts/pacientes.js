const db = require('../../db/database');

function cargarPacientes() {
    const tabla = document.getElementById('tablaPacientes');
    tabla.innerHTML = '';

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
