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

// ── Charts ─────────────────────────────────────────────────
let revenueChartInstance = null;
let currentPeriod = '7';   // '7', '30', 'week', 'month', 'year'

async function waitForChart(maxMs = 5000) {
  const start = Date.now();
  while (typeof Chart === 'undefined') {
    if (Date.now() - start > maxMs) return false;
    await new Promise(r => setTimeout(r, 100));
  }
  return true;
}

async function loadCharts() {
  if (!document.getElementById('revenue-chart')) return;
  const ready = await waitForChart();
  if (!ready) {
    console.warn('Chart.js not loaded after 5s');
    return;
  }

  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

  // Render period filter buttons
  renderPeriodFilter();
  await loadRevenueChart(currentPeriod);
  await loadTopProductsChart();
}

function renderPeriodFilter() {
  const wrap = document.getElementById('revenue-period-filter');
  if (!wrap) return;
  const periods = [
    { value: '7',      label: '7 ngày' },
    { value: '30',     label: '30 ngày' },
    { value: 'week',   label: 'Tuần này' },
    { value: 'month',  label: 'Tháng này' },
    { value: 'year',   label: 'Năm này' },
  ];
  wrap.innerHTML = periods.map(p =>
    `<button class="btn btn-sm ${p.value === currentPeriod ? 'btn-primary' : 'btn-secondary'}"
      onclick="switchPeriod('${p.value}')">${p.label}</button>`
  ).join('');
}

window.switchPeriod = async (period) => {
  currentPeriod = period;
  renderPeriodFilter();
  await loadRevenueChart(period);
};

async function loadRevenueChart(period) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;

  // Build query params
  let endpoint;
  if (period === 'week' || period === 'month' || period === 'year') {
    endpoint = `/admin/stats/revenue-chart?period=${period}`;
  } else {
    endpoint = `/admin/stats/revenue-chart?days=${period}`;
  }

  // Show loading
  const box = canvas.closest('.chart-container') || canvas.parentElement;
  const origContent = box.innerHTML;

  try {
    const revenueData = await api.get(endpoint, true);
    if (revenueChartInstance) {
      revenueChartInstance.destroy();
      revenueChartInstance = null;
    }
    if (!revenueData || revenueData.length === 0) {
      canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:260px;color:var(--color-text-muted)">Chưa có dữ liệu doanh thu</div>';
      return;
    }
    revenueChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: revenueData.map(d => d.date),
        datasets: [{
          label: 'Doanh thu (đ)',
          data: revenueData.map(d => d.revenue),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `  ${new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(ctx.raw)}`
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            beginAtZero: true,
            ticks: { callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : (v/1000).toFixed(0)+'K' }
          }
        }
      }
    });
  } catch(e) {
    console.warn('Revenue chart error:', e);
    const parent = document.getElementById('revenue-chart')?.parentElement;
    if (parent) parent.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--color-error);font-size:0.875rem">❌ Lỗi tải dữ liệu: ${e.message}</div>`;
  }
}

async function loadTopProductsChart() {
  try {
    const topData = await api.get('/admin/stats/top-products?limit=5', true);
    const topCanvas = document.getElementById('top-products-chart');
    const tableWrap = document.getElementById('top-products-table');

    if (!topData || topData.length === 0) {
      if (tableWrap) tableWrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--color-text-muted)">Chưa có dữ liệu sản phẩm</div>';
      return;
    }

    // Always render table (more reliable than chart canvas)
    if (tableWrap) {
      tableWrap.innerHTML = `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="font-size:0.75rem;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">
            <th style="padding:8px 12px;text-align:left;font-weight:600">#</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600">Sản phẩm</th>
            <th style="padding:8px 12px;text-align:center;font-weight:600">Loại</th>
            <th style="padding:8px 12px;text-align:right;font-weight:600">Học viên</th>
            <th style="padding:8px 12px;text-align:right;font-weight:600">Rating</th>
          </tr></thead>
          <tbody>
          ${topData.map((p, i) => `
            <tr style="border-bottom:1px solid var(--color-border-muted);transition:background 0.15s" onmouseenter="this.style.background='var(--color-bg-tertiary)'" onmouseleave="this.style.background=''">
              <td style="padding:12px;font-weight:800;color:${['#f59e0b','#94a3b8','#cd7f32','#64748b','#64748b'][i]};font-size:1rem">${['🥇','🥈','🥉','4','5'][i]}</td>
              <td style="padding:12px">
                <div style="font-weight:600;font-size:0.875rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
              </td>
              <td style="padding:12px;text-align:center">
                <span class="badge ${p.product_type === 'course' ? 'badge-accent' : 'badge-info'}">${p.product_type === 'course' ? '🎬' : '📖'}</span>
              </td>
              <td style="padding:12px;text-align:right;font-weight:700">${p.total_enrolled.toLocaleString()}</td>
              <td style="padding:12px;text-align:right;color:var(--color-warning);font-weight:700">★ ${p.average_rating.toFixed(1)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }

    // Also render bar chart if canvas exists
    if (topCanvas && topCanvas.getContext) {
      const colors = ['#f59e0b','#94a3b8','#cd7f32','#6366f1','#10b981'];
      new Chart(topCanvas, {
        type: 'bar',
        data: {
          labels: topData.map(p => p.name.length > 18 ? p.name.slice(0,18)+'…' : p.name),
          datasets: [{
            label: 'Học viên',
            data: topData.map(p => p.total_enrolled),
            backgroundColor: colors,
            borderRadius: 8,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
            y: { grid: { display: false } }
          }
        }
      });
    }
  } catch(e) { console.warn('Top products error:', e); }
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
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const data = await api.get(`/admin/products?${q}`, true);
    if (!data.products.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-text-muted)">Không có sản phẩm</td></tr>';
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
            <button class="btn btn-icon btn-sm" title="Sửa thông tin" onclick="editProduct(${p.product_id})">✏️</button>
            ${p.product_type === 'course' ? `<button class="btn btn-icon btn-sm" title="Quản lý nội dung" onclick="manageContent(${p.product_id}, '${p.name.replace(/'/g, '')}')">📋</button>` : ''}
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

window.editProduct = (productId) => { showEditProductModal(productId); };

async function showEditProductModal(productId) {
  try {
    const p = await api.get(`/products/${productId}`, true);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:620px">
        <div class="modal__header">
          <div class="modal__title">✏️ Chỉnh sửa sản phẩm</div>
          <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
        </div>
        <form id="edit-product-form" style="max-height:75vh;overflow-y:auto;padding-right:4px">
          <div class="form-group"><label class="form-label">Tên sản phẩm</label>
            <input class="form-control" name="name" value="${p.name}" required></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group"><label class="form-label">Giá (VNĐ)</label>
              <input type="number" class="form-control" name="price" value="${p.price}" required></div>
            <div class="form-group"><label class="form-label">Giá gốc</label>
              <input type="number" class="form-control" name="original_price" value="${p.original_price || ''}"></div>
          </div>
          <div class="form-group"><label class="form-label">URL Thumbnail</label>
            <input class="form-control" name="thumbnail_url" value="${p.thumbnail_url || ''}"></div>
          <div class="form-group"><label class="form-label">Mô tả ngắn</label>
            <input class="form-control" name="short_description" value="${p.short_description || ''}"></div>
          <div class="form-group"><label class="form-label">Mô tả đầy đủ</label>
            <textarea class="form-control" name="description" rows="3" style="resize:vertical">${p.description || ''}</textarea></div>
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
        await api.put(`/admin/products/${productId}`, {
          ...data,
          price: Number(data.price),
          original_price: data.original_price ? Number(data.original_price) : null,
        }, true);
        showToast('Cập nhật thành công', 'success');
        overlay.remove();
        loadProducts();
      } catch(err) { showToast(err.message, 'error'); }
    });
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Course Content Manager ─────────────────────────────────
window.manageContent = async (productId, productName) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'content-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:780px;width:95%">
      <div class="modal__header">
        <div class="modal__title">📋 Nội dung: ${productName}</div>
        <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      <div id="content-body" style="max-height:70vh;overflow-y:auto;padding:0 4px">
        <div class="loading-overlay"><div class="spinner" style="margin:auto"></div></div>
      </div>
      <div style="padding:20px;border-top:1px solid var(--color-border);display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="showAddModuleForm(${productId})">➕ Thêm Module</button>
        <span style="color:var(--color-text-muted);font-size:0.8rem;align-self:center">Nhấn 📝 để sửa, 🗑 để xóa module/lesson</span>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  await _reloadContent(productId);
};

async function _reloadContent(productId) {
  const body = document.getElementById('content-body');
  if (!body) return;
  body.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner" style="margin:auto"></div></div>';
  try {
    const data = await api.get(`/admin/courses/${productId}/content`, true);
    if (!data.modules || data.modules.length === 0) {
      body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--color-text-muted)">
        <div style="font-size:2rem;margin-bottom:12px">📭</div>
        <div>Chưa có module nào. Nhấn "Thêm Module" để bắt đầu.</div>
      </div>`;
      body.dataset.pid = productId;
      return;
    }
    body.dataset.pid = productId;
    body.innerHTML = data.modules.map((m, mIdx) => `
      <div style="margin-bottom:16px;border:1px solid var(--color-border);border-radius:10px;overflow:hidden">
        <div style="padding:14px 16px;background:var(--color-bg-glass);display:flex;align-items:center;gap:10px">
          <span style="font-weight:700;flex:1">📁 ${m.title}</span>
          <span style="font-size:0.75rem;color:var(--color-text-muted)">${m.lessons.length} bài</span>
          <button class="btn btn-sm btn-secondary" onclick="showAddLessonForm(${m.module_id}, ${productId})">+ Bài học</button>
          <button class="btn btn-sm btn-ghost" title="Sửa module" onclick="editModuleInline(${m.module_id}, '${m.title.replace(/'/g,'')}', ${productId})">📝</button>
          <button class="btn btn-sm btn-ghost" title="Xóa module" onclick="deleteModule(${m.module_id}, ${productId})" style="color:var(--color-error)">🗑</button>
        </div>
        <div style="padding:8px 0">
          ${m.lessons.length === 0 ? `<div style="padding:12px 20px;font-size:0.85rem;color:var(--color-text-muted)">Chưa có bài học</div>` :
            m.lessons.map((l, lIdx) => `
            <div style="padding:10px 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.04)">
              <span style="font-size:0.75rem;color:var(--color-text-muted);width:24px;text-align:center">${lIdx+1}</span>
              <span style="flex:1;font-size:0.9rem">${l.title}</span>
              ${l.mux_playback_id ? `<span style="font-size:0.7rem;background:rgba(99,102,241,0.2);color:var(--color-accent-light);padding:2px 8px;border-radius:4px">🎬 ${l.mux_playback_id.slice(0,12)}...</span>` :
                `<span style="font-size:0.7rem;color:var(--color-text-muted);background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px">⚠️ Chưa có video</span>`}
              ${l.is_preview ? `<span style="font-size:0.7rem;color:var(--color-accent)">preview</span>` : ''}
              <span style="font-size:0.75rem;color:var(--color-text-muted)">${l.duration ? Math.round(l.duration/60)+'m' : '--'}</span>
              <button class="btn btn-sm btn-ghost" title="Sửa lesson" onclick="editLessonModal(${l.lesson_id}, '${l.title.replace(/'/g,'')}', '${l.mux_playback_id || ''}', ${l.duration||0}, ${l.is_preview}, ${productId})">✏️</button>
              <button class="btn btn-sm btn-ghost" title="Xóa" onclick="deleteLesson(${l.lesson_id}, ${productId})" style="color:var(--color-error)">🗑</button>
            </div>`).join('')}
        </div>
      </div>`).join('');
  } catch(e) {
    if(body) body.innerHTML = `<div style="padding:20px;color:var(--color-error)">❌ ${e.message}</div>`;
  }
}

window.showAddModuleForm = (productId) => {
  const name = prompt('Tên module mới:');
  if (!name) return;
  api.post(`/admin/courses/${productId}/modules?title=${encodeURIComponent(name)}&sort_order=0`, null, true)
    .then(() => { showToast('Đã thêm module ✅', 'success'); _reloadContent(productId); })
    .catch(e => showToast(e.message, 'error'));
};

window.showAddLessonForm = (moduleId, productId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '600';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal__header">
        <div class="modal__title">➕ Thêm bài học mới</div>
        <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      <form id="add-lesson-form">
        <div class="form-group"><label class="form-label">Tên bài học <span style="color:var(--color-error)">*</span></label>
          <input class="form-control" name="title" placeholder="VD: Giới thiệu về FastAPI" required></div>
        <div class="form-group">
          <label class="form-label">Mux Playback ID</label>
          <input class="form-control" name="mux_playback_id" placeholder="VD: qU1jw1sfGTK...">
          <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:6px">
            💡 Lấy từ <a href="https://dashboard.mux.com" target="_blank" style="color:var(--color-accent-light)">Mux Dashboard → Tài sản → Playback ID</a>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group"><label class="form-label">Thời lượng (giây)</label>
            <input type="number" class="form-control" name="duration" value="0" min="0"></div>
          <div class="form-group"><label class="form-label">Thứ tự</label>
            <input type="number" class="form-control" name="sort_order" value="0" min="0"></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="is-preview-check" name="is_preview">
          <label for="is-preview-check" class="form-label" style="margin:0">Cho xem thử miễn phí</label>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Thêm bài học</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('add-lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const q = new URLSearchParams({
      title: fd.get('title'),
      mux_playback_id: fd.get('mux_playback_id') || '',
      duration: fd.get('duration') || 0,
      sort_order: fd.get('sort_order') || 0,
      is_preview: fd.get('is_preview') === 'on' ? 'true' : 'false',
    });
    try {
      await api.post(`/admin/modules/${moduleId}/lessons?${q}`, null, true);
      showToast('Đã thêm bài học ✅', 'success');
      overlay.remove();
      _reloadContent(productId);
    } catch(err) { showToast(err.message, 'error'); }
  });
};

window.editModuleInline = async (moduleId, currentTitle, productId) => {
  const newTitle = prompt('Sửa tên module:', currentTitle);
  if (!newTitle || newTitle === currentTitle) return;
  try {
    await api.put(`/admin/modules/${moduleId}?title=${encodeURIComponent(newTitle)}`, null, true);
    showToast('Đã cập nhật module', 'success');
    _reloadContent(productId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteModule = async (moduleId, productId) => {
  if (!confirm('Xóa module này và toàn bộ bài học trong đó?')) return;
  try {
    await api.delete(`/admin/modules/${moduleId}`, true);
    showToast('Đã xóa module', 'success');
    _reloadContent(productId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.editLessonModal = (lessonId, title, muxId, duration, isPreview, productId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '600';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal__header">
        <div class="modal__title">✏️ Sửa bài học</div>
        <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      <form id="edit-lesson-form">
        <div class="form-group"><label class="form-label">Tên bài học</label>
          <input class="form-control" name="title" value="${title}" required></div>
        <div class="form-group">
          <label class="form-label">Mux Playback ID</label>
          <input class="form-control" name="mux_playback_id" value="${muxId}" placeholder="Để trống = chưa có video">
          <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:6px">
            💡 Lấy từ <a href="https://dashboard.mux.com" target="_blank" style="color:var(--color-accent-light)">Mux Dashboard</a>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Thời lượng (giây)</label>
          <input type="number" class="form-control" name="duration" value="${duration}" min="0"></div>
        <div class="form-group" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="edit-preview-check" name="is_preview" ${isPreview ? 'checked' : ''}>
          <label for="edit-preview-check" class="form-label" style="margin:0">Cho xem thử miễn phí</label>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Lưu thay đổi</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('edit-lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const q = new URLSearchParams({
      title: fd.get('title'),
      mux_playback_id: fd.get('mux_playback_id') || '',
      duration: fd.get('duration') || 0,
      is_preview: fd.get('is_preview') === 'on' ? 'true' : 'false',
    });
    try {
      await api.put(`/admin/lessons/${lessonId}?${q}`, null, true);
      showToast('Cập nhật bài học thành công ✅', 'success');
      overlay.remove();
      _reloadContent(productId);
    } catch(err) { showToast(err.message, 'error'); }
  });
};

window.deleteLesson = async (lessonId, productId) => {
  if (!confirm('Xóa bài học này?')) return;
  try {
    await api.delete(`/admin/lessons/${lessonId}`, true);
    showToast('Đã xóa bài học', 'success');
    _reloadContent(productId);
  } catch(e) { showToast(e.message, 'error'); }
};

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

// ── Coupons ────────────────────────────────────────────────
async function loadCoupons() {
  const tbody = document.getElementById('coupons-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const data = await api.get('/admin/coupons', true);
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--color-text-muted)">Chưa có mã giảm giá nào</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(c => `
      <tr>
        <td><code style="background:var(--color-bg-tertiary);padding:4px 10px;border-radius:6px;font-weight:700;color:var(--color-accent);border:1px solid var(--color-border-accent)">${c.code}</code></td>
        <td>${c.discount_type === 'percent' ? c.discount + '%' : formatPrice(c.discount)}</td>
        <td><span class="badge ${c.discount_type === 'percent' ? 'badge-accent' : 'badge-success'}">${c.discount_type === 'percent' ? 'Phần trăm' : 'Cố định'}</span></td>
        <td>${c.min_order_amount > 0 ? formatPrice(c.min_order_amount) : '--'}</td>
        <td>${c.usage_limit ? c.used_count + ' / ' + c.usage_limit : c.used_count + ' / ∞'}</td>
        <td><span class="badge ${!c.expired_date || new Date(c.expired_date) > new Date() ? 'badge-success' : 'badge-error'}">${!c.expired_date || new Date(c.expired_date) > new Date() ? 'Còn hạn' : 'Hết hạn'}</span></td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteCoupon('${c.code}')">🗑 Xóa</button>
        </td>
      </tr>`).join('');
  } catch(e) { showToast(e.message, 'error'); }
}

window.deleteCoupon = async (code) => {
  if (!confirm(`Xóa mã giảm giá "${code}"?`)) return;
  try {
    await api.delete(`/admin/coupons/${encodeURIComponent(code)}`, true);
    showToast('Đã xóa coupon', 'success');
    loadCoupons();
  } catch(e) { showToast(e.message, 'error'); }
};

// ── Create product modal ───────────────────────────────────
window.showCreateProductModal = async () => {
  let cats = [];
  try { cats = await api.get('/products/categories'); } catch {}
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:660px">
      <div class="modal__header">
        <div class="modal__title">➕ Tạo sản phẩm mới</div>
        <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      <form id="create-product-form" style="max-height:78vh;overflow-y:auto;padding-right:4px">
        <div class="form-group"><label class="form-label">Loại <span style="color:var(--color-error)">*</span></label>
          <select class="form-control" name="product_type" id="cp-type" required>
            <option value="course">🎬 Khóa học</option>
            <option value="ebook">📖 Ebook</option>
          </select></div>
        <div class="form-group"><label class="form-label">Tên sản phẩm <span style="color:var(--color-error)">*</span></label>
          <input class="form-control" name="name" required placeholder="VD: Lập trình Python từ cơ bản đến nâng cao"></div>
        <div class="form-group"><label class="form-label">Danh mục</label>
          <select class="form-control" name="category_id">
            <option value="">-- Chọn danh mục --</option>
            ${cats.map(c => `<option value="${c.category_id}">${c.icon} ${c.name}</option>`).join('')}
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group"><label class="form-label">Giá (VNĐ) <span style="color:var(--color-error)">*</span></label>
            <input type="number" class="form-control" name="price" min="0" required></div>
          <div class="form-group"><label class="form-label">Giá gốc</label>
            <input type="number" class="form-control" name="original_price" min="0"></div>
        </div>
        <div class="form-group"><label class="form-label">URL Thumbnail</label>
          <input class="form-control" name="thumbnail_url" placeholder="https://..."></div>
        <div class="form-group"><label class="form-label">Mô tả ngắn</label>
          <input class="form-control" name="short_description" placeholder="1-2 câu mô tả nổi bật"></div>
        <div class="form-group"><label class="form-label">Mô tả đầy đủ</label>
          <textarea class="form-control" name="description" rows="3" style="resize:vertical" placeholder="Chi tiết về khóa học, nội dung học..."></textarea></div>

        <!-- Course-specific fields -->
        <div id="course-fields">
          <div style="margin:8px 0 16px;padding:12px;background:rgba(99,102,241,0.08);border-radius:8px;border:1px solid rgba(99,102,241,0.2)">
            <div style="font-weight:600;margin-bottom:12px;color:var(--color-accent-light)">🎬 Thông tin khóa học</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group"><label class="form-label">Cấp độ</label>
                <select class="form-control" name="level">
                  <option value="">-- Chọn --</option>
                  <option value="beginner">🟢 Cơ bản</option>
                  <option value="intermediate">🟡 Trung cấp</option>
                  <option value="advanced">🔴 Nâng cao</option>
                </select></div>
              <div class="form-group"><label class="form-label">Tổng thời lượng (phút)</label>
                <input type="number" class="form-control" name="duration" min="0" value="0"></div>
            </div>
            <div class="form-group"><label class="form-label">Yêu cầu đầu vào (mỗi dòng một yêu cầu)</label>
              <textarea class="form-control" name="requirements" rows="2" style="resize:vertical" placeholder="VD: Biết Python cơ bản&#10;Đã cài đặt VS Code"></textarea></div>
            <div class="form-group"><label class="form-label">Học xong bạn sẽ biết (mỗi dòng một kỹ năng)</label>
              <textarea class="form-control" name="what_you_learn" rows="3" style="resize:vertical" placeholder="VD: Xây dựng REST API bằng FastAPI&#10;Deploy lên cloud"></textarea></div>
          </div>
        </div>

        <!-- Ebook-specific fields -->
        <div id="ebook-fields" style="display:none">
          <div style="margin:8px 0 16px;padding:12px;background:rgba(168,85,247,0.08);border-radius:8px;border:1px solid rgba(168,85,247,0.2)">
            <div style="font-weight:600;margin-bottom:12px;color:#a855f7">📖 Thông tin Ebook</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
              <div class="form-group"><label class="form-label">Định dạng</label>
                <select class="form-control" name="format">
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                </select></div>
              <div class="form-group"><label class="form-label">Số trang</label>
                <input type="number" class="form-control" name="page_count" min="0"></div>
              <div class="form-group"><label class="form-label">Dung lượng (MB)</label>
                <input type="number" class="form-control" name="file_size" min="0" step="0.1"></div>
            </div>
          </div>
        </div>

        <div class="form-group"><label class="form-label">Trạng thái</label>
          <select class="form-control" name="status">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select></div>
        <button type="submit" class="btn btn-primary btn-block">Tạo sản phẩm</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  // Toggle fields based on type
  document.getElementById('cp-type').addEventListener('change', function() {
    document.getElementById('course-fields').style.display = this.value === 'course' ? 'block' : 'none';
    document.getElementById('ebook-fields').style.display = this.value === 'ebook' ? 'block' : 'none';
  });

  document.getElementById('create-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const raw = Object.fromEntries(fd.entries());
    const data = {
      product_type: raw.product_type,
      name: raw.name,
      price: Number(raw.price),
      status: raw.status,
    };
    if (raw.original_price) data.original_price = Number(raw.original_price);
    if (raw.category_id) data.category_id = Number(raw.category_id);
    if (raw.thumbnail_url) data.thumbnail_url = raw.thumbnail_url;
    if (raw.short_description) data.short_description = raw.short_description;
    if (raw.description) data.description = raw.description;

    if (raw.product_type === 'course') {
      if (raw.level) data.level = raw.level;
      if (raw.duration) data.duration = Number(raw.duration) * 60; // mins → seconds
      if (raw.requirements) {
        const lines = raw.requirements.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length) data.requirements = JSON.stringify(lines);
      }
      if (raw.what_you_learn) {
        const lines = raw.what_you_learn.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length) data.what_you_learn = JSON.stringify(lines);
      }
    } else {
      if (raw.format) data.format = raw.format;
      if (raw.page_count) data.page_count = Number(raw.page_count);
      if (raw.file_size) data.file_size = Number(raw.file_size);
    }

    try {
      const result = await api.post('/admin/products', data, true);
      showToast('Tạo sản phẩm thành công! ✅', 'success');
      overlay.remove();
      loadProducts();
      // Prompt to add content if it's a course
      if (raw.product_type === 'course') {
        setTimeout(() => {
          if (confirm('Bạn có muốn thêm Module/Lesson cho khóa học này ngay?')) {
            manageContent(result.product_id, data.name);
          }
        }, 300);
      }
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
if (PAGE === 'dashboard') { loadStats(); loadCharts(); }
if (PAGE === 'users')     { loadUsers(); setupSearchFilter('user-search', loadUsers); }
if (PAGE === 'products')  { loadProducts(); setupSearchFilter('product-search', loadProducts); }
if (PAGE === 'orders')    loadOrders();
if (PAGE === 'coupons')   loadCoupons();

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
window.loadCoupons  = loadCoupons;
