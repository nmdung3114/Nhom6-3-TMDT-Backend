import { authApi } from '../api/auth.js';
import { orderApi } from '../api/order.js';
import { AppState, requireAuth, showToast, formatPrice, formatDate, renderProductCard } from '../app.js';

if (!requireAuth()) throw new Error('Auth required');

// ── Tab navigation ─────────────────────────────────────────
const tabs = ['my-courses', 'profile-info', 'change-password', 'my-orders'];

function activateTab(tabId) {
  tabs.forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tabId);
    document.getElementById(`nav-${t}`)?.classList.toggle('active', t === tabId);
  });
  if (tabId === 'my-courses') loadMyCourses();
  if (tabId === 'my-orders')  loadMyOrders();
}

document.querySelectorAll('.profile-nav-item').forEach(el => {
  el.addEventListener('click', () => activateTab(el.dataset.tab));
});

// Auto-activate tab from hash
const hash = location.hash.replace('#', '') || 'my-courses';
activateTab(tabs.includes(hash) ? hash : 'my-courses');

// ── User info ──────────────────────────────────────────────
function loadUserInfo() {
  const u = AppState.user;
  if (!u) return;
  document.getElementById('profile-name').textContent = u.name;
  document.getElementById('profile-email').textContent = u.email;
  document.getElementById('profile-avatar-letter').textContent = u.name?.charAt(0).toUpperCase();
  document.getElementById('info-name').value = u.name || '';
  document.getElementById('info-email').value = u.email || '';
  document.getElementById('info-phone').value = u.phone || '';
  if (u.avatar_url) {
    document.getElementById('profile-avatar-letter').innerHTML = `<img src="${u.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  }
}
loadUserInfo();

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
