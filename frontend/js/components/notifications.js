/**
 * Notification Bell Component
 * Renders vào navbar, poll unread count định kỳ
 */
import { AppState, showToast } from '../app.js';

let pollInterval = null;

export function initNotifications() {
  if (!AppState.token) return;
  _injectBell();
  _loadUnreadCount();
  // Poll mỗi 60 giây
  pollInterval = setInterval(_loadUnreadCount, 60000);
}

function _injectBell() {
  // Tìm vị trí inject: trước cart button trong nav-user
  const navUser = document.getElementById('nav-user');
  if (!navUser || document.getElementById('notif-wrapper')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'notif-wrapper';
  wrapper.id = 'notif-wrapper';
  wrapper.innerHTML = `
    <button class="notif-btn" id="notif-btn" title="Thông báo" aria-label="Thông báo">
      🔔
      <span class="notif-badge" id="notif-badge"></span>
    </button>
    <div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-header">
        <span class="notif-header-title">🔔 Thông báo</span>
        <button class="notif-mark-all" id="notif-mark-all">Đánh dấu tất cả đã đọc</button>
      </div>
      <div class="notif-list" id="notif-list">
        <div class="notif-empty">Đang tải...</div>
      </div>
    </div>
  `;

  // Insert trước cart button
  const cartBtn = document.getElementById('nav-cart-btn');
  if (cartBtn) {
    navUser.insertBefore(wrapper, cartBtn);
  } else {
    navUser.prepend(wrapper);
  }

  // Events
  document.getElementById('notif-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    const isOpen = dropdown.classList.toggle('open');
    if (isOpen) _loadNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notif-wrapper')) {
      document.getElementById('notif-dropdown')?.classList.remove('open');
    }
  });

  document.getElementById('notif-mark-all')?.addEventListener('click', async () => {
    try {
      const { api } = await import('../api/client.js');
      await api.put('/notifications/read-all', {}, true);
      document.getElementById('notif-badge').style.display = 'none';
      _loadNotifications();
    } catch {}
  });
}

async function _loadUnreadCount() {
  if (!AppState.token) return;
  try {
    const { api } = await import('../api/client.js');
    const data = await api.get('/notifications/unread-count', true);
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = data.unread_count || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch {}
}

async function _loadNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div class="notif-empty">Đang tải...</div>';
  try {
    const { api } = await import('../api/client.js');
    const data = await api.get('/notifications?page_size=15', true);
    const notifs = data.notifications || [];

    // Update badge
    const badge = document.getElementById('notif-badge');
    if (badge) {
      const unread = data.unread_count || 0;
      if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (notifs.length === 0) {
      list.innerHTML = '<div class="notif-empty">🎉 Bạn đã đọc hết thông báo!</div>';
      return;
    }

    const typeIcons = { success: '✅', info: '📢', warning: '⚠️' };
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}"
           onclick="window._markNotifRead(${n.notification_id}, '${n.link || ''}')">
        <span class="notif-icon">${typeIcons[n.type] || '📢'}</span>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          ${n.message ? `<div class="notif-msg">${n.message}</div>` : ''}
          <div class="notif-time">${_timeAgo(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<span class="notif-unread-dot"></span>' : ''}
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<div class="notif-empty">❌ Không tải được thông báo</div>';
  }
}

function _timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

window._markNotifRead = async (id, link) => {
  try {
    const { api } = await import('./api/client.js').catch(() => import('../api/client.js'));
    await api.put(`/notifications/${id}/read`, {}, true);
    _loadUnreadCount();
  } catch {}
  if (link) location.href = link;
};
