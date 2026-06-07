/**
 * Global AI Tutor Widget — hiển thị ở góc dưới phải mọi trang
 * Context-aware: biết user đang ở trang nào
 */
import { AppState, showToast } from '../app.js';

let widgetEl = null;
let currentContext = null;  // context truyền vào từ trang learning

export function initAITutor(context = null) {
  currentContext = context;
  if (widgetEl) {
    // Nếu widget đã tồn tại, chỉ update context
    return;
  }
  _createWidget();
  _setupEvents();
}

export function setAIContext(ctx) {
  currentContext = ctx;
}

function _createWidget() {
  widgetEl = document.createElement('div');
  widgetEl.className = 'ai-widget-fab';
  widgetEl.id = 'ai-widget-fab';
  widgetEl.innerHTML = `
    <div class="ai-widget-window" id="ai-widget-window">
      <div class="ai-widget-header">
        <div class="ai-widget-avatar">✨</div>
        <div class="ai-widget-info">
          <div class="ai-widget-name">AI Tutor — ELearnVN</div>
          <div class="ai-widget-status">Sẵn sàng hỗ trợ</div>
        </div>
        <button class="ai-widget-close" id="ai-widget-close" title="Đóng">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div id="ai-widget-messages" class="ai-widget-messages">
        <div class="ai-msg assistant">
          👋 Xin chào! Mình là <strong>AI Tutor</strong> của ELearnVN. Bạn có thể hỏi mình bất kỳ điều gì về lập trình hoặc khóa học nhé!
        </div>
      </div>
      <div class="ai-widget-input-area">
        <div class="ai-widget-input-wrapper">
          <input class="ai-widget-input" id="ai-widget-input"
                 type="text" placeholder="Hỏi AI Tutor..." autocomplete="off">
          <button class="ai-widget-send" id="ai-widget-send" title="Gửi">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
    <button class="ai-widget-toggle" id="ai-widget-toggle" title="Trợ lý AI">
      <span style="font-size: 1.8rem">✨</span>
      <span class="ai-badge" id="ai-badge" style="display:none">1</span>
    </button>
  `;
  document.body.appendChild(widgetEl);
}

function _setupEvents() {
  const toggle = document.getElementById('ai-widget-toggle');
  const closeBtn = document.getElementById('ai-widget-close');
  const window_ = document.getElementById('ai-widget-window');
  const input = document.getElementById('ai-widget-input');
  const sendBtn = document.getElementById('ai-widget-send');
  const messages = document.getElementById('ai-widget-messages');

  toggle.addEventListener('click', () => {
    window_.classList.toggle('open');
    document.getElementById('ai-badge').style.display = 'none';
    if (window_.classList.contains('open')) {
      setTimeout(() => input?.focus(), 300);
    }
  });

  closeBtn.addEventListener('click', () => window_.classList.remove('open'));

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    if (!AppState.token) {
      _addMessage('Bạn cần <a href="/auth/login.html" class="ai-login-link">đăng nhập</a> để dùng AI Tutor nhé!', 'assistant', true);
      input.value = '';
      return;
    }

    _addMessage(text, 'user');
    input.value = '';
    sendBtn.disabled = true;

    const loadingId = 'ai-loading-' + Date.now();
    _addLoadingMessage(loadingId);

    try {
      const { api } = await import('../api/client.js');
      const response = await api.post('/ai/chat', {
        message: text,
        context: currentContext || `page: ${document.title}`,
      }, true);

      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) {
        loadingEl.className = 'ai-msg assistant';
        loadingEl.innerHTML = _formatReply(response.reply);
      }
    } catch (e) {
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) {
        loadingEl.className = 'ai-msg assistant';
        loadingEl.innerHTML = '❌ Lỗi kết nối. Vui lòng thử lại.';
        loadingEl.style.color = 'var(--color-error)';
      }
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Scroll to bottom when new messages appear
  const observer = new MutationObserver(() => {
    messages.scrollTop = messages.scrollHeight;
  });
  observer.observe(messages, { childList: true });
}

function _addMessage(text, role, isHTML = false) {
  const messages = document.getElementById('ai-widget-messages');
  if (!messages) return;
  const el = document.createElement('div');
  el.className = `ai-msg ${role}`;
  if (isHTML) {
    el.innerHTML = text;
  } else {
    el.innerHTML = _formatReply(text);
  }
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

function _addLoadingMessage(id) {
  const messages = document.getElementById('ai-widget-messages');
  if (!messages) return;
  const el = document.createElement('div');
  el.className = 'ai-msg loading';
  el.id = id;
  el.innerHTML = '<div class="ai-typing-indicator"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

function _formatReply(text) {
  // Convert markdown-like formatting to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(99,102,241,0.15);padding:2px 6px;border-radius:4px;font-size:0.85em">$1</code>')
    .replace(/\n/g, '<br>');
}
