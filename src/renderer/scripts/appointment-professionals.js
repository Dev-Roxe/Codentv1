(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AppointmentProfessionals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IGNORED_ROLES = new Set(['recepcionista', 'administrador', 'admin', 'asistente', 'caja', 'cajero']);
  const CLINICAL_ROLE_KEYWORDS = [
    'dentista',
    'especialista',
    'medico',
    'doctor',
    'doctora',
    'odont',
    'ortod',
    'endod',
    'ciruj',
    'implant',
    'higien',
  ];

  function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
  }

  function isIgnoredRole(role) {
    return IGNORED_ROLES.has(normalizeRole(role));
  }

  function isClinicalRole(role) {
    const normalized = normalizeRole(role);
    if (!normalized || isIgnoredRole(normalized)) return false;
    return CLINICAL_ROLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  function getDisplayName(user) {
    return [user?.nombre, user?.apellido].filter(Boolean).join(' ').trim()
      || (user?.id ? `Usuario ${user.id}` : 'Profesional');
  }

  function buildProfessionalLabel(user) {
    if (!user) return 'Profesional';
    const roleLower = normalizeRole(user.rol);
    const prefix = roleLower.includes('especialista') ? 'Esp.' : 'Dr(a).';
    return `${prefix} ${getDisplayName(user)}`.trim();
  }

  function filterAssignableProfessionals(users, options = {}) {
    const rows = Array.isArray(users) ? users : [];
    const referencedIds = new Set((options.referencedIds || []).map((id) => String(id)));
    const unique = new Map();

    rows.forEach((user) => {
      if (!user || user.id === null || user.id === undefined || user.id === '') return;

      const id = String(user.id);
      const include = isClinicalRole(user.rol) || referencedIds.has(id);
      if (!include || unique.has(id)) return;
      unique.set(id, user);
    });

    return [...unique.values()].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'es'));
  }

  return {
    buildProfessionalLabel,
    filterAssignableProfessionals,
    getDisplayName,
    isClinicalRole,
    isIgnoredRole,
    normalizeRole,
  };
});
