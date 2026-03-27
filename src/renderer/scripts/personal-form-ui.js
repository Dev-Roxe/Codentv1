/**
 * personal-form-ui.js
 * Shared UI component for patient personal data fields.
 */

export const PERSONAL_FIELDS = [
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, gridSpan: 1 },
    { key: 'apellido', label: 'Apellido', type: 'text', required: true, gridSpan: 1 },
    { key: 'telefono', label: 'Teléfono', type: 'tel', gridSpan: 1 },
    { key: 'email', label: 'Email', type: 'email', gridSpan: 1 },
    { key: 'direccion', label: 'Dirección', type: 'text', gridSpan: 2 },
    { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', gridSpan: 1 },
    { key: 'sexo', label: 'Sexo', type: 'select', options: ['', 'Masculino', 'Femenino', 'Otro'], gridSpan: 1 },
    { key: 'nombre_social', label: 'Nombre social', type: 'text', gridSpan: 1 },
    { key: 'curp', label: 'CURP/RFC', type: 'text', gridSpan: 1 },
    { key: 'convenio', label: 'Convenio', type: 'text', gridSpan: 1 },
    { key: 'numero_interno', label: 'Número Interno', type: 'text', gridSpan: 1 },
    { key: 'ciudad', label: 'Ciudad', type: 'text', gridSpan: 1 },
    { key: 'delegacion', label: 'Delegación', type: 'text', gridSpan: 1 },
    { key: 'actividad', label: 'Actividad', type: 'text', gridSpan: 1 },
    { key: 'profesion', label: 'Profesión', type: 'text', gridSpan: 1 },
    { key: 'empleador', label: 'Empleador', type: 'text', gridSpan: 1 },
    { key: 'apoderado', label: 'Apoderado', type: 'text', gridSpan: 1 },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', gridSpan: 2 }
];

/**
 * Generates the HTML for the personal data form fields.
 * @param {Object} data - Existing patient data for pre-filling.
 * @param {Object} config - Field configuration (show/required).
 */
export function generatePersonalFormHTML(data = {}, config = {}) {
    return PERSONAL_FIELDS.map(f => {
        const fieldConfig = config[f.key] || { show: true, required: f.required || false };
        if (config[f.key] && !fieldConfig.show && f.key !== 'nombre' && f.key !== 'apellido') {
            return '';
        }

        const value = data[f.key] || '';
        const isRequired = fieldConfig.required || f.required;
        const requiredMark = isRequired ? '<span class="text-red-500 ml-1">*</span>' : '';
        const gridClass = f.gridSpan === 2 ? 'md:col-span-2' : '';
        
        let inputHtml = '';
        const baseClasses = "w-full px-3 py-2.5 rounded-xl bg-white border border-[#8BCFDD] text-sm text-[#0F2532] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] dark:bg-[#0F2532] dark:border-slate-700 dark:text-slate-100 transition-all";

        if (f.type === 'textarea') {
            inputHtml = `<textarea name="${f.key}" rows="3" class="${baseClasses} resize-none" placeholder="Escribe aquí...">${value}</textarea>`;
        } else if (f.type === 'select') {
            const opts = (f.options || []).map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o || 'Seleccionar...'}</option>`).join('');
            inputHtml = `<select name="${f.key}" class="${baseClasses}">${opts}</select>`;
        } else {
            inputHtml = `<input type="${f.type}" name="${f.key}" value="${value}" class="${baseClasses}" placeholder="${f.label}" ${isRequired ? 'required' : ''} />`;
        }

        return `
            <div class="${gridClass}" data-field="${f.key}">
                <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-[#0F2532] dark:text-slate-300 mb-1.5 ml-1">
                    ${f.label}${requiredMark}
                </label>
                ${inputHtml}
            </div>
        `;
    }).join('');
}
