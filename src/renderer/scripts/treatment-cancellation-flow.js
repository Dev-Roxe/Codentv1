window.TreatmentCancellationFlow = (function () {
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(Number(value || 0));
    }

    function buildImpactRows(options = {}) {
        const planStatus = options.planStatus ? `<p class="text-xs text-slate-500 dark:text-slate-400">Estado actual: <strong>${escapeHtml(options.planStatus)}</strong></p>` : '';
        const paymentCount = Number(options.paymentCount || 0);
        const netPaid = Number(options.netPaid || 0);
        const totalPaid = Number(options.totalPaid || netPaid || 0);
        const totalRefunded = Number(options.totalRefunded || 0);

        return `
            <div class="rounded-2xl border border-amber-200 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 space-y-1">
                <p class="text-sm font-semibold text-amber-800 dark:text-amber-300">Impacto financiero</p>
                ${planStatus}
                <p class="text-xs text-slate-600 dark:text-slate-300">Movimientos aplicados: <strong>${paymentCount}</strong></p>
                <p class="text-xs text-slate-600 dark:text-slate-300">Cobrado bruto: <strong>${formatCurrency(totalPaid)}</strong></p>
                <p class="text-xs text-slate-600 dark:text-slate-300">Devuelto: <strong>${formatCurrency(totalRefunded)}</strong></p>
                <p class="text-xs text-slate-600 dark:text-slate-300">Neto retenido actual: <strong>${formatCurrency(netPaid)}</strong></p>
            </div>
        `;
    }

    function buildOption(id, title, description, disabled = false) {
        return `
            <label class="flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${disabled
                ? 'border-slate-200 bg-slate-100/70 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500'
                : 'border-[#8BCFDD]/50 hover:border-[#4EABBE] bg-white dark:bg-[#0F2532]'
            }">
                <input type="radio" name="cancel-policy" value="${id}" ${disabled ? 'disabled' : ''} class="mt-1 h-4 w-4 accent-[#4EABBE]" />
                <span>
                    <span class="block text-sm font-semibold text-[#0F2532] dark:text-white">${escapeHtml(title)}</span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(description)}</span>
                </span>
            </label>
        `;
    }

    async function prompt(options = {}) {
        return new Promise((resolve) => {
            const maxRefund = Math.max(0, Number(options.maxRefund != null ? options.maxRefund : options.netPaid || 0));
            const partialEnabled = maxRefund > 0.01;
            const fullEnabled = maxRefund > 0.01;

            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F2532]/70 backdrop-blur-sm p-4';
            overlay.innerHTML = `
                <div class="w-full max-w-2xl rounded-3xl border border-[#8BCFDD]/50 bg-white dark:bg-[#0E1A25] shadow-2xl overflow-hidden">
                    <div class="px-6 py-5 border-b border-[#8BCFDD]/20 dark:border-slate-700">
                        <p class="text-xs uppercase tracking-[0.24em] text-[#1D5D69] dark:text-slate-400">Cancelacion controlada</p>
                        <h3 class="mt-2 text-2xl font-bold text-[#1D5D69] dark:text-white">Este diagnostico ya tiene impacto clinico o financiero</h3>
                        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            ${escapeHtml(options.description || 'Antes de retirarlo debes decidir como quedara el tratamiento y el dinero asociado.')}
                        </p>
                    </div>
                    <div class="px-6 py-5 space-y-5">
                        ${buildImpactRows(options)}
                        <div class="space-y-3">
                            ${buildOption('refund_full', 'Cancelar tratamiento y devolver dinero', 'Genera una devolucion por el monto neto pagado.', !fullEnabled)}
                            ${buildOption('keep_income', 'Cancelar sin devolucion', 'El tratamiento queda cancelado y el ingreso se conserva con auditoria.')}
                            ${buildOption('refund_partial', 'Cancelar con devolucion parcial', 'Devuelve solo una parte y conserva el resto como ingreso.', !partialEnabled)}
                            ${buildOption('do_not_cancel', 'No cancelar', 'Mantiene el tratamiento y no retira el diagnostico.')}
                        </div>
                        <div data-partial-wrapper class="hidden space-y-2">
                            <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-[#0F2532] dark:text-slate-300">Monto a devolver</label>
                            <input data-partial-amount type="number" min="0" step="0.01" max="${maxRefund.toFixed(2)}"
                                class="w-full rounded-xl border border-[#8BCFDD] dark:border-slate-700 bg-white dark:bg-[#0F2532] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]" />
                            <p class="text-xs text-slate-500 dark:text-slate-400">Maximo disponible para devolucion: ${formatCurrency(maxRefund)}</p>
                        </div>
                        <div class="space-y-2">
                            <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-[#0F2532] dark:text-slate-300">Motivo de cancelacion</label>
                            <textarea data-reason rows="3"
                                class="w-full rounded-xl border border-[#8BCFDD] dark:border-slate-700 bg-white dark:bg-[#0F2532] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"
                                placeholder="Ej. paciente abandono el tratamiento, cambio de plan clinico, correccion de diagnostico..."></textarea>
                        </div>
                        <p data-error class="hidden text-sm font-medium text-rose-600 dark:text-rose-400"></p>
                    </div>
                    <div class="px-6 py-4 border-t border-[#8BCFDD]/20 dark:border-slate-700 flex justify-end gap-3">
                        <button type="button" data-cancel class="px-5 py-2.5 rounded-xl border border-[#8BCFDD] dark:border-slate-700 text-[#0F2532] dark:text-slate-100 hover:border-[#4EABBE] transition">
                            Cerrar
                        </button>
                        <button type="button" data-submit class="px-6 py-2.5 rounded-xl bg-[#4EABBE] hover:bg-[#1D5D69] text-white font-semibold shadow-lg shadow-[#4EABBE]/30 transition">
                            Confirmar decision
                        </button>
                    </div>
                </div>
            `;

            const cleanup = (result) => {
                overlay.remove();
                resolve(result);
            };

            const radios = Array.from(overlay.querySelectorAll('input[name="cancel-policy"]'));
            const partialWrapper = overlay.querySelector('[data-partial-wrapper]');
            const partialAmountInput = overlay.querySelector('[data-partial-amount]');
            const reasonInput = overlay.querySelector('[data-reason]');
            const errorEl = overlay.querySelector('[data-error]');

            const setError = (message) => {
                if (!message) {
                    errorEl.textContent = '';
                    errorEl.classList.add('hidden');
                    return;
                }
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
            };

            const syncPolicyUi = () => {
                const selected = radios.find(item => item.checked)?.value || '';
                partialWrapper.classList.toggle('hidden', selected !== 'refund_partial');
                if (selected !== 'refund_partial') {
                    partialAmountInput.value = '';
                }
                setError('');
            };

            radios.forEach(radio => radio.addEventListener('change', syncPolicyUi));

            const defaultOption = partialEnabled ? 'refund_full' : 'keep_income';
            const defaultRadio = radios.find(item => item.value === defaultOption && !item.disabled) || radios.find(item => item.value === 'keep_income');
            if (defaultRadio) defaultRadio.checked = true;
            syncPolicyUi();

            overlay.querySelector('[data-cancel]').addEventListener('click', () => cleanup({ confirmed: false }));
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) cleanup({ confirmed: false });
            });

            overlay.querySelector('[data-submit]').addEventListener('click', () => {
                const policy = radios.find(item => item.checked)?.value || '';
                const reason = String(reasonInput.value || '').trim();
                const refundAmount = Number(partialAmountInput.value || 0);

                if (!policy) {
                    setError('Selecciona una opcion para continuar.');
                    return;
                }
                if (policy === 'do_not_cancel') {
                    cleanup({ confirmed: false, policy });
                    return;
                }
                if (!reason) {
                    setError('Debes indicar el motivo de cancelacion.');
                    return;
                }
                if (policy === 'refund_partial') {
                    if (!(refundAmount > 0)) {
                        setError('Ingresa un monto de devolucion parcial mayor a 0.');
                        return;
                    }
                    if (refundAmount - maxRefund > 0.009) {
                        setError(`La devolucion parcial no puede exceder ${formatCurrency(maxRefund)}.`);
                        return;
                    }
                }

                cleanup({
                    confirmed: true,
                    policy,
                    reason,
                    refundAmount: policy === 'refund_partial' ? refundAmount : null,
                });
            });

            document.body.appendChild(overlay);
            reasonInput.focus();
        });
    }

    return {
        prompt,
    };
})();
