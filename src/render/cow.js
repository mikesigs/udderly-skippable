// Flying cows: a toon-shaded model built from primitives, with spot textures and per-type variations.
import * as THREE from 'three';
import { rand } from '../game/rocks.js';

export const COW_TYPES = {
  cow:  { scale: 1.0,  hp: 1.0, speed: 1.0,  voice: 'cow',  body: '#ffffff', spots: '#262626', weight: 6 },
  bull: { scale: 1.22, hp: 1.7, speed: 0.82, voice: 'bull', body: '#f7ecd8', spots: '#5b3a22', weight: 2 },
  calf: { scale: 0.74, hp: 0.7, speed: 1.35, voice: 'calf', body: '#ffffff', spots: '#3a2a20', weight: 2 },
  old:  { scale: 1.0,  hp: 1.0, speed: 0.9,  voice: 'old',  body: '#e6e6e6', spots: '#4a4a4a', weight: 1 },
};

function spotTexture(bodyHex, spotHex, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bodyHex; g.fillRect(0, 0, 256, 256);
  g.fillStyle = spotHex;
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 256, y = rnd() * 256, rx = 18 + rnd() * 30, ry = 14 + rnd() * 26;
    g.beginPath(); g.ellipse(x, y, rx, ry, rnd() * 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + rx * 0.6, y + ry * 0.3, rx * 0.6, ry * 0.7, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wingGeometry() {
  const sh = new THREE.Shape();
  const pts = [[-0.2, 0], [0.2, 0.05], [0.42, 0.28], [0.5, 0.8], [0.36, 1.02], [0.22, 0.88], [0.1, 1.08], [-0.04, 0.9], [-0.18, 1.04], [-0.3, 0.84], [-0.42, 0.95], [-0.46, 0.5], [-0.38, 0.12]];
  sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const g = new THREE.ShapeGeometry(sh, 6);
  g.rotateX(Math.PI / 2); // lies flat, extends toward +z
  return g;
}

export class CowFactory {
  constructor(gradient) {
    this.gradient = gradient;
    this.geo = {
      body: new THREE.CapsuleGeometry(0.42, 0.85, 6, 14).rotateZ(Math.PI / 2),
      head: new THREE.SphereGeometry(0.3, 16, 12),
      snout: new THREE.SphereGeometry(0.2, 14, 10),
      eye: new THREE.SphereGeometry(0.055, 8, 6),
      pupil: new THREE.SphereGeometry(0.03, 6, 5),
      ear: new THREE.SphereGeometry(0.1, 8, 6),
      horn: new THREE.ConeGeometry(0.05, 0.22, 6),
      leg: new THREE.CylinderGeometry(0.07, 0.06, 0.42, 7),
      hoof: new THREE.CylinderGeometry(0.075, 0.075, 0.09, 7),
      udder: new THREE.SphereGeometry(0.27, 14, 10),
      teat: new THREE.CylinderGeometry(0.035, 0.03, 0.12, 6),
      tail: new THREE.CylinderGeometry(0.025, 0.035, 0.5, 5),
      tuft: new THREE.SphereGeometry(0.075, 8, 6),
      wing: wingGeometry(),
      nostril: new THREE.SphereGeometry(0.025, 6, 5),
    };
    this.mats = {
      pink: this.toon('#ff9ec4'), black: this.toon('#262626'), horn: this.toon('#f5e6b8'), white: this.toon('#ffffff'),
      wing: this.toon('#ffffff', { side: THREE.DoubleSide }), eyeWhite: this.toon('#ffffff'),
    };
    this.spotTex = {};
    for (const [k, t] of Object.entries(COW_TYPES)) this.spotTex[k] = [0, 1, 2].map((i) => spotTexture(t.body, t.spots, 17 + i * 31 + k.length * 7));
    this.shadowGeo = new THREE.CircleGeometry(0.8, 20).rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x062c45, transparent: true, opacity: 0.22, depthWrite: false });
  }
  toon(color, extra = {}) { const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: this.gradient }, extra)); m.userData.shared = true; return m; }

  make(type = 'cow') {
    const T = COW_TYPES[type] || COW_TYPES.cow, G = this.geo, M = this.mats;
    const root = new THREE.Group();
    const g = new THREE.Group(); root.add(g);
    const bodyMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: this.spotTex[type][Math.floor(Math.random() * 3)], gradientMap: this.gradient, emissive: new THREE.Color('#ff3b3b'), emissiveIntensity: 0 });
    const body = new THREE.Mesh(G.body, bodyMat); body.castShadow = true; g.add(body);

    const headG = new THREE.Group(); headG.position.set(0.72, 0.1, 0); g.add(headG);
    const head = new THREE.Mesh(G.head, bodyMat); head.scale.set(1.1, 1, 0.95); headG.add(head);
    const snout = new THREE.Mesh(G.snout, M.pink); snout.position.set(0.24, -0.08, 0); snout.scale.set(0.95, 0.72, 1); headG.add(snout);
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(G.nostril, M.black); n.position.set(0.42, -0.05, s * 0.07); headG.add(n);
      const e = new THREE.Mesh(G.eye, M.eyeWhite); e.position.set(0.17, 0.12, s * 0.22); headG.add(e);
      const p = new THREE.Mesh(G.pupil, M.black); p.position.set(0.21, 0.12, s * 0.25); headG.add(p);
      const ear = new THREE.Mesh(G.ear, M.pink); ear.position.set(-0.06, 0.16, s * 0.32); ear.scale.set(1.4, 0.6, 0.9); headG.add(ear);
      const horn = new THREE.Mesh(G.horn, M.horn); horn.position.set(-0.02, 0.36, s * 0.16); horn.rotation.z = -0.25; horn.rotation.x = s * 0.5; headG.add(horn);
    }
    const legs = [];
    [[0.32, 0.2], [0.32, -0.2], [-0.3, 0.2], [-0.3, -0.2]].forEach(([x, z]) => {
      const hip = new THREE.Group(); hip.position.set(x, -0.3, z); g.add(hip);
      const leg = new THREE.Mesh(G.leg, M.white); leg.position.y = -0.21; hip.add(leg);
      const hoof = new THREE.Mesh(G.hoof, M.black); hoof.position.y = -0.46; hip.add(hoof);
      legs.push(hip);
    });
    const udderMat = new THREE.MeshToonMaterial({ color: new THREE.Color('#ff9ec4'), gradientMap: this.gradient, emissive: new THREE.Color('#ffd0e8'), emissiveIntensity: 0 });
    const udderG = new THREE.Group(); udderG.position.set(-0.08, -0.4, 0); g.add(udderG);
    const udder = new THREE.Mesh(G.udder, udderMat); udder.scale.set(1, 0.78, 1); udderG.add(udder);
    [[0.1, 0.1], [0.1, -0.1], [-0.1, 0.1], [-0.1, -0.1]].forEach(([x, z]) => { const t = new THREE.Mesh(G.teat, udderMat); t.position.set(x, -0.2, z); udderG.add(t); });
    const tail = new THREE.Mesh(G.tail, M.white); tail.position.set(-0.78, 0.0, 0); tail.rotation.z = 0.6; g.add(tail);
    const tuft = new THREE.Mesh(G.tuft, M.black); tuft.position.set(-0.98, -0.2, 0); g.add(tuft);
    const wingR = new THREE.Group(); wingR.position.set(0.0, 0.34, 0.3); g.add(wingR);
    const wR = new THREE.Mesh(G.wing, M.wing); wR.scale.setScalar(0.85); wingR.add(wR);
    const wingL = new THREE.Group(); wingL.position.set(0.0, 0.34, -0.3); g.add(wingL);
    const wL = new THREE.Mesh(G.wing, M.wing); wL.scale.set(0.85, 0.85, -0.85); wingL.add(wL);

    root.scale.setScalar(T.scale * 0.95);
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.scale.setScalar(T.scale);
    return { root, inner: g, headG, legs, udderG, udderMat, bodyMat, wingL, wingR, tail, shadow, type: T };
  }

  animate(parts, c, dt) {
    const t = c.t;
    const flap = Math.sin(t * 15) * 0.55;
    parts.wingR.rotation.x = -(0.2 + flap);
    parts.wingL.rotation.x = (0.2 + flap);
    parts.legs.forEach((hip, i) => { hip.rotation.z = Math.sin(t * 6 + i * 1.3) * 0.18; });
    parts.headG.rotation.z = Math.sin(t * 2.2) * 0.06 + (c.charge > 0 ? -0.15 * c.charge : 0);
    parts.tail.rotation.x = Math.sin(t * 7) * 0.35;
    parts.inner.position.y = Math.sin(t * 15) * 0.02;
    const u = 1 + 0.45 * c.charge;
    parts.udderG.scale.set(u, u, u);
    parts.udderMat.emissiveIntensity = c.charge * 1.2;
    parts.bodyMat.emissiveIntensity = c.hitT > 0 ? 0.9 : 0;
  }
}
