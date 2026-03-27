const {
    DEFAULT_MIN_WIDTH,
    DEFAULT_MIN_HEIGHT,
    computeDefaultBounds,
    resolveInitialWindowState,
    serializeWindowState,
} = require('../../main/window-state');

describe('window-state helpers', () => {
    const workArea = { x: 0, y: 0, width: 1600, height: 900 };

    test('usa maximizacion por defecto cuando no hay estado guardado', () => {
        const state = resolveInitialWindowState({ workArea });

        expect(state.maximize).toBe(true);
        expect(state.bounds.width).toBeGreaterThanOrEqual(DEFAULT_MIN_WIDTH);
        expect(state.bounds.height).toBeGreaterThanOrEqual(DEFAULT_MIN_HEIGHT);
    });

    test('respeta bounds guardados validos cuando el usuario no estaba maximizado', () => {
        const state = resolveInitialWindowState({
            workArea,
            savedState: {
                isMaximized: false,
                bounds: { x: 120, y: 80, width: 1280, height: 820 },
            },
        });

        expect(state.maximize).toBe(false);
        expect(state.bounds).toEqual({ x: 120, y: 80, width: 1280, height: 820 });
    });

    test('descarta bounds invalidos y vuelve a un estado grande por defecto', () => {
        const state = resolveInitialWindowState({
            workArea,
            savedState: {
                isMaximized: false,
                bounds: { x: 5000, y: 5000, width: 320, height: 240 },
            },
        });

        expect(state.maximize).toBe(false);
        expect(state.bounds).toEqual(computeDefaultBounds(workArea));
    });

    test('serializa bounds normales y bandera de maximizado', () => {
        const serialized = serializeWindowState({
            bounds: { x: 20, y: 30, width: 1400, height: 820 },
            isMaximized: true,
        });

        expect(serialized.bounds).toEqual({ x: 20, y: 30, width: 1400, height: 820 });
        expect(serialized.isMaximized).toBe(true);
        expect(serialized.savedAt).toEqual(expect.any(String));
    });
});
