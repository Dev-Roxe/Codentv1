document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');

    // ── Password strength checker ────────────────────────────────────────────
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        injectStrengthUI(passwordInput);
    }

    function injectStrengthUI(input) {
        const container = input.parentElement;

        // Strength bar
        const barWrap = document.createElement('div');
        barWrap.className = 'mt-2 flex gap-1';
        for (let i = 0; i < 4; i++) {
            const seg = document.createElement('div');
            seg.className = 'h-1 flex-1 rounded-full bg-gray-200 dark:bg-gray-600 transition-all duration-300';
            seg.dataset.seg = i;
            barWrap.appendChild(seg);
        }
        container.appendChild(barWrap);

        // Requirements list
        const reqList = document.createElement('ul');
        reqList.className = 'mt-2 space-y-0.5';
        const requirements = [
            { key: 'length', label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
            { key: 'upper', label: 'Una letra mayúscula (A-Z)', test: (p) => /[A-Z]/.test(p) },
            { key: 'lower', label: 'Una letra minúscula (a-z)', test: (p) => /[a-z]/.test(p) },
            { key: 'digit', label: 'Un número (0-9)', test: (p) => /[0-9]/.test(p) },
            { key: 'special', label: 'Un carácter especial (!@#$%…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
        ];
        requirements.forEach(({ key, label }) => {
            const li = document.createElement('li');
            li.dataset.req = key;
            li.className = 'flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200';
            li.innerHTML = `<span class="req-icon">✗</span><span>${label}</span>`;
            reqList.appendChild(li);
        });
        container.appendChild(reqList);

        const COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

        input.addEventListener('input', () => {
            const pwd = input.value;
            let passed = 0;
            requirements.forEach(({ key, test }) => {
                const ok = test(pwd);
                if (ok) passed++;
                const li = reqList.querySelector(`[data-req="${key}"]`);
                const icon = li.querySelector('.req-icon');
                if (ok) {
                    li.className = 'flex items-center gap-1.5 text-xs text-green-500 transition-colors duration-200';
                    icon.textContent = '✓';
                } else {
                    li.className = 'flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200';
                    icon.textContent = '✗';
                }
            });

            // Strength = 0-4 segments lit
            const strength = Math.min(4, passed);
            barWrap.querySelectorAll('[data-seg]').forEach((seg, i) => {
                seg.className = `h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? COLORS[strength - 1] : 'bg-gray-200 dark:bg-gray-600'}`;
            });
        });
    }

    function isPasswordStrong(pwd) {
        return pwd.length >= 8 &&
            /[A-Z]/.test(pwd) &&
            /[a-z]/.test(pwd) &&
            /[0-9]/.test(pwd) &&
            /[^A-Za-z0-9]/.test(pwd);
    }

    const redirectToLogin = async () => {
        if (window.api && typeof window.api.openView === 'function') {
            await window.api.openView('login');
            return;
        }
        window.location = 'login.html';
    };

    const registerUser = async (userData) => {
        if (!window.api || !window.api.registerUser) {
            throw new Error('API de registro no disponible');
        }
        await window.api.registerUser(userData);
        alert('¡Usuario registrado correctamente! Ya puedes iniciar sesión.');
        await redirectToLogin();
    };

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const pwInput = document.getElementById('password');
            const roleInput = document.getElementById('rol');
            const msgDiv = document.getElementById('msg');

            const password = pwInput ? pwInput.value : '';

            // ⚠️ S11 Frontend validation — mirrors server-side check
            if (!isPasswordStrong(password)) {
                if (msgDiv) {
                    msgDiv.textContent = 'La contraseña no cumple los requisitos de seguridad.';
                    msgDiv.className = 'text-center text-sm mt-4 col-span-2 text-red-500';
                }
                pwInput && pwInput.focus();
                return;
            }

            const userData = {
                nombre: nameInput && nameInput.value ? nameInput.value.trim() : '',
                email: emailInput && emailInput.value ? emailInput.value.trim() : '',
                password: password,
                rol: roleInput && roleInput.value ? roleInput.value.trim().toLowerCase() : 'recepcionista',
            };

            if (msgDiv) { msgDiv.textContent = ''; }

            try {
                await registerUser(userData);
            } catch (err) {
                const msg = err.message || String(err);
                if (msgDiv) {
                    msgDiv.textContent = msg;
                    msgDiv.className = 'text-center text-sm mt-4 col-span-2 text-red-500';
                } else {
                    alert('Error al registrar usuario: ' + msg);
                }
            }
        });
    }
});

