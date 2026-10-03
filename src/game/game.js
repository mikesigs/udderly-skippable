// Core game: state, rules, entities and their 3D counterparts.
import * as THREE from 'three';
import { makeRock, rockVerdict, rand, clamp, lerp } from './rocks.js';
import { makeRockMesh, rockRadius, disposeMesh } from '../render/rockmesh.js';
import { CowFactory, COW_TYPES } from '../render/cow.js';
import { SHORE_Z, CAM_Z, CAM_Y, sandY } from '../render/world.js';
import { SFX, audioInit, startAmbient } from '../audio/sfx.js';

export const POCKET_MAX = 8, BEACH_MAX = 16, IDEAL_V = 2.0, LANE = 1.4, AIM_MAX = 60, ROCK_G = 12;
const BEACH_Z0 = -1.2, BEACH_Z1 = 0.4;
const _v = new THREE.Vector3();

export class Game {
  constructor(world, fx, ui) {
    this.world = world; this.fx = fx; this.ui = ui;
    this.cowFactory = new CowFactory(world.gradient);
    this.mode = 'title'; this.practice = false;
    this.handMesh = null; this.aimDeg = null;
    this.hardReset();
  }

  hardReset() {
    for (const b of this.beach || []) disposeMesh(b.mesh);
    for (const c of this.cows || []) this.removeCow(c);
    for (const r of this.rocks || []) disposeMesh(r.mesh);
    for (const b of this.blasts || []) this.fx.removeBlast(b.mesh);
    this.score = 0; this.li = 0; this.level = 1; this.kills = 0; this.time = 0; this.bestChain = 0;
    this.pocket = []; this.sel = 0; this.beach = []; this.cows = []; this.blasts = []; this.rocks = [];
    this.spawnT = 1; this.beachT = 2; this.camTarget = 0; this.world.camX = 0; this.world.lean = 0;
    for (let i = 0; i < 10; i++) this.spawnBeachRock();
    this.syncHand(); this.fx.setAim(null, 0, false);
    this.ui.renderPocket(this); this.ui.hud(this);
  }

  start(practice) {
    audioInit(); startAmbient();
    this.practice = !!practice; this.hardReset();
    this.mode = 'play'; this.ui.show(null); this.ui.hudVisible(true);
    this.ui.msg(this.practice ? 'PRACTICE: JUST YOU AND THE LAKE' : 'GRAB SOME ROCKS!', this.world.W / 2, this.world.H * 0.22, { size: 22, color: '#ffd84d', life: 2 });
    this.ui.hint(this.practice ? 'TAP ROCKS, THEN FLICK FROM THE RING' : 'SWIPE OUTSIDE THE RING TO STEP ASIDE');
  }
  pause() { if (this.mode !== 'play') return; this.mode = 'pause'; this.ui.pause(this); }
  resume() { if (this.mode !== 'pause') return; this.mode = 'play'; this.ui.show(null); }
  quit() { this.mode = 'title'; this.practice = false; this.hardReset(); this.ui.hudVisible(false); this.ui.show('title'); }
  gameOver() { this.mode = 'over'; SFX.over(); this.fx.setAim(null, 0, false); this.ui.gameOver(this); }

  /* ---------- beach & pocket ---------- */
  spawnBeachRock() {
    for (let tries = 0; tries < 16; tries++) {
      const rock = makeRock(), r = rockRadius(rock) * rock.aspect;
      const z = rand(BEACH_Z0, BEACH_Z1), hw = this.world.halfWidthAt(z) * 0.9 + LANE;
      const x = rand(-hw, hw);
      let ok = true;
      for (const o of this.beach) if (Math.hypot(o.x - x, o.z - z) < r + rockRadius(o.rock) * o.rock.aspect + 0.06) { ok = false; break; }
      if (!ok) continue;
      const mesh = makeRockMesh(rock, this.world.gradient);
      const h = rockRadius(rock) * (0.26 + 0.74 * (1 - rock.flat));
      mesh.position.set(x, sandY(z) + h * 0.55, z); mesh.rotation.y = rand(0, 6.28); mesh.scale.setScalar(0.01);
      this.world.scene.add(mesh);
      this.beach.push({ rock, mesh, x, z, t: 0 });
      return;
    }
  }
  pickAt(sx, sy) {
    if (!this.beach.length) return false;
    const ndc = new THREE.Vector2((sx / this.world.W) * 2 - 1, -(sy / this.world.H) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.world.camera);
    const hits = rc.intersectObjects(this.beach.map((b) => b.mesh), false);
    let b = hits.length ? this.beach.find((o) => o.mesh === hits[0].object) : null;
    if (!b) {
      let bd = 40;
      for (const o of this.beach) { const p = this.world.project(o.mesh.position); const d = Math.hypot(p.x - sx, p.y - sy); if (d < bd) { bd = d; b = o; } }
    }
    if (!b) return false;
    const p = this.world.project(b.mesh.position);
    if (this.pocket.length >= POCKET_MAX) { this.ui.msg('POCKET FULL!', p.x, p.y - 30, { color: '#ff9f9f', size: 16 }); return true; }
    this.beach.splice(this.beach.indexOf(b), 1); disposeMesh(b.mesh);
    this.pocket.push(b.rock); if (this.pocket.length === 1) this.sel = 0;
    SFX.pick();
    this.ui.msg(rockVerdict(b.rock), clamp(p.x, 90, this.world.W - 90), p.y - 34, { color: b.rock.pot > 0.55 ? '#ffd84d' : '#eaf2ff', size: 15 });
    this.syncHand(); this.ui.renderPocket(this);
    return true;
  }
  selectSlot(i) { if (i >= 0 && i < this.pocket.length && i !== this.sel) { this.sel = i; SFX.select(); this.syncHand(); this.ui.renderPocket(this); } }
  syncHand() {
    if (this.handMesh) { this.world.camera.remove(this.handMesh); disposeMesh(this.handMesh); this.handMesh = null; }
    const rock = this.pocket[this.sel];
    if (!rock) return;
    const m = makeRockMesh(rock, this.world.gradient);
    m.position.set(0.02, -0.46, -1.15); m.scale.setScalar(0.42); m.castShadow = false;
    this.world.camera.add(m); this.handMesh = m;
    if (!this.world.camera.parent) this.world.scene.add(this.world.camera);
  }
  handWorld(out = _v) {
    if (!this.handMesh) { return out.set(this.world.camX + 0.02, CAM_Y - 0.46, CAM_Z - 1.15); }
    this.world.camera.updateMatrixWorld(); return this.handMesh.getWorldPosition(out);
  }

  /* ---------- throwing ---------- */
  setAim(deg) {
    this.aimDeg = deg;
    if (deg === null) { this.fx.setAim(null, 0, false); return; }
    const from = this.handWorld(new THREE.Vector3());
    this.fx.setAim(from, deg * Math.PI / 180, true);
  }
  throwRock(v, angleDeg) {
    if (!this.pocket.length) { this.ui.msg('POCKET EMPTY! GRAB ROCKS BELOW', this.world.W / 2, this.world.H * 0.5, { color: '#ffd166', size: 16 }); return; }
    const rock = this.pocket.splice(this.sel, 1)[0];
    this.sel = clamp(this.sel, 0, Math.max(0, this.pocket.length - 1));
    const q = Math.exp(-Math.pow((v - IDEAL_V) / 1.1, 2));
    const pw = clamp(v / IDEAL_V, 0.35, 1.5);
    const ang = clamp(angleDeg, -AIM_MAX, AIM_MAX) * Math.PI / 180;
    const sp = 6 + 4 * pw;
    let skipsLeft = Math.round(1 + 10 * rock.pot * q); if (q < 0.2) skipsLeft = 0;
    const from = this.handWorld(new THREE.Vector3());
    const mesh = makeRockMesh(rock, this.world.gradient); mesh.position.copy(from); this.world.scene.add(mesh);
    this.rocks.push({ rock, mesh, x: from.x, y: from.y, z: from.z, vx: Math.sin(ang) * sp, vz: -Math.cos(ang) * sp, vy: 1.2 + 0.6 * Math.min(pw, 1), skips: 0, skipsLeft, spin: rand(20, 32), done: false, q });
    SFX.throw();
    let fb, col = '#fff';
    if (v < 1.2) { fb = 'TOO GENTLE'; col = '#9fd3ff'; } else if (v > 2.9) { fb = 'TOO HARD!'; col = '#ff9f9f'; } else if (q > 0.88) { fb = 'PERFECT FLICK!'; col = '#ffd84d'; } else fb = 'NICE FLICK';
    this.ui.msg(fb, this.world.W / 2, this.world.H * 0.5, { color: col, size: 18 });
    this.syncHand(); this.ui.renderPocket(this); this.setAim(null);
  }
  dodge(dir) {
    const nt = clamp(Math.round(this.camTarget / LANE + dir) * LANE, -LANE, LANE);
    if (nt === this.camTarget) { this.ui.msg(dir > 0 ? "CAN'T STEP FURTHER RIGHT" : "CAN'T STEP FURTHER LEFT", this.world.W / 2, this.world.H * 0.44, { color: '#ffd166', size: 14, life: 0.9 }); return; }
    this.camTarget = nt; SFX.dodge();
  }

  /* ---------- cows & milk ---------- */
  pickCowType() {
    const lv = this.level, pool = [['cow', 6]];
    if (lv >= 2) pool.push(['calf', 2 + lv * 0.3]);
    if (lv >= 3) pool.push(['bull', 1.5 + lv * 0.4]);
    pool.push(['old', 1]);
    const tot = pool.reduce((a, p) => a + p[1], 0); let r = Math.random() * tot;
    for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
    return 'cow';
  }
  spawnCow() {
    const lv = this.level, type = this.pickCowType(), T = COW_TYPES[type];
    const dir = Math.random() < 0.5 ? 1 : -1, z = rand(-5, -14), half = this.world.halfWidthAt(z) + 1.6;
    const parts = this.cowFactory.make(type);
    parts.root.rotation.y = dir > 0 ? 0 : Math.PI;
    this.world.scene.add(parts.root, parts.shadow);
    const c = { type, T, parts, x: -dir * half, y0: rand(0.55, 1.8), y: 0, z, dir, half,
      vx: dir * (1.0 + 0.15 * (lv - 1)) * T.speed * rand(0.85, 1.15), hp: (1 + 0.4 * (lv - 1)) * T.hp,
      fire: rand(2.5, 4.5), charge: 0, bob: rand(0, 6.28), t: 0, dead: false, vy: 0, rot: 0, hitT: 0, gone: false, voice: T.voice };
    c.maxhp = c.hp; c.y = c.y0;
    this.cows.push(c);
  }
  removeCow(c) { this.world.scene.remove(c.parts.root, c.parts.shadow); c.parts.bodyMat.dispose(); c.parts.udderMat.dispose(); }
  fireBlast(c) {
    const lv = this.level;
    const from = new THREE.Vector3(); c.parts.udderG.getWorldPosition(from);
    this.blasts.push({ x0: from.x, y0: Math.max(0.15, from.y - 0.15), z0: from.z, tx: this.camTarget, t: 0, dur: Math.max(1.2, 2.5 - 0.08 * (lv - 1)), mesh: this.fx.makeBlast(), done: false });
    SFX.spray();
  }
  milkHit() {
    const dmg = Math.min(20, 8 + 1 * (this.level - 1));
    this.li = Math.min(100, this.li + dmg); this.world.shake = 1; SFX.splat(); this.ui.milk();
    this.ui.msg('SPLAT! +' + Math.round(dmg) + '% LACTOSE', this.world.W / 2, this.world.H * 0.4, { color: '#fff', size: 22, life: 1.6 });
    this.ui.hud(this);
    if (this.li >= 100) this.gameOver();
  }
  hitCow(c, r) {
    const dmg = 0.6 + r.rock.weight * 0.8; c.hp -= dmg; c.hitT = 0.3;
    const p = 50 + 15 * r.skips + 10 * (this.level - 1); this.score += p; SFX.hit();
    const sp = this.world.project(c.parts.root.position);
    this.ui.msg('+' + p, sp.x, sp.y - 40, { color: '#ffd84d', size: 20 });
    r.vz *= -0.15; r.vx *= 0.3; r.vy = 1.5; r.skipsLeft = 0;
    if (c.hp <= 0) {
      c.dead = true; c.vy = 1.8; this.kills++; const b = 200 * this.level; this.score += b;
      this.ui.msg('COW DOWN! +' + b, sp.x, sp.y - 70, { color: '#ff9fc0', size: 20, life: 1.6 });
      this.fx.stars(c.parts.root.position, 10);
    }
    SFX.moo(c.voice);
    this.ui.hud(this);
  }

  /* ---------- per-frame ---------- */
  update(dt) {
    if (this.mode === 'pause') return;
    const play = this.mode === 'play';
    if (play) {
      this.time += dt;
      if (!this.practice) this.updateLevel();
      this.world.camX += (this.camTarget - this.world.camX) * Math.min(1, dt * 12);
      this.world.lean = (this.camTarget - this.world.camX) * 0.09;
      this.updateBlasts(dt); this.updateRocks(dt);
      this.beachT -= dt; if (this.beach.length < BEACH_MAX && this.beachT <= 0) { this.spawnBeachRock(); this.beachT = 2.2; }
      if (this.aimDeg !== null) this.setAim(this.aimDeg);
    }
    for (const b of this.beach) { b.t += dt; const k = Math.min(1, b.t * 3); b.mesh.scale.setScalar(1 - Math.pow(1 - k, 3)); }
    if (!(play && this.practice)) this.updateCows(dt, play);
    if (this.handMesh) { this.handMesh.rotation.y += dt * 0.6; this.handMesh.position.y = -0.46 + Math.sin(this.world.time * 3) * 0.012; }
    this.ui.frame(this);
  }
  updateLevel() {
    const lv = 1 + Math.floor(this.kills / 5) + Math.floor(this.time / 75);
    if (lv !== this.level) { this.level = lv; this.ui.msg('WAVE ' + lv + '!', this.world.W / 2, this.world.H * 0.2, { color: '#ffd84d', size: 32, life: 2 }); SFX.wave(); this.ui.hud(this); }
  }
  updateCows(dt, canFire) {
    for (const c of this.cows) {
      c.t += dt; c.hitT = Math.max(0, c.hitT - dt);
      if (c.dead) {
        c.vy -= 9.8 * dt; c.y += c.vy * dt; c.rot += c.dir * 4 * dt; c.x += c.vx * 0.3 * dt;
        c.parts.root.rotation.z = c.rot;
        if (c.y <= 0) { c.gone = true; this.fx.splash(c.x, c.z, 2.2); SFX.plunk(); }
      } else {
        c.x += c.vx * dt; c.y = c.y0 + Math.sin(c.t * 2.2 + c.bob) * 0.15;
        if (c.x * c.dir > c.half + 1) c.gone = true;
        const onScreen = Math.abs(c.x - this.world.camX) < this.world.halfWidthAt(c.z) * 0.9;
        if (onScreen && canFire) {
          c.fire -= dt; c.charge = c.fire < 1.0 ? 1 - c.fire / 1.0 : 0;
          if (c.fire <= 0) { this.fireBlast(c); c.fire = Math.max(2.0, 5.0 - 0.25 * (this.level - 1)) * rand(0.8, 1.25); c.charge = 0; }
        }
      }
      c.parts.root.position.set(c.x, c.y, c.z);
      c.parts.shadow.position.set(c.x, 0.17, c.z); const ss = clamp(1 - c.y * 0.12, 0.5, 1) * c.T.scale; c.parts.shadow.scale.setScalar(ss); c.parts.shadow.visible = !c.dead || c.y > 0.3;
      this.cowFactory.animate(c.parts, c, dt);
      if (c.gone) this.removeCow(c);
    }
    this.cows = this.cows.filter((c) => !c.gone);
    this.spawnT -= dt;
    const maxC = canFire ? Math.min(4, 1 + Math.floor((this.level - 1) / 2)) : 2;
    if (this.cows.filter((c) => !c.dead).length < maxC && this.spawnT <= 0) { this.spawnCow(); this.spawnT = rand(1.2, 2.8); }
  }
  updateBlasts(dt) {
    const ty = CAM_Y - 0.25, tz = CAM_Z - 0.25;
    for (const b of this.blasts) {
      b.t += dt; const e = Math.min(1, b.t / b.dur), ee = e * e * 0.5 + e * 0.5;
      const g = b.mesh.group;
      g.position.set(lerp(b.x0, b.tx, ee), lerp(b.y0, ty, ee), lerp(b.z0, tz, ee));
      b.mesh.trail.forEach((tm, i) => { const el = Math.max(0, e - (i + 1) * 0.045), eel = el * el * 0.5 + el * 0.5; tm.position.set(lerp(b.x0, b.tx, eel) - g.position.x, lerp(b.y0, ty, eel) - g.position.y, lerp(b.z0, tz, eel) - g.position.z); });
      if (e >= 1) {
        b.done = true; this.fx.removeBlast(b.mesh);
        if (Math.abs(this.world.camX - b.tx) < 0.7) this.milkHit();
        else { this.score += 25; this.ui.msg('DODGED! +25', this.world.W / 2, this.world.H * 0.36, { color: '#bff7d0', size: 16 }); this.ui.hud(this); }
      }
    }
    this.blasts = this.blasts.filter((b) => !b.done);
  }
  updateRocks(dt) {
    for (const r of this.rocks) {
      if (r.done) continue;
      r.vy -= ROCK_G * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      r.mesh.position.set(r.x, r.y, r.z); r.mesh.rotation.y += r.spin * dt; r.mesh.rotation.z = Math.sin(r.mesh.rotation.y * 0.3) * 0.2;
      const ground = r.z > SHORE_Z ? sandY(r.z) : 0;
      if (r.y <= ground && r.vy < 0) {
        const p = this.world.project(r.mesh.position);
        if (r.z > SHORE_Z) { r.done = true; this.fx.splash(r.x, r.z, 0.6, false); SFX.sand(); }
        else if (r.skipsLeft > 0 && r.z > -45) {
          r.skipsLeft--; r.skips++; r.y = 0;
          r.vy = -r.vy * (0.55 + 0.35 * r.rock.flat); if (r.vy < 1.2) r.vy = 1.2;
          r.vz *= 0.86; r.vx *= 0.9;
          this.fx.splash(r.x, r.z, 0.5 + r.rock.size * 0.5); this.score += 5; SFX.skip();
          this.ui.msg('SKIP x' + r.skips, p.x, p.y - 18, { color: '#e9fbff', size: 13, life: 0.7 });
        } else {
          r.done = true; this.fx.splash(r.x, r.z, 0.9 + r.rock.size * 0.6); SFX.plunk();
          if (r.skips > 0) {
            const b = r.skips * r.skips * 5; this.score += b;
            this.ui.msg(r.skips + ' SKIPS! +' + b, clamp(p.x, 80, this.world.W - 80), p.y - 30, { color: '#ffd84d', size: 17 });
            if (r.skips > this.bestChain) { this.bestChain = r.skips; if (this.practice) this.ui.msg('NEW BEST CHAIN!', this.world.W / 2, this.world.H * 0.22, { color: '#ffd84d', size: 22, life: 1.6 }); }
          }
        }
        this.ui.hud(this);
      }
      if (r.z < -50 || r.y < -1) r.done = true;
      if (!r.done) for (const c of this.cows) {
        if (c.dead) continue; const s = c.T.scale;
        if (Math.abs(c.z - r.z) < 1.6 * s && Math.abs(c.x - r.x) < 1.15 * s && Math.abs(c.y - r.y) < 0.85 * s) { this.hitCow(c, r); break; }
      }
      if (r.done) disposeMesh(r.mesh);
    }
    this.rocks = this.rocks.filter((r) => !r.done);
  }
}
