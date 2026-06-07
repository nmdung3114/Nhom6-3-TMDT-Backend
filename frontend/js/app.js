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
  // Global features — AI Tutor, Blog Widget & Notifications
  // ES modules are deferred, so DOMContentLoaded may have already fired.
  const _initGlobalWidgets = () => {
    import('./components/ai-tutor.js').then(m => m.initAITutor()).catch(() => {});
    import('./components/blog-widget.js').then(m => m.initBlogWidget()).catch(() => {});
    if (AppState.token) {
      import('./components/notifications.js').then(m => m.initNotifications()).catch(() => {});
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', _initGlobalWidgets);
  } else {
    _initGlobalWidgets();
  }
}

// ── Voice Search ───────────────────────────────────────────
function setupVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Use event delegation — works for mic buttons added dynamically
  // (e.g. the one inside products-toolbar in products/list.html)
  document.addEventListener('click', (e) => {
    const micBtn = e.target.closest('#voice-search-btn');
    if (!micBtn) return;

    if (!SpeechRecognition) {
      showToast('Trình duyệt không hỗ trợ tìm kiếm giọng nói', 'error');
      return;
    }

    // Toggle off if already listening
    if (micBtn.classList.contains('listening')) {
      window._activeRecognition?.stop();
      return;
    }

    // ── Create a FRESH instance every click (fixes "works once" bug) ──
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    window._activeRecognition = recognition;

    function showVoiceOverlay() {
      document.getElementById('voice-overlay')?.remove(); // cleanup stale
      const overlay = document.createElement('div');
      overlay.className = 'voice-overlay';
      overlay.id = 'voice-overlay';
      overlay.innerHTML = `
        <div class="voice-overlay-icon">🎤</div>
        <div class="voice-overlay-text">Đang lắng nghe...</div>
        <div class="voice-overlay-hint">Hãy nói to và rõ tên khóa học bạn muốn tìm</div>
        <button class="voice-cancel-btn" id="voice-cancel">✕ Hủy</button>`;
      document.body.appendChild(overlay);
      document.getElementById('voice-cancel')?.addEventListener('click', () => {
        recognition.stop();
      });
    }

    function hideVoiceOverlay() {
      document.getElementById('voice-overlay')?.remove();
    }

    recognition.onstart = () => {
      micBtn.classList.add('listening');
      showVoiceOverlay();
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      hideVoiceOverlay();
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = transcript;
        // On the list page — trigger input event so filter runs without page reload
        if (location.pathname.includes('/products/list')) {
          searchInput.dispatchEvent(new Event('input'));
          return;
        }
      }
      // Otherwise navigate to list page with search query
      location.href = `/products/list.html?search=${encodeURIComponent(transcript)}`;
    };

    recognition.onerror = (event) => {
      hideVoiceOverlay();
      micBtn.classList.remove('listening');
      window._activeRecognition = null;
      if (event.error === 'not-allowed') {
        showToast('⚠️ Hãy cấp quyền microphone trong cài đặt trình duyệt.', 'error');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        showToast('⚠️ Không nhận diện được. Vui lòng thử lại.', 'error');
      }
    };

    recognition.onend = () => {
      micBtn.classList.remove('listening');
      hideVoiceOverlay();
      window._activeRecognition = null;
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Voice recognition start error:', err);
      showToast('Không thể khởi động microphone. Thử lại.', 'error');
      micBtn.classList.remove('listening');
      window._activeRecognition = null;
    }
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
    author_application_status: tokenData.author_application_status,
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

// ── Toast & Modals ───────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

export function showConfirm(title, message, confirmText = 'Xác nhận', isDanger = false) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, opacity: 0, transition: 'opacity 0.2s ease',
    });

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    Object.assign(modal.style, {
      backgroundColor: 'var(--color-bg-elevated, #fff)',
      border: '1px solid var(--color-border)',
      borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '400px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      transform: 'scale(0.95)', transition: 'all 0.2s ease',
    });

    modal.innerHTML = `
      <h3 style="margin: 0 0 12px 0; font-size: 1.25rem;">${title}</h3>
      <p style="margin: 0 0 24px 0; color: var(--color-text-muted); line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-secondary" id="confirm-cancel" style="padding: 8px 16px;">Hủy bỏ</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok" style="padding: 8px 16px; ${isDanger ? 'background: var(--color-error); color: white; border: none;' : ''}">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    });

    const close = (result) => {
      overlay.style.opacity = '0';
      modal.style.transform = 'scale(0.95)';
      setTimeout(() => { overlay.remove(); resolve(result); }, 200);
    };

    modal.querySelector('#confirm-cancel').onclick = () => close(false);
    modal.querySelector('#confirm-ok').onclick = () => close(true);
  });
}

export function showAuthorApplicationForm() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '10000', opacity: '0', transition: 'opacity 0.2s',
      padding: '20px'
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
      padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '600px',
      maxHeight: '90vh', overflowY: 'auto',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      transform: 'scale(0.95)', transition: 'all 0.2s ease',
    });

    modal.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 1.5rem;">✨ Đăng ký làm Giảng viên</h3>
      <p style="margin: 0 0 24px 0; color: var(--color-text-muted); line-height: 1.5;">Vui lòng cung cấp chi tiết về chuyên môn của bạn. Đội ngũ quản trị viên sẽ xem xét đơn đăng ký và làm việc với bạn sớm nhất.</p>
      
      <form id="author-app-form" style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <label style="display:block; margin-bottom:8px; font-weight:600;">Chuyên môn / Lĩnh vực giảng dạy *</label>
          <input type="text" id="specialization" required placeholder="VD: Lập trình Web, Thiết kế Đồ họa..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text);">
        </div>
        
        <div>
          <label style="display:block; margin-bottom:8px; font-weight:600;">Kinh nghiệm làm việc / Giảng dạy (Tóm tắt) *</label>
          <textarea id="experience" required rows="3" placeholder="Chia sẻ ngắn gọn trải nghiệm và thành tựu của bạn..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text); font-family:inherit; resize:vertical;"></textarea>
        </div>
        
        <div>
          <label style="display:block; margin-bottom:8px; font-weight:600;">Link Website / Portfolio / LinkedIn</label>
          <input type="url" id="portfolio_url" placeholder="https://linkedin.com/in/..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text);">
        </div>

        <div>
          <label style="display:block; margin-bottom:8px; font-weight:600;">Chủ đề Khóa học dự kiến *</label>
          <input type="text" id="course_topic" required placeholder="Sản phẩm đầu tiên bạn muốn tạo trên ELearnVN là gì?" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text);">
        </div>

        <div>
          <label style="display:block; margin-bottom:8px; font-weight:600;">Tải lên CV (Bắt buộc, tối đa 10MB) *</label>
          <input type="file" id="cv_file" required accept=".pdf,.doc,.docx" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text);">
          <small id="cv-upload-status" style="display:block; margin-top:6px; color:var(--color-text-muted);"></small>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top:20px;">
          <button type="button" class="btn btn-secondary" id="app-cancel">Hủy bỏ</button>
          <button type="submit" class="btn btn-primary" id="app-submit">Gửi đăng ký</button>
        </div>
      </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    });

    const close = (result) => {
      overlay.style.opacity = '0';
      modal.style.transform = 'scale(0.95)';
      setTimeout(() => { overlay.remove(); resolve(result); }, 200);
    };

    modal.querySelector('#app-cancel').onclick = () => close(null);

    const form = modal.querySelector('#author-app-form');
    const submitBtn = modal.querySelector('#app-submit');
    const statusText = modal.querySelector('#cv-upload-status');

    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('cv_file');
      if (!fileInput.files.length) {
        showToast('Vui lòng đính kèm CV', 'warning');
        return;
      }
      
      const file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) {
        showToast('File CV quá lớn (tối đa 10MB)', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Đang xử lý...';
      statusText.textContent = 'Đang tải tệp lên...';

      try {
        const { api } = await import('./api/client.js');
        
        // 1. Upload CV
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('el_token');
        const uploadRes = await fetch('/api/users/upload-cv', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        
        if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.detail || 'Lỗi khi tải CV lên hệ thống.');
        }
        
        const uploadData = await uploadRes.json();
        const cv_url = uploadData.url;
        
        statusText.textContent = 'Tải tệp thành công! Đang lưu đơn...';

        // 2. Submit form
        const payload = {
            specialization: document.getElementById('specialization').value,
            experience: document.getElementById('experience').value,
            portfolio_url: document.getElementById('portfolio_url').value || undefined,
            course_topic: document.getElementById('course_topic').value,
            cv_url: cv_url
        };

        const res = await api.post('/users/apply-author', payload, true);
        showToast(res.message || 'Đơn đã được gửi! 🎉', 'success');
        
        if (AppState.user) AppState.user.author_application_status = 'pending';
        
        close(payload);

      } catch (err) {
        showToast(err.message, 'error');
        statusText.textContent = '';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi đăng ký';
      }
    };
  });
}

// ── Formatting ─────────────────────────────────────────────
export function formatPrice(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatDate(dateStr, showTime = true) {
  if (!dateStr) return '';
  let str = String(dateStr);
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(str.trim());
  const finalStr = hasOffset ? str : str.replace(' ', 'T') + 'Z';
  const realDate = new Date(finalStr);

  if (isNaN(realDate.getTime())) return dateStr;

  const vnStr = realDate.toLocaleString('en-US', { 
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false 
  });
  
  const [datePartStr, timePartStr] = vnStr.split(', ');
  if (!datePartStr || !timePartStr) return vnStr;

  const [month, day, year] = datePartStr.split('/');
  let [hour, min, sec] = timePartStr.split(':');
  
  if (hour === '24') hour = '00';

  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${pad(day)}/${pad(month)}/${year}`;
  
  if (showTime) {
    return `${pad(hour)}:${pad(min)}:${pad(sec)} ${datePart}`;
  }
  return datePart;
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
        <div class="wishlist-btn-wrap">
          <button class="wishlist-btn" id="wl-${product.product_id}"
            onclick="event.stopPropagation(); toggleWishlist(${product.product_id}, this)"
            title="Yêu thích">❤️</button>
        </div>
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

// ── Wishlist toggle ────────────────────────────────────────
window.toggleWishlist = async function(productId, btn) {
  if (!requireAuth(true)) return;
  const isActive = btn.classList.contains('active');
  try {
    const { api } = await import('./api/client.js');
    if (isActive) {
      await api.delete(`/wishlist/${productId}`, true);
      btn.classList.remove('active');
      showToast('Đã xóa khỏi yêu thích', 'info');
    } else {
      await api.post(`/wishlist/${productId}`, {}, true);
      btn.classList.add('active');
      showToast('Đã thêm vào yêu thích ❤️', 'success');
    }
  } catch(e) {
    showToast(e.message || 'Lỗi', 'error');
  }
};

// ── Expose on window ───────────────────────────────────────
window.app = { logout, requireAuth, requireAdmin, showToast, showConfirm, formatPrice };

initApp();
