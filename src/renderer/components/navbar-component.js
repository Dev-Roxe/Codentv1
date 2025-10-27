// src/renderer/components/navbar-component.js
class NavbarComponent extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const currentPage = this.getAttribute('current') || '';
    const userName = this.getAttribute('user-name') || 'Usuario';
    
    this.innerHTML = `
      <div class="app-navbar-container">
        <style>
          /* Paleta personalizada */
          :root {
            --nv-primary: #4EABBE; /* principal */
            --nv-muted: #D9D9D9;   /* borde/muted */
            --nv-accent: #8BCFDD;  /* acento claro */
            --nv-bg: #F8F7F7;      /* fondo suave */
            --nv-text: #1f2937;    /* texto primario */
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
          .search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:rgba(31,41,55,0.45); }

          .user-block { display:flex; align-items:center; gap:12px; }
          .user-name { color:var(--nv-text); font-weight:600; }
          .user-role { color:rgba(31,41,55,0.6); font-size:12px; }
          .avatar { width:40px; height:40px; border-radius:9999px; background:var(--nv-primary); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(16,24,40,0.06); cursor:pointer; }

          nav.app-nav { background: var(--nv-bg); padding:8px 24px; }
          ul.nav-list { display:flex; gap:8px; list-style:none; margin:0; padding:0; }
          a.nav-item { color:var(--nv-text); padding:10px 14px; display:flex; align-items:center; gap:8px; border-radius:8px; text-decoration:none; font-weight:600; transition:all .12s ease; border-bottom:3px solid transparent; }
          a.nav-item:hover { color:var(--nv-primary); background: rgba(78,171,190,0.06); transform:translateY(-1px); }
          a.nav-item.active { color:var(--nv-primary); background:#ffffff; box-shadow:0 6px 18px rgba(16,24,40,0.06); border-bottom-color:var(--nv-primary); }

          /* Dropdown pequeño */
          .avatar-menu { position:relative; }
          .avatar-menu .menu { position:absolute; right:0; top:54px; min-width:180px; background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; box-shadow:0 10px 30px rgba(2,6,23,0.08); display:none; }
          .avatar-menu:hover .menu { display:block; }
          .menu a { display:block; padding:10px 12px; color:#374151; text-decoration:none; }
          .menu a:hover { background:var(--nv-bg); }
        </style>

        <!-- Header superior -->
        <div class="app-navbar">
          <!-- Logo y búsqueda -->
          <div class="brand">

            <!-- Logo -->

            <img src="../assets/V2 BLANCO .png" alt="Sonalia" class="brand-logo" />

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
              />
            </div>
          </div>

          <!-- Usuario -->
          <div class="user-block">
            <div style="text-align:right;">
              <div class="user-name">${userName}</div>
              <div class="user-role">Administrador</div>
            </div>
            <div class="avatar-menu">
              <div class="avatar" role="button" tabindex="0">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="menu" aria-hidden="true">
                <a href="#">Mi Perfil</a>
                <a href="#">Configuración</a>
                <hr style="margin:6px 0;border:none;border-top:1px solid rgba(0,0,0,0.06);">
                <a href="#" data-logout style="color:#dc2626;">Cerrar Sesión</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Menú de navegación mejorado -->
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

  createNavItem(label, page, currentPage, icon) {
    const isActive = currentPage === page;
    const classes = isActive ? 'nav-item active' : 'nav-item';
    return `
      <li>
        <a 
          href="#${page}" 
          data-nav-item="${page}"
          class="${classes}"
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
        this.dispatchEvent(new CustomEvent('navigate', { 
          detail: { page },
          bubbles: true 
        }));
      });
    });

    // Event listener para logout
    const logoutBtn = this.querySelector('[data-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('logout', { bubbles: true }));
      });
    }

    // Event listener para búsqueda
    const searchInput = this.querySelector('#navbar-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.dispatchEvent(new CustomEvent('search', {
          detail: { query: e.target.value },
          bubbles: true
        }));
      });

      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.dispatchEvent(new CustomEvent('searchSubmit', {
            detail: { query: e.target.value },
            bubbles: true
          }));
        }
      });
    }
  }
}

// Registrar el componente
customElements.define('app-navbar', NavbarComponent);