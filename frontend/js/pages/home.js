import { productApi } from '../api/product.js';
import { renderProductCard } from '../app.js';

async function loadHomePage() {
  // Load featured courses
  loadProductSection('courses-grid', { product_type: 'course', page_size: 4, sort: 'rating' });
  // Load featured ebooks
  loadProductSection('ebooks-grid', { product_type: 'ebook', page_size: 4, sort: 'rating' });
}

async function loadProductSection(gridId, params) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  try {
    const data = await productApi.list(params);
    if (!data.products || data.products.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__icon">📦</div><div class="empty-state__title">Chưa có sản phẩm</div></div>';
      return;
    }
    grid.innerHTML = data.products.map(renderProductCard).join('');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__title">❌ ${e.message}</div></div>`;
  }
}

loadHomePage();
