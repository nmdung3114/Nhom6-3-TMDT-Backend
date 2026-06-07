import { authApi } from '../api/auth.js';
import { saveAuth, showToast, AppState, getQueryParam } from '../app.js';

const GOOGLE_CLIENT_ID = '798650741088-9nn9rleehvi8b77vsnod78nr6hvvo4sc.apps.googleusercontent.com';
const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID'; // Sẽ cập nhật sau khi có App ID

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

  // Disable GSI container to prevent double-click
  const container = document.getElementById('google-signin-container');
  if (container) container.style.pointerEvents = 'none';

  showToast('⏳ Đang xác thực tài khoản Google...', 'info');

  try {
    const { api } = await import('../api/client.js');
    const data = await api.post('/auth/google', { id_token: idToken }, false);
    saveAuth(data);
    showToast(`Chào mừng, ${data.name}! 🎉`, 'success');
    setTimeout(() => {
      const redirect = getQueryParam('redirect') || (data.role === 'admin' ? '/admin/dashboard.html' : '/');
      location.href = redirect;
    }, 700);
  } catch (err) {
    showToast('Đăng nhập Google thất bại: ' + err.message, 'error');
    if (container) container.style.pointerEvents = '';
  }
}

function initGoogleSignIn() {
  if (!window.google?.accounts?.id) {
    // Retry until GSI script loads
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

  // Render the official Google button directly into the container
  const container = document.getElementById('google-signin-container');
  if (container) {
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: container.offsetWidth || 340,
      text: 'continue_with',
      locale: 'vi',
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

// ── Facebook OAuth ──────────────────────────────────────────
function loadFacebookSDK() {
  if (document.getElementById('fb-sdk-script')) return;
  
  // FB SDK requires this global init function
  window.fbAsyncInit = function() {
    FB.init({
      appId: FACEBOOK_APP_ID,
      cookie: true,
      xfbml: false,
      version: 'v19.0',
    });
  };

  const script = document.createElement('script');
  script.id = 'fb-sdk-script';
  script.src = 'https://connect.facebook.net/vi_VN/sdk.js';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

async function handleFacebookLogin() {
  if (typeof FB === 'undefined') {
    showToast('Facebook SDK đang tải, vui lòng thử lại...', 'info');
    return;
  }

  FB.login(function(response) {
    if (response.authResponse) {
      const accessToken = response.authResponse.accessToken;
      sendFacebookTokenToBackend(accessToken);
    } else {
      showToast('Đăng nhập Facebook bị hủy.', 'info');
    }
  }, { scope: 'email,public_profile' });
}

async function sendFacebookTokenToBackend(accessToken) {
  const btn = document.getElementById('btn-facebook-login');
  if (btn) btn.style.pointerEvents = 'none';

  showToast('⏳ Đang xác thực tài khoản Facebook...', 'info');

  try {
    const { api } = await import('../api/client.js');
    const data = await api.post('/auth/facebook', { access_token: accessToken }, false);
    saveAuth(data);
    showToast(`Chào mừng, ${data.name}! 🎉`, 'success');
    setTimeout(() => {
      const redirect = getQueryParam('redirect') || (data.role === 'admin' ? '/admin/dashboard.html' : '/');
      location.href = redirect;
    }, 700);
  } catch (err) {
    showToast('Đăng nhập Facebook thất bại: ' + err.message, 'error');
    if (btn) btn.style.pointerEvents = '';
  }
}

document.getElementById('btn-facebook-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  handleFacebookLogin();
});

loadFacebookSDK();
