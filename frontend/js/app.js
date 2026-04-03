/**
 * ELearnVN - Global App State & Utilities
 * Loaded as ES module on every page
 */

// ── State ──────────────────────────────────────────────────
export const AppState = {
  user: null,   // { user_id, name, email, role, avatar_url }
  token: null,
  cartCount: 0,
};

// ── Init ───────────────────────────────────────────────────
export function initApp() {
  const savedToken = localStorage.getItem('el_token');
  const savedUser  = localStorage.getItem('el_user');
  if (savedToken && savedUser) {
    try {
      AppState.token = savedToken;
      AppState.user  = JSON.parse(savedUser);
    } catch { clearAuth(); }
  }
  import('./components/header.js').then(m => m.renderNavbar());
  import('./components/footer.js').then(m => m.renderFooter());
  if (AppState.token) loadCartCount();
  setupVoiceSearch();
}

// ── Voice Search ───────────────────────────────────────────
function setupVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Trình duyệt không hỗ trợ Web Speech API.");
    return;
  }
  
  window.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('voice-search-btn');
    const searchInput = document.getElementById('search-input');
    if(!micBtn || !searchInput) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isListening = false;

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }
      recognition.start();
    });

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      searchInput.placeholder = "Đang lắng nghe...";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      searchInput.value = transcript;
      // Tự động chuyển trang search
      location.href = `/products/list.html?search=${encodeURIComponent(transcript)}`;
    };

    recognition.onerror = (event) => {
      console.error("Lỗi nhận diện:", event.error);
      showToast("Không nhận diện được giọng nói", "error");
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      searchInput.placeholder = "Tìm kiếm khóa học, ebook...";
    };
  });
}

// ── Auth ───────────────────────────────────────────────────
export function saveAuth(tokenData) {
  AppState.token = tokenData.access_token;
  AppState.user  = {
    user_id:    tokenData.user_id,
    name:       tokenData.name,
    email:      tokenData.email,
    role:       tokenData.role,
    avatar_url: tokenData.avatar_url,
  };
  localStorage.setItem('el_token', AppState.token);
  localStorage.setItem('el_user',  JSON.stringify(AppState.user));
}

export function clearAuth() {
  AppState.token = null;
  AppState.user  = null;
  AppState.cartCount = 0;
  localStorage.removeItem('el_token');
  localStorage.removeItem('el_user');
}

export function logout() {
  clearAuth();
  showToast('Đã đăng xuất thành công', 'info');
  setTimeout(() => location.href = '/', 600);
}

export function requireAuth(redirectBack = true) {
  if (!AppState.token) {
    const redirect = redirectBack
      ? '?redirect=' + encodeURIComponent(location.pathname + location.search)
      : '';
    location.href = '/auth/login.html' + redirect;
    return false;
  }
  return true;
}

export function requireAdmin() {
  if (!requireAuth()) return false;
  if (AppState.user?.role !== 'admin') {
    showToast('Bạn không có quyền truy cập trang này', 'error');
    setTimeout(() => location.href = '/', 1000);
    return false;
  }
  return true;
}

// ── Cart count ─────────────────────────────────────────────
export async function loadCartCount() {
  if (!AppState.token) return;
  try {
    const { api } = await import('./api/client.js');
    const cart = await api.get('/cart', true);
    AppState.cartCount = cart.item_count || 0;
    updateCartBadge();
  } catch {}
}

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  if (AppState.cartCount > 0) {
    badge.textContent = AppState.cartCount > 99 ? '99+' : AppState.cartCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── Toast ──────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Formatting ─────────────────────────────────────────────
export function formatPrice(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function formatDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
}

export function renderStars(rating) {
  const full = Math.floor(rating || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function truncate(text, len = 80) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
}

export function getQueryParam(key) {
  return new URLSearchParams(location.search).get(key);
}

// ── Product card renderer ─────────────────────────────────
export function renderProductCard(product) {
  const discount = product.original_price && product.price < product.original_price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;
  const typeLabel = product.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook';
  const meta = product.product_type === 'course'
    ? `<span>${product.total_lessons || 0} bài</span><span>·</span><span>${formatDuration(product.duration || 0)}</span>`
    : `<span>${product.page_count || 0} trang</span>`;
  return `
    <div class="product-card" onclick="location.href='/products/detail.html?id=${product.product_id}'">
      <div class="product-card__thumb">
        <img src="${product.thumbnail_url || 'https://via.placeholder.com/640x360/1a1a35/6366f1?text=' + encodeURIComponent(product.name)}"
             alt="${product.name}" loading="lazy">
        <div class="product-card__type">
          <span class="badge badge-accent">${typeLabel}</span>
        </div>
        ${discount > 0 ? `<div class="product-card__discount"><span class="badge badge-error">-${discount}%</span></div>` : ''}
      </div>
      <div class="product-card__body">
        <div class="product-card__category">${product.category?.name || 'Khóa học'}</div>
        <h3 class="product-card__title">${product.name}</h3>
        ${product.author_name ? `<div class="product-card__author">👨‍💻 ${product.author_name}</div>` : ''}
        <div class="product-card__meta">${meta}</div>
        <div class="product-card__rating">
          <span class="score">${Number(product.average_rating || 0).toFixed(1)}</span>
          <span style="color:var(--color-warning)">${renderStars(product.average_rating)}</span>
          <span class="count">(${product.review_count || 0})</span>
        </div>
        <div class="product-card__footer">
          <div>
            <div class="price" style="font-size:1.1rem">${formatPrice(product.price)}</div>
            ${product.original_price && product.original_price > product.price
              ? `<div class="price-original">${formatPrice(product.original_price)}</div>` : ''}
          </div>
          <div class="product-card__add" onclick="event.stopPropagation(); addToCart(${product.product_id})">+</div>
        </div>
      </div>
    </div>`;
}

// ── Global add to cart helper ──────────────────────────────
window.addToCart = async function(productId) {
  if (!requireAuth(true)) return;
  try {
    const { api } = await import('./api/client.js');
    await api.post('/cart', { product_id: productId, quantity: 1 }, true);
    AppState.cartCount = (AppState.cartCount || 0) + 1;
    updateCartBadge();
    showToast('Đã thêm vào giỏ hàng! 🛒', 'success');
  } catch(e) {
    showToast(e.message || 'Không thể thêm vào giỏ hàng', 'error');
  }
};

// ── Expose on window ───────────────────────────────────────
window.app = { logout, requireAuth, requireAdmin, showToast, formatPrice };

initApp();
