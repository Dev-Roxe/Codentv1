// cajas.js - Gestión de cajas registradoras
import '../components/navbar-component.js';
import { initNavbarListeners, getUserName } from './navigation.js';

let currentTab = 'abiertas';
let cajas = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar navbar
  const navbar = document.querySelector('app-navbar');
  if (navbar) navbar.setAttribute('user-name', getUserName());

  initNavbarListeners({
    onSearch: (query) => {
      console.log('Buscando:', query);
      filterCajas(query);
    },
    onSearchSubmit: (query) => {
      console.log('Búsqueda:', query);
    },
    onLogout: () => {
      if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.clear();
        window.location.href = '../login.html';
      }
    }
  });

  // Cargar cajas
  await loadCajas();

  // Event listeners para tabs
  document.querySelectorAll('.tab-button').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Event listener para búsqueda local
  const searchInput = document.getElementById('searchCaja');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filterCajas(e.target.value);
      }, 300);
    });
  }

  // Event listener para abrir caja
  const btnAbrirCaja = document.getElementById('btnAbrirCaja');
  if (btnAbrirCaja) {
    btnAbrirCaja.addEventListener('click', showAbrirCajaModal);
  }

  // Renderizar tab inicial
  renderCurrentTab();
});

// Cargar cajas desde la base de datos
async function loadCajas() {
  try {
    // Simulación - en producción esto vendría de la BD
    const sql = `
      SELECT 
        c.*,
        u.nombre || ' ' || u.apellido as usuario_nombre,
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja WHERE caja_id = c.id) as total_movimientos
      FROM cajas c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.fecha_apertura DESC
    `;

    // Temporal: datos de ejemplo
    cajas = [
      {
        id: 1,
        usuario_nombre: 'EVA MARITZA SOSA TAPIA',
        fecha_apertura: '2024-05-30T08:00:00',
        fecha_cierre: null,
        saldo_inicial: 0,
        saldo_final: null,
        estado: 'abierta',
        total_movimientos: 111200,
        notas: 'Caja principal recepción'
      },
      {
        id: 2,
        usuario_nombre: 'JUAN CARLOS PÉREZ',
        fecha_apertura: '2024-05-29T08:00:00',
        fecha_cierre: '2024-05-29T18:00:00',
        saldo_inicial: 500,
        saldo_final: 45300,
        estado: 'cerrada',
        total_movimientos: 44800,
        notas: null
      },
      {
        id: 3,
        usuario_nombre: 'MARIA FERNANDA GOMEZ',
        fecha_apertura: '2024-05-30T09:00:00',
        fecha_cierre: null,
        saldo_inicial: 1000,
        saldo_final: null,
        estado: 'abierta',
        total_movimientos: 23400,
        notas: 'Caja 2 - Área administrativa'
      }
    ];

    updateStats();
  } catch (error) {
    console.error('Error cargando cajas:', error);
    cajas = [];
  }
}

// Actualizar estadísticas
function updateStats() {
  const cajasAbiertas = cajas.filter(c => c.estado === 'abierta').length;
  const totalDia = cajas
    .filter(c => c.estado === 'abierta')
    .reduce((sum, c) => sum + (c.saldo_inicial + c.total_movimientos), 0);

  const statCajasAbiertas = document.getElementById('statCajasAbiertas');
  const statTotalDia = document.getElementById('statTotalDia');

  if (statCajasAbiertas) statCajasAbiertas.textContent = cajasAbiertas;
  if (statTotalDia) statTotalDia.textContent = formatCurrency(totalDia);
}

// Cambiar de tab
function switchTab(tabName) {
  currentTab = tabName;

  // Actualizar clases de botones
  document.querySelectorAll('.tab-button').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  renderCurrentTab();
}

// Renderizar tab actual
function renderCurrentTab() {
  const container = document.getElementById('tabContent');
  if (!container) return;

  let filteredCajas = [];

  switch (currentTab) {
    case 'abiertas':
      filteredCajas = cajas.filter(c => c.estado === 'abierta');
      break;
    case 'cerradas':
      filteredCajas = cajas.filter(c => c.estado === 'cerrada');
      break;
    case 'mi-caja':
      // En producción, filtrar por usuario actual
      const currentUser = getUserName();
      filteredCajas = cajas.filter(c =>
        c.usuario_nombre.includes(currentUser) && c.estado === 'abierta'
      );
      break;
  }

  if (filteredCajas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <svg class="w-20 h-20 mx-auto text-[#D9D9D9] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p class="text-[#0F2532]/60 text-lg font-medium">No hay cajas ${currentTab === 'abiertas' ? 'abiertas' : currentTab === 'cerradas' ? 'cerradas' : 'asignadas'}</p>
        <p class="text-[#0F2532]/40 text-sm mt-2">
          ${currentTab === 'abiertas' ? 'Haz clic en "Abrir Caja" para comenzar' : 'No se encontraron registros'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white">
          <tr>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Usuario</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Apertura</th>
            ${currentTab === 'cerradas' ? '<th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Cierre</th>' : ''}
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Saldo Inicial</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Movimientos</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Total Acumulado</th>
            <th class="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Estado</th>
            <th class="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-[#E6E6E6]">
          ${filteredCajas.map(caja => renderCajaRow(caja)).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Adjuntar event listeners
  attachRowEventListeners();
}

// Renderizar fila de caja
function renderCajaRow(caja) {
  const totalAcumulado = caja.saldo_inicial + caja.total_movimientos;
  const fechaApertura = new Date(caja.fecha_apertura).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let fechaCierre = '';
  if (caja.fecha_cierre) {
    fechaCierre = new Date(caja.fecha_cierre).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return `
    <tr class="caja-card hover:bg-[#F8F7F7] transition" data-caja-id="${caja.id}">
      <td class="px-6 py-4">
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] flex items-center justify-center text-white font-bold mr-3">
            ${caja.usuario_nombre.charAt(0)}
          </div>
          <div>
            <div class="font-semibold text-[#0F2532]">${caja.usuario_nombre}</div>
            ${caja.notas ? `<div class="text-xs text-[#0F2532]/60">${caja.notas}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-sm text-[#0F2532]/80">${fechaApertura}</td>
      ${currentTab === 'cerradas' ? `<td class="px-6 py-4 text-sm text-[#0F2532]/80">${fechaCierre}</td>` : ''}
      <td class="px-6 py-4 text-sm font-medium text-[#0F2532]">${formatCurrency(caja.saldo_inicial)}</td>
      <td class="px-6 py-4 text-sm font-medium ${caja.total_movimientos > 0 ? 'text-green-600' : 'text-[#0F2532]/60'}">${formatCurrency(caja.total_movimientos)}</td>
      <td class="px-6 py-4 text-lg font-bold text-[#1D5D69]">${formatCurrency(totalAcumulado)}</td>
      <td class="px-6 py-4">
        <span class="status-badge ${caja.estado === 'abierta' ? 'status-open' : 'status-closed'}">
          ${caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </span>
      </td>
      <td class="px-6 py-4 text-center">
        <button 
          class="btn-ver-detalle inline-flex items-center px-4 py-2 bg-[#4EABBE] text-white rounded-lg hover:bg-[#1D5D69] transition font-medium text-sm"
          data-caja-id="${caja.id}"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          Ver Detalle
        </button>
        ${caja.estado === 'abierta' ? `
          <button 
            class="btn-cerrar-caja ml-2 inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm"
            data-caja-id="${caja.id}"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            Cerrar Caja
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

// Adjuntar event listeners a las filas
function attachRowEventListeners() {
  // Ver detalle
  document.querySelectorAll('.btn-ver-detalle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cajaId = btn.getAttribute('data-caja-id');
      showDetalleCaja(cajaId);
    });
  });

  // Cerrar caja
  document.querySelectorAll('.btn-cerrar-caja').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cajaId = btn.getAttribute('data-caja-id');
      showCerrarCajaModal(cajaId);
    });
  });
}

// Filtrar cajas por búsqueda
function filterCajas(query) {
  if (!query || query.trim() === '') {
    renderCurrentTab();
    return;
  }

  const searchLower = query.toLowerCase();
  const filtered = cajas.filter(c =>
    c.usuario_nombre.toLowerCase().includes(searchLower) ||
    (c.notas && c.notas.toLowerCase().includes(searchLower))
  );

  // Renderizar filtrados (simplificado por ahora)
  console.log('Cajas filtradas:', filtered);
  renderCurrentTab();
}

// Modal para abrir caja
function showAbrirCajaModal() {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-in">
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Abrir Nueva Caja</h3>
        <p class="text-white/80 text-sm mt-1">Registra la apertura de caja</p>
      </div>
      <form id="formAbrirCaja" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] mb-2">Saldo Inicial *</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-[#0F2532]/60 font-medium">$</span>
            <input 
              type="number" 
              id="saldoInicial" 
              required 
              min="0"
              step="0.01"
              placeholder="0.00"
              class="w-full pl-8 pr-4 py-3 border border-[#D9D9D9] rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] mb-2">Notas (opcional)</label>
          <textarea 
            id="notasCaja" 
            rows="3"
            placeholder="Ej: Caja principal, Caja 2..."
            class="w-full px-4 py-3 border border-[#D9D9D9] rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition"
          ></textarea>
        </div>
        <div class="flex gap-3 pt-4">
          <button 
            type="button" 
            id="btnCancelarAbrir" 
            class="flex-1 py-3 border-2 border-[#D9D9D9] rounded-xl hover:bg-[#F8F7F7] font-semibold text-[#0F2532] transition"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            class="flex-1 py-3 bg-gradient-to-r from-[#4EABBE] to-[#1D5D69] text-white rounded-xl hover:shadow-lg font-semibold transition"
          >
            Abrir Caja
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.querySelector('#btnCancelarAbrir').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#formAbrirCaja').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saldoInicial = parseFloat(document.getElementById('saldoInicial').value);
    const notas = document.getElementById('notasCaja').value.trim();

    try {
      // En producción: guardar en BD
      console.log('Abriendo caja:', { saldoInicial, notas });

      // Simulación: agregar nueva caja
      const nuevaCaja = {
        id: cajas.length + 1,
        usuario_nombre: getUserName(),
        fecha_apertura: new Date().toISOString(),
        fecha_cierre: null,
        saldo_inicial: saldoInicial,
        saldo_final: null,
        estado: 'abierta',
        total_movimientos: 0,
        notas: notas || null
      };

      cajas.unshift(nuevaCaja);
      updateStats();
      renderCurrentTab();

      overlay.remove();

      // Notificación de éxito
      showNotification('Caja abierta exitosamente', 'success');
    } catch (error) {
      console.error('Error abriendo caja:', error);
      showNotification('Error al abrir la caja', 'error');
    }
  });
}

// Modal para cerrar caja
function showCerrarCajaModal(cajaId) {
  const caja = cajas.find(c => c.id == cajaId);
  if (!caja) return;

  const totalAcumulado = caja.saldo_inicial + caja.total_movimientos;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-in">
      <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Cerrar Caja</h3>
        <p class="text-white/80 text-sm mt-1">${caja.usuario_nombre}</p>
      </div>
      <div class="p-6 space-y-4">
        <div class="bg-gradient-to-br from-[#4EABBE]/10 to-[#1D5D69]/10 p-4 rounded-xl">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[#0F2532]/60 text-sm">Saldo Inicial</span>
            <span class="font-bold text-[#0F2532]">${formatCurrency(caja.saldo_inicial)}</span>
          </div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-[#0F2532]/60 text-sm">Movimientos</span>
            <span class="font-bold text-green-600">${formatCurrency(caja.total_movimientos)}</span>
          </div>
          <div class="border-t border-[#0F2532]/20 pt-2 mt-2">
            <div class="flex justify-between items-center">
              <span class="text-[#0F2532] font-semibold">Total Esperado</span>
              <span class="font-bold text-2xl text-[#1D5D69]">${formatCurrency(totalAcumulado)}</span>
            </div>
          </div>
        </div>
        
        <form id="formCerrarCaja" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-[#0F2532] mb-2">Saldo Final (conteo real) *</label>
            <div class="relative">
              <span class="absolute left-4 top-3 text-[#0F2532]/60 font-medium">$</span>
              <input 
                type="number" 
                id="saldoFinal" 
                required 
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-4 py-3 border border-[#D9D9D9] rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
              />
            </div>
            <p class="text-xs text-[#0F2532]/50 mt-1">Ingresa el monto real contado en la caja</p>
          </div>
          
          <div class="flex gap-3 pt-2">
            <button 
              type="button" 
              id="btnCancelarCerrar" 
              class="flex-1 py-3 border-2 border-[#D9D9D9] rounded-xl hover:bg-[#F8F7F7] font-semibold text-[#0F2532] transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              class="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg font-semibold transition"
            >
              Cerrar Caja
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.querySelector('#btnCancelarCerrar').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#formCerrarCaja').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saldoFinal = parseFloat(document.getElementById('saldoFinal').value);
    const diferencia = saldoFinal - totalAcumulado;

    if (Math.abs(diferencia) > 0.01) {
      const confirmClose = confirm(
        `Hay una diferencia de ${formatCurrency(Math.abs(diferencia))} ${diferencia > 0 ? 'a favor' : 'en contra'}.\n\n¿Deseas cerrar la caja de todas formas?`
      );
      if (!confirmClose) return;
    }

    try {
      // En producción: actualizar en BD
      caja.estado = 'cerrada';
      caja.fecha_cierre = new Date().toISOString();
      caja.saldo_final = saldoFinal;

      updateStats();
      renderCurrentTab();
      overlay.remove();

      showNotification('Caja cerrada exitosamente', 'success');
    } catch (error) {
      console.error('Error cerrando caja:', error);
      showNotification('Error al cerrar la caja', 'error');
    }
  });
}

// Ver detalle de caja
function showDetalleCaja(cajaId) {
  const caja = cajas.find(c => c.id == cajaId);
  if (!caja) return;

  // Por ahora solo navegamos a una página de detalle o mostramos un modal simple
  console.log('Ver detalle de caja:', caja);
  showNotification('Funcionalidad de detalle en desarrollo', 'info');
}

// Notificación toast
function showNotification(message, type = 'info') {
  const colors = {
    success: 'from-green-500 to-green-600',
    error: 'from-red-500 to-red-600',
    info: 'from-[#4EABBE] to-[#1D5D69]'
  };

  const toast = document.createElement('div');
  toast.className = `fixed top-6 right-6 bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] animate-slide-in`;
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      <span class="font-medium">${message}</span>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Formatear moneda
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}
