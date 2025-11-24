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

  // ---------- Estado ----------
  const sesion = safeParseJSON(localStorage.getItem('sesionActual')) || {};
  const userId = sesion.id || null;

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
  const photoInput = document.getElementById('photoInput');

  const prefEmail = document.getElementById('pref-email-notifications');
  const prefCompact = document.getElementById('pref-compact-mode');

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

    const foto = perfil.foto_perfil || null;

    if (foto && avatarImg && avatarFallback) {
      avatarImg.src = foto;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
    } else if (avatarImg && avatarFallback) {
      avatarImg.classList.add('hidden');
      avatarFallback.classList.remove('hidden');
    }
  };

  const loadPreferences = () => {
    if (prefEmail) {
      prefEmail.checked = localStorage.getItem('perfil_pref_email_notif') === '1';
    }
    if (prefCompact) {
      prefCompact.checked = localStorage.getItem('perfil_pref_compact_mode') === '1';
    }
  };

  const savePreferences = () => {
    if (prefEmail) {
      localStorage.setItem('perfil_pref_email_notif', prefEmail.checked ? '1' : '0');
    }
    if (prefCompact) {
      localStorage.setItem('perfil_pref_compact_mode', prefCompact.checked ? '1' : '0');
    }
  };

  // ---------- Lógica principal ----------
  const loadProfile = async () => {
    if (!userId) {
      console.warn('[perfil] No hay sesión activa (sesionActual.id).');
      return;
    }

    try {
      if (window.logToMain?.log) {
        window.logToMain.log(`[perfil] Cargando perfil para usuario ID ${userId}`);
      }

      let perfil = null;

      if (window.api?.getUserProfile) {
        perfil = await window.api.getUserProfile({ id: userId });
      } else {
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

      fillForm(perfil);
      updateHeader(perfil);
      updateAvatar(perfil);
      loadPreferences();
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

  if (prefEmail) {
    prefEmail.addEventListener('change', savePreferences);
  }
  if (prefCompact) {
    prefCompact.addEventListener('change', savePreferences);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadProfile();
    });
  }

  // ---------- Init ----------
  loadProfile();
});
