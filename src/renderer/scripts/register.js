const form = document.getElementById('registerForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userData = {
        nombre: form.nombre.value,
        email: form.email.value,
        password: form.password.value,
        rol: 'recepcionista'
    };

    try {
        await window.api.registerUser(userData);
        alert('Usuario registrado correctamente');
        window.location = 'index.html';
    } catch (err) {
        alert('Error al registrar usuario: ' + err.message);
    }
});
