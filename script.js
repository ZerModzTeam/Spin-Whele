/* ============================================
   ZMT SPIN GIVEAWAY - SCRIPT.JS
   Full Application Logic
   ============================================ */

// ============ FIREBASE CONFIG ============
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

// ============ GLOBAL STATE ============
let currentUser = null;
let isSpinning = false;
let spinListeners = [];
let countdownInterval = null;

// ============ OWNER KEY ============
const OWNER_KEY = "zmtxxx";

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
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 10 + 8}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: ${Math.random() * 0.6 + 0.2};
    `;
    container.appendChild(p);
  }
}

// ============ LOGIN ============
async function loginUser() {
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value.trim();
  const errorEl = document.getElementById('user-login-error');
  errorEl.classList.add('hidden');

  if (!username || !password) {
    showError(errorEl, 'Username dan password wajib diisi.');
    return;
  }
  if (username.length < 3) {
    showError(errorEl, 'Username minimal 3 karakter.');
    return;
  }

  try {
    const userRef = db.ref('users/' + username);
    const snap = await userRef.once('value');

    if (!snap.exists()) {
      // Register new user
      const newUser = {
        username,
        password,
        role: 'user',
        status: 'active',
        createdAt: Date.now()
      };
      await userRef.set(newUser);
      currentUser = newUser;
    } else {
      const userData = snap.val();
      if (userData.password !== password) {
        showError(errorEl, 'Password salah.');
        return;
      }
      if (userData.status === 'banned') {
        showError(errorEl, 'Akun ini dibanned.');
        return;
      }
      currentUser = userData;
    }
    sessionStorage.setItem('zmtUser', JSON.stringify(currentUser));
    initApp();
  } catch (err) {
    showError(errorEl, 'Terjadi kesalahan: ' + err.message);
  }
}

async function loginAdmin() {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value.trim();
  const key = document.getElementById('admin-key').value.trim();
  const errorEl = document.getElementById('admin-login-error');
  errorEl.classList.add('hidden');

  if (!username || !password || !key) {
    showError(errorEl, 'Semua field wajib diisi.');
    return;
  }

  try {
    let role = null;

    // Check if owner key
    if (key === OWNER_KEY) {
      role = 'owner';
    } else {
      // Check admin keys from DB
      const keysSnap = await db.ref('adminKeys').once('value');
      const keys = keysSnap.val() || {};
      const validKey = Object.values(keys).find(k => k === key);
      if (validKey) {
        role = 'admin';
      } else {
        showError(errorEl, 'Key tidak valid.');
        return;
      }
    }

    const userRef = db.ref('users/' + username);
    const snap = await userRef.once('value');

    if (!snap.exists()) {
      // Create admin/owner account
      const newUser = { username, password, role, status: 'active', createdAt: Date.now() };
      await userRef.set(newUser);
      currentUser = newUser;
    } else {
      const userData = snap.val();
      if (userData.password !== password) {
        showError(errorEl, 'Password salah.');
        return;
      }
      // Update role if needed
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
  const adminToggle = document.getElementById('card-admin-toggle');
  const adminCard = document.getElementById('card-admin');
  adminToggle.classList.add('hidden');
  adminCard.classList.remove('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ============ LOGOUT ============
function logout() {
  // Remove all listeners
  spinListeners.forEach(off => off());
  spinListeners = [];
  if (countdownInterval) clearInterval(countdownInterval);
  currentUser = null;
  sessionStorage.removeItem('zmtUser');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('page-login').classList.add('hidden');
  // Reset login form
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

  // Show admin nav
  if (u.role === 'admin' || u.role === 'owner') {
    document.getElementById('nav-admin').classList.remove('hidden');
  }
}

// ============ PAGE ROUTING ============
function showPage(page) {
  document.querySelectorAll('.inner-page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  const navLink = document.querySelector(`[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');

  // Page-specific init
  if (page === 'dashboard') loadDashboard();
  if (page === 'spin') loadSpinPage();
  if (page === 'chat') scrollChatToBottom('chat-messages');
  if (page === 'winner-chat') checkWinnerAccess();
  if (page === 'admin') loadAdminPanel();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden');
}

// ============ REALTIME LISTENERS ============
function startRealtimeListeners() {
  // Listen to event settings
  const eventRef = db.ref('settings/event');
  const evtOff = eventRef.on('value', snap => {
    updateCountdown(snap.val());
  });
  spinListeners.push(() => eventRef.off('value', evtOff));

  // Listen to winners count
  const winnersRef = db.ref('winners');
  const wOff = winnersRef.on('value', snap => {
    const count = snap.val() ? Object.keys(snap.val()).length : 0;
    document.getElementById('stat-winner-count').textContent = count;
    document.getElementById('stat-spin-count').textContent = count;
  });
  spinListeners.push(() => winnersRef.off('value', wOff));

  // Listen to users count
  const usersRef = db.ref('users');
  const uOff = usersRef.on('value', snap => {
    const data = snap.val() || {};
    const count = Object.values(data).filter(u => u.role === 'user').length;
    document.getElementById('stat-total-users').textContent = Object.keys(data).length;
  });
  spinListeners.push(() => usersRef.off('value', uOff));

  // Global chat listener
  listenGlobalChat();
  listenWinnerChat();

  // Check if current user is winner
  checkIfWinner();
}

function checkIfWinner() {
  db.ref('winners').on('value', snap => {
    const winners = snap.val() || {};
    const isWinner = Object.values(winners).some(w => w.username === currentUser.username);
    if (isWinner) {
      document.getElementById('nav-winner-chat').classList.remove('hidden');
    }
  });
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

  // Update registration toggle UI
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
      const diff = startTime - now;
      label.textContent = 'Event dimulai dalam';
      badge.textContent = 'Belum Dibuka';
      badge.className = 'event-status-badge';
      setCountdownFromMs(diff);
      return;
    }
    if (startTime && now >= startTime && (!endTime || now < endTime)) {
      label.textContent = 'Event berlangsung, berakhir dalam';
      badge.textContent = 'Sedang Berlangsung';
      badge.className = 'event-status-badge open';
      if (endTime) {
        setCountdownFromMs(endTime - now);
      } else {
        setCountdownDisplay(0, 0, 0, 0);
      }
    }
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function setCountdownFromMs(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  setCountdownDisplay(d, h, m, s);
}

function setCountdownDisplay(d, h, m, s) {
  document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
  document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
  document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
  document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
}

// ============ DASHBOARD ============
async function loadDashboard() {
  // Load winners
  const winnersSnap = await db.ref('winners').once('value');
  const winners = winnersSnap.val() || {};
  const winnerList = document.getElementById('winner-list-dashboard');
  const winnerArr = Object.values(winners).sort((a, b) => b.timestamp - a.timestamp);

  if (winnerArr.length === 0) {
    winnerList.innerHTML = '<p class="empty-state">Belum ada pemenang</p>';
  } else {
    winnerList.innerHTML = winnerArr.map((w, i) => `
      <div class="winner-item">
        <span class="winner-rank">#${i + 1}</span>
        <span class="winner-name-text">${escHtml(w.username)}</span>
        <span class="winner-time">${formatTime(w.timestamp)}</span>
      </div>
    `).join('');
  }
}

// ============ SPIN PAGE ============
function loadSpinPage() {
  const controls = document.getElementById('spin-controls-admin');
  if (currentUser.role === 'user') {
    controls.style.display = 'none';
  }

  // Listen participants
  db.ref('users').on('value', snap => {
    const users = snap.val() || {};
    const participants = Object.values(users).filter(u => u.role === 'user' && u.status === 'active');
    renderParticipants(participants);
    drawWheel(participants);
  });

  // Listen winners for result display
  db.ref('winners').on('value', snap => {
    const winners = snap.val() || {};
    const list = Object.values(winners);
    if (list.length > 0) {
      const latest = list.sort((a, b) => b.timestamp - a.timestamp)[0];
      showWinnerResult(latest.username);
    }
  });
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
    </div>
  `).join('');
}

// ============ SPIN WHEEL CANVAS ============
function drawWheel(participants) {
  const canvas = document.getElementById('spin-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 10;

  ctx.clearRect(0, 0, w, h);

  if (participants.length === 0) {
    // Draw empty wheel
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Belum ada peserta', cx, cy);
    return;
  }

  const n = participants.length;
  const slice = (2 * Math.PI) / n;

  // Color palette for wheel segments
  const colors = [
    '#1d4ed8','#1e40af','#2563eb','#3b82f6','#1e3a8a',
    '#0369a1','#0284c7','#0ea5e9','#0c4a6e','#164e63',
    '#155e75','#0891b2','#06b6d4','#0e7490','#1a56db'
  ];

  for (let i = 0; i < n; i++) {
    const startAngle = i * slice - Math.PI / 2;
    const endAngle = startAngle + slice;

    // Segment
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    // Border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + slice / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const fontSize = Math.min(14, Math.max(8, r * 0.08));
    ctx.font = `600 ${fontSize}px Inter`;
    const name = participants[i].username;
    const truncated = name.length > 10 ? name.substring(0, 10) + '...' : name;
    ctx.fillText(truncated, r - 16, 0);
    ctx.restore();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb';
  ctx.fill();
}

// ============ SPIN LOGIC ============
let wheelRotation = 0;

async function startSpin() {
  if (isSpinning) return;
  if (currentUser.role === 'user') return;

  // Get participants
  const snap = await db.ref('users').once('value');
  const users = snap.val() || {};
  const participants = Object.values(users).filter(u => u.role === 'user' && u.status === 'active');

  if (participants.length === 0) {
    showToast('Tidak ada peserta untuk di-spin!', 'error');
    return;
  }

  isSpinning = true;
  const btn = document.getElementById('spin-btn');
  btn.disabled = true;
  btn.textContent = 'Sedang berputar...';

  // Play spin sound
  playSpinSound();

  // Random winner
  const winnerIdx = Math.floor(Math.random() * participants.length);
  const winner = participants[winnerIdx];

  // Calculate rotation: extra full rotations + land on winner segment
  const n = participants.length;
  const slice = 360 / n;
  const targetAngle = 360 - (winnerIdx * slice + slice / 2);
  const extraSpins = (5 + Math.floor(Math.random() * 5)) * 360;
  const totalRotation = wheelRotation + extraSpins + targetAngle;

  // Animate
  const canvas = document.getElementById('spin-canvas');
  const duration = 4000 + Math.random() * 2000;
  const start = performance.now();
  const startRot = wheelRotation;

  function animate(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeOutCubic(progress);
    const current = startRot + (totalRotation - startRot) * ease;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((current * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    drawWheel(participants);
    ctx.restore();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelRotation = totalRotation % 360;
      finishSpin(winner, participants);
    }
  }

  requestAnimationFrame(animate);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

async function finishSpin(winner, participants) {
  isSpinning = false;
  const btn = document.getElementById('spin-btn');
  btn.disabled = false;
  btn.textContent = 'PUTAR SEKARANG';

  // Save winner
  const winnerData = {
    username: winner.username,
    timestamp: Date.now()
  };
  await db.ref('winners').push(winnerData);

  // Send system message to global chat
  await db.ref('globalChat').push({
    type: 'system',
    message: winner.username + ' Memenangkan Giveaway!',
    timestamp: Date.now()
  });

  // Play win sound
  playWinSound();

  // Show popup
  showWinnerPopup(winner.username);

  // Redraw normal wheel
  drawWheel(participants);

  // Highlight winner in list
  document.querySelectorAll('.participant-item').forEach(el => {
    el.classList.remove('winner');
  });
  const winnerEl = document.getElementById('part-' + escId(winner.username));
  if (winnerEl) winnerEl.classList.add('winner');
}

function showWinnerResult(username) {
  const card = document.getElementById('winner-result-card');
  const announce = document.getElementById('winner-announce');
  card.style.display = 'block';
  announce.innerHTML = `
    <div class="w-trophy"></div>
    <div class="w-label">Pemenang</div>
    <div class="w-name">${escHtml(username)}</div>
  `;
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
    const color = colors[Math.floor(Math.random() * colors.length)];
    c.style.cssText = `
      background: ${color};
      left: ${Math.random() * 100}%;
      top: -10px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      width: ${Math.random() * 8 + 4}px;
      height: ${Math.random() * 8 + 4}px;
      animation-duration: ${Math.random() * 2 + 1.5}s;
      animation-delay: ${Math.random() * 0.8}s;
    `;
    container.appendChild(c);
  }
}

// ============ SOUND ============
function playSpinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let startTime = ctx.currentTime;
    const duration = 4.5;

    function playTick(time, freq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.start(time);
      osc.stop(time + 0.1);
    }

    // Increasing tick speed then decreasing
    let t = startTime;
    let interval = 0.15;
    while (t < startTime + duration) {
      const progress = (t - startTime) / duration;
      const freq = 200 + 600 * Math.sin(progress * Math.PI);
      playTick(t, freq);
      interval = 0.05 + 0.2 * (1 - Math.sin(progress * Math.PI));
      t += interval;
    }
  } catch (e) {}
}

function playWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (e) {}
}

// ============ GLOBAL CHAT ============
let lastChatKey = null;

function listenGlobalChat() {
  const chatRef = db.ref('globalChat').orderByChild('timestamp').limitToLast(100);
  chatRef.on('value', snap => {
    const msgs = snap.val() || {};
    renderChatMessages(msgs, 'chat-messages');
  });
}

function renderChatMessages(msgs, containerId) {
  const container = document.getElementById(containerId);
  const msgArr = Object.values(msgs).sort((a, b) => a.timestamp - b.timestamp);

  if (msgArr.length === 0) {
    container.innerHTML = '<p class="empty-state">Belum ada pesan</p>';
    return;
  }

  container.innerHTML = msgArr.map(msg => {
    if (msg.type === 'system') {
      return `<div class="chat-msg system">
        <div class="msg-bubble">${escHtml(msg.message)}</div>
      </div>`;
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

  if (currentUser.status === 'banned') {
    showToast('Akun Anda dibanned.', 'error');
    return;
  }

  await db.ref('globalChat').push({
    sender: currentUser.username,
    text,
    timestamp: Date.now()
  });
  input.value = '';
}

function chatEnter(e) {
  if (e.key === 'Enter') sendChatMessage();
}

async function sendChatImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Hanya file gambar yang diizinkan.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ukuran gambar maksimal 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    await db.ref('globalChat').push({
      sender: currentUser.username,
      image: e.target.result,
      timestamp: Date.now()
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function scrollChatToBottom(containerId) {
  setTimeout(() => {
    const el = document.getElementById(containerId);
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}

// ============ WINNER CHAT ============
function listenWinnerChat() {
  db.ref('winnerChat').orderByChild('timestamp').limitToLast(100).on('value', snap => {
    const msgs = snap.val() || {};
    renderChatMessages(msgs, 'winner-chat-messages');
  });
}

function checkWinnerAccess() {
  db.ref('winners').once('value', snap => {
    const winners = snap.val() || {};
    const isWinner = Object.values(winners).some(w => w.username === currentUser.username);
    const canAccess = isWinner || currentUser.role === 'admin' || currentUser.role === 'owner';

    const container = document.querySelector('#page-winner-chat .chat-input-area');
    if (!canAccess) {
      if (container) container.style.display = 'none';
      document.getElementById('winner-chat-messages').innerHTML = '<p class="empty-state">Hanya pemenang yang dapat mengirim pesan di sini.</p>';
    }
  });
}

async function sendWinnerChatMessage() {
  const input = document.getElementById('winner-chat-input');
  const text = input.value.trim();
  if (!text) return;

  await db.ref('winnerChat').push({
    sender: currentUser.username,
    text,
    timestamp: Date.now()
  });
  input.value = '';
}

function winnerChatEnter(e) {
  if (e.key === 'Enter') sendWinnerChatMessage();
}

async function sendWinnerChatImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Hanya file gambar yang diizinkan.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ukuran gambar maksimal 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    await db.ref('winnerChat').push({
      sender: currentUser.username,
      image: e.target.result,
      timestamp: Date.now()
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ============ ADMIN PANEL ============
function loadAdminPanel() {
  if (currentUser.role !== 'admin' && currentUser.role !== 'owner') {
    showPage('dashboard');
    return;
  }

  // Show owner-only tabs
  if (currentUser.role === 'owner') {
    document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.remove('hidden'));
  }

  switchAdminTab('users', document.querySelector('.tab-btn'));
  loadAdminUsers();
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

  if (arr.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada pengguna</td></tr>';
    return;
  }

  tbody.innerHTML = arr.map(u => {
    const isSelf = u.username === currentUser.username;
    const isOwner = u.role === 'owner';
    const canModify = !isSelf && !isOwner;

    return `<tr>
      <td><strong>${escHtml(u.username)}</strong></td>
      <td><code style="font-size:13px;color:var(--text-muted)">${escHtml(u.password)}</code></td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td><span class="status-${u.status || 'active'}">${u.status || 'active'}</span></td>
      <td>
        <div class="action-btns">
          ${canModify ? `
            ${u.status === 'banned'
              ? `<button class="btn btn-table btn-unban" onclick="banUser('${escId(u.username)}', false)">Unban</button>`
              : `<button class="btn btn-table btn-ban" onclick="banUser('${escId(u.username)}', true)">Ban</button>`
            }
            <button class="btn btn-table btn-del" onclick="deleteUser('${escId(u.username)}')">Hapus</button>
          ` : '<span style="color:var(--text-muted);font-size:12px">-</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function banUser(username, ban) {
  await db.ref('users/' + username).update({ status: ban ? 'banned' : 'active' });
  loadAdminUsers();
  showToast('Status pengguna diperbarui.', 'success');
}

function deleteUser(username) {
  showModal(
    'Hapus Pengguna',
    `Apakah Anda yakin ingin menghapus pengguna <strong>${escHtml(username)}</strong>? Tindakan ini tidak dapat dibatalkan.`,
    async () => {
      await db.ref('users/' + username).remove();
      loadAdminUsers();
      showToast('Pengguna dihapus.', 'success');
    }
  );
}

async function loadAdminWinners() {
  const snap = await db.ref('winners').once('value');
  const winners = snap.val() || {};
  const container = document.getElementById('admin-winner-list');
  const arr = Object.values(winners).sort((a, b) => b.timestamp - a.timestamp);

  if (arr.length === 0) {
    container.innerHTML = '<p class="empty-state">Belum ada pemenang</p>';
    return;
  }

  container.innerHTML = arr.map((w, i) => `
    <div class="winner-item">
      <span class="winner-rank">#${i + 1}</span>
      <span class="winner-name-text">${escHtml(w.username)}</span>
      <span class="winner-time">${formatTime(w.timestamp)}</span>
    </div>
  `).join('');
}

async function loadEventSettings() {
  const snap = await db.ref('settings/event').once('value');
  const data = snap.val() || {};

  const toggle = document.getElementById('reg-toggle');
  const label = document.getElementById('reg-status-label');

  if (data.registrationOpen) {
    toggle.classList.add('on');
    label.textContent = 'Dibuka';
  } else {
    toggle.classList.remove('on');
    label.textContent = 'Ditutup';
  }

  if (data.startTime) {
    document.getElementById('event-start').value = toLocalDatetime(data.startTime);
  }
  if (data.endTime) {
    document.getElementById('event-end').value = toLocalDatetime(data.endTime);
  }
}

async function toggleRegistration() {
  const snap = await db.ref('settings/event').once('value');
  const data = snap.val() || {};
  const newState = !data.registrationOpen;
  await db.ref('settings/event').update({ registrationOpen: newState });
  const toggle = document.getElementById('reg-toggle');
  const label = document.getElementById('reg-status-label');
  toggle.className = 'toggle-switch' + (newState ? ' on' : '');
  label.textContent = newState ? 'Dibuka' : 'Ditutup';
  showToast('Status pendaftaran diperbarui.', 'success');
}

async function saveEventSettings() {
  const startStr = document.getElementById('event-start').value;
  const endStr = document.getElementById('event-end').value;

  const updates = {};
  if (startStr) updates.startTime = new Date(startStr).getTime();
  if (endStr) updates.endTime = new Date(endStr).getTime();

  if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
    showToast('Waktu selesai harus lebih dari waktu mulai.', 'error');
    return;
  }

  await db.ref('settings/event').update(updates);
  showToast('Pengaturan event disimpan.', 'success');
}

// ============ ADMIN KEYS (OWNER ONLY) ============
async function loadAdminKeys() {
  if (currentUser.role !== 'owner') return;

  const snap = await db.ref('adminKeys').once('value');
  const keys = snap.val() || {};
  const list = document.getElementById('key-list');
  const arr = Object.entries(keys);

  if (arr.length === 0) {
    list.innerHTML = '<p class="empty-state">Belum ada key admin</p>';
    return;
  }

  list.innerHTML = arr.map(([id, key]) => `
    <div class="key-item">
      <span>${escHtml(key)}</span>
      <button class="btn btn-table btn-del" onclick="deleteAdminKey('${id}')">Hapus</button>
    </div>
  `).join('');
}

async function addAdminKey() {
  const input = document.getElementById('new-key-input');
  const key = input.value.trim();
  if (!key) {
    showToast('Key tidak boleh kosong.', 'error');
    return;
  }
  if (key === OWNER_KEY) {
    showToast('Key tidak boleh sama dengan key owner.', 'error');
    return;
  }

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
    '<strong style="color:var(--danger)">PERINGATAN!</strong> Tindakan ini akan menghapus SEMUA data: pengguna, chat, pemenang, pengaturan, dan key admin. Tindakan ini TIDAK DAPAT dibatalkan!',
    async () => {
      await db.ref().set(null);
      showToast('Semua database berhasil dihapus.', 'success');
      logout();
    },
    true
  );
}

// ============ MODAL ============
let modalCallback = null;

function showModal(title, body, onConfirm, isDanger = false) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  modalCallback = onConfirm;

  const confirmBtn = document.getElementById('modal-confirm-btn');
  confirmBtn.textContent = isDanger ? 'HAPUS SEMUA' : 'Konfirmasi';
  confirmBtn.className = 'btn ' + (isDanger ? 'btn-danger' : 'btn-primary');
  confirmBtn.onclick = () => {
    if (modalCallback) modalCallback();
    closeModal();
  };

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
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============ OPEN IMAGE ============
function openImage(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.9);
    z-index: 1000; display: flex; align-items: center;
    justify-content: center; cursor: zoom-out;
  `;
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width: 90vw; max-height: 90vh; border-radius: 8px;';
  overlay.appendChild(img);
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

// ============ HELPERS ============
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function toLocalDatetime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
