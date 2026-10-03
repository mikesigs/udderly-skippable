// Pointer gestures: flicks inside the ring throw, sideways swipes outside step, taps pick rocks.
import { clamp } from './rocks.js';
import { AIM_MAX } from './game.js';

export class Input {
  constructor(canvas, world, game, ui) {
    this.canvas = canvas; this.world = world; this.game = game; this.ui = ui; this.ptr = null;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', () => { this.ptr = null; this.game.setAim(null); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  ringR() { return Math.max(64, this.world.W * 0.2); }
  handScreen() { return this.world.project(this.game.handWorld()); }
  pos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  inZone(x, y) { const h = this.handScreen(); return Math.hypot(x - h.x, y - h.y) < this.ringR(); }

  down(e) {
    if (this.game.mode !== 'play' || this.ptr) return;
    const p = this.pos(e), t = performance.now();
    this.ptr = { id: e.pointerId, x0: p.x, y0: p.y, t0: t, hist: [{ x: p.x, y: p.y, t }], zone: this.inZone(p.x, p.y) };
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  move(e) {
    const P = this.ptr; if (!P || e.pointerId !== P.id) return;
    const p = this.pos(e); P.hist.push({ x: p.x, y: p.y, t: performance.now() }); if (P.hist.length > 40) P.hist.shift();
    const dx = p.x - P.x0, dy = p.y - P.y0;
    if (P.zone && Math.hypot(dx, dy) > 16) this.game.setAim(clamp(Math.atan2(dx, -dy) * 180 / Math.PI, -AIM_MAX, AIM_MAX));
  }
  up(e) {
    const P = this.ptr; if (!P || e.pointerId !== P.id) return;
    const p = this.pos(e), t = performance.now(); P.hist.push({ x: p.x, y: p.y, t });
    const dx = p.x - P.x0, dy = p.y - P.y0, dist = Math.hypot(dx, dy);
    this.ptr = null; this.game.setAim(null);
    if (dist < 20) {
      if (!this.game.pickAt(P.x0, P.y0)) {
        if (this.game.pocket.length) this.ui.msg('FLICK FROM THE ROCK TO THROW', this.world.W / 2, this.world.H * 0.5, { size: 14 });
        else this.ui.msg('POCKET EMPTY! TAP ROCKS ON THE BEACH', this.world.W / 2, this.world.H * 0.5, { size: 14, color: '#ffd166' });
      }
      return;
    }
    if (P.zone) {
      const h = P.hist, last = h[h.length - 1]; let j = h.length - 1; while (j > 0 && last.t - h[j - 1].t < 120) j--;
      const a = h[j], vWin = Math.hypot(last.x - a.x, last.y - a.y) / Math.max(16, last.t - a.t);
      const vAll = dist / Math.max(16, t - P.t0);
      this.game.throwRock(Math.max(vWin, vAll), Math.atan2(dx, -dy) * 180 / Math.PI);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      this.game.dodge(Math.sign(dx));
    } else if (dy < 0) {
      if (!this.game.pickAt(P.x0, P.y0)) this.ui.msg('START YOUR FLICK ON THE ROCK', this.world.W / 2, this.world.H * 0.5, { size: 14, color: '#ffd166' });
    }
  }
}
