// src/renderer/components/navbar-component.js
export class NavbarComponent extends HTMLElement {
  constructor() {
    super();
    this.menuOpen = false;
  }

  connectedCallback() {
    const currentPage = this.getAttribute('current') || '';
    const userName = this.getAttribute('user-name') || 'Usuario';
    const userRole = this.getAttribute('user-role') || 'Administrador';
    
    this.innerHTML = `
      <div class="app-navbar-container">
        <style>
          /* Paleta personalizada */
          :root {
            --nv-primary: #4EABBE;
            --nv-muted: #D9D9D9;
            --nv-accent: #8BCFDD;
            --nv-bg: #F8F7F7;
            --nv-text: #1f2937;
          }

          .app-navbar-container { background: var(--nv-accent); box-shadow: 0 6px 18px rgba(16,24,40,0.08); }
          .app-navbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid rgba(0,0,0,0.04); }

          .brand { display:flex; align-items:center; gap:12px; }
          .brand-logo { width:84px; height:auto; object-fit:contain; }

          .search-wrap { position:relative; }
          .search-input {
            width: 420px; padding:10px 14px 10px 40px; border-radius:10px; border:1px solid var(--nv-muted);
            background: var(--nv-bg); color:var(--nv-text); font-size:14px; transition:box-shadow .15s ease, border-color .15s ease;
          }
          .search-input:focus { outline:none; box-shadow:0 4px 12px rgba(78,171,190,0.12); border-color:var(--nv-primary); }
          .search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:rgba(31,41,55,0.45); pointer-events: none; }

          .user-block { display:flex; align-items:center; gap:12px; }
          .user-name { color:var(--nv-text); font-weight:600; margin:0; }
          .user-role { color:rgba(31,41,55,0.6); font-size:12px; margin:0; }
          .avatar { width:40px; height:40px; border-radius:9999px; background:var(--nv-primary); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(16,24,40,0.06); cursor:pointer; transition: transform .2s ease; }
          .avatar:hover { transform: scale(1.05); }

          nav.app-nav { background: var(--nv-bg); padding:8px 24px; }
          ul.nav-list { display:flex; gap:8px; list-style:none; margin:0; padding:0; }
          a.nav-item { color:var(--nv-text); padding:10px 14px; display:flex; align-items:center; gap:8px; border-radius:8px; text-decoration:none; font-weight:600; transition:all .12s ease; border-bottom:3px solid transparent; }
          a.nav-item:hover { color:var(--nv-primary); background: rgba(78,171,190,0.06); transform:translateY(-1px); }
          a.nav-item.active { color:var(--nv-primary); background:#ffffff; box-shadow:0 6px 18px rgba(16,24,40,0.06); border-bottom-color:var(--nv-primary); }

          /* Dropdown mejorado */
          .avatar-menu { position:relative; }
          .avatar-menu .menu { 
            position:absolute; right:0; top:54px; min-width:200px; background:#fff; 
            border:1px solid rgba(0,0,0,0.06); border-radius:10px; 
            box-shadow:0 10px 30px rgba(2,6,23,0.12); 
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all .2s ease;
            z-index: 1000;
          }
          .avatar-menu .menu.show { 
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
          }
          .menu a { 
            display:block; padding:12px 16px; color:#374151; text-decoration:none; 
            transition: background .15s ease;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .menu a:first-child { border-radius: 10px 10px 0 0; }
          .menu a:last-child { border-radius: 0 0 10px 10px; }
          .menu a:hover { background:var(--nv-bg); }
          .menu hr { margin:6px 0; border:none; border-top:1px solid rgba(0,0,0,0.06); }
          
          /* Loading state */
          .search-input:disabled { opacity: 0.6; cursor: not-allowed; }
        </style>

        <!-- Header superior -->
        <div class="app-navbar">
          <!-- Logo y búsqueda -->
          <div class="brand">
            <!-- Logo -->
            <img src="../assets/V2 BLANCO .png" alt="Sonalia" class="brand-logo" onerror="this.style.display='none'" />

            <!-- Buscador mejorado -->
            <div class="search-wrap">
              <div class="search-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
              <input 
                type="text" 
                id="navbar-search"
                placeholder="Busca pacientes por nombre o documento" 
                class="search-input"
                autocomplete="off"
              />
            </div>
          </div>

          <!-- Usuario -->
          <div class="user-block">
            <div style="text-align:right;">
              <p class="user-name">${this.escapeHtml(userName)}</p>
              <p class="user-role">${this.escapeHtml(userRole)}</p>
            </div>
            <div class="avatar-menu">
              <button class="avatar" type="button" aria-label="Menú de usuario" aria-expanded="false" id="avatar-btn">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                </svg>
              </button>
              <div class="menu" id="user-menu" role="menu">
                <a href="#perfil" data-menu-item="perfil" role="menuitem">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Mi Perfil
                </a>
                <a href="#configuracion" data-menu-item="configuracion" role="menuitem">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Configuración
                </a>
                <hr>
                <a href="#logout" data-logout role="menuitem" style="color:#dc2626;">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Cerrar Sesión
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Menú de navegación -->
        <nav class="app-nav">
          <ul class="nav-list">
            ${this.createNavItem('Agenda', currentPage === 'agenda_diaria' || currentPage === 'agenda_semanal' ? currentPage : 'agenda_diaria', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            `)}
            ${this.createNavItem('Pacientes', 'pacientes', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            `)}
            ${this.createNavItem('Cajas', 'cajas', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            `)}
            ${this.createNavItem('Administración', 'administracion', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            `)}
            ${this.createNavItem('Reportes', 'reportes', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            `)}
            ${this.createNavItem('CRM', 'crm', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            `)}
          </ul>
        </nav>
      </div>
    `;

    this.attachEventListeners();
  }

  // Función para escapar HTML y prevenir XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createNavItem(label, page, currentPage, icon) {
    const isActive = currentPage === page;
    const classes = isActive ? 'nav-item active' : 'nav-item';
    return `
      <li>
        <a 
          href="#${page}" 
          data-nav-item="${page}"
          class="${classes}"
          role="menuitem"
        >
          ${icon}
          <span>${label}</span>
        </a>
      </li>
    `;
  }

  attachEventListeners() {
    // Event listeners para navegación
    this.querySelectorAll('[data-nav-item]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-nav-item');
        
        // Actualizar clases activas
        this.querySelectorAll('[data-nav-item]').forEach(i => {
          i.classList.remove('active');
        });
        item.classList.add('active');
        
        this.dispatchEvent(new CustomEvent('navigate', { 
          detail: { page },
          bubbles: true,
          composed: true
        }));
      });
    });

    // Toggle del menú de usuario
    const avatarBtn = this.querySelector('#avatar-btn');
    const userMenu = this.querySelector('#user-menu');
    
    if (avatarBtn && userMenu) {
      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.menuOpen = !this.menuOpen;
        userMenu.classList.toggle('show', this.menuOpen);
        avatarBtn.setAttribute('aria-expanded', this.menuOpen);
      });

      // Cerrar menú al hacer click fuera
      document.addEventListener('click', (e) => {
        if (this.menuOpen && !this.contains(e.target)) {
          this.menuOpen = false;
          userMenu.classList.remove('show');
          avatarBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Event listeners para items del menú
    this.querySelectorAll('[data-menu-item]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-menu-item');
        
        // Cerrar menú
        if (userMenu) {
          this.menuOpen = false;
          userMenu.classList.remove('show');
          avatarBtn.setAttribute('aria-expanded', 'false');
        }
        
        this.dispatchEvent(new CustomEvent('navigate', { 
          detail: { page },
          bubbles: true,
          composed: true
        }));
      });
    });

    // Event listener para logout
    const logoutBtn = this.querySelector('[data-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Cerrar menú
        if (userMenu) {
          this.menuOpen = false;
          userMenu.classList.remove('show');
        }
        
        this.dispatchEvent(new CustomEvent('logout', { 
          bubbles: true,
          composed: true
        }));
      });
    }

    // Event listener para búsqueda con debounce
    const searchInput = this.querySelector('#navbar-search');
    if (searchInput) {
      let debounceTimer;
      
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.dispatchEvent(new CustomEvent('search', {
            detail: { query: e.target.value.trim() },
            bubbles: true,
            composed: true
          }));
        }, 300); // Debounce de 300ms
      });

      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceTimer);
          this.dispatchEvent(new CustomEvent('searchSubmit', {
            detail: { query: e.target.value.trim() },
            bubbles: true,
            composed: true
          }));
        }
      });
    }
  }

  // Método público para actualizar el usuario
  updateUser(userName, userRole) {
    const nameEl = this.querySelector('.user-name');
    const roleEl = this.querySelector('.user-role');
    
    if (nameEl) nameEl.textContent = this.escapeHtml(userName);
    if (roleEl) roleEl.textContent = this.escapeHtml(userRole);
  }

  // Método público para actualizar la página activa
  setActivePage(page) {
    this.querySelectorAll('[data-nav-item]').forEach(item => {
      const itemPage = item.getAttribute('data-nav-item');
      if (itemPage === page) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  disconnectedCallback() {
    // Cleanup
    const userMenu = this.querySelector('#user-menu');
    if (userMenu) {
      userMenu.classList.remove('show');
    }
  }
}

// Registrar el componente
customElements.define('app-navbar', NavbarComponent);