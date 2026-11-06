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
  [220, 330, 440, 659].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime([.026, .014, .008, .003][index], now + .35);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 7.5);
    oscillator.connect(gain).connect(meditationBus);
    oscillator.start(now);
    oscillator.stop(now + 7.6);
  });
}

async function startMeditationSound() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  const now = audioContext.currentTime;
  const bus = audioContext.createGain();
  bus.gain.setValueAtTime(.0001, now);
  bus.gain.linearRampToValueAtTime(.46, now + 2);
  bus.connect(audioContext.destination);
  meditationBus = bus;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 480;
  filter.connect(bus);

  [[110, .055], [164.81, .025], [220, .012]].forEach(([frequency, volume]) => {
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
  meditationChimeTimer = setInterval(playMeditationChime, 12500);
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

$('#soundToggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const enabled = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enabled));
  $('#soundLabel').textContent = `Chuông: ${enabled ? 'bật' : 'tắt'}`;
  $('#soundIcon').textContent = enabled ? '♫' : '♪';
  if (enabled) playBell();
});

$('#meditateButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  meditationActive = !meditationActive;
  button.setAttribute('aria-pressed', String(meditationActive));
  garden.classList.toggle('meditating', meditationActive);

  if (meditationActive) {
    try {
      await startMeditationSound();
      button.setAttribute('aria-label', 'Dừng âm thanh thiền');
      button.title = 'Dừng âm thanh thiền';
      button.querySelector('small').textContent = 'Dừng thiền';
      showToast('Âm thiền nhẹ đang phát. Chúc bạn tĩnh tâm. 🌿');
    } catch (error) {
      meditationActive = false;
      garden.classList.remove('meditating');
      button.setAttribute('aria-pressed', 'false');
      showToast('Trình duyệt chưa phát được âm thanh. Hãy thử bấm lại nhé.');
    }
  } else {
    stopMeditationSound();
    button.setAttribute('aria-label', 'Ngồi tĩnh tâm');
    button.title = 'Bật âm thanh thiền';
    button.querySelector('small').textContent = 'Tĩnh tâm';
    showToast('Âm thanh thiền đã dừng.');
  }
});
