/* ═══════════════════════════════════════════════
   FloatDrive — app.js
   Communicates with Express API at /api/*
═══════════════════════════════════════════════ */

const API = '';  // 같은 origin이므로 빈 문자열 (상대경로)

/* ─── Folder SVG templates ─────────────────── */
const FOLDER_COLORS = ['blue','green','yellow','pink','purple','orange'];

function folderSVG(color) {
  const map = {
    blue:   ['#5b9cf6','#3a7de8'],
    green:  ['#5cd4a0','#38b580'],
    yellow: ['#f6c05b','#e8a030'],
    pink:   ['#f65bc2','#d83aa0'],
    purple: ['#a05bf6','#7c35e8'],
    orange: ['#f68a5b','#e86030'],
  };
  const [fill, dark] = map[color] || map.blue;
  return `<svg viewBox="0 0 56 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 10C2 7.79 3.79 6 6 6H20L25 13H50C52.21 13 54 14.79 54 17V42C54 44.21 52.21 46 50 46H6C3.79 46 2 44.21 2 42V10Z" fill="${fill}" opacity="0.18"/>
    <path d="M2 10C2 7.79 3.79 6 6 6H20L25 13H50C52.21 13 54 14.79 54 17V42C54 44.21 52.21 46 50 46H6C3.79 46 2 44.21 2 42V10Z" stroke="${fill}" stroke-width="1.5"/>
    <path d="M2 17H54" stroke="${dark}" stroke-width="1" opacity="0.4"/>
    <rect x="8" y="22" width="40" height="2" rx="1" fill="${fill}" opacity="0.35"/>
    <rect x="8" y="27" width="28" height="2" rx="1" fill="${fill}" opacity="0.25"/>
    <rect x="8" y="32" width="34" height="2" rx="1" fill="${fill}" opacity="0.2"/>
  </svg>`;
}

function folderEmoji(color) {
  const map = { blue:'🔵', green:'🟢', yellow:'🟡', pink:'🩷', purple:'🟣', orange:'🟠' };
  return map[color] || '📁';
}

/* ─── State ─────────────────────────────────── */
const State = {
  token: localStorage.getItem('fd_token') || null,
  user:  JSON.parse(localStorage.getItem('fd_user') || 'null'),
  files: [],
  dragging: null,
  dragOffX: 0, dragOffY: 0,
  pendingVerifyFile: null,
  infoFile: null,
};

/* ─── API helpers ────────────────────────────── */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (State.token) headers['Authorization'] = `Bearer ${State.token}`;
  const res = await fetch(API + path, { ...options, headers: { ...headers, ...(options.headers||{}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

/* ─── Toast ─────────────────────────────────── */
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ─── Modal helpers ──────────────────────────── */
function openOverlay(id)  { document.getElementById(id + 'Overlay').classList.remove('hidden'); }
function closeOverlay(id) { document.getElementById(id + 'Overlay').classList.add('hidden'); }

/* ─── File counter ───────────────────────────── */
function updateCounter(n) {
  document.getElementById('fileCounter').textContent =
    n === 0 ? '— files floating' : `${n} file${n === 1 ? '' : 's'} floating`;
}

/* ─── Auth UI ────────────────────────────────── */
function syncAuthUI() {
  const loggedIn = !!State.token;
  document.getElementById('guestActions').classList.toggle('hidden', loggedIn);
  document.getElementById('userActions').classList.toggle('hidden', !loggedIn);
  if (loggedIn && State.user) {
    document.getElementById('userAvatar').textContent = State.user.username[0].toUpperCase();
    document.getElementById('menuName').textContent = State.user.username;
    document.getElementById('emptySub').textContent = '+ 새 파일 버튼으로 파일을 만들어보세요';
  } else {
    document.getElementById('emptySub').textContent = '로그인하고 첫 파일을 올려보세요';
  }
}

/* ─── Drag & Drop ────────────────────────────── */
function initDrag(el, fileId) {
  const canvas = document.getElementById('canvas');

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.file-card-inner') === null) return;

    e.preventDefault();
    State.dragging = { el, fileId };

    const rect = el.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    State.dragOffX = e.clientX - rect.left;
    State.dragOffY = e.clientY - rect.top;

    el.classList.remove('is-floating');
    el.style.zIndex = 50;
    el.style.transition = 'box-shadow 0.2s';
    el.querySelector('.file-card-inner').style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)';
  });

  el.addEventListener('dblclick', () => {
    const file = State.files.find(f => f.id === fileId);
    if (!file) return;
    if (file.is_password_protected) {
      State.pendingVerifyFile = file;
      document.getElementById('verifyFileName').textContent = `"${file.name}" 파일은 보호되어 있어요`;
      document.getElementById('verifyPw').value = '';
      App.closeModal('verify'); // reset
      openOverlay('verify');
    } else {
      App.openInfo(file);
    }
  });
}

document.addEventListener('mousemove', e => {
  if (!State.dragging) return;
  const { el } = State.dragging;
  const canvas = document.getElementById('canvas');
  const canvasRect = canvas.getBoundingClientRect();

  let x = e.clientX - canvasRect.left - State.dragOffX;
  let y = e.clientY - canvasRect.top  - State.dragOffY;

  // Clamp within canvas
  x = Math.max(0, Math.min(x, canvasRect.width  - 110));
  y = Math.max(0, Math.min(y, canvasRect.height - 140));

  el.style.left = x + 'px';
  el.style.top  = y + 'px';
});

document.addEventListener('mouseup', async () => {
  if (!State.dragging) return;
  const { el, fileId } = State.dragging;

  el.style.zIndex = 10;
  el.querySelector('.file-card-inner').style.boxShadow = '';

  // Restart float animation
  setTimeout(() => el.classList.add('is-floating'), 100);

  const x = parseFloat(el.style.left);
  const y = parseFloat(el.style.top);

  // Save position to DB if logged in
  if (State.token) {
    try {
      await apiFetch(`/api/files/${fileId}/position`, {
        method: 'PATCH',
        body: JSON.stringify({ pos_x: x, pos_y: y })
      });
      // Update local state
      const f = State.files.find(f => f.id === fileId);
      if (f) { f.pos_x = x; f.pos_y = y; }
    } catch (_) {}
  }

  State.dragging = null;
});

/* ─── Render Files ───────────────────────────── */
function renderFiles(files) {
  const canvas = document.getElementById('canvas');
  // Remove existing cards
  canvas.querySelectorAll('.file-card').forEach(c => c.remove());

  const empty = document.getElementById('emptyState');
  empty.classList.toggle('hidden', files.length > 0);
  updateCounter(files.length);

  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  files.forEach((file, i) => {
    const colorIndex = file.name.charCodeAt(0) % FOLDER_COLORS.length;
    const color = FOLDER_COLORS[colorIndex];
    const tilt = ((file.name.charCodeAt(0) % 7) - 3) * 0.8; // -2.4 to 2.4 deg
    const floatDur = 5 + (i % 4);
    const floatDelay = -(i * 1.1);

    // Position: use saved position, else random
    let x = file.pos_x ?? (40 + Math.random() * (W - 160));
    let y = file.pos_y ?? (20 + Math.random() * (H - 180));

    // Keep within bounds
    x = Math.max(0, Math.min(x, W - 120));
    y = Math.max(0, Math.min(y, H - 150));

    const card = document.createElement('div');
    card.className = 'file-card is-floating';
    card.style.cssText = `
      left: ${x}px; top: ${y}px;
      --tilt: ${tilt}deg;
      --float-dur: ${floatDur}s;
      --float-delay: ${floatDelay}s;
      animation-delay: ${floatDelay}s;
    `;

    card.innerHTML = `
      <div class="file-card-inner">
        ${file.is_password_protected ? `
        <div class="lock-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round"/>
          </svg>
        </div>` : ''}
        <div class="folder-icon">${folderSVG(color)}</div>
        <div class="file-name" title="${escHtml(file.name)}">${escHtml(file.name)}</div>
        <div class="owner-tag">${escHtml(file.username || '')}</div>
      </div>
    `;

    canvas.appendChild(card);
    initDrag(card, file.id);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Load Files ─────────────────────────────── */
async function loadFiles() {
  try {
    const files = await apiFetch('/api/files');
    State.files = files;
    renderFiles(files);
  } catch (e) {
    showToast('파일 로드 실패', 'error');
  }
}

/* ═══════════════════════════════════════════════
   App — public interface
═══════════════════════════════════════════════ */
const App = {

  /* ── Modals ───────────────────────── */
  openModal(name) {
    // Clear errors
    ['login','register','create','verify'].forEach(n => {
      const el = document.getElementById(n + 'Error');
      if (el) el.classList.add('hidden');
    });
    openOverlay(name);
    // Auto-focus first input
    const input = document.querySelector(`#${name}Overlay input`);
    if (input) setTimeout(() => input.focus(), 80);
  },

  closeModal(name) {
    closeOverlay(name);
  },

  switchModal(from, to) {
    closeOverlay(from);
    setTimeout(() => App.openModal(to), 80);
  },

  toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('hidden');
  },

  /* ── Auth ─────────────────────────── */
  async login() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPw').value;
    const errEl    = document.getElementById('loginError');
    errEl.classList.add('hidden');

    if (!email || !password) {
      errEl.textContent = '이메일과 비밀번호를 입력하세요';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = document.querySelector('#loginOverlay .btn-modal-primary');
    btn.disabled = true; btn.textContent = '로그인 중...';

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      State.token = data.token;
      State.user  = { username: data.username };
      localStorage.setItem('fd_token', data.token);
      localStorage.setItem('fd_user', JSON.stringify(State.user));
      closeOverlay('login');
      syncAuthUI();
      showToast(`환영해요, ${data.username}!`, 'success');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = '로그인';
    }
  },

  async register() {
    const username = document.getElementById('regUsername').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPw').value;
    const errEl    = document.getElementById('registerError');
    errEl.classList.add('hidden');

    if (!username || !email || !password) {
      errEl.textContent = '모든 항목을 입력하세요';
      errEl.classList.remove('hidden');
      return;
    }
    if (password.length < 6) {
      errEl.textContent = '비밀번호는 6자 이상이어야 해요';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.querySelector('#registerOverlay .btn-modal-primary');
    btn.disabled = true; btn.textContent = '계정 만드는 중...';

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      showToast('계정이 만들어졌어요! 로그인해주세요', 'success');
      closeOverlay('register');
      setTimeout(() => App.openModal('login'), 150);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = '계정 만들기';
    }
  },

  logout() {
    State.token = null;
    State.user  = null;
    localStorage.removeItem('fd_token');
    localStorage.removeItem('fd_user');
    document.getElementById('userMenu').classList.add('hidden');
    syncAuthUI();
    showToast('로그아웃 되었습니다');
  },

  /* ── Create File ──────────────────── */
  togglePwField() {
    const checked = document.getElementById('createPwToggle').checked;
    document.getElementById('createPwField').classList.toggle('hidden', !checked);
    if (checked) document.getElementById('createPw').focus();
  },

  async createFile() {
    const name      = document.getElementById('createName').value.trim();
    const usePw     = document.getElementById('createPwToggle').checked;
    const password  = usePw ? document.getElementById('createPw').value : null;
    const errEl     = document.getElementById('createError');
    errEl.classList.add('hidden');

    if (!name) {
      errEl.textContent = '파일 이름을 입력하세요';
      errEl.classList.remove('hidden');
      return;
    }
    if (usePw && (!password || password.length < 4)) {
      errEl.textContent = '파일 비밀번호는 4자 이상이어야 해요';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.querySelector('#createOverlay .btn-modal-primary');
    btn.disabled = true; btn.textContent = '생성 중...';

    try {
      const file = await apiFetch('/api/files', {
        method: 'POST',
        body: JSON.stringify({ name, password: password || undefined })
      });
      State.files.push({ ...file, username: State.user.username });
      renderFiles(State.files);
      closeOverlay('create');
      document.getElementById('createName').value = '';
      document.getElementById('createPwToggle').checked = false;
      document.getElementById('createPw').value = '';
      document.getElementById('createPwField').classList.add('hidden');
      showToast(`"${name}" 파일이 생성됐어요`, 'success');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = '파일 생성';
    }
  },

  /* ── Verify Password ──────────────── */
  async verifyFile() {
    const pw    = document.getElementById('verifyPw').value;
    const errEl = document.getElementById('verifyError');
    errEl.classList.add('hidden');

    if (!pw) return;
    const btn = document.querySelector('#verifyOverlay .btn-modal-primary');
    btn.disabled = true; btn.textContent = '확인 중...';

    try {
      const data = await apiFetch(`/api/files/${State.pendingVerifyFile.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ password: pw })
      });
      if (data.ok) {
        closeOverlay('verify');
        App.openInfo(State.pendingVerifyFile);
      } else {
        errEl.classList.remove('hidden');
        document.getElementById('verifyPw').select();
      }
    } catch (_) {
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = '열기';
    }
  },

  /* ── File Info ────────────────────── */
  openInfo(file) {
    State.infoFile = file;
    const colorIndex = file.name.charCodeAt(0) % FOLDER_COLORS.length;
    const color = FOLDER_COLORS[colorIndex];

    document.getElementById('infoFolderIcon').innerHTML = folderSVG(color);
    document.getElementById('infoFolderIcon').style.cssText = 'width:64px;height:54px;display:block';
    document.getElementById('infoFileName').textContent = file.name;
    document.getElementById('infoUploader').textContent = file.username || '알 수 없음';
    document.getElementById('infoDate').textContent = formatDate(file.created_at);
    document.getElementById('infoProtected').textContent = file.is_password_protected ? '🔒 보호됨' : '공개';

    // Show delete button only for own files
    const deleteBtn = document.getElementById('infoDeleteBtn');
    const isOwner = State.user && file.username === State.user.username;
    deleteBtn.classList.toggle('hidden', !isOwner);

    openOverlay('info');
  },

  async deleteFileFromInfo() {
    if (!State.infoFile) return;
    if (!confirm(`"${State.infoFile.name}" 파일을 삭제할까요?`)) return;
    try {
      await apiFetch(`/api/files/${State.infoFile.id}`, { method: 'DELETE' });
      State.files = State.files.filter(f => f.id !== State.infoFile.id);
      renderFiles(State.files);
      closeOverlay('info');
      showToast('파일이 삭제됐어요');
    } catch (e) {
      showToast(e.message, 'error');
    }
  },
};

/* ─── Keyboard shortcuts ─────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['login','register','create','verify','info'].forEach(n => closeOverlay(n));
    document.getElementById('userMenu').classList.add('hidden');
  }
  if (e.key === 'Enter') {
    if (!document.getElementById('loginOverlay').classList.contains('hidden'))    App.login();
    if (!document.getElementById('registerOverlay').classList.contains('hidden')) App.register();
    if (!document.getElementById('createOverlay').classList.contains('hidden'))   App.createFile();
  }
});

// Close user menu when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.avatar-wrap')) {
    document.getElementById('userMenu')?.classList.add('hidden');
  }
});

// Close modal on overlay click
document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      const id = overlay.id.replace('Overlay', '');
      closeOverlay(id);
    }
  });
});

/* ─── Date formatter ─────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' });
}

/* ─── Init ───────────────────────────────────── */
syncAuthUI();
loadFiles();

// Refresh every 30 seconds to pick up new files from others
setInterval(loadFiles, 30000);
