import { authApi } from '../api/auth.js';
import { orderApi } from '../api/order.js';
import { api } from '../api/client.js';
import { AppState, requireAuth, showToast, formatPrice, formatDate, renderProductCard } from '../app.js';

if (!requireAuth()) throw new Error('Auth required');

// ── Tab navigation ─────────────────────────────────────────
const tabs = ['my-courses', 'profile-info', 'change-password', 'my-orders', 'wishlist', 'become-instructor'];

function activateTab(tabId) {
  tabs.forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tabId);
    document.getElementById(`nav-${t}`)?.classList.toggle('active', t === tabId);
  });
  if (tabId === 'my-courses') loadMyCourses();
  if (tabId === 'my-orders')  loadMyOrders();
  if (tabId === 'wishlist')   loadWishlist();
  if (tabId === 'become-instructor') loadInstructorStatus();
}

document.querySelectorAll('.profile-nav-item').forEach(el => {
  el.addEventListener('click', () => activateTab(el.dataset.tab));
});

// Auto-activate tab from hash
const hash = location.hash.replace('#', '') || 'my-courses';
activateTab(tabs.includes(hash) ? hash : 'my-courses');
if (hash === 'become-instructor') loadInstructorStatus();

// ── User info ──────────────────────────────────────────────
function setAvatarImage(el, url, fallbackName) {
  if (!el) return;
  if (url) {
    el.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"><div class="avatar-upload-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.45);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;color:white;font-size:1.2rem">📷</div>`;
  } else {
    el.innerHTML = `${(fallbackName || 'U').charAt(0).toUpperCase()}<div class="avatar-upload-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.45);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;color:white;font-size:1.2rem">📷</div>`;
  }
}

function loadUserInfo() {
  const u = AppState.user;
  if (!u) return;
  document.getElementById('profile-name').textContent = u.name;
  document.getElementById('profile-email').textContent = u.email;
  document.getElementById('info-name').value = u.name || '';
  document.getElementById('info-email').value = u.email || '';
  document.getElementById('info-phone').value = u.phone || '';

  // Update both avatar elements
  setAvatarImage(document.getElementById('profile-avatar-letter'), u.avatar_url, u.name);
  setAvatarImage(document.getElementById('info-avatar-preview'), u.avatar_url, u.name);
}
loadUserInfo();

// ── Avatar upload ──────────────────────────────────────────
document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate client-side
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    showToast('Chỉ chấp nhận file ảnh (JPG, PNG, WebP, GIF)', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ảnh không được vượt quá 2MB', 'error');
    return;
  }

  // Show instant preview
  const previewUrl = URL.createObjectURL(file);
  setAvatarImage(document.getElementById('profile-avatar-letter'), previewUrl, AppState.user?.name);
  setAvatarImage(document.getElementById('info-avatar-preview'), previewUrl, AppState.user?.name);

  const status = document.getElementById('avatar-status');
  if (status) { status.style.display = 'block'; status.textContent = 'Đang tải lên...'; status.style.color = 'var(--color-accent)'; }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('el_token');
    const res = await fetch('/api/users/avatar', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload thất bại');
    }

    const updated = await res.json();
    AppState.user.avatar_url = updated.avatar_url;
    localStorage.setItem('el_user', JSON.stringify(AppState.user));
    loadUserInfo();
    showToast('Đã cập nhật ảnh đại diện', 'success');
    if (status) { status.textContent = 'Cập nhật thành công!'; status.style.color = 'var(--color-success)'; setTimeout(() => status.style.display = 'none', 3000); }
  } catch (err) {
    showToast(err.message, 'error');
    loadUserInfo(); // Revert preview
    if (status) { status.textContent = 'Lỗi: ' + err.message; status.style.color = 'var(--color-error)'; }
  } finally {
    URL.revokeObjectURL(previewUrl);
    e.target.value = ''; // Reset input
  }
});

// ── Profile form ───────────────────────────────────────────
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.classList.add('loading');
  try {
    const updated = await authApi.updateProfile({
      name: document.getElementById('info-name').value,
      phone: document.getElementById('info-phone').value,
    });
    AppState.user.name = updated.name;
    AppState.user.phone = updated.phone;
    localStorage.setItem('el_user', JSON.stringify(AppState.user));
    showToast('Cập nhật thông tin thành công ✅', 'success');
    loadUserInfo();
  } catch(e) { showToast(e.message, 'error'); }
  finally { btn.classList.remove('loading'); }
});

// ── Change password ────────────────────────────────────────
document.getElementById('password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const np = document.getElementById('new-password').value;
  const cp = document.getElementById('confirm-password').value;
  if (np !== cp) { showToast('Mật khẩu xác nhận không khớp', 'error'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  btn.classList.add('loading');
  try {
    await authApi.changePassword(document.getElementById('current-password').value, np);
    showToast('Đổi mật khẩu thành công! ✅', 'success');
    e.target.reset();
  } catch(e) { showToast(e.message, 'error'); }
  finally { btn.classList.remove('loading'); }
});

// ── My courses ─────────────────────────────────────────────
async function loadMyCourses() {
  const grid = document.getElementById('my-courses-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
  try {
    const items = await orderApi.myCourses();
    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state__icon">🎓</div>
        <div class="empty-state__title">Chưa có khóa học nào</div>
        <a href="/products/list.html" class="btn btn-primary" style="margin-top:12px">Khám phá ngay</a>
      </div>`;
      return;
    }
    grid.innerHTML = items.map(item => {
      const pct = item.progress
        ? (item.progress.total > 0 ? Math.round((item.progress.completed / item.progress.total) * 100) : 0)
        : null;
      const href = item.product_type === 'course'
        ? `/learning/index.html?id=${item.product_id}`
        : `/learning/index.html?id=${item.product_id}&type=ebook`;
      return `
        <div class="my-course-card" onclick="location.href='${href}'">
          <div class="my-course-card__thumb">
            <img src="${item.thumbnail_url || 'https://via.placeholder.com/300x180/1a1a35/6366f1'}" alt="" loading="lazy">
          </div>
          <div class="my-course-card__body">
            <div class="my-course-card__title">${item.name}</div>
            ${pct !== null ? `
              <div class="my-course-progress"><div class="my-course-progress-fill" style="width:${pct}%"></div></div>
              <div class="my-course-progress-label">${pct}% hoàn thành · ${item.progress.completed}/${item.progress.total} bài</div>
            ` : '<div style="font-size:0.78rem;color:var(--color-accent-light);margin-top:8px">📖 Ebook</div>'}
            <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%">
              ${item.product_type === 'course' ? '▶ Tiếp tục học' : '⬇ Tải xuống'}
            </button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__title">❌ ${e.message}</div></div>`;
  }
}

// ── My orders ──────────────────────────────────────────────
async function loadMyOrders() {
  const container = document.getElementById('my-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
  try {
    const data = await orderApi.list(1);
    if (!data.orders || data.orders.length === 0) {
      container.innerHTML = '<div style="color:var(--color-text-muted)">Chưa có đơn hàng nào</div>';
      return;
    }
    const statusMap = {
      pending: '<span class="badge badge-warning">⏳ Chờ TT</span>',
      paid: '<span class="badge badge-success">✅ Đã TT</span>',
      cancelled: '<span class="badge badge-error">❌ Hủy</span>',
      refunded: '<span class="badge badge-info">↩ Hoàn tiền</span>',
    };
    container.innerHTML = data.orders.slice(0, 5).map(o => `
      <div style="padding:12px;background:var(--color-bg-glass);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:0.875rem">Đơn #${o.order_id}</div>
          <div style="font-size:0.78rem;color:var(--color-text-muted)">${formatDate(o.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${statusMap[o.status] || o.status}
          <span style="font-weight:700;color:var(--color-accent-light)">${formatPrice(o.total_amount)}</span>
        </div>
      </div>`).join('');
    if (data.total > 5) {
      container.innerHTML += `<a href="/orders/index.html" class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px">Xem tất cả đơn hàng →</a>`;
    }
  } catch(e) { container.innerHTML = `<div style="color:var(--color-error)">${e.message}</div>`; }
}

// ── Wishlist ───────────────────────────────────────────────
async function loadWishlist() {
  const grid = document.getElementById('wishlist-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
  try {
    const items = await api.get('/wishlist', true);
    if (!items || items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--color-text-muted)">
        <div style="font-size:3rem;margin-bottom:16px">💔</div>
        <div style="font-size:1.1rem;font-weight:600;margin-bottom:8px">Chưa có sản phẩm yêu thích</div>
        <p>Nhấn ❤️ trên bất kỳ sản phẩm nào để lưu vào danh sách này</p>
        <a href="/products/list.html" class="btn btn-primary" style="margin-top:20px">Khám phá khóa học</a>
      </div>`;
      return;
    }
    grid.innerHTML = items.map(item => {
      const pct = item.original_price && item.original_price > item.price
        ? Math.round((1 - item.price / item.original_price) * 100) : 0;
      return `
        <div class="my-course-card" onclick="location.href='/products/detail.html?id=${item.product_id}'" style="cursor:pointer">
          <div style="position:relative">
            <img src="${item.thumbnail_url || `https://via.placeholder.com/640x360/1a1a35/6366f1?text=${encodeURIComponent(item.name)}`}"
                 alt="${item.name}" style="width:100%;height:140px;object-fit:cover;border-radius:12px 12px 0 0">
            ${pct > 0 ? `<span class="badge badge-error" style="position:absolute;top:8px;right:8px">-${pct}%</span>` : ''}
          </div>
          <div style="padding:16px">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:4px">${item.category?.name || ''}</div>
            <div style="font-weight:700;font-size:0.95rem;margin-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${item.name}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-weight:700;color:var(--color-accent-light)">${formatPrice(item.price)}</div>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); removeWishlist(${item.product_id}, this)">
                ✕ Xóa
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div style="color:var(--color-error)">Lỗi: ${e.message}</div>`;
  }
}

window.removeWishlist = async (productId, btn) => {
  try {
    await api.delete(`/wishlist/${productId}`, true);
    showToast('Đã xóa khỏi yêu thích', 'info');
    loadWishlist();
  } catch(e) {
    showToast(e.message, 'error');
  }
};


// ── Become Instructor ──────────────────────────────────────
let _uploadedCvUrl = null;

async function loadInstructorStatus() {
  const container = document.getElementById('instructor-status-box');
  if (!container) return;
  try {
    const data = await api.get('/users/author-status', true);
    const status = data.author_application_status;
    const role   = data.role;

    const form      = document.getElementById('instructor-apply-form');
    const statusBox = document.getElementById('instructor-app-status');

    if (role === 'author' || role === 'admin') {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;">
          <div style="font-size:3rem;margin-bottom:16px">🎓</div>
          <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Bạn đã là Giảng viên!</div>
          <p style="color:var(--color-text-muted)">Truy cập kênh giảng viên để quản lý khóa học của bạn.</p>
          <a href="/instructor/dashboard.html" class="btn btn-primary" style="margin-top:16px">Kênh Giảng viên →</a>
        </div>`;
      return;
    }

    if (status === 'pending') {
      if (statusBox) statusBox.innerHTML = `
        <div style="background:var(--color-warning-bg,#fef9c3);border:1px solid #fde047;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px">
          <span style="font-size:1.5rem">⏳</span>
          <div><strong>Đơn đăng ký của bạn đang được xét duyệt.</strong><br>
          <span style="font-size:0.85rem;color:var(--color-text-muted)">Admin sẽ phản hồi trong thời gian sớm nhất.</span></div>
        </div>`;
      if (form) form.style.display = 'none';
      return;
    }

    if (status === 'rejected') {
      if (statusBox) statusBox.innerHTML = `
        <div style="background:var(--color-error-bg,#fee2e2);border:1px solid #fca5a5;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px">
          <span style="font-size:1.5rem">❌</span>
          <div><strong>Đơn đăng ký bị từ chối.</strong><br>
          <span style="font-size:0.85rem;color:var(--color-text-muted)">Bạn có thể nộp lại đơn mới bên dưới.</span></div>
        </div>`;
    }
  } catch(e) {
    console.error('Error loading instructor status:', e);
  }
}

// CV Upload
document.getElementById('cv-file-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) {
    showToast('Chỉ chấp nhận file PDF hoặc Word (.doc, .docx)', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) { showToast('File CV không được vượt quá 10MB', 'error'); return; }

  const cvStatus = document.getElementById('cv-upload-status');
  const cvLabel  = document.getElementById('cv-upload-label');
  if (cvStatus) { cvStatus.style.display = 'flex'; cvStatus.textContent = '⏳ Đang tải lên...'; cvStatus.style.color = 'var(--color-accent)'; }

  try {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('el_token');
    const res = await fetch('/api/users/upload-cv', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Upload thất bại'); }
    const data = await res.json();
    _uploadedCvUrl = data.url;
    if (cvStatus) { cvStatus.textContent = `✅ ${file.name} đã tải lên`; cvStatus.style.color = 'var(--color-success)'; }
    if (cvLabel)  cvLabel.textContent = `📎 ${file.name}`;
  } catch(err) {
    showToast(err.message, 'error');
    _uploadedCvUrl = null;
    if (cvStatus) { cvStatus.textContent = '❌ Upload thất bại'; cvStatus.style.color = 'var(--color-error)'; }
  }
});

// Submit Application
document.getElementById('instructor-apply-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const specialization = document.getElementById('instr-specialization').value.trim();
  const experience     = document.getElementById('instr-experience').value.trim();
  const portfolio_url  = document.getElementById('instr-portfolio').value.trim();
  const course_topic   = document.getElementById('instr-course-topic').value.trim();

  if (!specialization || !experience || !course_topic) {
    showToast('Vui lòng điền đầy đủ các trường bắt buộc (*)', 'error');
    return;
  }

  btn.classList.add('loading');
  try {
    await api.post('/users/apply-author', {
      specialization,
      experience,
      portfolio_url: portfolio_url || null,
      course_topic,
      cv_url: _uploadedCvUrl || null,
    }, true);
    showToast('🎉 Đơn đăng ký đã được gửi! Admin sẽ xét duyệt sớm nhất.', 'success');
    e.target.reset();
    _uploadedCvUrl = null;
    loadInstructorStatus();
  } catch(err) {
    showToast(err.message, 'error');
  } finally {
    btn.classList.remove('loading');
  }
});
