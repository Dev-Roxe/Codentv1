// init-navbar.js
import '../components/navbar-component.js';
import { initNavbarListeners, getUserName } from './navigation.js';

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('app-navbar');
  if (navbar) navbar.setAttribute('user-name', getUserName());

  initNavbarListeners({
    onSearch: (query) => {
      // Puedes implementar un buscador global aquí
      console.log('Navbar search:', query);
    },
    onSearchSubmit: (query) => {
      if (query && query.trim()) {
        window.location.href = `../pacientes.html?search=${encodeURIComponent(query)}`;
      }
    },
    onLogout: () => {
      if (confirm('¿Cerrar sesión?')) {
        localStorage.clear();
        window.location.href = '../login.html';
      }
    }
  });
});
