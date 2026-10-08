// Web Games hub: a 3D retro TV (three.js) whose screen grows into the first game,
// then the other games slide over each other (GSAP ScrollTrigger + SplitText, Lenis).
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

const CHANNELS = [
  { name: 'Pixel Peek', url: 'https://gamepixelpeek.vercel.app', src: 'media/pp', glow: '#ffc35a' },
  { name: "Liar's Call", url: 'https://liarscall.vercel.app', src: 'media/lc', glow: '#ff6a45' },
  { name: 'Apartment 07', url: 'https://apartment07.up.railway.app', src: 'media/a7', glow: '#f0cf8e' },
];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EXT = document.createElement('video').canPlayType('video/webm; codecs="vp9"') ? '.webm' : '.mp4';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Hero timeline, as fractions of the hero's pinned scroll:
const ZOOM_END = .667;   // TV framed and its screen grown to full screen by here; the next game then slides over it
const FRAME = [0, .45];  // camera moves from the 3/4 view to a front-on view of the set
const GROW = [.5, .88];  // the screen grows from the TV to the whole viewport
const SHOW = .86;        // Pixel Peek's title and button come in

/* ───────────── smooth scroll ───────────── */
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, SplitText = window.SplitText;
gsap.registerPlugin(ScrollTrigger, SplitText);
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.2, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  window.__lenis = lenis;
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const hero = $('#hero');
const heroY = (f) => hero.offsetTop + f * (hero.offsetHeight - innerHeight);
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.8 }) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id === '#pixel-peek') { e.preventDefault(); scrollToY(heroY(ZOOM_END)); return; }
  const el = $(id); if (!el) return;
  e.preventDefault(); lenis ? lenis.scrollTo(el, { duration: 1.8 }) : el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}));

/* ───────────── channels: the cards, the Play button and the TV share one state ───────────── */
let current = 0, userPicked = false;
const cards = $$('.ch'), watch = $('#watch'), watchName = $('#watchName');
const listeners = [];
function setChannel(i, byUser) {
  if (byUser) userPicked = true;
  if (i === current) return;
  current = i;
  cards.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
  watch.href = CHANNELS[i].url; watchName.textContent = CHANNELS[i].name;
  listeners.forEach((f) => f(i));
}
let hoverTimer;
cards.forEach((card, k) => {
  const v = $('video', card);
  const preview = () => {
    if (reduce) return;
    if (!v.src) { v.src = v.dataset.src + EXT; v.addEventListener('playing', () => v.classList.add('ok'), { once: true }); }
    v.play().catch(() => {});
  };
  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    preview(); clearTimeout(hoverTimer); hoverTimer = setTimeout(() => setChannel(k, true), 140);
  });
  card.addEventListener('pointerleave', () => { clearTimeout(hoverTimer); v.pause(); });
  card.addEventListener('focus', () => { preview(); setChannel(k, true); });
  card.addEventListener('blur', () => v.pause());
  card.addEventListener('click', () => setChannel(k, true));
});
addEventListener('keydown', (e) => {
  if (heroProgress > .1) return;
  if (e.key === 'ArrowRight') setChannel((current + 1) % 3, true);
  if (e.key === 'ArrowLeft') setChannel((current + 2) % 3, true);
});
function autoCycle() {
  if (reduce) return;
  setInterval(() => { if (!userPicked && heroProgress < .03 && !document.hidden) setChannel((current + 1) % 3, false); }, 7000);
}

/* ───────────── titles split into letters for the reveals ───────────── */
const splits = new Map();
function splitTitles() {
  $$('.title').forEach((t) => { if (!splits.has(t)) splits.set(t, SplitText.create(t, { type: 'chars', mask: 'chars' })); });
}

/* ───────────── hero choreography (TV → portal) ───────────── */
let heroProgress = 0, heroSmooth = 0;
ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { heroProgress = s.progress; } });
const copy = $('.copy'), cue = $('.cue'), portal = $('#pixel-peek'), portalVideo = $('.bg', portal), crt = $('.crt', portal);
const portalDim = document.createElement('div'); portalDim.className = 'dim'; portal.appendChild(portalDim);
let screenRect = () => null;       // set by the TV (or the fallback): where the screen is, in page pixels
let syncPortal = () => {};         // set by the TV: start the portal's video where the set's video is
let portalIn = null;               // timeline for Pixel Peek's title and button
let portalShown = false;

function choreo() {
  // time-based smoothing: the same feel at 30, 60 or 120 frames a second
  heroSmooth += (heroProgress - heroSmooth) * (reduce ? 1 : 1 - Math.pow(.86, gsap.ticker.deltaRatio(60)));
  if (Math.abs(heroProgress - heroSmooth) < .0005) heroSmooth = heroProgress;
  const z = clamp(heroSmooth / ZOOM_END);          // 0 → 1 while the TV is framed and the screen grows
  const s = clamp((heroSmooth - ZOOM_END) / (1 - ZOOM_END)); // 0 → 1 while Liar's Call slides over

  copy.style.opacity = String(clamp(1 - z * 5)); copy.style.transform = `translateY(${-z * 160}px)`;
  copy.style.pointerEvents = z > .1 ? 'none' : '';
  cue.style.opacity = String(clamp(1 - z * 10));
  if (z > .15 && current !== 0) setChannel(0, false);

  const g = ease(clamp((z - GROW[0]) / (GROW[1] - GROW[0])));
  const on = z > GROW[0] - .02;
  if (on !== portalShown) {
    portalShown = on; portal.classList.toggle('on', on);
    if (on) { syncPortal(); portalVideo.play().catch(() => {}); } else portalVideo.pause();
  }
  if (on) {
    const r = screenRect();
    const W = innerWidth, H = innerHeight;
    const from = r || { top: H * .3, left: W * .3, right: W * .7, bottom: H * .7 };
    const t = lerp(from.top, 0, g), l = lerp(from.left, 0, g), rr = lerp(W - from.right, 0, g), b = lerp(H - from.bottom, 0, g);
    const radius = lerp(22, 0, g) + 28 * s;
    portal.style.clipPath = `inset(${t}px ${rr}px ${b}px ${l}px round ${radius}px)`;
    portal.style.transform = `scale(${1 - .08 * s})`;
    portalDim.style.opacity = String(.7 * s);
    crt.style.opacity = String(1 - g);
    portal.classList.toggle('live', z > .95 && s < .5);
  }
  if (portalIn) { if (z >= SHOW && portalIn.reversed() !== false) portalIn.play(); else if (z < SHOW - .04 && !portalIn.reversed()) portalIn.reverse(); }
}
gsap.ticker.add(choreo);

/* ───────────── the reel: Liar's Call and Apartment 07 ───────────── */
const panels = $$('.reel .panel');
function buildReel() {
  splitTitles();
  // Pixel Peek's text, played when the screen has grown to full size
  const pp = splits.get($('.title', portal));
  portalIn = gsap.timeline({ paused: true })
    .fromTo(pp.chars, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: .035, ease: 'expo.out' })
    .fromTo($$('.chan, .line, .meta li, .play', portal), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .9, stagger: .05, ease: 'expo.out' }, '-=.85');
  portalIn.reverse(0);

  panels.forEach((panel, i) => {
    const vid = $('video', panel), last = i === panels.length - 1;
    const dim = document.createElement('div'); dim.className = 'dim'; panel.appendChild(dim);
    ScrollTrigger.create({ trigger: panel, start: 'top bottom', end: 'bottom top', onToggle: (st) => (st.isActive && !reduce ? vid.play().catch(() => {}) : vid.pause()) });
    if (reduce) return;
    // rises as a card and opens to full bleed; its video settles and drifts (parallax)
    gsap.fromTo(panel, { clipPath: 'inset(12% 6% 0% 6% round 36px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: panel, start: 'top bottom', end: 'top top', scrub: true } });
    gsap.fromTo(vid, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: panel, start: 'top bottom', end: 'top top', scrub: true } });
    gsap.fromTo(vid, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (!last) {
      // stays put while the next one slides over it, sinking back into the stack
      ScrollTrigger.create({ trigger: panel, start: 'top top', end: 'bottom top', pin: true, pinSpacing: false });
      gsap.to(panel, { scale: .92, borderRadius: 28, ease: 'none', scrollTrigger: { trigger: panel, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to(dim, { opacity: .7, ease: 'none', scrollTrigger: { trigger: panel, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to($('.content', panel), { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: panel, start: 'top top', end: '55% top', scrub: true } });
    }
    const chars = splits.get($('.title', panel)).chars;
    gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top 40%', toggleActions: 'play none none reverse' } })
      .from($('.chan', panel), { opacity: 0, x: -16, duration: .6, ease: 'expo.out' })
      .from(chars, { yPercent: 110, rotate: 4, duration: 1.1, stagger: .03, ease: 'expo.out' }, '-=.4')
      .from($$('.line, .meta li, .play', panel), { y: 24, opacity: 0, duration: .9, stagger: .05, ease: 'expo.out' }, '-=.85');
  });

  // the channel indicator on the side
  const rail = $('.rail'), links = $$('.rail a');
  const setRail = (i) => links.forEach((a, k) => a.classList.toggle('cur', k === i));
  setRail(0);
  ScrollTrigger.create({ trigger: hero, start: () => `top+=${(hero.offsetHeight - innerHeight) * .6} top`, endTrigger: '.end', end: 'top 60%',
    onToggle: (st) => rail.classList.toggle('on', st.isActive) });
  panels.forEach((panel, i) => ScrollTrigger.create({ trigger: panel, start: 'top 50%', onEnter: () => setRail(i + 1), onLeaveBack: () => setRail(i) }));

  gsap.from('.end h2, .end .kicker, .end .free', { y: 40, opacity: 0, duration: 1.2, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.end', start: 'top 75%' } });
  ScrollTrigger.refresh();
}
document.fonts.ready.then(buildReel);

/* ───────────── the TV ───────────── */
const canvas = $('#tv');
const videos = CHANNELS.map((c) => {
  const v = document.createElement('video');
  Object.assign(v, { src: c.src + EXT, muted: true, loop: true, playsInline: true, preload: 'auto' });
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  return v;
});
syncPortal = () => { try { portalVideo.currentTime = videos[0].currentTime || 0; } catch (e) { /* not seekable yet */ } };

function fallback() {
  document.documentElement.classList.add('no-webgl');
  const box = $('.fallback'), fv = $('#fallbackVideo');
  const show = (i) => { fv.src = CHANNELS[i].src + EXT; fv.poster = CHANNELS[i].src + '.jpg'; if (!reduce) fv.play().catch(() => {}); };
  show(current); listeners.push(show);
  screenRect = () => box.getBoundingClientRect();
  autoCycle();
}

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) fallback(); else buildTV();

function buildTV() {
  const DPR = Math.min(devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // screen-space background that matches the page
  const bgc = document.createElement('canvas'); bgc.width = 512; bgc.height = 512;
  const g2 = bgc.getContext('2d'); const rg = g2.createRadialGradient(340, 280, 10, 300, 280, 420);
  rg.addColorStop(0, '#221a2d'); rg.addColorStop(.45, '#130f19'); rg.addColorStop(1, '#0b0a0f');
  g2.fillStyle = rg; g2.fillRect(0, 0, 512, 512);
  const bgTex = new THREE.CanvasTexture(bgc); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .32;

  const camera = new THREE.PerspectiveCamera(28, 1, .05, 100);

  /* — geometry helpers — */
  const rrect = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };

  const W = 2.3, H = 1.66, D = 1.3, B = .09, LEG = .44;
  const SW = 1.38, SH = 1.035, SX = -.33, SY = .03; // screen (4:3)
  const tv = new THREE.Group(); scene.add(tv);
  const body = new THREE.Group(); tv.add(body);

  // shell
  const shellGeo = new THREE.ExtrudeGeometry(rrect(W - 2 * B, H - 2 * B, .2), { depth: D - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 10, curveSegments: 32 });
  shellGeo.center();
  const shellMat = new THREE.MeshPhysicalMaterial({ color: '#ece1c8', roughness: .38, clearcoat: .9, clearcoatRoughness: .18 });
  const shell = new THREE.Mesh(shellGeo, shellMat); shell.castShadow = true; shell.receiveShadow = true; body.add(shell);


  // bezel (dark frame with a screen-shaped hole)
  const bezelShape = rrect(SW + .2, SH + .2, .2); bezelShape.holes.push(rrect(SW, SH, .14));
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, { depth: .07, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 4, curveSegments: 24 });
  const bezelMat = new THREE.MeshPhysicalMaterial({ color: '#1a171d', roughness: .45, clearcoat: .6, clearcoatRoughness: .3 });
  const bezel = new THREE.Mesh(bezelGeo, bezelMat); bezel.position.set(SX, SY, D / 2 - .02); body.add(bezel);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SW + .05, SH + .05), new THREE.MeshBasicMaterial({ color: '#000' })); back.position.set(SX, SY, D / 2 + .004); body.add(back);

  // curved CRT screen
  const sGeo = new THREE.PlaneGeometry(SW, SH, 48, 36); const pos = sGeo.attributes.position;
  for (let k = 0; k < pos.count; k++) { const nx = pos.getX(k) / (SW / 2), ny = pos.getY(k) / (SH / 2); pos.setZ(k, .045 * (1 - nx * nx * .55) * (1 - ny * ny * .55)); }
  sGeo.computeVertexNormals();

  // on-screen display (channel number + name), drawn on a canvas
  const osd = document.createElement('canvas'); osd.width = 640; osd.height = 480; const ox = osd.getContext('2d');
  const osdTex = new THREE.CanvasTexture(osd); osdTex.colorSpace = THREE.SRGBColorSpace;
  function drawOSD(i) {
    ox.clearRect(0, 0, 640, 480);
    ox.font = '64px VT323, monospace'; ox.textBaseline = 'top'; ox.shadowColor = 'rgba(80,255,140,.9)'; ox.shadowBlur = 14; ox.fillStyle = '#9dffb4';
    ox.textAlign = 'right'; ox.fillText(`CH 0${i + 1}`, 596, 40);
    ox.textAlign = 'left'; ox.font = '44px VT323, monospace'; ox.fillText(`▶ ${CHANNELS[i].name.toUpperCase()}`, 44, 404);
  }
  const textures = videos.map((v) => { const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; });

  const screenMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: textures[0] }, uOsd: { value: osdTex }, uTime: { value: 0 }, uStatic: { value: 0 }, uPower: { value: reduce ? 1 : 0 }, uOsdA: { value: 0 }, uCrop: { value: .75 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform sampler2D uOsd; uniform float uTime, uStatic, uPower, uOsdA, uCrop; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec2 curve(vec2 uv){ uv = uv * 2.0 - 1.0; vec2 o = abs(uv.yx) / vec2(11.0, 9.0); uv += uv * o * o; return uv * 0.5 + 0.5; }
      void main(){
        vec2 uv = curve(vUv);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float jit = (hash(vec2(floor(uv.y * 160.0), floor(uTime * 30.0))) - 0.5) * uStatic * 0.07;
        float wob = sin(uv.y * 4.0 + uTime * 1.7) * 0.0012;
        vec2 t = vec2((uv.x - 0.5) * uCrop + 0.5 + jit + wob, uv.y);
        float s = 0.0016 + uStatic * 0.014;
        vec3 col = vec3(texture2D(uTex, t + vec2(s, 0.0)).r, texture2D(uTex, t).g, texture2D(uTex, t - vec2(s, 0.0)).b);
        col *= 0.88 + 0.12 * sin(uv.y * 900.0);                           // scanlines
        col *= 0.93 + 0.07 * sin(gl_FragCoord.x * 2.2);                   // aperture grille
        float n = hash(uv * vec2(420.0, 320.0) + fract(uTime * 13.0));
        col = mix(col, vec3(n) * vec3(0.92, 0.95, 1.0), clamp(uStatic, 0.0, 1.0)); // channel static
        col = pow(col, vec3(1.08)) * 1.3 * (0.975 + 0.025 * sin(uTime * 120.0));               // phosphor + flicker
        col *= pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.3); // vignette
        vec4 o = texture2D(uOsd, vUv); col = mix(col, o.rgb * 1.4, o.a * uOsdA);
        float h = smoothstep(0.0, 0.55, uPower), w = smoothstep(0.0, 0.2, uPower);  // power-on line
        float on = step(abs(vUv.y - 0.5) * 2.0, max(h, 0.006)) * step(abs(vUv.x - 0.5) * 2.0, w);
        col = col * on + vec3(1.0) * on * (1.0 - h) * 1.5;
        col += vec3(0.07, 0.07, 0.08) * smoothstep(0.55, 0.0, distance(vUv, vec2(0.22, 0.82)));    // glass sheen
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const screen = new THREE.Mesh(sGeo, screenMat); screen.position.set(SX, SY, D / 2 + .008); body.add(screen);

  // control panel: two brass knobs, a speaker grille, a power light
  const brass = new THREE.MeshStandardMaterial({ color: '#d4a862', metalness: .9, roughness: .26, envMapIntensity: 3 });
  const PX = SX + SW / 2 + (W / 2 - (SX + SW / 2)) / 2;
  const knobs = [];
  for (const [y, r] of [[.42, .13], [.1, .1]]) {
    const k = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, .11, 48), brass); cap.rotation.x = Math.PI / 2; cap.castShadow = true; k.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, .012, 12, 48), new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: .6 })); k.add(ring);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(.018, r * .8, .02), new THREE.MeshStandardMaterial({ color: '#1b1612' })); mark.position.set(0, r * .45, .062); k.add(mark);
    k.position.set(PX, y, D / 2 + .02); body.add(k); knobs.push(k);
  }
  const slotMat = new THREE.MeshStandardMaterial({ color: '#2b241f', roughness: .7 });
  for (let k = 0; k < 7; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(.34, .026, .02), slotMat); sl.position.set(PX, -.2 - k * .065, D / 2 + .003); body.add(sl); }
  const led = new THREE.Mesh(new THREE.SphereGeometry(.022, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff3b2e', emissive: '#ff3b2e', emissiveIntensity: 4 }));
  led.position.set(PX + .14, -.69, D / 2 + .01); body.add(led);

  // legs + antenna
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: .55 });
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .022, LEG, 16), wood);
    leg.position.set(x * (W / 2 - .3), -H / 2 - LEG / 2 + .02, z * (D / 2 - .28)); leg.rotation.z = -x * .1; leg.rotation.x = z * .08; leg.castShadow = true; body.add(leg);
  }
  const chrome = new THREE.MeshStandardMaterial({ color: '#d8d8dc', metalness: 1, roughness: .18 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.14, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#221d1a', roughness: .4 }));
  dome.position.set(.15, H / 2, -.15); body.add(dome);
  for (const s of [-1, 1]) {
    const ant = new THREE.Group(); ant.position.set(.15, H / 2 + .06, -.15); ant.rotation.z = s * .52; ant.rotation.x = -.16;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.011, .014, 1.15, 10), chrome); rod.position.y = .575; rod.castShadow = true; ant.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.03, 16, 12), chrome); tip.position.y = 1.16; ant.add(tip);
    body.add(ant);
  }

  // floor that fades into the background, with a soft contact shadow
  const fade = document.createElement('canvas'); fade.width = fade.height = 256; const fx = fade.getContext('2d');
  const fg = fx.createRadialGradient(128, 128, 0, 128, 128, 128); fg.addColorStop(0, '#fff'); fg.addColorStop(.55, '#888'); fg.addColorStop(1, '#000'); fx.fillStyle = fg; fx.fillRect(0, 0, 256, 256);
  const fadeTex = new THREE.CanvasTexture(fade);
  const floorY = -H / 2 - LEG + .02;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ color: '#17121e', roughness: .5, metalness: .25, transparent: true, alphaMap: fadeTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true; tv.add(floor);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, D * 1.8), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .55, alphaMap: fadeTex, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = floorY + .005; tv.add(blob);

  /* — lights — */
  scene.add(new THREE.HemisphereLight('#b7a6ff', '#140c18', .22));
  const key = new THREE.SpotLight('#ffe0b5', 26, 22, .5, .85, 1.4); key.position.set(-3.2, 5.2, 4.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; key.shadow.radius = 6; key.target = tv; scene.add(key);
  const rim = new THREE.DirectionalLight('#7f6dff', 1.4); rim.position.set(4.5, 3, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#ff8a5c', .9); rim2.position.set(-5, 1.5, -3); scene.add(rim2);
  const glow = new THREE.PointLight(CHANNELS[0].glow, 3, 6, 1.8); glow.position.set(SX, SY - .2, D / 2 + 1.1); body.add(glow);

  /* — post: bloom so the screen and lamp actually glow — */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .4, .5, .92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* — layout: the 3/4 view, and the front-on view the scroll settles on — */
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const L = { camFrom: new THREE.Vector3(), lookFrom: new THREE.Vector3(), camTo: new THREE.Vector3(), lookTo: new THREE.Vector3(), rotY: -.4, x: 0 };
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight, a = w / h;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
    camera.aspect = a; camera.updateProjectionMatrix();
    if (a >= .9) {
      const d = 8.6; L.x = clamp(d * tanH * a * .36, .6, 1.9); L.rotY = -.42;
      L.camFrom.set(0, .7, d); L.lookFrom.set(0, .18, 0);
    } else {
      const d = 2.7 / (.86 * 2 * tanH * a); L.x = 0; L.rotY = -.24;
      const visH = 2 * d * tanH; L.camFrom.set(0, .55, d); L.lookFrom.set(0, .2 - visH * .14, 0);
    }
    // front-on, a step back: the screen about a third of the view's height (never wider than 60% of it), the whole set in view
    const narrow = a < .9;
    const dist = Math.max((SH / 2) / (tanH * .34), (SW / 2) / (tanH * a * (narrow ? .4 : .6)));
    L.lookTo.set(L.x + (narrow ? 0 : SX), SY - .12, D / 2); L.camTo.copy(L.lookTo).add(new THREE.Vector3(0, 0, dist));
    tv.position.set(L.x, 0, 0);
  }
  layout(); addEventListener('resize', layout);

  // where the screen sits on the page, for the portal to start from
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(SX + x * SW / 2, SY + y * SH / 2, D / 2 + .03));
  const tmp = new THREE.Vector3();
  screenRect = () => {
    const w = innerWidth, h = innerHeight; let top = h, left = w, right = 0, bottom = 0;
    for (const c of corners) {
      tmp.copy(c); body.localToWorld(tmp); tmp.project(camera);
      const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
      top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
    }
    return { top, left, right, bottom };
  };

  /* — channel switching on the set — */
  drawOSD(0);
  let osdTimer;
  const showOSD = () => { gsap.killTweensOf(screenMat.uniforms.uOsdA); screenMat.uniforms.uOsdA.value = 1; clearTimeout(osdTimer); osdTimer = setTimeout(() => gsap.to(screenMat.uniforms.uOsdA, { value: 0, duration: .6 }), 2600); };
  function tune(i) {
    const u = screenMat.uniforms;
    videos[i].currentTime = 0; videos[i].play().catch(() => {});
    gsap.timeline()
      .to(u.uStatic, { value: 1, duration: .14, ease: 'power2.in', onComplete: () => { u.uTex.value = textures[i]; drawOSD(i); osdTex.needsUpdate = true; showOSD(); videos.forEach((v, k) => k !== i && v.pause()); } })
      .to(u.uStatic, { value: 0, duration: .5, ease: 'power2.out' });
    const c = new THREE.Color(CHANNELS[i].glow);
    gsap.to(glow.color, { r: c.r, g: c.g, b: c.b, duration: .6 });
    gsap.to(knobs[0].rotation, { z: -i * 1.1, duration: .9, ease: 'back.out(2)' });
  }
  listeners.push(tune);

  /* — pointer: tilt toward the cursor; click the set to change channel — */
  const ptr = { x: 0, y: 0 }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hovering = false;
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX / innerWidth - .5; ptr.y = e.clientY / innerHeight - .5;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }, { passive: true });
  canvas.addEventListener('click', () => { if (hovering) setChannel((current + 1) % 3, true); });

  /* — start: wait for the first frame, then switch the set on — */
  let started = false;
  const start = () => {
    if (started) return; started = true;
    canvas.classList.add('ready');
    if (!reduce) { gsap.to(screenMat.uniforms.uPower, { value: 1, duration: 1.4, delay: .5, ease: 'power3.inOut', onComplete: showOSD }); videos[0].play().catch(() => {}); }
    else showOSD();
  };
  document.fonts.load('64px VT323').then(() => { drawOSD(current); osdTex.needsUpdate = true; });
  if (videos[0].readyState >= 2) start(); else videos[0].addEventListener('loadeddata', start, { once: true });
  setTimeout(start, 2500);
  autoCycle();

  /* — render loop (paused once the TV is covered or off screen) — */
  let visible = true; new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  const clock = new THREE.Clock(), look = new THREE.Vector3(), rot = { y: L.rotY, x: 0 };
  renderer.setAnimationLoop(() => {
    const z = clamp(heroSmooth / ZOOM_END);
    if (!visible || z >= GROW[1] + .02) return; // the portal covers the set from here on
    const t = clock.getElapsedTime();
    const p = ease(clamp((z - FRAME[0]) / (FRAME[1] - FRAME[0])));
    const k = 1 - p;
    rot.y += ((L.rotY + ptr.x * .32) * k - rot.y) * .07; rot.x += ((ptr.y * .08) * k - rot.x) * .07;
    tv.rotation.set(rot.x, rot.y, 0); body.position.y = Math.sin(t * .9) * .025 * k;
    camera.position.lerpVectors(L.camFrom, L.camTo, p); look.lerpVectors(L.lookFrom, L.lookTo, p); camera.lookAt(look);
    ray.setFromCamera(ndc, camera); hovering = z < .05 && ray.intersectObject(body, true).length > 0; canvas.style.cursor = hovering ? 'pointer' : '';
    screenMat.uniforms.uTime.value = t;
    glow.intensity = (3 + Math.sin(t * 9) * .25 + Math.sin(t * 23) * .2) * screenMat.uniforms.uPower.value;
    led.material.emissiveIntensity = 3 + Math.sin(t * 3) * 1.5;
    composer.render();
  });
}
