import { AppState, showToast, formatDate } from '../app.js';
import { api } from '../api/client.js';

// ── Helpers ──────────────────────────────────────────────────
function getPostId() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('id'));
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(iso) {
  return formatDate(iso, true);
}

function avatarEl(author, size = 36) {
  const style = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0`;
  if (author.avatar_url) {
    return `<img src="${author.avatar_url}" alt="${escHtml(author.name)}" style="${style}">`;
  }
  const initials = author.name?.charAt(0)?.toUpperCase() || '?';
  const bgStyle = `${style};background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.4)}px;font-weight:700;color:white`;
  return `<div style="${bgStyle}">${initials}</div>`;
}

// ── Render post ───────────────────────────────────────────────
function renderPost(post) {
  document.title = `${post.title} — ELearnVN Blog`;
  document.getElementById('post-content').innerHTML = `
    <h1 class="post-detail__title">${escHtml(post.title)}</h1>
    <div class="post-detail__meta">
      ${avatarEl(post.author, 36)}
      <div>
        <div style="font-weight:700;font-size:0.9rem;color:var(--color-text-primary)">${escHtml(post.author.name)}</div>
        <div style="font-size:0.78rem;color:var(--color-text-muted)">${fmtDate(post.created_at)}</div>
      </div>
      ${post.status === 'hidden' ? `<span style="margin-left:auto;font-size:0.75rem;background:rgba(239,68,68,0.12);color:#ef4444;padding:3px 10px;border-radius:20px;font-weight:700">Đã ẩn</span>` : ''}
    </div>
    <div class="post-detail__content">${escHtml(post.content)}</div>`;

  // Show delete button if owner or admin
  const user = AppState.user;
  if (user && (user.user_id === post.author.user_id || user.role === 'admin')) {
    document.getElementById('post-actions').style.display = 'flex';
  }
  // Show comments section
  document.getElementById('comments-section').style.display = '';
  document.getElementById('comment-count').textContent = `(${post.comment_count})`;
}

// ── Render comments ───────────────────────────────────────────
function renderComments(comments) {
  const list = document.getElementById('comments-list');
  const user = AppState.user;

  if (!comments.length) {
    list.innerHTML = `<div style="padding:32px 0;text-align:center;color:var(--color-text-muted);font-size:0.9rem">Chưa có bình luận nào. Hãy là người đầu tiên!</div>`;
    return;
  }

  list.innerHTML = comments.map(c => {
    const canDelete = user && (user.user_id === c.author.user_id || user.role === 'admin');
    return `
      <div class="comment-item" data-id="${c.comment_id}">
        ${avatarEl(c.author, 36)}
        <div class="comment-item__body">
          <div class="comment-item__header">
            <span class="comment-item__author">${escHtml(c.author.name)}</span>
            <span class="comment-item__date">${fmtDate(c.created_at)}</span>
            ${canDelete ? `<button class="comment-item__delete" data-cid="${c.comment_id}">🗑️ Xóa</button>` : ''}
          </div>
          <div class="comment-item__content">${escHtml(c.content)}</div>
        </div>
      </div>`;
  }).join('');

  // Delete comment handlers
  list.querySelectorAll('.comment-item__delete').forEach(btn => {
    btn.addEventListener('click', () => deleteComment(parseInt(btn.dataset.cid)));
  });
}

// ── API calls ─────────────────────────────────────────────────
const postId = getPostId();

async function loadPost() {
  if (!postId) {
    document.getElementById('post-content').innerHTML = `<div style="text-align:center;padding:60px;color:var(--color-text-muted)">Bài viết không tồn tại.</div>`;
    return;
  }
  try {
    const post = await api.get(`/blog/posts/${postId}`);
    renderPost(post);
    loadComments();
  } catch (err) {
    document.getElementById('post-content').innerHTML = `<div style="text-align:center;padding:60px;color:var(--color-text-muted)">😕 Bài viết không tồn tại hoặc đã bị ẩn.</div>`;
  }
}

async function loadComments() {
  try {
    const data = await api.get(`/blog/posts/${postId}/comments`);
    renderComments(data.items || []);
    const countEl = document.getElementById('comment-count');
    if (countEl) countEl.textContent = `(${data.total})`;
  } catch (_) {}
}

async function submitComment() {
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) { showToast('Vui lòng nhập nội dung bình luận', 'error'); return; }

  const btn = document.getElementById('btn-submit-comment');
  btn.disabled = true;
  btn.textContent = '⏳ Đang gửi...';

  try {
    await api.post(`/blog/posts/${postId}/comments`, { content }, true);
    input.value = '';
    showToast('Bình luận đã được đăng! 🎉', 'success');
    loadComments();
  } catch (err) {
    showToast(err.message || 'Gửi bình luận thất bại', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gửi bình luận';
  }
}

async function deleteComment(commentId) {
  if (!confirm('Xóa bình luận này?')) return;
  try {
    await api.delete(`/blog/comments/${commentId}`, true);
    showToast('Đã xóa bình luận', 'success');
    loadComments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePost() {
  if (!confirm('Bạn có chắc muốn xóa bài viết này? Hành động không thể hoàn tác.')) return;
  try {
    await api.delete(`/blog/posts/${postId}`, true);
    showToast('Đã xóa bài viết', 'success');
    setTimeout(() => { location.href = '/blog/'; }, 800);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPost();

  // Comment form visibility
  const user = AppState.user;
  if (user) {
    document.getElementById('comment-form-wrapper').style.display = '';
  } else {
    document.getElementById('login-to-comment').style.display = '';
  }

  document.getElementById('btn-submit-comment')?.addEventListener('click', submitComment);
  document.getElementById('btn-delete-post')?.addEventListener('click', deletePost);

  // Auto-resize textarea + Ctrl+Enter to submit
  const textarea = document.getElementById('comment-input');
  textarea?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 300) + 'px';
  });
  // Enter = submit (Shift+Enter = new line)
  textarea?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  });
});
