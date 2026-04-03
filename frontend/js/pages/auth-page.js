import { authApi } from '../api/auth.js';
import { saveAuth, showToast, AppState, getQueryParam } from '../app.js';

// Redirect if already logged in
if (AppState.token && AppState.user) {
  const redirect = getQueryParam('redirect') || '/';
  location.href = redirect;
}

// ── Toggle password visibility ─────────────────────────────
document.getElementById('toggle-password')?.addEventListener('click', function() {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
  this.textContent = input.type === 'password' ? '👁' : '🙈';
});

// ── Login form ─────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const errDiv = document.getElementById('login-error');
    btn.classList.add('loading');
    errDiv.style.display = 'none';
    try {
      const data = await authApi.login(
        document.getElementById('email').value,
        document.getElementById('password').value,
      );
      saveAuth(data);
      showToast(`Chào mừng, ${data.name}! 🎉`, 'success');
      setTimeout(() => {
        const redirect = getQueryParam('redirect') || (data.role === 'admin' ? '/admin/dashboard.html' : '/');
        location.href = redirect;
      }, 600);
    } catch (err) {
      errDiv.style.display = 'flex';
      errDiv.querySelector('span').textContent = err.message;
    } finally {
      btn.classList.remove('loading');
    }
  });
}

// ── Register form ──────────────────────────────────────────
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-register');
    const errDiv = document.getElementById('register-error');
    const terms = document.getElementById('agree-terms');
    if (!terms?.checked) {
      errDiv.style.display = 'flex';
      errDiv.querySelector('span').textContent = 'Vui lòng đồng ý với điều khoản sử dụng';
      return;
    }
    btn.classList.add('loading');
    errDiv.style.display = 'none';
    try {
      const data = await authApi.register(
        document.getElementById('name').value,
        document.getElementById('email').value,
        document.getElementById('password').value,
        document.getElementById('phone')?.value || null,
      );
      saveAuth(data);
      showToast('Tạo tài khoản thành công! Chào mừng bạn 🎉', 'success');
      setTimeout(() => location.href = '/', 800);
    } catch (err) {
      errDiv.style.display = 'flex';
      errDiv.querySelector('span').textContent = err.message;
    } finally {
      btn.classList.remove('loading');
    }
  });
}

// ── Mock OAuth (Google / Facebook) ──────────────────────────
function showOAuthModal(provider) {
  const providerLabel = provider === 'google' ? '🌐 Google' : '📘 Facebook';
  const fakeAccounts = [
    { name: 'Nguyễn Văn Demo', email: `demo.${provider}@elearning.vn`,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=Demo` },
    { name: 'Trần Thị Test', email: `test.${provider}@elearning.vn`,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=Test` },
  ];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <div class="modal__title">Đăng nhập với ${providerLabel}</div>
        <div class="modal__close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      <p style="color:var(--color-text-secondary);font-size:0.85rem;margin-bottom:20px">
        🔔 Đây là giao diện demo OAuth — chọn tài khoản test để tiếp tục
      </p>
      ${fakeAccounts.map(acc => `
        <div class="oauth-btn" style="justify-content:flex-start;gap:16px;margin-bottom:8px" 
             data-email="${acc.email}" data-name="${acc.name}" data-avatar="${acc.avatar}">
          <img src="${acc.avatar}" style="width:36px;height:36px;border-radius:50%">
          <div style="text-align:left">
            <div style="font-weight:600;color:white">${acc.name}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted)">${acc.email}</div>
          </div>
        </div>`).join('')}
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-email]').forEach(btn => {
    btn.addEventListener('click', async () => {
      overlay.remove();
      try {
        const data = await authApi.oauthCallback({
          provider,
          email: btn.dataset.email,
          name:  btn.dataset.name,
          oauth_id: `${provider}_${Date.now()}`,
          avatar_url: btn.dataset.avatar,
        });
        saveAuth(data);
        showToast(`Chào mừng, ${data.name}! 🎉`, 'success');
        setTimeout(() => location.href = '/', 600);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

document.getElementById('btn-google-login')?.addEventListener('click', () => showOAuthModal('google'));
document.getElementById('btn-facebook-login')?.addEventListener('click', () => showOAuthModal('facebook'));
