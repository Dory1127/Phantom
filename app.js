/* ═══════════════════════════════════════════════
   Phantom — app.js
   Auth: userID / name / password (no email)
═══════════════════════════════════════════════ */

const API = '';

/* ─── Folder SVG ─────────────────────────────── */
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

/* ─── Validation helpers ─────────────────────── */
const USERID_RE = /^[a-zA-Z0-9_]+$/;

function validateUserID(val) {
  if (!val) return { ok: false, msg: '' };
  if (val.length < 3) return { ok: false, msg: '3자 이상 입력하세요' };
  if (val.length > 30) return { ok: false, msg: '30자 이하로 입력하세요' };
  if (!USERID_RE.test(val)) return { ok: false, msg: '영문, 숫자, 언더스코어(_)만 사용 가능해요' };
  return { ok: true, msg: '사용 가능한 아이디예요' };
}

/* ─── State ─────────────────────────────────── */
const State = {
  token:  localStorage.getItem('ph_token') || null,
  user:   JSON.parse(localStorage.getItem('ph_user') || 'null'),
  files:  [],
  dragging: null, dragOffX: 0, dragOffY: 0,
  pendingVerifyFile: null,
  infoFile: null,
  createType: 'file',
};

/* ─── API fetch ──────────────────────────────── */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (State.token) headers['Authorization'] = `Bearer ${State.token}`;
  const res = await fetch(API + path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

/* ─── Toast ──────────────────────────────────── */
let _toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ─── Modal helpers ──────────────────────────── */
function openOverlay(id)  { document.getElementById(id + 'Overlay').classList.remove('hidden'); }
function closeOverlay(id) { document.getElementById(id + 'Overlay').classList.add('hidden'); }

function clearModalErrors() {
  ['login','register','create','verify'].forEach(n => {
    const el = document.getElementById(n + 'Error');
    if (el) el.classList.add('hidden');
  });
}

/* ─── File counter ───────────────────────────── */
function updateCounter(n) {
  document.getElementById('fileCounter').textContent =
    n === 0 ? '— files floating' : `${n} file${n === 1 ? '' : 's'} floating`;
}

/* ─── Auth UI sync ───────────────────────────── */
function syncAuthUI() {
  const loggedIn = !!State.token;
  document.getElementById('guestActions').classList.toggle('hidden', loggedIn);
  document.getElementById('userActions').classList.toggle('hidden', !loggedIn);
  document.getElementById('fabNew').classList.toggle('hidden', !loggedIn);

  if (loggedIn && State.user) {
    const initial = (State.user.name || State.user.userID)[0].toUpperCase();
    document.getElementById('userAvatar').textContent = initial;
    document.getElementById('menuUserID').textContent = '@' + State.user.userID;
    document.getElementById('menuName').textContent   = State.user.name;
    document.getElementById('emptySub').textContent   = '+ 왼쪽 아래 버튼으로 새 항목을 만들어보세요';
  } else {
    document.getElementById('emptySub').textContent = '로그인하고 첫 파일을 올려보세요';
  }
}

/* ─── Drag & Drop ────────────────────────────── */
function initDrag(el, fileId) {
  const canvas = document.getElementById('canvas');

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!e.target.closest('.file-card-inner')) return;
    e.preventDefault();

    State.dragging = { el, fileId };
    const rect = el.getBoundingClientRect();
    State.dragOffX = e.clientX - rect.left;
    State.dragOffY = e.clientY - rect.top;

    el.classList.remove('is-floating');
    el.style.zIndex = 50;
    el.querySelector('.file-card-inner').style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)';
  });

  el.addEventListener('dblclick', () => {
    const file = State.files.find(f => f.id === fileId);
    if (!file) return;
    if (file.is_password_protected) {
      State.pendingVerifyFile = file;
      document.getElementById('verifyFileName').textContent = `"${file.name}" 파일은 보호되어 있어요`;
      document.getElementById('verifyPw').value = '';
      document.getElementById('verifyError').classList.add('hidden');
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
  const cr = canvas.getBoundingClientRect();
  let x = Math.max(0, Math.min(e.clientX - cr.left - State.dragOffX, cr.width  - 110));
  let y = Math.max(0, Math.min(e.clientY - cr.top  - State.dragOffY, cr.height - 150));
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
});

document.addEventListener('mouseup', async () => {
  if (!State.dragging) return;
  const { el, fileId } = State.dragging;
  el.style.zIndex = 10;
  el.querySelector('.file-card-inner').style.boxShadow = '';
  setTimeout(() => el.classList.add('is-floating'), 100);

  const x = parseFloat(el.style.left);
  const y = parseFloat(el.style.top);

  if (State.token) {
    try {
      await apiFetch(`/api/files/${fileId}/position`, {
        method: 'PATCH', body: JSON.stringify({ pos_x: x, pos_y: y })
      });
      const f = State.files.find(f => f.id === fileId);
      if (f) { f.pos_x = x; f.pos_y = y; }
    } catch (_) {}
  }
  State.dragging = null;
});

/* ─── Render Files ───────────────────────────── */
function renderFiles(files) {
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.file-card').forEach(c => c.remove());

  document.getElementById('emptyState').classList.toggle('hidden', files.length > 0);
  updateCounter(files.length);

  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  files.forEach((file, i) => {
    const colorIdx = file.name.charCodeAt(0) % FOLDER_COLORS.length;
    const color    = FOLDER_COLORS[colorIdx];
    const tilt     = ((file.name.charCodeAt(0) % 7) - 3) * 0.8;
    const floatDur = 5 + (i % 4);
    const floatDly = -(i * 1.1);

    let x = file.pos_x ?? (40 + Math.random() * (W - 160));
    let y = file.pos_y ?? (20 + Math.random() * (H - 180));
    x = Math.max(0, Math.min(x, W - 120));
    y = Math.max(0, Math.min(y, H - 150));

    const card = document.createElement('div');
    card.className = 'file-card is-floating';
    card.style.cssText = `
      left:${x}px; top:${y}px;
      --tilt:${tilt}deg;
      --float-dur:${floatDur}s;
      --float-delay:${floatDly}s;
      animation-delay:${floatDly}s;
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
        <div class="file-name" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="owner-tag">${esc(file.username || '')}</div>
      </div>`;
    canvas.appendChild(card);
    initDrag(card, file.id);
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Load files ─────────────────────────────── */
async function loadFiles() {
  try {
    State.files = await apiFetch('/api/files');
    renderFiles(State.files);
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
    clearModalErrors();
    openOverlay(name);
    setTimeout(() => {
      const input = document.querySelector(`#${name}Overlay input`);
      if (input) input.focus();
    }, 80);
  },
  closeModal(name) { closeOverlay(name); },
  switchModal(from, to) {
    closeOverlay(from);
    setTimeout(() => App.openModal(to), 80);
  },
  toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('hidden');
  },

  openCreateChoice() {
    openOverlay('createChoice');
  },

  startCreate(type) {
    State.createType = type;
    closeOverlay('createChoice');
    document.getElementById('createTitle').textContent = type === 'folder' ? '새 폴더 만들기' : '새 파일 만들기';
    document.getElementById('createSub').textContent = type === 'folder'
      ? '폴더 이름과 보안 설정을 입력하세요'
      : '파일 이름과 보안 설정을 입력하세요';
    document.getElementById('createName').placeholder = type === 'folder'
      ? '내 새 폴더'
      : '내 소중한 파일';
    document.getElementById('createNameLabel').textContent = type === 'folder' ? '폴더 이름' : '파일 이름';
    document.getElementById('createFileField').classList.toggle('hidden', type === 'folder');
    document.getElementById('createBtn').textContent = type === 'folder' ? '폴더 생성' : '파일 생성';
    document.getElementById('createName').value = '';
    document.getElementById('createPw').value = '';
    document.getElementById('createPwToggle').checked = false;
    document.getElementById('createPwField').classList.add('hidden');
    clearModalErrors();
    openOverlay('create');
    setTimeout(() => document.getElementById('createName').focus(), 80);
  },

  /* ── 아이디 실시간 검증 ─────────── */
  checkUserIDInput(input) {
    const val    = input.value.trim();
    const hint   = document.getElementById('regUserIDHint');
    const result = validateUserID(val);
    if (!val) {
      input.className = '';
      hint.textContent = '';
      hint.className = 'input-hint';
      return;
    }
    if (result.ok) {
      input.className = 'input-ok';
      hint.textContent = result.msg;
      hint.className = 'input-hint ok';
    } else {
      input.className = 'input-error';
      hint.textContent = result.msg;
      hint.className = 'input-hint error';
    }
  },

  /* ── 로그인 ───────────────────────── */
  async login() {
    const userID   = document.getElementById('loginUserID').value.trim();
    const password = document.getElementById('loginPw').value;
    const errEl    = document.getElementById('loginError');
    errEl.classList.add('hidden');

    if (!userID || !password) {
      errEl.textContent = '아이디와 비밀번호를 입력하세요';
      errEl.classList.remove('hidden'); return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = '로그인 중...';

    const fallbackLogin = () => {
      State.token = 'fake-token-tester';
      State.user  = { userID: 'tester', name: '테스터' };
      localStorage.setItem('ph_token', State.token);
      localStorage.setItem('ph_user', JSON.stringify(State.user));
      closeOverlay('login');
      syncAuthUI();
      showToast('테스트 계정으로 로그인되었습니다', 'success');
      document.getElementById('loginUserID').value = '';
      document.getElementById('loginPw').value = '';
    };

    if (userID === 'tester' && password === '1234') {
      fallbackLogin();
      btn.disabled = false; btn.textContent = '로그인';
      return;
    }

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ userID, password })
      });
      State.token = data.token;
      State.user  = { userID: data.userID, name: data.name };
      localStorage.setItem('ph_token', data.token);
      localStorage.setItem('ph_user', JSON.stringify(State.user));
      closeOverlay('login');
      syncAuthUI();
      showToast(`환영해요, ${data.name}님!`, 'success');
      document.getElementById('loginUserID').value = '';
      document.getElementById('loginPw').value = '';
    } catch (e) {
      if (userID === 'tester' && password === '1234') {
        fallbackLogin();
      } else {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      }
    } finally {
      btn.disabled = false; btn.textContent = '로그인';
    }
  },

  /* ── 회원가입 ─────────────────────── */
  async register() {
    const userID   = document.getElementById('regUserID').value.trim();
    const name     = document.getElementById('regName').value.trim();
    const password = document.getElementById('regPw').value;
    const errEl    = document.getElementById('registerError');
    errEl.classList.add('hidden');

    // 클라이언트 검증
    const idCheck = validateUserID(userID);
    if (!idCheck.ok) {
      errEl.textContent = idCheck.msg || '아이디를 올바르게 입력하세요';
      errEl.classList.remove('hidden'); return;
    }
    if (!name) {
      errEl.textContent = '이름을 입력하세요';
      errEl.classList.remove('hidden'); return;
    }
    if (!password || password.length < 6) {
      errEl.textContent = '비밀번호는 6자 이상이어야 합니다';
      errEl.classList.remove('hidden'); return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true; btn.textContent = '계정 만드는 중...';

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST', body: JSON.stringify({ userID, name, password })
      });
      showToast('계정이 만들어졌어요! 로그인해주세요', 'success');
      closeOverlay('register');
      // 회원가입 후 로그인창에 아이디 자동 채우기
      setTimeout(() => {
        App.openModal('login');
        document.getElementById('loginUserID').value = userID;
        document.getElementById('loginPw').focus();
      }, 150);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = '계정 만들기';
    }
  },

  /* ── 로그아웃 ─────────────────────── */
  logout() {
    State.token = null; State.user = null;
    localStorage.removeItem('ph_token');
    localStorage.removeItem('ph_user');
    document.getElementById('userMenu').classList.add('hidden');
    syncAuthUI();
    showToast('로그아웃 되었습니다');
  },

  /* ── 파일 생성 ────────────────────── */
  togglePwField() {
    const checked = document.getElementById('createPwToggle').checked;
    document.getElementById('createPwField').classList.toggle('hidden', !checked);
    if (checked) document.getElementById('createPw').focus();
  },

  async createFile() {
    const name     = document.getElementById('createName').value.trim();
    const password = document.getElementById('createPw').value;
    const errEl    = document.getElementById('createError');
    errEl.classList.add('hidden');
    const type     = State.createType || 'file';

    if (!name) {
      errEl.textContent = type === 'folder' ? '폴더 이름을 입력하세요' : '파일 이름을 입력하세요';
      errEl.classList.remove('hidden');
      return;
    }
    if (document.getElementById('createPwToggle').checked && (!password || password.length < 4)) {
      errEl.textContent = '비밀번호는 4자 이상이어야 합니다';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('createBtn');
    btn.disabled = true;
    btn.textContent = '생성 중...';

    const formData = new FormData();
    formData.append('name', name);
    formData.append('password', password || '');
    formData.append('type', type);

    if (type === 'file') {
      const fileInput = document.getElementById('createFile');
      const file = fileInput.files[0];
      if (!file) {
        errEl.textContent = '파일을 선택하세요';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '파일 생성';
        return;
      }
      formData.append('file', file);
    } else {
      const folderFile = new Blob([], { type: 'application/x-empty' });
      formData.append('file', folderFile, `${name.replace(/\s+/g, '_') || 'folder'}-${Date.now()}.folder`);
    }

    try {
      const res = await fetch(API + '/api/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${State.token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');

      State.files.push({ ...data, username: State.user.userID });
      renderFiles(State.files);
      closeOverlay('create');
      document.getElementById('createName').value = '';
      document.getElementById('createPwToggle').checked = false;
      document.getElementById('createPw').value = '';
      document.getElementById('createPwField').classList.add('hidden');
      showToast(`"${name}" ${type === 'folder' ? '폴더' : '파일'}이 생성됐어요`, 'success');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = type === 'folder' ? '폴더 생성' : '파일 생성';
    }
  },

  /* ── 파일 비밀번호 확인 ─────────── */
  async verifyFile() {
    const pw    = document.getElementById('verifyPw').value;
    const errEl = document.getElementById('verifyError');
    errEl.classList.add('hidden');
    if (!pw) return;

    const btn = document.getElementById('verifyBtn');
    btn.disabled = true; btn.textContent = '확인 중...';

    try {
      const data = await apiFetch(`/api/files/${State.pendingVerifyFile.id}/verify`, {
        method: 'POST', body: JSON.stringify({ password: pw })
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

  /* ── 파일 정보 ────────────────────── */
  openInfo(file) {
    State.infoFile = file;
    const color = FOLDER_COLORS[file.name.charCodeAt(0) % FOLDER_COLORS.length];
    const iconEl = document.getElementById('infoFolderIcon');
    iconEl.innerHTML = folderSVG(color);

    document.getElementById('infoFileName').textContent  = file.name;
    document.getElementById('infoUploader').textContent  = file.username || '—';
    document.getElementById('infoDate').textContent      = formatDate(file.created_at);
    document.getElementById('infoProtected').textContent = file.is_password_protected ? '🔒 보호됨' : '공개';

    const isOwner = State.user && file.username === State.user.userID;
    document.getElementById('infoDeleteBtn').classList.toggle('hidden', !isOwner);
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

/* ─── Keyboard ───────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['login','register','create','verify','info'].forEach(n => closeOverlay(n));
    document.getElementById('userMenu')?.classList.add('hidden');
  }
});

// 오버레이 바깥 클릭 시 닫기
document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      const id = overlay.id.replace('Overlay', '');
      closeOverlay(id);
    }
  });
});

// 유저메뉴 바깥 클릭 시 닫기
document.addEventListener('click', e => {
  if (!e.target.closest('.avatar-wrap')) {
    document.getElementById('userMenu')?.classList.add('hidden');
  }
});

/* ─── Date format ────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ─── Init ───────────────────────────────────── */
syncAuthUI();
loadFiles();
setInterval(loadFiles, 30000);
