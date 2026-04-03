import { api } from '../api/client.js';
import { requireAdmin, showToast, formatPrice, formatDate } from '../app.js';

if (!requireAdmin()) throw new Error('Admin required');

// ── Tab navigation ─────────────────────────────────────────
const PAGE = document.body.dataset.page || 'dashboard';

// ── Dashboard stats ────────────────────────────────────────
async function loadStats() {
  const el = id => document.getElementById(id);
  try {
    const stats = await api.get('/admin/stats', true);
    el('stat-users') && (el('stat-users').textContent   = stats.total_users.toLocaleString());
    el('stat-products') && (el('stat-products').textContent = stats.total_products.toLocaleString());
    el('stat-orders') && (el('stat-orders').textContent  = stats.total_orders.toLocaleString());
    el('stat-revenue') && (el('stat-revenue').textContent = formatPrice(stats.total_revenue));
    el('stat-pending') && (el('stat-pending').textContent = stats.pending_orders);
    el('stat-paid')    && (el('stat-paid').textContent    = stats.paid_orders);
    el('stat-new-users') && (el('stat-new-users').textContent = stats.new_users_today);
    el('stat-revenue-today') && (el('stat-revenue-today').textContent = formatPrice(stats.revenue_today));
  } catch(e) { showToast('Không tải được thống kê: ' + e.message, 'error'); }
}

// ── Users ──────────────────────────────────────────────────
async function loadUsers(page = 1) {
  const search  = document.getElementById('user-search')?.value || '';
  const role    = document.getElementById('user-role-filter')?.value || '';
  const status  = document.getElementById('user-status-filter')?.value || '';
  const q = new URLSearchParams({ page, page_size: 20, search, role, status });
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const data = await api.get(`/admin/users?${q}`, true);
    if (!data.users.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:40px">Không tìm thấy người dùng</td></tr>';
      return;
    }
    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${u.name.charAt(0)}</div>
          <div><div style="font-weight:600">${u.name}</div><div style="font-size:0.75rem;color:var(--color-text-muted)">${u.email}</div></div>
        </div></td>
        <td>${u.phone || '--'}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-error' : u.role === 'author' ? 'badge-info' : 'badge-accent'}">${u.role}</span></td>
        <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-error'}">${u.status}</span></td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-icon btn-sm" title="Đổi role" onclick="changeUserRole(${u.user_id}, '${u.role}')">✏️</button>
            <button class="btn btn-icon btn-sm" title="${u.status === 'active' ? 'Khóa' : 'Mở khóa'}" onclick="toggleUserStatus(${u.user_id}, '${u.status}')">
              ${u.status === 'active' ? '🔒' : '🔓'}
            </button>
          </div>
        </td>
      </tr>`).join('');
    document.getElementById('users-count').textContent = `Tổng: ${data.total} người dùng`;
    renderTablePagination('users-pagination', data.total, 20, page, loadUsers);
  } catch(e) { showToast(e.message, 'error'); }
}

window.changeUserRole = async (userId, currentRole) => {
  const roles = ['learner', 'author', 'admin'];
  const newRole = prompt(`Đổi role (hiện tại: ${currentRole})\nNhập: learner / author / admin`, currentRole);
  if (!newRole || !roles.includes(newRole) || newRole === currentRole) return;
  try {
    await api.put(`/admin/users/${userId}`, { role: newRole }, true);
    showToast('Cập nhật role thành công', 'success');
    loadUsers();
  } catch(e) { showToast(e.message, 'error'); }
};

window.toggleUserStatus = async (userId, currentStatus) => {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  const confirm = window.confirm(`${newStatus === 'suspended' ? 'Khóa' : 'Mở khóa'} tài khoản này?`);
  if (!confirm) return;
  try {
    await api.put(`/admin/users/${userId}`, { status: newStatus }, true);
    showToast(`Đã ${newStatus === 'suspended' ? 'khóa' : 'mở khóa'} tài khoản`, 'success');
    loadUsers();
  } catch(e) { showToast(e.message, 'error'); }
};

// ── Products ───────────────────────────────────────────────
async function loadProducts(page = 1) {
  const search = document.getElementById('product-search')?.value || '';
  const type   = document.getElementById('product-type-filter')?.value || '';
  const status = document.getElementById('product-status-filter')?.value || '';
  const q = new URLSearchParams({ page, page_size: 20, search, product_type: type, status });
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const data = await api.get(`/admin/products?${q}`, true);
    if (!data.products.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--color-text-muted)">Không có sản phẩm</td></tr>';
      return;
    }
    tbody.innerHTML = data.products.map(p => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <img src="${p.thumbnail_url || ''}" style="width:48px;height:32px;object-fit:cover;border-radius:4px;background:var(--color-bg-glass)">
          <div><div style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
          <div style="font-size:0.75rem;color:var(--color-text-muted)">${p.author_name || '--'}</div></div>
        </div></td>
        <td><span class="badge badge-accent">${p.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook'}</span></td>
        <td>${formatPrice(p.price)}</td>
        <td><span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-error'}">${p.status}</span></td>
        <td>${p.total_enrolled?.toLocaleString() || 0}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-icon btn-sm" onclick="editProduct(${p.product_id})">✏️</button>
            <button class="btn btn-icon btn-sm" onclick="archiveProduct(${p.product_id}, '${p.status}')">
              ${p.status === 'active' ? '🗑' : '♻️'}
            </button>
          </div>
        </td>
      </tr>`).join('');
    document.getElementById('products-count').textContent = `Tổng: ${data.total} sản phẩm`;
    renderTablePagination('products-pagination', data.total, 20, page, loadProducts);
  } catch(e) { showToast(e.message, 'error'); }
}

window.archiveProduct = async (productId, currentStatus) => {
  const action = currentStatus === 'active' ? 'ẩn' : 'kích hoạt lại';
  if (!confirm(`${action} sản phẩm này?`)) return;
  try {
    if (currentStatus === 'active') {
      await api.delete(`/admin/products/${productId}`, true);
      showToast('Đã ẩn sản phẩm', 'success');
    } else {
      await api.put(`/admin/products/${productId}`, { status: 'active' }, true);
      showToast('Đã kích hoạt sản phẩm', 'success');
    }
    loadProducts();
  } catch(e) { showToast(e.message, 'error'); }
};

window.editProduct = (productId) => {
  showEditProductModal(productId);
};

async function showEditProductModal(productId) {
  try {
    const p = await api.get(`/products/${productId}`, true);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:600px">
        <div class="modal__header">
          <div class="modal__title">✏️ Chỉnh sửa sản phẩm</div>
          <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
        </div>
        <form id="edit-product-form">
          <div class="form-group"><label class="form-label">Tên sản phẩm</label>
            <input class="form-control" name="name" value="${p.name}" required></div>
          <div class="form-group"><label class="form-label">Giá (VNĐ)</label>
            <input type="number" class="form-control" name="price" value="${p.price}" required></div>
          <div class="form-group"><label class="form-label">Giá gốc</label>
            <input type="number" class="form-control" name="original_price" value="${p.original_price || ''}"></div>
          <div class="form-group"><label class="form-label">URL Thumbnail</label>
            <input class="form-control" name="thumbnail_url" value="${p.thumbnail_url || ''}"></div>
          <div class="form-group"><label class="form-label">Mô tả ngắn</label>
            <input class="form-control" name="short_description" value="${p.short_description || ''}"></div>
          <div class="form-group"><label class="form-label">Trạng thái</label>
            <select class="form-control" name="status">
              <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select></div>
          <button type="submit" class="btn btn-primary btn-block">Lưu thay đổi</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      try {
        await api.put(`/admin/products/${productId}`, { ...data, price: Number(data.price), original_price: data.original_price ? Number(data.original_price) : null }, true);
        showToast('Cập nhật thành công', 'success');
        overlay.remove();
        loadProducts();
      } catch(err) { showToast(err.message, 'error'); }
    });
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Orders ─────────────────────────────────────────────────
async function loadOrders(page = 1) {
  const status = document.getElementById('order-status-filter')?.value || '';
  const q = new URLSearchParams({ page, page_size: 20, status });
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const data = await api.get(`/admin/orders?${q}`, true);
    if (!data.orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-text-muted)">Không có đơn hàng</td></tr>';
      return;
    }
    tbody.innerHTML = data.orders.map(o => {
      const statusBadge = {
        pending: '<span class="badge badge-warning">⏳ Chờ TT</span>',
        paid: '<span class="badge badge-success">✅ Đã TT</span>',
        cancelled: '<span class="badge badge-error">❌ Hủy</span>',
        refunded: '<span class="badge badge-info">↩ Hoàn tiền</span>',
      };
      return `<tr>
        <td>#${o.order_id}</td>
        <td>User #${o.user_id}</td>
        <td>${o.items.length} sản phẩm</td>
        <td>${formatPrice(o.total_amount)}</td>
        <td>${statusBadge[o.status] || o.status}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>
          ${o.status === 'paid'
            ? `<button class="btn btn-sm btn-danger" onclick="refundOrder(${o.order_id})">↩ Hoàn tiền</button>`
            : ''}
        </td>
      </tr>`;
    }).join('');
    document.getElementById('orders-count').textContent = `Tổng: ${data.total} đơn hàng`;
    renderTablePagination('orders-pagination', data.total, 20, page, loadOrders);
  } catch(e) { showToast(e.message, 'error'); }
}

window.refundOrder = async (orderId) => {
  if (!confirm(`Hoàn tiền đơn hàng #${orderId}? Quyền truy cập nội dung sẽ bị thu hồi.`)) return;
  try {
    await api.post(`/admin/orders/${orderId}/refund`, null, true);
    showToast('Hoàn tiền thành công', 'success');
    loadOrders();
  } catch(e) { showToast(e.message, 'error'); }
};

// ── Create product modal ───────────────────────────────────
window.showCreateProductModal = async () => {
  let cats = [];
  try { cats = await api.get('/products/categories'); } catch {}
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <div class="modal__header">
        <div class="modal__title">➕ Tạo sản phẩm mới</div>
        <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      <form id="create-product-form">
        <div class="form-group"><label class="form-label">Loại <span class="required">*</span></label>
          <select class="form-control" name="product_type" required>
            <option value="course">🎬 Khóa học</option>
            <option value="ebook">📖 Ebook</option>
          </select></div>
        <div class="form-group"><label class="form-label">Tên sản phẩm <span class="required">*</span></label>
          <input class="form-control" name="name" required></div>
        <div class="form-group"><label class="form-label">Danh mục</label>
          <select class="form-control" name="category_id">
            <option value="">-- Chọn danh mục --</option>
            ${cats.map(c => `<option value="${c.category_id}">${c.icon} ${c.name}</option>`).join('')}
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group"><label class="form-label">Giá (VNĐ) <span class="required">*</span></label>
            <input type="number" class="form-control" name="price" min="0" required></div>
          <div class="form-group"><label class="form-label">Giá gốc</label>
            <input type="number" class="form-control" name="original_price" min="0"></div>
        </div>
        <div class="form-group"><label class="form-label">URL Thumbnail</label>
          <input class="form-control" name="thumbnail_url" placeholder="https://..."></div>
        <div class="form-group"><label class="form-label">Mô tả ngắn</label>
          <input class="form-control" name="short_description"></div>
        <button type="submit" class="btn btn-primary btn-block">Tạo sản phẩm</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('create-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.price = Number(data.price);
    if (data.original_price) data.original_price = Number(data.original_price);
    try {
      await api.post('/admin/products', data, true);
      showToast('Tạo sản phẩm thành công! ✅', 'success');
      overlay.remove();
      loadProducts();
    } catch(err) { showToast(err.message, 'error'); }
  });
};

// ── Shared: table pagination ───────────────────────────────
function renderTablePagination(containerId, total, pageSize, current, loadFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = `<span style="font-size:0.85rem;color:var(--color-text-muted)">Trang ${current}/${totalPages}</span>`;
  html += `<button class="page-btn" onclick="(${loadFn.name})(${current - 1})" ${current <= 1 ? 'disabled' : ''}>‹</button>`;
  html += `<button class="page-btn" onclick="(${loadFn.name})(${current + 1})" ${current >= totalPages ? 'disabled' : ''}>›</button>`;
  container.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">${html}</div>`;
}

// ── Init based on page ─────────────────────────────────────
if (PAGE === 'dashboard') loadStats();
if (PAGE === 'users')     { loadUsers(); setupSearchFilter('user-search', loadUsers); }
if (PAGE === 'products')  { loadProducts(); setupSearchFilter('product-search', loadProducts); }
if (PAGE === 'orders')    loadOrders();

function setupSearchFilter(inputId, loadFn) {
  let timer;
  document.getElementById(inputId)?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => loadFn(1), 500);
  });
}

// Filter dropdowns
document.getElementById('user-role-filter')?.addEventListener('change', () => loadUsers(1));
document.getElementById('user-status-filter')?.addEventListener('change', () => loadUsers(1));
document.getElementById('product-type-filter')?.addEventListener('change', () => loadProducts(1));
document.getElementById('product-status-filter')?.addEventListener('change', () => loadProducts(1));
document.getElementById('order-status-filter')?.addEventListener('change', () => loadOrders(1));

// Expose for pagination buttons in HTML context
window.loadUsers    = loadUsers;
window.loadProducts = loadProducts;
window.loadOrders   = loadOrders;
