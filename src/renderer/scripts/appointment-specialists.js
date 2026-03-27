(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AppointmentSpecialists = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isActiveSpecialist(specialist) {
    return Number(specialist?.activo ?? 1) === 1;
  }

  function buildSpecialistLabel(specialist, options = {}) {
    const { includeStatus = false } = options;
    const parts = [specialist?.nombre, specialist?.especialidad]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const baseLabel = parts.join(' - ') || `Especialista ${specialist?.id ?? ''}`.trim();

    if (includeStatus && !isActiveSpecialist(specialist)) {
      return `${baseLabel} (inactivo)`;
    }

    return baseLabel;
  }

  async function loadRegisteredSpecialists(db) {
    if (!db || typeof db.all !== 'function') return [];

    const rows = await db.all(`
      SELECT
        id,
        nombre,
        especialidad,
        COALESCE(activo, 1) AS activo
      FROM especialistas
      ORDER BY nombre COLLATE NOCASE ASC, especialidad COLLATE NOCASE ASC, id ASC
    `);

    return Array.isArray(rows) ? rows : [];
  }

  function buildSpecialistOptionsHtml(specialists, options = {}) {
    const {
      selectedValue = '',
      includeUnassigned = true,
      includeInactiveLabel = true,
      missingOptionLabel = null,
    } = options;

    const selectedStr = selectedValue === null || selectedValue === undefined || selectedValue === ''
      ? ''
      : String(selectedValue);
    const rows = Array.isArray(specialists) ? specialists : [];
    const items = [];

    if (includeUnassigned) {
      const selected = selectedStr === '' ? ' selected' : '';
      items.push(`<option value=""${selected}>Sin asignar</option>`);
    }

    rows.forEach((specialist) => {
      const value = String(specialist.id);
      const selected = value === selectedStr ? ' selected' : '';
      const label = escapeHtml(buildSpecialistLabel(specialist, { includeStatus: includeInactiveLabel }));
      items.push(`<option value="${escapeHtml(value)}"${selected}>${label}</option>`);
    });

    if (selectedStr && !rows.some(specialist => String(specialist.id) === selectedStr)) {
      const fallbackLabel = missingOptionLabel || `Especialista ${selectedStr} (no disponible)`;
      items.push(`<option value="${escapeHtml(selectedStr)}" selected>${escapeHtml(fallbackLabel)}</option>`);
    }

    return items.join('');
  }

  return {
    buildSpecialistLabel,
    buildSpecialistOptionsHtml,
    isActiveSpecialist,
    loadRegisteredSpecialists,
  };
});
