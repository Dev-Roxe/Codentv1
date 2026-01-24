// ficha_clinica.js
// Controla la navegacion entre pestanas y actualiza el encabezado.
// Cada pestana se carga en un iframe separado para aislar su HTML y logica.

// --- DB helpers (copiados del script original) ---
let db = (window.api && window.api.db) ? window.api.db : null;

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve(null);
      if (db.get.length >= 3) {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      } else {
        db.get(sql, params).then(row => resolve(row)).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve([]);
      if (db.all && db.all.length >= 3) {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else if (db.all) {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      } else {
        // Fallback: usar db.get si db.all no está disponible
        dbGet(sql, params).then(row => resolve(row ? [row] : [])).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function respondDbMessage(event, type, requestId, payload) {
  const message = { type: `${type}-response`, requestId, ...payload };
  if (event && event.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage(message, '*');
    return;
  }
  for (let i = 0; i < window.frames.length; i += 1) {
    try {
      window.frames[i].postMessage(message, '*');
    } catch (e) {
      // Ignore cross-origin or inaccessible frames.
    }
  }
}

function handleDbMessage(event) {
  const data = event && event.data;
  if (!data || typeof data !== 'object') return;
  const { type, requestId, sql, params } = data;
  if (!type || !requestId) return;
  if (type !== 'db-all' && type !== 'db-get' && type !== 'db-run') return;
  if (!db) return respondDbMessage(event, type, requestId, { error: 'DB no disponible' });

  try {
    if (type === 'db-all') {
      db.all(sql, params || [], (err, rows) => {
        if (err) return respondDbMessage(event, type, requestId, { error: err.message });
        respondDbMessage(event, type, requestId, { result: rows || [] });
      });
      return;
    }
    if (type === 'db-get') {
      db.get(sql, params || [], (err, row) => {
        if (err) return respondDbMessage(event, type, requestId, { error: err.message });
        respondDbMessage(event, type, requestId, { result: row || null });
      });
      return;
    }
    if (type === 'db-run') {
      db.run(sql, params || [], (err, res) => {
        if (err) return respondDbMessage(event, type, requestId, { error: err.message });
        respondDbMessage(event, type, requestId, { result: res || null });
      });
    }
  } catch (e) {
    respondDbMessage(event, type, requestId, { error: e.message || String(e) });
  }
}

window.addEventListener('message', handleDbMessage);

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

let currentPaciente = null;

async function loadPaciente(id) {
  try {
    const row = await dbGet('SELECT * FROM pacientes WHERE id = ?', [id]);
    return row || null;
  } catch (e) {
    console.error('loadPaciente error', e);
    return null;
  }
}

function switchFrame(name) {
  // Mapeo de tabs a archivos (algunos pueden no existir aún)
  const frameMapping = {
    'datos': 'datos.html',
    'historial': 'historial_tratamientos.html',
    'antecedentes': 'antecedentes.html',
    'tratamientos': 'tratamientos.html',
    'recetas': 'recetas.html',
    'odontograma': 'odontograma.html',
    'periodontograma': 'periodontograma.html',
    'pagos': 'pagos.html',
    'galeria': 'datos.html', // Temporal: usar datos hasta que exista
    'contactos': 'datos.html', // Temporal: usar datos hasta que exista
    'diagnostico': 'antecedentes.html', // Temporal: usar antecedentes hasta que exista
    'documentos': 'tratamientos.html', // Temporal: usar tratamientos hasta que exista
    'agenda': 'agenda.html'
  };

  // Oculta todos los iframes
  document.querySelectorAll('.tab-frame').forEach(frame => frame.classList.add('hidden'));

  // Muestra el iframe correspondiente
  const frame = document.getElementById(`frame-${name}`);
  if (frame) {
    // Si el iframe no tiene src configurado o no se ha cargado, configúralo
    if (!frame.dataset.loaded || frame.dataset.loaded !== 'true') {
      const file = frameMapping[name] || 'datos.html';
      const url = new URL(file, window.location.href);

      // Agregar el ID del paciente si está disponible
      if (currentPaciente) {
        url.searchParams.set('paciente_id', currentPaciente.id);
      }

      frame.src = url.toString();
      frame.dataset.loaded = 'true';

      console.log(`Loading iframe ${name} with URL:`, frame.src);
    }

    frame.classList.remove('hidden');
  }

  // Actualiza estilos de botones (tanto en nav como en aside)
  const activeClasses = [
    'text-white',
    'bg-[#4EABBE]',
    'border-[#4EABBE]',
    'shadow-lg',
    'shadow-[#4EABBE]/40',
    'font-semibold'
  ];
  const inactiveClasses = [
    'text-[#0F2532]',
    'dark:text-slate-200',
    'hover:bg-[#8BCFDD]/25',
    'dark:hover:bg-slate-800'
  ];
  document.querySelectorAll('nav .tab-btn, aside .tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === name;
    if (isActive) {
      btn.classList.add(...activeClasses);
      btn.classList.remove(...inactiveClasses);
    } else {
      btn.classList.remove(...activeClasses);
      btn.classList.add(...inactiveClasses);
    }
  });
}

function calculateAge(fechaNacimiento) {
  if (!fechaNacimiento) return 'N/A';
  try {
    const birth = new Date(fechaNacimiento);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} años ${months} mes${months !== 1 ? 'es' : ''}`;
  } catch (e) {
    return 'N/A';
  }
}

async function init() {
  const id = getQueryParam('id');
  if (!id) {
    alert('ID de paciente no especificado');
    return;
  }
  currentPaciente = await loadPaciente(id);
  if (!currentPaciente) {
    alert('Paciente no encontrado');
    return;
  }

  // Actualiza encabezado superior
  const headerNombre = document.getElementById('header-nombre');
  if (headerNombre) {
    headerNombre.textContent = 'Información del Paciente';
  }

  // Actualiza sidebar
  const sidebarNombre = document.getElementById('sidebar-nombre');
  const sidebarId = document.getElementById('sidebar-id');
  const sidebarEdad = document.getElementById('sidebar-edad');

  if (sidebarNombre) {
    sidebarNombre.textContent = `${currentPaciente.nombre || ''} ${currentPaciente.apellido || ''}`.trim() || 'Paciente';
  }
  if (sidebarId) {
    sidebarId.textContent = currentPaciente.id || 'ID';
  }
  if (sidebarEdad) {
    const edad = calculateAge(currentPaciente.fecha_nacimiento);
    sidebarEdad.textContent = edad;
  }

  // Boton regresar
  const backBtn = document.getElementById('btn-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'pacientes.html';
    });
  }

  // Configura navegacion
  document.querySelectorAll('nav .tab-btn, aside .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchFrame(btn.dataset.tab));
  });

  // Carga la primera pestana
  switchFrame('datos');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for theme changes to reload iframes
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    console.log('Theme changed to:', e.newValue);
    // Reload all iframes to apply new theme
    document.querySelectorAll('.tab-frame').forEach(frame => {
      if (frame.src && frame.dataset.loaded === 'true') {
        frame.contentWindow.location.reload();
      }
    });
  }
});

// Also listen for custom theme change event (for same-window changes)
window.addEventListener('themeChanged', () => {
  console.log('Theme changed (custom event)');
  document.querySelectorAll('.tab-frame').forEach(frame => {
    if (frame.src && frame.dataset.loaded === 'true') {
      frame.contentWindow.location.reload();
    }
  });
});
