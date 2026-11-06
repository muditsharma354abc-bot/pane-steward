import {
  BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry,
} from '@iwsdk/core';

/** Simple procedural steward — head, torso, arms; gesture stubs for tool mirroring. */
export class StewardCharacter {
  readonly root = new Group();
  private leftArm: Mesh;
  private rightArm: Mesh;
  private head: Mesh;
  private gestureT = 0;
  private gesture: 'idle' | 'point' | 'open' | 'nod' = 'idle';

  constructor() {
    const skin = new MeshStandardMaterial({ color: '#c9a07a', roughness: 0.65 });
    const cloth = new MeshStandardMaterial({ color: '#3a4a7a', roughness: 0.7 });
    const accent = new MeshStandardMaterial({ color: '#7c9cff', roughness: 0.4, emissive: '#1a2a66', emissiveIntensity: 0.35 });

    const torso = new Mesh(new BoxGeometry(0.22, 0.32, 0.14), cloth);
    torso.position.set(0, 1.15, -0.55);
    this.root.add(torso);

    this.head = new Mesh(new SphereGeometry(0.09, 16, 12), skin);
    this.head.position.set(0, 1.42, -0.55);
    this.root.add(this.head);

    const visor = new Mesh(new BoxGeometry(0.12, 0.03, 0.02), accent);
    visor.position.set(0, 1.43, -0.47);
    this.root.add(visor);

    this.leftArm = new Mesh(new CylinderGeometry(0.025, 0.03, 0.28, 8), cloth);
    this.leftArm.position.set(-0.16, 1.2, -0.55);
    this.leftArm.rotation.z = 0.4;
    this.root.add(this.leftArm);

    this.rightArm = new Mesh(new CylinderGeometry(0.025, 0.03, 0.28, 8), cloth);
    this.rightArm.position.set(0.16, 1.2, -0.55);
    this.rightArm.rotation.z = -0.4;
    this.root.add(this.rightArm);

    const base = new Mesh(new CylinderGeometry(0.12, 0.14, 0.04, 16), accent);
    base.position.set(0, 0.98, -0.55);
    this.root.add(base);
  }

  play(kind: 'idle' | 'point' | 'open' | 'nod'): void {
    this.gesture = kind;
    this.gestureT = 0;
  }

  update(dt: number): void {
    this.gestureT += dt;
    const t = this.gestureT;
    if (this.gesture === 'idle') {
      this.head.position.y = 1.42 + Math.sin(t * 1.4) * 0.008;
      this.rightArm.rotation.z = -0.4 + Math.sin(t * 1.1) * 0.05;
      this.leftArm.rotation.z = 0.4 + Math.sin(t * 1.1 + 1) * 0.05;
    } else if (this.gesture === 'point') {
      this.rightArm.rotation.z = -1.1;
      this.rightArm.rotation.x = -0.6 + Math.sin(t * 6) * 0.05;
      if (t > 0.9) this.gesture = 'idle';
    } else if (this.gesture === 'open') {
      this.leftArm.rotation.z = 1.0;
      this.rightArm.rotation.z = -1.0;
      if (t > 0.85) this.gesture = 'idle';
    } else if (this.gesture === 'nod') {
      this.head.rotation.x = Math.sin(t * 10) * 0.18;
      if (t > 0.6) { this.head.rotation.x = 0; this.gesture = 'idle'; }
    }
  }
}
