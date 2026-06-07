import { productApi } from '../api/product.js';
import { renderProductCard, AppState } from '../app.js';
import { initScrollAnimations, initTheme } from '../components/header.js';

async function loadHomePage() {
  // Apply saved theme immediately
  initTheme();

  // Fix CTA buttons for logged-in users
  updateCtaLinks();

  // Load products
  loadProductSection('courses-grid', { product_type: 'course', page_size: 4, sort: 'rating' });
  loadProductSection('ebooks-grid',  { product_type: 'ebook',  page_size: 4, sort: 'rating' });

  // Initialize scroll animations after DOM is ready
  setTimeout(initScrollAnimations, 100);
  animateCounters();
}

/**
 * If user is already logged in, update CTA links to go to my-courses
 * instead of the register page.
 */
function updateCtaLinks() {
  if (!AppState.user) return;

  // Update any CTA buttons pointing to register
  document.querySelectorAll('a[href*="register"], a[href*="auth/register"]').forEach(link => {
    link.href = '/profile/index.html#my-courses';
    // Update button text to be more contextual
    if (link.textContent.includes('Đăng ký') || link.textContent.includes('miễn phí')) {
      link.innerHTML = link.innerHTML
        .replace(/Đăng ký miễn phí/g, '🎓 Khóa học của tôi')
        .replace(/Đăng ký/g, '🎓 Khóa học của tôi');
    }
  });
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
    // Animate cards on load
    grid.querySelectorAll('.product-card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      card.style.transition = `opacity 0.45s ease ${i * 0.08}s, transform 0.45s ease ${i * 0.08}s`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    });
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__title">❌ ${e.message}</div></div>`;
  }
}

// Animated counters for hero stats
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.floor(easeOut(progress) * target);
      el.textContent = value.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}

loadHomePage();
