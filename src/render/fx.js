// Particles and transient meshes: splash rings, droplets, sand puffs, milk blasts, aim guide.
import * as THREE from 'three';
import { rand } from '../game/rocks.js';

export class FX {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.ringGeo = new THREE.RingGeometry(0.75, 1, 36).rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xd9bf8a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.dropGeo = new THREE.SphereGeometry(0.035, 6, 5);
    this.dropMat = new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.95 });
    this.milkMat = new THREE.MeshToonMaterial({ color: 0xffffff, emissive: new THREE.Color('#dfe9ff'), emissiveIntensity: 0.35 });
    this.milkGeo = new THREE.SphereGeometry(0.23, 16, 12);
    this.trailGeo = new THREE.SphereGeometry(0.1, 10, 8);
    this.trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    this.starGeo = new THREE.OctahedronGeometry(0.09, 0);
    this.starMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.aimDots = []; const dotGeo = new THREE.SphereGeometry(1, 10, 8), dotMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthTest: false });
    for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(dotGeo, dotMat); d.visible = false; d.renderOrder = 5; scene.add(d); this.aimDots.push(d); }
  }

  splash(x, z, size = 1, water = true) {
    const ring = new THREE.Mesh(this.ringGeo, water ? this.ringMat.clone() : this.dustMat.clone());
    ring.position.set(x, water ? 0.1 : 0.03, z); ring.scale.setScalar(0.15 * size);
    this.scene.add(ring);
    this.items.push({ kind: 'ring', mesh: ring, t: 0, life: 0.7, size });
    const n = water ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(this.dropGeo, water ? this.dropMat : this.dustMat);
      d.position.set(x, 0.1, z); d.scale.setScalar(rand(0.6, 1.4) * Math.sqrt(size));
      this.scene.add(d);
      this.items.push({ kind: 'drop', mesh: d, t: 0, life: rand(0.45, 0.75), vx: rand(-1.2, 1.2) * size, vy: rand(2.2, 4.0) * Math.sqrt(size), vz: rand(-1.2, 1.2) * size });
    }
  }

  stars(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.starGeo, this.starMat); s.position.copy(pos); this.scene.add(s);
      this.items.push({ kind: 'drop', mesh: s, t: 0, life: rand(0.5, 0.9), vx: rand(-2.5, 2.5), vy: rand(1.5, 4.5), vz: rand(-2.5, 2.5), spin: true });
    }
  }

  makeBlast() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(this.milkGeo, this.milkMat); g.add(core);
    const trail = [];
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(this.trailGeo, this.trailMat); t.scale.setScalar(1 - i * 0.22); g.add(t); trail.push(t); }
    this.scene.add(g);
    return { group: g, core, trail };
  }
  removeBlast(b) { this.scene.remove(b.group); }

  setAim(from, angleRad, visible) {
    this.aimDots.forEach((d) => (d.visible = visible));
    if (!visible) return;
    this.aimDots.forEach((dot, i) => {
      const d = 0.9 + i * 1.25;
      dot.position.set(from.x + Math.sin(angleRad) * d, Math.max(0.15, from.y - d * 0.06), from.z - Math.cos(angleRad) * d);
      dot.scale.setScalar(0.035 + d * 0.012);
    });
  }

  update(dt) {
    for (const it of this.items) {
      it.t += dt; const k = it.t / it.life;
      if (it.kind === 'ring') { it.mesh.scale.setScalar(0.15 * it.size + k * 1.3 * it.size); it.mesh.material.opacity = (1 - k) * 0.9; }
      else {
        it.vy -= 9.8 * dt; it.mesh.position.x += it.vx * dt; it.mesh.position.y += it.vy * dt; it.mesh.position.z += it.vz * dt;
        if (it.spin) { it.mesh.rotation.x += dt * 6; it.mesh.rotation.y += dt * 4; }
        if (it.mesh.position.y < 0.02 && !it.spin) it.t = it.life;
      }
      if (it.t >= it.life) { this.scene.remove(it.mesh); if (it.kind === 'ring') it.mesh.material.dispose(); it.dead = true; }
    }
    this.items = this.items.filter((i) => !i.dead);
  }
}
