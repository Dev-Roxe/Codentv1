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

  // Datos de ejemplo de movimientos
  const movimientos = [
    { id: 1, tipo: 'ingreso', monto: 50000, concepto: 'Pago paciente consulta', fecha: '2024-05-30T10:30:00', usuario: 'Eva Maritza' },
    { id: 2, tipo: 'ingreso', monto: 35200, concepto: 'Pago tratamiento ortodoncia', fecha: '2024-05-30T11:15:00', usuario: 'Eva Maritza' },
    { id: 3, tipo: 'egreso', monto: -5000, concepto: 'Compra material dental', fecha: '2024-05-30T12:00:00', usuario: 'Eva Maritza' },
    { id: 4, tipo: 'ingreso', monto: 28000, concepto: 'Pago limpieza dental', fecha: '2024-05-30T14:30:00', usuario: 'Eva Maritza' },
    { id: 5, tipo: 'ingreso', monto: 3000, concepto: 'Pago consulta', fecha: '2024-05-30T15:45:00', usuario: 'Eva Maritza' }
  ];

  const totalAcumulado = caja.saldo_inicial + caja.total_movimientos;
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0);
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + Math.abs(m.monto), 0);

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fade-in';
  overlay.innerHTML = `
    <div class="glass-card w-full max-w-5xl mx-4 rounded-2xl shadow-2xl animate-slide-in overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-3xl font-bold">Detalle de Caja #${caja.id}</h3>
            <p class="text-white/80 text-sm mt-1">${caja.usuario_nombre}</p>
          </div>
          <button id="btnCloseDetail" class="text-white/80 hover:text-white transition p-2 rounded-lg hover:bg-white/10">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 max-h-[70vh] overflow-y-auto dark:bg-gray-800">
        <!-- Resumen financiero -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Saldo Inicial</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(caja.saldo_inicial)}</p>
          </div>
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Ingresos</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(totalIngresos)}</p>
          </div>
          <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Egresos</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(totalEgresos)}</p>
          </div>
          <div class="bg-gradient-to-br from-[#1D5D69] to-[#4EABBE] rounded-xl p-4 text-white">
            <p class="text-sm opacity-90">Total Acumulado</p>
            <p class="text-2xl font-bold mt-1">${formatCurrency(totalAcumulado)}</p>
          </div>
        </div>

        <!-- Información de la caja -->
        <div class="bg-white dark:bg-gray-700 rounded-xl p-4 mb-6">
          <h4 class="font-bold text-lg text-[#0F2532] dark:text-white mb-3">Información</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Fecha de apertura</p>
              <p class="font-medium text-[#0F2532] dark:text-white">${new Date(caja.fecha_apertura).toLocaleString('es-ES')}</p>
            </div>
            ${caja.fecha_cierre ? `
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Fecha de cierre</p>
              <p class="font-medium text-[#0F2532] dark:text-white">${new Date(caja.fecha_cierre).toLocaleString('es-ES')}</p>
            </div>
            ` : ''}
            <div>
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Estado</p>
              <span class="status-badge ${caja.estado === 'abierta' ? 'status-open' : 'status-closed'}">
                ${caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
            ${caja.notas ? `
            <div class="col-span-2">
              <p class="text-sm text-[#0F2532]/60 dark:text-gray-400">Notas</p>
              <p class="font-medium text-[#0F2532] dark:text-white">${caja.notas}</p>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Historial de movimientos -->
        <div class="bg-white dark:bg-gray-700 rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <h4 class="font-bold text-lg text-[#0F2532] dark:text-white">Historial de Movimientos</h4>
            ${caja.estado === 'abierta' ? `
              <button id="btnNuevoMovimiento" class="action-button text-sm py-2 px-4">
                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Nuevo Movimiento
              </button>
            ` : ''}
          </div>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            ${movimientos.length === 0 ? `
              <p class="text-center text-[#0F2532]/60 dark:text-gray-400 py-8">No hay movimientos registrados</p>
            ` : movimientos.map(mov => `
              <div class="flex items-center justify-between p-3 rounded-lg ${mov.tipo === 'ingreso' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center ${mov.tipo === 'ingreso' ? 'bg-green-500' : 'bg-red-500'}">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      ${mov.tipo === 'ingreso' ? 
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m0-16l-4 4m4-4l4 4"/>' : 
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20V4m0 16l-4-4m4 4l4-4"/>'}
                    </svg>
                  </div>
                  <div>
                    <p class="font-semibold text-[#0F2532] dark:text-white">${mov.concepto}</p>
                    <p class="text-xs text-[#0F2532]/60 dark:text-gray-400">${new Date(mov.fecha).toLocaleString('es-ES')} • ${mov.usuario}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-lg font-bold ${mov.tipo === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                    ${mov.tipo === 'ingreso' ? '+' : '-'}${formatCurrency(Math.abs(mov.monto))}
                  </p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 dark:bg-gray-900 p-4 flex justify-between items-center">
        <button id="btnExportarReporte" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium">
          <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Exportar Reporte
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.querySelector('#btnCloseDetail')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  
  overlay.querySelector('#btnExportarReporte')?.addEventListener('click', () => {
    showNotification('Exportando reporte...', 'info');
    // Simulación de exportación
    setTimeout(() => {
      showNotification('Reporte exportado exitosamente', 'success');
    }, 1500);
  });

  overlay.querySelector('#btnNuevoMovimiento')?.addEventListener('click', () => {
    showNuevoMovimientoModal(cajaId);
  });
}

// Modal para nuevo movimiento
function showNuevoMovimientoModal(cajaId) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 modal-overlay flex items-center justify-center z-[60] animate-fade-in';
  overlay.innerHTML = `
    <div class="glass-card w-full max-w-md mx-4 rounded-2xl shadow-2xl animate-slide-in">
      <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
        <h3 class="text-2xl font-bold">Nuevo Movimiento</h3>
        <p class="text-white/80 text-sm mt-1">Registra un ingreso o egreso</p>
      </div>
      <form id="formNuevoMovimiento" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Tipo de Movimiento *</label>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" class="tipo-btn ingreso-btn bg-green-500 text-white py-3 rounded-xl font-semibold transition hover:bg-green-600 active" data-tipo="ingreso">
              <svg class="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m0-16l-4 4m4-4l4 4"/>
              </svg>
              Ingreso
            </button>
            <button type="button" class="tipo-btn egreso-btn bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition hover:bg-red-500 hover:text-white" data-tipo="egreso">
              <svg class="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20V4m0 16l-4-4m4 4l4-4"/>
              </svg>
              Egreso
            </button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Monto *</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-[#0F2532]/60 dark:text-gray-400 font-medium">$</span>
            <input type="number" id="montoMovimiento" required min="0" step="0.01" placeholder="0.00"
              class="w-full pl-8 pr-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white"/>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#0F2532] dark:text-white mb-2">Concepto *</label>
          <input type="text" id="conceptoMovimiento" required placeholder="Ej: Pago de consulta, Compra material..."
            class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] transition bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white"/>
        </div>
        <div class="flex gap-3 pt-4">
          <button type="button" id="btnCancelarMovimiento" class="flex-1 py-3 border-2 border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 font-semibold text-[#0F2532] dark:text-white transition">
            Cancelar
          </button>
          <button type="submit" class="flex-1 py-3 action-button">
            Registrar
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  let tipoSeleccionado = 'ingreso';

  // Event listeners para tipo
  overlay.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.querySelectorAll('.tipo-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.tipo === 'ingreso') {
          b.className = 'tipo-btn ingreso-btn bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition hover:bg-green-500 hover:text-white';
        } else {
          b.className = 'tipo-btn egreso-btn bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition hover:bg-red-500 hover:text-white';
        }
      });
      btn.classList.add('active');
      tipoSeleccionado = btn.dataset.tipo;
      if (tipoSeleccionado === 'ingreso') {
        btn.className = 'tipo-btn ingreso-btn bg-green-500 text-white py-3 rounded-xl font-semibold transition hover:bg-green-600 active';
      } else {
        btn.className = 'tipo-btn egreso-btn bg-red-500 text-white py-3 rounded-xl font-semibold transition hover:bg-red-600 active';
      }
    });
  });

  overlay.querySelector('#btnCancelarMovimiento').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#formNuevoMovimiento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('montoMovimiento').value);
    const concepto = document.getElementById('conceptoMovimiento').value.trim();

    console.log('Nuevo movimiento:', { cajaId, tipo: tipoSeleccionado, monto, concepto });

    // Simulación de guardado
    overlay.remove();
    showNotification(`${tipoSeleccionado === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado exitosamente`, 'success');
    
    // Actualizar la vista si es necesario
    setTimeout(() => {
      showDetalleCaja(cajaId);
    }, 500);
  });
}

// Notificación toast mejorada
function showNotification(message, type = 'info') {
  const colors = {
    success: 'from-green-500 to-green-600',
    error: 'from-red-500 to-red-600',
    info: 'from-[#4EABBE] to-[#1D5D69]',
    warning: 'from-yellow-500 to-yellow-600'
  };

  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>',
    error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
    info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>'
  };

  const toast = document.createElement('div');
  toast.className = `fixed top-6 right-6 bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] animate-slide-in-right backdrop-blur-sm min-w-[300px]`;
  toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="flex-shrink-0">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${icons[type]}
        </svg>
      </div>
      <span class="font-semibold text-sm flex-1">${message}</span>
      <button class="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // Cerrar al hacer clic en el botón
  toast.querySelector('button').addEventListener('click', () => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  });

  // Auto-cerrar después de 4 segundos
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Formatear moneda
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}
