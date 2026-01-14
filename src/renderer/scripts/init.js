// Importar componentes
import '../components/navbar-component.js';

// Inicializar dark mode desde localStorage
const initializeDarkMode = () => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Si está en auto y no hay preferencia guardada, o si es explícitamente dark
    const root = document.documentElement;
    if (isDark) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

// Código de inicialización global
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar dark mode
    initializeDarkMode();

    // Manejo global de eventos del navbar
    document.addEventListener('navigate', (e) => {
        const page = e.detail.page;
        const openMenu = !!e.detail.openMenu;
        // Manejar navegación según la página
        switch (page) {
            case 'agenda_diaria':
            case 'agenda_semanal':
                window.location.href = '../views/agenda.html';
                break;
            case 'pacientes':
                window.location.href = '../views/pacientes.html';
                break;
            case 'cajas':
                window.location.href = '../views/cajas.html';
                break;
            case 'administracion':
                if (openMenu) {
                    try { sessionStorage.setItem('openAdminMenu', '1'); } catch (e) { }
                }
                window.location.href = '../views/administracion.html';
                break;
            case 'inventario':
                window.location.href = '../views/inventario.html';
                break;
            case 'reportes':
                window.location.href = '../views/reportes.html';
                break;
            case 'crm':
                window.location.href = '../views/crm.html';
                break;
            case 'perfil':
                window.location.href = '../views/perfil.html';
                break;
            case 'configuracion':
                window.location.href = '../views/configuracion.html';
                break;
        }
    });

    // Manejo del logout
    document.addEventListener('logout', () => {
        // Redirigir a login
        window.location.href = '../views/login.html';
    });

    // Manejo de búsqueda
    document.addEventListener('search', (e) => {
        console.log('Búsqueda:', e.detail.query);
        // Implementar lógica de búsqueda
    });
});