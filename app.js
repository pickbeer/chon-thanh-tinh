const $ = (selector) => document.querySelector(selector);
const joinForm = $('#joinForm');
const visitorName = $('#visitorName');
const joinButton = $('#joinButton');
const welcomeNote = $('#welcomeNote');
const garden = $('.garden');
const modal = $('#prayerModal');
const prayerForm = $('#prayerForm');
const prayerText = $('#prayerText');
let currentRoom = 'courtyard';
let visitor = null;
let toastTimer;
let audioContext;

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function updatePresence() {
  $('#peopleCount').textContent = visitor ? '1' : '0';
  $('#courtyardCount').textContent = visitor && currentRoom === 'courtyard' ? '1' : '0';
  $('#hallCount').textContent = visitor && currentRoom === 'hall' ? '1' : '0';
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = visitorName.value.trim();
  visitor = { name: name || 'Bạn' };
  welcomeNote.textContent = `Chào ${visitor.name}, mong bạn có một phút giây thật nhẹ lòng.`;
  joinButton.innerHTML = 'Bạn đang ở đây <span aria-hidden="true">✓</span>';
  visitorName.disabled = true;
  joinButton.disabled = true;
  updatePresence();
  showToast('Chào mừng bạn ghé thăm 🌿');
});

document.querySelectorAll('.room-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    currentRoom = tab.dataset.room;
    document.querySelectorAll('.room-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
    const inHall = currentRoom === 'hall';
    garden.classList.toggle('hall-view', inHall);
    $('#roomCaption').textContent = inHall ? 'CHÍNH ĐIỆN' : 'SÂN CHÙA';
    updatePresence();
  });
});

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
  $('#soundLabel').textContent = `Âm thanh: ${enabled ? 'bật' : 'tắt'}`;
  $('#soundIcon').textContent = enabled ? '♫' : '♪';
  if (enabled) playBell();
});

$('#meditateButton').addEventListener('click', () => {
  showToast('Hít vào thật chậm… thở ra thật nhẹ. 🌿');
  garden.classList.add('meditating');
  setTimeout(() => garden.classList.remove('meditating'), 4500);
});
