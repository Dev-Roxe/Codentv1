const GOOGLE_AUTH_MODES = Object.freeze({
  LOGIN: 'login',
  REGISTER: 'register',
});

const ROLE_ALIASES = Object.freeze({
  admin: 'Administrador',
  administrador: 'Administrador',
  especialista: 'Especialista',
  dentista: 'Especialista',
  doctor: 'Especialista',
  doctora: 'Especialista',
  medico: 'Especialista',
  odontologo: 'Especialista',
  odontologa: 'Especialista',
  recepcionista: 'Recepcionista',
});

function toBooleanFlag(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback ? 1 : 0;
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeLookupValue(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeRole(role) {
  const normalized = normalizeLookupValue(role);
  return ROLE_ALIASES[normalized] || '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isProfileComplete(user = {}) {
  return Boolean(String(user.nombre || '').trim() && String(user.apellido || '').trim());
}

function isAuthorizedUser(user = {}) {
  return (
    toBooleanFlag(user.registration_completed, true) === 1 &&
    toBooleanFlag(user.profile_completed, true) === 1 &&
    toBooleanFlag(user.accepted_terms, true) === 1
  );
}

function hasGoogleLinkedAccount(user = {}) {
  if (!user || typeof user !== 'object') return false;
  return Boolean(String(user.google_id || user.googleId || '').trim());
}

function hasLocalPassword(user = {}) {
  if (!user || typeof user !== 'object') return false;

  if (user.has_password !== undefined) {
    return toBooleanFlag(user.has_password, false) === 1;
  }

  if (user.hasPassword !== undefined) {
    return toBooleanFlag(user.hasPassword, false) === 1;
  }

  return Boolean(String(user.password || '').trim());
}

function resolveAccountAuthProvider(user = {}) {
  const hasGoogle = hasGoogleLinkedAccount(user);
  const hasPassword = hasLocalPassword(user);

  if (hasGoogle && hasPassword) return 'hybrid';
  if (hasGoogle) return 'google';
  return 'local';
}

function mapUserRow(row) {
  if (!row) return null;

  const hasPassword = hasLocalPassword(row);

  return {
    id: row.id,
    nombre: row.nombre || '',
    apellido: row.apellido || row.apellidos || '',
    email: normalizeEmail(row.email),
    rol: row.rol || '',
    authProvider: resolveAccountAuthProvider(row),
    hasPassword,
    emailVerified: toBooleanFlag(row.email_verified ?? row.emailVerified, false) === 1,
    registrationCompleted: toBooleanFlag(row.registration_completed ?? row.registrationCompleted, true) === 1,
    profileCompleted: toBooleanFlag(row.profile_completed ?? row.profileCompleted, true) === 1,
    acceptedTerms: toBooleanFlag(row.accepted_terms ?? row.acceptedTerms, true) === 1,
    googleId: row.google_id || row.googleId || null,
    fotoPerfil: row.foto_perfil || row.fotoPerfil || null,
    lastLoginAt: row.last_login_at || row.lastLoginAt || null,
  };
}

function resolveGoogleAuthDecision({ mode, googleProfile, userByGoogleId, userByEmail }) {
  const authMode =
    mode === GOOGLE_AUTH_MODES.REGISTER ? GOOGLE_AUTH_MODES.REGISTER : GOOGLE_AUTH_MODES.LOGIN;

  if (!googleProfile?.email || !googleProfile?.googleId) {
    return {
      kind: 'error',
      code: 'INVALID_GOOGLE_PROFILE',
      message: 'Google no devolvio un perfil de usuario valido.',
    };
  }

  if (!googleProfile.emailVerified) {
    return {
      kind: 'error',
      code: 'GOOGLE_EMAIL_NOT_VERIFIED',
      message: 'Tu cuenta de Google no tiene un correo verificado.',
    };
  }

  if (userByGoogleId && userByEmail && Number(userByGoogleId.id) !== Number(userByEmail.id)) {
    return {
      kind: 'error',
      code: 'GOOGLE_EMAIL_COLLISION',
      message: 'El correo de Google ya esta asociado a otra cuenta local.',
    };
  }

  if (userByGoogleId) {
    return {
      kind: isAuthorizedUser(userByGoogleId) ? 'login-existing-google' : 'complete-existing-google',
      user: userByGoogleId,
      mode: authMode,
    };
  }

  if (userByEmail) {
    if (hasGoogleLinkedAccount(userByEmail)) {
      return {
        kind: 'error',
        code: 'GOOGLE_ID_ALREADY_LINKED',
        message: 'Este correo ya esta vinculado a otra identidad de Google.',
      };
    }

    return {
      kind: isAuthorizedUser(userByEmail)
        ? 'attach-google-id-and-login'
        : 'attach-google-id-and-complete',
      user: userByEmail,
      mode: authMode,
    };
  }

  return {
    kind: 'start-registration',
    mode: authMode,
  };
}

module.exports = {
  GOOGLE_AUTH_MODES,
  hasGoogleLinkedAccount,
  hasLocalPassword,
  isAuthorizedUser,
  isProfileComplete,
  isValidEmail,
  mapUserRow,
  normalizeEmail,
  normalizeRole,
  resolveAccountAuthProvider,
  resolveGoogleAuthDecision,
  toBooleanFlag,
};
