import { AppState, showToast, getQueryParam, formatDate } from '../app.js';

const api_base = '/api';

// ── Helpers ──────────────────────────────────────────────────
function fmtDate(iso) {
  return formatDate(iso, true);
}

function avatarEl(author) {
  if (author.avatar_url) {
    return `<img src="${author.avatar_url}" alt="${author.name}" class="post-card__avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover">`;
  }
  const initials = author.name?.charAt(0)?.toUpperCase() || '?';
  return `<div class="post-card__avatar">${initials}</div>`;
}

function renderCard(post) {
  const statusBadge = post.status === 'hidden'
    ? `<span class="post-card__status-badge">Đã ẩn</span>`
    : '';
  return `
    <a class="post-card" href="/blog/post.html?id=${post.post_id}">
      <div class="post-card__title">${escHtml(post.title)}${statusBadge}</div>
      <div class="post-card__preview">${escHtml(post.content_preview)}</div>
      <div class="post-card__meta">
        ${avatarEl(post.author)}
        <span class="post-card__author-name">${escHtml(post.author.name)}</span>
        <span class="post-card__divider">•</span>
        <span class="post-card__date">${fmtDate(post.created_at)}</span>
        <span class="post-card__comments">💬 ${post.comment_count}</span>
      </div>
    </a>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderPagination(page, total_pages) {
  const container = document.getElementById('blog-pagination');
  if (total_pages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;
  for (let i = 1; i <= total_pages; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" ${page === total_pages ? 'disabled' : ''} data-page="${page + 1}">›</button>`;
  container.innerHTML = html;
  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => loadPosts(parseInt(btn.dataset.page), currentSearch));
  });
}

// ── State ────────────────────────────────────────────────────
let currentSearch = '';

async function loadPosts(page = 1, search = '') {
  const list = document.getElementById('blog-list');
  list.innerHTML = `
    <div class="skeleton" style="height:140px;border-radius:16px"></div>
    <div class="skeleton" style="height:140px;border-radius:16px"></div>
    <div class="skeleton" style="height:140px;border-radius:16px"></div>`;

  try {
    const params = new URLSearchParams({ page, limit: 10 });
    if (search) params.set('search', search);
    const res = await fetch(`${api_base}/blog/posts?${params}`);
    if (!res.ok) throw new Error('Không thể tải danh sách bài viết');
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      list.innerHTML = `
        <div class="blog-empty">
          <span class="blog-empty__icon">📝</span>
          <div class="blog-empty__title">${search ? 'Không tìm thấy bài viết phù hợp' : 'Chưa có bài viết nào'}</div>
          <p style="font-size:0.9rem;margin-top:8px">
            ${AppState.user ? '<a href="/blog/create.html" class="btn btn-primary btn-sm" style="margin-top:12px">✏️ Viết bài đầu tiên</a>' : 'Hãy đăng nhập để viết bài đầu tiên!'}
          </p>
        </div>`;
    } else {
      list.innerHTML = data.items.map(renderCard).join('');
    }
    renderPagination(data.page, data.total_pages);
  } catch (err) {
    list.innerHTML = `<div class="blog-empty"><span class="blog-empty__icon">😕</span><div class="blog-empty__title">Lỗi tải dữ liệu</div></div>`;
    showToast(err.message, 'error');
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Show "Viết bài" button for logged-in users
  if (AppState.user) {
    const btn = document.getElementById('btn-write');
    if (btn) btn.style.display = '';
  }

  // Search
  const searchInput = document.getElementById('search-input');
  const btnSearch = document.getElementById('btn-search');

  function doSearch() {
    currentSearch = searchInput.value.trim();
    loadPosts(1, currentSearch);
  }

  btnSearch?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  loadPosts(1);
});
