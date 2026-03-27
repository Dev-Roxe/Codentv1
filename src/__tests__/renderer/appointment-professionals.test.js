const {
  buildProfessionalLabel,
  filterAssignableProfessionals,
  getDisplayName,
  isClinicalRole,
  isIgnoredRole,
} = require('../../renderer/scripts/appointment-professionals');

describe('appointment professional helpers', () => {
  test('recognizes clinical and ignored roles correctly', () => {
    expect(isClinicalRole('Dentista')).toBe(true);
    expect(isClinicalRole('Especialista')).toBe(true);
    expect(isClinicalRole('Recepcionista')).toBe(false);
    expect(isIgnoredRole('admin')).toBe(true);
  });

  test('returns only clinical professionals when there are no referenced appointments', () => {
    const users = [
      { id: 1, nombre: 'Ana', apellido: 'Ruiz', rol: 'recepcionista' },
      { id: 2, nombre: 'Luis', apellido: 'Soto', rol: 'dentista' },
      { id: 3, nombre: 'Mario', apellido: 'Lopez', rol: 'administrador' },
    ];

    const result = filterAssignableProfessionals(users);

    expect(result).toEqual([
      { id: 2, nombre: 'Luis', apellido: 'Soto', rol: 'dentista' },
    ]);
  });

  test('keeps referenced professionals available even if their current role is no longer clinical', () => {
    const users = [
      { id: 4, nombre: 'Marta', apellido: 'Vega', rol: 'recepcionista' },
      { id: 6, nombre: 'Nora', apellido: 'Diaz', rol: 'especialista' },
    ];

    const result = filterAssignableProfessionals(users, { referencedIds: [4] });

    expect(result).toEqual([
      { id: 4, nombre: 'Marta', apellido: 'Vega', rol: 'recepcionista' },
      { id: 6, nombre: 'Nora', apellido: 'Diaz', rol: 'especialista' },
    ]);
  });

  test('builds the expected label for appointment dropdowns', () => {
    expect(getDisplayName({ id: 5, nombre: 'Julia', apellido: 'Campos' })).toBe('Julia Campos');
    expect(buildProfessionalLabel({ id: 7, nombre: 'Leo', apellido: 'Mora', rol: 'especialista' })).toBe('Esp. Leo Mora');
    expect(buildProfessionalLabel({ id: 8, nombre: 'Rosa', apellido: 'Paz', rol: 'dentista' })).toBe('Dr(a). Rosa Paz');
  });
});
