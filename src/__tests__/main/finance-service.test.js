const {
    calculateDiscount,
    calculateTax,
    computePlanFinancials,
    buildInstallmentSchedule,
    applyAmountToInstallments,
    reverseAmountFromInstallments,
    buildPlanLifecycle,
} = require('../../main/finance-service');

describe('Finance Service Helpers', () => {
    test('calcula descuentos porcentuales correctamente', () => {
        expect(calculateDiscount(1000, 'porcentaje', 10)).toBe(100);
        expect(calculateDiscount(1000, 'porcentaje', 0)).toBe(0);
    });

    test('calcula el total final del plan con descuento fijo', () => {
        const totals = computePlanFinancials({
            costoBase: 1500,
            costoMedicina: 250,
            costoMiscelanea: 250,
            discountType: 'monto_fijo',
            discountValue: 200,
        });

        expect(totals.costo_total).toBe(2000);
        expect(totals.descuento_monto).toBe(200);
        expect(totals.total_final).toBe(1800);
    });

    test('calcula impuesto porcentual sobre subtotal neto', () => {
        expect(calculateTax(1000, 'porcentaje', 16)).toBe(160);
        const totals = computePlanFinancials({
            costoBase: 1000,
            costoMedicina: 0,
            costoMiscelanea: 0,
            discountType: 'porcentaje',
            discountValue: 10,
            taxType: 'porcentaje',
            taxValue: 16,
        });

        expect(totals.subtotal_neto).toBe(900);
        expect(totals.impuesto_monto).toBe(144);
        expect(totals.total_final).toBe(1044);
    });

    test('genera un anticipo y cuotas mensuales con interés', () => {
        const schedule = buildInstallmentSchedule({
            totalFinal: 1000,
            downPayment: 100,
            installmentCount: 3,
            frequency: 'mensual',
            interestPercent: 10,
            startDate: '2026-03-03',
            firstDueDate: '2026-04-03',
        });

        expect(schedule.cuotas).toHaveLength(4);
        expect(schedule.cuotas[0].es_anticipo).toBe(1);
        expect(schedule.cuotas[0].monto_programado).toBe(100);
        expect(schedule.totalFinanciadoBase).toBe(900);
        expect(schedule.totalFinanciadoConInteres).toBe(990);
        expect(schedule.cuotas[1].fecha_vencimiento).toBe('2026-04-03');
    });

    test('aplica un pago a múltiples cuotas en orden', () => {
        const result = applyAmountToInstallments([
            { id: 1, numero: 1, fecha_vencimiento: '2026-03-10', monto_programado: 200, monto_pagado: 0 },
            { id: 2, numero: 2, fecha_vencimiento: '2026-04-10', monto_programado: 200, monto_pagado: 50 },
        ], 260);

        expect(result.remaining).toBe(0);
        expect(result.allocations).toEqual([
            { cuotaId: 1, monto: 200 },
            { cuotaId: 2, monto: 60 },
        ]);
        expect(result.installments.find(item => item.id === 1).estado).toBe('pagada');
        expect(result.installments.find(item => item.id === 2).monto_pagado).toBe(110);
    });

    test('revierte devoluciones desde las últimas cuotas pagadas', () => {
        const result = reverseAmountFromInstallments([
            { id: 1, numero: 1, fecha_vencimiento: '2026-03-10', fecha_ultimo_pago: '2026-03-12 10:00:00', monto_programado: 200, monto_pagado: 200 },
            { id: 2, numero: 2, fecha_vencimiento: '2026-04-10', fecha_ultimo_pago: '2026-04-12 10:00:00', monto_programado: 200, monto_pagado: 150 },
        ], 120);

        expect(result.remaining).toBe(0);
        expect(result.allocations[0]).toEqual({ cuotaId: 2, monto: -120 });
        expect(result.installments.find(item => item.id === 2).monto_pagado).toBe(30);
        expect(result.installments.find(item => item.id === 2).estado).toBe('parcial');
    });
    test('marca terminado con saldo cuando el tratamiento esta al 100 por ciento clinico pero queda saldo pendiente', () => {
        const lifecycle = buildPlanLifecycle(
            {
                estado: 'en_progreso',
                progreso: 100,
                total_final: 1200,
            },
            [
                { id: 1, numero: 1, fecha_vencimiento: '2099-03-10', monto_programado: 600, monto_pagado: 600, estado: 'pagada' },
                { id: 2, numero: 2, fecha_vencimiento: '2099-04-10', monto_programado: 600, monto_pagado: 0, estado: 'pendiente' },
            ],
            600
        );

        expect(lifecycle.estado_clinico).toBe('completado');
        expect(lifecycle.estado_financiero).toBe('parcial');
        expect(lifecycle.estado_general).toBe('terminado_con_saldo');
        expect(lifecycle.puede_completarse).toBe(false);
        expect(lifecycle.puede_finalizar_clinicamente).toBe(false);
        expect(lifecycle.terminado_con_saldo).toBe(true);
        expect(lifecycle.bloqueo_completado_codigo).toBe('saldo_pendiente');
    });

    test('habilita completar solo cuando el avance clinico y el pago estan al 100 por ciento', () => {
        const lifecycle = buildPlanLifecycle(
            {
                estado: 'en_progreso',
                progreso: 100,
                total_final: 1200,
            },
            [
                { id: 1, numero: 1, fecha_vencimiento: '2099-03-10', monto_programado: 600, monto_pagado: 600, estado: 'pagada' },
                { id: 2, numero: 2, fecha_vencimiento: '2099-04-10', monto_programado: 600, monto_pagado: 600, estado: 'pagada' },
            ],
            1200
        );

        expect(lifecycle.progreso_clinico).toBe(100);
        expect(lifecycle.progreso_financiero).toBe(100);
        expect(lifecycle.estado_financiero).toBe('pagado');
        expect(lifecycle.puede_completarse).toBe(true);
        expect(lifecycle.listo_para_completar).toBe(true);
    });

    test('cancela el saldo operativo cuando el plan ya esta cancelado', () => {
        const lifecycle = buildPlanLifecycle(
            {
                estado: 'cancelado',
                progreso: 45,
                total_final: 1500,
            },
            [
                { id: 1, numero: 1, fecha_vencimiento: '2026-03-10', monto_programado: 500, monto_pagado: 300, estado: 'parcial', plan_estado: 'cancelado' },
                { id: 2, numero: 2, fecha_vencimiento: '2026-04-10', monto_programado: 1000, monto_pagado: 0, estado: 'pendiente', plan_estado: 'cancelado' },
            ],
            300
        );

        expect(lifecycle.estado_general).toBe('cancelado');
        expect(lifecycle.estado_financiero).toBe('cancelado');
        expect(lifecycle.saldo_pendiente).toBe(0);
        expect(lifecycle.cuotas[0].estado_visual).toBe('cancelada');
        expect(lifecycle.cuotas[0].saldo_pendiente).toBe(0);
    });
});
