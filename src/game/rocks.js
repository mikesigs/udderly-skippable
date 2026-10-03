// Rock model: physical stats that drive skipping, plus a 2D icon painter for the pocket bar.
export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

const ROCK_HUES = [[210, 8, 58], [35, 14, 60], [205, 12, 50], [30, 12, 52], [215, 14, 44], [40, 16, 66], [20, 12, 48], [150, 7, 55], [330, 10, 55]];

export function makeRock() {
  const flat = Math.pow(Math.random(), 1.35);
  const size = rand(0.3, 1);
  const thick = 1.35 - flat;
  const weight = size * size * thick * 2.2;
  const [h, s, l] = ROCK_HUES[Math.floor(Math.random() * ROCK_HUES.length)];
  const jag = (1 - flat) * 0.3;
  const n = 16, pts = [];
  for (let i = 0; i < n; i++) pts.push(1 + (Math.random() - 0.5) * 2 * jag);
  const aspect = 1 + Math.random() * 0.55;
  const sizeFac = clamp(1 - Math.abs(size - 0.58) * 1.6, 0.25, 1);
  const weightFac = clamp(1 - Math.abs(weight - 0.7) * 0.7, 0.25, 1);
  const pot = flat * sizeFac * weightFac;
  return { id: Math.random().toString(36).slice(2, 9), flat, size, thick, weight, h, s, l: l + Math.round(rand(-5, 5)), pts, aspect, pot, seed: Math.random() * 1000, rot: rand(0, TAU) };
}

export function rockLabel(r) {
  return { circ: Math.round(TAU * (2.5 + r.size * 5.5)), g: Math.round(r.weight * 180), stars: 1 + Math.round(r.pot * 4) };
}

export function rockVerdict(r) {
  const p = r.pot;
  return p > 0.8 ? 'FLAT AS A PANCAKE!' : p > 0.55 ? 'GOOD SKIPPER' : p > 0.3 ? "MEH. IT'LL DO" : 'ROUND AS A POTATO';
}

export function rockColor(r, dl = 0) {
  return `hsl(${r.h} ${r.s}% ${clamp(r.l + dl, 4, 96)}%)`;
}

// Paints a top-down rock icon into a 2D canvas context.
export function drawRockIcon(ctx, x, y, r, rock, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const rx = r * rock.aspect, ry = r, n = rock.pts.length;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const i0 = i % n, i1 = (i + 1) % n, a0 = i0 / n * TAU, a1 = i1 / n * TAU;
    const p0x = Math.cos(a0) * rx * rock.pts[i0], p0y = Math.sin(a0) * ry * rock.pts[i0];
    const p1x = Math.cos(a1) * rx * rock.pts[i1], p1y = Math.sin(a1) * ry * rock.pts[i1];
    const mx = (p0x + p1x) / 2, my = (p0y + p1y) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p0x, p0y, mx, my);
  }
  ctx.closePath();
  const dome = 1 - rock.flat;
  const g = ctx.createRadialGradient(-rx * (0.1 + 0.35 * dome), -ry * (0.1 + 0.4 * dome), r * 0.1, 0, 0, r * 1.25);
  g.addColorStop(0, rockColor(rock, 12 + dome * 22));
  g.addColorStop(0.55, rockColor(rock, 0));
  g.addColorStop(1, rockColor(rock, -10 - dome * 22));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = rockColor(rock, -30); ctx.stroke();
  ctx.restore();
}
