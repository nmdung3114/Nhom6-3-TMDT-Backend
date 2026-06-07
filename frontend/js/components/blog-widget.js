/**
 * Blog Widget — Floating icon + slide-in panel (nửa màn hình bên phải)
 * Tương tự AI Tutor, hiển thị trên mọi trang
 */
import { AppState, showToast, formatDate } from '../app.js';
import { api } from '../api/client.js';

const API = '/api';
let widgetEl = null;

// ── Khởi tạo ──────────────────────────────────────────────────
export function initBlogWidget() {
  if (widgetEl) return;
  _createWidget();
  _setupEvents();
}

// ── Tạo DOM ───────────────────────────────────────────────────
function _createWidget() {
  widgetEl = document.createElement('div');
  widgetEl.id = 'blog-widget-fab';
  widgetEl.className = 'blog-widget-fab';
  widgetEl.innerHTML = `
    <!-- Overlay backdrop -->
    <div class="blog-widget-backdrop" id="blog-widget-backdrop"></div>

    <!-- Side Panel -->
    <div class="blog-widget-panel" id="blog-widget-panel">
      <!-- Header -->
      <div class="blog-widget-header">
        <div class="blog-widget-header-left">
          <div class="blog-widget-icon-sm">💎</div>
          <div>
            <div class="blog-widget-title">Cộng đồng ELearnVN</div>
            <div class="blog-widget-subtitle">Chia sẻ & Học hỏi</div>
          </div>
        </div>
        <div class="blog-widget-header-actions">
          <button class="blog-widget-write-btn" id="bw-write-btn" style="display:none" title="Viết bài mới">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:-2px"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            Viết bài
          </button>
          <button class="blog-widget-close-btn" id="bw-close-btn" title="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="blog-widget-search-wrap" id="bw-search-wrap">
        <div class="blog-widget-search">
          <span class="blog-widget-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" id="bw-search-input" placeholder="Tìm kiếm bài viết..." autocomplete="off">
        </div>
      </div>

      <!-- Content area (switches between views) -->
      <div class="blog-widget-body" id="blog-widget-body">
        <!-- list / detail / compose rendered here -->
      </div>

      <!-- Pagination (list view only) -->
      <div class="blog-widget-pagination" id="bw-pagination"></div>
    </div>

    <!-- FAB toggle button -->
    <button class="blog-widget-toggle" id="blog-widget-toggle" title="Cộng đồng">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      <span class="blog-widget-badge" id="bw-badge" style="display:none">N</span>
    </button>
  `;
  document.body.appendChild(widgetEl);
}

// ── Views ─────────────────────────────────────────────────────
let _currentPage = 1;
let _currentSearch = '';
let _view = 'list'; // 'list' | 'detail' | 'compose'

async function showList(page = 1, search = '') {
  _view = 'list';
  _currentPage = page;
  _currentSearch = search;

  const body = document.getElementById('blog-widget-body');
  const pag = document.getElementById('bw-pagination');
  const searchWrap = document.getElementById('bw-search-wrap');
  if (searchWrap) searchWrap.style.display = '';

  body.innerHTML = `
    <div class="bw-skeleton"></div>
    <div class="bw-skeleton"></div>
    <div class="bw-skeleton"></div>
    <div class="bw-skeleton"></div>`;
  pag.innerHTML = '';

  try {
    const params = new URLSearchParams({ page, limit: 8 });
    if (search) params.set('search', search);
    const res = await fetch(`${API}/blog/posts?${params}`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!data.items?.length) {
      body.innerHTML = `
        <div class="bw-empty">
          <span class="bw-empty-icon">${search ? '🔍' : '📝'}</span>
          <div>${search ? 'Không tìm thấy bài viết' : 'Chưa có bài viết nào'}</div>
          ${AppState.user ? '<a class="btn btn-primary btn-sm bw-compose-btn" style="margin-top:12px">✏️ Viết bài đầu tiên</a>' : ''}
        </div>`;
      body.querySelector('.bw-compose-btn')?.addEventListener('click', showCompose);
    } else {
      body.innerHTML = data.items.map(post => _cardHtml(post)).join('');
      // Attach click
      body.querySelectorAll('.bw-post-card').forEach(card => {
        card.addEventListener('click', () => showDetail(parseInt(card.dataset.id)));
      });
    }

    // Pagination
    _renderPagination(data.page, data.total_pages);
  } catch {
    body.innerHTML = `<div class="bw-empty"><span class="bw-empty-icon">😕</span><div>Lỗi tải dữ liệu</div></div>`;
  }
}

function _cardHtml(post) {
  const date = formatDate(post.created_at, true);
  const avatar = post.author.avatar_url
    ? `<img src="${post.author.avatar_url}" class="bw-avatar" alt="">`
    : `<div class="bw-avatar bw-avatar-init">${(post.author.name || '?').charAt(0).toUpperCase()}</div>`;
  return `
    <div class="bw-post-card" data-id="${post.post_id}">
      <div class="bw-post-title">${_esc(post.title)}</div>
      <div class="bw-post-preview">${_esc(post.content_preview)}</div>
      <div class="bw-post-meta">
        ${avatar}
        <span class="bw-post-author">${_esc(post.author.name)}</span>
        <span class="bw-post-dot">•</span>
        <span class="bw-post-date">${date}</span>
        <span class="bw-post-cmt">💬 ${post.comment_count}</span>
      </div>
    </div>`;
}

async function showDetail(postId) {
  _view = 'detail';
  const body = document.getElementById('blog-widget-body');
  const pag = document.getElementById('bw-pagination');
  const searchWrap = document.getElementById('bw-search-wrap');
  if (searchWrap) searchWrap.style.display = 'none';
  pag.innerHTML = '';

  body.innerHTML = `
    <div class="bw-back-btn" id="bw-back">← Quay lại</div>
    <div id="bw-detail-content">
      <div class="bw-skeleton" style="height:32px;margin-bottom:12px"></div>
      <div class="bw-skeleton" style="height:16px;width:50%;margin-bottom:24px"></div>
      <div class="bw-skeleton" style="height:160px"></div>
    </div>`;

  document.getElementById('bw-back')?.addEventListener('click', () => showList(_currentPage, _currentSearch));

  try {
    const [post, commentsData] = await Promise.all([
      api.get(`/blog/posts/${postId}`),
      fetch(`${API}/blog/posts/${postId}/comments`).then(r => r.json()),
    ]);

    const user = AppState.user;
    const canDelete = user && (user.user_id === post.author.user_id || user.role === 'admin');
    const avatar = post.author.avatar_url
      ? `<img src="${post.author.avatar_url}" class="bw-avatar" alt="">`
      : `<div class="bw-avatar bw-avatar-init">${(post.author.name || '?').charAt(0).toUpperCase()}</div>`;

    const fmtDate = iso => formatDate(iso, true);

    document.getElementById('bw-detail-content').innerHTML = `
      <h2 class="bw-detail-title">${_esc(post.title)}</h2>
      <div class="bw-detail-meta">
        ${avatar}
        <div>
          <div class="bw-post-author">${_esc(post.author.name)}</div>
          <div class="bw-post-date">${fmtDate(post.created_at)}</div>
        </div>
        ${canDelete ? `<button class="bw-delete-btn" id="bw-delete-post">🗑️</button>` : ''}
      </div>
      <div class="bw-detail-content">${_esc(post.content)}</div>

      <!-- Comments -->
      <div class="bw-comments-section">
        <div class="bw-comments-title">💬 Bình luận (${commentsData.total || 0})</div>

        ${user ? `
          <div class="bw-comment-form">
            <textarea id="bw-comment-input" placeholder="Viết bình luận..."></textarea>
            <button class="btn btn-primary btn-sm" id="bw-submit-cmt">Gửi</button>
          </div>` : `
          <div class="bw-login-hint"><a href="/auth/login.html">Đăng nhập</a> để bình luận</div>`}

        <div id="bw-comments-list">
          ${_renderCommentsList(commentsData.items || [], user)}
        </div>
      </div>`;

    // Delete post
    document.getElementById('bw-delete-post')?.addEventListener('click', async () => {
      if (!confirm('Xóa bài viết này?')) return;
      try {
        await api.delete(`/blog/posts/${postId}`, true);
        showToast('Đã xóa bài viết', 'success');
        showList(_currentPage, _currentSearch);
      } catch (e) { showToast(e.message, 'error'); }
    });

    const commentInput = document.getElementById('bw-comment-input');
    commentInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('bw-submit-cmt')?.click();
      }
    });

    // Submit comment
    document.getElementById('bw-submit-cmt')?.addEventListener('click', async () => {
      const inp = document.getElementById('bw-comment-input');
      const content = inp.value.trim();
      if (!content) return;
      const btn = document.getElementById('bw-submit-cmt');
      btn.disabled = true;
      try {
        await api.post(`/blog/posts/${postId}/comments`, { content }, true);
        inp.value = '';
        showToast('Bình luận đã được đăng! 🎉', 'success');
        // Reload comments
        const cd = await fetch(`${API}/blog/posts/${postId}/comments`).then(r => r.json());
        document.getElementById('bw-comments-list').innerHTML = _renderCommentsList(cd.items || [], user);
        document.querySelector('.bw-comments-title').textContent = `💬 Bình luận (${cd.total})`;
        _setupDeleteCommentBtns(postId, user);
      } catch (e) {
        showToast(e.message || 'Lỗi', 'error');
      } finally { btn.disabled = false; }
    });

    _setupDeleteCommentBtns(postId, user);

  } catch {
    document.getElementById('bw-detail-content').innerHTML = `<div class="bw-empty"><span class="bw-empty-icon">😕</span><div>Bài viết không tồn tại hoặc đã bị ẩn</div></div>`;
  }
}

function _renderCommentsList(comments, user) {
  if (!comments.length) return `<div class="bw-no-comments">Chưa có bình luận nào</div>`;
  const fmtDate = iso => formatDate(iso, true);
  return comments.map(c => {
    const canDel = user && (user.user_id === c.author.user_id || user.role === 'admin');
    const av = c.author.avatar_url
      ? `<img src="${c.author.avatar_url}" class="bw-avatar bw-avatar-sm" alt="">`
      : `<div class="bw-avatar bw-avatar-sm bw-avatar-init">${(c.author.name || '?').charAt(0).toUpperCase()}</div>`;
    return `
      <div class="bw-comment-item" data-cid="${c.comment_id}">
        ${av}
        <div class="bw-comment-body">
          <div class="bw-comment-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px">
            <div class="bw-comment-author">${_esc(c.author.name)}</div>
            <div class="bw-comment-date" style="font-size:0.75rem; color:var(--color-text-muted);">${fmtDate(c.created_at)}</div>
          </div>
          <div class="bw-comment-text">${_esc(c.content)}</div>
        </div>
        ${canDel ? `<button class="bw-del-cmt" data-cid="${c.comment_id}">🗑️</button>` : ''}
      </div>`;
  }).join('');
}

function _setupDeleteCommentBtns(postId, user) {
  document.querySelectorAll('.bw-del-cmt').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Xóa bình luận?')) return;
      try {
        await api.delete(`/blog/comments/${btn.dataset.cid}`, true);
        showToast('Đã xóa', 'success');
        const cd = await fetch(`${API}/blog/posts/${postId}/comments`).then(r => r.json());
        document.getElementById('bw-comments-list').innerHTML = _renderCommentsList(cd.items || [], user);
        document.querySelector('.bw-comments-title').textContent = `💬 Bình luận (${cd.total})`;
        _setupDeleteCommentBtns(postId, user);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

function showCompose() {
  _view = 'compose';
  if (!AppState.user) {
    showToast('Vui lòng đăng nhập để viết bài', 'error'); return;
  }
  const body = document.getElementById('blog-widget-body');
  const searchWrap = document.getElementById('bw-search-wrap');
  if (searchWrap) searchWrap.style.display = 'none';
  document.getElementById('bw-pagination').innerHTML = '';

  body.innerHTML = `
    <div class="bw-back-btn" id="bw-back">← Quay lại</div>
    <div class="bw-compose-form">
      <div class="bw-compose-heading">✏️ Viết bài mới</div>
      <div class="bw-form-group">
        <label>Tiêu đề <span style="color:#ef4444">*</span></label>
        <input type="text" id="bw-title-inp" placeholder="Nhập tiêu đề..." maxlength="300">
        <div class="bw-char-count"><span id="bw-title-cnt">0</span>/300</div>
      </div>
      <div class="bw-form-group">
        <label>Nội dung <span style="color:#ef4444">*</span></label>
        <textarea id="bw-content-inp" placeholder="Chia sẻ kiến thức, kinh nghiệm..."></textarea>
      </div>
      <div class="bw-compose-footer">
        <button class="btn btn-secondary btn-sm" id="bw-cancel-compose">Hủy</button>
        <button class="btn btn-primary btn-sm" id="bw-submit-post">🚀 Đăng bài</button>
      </div>
      <div id="bw-compose-error" style="display:none;color:#ef4444;font-size:0.82rem;margin-top:8px"></div>
    </div>`;

  document.getElementById('bw-back')?.addEventListener('click', () => showList(_currentPage, _currentSearch));
  document.getElementById('bw-cancel-compose')?.addEventListener('click', () => showList(_currentPage, _currentSearch));

  const titleInp = document.getElementById('bw-title-inp');
  const titleCnt = document.getElementById('bw-title-cnt');
  titleInp?.addEventListener('input', () => titleCnt.textContent = titleInp.value.length);

  const contentInp = document.getElementById('bw-content-inp');
  contentInp?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 400) + 'px';
  });

  document.getElementById('bw-submit-post')?.addEventListener('click', async () => {
    const title = titleInp.value.trim();
    const content = contentInp.value.trim();
    const errEl = document.getElementById('bw-compose-error');
    errEl.style.display = 'none';

    if (!title) { errEl.textContent = 'Tiêu đề không được bỏ trống'; errEl.style.display = 'block'; return; }
    if (!content) { errEl.textContent = 'Nội dung không được bỏ trống'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('bw-submit-post');
    btn.disabled = true; btn.textContent = '⏳ Đang đăng...';

    try {
      const post = await api.post('/blog/posts', { title, content }, true);
      showToast('Bài viết đã được đăng! 🎉', 'success');
      showDetail(post.post_id);
    } catch (e) {
      errEl.textContent = e.message || 'Đăng bài thất bại';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = '🚀 Đăng bài';
    }
  });
}

function _renderPagination(page, totalPages) {
  const pag = document.getElementById('bw-pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = `<button class="bw-page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="bw-page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="bw-page-btn" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`;
  pag.innerHTML = html;
  pag.querySelectorAll('.bw-page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => showList(parseInt(btn.dataset.page), _currentSearch));
  });
}

// ── Event setup ───────────────────────────────────────────────
function _setupEvents() {
  const toggle = document.getElementById('blog-widget-toggle');
  const panel = document.getElementById('blog-widget-panel');
  const backdrop = document.getElementById('blog-widget-backdrop');
  const closeBtn = document.getElementById('bw-close-btn');
  const writeBtn = document.getElementById('bw-write-btn');
  const searchBtn = document.getElementById('bw-search-btn');
  const searchInput = document.getElementById('bw-search-input');

  // Show write button only for logged-in users
  if (AppState.user && writeBtn) writeBtn.style.display = '';

  // Open / close panel
  let _open = false;
  function openPanel() {
    _open = true;
    panel.classList.add('open');
    backdrop.classList.add('open');
    toggle.classList.add('active');
    document.body.style.overflow = 'hidden'; // prevent scroll behind
    if (_view === 'list') showList(_currentPage, _currentSearch);
  }
  function closePanel() {
    _open = false;
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    toggle.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => _open ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);

  // Write button
  writeBtn?.addEventListener('click', showCompose);

  // Search
  function doSearch() {
    _currentSearch = searchInput.value.trim();
    showList(1, _currentSearch);
  }
  searchBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Keyboard close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _open) closePanel();
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
