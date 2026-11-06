import {
  DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader,
} from '@iwsdk/core';

type Gesture = 'idle' | 'point' | 'open' | 'nod';

/**
 * Hoodie duo — Shubham's locked claymation helpers (male left, female right).
 * Two textured billboards cropped from public/characters/hoodie-duo.jpg.
 * Same API as before: play(gesture), update(dt), plus talk(text) for speech.
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
    const url = `${import.meta.env.BASE_URL}characters/hoodie-duo.jpg`;
    const loader = new TextureLoader();
    const make = (half: 0 | 1, holder: Group, x: number, yaw: number) => {
      const tex = loader.load(url);
      tex.colorSpace = SRGBColorSpace;
      tex.repeat.set(0.5, 1);
      tex.offset.set(half * 0.5, 0);
      const mat = new MeshBasicMaterial({ map: tex, side: DoubleSide, toneMapped: false });
      const plane = new Mesh(new PlaneGeometry(0.36, 0.405), mat);
      plane.position.y = 0.2;
      holder.add(plane);
      holder.position.set(x, 1.0, -0.62);
      holder.rotation.y = yaw; // angled in toward the pane zone
      this.root.add(holder);
    };
    make(0, this.male, -0.2, 0.18);
    make(1, this.female, 0.2, -0.18);
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
