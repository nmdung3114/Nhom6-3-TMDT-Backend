import { cartApi } from '../api/cart.js';
import { orderApi } from '../api/order.js';
import { AppState, requireAuth, showToast, formatPrice, updateCartBadge } from '../app.js';

if (!requireAuth()) throw new Error('Auth required');

let cart = null;
let couponApplied = null;

async function loadCart() {
  const itemsEl = document.getElementById('cart-items');
  const emptyEl = document.getElementById('cart-empty');
  const contentEl = document.getElementById('cart-content');
  try {
    cart = await cartApi.get();
    if (!cart.items || cart.items.length === 0) {
      emptyEl.style.display = 'flex';
      contentEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    contentEl.style.display = 'grid';
    renderItems(cart.items);
    renderSummary(cart);
  } catch(e) { showToast(e.message, 'error'); }
}

function renderItems(items) {
  document.getElementById('cart-items').innerHTML = items.map(item => `
    <div class="cart-item" id="cart-item-${item.product_id}">
      <div class="cart-item__thumb">
        <img src="${item.product_thumbnail || 'https://via.placeholder.com/100x64/1a1a35/6366f1'}" alt="">
      </div>
      <div class="cart-item__info">
        <a href="/products/detail.html?id=${item.product_id}" class="cart-item__name">${item.product_name}</a>
        <div class="cart-item__type">${item.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook'}</div>
      </div>
      <div class="cart-item__price">${formatPrice(item.price)}</div>
      <button class="cart-item__remove" onclick="removeItem(${item.product_id})" title="Xóa">✕</button>
    </div>`).join('');
}

function renderSummary(cart) {
  const subtotal = cart.subtotal || 0;
  const discount = couponApplied?.discount || 0;
  const total = Math.max(subtotal - discount, 0);

  document.getElementById('summary-count').textContent = `${cart.item_count} sản phẩm`;
  document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('summary-discount').textContent = discount > 0 ? `- ${formatPrice(discount)}` : '0đ';
  document.getElementById('summary-total').textContent = formatPrice(total);
}

window.removeItem = async function(productId) {
  try {
    cart = await cartApi.remove(productId);
    document.getElementById(`cart-item-${productId}`)?.remove();
    AppState.cartCount = cart.item_count;
    updateCartBadge();
    renderSummary(cart);
    if (!cart.items || cart.items.length === 0) {
      document.getElementById('cart-empty').style.display = 'flex';
      document.getElementById('cart-content').style.display = 'none';
    }
    showToast('Đã xóa khỏi giỏ hàng', 'info');
  } catch(e) { showToast(e.message, 'error'); }
};

// Coupon
async function applyCoupon() {
  const code = document.getElementById('coupon-input').value.trim().toUpperCase();
  if (!code) return;
  try {
    const subtotal = cart?.subtotal || 0;
    const result = await orderApi.validateCoupon(code, subtotal);
    couponApplied = { code, discount: result.discount };
    renderSummary(cart);
    document.getElementById('coupon-status').innerHTML = `<span class="text-success">✅ Áp dụng mã "${code}" - giảm ${formatPrice(result.discount)}</span>`;
  } catch(e) {
    couponApplied = null;
    document.getElementById('coupon-status').innerHTML = `<span class="text-error">❌ ${e.message}</span>`;
  }
}

document.getElementById('btn-apply-coupon')?.addEventListener('click', applyCoupon);
// Enter in coupon input = apply immediately
document.getElementById('coupon-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyCoupon();
});

// Checkout
document.getElementById('btn-checkout')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-checkout');
  btn.classList.add('loading');
  try {
    const order = await orderApi.create(couponApplied?.code || null);
    location.href = `/checkout/index.html?order_id=${order.order_id}`;
  } catch(e) {
    showToast(e.message, 'error');
    btn.classList.remove('loading');
  }
});

loadCart();
