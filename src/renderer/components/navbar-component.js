// src/renderer/components/navbar-component.js

export class NavbarComponent extends HTMLElement {
  constructor() {
    super();
    this.menuOpen = false;
    this.adminDropdownOpen = false;
  }

  async connectedCallback() {
    const currentPage = this.getAttribute('current') || '';
    const userName = this.getAttribute('user-name') || 'Usuario';
    const userRole = this.getAttribute('user-role') || 'Administrador';

    try {
      const response = await fetch('../components/navbar-component.html');
      const html = await response.text();
      this.innerHTML = html;

      requestAnimationFrame(() => {
        this.updateUser(userName, userRole);
        this.renderNavigation(currentPage);
        this.renderAdminDropdown();
        this.attachEventListeners();
      });

    } catch (error) {
      console.error('Error cargando navbar:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderNavigation(currentPage) {
    const navList = this.querySelector('#navbar-nav-list');
    if (!navList) return;

    const navItems = [
      { label: 'Agenda', page: 'agenda_diaria', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', isActive: currentPage === 'agenda_diaria' || currentPage === 'agenda_semanal' },
      { label: 'Pacientes', page: 'pacientes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', isActive: currentPage === 'pacientes' },
      { label: 'Cajas', page: 'cajas', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', isActive: currentPage === 'cajas' },
      { label: 'Administración', page: 'administracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', hasDropdown: true, isActive: currentPage === 'administracion' || currentPage === 'inventario' },
      { label: 'Reportes', page: 'reportes', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', isActive: currentPage === 'reportes' },
      { label: 'CRM', page: 'crm', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', isActive: currentPage === 'crm' }
    ];

    navList.innerHTML = navItems.map(it => {
      const base = 'flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all';
      const act = it.isActive ? 'text-white bg-gradient-to-r from-[#4EABBE] to-[#1D5D69] shadow-md' : 'text-[#0F2532] dark:text-gray-300 hover:text-[#4EABBE] dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-md';
      return `<li><a href="#${it.page}" data-nav-item="${it.page}" ${it.hasDropdown ? 'data-has-dropdown="true"' : ''} class="${base} ${act}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${it.icon}"/></svg><span>${it.label}</span></a></li>`;
    }).join('');
  }

  renderAdminDropdown() {
    const left = this.querySelector('#admin-col-left');
    const right = this.querySelector('#admin-col-right');
    if (!left || !right) return;
    left.innerHTML = `
      <a href="#inventario" data-nav-item="inventario" class="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">Inventario</a>
      <a href="#convenios" data-nav-item="convenios" class="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">Convenios</a>
    `;
    right.innerHTML = '<a href="#profesionales" data-nav-item="profesionales" class="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">Profesionales</a>';
  }

  attachEventListeners() {
    // Main navigation & Dropdown items
    this.querySelectorAll('[data-nav-item]:not([data-has-dropdown])').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('navigate', { detail: { page: item.getAttribute('data-nav-item') }, bubbles: true, composed: true }));
      });
    });

    // Admin dropdown toggle
    const btn = this.querySelector('[data-has-dropdown="true"]');
    const dropdown = this.querySelector('#admin-dropdown');
    if (btn && dropdown) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('show');
      });
    }

    // User menu toggle
    const avatar = this.querySelector('#avatar-btn');
    const menu = this.querySelector('#user-menu');
    if (avatar && menu) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
      });
    }

    // User menu navigation (Profile, Settings)
    this.querySelectorAll('[data-menu-item]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-menu-item');
        this.dispatchEvent(new CustomEvent('navigate', { detail: { page }, bubbles: true, composed: true }));
        if (menu) menu.classList.remove('show');
      });
    });

    // Logout
    const logout = this.querySelector('[data-logout]');
    if (logout) {
      logout.addEventListener('click', (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('logout', { bubbles: true, composed: true }));
      });
    }

    // Dark mode toggle - Consolidated Logic
    const themeBtn = this.querySelector('#themeToggle');
    if (themeBtn) {
      const sun = themeBtn.querySelector('.sun-icon');
      const moon = themeBtn.querySelector('.moon-icon');
      const root = document.documentElement;

      // Initialize state based on localStorage or system preference
      const savedTheme = localStorage.getItem('theme');
      const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        root.classList.add('dark');
        this.updateThemeIcons(true, themeBtn, sun, moon);
      } else {
        root.classList.remove('dark');
        this.updateThemeIcons(false, themeBtn, sun, moon);
      }

      themeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isCurrentlyDark = root.classList.contains('dark');
        const newIsDark = !isCurrentlyDark;

        if (newIsDark) {
          root.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          root.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }

        this.updateThemeIcons(newIsDark, themeBtn, sun, moon);
        console.log('[navbar] Theme changed to:', newIsDark ? 'dark' : 'light');
      });
    }
  }

  updateUser(userName, userRole) {
    const name = this.querySelector('.user-name');
    const role = this.querySelector('.user-role');
    if (name) name.textContent = this.escapeHtml(userName);
    if (role) role.textContent = this.escapeHtml(userRole);
  }

  updateThemeIcons(isDark, btn, sun, moon) {
    if (isDark) {
      btn.classList.remove('bg-white');
      btn.classList.add('bg-[#1D5D69]');
      if (sun) {
        sun.classList.remove('opacity-100', 'rotate-0', 'scale-100');
        sun.classList.add('opacity-0', '-rotate-90', 'scale-0');
      }
      if (moon) {
        moon.classList.remove('opacity-0', 'rotate-90', 'scale-0');
        moon.classList.add('opacity-100', 'rotate-0', 'scale-100');
      }
    } else {
      btn.classList.remove('bg-[#1D5D69]');
      btn.classList.add('bg-white');
      if (sun) {
        sun.classList.remove('opacity-0', '-rotate-90', 'scale-0');
        sun.classList.add('opacity-100', 'rotate-0', 'scale-100');
      }
      if (moon) {
        moon.classList.remove('opacity-100', 'rotate-0', 'scale-100');
        moon.classList.add('opacity-0', 'rotate-90', 'scale-0');
      }
    }
  }
}

customElements.define('app-navbar', NavbarComponent);