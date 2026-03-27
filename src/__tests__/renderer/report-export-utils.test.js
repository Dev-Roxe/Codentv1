const {
  buildColumnsFromRows,
  normalizarMonto,
  normalizarTexto,
} = require('../../renderer/scripts/report-export-utils');

describe('report export utils', () => {
  test('normalizes text without stripping key separators', () => {
    expect(normalizarTexto('Gestión #1 / Débito: José Núñez')).toBe('Gestion #1 / Debito: Jose Nunez');
  });

  test('normalizes currency strings into numbers', () => {
    expect(normalizarMonto('$1,234.50')).toBe(1234.5);
    expect(normalizarMonto('1.234,50')).toBe(1234.5);
    expect(normalizarMonto('1234,50')).toBe(1234.5);
    expect(normalizarMonto('  -45.20 ')).toBe(-45.2);
    expect(normalizarMonto(null)).toBe(0);
  });

  test('builds export columns with inferred types and widths', () => {
    const columns = buildColumnsFromRows([
      { Fecha: '2026-03-14', Debe: 1200.5, Concepto: 'Pago inicial' },
      { Fecha: '2026-03-15', Debe: 300, Concepto: 'Abono' },
    ]);

    expect(columns.map(column => column.key)).toEqual(['Fecha', 'Debe', 'Concepto']);
    expect(columns.find(column => column.key === 'Debe').type).toBe('number');
    expect(columns.find(column => column.key === 'Concepto').width).toBeGreaterThanOrEqual(10);
  });
});
