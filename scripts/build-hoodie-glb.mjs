/**
 * Procedural claymation hoodie duo → public/characters/hoodie-{male,female}.glb
 * No photo bg, no Meta sample forks — spheres/capsules/boxes only.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blob as NodeBlob } from 'node:buffer';
globalThis.Blob = NodeBlob;
class FR {
  result = null; onload = null; onerror = null; onloadend = null; readyState = 0;
  readAsArrayBuffer(blob) {
    const done = (buf) => {
      this.result = buf; this.readyState = 2;
      const ev = { target: this };
      this.onload?.(ev); this.onloadend?.(ev);
    };
    if (blob instanceof ArrayBuffer) return done(blob);
    if (ArrayBuffer.isView(blob)) return done(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength));
    if (typeof blob?.arrayBuffer === 'function') {
      blob.arrayBuffer().then(done).catch((e) => this.onerror?.(e));
      return;
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(blob)) {
      return done(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength));
    }
    this.onerror?.(new Error('unsupported blob'));
  }
}
globalThis.FileReader = FR;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/characters');
fs.mkdirSync(outDir, { recursive: true });

const C = {
  skin: 0xd4a574,
  hair: 0x3b2a1f,
  hoodie: 0x2c2c2e,
  hoodieDark: 0x1a1a1c,
  shoe: 0xc4a882,
  shoeSole: 0xf0ebe3,
  eye: 0x1a1a1a,
  drawstring: 0xd8d0c4,
};

function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: opts.roughness ?? 0.72,
    metalness: 0,
    flatShading: false,
    ...opts,
  });
}

function add(parent, geo, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Build one chibi hoodie figure. sex: 'male' | 'female'. pointSide: which arm points (+1 = viewer's right of character). */
function buildFigure(sex) {
  const root = new THREE.Group();
  root.name = sex === 'male' ? 'HoodieMale' : 'HoodieFemale';

  const skin = mat(C.skin, { roughness: 0.55 });
  const hairM = mat(C.hair, { roughness: 0.85 });
  const hoodie = mat(C.hoodie, { roughness: 0.8 });
  const hoodieDark = mat(C.hoodieDark, { roughness: 0.85 });
  const shoe = mat(C.shoe, { roughness: 0.7 });
  const sole = mat(C.shoeSole, { roughness: 0.9 });
  const eyeM = mat(C.eye, { roughness: 0.4 });
  const cord = mat(C.drawstring, { roughness: 0.6 });

  // Proportions (meters) — ~0.78 tall chibi
  const torsoY = 0.28;
  const headY = 0.58;

  // Legs (joggers) — same charcoal
  const legGeo = new THREE.CapsuleGeometry(0.045, 0.12, 4, 8);
  add(root, legGeo, hoodie, -0.055, 0.12, 0);
  add(root, legGeo, hoodie, 0.055, 0.12, 0);

  // Feet / sneakers
  const shoeGeo = new THREE.BoxGeometry(0.07, 0.035, 0.11);
  const soleGeo = new THREE.BoxGeometry(0.072, 0.012, 0.115);
  for (const sx of [-0.055, 0.055]) {
    add(root, shoeGeo, shoe, sx, 0.028, 0.02);
    add(root, soleGeo, sole, sx, 0.01, 0.02);
  }

  // Torso hoodie
  const torso = add(root, new THREE.CapsuleGeometry(0.11, 0.14, 6, 12), hoodie, 0, torsoY, 0);
  // Kangaroo pocket
  add(root, new THREE.BoxGeometry(0.14, 0.07, 0.04), hoodieDark, 0, torsoY - 0.02, 0.09);
  // Hood (resting on back/shoulders)
  add(root, new THREE.SphereGeometry(0.09, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hoodieDark, 0, torsoY + 0.12, -0.06, 1, 0.7, 1, 0.4, 0, 0);
  // Drawstrings
  add(root, new THREE.CapsuleGeometry(0.006, 0.06, 2, 6), cord, -0.03, torsoY + 0.08, 0.1);
  add(root, new THREE.CapsuleGeometry(0.006, 0.06, 2, 6), cord, 0.03, torsoY + 0.08, 0.1);

  // Arms — one pointing (raised), one hanging
  // Male points with viewer's-left arm (character's right → toward center when on left)
  // Female points with viewer's-right arm (character's left → toward center when on right)
  const pointLeft = sex === 'male'; // male's left from our +X? In cutout male points with arm toward center (his left / +X side when facing us? Looking at image: male on left points with his right hand? Description said "right arm raised pointing upper right" for male facing slightly right — actually male points toward center (rightward from his position). Female points toward center (leftward).
  // Male at left points rightward → use character's arm on +X (right side of mesh, which faces us as their left? Standard: +X is character's left if facing +Z toward camera... Actually Three.js character facing camera: -Z forward often. We'll face +Z toward camera so +X is character's left.
  // Simpler: male raises arm on +X (toward center when placed left); female raises arm on -X (toward center when placed right).

  const hangArm = new THREE.CapsuleGeometry(0.032, 0.1, 4, 8);
  const pointUpper = new THREE.CapsuleGeometry(0.032, 0.09, 4, 8);
  const handGeo = new THREE.SphereGeometry(0.028, 10, 8);

  if (sex === 'male') {
    // hang left (-X), point right (+X) toward center
    add(root, hangArm, hoodie, -0.15, torsoY + 0.02, 0.02, 1, 1, 1, 0, 0, 0.15);
    add(root, handGeo, skin, -0.15, torsoY - 0.1, 0.04);
    // pointing arm angled up-forward-right
    const pointArm = add(root, pointUpper, hoodie, 0.14, torsoY + 0.1, 0.08, 1, 1, 1, 0, 0, -0.9);
    add(root, handGeo, skin, 0.22, torsoY + 0.2, 0.14);
    // pointing finger
    add(root, new THREE.CapsuleGeometry(0.008, 0.035, 2, 6), skin, 0.26, torsoY + 0.24, 0.18, 1, 1, 1, 0, 0, -0.6);
  } else {
    // hang right (+X), point left (-X) toward center
    add(root, hangArm, hoodie, 0.15, torsoY + 0.02, 0.02, 1, 1, 1, 0, 0, -0.15);
    add(root, handGeo, skin, 0.15, torsoY - 0.1, 0.04);
    add(root, pointUpper, hoodie, -0.14, torsoY + 0.1, 0.08, 1, 1, 1, 0, 0, 0.9);
    add(root, handGeo, skin, -0.22, torsoY + 0.2, 0.14);
    add(root, new THREE.CapsuleGeometry(0.008, 0.035, 2, 6), skin, -0.26, torsoY + 0.24, 0.18, 1, 1, 1, 0, 0, 0.6);
  }

  // Neck
  add(root, new THREE.CylinderGeometry(0.035, 0.04, 0.04, 10), skin, 0, headY - 0.1, 0);

  // Head
  add(root, new THREE.SphereGeometry(0.11, 16, 14), skin, 0, headY, 0.01);
  // Ears
  add(root, new THREE.SphereGeometry(0.025, 8, 8), skin, -0.1, headY, 0);
  add(root, new THREE.SphereGeometry(0.025, 8, 8), skin, 0.1, headY, 0);
  // Eyes (simple dots)
  add(root, new THREE.SphereGeometry(0.014, 8, 8), eyeM, -0.035, headY + 0.02, 0.095);
  add(root, new THREE.SphereGeometry(0.014, 8, 8), eyeM, 0.035, headY + 0.02, 0.095);
  // Nose
  add(root, new THREE.SphereGeometry(0.016, 8, 8), skin, 0, headY - 0.01, 0.105);
  // Smile — thin torus arc approximated with stretched sphere
  add(root, new THREE.TorusGeometry(0.025, 0.006, 6, 12, Math.PI), eyeM, 0, headY - 0.04, 0.095, 1, 1, 1, Math.PI, 0, 0);

  // Hair
  if (sex === 'male') {
    // messy tufted brown hair — several overlapping spheres/capsules on top
    add(root, new THREE.SphereGeometry(0.12, 12, 10), hairM, 0, headY + 0.06, -0.02, 1.05, 0.75, 1.0);
    const tufts = [
      [0, 0.14, -0.02, 0.07],
      [-0.06, 0.12, 0.02, 0.055],
      [0.06, 0.12, 0.02, 0.055],
      [-0.04, 0.13, -0.05, 0.05],
      [0.05, 0.13, -0.04, 0.05],
      [0.0, 0.11, 0.06, 0.045],
      [-0.08, 0.08, -0.02, 0.045],
      [0.08, 0.08, -0.02, 0.045],
    ];
    for (const [x, y, z, r] of tufts) {
      add(root, new THREE.SphereGeometry(r, 10, 8), hairM, x, headY + y, z);
    }
  } else {
    // shoulder-length, tucked behind ears — helmet + side locks
    add(root, new THREE.SphereGeometry(0.118, 14, 12), hairM, 0, headY + 0.04, -0.015, 1.05, 0.9, 1.05);
    // bangs
    add(root, new THREE.SphereGeometry(0.06, 10, 8), hairM, -0.04, headY + 0.08, 0.07, 1.2, 0.6, 0.7);
    add(root, new THREE.SphereGeometry(0.06, 10, 8), hairM, 0.04, headY + 0.08, 0.07, 1.2, 0.6, 0.7);
    // side locks to shoulders
    add(root, new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), hairM, -0.11, headY - 0.06, -0.02);
    add(root, new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), hairM, 0.11, headY - 0.06, -0.02);
    add(root, new THREE.SphereGeometry(0.045, 10, 8), hairM, -0.11, headY - 0.16, 0.0);
    add(root, new THREE.SphereGeometry(0.045, 10, 8), hairM, 0.11, headY - 0.16, 0.0);
  }

  // Face slightly toward camera (+Z)
  root.rotation.y = 0;
  return root;
}

function exportGlb(object, filePath) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        const buf = Buffer.from(result);
        fs.writeFileSync(filePath, buf);
        console.log('wrote', filePath, buf.length);
        resolve(buf.length);
      },
      (err) => reject(err),
      { binary: true },
    );
  });
}

const male = buildFigure('male');
const female = buildFigure('female');
await exportGlb(male, path.join(outDir, 'hoodie-male.glb'));
await exportGlb(female, path.join(outDir, 'hoodie-female.glb'));
console.log('done');
