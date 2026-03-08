let currentPacienteId = null;
let financeApi = null;

const State = {
    summary: null,
    plans: [],
    payments: [],
    installments: [],
};

function resolveApi() {
    if (window.api) return window.api;
    if (window.parent && window.parent !== window && window.parent.api) {
        return window.parent.api;
    }
    return null;
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name);
    if (value !== null && value !== '') return value;
    if (window.parent && window.parent !== window) {
        const parentParams = new URLSearchParams(window.parent.location.search);
        const parentValue = parentParams.get(name);
        if (parentValue !== null && parentValue !== '') return parentValue;
    }
    return null;
}

function getSessionUser() {
    try {
        const localSession = JSON.parse(localStorage.getItem('sesionActual')) || {};
        if (localSession && typeof localSession === 'object' && Object.keys(localSession).length) {
            return localSession;
        }

        if (window.parent && window.parent !== window) {
            const parentSessionRaw = window.parent.localStorage?.getItem('sesionActual');
            if (parentSessionRaw) {
                const parentSession = JSON.parse(parentSessionRaw) || {};
                if (parentSession && typeof parentSession === 'object') return parentSession;
            }
        }
        return {};
    } catch (e) {
        return {};
    }
}

function getCurrentUserId() {
    const session = getSessionUser();
    const candidates = [
        session.id,
        session.user_id,
        session.id_usuario,
        session.usuario_id,
        session.userId,
        session.usuarioId,
    ];

    for (const raw of candidates) {
        const id = Number(raw);
        if (Number.isInteger(id) && id > 0) return id;
    }

    return null;
}

async function resolveCurrentUserId() {
    const idFromSession = getCurrentUserId();
    if (idFromSession) return idFromSession;

    const session = getSessionUser();
    const email = String(session.email || '').trim().toLowerCase();
    if (!email) return null;

    const dbApi = resolveApi()?.db;
    if (!dbApi?.get) return null;

    try {
        const row = await dbApi.get(
            'SELECT id, nombre, apellido, apellidos, rol, email FROM usuarios WHERE lower(email) = lower(?) LIMIT 1',
            [email]
        );
        const resolvedId = Number(row?.id || 0);
        if (!Number.isInteger(resolvedId) || resolvedId <= 0) return null;

        const patchedSession = {
            ...session,
            id: resolvedId,
            nombre: session.nombre || row.nombre || '',
            apellido: session.apellido || row.apellido || row.apellidos || '',
            rol: session.rol || row.rol || '',
            email: session.email || row.email || email,
        };

        try {
            localStorage.setItem('sesionActual', JSON.stringify(patchedSession));
        } catch (storageError) {
            console.warn('No se pudo actualizar sesionActual con id', storageError);
        }

        return resolvedId;
    } catch (error) {
        console.error('resolveCurrentUserId error', error);
        return null;
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(Number(amount || 0));
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function applySummaryData(data) {
    State.summary = data?.summary || null;
    State.plans = data?.plans || [];
    State.payments = data?.payments || [];
    State.installments = data?.installments || [];
    renderSummary();
    renderPlans();
    renderInstallments();
    renderPayments();
    populatePlanSelect();
}

async function loadFinanceData() {
    if (!financeApi?.getPatientSummary) {
        showToast('La API financiera no está disponible', 'error');
        return;
    }

    try {
        const data = await financeApi.getPatientSummary(Number(currentPacienteId));
        applySummaryData(data);
    } catch (error) {
        console.error('loadFinanceData error', error);
        showToast(error.message || 'Error cargando finanzas', 'error');
    }
}

function renderSummary() {
    const summary = State.summary || {};
    document.getElementById('summary-total-planned').textContent = formatCurrency(summary.total_planned);
    document.getElementById('summary-net-paid').textContent = formatCurrency(summary.net_paid);
    document.getElementById('summary-refunds-info').textContent = `Devoluciones: ${formatCurrency(summary.total_refunded)}`;
    document.getElementById('summary-pending').textContent = formatCurrency(summary.total_pending);
    document.getElementById('summary-overdue').textContent = formatCurrency(summary.total_overdue);
    document.getElementById('summary-plans-count').textContent = `${State.plans.length} plan${State.plans.length === 1 ? '' : 'es'}`;
    document.getElementById('summary-payments-count').textContent = `${summary.payment_count || 0} movimiento${summary.payment_count === 1 ? '' : 's'}`;
    document.getElementById('summary-overdue-count').textContent = `${summary.overdue_count || 0} cuota${summary.overdue_count === 1 ? '' : 's'} vencida${summary.overdue_count === 1 ? '' : 's'}`;
}

function renderPlans() {
    const container = document.getElementById('plans-list');
    if (!container) return;

    if (!State.plans.length) {
        container.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">No hay planes financieros para este paciente.</p>';
        return;
    }

    container.innerHTML = State.plans.map(plan => {
        const statusClass = plan.monto_vencido > 0
            ? 'text-rose-600 dark:text-rose-400'
            : plan.saldo_pendiente > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400';

        return `
            <div class="rounded-2xl border border-[#8BCFDD]/30 dark:border-slate-700 p-4 bg-[#F8F7F7]/70 dark:bg-slate-900/40">
                <div class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p class="text-lg font-bold text-[#0F2532] dark:text-white">${escapeHtml(plan.tratamiento_nombre)}</p>
                        <p class="text-xs text-[#1D5D69] dark:text-slate-400">${escapeHtml(plan.especialista_asignado || 'Sin especialista asignado')}</p>
                    </div>
                    <button data-plan-action="pay" data-plan-id="${plan.id}"
                        class="px-4 py-2 rounded-xl bg-[#4EABBE] hover:bg-[#1D5D69] text-white text-sm font-semibold transition">
                        Cobrar
                    </button>
                </div>
                <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Total</p>
                        <p class="font-semibold">${formatCurrency(plan.total_final)}</p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Pagado</p>
                        <p class="font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(plan.neto_pagado)}</p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Pendiente</p>
                        <p class="font-semibold ${statusClass}">${formatCurrency(plan.saldo_pendiente)}</p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Vencido</p>
                        <p class="font-semibold ${plan.monto_vencido > 0 ? 'text-rose-600 dark:text-rose-400' : ''}">${formatCurrency(plan.monto_vencido)}</p>
                    </div>
                </div>
                <div class="mt-4 flex flex-wrap gap-2 text-xs">
                    <span class="px-3 py-1 rounded-full bg-[#8BCFDD]/20 text-[#1D5D69] dark:text-[#8BCFDD]">
                        Descuento: ${formatCurrency(plan.descuento_monto || 0)}
                    </span>
                    <span class="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Estado: ${escapeHtml(plan.estado || 'pendiente')}
                    </span>
                    <span class="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Progreso: ${Number(plan.progreso || 0)}%
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function renderInstallments() {
    const container = document.getElementById('installments-list');
    if (!container) return;

    if (!State.installments.length) {
        container.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">No hay cuotas programadas para este paciente.</p>';
        return;
    }

    container.innerHTML = State.installments.map(item => {
        const status = item.esta_vencida ? 'vencida' : item.estado;
        const statusStyles = status === 'pagada'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
            : status === 'vencida'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                : status === 'parcial'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

        return `
            <div class="rounded-2xl border border-[#8BCFDD]/30 dark:border-slate-700 p-4 bg-[#F8F7F7]/70 dark:bg-slate-900/40" data-installment-id="${item.id}">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p class="font-semibold text-[#0F2532] dark:text-white">${escapeHtml(item.tratamiento_nombre)}</p>
                        <p class="text-xs text-[#1D5D69] dark:text-slate-400">
                            ${item.es_anticipo ? 'Anticipo' : `Cuota #${item.numero}`} • vence ${escapeHtml(item.fecha_vencimiento)}
                        </p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusStyles}">${escapeHtml(status)}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Programado</p>
                        <p class="font-semibold">${formatCurrency(item.monto_programado)}</p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Pagado</p>
                        <p class="font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(item.monto_pagado)}</p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">Saldo</p>
                        <p class="font-semibold ${item.esta_vencida ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}">${formatCurrency(item.saldo_pendiente)}</p>
                    </div>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                    <button data-plan-action="pay" data-plan-id="${item.plan_tratamiento_id}"
                        class="px-3 py-2 rounded-xl bg-[#4EABBE]/15 text-[#1D5D69] dark:text-[#8BCFDD] text-xs font-semibold hover:bg-[#4EABBE]/25 transition">
                        Aplicar pago
                    </button>
                    ${item.esta_vencida ? `
                        <button data-remind-installment="${item.id}"
                            class="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-500/25 transition">
                            Enviar recordatorio
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderPayments() {
    const container = document.getElementById('payments-list');
    if (!container) return;

    if (!State.payments.length) {
        container.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">No hay movimientos financieros registrados.</p>';
        return;
    }

    container.innerHTML = State.payments.map(item => {
        const isRefund = item.tipo === 'devolucion';
        const badgeClass = isRefund
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400';
        const canGenerateInvoice = !isRefund && item.estado === 'aplicado';
        const hasInvoice = !!item.factura_simulada_id;

        return `
            <div class="rounded-2xl border border-[#8BCFDD]/30 dark:border-slate-700 p-4 bg-[#F8F7F7]/70 dark:bg-slate-900/40">
                <div class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <p class="text-lg font-bold ${isRefund ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                ${isRefund ? '-' : '+'}${formatCurrency(item.monto)}
                            </p>
                            <span class="px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}">${escapeHtml(item.tipo || 'pago')}</span>
                        </div>
                        <p class="text-xs text-[#1D5D69] dark:text-slate-400 mt-1">${formatDateTime(item.fecha)}</p>
                        ${item.descripcion ? `<p class="text-sm text-[#0F2532] dark:text-slate-200 mt-2">${escapeHtml(item.descripcion)}</p>` : ''}
                    </div>
                    <div class="text-right text-sm">
                        <p class="font-semibold text-[#0F2532] dark:text-white">${escapeHtml(item.metodo || '-')}</p>
                        <p class="text-xs text-[#1D5D69] dark:text-slate-400">${escapeHtml(item.tratamiento_nombre || 'Sin plan')}</p>
                        ${hasInvoice ? `
                            <p class="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                                Comprobante: ${escapeHtml(item.factura_folio || 'Generado')}
                            </p>
                        ` : ''}
                        ${canGenerateInvoice ? `
                            <button
                                data-payment-action="invoice"
                                data-payment-id="${item.id}"
                                class="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${hasInvoice
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                                    : 'bg-[#4EABBE]/15 text-[#1D5D69] dark:text-[#8BCFDD] hover:bg-[#4EABBE]/25'
                                } transition">
                                ${hasInvoice ? 'Ver comprobante' : 'Generar comprobante'}
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function populatePlanSelect(selectedPlanId = '') {
    const select = document.getElementById('pago-plan');
    if (!select) return;

    const currentValue = selectedPlanId || select.value || '';
    select.innerHTML = '<option value="">Sin asociar</option>';

    State.plans.forEach(plan => {
        const option = document.createElement('option');
        option.value = plan.id;
        option.textContent = `${plan.tratamiento_nombre} • saldo ${formatCurrency(plan.saldo_pendiente)}`;
        select.appendChild(option);
    });

    if (currentValue) {
        select.value = String(currentValue);
    }
    populateInstallmentSelect(select.value || '');
}

function populateInstallmentSelect(planId, selectedInstallmentId = '') {
    const select = document.getElementById('pago-cuota');
    if (!select) return;

    select.innerHTML = '<option value="">Aplicar automáticamente</option>';
    if (!planId) return;

    State.installments
        .filter(item => String(item.plan_tratamiento_id) === String(planId) && Number(item.saldo_pendiente || 0) > 0)
        .forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.es_anticipo ? 'Anticipo' : `Cuota #${item.numero}`} • ${formatCurrency(item.saldo_pendiente)} • vence ${item.fecha_vencimiento}`;
            select.appendChild(option);
        });

    if (selectedInstallmentId) {
        select.value = String(selectedInstallmentId);
    }
}

function openModal(mode = 'payment', planId = '', installmentId = '') {
    const modal = document.getElementById('modal-pago');
    const title = document.getElementById('modal-pago-titulo');
    const label = document.getElementById('modal-pago-etiqueta');
    const typeInput = document.getElementById('movement-type');
    const form = document.getElementById('form-pago');

    if (!modal || !title || !label || !typeInput || !form) return;

    form.reset();
    typeInput.value = mode;
    title.textContent = mode === 'refund' ? 'Nueva devolución' : 'Nuevo pago';
    label.textContent = mode === 'refund' ? 'Devolución' : 'Cobro';
    document.getElementById('pago-metodo').value = mode === 'refund' ? 'Otro' : '';
    populatePlanSelect(planId);
    if (planId) {
        document.getElementById('pago-plan').value = String(planId);
        populateInstallmentSelect(planId, installmentId);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    const modal = document.getElementById('modal-pago');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleFormSubmit(event) {
    event.preventDefault();
    if (!financeApi) {
        showToast('La API financiera no está disponible', 'error');
        return;
    }

    const userId = await resolveCurrentUserId();
    if (!userId) {
        showToast('No se pudo validar la sesión del usuario. Cierra sesión y vuelve a entrar.', 'error');
        return;
    }

    const type = document.getElementById('movement-type').value;
    const payload = {
        paciente_id: Number(currentPacienteId),
        usuario_id: userId,
        user_id: userId,
        monto: parseFloat(document.getElementById('pago-monto').value || 0),
        metodo: document.getElementById('pago-metodo').value,
        plan_tratamiento_id: document.getElementById('pago-plan').value || null,
        cuota_financiamiento_id: document.getElementById('pago-cuota').value || null,
        descripcion: document.getElementById('pago-descripcion').value.trim(),
    };

    try {
        const result = type === 'refund'
            ? await financeApi.registerRefund(payload)
            : await financeApi.registerPayment(payload);

        applySummaryData(result.summary);
        closeModal();
        showToast(type === 'refund' ? 'Devolución registrada' : 'Pago registrado', 'success');
    } catch (error) {
        console.error('handleFormSubmit error', error);
        showToast(error.message || 'No se pudo guardar el movimiento', 'error');
    }
}

async function handleInstallmentReminder(installmentId) {
    if (!financeApi?.sendCollectionReminder) {
        showToast('La API financiera no está disponible', 'error');
        return;
    }

    const userId = await resolveCurrentUserId();

    try {
        await financeApi.sendCollectionReminder({
            cuota_financiamiento_id: Number(installmentId),
            usuario_id: userId || null,
        });
        showToast('Recordatorio enviado correctamente', 'success');
    } catch (error) {
        console.error('handleInstallmentReminder error', error);
        showToast(error.message || 'No se pudo enviar el recordatorio', 'error');
    }
}

function buildSimulatedInvoiceHtml(invoice) {
    const movementLabel = invoice?.tipo === 'comprobante_devolucion'
        ? 'Comprobante de devolucion'
        : invoice?.tipo === 'comprobante_plan'
            ? 'Comprobante de plan'
            : 'Comprobante de pago';

    return `
<!doctype html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(invoice?.folio || 'Comprobante interno')}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #0F2532; }
        .card { border: 1px solid #D9EEF2; border-radius: 12px; padding: 20px; }
        .row { display: flex; justify-content: space-between; gap: 16px; margin: 8px 0; }
        .label { color: #1D5D69; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
        .value { font-size: 14px; font-weight: 600; }
        .title { margin: 0 0 6px 0; font-size: 22px; color: #1D5D69; }
        .subtitle { margin: 0 0 18px 0; font-size: 13px; color: #5B7280; }
        .totals { margin-top: 16px; padding-top: 14px; border-top: 1px solid #E2E8F0; }
        .total { font-size: 24px; color: #0F766E; font-weight: 800; }
    </style>
</head>
<body>
    <div class="card">
        <h1 class="title">${movementLabel}</h1>
        <p class="subtitle">Documento interno sin validez fiscal (sin CFDI/SAT).</p>
        <div class="row"><span class="label">Folio</span><span class="value">${escapeHtml(invoice?.folio || '-')}</span></div>
        <div class="row"><span class="label">Fecha</span><span class="value">${escapeHtml(formatDateTime(invoice?.fecha_emision))}</span></div>
        <div class="row"><span class="label">Paciente ID</span><span class="value">${escapeHtml(invoice?.paciente_id ?? '-')}</span></div>
        <div class="row"><span class="label">Plan ID</span><span class="value">${escapeHtml(invoice?.plan_tratamiento_id ?? '-')}</span></div>
        <div class="row"><span class="label">Pago ID</span><span class="value">${escapeHtml(invoice?.pago_id ?? '-')}</span></div>
        <div class="row"><span class="label">Metodo</span><span class="value">${escapeHtml(invoice?.metodo_pago || '-')}</span></div>
        <div class="row"><span class="label">Concepto</span><span class="value">${escapeHtml(invoice?.concepto || '-')}</span></div>
        <div class="totals">
            <div class="row"><span class="label">Subtotal</span><span class="value">${formatCurrency(invoice?.subtotal)}</span></div>
            <div class="row"><span class="label">Descuento</span><span class="value">${formatCurrency(invoice?.descuento)}</span></div>
            <div class="row"><span class="label">Impuesto</span><span class="value">${formatCurrency(invoice?.impuesto)}</span></div>
            <div class="row"><span class="label">Total</span><span class="total">${formatCurrency(invoice?.total)}</span></div>
        </div>
    </div>
    <script>window.print();</script>
</body>
</html>
    `;
}

function openInvoicePreview(invoice) {
    const popup = window.open('', '_blank');
    if (!popup) {
        showToast('No se pudo abrir la ventana de comprobante', 'error');
        return;
    }
    popup.document.open();
    popup.document.write(buildSimulatedInvoiceHtml(invoice));
    popup.document.close();
}

async function handleGenerateInvoice(paymentId) {
    if (!financeApi?.generateSimulatedInvoice) {
        showToast('La API financiera no está disponible', 'error');
        return;
    }

    const userId = await resolveCurrentUserId();

    try {
        const invoice = await financeApi.generateSimulatedInvoice({
            pago_id: Number(paymentId),
            usuario_id: userId || null,
            tipo: 'comprobante_pago',
        });
        if (!invoice) throw new Error('No se pudo generar el comprobante');
        openInvoicePreview(invoice);
        await loadFinanceData();
    } catch (error) {
        console.error('handleGenerateInvoice error', error);
        showToast(error.message || 'No se pudo generar el comprobante', 'error');
    }
}

function setupEventListeners() {
    document.getElementById('btn-nuevo-pago')?.addEventListener('click', () => openModal('payment'));
    document.getElementById('btn-nueva-devolucion')?.addEventListener('click', () => openModal('refund'));
    document.getElementById('btn-refresh-finanzas')?.addEventListener('click', loadFinanceData);
    document.getElementById('close-modal-pago')?.addEventListener('click', closeModal);
    document.getElementById('cancel-pago')?.addEventListener('click', closeModal);
    document.getElementById('form-pago')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('pago-plan')?.addEventListener('change', event => {
        populateInstallmentSelect(event.target.value);
    });

    document.getElementById('plans-list')?.addEventListener('click', event => {
        const trigger = event.target.closest('[data-plan-action="pay"]');
        if (!trigger) return;
        openModal('payment', trigger.getAttribute('data-plan-id'));
    });

    document.getElementById('installments-list')?.addEventListener('click', event => {
        const payTrigger = event.target.closest('[data-plan-action="pay"]');
        if (payTrigger) {
            const wrapper = payTrigger.closest('[data-installment-id]');
            openModal('payment', payTrigger.getAttribute('data-plan-id'), wrapper?.getAttribute('data-installment-id') || '');
            return;
        }

        const reminderTrigger = event.target.closest('[data-remind-installment]');
        if (reminderTrigger) {
            handleInstallmentReminder(reminderTrigger.getAttribute('data-remind-installment'));
        }
    });

    document.getElementById('payments-list')?.addEventListener('click', event => {
        const invoiceTrigger = event.target.closest('[data-payment-action="invoice"]');
        if (!invoiceTrigger) return;
        handleGenerateInvoice(invoiceTrigger.getAttribute('data-payment-id'));
    });
}

window.registrarPagoPlan = (planId) => openModal('payment', planId);

async function init() {
    currentPacienteId = getQueryParam('paciente_id') || getQueryParam('id');
    if (!currentPacienteId) {
        showToast('No se encontró el paciente', 'error');
        return;
    }

    financeApi = resolveApi()?.finance || null;
    setupEventListeners();
    await loadFinanceData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
