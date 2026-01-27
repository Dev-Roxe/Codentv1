import toast from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    const buildDisplayName = (nombre = '', apellido = '') => {
        return [nombre, apellido].filter(Boolean).join(' ').trim() || nombre || 'Usuario';
    };
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const msg = document.getElementById('msg');

    // Clear legacy message element if it exists
    if (msg) msg.innerHTML = '';

    const clearSessionData = () => {
        try {
            localStorage.removeItem('sesionActual');
            localStorage.removeItem('userName');
            localStorage.removeItem('userToken');
            localStorage.removeItem('sesionLastLogin');
        } catch (e) { }

        try {
            sessionStorage.removeItem('notified_appointments');
            sessionStorage.removeItem('notifiedAppointments');
            sessionStorage.removeItem('openAdminMenu');
        } catch (e) { }
    };

    // Si llegamos al login, forzamos estado sin sesión
    clearSessionData();

    // ============================================================
    // REGULAR LOGIN
    // ============================================================
    if (loginBtn) {
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

            if (window.logToMain && window.logToMain.log) window.logToMain.log(`Intentando login para ${email}`);

            try {
                // Evitar que sobreviva una sesiÃ³n previa
                clearSessionData();
                const res = await window.api.loginUser({ email, password: pwd });
                if (window.logToMain && window.logToMain.log) window.logToMain.log('loginUser resolved: ' + JSON.stringify(res));

                toast.show('¡Bienvenido de nuevo!', 'success');

                // Clear any cached user data
                if (window.cachedUserEmail !== undefined) window.cachedUserEmail = null;
                if (window.cachedUserName !== undefined) window.cachedUserName = null;

                // Guardar datos de sesión en localStorage
                try {
                    const displayName = buildDisplayName(res.nombre, res.apellido);
                    localStorage.setItem('sesionActual', JSON.stringify({
                        id: res.id,
                        nombre: res.nombre,
                        apellido: res.apellido || '',
                        rol: res.rol,
                        email: res.email || email
                    }));
                    localStorage.setItem('userName', displayName);
                    localStorage.setItem('sesionLastLogin', new Date().toISOString());
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
    }

    // ============================================================
    // GOOGLE OAUTH WITH ROLE SELECTION
    // ============================================================
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const roleSelectionModal = document.getElementById('roleSelectionModal');
    let pendingUserInfo = null;

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            googleSignInBtn.disabled = true;
            const originalText = googleSignInBtn.innerHTML;
            googleSignInBtn.innerHTML = '<span class="text-sm">Autenticando...</span>';

            try {
                // Evitar que sobreviva una sesiÃ³n previa
                clearSessionData();
                const result = await window.api.googleOAuthAuthenticate();

                if (!result.success) {
                    toast.show('Error: ' + result.error, 'error');
                    return;
                }

                // Check if user needs to select role
                if (result.needsRole) {
                    // Store user info and show role selection modal
                    pendingUserInfo = result.userInfo;
                    roleSelectionModal.classList.remove('hidden');
                    return;
                }

                // Existing user or registration complete
                if (result.isNewUser) {
                    toast.show('¡Registro exitoso! Bienvenido', 'success');
                } else {
                    toast.show('¡Autenticación exitosa!', 'success');
                }

                // Clear any cached user data
                if (window.cachedUserEmail !== undefined) window.cachedUserEmail = null;
                if (window.cachedUserName !== undefined) window.cachedUserName = null;

                // Save session with complete user data
                const displayName = buildDisplayName(result.user.nombre, result.user.apellido);
                localStorage.setItem('sesionActual', JSON.stringify({
                    id: result.user.id,
                    nombre: result.user.nombre,
                    apellido: result.user.apellido || '',
                    rol: result.user.rol,
                    email: result.user.email || result.userInfo?.email
                }));
                localStorage.setItem('userName', displayName);
                localStorage.setItem('sesionLastLogin', new Date().toISOString());

                // Redirect
                await window.api.openView('pacientes');
            } catch (err) {
                toast.show('Error al autenticar con Google', 'error');
                console.error(err);
            } finally {
                googleSignInBtn.disabled = false;
                googleSignInBtn.innerHTML = originalText;
            }
        });
    }

    // Handle role selection
    if (roleSelectionModal) {
        const roleOptions = roleSelectionModal.querySelectorAll('.role-option');

        roleOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const selectedRole = option.getAttribute('data-role');

                if (!pendingUserInfo) {
                    toast.show('Error: No hay información de usuario pendiente', 'error');
                    return;
                }

                // Disable all buttons
                roleOptions.forEach(btn => btn.disabled = true);

                try {
                    const result = await window.api.completeOAuthRegistration(pendingUserInfo, selectedRole);

                    if (!result.success) {
                        toast.show('Error al completar registro: ' + result.error, 'error');
                        return;
                    }

                    toast.show('¡Registro completado! Bienvenido', 'success');

                    // Clear any cached user data
                    if (window.cachedUserEmail !== undefined) window.cachedUserEmail = null;
                    if (window.cachedUserName !== undefined) window.cachedUserName = null;

                    // Save session with complete user data
                    const displayName = buildDisplayName(result.user.nombre, result.user.apellido);
                    localStorage.setItem('sesionActual', JSON.stringify({
                        id: result.user.id,
                        nombre: result.user.nombre,
                        apellido: result.user.apellido || '',
                        rol: result.user.rol,
                        email: result.user.email || pendingUserInfo?.email
                    }));
                    localStorage.setItem('userName', displayName);
                    localStorage.setItem('sesionLastLogin', new Date().toISOString());

                    // Hide modal
                    roleSelectionModal.classList.add('hidden');
                    pendingUserInfo = null;

                    // Redirect
                    await window.api.openView('pacientes');
                } catch (err) {
                    toast.show('Error al completar registro', 'error');
                    console.error(err);
                } finally {
                    roleOptions.forEach(btn => btn.disabled = false);
                }
            });
        });
    }

    // ============================================================
    // FORGOT PASSWORD
    // ============================================================
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const resetEmail = document.getElementById('resetEmail');
    const sendResetBtn = document.getElementById('sendResetBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordModal.classList.remove('hidden');
            resetEmail.focus();
        });
    }

    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', async () => {
            const email = resetEmail.value.trim();
            if (!email) {
                toast.show('Por favor ingresa tu correo electrónico', 'warning');
                return;
            }

            sendResetBtn.disabled = true;
            sendResetBtn.textContent = 'Enviando...';

            try {
                const result = await window.api.requestPasswordReset(email);
                if (result.success) {
                    toast.show(result.message, 'success');
                    forgotPasswordModal.classList.add('hidden');
                    resetEmail.value = '';

                    // Show reset password modal
                    document.getElementById('resetPasswordModal').classList.remove('hidden');
                    document.getElementById('resetToken').focus();
                } else {
                    toast.show(result.error || 'Error al enviar correo', 'error');
                }
            } catch (err) {
                toast.show('Error al procesar solicitud', 'error');
                console.error(err);
            } finally {
                sendResetBtn.disabled = false;
                sendResetBtn.textContent = 'Enviar Código';
            }
        });
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', () => {
            forgotPasswordModal.classList.add('hidden');
            resetEmail.value = '';
        });
    }

    // ============================================================
    // RESET PASSWORD
    // ============================================================
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const resetToken = document.getElementById('resetToken');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const confirmResetBtn = document.getElementById('confirmResetBtn');
    const cancelNewPasswordBtn = document.getElementById('cancelNewPasswordBtn');

    if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', async () => {
            const token = resetToken.value.trim();
            const newPwd = newPassword.value;
            const confirmPwd = confirmPassword.value;

            if (!token) {
                toast.show('Por favor ingresa el código de recuperación', 'warning');
                return;
            }

            if (!newPwd || newPwd.length < 8) {
                toast.show('La contraseña debe tener al menos 8 caracteres', 'warning');
                return;
            }

            if (newPwd !== confirmPwd) {
                toast.show('Las contraseñas no coinciden', 'warning');
                return;
            }

            confirmResetBtn.disabled = true;
            confirmResetBtn.textContent = 'Restableciendo...';

            try {
                const result = await window.api.resetPassword(token, newPwd);
                if (result.success) {
                    toast.show('¡Contraseña restablecida exitosamente!', 'success');
                    resetPasswordModal.classList.add('hidden');
                    resetToken.value = '';
                    newPassword.value = '';
                    confirmPassword.value = '';
                } else {
                    toast.show(result.error || 'Error al restablecer contraseña', 'error');
                }
            } catch (err) {
                toast.show('Error al procesar solicitud', 'error');
                console.error(err);
            } finally {
                confirmResetBtn.disabled = false;
                confirmResetBtn.textContent = 'Restablecer';
            }
        });
    }

    if (cancelNewPasswordBtn) {
        cancelNewPasswordBtn.addEventListener('click', () => {
            resetPasswordModal.classList.add('hidden');
            resetToken.value = '';
            newPassword.value = '';
            confirmPassword.value = '';
        });
    }
});
