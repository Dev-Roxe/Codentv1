/**
 * session-timeout.js
 * SECURITY FIX S4: Session inactivity timeout + lock screen.
 *
 * Usage: include this script in any protected view's HTML.
 * <script src="../scripts/session-timeout.js"></script>
 *
 * When the user is inactive for SESSION_TIMEOUT_MS, a lock overlay appears.
 * They must re-enter their password to continue.
 * The session user is read from sessionStorage key 'currentUser'.
 */

(function () {
    const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    const WARNING_BEFORE_MS = 60 * 1000;       // warn 1 min before lock

    let timeoutId = null;
    let warningId = null;
    let lockOverlay = null;
    let isLocked = false;

    // ── Build lock overlay ────────────────────────────────────────────────────
    function buildOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'session-lock-overlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(0,0,0,0.85)', 'backdrop-filter:blur(6px)',
        ].join(';');

        overlay.innerHTML = `
      <div style="background:#1e293b;border-radius:16px;padding:40px;max-width:360px;width:90%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5);">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <h2 style="color:#f1f5f9;font-size:20px;font-weight:600;margin-bottom:8px;">Sesión bloqueada</h2>
        <p style="color:#94a3b8;font-size:14px;margin-bottom:24px;">Ingresaste tu contraseña para continuar</p>
        <input
          id="session-lock-password"
          type="password"
          placeholder="Contraseña"
          autocomplete="current-password"
          style="width:100%;padding:12px 16px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#f1f5f9;font-size:14px;box-sizing:border-box;margin-bottom:12px;outline:none;"
        />
        <div id="session-lock-error" style="color:#f87171;font-size:12px;min-height:18px;margin-bottom:12px;"></div>
        <button
          id="session-lock-btn"
          style="width:100%;padding:12px;border-radius:8px;background:#4EABBE;color:#fff;font-size:14px;font-weight:600;border:none;cursor:pointer;"
        >Desbloquear</button>
        <button
          id="session-logout-btn"
          style="width:100%;padding:10px;border-radius:8px;background:transparent;color:#94a3b8;font-size:12px;border:none;cursor:pointer;margin-top:8px;"
        >Cerrar sesión</button>
      </div>
    `;
        return overlay;
    }

    // ── Lock screen ───────────────────────────────────────────────────────────
    function lockSession() {
        if (isLocked) return;
        isLocked = true;
        clearTimers();

        lockOverlay = buildOverlay();
        document.body.appendChild(lockOverlay);

        const pwInput = lockOverlay.querySelector('#session-lock-password');
        const unlockBtn = lockOverlay.querySelector('#session-lock-btn');
        const logoutBtn = lockOverlay.querySelector('#session-logout-btn');
        const errDiv = lockOverlay.querySelector('#session-lock-error');

        pwInput.focus();

        async function attemptUnlock() {
            const password = pwInput.value;
            const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            if (!user.email) { doLogout(); return; }

            errDiv.textContent = '';
            unlockBtn.textContent = 'Verificando…';
            unlockBtn.disabled = true;

            try {
                await window.api.loginUser({ email: user.email, password });
                // Success — remove overlay and restart timer
                lockOverlay.remove();
                lockOverlay = null;
                isLocked = false;
                resetTimer();
            } catch (e) {
                errDiv.textContent = 'Contraseña incorrecta. Intenta de nuevo.';
                pwInput.value = '';
                pwInput.focus();
            } finally {
                unlockBtn.textContent = 'Desbloquear';
                unlockBtn.disabled = false;
            }
        }

        unlockBtn.addEventListener('click', attemptUnlock);
        pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
        logoutBtn.addEventListener('click', doLogout);
    }

    function doLogout() {
        sessionStorage.clear();
        if (window.api && window.api.openView) {
            window.api.openView('login').catch(() => { window.location = 'login.html'; });
        } else {
            window.location = 'login.html';
        }
    }

    // ── Timer management ──────────────────────────────────────────────────────
    function clearTimers() {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        if (warningId) { clearTimeout(warningId); warningId = null; }
    }

    function resetTimer() {
        if (isLocked) return;
        clearTimers();
        warningId = setTimeout(showWarning, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);
        timeoutId = setTimeout(lockSession, SESSION_TIMEOUT_MS);
    }

    function showWarning() {
        // Use a non-blocking subtle toast if available, else console
        console.info('[Sonalia] Sesión se bloqueará en 1 minuto por inactividad.');
        // If toast helper exists in the page, use it
        if (typeof window.showToast === 'function') {
            window.showToast('Tu sesión se bloqueará en 1 minuto por inactividad', 'warning');
        }
    }

    // ── Activity listeners ────────────────────────────────────────────────────
    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    ACTIVITY_EVENTS.forEach((evt) => {
        document.addEventListener(evt, () => { if (!isLocked) resetTimer(); }, { passive: true });
    });

    // ── Start ─────────────────────────────────────────────────────────────────
    // Only activate if a user is logged in (has sessionStorage entry)
    if (sessionStorage.getItem('currentUser')) {
        resetTimer();
        console.info('[Sonalia Security] Session timeout activo — inactivity lock en 15 min');
    }
})();
