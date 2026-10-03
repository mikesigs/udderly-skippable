// Builds a faceted 3D rock from the rock's stats: flat rocks are thin discs, round ones are lumpy spheres.
import * as THREE from 'three';
import { rockColor } from '../game/rocks.js';

function hashNoise(x, y, z, seed) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
  return s - Math.floor(s);
}

export function rockRadius(rock) { return 0.045 + 0.105 * rock.size; }

export function makeRockMesh(rock, gradient) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  const jag = (1 - rock.flat) * 0.22 + 0.04;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = hashNoise(Math.round(v.x * 50) / 50, Math.round(v.y * 50) / 50, Math.round(v.z * 50) / 50, rock.seed);
    v.multiplyScalar(1 + (n - 0.5) * 2 * jag);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const r = rockRadius(rock);
  geo.scale(r * rock.aspect, r * (0.26 + 0.74 * (1 - rock.flat)), r);
  geo.computeVertexNormals();
  const mat = new THREE.MeshToonMaterial({ color: new THREE.Color(`hsl(${rock.h} ${Math.min(60, rock.s + 18)}% ${Math.max(8, rock.l - 30)}%)`), gradientMap: gradient });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.rock = rock;
  return mesh;
}

export function disposeMesh(mesh) {
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.geometry && mesh.geometry.dispose();
  if (mesh.material && !mesh.material.userData.shared) mesh.material.dispose();
}
