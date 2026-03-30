/* ============================================
   ZMT SPIN GIVEAWAY - SCRIPT.JS
   Fixed Version
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBqTm0G0UR-UA-GzqWjHXWFNiJoVeg5Krk",
  authDomain: "zmtspin.firebaseapp.com",
  databaseURL: "https://zmtspin-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "zmtspin",
  storageBucket: "zmtspin.firebasestorage.app",
  messagingSenderId: "305119744319",
  appId: "1:305119744319:web:2cc44fd4dbf785cf3c838a",
  measurementId: "G-5F2JH3R7QE"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = null;
let isSpinning = false;
let spinListeners = [];
let countdownInterval = null;
let spinPageUsersListener = null;
let spinPageWinnersListener = null;
const OWNER_KEY = "zmtxxx";

// ============ DISABLE ZOOM & BLOCK OUTER SCROLL ============
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => {
  const scrollable = e.target.closest(
    '.chat-messages, .participants-list, .table-wrapper, .nav-links, .key-list, .winner-list, .admin-tabs, .login-container'
  );
  if (!scrollable) e.preventDefault();
}, { passive: false });

// ============ INIT ============
window.addEventListener('DOMContentLoaded', () => {
  initParticles();
  const saved = sessionStorage.getItem('zmtUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    initApp();
  } else {
    showLoginPage();
  }
});

function showLoginPage() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('page-login').classList.remove('hidden');
}

function initApp() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('page-login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  setupNavUI();
  showPage('dashboard');
  startRealtimeListeners();
}

// ============ PARTICLES ============
function initParticles() {
  const container = document.getElementById('login-particles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;animation-duration:${Math.random()*10+8}s;animation-delay:${Math.random()*10}s;opacity:${Math.random()*0.6+0.2};`;
    container.appendChild(p);
  }
}

// ============ LOGIN USER ============
async function loginUser() {
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value.trim();
  const errorEl = document.getElementById('user-login-error');
  errorEl.classList.add('hidden');

  if (!username || !password) { showError(errorEl, 'Username dan password wajib diisi.'); return; }
  if (username.length < 3) { showError(errorEl, 'Username minimal 3 karakter.'); return; }

  try {
    const userRef = db.ref('users/' + username);
    const snap = await userRef.once('value');

    if (!snap.exists()) {
      const newUser = { username, password, role: 'user', status: 'active', inSpin: true, createdAt: Date.now() };
      await userRef.set(newUser);
      currentUser = newUser;
    } else {
      const userData = snap.val();
      if (userData.password !== password) { showError(errorEl, 'Password salah.'); return; }
      if (userData.status === 'banned') { showError(errorEl, 'Akun ini dibanned.'); return; }
      currentUser = userData;
    }
    sessionStorage.setItem('zmtUser', JSON.stringify(currentUser));
    initApp();
  } catch (err) {
    showError(errorEl, 'Terjadi kesalahan: ' + err.message);
  }
}

// ============ LOGIN ADMIN/OWNER ============
async function loginAdmin() {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value.trim();
  const key = document.getElementById('admin-key').value.trim();
  const errorEl = document.getElementById('admin-login-error');
  errorEl.classList.add('hidden');

  if (!username || !password || !key) { showError(errorEl, 'Semua field wajib diisi.'); return; }

  try {
    let role = null;
    if (key === OWNER_KEY) {
      role = 'owner';
    } else {
      const keysSnap = await db.ref('adminKeys').once('value');
      const keys = keysSnap.val() || {};
      if (Object.values(keys).includes(key)) {
        role = 'admin';
      } else {
        showError(errorEl, 'Key tidak valid.');
        return;
      }
    }

    const userRef = db.ref('users/' + username);
    const snap = await userRef.once('value');

    if (!snap.exists()) {
      // Admin/owner baru: inSpin = false — harus daftar manual
      const newUser = { username, password, role, status: 'active', inSpin: false, createdAt: Date.now() };
      await userRef.set(newUser);
      currentUser = newUser;
    } else {
      const userData = snap.val();
      if (userData.password !== password) { showError(errorEl, 'Password salah.'); return; }
      await userRef.update({ role });
      currentUser = { ...userData, role };
    }

    sessionStorage.setItem('zmtUser', JSON.stringify(currentUser));
    initApp();
  } catch (err) {
    showError(errorEl, 'Terjadi kesalahan: ' + err.message);
  }
}

function toggleAdminForm() {
  document.getElementById('card-admin-toggle').classList.add('hidden');
  document.getElementById('card-admin').classList.remove('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ============ LOGOUT ============
function logout() {
  spinListeners.forEach(fn => fn());
  spinListeners = [];
  if (countdownInterval) clearInterval(countdownInterval);
  if (spinPageUsersListener) db.ref('users').off('value', spinPageUsersListener);
  if (spinPageWinnersListener) db.ref('winners').off('value', spinPageWinnersListener);
  currentUser = null;
  sessionStorage.removeItem('zmtUser');
  document.getElementById('app').classList.add('hidden');
  ['user-username','user-password','admin-username','admin-password','admin-key'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['user-login-error','admin-login-error'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('card-admin').classList.add('hidden');
  document.getElementById('card-admin-toggle').classList.remove('hidden');
  document.getElementById('page-login').classList.remove('hidden');
}

// ============ NAV SETUP ============
function setupNavUI() {
  const u = currentUser;
  const initial = u.username.charAt(0).toUpperCase();
  document.getElementById('nav-username').textContent = u.username;
  document.getElementById('nav-avatar').textContent = initial;
  document.getElementById('mobile-avatar').textContent = initial;
  const badge = document.getElementById('nav-role-badge');
  badge.textContent = u.role;
  badge.className = 'role-badge role-' + u.role;

  // Admin/owner: tampilkan nav admin DAN winner chat selalu
  if (u.role === 'admin' || u.role === 'owner') {
    document.getElementById('nav-admin').classList.remove('hidden');
    document.getElementById('nav-winner-chat').classList.remove('hidden');
  } else {
    // User biasa: cek apakah pemenang, baru tampilkan winner chat
    db.ref('winners').once('value', snap => {
      const winners = snap.val() || {};
      const isWinner = Object.values(winners).some(w => w.username === u.username);
      if (isWinner) {
        document.getElementById('nav-winner-chat').classList.remove('hidden');
      }
    });
  }
}

// ============ PAGE ROUTING ============
function showPage(page) {
  document.querySelectorAll('.inner-page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');
  const navLink = document.querySelector('[data-page="' + page + '"]');
  if (navLink) navLink.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');

  if (page === 'dashboard') loadDashboard();
  if (page === 'spin') loadSpinPage();
  if (page === 'chat') scrollChatToBottom('chat-messages');
  if (page === 'winner-chat') checkWinnerAccess();
  if (page === 'admin') loadAdminPanel();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

// ============ REALTIME LISTENERS ============
function startRealtimeListeners() {
  const eventRef = db.ref('settings/event');
  const evtOff = eventRef.on('value', snap => updateCountdown(snap.val()));
  spinListeners.push(() => eventRef.off('value', evtOff));

  const winnersRef = db.ref('winners');
  const wOff = winnersRef.on('value', snap => {
    const data = snap.val() || {};
    const count = Object.keys(data).length;
    document.getElementById('stat-winner-count').textContent = count;
    document.getElementById('stat-spin-count').textContent = count;
    // Tampilkan nav winner chat jika user adalah pemenang
    const isWinner = Object.values(data).some(w => w.username === currentUser.username);
    if (isWinner) document.getElementById('nav-winner-chat').classList.remove('hidden');
  });
  spinListeners.push(() => winnersRef.off('value', wOff));

  const usersRef = db.ref('users');
  const uOff = usersRef.on('value', snap => {
    const data = snap.val() || {};
    document.getElementById('stat-total-users').textContent = Object.keys(data).length;
  });
  spinListeners.push(() => usersRef.off('value', uOff));

  listenGlobalChat();
  listenWinnerChat();
}

// ============ COUNTDOWN ============
function updateCountdown(eventData) {
  if (countdownInterval) clearInterval(countdownInterval);
  const label = document.getElementById('countdown-label');
  const badge = document.getElementById('event-status-badge');
  const regToggle = document.getElementById('reg-toggle');
  const regLabel = document.getElementById('reg-status-label');

  if (!eventData) {
    label.textContent = 'Belum ada pengaturan event';
    badge.textContent = 'Menunggu Info';
    badge.className = 'event-status-badge';
    setCountdownDisplay(0, 0, 0, 0);
    return;
  }

  const { registrationOpen, startTime, endTime } = eventData;
  if (regToggle) {
    regToggle.className = 'toggle-switch' + (registrationOpen ? ' on' : '');
    if (regLabel) regLabel.textContent = registrationOpen ? 'Dibuka' : 'Ditutup';
  }

  function tick() {
    const now = Date.now();
    if (endTime && now > endTime) {
      label.textContent = 'Event telah selesai';
      badge.textContent = 'Ditutup';
      badge.className = 'event-status-badge closed';
      setCountdownDisplay(0, 0, 0, 0);
      clearInterval(countdownInterval);
      return;
    }
    if (startTime && now < startTime) {
      label.textContent = 'Event dimulai dalam';
      badge.textContent = 'Belum Dibuka';
      badge.className = 'event-status-badge';
      setCountdownFromMs(startTime - now);
      return;
    }
    if (startTime && now >= startTime) {
      label.textContent = 'Event berlangsung, berakhir dalam';
      badge.textContent = 'Sedang Berlangsung';
      badge.className = 'event-status-badge open';
      if (endTime) setCountdownFromMs(endTime - now);
      else setCountdownDisplay(0, 0, 0, 0);
    }
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function setCountdownFromMs(ms) {
  setCountdownDisplay(
    Math.floor(ms / 86400000),
    Math.floor((ms % 86400000) / 3600000),
    Math.floor((ms % 3600000) / 60000),
    Math.floor((ms % 60000) / 1000)
  );
}

function setCountdownDisplay(d, h, m, s) {
  document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
  document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
  document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
  document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
}

// ============ DASHBOARD ============
async function loadDashboard() {
  const snap = await db.ref('winners').once('value');
  const winners = snap.val() || {};
  const winnerList = document.getElementById('winner-list-dashboard');
  const arr = Object.values(winners).sort((a, b) => b.timestamp - a.timestamp);
  if (arr.length === 0) {
    winnerList.innerHTML = '<p class="empty-state">Belum ada pemenang</p>';
  } else {
    winnerList.innerHTML = arr.map((w, i) => `
      <div class="winner-item">
        <span class="winner-rank">#${i + 1}</span>
        <span class="winner-name-text">${escHtml(w.username)}</span>
        <span class="winner-time">${formatTime(w.timestamp)}</span>
      </div>`).join('');
  }
}

// ============ SPIN PAGE ============
function loadSpinPage() {
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'owner';

  // Tombol PUTAR: hanya admin/owner
  const adminCtrl = document.getElementById('spin-controls-admin');
  const regSection = document.getElementById('spin-register-section');

  if (isStaff) {
    adminCtrl.classList.remove('hidden');
    regSection.classList.remove('hidden');
  } else {
    // User biasa: sembunyikan KEDUA tombol
    adminCtrl.classList.add('hidden');
    regSection.classList.add('hidden');
  }

  // Bersihkan listener lama
  if (spinPageUsersListener) db.ref('users').off('value', spinPageUsersListener);
  if (spinPageWinnersListener) db.ref('winners').off('value', spinPageWinnersListener);

  function refreshParticipants() {
    db.ref('users').once('value', uSnap => {
      const users = uSnap.val() || {};
      db.ref('winners').once('value', wSnap => {
        const winners = wSnap.val() || {};
        const winnerNames = new Set(Object.values(winners).map(w => w.username));
        // Peserta: inSpin=true, active, belum menang
        const participants = Object.values(users).filter(u =>
          u.inSpin === true && u.status === 'active' && !winnerNames.has(u.username)
        );
        renderParticipants(participants);
        drawWheel(participants);
        if (isStaff) updateRegisterBtn();
      });
    });
  }

  spinPageUsersListener = db.ref('users').on('value', () => refreshParticipants());
  spinPageWinnersListener = db.ref('winners').on('value', snap => {
    const winners = snap.val() || {};
    const list = Object.values(winners);
    if (list.length > 0) {
      const latest = list.sort((a, b) => b.timestamp - a.timestamp)[0];
      showWinnerResult(latest.username);
    }
    refreshParticipants();
  });
}

// Update tombol daftar/batal untuk admin/owner
function updateRegisterBtn() {
  const btn = document.getElementById('spin-register-btn');
  if (!btn) return;
  db.ref('users/' + currentUser.username).once('value', snap => {
    const data = snap.val();
    const inSpin = data && data.inSpin === true;
    btn.textContent = inSpin ? 'BATALKAN DIRI DARI SPIN' : 'DAFTARKAN DIRI KE SPIN';
    btn.className = inSpin ? 'btn btn-danger' : 'btn btn-outline';
  });
}

async function toggleSelfRegister() {
  const snap = await db.ref('users/' + currentUser.username).once('value');
  const data = snap.val();
  const current = data && data.inSpin === true;
  await db.ref('users/' + currentUser.username).update({ inSpin: !current });
  currentUser.inSpin = !current;
  sessionStorage.setItem('zmtUser', JSON.stringify(currentUser));
  showToast(!current ? 'Berhasil didaftarkan ke spin.' : 'Berhasil dibatalkan dari spin.', 'info');
  updateRegisterBtn();
}

function renderParticipants(participants) {
  const container = document.getElementById('participants-list');
  if (participants.length === 0) {
    container.innerHTML = '<p class="empty-state">Belum ada peserta</p>';
    return;
  }
  container.innerHTML = participants.map((u, i) => `
    <div class="participant-item" id="part-${escId(u.username)}">
      <span class="participant-num">${i + 1}</span>
      <span>${escHtml(u.username)}</span>
    </div>`).join('');
}

// ============ WHEEL CANVAS ============
function drawWheel(participants) {
  const canvas = document.getElementById('spin-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(cx, cy) - 10;
  ctx.clearRect(0, 0, w, h);

  if (participants.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill();
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Belum ada peserta', cx, cy);
    return;
  }

  const n = participants.length;
  const slice = (2 * Math.PI) / n;
  const colors = ['#1d4ed8','#1e40af','#2563eb','#3b82f6','#1e3a8a','#0369a1','#0284c7','#0ea5e9','#0c4a6e','#164e63','#155e75','#0891b2','#06b6d4','#0e7490','#1a56db'];

  for (let i = 0; i < n; i++) {
    const s = i * slice - Math.PI / 2;
    const e = s + slice;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, e); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(s + slice / 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const fs = Math.min(14, Math.max(8, r * 0.08));
    ctx.font = '600 ' + fs + 'px Inter,sans-serif';
    const name = participants[i].username;
    ctx.fillText(name.length > 10 ? name.substring(0, 10) + '...' : name, r - 16, 0);
    ctx.restore();
  }

  ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb'; ctx.fill();
}

// ============ SPIN LOGIC ============
let wheelRotation = 0;

async function startSpin() {
  if (isSpinning) return;
  if (currentUser.role === 'user') return; // guard

  const uSnap = await db.ref('users').once('value');
  const users = uSnap.val() || {};
  const wSnap = await db.ref('winners').once('value');
  const winners = wSnap.val() || {};
  const winnerNames = new Set(Object.values(winners).map(w => w.username));

  const participants = Object.values(users).filter(u =>
    u.inSpin === true && u.status === 'active' && !winnerNames.has(u.username)
  );

  if (participants.length === 0) { showToast('Tidak ada peserta untuk di-spin!', 'error'); return; }

  isSpinning = true;
  const btn = document.getElementById('spin-btn');
  btn.disabled = true; btn.textContent = 'Sedang berputar...';

  playSpinSound();

  const winnerIdx = Math.floor(Math.random() * participants.length);
  const winner = participants[winnerIdx];

  const n = participants.length;
  const slice = 360 / n;
  const targetAngle = 360 - (winnerIdx * slice + slice / 2);
  const extraSpins = (5 + Math.floor(Math.random() * 5)) * 360;
  const totalRotation = wheelRotation + extraSpins + targetAngle;

  const canvas = document.getElementById('spin-canvas');
  const duration = 4000 + Math.random() * 2000;
  const startTime = performance.now();
  const startRot = wheelRotation;

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = startRot + (totalRotation - startRot) * ease;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((current * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    drawWheel(participants);
    ctx.restore();

    if (progress < 1) requestAnimationFrame(animate);
    else { wheelRotation = totalRotation % 360; finishSpin(winner, participants); }
  }
  requestAnimationFrame(animate);
}

async function finishSpin(winner, participants) {
  isSpinning = false;
  const btn = document.getElementById('spin-btn');
  btn.disabled = false; btn.textContent = 'PUTAR SEKARANG';

  // Simpan pemenang
  await db.ref('winners').push({ username: winner.username, timestamp: Date.now() });

  // Keluarkan dari daftar spin (otomatis hilang dari wheel)
  await db.ref('users/' + winner.username).update({ inSpin: false });

  // Pesan sistem ke global chat
  await db.ref('globalChat').push({
    type: 'system',
    message: winner.username + ' Memenangkan Giveaway!',
    timestamp: Date.now()
  });

  playWinSound();
  showWinnerPopup(winner.username);

  const remaining = participants.filter(p => p.username !== winner.username);
  drawWheel(remaining);

  if (winner.username === currentUser.username) {
    currentUser.inSpin = false;
    sessionStorage.setItem('zmtUser', JSON.stringify(currentUser));
    updateRegisterBtn();
  }
}

function showWinnerResult(username) {
  const card = document.getElementById('winner-result-card');
  const announce = document.getElementById('winner-announce');
  card.style.display = 'block';
  announce.innerHTML = `
    <div class="w-trophy"></div>
    <div class="w-label">Pemenang Terakhir</div>
    <div class="w-name">${escHtml(username)}</div>`;
}

// ============ WINNER POPUP ============
function showWinnerPopup(username) {
  document.getElementById('winner-popup-name').textContent = username;
  document.getElementById('winner-popup').classList.remove('hidden');
  createConfetti();
}

function closeWinnerPopup() {
  document.getElementById('winner-popup').classList.add('hidden');
  document.getElementById('confetti-container').innerHTML = '';
}

function createConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#2563eb','#3b82f6','#f59e0b','#22c55e','#ef4444','#a855f7','#06b6d4'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.cssText = `background:${colors[Math.floor(Math.random()*colors.length)]};left:${Math.random()*100}%;top:-10px;border-radius:${Math.random()>0.5?'50%':'2px'};width:${Math.random()*8+4}px;height:${Math.random()*8+4}px;animation-duration:${Math.random()*2+1.5}s;animation-delay:${Math.random()*0.8}s;`;
    container.appendChild(c);
  }
}

// ============ SOUND ============
function playSpinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime, interval = 0.15;
    while (t < ctx.currentTime + 4.5) {
      const progress = (t - ctx.currentTime) / 4.5;
      const freq = 200 + 600 * Math.sin(progress * Math.PI);
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'triangle';
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.1);
      interval = 0.05 + 0.2 * (1 - Math.sin(progress * Math.PI));
      t += interval;
    }
  } catch (e) {}
}

function playWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t); osc.stop(t + 0.4);
    });
  } catch (e) {}
}

// ============ GLOBAL CHAT ============
function listenGlobalChat() {
  db.ref('globalChat').orderByChild('timestamp').limitToLast(100).on('value', snap => {
    renderChatMessages(snap.val() || {}, 'chat-messages');
  });
}

function renderChatMessages(msgs, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const arr = Object.values(msgs).sort((a, b) => a.timestamp - b.timestamp);
  if (arr.length === 0) { container.innerHTML = '<p class="empty-state">Belum ada pesan</p>'; return; }
  container.innerHTML = arr.map(msg => {
    if (msg.type === 'system') {
      return `<div class="chat-msg system"><div class="msg-bubble">${escHtml(msg.message)}</div></div>`;
    }
    const isOwn = msg.sender === currentUser.username;
    return `<div class="chat-msg ${isOwn ? 'own' : 'other'}">
      ${!isOwn ? `<span class="msg-sender">${escHtml(msg.sender)}</span>` : ''}
      <div class="msg-bubble">
        ${msg.image ? `<img src="${escHtml(msg.image)}" alt="gambar" onclick="openImage(this.src)">` : ''}
        ${msg.text ? escHtml(msg.text) : ''}
      </div>
      <span class="msg-time">${formatTime(msg.timestamp)}</span>
    </div>`;
  }).join('');
  scrollChatToBottom(containerId);
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (currentUser.status === 'banned') { showToast('Akun Anda dibanned.', 'error'); return; }
  await db.ref('globalChat').push({ sender: currentUser.username, text, timestamp: Date.now() });
  input.value = '';
}

function chatEnter(e) { if (e.key === 'Enter') sendChatMessage(); }

async function sendChatImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Hanya file gambar.', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Maks 2MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    await db.ref('globalChat').push({ sender: currentUser.username, image: e.target.result, timestamp: Date.now() });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function scrollChatToBottom(id) {
  setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollTop = el.scrollHeight; }, 80);
}

// ============ WINNER CHAT ============
function listenWinnerChat() {
  db.ref('winnerChat').orderByChild('timestamp').limitToLast(100).on('value', snap => {
    renderChatMessages(snap.val() || {}, 'winner-chat-messages');
  });
}

function checkWinnerAccess() {
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'owner';
  if (isStaff) {
    // Admin/owner selalu bisa akses dan kirim
    const area = document.querySelector('#page-winner-chat .chat-input-area');
    if (area) area.style.display = '';
    return;
  }
  // User biasa: cek apakah pemenang
  db.ref('winners').once('value', snap => {
    const winners = snap.val() || {};
    const isWinner = Object.values(winners).some(w => w.username === currentUser.username);
    // Pastikan nav winner chat muncul jika pemenang
    if (isWinner) {
      document.getElementById('nav-winner-chat').classList.remove('hidden');
    }
    const area = document.querySelector('#page-winner-chat .chat-input-area');
    if (area) area.style.display = isWinner ? '' : 'none';
    // Jika bukan pemenang, redirect ke dashboard
    if (!isWinner) {
      showToast('Hanya pemenang yang bisa mengakses halaman ini.', 'error');
      showPage('dashboard');
    }
  });
}

async function sendWinnerChatMessage() {
  const input = document.getElementById('winner-chat-input');
  const text = input.value.trim();
  if (!text) return;
  await db.ref('winnerChat').push({ sender: currentUser.username, text, timestamp: Date.now() });
  input.value = '';
}

function winnerChatEnter(e) { if (e.key === 'Enter') sendWinnerChatMessage(); }

async function sendWinnerChatImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Hanya file gambar.', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Maks 2MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    await db.ref('winnerChat').push({ sender: currentUser.username, image: e.target.result, timestamp: Date.now() });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ============ ADMIN PANEL ============
function loadAdminPanel() {
  if (currentUser.role !== 'admin' && currentUser.role !== 'owner') { showPage('dashboard'); return; }
  if (currentUser.role === 'owner') {
    document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.remove('hidden'));
  }
  const firstBtn = document.querySelector('.tab-btn');
  switchAdminTab('users', firstBtn);
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  if (btn) btn.classList.add('active');
  if (tab === 'users') loadAdminUsers();
  if (tab === 'winners') loadAdminWinners();
  if (tab === 'event') loadEventSettings();
  if (tab === 'keys') loadAdminKeys();
}

async function loadAdminUsers() {
  const snap = await db.ref('users').once('value');
  const users = snap.val() || {};
  const tbody = document.getElementById('users-tbody');
  const count = document.getElementById('admin-user-count');
  const arr = Object.values(users);
  count.textContent = arr.length + ' pengguna';
  if (arr.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada pengguna</td></tr>'; return; }
  tbody.innerHTML = arr.map(u => {
    const isSelf = u.username === currentUser.username;
    const isOwnerAcc = u.role === 'owner';
    const canModify = !isSelf && !isOwnerAcc;
    return `<tr>
      <td><strong>${escHtml(u.username)}</strong></td>
      <td><code style="font-size:13px;color:var(--text-muted)">${escHtml(u.password)}</code></td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td><span class="status-${u.status||'active'}">${u.status||'active'}</span></td>
      <td><div class="action-btns">
        ${canModify ? `
          ${u.status==='banned'
            ? `<button class="btn btn-table btn-unban" onclick="banUser('${escId(u.username)}',false)">Unban</button>`
            : `<button class="btn btn-table btn-ban" onclick="banUser('${escId(u.username)}',true)">Ban</button>`
          }
          <button class="btn btn-table btn-del" onclick="deleteUser('${escId(u.username)}')">Hapus</button>
        ` : '<span style="color:var(--text-muted);font-size:12px">-</span>'}
      </div></td>
    </tr>`;
  }).join('');
}

async function banUser(username, ban) {
  await db.ref('users/' + username).update({ status: ban ? 'banned' : 'active' });
  loadAdminUsers();
  showToast('Status pengguna diperbarui.', 'success');
}

function deleteUser(username) {
  showModal('Hapus Pengguna', `Hapus pengguna <strong>${escHtml(username)}</strong>? Tidak bisa dibatalkan.`, async () => {
    await db.ref('users/' + username).remove();
    loadAdminUsers();
    showToast('Pengguna dihapus.', 'success');
  });
}

async function loadAdminWinners() {
  const snap = await db.ref('winners').once('value');
  const winners = snap.val() || {};
  const container = document.getElementById('admin-winner-list');
  const arr = Object.values(winners).sort((a, b) => b.timestamp - a.timestamp);
  if (arr.length === 0) { container.innerHTML = '<p class="empty-state">Belum ada pemenang</p>'; return; }
  container.innerHTML = arr.map((w, i) => `
    <div class="winner-item">
      <span class="winner-rank">#${i+1}</span>
      <span class="winner-name-text">${escHtml(w.username)}</span>
      <span class="winner-time">${formatTime(w.timestamp)}</span>
    </div>`).join('');
}

async function loadEventSettings() {
  const snap = await db.ref('settings/event').once('value');
  const data = snap.val() || {};
  const toggle = document.getElementById('reg-toggle');
  const label = document.getElementById('reg-status-label');
  toggle.className = 'toggle-switch' + (data.registrationOpen ? ' on' : '');
  label.textContent = data.registrationOpen ? 'Dibuka' : 'Ditutup';
  if (data.startTime) document.getElementById('event-start').value = toLocalDatetime(data.startTime);
  if (data.endTime) document.getElementById('event-end').value = toLocalDatetime(data.endTime);
}

async function toggleRegistration() {
  const snap = await db.ref('settings/event').once('value');
  const newState = !(snap.val() || {}).registrationOpen;
  await db.ref('settings/event').update({ registrationOpen: newState });
  document.getElementById('reg-toggle').className = 'toggle-switch' + (newState ? ' on' : '');
  document.getElementById('reg-status-label').textContent = newState ? 'Dibuka' : 'Ditutup';
  showToast('Status pendaftaran diperbarui.', 'success');
}

async function saveEventSettings() {
  const startStr = document.getElementById('event-start').value;
  const endStr = document.getElementById('event-end').value;
  const updates = {};
  if (startStr) updates.startTime = new Date(startStr).getTime();
  if (endStr) updates.endTime = new Date(endStr).getTime();
  if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
    showToast('Waktu selesai harus lebih dari waktu mulai.', 'error'); return;
  }
  await db.ref('settings/event').update(updates);
  showToast('Pengaturan event disimpan.', 'success');
}

// ============ ADMIN KEYS ============
async function loadAdminKeys() {
  if (currentUser.role !== 'owner') return;
  const snap = await db.ref('adminKeys').once('value');
  const keys = snap.val() || {};
  const list = document.getElementById('key-list');
  const arr = Object.entries(keys);
  if (arr.length === 0) { list.innerHTML = '<p class="empty-state">Belum ada key admin</p>'; return; }
  list.innerHTML = arr.map(([id, key]) => `
    <div class="key-item">
      <span>${escHtml(key)}</span>
      <button class="btn btn-table btn-del" onclick="deleteAdminKey('${id}')">Hapus</button>
    </div>`).join('');
}

async function addAdminKey() {
  const input = document.getElementById('new-key-input');
  const key = input.value.trim();
  if (!key) { showToast('Key tidak boleh kosong.', 'error'); return; }
  if (key === OWNER_KEY) { showToast('Key tidak boleh sama dengan key owner.', 'error'); return; }
  await db.ref('adminKeys').push(key);
  input.value = '';
  loadAdminKeys();
  showToast('Key admin ditambahkan.', 'success');
}

async function deleteAdminKey(id) {
  await db.ref('adminKeys/' + id).remove();
  loadAdminKeys();
  showToast('Key admin dihapus.', 'success');
}

// ============ CLEAR DATABASE ============
function clearAllDatabase() {
  showModal(
    'CLEAR ALL DATABASE',
    '<strong style="color:var(--danger)">PERINGATAN!</strong> Tindakan ini menghapus SEMUA data. Tidak bisa dibatalkan!',
    async () => {
      await db.ref().set(null);
      showToast('Semua database berhasil dihapus.', 'success');
      logout();
    }, true
  );
}

// ============ MODAL ============
let modalCallback = null;

function showModal(title, body, onConfirm, isDanger = false) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  modalCallback = onConfirm;
  const btn = document.getElementById('modal-confirm-btn');
  btn.textContent = isDanger ? 'HAPUS SEMUA' : 'Konfirmasi';
  btn.className = 'btn ' + (isDanger ? 'btn-danger' : 'btn-primary');
  btn.onclick = () => { if (modalCallback) modalCallback(); closeModal(); };
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  modalCallback = null;
}

// ============ TOAST ============
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ============ OPEN IMAGE ============
function openImage(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:1000;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;';
  overlay.appendChild(img);
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

// ============ HELPERS ============
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escId(str) { return String(str).replace(/[^a-zA-Z0-9_-]/g,'_'); }
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function toLocalDatetime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
