import { orderApi } from '../api/order.js';
import { AppState, requireAuth, showToast, formatPrice, formatDate, getQueryParam } from '../app.js';

if (!requireAuth()) throw new Error('Auth required');

const orderId = parseInt(getQueryParam('order_id'));

async function loadCheckout() {
  if (!orderId) { location.href = '/cart/index.html'; return; }
  try {
    const order = await orderApi.detail(orderId);
    renderOrder(order);
  } catch(e) {
    showToast(e.message, 'error');
    setTimeout(() => location.href = '/cart/index.html', 1500);
  }
}

function renderOrder(order) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('checkout-content').style.display = 'grid';

  // Items
  document.getElementById('checkout-items').innerHTML = order.items.map(item => `
    <div class="order-item">
      <div class="order-item__thumb">
        <img src="${item.product_thumbnail || 'https://via.placeholder.com/60x40/1a1a35/6366f1'}" alt="">
      </div>
      <div style="flex:1">
        <div class="order-item__name">${item.product_name}</div>
        <div class="order-item__type">${item.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook'}</div>
      </div>
      <div style="font-weight:600;color:var(--color-accent-light)">${formatPrice(item.price)}</div>
    </div>`).join('');

  // Summary
  document.getElementById('co-subtotal').textContent = formatPrice(order.subtotal);
  document.getElementById('co-discount').textContent = order.discount_amount > 0
    ? `- ${formatPrice(order.discount_amount)}` : '0đ';
  document.getElementById('co-total').textContent = formatPrice(order.total_amount);
  document.getElementById('co-order-id').textContent = `#${order.order_id}`;

  if (order.status === 'paid') {
    location.replace(`/orders/index.html?status=success&order_id=${orderId}`);
    return;
  }
}

// ── Payment method selection ────────────────────────────────
let selectedMethod = 'vnpay';

function updateMethodUI(method) {
  selectedMethod = method;

  // Update card states
  document.querySelectorAll('.payment-method').forEach(el => {
    const isSelected = el.dataset.method === method;
    el.classList.toggle('selected', isSelected);
    const radio = el.querySelector('.method-radio');
    if (radio) radio.textContent = isSelected ? '●' : '○';
  });

  // Update button label
  const btn = document.getElementById('pay-btn');
  const note = document.getElementById('paypal-note');
  if (method === 'paypal') {
    btn.textContent = ' Thanh toán với PayPal';
    if (note) note.style.display = 'block';
  } else {
    btn.textContent = ' Thanh toán với VNPay';
    if (note) note.style.display = 'none';
  }
}

document.querySelectorAll('.payment-method').forEach(el => {
  el.addEventListener('click', () => updateMethodUI(el.dataset.method));
});

// ── Pay button ──────────────────────────────────────────────
document.getElementById('pay-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('pay-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    if (selectedMethod === 'paypal') {
      showToast('Đang kết nối PayPal Sandbox...', 'info');
      const result = await orderApi.createPaypalPayment(orderId);
      showToast('Đang chuyển hướng đến PayPal...', 'info');
      setTimeout(() => { window.location.href = result.approve_url; }, 600);
    } else {
      showToast('Đang chuyển hướng đến cổng thanh toán VNPay...', 'info');
      const result = await orderApi.createPayment(orderId, null);
      setTimeout(() => { window.location.href = result.payment_url; }, 800);
    }
  } catch(e) {
    showToast(e.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

loadCheckout();
