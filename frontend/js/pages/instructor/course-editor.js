import { api } from '../../api/client.js';
import { AppState } from '../../app.js';

window._api = api;

const params = new URLSearchParams(location.search);
const productId = params.get('id');
let courseData = null;
let isReadOnly = false;

// Load categories
async function loadCategories() {
  const cats = await api.get('/products/categories');
  const sel = document.getElementById('f-category');
  sel.innerHTML = '<option value="">-- Chọn danh mục --</option>' +
    cats.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
}

// Load existing course if editing
async function loadCourse() {
  if (!productId) return;
  document.getElementById('page-title').textContent = '✏️ Chỉnh sửa khóa học';
  document.getElementById('btn-save-draft').textContent = '💾 Lưu thay đổi';

  try {
    const data = await api.get(`/instructor/courses/${productId}`, true);
    courseData = data;

    document.getElementById('f-name').value = data.name || '';
    document.getElementById('f-price').value = data.price || '';
    document.getElementById('f-original-price').value = data.original_price || '';
    document.getElementById('f-type').value = data.product_type || 'course';
    document.getElementById('f-thumbnail').value = data.thumbnail_url || '';
    document.getElementById('f-short-desc').value = data.short_description || '';
    document.getElementById('f-desc').value = data.description || '';
    if (data.course) {
      document.getElementById('f-level').value = data.course.level || '';
      document.getElementById('f-learn').value = data.course.what_you_learn || '';
      document.getElementById('f-requirements').value = data.course.requirements || '';
    }
    if (data.category_id) {
      document.getElementById('f-category').value = data.category_id;
    }
    updateThumbPreview(data.thumbnail_url);

    // Status handling
    const status = data.status;
    isReadOnly = status === 'pending_approval';

    const statusInfo = {
      draft: ['📝 Bản nháp', '#6366f1'],
      pending_approval: ['⏳ Chờ duyệt', '#f59e0b'],
      active: ['✅ Đang bán', '#22c55e'],
      rejected: ['❌ Bị từ chối', '#ef4444'],
      inactive: ['🚫 Đã ẩn', '#9ca3af'],
    };
    const [slabel, scolor] = statusInfo[status] || [status, '#9ca3af'];
    const badge = document.getElementById('status-badge');
    badge.style.display = 'inline-block';
    badge.innerHTML = `<span style="background:${scolor}20;color:${scolor};padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600">${slabel}</span>`;

    // Banners
    const banner = document.getElementById('status-banner');
    if (status === 'pending_approval') {
      banner.innerHTML = `<div class="status-banner banner-pending">⏳ <strong>Đang chờ Admin kiểm duyệt.</strong> Bạn không thể chỉnh sửa trong thời gian này.</div>`;
      document.getElementById('btn-save-draft').disabled = true;
      document.getElementById('curriculum-locked-banner').style.display = 'flex';
    } else if (status === 'active') {
      banner.innerHTML = `<div class="status-banner banner-active">✅ <strong>Khóa học đang bán trên hệ thống.</strong> Nếu bạn lưu thay đổi, khóa học sẽ tạm ẩn và chờ Admin duyệt lại.</div>`;
    } else if (status === 'rejected') {
      banner.innerHTML = `<div class="status-banner banner-rejected">❌ <strong>Khóa học bị từ chối.</strong>${data.rejection_reason ? ` Lý do: <em>${data.rejection_reason}</em>` : ''} Hãy sửa và gửi duyệt lại.</div>`;
    }

    if (['draft', 'rejected'].includes(status)) {
      document.getElementById('btn-submit').style.display = 'inline-flex';
    }

    if (data.product_type === 'course') {
      renderModules(data.course?.modules || []);
    }
  } catch (err) {
    app.showToast('Không thể tải khóa học: ' + err.message, 'error');
  }
}

function updateThumbPreview(url) {
  const preview = document.getElementById('thumb-preview');
  const img = document.getElementById('thumb-img');
  if (url) { img.src = url; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
}
document.getElementById('f-thumbnail').addEventListener('input', e => updateThumbPreview(e.target.value));

window.switchTab = function(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
};

// Save course
window.saveCourse = async function() {
  const btn = document.getElementById('btn-save-draft');
  btn.disabled = true;
  const origText = btn.textContent;
  btn.innerHTML = '<div class="spinner-sm" style="display:inline-block;margin-right:6px"></div> Đang lưu...';

  const payload = {
    name: document.getElementById('f-name').value.trim(),
    price: parseFloat(document.getElementById('f-price').value) || 0,
    original_price: parseFloat(document.getElementById('f-original-price').value) || null,
    description: document.getElementById('f-desc').value.trim() || null,
    short_description: document.getElementById('f-short-desc').value.trim() || null,
    thumbnail_url: document.getElementById('f-thumbnail').value.trim() || null,
    category_id: parseInt(document.getElementById('f-category').value) || null,
    product_type: document.getElementById('f-type').value,
    level: document.getElementById('f-level').value || null,
    what_you_learn: document.getElementById('f-learn').value.trim() || null,
    requirements: document.getElementById('f-requirements').value.trim() || null,
  };

  if (!payload.name) { app.showToast('Vui lòng nhập tên khóa học', 'error'); btn.disabled = false; btn.textContent = origText; return; }

  try {
    if (productId) {
      await api.put(`/instructor/courses/${productId}`, payload, true);
      app.showToast('Đã lưu thay đổi! ✅', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      const res = await api.post('/instructor/courses', payload, true);
      app.showToast('Tạo khóa học thành công! Tiếp tục thêm bài học 📚', 'success');
      setTimeout(() => { location.href = `/instructor/course-editor.html?id=${res.product_id}`; }, 1000);
    }
  } catch (err) {
    app.showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
};

window.submitForReview = async function() {
  if (!productId) { app.showToast('Hãy lưu khóa học trước', 'error'); return; }
  const isConfirmed = await window.app.showConfirm('Gửi kiểm duyệt', 'Gửi khóa học này lên để Admin kiểm duyệt? Bạn sẽ không thể chỉnh sửa cho đến khi có kết quả.');
  if (!isConfirmed) return;
  try {
    await api.post(`/instructor/courses/${productId}/submit`, null, true);
    app.showToast('Đã gửi kiểm duyệt! Admin sẽ xem xét sớm 🚀', 'success');
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    app.showToast(err.message, 'error');
  }
};

// ── Curriculum ──
function renderModules(modules) {
  const container = document.getElementById('modules-container');
  if (!modules.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-muted)">Chưa có chương nào. Bấm "+ Thêm Chương mới" để bắt đầu.</div>`;
    return;
  }
  container.innerHTML = modules.map((m, mi) => renderModuleHTML(m, mi)).join('');
}

function renderModuleHTML(m, mi) {
  const lessons = (m.lessons || []).map((l, li) => `
    <div class="lesson-item" id="lesson-${l.lesson_id}">
      <span style="color:var(--color-text-muted);font-size:0.8rem;width:20px">${li+1}</span>
      <span style="font-size:0.85rem">🎬</span>
      <span style="flex:1;font-size:0.88rem">${l.title}</span>
      <span style="font-size:0.78rem;color:var(--color-text-muted)">${l.duration ? Math.round(l.duration/60)+'m' : '--'}</span>
      ${!isReadOnly ? `<button class="btn btn-ghost btn-sm" onclick="deleteLesson(${l.lesson_id})" title="Xóa">🗑</button>` : ''}
    </div>`).join('');

  const addRow = !isReadOnly ? `
    <div class="add-lesson-row">
      <input id="new-lesson-${m.module_id}" placeholder="Tên bài học mới..." onkeydown="if(event.key==='Enter')addLesson(${m.module_id})">
      <button class="btn btn-sm btn-secondary" onclick="addLesson(${m.module_id})">+ Thêm bài</button>
    </div>` : '';

  return `
  <div class="module-card" id="module-${m.module_id}">
    <div class="module-header">
      <span style="color:var(--color-text-muted)">📂</span>
      <span style="font-weight:600;flex:1">Chương ${mi+1}: ${m.title}</span>
      <span style="font-size:0.8rem;color:var(--color-text-muted)">${(m.lessons||[]).length} bài</span>
      ${!isReadOnly ? `<button class="btn btn-ghost btn-sm" onclick="deleteModule(${m.module_id})" title="Xóa chương">🗑</button>` : ''}
    </div>
    <div class="module-lessons">
      ${lessons}
      ${addRow}
    </div>
  </div>`;
}

window.addModule = async function() {
  if (isReadOnly) return;
  if (!productId) { app.showToast('Hãy lưu khóa học trước khi thêm chương', 'warning'); return; }
  const title = prompt('Tên chương mới:');
  if (!title?.trim()) return;
  try {
    const sortOrder = document.querySelectorAll('.module-card').length;
    await api.post(`/instructor/courses/${productId}/modules?title=${encodeURIComponent(title.trim())}&sort_order=${sortOrder}`, null, true);
    app.showToast('Đã thêm chương mới!', 'success');
    const data = await api.get(`/instructor/courses/${productId}`, true);
    renderModules(data.course?.modules || []);
  } catch (err) {
    app.showToast(err.message, 'error');
  }
};

window.deleteModule = async function(moduleId) {
  const isConfirmed = await window.app.showConfirm('Xóa chương', 'Xóa chương này và tất cả bài học trong đó?', 'Xóa', true);
  if (!isConfirmed) return;
  try {
    await api.delete(`/instructor/modules/${moduleId}`, true);
    document.getElementById('module-' + moduleId)?.remove();
    app.showToast('Đã xóa chương', 'success');
  } catch (err) {
    app.showToast(err.message, 'error');
  }
};

window.addLesson = async function(moduleId) {
  if (isReadOnly) return;
  const input = document.getElementById('new-lesson-' + moduleId);
  const title = input?.value?.trim();
  if (!title) { app.showToast('Nhập tên bài học', 'warning'); return; }
  try {
    await api.post(`/instructor/modules/${moduleId}/lessons?title=${encodeURIComponent(title)}`, null, true);
    app.showToast('Đã thêm bài học!', 'success');
    if (input) input.value = '';
    const data = await api.get(`/instructor/courses/${productId}`, true);
    renderModules(data.course?.modules || []);
  } catch (err) {
    app.showToast(err.message, 'error');
  }
};

window.deleteLesson = async function(lessonId) {
  const isConfirmed = await window.app.showConfirm('Xóa bài học', 'Xóa bài học này?', 'Xóa', true);
  if (!isConfirmed) return;
  try {
    await api.delete(`/instructor/lessons/${lessonId}`, true);
    document.getElementById('lesson-' + lessonId)?.remove();
    app.showToast('Đã xóa bài học', 'success');
  } catch (err) {
    app.showToast(err.message, 'error');
  }
};

setTimeout(async () => {
  const user = window.AppState?.user || JSON.parse(localStorage.getItem('el_user') || 'null');
  if (!user || !['author', 'admin'].includes(user.role)) {
    window.location.href = '/';
    return;
  }
  await loadCategories();
  await loadCourse();
}, 100);
