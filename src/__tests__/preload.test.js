describe('preload legacy db api', () => {
  let exposeInMainWorld;
  let invoke;

  function loadExposedApi() {
    jest.resetModules();
    exposeInMainWorld = jest.fn();
    invoke = jest.fn();

    jest.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld,
      },
      ipcRenderer: {
        invoke,
        send: jest.fn(),
        on: jest.fn(),
      },
    }));

    require('../preload');

    const apiCall = exposeInMainWorld.mock.calls.find(([name]) => name === 'api');
    expect(apiCall).toBeTruthy();
    return apiCall[1];
  }

  afterEach(() => {
    jest.resetModules();
    jest.unmock('electron');
  });

  test('exposes db.all with promise-based invocation', async () => {
    const api = loadExposedApi();
    const rows = [{ id: 1, nombre: 'Ana' }];
    invoke.mockResolvedValueOnce(rows);

    await expect(api.db.all('SELECT id, nombre FROM pacientes')).resolves.toEqual(rows);
    expect(invoke).toHaveBeenCalledWith('db-all', 'SELECT id, nombre FROM pacientes', []);
  });

  test('supports callbacks for db.get and db.run', async () => {
    const api = loadExposedApi();
    const getCallback = jest.fn();
    const runCallback = jest.fn();
    const patientRow = { id: 7, nombre: 'Luis' };
    const runResult = { lastID: 11, changes: 1 };

    invoke
      .mockResolvedValueOnce(patientRow)
      .mockResolvedValueOnce(runResult);

    expect(api.db.get('SELECT id, nombre FROM pacientes WHERE id = ?', 7, getCallback)).toBeUndefined();
    expect(api.db.run('DELETE FROM citas WHERE id = ?', [11], runCallback)).toBeUndefined();

    await Promise.resolve();

    expect(invoke).toHaveBeenNthCalledWith(1, 'db-get', 'SELECT id, nombre FROM pacientes WHERE id = ?', [7]);
    expect(invoke).toHaveBeenNthCalledWith(2, 'db-run', 'DELETE FROM citas WHERE id = ?', [11]);
    expect(getCallback).toHaveBeenCalledWith(null, patientRow);
    expect(runCallback).toHaveBeenCalledWith(null, runResult);
  });

  test('exposes clinicConfig IPC helpers for settings and clinic identity', async () => {
    const api = loadExposedApi();
    const systemConfig = {
      settings: { theme: 'dark', firstDayWeek: '0' },
      clinicIdentity: { clinica_nombre: 'Clinica Central' },
    };

    invoke
      .mockResolvedValueOnce({ theme: 'light' })
      .mockResolvedValueOnce({ theme: 'dark' })
      .mockResolvedValueOnce({ clinica_nombre: 'Clinica Norte' })
      .mockResolvedValueOnce({ ok: true, clinicIdentity: { clinica_nombre: 'Clinica Sur' } })
      .mockResolvedValueOnce(systemConfig)
      .mockResolvedValueOnce(systemConfig);

    await expect(api.clinicConfig.getSettings()).resolves.toEqual({ theme: 'light' });
    await expect(api.clinicConfig.saveSettings({ theme: 'dark' })).resolves.toEqual({ theme: 'dark' });
    await expect(api.clinicConfig.getConfig()).resolves.toEqual({ clinica_nombre: 'Clinica Norte' });
    await expect(api.clinicConfig.saveConfig({ clinica_nombre: 'Clinica Sur' })).resolves.toEqual({
      ok: true,
      clinicIdentity: { clinica_nombre: 'Clinica Sur' },
    });
    await expect(api.clinicConfig.getSystemConfig()).resolves.toEqual(systemConfig);
    await expect(api.clinicConfig.saveSystemConfig(systemConfig)).resolves.toEqual(systemConfig);

    expect(invoke).toHaveBeenNthCalledWith(1, 'clinic-get-settings');
    expect(invoke).toHaveBeenNthCalledWith(2, 'clinic-save-settings', { theme: 'dark' });
    expect(invoke).toHaveBeenNthCalledWith(3, 'clinic-get-config');
    expect(invoke).toHaveBeenNthCalledWith(4, 'clinic-save-config', { clinica_nombre: 'Clinica Sur' });
    expect(invoke).toHaveBeenNthCalledWith(5, 'clinic-get-system-config');
    expect(invoke).toHaveBeenNthCalledWith(6, 'clinic-save-system-config', systemConfig);
  });
});
