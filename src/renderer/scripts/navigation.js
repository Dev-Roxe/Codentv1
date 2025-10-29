// src/renderer/scripts/navigation.js
// Helper para manejar la navegación en toda la aplicación

/**
 * Configuración de rutas de la aplicación
 */
export const ROUTES = {
  agenda: 'agenda.html',  // Vista principal de agenda
  agenda_diaria: 'agenda.html#diaria',  // Fragment para vista diaria
  agenda_semanal: 'agenda.html#semanal', // Fragment para vista semanal
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
 * @param {Object} options - Opciones adicionales de navegación
 */
export function navigateTo(page, options = {}) {
  const route = ROUTES[page];
  if (route) {
    // Si hay un hash en las opciones, úsalo (útil para agenda diaria/semanal)
    const hash = options.hash || '';
    window.location.href = route + hash;
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
 * Obtiene el tipo de vista de agenda actual
 * @returns {'diaria'|'semanal'} Tipo de vista de agenda
 */
export function getCurrentAgendaView() {
  const hash = window.location.hash.slice(1);
  return hash || 'semanal'; // Default a vista semanal
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
 * @returns {boolean} True si el usuario está autenticado, false si no
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    navigateTo('login');
    return false;
  }
  return true;
}