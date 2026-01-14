import toast from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const msg = document.getElementById('msg');

    // Clear legacy message element if it exists
    if (msg) msg.innerHTML = '';

    if (!loginBtn) return;

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!window.api || !window.api.loginUser) {
            toast.show('Función de login no disponible', 'error');
            return;
        }

        const email = username ? username.value.trim() : '';
        const pwd = password ? password.value : '';

        if (!email || !pwd) {
            toast.show('Por favor completa todos los campos', 'warning');
            return;
        }

        loginBtn.disabled = true;
        // Optional: show loading toast or just rely on button state
        // toast.show('Iniciando sesión...', 'info'); 

        // Log para debugging
        if (window.logToMain && window.logToMain.log) window.logToMain.log(`Intentando login para ${email}`);

        try {
            const res = await window.api.loginUser({ email, password: pwd });
            if (window.logToMain && window.logToMain.log) window.logToMain.log('loginUser resolved: ' + JSON.stringify(res));

            toast.show('¡Bienvenido de nuevo!', 'success');

            // Guardar datos de sesión en localStorage
            try {
                localStorage.setItem('sesionActual', JSON.stringify({
                    id: res.id,
                    nombre: res.nombre,
                    rol: res.rol
                }));
                if (window.logToMain && window.logToMain.log) window.logToMain.log('Sesión guardada en localStorage');
            } catch (storageErr) {
                if (window.logToMain && window.logToMain.log) window.logToMain.log('Error guardando sesión: ' + storageErr.message);
            }

            // Redirigir a la vista de pacientes
            if (window.api && window.api.openView) {
                try {
                    await window.api.openView('pacientes');
                } catch (navErr) {
                    if (window.logToMain && window.logToMain.log) window.logToMain.log('openView error: ' + String(navErr));
                    toast.show('No se pudo redirigir a la vista de pacientes', 'error');
                }
            } else {
                window.location = '../pacientes.html';
            }
        } catch (err) {
            if (window.logToMain && window.logToMain.log) window.logToMain.log('loginUser rejected: ' + JSON.stringify(err));

            let message = (err && err.message) ? err.message : String(err);

            // Clean up error message
            if (message.includes('Contraseña incorrecta') || message.includes('Incorrect password')) {
                message = 'Contraseña incorrecta. Verifícala e inténtalo de nuevo.';
            } else if (message.includes('User not found') || message.includes('Usuario no encontrado')) {
                message = 'Usuario no encontrado. Verifica tu correo.';
            } else {
                // Remove generic Electron error prefix
                message = message.replace(/Error invoking remote method '[^']+': Error: /, '');
            }

            toast.show(message, 'error');
        } finally {
            loginBtn.disabled = false;
        }
    });
});
