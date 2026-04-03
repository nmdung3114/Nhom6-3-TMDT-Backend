import { orderApi } from '../api/order.js';
import { requireAuth, showToast, formatPrice, formatDate, getQueryParam } from '../app.js';

if (!requireAuth()) throw new Error('Auth required');

let currentPage = 1;

// Show payment result notification
const status = getQueryParam('status');
const orderId = getQueryParam('order_id');
if (status === 'success') {
  setTimeout(() => showToast('🎉 Thanh toán thành công! Nội dung đã được mở khóa.', 'success'), 500);
} else if (status === 'failed') {
  setTimeout(() => showToast('❌ Thanh toán thất bại. Vui lòng thử lại.', 'error'), 500);
}

async function loadOrders(page = 1) {
  const container = document.getElementById('orders-list');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
  try {
    const data = await orderApi.list(page);
    currentPage = page;

    if (!data.orders || data.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📦</div>
          <div class="empty-state__title">Chưa có đơn hàng nào</div>
          <div class="empty-state__desc">Hãy khám phá và mua sắm khóa học!</div>
          <a href="/products/list.html" class="btn btn-primary" style="margin-top:16px">Khám phá ngay</a>
        </div>`;
      return;
    }

    container.innerHTML = data.orders.map(o => renderOrderCard(o)).join('');
    renderPagination(data.total, 10, page);
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__title">❌ ${e.message}</div></div>`;
  }
}

function renderOrderCard(o) {
  const statusMap = {
    pending:  '<span class="badge badge-warning">⏳ Chờ thanh toán</span>',
    paid:     '<span class="badge badge-success">✅ Đã thanh toán</span>',
    cancelled:'<span class="badge badge-error">❌ Đã hủy</span>',
    refunded: '<span class="badge badge-info">↩ Hoàn tiền</span>',
  };
  const actionBtn = o.status === 'pending'
    ? `<a href="/checkout/index.html?order_id=${o.order_id}" class="btn btn-primary btn-sm">💳 Thanh toán ngay</a>`
    : o.status === 'paid'
    ? `<a href="/profile/index.html#my-courses" class="btn btn-secondary btn-sm">▶ Học ngay</a>`
    : '';

  return `
    <div class="order-card">
      <div class="order-card__header">
        <div>
          <div class="order-card__id">Đơn hàng #${o.order_id}</div>
          <div class="order-card__date">${formatDate(o.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${statusMap[o.status] || o.status}
          ${actionBtn}
        </div>
      </div>
      <div class="order-items">
        ${o.items.map(item => `
          <div class="order-item">
            <div class="order-item__thumb">
              <img src="${item.product_thumbnail || 'https://via.placeholder.com/60x40/1a1a35/6366f1'}" alt="">
            </div>
            <div>
              <div class="order-item__name">${item.product_name || '(Không có tên)'}</div>
              <div class="order-item__type">${item.product_type === 'course' ? '🎬 Khóa học' : '📖 Ebook'}</div>
            </div>
            <div style="margin-left:auto;font-weight:600;color:var(--color-accent-light)">${formatPrice(item.price)}</div>
          </div>`).join('')}
      </div>
      <div class="order-card__footer">
        <div style="font-size:0.85rem;color:var(--color-text-muted)">
          ${o.discount_amount > 0 ? `Giảm giá: ${formatPrice(o.discount_amount)}` : ''}
        </div>
        <div>
          <span style="color:var(--color-text-muted);font-size:0.85rem">Tổng cộng: </span>
          <span class="order-total">${formatPrice(o.total_amount)}</span>
        </div>
      </div>
    </div>`;
}

function renderPagination(total, pageSize, current) {
  const totalPages = Math.ceil(total / pageSize);
  const container = document.getElementById('pagination');
  if (!container || totalPages <= 1) return;
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadPage(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

window.loadPage = (p) => { loadOrders(p); window.scrollTo(0, 0); };

loadOrders();
