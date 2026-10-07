import Phaser from 'phaser';
import { Client, type Room } from 'colyseus.js';
import { APARTMENT } from '../shared/map';
import { DEFAULT_AVATAR, cleanAvatar, SKINS, HAIR, COLORS, type AvatarConfig, type Snapshot, type Inspection, type Direction } from '../shared/types';
import { drawAvatar } from './art';
import { ApartmentScene } from './scene';
import { sound, TRACK_LIST } from './audio';
import './style.css';

// ── Small helpers ───────────────────────────────────────────────
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function readLocal(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function saveLocal(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private browsing may block storage. */ } }
function formatTime(ms: number) { const n = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── State ───────────────────────────────────────────────────────
let avatar: AvatarConfig;
try { avatar = cleanAvatar(JSON.parse(readLocal('a07-avatar', '{}'))); } catch { avatar = { ...DEFAULT_AVATAR }; }
let playerName = readLocal('a07-name', '');
let state: Snapshot | undefined, room: Room | undefined, game: Phaser.Game | undefined, scene: ApartmentScene | undefined;
let overlay: string | null = null, inspection: Inspection | undefined, near: string | null = null, busy = false;
let lastPhase = '', lobbySignature = '', hudSignature = '', chatSignature = '', goalSignature = '';
let sequence: string[] = [], startedLocally = false, reconnecting = false, namesOn = true;
let knownItems: Set<string> | undefined, knownClues: Set<string> | undefined, unreadChat = 0, lastChatCount = 0;
let lightningOn = readLocal('a07-lightning', 'true') === 'true';
const seenRooms = new Set<string>();
const api = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '') ?? `${location.protocol}//${location.hostname}:2567`;
const client = new Client(api.replace(/^http/, 'ws'));
const invite = (new URL(location.href).searchParams.get('room') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);

// ── Markup ──────────────────────────────────────────────────────
const titleLetters = (word: string, offset = 0) => [...word].map((ch, i) => `<span style="--i:${i + offset}">${ch}</span>`).join('');
const keycap = (k: string) => `<kbd>${k}</kbd>`;

$('app').innerHTML = `
<main id="welcome" class="welcome">
  <div class="scene-bg" aria-hidden="true">
    <div class="cover-art" id="cover-art"></div>
    <div class="cover-shade"></div>
    <canvas id="rain-canvas" class="rain-canvas"></canvas>
    <div class="lamp-glow"></div>
    <div id="flash" class="flash"></div>
    <div class="motes">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${8 + (i % 5) * 3}s;--delay:${-i * 1.7}s"></i>`).join('')}</div>
  </div>

  <div id="gate" class="gate" role="button" tabindex="0" aria-label="Enter Apartment 07">
    <div class="gate-mark"><svg viewBox="0 0 120 120" aria-hidden="true"><rect x="6" y="6" width="108" height="108" rx="2"/></svg><span>07</span></div>
    <p class="gate-title">APARTMENT 07</p>
    <p class="gate-cta"><span class="pulse-dot"></span>Click anywhere to come inside</p>
    <p class="gate-note">♫ &nbsp;Best with headphones</p>
  </div>

  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">07</span><span class="brand-text">AN EVENING AT HOME</span></div>
      <div class="topbar-right"><span class="live-dot"></span><span class="topbar-status" id="server-status">Checking the building…</span></div>
    </header>

    <section class="hero">
      <div class="eyebrow reveal" style="--r:1"><span class="gold-line"></span>A COOPERATIVE ESCAPE MYSTERY</div>
      <h1 class="title" aria-label="Apartment 07"><span class="word">${titleLetters('Apartment')}</span> <em class="word">${titleLetters('07', 10)}</em></h1>
      <p class="subtitle reveal" style="--r:3">LOST AT HOME</p>
      <p class="tagline reveal" style="--r:4">The storm knocked the power out. Every door in the flat is locked tight, and Mum is somewhere on the other side. Find the little things that will bring you back together.</p>
      <div class="chips reveal" style="--r:5"><span>◈ 1–4 explorers</span><span>◷ 30–40 min</span><span>☂ No time limit</span><span>✦ 7 doors to open</span></div>
    </section>

    <nav class="menu" aria-label="Main menu">
      <button class="menu-item" data-panel="create" style="--m:0"><i>01</i><span>New apartment<small>Start a fresh story and invite friends</small></span><b>→</b></button>
      <button class="menu-item" data-panel="join" style="--m:1"><i>02</i><span>Join friends<small>Enter a six-letter room code</small></span><b>→</b></button>
      <button class="menu-item" data-panel="explorer" style="--m:2"><i>03</i><span>Your explorer<small>Change how you look</small></span><b>→</b></button>
      <button class="menu-item" data-panel="music" style="--m:3"><i>04</i><span>Music &amp; sound<small>Pick your soundtrack</small></span><b>→</b></button>
      <button class="menu-item" data-panel="help" style="--m:4"><i>05</i><span>How to play<small>Controls and a few tips</small></span><b>→</b></button>
    </nav>

    <section class="panels" aria-live="polite">
      <article class="panel" data-panel="create">
        <header><span class="eyebrow">CHAPTER ONE · THE RAIN OUTSIDE</span><h2>A fresh apartment</h2><p>You’ll get a room code to share. Solo works too — it’s the same story.</p></header>
        <div class="who"><canvas class="mini-avatar" width="120" height="120" aria-hidden="true"></canvas><div class="field"><label for="name-create">YOUR NAME</label><input id="name-create" class="name-input" maxlength="18" placeholder="What should we call you?" autocomplete="nickname"><button type="button" class="link edit-look" data-panel="explorer">Change your look →</button></div></div>
        <button id="create" class="primary wide shine">Create an apartment <span>→</span></button>
        <p class="panel-note">No sign-up. Your bag and notebook are shared with friends; your view of the flat is your own.</p>
      </article>

      <article class="panel" data-panel="join">
        <header><span class="eyebrow">YOUR FRIENDS ARE WAITING</span><h2>Join an apartment</h2><p>Type the six letters your friend sent you.</p></header>
        <form id="join-form" class="join-form" autocomplete="off">
          <div class="code-boxes" id="code-boxes">${Array.from({ length: 6 }, (_, i) => `<input maxlength="1" aria-label="Room code letter ${i + 1}" data-code="${i}" value="${invite[i] ?? ''}">`).join('')}</div>
          <div class="who compact"><canvas class="mini-avatar" width="120" height="120" aria-hidden="true"></canvas><div class="field"><label for="name-join">YOUR NAME</label><input id="name-join" class="name-input" maxlength="18" placeholder="What should we call you?" autocomplete="nickname"></div></div>
          <button class="primary wide shine" type="submit" id="join-button">Join the apartment <span>→</span></button>
        </form>
      </article>

      <article class="panel" data-panel="explorer">
        <header><span class="eyebrow">EVERY STORY STARTS WITH YOU</span><h2>Your little explorer</h2></header>
        <div class="explorer">
          <div class="avatar-stage"><div class="avatar-halo"></div><canvas id="avatar-preview" width="240" height="230" aria-label="Your character, turning around"></canvas>
            <div class="stage-buttons"><button type="button" id="turn-left" class="round" aria-label="Turn left">↺</button><button type="button" id="randomize" class="pill">⚄ Surprise me</button><button type="button" id="turn-right" class="round" aria-label="Turn right">↻</button></div></div>
          <div class="customizer"><div class="tabs" role="tablist">${['Look', 'Hair', 'Outfit', 'Extras'].map((t, i) => `<button role="tab" class="tab ${i ? '' : 'active'}" data-tab="${i}">${t}</button>`).join('')}</div><div id="customization" class="choices"></div></div>
        </div>
      </article>

      <article class="panel" data-panel="music">
        <header><span class="eyebrow">THE SOUND OF HOME</span><h2>Music &amp; sound</h2><p>Six little tracks, written for the apartment. Your choice follows you into the game.</p></header>
        <div id="track-list" class="track-list"></div>
        <div id="mixer" class="mixer"></div>
      </article>

      <article class="panel" data-panel="help">
        <header><span class="eyebrow">A SMALL GUIDE</span><h2>How to play</h2></header>
        <div class="keys-grid">
          <div>${keycap('W')}${keycap('A')}${keycap('S')}${keycap('D')}<span>Walk around</span></div>
          <div>${keycap('Shift')}<span>Hold to sprint</span></div>
          <div>${keycap('E')}<span>Inspect what’s glowing</span></div>
          <div>${keycap('Tab')}<span>Shared bag</span></div>
          <div>${keycap('J')}<span>Notebook of clues</span></div>
          <div>${keycap('Q')}<span>Ping your location</span></div>
        </div>
        <ol class="tips">
          <li><b>Look for the little lights.</b> Small glowing dots mark things you can inspect. Walk close and press E.</li>
          <li><b>Read everything.</b> Notes, receipts and photos hold the answers. They’re saved to your notebook.</li>
          <li><b>Share the work.</b> Items go into one shared bag, so friends can split up and explore different rooms.</li>
          <li><b>Stuck? Ask for a little help.</b> Hints get clearer each time. There’s no penalty and no timer.</li>
        </ol>
      </article>
      <p id="menu-error" class="error" role="alert"></p>
    </section>

    <footer class="now-playing" id="now-playing">
      <button class="round small" id="np-prev" aria-label="Previous track">‹</button>
      <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <button class="np-title" id="np-title" data-panel="music"><b></b><small></small></button>
      <button class="round small" id="np-next" aria-label="Next track">›</button>
      <button class="round small" id="np-mute" aria-label="Mute"></button>
      <span class="footer-line">PLAY TOGETHER · FIND YOUR WAY HOME</span>
    </footer>
  </div>
</main>

<main id="play" class="play hidden">
  <div id="game-canvas"></div><div class="vignette"></div>
  <header class="game-top">
    <div class="game-logo"><span class="brand-mark">07</span><div>APARTMENT 07<small>Lost at Home</small></div></div>
    <div class="room-share"><span>ROOM <b id="hud-code">------</b></span><button id="copy-invite" class="quiet">Copy invite ↗</button></div>
    <div class="top-right"><span id="timer" class="timer">00:00</span><button id="music-button" class="icon-button" aria-label="Music">♫</button><button id="settings" class="icon-button" aria-label="Settings">⚙</button></div>
  </header>
  <div class="room-title"><span class="eyebrow">CHAPTER ONE · THE RAIN OUTSIDE</span><h2 id="location">Your bedroom</h2><p id="location-sub">Everything is familiar. Almost.</p>
    <div class="goals"><span class="eyebrow">WHAT NOW</span><ul id="goal-list"></ul></div></div>
  <aside class="party"><span class="eyebrow">TOGETHER IN THIS</span><div id="party-list"></div></aside>
  <div id="progress" class="progress"><span class="eyebrow">DOORS OPENED <b id="door-count">0 / 7</b></span><div id="door-progress"></div></div>
  <div id="room-card" class="room-card hidden"><span class="eyebrow" id="room-card-kicker">YOU ENTER</span><h3 id="room-card-title"></h3><p id="room-card-sub"></p></div>
  <button id="interaction" class="interaction hidden"><kbd>E</kbd><span id="interaction-label">Inspect</span><span class="subtle">Inspect</span></button>
  <div id="pickups" class="pickups" aria-live="polite"></div>
  <footer class="game-bottom">
    <span class="move-help">${keycap('W')}${keycap('A')}${keycap('S')}${keycap('D')} Move <span class="bottom-separator"></span>${keycap('Shift')} Sprint <span class="bottom-separator"></span>${keycap('E')} Inspect</span>
    <div class="tools">
      <button id="inventory"><span>▱</span> Shared bag ${keycap('Tab')}<b id="bag-count">0</b></button>
      <button id="notebook"><span>▤</span> Notebook ${keycap('J')}<b id="clue-count">0</b></button>
      <button id="ping"><span>◎</span> Ping ${keycap('Q')}</button>
      <button id="hint"><span>☼</span> A little help</button>
      <button id="chat-toggle" aria-label="Open team chat"><span>☏</span> Chat <b id="chat-badge" class="hidden">0</b></button>
    </div>
  </footer>
  <section id="chat-box" class="chat-box hidden"><div class="chat-heading">A word with your friends<button id="chat-close" aria-label="Close chat">×</button></div><div id="chat-lines"></div><form id="chat-form"><input id="chat-input" maxlength="240" aria-label="Message your team" placeholder="Say something…"><button type="submit" aria-label="Send message">↑</button></form></section>
</main>
<div id="modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div id="modal-body" class="modal-body"></div></div>
<div id="toasts" class="toasts" role="status"></div>
<div id="connection" class="connection hidden" role="status"><span class="spinner"></span>Reconnecting to your apartment…</div>`;

// ── Home: entrance gate ─────────────────────────────────────────
function enter() {
  if (!$('welcome').classList.contains('entered')) {
    sound.start();
    sound.whoosh();
    $('welcome').classList.add('entered');
    showPanel(invite ? 'join' : 'create', false);
  }
}
$('gate').addEventListener('click', enter);
window.addEventListener('keydown', e => { if (!$('welcome').classList.contains('entered') && !$('welcome').classList.contains('hidden') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); enter(); } });

// ── Home: menu panels ───────────────────────────────────────────
let currentPanel = '';
function showPanel(name: string, withSound = true) {
  if (name === currentPanel) return;
  currentPanel = name;
  if (withSound) sound.page();
  $$('.menu-item').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  $('menu-error').textContent = '';
  if (name === 'music') renderMusic();
  const focus = name === 'join' ? $$<HTMLInputElement>('#code-boxes input').find(i => !i.value) ?? $<HTMLInputElement>('name-join') : name === 'create' ? $<HTMLInputElement>('name-create') : null;
  setTimeout(() => focus?.focus({ preventScroll: true }), 350);
}
$$('[data-panel]').forEach(b => { if (b.tagName === 'BUTTON') { b.addEventListener('click', () => showPanel(b.dataset.panel!)); b.addEventListener('mouseenter', () => sound.hover()); } });

// Names stay in sync between the create and join panels.
$$<HTMLInputElement>('.name-input').forEach(input => {
  input.value = playerName;
  input.addEventListener('input', () => { playerName = input.value; $$<HTMLInputElement>('.name-input').forEach(o => { if (o !== input) o.value = input.value; }); });
});

// Room code boxes: type, paste, backspace and arrow keys all behave.
const codeInputs = $$<HTMLInputElement>('#code-boxes input');
codeInputs.forEach((input, i) => {
  input.addEventListener('input', () => {
    const letters = input.value.toUpperCase().replace(/[^A-Z]/g, '');
    input.value = letters.slice(-1);
    if (letters.length > 1) fillCode(letters, i);
    else if (input.value && i < 5) codeInputs[i + 1].focus();
    input.classList.toggle('filled', !!input.value);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && i > 0) { codeInputs[i - 1].focus(); codeInputs[i - 1].value = ''; codeInputs[i - 1].classList.remove('filled'); }
    if (e.key === 'ArrowLeft' && i > 0) codeInputs[i - 1].focus();
    if (e.key === 'ArrowRight' && i < 5) codeInputs[i + 1].focus();
  });
  input.addEventListener('paste', e => { e.preventDefault(); fillCode((e.clipboardData?.getData('text') ?? '').toUpperCase().replace(/[^A-Z]/g, ''), 0); });
  input.classList.toggle('filled', !!input.value);
});
function fillCode(letters: string, from: number) {
  for (let k = 0; k < letters.length && from + k < 6; k++) { codeInputs[from + k].value = letters[k]; codeInputs[from + k].classList.add('filled'); }
  codeInputs[Math.min(5, from + letters.length)].focus();
}
const roomCode = () => codeInputs.map(i => i.value).join('');

// ── Home: explorer customizer ───────────────────────────────────
const choiceGroups: [keyof AvatarConfig, string, string[], number][] = [
  ['skin', 'Skin tone', SKINS, 0], ['hair', 'Hairstyle', ['Sweep', 'Bob', 'Curls', 'Bun', 'Pigtails', 'Spikes'], 1], ['hairColor', 'Hair colour', HAIR, 1],
  ['top', 'Top', ['Tee', 'Hoodie', 'Stripes', 'Dungarees'], 2], ['topColor', 'Top colour', COLORS, 2], ['bottom', 'Bottom', ['Trousers', 'Shorts', 'Skirt'], 2], ['bottomColor', 'Bottom colour', COLORS, 2],
  ['accessory', 'Accessory', ['None', 'Glasses', 'Backpack', 'Headband', 'Scarf'], 3],
];
let activeTab = 0, previewDir = 0;
const DIRS: Direction[] = ['down', 'right', 'up', 'left'];
function customization() {
  $('customization').innerHTML = choiceGroups.filter(g => g[3] === activeTab).map(([key, label, values]) => `<div class="choice-group"><span>${label}</span><div>${values.map((v, i) => {
    const swatch = v.startsWith('#');
    return `<button type="button" data-choice="${key}" data-index="${i}" class="${swatch ? 'swatch' : 'choice'} ${avatar[key] === i ? 'selected' : ''}" ${swatch ? `style="--swatch:${v}"` : ''} aria-label="${label} ${swatch ? i + 1 : v}" aria-pressed="${avatar[key] === i}">${swatch ? '' : v}</button>`;
  }).join('')}</div></div>`).join('');
  $$<HTMLButtonElement>('[data-choice]', $('customization')).forEach(b => b.onclick = () => {
    avatar[b.dataset.choice as keyof AvatarConfig] = Number(b.dataset.index);
    saveLocal('a07-avatar', JSON.stringify(avatar));
    sound.click();
    customization();
    $('avatar-preview').classList.remove('pop'); void $('avatar-preview').offsetWidth; $('avatar-preview').classList.add('pop');
  });
}
$$<HTMLButtonElement>('.tab').forEach(t => t.onclick = () => { activeTab = Number(t.dataset.tab); $$('.tab').forEach(o => o.classList.toggle('active', o === t)); sound.click(); customization(); });
$('turn-left').onclick = () => { previewDir = (previewDir + 3) % 4; sound.click(); };
$('turn-right').onclick = () => { previewDir = (previewDir + 1) % 4; sound.click(); };
$('randomize').onclick = () => {
  const max: Record<keyof AvatarConfig, number> = { skin: 6, hair: 6, hairColor: 8, top: 4, bottom: 3, accessory: 5, topColor: 8, bottomColor: 8 };
  for (const k of Object.keys(max) as (keyof AvatarConfig)[]) avatar[k] = Math.floor(Math.random() * max[k]);
  saveLocal('a07-avatar', JSON.stringify(avatar));
  sound.pickup();
  customization();
};
customization();

// Animated previews: the big one walks and turns, the small ones idle.
function animatePreviews(now: number) {
  if (!$('welcome').classList.contains('hidden')) {
    const big = $<HTMLCanvasElement>('avatar-preview').getContext('2d')!;
    big.clearRect(0, 0, 240, 230);
    const walking = Math.floor(now / 2400) % 2 === 0;
    drawAvatar(big, avatar, DIRS[previewDir], walking ? Math.floor(now / 150) % 4 : 0, 120, 205, 1.45);
    for (const c of $$<HTMLCanvasElement>('.mini-avatar')) {
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 120, 120);
      drawAvatar(ctx, avatar, 'down', 0, 60, 112 + Math.sin(now / 500) * 1.5, 0.82);
    }
  }
  requestAnimationFrame(animatePreviews);
}
requestAnimationFrame(animatePreviews);

// ── Home: music panel + now-playing bar ─────────────────────────
function renderMusic() {
  const s = sound.settings;
  $('track-list').innerHTML = TRACK_LIST.map((t, i) => `<button class="track ${t.id === s.track ? 'playing' : ''}" data-track="${t.id}"><i>${String(i + 1).padStart(2, '0')}</i><span><b>${esc(t.title)}</b><small>${esc(t.mood)} · ${t.bpm} bpm</small></span><span class="eq mini" aria-hidden="true"><i></i><i></i><i></i></span></button>`).join('');
  $$<HTMLButtonElement>('[data-track]').forEach(b => b.onclick = () => { sound.start(); sound.set({ track: b.dataset.track!, muted: false }); });
  $('mixer').innerHTML = mixerHtml();
  bindMixer($('mixer'));
}
function mixerHtml() {
  const s = sound.settings;
  const slider = (key: 'music' | 'sfx' | 'ambience', label: string) => `<label class="slider"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(s[key] * 100)}" data-mix="${key}"><output>${Math.round(s[key] * 100)}</output></label>`;
  return `${slider('music', 'Music')}${slider('ambience', 'Rain &amp; storm')}${slider('sfx', 'Effects')}`;
}
function bindMixer(root: HTMLElement) {
  $$<HTMLInputElement>('[data-mix]', root).forEach(r => r.oninput = () => {
    sound.start();
    sound.set({ [r.dataset.mix!]: Number(r.value) / 100, muted: false });
    (r.nextElementSibling as HTMLOutputElement).value = r.value;
  });
}
function renderNowPlaying() {
  const t = sound.current(), muted = sound.settings.muted;
  $('np-title').querySelector('b')!.textContent = t.title;
  $('np-title').querySelector('small')!.textContent = muted ? 'Sound off' : t.mood;
  $('np-mute').textContent = muted ? '✕' : '♪';
  $('np-mute').setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute');
  document.body.classList.toggle('muted', muted);
  $$('[data-track]').forEach(b => b.classList.toggle('playing', b.dataset.track === sound.settings.track));
  if (overlay === 'music') { const list = $('modal-body').querySelector('.track-list'); if (list) $$('[data-track]', list).forEach(b => b.classList.toggle('playing', b.dataset.track === sound.settings.track)); }
}
sound.onChange(renderNowPlaying);
renderNowPlaying();
$('np-prev').onclick = () => { sound.start(); sound.step(-1); };
$('np-next').onclick = () => { sound.start(); sound.step(1); };
$('np-mute').onclick = () => { sound.start(); sound.set({ muted: !sound.settings.muted }); };

// ── Home: rain on the glass, parallax and lightning ─────────────
(function homeAtmosphere() {
  const canvas = $<HTMLCanvasElement>('rain-canvas'), ctx = canvas.getContext('2d')!;
  type Drop = { x: number; y: number; v: number; len: number };
  type Bead = { x: number; y: number; r: number; slide: number };
  let drops: Drop[] = [], beads: Bead[] = [], w = 0, h = 0;
  // One pre-drawn raindrop bead, stamped many times (much cheaper than a gradient per bead per frame).
  const bead = document.createElement('canvas');
  bead.width = bead.height = 16;
  const bc = bead.getContext('2d')!, bg = bc.createRadialGradient(6, 6, 0, 8, 8, 8);
  bg.addColorStop(0, 'rgba(235,245,248,0.4)'); bg.addColorStop(1, 'rgba(160,190,200,0.04)');
  bc.fillStyle = bg; bc.beginPath(); bc.arc(8, 8, 8, 0, Math.PI * 2); bc.fill();
  const resize = () => {
    w = canvas.width = innerWidth; h = canvas.height = innerHeight;
    drops = Array.from({ length: Math.round(w / 9) }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 600 + Math.random() * 500, len: 10 + Math.random() * 18 }));
    beads = Array.from({ length: Math.round(w / 22) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.4, slide: Math.random() < 0.15 ? 20 + Math.random() * 60 : 0 }));
  };
  resize(); addEventListener('resize', resize);
  let last = performance.now(), nextFlash = performance.now() + 9000;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!$('welcome').classList.contains('hidden')) {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(190,212,220,0.13)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of drops) { d.y += d.v * dt; d.x -= d.v * dt * 0.12; if (d.y > h) { d.y = -20; d.x = Math.random() * w * 1.1; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.len * 0.12, d.y - d.len); }
      ctx.stroke();
      for (const b of beads) {
        if (b.slide) { b.y += b.slide * dt; if (b.y > h) { b.y = -5; b.x = Math.random() * w; } }
        ctx.drawImage(bead, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      if (now > nextFlash && lightningOn) {
        nextFlash = now + 14000 + Math.random() * 16000;
        const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
        setTimeout(() => sound.thunder(0.5 + Math.random() * 0.4), 500 + Math.random() * 1200);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    $('cover-art').style.transform = `scale(1.08) translate(${x * -14}px, ${y * -10}px)`;
  });
})();

// Let players know if the game server is reachable before they try.
async function checkServer() {
  try {
    const r = await fetch(`${api}/api/health`, { cache: 'no-store' });
    if (!r.ok) throw Error();
    $('server-status').textContent = 'The lights are on · server ready';
    document.body.classList.remove('offline');
  } catch {
    $('server-status').textContent = 'Server offline · run the game server to play';
    document.body.classList.add('offline');
  }
}
void checkServer();

// ── Toasts and pickups ──────────────────────────────────────────
function toast(text: string, good = true, icon = good ? '✦' : '!') {
  const el = document.createElement('div');
  el.className = `toast ${good ? '' : 'bad'}`;
  el.innerHTML = `<i>${icon}</i><span>${esc(text)}</span>`;
  $('toasts').append(el);
  while ($('toasts').children.length > 3) $('toasts').firstElementChild!.remove();
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 400); }, 4800);
}
function pickup(icon: string, kicker: string, title: string, target: string) {
  const el = document.createElement('div');
  el.className = 'pickup';
  el.innerHTML = `<span class="pickup-icon">${icon}</span><div><small>${kicker}</small><b>${esc(title)}</b></div>`;
  $('pickups').append(el);
  const button = $(target);
  setTimeout(() => {
    const from = el.getBoundingClientRect(), to = button.getBoundingClientRect();
    el.style.setProperty('--fx', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
    el.style.setProperty('--fy', `${to.top - from.top}px`);
    el.classList.add('fly');
    setTimeout(() => { el.remove(); button.classList.remove('bump'); void button.offsetWidth; button.classList.add('bump'); }, 650);
  }, 1900);
}

// ── Networking ──────────────────────────────────────────────────
function send(type: string, data?: any) { if (room && !reconnecting) room.send(type, data); }

async function join(create: boolean) {
  if (busy) return;
  sound.start();
  const name = playerName.trim() || 'Explorer', code = roomCode();
  if (!create && !/^[A-Z]{6}$/.test(code)) { $('menu-error').textContent = 'Enter all six letters of your friend’s room code.'; $('code-boxes').classList.remove('shake'); void $('code-boxes').offsetWidth; $('code-boxes').classList.add('shake'); sound.bad(); return; }
  busy = true;
  $('menu-error').textContent = '';
  const button = $<HTMLButtonElement>(create ? 'create' : 'join-button');
  button.disabled = true; button.classList.add('loading');
  try {
    const response = await fetch(`${api}/api/rooms${create ? '' : `/${code}/join`}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, avatar }) });
    const reservation = await response.json();
    if (!response.ok) throw Error(reservation.error ?? 'Could not join.');
    room = await client.consumeSeatReservation(reservation);
    saveLocal('a07-name', name);
    attachRoom(room);
    sound.whoosh();
    $('welcome').classList.add('leaving');
    await sleep(600);
    $('welcome').classList.add('hidden');
    $('play').classList.remove('hidden');
  } catch (e) {
    $('menu-error').textContent = e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'Couldn’t reach the apartment. Make sure the game server is running.';
    sound.bad();
  } finally {
    busy = false; button.disabled = false; button.classList.remove('loading');
  }
}
$('create').onclick = () => join(true);
$('join-form').onsubmit = e => { e.preventDefault(); join(false); };

function attachRoom(r: Room) {
  room = r;
  sessionStorage.setItem('a07-reconnect', r.reconnectionToken);
  r.onMessage('snapshot', (s: Snapshot) => { state = s; renderState(); });
  r.onMessage('inspection', (v: Inspection) => { const first = !inspection || inspection.id !== v.id || overlay !== 'inspect'; inspection = v; renderInspection(first); });
  r.onMessage('feedback', (f: { message: string; good: boolean }) => { toast(f.message, f.good); if (f.good) sound.good(); else sound.bad(); });
  r.onMessage('correct', (p: { x: number; y: number }) => scene?.correct(p.x, p.y));
  r.onMessage('hint', (text: string) => {
    showModal('hint', `${modalTitle('A LITTLE HELP', 'A nudge in the right direction.')}<p class="hint-copy">${esc(text)}</p><p class="muted">Hints are optional, and each one is a little clearer than the last.</p><button id="another-hint" class="secondary wide">Make it a little clearer</button>`);
    $('another-hint').onclick = () => send('hint');
  });
  r.onError((_code, message) => toast(message ?? 'Connection error.', false));
  r.onLeave(code => { if (code === 1000 || code === 4000) { sessionStorage.removeItem('a07-reconnect'); return; } recover(); });
}

async function recover() {
  if (reconnecting) return;
  reconnecting = true;
  $('connection').classList.remove('hidden');
  const token = sessionStorage.getItem('a07-reconnect');
  let ok = false;
  const end = Date.now() + 115000;
  while (token && Date.now() < end && !ok) {
    try { attachRoom(await client.reconnect(token)); ok = true; } catch { await sleep(1500); }
  }
  reconnecting = false;
  $('connection').classList.add('hidden');
  if (!ok) {
    sessionStorage.removeItem('a07-reconnect');
    showModal('error', `${modalTitle('CONNECTION LOST', 'Your apartment is unavailable.')}<p>The room may have expired, or the server restarted. Create a new apartment to begin again.</p><button id="return-home" class="primary wide">Back to the beginning <span>→</span></button>`, false);
    $('return-home').onclick = () => location.assign(location.pathname);
  }
}

// ── Game ────────────────────────────────────────────────────────
function createGame() {
  if (game) return;
  scene = new ApartmentScene({
    getState: () => state,
    getId: () => room?.sessionId ?? '',
    blocked: () => !!overlay || reconnecting || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? ''),
    send,
    near: id => {
      near = id;
      $('interaction').classList.toggle('hidden', !id);
      $('interaction-label').textContent = APARTMENT.interactables.find(o => o.id === id)?.name ?? '';
      if (id) { $('interaction').classList.remove('appear'); void $('interaction').offsetWidth; $('interaction').classList.add('appear'); }
    },
    location: (name, subtitle) => {
      $('location').textContent = name;
      $('location-sub').textContent = subtitle;
      const t = $('location').parentElement!;
      t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap');
      const id = APARTMENT.rooms.find(r => r.name === name)?.id ?? 'outside';
      if (!seenRooms.has(id)) {
        const firstRoom = seenRooms.size === 0;
        seenRooms.add(id);
        if (!firstRoom) roomCard(name, subtitle, id === 'outside' ? 'AT LAST' : 'YOU ENTER');
      }
    },
    footstep: running => sound.footstep(running),
    thunder: strength => sound.thunder(strength),
    doorOpened: () => sound.unlock(),
  });
  scene.labels = namesOn;
  scene.lightning = lightningOn;
  game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-canvas', backgroundColor: '#0b1215', scene: [scene], scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight }, render: { antialias: true, pixelArt: false }, audio: { noAudio: true }, input: { keyboard: true }, banner: false });
}

let roomCardTimer: ReturnType<typeof setTimeout>;
function roomCard(title: string, sub: string, kicker: string) {
  $('room-card-kicker').textContent = kicker;
  $('room-card-title').textContent = title;
  $('room-card-sub').textContent = sub;
  const card = $('room-card');
  card.classList.remove('hidden', 'out'); void card.offsetWidth; card.classList.add('in');
  clearTimeout(roomCardTimer);
  roomCardTimer = setTimeout(() => { card.classList.add('out'); setTimeout(() => card.classList.add('hidden'), 700); }, 2600);
}

function renderState() {
  const s = state;
  if (!s || !room) return;
  $('hud-code').textContent = s.roomCode;
  if (s.phase === 'lobby') { const sig = JSON.stringify([s.hostId, s.players]); if (sig !== lobbySignature) { lobbySignature = sig; showLobby(); } }
  if (s.phase === 'playing' && lastPhase !== 'playing') { createGame(); if (!startedLocally) { startedLocally = true; if (lastPhase === 'lobby') showIntro(); else closeModal(); } }
  if (s.phase === 'won' && lastPhase !== 'won') { sound.win(); if (lastPhase === 'playing') sound.set({ track: 'home' }); showWin(); }
  lastPhase = s.phase;

  // New items / clues pop up and fly into their buttons.
  const items = new Set(s.inventory.map(i => i.id)), clues = new Set(s.clues.map(c => c.id));
  if (knownItems && s.phase === 'playing') for (const i of s.inventory) if (!knownItems.has(i.id)) { pickup(i.icon, 'ADDED TO THE SHARED BAG', i.name, 'inventory'); sound.pickup(); }
  if (knownClues && s.phase === 'playing') for (const c of s.clues) if (!knownClues.has(c.id)) { pickup('▤', 'NEW IN THE NOTEBOOK', c.title, 'notebook'); sound.page(); }
  knownItems = items; knownClues = clues;

  const sig = JSON.stringify([s.players.map(p => [p.id, p.name, p.connected, p.avatar.topColor]), s.doors, s.inventory.length, s.clues.length]);
  if (sig !== hudSignature) {
    hudSignature = sig;
    $('party-list').innerHTML = s.players.map(p => `<div class="party-person ${p.connected ? '' : 'offline'}"><span class="person-dot" style="--person:${COLORS[p.avatar.topColor]}">${esc(p.name[0].toUpperCase())}</span><div>${esc(p.name)}${p.id === room!.sessionId ? ' <small class="you">you</small>' : ''}<small>${p.connected ? 'Exploring' : 'Reconnecting…'}</small></div></div>`).join('');
    $('bag-count').textContent = String(s.inventory.length);
    $('clue-count').textContent = String(s.clues.length);
    $('door-count').textContent = `${s.doors.length} / ${APARTMENT.doors.length}`;
    $('door-progress').innerHTML = APARTMENT.doors.map(d => `<i class="${s.doors.includes(d.id) ? 'done' : ''}" title="${esc(d.label)}"></i>`).join('');
    if (overlay === 'inventory') inventory();
    if (overlay === 'notebook') notebook();
  }

  const goals = JSON.stringify(s.objectives ?? []);
  if (goals !== goalSignature) {
    const before: string[] = goalSignature ? JSON.parse(goalSignature) : [];
    goalSignature = goals;
    const now: string[] = s.objectives ?? [];
    for (const g of before) if (!now.includes(g) && s.phase === 'playing') toast(`Done: ${g.replace(/\.$/, '')}`, true, '✓');
    $('goal-list').innerHTML = now.map(g => `<li class="${before.includes(g) ? '' : 'fresh'}">${esc(g)}</li>`).join('');
  }

  const cs = JSON.stringify(s.chat);
  if (cs !== chatSignature) {
    chatSignature = cs;
    $('chat-lines').innerHTML = s.chat.map(c => `<div class="chat-line ${c.system ? 'system' : ''}"><strong>${esc(c.name)}</strong><span>${esc(c.text)}</span></div>`).join('');
    $('chat-lines').scrollTop = $('chat-lines').scrollHeight;
    const fromOthers = s.chat.filter(c => !c.system).length;
    if ($('chat-box').classList.contains('hidden') && fromOthers > lastChatCount && lastChatCount > 0) { unreadChat += fromOthers - lastChatCount; $('chat-badge').textContent = String(unreadChat); $('chat-badge').classList.remove('hidden'); sound.ping(); }
    lastChatCount = fromOthers;
  }

  for (const p of s.pings.filter(p => p.until > Date.now() && p.id !== room!.sessionId)) {
    const key = `${p.id}-${p.until}`;
    if (!seenPings.has(key)) {
      seenPings.add(key);
      sound.ping();
      toast(`${p.name} is calling you from ${APARTMENT.rooms.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)?.name.toLowerCase() ?? 'the entrance'}.`, true, '◎');
    }
  }
}
const seenPings = new Set<string>();

// ── Modals ──────────────────────────────────────────────────────
function closeModal() {
  if (!overlay) return;
  if (overlay === 'inspect') send('close');
  overlay = null; inspection = undefined;
  $('modal').classList.add('closing');
  setTimeout(() => { if (!overlay) $('modal').classList.add('hidden'); $('modal').classList.remove('closing'); }, 220);
  if (scene?.ready) scene.input.keyboard?.resetKeys();
  $('play').inert = false; $('welcome').inert = false;
}
function showModal(type: string, html: string, closable = true, animate = true) {
  const fresh = overlay !== type || animate;
  overlay = type;
  $('modal').classList.remove('closing');
  $('modal-body').className = `modal-body ${type}-modal ${fresh ? 'enter' : ''}`;
  $('modal-body').innerHTML = `${closable ? '<button class="close-modal" aria-label="Close panel">×</button>' : ''}${html}`;
  $('modal').classList.remove('hidden');
  if (scene?.ready) scene.input.keyboard?.resetKeys();
  $('play').inert = true; $('welcome').inert = true;
  $('modal-body').querySelector('.close-modal')?.addEventListener('click', closeModal);
  if (fresh) $('modal-body').querySelector<HTMLElement>('input,button:not(.close-modal),[tabindex]')?.focus({ preventScroll: true });
}
$('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && overlay && !['lobby', 'intro', 'ending', 'error'].includes(overlay)) closeModal(); });
const modalTitle = (kicker: string, title: string) => `<span class="eyebrow">${kicker}</span><h2 id="modal-title">${title}</h2>`;

function showLobby() {
  const s = state!;
  const host = room?.sessionId === s.hostId;
  showModal('lobby', `${modalTitle('YOUR CHAPTER IS WAITING', 'A place for your people.')}
    <p>Share the code with up to three friends — or begin on your own.</p>
    <button class="lobby-code" id="lobby-code" title="Copy invitation link">${[...s.roomCode].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}<small>Click to copy the invite link</small></button>
    <div class="lobby-people">${s.players.map(p => `<div class="seat filled"><span class="person-dot" style="--person:${COLORS[p.avatar.topColor]}">${esc(p.name[0])}</span><b>${esc(p.name)}</b><small>${p.id === s.hostId ? 'Host' : p.connected ? 'Ready' : 'Reconnecting'}</small></div>`).join('')}${Array.from({ length: 4 - s.players.length }, () => '<div class="seat empty"><span>+</span><small>A friend could be here</small></div>').join('')}</div>
    <div class="note">Your bag and notebook are shared. Your view of the apartment is your own.</div>
    ${host ? '<button id="begin" class="primary wide shine">Begin the story <span>→</span></button>' : '<p class="waiting"><span class="spinner"></span>Waiting for the host to begin…</p>'}
    <button id="leave-lobby" class="quiet">Leave apartment</button>`, false, false);
  $('lobby-code').onclick = copyInvite;
  if ($('begin')) $('begin').onclick = () => { sound.whoosh(); send('start'); };
  $('leave-lobby').onclick = leave;
}

function showIntro() {
  showModal('intro', `${modalTitle('APARTMENT 07 · CHAPTER ONE', 'The rain outside.')}
    <div class="story-line"><span style="--l:0">“This is my room.</span><span style="--l:1">Those are my toys.</span><span style="--l:2">So why does home feel so unfamiliar?”</span></div>
    <p class="fade-in" style="--l:3">The clock has stopped. The hallway is silent. The door won’t open.${state!.players.filter(p => p.connected).length > 1 ? ' We’ll have to find a way out together.' : ''}</p>
    <p class="fade-in" style="--l:4">Somewhere beyond it, Mum is calling my name.</p>
    <div class="note fade-in" style="--l:5">Start with the drawing on the little desk.<br>${keycap('WASD')} move · ${keycap('Shift')} sprint · ${keycap('E')} inspect · ${keycap('J')} notebook</div>
    <button id="wake" class="primary wide shine fade-in" style="--l:6">Open your eyes <span>→</span></button>`, false);
  $('wake').onclick = () => { closeModal(); sound.whoosh(); roomCard('Your bedroom', 'Everything is familiar. Almost.', 'CHAPTER ONE'); };
}

function showWin() {
  const s = state!;
  showModal('ending', `<div class="ending-lights">${Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 53) % 100}%;--d:${5 + (i % 4) * 2}s;--delay:${-i * 0.6}s"></i>`).join('')}</div>
    ${modalTitle('CHAPTER COMPLETE', 'You were home all along.')}<div class="ending-symbol">⌂</div>
    <p>The last latch clicks. Cool corridor air slips through the doorway, and Mum kneels down to gather you close.</p>
    <p class="story-line">“There you are.<br>I knew you’d find your way.”</p>
    <div class="ending-stats"><span><b>${formatTime(Date.now() - s.startedAt)}</b>time together</span><span><b>${s.clues.length}</b>discoveries</span><span><b>${Object.values(s.hintCounts).reduce((a, b) => a + b, 0)}</b>little nudges</span></div>
    <button id="again" class="primary wide shine">Back to the beginning <span>→</span></button>`, false);
  $('again').onclick = leave;
}

function inventory() {
  if (!state) return;
  const fresh = overlay !== 'inventory';
  if (fresh) sound.page();
  showModal('inventory', `${modalTitle('EVERYTHING WE FOUND', 'Our shared bag.')}<p class="muted">Everyone can use these. Walk up to a mechanism to use an item.</p>
    <div class="item-grid">${state.inventory.map((i, n) => `<article class="item-card" style="--n:${n}"><span>${i.icon}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p></article>`).join('') || '<div class="empty-state">Nothing in here yet.<br>Have a look around your bedroom.</div>'}</div>`, true, fresh);
}

function notebook() {
  if (!state) return;
  const fresh = overlay !== 'notebook';
  if (fresh) sound.page();
  showModal('notebook', `${modalTitle('THE LITTLE THINGS ADD UP', 'Our notebook.')}<p class="muted">Every clue anyone discovers is written down here.</p>
    <div class="clue-list">${state.clues.map((c, i) => `<details ${i === state!.clues.length - 1 ? 'open' : ''} style="--n:${i}"><summary><span>${String(i + 1).padStart(2, '0')}</span>${esc(c.title)}<em>${esc(APARTMENT.rooms.find(r => r.id === c.room)?.name ?? '')}</em><i>+</i></summary><p>${esc(c.text).replace(/\n/g, '<br>')}</p></details>`).join('') || '<div class="empty-state">Your story starts with a drawing on the little desk.</div>'}</div>`, true, fresh);
}

function showMusic() {
  const fresh = overlay !== 'music';
  showModal('music', `${modalTitle('THE SOUND OF HOME', 'Music &amp; sound.')}<div class="track-list"></div><div class="mixer"></div>`, true, fresh);
  const list = $('modal-body').querySelector<HTMLElement>('.track-list')!;
  list.innerHTML = TRACK_LIST.map((t, i) => `<button class="track ${t.id === sound.settings.track ? 'playing' : ''}" data-track="${t.id}"><i>${String(i + 1).padStart(2, '0')}</i><span><b>${esc(t.title)}</b><small>${esc(t.mood)}</small></span><span class="eq mini" aria-hidden="true"><i></i><i></i><i></i></span></button>`).join('');
  $$<HTMLButtonElement>('[data-track]', list).forEach(b => b.onclick = () => sound.set({ track: b.dataset.track!, muted: false }));
  const mixer = $('modal-body').querySelector<HTMLElement>('.mixer')!;
  mixer.innerHTML = mixerHtml();
  bindMixer(mixer);
}

function doAction(action: string, value?: unknown) { if (!inspection) return; sound.click(); send('action', { target: inspection.id, action, value }); }

function renderInspection(first: boolean) {
  const v = inspection;
  if (!v) return;
  sequence = [];
  let controls = '';
  if (v.controls) {
    const ct = v.controls;
    if (ct.type === 'code') controls = `<form id="code-form" class="code-form"><label for="combination">FOUR-DIGIT COMBINATION</label><div class="dial-row">${[0, 1, 2, 3].map(i => `<div class="dial"><button type="button" data-dial="${i}" data-step="1" aria-label="Digit ${i + 1} up">▲</button><output id="dial-${i}">0</output><button type="button" data-dial="${i}" data-step="-1" aria-label="Digit ${i + 1} down">▼</button></div>`).join('')}</div><input id="combination" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="or type four digits" aria-label="Four-digit combination"><button class="primary wide" type="submit">Try the combination <span>→</span></button></form>`;
    else if (ct.type === 'sequence') controls = `<div class="sequence-status" id="sequence-status">${['○', '○', '○'].map(c => `<i>${c}</i>`).join('')}</div><div class="mechanism-choices">${ct.options!.map(o => `<button data-sequence="${o}" class="zone-button"><i></i>${o}</button>`).join('')}</div><div class="mechanism-footer"><button id="sequence-reset" class="quiet">Clear</button><button id="sequence-confirm" class="primary" disabled>Confirm route</button></div>`;
    else if (ct.type === 'overlay') controls = `<div class="overlay-puzzle"><div id="plan-target" class="plan-target" tabindex="0" aria-label="Floor plan drop zone"><span>DROP THE SHEET HERE</span><div class="plan-lines"></div></div><div id="tracing-sheet" class="tracing-sheet" draggable="true" tabindex="0" aria-label="Transparent sheet. Drag it onto the plan, or use the button.">⌜ &nbsp; ◯ → ◯ &nbsp; ⌝<small>TRANSPARENT SHEET</small>⌞ &nbsp; &nbsp; ◯ &nbsp; &nbsp; ⌟</div></div><button id="align-sheet" class="secondary wide">Line the sheet up with the plan</button>`;
    else controls = `<div class="mechanism-choices">${ct.options!.map((o, i) => `<button class="object-choice" data-value="${o}" data-action="${ct.type === 'hook' ? 'hook' : ct.type === 'tin' ? 'tin' : ct.type === 'suitcase' ? 'suitcase' : 'manual'}"><span>${ct.type === 'hook' ? ['☾', '☆', '♧', '○'][i] : ct.type === 'tin' ? '▥' : ct.type === 'suitcase' ? '▣' : i ? '↻' : '◉'}</span>${o}${ct.type === 'suitcase' ? `<small>TAG: ${o.toUpperCase()}</small>` : ''}</button>`).join('')}</div>`;
  }
  const needsItem = v.actions.find(a => a.item);
  const itemSelect = needsItem ? `<div class="item-picker"><span class="item-select-label">USE SOMETHING FROM THE SHARED BAG</span><div class="item-options">${state!.inventory.map(i => `<button type="button" class="item-option" data-use="${i.id}"><span>${i.icon}</span>${esc(i.name)}</button>`).join('') || '<em>The bag is empty.</em>'}</div></div>` : '';
  showModal('inspect', `${modalTitle(esc(v.subtitle), esc(v.title))}
    <div class="inspection-illustration ${v.kind} ${v.solved ? 'solved' : ''}"><span>${APARTMENT.interactables.find(o => o.id === v.id)?.icon ?? '⌂'}</span><i>${v.solved ? '✓' : '07'}</i></div>
    <p class="inspection-text">${esc(v.text).replace(/\n/g, '<br>')}</p>
    ${v.lockedBy ? `<div class="note">${esc(v.lockedBy)} is using this right now. You can read it while they finish.</div>` : `${controls}${itemSelect}<div class="inspection-actions">${v.actions.map(a => `<button class="primary wide" data-action-button="${a.id}" ${a.item ? `data-item="${a.item}"` : ''}>${esc(a.label)} <span>→</span></button>`).join('')}</div>`}
    ${v.solved ? '<div class="solved-note">✓ &nbsp; Nothing more to do here.</div>' : ''}`, true, first);

  let chosenItem = '';
  $$<HTMLButtonElement>('[data-use]').forEach(b => b.onclick = () => { chosenItem = b.dataset.use!; $$('[data-use]').forEach(o => o.classList.toggle('selected', o === b)); sound.click(); });
  const dials = [0, 0, 0, 0];
  $$<HTMLButtonElement>('[data-dial]').forEach(b => b.onclick = () => { const i = Number(b.dataset.dial); dials[i] = (dials[i] + Number(b.dataset.step) + 10) % 10; $(`dial-${i}`).textContent = String(dials[i]); $<HTMLInputElement>('combination').value = dials.join(''); sound.click(); });
  $('code-form')?.addEventListener('submit', e => { e.preventDefault(); const value = $<HTMLInputElement>('combination').value || dials.join(''); if (/^\d{4}$/.test(value)) doAction('code', value); else { toast('Enter four digits.', false); sound.bad(); } });
  $<HTMLInputElement>('combination')?.addEventListener('input', e => { const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4); (e.target as HTMLInputElement).value = val; [...val].forEach((d, i) => { dials[i] = Number(d); $(`dial-${i}`).textContent = d; }); });
  $$<HTMLButtonElement>('[data-action-button]').forEach(b => b.onclick = () => {
    if (b.dataset.item && chosenItem !== b.dataset.item) { toast(chosenItem ? 'That doesn’t fit here. Try something else from the bag.' : 'Pick the item to use from the shared bag first.', false); sound.bad(); $('modal-body').querySelector('.item-picker')?.classList.remove('shake'); void ($('modal-body').querySelector('.item-picker') as HTMLElement | null)?.offsetWidth; $('modal-body').querySelector('.item-picker')?.classList.add('shake'); return; }
    doAction(b.dataset.actionButton!);
  });
  $$<HTMLButtonElement>('[data-value]').forEach(b => b.onclick = () => doAction(b.dataset.action!, b.dataset.value));
  $$<HTMLButtonElement>('[data-sequence]').forEach(b => b.onclick = () => {
    if (sequence.length === 3) return;
    sequence.push(b.dataset.sequence!);
    b.classList.add('pressed'); sound.click();
    $('sequence-status').innerHTML = [0, 1, 2].map(i => `<i class="${sequence[i] ? 'on' : ''}">${sequence[i] ?? '○'}</i>`).join('');
    $<HTMLButtonElement>('sequence-confirm').disabled = sequence.length !== 3;
  });
  if ($('sequence-reset')) $('sequence-reset').onclick = () => { sequence = []; $('sequence-status').innerHTML = '<i>○</i><i>○</i><i>○</i>'; $$('.pressed').forEach(b => b.classList.remove('pressed')); $<HTMLButtonElement>('sequence-confirm').disabled = true; };
  if ($('sequence-confirm')) $('sequence-confirm').onclick = () => doAction('sequence', sequence);
  if ($('align-sheet')) {
    const align = () => { if (!state!.inventory.some(i => i.id === 'sheet')) { toast('Take the transparent sheet from the study shelf first.', false); sound.bad(); return; } $('plan-target').classList.add('aligned'); doAction('overlay', true); };
    $('align-sheet').onclick = align;
    $('tracing-sheet').ondragstart = e => e.dataTransfer?.setData('text/plain', 'service-sheet');
    $('plan-target').ondragover = e => { e.preventDefault(); $('plan-target').classList.add('hover'); };
    $('plan-target').ondragleave = () => $('plan-target').classList.remove('hover');
    $('plan-target').ondrop = e => { e.preventDefault(); if (e.dataTransfer?.getData('text/plain') === 'service-sheet') align(); };
  }
}

function inspectNear() { if (near && !overlay) { sound.click(); send('inspect', near); } }
$('interaction').onclick = inspectNear;
$('inventory').onclick = inventory;
$('notebook').onclick = notebook;
$('ping').onclick = () => { send('ping'); sound.ping(); toast('Your friends can see where you are.', true, '◎'); };
$('hint').onclick = () => send('hint');
$('music-button').onclick = showMusic;

async function copyInvite() {
  const url = new URL(location.href);
  url.searchParams.set('room', state?.roomCode ?? '');
  try { await navigator.clipboard.writeText(url.toString()); toast('Invitation link copied. Send it to a friend!'); }
  catch { toast(`Room code: ${state?.roomCode}. Share it with your friends.`); }
  sound.click();
}
$('copy-invite').onclick = copyInvite;
async function leave() { sessionStorage.removeItem('a07-reconnect'); await room?.leave(); location.assign(location.pathname); }

function showSettings() {
  const fresh = overlay !== 'settings';
  showModal('settings', `${modalTitle('MAKE YOURSELF COMFORTABLE', 'Settings.')}
    <div class="mixer">${mixerHtml()}</div>
    <div class="toggles">
      <button id="settings-names" class="toggle ${namesOn ? 'on' : ''}"><span>Teammate names</span><i></i></button>
      <button id="settings-lightning" class="toggle ${lightningOn ? 'on' : ''}"><span>Lightning flashes</span><i></i></button>
      <button id="settings-mute" class="toggle ${!sound.settings.muted ? 'on' : ''}"><span>All sound</span><i></i></button>
    </div>
    <p class="muted keys-line">${keycap('WASD')} move · ${keycap('Shift')} sprint · ${keycap('E')} inspect · ${keycap('Tab')} bag · ${keycap('J')} notebook · ${keycap('Q')} ping · ${keycap('Esc')} close</p>
    <button id="leave-game" class="quiet">Leave this apartment</button>`, true, fresh);
  bindMixer($('modal-body'));
  $('settings-names').onclick = () => { namesOn = !namesOn; if (scene) scene.labels = namesOn; sound.click(); showSettings(); };
  $('settings-lightning').onclick = () => { lightningOn = !lightningOn; saveLocal('a07-lightning', String(lightningOn)); if (scene) scene.lightning = lightningOn; sound.click(); showSettings(); };
  $('settings-mute').onclick = () => { sound.set({ muted: !sound.settings.muted }); showSettings(); };
  $('leave-game').onclick = leave;
}
$('settings').onclick = showSettings;

$('chat-toggle').onclick = () => {
  $('chat-box').classList.toggle('hidden');
  if (!$('chat-box').classList.contains('hidden')) { $('chat-input').focus(); unreadChat = 0; $('chat-badge').classList.add('hidden'); }
};
$('chat-close').onclick = () => $('chat-box').classList.add('hidden');
$('chat-form').onsubmit = e => { e.preventDefault(); const input = $<HTMLInputElement>('chat-input'); if (input.value.trim()) { send('chat', input.value); sound.click(); } input.value = ''; };

document.addEventListener('keydown', e => {
  if (overlay && e.key === 'Tab') {
    const els = $$<HTMLElement>('button:not(:disabled),input,select,summary,[tabindex="0"]', $('modal-body'));
    const first = els[0], last = els[els.length - 1];
    if (overlay === 'inventory' && !e.shiftKey) { e.preventDefault(); closeModal(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    return;
  }
  if (e.key === 'Escape') {
    if (overlay && !['lobby', 'intro', 'ending', 'error'].includes(overlay)) closeModal();
    else { $('chat-box').classList.add('hidden'); $<HTMLInputElement>('chat-input').blur(); }
    return;
  }
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) return;
  if (!state || state.phase !== 'playing' || e.repeat) return;
  const k = e.key.toLowerCase();
  if (e.key === 'Tab') { e.preventDefault(); if (overlay === 'inventory') closeModal(); else if (!overlay) inventory(); }
  if (k === 'j') { if (overlay === 'notebook') closeModal(); else if (!overlay) notebook(); }
  if (k === 'e') { if (overlay === 'inspect') closeModal(); else inspectNear(); }
  if (k === 'q' && !overlay) { send('ping'); sound.ping(); toast('Your friends can see where you are.', true, '◎'); }
  if (k === 'enter' && !overlay) { $('chat-box').classList.remove('hidden'); $('chat-input').focus(); unreadChat = 0; $('chat-badge').classList.add('hidden'); e.preventDefault(); }
});

setInterval(() => { if (state?.phase === 'playing') $('timer').textContent = formatTime(Date.now() - state.startedAt); }, 1000);
window.addEventListener('blur', () => { send('move', { x: 0, y: 0, seq: 0 }); scene?.input.keyboard?.resetKeys(); });

// A refresh can rejoin the same room during the server's two-minute grace period.
if (sessionStorage.getItem('a07-reconnect')) {
  const token = sessionStorage.getItem('a07-reconnect')!;
  client.reconnect(token).then(r => {
    attachRoom(r);
    $('welcome').classList.add('hidden', 'entered');
    $('play').classList.remove('hidden');
  }).catch(() => sessionStorage.removeItem('a07-reconnect'));
}
// Start any audio the moment the player interacts anywhere (browsers block sound before that).
window.addEventListener('pointerdown', () => { if ($('welcome').classList.contains('entered')) sound.start(); }, { once: false, passive: true });
// Dev-only handle for automated checks in the browser console.
if (import.meta.env.DEV) (window as any).a07 = { get scene() { return scene; }, get state() { return state; }, get room() { return room; }, sound };
