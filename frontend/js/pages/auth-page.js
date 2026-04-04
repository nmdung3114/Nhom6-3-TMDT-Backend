import { authApi } from '../api/auth.js';
import { saveAuth, showToast, AppState, getQueryParam } from '../app.js';

const GOOGLE_CLIENT_ID = '769838445738-qbev0l32b0namp6pq4cea7d41suhsll7.apps.googleusercontent.com';

// Redirect if already logged in
if (AppState.token && AppState.user) {
  const redirect = getQueryParam('redirect') || '/';
  location.href = redirect;
}

// ── Toggle password visibility ──────────────────────────────
document.getElementById('toggle-password')?.addEventListener('click', function() {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
  this.textContent = input.type === 'password' ? '👁' : '🙈';
});

// ── Login form ──────────────────────────────────────────────
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

// ── Register form ───────────────────────────────────────────
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

// ── Google OAuth (thực) ─────────────────────────────────────
async function handleGoogleCredential(credentialResponse) {
  const idToken = credentialResponse.credential;
  if (!idToken) {
    showToast('Đăng nhập Google thất bại. Thử lại.', 'error');
    return;
  }

  // Show loading state on button
  const btn = document.getElementById('btn-google-login');
  if (btn) {
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
    btn.innerHTML = '⏳ Đang xử lý...';
  }

  try {
    const { api } = await import('../api/client.js');
    const data = await api.post('/auth/google', { id_token: idToken }, false);
    saveAuth(data);
    showToast(`Chào mừng, ${data.name}! 🎉`, 'success');
    setTimeout(() => {
      const redirect = getQueryParam('redirect') || (data.role === 'admin' ? '/admin/dashboard.html' : '/');
      location.href = redirect;
    }, 600);
  } catch (err) {
    showToast('Đăng nhập Google thất bại: ' + err.message, 'error');
    // Restore button
    if (btn) {
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
      btn.innerHTML = '<img src="https://www.google.com/favicon.ico" alt="Google" style="width:18px"> Tiếp tục với Google';
    }
  }
}

function initGoogleSignIn() {
  if (!window.google?.accounts?.id) {
    // Retry until GSI loads
    setTimeout(initGoogleSignIn, 300);
    return;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    ux_mode: 'popup',
  });

  // Bind button click to trigger Google popup
  const googleBtn = document.getElementById('btn-google-login');
  if (googleBtn) {
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap not available — use renderButton fallback
          window.google.accounts.id.renderButton(
            document.getElementById('google-btn-container') || googleBtn.parentElement,
            { theme: 'outline', size: 'large', width: '100%' }
          );
          showToast('Vui lòng chọn tài khoản Google trong popup', 'info');
        }
      });
    });
  }
}

// Load Google Identity Services script dynamically
function loadGSI() {
  if (document.getElementById('gsi-script')) return;
  const script = document.createElement('script');
  script.id = 'gsi-script';
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => initGoogleSignIn();
  document.head.appendChild(script);
}

loadGSI();

// ── Facebook OAuth (placeholder — requires HTTPS) ───────────
document.getElementById('btn-facebook-login')?.addEventListener('click', () => {
  showToast('Đăng nhập Facebook cần HTTPS. Hiện chưa hỗ trợ ở localhost.', 'info');
});
