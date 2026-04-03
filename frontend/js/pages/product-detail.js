import { productApi } from '../api/product.js';
import { cartApi } from '../api/cart.js';
import { AppState, showToast, formatPrice, formatDuration, renderStars, getQueryParam, updateCartBadge } from '../app.js';

const productId = parseInt(getQueryParam('id'));
let product = null;
let selectedRating = 0;

async function loadProduct() {
  if (!productId) { location.href = '/products/list.html'; return; }
  try {
    product = await productApi.detail(productId);
    renderProduct(product);
  } catch (e) {
    document.getElementById('loading-state').innerHTML =
      `<div class="empty-state"><div class="empty-state__icon">❌</div><div class="empty-state__title">${e.message}</div></div>`;
  }
}

function renderProduct(p) {
  document.title = `${p.name} - ELearnVN`;
  document.getElementById('page-title').textContent = p.name;

  // Hero
  document.getElementById('breadcrumb-category').textContent = p.category?.name || 'Sản phẩm';
  document.getElementById('product-type-badge').textContent = p.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook';
  document.getElementById('product-name').textContent = p.name;
  document.getElementById('product-short-desc').textContent = p.short_description || '';
  document.getElementById('product-thumbnail').src = p.thumbnail_url || 'https://via.placeholder.com/640x360/1a1a35/6366f1?text=Preview';
  document.getElementById('product-thumbnail').alt = p.name;
  document.getElementById('product-rating-meta').textContent = `⭐ ${Number(p.average_rating || 0).toFixed(1)} (${p.review_count} đánh giá)`;
  document.getElementById('product-enrolled-meta').textContent = `👥 ${p.total_enrolled?.toLocaleString()} học viên`;
  document.getElementById('product-author-meta').textContent = `👨‍💻 ${p.author_name || 'ELearnVN'}`;
  document.getElementById('product-category-meta').textContent = `📁 ${p.category?.name || ''}`;
  document.getElementById('product-price').textContent = formatPrice(p.price);

  if (p.original_price && p.original_price > p.price) {
    const origEl = document.getElementById('product-original-price');
    origEl.textContent = formatPrice(p.original_price);
    origEl.style.display = 'inline';
    const disc = Math.round((1 - p.price / p.original_price) * 100);
    document.getElementById('feature-type').innerHTML = `<span class="purchase-feature__icon">🔥</span> Tiết kiệm ${disc}%`;
  }

  // Course info
  if (p.product_type === 'course' && p.course) {
    document.getElementById('tab-curriculum').style.display = 'inline-block';
    document.getElementById('course-info-sidebar').style.display = 'block';
    document.getElementById('course-duration').textContent = formatDuration(p.course.duration) || '--';
    document.getElementById('course-lessons').textContent = `${p.course.total_lessons || 0} bài học`;
    const lvlMap = { beginner: '🟢 Cơ bản', intermediate: '🟡 Trung cấp', advanced: '🔴 Nâng cao' };
    document.getElementById('course-level').textContent = lvlMap[p.course.level] || p.course.level || '--';
    document.getElementById('feature-type').innerHTML = `<span class="purchase-feature__icon">✅</span> ${p.course.total_lessons} bài học video`;
    renderCurriculum(p.course);
  }
  if (p.product_type === 'ebook' && p.ebook) {
    document.getElementById('ebook-info-sidebar').style.display = 'block';
    document.getElementById('ebook-format').textContent = (p.ebook.format || 'PDF').toUpperCase();
    document.getElementById('ebook-pages').textContent = `${p.ebook.page_count || '--'} trang`;
    document.getElementById('ebook-size').textContent = p.ebook.file_size ? `${p.ebook.file_size} MB` : '--';
    document.getElementById('feature-type').innerHTML = `<span class="purchase-feature__icon">✅</span> Tải về PDF/Epub`;
  }

  // Description
  document.getElementById('product-description').innerHTML = (p.description || '').replace(/\n/g, '<br>');

  // What you learn
  if (p.course?.what_you_learn) {
    try {
      const items = JSON.parse(p.course.what_you_learn);
      document.getElementById('what-you-learn').style.display = 'block';
      document.getElementById('learn-list').innerHTML = items.map(i =>
        `<li style="display:flex;gap:8px;color:var(--color-text-secondary);font-size:0.875rem"><span style="color:var(--color-success);flex-shrink:0">✅</span>${i}</li>`
      ).join('');
    } catch {}
  }

  // Requirements
  if (p.course?.requirements) {
    try {
      const items = JSON.parse(p.course.requirements);
      document.getElementById('requirements-section').style.display = 'block';
      document.getElementById('requirements-list').innerHTML = items.map(i =>
        `<li style="color:var(--color-text-secondary);font-size:0.875rem;margin-bottom:8px">• ${i}</li>`
      ).join('');
    } catch {}
  }

  // Reviews
  renderReviews(p.reviews || []);
  document.getElementById('review-count-tab').textContent = p.review_count || 0;

  // Action button
  renderActionArea(p);

  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('product-content').style.display = 'block';
}

function renderActionArea(p) {
  const area = document.getElementById('action-area');
  // Check if user has access
  const hasAccess = AppState.user && p.has_access;

  if (hasAccess) {
    const learnUrl = p.product_type === 'course'
      ? `/learning/index.html?id=${p.product_id}`
      : `/learning/index.html?id=${p.product_id}&type=ebook`;
    area.innerHTML = `
      <a href="${learnUrl}" class="btn btn-primary btn-block btn-lg">▶ Học ngay</a>
      <p style="text-align:center;color:var(--color-success);font-size:0.85rem;margin-top:12px">✅ Bạn đã sở hữu nội dung này</p>`;
    return;
  }

  area.innerHTML = `
    <button id="btn-add-cart" class="btn btn-primary btn-block btn-lg" onclick="addToCartPage()">🛒 Thêm vào giỏ hàng</button>
    <button class="btn btn-secondary btn-block" style="margin-top:12px" onclick="buyNow()">⚡ Mua ngay</button>
    <p style="text-align:center;color:var(--color-text-muted);font-size:0.75rem;margin-top:16px">🔒 Thanh toán bảo mật qua VNPay</p>`;
}

function renderCurriculum(course) {
  const content = document.getElementById('curriculum-content');
  if (!content) return;
  if (!course.modules || course.modules.length === 0) {
    content.innerHTML = '<p style="color:var(--color-text-muted)">Chưa có nội dung</p>';
    return;
  }
  content.innerHTML = course.modules.map((m, idx) => {
    const lessons = m.lessons || [];
    const totalDur = lessons.reduce((s, l) => s + (l.duration || 0), 0);
    return `
      <div class="module-accordion" style="margin-bottom:12px">
        <div class="module-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <div>
            <div class="module-title">${m.title}</div>
            <div class="module-meta">${lessons.length} bài · ${formatDuration(Math.round(totalDur / 60))}</div>
          </div>
          <span>▾</span>
        </div>
        <div class="lesson-list ${idx === 0 ? 'open' : ''}">
          ${lessons.map(l => `
            <div class="lesson-item ${l.is_preview ? 'preview' : ''}">
              <span class="lesson-icon">${l.is_preview ? '▶' : '🔒'}</span>
              <span>${l.title}</span>
              ${l.is_preview ? '<span class="lesson-preview-badge"><span class="badge badge-accent">preview</span></span>' : ''}
              <span style="margin-left:auto;font-size:0.8rem;color:var(--color-text-muted)">${formatDuration(Math.round((l.duration || 0) / 60)) || '--'}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  if (!list) return;
  if (reviews.length === 0) {
    list.innerHTML = '<p style="color:var(--color-text-muted)">Chưa có đánh giá nào</p>';
    return;
  }
  list.innerHTML = reviews.map(r => `
    <div style="padding:20px 0;border-bottom:1px solid var(--color-border)">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">
          ${(r.user_name || 'U').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <strong>${r.user_name || 'Ẩn danh'}</strong>
            <span style="color:var(--color-warning)">${renderStars(r.rating)}</span>
            <span style="font-size:0.78rem;color:var(--color-text-muted)">${new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
          <p style="color:var(--color-text-secondary);font-size:0.9rem">${r.comment || ''}</p>
        </div>
      </div>
    </div>`).join('');

  // Show review form if user has purchased
  if (AppState.user) {
    document.getElementById('review-form-section').style.display = 'block';
    setupReviewForm();
  }
}

function setupReviewForm() {
  const stars = document.querySelectorAll('#star-rating span');
  stars.forEach(s => {
    s.addEventListener('mouseover', () => stars.forEach((st, i) => st.textContent = i < s.dataset.val ? '★' : '☆'));
    s.addEventListener('mouseleave', () => stars.forEach((st, i) => st.textContent = i < selectedRating ? '★' : '☆'));
    s.addEventListener('click', () => { selectedRating = parseInt(s.dataset.val); });
  });

  document.getElementById('review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedRating) { showToast('Vui lòng chọn số sao', 'error'); return; }
    try {
      await productApi.addReview(productId, { rating: selectedRating, comment: document.getElementById('review-comment').value });
      showToast('Cảm ơn bạn đã đánh giá! ⭐', 'success');
      document.getElementById('review-form-section').style.display = 'none';
    } catch (e) { showToast(e.message, 'error'); }
  });
}

window.addToCartPage = async function() {
  if (!AppState.token) { location.href = '/auth/login.html?redirect=' + encodeURIComponent(location.href); return; }
  const btn = document.getElementById('btn-add-cart');
  btn?.classList.add('loading');
  try {
    await cartApi.add(productId);
    AppState.cartCount = (AppState.cartCount || 0) + 1;
    updateCartBadge();
    showToast('Đã thêm vào giỏ hàng! 🛒', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  finally { btn?.classList.remove('loading'); }
};

window.buyNow = async function() {
  if (!AppState.token) { location.href = '/auth/login.html?redirect=' + encodeURIComponent(location.href); return; }
  await window.addToCartPage();
  setTimeout(() => location.href = '/cart/index.html', 500);
};

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + tab)?.classList.add('active');
};

loadProduct();
