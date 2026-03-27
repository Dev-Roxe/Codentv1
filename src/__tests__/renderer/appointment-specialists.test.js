const {
  buildSpecialistLabel,
  buildSpecialistOptionsHtml,
  isActiveSpecialist,
  loadRegisteredSpecialists,
} = require('../../renderer/scripts/appointment-specialists');

describe('appointment specialist helpers', () => {
  test('loads every specialist registered in the database', async () => {
    const rows = [
      { id: 3, nombre: 'Dra. Ruiz', especialidad: 'Ortodoncia', activo: 1 },
      { id: 7, nombre: 'Dr. Soto', especialidad: 'Endodoncia', activo: 0 },
    ];
    const db = {
      all: jest.fn().mockResolvedValue(rows),
    };

    const result = await loadRegisteredSpecialists(db);

    expect(result).toEqual(rows);
    expect(db.all).toHaveBeenCalledTimes(1);
    expect(db.all.mock.calls[0][0]).toContain('FROM especialistas');
  });

  test('builds option labels with inactive state when needed', () => {
    expect(buildSpecialistLabel({ id: 2, nombre: 'Dra. Vega', especialidad: 'Periodoncia', activo: 1 }))
      .toBe('Dra. Vega - Periodoncia');
    expect(buildSpecialistLabel(
      { id: 4, nombre: 'Dr. Luna', especialidad: 'Cirugia', activo: 0 },
      { includeStatus: true }
    )).toBe('Dr. Luna - Cirugia (inactivo)');
    expect(isActiveSpecialist({ activo: 0 })).toBe(false);
  });

  test('keeps the selected specialist and escapes labels safely', () => {
    const html = buildSpecialistOptionsHtml([
      { id: 5, nombre: 'Dra. <Ana>', especialidad: 'Odontopediatria', activo: 1 },
      { id: 8, nombre: 'Dr. Mora', especialidad: 'Implantes', activo: 0 },
    ], { selectedValue: 8 });

    expect(html).toContain('Sin asignar');
    expect(html).toContain('value="8" selected');
    expect(html).toContain('Dra. &lt;Ana&gt; - Odontopediatria');
    expect(html).toContain('Dr. Mora - Implantes (inactivo)');
  });

  test('adds a fallback option when the current specialist no longer exists', () => {
    const html = buildSpecialistOptionsHtml([], { selectedValue: 99 });

    expect(html).toContain('Especialista 99 (no disponible)');
    expect(html).toContain('value="99" selected');
  });
});
