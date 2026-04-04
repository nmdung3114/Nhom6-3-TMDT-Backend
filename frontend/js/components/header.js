import { AppState, updateCartBadge } from '../app.js';

/* ── DARK MODE ───────────────────────────────────────── */
const THEME_KEY = 'elearn-theme';
let _themeListenerBound = false;

// Apply theme immediately when this module loads — prevents white flash
(function () {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  // Sync all toggle button icons
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  });
}

function applyTheme(theme) {
  document.documentElement.classList.add('theme-transition');
  setTimeout(() => document.documentElement.classList.remove('theme-transition'), 500);
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  // Update ALL #theme-toggle buttons on the page
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── SCROLL ANIMATION ────────────────────────────────── */
export function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

/* ── RENDER NAVBAR ───────────────────────────────────── */
export function renderNavbar() {
  const container = document.getElementById('navbar-inner');
  // If navbar already has content (static HTML), just update auth state
  if (container && container.children.length > 0) {
    updateNavAuthState();
    setupNavbarHandlers();
    initTheme();
    return;
  }
  if (!container) {
    updateNavAuthState();
    setupNavbarHandlers();
    initTheme();
    return;
  }

  const isAdmin = AppState.user?.role === 'admin';

  container.innerHTML = `
    <a href="/" class="navbar__brand">
      <div class="navbar__brand-icon">🎓</div>
      <span class="navbar__brand-text">ELearn<span>VN</span></span>
    </a>
    <div class="navbar__search">
      <span class="navbar__search-icon">🔍</span>
      <input id="search-input" type="text" class="navbar__search-input" placeholder="Tìm kiếm khóa học, ebook...">
      <button id="voice-search-btn" class="navbar__search-mic" title="Tìm kiếm bằng giọng nói" aria-label="Tìm kiếm bằng giọng nói">🎤</button>
    </div>
    <nav class="navbar__nav">
      <a href="/products/list.html" class="navbar__nav-link">📚 <span>Khóa học</span></a>
      <a href="/products/list.html?type=ebook" class="navbar__nav-link">📖 <span>Ebook</span></a>
      <button id="theme-toggle" class="theme-toggle" title="Đổi chủ đề sáng/tối" aria-label="Đổi chủ đề">🌙</button>
      ${!AppState.user ? `
        <a href="/auth/login.html" class="btn btn-sm btn-secondary">Đăng nhập</a>
        <a href="/auth/register.html" class="btn btn-sm btn-primary" style="margin-left:8px">Đăng ký</a>
      ` : `
        <div style="display:flex;align-items:center;gap:10px">
          <a href="/cart/index.html" id="nav-cart-btn" class="navbar__cart-btn">
            🛒 <span id="cart-badge" class="cart-badge" style="display:none">0</span>
          </a>
          <div class="navbar__user">
            <button id="user-menu-btn" class="navbar__user-btn">
              <div class="navbar__avatar">
                ${AppState.user.avatar_url
                  ? `<img src="${AppState.user.avatar_url}" alt="">`
                  : AppState.user.name.charAt(0).toUpperCase()}
              </div>
              <span class="navbar__user-name">${AppState.user.name}</span>
              <span class="navbar__user-chevron">▾</span>
            </button>
            <div id="user-dropdown" class="dropdown-menu">
              <a href="/profile/index.html" class="dropdown-item">👤 Hồ sơ của tôi</a>
              <a href="/profile/index.html#my-courses" class="dropdown-item">🎓 Khóa học của tôi</a>
              <a href="/orders/index.html" class="dropdown-item">📦 Đơn hàng</a>
              ${isAdmin ? `<a href="/admin/dashboard.html" class="dropdown-item">⚙️ Quản trị</a>` : ''}
              <div class="dropdown-divider"></div>
              <div class="dropdown-item danger" onclick="app.logout()">🚪 Đăng xuất</div>
            </div>
          </div>
        </div>
      `}
    </nav>`;

  updateCartBadge();
  setupNavbarHandlers();
  initTheme();
}

function updateNavAuthState() {
  const navAuth = document.getElementById('nav-auth');
  const navUser = document.getElementById('nav-user');
  const navUserName = document.getElementById('nav-user-name');
  const adminItem = document.getElementById('admin-dropdown-item');

  if (AppState.user) {
    navAuth && (navAuth.style.display = 'none');
    navUser && (navUser.style.display = 'flex');
    navUserName && (navUserName.textContent = AppState.user.name);
    if (adminItem) adminItem.style.display = AppState.user.role === 'admin' ? 'flex' : 'none';
    updateCartBadge();
  } else {
    navAuth && (navAuth.style.display = 'flex');
    navUser && (navUser.style.display = 'none');
  }

  // Highlight active nav link
  document.querySelectorAll('.navbar__nav-link').forEach(link => {
    link.classList.toggle('active', link.href === location.href);
  });
}

function setupNavbarHandlers() {
  // Scroll effect — bind only once per navbar element
  const navbar = document.getElementById('navbar');
  if (navbar && !navbar._scrollBound) {
    navbar._scrollBound = true;
    const onScroll = () => navbar.classList.toggle('scrolled', scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Theme toggle — bind ONCE at document level (survives re-renders)
  if (!_themeListenerBound) {
    _themeListenerBound = true;
    document.addEventListener('click', (e) => {
      if (e.target.id === 'theme-toggle' || e.target.closest('#theme-toggle')) {
        e.stopPropagation();
        toggleTheme();
      }
    });
  }

  // Sync toggle icon to current theme after render
  const current = localStorage.getItem(THEME_KEY) || 'light';
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.textContent = current === 'dark' ? '☀️' : '🌙';
  });

  // User dropdown — guard with flag
  if (!document._dropdownBound) {
    document._dropdownBound = true;
    document.addEventListener('click', (e) => {
      const btn = document.getElementById('user-menu-btn');
      const dropdown = document.getElementById('user-dropdown');
      if (!dropdown) return;
      if (btn?.contains(e.target)) {
        dropdown.classList.toggle('open');
        btn.classList.toggle('open');
      } else if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        btn?.classList.remove('open');
      }
    });
  }

  // Global search input (navbar search bar)
  const searchInput = document.getElementById('search-input');
  if (searchInput && !searchInput._searchBound) {
    searchInput._searchBound = true;
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        location.href = `/products/list.html?search=${encodeURIComponent(searchInput.value.trim())}`;
      }
    });
  }
}
