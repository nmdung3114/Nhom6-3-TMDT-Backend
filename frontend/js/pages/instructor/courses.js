import { api } from '../../api/client.js';
import { AppState } from '../../app.js';

let currentStatus = '';
let currentPage = 1;

export async function loadCourses(status = '', page = 1) {
  const list = document.getElementById('course-list');
  list.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:12px;color:var(--color-text-muted)"><div class="spinner spinner-sm"></div> Đang tải...</div>`;

  try {
    const params = new URLSearchParams({ page, page_size: 10 });
    if (status) params.set('status', status);
    const data = await api.get(`/instructor/courses?${params}`, true);

    // Update stats
    const stats = { total: 0, active: 0, pending: 0, draft: 0, enrolled: 0 };
    if (!status) {
      stats.total = data.total;
      data.products.forEach(c => {
        if (c.status === 'active') stats.active++;
        else if (c.status === 'pending_approval') stats.pending++;
        else if (c.status === 'draft') stats.draft++;
        stats.enrolled += (c.total_enrolled || 0);
      });
      document.getElementById('stat-total').textContent = data.total;
      document.getElementById('stat-active').textContent = stats.active;
      document.getElementById('stat-pending').textContent = stats.pending;
      document.getElementById('stat-draft').textContent = stats.draft;
      document.getElementById('stat-enrolled').textContent = stats.enrolled;
    }

    if (!data.products.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📭</div><p>Không có khóa học nào${status ? ` ở trạng thái này` : ''}</p><a href="/instructor/course-editor.html" class="btn btn-primary" style="margin-top:16px">+ Tạo khóa học mới</a></div>`;
      return;
    }

    const statusMap = {
      draft: ['status-draft', '📝 Bản nháp'],
      pending_approval: ['status-pending', '⏳ Chờ duyệt'],
      active: ['status-active', '✅ Đang bán'],
      rejected: ['status-rejected', '❌ Bị từ chối'],
      inactive: ['status-inactive', '🚫 Đã ẩn'],
    };

    list.innerHTML = data.products.map(c => {
      const [cls, label] = statusMap[c.status] || ['status-inactive', c.status];
      const canEdit = ['draft', 'rejected'].includes(c.status);
      const canSubmit = ['draft', 'rejected'].includes(c.status);
      const rejectionHtml = c.status === 'rejected' && c.rejection_reason
        ? `<div class="rejection-alert">💬 Lý do từ chối: ${c.rejection_reason}</div>` : '';

      return `
      <div class="course-card">
        <img class="course-card__thumb" src="${c.thumbnail_url || '/images/placeholder.jpg'}" onerror="this.src='/images/placeholder.jpg'" alt="${c.name}">
        <div class="course-card__body">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="status-badge ${cls}">${label}</span>
            <span style="font-size:0.75rem;color:var(--color-text-muted)">${c.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook'}</span>
          </div>
          <div class="course-card__title">${c.name}</div>
          <div class="course-card__meta">
            <span>💰 ${Number(c.price).toLocaleString('vi-VN')}đ</span>
            ${c.level ? `<span>📊 ${c.level}</span>` : ''}
            ${c.duration ? `<span>⏱ ${Math.round(c.duration/60)}h</span>` : ''}
            <span>👥 ${c.total_enrolled || 0} học viên</span>
            <span>⭐ ${Number(c.average_rating || 0).toFixed(1)}</span>
          </div>
          ${rejectionHtml}
        </div>
        <div class="course-card__actions">
          ${canEdit ? `<a href="/instructor/course-editor.html?id=${c.product_id}" class="btn btn-sm btn-secondary">✏️ Sửa</a>` : `<a href="/instructor/course-editor.html?id=${c.product_id}" class="btn btn-sm btn-ghost">👁 Xem</a>`}
          ${canSubmit ? `<button class="btn btn-sm btn-primary" onclick="submitCourse(${c.product_id}, this)">🚀 Gửi duyệt</button>` : ''}
        </div>
      </div>`;
    }).join('');

    const totalPages = Math.ceil(data.total / 10);
    renderPagination(page, totalPages);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><p>${err.message || 'Lỗi tải dữ liệu'}</p></div>`;
  }
}

export function renderPagination(page, total) {
  const el = document.getElementById('pagination');
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-secondary'}" onclick="goPage(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

window.goPage = function(page) {
  currentPage = page;
  loadCourses(currentStatus, page);
};

window.submitCourse = async function(id, btn) {
  const isConfirmed = await window.app.showConfirm('Gửi duyệt', 'Gửi khóa học này lên để Admin kiểm duyệt?');
  if (!isConfirmed) return;
  btn.disabled = true;
  btn.textContent = '⏳ Đang gửi...';
  try {
    await api.post(`/instructor/courses/${id}/submit`, null, true);
    app.showToast('Đã gửi khóa học lên kiểm duyệt! 🚀', 'success');
    loadCourses(currentStatus, currentPage);
  } catch (err) {
    app.showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = '🚀 Gửi duyệt';
  }
};

export function setupCourses() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.replace('btn-primary', 'btn-secondary'));
      btn.classList.replace('btn-secondary', 'btn-primary');
      currentStatus = btn.dataset.status;
      currentPage = 1;
      loadCourses(currentStatus);
    });
  });

  window.addEventListener('app:ready', () => {
    const user = AppState.user;
    if (!user || !['author', 'admin'].includes(user.role)) {
      window.location.href = '/';
      return;
    }
    loadCourses();
  });
}

setupCourses();
