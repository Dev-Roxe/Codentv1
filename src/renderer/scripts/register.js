import toast from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const googleRegisterBtn = document.getElementById('googleRegisterBtn');
    const msgDiv = document.getElementById('msg');

    const oauthModal = document.getElementById('oauthRegistrationModal');
    const oauthName = document.getElementById('oauthName');
    const oauthSurname = document.getElementById('oauthSurname');
    const oauthEmail = document.getElementById('oauthEmail');
    const oauthRole = document.getElementById('oauthRole');
    const oauthTerms = document.getElementById('oauthTerms');
    const oauthCancelBtn = document.getElementById('oauthCancelBtn');
    const oauthCompleteBtn = document.getElementById('oauthCompleteBtn');

    let pendingOAuthProfile = null;

    const buildDisplayName = (nombre = '', apellido = '') => {
        return [nombre, apellido].filter(Boolean).join(' ').trim() || nombre || 'Usuario';
    };

    const clearInlineMessage = () => {
        if (!msgDiv) return;
        msgDiv.textContent = '';
        msgDiv.className = 'text-center text-sm mt-4 col-span-2 dark:text-gray-300';
    };

    const showInlineMessage = (message, type = 'error') => {
        if (!msgDiv) return;
        const tone = type === 'success' ? 'text-green-600' : 'text-red-500';
        msgDiv.textContent = typeof toast.sanitizeMessage === 'function'
            ? toast.sanitizeMessage(message)
            : message;
        msgDiv.className = `text-center text-sm mt-4 col-span-2 ${tone}`;
    };

    const setButtonBusy = (button, busy, label) => {
        if (!button) return;
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }

        button.disabled = !!busy;
        button.innerHTML = busy ? `<span class="text-sm">${label}</span>` : button.dataset.originalText;
    };

    const persistSession = (user, fallbackEmail = '') => {
        if (!user?.id) return;

        const session = {
            id: user.id,
            nombre: user.nombre || '',
            apellido: user.apellido || '',
            rol: user.rol || '',
            email: user.email || fallbackEmail || '',
        };

        localStorage.setItem('sesionActual', JSON.stringify(session));
        localStorage.setItem('userName', buildDisplayName(session.nombre, session.apellido));
        localStorage.setItem('sesionLastLogin', new Date().toISOString());
    };

    const redirectToLogin = async () => {
        if (window.api?.openView) {
            await window.api.openView('login');
            return;
        }
        window.location = 'login.html';
    };

    const redirectToApp = async () => {
        if (window.api?.openView) {
            await window.api.openView('pacientes');
            return;
        }
        window.location = 'pacientes.html';
    };

    const passwordInput = document.getElementById('password');

    const isPasswordStrong = (pwd) => {
        return pwd.length >= 8 &&
            /[A-Z]/.test(pwd) &&
            /[a-z]/.test(pwd) &&
            /[0-9]/.test(pwd) &&
            /[^A-Za-z0-9]/.test(pwd);
    };

    const injectStrengthUI = (input) => {
        const container = input.parentElement;
        if (!container) return;

        const barWrap = document.createElement('div');
        barWrap.className = 'mt-2 flex gap-1';
        for (let i = 0; i < 4; i += 1) {
            const segment = document.createElement('div');
            segment.className = 'h-1 flex-1 rounded-full bg-gray-200 dark:bg-gray-600 transition-all duration-300';
            segment.dataset.seg = String(i);
            barWrap.appendChild(segment);
        }
        container.appendChild(barWrap);

        const reqList = document.createElement('ul');
        reqList.className = 'mt-2 space-y-0.5';

        const requirements = [
            { key: 'length', label: 'Al menos 8 caracteres', test: (pwd) => pwd.length >= 8 },
            { key: 'upper', label: 'Una letra mayuscula (A-Z)', test: (pwd) => /[A-Z]/.test(pwd) },
            { key: 'lower', label: 'Una letra minuscula (a-z)', test: (pwd) => /[a-z]/.test(pwd) },
            { key: 'digit', label: 'Un numero (0-9)', test: (pwd) => /[0-9]/.test(pwd) },
            { key: 'special', label: 'Un caracter especial (!@#$...)', test: (pwd) => /[^A-Za-z0-9]/.test(pwd) },
        ];

        requirements.forEach(({ key, label }) => {
            const li = document.createElement('li');
            li.dataset.req = key;
            li.className = 'flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200';
            li.innerHTML = `<span class="req-icon">x</span><span>${label}</span>`;
            reqList.appendChild(li);
        });
        container.appendChild(reqList);

        const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

        input.addEventListener('input', () => {
            const pwd = input.value;
            let passed = 0;

            requirements.forEach(({ key, test }) => {
                const ok = test(pwd);
                if (ok) passed += 1;

                const li = reqList.querySelector(`[data-req="${key}"]`);
                const icon = li?.querySelector('.req-icon');
                if (!li || !icon) return;

                if (ok) {
                    li.className = 'flex items-center gap-1.5 text-xs text-green-500 transition-colors duration-200';
                    icon.textContent = 'ok';
                } else {
                    li.className = 'flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200';
                    icon.textContent = 'x';
                }
            });

            const strength = Math.min(4, passed);
            barWrap.querySelectorAll('[data-seg]').forEach((segment, index) => {
                segment.className = `h-1 flex-1 rounded-full transition-all duration-300 ${index < strength ? colors[strength - 1] : 'bg-gray-200 dark:bg-gray-600'}`;
            });
        });
    };

    if (passwordInput) {
        injectStrengthUI(passwordInput);
    }

    const closeOAuthModal = async (clearPending = false) => {
        if (oauthModal) {
            oauthModal.classList.add('hidden');
        }

        if (clearPending && window.api?.clearPendingOAuthRegistration) {
            try {
                await window.api.clearPendingOAuthRegistration();
            } catch (error) {
                console.warn('[register] No se pudo limpiar el OAuth pendiente', error);
            }
        }

        pendingOAuthProfile = null;
    };

    const openOAuthModal = (profile = {}) => {
        pendingOAuthProfile = profile;

        if (oauthName) oauthName.value = profile.nombre || '';
        if (oauthSurname) oauthSurname.value = profile.apellido || '';
        if (oauthEmail) oauthEmail.value = profile.email || '';
        if (oauthRole) oauthRole.value = profile.role || '';
        if (oauthTerms) oauthTerms.checked = !!profile.acceptedTerms;

        oauthModal?.classList.remove('hidden');
    };

    const loadPendingOAuthRegistration = async () => {
        if (!window.api?.getPendingOAuthRegistration) return false;

        const result = await window.api.getPendingOAuthRegistration();
        if (!result?.pending || !result.profile) return false;

        openOAuthModal(result.profile);
        return true;
    };

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearInlineMessage();

            const payload = {
                nombre: document.getElementById('name')?.value.trim() || '',
                apellido: document.getElementById('surnames')?.value.trim() || '',
                email: document.getElementById('email')?.value.trim() || '',
                password: document.getElementById('password')?.value || '',
                telefono: document.getElementById('phone')?.value.trim() || '',
                rol: document.getElementById('rol')?.value || '',
                acceptedTerms: !!document.getElementById('terms')?.checked,
            };

            if (!payload.acceptedTerms) {
                showInlineMessage('Debes aceptar los terminos y condiciones.');
                return;
            }

            if (!isPasswordStrong(payload.password)) {
                showInlineMessage('La contrasena no cumple los requisitos de seguridad.');
                passwordInput?.focus();
                return;
            }

            setButtonBusy(registerBtn, true, 'Creando cuenta...');

            try {
                if (!window.api?.registerUser) {
                    throw new Error('API de registro no disponible');
                }

                await window.api.registerUser(payload);
                toast.show('Cuenta creada correctamente. Ya puedes iniciar sesion.', 'success');
                await redirectToLogin();
            } catch (error) {
                const message = error?.message || String(error);
                showInlineMessage(message);
                toast.show(message, 'error');
            } finally {
                setButtonBusy(registerBtn, false);
            }
        });
    }

    if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            clearInlineMessage();
            setButtonBusy(googleRegisterBtn, true, 'Autenticando...');

            try {
                if (!window.api?.googleOAuthAuthenticate) {
                    throw new Error('Google OAuth no esta disponible');
                }

                const result = await window.api.googleOAuthAuthenticate('register');
                if (!result?.success) {
                    throw new Error(result?.error || 'No se pudo autenticar con Google');
                }

                if (result.needsRegistrationCompletion) {
                    const loaded = await loadPendingOAuthRegistration();
                    if (!loaded) {
                        throw new Error('Google autentico la cuenta, pero no se pudo cargar el registro pendiente');
                    }
                    return;
                }

                if (result.user?.id) {
                    persistSession(result.user, result.user.email || '');
                    toast.show('Autenticacion con Google completada.', 'success');
                    await redirectToApp();
                    return;
                }

                throw new Error('El flujo de Google devolvio una respuesta inesperada');
            } catch (error) {
                const message = error?.message || String(error);
                showInlineMessage(message);
                toast.show(message, 'error');
            } finally {
                setButtonBusy(googleRegisterBtn, false);
            }
        });
    }

    if (oauthCompleteBtn) {
        oauthCompleteBtn.addEventListener('click', async () => {
            setButtonBusy(oauthCompleteBtn, true, 'Completando...');

            try {
                if (!pendingOAuthProfile) {
                    const loaded = await loadPendingOAuthRegistration();
                    if (!loaded) {
                        throw new Error('No hay un registro de Google pendiente');
                    }
                }

                const payload = {
                    nombre: oauthName?.value.trim() || '',
                    apellido: oauthSurname?.value.trim() || '',
                    role: oauthRole?.value || '',
                    acceptedTerms: !!oauthTerms?.checked,
                };

                const result = await window.api.completeOAuthRegistration(payload);
                if (!result?.success) {
                    throw new Error(result?.error || 'No se pudo completar el registro con Google');
                }

                persistSession(result.user, oauthEmail?.value.trim() || '');
                await closeOAuthModal(false);
                toast.show('Registro con Google completado.', 'success');
                await redirectToApp();
            } catch (error) {
                const message = error?.message || String(error);
                toast.show(message, 'error');
            } finally {
                setButtonBusy(oauthCompleteBtn, false);
            }
        });
    }

    if (oauthCancelBtn) {
        oauthCancelBtn.addEventListener('click', async () => {
            await closeOAuthModal(true);
        });
    }

    if (oauthModal) {
        oauthModal.addEventListener('click', async (event) => {
            if (event.target === oauthModal) {
                await closeOAuthModal(true);
            }
        });
    }

    try {
        await loadPendingOAuthRegistration();
    } catch (error) {
        console.warn('[register] No se pudo hidratar el OAuth pendiente', error);
    }
});
