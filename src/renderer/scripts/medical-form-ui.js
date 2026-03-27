export const MEDICAL_FIELDS = [
    { 
        id: 'alergias', 
        label: 'Alergias', 
        icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />', 
        iconColor: 'text-red-500',
        subfields: [
            { id: 'penicilina', label: 'Penicilina / Amoxicilina', type: 'checkbox' },
            { id: 'anestesia', label: 'Anestesia Local (Lidocaína, etc)', type: 'checkbox' },
            { id: 'latex', label: 'Látex (Guantes, dique)', type: 'checkbox' },
            { id: 'aspirina', label: 'Aspirina / AINES', type: 'checkbox' },
            { id: 'otros', label: 'Otros (Alimentos, metales, yodo, etc)', type: 'textarea', placeholder: 'Especifica todas las alergias conocidas...' }
        ]
    },
    { 
        id: 'diabetes', 
        label: 'Diabetes', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />', 
        iconColor: 'text-blue-500',
        subfields: [
            { id: 'tipo', label: 'Tipo de Diabetes', type: 'select', options: ['', 'Tipo 1', 'Tipo 2', 'Gestacional', 'Prediabetes'] },
            { id: 'hba1c', label: 'Última HbA1c (%)', type: 'text', placeholder: 'Ej: 6.5' },
            { id: 'control', label: 'Tratamiento actual', type: 'text', placeholder: 'Ej: Insulina / Metformina' },
            { id: 'hipoglucemia', label: '¿Ha tenido crisis de hipoglucemia?', type: 'checkbox' }
        ]
    },
    { 
        id: 'hipertension', 
        label: 'Hipertensión', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />', 
        iconColor: 'text-orange-500',
        subfields: [
            { id: 'presion', label: 'Presión Habitual', type: 'text', placeholder: 'Ej: 120/80' },
            { id: 'medicamento', label: 'Medicamento Control', type: 'text', placeholder: 'Ej: Losartán / Enalapril' },
            { id: 'tiempo', label: 'Tiempo con el diagnóstico', type: 'text', placeholder: 'Ej: 5 años' }
        ]
    },
    { 
        id: 'problemas_cardiacos', 
        label: 'Problemas Cardíacos', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />', 
        iconColor: 'text-rose-500',
        subfields: [
            { id: 'infarto', label: 'Infarto Previo', type: 'checkbox' },
            { id: 'soplo', label: 'Soplos / Arritmias', type: 'checkbox' },
            { id: 'marcapasos', label: 'Uso de Marcapasos', type: 'checkbox' },
            { id: 'valvulas', label: 'Prótesis Valvulares', type: 'checkbox' },
            { id: 'otros', label: 'Otros detalles', type: 'text', placeholder: 'Especifique condición cardiaca...' }
        ]
    },
    { 
        id: 'coagulacion', 
        label: 'Trastornos de Coagulación', 
        icon: '<path d="M12 2s-7 4.5-7 9.5S12 22 12 22s7-7.5 7-12.5S12 2 12 2z" />', 
        iconColor: 'text-red-600',
        subfields: [
            { id: 'anticoagulante', label: 'Toma Anticoagulantes (Aspirina, etc)', type: 'checkbox' },
            { id: 'hemofilia', label: 'Hemofilia / Otros trastornos', type: 'checkbox' },
            { id: 'hemorragia', label: '¿Sangra mucho al cortarse / extracciones?', type: 'checkbox' }
        ]
    },
    { 
        id: 'enfermedades_sistemicas', 
        label: 'Otras Enfermedades', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />',
        subfields: [
            { id: 'tuberculosis', label: 'Tuberculosis', type: 'checkbox' },
            { id: 'vih', label: 'VIH / SIDA / Hepatitis', type: 'checkbox' },
            { id: 'tiroides', label: 'Problemas de Tiroides', type: 'checkbox' },
            { id: 'osteoporosis', label: 'Osteoporosis / Artritis', type: 'checkbox' },
            { id: 'renal', label: 'Insuficiencia Renal / Dialisis', type: 'checkbox' },
            { id: 'otros', label: 'Especifique otras enfermedades', type: 'textarea', placeholder: 'Cualquier otra condición relevante...' }
        ]
    },
    { 
        id: 'epilepsia', 
        label: 'Epilepsia / Convulsiones', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />', 
        iconColor: 'text-yellow-500',
        subfields: [
            { id: 'frecuencia', label: 'Frecuencia de crisis', type: 'text', placeholder: 'Ej: Una vez al mes' },
            { id: 'ultima', label: 'Fecha última crisis', type: 'text', placeholder: 'Ej: Enero 2024' },
            { id: 'medicamento', label: 'Medicamento de control', type: 'text' }
        ]
    },
    { 
        id: 'oncologico', 
        label: 'Tratamiento Oncológico', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
        subfields: [
            { id: 'quimio', label: 'Quimioterapia', type: 'checkbox' },
            { id: 'radio', label: 'Radioterapia (Cabeza o Cuello)', type: 'checkbox' },
            { id: 'bifosfonatos', label: 'Uso de Bifosfonatos (Fosamax, etc)', type: 'checkbox' }
        ]
    },
    { 
        id: 'embarazo', 
        label: 'Embarazo', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />', 
        iconColor: 'text-pink-400',
        subfields: [
            { id: 'meses', label: 'Meses de gestación', type: 'text', placeholder: 'Ej: 6 meses' },
            { id: 'riesgo', label: 'Embarazo de alto riesgo', type: 'checkbox' },
            { id: 'lactancia', label: '¿Está en periodo de lactancia?', type: 'checkbox' }
        ]
    },
    { 
        id: 'habitos', 
        label: 'Hábitos Relevantes', 
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />',
        subfields: [
            { id: 'fuma', label: 'Tabaquismo (Cigarro/Vape)', type: 'checkbox' },
            { id: 'alcohol', label: 'Alcoholismo / Consumo frecuente', type: 'checkbox' },
            { id: 'bruxismo', label: 'Bruxismo (Aprieta los dientes)', type: 'checkbox' },
            { id: 'drogas', label: 'Uso de drogas recreativas', type: 'checkbox' }
        ]
    },
];

export function generateMedicalFormHTML(data = {}) {
    let medicalData = {};
    if (data.detalles_medicos) {
        medicalData = typeof data.detalles_medicos === 'string' ? JSON.parse(data.detalles_medicos) : data.detalles_medicos;
    }

    let html = `
    <div class="grid gap-4 md:grid-cols-2 items-start">
    `;

    MEDICAL_FIELDS.forEach(field => {
        const hasCondition = medicalData[field.id] === true || medicalData[field.id] === 'Sí';
        
        html += `
        <div class="bg-white dark:bg-[#0E1A25] border border-[#E6E6E6] dark:border-slate-800/60 rounded-2xl p-4 transition-all hover:border-[#8BCFDD] dark:hover:border-slate-600 shadow-sm relative overflow-hidden group self-start ${hasCondition ? 'ring-1 ring-[#4EABBE]/20' : ''}">
            <div class="flex items-center justify-between">
                <label class="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#0F2532] dark:text-slate-300">
                    <div class="p-2 rounded-lg ${hasCondition ? 'bg-[#4EABBE]/10' : 'bg-gray-50 dark:bg-slate-800/50'} group-hover:bg-[#4EABBE]/10 transition-colors">
                        <svg class="w-5 h-5 ${field.iconColor || 'text-[#4EABBE]'}" fill="${field.iconColor ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            ${field.icon}
                        </svg>
                    </div>
                    ${field.label}
                </label>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-bold uppercase ${hasCondition ? 'text-[#4EABBE]' : 'text-gray-400 dark:text-slate-600'} transition-colors toggle-label">${hasCondition ? 'Sí' : 'No'}</span>
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="has_${field.id}" value="true" class="sr-only peer toggle-medical-field" ${hasCondition ? 'checked' : ''}>
                        <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#4EABBE]"></div>
                    </label>
                </div>
            </div>
            
            <div class="medical-detail-container transition-all duration-300 overflow-hidden ${hasCondition ? 'max-h-[800px] mt-4 opacity-100' : 'max-h-0 mt-0 opacity-0'}">
                <div class="grid gap-4 pt-3 border-t border-gray-100 dark:border-slate-800/50">
                    ${(field.subfields || []).map(sub => {
                        const subValue = medicalData[`${field.id}_${sub.id}`];
                        const name = `${field.id}_${sub.id}`;
                        
                        if (sub.type === 'checkbox') {
                            return `
                                <label class="flex items-center gap-3 cursor-pointer group/sub py-0.5">
                                    <input type="checkbox" name="${name}" value="true" ${subValue === true || subValue === 'true' ? 'checked' : ''}
                                        class="w-4.5 h-4.5 rounded-md border-[#D9D9D9] dark:border-slate-700 text-[#4EABBE] focus:ring-[#4EABBE] dark:bg-[#0B1721] transition">
                                    <span class="text-sm text-[#0F2532] dark:text-slate-300 group-hover/sub:text-[#4EABBE] transition-colors">${sub.label}</span>
                                </label>
                            `;
                        } else if (sub.type === 'select') {
                            return `
                                <div class="space-y-1">
                                    <label class="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 ml-1 tracking-wider">${sub.label}</label>
                                    <select name="${name}" 
                                        class="w-full px-3 py-2 text-sm text-[#0F2532] dark:text-slate-200 bg-white dark:bg-[#0B1721] border border-[#D9D9D9] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4EABBE] transition">
                                        ${sub.options.map(opt => `<option value="${opt}" ${subValue === opt ? 'selected' : ''}>${opt || 'Seleccionar...'}</option>`).join('')}
                                    </select>
                                </div>
                            `;
                        } else if (sub.type === 'textarea') {
                            return `
                                <div class="space-y-1">
                                    <label class="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 ml-1 tracking-wider">${sub.label}</label>
                                    <textarea name="${name}" rows="2" placeholder="${sub.placeholder || ''}"
                                        class="w-full px-4 py-2 text-sm text-[#0F2532] dark:text-slate-200 bg-white dark:bg-[#0B1721] border border-[#D9D9D9] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4EABBE] transition resize-none scrollbar-none">${subValue || ''}</textarea>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="space-y-1">
                                    <label class="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 ml-1 tracking-wider">${sub.label}</label>
                                    <input type="${sub.type || 'text'}" name="${name}" value="${subValue || ''}" placeholder="${sub.placeholder || ''}"
                                        class="w-full px-4 py-2 text-sm text-[#0F2532] dark:text-slate-200 bg-white dark:bg-[#0B1721] border border-[#D9D9D9] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4EABBE] transition">
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        </div>
        `;
    });

    // Global fields
    html += `
        <div class="bg-white dark:bg-[#0E1A25] border border-[#E6E6E6] dark:border-slate-800/60 rounded-2xl p-4 shadow-sm self-start">
            <label class="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#0F2532] dark:text-slate-300 mb-3 ml-1">
                <div class="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                </div>
                Tipo de Sangre
            </label>
            <select name="tipo_sangre"
                class="w-full px-4 py-2.5 text-sm text-[#0F2532] dark:text-slate-200 bg-white dark:bg-[#0B1721] border border-[#D9D9D9] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4EABBE] transition">
                <option value="">Desconocido...</option>
                <option value="A+" ${data.tipo_sangre === 'A+' || medicalData.tipo_sangre === 'A+' ? 'selected' : ''}>A+</option>
                <option value="A-" ${data.tipo_sangre === 'A-' || medicalData.tipo_sangre === 'A-' ? 'selected' : ''}>A-</option>
                <option value="B+" ${data.tipo_sangre === 'B+' || medicalData.tipo_sangre === 'B+' ? 'selected' : ''}>B+</option>
                <option value="B-" ${data.tipo_sangre === 'B-' || medicalData.tipo_sangre === 'B-' ? 'selected' : ''}>B-</option>
                <option value="AB+" ${data.tipo_sangre === 'AB+' || medicalData.tipo_sangre === 'AB+' ? 'selected' : ''}>AB+</option>
                <option value="AB-" ${data.tipo_sangre === 'AB-' || medicalData.tipo_sangre === 'AB-' ? 'selected' : ''}>AB-</option>
                <option value="O+" ${data.tipo_sangre === 'O+' || medicalData.tipo_sangre === 'O+' ? 'selected' : ''}>O+</option>
                <option value="O-" ${data.tipo_sangre === 'O-' || medicalData.tipo_sangre === 'O-' ? 'selected' : ''}>O-</option>
            </select>
        </div>

        <div class="bg-white dark:bg-[#0E1A25] border border-[#E6E6E6] dark:border-slate-800/60 rounded-2xl p-4 shadow-sm md:col-span-2">
            <label class="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#0F2532] dark:text-slate-300 mb-3 ml-1">
                <div class="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <svg class="w-4 h-4 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                Observaciones Médicas Adicionales
            </label>
            <textarea name="observaciones_generales" rows="2" placeholder="Cualquier información complementaria..."
                class="w-full px-4 py-3 text-sm text-[#0F2532] dark:text-slate-200 bg-white dark:bg-[#0B1721] border border-[#D9D9D9] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4EABBE] transition resize-none">${data.observaciones || medicalData.observaciones || ''}</textarea>
        </div>
    </div>
    `;

    return html;
}

export function attachMedicalFormListeners(container) {
    const toggles = container.querySelectorAll('.toggle-medical-field');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const card = e.target.closest('.rounded-2xl');
            const detailContainer = card.querySelector('.medical-detail-container');
            const label = card.querySelector('.toggle-label');
            
            label.textContent = isChecked ? 'Sí' : 'No';
            label.classList.toggle('text-[#4EABBE]', isChecked);
            label.classList.toggle('text-gray-400', !isChecked);
            label.classList.toggle('dark:text-slate-600', !isChecked);
            
            card.classList.toggle('ring-1', isChecked);
            card.classList.toggle('ring-[#4EABBE]/20', isChecked);

            const iconContainer = card.querySelector('svg').parentElement;
            iconContainer.classList.toggle('bg-[#4EABBE]/10', isChecked);
            iconContainer.classList.toggle('bg-gray-50', !isChecked);
            iconContainer.classList.toggle('dark:bg-slate-800/50', !isChecked);
            
            if (isChecked) {
                detailContainer.classList.remove('max-h-0', 'mt-0', 'opacity-0');
                detailContainer.classList.add('max-h-[800px]', 'mt-4', 'opacity-100');
            } else {
                detailContainer.classList.add('max-h-0', 'mt-0', 'opacity-0');
                detailContainer.classList.remove('max-h-[800px]', 'mt-4', 'opacity-100');
            }
        });
    });
}

export function extractMedicalFormData(form) {
    const payload = {
        detalles_medicos: {}
    };

    MEDICAL_FIELDS.forEach(field => {
        const hasCondition = form[`has_${field.id}`]?.checked || false;
        payload.detalles_medicos[field.id] = hasCondition;

        (field.subfields || []).forEach(sub => {
            const el = form[`${field.id}_${sub.id}`];
            if (sub.type === 'checkbox') {
                payload.detalles_medicos[`${field.id}_${sub.id}`] = el?.checked || false;
            } else {
                payload.detalles_medicos[`${field.id}_${sub.id}`] = el?.value || '';
            }
        });
    });

    // Global fields
    payload.tipo_sangre = form.tipo_sangre?.value || '';
    payload.observaciones = form.observaciones_generales?.value || '';
    
    // Merge into detalles_medicos for full structure
    payload.detalles_medicos.tipo_sangre = payload.tipo_sangre;
    payload.detalles_medicos.observaciones = payload.observaciones;

    // Backwards compatibility for legacy fields
    const mapToLegacy = {
        'alergias': 'alergias',
        'diabetes': 'diabetes',
        'hipertension': 'hipertension',
        'medicamentos': 'medicamentos'
    };

    Object.keys(mapToLegacy).forEach(key => {
        const has = payload.detalles_medicos[key];
        if (has) {
            // Summary for legacy fields
            let summary = 'Sí';
            const sigSub = (MEDICAL_FIELDS.find(f => f.id === key).subfields || []).find(s => s.type === 'checkbox' && payload.detalles_medicos[`${key}_${s.id}`]);
            if (sigSub) summary += ` (${sigSub.label})`;
            payload[mapToLegacy[key]] = summary;
        } else {
            payload[mapToLegacy[key]] = '';
        }
    });

    return payload;
}
