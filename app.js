import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, onDisconnect } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

const $ = (selector) => document.querySelector(selector);
const joinForm = $('#joinForm');
const visitorName = $('#visitorName');
const joinButton = $('#joinButton');
const welcomeNote = $('#welcomeNote');
const garden = $('.garden');
const modal = $('#prayerModal');
const prayerForm = $('#prayerForm');
const prayerText = $('#prayerText');
const namesLine = $('#presenceNames');
const worshippers = $('#worshippers');
let currentRoom = 'courtyard';
let presenceData = {};
let visitor = null;
let currentUid = null;
let database = null;
let toastTimer;
let audioContext;
let meditationActive = false;
let meditationBus = null;
let meditationOscillators = [];
let meditationChimeTimer = null;
const hallSeats = [
  [6, .98, [42, 58, 28, 72, 12, 88]],
  [15, .88, [43, 57, 30, 70, 17, 83]],
  [23, .79, [43, 57, 32, 68, 20, 80]],
  [31, .70, [44, 56, 34, 66, 24, 76]],
  [39, .61, [44, 56, 37, 63, 28, 72]],
  [45, .54, [44, 56, 39, 61, 32, 68]]
].flatMap(([bottom, scale, columns]) => columns.map((x) => ({ x, bottom, scale })));
let authReady = Promise.resolve(null);

const firebaseConfig = {
  apiKey: 'AIzaSyAA3GSUsxarsCaguePSe0PNyWKRJojwNMc',
  authDomain: 'chon-thanh-tinh-live.firebaseapp.com',
  databaseURL: 'https://chon-thanh-tinh-live-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'chon-thanh-tinh-live',
  storageBucket: 'chon-thanh-tinh-live.firebasestorage.app',
  messagingSenderId: '111045636475',
  appId: '1:111045636475:web:ced6378c18f81b986f0dde'
};

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function renderPresence(data) {
  const people = Object.entries(data || {})
    .filter(([, person]) => person && typeof person.name === 'string' && ['courtyard', 'hall'].includes(person.room))
    .map(([uid, person]) => ({ uid, name: person.name.slice(0, 24), room: person.room }));
  $('#peopleCount').textContent = String(people.length);
  $('#courtyardCount').textContent = String(people.filter((person) => person.room === 'courtyard').length);
  $('#hallCount').textContent = String(people.filter((person) => person.room === 'hall').length);
  namesLine.replaceChildren();
  if (!people.length) {
    namesLine.textContent = 'Chưa có ai tham gia';
  } else {
    people.forEach((person) => {
      const name = document.createElement('span');
      name.className = 'presence-name';
      name.textContent = person.name;
      namesLine.append(name);
    });
  }

  const inRoom = people.filter((person) => person.room === currentRoom);
  worshippers.replaceChildren();
  inRoom.slice(0, hallSeats.length).forEach((person, index) => {
    const figure = document.createElement('span');
    const small = document.createElement('small');
    const head = document.createElement('b');
    const robe = document.createElement('i');
    const seat = hallSeats[index];
    figure.className = 'worshipper visitor-person';
    figure.style.setProperty('--person-x', `${seat.x}%`);
    figure.style.setProperty('--person-bottom', `${seat.bottom}%`);
    figure.style.setProperty('--person-scale', String(seat.scale));
    figure.style.setProperty('--person-delay', `${(index % 6) * -0.55}s`);
    small.className = 'name-label';
    small.textContent = person.name;
    figure.append(small, head, robe);
    worshippers.append(figure);
  });
}

try {
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  database = getDatabase(firebaseApp);
  authReady = signInAnonymously(auth).then(({ user }) => {
    currentUid = user.uid;
    onValue(ref(database, 'presence'), (snapshot) => {
      presenceData = snapshot.val() || {};
      renderPresence(presenceData);
    }, () => {
      welcomeNote.textContent = 'Chưa kết nối được danh sách người đang có mặt.';
    });
    onValue(ref(database, '.info/connected'), (snapshot) => {
      if (snapshot.val() && visitor && currentUid) {
        const userRef = ref(database, `presence/${currentUid}`);
        onDisconnect(userRef).remove().then(() => set(userRef, visitor)).catch(() => {});
      }
    });
    return user;
  }).catch(() => {
    welcomeNote.textContent = 'Chưa kết nối được Firebase. Danh sách người tham gia chưa hoạt động.';
    return null;
  });
} catch (error) {
  welcomeNote.textContent = 'Chưa kết nối được dịch vụ đếm người tham gia.';
}

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = visitorName.value.trim().slice(0, 24) || 'Bạn';
  const user = await authReady;
  if (!user || !database) {
    showToast('Đang kết nối danh sách người tham gia, vui lòng thử lại.');
    return;
  }
  visitor = { name, room: currentRoom };
  const userRef = ref(database, `presence/${user.uid}`);
  try {
    await onDisconnect(userRef).remove();
    await set(userRef, visitor);
    welcomeNote.textContent = `Chào ${name}, tên bạn đang hiển thị cùng mọi người.`;
    joinButton.innerHTML = 'Bạn đang ở đây <span aria-hidden="true">✓</span>';
    visitorName.disabled = true;
    joinButton.disabled = true;
  } catch (error) {
    visitor = null;
    showToast('Chưa ghi nhận được lượt tham gia. Vui lòng thử lại sau.');
  }
});

function enterRoom(room) {
  currentRoom = room;
  document.querySelectorAll('.room-tab').forEach((item) => {
    const active = item.dataset.room === room;
    item.classList.toggle('active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const inHall = room === 'hall';
  garden.classList.toggle('hall-view', inHall);
  $('#hallInterior').setAttribute('aria-hidden', String(!inHall));
  $('#enterHallButton').hidden = inHall;
  $('#roomCaption').textContent = inHall ? 'CHÍNH ĐIỆN' : 'SÂN CHÙA';
  $('.caption-hint').textContent = inHall ? 'Xin giữ lòng thanh tịnh' : 'Một nơi để thở chậm lại';
  renderPresence(presenceData);
  if (visitor && currentUid && database) {
    visitor = { ...visitor, room };
    set(ref(database, `presence/${currentUid}`), visitor).catch(() => {});
  }
}

document.querySelectorAll('.room-tab').forEach((tab) => {
  tab.addEventListener('click', () => enterRoom(tab.dataset.room));
});
$('#enterHallButton').addEventListener('click', () => enterRoom('hall'));

$('#prayerButton').addEventListener('click', () => {
  prayerText.value = '';
  $('#charCount').textContent = '0 / 240';
  modal.showModal();
  prayerText.focus();
});
prayerText.addEventListener('input', () => {
  $('#charCount').textContent = `${prayerText.value.length} / 240`;
});
prayerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!prayerText.value.trim()) {
    showToast('Bạn hãy viết một lời lành trước nhé.');
    prayerText.focus();
    return;
  }
  modal.close();
  showToast('Lời lành của bạn đã được gửi vào khoảng lặng.');
});

function playBell() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    [0, 2.76, 5.4].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 392 + frequency;
      gain.gain.setValueAtTime(index === 0 ? .17 : .045, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + 3.5);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 3.6);
    });
  } catch (error) {
    // The visual bell remains available when browser audio is unavailable.
  }
}

function playMeditationChime() {
  if (!audioContext || !meditationBus) return;
  const now = audioContext.currentTime;
  [293.66, 392, 587.33, 783.99].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime([.014, .009, .005, .002][index], now + 1.1);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 11.5);
    oscillator.connect(gain).connect(meditationBus);
    oscillator.start(now);
    oscillator.stop(now + 11.6);
  });
}

async function startMeditationSound() {
  if (meditationBus) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const resumePromise = audioContext.resume();
  await Promise.race([
    resumePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Audio needs a user gesture')), 900))
  ]);
  if (audioContext.state !== 'running') throw new Error('Audio is blocked until a user gesture');

  const now = audioContext.currentTime;
  const bus = audioContext.createGain();
  bus.gain.setValueAtTime(.0001, now);
  bus.gain.linearRampToValueAtTime(.32, now + 3.5);
  bus.connect(audioContext.destination);
  meditationBus = bus;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1050;
  filter.connect(bus);

  [[196, .028], [293.66, .016], [392, .008], [587.33, .0025]].forEach(([frequency, volume]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain).connect(filter);
    oscillator.start(now);
    meditationOscillators.push(oscillator);
  });

  playMeditationChime();
  meditationChimeTimer = setInterval(playMeditationChime, 17500);
}

function stopMeditationSound() {
  if (meditationChimeTimer) clearInterval(meditationChimeTimer);
  meditationChimeTimer = null;
  const bus = meditationBus;
  meditationBus = null;
  if (!bus || !audioContext) return;
  const now = audioContext.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setTargetAtTime(.0001, now, .45);
  meditationOscillators.forEach((oscillator) => {
    try { oscillator.stop(now + 1.8); } catch (error) {}
  });
  meditationOscillators = [];
  setTimeout(() => bus.disconnect(), 2200);
}

$('#bellButton').addEventListener('click', () => {
  const ripple = $('#bellRipple');
  ripple.classList.remove('ringing');
  void ripple.offsetWidth;
  ripple.classList.add('ringing');
  if ($('#soundToggle').getAttribute('aria-pressed') === 'true') playBell();
  showToast('Tiếng chuông nhắc ta trở về phút giây hiện tại.');
});

function syncMeditationControls(enabled) {
  meditationActive = enabled;
  garden.classList.toggle('meditating', enabled);
  const soundToggle = $('#soundToggle');
  soundToggle.setAttribute('aria-pressed', String(enabled));
  $('#soundIcon').textContent = enabled ? '♫' : '♪';
  $('#soundLabel').textContent = `Nhạc thiền: ${enabled ? 'đang phát' : 'tắt'}`;

  const meditateButton = $('#meditateButton');
  meditateButton.setAttribute('aria-pressed', String(enabled));
  meditateButton.setAttribute('aria-label', enabled ? 'Dừng âm thanh thiền' : 'Ngồi tĩnh tâm');
  meditateButton.title = enabled ? 'Dừng âm thanh thiền' : 'Bật âm thanh thiền';
  meditateButton.querySelector('small').textContent = enabled ? 'Dừng thiền' : 'Tĩnh tâm';
}

async function setMeditationEnabled(enabled, announce = false) {
  if (!enabled) {
    stopMeditationSound();
    syncMeditationControls(false);
    if (announce) showToast('Nhạc thiền đã dừng.');
    return false;
  }

  try {
    await startMeditationSound();
    syncMeditationControls(true);
    if (announce) showToast('Nhạc thiền nhẹ đang phát. Chúc bạn tĩnh tâm. 🌿');
    return true;
  } catch (error) {
    syncMeditationControls(false);
    $('#soundLabel').textContent = 'Chạm để bật nhạc thiền';
    if (announce) showToast('Trình duyệt chặn tự phát. Chạm vào đây để bật nhạc thiền.');
    return false;
  }
}

$('#soundToggle').addEventListener('click', () => {
  setMeditationEnabled(!meditationActive, true);
});

$('#meditateButton').addEventListener('click', () => {
  setMeditationEnabled(!meditationActive, true);
});

// Try to start ambience on arrival. Browsers that block autoplay show a one-tap fallback.
setMeditationEnabled(true);
