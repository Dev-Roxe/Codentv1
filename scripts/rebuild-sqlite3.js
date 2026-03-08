const { spawnSync } = require('child_process');
const fs = require('fs');

function resolvePython311() {
  const envPython = process.env.PYTHON;
  if (envPython && fs.existsSync(envPython)) {
    return envPython;
  }

  if (process.platform === 'win32') {
    const probe = spawnSync('py', ['-3.11', '-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf8',
    });

    if (probe.status === 0) {
      const candidate = String(probe.stdout || '').trim();
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

const env = { ...process.env };
const python311 = resolvePython311();

if (python311) {
  env.PYTHON = python311;
  console.log(`[rebuild:sqlite3] Usando PYTHON=${python311}`);
} else {
  console.warn('[rebuild:sqlite3] No se detecto Python 3.11. Si falla la compilacion, instala Python 3.11 y reintenta.');
}

const result = spawnSync(
  'npx',
  ['electron-rebuild', '-f', '-w', 'sqlite3'],
  {
    stdio: 'inherit',
    env,
    shell: true,
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
