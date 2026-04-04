import { productApi } from '../api/product.js';
import { renderProductCard, showToast, getQueryParam } from '../app.js';

// ── State ─────────────────────────────────────────────────
const state = {
  page: 1, page_size: 12,
  search: '', category_id: '', product_type: '', level: '',
  min_price: '', max_price: '', sort: 'newest',
  total: 0,
};

// ── Init ──────────────────────────────────────────────────
async function init() {
  // Read URL params
  state.search      = getQueryParam('search') || '';
  state.product_type = getQueryParam('type') || '';
  state.category_id = getQueryParam('category') || '';

  // Restore search input
  const searchInput = document.getElementById('search-input');
  if (searchInput && state.search) searchInput.value = state.search;

  // Update browser tab title based on filter type
  if (state.product_type === 'course') {
    document.title = 'Khóa học - ELearnVN';
  } else if (state.product_type === 'ebook') {
    document.title = 'Ebook - ELearnVN';
  } else {
    document.title = 'Tất cả Khóa học & Ebook - ELearnVN';
  }

  // Highlight type filter
  document.querySelectorAll('[data-filter="type"]').forEach(el => {
    el.classList.toggle('active', el.dataset.value === state.product_type);
  });
  document.querySelectorAll('[data-filter="category"]').forEach(el => {
    el.classList.toggle('active', el.dataset.value === state.category_id);
  });

  await loadCategories();
  await loadProducts();
  setupListeners();
}

async function loadCategories() {
  try {
    const cats = await productApi.categories();
    const container = document.getElementById('category-filters');
    if (!container) return;
    const allItem = container.querySelector('[data-value=""]');
    cats.forEach(cat => {
      const el = document.createElement('label');
      el.className = 'filter-option' + (String(cat.category_id) === state.category_id ? ' active' : '');
      el.dataset.filter = 'category';
      el.dataset.value = cat.category_id;
      el.innerHTML = `<input type="radio" name="category" value="${cat.category_id}">
        ${cat.icon || '📁'} ${cat.name} <div class="filter-dot"></div>`;
      el.addEventListener('click', () => setFilter('category_id', String(cat.category_id)));
      container.appendChild(el);
    });
  } catch {}
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<div class="loading-overlay" style="grid-column:1/-1"><div class="spinner"></div></div>';

  try {
    const params = {
      page:         state.page,
      page_size:    state.page_size,
      sort:         state.sort,
      search:       state.search,
      category_id:  state.category_id,
      product_type: state.product_type,
      level:        state.level,
      min_price:    state.min_price,
      max_price:    state.max_price,
    };
    const data = await productApi.list(params);
    state.total = data.total;

    document.getElementById('products-count').textContent =
      `Tìm thấy ${data.total} kết quả`;

    if (!data.products || data.products.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">Không tìm thấy sản phẩm</div>
        <div class="empty-state__desc">Hãy thử thay đổi bộ lọc</div>
      </div>`;
      renderPagination(0, state.page_size, 1);
      return;
    }
    grid.innerHTML = data.products.map(renderProductCard).join('');
    renderPagination(data.total, state.page_size, state.page);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__title">❌ ${e.message}</div></div>`;
  }
}

function renderPagination(total, pageSize, current) {
  const container = document.getElementById('pagination');
  if (!container) return;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" onclick="window.productsPage.goPage(${current - 1})" ${current === 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === current || i === 1 || i === totalPages || Math.abs(i - current) <= 1) {
      html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="window.productsPage.goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - current) === 2) {
      html += `<span style="color:var(--color-text-muted);padding:0 4px">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="window.productsPage.goPage(${current + 1})" ${current === totalPages ? 'disabled' : ''}>›</button>`;
  container.innerHTML = html;
}

function setFilter(key, value) {
  state[key] = value;
  state.page = 1;
  document.querySelectorAll(`[data-filter="${key.replace('_id','')}"]`).forEach(el => {
    el.classList.toggle('active', el.dataset.value === value);
  });
  loadProducts();
}

function setupListeners() {
  // Filter options
  document.querySelectorAll('.filter-option').forEach(el => {
    el.addEventListener('click', () => {
      const filterKey = el.dataset.filter + (el.dataset.filter === 'category' ? '_id' : '_type' in el.dataset ? '' : '');
      const keyMap = { type: 'product_type', category: 'category_id', level: 'level' };
      setFilter(keyMap[el.dataset.filter] || el.dataset.filter, el.dataset.value);
    });
  });

  // Sort
  document.getElementById('sort-select')?.addEventListener('change', function() {
    state.sort = this.value;
    state.page = 1;
    loadProducts();
  });

  // Search
  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = this.value.trim();
      state.page = 1;
      loadProducts();
    }, 500);
  });
}

window.productsPage = {
  goPage: (p) => { state.page = Math.max(1, p); loadProducts(); window.scrollTo(0, 0); },
  applyFilters: () => {
    state.min_price = document.getElementById('min-price')?.value || '';
    state.max_price = document.getElementById('max-price')?.value || '';
    state.page = 1;
    loadProducts();
  },
  applySort: (val) => { state.sort = val; state.page = 1; loadProducts(); },
  resetFilters: () => {
    state.search = ''; state.product_type = ''; state.category_id = '';
    state.level = ''; state.min_price = ''; state.max_price = '';
    state.sort = 'newest'; state.page = 1;
    document.querySelectorAll('.filter-option').forEach(el => el.classList.toggle('active', el.dataset.value === ''));
    document.getElementById('search-input') && (document.getElementById('search-input').value = '');
    loadProducts();
  },
};

init();
