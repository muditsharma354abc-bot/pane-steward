import { Group } from '@iwsdk/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Gesture = 'idle' | 'point' | 'open' | 'nod';

/**
 * Hoodie duo — procedural claymation glTF meshes (male left, female right).
 * Loaded from public/characters/hoodie-{male,female}.glb (no photo billboards).
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
    const loader = new GLTFLoader();
    const place = (holder: Group, x: number, yaw: number) => {
      holder.position.set(x, 1.0, -0.62);
      holder.rotation.y = yaw;
      this.root.add(holder);
    };
    place(this.male, -0.22, 0.22);
    place(this.female, 0.22, -0.22);

    const loadOne = (file: string, holder: Group) => {
      loader.load(
        `${base}characters/${file}`,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((o) => {
            const m = o as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          // Feet at group origin; chibi ~0.78m — slight scale bump for XR readability
          model.scale.setScalar(1.05);
          model.position.set(0, 0, 0);
          holder.add(model);
        },
        undefined,
        (err) => console.warn('[StewardCharacter] glTF load failed', file, err),
      );
    };
    loadOne('hoodie-male.glb', this.male);
    loadOne('hoodie-female.glb', this.female);
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
