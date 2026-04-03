import { orderApi } from '../api/order.js';
import { requireAuth, showToast, formatPrice, getQueryParam, formatDuration } from '../app.js';

if (!requireAuth()) throw new Error('Auth required');

const productId = parseInt(getQueryParam('id'));
const type = getQueryParam('type') || 'course';
let courseData = null;
let currentLesson = null;
let progressTimer = null;

async function loadLearning() {
  if (!productId) { location.href = '/profile/index.html'; return; }
  try {
    if (type === 'ebook') {
      await loadEbook();
    } else {
      await loadCourse();
    }
  } catch(e) {
    showToast(e.message || 'Không có quyền truy cập', 'error');
    setTimeout(() => location.href = '/profile/index.html', 1500);
  }
}

async function loadCourse() {
  courseData = await orderApi.courseContent(productId);
  document.title = `${courseData.name} - ELearnVN`;
  document.getElementById('course-title').textContent = courseData.name;

  renderSidebar(courseData.modules);
  updateOverallProgress(courseData.modules);

  // Auto-load first lesson
  const firstModule = courseData.modules?.[0];
  const firstLesson = firstModule?.lessons?.[0];
  if (firstLesson) loadLesson(firstLesson);
}

function renderSidebar(modules) {
  const sidebar = document.getElementById('sidebar-content');
  sidebar.innerHTML = modules.map((m, mIdx) => {
    const completedCount = m.lessons.filter(l => l.progress?.completed).length;
    return `
      <div class="sidebar-module">
        <div class="sidebar-module__header" onclick="toggleModule(${mIdx})">
          <span>${m.title}</span>
          <span style="font-size:0.75rem;color:var(--color-text-muted)">${completedCount}/${m.lessons.length}</span>
        </div>
        <div id="module-lessons-${mIdx}" style="display:${mIdx === 0 ? 'block' : 'none'}">
          ${m.lessons.map((l, lIdx) => `
            <div id="lesson-item-${l.lesson_id}"
                 class="sidebar-lesson ${l.progress?.completed ? 'completed' : ''}"
                 onclick="selectLesson(${mIdx}, ${lIdx})">
              <span class="sidebar-lesson__icon">${l.progress?.completed ? '✅' : '▶'}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.title}</span>
              <span class="sidebar-lesson__duration">${formatDuration(Math.round((l.duration || 0) / 60))}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function updateOverallProgress(modules) {
  const allLessons = modules.flatMap(m => m.lessons);
  const completed = allLessons.filter(l => l.progress?.completed).length;
  const pct = allLessons.length > 0 ? Math.round((completed / allLessons.length) * 100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent = `${pct}% hoàn thành (${completed}/${allLessons.length} bài)`;
}

window.toggleModule = (idx) => {
  const el = document.getElementById(`module-lessons-${idx}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.selectLesson = (mIdx, lIdx) => {
  const lesson = courseData.modules?.[mIdx]?.lessons?.[lIdx];
  if (lesson) loadLesson(lesson);
};

function loadLesson(lesson) {
  currentLesson = lesson;

  // Update active state in sidebar
  document.querySelectorAll('.sidebar-lesson').forEach(el => el.classList.remove('active'));
  document.getElementById(`lesson-item-${lesson.lesson_id}`)?.classList.add('active');

  // Update content area
  document.getElementById('lesson-title').textContent = lesson.title;

  const playerWrap = document.getElementById('video-player-wrap');
  if (lesson.stream_url) {
    playerWrap.innerHTML = `<video id="video-player" controls autoplay style="width:100%;height:100%;max-height:60vh;background:black">
      <source src="${lesson.stream_url}" type="application/x-mpegURL">
      <source src="${lesson.stream_url}" type="video/mp4">
      Trình duyệt không hỗ trợ video.
    </video>`;
    setupVideoTracking();
  } else {
    playerWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#05051a;color:var(--color-text-muted);flex-direction:column;gap:16px;padding:40px">
      <div style="font-size:3rem">🎬</div>
      <div style="font-size:1rem">Video đang được xử lý...</div>
      <div style="font-size:0.85rem;color:var(--color-text-muted)">Vui lòng quay lại sau khi admin upload video lên Mux</div>
    </div>`;
  }

  // Nav buttons
  updateNavButtons();
}

function setupVideoTracking() {
  const video = document.getElementById('video-player');
  if (!video || !currentLesson) return;
  clearInterval(progressTimer);
  progressTimer = setInterval(async () => {
    if (!video.paused && currentLesson) {
      try {
        await orderApi.updateProgress(currentLesson.lesson_id, Math.floor(video.currentTime), false);
      } catch {}
    }
  }, 15000);

  video.addEventListener('ended', async () => {
    clearInterval(progressTimer);
    try {
      await orderApi.updateProgress(currentLesson.lesson_id, Math.floor(video.duration), true);
      // Mark completed in sidebar
      document.getElementById(`lesson-item-${currentLesson.lesson_id}`)?.classList.add('completed');
      currentLesson.progress = { completed: true };
      showToast('✅ Hoàn thành bài học!', 'success');
      updateOverallProgress(courseData.modules);
      // Auto next lesson
      setTimeout(goNextLesson, 2000);
    } catch {}
  });
}

function updateNavButtons() {
  const allLessons = courseData.modules.flatMap(m => m.lessons);
  const idx = allLessons.findIndex(l => l.lesson_id === currentLesson?.lesson_id);
  const prevLesson = allLessons[idx - 1];
  const nextLesson = allLessons[idx + 1];

  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (prevBtn) {
    prevBtn.disabled = !prevLesson;
    prevBtn.onclick = prevLesson ? () => loadLesson(prevLesson) : null;
  }
  if (nextBtn) {
    nextBtn.disabled = !nextLesson;
    nextBtn.onclick = nextLesson ? () => loadLesson(nextLesson) : null;
  }
}

function goNextLesson() {
  const allLessons = courseData.modules.flatMap(m => m.lessons);
  const idx = allLessons.findIndex(l => l.lesson_id === currentLesson?.lesson_id);
  if (allLessons[idx + 1]) loadLesson(allLessons[idx + 1]);
}

async function loadEbook() {
  const data = await orderApi.ebookContent(productId);
  document.title = `${data.name} - ELearnVN`;
  document.getElementById('course-title').textContent = data.name;

  const playerWrap = document.getElementById('video-player-wrap');
  playerWrap.style.aspectRatio = 'auto';
  playerWrap.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:24px;background:var(--color-bg-primary);min-height:300px">
      <div style="font-size:4rem">📖</div>
      <div style="font-size:1.5rem;font-weight:700">${data.name}</div>
      <div style="color:var(--color-text-secondary)">${data.format?.toUpperCase() || 'PDF'} · ${data.page_count || '--'} trang</div>
      <a href="${data.download_url}" class="btn btn-primary btn-lg" target="_blank">
        ⬇ Tải xuống Ebook
      </a>
      <p style="font-size:0.8rem;color:var(--color-text-muted)">Link tải có hiệu lực trong 1 giờ</p>
    </div>`;
  document.getElementById('sidebar-content').innerHTML = `
    <div style="padding:20px;text-align:center;color:var(--color-text-muted)">
      <div style="font-size:2rem;margin-bottom:12px">📖</div>
      Ebook không chia thành chương. Tải về để đọc.
    </div>`;
}

loadLearning();

// ── AI Tutor Logic ──────────────────────────────────────────
function setupAITutor() {
  const btnOpen = document.getElementById('ai-tutor-btn');
  const btnClose = document.getElementById('ai-tutor-close');
  const windowEl = document.getElementById('ai-tutor-window');
  const inputEl = document.getElementById('ai-tutor-input');
  const btnSend = document.getElementById('ai-tutor-send');
  const msgContainer = document.getElementById('ai-tutor-messages');

  if (!btnOpen || !windowEl) return;

  btnOpen.onclick = () => windowEl.classList.add('open');
  btnClose.onclick = () => windowEl.classList.remove('open');

  const sendMessage = async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    
    // show user msg
    addMessage(text, 'user');
    inputEl.value = '';

    // loading state
    const loadingId = 'msg-' + Date.now();
    addMessage('Mình đang suy nghĩ...', 'assistant', loadingId);

    try {
      const { api } = await import('../api/client.js');
      const response = await api.post('/ai/chat', {
        message: text,
        product_id: productId,
        context: currentLesson ? \`video_lesson: \${currentLesson.title}\` : ''
      }, true);
      
      document.getElementById(loadingId).innerText = response.reply;
    } catch(e) {
      document.getElementById(loadingId).innerText = "Xin lỗi, đã có lỗi kết nối tới Server AI.";
      document.getElementById(loadingId).style.color = "var(--color-error)";
    }
  };

  btnSend.onclick = sendMessage;
  inputEl.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

  function addMessage(text, role, id = '') {
    const el = document.createElement('div');
    el.className = \`message \${role}\`;
    if (id) el.id = id;
    el.innerText = text;
    msgContainer.appendChild(el);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}

setupAITutor();
