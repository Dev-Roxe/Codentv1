document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');

    // Si no existe el formulario, salimos silenciosamente (evita errores al cargar en otras páginas)
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const userData = {
            nombre: form.nombre.value,
            email: form.email.value,
            password: form.password.value,
            rol: 'recepcionista'
        };

        try {
            if (!window.api || !window.api.registerUser) throw new Error('API de registro no disponible');
            await window.api.registerUser(userData);
            alert('Usuario registrado correctamente');
            window.location = 'index.html';
        } catch (err) {
            alert('Error al registrar usuario: ' + (err.message || err));
        }
    });
});
