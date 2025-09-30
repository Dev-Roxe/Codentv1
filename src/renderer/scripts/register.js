document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');

    // Si no existe el formulario, salimos silenciosamente (evita errores al cargar en otras páginas)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userData = {
                nombre: form.nombre && form.nombre.value ? form.nombre.value : '',
                email: form.email && form.email.value ? form.email.value : '',
                password: form.password && form.password.value ? form.password.value : '',
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
        return;
    }

    // Si no hay un <form> (como en tu `register.html`), usamos los inputs y el botón por su id
    const fullname = document.getElementById('fullname');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const registerBtn = document.getElementById('registerBtn');

    if (!registerBtn) return; // nada que hacer

    registerBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const userData = {
            nombre: fullname ? fullname.value : '',
            email: email ? email.value : '',
            password: password ? password.value : '',
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
