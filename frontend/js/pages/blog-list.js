import { AppState, showToast, getQueryParam } from '../app.js';

const api_base = '/api';

// ── Helpers ──────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;
  if (diffD < 7) return `${diffD} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function avatarEl(author, size = 30) {
  if (author.avatar_url) {
    return `<img src="${author.avatar_url}" alt="${escHtml(author.name)}" class="post-card__avatar" style="width:${size}px;height:${size}px">`;
  }
  const initials = author.name?.charAt(0)?.toUpperCase() || '?';
  return `<div class="post-card__avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.4)}px">${initials}</div>`;
}

// Reading time estimate
function readTime(text) {
  const words = text.split(/\s+/).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} phút đọc`;
}

// Cover image or placeholder
function coverEl(post) {
  if (post.cover_image_url) {
    return `
      <div class="post-card__cover">
        <img src="${escHtml(post.cover_image_url)}" alt="${escHtml(post.title)}" loading="lazy">
      </div>`;
  }
  // Decorative placeholder with emoji based on first char
  const emojis = ['📚','🎓','💡','🔥','✨','🚀','🎯','💻','📝','🌟'];
  const idx = (post.post_id || 0) % emojis.length;
  return `
    <div class="post-card__cover">
      <div class="post-card__cover-placeholder">${emojis[idx]}</div>
    </div>`;
}

function renderCard(post) {
  const statusBadge = post.status === 'hidden'
    ? `<span class="post-card__status-badge">Đã ẩn</span>`
    : '';
  return `
    <a class="post-card" href="/blog/post.html?id=${post.post_id}">
      ${coverEl(post)}
      <div class="post-card__body">
        <div class="post-card__title">${escHtml(post.title)}${statusBadge}</div>
        <div class="post-card__preview">${escHtml(post.content_preview)}</div>
        <div class="post-card__footer">
          ${avatarEl(post.author, 30)}
          <div>
            <div class="post-card__author-name">${escHtml(post.author.name)}</div>
            <div class="post-card__date">${fmtDate(post.created_at)}</div>
          </div>
          <div class="post-card__comments">💬 ${post.comment_count}</div>
        </div>
      </div>
    </a>`;
}

function renderPagination(page, total_pages, total) {
  const pag = document.getElementById('blog-pagination');
  if (total_pages <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;
  const start = Math.max(1, page - 2);
  const end = Math.min(total_pages, page + 2);
  if (start > 1) html += `<button class="page-btn" data-page="1">1</button>${start > 2 ? '<span style="color:var(--color-text-muted);padding:0 4px">…</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  if (end < total_pages) html += `${end < total_pages - 1 ? '<span style="color:var(--color-text-muted);padding:0 4px">…</span>' : ''}<button class="page-btn" data-page="${total_pages}">${total_pages}</button>`;
  html += `<button class="page-btn" ${page === total_pages ? 'disabled' : ''} data-page="${page + 1}">›</button>`;

  pag.innerHTML = html;
  pag.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => loadPosts(parseInt(btn.dataset.page), currentSearch));
  });
}

// ── State ────────────────────────────────────────────────────
let currentSearch = '';

async function loadPosts(page = 1, search = '') {
  const list = document.getElementById('blog-list');

  // Skeleton
  list.innerHTML = `
    ${'<div class="post-card" style="pointer-events:none"><div class="post-card__cover"><div class="skeleton" style="width:100%;height:100%"></div></div><div class="post-card__body"><div class="skeleton" style="height:18px;margin-bottom:12px;border-radius:8px"></div><div class="skeleton" style="height:14px;width:80%;margin-bottom:8px;border-radius:6px"></div><div class="skeleton" style="height:14px;width:60%;border-radius:6px"></div></div></div>'.repeat(6)}`;

  try {
    const params = new URLSearchParams({ page, limit: 9 });
    if (search) params.set('search', search);
    const res = await fetch(`${api_base}/blog/posts?${params}`);
    if (!res.ok) throw new Error('Không thể tải danh sách bài viết');
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      list.innerHTML = `
        <div class="blog-empty" style="grid-column:1/-1">
          <span class="blog-empty__icon">${search ? '🔍' : '📝'}</span>
          <div class="blog-empty__title">${search ? 'Không tìm thấy bài viết phù hợp' : 'Chưa có bài viết nào'}</div>
          ${AppState.user
            ? '<a href="/blog/create.html" class="btn btn-primary" style="margin-top:16px">✏️ Viết bài đầu tiên</a>'
            : '<p style="font-size:0.875rem;margin-top:8px">Hãy đăng nhập để viết bài đầu tiên!</p>'}
        </div>`;
    } else {
      list.innerHTML = data.items.map(renderCard).join('');
    }
    renderPagination(data.page, data.total_pages, data.total);
  } catch (err) {
    list.innerHTML = `<div class="blog-empty" style="grid-column:1/-1"><span class="blog-empty__icon">😕</span><div class="blog-empty__title">Lỗi tải dữ liệu</div></div>`;
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

  // Check URL for search param
  const urlSearch = getQueryParam('search');
  if (urlSearch) {
    searchInput.value = urlSearch;
    currentSearch = urlSearch;
  }

  loadPosts(1, currentSearch);
});
