function resolveApi() {
    if (window.api) return window.api;
    if (window.opener && window.opener !== window && window.opener.api) {
        return window.opener.api;
    }
    return null;
}

function getNumericQueryParam(name) {
    const raw = new URLSearchParams(window.location.search).get(name);
    const value = Number(raw || 0);
    return Number.isInteger(value) && value > 0 ? value : null;
}

function escapeHtml(value) {
    return String(value ?? '')
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

function buildDetailRow(label, value) {
    return `
        <div class="rounded-2xl border border-[#8BCFDD]/25 dark:border-slate-700 bg-[#F8F7F7]/70 dark:bg-slate-900/40 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.12em] text-[#1D5D69] dark:text-slate-400">${escapeHtml(label)}</p>
            <p class="mt-1 text-sm font-semibold text-[#0F2532] dark:text-white break-words">${escapeHtml(value || '-')}</p>
        </div>
    `;
}

function showFeedback(message, type = 'info') {
    const feedback = document.getElementById('invoice-feedback');
    const card = document.getElementById('invoice-card');
    if (!feedback || !card) return;

    const colorClass = type === 'error'
        ? 'text-rose-600 dark:text-rose-300'
        : 'text-[#1D5D69] dark:text-slate-400';

    feedback.innerHTML = `<p class="text-sm ${colorClass}">${escapeHtml(message)}</p>`;
    feedback.classList.remove('hidden');
    card.classList.add('hidden');
}

function renderInvoice(invoice) {
    const feedback = document.getElementById('invoice-feedback');
    const card = document.getElementById('invoice-card');
    const title = document.getElementById('invoice-title');
    const folio = document.getElementById('invoice-folio');
    const total = document.getElementById('invoice-total');
    const detailContainer = document.getElementById('invoice-details');
    const totalsContainer = document.getElementById('invoice-totals');

    if (!feedback || !card || !title || !folio || !total || !detailContainer || !totalsContainer) return;

    const movementLabel = invoice?.tipo === 'comprobante_devolucion'
        ? 'Comprobante de devolucion'
        : invoice?.tipo === 'comprobante_plan'
            ? 'Comprobante de plan'
            : 'Comprobante de pago';

    title.textContent = movementLabel;
    folio.textContent = invoice?.folio || '-';
    total.textContent = formatCurrency(invoice?.total);
    document.title = invoice?.folio ? `${invoice.folio} | Comprobante` : 'Comprobante';

    detailContainer.innerHTML = [
        buildDetailRow('Fecha', formatDateTime(invoice?.fecha_emision)),
        buildDetailRow('Paciente ID', invoice?.paciente_id),
        buildDetailRow('Plan ID', invoice?.plan_tratamiento_id),
        buildDetailRow('Pago ID', invoice?.pago_id),
        buildDetailRow('Metodo', invoice?.metodo_pago || '-'),
        buildDetailRow('Concepto', invoice?.concepto || '-'),
        buildDetailRow('Observaciones', invoice?.observaciones || '-'),
        buildDetailRow('Estado', invoice?.estado || '-'),
    ].join('');

    totalsContainer.innerHTML = [
        buildDetailRow('Subtotal', formatCurrency(invoice?.subtotal)),
        buildDetailRow('Descuento', formatCurrency(invoice?.descuento)),
        buildDetailRow('Impuesto', formatCurrency(invoice?.impuesto)),
        buildDetailRow('Total', formatCurrency(invoice?.total)),
    ].join('');

    feedback.classList.add('hidden');
    card.classList.remove('hidden');
}

async function loadInvoice() {
    const financeApi = resolveApi()?.finance;
    if (!financeApi?.getSimulatedInvoices) {
        showFeedback('No se pudo acceder a la API financiera para abrir el comprobante.', 'error');
        return;
    }

    const invoiceId = getNumericQueryParam('factura_id');
    const paymentId = getNumericQueryParam('pago_id');

    if (!invoiceId && !paymentId) {
        showFeedback('No se recibio un identificador valido para el comprobante.', 'error');
        return;
    }

    try {
        const invoices = await financeApi.getSimulatedInvoices(
            invoiceId ? { factura_id: invoiceId } : { pago_id: paymentId }
        );
        const invoice = Array.isArray(invoices) && invoices.length ? invoices[0] : null;
        if (!invoice) {
            throw new Error('No se encontro el comprobante solicitado.');
        }
        renderInvoice(invoice);
    } catch (error) {
        console.error('loadInvoice error', error);
        showFeedback(error.message || 'No se pudo cargar el comprobante.', 'error');
    }
}

function setupEventListeners() {
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-close')?.addEventListener('click', () => window.close());
}

async function init() {
    setupEventListeners();
    await loadInvoice();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
