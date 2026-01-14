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
    'antecedentes': 'antecedentes.html',
    'tratamientos': 'tratamientos.html',
    'recetas': 'recetas.html',
    'odontograma': 'odontograma.html',
    'periodontograma': 'periodontograma.html',
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
    // Si el iframe no tiene src configurado, configúralo
    if (!frame.src || frame.src === window.location.href) {
      const file = frameMapping[name] || 'datos.html';
      frame.src = file;
    }
    
    frame.classList.remove('hidden');
    
    // Si aún no se ha asignado el ID de paciente, añádelo al src
    if (currentPaciente && frame.dataset.loaded !== 'true') {
      const url = new URL(frame.src, window.location.href);
      url.searchParams.set('id', currentPaciente.id);
      frame.src = url.toString();
      frame.dataset.loaded = 'true';
    }
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

async function loadHistorialServicios(pacienteId) {
  try {
    // Cargar historial desde la tabla tratamientos
    const rows = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND diente IS NOT NULL ORDER BY fecha DESC LIMIT 10', [pacienteId]);
    const tbody = document.getElementById('historial-servicios');
    if (!tbody) return;
    
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-3 text-center text-[#1D5D69] dark:text-slate-400">No hay servicios registrados</td></tr>';
      return;
    }
    
    tbody.innerHTML = rows.map(row => {
      const fecha = row.fecha ? new Date(row.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
      // Extraer caras de las notas
      let caras = '—';
      if (row.notas && row.notas.includes('Caras:')) {
        caras = row.notas.split('Caras:')[1]?.trim() || '—';
      }
      return `
        <tr class="border-b border-[#8BCFDD]/20 dark:border-slate-700 hover:bg-[#8BCFDD]/10">
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300">${fecha}</td>
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300">${row.procedimiento || 'N/A'}</td>
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300">${row.diente || '—'}</td>
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300">${caras}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('Error cargando historial:', e);
    const tbody = document.getElementById('historial-servicios');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-3 text-center text-[#1D5D69] dark:text-slate-400">Error al cargar historial</td></tr>';
    }
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
  
  // Carga el historial de servicios
  await loadHistorialServicios(currentPaciente.id);
  
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

// Escuchar mensajes de los iframes (por ejemplo, cuando se guarda un tratamiento)
window.addEventListener('message', async (e) => {
  if (e.data && e.data.type === 'tratamiento-guardado') {
    // Recargar historial de servicios
    if (currentPaciente && currentPaciente.id) {
      await loadHistorialServicios(currentPaciente.id);
    }
  }
});
