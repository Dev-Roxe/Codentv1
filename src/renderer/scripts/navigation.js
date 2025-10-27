// src/renderer/scripts/navigation.js
// Helper para manejar la navegación en toda la aplicación

/**
 * Configuración de rutas de la aplicación
 */
const ROUTES = {
  agenda_diaria: 'agenda_diaria.html',
  agenda_semanal: 'agenda_semanal.html',
  pacientes: 'pacientes.html',
  cajas: 'cajas.html',
  administracion: 'administracion.html',
  reportes: 'reportes.html',
  crm: 'crm.html',
  login: 'login.html',
  register: 'register.html'
};

/**
 * Navega a una página específica
 * @param {string} page - Nombre de la página (sin .html)
 */
export function navigateTo(page) {
  if (ROUTES[page]) {
    window.location.href = ROUTES[page];
  } else {
    console.warn(`Ruta no encontrada para: ${page}`);
  }
}

/**
 * Obtiene el nombre de la página actual
 * @returns {string} Nombre de la página sin .html
 */
export function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  return filename.replace('.html', '');
}

/**
 * Inicializa los event listeners del navbar
 * @param {Object} options - Opciones de configuración
 */
export function initNavbarListeners(options = {}) {
  const navbar = document.querySelector('app-navbar');
  
  if (!navbar) {
    console.error('Navbar component no encontrado');
    return;
  }

  // Event listener para navegación
  navbar.addEventListener('navigate', (e) => {
    const { page } = e.detail;
    
    // Callback personalizado antes de navegar
    if (options.beforeNavigate) {
      const shouldNavigate = options.beforeNavigate(page);
      if (shouldNavigate === false) return;
    }
    
    navigateTo(page);
  });

  // Event listener para logout
  navbar.addEventListener('logout', (e) => {
    if (options.onLogout) {
      options.onLogout();
    } else {
      logout();
    }
  });

  // Event listener para búsqueda en tiempo real
  navbar.addEventListener('search', (e) => {
    const { query } = e.detail;
    
    if (options.onSearch) {
      options.onSearch(query);
    }
  });

  // Event listener para búsqueda al presionar Enter
  navbar.addEventListener('searchSubmit', (e) => {
    const { query } = e.detail;
    
    if (options.onSearchSubmit) {
      options.onSearchSubmit(query);
    }
  });
}

/**
 * Obtiene el nombre del usuario desde localStorage o Electron store
 * @returns {string} Nombre del usuario
 */
export function getUserName() {
  // Si tienes Electron IPC configurado para obtener usuario:
  // return window.electronAPI?.getUserName() || localStorage.getItem('userName') || 'Usuario';
  
  return localStorage.getItem('userName') || 'Usuario';
}

/**
 * Establece el nombre del usuario
 * @param {string} name - Nombre del usuario
 */
export function setUserName(name) {
  localStorage.setItem('userName', name);
  
  // Si usas Electron store:
  // window.electronAPI?.setUserName(name);
}

/**
 * Cierra sesión del usuario
 */
export function logout() {
  localStorage.removeItem('userName');
  localStorage.removeItem('userToken');
  navigateTo('login');
}

/**
 * Verifica si el usuario está autenticado
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!localStorage.getItem('userName');
}

/**
 * Protege una página requiriendo autenticación
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    navigateTo('login');
  }
}