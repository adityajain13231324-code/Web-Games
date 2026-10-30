/* Particles on one full-screen canvas: sparks and confetti. The loop only runs while particles exist.
   The shape follows the theme (spark, scrap, dot, pixel, bubble, leaf, confetti). */
(function (root) {
  'use strict';
  const canvas = document.getElementById('fx');
  const c2d = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, kind = 'spark', enabled = true, raf = 0, last = 0;
  const parts = [];

  function resize() {
    dpr = Math.min(2, root.devicePixelRatio || 1);
    W = root.innerWidth; H = root.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  root.addEventListener('resize', resize);
  resize();

  const rnd = (a, b) => a + Math.random() * (b - a);

  /* shape defaults per theme kind: gravity, drag, size range, life seconds */
  const KIND = {
    spark:    { g: 380, drag: .5, size: [2, 4.5], life: [.5, 1] },
    scrap:    { g: 520, drag: 1.2, size: [5, 9], life: [.8, 1.5] },
    dot:      { g: 260, drag: .8, size: [2.5, 5], life: [.6, 1.2] },
    pixel:    { g: 600, drag: .3, size: [4, 8], life: [.6, 1.2] },
    bubble:   { g: -90, drag: 1.4, size: [3, 8], life: [.9, 1.8] },
    leaf:     { g: 160, drag: 1.6, size: [5, 9], life: [1, 2] },
    confetti: { g: 520, drag: 1, size: [4, 8], life: [.9, 1.8] },
  };

  function burst(x, y, color, count, opt) {
    if (!enabled) return;
    opt = opt || {};
    const k = KIND[kind] || KIND.spark;
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(60, opt.power || 260);
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.lift || 60), rot: rnd(0, 6.28), vr: rnd(-8, 8),
        size: rnd(k.size[0], k.size[1]) * (opt.scale || 1), life: 0, max: rnd(k.life[0], k.life[1]),
        color: colors[(Math.random() * colors.length) | 0], g: k.g, drag: k.drag, kind,
      });
    }
    start();
  }

  /* Confetti raining from the top plus a few bursts, for winning the whole game. */
  function celebrate(colors) {
    if (!enabled) return;
    for (let i = 0; i < 4; i++) setTimeout(() => burst(rnd(W * .15, W * .85), rnd(H * .15, H * .45), colors, 40, { power: 420, lift: 160 }), i * 180);
    for (let i = 0; i < 90; i++) {
      setTimeout(() => {
        const k = KIND[kind] || KIND.confetti;
        parts.push({ x: rnd(0, W), y: -10, vx: rnd(-60, 60), vy: rnd(40, 200), rot: rnd(0, 6.28), vr: rnd(-6, 6), size: rnd(k.size[0], k.size[1]) * 1.2,
          life: 0, max: rnd(2, 3.4), color: colors[(Math.random() * colors.length) | 0], g: Math.abs(k.g) * .5 + 80, drag: 1.1, kind });
        start();
      }, rnd(0, 900));
    }
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    c2d.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max || p.y > H + 30) { parts.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt; p.vy += p.g * dt - p.vy * p.drag * dt * .5;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const t = p.life / p.max;
      c2d.globalAlpha = t < .7 ? 1 : 1 - (t - .7) / .3;
      c2d.fillStyle = c2d.strokeStyle = p.color;
      c2d.save(); c2d.translate(p.x, p.y); c2d.rotate(p.rot);
      const s = p.size;
      if (p.kind === 'spark') { c2d.lineWidth = 1.6; c2d.beginPath(); c2d.moveTo(-s, 0); c2d.lineTo(s, 0); c2d.stroke(); }
      else if (p.kind === 'pixel') c2d.fillRect(-s / 2, -s / 2, s, s);
      else if (p.kind === 'bubble') { c2d.lineWidth = 1.5; c2d.beginPath(); c2d.arc(0, 0, s, 0, 6.283); c2d.stroke(); }
      else if (p.kind === 'leaf') { c2d.beginPath(); c2d.ellipse(0, 0, s, s * .45, 0, 0, 6.283); c2d.fill(); }
      else if (p.kind === 'dot') { c2d.beginPath(); c2d.arc(0, 0, s, 0, 6.283); c2d.fill(); }
      else c2d.fillRect(-s, -s * .5, s * 2, s);          // scrap, confetti
      c2d.restore();
    }
    c2d.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(frame) : 0;
    if (!raf) c2d.clearRect(0, 0, W, H);
  }

  root.UTTT.fx = {
    burst, celebrate,
    setKind(k) { kind = KIND[k] ? k : 'spark'; },
    setEnabled(on) { enabled = !!on; if (!on) parts.length = 0; },
  };
})(window);
