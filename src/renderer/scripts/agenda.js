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

  async function cargarVista(vista) {
    try {
      const res = await fetch(`./Agendas/${vista}.html`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const html = await res.text();

      // Insertar solo el fragmento (los archivos en /Agendas son fragments)
      contenedor.innerHTML = html;

      // Llamar al inicializador específico si existe
      if (vista === 'diaria' && typeof initDiaria === 'function') {
        initDiaria(contenedor);
      }
      if (vista === 'semanal' && typeof initSemanal === 'function') {
        initSemanal(contenedor);
      }

      // Actualiza estilos activos (clases tailwind usadas en los botones)
      btnDiaria.classList.toggle('bg-white', vista === 'diaria');
      btnDiaria.classList.toggle('text-cyan-600', vista === 'diaria');
      btnDiaria.classList.toggle('bg-white', vista !== 'diaria', false);

      btnSemanal.classList.toggle('bg-white', vista === 'semanal');
      btnSemanal.classList.toggle('text-cyan-600', vista === 'semanal');
    } catch (error) {
      contenedor.innerHTML = `<p class="text-red-500">Error al cargar la vista: ${error.message}</p>`;
    }
  }

  // Listeners
  btnDiaria.addEventListener('click', () => cargarVista('diaria'));
  btnSemanal.addEventListener('click', () => cargarVista('semanal'));

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
