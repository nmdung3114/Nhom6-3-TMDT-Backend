import { AppState, showToast } from '../app.js';
import { api } from '../api/client.js';

// Redirect if not logged in
document.addEventListener('DOMContentLoaded', () => {
  if (!AppState.user) {
    showToast('Vui lòng đăng nhập để viết bài', 'error');
    setTimeout(() => {
      location.href = '/auth/login.html?redirect=' + encodeURIComponent('/blog/create.html');
    }, 1000);
    return;
  }

  initCreateForm();
});

function initCreateForm() {
  const form = document.getElementById('create-post-form');
  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');
  const titleCount = document.getElementById('title-count');
  const errDiv = document.getElementById('create-error');

  // Title counter
  titleInput?.addEventListener('input', () => {
    if (titleCount) titleCount.textContent = titleInput.value.length;
  });

  // Auto-resize textarea
  contentInput?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 600) + 'px';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errDiv.style.display = 'none';

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title) {
      errDiv.style.display = 'flex';
      errDiv.querySelector('span').textContent = 'Tiêu đề không được bỏ trống';
      return;
    }
    if (!content) {
      errDiv.style.display = 'flex';
      errDiv.querySelector('span').textContent = 'Nội dung không được bỏ trống';
      return;
    }

    const btn = document.getElementById('btn-publish');
    btn.disabled = true;
    btn.textContent = '⏳ Đang đăng...';

    try {
      const post = await api.post('/blog/posts', { title, content }, true);
      showToast('Bài viết đã được đăng thành công! 🎉', 'success');
      setTimeout(() => {
        location.href = `/blog/post.html?id=${post.post_id}`;
      }, 800);
    } catch (err) {
      errDiv.style.display = 'flex';
      errDiv.querySelector('span').textContent = err.message || 'Đăng bài thất bại';
      btn.disabled = false;
      btn.textContent = '🚀 Đăng bài';
    }
  });
}
