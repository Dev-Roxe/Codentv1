// Importar componentes
import '../components/navbar-component.js';

// Código de inicialización global
document.addEventListener('DOMContentLoaded', () => {
    // Manejo global de eventos del navbar
    document.addEventListener('navigate', (e) => {
        const page = e.detail.page;
        const openMenu = !!e.detail.openMenu;
        // Manejar navegación según la página
        switch(page) {
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
                // Si se solicita abrir el menú desde el navbar, guardamos una señal
                // en sessionStorage y luego navegamos; la página objetivo leerá
                // la señal y abrirá el dropdown.
                if (openMenu) {
                    try { sessionStorage.setItem('openAdminMenu', '1'); } catch (e) {}
                }
                window.location.href = '../views/administracion.html';
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