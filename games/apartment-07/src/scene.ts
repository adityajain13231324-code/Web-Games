import Phaser from 'phaser';
import { APARTMENT, blockers, rayRect, canSee, movePoint, roomAt } from '../shared/map';
import { RUN_SPEED, WALK_SPEED, type Snapshot, type Point, type Player, type Direction } from '../shared/types';
import { apartmentCanvas, drawAvatar, WINDOWS } from './art';

export interface SceneBridge {
  getState: () => Snapshot | undefined;
  getId: () => string;
  blocked: () => boolean;
  send: (type: string, data?: any) => void;
  near: (id: string | null) => void;
  location: (name: string, subtitle: string) => void;
  footstep: (running: boolean) => void;
  thunder: (strength: number) => void;
  doorOpened: (id: string) => void;
}

/** How far your own light reaches, in world pixels. */
const LIGHT_RADIUS = 340;
/** Fog is drawn at a lower resolution and stretched; this keeps it soft and cheap. */
const FOG_SCALE = 0.5;
const ACCEL = 1700;
const DECEL = 2300;

type Dust = { x: number; y: number; born: number; size: number };

export class ApartmentScene extends Phaser.Scene {
  bridge: SceneBridge;
  world!: Phaser.GameObjects.Container;
  details!: Phaser.GameObjects.Graphics;
  doorLayer!: Phaser.GameObjects.Graphics;
  effects!: Phaser.GameObjects.Graphics;
  overlay!: Phaser.GameObjects.Graphics;
  uiCam!: Phaser.Cameras.Scene2D.Camera;
  fogCanvas!: HTMLCanvasElement;
  fogCtx!: CanvasRenderingContext2D;
  fogTexture!: Phaser.Textures.CanvasTexture;
  fogImage!: Phaser.GameObjects.Image;
  people = new Map<string, Phaser.GameObjects.Container>();
  markers = new Map<string, Phaser.GameObjects.Container>();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;

  local: Point = { ...APARTMENT.spawn };
  velocity = { x: 0, y: 0 };
  facing: Direction = 'down';
  running = false;
  camPos: Point = { ...APARTMENT.spawn };
  zoom = 1;
  seq = 0;
  lastSend = 0;
  lastSent = { x: 0, y: 0, moving: false };
  stepClock = 0;
  nearId: string | null = null;
  lastRoom = '';
  lastPhase = '';
  labels = true;
  lightning = true;
  ready = false;
  explored = new Set<string>();
  knownDoors = new Set<string>();
  doorOpenedAt = new Map<string, number>();
  dust: Dust[] = [];
  flash = 0;
  nextFlash = 0;
  pendingThunder: { at: number; strength: number } | null = null;
  ambient = 0.94;

  constructor(bridge: SceneBridge) {
    super('apartment');
    this.bridge = bridge;
  }

  preload() {
    this.load.image('furniture-atlas', '/art/furniture-atlas.png');
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b1215');
    this.world = this.add.container(0, 0);
    this.textures.addCanvas('apartment', apartmentCanvas(this.textures.get('furniture-atlas').getSourceImage() as HTMLImageElement));
    this.world.add(this.add.image(0, 0, 'apartment').setOrigin(0));
    this.details = this.add.graphics();
    this.doorLayer = this.add.graphics();
    this.effects = this.add.graphics();
    this.world.add([this.details, this.doorLayer, this.effects]);

    for (const o of APARTMENT.interactables) {
      const glow = this.add.graphics();
      glow.fillStyle(0xf3d394, 0.18).fillCircle(0, 0, 11);
      glow.fillStyle(0xf6e2b4, 0.95).fillCircle(0, 0, 3.2);
      const ring = this.add.graphics();
      ring.lineStyle(2, 0xf5d393, 0.95).strokeCircle(0, 0, 16);
      ring.setName('ring').setVisible(false);
      const bubble = this.add.text(0, -34, 'E', { fontFamily: 'DM Sans, Arial', fontSize: '12px', fontStyle: 'bold', color: '#1c1610', backgroundColor: '#e7c58b', padding: { x: 6, y: 3 } }).setOrigin(0.5).setName('bubble').setVisible(false);
      const group = this.add.container(o.x, o.y, [glow, ring, bubble]);
      this.markers.set(o.id, group);
      this.world.add(group);
    }

    // Screen-space layers live on a second camera so the world camera's zoom never distorts them.
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.resizeFog();
    this.fogTexture = this.textures.addCanvas('fog', this.fogCanvas)!;
    this.fogImage = this.add.image(0, 0, 'fog').setOrigin(0).setDepth(1000).setDisplaySize(this.scale.width, this.scale.height);
    this.overlay = this.add.graphics().setDepth(1001);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.world);
    cam.ignore([this.fogImage, this.overlay]);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT', false) as Record<string, Phaser.Input.Keyboard.Key>;
    this.applyZoom();
    this.scale.on('resize', () => {
      this.applyZoom();
      this.uiCam.setSize(this.scale.width, this.scale.height);
      this.resizeFog();
    });
    this.nextFlash = this.time.now + 25000 + Math.random() * 30000;
    this.ready = true;
  }

  applyZoom() {
    this.zoom = Math.max(0.85, Math.min(1.4, this.scale.height / 680));
    this.cameras.main.setZoom(this.zoom);
  }

  resizeFog() {
    const w = Math.max(2, Math.ceil(this.scale.width * FOG_SCALE)), h = Math.max(2, Math.ceil(this.scale.height * FOG_SCALE));
    if (this.fogCanvas.width !== w || this.fogCanvas.height !== h) {
      this.fogCanvas.width = w;
      this.fogCanvas.height = h;
    }
    this.fogImage?.setDisplaySize(this.scale.width, this.scale.height);
  }

  /** Server rejected a move (e.g. a door closed on us); jump to the authoritative position. */
  correct(x: number, y: number) {
    this.local = { x, y };
    this.velocity = { x: 0, y: 0 };
  }

  avatarTexture(p: Player, d: string, frame: number) {
    const key = `avatar-${JSON.stringify(p.avatar)}-${d}-${frame}`;
    if (!this.textures.exists(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 128;
      drawAvatar(canvas.getContext('2d')!, p.avatar, d as Direction, frame);
      this.textures.addCanvas(key, canvas);
    }
    return key;
  }

  /** World → fog-canvas coordinates. Uses our own camera centre so light and world never drift apart. */
  toFog(x: number, y: number): [number, number] {
    const z = this.zoom, w = this.scale.width, h = this.scale.height;
    return [((x - this.camPos.x) * z + w / 2) * FOG_SCALE, ((y - this.camPos.y) * z + h / 2) * FOG_SCALE];
  }

  toScreen(x: number, y: number): [number, number] {
    const z = this.zoom;
    return [(x - this.camPos.x) * z + this.scale.width / 2, (y - this.camPos.y) * z + this.scale.height / 2];
  }

  update(time: number, delta: number) {
    const s = this.bridge.getState();
    if (!s || !this.ready) return;
    const me = s.players.find(p => p.id === this.bridge.getId());
    if (!me) return;
    const dt = Math.min(delta, 50) / 1000;
    if (this.lastPhase !== s.phase) {
      this.local = { x: me.x, y: me.y };
      this.camPos = { x: me.x, y: me.y - 24 };
      this.lastPhase = s.phase;
    }

    this.move(s, me, time, dt);
    this.camera(dt);
    this.drawDoors(s, time);
    this.drawDetails(s, time);
    this.drawPeople(s, me, time);
    this.findNearby(s, time);
    this.trackRoom();
    this.weather(time, dt);
    this.drawFog(s, me, time);
    this.drawOverlay(s, me, time);
  }

  move(s: Snapshot, me: Player, time: number, dt: number) {
    const k = this.keys;
    const busy = this.bridge.blocked() || s.phase !== 'playing';
    let ix = busy ? 0 : Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown);
    let iy = busy ? 0 : Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown);
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    this.running = !busy && k.SHIFT.isDown && len > 0;
    const speed = this.running ? RUN_SPEED : WALK_SPEED;

    // Ease toward the target velocity so starts and stops feel weighty but responsive.
    const tx = ix * speed, ty = iy * speed;
    const approach = (v: number, t: number) => {
      const rate = (t === 0 || Math.sign(t) !== Math.sign(v) ? DECEL : ACCEL) * dt;
      return v < t ? Math.min(t, v + rate) : Math.max(t, v - rate);
    };
    this.velocity.x = approach(this.velocity.x, tx);
    this.velocity.y = approach(this.velocity.y, ty);
    const before = { ...this.local };
    this.local = movePoint(this.local, this.velocity.x * dt, this.velocity.y * dt, s.doors);
    // If a wall stopped us, drop that velocity component so we don't "stick" when sliding off.
    if (Math.abs(this.local.x - before.x) < Math.abs(this.velocity.x * dt) * 0.3) this.velocity.x = 0;
    if (Math.abs(this.local.y - before.y) < Math.abs(this.velocity.y * dt) * 0.3) this.velocity.y = 0;
    if (len > 0) this.facing = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 'right' : 'left') : iy > 0 ? 'down' : 'up';

    // Large disagreement with the server (teleport, reconnect) → trust the server.
    if (Math.hypot(me.x - this.local.x, me.y - this.local.y) > 220) this.correct(me.x, me.y);

    const moving = Math.hypot(this.velocity.x, this.velocity.y) > 8;
    if (moving) {
      this.stepClock += dt * (this.running ? 3.4 : 2.3);
      if (this.stepClock >= 1) {
        this.stepClock -= 1;
        this.bridge.footstep(this.running);
        if (this.running) this.dust.push({ x: this.local.x + (Math.random() - 0.5) * 10, y: this.local.y + 2, born: time, size: 5 + Math.random() * 4 });
      }
    } else this.stepClock = 0.6;

    const changed = Math.hypot(this.local.x - this.lastSent.x, this.local.y - this.lastSent.y) > 0.3 || moving !== this.lastSent.moving;
    if (s.phase === 'playing' && changed && time - this.lastSend >= 50) {
      this.bridge.send('pos', { x: this.local.x, y: this.local.y, dir: this.facing, moving, run: this.running, seq: ++this.seq });
      this.lastSend = time;
      this.lastSent = { x: this.local.x, y: this.local.y, moving };
    }
  }

  camera(dt: number) {
    const target = { x: this.local.x + this.velocity.x * 0.18, y: this.local.y - 24 + this.velocity.y * 0.18 };
    const k = 1 - Math.exp(-dt * 7);
    this.camPos.x += (target.x - this.camPos.x) * k;
    this.camPos.y += (target.y - this.camPos.y) * k;
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
  }

  drawDoors(s: Snapshot, time: number) {
    const g = this.doorLayer;
    g.clear();
    for (const d of APARTMENT.doors) {
      const open = s.doors.includes(d.id);
      if (open && !this.knownDoors.has(d.id)) {
        this.knownDoors.add(d.id);
        // Doors already open when we join appear open immediately; new ones swing open.
        if (this.lastRoom) { this.doorOpenedAt.set(d.id, time); this.bridge.doorOpened(d.id); }
        else this.doorOpenedAt.set(d.id, -10000);
      }
      const t = open ? Phaser.Math.Easing.Back.Out(Math.min(1, (time - (this.doorOpenedAt.get(d.id) ?? -10000)) / 700)) : 0;
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      // Door frame (always visible).
      g.fillStyle(0x2a211b, 1);
      if (d.horizontal) { g.fillRect(d.x - 6, cy - 9, 8, 18); g.fillRect(d.x + d.w - 2, cy - 9, 8, 18); }
      else { g.fillRect(cx - 9, d.y - 6, 18, 8); g.fillRect(cx - 9, d.y + d.h - 2, 18, 8); }
      if (open) {
        // Swung-open door leaf, hinged at one end.
        const hinge = d.horizontal ? { x: d.x, y: cy } : { x: cx, y: d.y };
        const length = d.horizontal ? d.w : d.h;
        const angle = d.horizontal ? t * Math.PI / 2 * 0.92 : Math.PI / 2 - t * Math.PI / 2 * 0.92;
        const ex = hinge.x + Math.cos(angle) * length, ey = hinge.y + Math.sin(angle) * length;
        g.lineStyle(9, 0x5c4636, 1).lineBetween(hinge.x, hinge.y, ex, ey);
        g.lineStyle(2, 0xb99b6e, 0.7).lineBetween(hinge.x, hinge.y, ex, ey);
        const glowAge = (time - (this.doorOpenedAt.get(d.id) ?? -10000)) / 1600;
        if (glowAge < 1) {
          g.fillStyle(0xf2cf8c, 0.35 * (1 - glowAge));
          g.fillCircle(cx, cy, 30 + glowAge * 50);
        }
      } else {
        g.fillStyle(0x5f4b3d, 1).fillRoundedRect(d.x, d.y - 4, d.w, d.h + 4, 3);
        g.lineStyle(2, 0xb99b6e, 0.55).strokeRect(d.x + 4, d.y + 2, d.w - 8, d.h - 6);
        const pulse = 0.55 + Math.sin(time / 380) * 0.35;
        g.fillStyle(0xe08c5e, pulse).fillCircle(cx, cy, 3.5);
      }
    }
  }

  drawDetails(s: Snapshot, time: number) {
    const g = this.details;
    g.clear();
    if (s.flags.includes('stool')) {
      g.fillStyle(0x6a4b32).fillRect(460, 212, 6, 26).fillRect(486, 212, 6, 26);
      g.fillStyle(0xb6966b).fillEllipse(477, 209, 43, 19);
    }
    if (s.flags.includes('backup')) for (let n = 0; n < 3; n++) g.fillStyle(0xadc77e, 0.75 + Math.sin(time / 300 + n) * 0.25).fillCircle(1604 + n * 19, 192, 4);
    if (s.doors.includes('exit')) {
      g.fillStyle(0xeac286, 0.12).fillRect(646, 1730, 130, 154);
      g.fillStyle(0x769284).fillRoundedRect(701, 1798, 26, 42, 9);
      g.fillStyle(0xd0a17b).fillCircle(714, 1786, 14);
      g.fillStyle(0x4a392d).fillEllipse(714, 1777, 29, 18);
    }
    // Running dust.
    const e = this.effects;
    e.clear();
    this.dust = this.dust.filter(d => time - d.born < 480);
    for (const d of this.dust) {
      const t = (time - d.born) / 480;
      e.fillStyle(0xd8c6a6, 0.28 * (1 - t)).fillCircle(d.x, d.y - t * 6, d.size * (0.6 + t));
    }
  }

  drawPeople(s: Snapshot, me: Player, time: number) {
    const ids = new Set(s.players.map(p => p.id));
    for (const [id, c] of this.people) if (!ids.has(id)) { c.destroy(); this.people.delete(id); }
    const dtK = 1 - Math.exp(-this.game.loop.delta / 1000 * 14);
    for (const p of s.players) {
      let c = this.people.get(p.id);
      if (!c) {
        c = this.add.container(p.x, p.y);
        const shadow = this.add.ellipse(0, 1, 30, 10, 0x05090b, 0.35);
        const img = this.add.image(0, 0, this.avatarTexture(p, p.direction, 0)).setOrigin(0.5, 0.875).setScale(0.57);
        const label = this.add.text(0, -80, p.name, { fontFamily: 'DM Sans, Arial', fontSize: '11px', color: '#f0e2c8', backgroundColor: '#12191dcc', padding: { x: 6, y: 3 } }).setOrigin(0.5, 1);
        c.add([shadow, img, label]);
        this.people.set(p.id, c);
        this.world.add(c);
      }
      const own = p.id === me.id;
      if (own) c.setPosition(this.local.x, this.local.y);
      else if (Math.hypot(c.x - p.x, c.y - p.y) > 200) c.setPosition(p.x, p.y);
      else c.setPosition(c.x + (p.x - c.x) * dtK, c.y + (p.y - c.y) * dtK);
      c.setVisible(p.connected && (own || canSee(this.local, c, s.doors, LIGHT_RADIUS)));
      const moving = own ? Math.hypot(this.velocity.x, this.velocity.y) > 8 : p.moving;
      const fast = own ? this.running : p.running;
      const frame = moving ? Math.floor(time / (fast ? 95 : 145)) % 4 : 0;
      const dir = own ? this.facing : p.direction;
      const img = c.list[1] as Phaser.GameObjects.Image;
      img.setTexture(this.avatarTexture(p, dir, frame));
      // A subtle lean while sprinting sells the speed.
      img.setRotation(fast && moving ? (dir === 'left' ? -0.06 : dir === 'right' ? 0.06 : 0) : 0);
      (c.list[2] as Phaser.GameObjects.Text).setVisible(this.labels && !own);
    }
    // Keep people in walking order so the one in front overlaps the one behind.
    const people = [...this.people.values()].sort((a, b) => a.y - b.y);
    for (const c of people) this.world.bringToTop(c);
  }

  findNearby(s: Snapshot, time: number) {
    let near: string | null = null, best = 84;
    for (const o of APARTMENT.interactables) {
      const dist = Math.hypot(o.x - this.local.x, o.y - this.local.y);
      if (dist < best && canSee(this.local, o, s.doors, 84)) { best = dist; near = o.id; }
    }
    if (near !== this.nearId) { this.nearId = near; this.bridge.near(near); }
    for (const [id, m] of this.markers) {
      const active = id === near;
      const ring = m.getByName('ring') as Phaser.GameObjects.Graphics;
      ring.setVisible(active).setScale(1 + Math.sin(time / 220) * 0.08);
      (m.getByName('bubble') as Phaser.GameObjects.Text).setVisible(active).setY(-34 + Math.sin(time / 300) * 2);
      (m.list[0] as Phaser.GameObjects.Graphics).setScale(1 + Math.sin(time / 500 + m.x) * 0.15);
    }
  }

  trackRoom() {
    const r = roomAt(this.local);
    if (r) this.explored.add(r.id);
    const id = r?.id ?? 'outside';
    if (id !== this.lastRoom) {
      this.lastRoom = id;
      this.bridge.location(r?.name ?? 'Together again', r?.subtitle ?? 'You found your way home.');
    }
  }

  weather(time: number, dt: number) {
    if (this.lightning && time > this.nextFlash) {
      const strength = 0.55 + Math.random() * 0.45;
      this.flash = strength;
      this.pendingThunder = { at: time + 400 + Math.random() * 1400, strength };
      this.nextFlash = time + 35000 + Math.random() * 50000;
      this.time.delayedCall(140, () => { this.flash = Math.max(this.flash, strength * 0.7); });
    }
    if (this.pendingThunder && time > this.pendingThunder.at) {
      this.bridge.thunder(this.pendingThunder.strength);
      this.pendingThunder = null;
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  /** Visibility polygon around a point, built from rays aimed at nearby wall corners. */
  visibility(origin: Point, doors: string[], radius: number) {
    const blocks = blockers(doors);
    const angles: number[] = [];
    // All angles in (-π, π] so the polygon is traced exactly once around the light.
    for (let i = 0; i < 96; i++) angles.push(-Math.PI + (i * Math.PI * 2) / 96);
    for (const b of blocks) for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      if (Math.hypot(x - origin.x, y - origin.y) > radius + 30) continue;
      const a = Math.atan2(y - origin.y, x - origin.x);
      angles.push(a - 0.0004, a + 0.0004);
    }
    angles.sort((a, b) => a - b);
    const near = blocks.filter(b => {
      const x = Math.max(b.x, Math.min(origin.x, b.x + b.w)), y = Math.max(b.y, Math.min(origin.y, b.y + b.h));
      return Math.hypot(origin.x - x, origin.y - y) < radius;
    });
    return angles.map(a => {
      const dx = Math.cos(a), dy = Math.sin(a);
      let len = radius;
      for (const b of near) len = Math.min(len, rayRect(origin, dx, dy, b, radius));
      // Reach into the wall a little so its top edge is lit, not cut off.
      const reach = len < radius ? len + 15 : len;
      return { x: origin.x + dx * reach, y: origin.y + dy * reach };
    });
  }

  drawFog(s: Snapshot, me: Player, time: number) {
    const c = this.fogCtx, W = this.fogCanvas.width, H = this.fogCanvas.height, z = this.zoom * FOG_SCALE;
    const backup = s.flags.includes('backup');
    // Ambient darkness eases between states instead of jumping.
    const targetAmbient = backup ? 0.8 : 0.94;
    this.ambient += (targetAmbient - this.ambient) * 0.02;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.fillStyle = `rgba(5,9,12,${this.ambient})`;
    c.fillRect(0, 0, W, H);

    c.globalCompositeOperation = 'destination-out';
    // Rooms you've explored stay faintly visible, like your memory of them.
    for (const r of APARTMENT.rooms) {
      if (!this.explored.has(r.id) && !backup) continue;
      const [x, y] = this.toFog(r.x - 8, r.y - 22);
      c.fillStyle = `rgba(0,0,0,${backup ? 0.42 : 0.3})`;
      c.fillRect(x, y, (r.w + 16) * z, (r.h + 30) * z);
    }
    // Storm light from windows.
    for (const w of WINDOWS) {
      const room = APARTMENT.rooms.find(r => r.id === w.room)!;
      if (!this.explored.has(room.id) && !backup) continue;
      const [x, y] = this.toFog(w.lx, w.ly);
      const g = c.createRadialGradient(x, y, 0, x, y, 150 * z);
      g.addColorStop(0, `rgba(0,0,0,${0.32 + this.flash * 0.5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - 150 * z, y - 150 * z, 300 * z, 300 * z);
    }

    // Your light: a soft radial falloff clipped by walls.
    const light = (origin: Point, radius: number, strength: number) => {
      const poly = this.visibility(origin, s.doors, radius);
      const [ox, oy] = this.toFog(origin.x, origin.y - 20);
      const g = c.createRadialGradient(ox, oy, 0, ox, oy, radius * z);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.35, `rgba(0,0,0,${strength * 0.96})`);
      g.addColorStop(0.75, `rgba(0,0,0,${strength * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      poly.forEach((p, i) => { const [x, y] = this.toFog(p.x, p.y); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath();
      c.fill();
    };
    const flicker = 1 - (Math.sin(time / 900) * 0.01 + Math.sin(time / 233) * 0.006);
    light(this.local, LIGHT_RADIUS, flicker);
    for (const p of s.players) {
      if (p.id === me.id || !p.connected) continue;
      const c2 = this.people.get(p.id);
      if (c2 && c2.visible) light({ x: c2.x, y: c2.y }, 170, 0.55);
    }
    // Lightning briefly lifts the whole house out of the dark.
    if (this.flash > 0) {
      c.fillStyle = `rgba(0,0,0,${this.flash * 0.55})`;
      c.fillRect(0, 0, W, H);
    }

    // A warm tint inside your own light, a cool tint in lightning.
    c.globalCompositeOperation = 'source-over';
    const [lx, ly] = this.toFog(this.local.x, this.local.y - 20);
    const warm = c.createRadialGradient(lx, ly, 0, lx, ly, 220 * z);
    warm.addColorStop(0, backup ? 'rgba(255,214,150,0.05)' : 'rgba(255,196,120,0.08)');
    warm.addColorStop(1, 'rgba(255,196,120,0)');
    c.fillStyle = warm;
    c.fillRect(lx - 220 * z, ly - 220 * z, 440 * z, 440 * z);
    if (this.flash > 0) {
      c.fillStyle = `rgba(190,215,235,${this.flash * 0.1})`;
      c.fillRect(0, 0, W, H);
    }
    this.fogTexture.refresh();
  }

  drawOverlay(s: Snapshot, me: Player, time: number) {
    const g = this.overlay;
    g.clear();
    // Teammate pings: rings in the world, plus an edge arrow if they're off screen.
    for (const p of s.pings) {
      if (p.until < Date.now()) continue;
      const [x, y] = this.toScreen(p.x, p.y);
      const t = (time % 1400) / 1400;
      const W = this.scale.width, H = this.scale.height, m = 40;
      if (x > m && x < W - m && y > m && y < H - m) {
        g.lineStyle(3, 0xf0c27b, 1 - t).strokeCircle(x, y - 20, 14 + t * 46);
        g.lineStyle(2, 0xf0c27b, 0.8).strokeCircle(x, y - 20, 9);
      } else if (p.id !== me.id) {
        const cx = W / 2, cy = H / 2, a = Math.atan2(y - cy, x - cx);
        const ex = Phaser.Math.Clamp(cx + Math.cos(a) * W, m, W - m), ey = Phaser.Math.Clamp(cy + Math.sin(a) * H, m + 60, H - m - 60);
        g.fillStyle(0xf0c27b, 0.6 + Math.sin(time / 150) * 0.3);
        g.fillTriangle(ex + Math.cos(a) * 16, ey + Math.sin(a) * 16, ex + Math.cos(a + 2.4) * 12, ey + Math.sin(a + 2.4) * 12, ex + Math.cos(a - 2.4) * 12, ey + Math.sin(a - 2.4) * 12);
      }
    }
  }
}
