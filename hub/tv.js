// The 3D TV (three.js). main.js loads this module after the page is already usable,
// so the headline, cards and scrolling never wait for the 3D engine.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

/** Builds the set and starts rendering. Returns false when WebGL is unavailable. */
export function startTV(ctx) {
  const { canvas, hero, CHANNELS, EXT, reduce, gsap, clamp, ease, ZOOM_END, FRAME, GROW, setChannel, listeners, autoCycle, get } = ctx;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { return false; }

  // one video per channel; only the one on air is fetched up front, the others when first tuned
  const videos = CHANNELS.map(() => {
    const v = document.createElement('video');
    Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto' });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    return v;
  });
  const load = (i) => { if (!videos[i].src) videos[i].src = CHANNELS[i].src + EXT; };
  load(0);
  ctx.setSync((pv) => { try { pv.currentTime = videos[0].currentTime || 0; } catch (e) { /* not seekable yet */ } });

  // drop the resolution if the device can't keep up (measured over about a second)
  let slow = 0, frames = 0;
  function adapt(dt) {
    if (dpr <= 1 || reduce) return;
    frames++; if (dt > 1 / 40) slow++;
    if (frames < 60) return;
    if (slow > 30) { bloom.enabled = false; dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); layout(); }
    slow = 0; frames = 0;
  }

  const MAX_DPR = Math.min(devicePixelRatio || 1, 1.5);
  let dpr = MAX_DPR;
  renderer.setPixelRatio(dpr);
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
        col = pow(col, vec3(1.08)) * 1.3 * (0.995 + 0.005 * sin(uTime * 2.0));               // phosphor + flicker
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
  key.shadow.mapSize.set(512, 512); key.shadow.bias = -.0004; key.shadow.radius = 6; key.target = tv; scene.add(key);
  const rim = new THREE.DirectionalLight('#7f6dff', 1.4); rim.position.set(4.5, 3, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#ff8a5c', .9); rim2.position.set(-5, 1.5, -3); scene.add(rim2);
  const glow = new THREE.PointLight(CHANNELS[0].glow, 3, 6, 1.8); glow.position.set(SX, SY - .2, D / 2 + 1.1); body.add(glow);

  /* — post: bloom so the screen and lamp actually glow — */
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .4, .5, .92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* — layout: the 3/4 view, and the front-on view the scroll settles on — */
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const L = { camFrom: new THREE.Vector3(), lookFrom: new THREE.Vector3(), camTo: new THREE.Vector3(), lookTo: new THREE.Vector3(), rotY: -.4, x: 0 };
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight, a = w / h;
    renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
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
  ctx.setScreenRect(() => {
    const w = innerWidth, h = innerHeight; let top = h, left = w, right = 0, bottom = 0;
    for (const c of corners) {
      tmp.copy(c); body.localToWorld(tmp); tmp.project(camera);
      const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
      top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
    }
    return { top, left, right, bottom };
  });

  /* — channel switching on the set — */
  drawOSD(0);
  let osdTimer, tuning;
  const showOSD = () => { gsap.killTweensOf(screenMat.uniforms.uOsdA); screenMat.uniforms.uOsdA.value = 1; clearTimeout(osdTimer); osdTimer = setTimeout(() => gsap.to(screenMat.uniforms.uOsdA, { value: 0, duration: .6 }), 2600); };
  function tune(i) {
    const u = screenMat.uniforms;
    load(i); videos[i].play().catch(() => {});
    tuning?.kill();
    tuning = gsap.timeline()
      .to(u.uStatic, { value: .4, duration: .1, ease: 'power2.in', onComplete: () => { u.uTex.value = textures[i]; drawOSD(i); osdTex.needsUpdate = true; showOSD(); videos.forEach((v, k) => k !== i && v.pause()); } })
      .to(u.uStatic, { value: 0, duration: .35, ease: 'power2.out' });
    const c = new THREE.Color(CHANNELS[i].glow);
    gsap.to(glow.color, { r: c.r, g: c.g, b: c.b, duration: .6 });
    gsap.to(knobs[0].rotation, { z: -i * 1.1, duration: .7, ease: 'power3.out', overwrite: true });
  }
  listeners.push(tune);

  /* — pointer: tilt toward the cursor; click the set to change channel — */
  const ptr = { x: 0, y: 0 }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hovering = false, moved = false;
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX / innerWidth - .5; ptr.y = e.clientY / innerHeight - .5;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    moved = true;
  }, { passive: true });
  canvas.addEventListener('click', () => { if (hovering) setChannel((get().current + 1) % CHANNELS.length, true); });

  /* — start: wait for the first frame, then switch the set on — */
  let started = false;
  const start = () => {
    if (started) return; started = true;
    canvas.classList.add('ready');
    if (!reduce) { gsap.to(screenMat.uniforms.uPower, { value: 1, duration: 1.4, delay: .5, ease: 'power3.inOut', onComplete: showOSD }); videos[0].play().catch(() => {}); }
    else showOSD();
  };
  document.fonts.load('64px VT323').then(() => { drawOSD(get().current); osdTex.needsUpdate = true; });
  if (videos[0].readyState >= 2) start(); else videos[0].addEventListener('loadeddata', start, { once: true });
  setTimeout(start, 2500);
  autoCycle();

  /* — render loop (paused once the TV is covered or off screen) — */
  let visible = true; new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  const clock = new THREE.Clock(), look = new THREE.Vector3(), rot = { y: L.rotY, x: 0 };
  renderer.setAnimationLoop(() => {
    const z = clamp(get().heroSmooth / ZOOM_END);
    if (!visible || document.hidden || z >= GROW[1] + .02) { clock.getDelta(); return; } // the portal covers the set from here on
    const dt = clock.getDelta(), t = clock.elapsedTime;
    adapt(dt);
    const p = ease(clamp((z - FRAME[0]) / (FRAME[1] - FRAME[0])));
    const k = 1 - p;
    const damping = 1 - Math.exp(-5 * Math.min(dt, .05));
    rot.y += ((L.rotY + ptr.x * .22) * k - rot.y) * damping; rot.x += ((ptr.y * .06) * k - rot.x) * damping;
    tv.rotation.set(rot.x, rot.y, 0); body.position.y = Math.sin(t * .9) * .025 * k;
    camera.position.lerpVectors(L.camFrom, L.camTo, p); look.lerpVectors(L.lookFrom, L.lookTo, p); camera.lookAt(look);
    if (moved || z >= .05) { moved = false; const was = hovering; hovering = z < .05 && (ray.setFromCamera(ndc, camera), ray.intersectObject(body, true).length > 0); if (was !== hovering) canvas.style.cursor = hovering ? 'pointer' : ''; }
    screenMat.uniforms.uTime.value = t;
    glow.intensity = (3 + Math.sin(t * 2) * .08) * screenMat.uniforms.uPower.value;
    led.material.emissiveIntensity = 3 + Math.sin(t * 3) * 1.5;
    composer.render();
  });
  return true;
}
