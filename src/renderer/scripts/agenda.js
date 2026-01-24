// agenda.js (módulo)
import '../components/navbar-component.js';
import { initNavbarListeners, getUserName } from './navigation.js';
import { initDiaria } from './agenda_diaria.js';
import { initSemanal } from './agenda_semanal.js';

document.addEventListener('DOMContentLoaded', () => {
  const contenedor = document.getElementById('agendaContainer');
  const btnDiaria = document.getElementById('btnDiaria');
  const btnSemanal = document.getElementById('btnSemanal');

  if (!contenedor) return console.error('No se encontró #agendaContainer');

  async function cargarVista(vista, dateStr) {
    try {
      const res = await fetch(`./Agendas/${vista}.html`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const html = await res.text();

      // Insertar solo el fragmento (los archivos en /Agendas son fragments)
      contenedor.innerHTML = html;

      // Llamar al inicializador específico si existe
      if (vista === 'diaria' && typeof initDiaria === 'function') {
        await initDiaria(contenedor, dateStr);
      }
      if (vista === 'semanal' && typeof initSemanal === 'function') {
        await initSemanal(contenedor, dateStr);
      }

      // Actualizar estilos del segmented control
      const viewIndicator = document.getElementById('viewIndicator');

      if (vista === 'diaria') {
        // Mover indicador a la izquierda (Vista Diaria)
        if (viewIndicator) {
          viewIndicator.style.transform = 'translateX(0)';
        }
        // Botón Diaria: texto blanco (activo)
        btnDiaria.classList.add('text-white');
        btnDiaria.classList.remove('text-gray-600', 'dark:text-gray-400');
        // Botón Semanal: texto gris (inactivo)
        btnSemanal.classList.remove('text-white');
        btnSemanal.classList.add('text-gray-600', 'dark:text-gray-400');
      } else {
        // Mover indicador a la derecha (Vista Semanal)
        if (viewIndicator) {
          viewIndicator.style.transform = 'translateX(calc(100% + 4px))';
        }
        // Botón Semanal: texto blanco (activo)
        btnSemanal.classList.add('text-white');
        btnSemanal.classList.remove('text-gray-600', 'dark:text-gray-400');
        // Botón Diaria: texto gris (inactivo)
        btnDiaria.classList.remove('text-white');
        btnDiaria.classList.add('text-gray-600', 'dark:text-gray-400');
      }
    } catch (error) {
      contenedor.innerHTML = `<p class="text-red-500">Error al cargar la vista: ${error.message}</p>`;
    }
  }

  // Listeners
  btnDiaria.addEventListener('click', () => cargarVista('diaria'));
  btnSemanal.addEventListener('click', () => cargarVista('semanal'));

  // Botones de acciones: Dar cita, Fecha, Imprimir
  const btnDarCita = document.getElementById('btnDarCita');
  const btnFecha = document.getElementById('btnFecha');
  const btnImprimir = document.getElementById('btnImprimir');

  if (btnDarCita) {
    btnDarCita.addEventListener('click', async () => {
      await cargarVista('diaria');
      // esperar a que initDiaria haya creado el botón
      setTimeout(() => {
        const createBtn = document.getElementById('createAptBtn');
        if (createBtn) createBtn.click();
      }, 150);
    });
  }

  if (btnFecha) {
    btnFecha.addEventListener('click', async () => {
      const now = new Date();
      const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const input = prompt('Selecciona fecha (YYYY-MM-DD)', defaultDate);
      if (input) {
        // cargar vista diaria para esa fecha
        await cargarVista('diaria', input);
      }
    });
  }

  if (btnImprimir) {
    btnImprimir.addEventListener('click', () => {
      window.print();
    });
  }

  // Inicializar navbar
  const navbar = document.querySelector('app-navbar');
  if (navbar) navbar.setAttribute('user-name', getUserName());

  initNavbarListeners({
    onSearch: (query) => {
      console.log('Buscando paciente:', query);
    },
    onSearchSubmit: (query) => {
      if (query.trim()) {
        window.location.href = `../pacientes.html?search=${encodeURIComponent(query)}`;
      }
    },
    onLogout: () => {
      if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.clear();
        window.location.href = '../login.html';
      }
    }
  });

  // Carga inicial
  cargarVista('diaria');
});
