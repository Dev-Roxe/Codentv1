document.addEventListener('DOMContentLoaded', () => {
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const msg = document.getElementById('msg');

    if (!loginBtn) return; // nothing to do

    const setMsg = (text, isError = true) => {
        if (msg) {
            msg.innerText = text;
            msg.style.color = isError ? 'red' : 'green';
        } else {
            alert(text);
        }
    };

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!window.api || !window.api.loginUser) return setMsg('Función de login no disponible');

        const email = username ? username.value.trim() : '';
        const pwd = password ? password.value : '';

        if (!email || !pwd) return setMsg('Por favor completa los campos');

        loginBtn.disabled = true;
        setMsg('Iniciando sesión...', false);

        // Log para debugging
        if (window.logToMain && window.logToMain.log) window.logToMain.log(`Intentando login para ${email}`);

        try {
            const res = await window.api.loginUser({ email, password: pwd });
                if (window.logToMain && window.logToMain.log) window.logToMain.log('loginUser resolved: ' + JSON.stringify(res));
            // Exitoso: res debería contener id, nombre, rol según main.js
            setMsg('Login exitoso', false);
            // Redirigir a la vista de pacientes usando la API segura del preload
            if (window.api && window.api.openView) {
                try {
                    await window.api.openView('pacientes');
                } catch (navErr) {
                    // Si falla, mostrar mensaje y escribir log
                    if (window.logToMain && window.logToMain.log) window.logToMain.log('openView error: ' + String(navErr));
                    setMsg('No se pudo abrir la vista de pacientes.');
                }
            } else {
                // Fallback: intentar navegación relativa (puede fallar en Electron por seguridad)
                window.location = '../pacientes.html';
            }
        } catch (err) {
                if (window.logToMain && window.logToMain.log) window.logToMain.log('loginUser rejected: ' + JSON.stringify(err));
            const message = (err && err.message) ? err.message : String(err);
            setMsg('Error al iniciar sesión: ' + message);
        } finally {
            loginBtn.disabled = false;
        }
    });
});
