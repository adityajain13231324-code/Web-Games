// Web Games hub: a 3D retro TV (tv.js, three.js) whose screen grows into the first game,
// then the other games slide over each other (GSAP ScrollTrigger + SplitText, Lenis).
// The 3D TV lives in tv.js and is loaded once the page is up (see the bottom of this file).

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
  cards.forEach((c, k) => c.classList.toggle('on', k === i));
  watch.href = CHANNELS[i].url; watchName.textContent = CHANNELS[i].name;
  listeners.forEach((f) => f(i));
}
document.querySelector('#surprise').addEventListener('click', () => {
  setChannel((current + 1 + Math.floor(Math.random() * 2)) % 3, true);
  watch.focus({ preventScroll: true });
});
// each card is a link to its game; pointing at it (or focusing it) tunes the TV to that channel
let hoverTimer;
cards.forEach((card, k) => {
  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer); hoverTimer = setTimeout(() => setChannel(k, true), 120);
  });
  card.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
  card.addEventListener('focus', () => setChannel(k, true));
});
addEventListener('keydown', (e) => {
  if (heroProgress > .1 || e.target.closest?.('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') e.preventDefault();
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

let drawn = -1;
function choreo() {
  // time-based smoothing: the same feel at 30, 60 or 120 frames a second
  heroSmooth += (heroProgress - heroSmooth) * (reduce ? 1 : 1 - Math.pow(.86, gsap.ticker.deltaRatio(60)));
  if (Math.abs(heroProgress - heroSmooth) < .0005) heroSmooth = heroProgress;
  if (heroSmooth === drawn) return; // nothing moved: leave the page alone
  drawn = heroSmooth;
  const z = clamp(heroSmooth / ZOOM_END);          // 0 → 1 while the TV is framed and the screen grows
  const s = clamp((heroSmooth - ZOOM_END) / (1 - ZOOM_END)); // 0 → 1 while Liar's Call slides over

  copy.style.opacity = String(clamp(1 - z * 5)); copy.style.transform = `translateY(${-z * 160}px)`;
  copy.style.pointerEvents = z > .1 ? 'none' : '';
  cue.style.opacity = String(clamp(1 - z * 10));
  if (z > .15 && current !== 0) setChannel(0, false);
  if (z > .2 && portalVideo.preload !== 'auto') { portalVideo.preload = 'auto'; portalVideo.load(); }

  const g = ease(clamp((z - GROW[0]) / (GROW[1] - GROW[0])));
  const on = z > GROW[0] - .02;
  if (on !== portalShown) {
    portalShown = on; portal.classList.toggle('on', on);
    if (on) { syncPortal(portalVideo); portalVideo.play().catch(() => {}); } else portalVideo.pause();
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
    ScrollTrigger.create({ trigger: panel, start: 'top 250%', once: true, onEnter: () => { vid.preload = 'auto'; vid.load(); } });
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

/* ───────────── the TV (tv.js), loaded after the first frame ───────────── */
function fallback() {
  document.documentElement.classList.add('no-webgl');
  const box = $('.fallback'), fv = $('#fallbackVideo');
  const show = (i) => { fv.src = CHANNELS[i].src + EXT; fv.poster = CHANNELS[i].src + '.jpg'; if (!reduce) fv.play().catch(() => {}); };
  show(current); listeners.push(show);
  screenRect = () => box.getBoundingClientRect();
  autoCycle();
}
const ctx = {
  canvas: $('#tv'), hero, CHANNELS, EXT, reduce, gsap, clamp, ease, ZOOM_END, FRAME, GROW, setChannel, listeners, autoCycle,
  get: () => ({ heroSmooth, current }),
  setScreenRect: (f) => { screenRect = f; },
  setSync: (f) => { syncPortal = f; },
};
requestAnimationFrame(() => setTimeout(() => {
  import('./tv.js').then((m) => { if (!m.startTV(ctx)) fallback(); }).catch(fallback);
}, 0));
