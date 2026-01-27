// src/renderer/scripts/perfil.js

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Helpers ----------
  const safeParseJSON = (value) => {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  const getInitials = (nombre = '', apellido = '', email = '') => {
    const full = `${nombre} ${apellido}`.trim() || email;
    if (!full) return 'US';

    const parts = full
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    const initials = parts.map((p) => p[0]?.toUpperCase() || '').join('');
    return initials || 'US';
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';

    try {
      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const buildDisplayName = (nombre = '', apellido = '') =>
    [nombre, apellido].filter(Boolean).join(' ').trim();

  const syncSessionFromProfile = (perfil = {}) => {
    let session = {};
    try {
      session = JSON.parse(localStorage.getItem('sesionActual') || '{}') || {};
    } catch (e) {
      session = {};
    }

    session.nombre = perfil.nombre || session.nombre || '';
    session.apellido = perfil.apellido || session.apellido || '';
    session.email = perfil.email || session.email || '';
    session.rol = perfil.rol || session.rol || '';

    const displayName =
      buildDisplayName(session.nombre, session.apellido) ||
      session.nombre ||
      'Usuario';

    try {
      localStorage.setItem('sesionActual', JSON.stringify(session));
      localStorage.setItem('userName', displayName);
    } catch (e) { }

    sesion.nombre = session.nombre;
    sesion.apellido = session.apellido;
    sesion.email = session.email;
    sesion.rol = session.rol;

    window.dispatchEvent(
      new CustomEvent('session-updated', { detail: { session } })
    );
  };

  // ---------- Estado ----------
  const sesion = safeParseJSON(localStorage.getItem('sesionActual')) || {};
  let userId = sesion.id || null;

  console.log('[perfil] Sesión cargada:', sesion);
  console.log('[perfil] userId:', userId);

  const state = {
    userId,
    perfil: null,
    pendingPhotoData: null, // base64 de la foto nueva (dataURL)
  };

  // ---------- Referencias DOM ----------
  const form = document.getElementById('personal-info-form');
  const inputs = form
    ? form.querySelectorAll('input, textarea, select')
    : [];

  const editBtn = document.getElementById('edit-personal-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const actionsBar = document.getElementById('form-actions');
  const updateBtn = document.getElementById('updateBtn');
  const refreshBtn = document.getElementById('refresh-profile-btn');

  const nombreInput = document.getElementById('nombre');
  const apellidoInput = document.getElementById('apellido');
  const emailInput = document.getElementById('email');
  const telefonoInput = document.getElementById('telefono');
  const nacimientoInput = document.getElementById('nacimiento');
  const direccionInput = document.getElementById('direccion');

  const profileNameEl = document.getElementById('profile-name');
  const profileRoleEl = document.getElementById('profile-role');
  const memberSinceEl = document.getElementById('member-since');
  const lastLoginEl = document.getElementById('last-login-text');

  const avatarImg = document.getElementById('profile-avatar');
  const avatarFallback = document.getElementById('profile-avatar-fallback');
  const avatarInitialsEl = document.getElementById('profile-avatar-initials');
  const avatarHeaderImg = document.getElementById('profile-avatar-header');
  const avatarHeaderFallback = document.getElementById('profile-avatar-header-fallback');
  const avatarHeaderInitials = document.getElementById('profile-avatar-header-initials');
  const photoInput = document.getElementById('photoInput');

  // ---------- Funciones UI ----------
  const setFormDisabled = (disabled) => {
    inputs.forEach((el) => {
      el.disabled = disabled;
      if (disabled) {
        el.classList.add('bg-gray-50');
      } else {
        el.classList.remove('bg-gray-50');
      }
    });
  };

  const fillForm = (perfil = {}) => {
    nombreInput && (nombreInput.value = perfil.nombre || '');
    apellidoInput && (apellidoInput.value = perfil.apellido || '');
    emailInput && (emailInput.value = perfil.email || '');
    telefonoInput && (telefonoInput.value = perfil.telefono || '');
    nacimientoInput && (nacimientoInput.value = perfil.nacimiento || '');
    direccionInput && (direccionInput.value = perfil.direccion || '');
  };

  const updateHeader = (perfil = {}) => {
    const nombre = perfil.nombre || sesion.nombre || 'Usuario';
    const apellido = perfil.apellido || '';
    const rol = perfil.rol || sesion.rol || 'Usuario';

    if (profileNameEl) {
      profileNameEl.textContent = `${nombre} ${apellido}`.trim() || 'Usuario';
    }
    if (profileRoleEl) {
      profileRoleEl.textContent = rol;
    }

    if (memberSinceEl) {
      memberSinceEl.textContent = formatDate(perfil.fecha_creacion || perfil.nacimiento);
    }

    // Si algún día guardas "last_login" en DB o localStorage, leremos eso aquí
    if (lastLoginEl) {
      const last = localStorage.getItem('sesionLastLogin');
      lastLoginEl.textContent = last || '—';
    }
  };

  const updateAvatar = (perfil = {}) => {
    const nombre = perfil.nombre || sesion.nombre || '';
    const apellido = perfil.apellido || '';
    const email = perfil.email || '';

    const initials = getInitials(nombre, apellido, email);
    if (avatarInitialsEl) {
      avatarInitialsEl.textContent = initials;
    }
    if (avatarHeaderInitials) {
      avatarHeaderInitials.textContent = initials;
    }

    const foto = perfil.foto_perfil || null;

    if (foto && avatarImg && avatarFallback) {
      avatarImg.src = foto;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
      if (avatarHeaderImg && avatarHeaderFallback) {
        avatarHeaderImg.src = foto;
        avatarHeaderImg.classList.remove('hidden');
        avatarHeaderFallback.classList.add('hidden');
      }
    } else if (avatarImg && avatarFallback) {
      avatarImg.classList.add('hidden');
      avatarFallback.classList.remove('hidden');
      if (avatarHeaderImg && avatarHeaderFallback) {
        avatarHeaderImg.classList.add('hidden');
        avatarHeaderFallback.classList.remove('hidden');
      }
    }
  };

  // ---------- Lógica principal ----------
  const loadProfile = async () => {
    userId = sesion.id || null;
    if (!userId) {
      console.warn('[perfil] No hay sesión activa (sesionActual.id).');
      console.warn('[perfil] sesion:', sesion);
      alert('No hay sesión activa. Por favor inicia sesión nuevamente.');
      return;
    }

    try {
      if (window.logToMain?.log) {
        window.logToMain.log(`[perfil] Cargando perfil para usuario ID ${userId}`);
      }

      let perfil = null;

      if (window.api?.getUserProfile) {
        console.log('[perfil] Llamando a window.api.getUserProfile...');
        perfil = await window.api.getUserProfile({ id: userId });
        console.log('[perfil] Respuesta recibida:', perfil);
        if (!perfil?.success && !perfil?.id) {
          console.error('[perfil] Error: respuesta vacía o error:', perfil);
          alert('No se pudo cargar el perfil. Intenta nuevamente.');
          return;
        }
      } else {
        console.warn('[perfil] window.api.getUserProfile no disponible, usando fallback');
        // Fallback solo con lo que tenemos en localStorage
        perfil = {
          id: userId,
          nombre: sesion.nombre,
          apellido: '',
          email: '',
          telefono: '',
          nacimiento: '',
          direccion: '',
          rol: sesion.rol,
        };
      }

      state.perfil = perfil;
      state.pendingPhotoData = null;

      syncSessionFromProfile(perfil);
      fillForm(perfil);
      updateHeader(perfil);
      updateAvatar(perfil);
      setFormDisabled(true);
      if (actionsBar) actionsBar.classList.add('hidden');
      if (editBtn) editBtn.style.display = 'inline-flex';
    } catch (err) {
      console.error('[perfil] Error cargando perfil:', err);
      alert('No se pudo cargar el perfil. Revisa la consola para más detalles.');
    }
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      state.pendingPhotoData = dataUrl;

      if (avatarImg && avatarFallback) {
        avatarImg.src = dataUrl;
        avatarImg.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!userId) {
      alert('No hay usuario en sesión. Vuelve a iniciar sesión.');
      return;
    }

    if (!window.api?.updateUserProfile) {
      alert('La API de actualización de perfil no está disponible.');
      return;
    }

    const payload = {
      id: userId,
      nombre: nombreInput?.value?.trim() || '',
      apellido: apellidoInput?.value?.trim() || '',
      email: emailInput?.value?.trim() || '',
      telefono: telefonoInput?.value?.trim() || '',
      nacimiento: nacimientoInput?.value || null,
      direccion: direccionInput?.value?.trim() || '',
      foto_perfil: state.pendingPhotoData || state.perfil?.foto_perfil || null,
    };

    try {
      if (updateBtn) {
        updateBtn.disabled = true;
        updateBtn.textContent = 'Guardando...';
      }

      const res = await window.api.updateUserProfile(payload);
      if (window.logToMain?.log) {
        window.logToMain.log('[perfil] updateUserProfile result: ' + JSON.stringify(res));
      }

      alert('Perfil actualizado correctamente');
      await loadProfile();
    } catch (err) {
      console.error('[perfil] Error al actualizar perfil:', err);
      alert('Error al actualizar el perfil: ' + (err.message || err));
    } finally {
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Guardar cambios';
      }
    }
  };

  // ---------- Listeners ----------
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      setFormDisabled(false);
      if (actionsBar) actionsBar.classList.remove('hidden');
      editBtn.style.display = 'none';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      fillForm(state.perfil || {});
      setFormDisabled(true);
      if (actionsBar) actionsBar.classList.add('hidden');
      if (editBtn) editBtn.style.display = 'inline-flex';
      state.pendingPhotoData = null;
      updateAvatar(state.perfil || {});
    });
  }

  if (form) {
    form.addEventListener('submit', handleSave);
  }

  if (photoInput) {
    photoInput.addEventListener('change', handlePhotoChange);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadProfile();
    });
  }

  // ---------- Init ----------
  loadProfile();
});
