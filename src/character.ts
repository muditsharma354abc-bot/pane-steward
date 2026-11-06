import {
  DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader,
} from '@iwsdk/core';

type Gesture = 'idle' | 'point' | 'open' | 'nod';

/**
 * Hoodie duo — Shubham's locked claymation helpers (male left, female right).
 * Transparent PNG cutouts (no beige bg / no floating UI cards).
 * Same API: play(gesture), update(dt), talk(text).
 */
export class StewardCharacter {
  readonly root = new Group();
  private male = new Group();
  private female = new Group();
  private gestureT = 0;
  private gesture: Gesture = 'idle';
  private talkT = 0;
  private talker: 0 | 1 = 0;
  private time = 0;

  constructor() {
    const base = import.meta.env.BASE_URL;
    const loader = new TextureLoader();
    // Portrait cutouts ~265×509 / 261×498 → keep ~0.40 wide, height from aspect.
    const make = (file: string, holder: Group, x: number, yaw: number, aspect: number) => {
      const tex = loader.load(`${base}characters/${file}`);
      tex.colorSpace = SRGBColorSpace;
      const w = 0.40;
      const h = w / aspect;
      const mat = new MeshBasicMaterial({
        map: tex,
        side: DoubleSide,
        toneMapped: false,
        transparent: true,
        alphaTest: 0.15,
        depthWrite: false,
      });
      const plane = new Mesh(new PlaneGeometry(w, h), mat);
      plane.position.y = h * 0.5; // feet near group origin
      holder.add(plane);
      holder.position.set(x, 1.0, -0.62);
      holder.rotation.y = yaw; // angled in toward the pane zone
      this.root.add(holder);
    };
    // male 265/509 ≈ 0.521; female 261/498 ≈ 0.524
    make('hoodie-male.png', this.male, -0.22, 0.18, 265 / 509);
    make('hoodie-female.png', this.female, 0.22, -0.18, 261 / 498);
  }

  play(kind: Gesture): void {
    this.gesture = kind;
    this.gestureT = 0;
  }

  /** Talk pose + non-blocking browser TTS; duo alternates who speaks. */
  talk(text: string): void {
    this.talker = this.talker === 0 ? 1 : 0;
    this.talkT = Math.min(4, 0.6 + text.length * 0.05);
    try {
      const ss = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
      if (ss && text && typeof SpeechSynthesisUtterance !== 'undefined') {
        ss.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.pitch = this.talker === 0 ? 0.9 : 1.25;
        ss.speak(u);
      }
    } catch { /* TTS optional */ }
  }

  update(dt: number): void {
    this.time += dt;
    this.gestureT += dt;
    this.talkT = Math.max(0, this.talkT - dt);
    const t = this.time, g = this.gestureT;
    const base = (h: Group, phase: number) => {
      h.position.y = 1.0 + Math.sin(t * 1.4 + phase) * 0.006;
      h.scale.set(1, 1, 1);
      h.rotation.z = 0;
    };
    base(this.male, 0); base(this.female, 1.3);
    // talking: quick bob + squash on the active speaker
    if (this.talkT > 0) {
      const s = this.talker === 0 ? this.male : this.female;
      s.position.y += Math.abs(Math.sin(t * 14)) * 0.012;
      s.scale.y = 1 + Math.sin(t * 14) * 0.015;
    }
    if (this.gesture === 'point') {
      const lean = Math.sin(Math.min(g, 0.9) / 0.9 * Math.PI) * 0.06;
      this.male.rotation.z = -lean; this.female.rotation.z = lean;
      if (g > 0.9) this.gesture = 'idle';
    } else if (this.gesture === 'open') {
      const k = 1 + Math.sin(Math.min(g, 0.85) / 0.85 * Math.PI) * 0.06;
      this.male.scale.set(k, k, 1); this.female.scale.set(k, k, 1);
      if (g > 0.85) this.gesture = 'idle';
    } else if (this.gesture === 'nod') {
      const d = Math.sin(g * 12) * 0.012;
      this.male.position.y -= d; this.female.position.y -= d;
      if (g > 0.6) this.gesture = 'idle';
    }
  }
}
