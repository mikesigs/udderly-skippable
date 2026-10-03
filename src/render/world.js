// The 3D lakeshore: renderer, camera, sky, sun, water, beach, forest, mountains and clouds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand, clamp } from '../game/rocks.js';

export const SHORE_Z = -1.5;
export const CAM_Z = 2.6;
export const CAM_Y = 1.9;
export const CAM_PITCH = -16 * Math.PI / 180;
export const sandY = (z) => Math.max(0, z - SHORE_Z) * 0.045;

export function toonGradient(steps = [0.3, 0.62, 1.0]) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255); data[i * 4 + 3] = 255; });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
uniform vec3 uTop, uHorizon, uSunDir, uSunColor; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.38));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (smoothstep(0.9985, 0.9992, s) * 1.6 + pow(s, 10.0) * 0.28 + pow(s, 2.0) * 0.06);
  col = mix(col, uHorizon * vec3(1.02, 0.98, 0.95), smoothstep(0.12, 0.0, h) * 0.5);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VERT = `
uniform float uTime, uShoreZ; varying vec3 vWorld; varying vec3 vNormal;
void wave(vec2 p, out float h, out vec2 g){
  float t = uTime;
  vec2 d1 = normalize(vec2(0.8, 0.6)), d2 = normalize(vec2(-0.5, 0.9)), d3 = normalize(vec2(0.2, -1.0)), d4 = normalize(vec2(1.0, 0.1));
  float a1 = 0.065, a2 = 0.045, a3 = 0.025, a4 = 0.02;
  float k1 = 0.9, k2 = 1.6, k3 = 3.1, k4 = 5.0; float w1 = 1.1, w2 = 1.6, w3 = 2.4, w4 = 3.3;
  float p1 = dot(d1, p) * k1 + t * w1, p2 = dot(d2, p) * k2 + t * w2, p3 = dot(d3, p) * k3 + t * w3, p4 = dot(d4, p) * k4 + t * w4;
  h = a1 * sin(p1) + a2 * sin(p2) + a3 * sin(p3) + a4 * sin(p4);
  g = a1 * k1 * cos(p1) * d1 + a2 * k2 * cos(p2) * d2 + a3 * k3 * cos(p3) * d3 + a4 * k4 * cos(p4) * d4;
}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h; vec2 g; wave(wp.xz, h, g);
  float calm = smoothstep(0.0, 6.0, uShoreZ - wp.z);
  h *= calm; g *= calm;
  wp.y += h; vWorld = wp.xyz; vNormal = normalize(vec3(-g.x, 1.0, -g.y));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FRAG = `
uniform vec3 uDeep, uShallow, uSkyRef, uSunDir, uSunColor, uFoam, uHaze, uCamPos; uniform float uTime, uShoreZ;
varying vec3 vWorld; varying vec3 vNormal;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 n = normalize(vNormal); vec3 v = normalize(uCamPos - vWorld);
  float dist = length(uCamPos.xz - vWorld.xz);
  vec3 base = mix(uShallow, uDeep, smoothstep(2.0, 30.0, dist));
  float fres = pow(1.0 - max(dot(v, n), 0.0), 4.0);
  vec3 col = mix(base, uSkyRef, fres * 0.45);
  vec3 r = reflect(-uSunDir, n); float sp = pow(max(dot(r, v), 0.0), 160.0); col += uSunColor * sp * 1.6;
  vec2 sp2 = vWorld.xz * 9.0 + vec2(uTime * 0.5, uTime * 0.15); vec2 cell = floor(sp2); float sk = hash(cell);
  float dcen = length(fract(sp2) - 0.5);
  float tw = step(0.975, sk) * pow(max(sin(uTime * 5.0 + sk * 80.0), 0.0), 8.0) * smoothstep(0.32, 0.05, dcen);
  col += uSunColor * tw * 1.4 * smoothstep(70.0, 6.0, dist);
  float shore = smoothstep(1.0, 0.0, uShoreZ - vWorld.z);
  float line = sin(vWorld.x * 2.6 + uTime * 1.8 + sin(vWorld.x * 0.7) * 2.0) * 0.5 + 0.5;
  col = mix(col, uFoam, shore * shore * shore * (0.15 + 0.3 * line));
  col = mix(col, uHaze, smoothstep(70.0, 300.0, dist) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class World {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = Object.assign({ shadows: true, sharp: false }, opts);
    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.sharp ? 2 : 1.5));
    renderer.shadowMap.enabled = this.opts.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color('#cfe6f7'), 90, 330);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 420);
    this.camera.position.set(0, CAM_Y, CAM_Z); this.camera.rotation.x = CAM_PITCH;
    this.camX = 0; this.shake = 0; this.sway = 0; this.lean = 0;
    this.gradient = toonGradient();
    this.sunDir = new THREE.Vector3(0.45, 0.5, -0.74).normalize();
    this.time = 0;

    this.buildLights(); this.buildSky(); this.buildWater(); this.buildBeach(); this.buildFarShore(); this.buildClouds(); this.buildLanes();
    this.resize();
  }

  toon(color, extra = {}) { return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: this.gradient }, extra)); }

  buildLights() {
    const hemi = new THREE.HemisphereLight(new THREE.Color('#cfe4ff'), new THREE.Color('#d9b985'), 0.75);
    this.scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight(new THREE.Color('#fff1d2'), 2.3);
    sun.position.copy(this.sunDir).multiplyScalar(90); sun.target.position.set(0, 0, -6);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera; c.left = -16; c.right = 16; c.top = 16; c.bottom = -16; c.near = 30; c.far = 170;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    this.scene.add(sun, sun.target);
  }

  buildSky() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
      uniforms: { uTop: { value: new THREE.Color('#1d6fd8') }, uHorizon: { value: new THREE.Color('#cfeaff') }, uSunDir: { value: this.sunDir }, uSunColor: { value: new THREE.Color('#fff2c4') } },
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), mat);
    this.scene.add(sky);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(420, 280, 150, 100);
    geo.rotateX(-Math.PI / 2);
    this.waterUniforms = {
      uTime: { value: 0 }, uShoreZ: { value: SHORE_Z }, uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: this.sunDir },
      uDeep: { value: new THREE.Color('#0a5f96') }, uShallow: { value: new THREE.Color('#1fb4b8') }, uSkyRef: { value: new THREE.Color('#8fd0ff') },
      uSunColor: { value: new THREE.Color('#fff3c8') }, uFoam: { value: new THREE.Color('#ffffff') }, uHaze: { value: new THREE.Color('#cfe6f7') },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: this.waterUniforms });
    const water = this.water = new THREE.Mesh(geo, mat);
    water.position.set(0, -0.01, SHORE_Z - 140);
    this.scene.add(water);
  }

  buildBeach() {
    const W = 70, D = 16, segZ = 24;
    const geo = new THREE.PlaneGeometry(W, D, 28, segZ); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const dry = new THREE.Color('#f3dca8'), wet = new THREE.Color('#c9a773'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) + (SHORE_Z + D / 2);
      pos.setY(i, sandY(z));
      const wetness = clamp(1 - (z - SHORE_Z) / 1.4, 0, 1);
      c.copy(dry).lerp(wet, wetness * wetness);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const beach = new THREE.Mesh(geo, this.toon(0xffffff, { vertexColors: true }));
    beach.position.z = SHORE_Z + D / 2; beach.receiveShadow = true;
    this.scene.add(beach);

    const pebGeo = new THREE.DodecahedronGeometry(1, 0);
    const pebbles = new THREE.InstancedMesh(pebGeo, this.toon(0xffffff), 260);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < 260; i++) {
      const x = rand(-9, 9), z = rand(SHORE_Z + 0.1, 6), sc = rand(0.025, 0.08);
      p.set(x, sandY(z) + sc * 0.5, z); e.set(rand(0, 6), rand(0, 6), rand(0, 6)); q.setFromEuler(e); s.set(sc * rand(0.8, 1.4), sc * rand(0.5, 0.9), sc);
      m.compose(p, q, s); pebbles.setMatrixAt(i, m);
      pebbles.setColorAt(i, new THREE.Color().setHSL(rand(0.05, 0.6), rand(0.05, 0.2), rand(0.4, 0.75)));
    }
    pebbles.instanceMatrix.needsUpdate = true; pebbles.receiveShadow = true;
    this.scene.add(pebbles);
  }

  buildFarShore() {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(520, 6, 70), this.toon('#3f8a4e'));
    ground.position.set(0, -2.6, -130); this.scene.add(ground);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(520, 3, 6), this.toon('#c9b07e'));
    bank.position.set(0, -1.2, -96); this.scene.add(bank);

    // pine geometry: trunk + two cones, merged
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 0.8, 5); trunk.translate(0, 0.4, 0);
    const c1 = new THREE.ConeGeometry(1.1, 2.2, 6); c1.translate(0, 1.7, 0);
    const c2 = new THREE.ConeGeometry(0.8, 1.8, 6); c2.translate(0, 2.9, 0);
    const pine = mergeGeometries([trunk, c1, c2], false);
    const trees = new THREE.InstancedMesh(pine, this.toon(0xffffff), 1100);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    let i = 0;
    const place = (x, y, z, sc) => { if (i >= 1100) return; p.set(x, y, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6)); s.set(sc, sc * rand(0.9, 1.4), sc); m.compose(p, q, s); trees.setMatrixAt(i, m); col.setHSL(rand(0.3, 0.42), rand(0.45, 0.7), rand(0.22, 0.4)); trees.setColorAt(i, col); i++; };
    for (let k = 0; k < 760; k++) place(rand(-240, 240), 0.4, rand(-98, -128), rand(1.6, 3.2));
    // side banks framing the lake
    for (let k = 0; k < 170; k++) { const side = k % 2 ? 1 : -1; const z = rand(-10, -80); const spread = 14 + (-z) * 0.22; place(side * rand(spread, spread + 16), 0.1, z, rand(1.2, 2.6)); }
    for (let k = 0; k < 170; k++) { const side = k % 2 ? 1 : -1; place(side * rand(12, 40), sandY(6) + 0.2, rand(-2, 10), rand(1.0, 2.2)); }
    trees.count = i; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
    this.scene.add(trees);

    const sideGround = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 110), this.toon('#4a9456'));
    sideGround.position.set(-44, -1.9, -40); this.scene.add(sideGround);
    const sideGround2 = sideGround.clone(); sideGround2.position.x = 44; this.scene.add(sideGround2);

    const mtnMat = this.toon('#8fb0d6'), snowMat = this.toon('#f4f8ff');
    for (let k = 0; k < 11; k++) {
      const h = rand(26, 52), r = rand(28, 56), x = -230 + k * 46 + rand(-10, 10), z = rand(-190, -240);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mtnMat); cone.position.set(x, h / 2 - 3, z); this.scene.add(cone);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, h * 0.28, 7), snowMat); cap.position.set(x, h - 3 - h * 0.14 + 0.01, z); this.scene.add(cap);
    }
  }

  buildClouds() {
    this.clouds = [];
    const mat = this.toon('#ffffff', { emissive: new THREE.Color('#2a3a55'), emissiveIntensity: 0.25 });
    for (let k = 0; k < 9; k++) {
      const parts = [];
      const n = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < n; j++) { const g = new THREE.SphereGeometry(rand(3, 6.5), 10, 8); g.translate(j * rand(3, 5) - n * 2, rand(-0.8, 1.6), rand(-1.5, 1.5)); parts.push(g); }
      const geo = mergeGeometries(parts, false);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(rand(-220, 220), rand(40, 75), rand(-200, -300)); mesh.scale.setScalar(rand(0.7, 1.5));
      this.scene.add(mesh); this.clouds.push({ mesh, v: rand(0.6, 1.6) });
    }
  }

  buildLanes() {
    this.lanes = [];
    const geo = new THREE.RingGeometry(0.42, 0.55, 40).rotateX(-Math.PI / 2);
    for (const x of [-1.4, 0, 1.4]) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
      m.position.set(x, sandY(SHORE_Z + 1.1) + 0.015, SHORE_Z + 1.1); m.renderOrder = 2;
      this.scene.add(m); this.lanes.push(m);
    }
  }
  setLanes(active, visible) {
    if (!this.lanes) return;
    this.lanes.forEach((m, i) => { const x = [-1.4, 0, 1.4][i]; m.visible = visible; m.material.opacity = Math.abs(x - active) < 0.1 ? 0.75 : 0.22; m.material.color.set(Math.abs(x - active) < 0.1 ? '#ffe066' : '#ffffff'); });
  }
  setQuality({ shadows, sharp }) {
    if (shadows !== undefined && shadows !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
    }
    if (sharp !== undefined) { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, sharp ? 2 : 1.5)); this.resize(); }
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.W = w; this.H = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 70 : 58;
    this.camera.updateProjectionMatrix();
    const vfov = this.camera.fov * Math.PI / 180;
    this.hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
  }

  halfWidthAt(z) { return (CAM_Z - z) * Math.tan(this.hfov / 2); }

  update(dt, attract = false) {
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;
    for (const c of this.clouds) { c.mesh.position.x += c.v * dt; if (c.mesh.position.x > 230) c.mesh.position.x = -230; }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.12 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.08 : 0;
    const swayX = attract ? Math.sin(this.time * 0.35) * 0.6 : 0;
    const bobY = Math.sin(this.time * 1.7) * 0.012;
    this.camera.position.set(this.camX + sx + swayX, CAM_Y + bobY + sy, CAM_Z);
    this.camera.rotation.set(CAM_PITCH + sy * 0.4, 0, this.lean, 'YXZ');
    this.waterUniforms.uCamPos.value.copy(this.camera.position);
    this.sun.position.set(this.camX + this.sunDir.x * 90, this.sunDir.y * 90, this.sunDir.z * 90);
    this.sun.target.position.set(this.camX, 0, -6);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  project(v3, out = { x: 0, y: 0, z: 0 }) {
    const v = v3.clone().project(this.camera);
    out.x = (v.x + 1) / 2 * this.W; out.y = (1 - v.y) / 2 * this.H; out.z = v.z; return out;
  }
}
