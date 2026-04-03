import { AppState, updateCartBadge } from '../app.js';

export function renderNavbar() {
  const container = document.getElementById('navbar-inner');
  // If navbar already has content (static HTML), just update auth state
  if (container && container.children.length > 0) {
    updateNavAuthState();
    setupNavbarHandlers();
    return;
  }
  if (!container) {
    updateNavAuthState();
    setupNavbarHandlers();
    return;
  }

  const isAdmin = AppState.user?.role === 'admin';

  container.innerHTML = `
    <a href="/" class="navbar__brand">
      <div class="navbar__brand-icon">🎓</div>
      <span class="navbar__brand-text">ELearnVN</span>
    </a>
    <div class="navbar__search">
      <span class="navbar__search-icon">🔍</span>
      <input id="search-input" type="text" class="navbar__search-input" placeholder="Tìm kiếm khóa học, ebook...">
    </div>
    <nav class="navbar__nav">
      <a href="/products/list.html" class="navbar__nav-link">📚 <span>Khóa học</span></a>
      <a href="/products/list.html?type=ebook" class="navbar__nav-link">📖 <span>Ebook</span></a>
      ${!AppState.user ? `
        <a href="/auth/login.html" class="btn btn-sm btn-secondary">Đăng nhập</a>
        <a href="/auth/register.html" class="btn btn-sm btn-primary" style="margin-left:8px">Đăng ký</a>
      ` : `
        <div style="display:flex;align-items:center;gap:12px">
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
              <span>▾</span>
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
  // Scroll effect
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', scrollY > 10);
  });

  // User dropdown
  document.addEventListener('click', (e) => {
    const btn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (!dropdown) return;
    if (btn?.contains(e.target)) {
      dropdown.classList.toggle('open');
    } else if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Global search
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
      location.href = `/products/list.html?search=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
}
