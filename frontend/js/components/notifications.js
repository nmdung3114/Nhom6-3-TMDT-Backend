/**
 * Notifications Component — Chuông thông báo trên navbar
 * Hiển thị badge số chưa đọc, dropdown danh sách
 */
import { AppState, showToast, formatDate } from '../app.js';

let pollInterval = null;

export function initNotifications() {
  if (!AppState.token) return;
  _injectNotificationBell();
  _fetchUnreadCount();
  // Poll every 60s
  pollInterval = setInterval(_fetchUnreadCount, 60000);
}

function _injectNotificationBell() {
  // Find navbar actions area
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  if (document.getElementById('notif-bell-wrap')) return; // already injected

  // Create bell button
  const bell = document.createElement('div');
  bell.id = 'notif-bell-wrap';
  bell.style.cssText = 'position:relative;display:inline-flex;align-items:center;cursor:pointer;';
  bell.innerHTML = `
    <button id="notif-bell-btn"
      style="background:none;border:none;cursor:pointer;font-size:1.3rem;padding:6px;position:relative;color:var(--color-text-secondary);transition:color 0.2s"
      title="Thông báo">
      🔔
      <span id="notif-badge"
        style="display:none;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;background:var(--color-error);color:white;border-radius:50%;font-size:0.65rem;font-weight:700;align-items:center;justify-content:center;padding:0 4px">
        0
      </span>
    </button>
    <div id="notif-dropdown"
      style="display:none;position:absolute;top:calc(100% + 8px);right:0;width:340px;background:var(--color-bg-primary);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);z-index:500;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:700;font-size:0.95rem">🔔 Thông báo</div>
        <button id="notif-mark-all" style="font-size:0.75rem;background:none;border:none;color:var(--color-accent-light);cursor:pointer;padding:4px 8px">✓ Đọc tất cả</button>
      </div>
      <div id="notif-list" style="max-height:320px;overflow-y:auto"></div>
      <div style="padding:12px;text-align:center;border-top:1px solid var(--color-border)">
        <a href="/profile/index.html" style="font-size:0.8rem;color:var(--color-text-muted)">Xem hồ sơ →</a>
      </div>
    </div>`;

  // Insert bell into navbar
  const navInner = navbar.querySelector('.navbar__inner') || navbar.querySelector('.container') || navbar;
  const actionsDiv = navInner.querySelector('[style*="display:flex"]') || navInner.lastElementChild;
  if (actionsDiv) {
    actionsDiv.insertBefore(bell, actionsDiv.firstChild);
  } else {
    navInner.appendChild(bell);
  }

  // Toggle dropdown
  document.getElementById('notif-bell-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    const isOpen = dropdown.style.display !== 'none';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) _loadNotifications();
  });

  // Mark all read
  document.getElementById('notif-mark-all').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const { api } = await import('../api/client.js');
      await api.put('/notifications/read-all', {}, true);
      _updateBadge(0);
      _loadNotifications();
    } catch {}
  });

  // Close on outside click
  document.addEventListener('click', () => {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  });

  document.getElementById('notif-dropdown')?.addEventListener('click', (e) => e.stopPropagation());
}

async function _fetchUnreadCount() {
  if (!AppState.token) return;
  try {
    const { api } = await import('../api/client.js');
    const data = await api.get('/notifications/unread-count', true);
    _updateBadge(data.unread_count || 0);
  } catch {}
}

function _updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function _loadNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner" style="margin:auto"></div></div>';
  try {
    const { api } = await import('../api/client.js');
    const data = await api.get('/notifications?page_size=10', true);
    const notifs = data.notifications || [];

    if (notifs.length === 0) {
      list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--color-text-muted)">🔔 Chưa có thông báo nào</div>';
      return;
    }

    list.innerHTML = notifs.map(n => `
      <div class="notif-item" data-id="${n.notification_id}"
        style="padding:14px 20px;border-bottom:1px solid var(--color-border);cursor:pointer;transition:background 0.15s;${!n.is_read ? 'background:rgba(99,102,241,0.07);' : ''}"
        onclick="window._markNotifRead(${n.notification_id}, '${n.link || ''}')">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="font-size:1.2rem;flex-shrink:0">${_notifIcon(n.type)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:${n.is_read ? '400' : '600'};font-size:0.875rem;margin-bottom:2px">${n.title || 'Thông báo'}</div>
            <div style="font-size:0.8rem;color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.message || ''}</div>
            <div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:4px">${_timeAgo(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--color-accent);flex-shrink:0;margin-top:6px"></div>' : ''}
        </div>
      </div>`).join('');

    window._markNotifRead = async (id, link) => {
      try {
        const { api } = await import('../api/client.js');
        await api.put(`/notifications/${id}/read`, {}, true);
        _fetchUnreadCount();
        if (link) location.href = link;
      } catch {}
    };

  } catch {
    if (list) list.innerHTML = `<div style="padding:20px;color:var(--color-error);text-align:center">❌ Lỗi tải thông báo</div>`;
  }
}

function _notifIcon(type) {
  const map = { order: '📦', payment: '💳', course: '🎓', system: '🔧', promo: '🏷' };
  return map[type] || '🔔';
}

function _timeAgo(dateStr) {
  return formatDate(dateStr, true);
}
