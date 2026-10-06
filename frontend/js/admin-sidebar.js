/* ==================== ADMIN SIDEBAR.JS ==================== */
/* Sidebar del panel admin: Sidebar / SidebarSection / SidebarItem.
   La navegación se declara en SIDEBAR_SECTIONS (secciones -> ítems). */

(function () {
  'use strict';

  /* ---------- Íconos Lucide (línea, 24x24, currentColor) ---------- */

  var ICONS = {
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    images: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
    trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    clipboardList: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 2 6.35v0A2 2 0 0 1 2.35 4.41l8-3A2 2 0 0 1 12 4a2 2 0 0 1 1.65.41l8 3A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
    logOut: '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    panelLeftClose: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
    panelLeftOpen: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'
  };

  /* Rosa de la marca: mismo SVG que el favicon público (frontend/index.html).
     Inline para que no dependa de la ruta ni de un request extra. */
  var BRAND_ROSE =
    '<svg viewBox="0 0 100 100" role="img" aria-label="Artesanía Gualeguay">' +
    '<text y=".9em" font-size="90">🌸</text>' +
    '</svg>';

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') + '</svg>';
  }

  /* ---------- Configuración de navegación ---------- */

  var SIDEBAR_SECTIONS = [
    {
      id: 'contenido',
      title: 'Contenido',
      items: [
        { section: 'content', label: 'Contenido del sitio', icon: 'fileText' },
        { section: 'carousel', label: 'Carrusel', icon: 'images' },
        { section: 'testimonials', label: 'Testimonios', icon: 'messageSquare' }
      ]
    },
    {
      id: 'catalogo',
      title: 'Catálogo',
      items: [
        { section: 'products', label: 'Productos', icon: 'package' },
        { section: 'categories', label: 'Categorías', icon: 'tag' },
        { section: 'inventory', label: 'Inventario', icon: 'warehouse', badge: { key: 'lowStock', tone: 'warn', srText: 'productos con stock bajo', srTextOne: 'producto con stock bajo' } }
      ]
    },
    {
      id: 'ventas',
      title: 'Ventas',
      items: [
        { section: 'orders', label: 'Pedidos Individuales', icon: 'clipboardList', badge: { key: 'ordersPending', tone: 'accent', srText: 'pedidos pendientes', srTextOne: 'pedido pendiente' } },
        { section: 'sales', label: 'Ganancias', icon: 'trendingUp' },
        { section: 'payments', label: 'Medio de pago', icon: 'creditCard' }
      ]
    }
  ];

  /* ---------- Estado ---------- */

  var STORAGE_KEY = 'adminSidebarCollapsed';
  var MOBILE_QUERY = '(max-width: 900px)';
  var state = { badges: {}, lastFocused: null, listeners: [] };

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  /* ---------- SidebarItem ---------- */

  function SidebarItem(item) {
    var link = el('a', 'sb__item');
    link.href = '#';
    link.setAttribute('data-section', item.section);
    link.setAttribute('data-label', item.label);
    link.setAttribute('title', item.label);

    // El texto (sr-only) va antes del label para que el label sea el último hijo
    link.appendChild(el('span', 'sb__icon', svg(item.icon)));

    if (item.badge) {
      var badge = el('span', 'sb__badge');
      badge.setAttribute('data-badge-key', item.badge.key);
      if (item.badge.tone === 'warn') badge.classList.add('is-warn');
      link.appendChild(badge);
    }

    link.appendChild(el('em', 'sb__sr', ''));
    link.appendChild(el('span', 'sb__label', escapeHtml(item.label)));

    if (item.badge) renderBadge(link, item.badge);
    return link;
  }

  /* ---------- SidebarSection ---------- */

  function SidebarSection(section) {
    var group = el('div', 'sb__section');
    group.setAttribute('data-section-group', section.id);

    var titleId = 'sb-section-' + section.id;
    var heading = el('p', 'sb__section-title', escapeHtml(section.title));
    heading.id = titleId;

    var list = el('ul', 'sb__list');
    list.setAttribute('aria-labelledby', titleId);

    section.items.forEach(function (item) {
      var li = el('li');
      li.appendChild(SidebarItem(item));
      list.appendChild(li);
    });

    group.appendChild(heading);
    group.appendChild(list);
    return group;
  }

  /* ---------- Sidebar ---------- */

  function Sidebar(options) {
    var opts = options || {};
    var root = el('aside', 'admin-sidebar sb');
    root.id = opts.id || 'adminSidebar';
    root.setAttribute('data-collapsed', 'false');

    /* Marca */
    var brand = el('div', 'sb__brand');
    var mark = el('span', 'sb__brand-mark', BRAND_ROSE);
    var brandText = el('span', 'sb__brand-text');
    brandText.appendChild(el('span', 'sb__brand-title', escapeHtml(opts.brandTitle || 'Artesanías')));
    brandText.appendChild(el('span', 'sb__brand-sub', escapeHtml(opts.brandSubtitle || 'Panel admin')));
    brand.appendChild(mark);
    brand.appendChild(brandText);

    var collapseBtn = el('button', 'sb__collapse', svg('panelLeftClose'));
    collapseBtn.type = 'button';
    collapseBtn.id = 'sidebarCollapseBtn';
    collapseBtn.setAttribute('aria-label', 'Colapsar el menú lateral');
    collapseBtn.setAttribute('aria-expanded', 'true');
    collapseBtn.setAttribute('aria-controls', root.id);
    brand.appendChild(collapseBtn);

    /* Navegación */
    var nav = el('nav', 'sb__nav');
    nav.id = opts.navId || 'adminNav';
    nav.setAttribute('aria-label', opts.navLabel || 'Navegación del panel de administración');
    (opts.sections || SIDEBAR_SECTIONS).forEach(function (section) {
      nav.appendChild(SidebarSection(section, opts));
    });

    /* Pie: usuario + cerrar sesión */
    var footer = el('div', 'sb__footer');

    var user = el('div', 'sb__user');
    user.id = 'sidebarUser';
    user.hidden = true;
    var avatar = el('span', 'sb__avatar', '');
    avatar.id = 'sidebarUserInitial';
    avatar.setAttribute('aria-hidden', 'true');
    var userMeta = el('span', 'sb__user-meta');
    var userName = el('span', 'sb__user-name', '');
    userName.id = 'sidebarUserName';
    var userRole = el('span', 'sb__user-role', '');
    userRole.id = 'sidebarUserRole';
    userMeta.appendChild(userName);
    userMeta.appendChild(userRole);
    user.appendChild(avatar);
    user.appendChild(userMeta);

    var logoutBtn = el('button', 'sb__logout');
    logoutBtn.type = 'button';
    logoutBtn.id = 'logoutBtn';
    logoutBtn.setAttribute('data-label', 'Cerrar sesión');
    logoutBtn.setAttribute('title', 'Cerrar sesión');
    logoutBtn.appendChild(el('span', 'sb__icon', svg('logOut')));
    logoutBtn.appendChild(el('span', 'sb__label', 'Cerrar sesión'));
    logoutBtn.appendChild(el('em', 'sb__sr', ''));

    footer.appendChild(user);
    footer.appendChild(logoutBtn);

    root.appendChild(brand);
    root.appendChild(nav);
    root.appendChild(footer);

    return root;
  }

  /* ---------- Utilidades ---------- */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function renderBadge(link, badgeConfig) {
    var value = state.badges[badgeConfig.key];
    var badge = link.querySelector('[data-badge-key="' + badgeConfig.key + '"]');
    var sr = link.querySelector('.sb__sr');
    if (!badge) return;

    if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
      badge.classList.remove('is-visible');
      badge.textContent = '';
      if (sr) sr.textContent = '';
      return;
    }

    badge.classList.add('is-visible');
    badge.textContent = value > 99 ? '99+' : String(value);
    if (sr) {
      sr.textContent = value + ' ' + (value === 1
        ? (badgeConfig.srTextOne || badgeConfig.srText)
        : badgeConfig.srText);
    }
  }

  function renderAllBadges() {
    var nav = document.getElementById('adminNav');
    if (!nav) return;
    SIDEBAR_SECTIONS.forEach(function (section) {
      section.items.forEach(function (item) {
        if (!item.badge) return;
        var link = nav.querySelector('a[data-section="' + item.section + '"]');
        if (link) renderBadge(link, item.badge);
      });
    });
  }

  /* ---------- Estado activo ---------- */

  function setActiveSection(section) {
    var nav = document.getElementById('adminNav');
    if (!nav) return;
    nav.querySelectorAll('a[data-section]').forEach(function (link) {
      var active = link.getAttribute('data-section') === section;
      link.classList.toggle('is-active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /* ---------- Colapsado (escritorio) ---------- */

  function applyCollapsed(collapsed) {
    var sidebar = document.getElementById('adminSidebar');
    var btn = document.getElementById('sidebarCollapseBtn');
    if (!sidebar || isMobile()) return;

    sidebar.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    if (!btn) return;

    btn.innerHTML = svg(collapsed ? 'panelLeftOpen' : 'panelLeftClose');
    btn.setAttribute('aria-label', collapsed ? 'Expandir el menú lateral' : 'Colapsar el menú lateral');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (e) {
      /* almacenamiento no disponible: el estado queda solo en memoria */
    }
  }

  function readStoredCollapsed() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  /* ---------- Drawer móvil ---------- */

  function openDrawer(trigger) {
    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggle = document.getElementById('sidebarToggle');
    if (!sidebar) return;

    state.lastFocused = trigger || (toggle && document.activeElement) || null;
    sidebar.classList.add('admin-sidebar-open');
    if (overlay) overlay.classList.add('admin-sidebar-overlay-visible');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    var first = sidebar.querySelector('a[data-section]');
    if (first) first.focus();
  }

  function closeDrawer(restoreFocus) {
    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggle = document.getElementById('sidebarToggle');
    if (!sidebar) return;

    sidebar.classList.remove('admin-sidebar-open');
    if (overlay) overlay.classList.remove('admin-sidebar-overlay-visible');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    if (restoreFocus !== false && state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
      state.lastFocused = null;
    }
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var sidebar = document.getElementById('adminSidebar');
    if (!sidebar || !sidebar.classList.contains('admin-sidebar-open')) return;
    e.preventDefault();
    closeDrawer(true);
  }

  /* ---------- Bloque de usuario ---------- */

  function setUser(user) {
    var block = document.getElementById('sidebarUser');
    if (!block) return;
    if (!user || !user.username) {
      block.hidden = true;
      return;
    }
    var role = user.role || 'admin';
    block.hidden = false;
    var initial = document.getElementById('sidebarUserInitial');
    var name = document.getElementById('sidebarUserName');
    var roleEl = document.getElementById('sidebarUserRole');
    if (initial) initial.textContent = user.username.charAt(0);
    if (name) name.textContent = user.username;
    if (roleEl) roleEl.textContent = role;
  }

  /* ---------- API ---------- */

  var api = {
    init: function (options) {
      var opts = options || {};
      var mount = opts.mount || document.getElementById('adminSidebar');
      if (!mount) return null;
      if (!mount.parentNode) return null;

      mount.parentNode.replaceChild(Sidebar(opts), mount);

      var collapseBtn = document.getElementById('sidebarCollapseBtn');
      if (collapseBtn) {
        collapseBtn.addEventListener('click', function () {
          var sidebar = document.getElementById('adminSidebar');
          applyCollapsed(sidebar && sidebar.getAttribute('data-collapsed') !== 'true');
        });
      }

      var logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          if (typeof opts.onLogout === 'function') opts.onLogout();
        });
      }

      var toggle = document.getElementById('sidebarToggle');
      if (toggle) {
        toggle.addEventListener('click', function () {
          var sidebar = document.getElementById('adminSidebar');
          if (!sidebar) return;
          if (sidebar.classList.contains('admin-sidebar-open')) {
            closeDrawer(true);
          } else {
            openDrawer(toggle);
          }
        });
      }

      var overlay = document.getElementById('sidebarOverlay');
      if (overlay) overlay.addEventListener('click', function () { closeDrawer(true); });

      document.addEventListener('keydown', onKeyDown);

      if (!isMobile()) applyCollapsed(readStoredCollapsed());
      else applyCollapsed(false);

      return api;
    },

    setBadges: function (badges) {
      Object.keys(badges || {}).forEach(function (key) {
        state.badges[key] = badges[key];
      });
      renderAllBadges();
    },

    setUser: setUser,
    setActiveSection: setActiveSection,
    isDrawerOpen: function () {
      var sidebar = document.getElementById('adminSidebar');
      return !!(sidebar && sidebar.classList.contains('admin-sidebar-open'));
    },
    closeDrawer: closeDrawer
  };

  window.adminSidebar = api;
})();