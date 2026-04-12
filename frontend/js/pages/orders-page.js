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

  // ── Tính thời gian từ lúc thanh toán (để ẩn/hiện nút hoàn tiền) ──
  const paidAt = o.payment?.paid_at ? new Date(o.payment.paid_at) : null;
  const daysSincePaid = paidAt
    ? (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const withinRefundWindow = daysSincePaid <= 3;

  // ── Tính giờ còn lại trong cửa sổ hoàn tiền ──
  let refundTimeLeft = '';
  if (o.status === 'paid' && withinRefundWindow && paidAt) {
    const msLeft = (3 * 24 * 60 * 60 * 1000) - (Date.now() - paidAt.getTime());
    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    if (hoursLeft > 0) {
      refundTimeLeft = `Còn ${hoursLeft}g ${minutesLeft}p để yêu cầu hoàn tiền`;
    } else {
      refundTimeLeft = `Còn ${minutesLeft} phút để yêu cầu hoàn tiền`;
    }
  }

  // ── Buttons theo trạng thái ──
  let actionBtns = '';

  if (o.status === 'pending') {
    actionBtns = `
      <a href="/checkout/index.html?order_id=${o.order_id}" class="btn btn-primary btn-sm">💳 Thanh toán ngay</a>
      <button class="btn btn-ghost btn-sm" style="color:var(--color-error);border-color:var(--color-error)"
        onclick="cancelOrder(${o.order_id})">🗑 Hủy đơn</button>`;

  } else if (o.status === 'paid') {
    actionBtns = `<a href="/profile/index.html#my-courses" class="btn btn-secondary btn-sm">▶ Học ngay</a>`;
    if (withinRefundWindow) {
      actionBtns += `
        <button class="btn btn-ghost btn-sm refund-btn"
          style="color:var(--color-warning);border:1px solid var(--color-warning)"
          onclick="requestRefund(${o.order_id})"
          title="Điều kiện: Chưa học quá 10% • Ebook chưa mở • Trong 3 ngày đầu">
          ↩ Hoàn tiền
        </button>`;
    }
  }

  return `
    <div class="order-card" id="order-${o.order_id}">
      <div class="order-card__header">
        <div>
          <div class="order-card__id">Đơn hàng #${o.order_id}</div>
          <div class="order-card__date">${formatDate(o.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end">
          ${statusMap[o.status] || o.status}
          ${actionBtns}
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
          ${refundTimeLeft ? `<span style="color:var(--color-warning);margin-left:8px">⏰ ${refundTimeLeft}</span>` : ''}
        </div>
        <div>
          <span style="color:var(--color-text-muted);font-size:0.85rem">Tổng cộng: </span>
          <span class="order-total">${formatPrice(o.total_amount)}</span>
        </div>
      </div>
    </div>`;
}

// ── Xử lý hủy đơn ──────────────────────────────────────────
window.cancelOrder = async (orderId) => {
  if (!confirm('Bạn có chắc muốn hủy đơn hàng này không?')) return;
  try {
    await orderApi.cancelOrder(orderId);
    showToast('✅ Đã hủy đơn hàng thành công', 'success');
    loadOrders(currentPage);
  } catch(e) {
    showToast(e.message || 'Không thể hủy đơn hàng', 'error');
  }
};

// ── Xử lý yêu cầu hoàn tiền ────────────────────────────────
window.requestRefund = async (orderId) => {
  const confirmed = confirm(
    'Yêu cầu hoàn tiền?\n\n' +
    'Điều kiện:\n' +
    '• Chưa hoàn thành quá 10% khóa học\n' +
    '• Ebook chưa được mở\n' +
    '• Trong vòng 3 ngày kể từ khi thanh toán\n\n' +
    'Quyền truy cập vào nội dung sẽ bị thu hồi sau khi hoàn tiền.'
  );
  if (!confirmed) return;

  // Disable button để tránh double click
  const btn = document.querySelector(`#order-${orderId} .refund-btn`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang xử lý...';
  }

  try {
    const res = await orderApi.requestRefund(orderId);
    showToast(`✅ ${res.message}`, 'success');
    loadOrders(currentPage);
  } catch(e) {
    showToast(e.message || 'Không thể yêu cầu hoàn tiền', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '↩ Hoàn tiền';
    }
  }
};

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
