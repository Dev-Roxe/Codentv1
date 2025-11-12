// src/renderer/components/navbar-component.js
export class NavbarComponent extends HTMLElement {
  constructor() {
    super();
    this.menuOpen = false;
    this.adminDropdownOpen = false;
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

          nav.app-nav { background: var(--nv-bg); padding:8px 24px; position: relative; }
          ul.nav-list { display:flex; gap:8px; list-style:none; margin:0; padding:0; }
          a.nav-item { color:var(--nv-text); padding:10px 14px; display:flex; align-items:center; gap:8px; border-radius:8px; text-decoration:none; font-weight:600; transition:all .12s ease; border-bottom:3px solid transparent; position: relative; }
          a.nav-item:hover { color:var(--nv-primary); background: rgba(78,171,190,0.06); transform:translateY(-1px); }
          a.nav-item.active { color:var(--nv-primary); background:#ffffff; box-shadow:0 6px 18px rgba(16,24,40,0.06); border-bottom-color:var(--nv-primary); }

          /* Dropdown usuario mejorado */
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
          
          /* Dropdown Administración */
          .admin-dropdown-wrapper { position: relative; }
          .admin-dropdown {
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-top: 12px;
            opacity: 0;
            visibility: hidden;
            transition: all .2s ease;
            z-index: 999;
          }
          .admin-dropdown.show {
            opacity: 1;
            visibility: visible;
            margin-top: 8px;
          }
          
          .admin-dropdown-content {
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            border: 1px solid rgba(0,0,0,0.06);
            width: 680px;
          }

          .admin-dropdown-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-radius: 10px;
            overflow: hidden;
          }

          .admin-dropdown-col {
            padding: 20px;
          }

          .admin-dropdown-col:first-child {
            border-right: 1px solid #e5e7eb;
          }

          .admin-dropdown-title {
            font-size: 11px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 12px;
          }

          .admin-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            color: #374151;
            text-decoration: none;
            border-radius: 6px;
            transition: background .15s ease;
            font-size: 14px;
            margin-bottom: 2px;
          }

          .admin-dropdown-item:hover {
            background: #f9fafb;
          }

          .admin-dropdown-item svg {
            width: 16px;
            height: 16px;
            color: #6b7280;
            transition: color .15s ease;
          }

          .admin-dropdown-item:hover svg {
            color: var(--nv-primary);
          }

          .admin-badge {
            margin-left: auto;
            padding: 2px 8px;
            background: #3b82f6;
            color: white;
            font-size: 10px;
            font-weight: 700;
            border-radius: 4px;
          }

          /* Arrow animation */
          .nav-arrow {
            transition: transform .2s ease;
          }
          .nav-arrow.rotated {
            transform: rotate(180deg);
          }

          /* Loading state */
          .search-input:disabled { opacity: 0.6; cursor: not-allowed; }
        </style>

        <!-- Header superior -->
        <div class="app-navbar">
          <!-- Logo y búsqueda -->
          <div class="brand">
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
            `, false)}
            ${this.createNavItem('Pacientes', 'pacientes', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            `, false)}
            ${this.createNavItem('Cajas', 'cajas', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            `, false)}
            ${this.createNavItem('Administración', 'administracion', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            `, true)}
            ${this.createNavItem('Reportes', 'reportes', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            `, false)}
            ${this.createNavItem('CRM', 'crm', currentPage, `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            `, false)}
          </ul>

          <!-- Dropdown de Administración -->
          <div id="admin-dropdown" class="admin-dropdown">
            <div class="admin-dropdown-content">
              <div class="admin-dropdown-grid">
                <!-- Columna Administración -->
                <div class="admin-dropdown-col">
                  <div class="admin-dropdown-title">ADMINISTRACIÓN</div>
                  ${this.createAdminDropdownItem('Convenios', '#convenios', 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4')}
                  ${this.createAdminDropdownItem('Gestión de profesionales', '#profesionales', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z')}
                  ${this.createAdminDropdownItem('Gestión de especialidades', '#especialidades', 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10')}
                  ${this.createAdminDropdownItem('Planificación y uso de Cubículos', '#cubiculos', 'M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z')}
                  ${this.createAdminDropdownItem('Usuarios', '#usuarios', 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z')}
                  ${this.createAdminDropdownItem('Pagos TPV', '#pagos-tpv', 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', true)}
                  ${this.createAdminDropdownItem('Planes y servicios', '#planes', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z')}
                </div>

                <!-- Columna Configuración -->
                <div class="admin-dropdown-col">
                  <div class="admin-dropdown-title">CONFIGURACIÓN</div>
                  ${this.createAdminDropdownItem('Agenda Online', '#agenda-online', 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')}
                  ${this.createAdminDropdownItem('Arancel de precios', '#aranceles', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2')}
                  ${this.createAdminDropdownItem('Bancos y entidades financieras', '#bancos', 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z')}
                  ${this.createAdminDropdownItem('Consentimientos Informados', '#consentimientos', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z')}
                  ${this.createAdminDropdownItem('Estados de agenda', '#estados-agenda', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01')}
                  ${this.createAdminDropdownItem('Logotipo', '#logotipo', 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z')}
                  ${this.createAdminDropdownItem('Opciones de pago', '#opciones-pago', 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z')}
                  ${this.createAdminDropdownItem('Pagos anulados y pendientes', '#pagos-pendientes', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')}
                  ${this.createAdminDropdownItem('Configuraciones especiales', '#configuraciones-especiales', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z')}
                </div>
              </div>
            </div>
          </div>
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

  createNavItem(label, page, currentPage, icon, hasDropdown = false) {
    const isActive = currentPage === page;
    const classes = isActive ? 'nav-item active' : 'nav-item';
    const arrowSvg = hasDropdown ? `
      <svg class="w-3 h-3 nav-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    ` : '';
    
    return `
      <li class="${hasDropdown ? 'admin-dropdown-wrapper' : ''}">
        <a 
          href="#${page}" 
          data-nav-item="${page}"
          ${hasDropdown ? 'data-has-dropdown="true"' : ''}
          class="${classes}"
          role="menuitem"
        >
          ${icon}
          <span>${label}</span>
          ${arrowSvg}
        </a>
      </li>
    `;
  }

  createAdminDropdownItem(label, href, svgPath, hasNew = false) {
    const badge = hasNew ? '<span class="admin-badge">NUEVO</span>' : '';
    return `
      <a href="${href}" class="admin-dropdown-item" data-admin-link="${href}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${svgPath}"/>
        </svg>
        <span>${label}</span>
        ${badge}
      </a>
    `;
  }

  attachEventListeners() {
    // Event listeners para navegación normal
    this.querySelectorAll('[data-nav-item]:not([data-has-dropdown])').forEach(item => {
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

    // Event listener para el botón de Administración con dropdown
    const adminBtn = this.querySelector('[data-has-dropdown="true"]');
    const adminDropdown = this.querySelector('#admin-dropdown');
    const adminArrow = adminBtn?.querySelector('.nav-arrow');

    if (adminBtn && adminDropdown) {
      adminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        this.adminDropdownOpen = !this.adminDropdownOpen;
        
        if (this.adminDropdownOpen) {
          adminDropdown.classList.add('show');
          if (adminArrow) adminArrow.classList.add('rotated');
        } else {
          adminDropdown.classList.remove('show');
          if (adminArrow) adminArrow.classList.remove('rotated');
        }
      });

      // Cerrar dropdown al hacer click fuera
      document.addEventListener('click', (e) => {
        if (this.adminDropdownOpen && 
            !adminBtn.contains(e.target) && 
            !adminDropdown.contains(e.target)) {
          this.adminDropdownOpen = false;
          adminDropdown.classList.remove('show');
          if (adminArrow) adminArrow.classList.remove('rotated');
        }
      });

      // Event listeners para items del dropdown
      adminDropdown.querySelectorAll('[data-admin-link]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const section = link.getAttribute('data-admin-link').substring(1);
          
          // Cerrar dropdown
          this.adminDropdownOpen = false;
          adminDropdown.classList.remove('show');
          if (adminArrow) adminArrow.classList.remove('rotated');
          
          console.log('Navegar a sección de admin:', section);
          
          this.dispatchEvent(new CustomEvent('navigate', { 
            detail: { page: 'administracion', section },
            bubbles: true,
            composed: true
          }));
        });
      });
    }

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

    // Event listeners para items del menú de usuario
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
        }, 300);
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

  // Método público para cerrar dropdowns
  closeDropdowns() {
    const adminDropdown = this.querySelector('#admin-dropdown');
    const adminArrow = this.querySelector('[data-has-dropdown="true"] .nav-arrow');
    const userMenu = this.querySelector('#user-menu');
    const avatarBtn = this.querySelector('#avatar-btn');
    
    if (adminDropdown) {
      this.adminDropdownOpen = false;
      adminDropdown.classList.remove('show');
      if (adminArrow) adminArrow.classList.remove('rotated');
    }
    
    if (userMenu) {
      this.menuOpen = false;
      userMenu.classList.remove('show');
      if (avatarBtn) avatarBtn.setAttribute('aria-expanded', 'false');
    }
  }

  disconnectedCallback() {
    this.closeDropdowns();
  }
}

// Registrar el componente
customElements.define('app-navbar', NavbarComponent);