import { Group, type MeshBasicMaterial } from '@iwsdk/core';
import { Label, panel, para } from './label.js';
import { C } from './style.js';
import type { PaneSnap } from './tools.js';
import { paneCaption } from './titles.js';

export interface Pane {
  id: string;
  title: string;
  body: string;
  focused: boolean;
  label: Label;
  root: Group;
}

const SLOT_X = [-0.46, 0, 0.46];
const SLOT_Y = 1.32;
const SLOT_Z = -1.18;
const PW = 0.42, PH = 0.50;
const PITCH = -0.12;
const YAW = [0.10, 0, -0.10];

interface Target {
  x: number;
  y: number;
  z: number;
  s: number;
  departing?: boolean;
}

export class PaneManager {
  readonly root = new Group();
  panes: Pane[] = [];
  private focusId = '';
  private dimTimer: ReturnType<typeof setTimeout> | null = null;
  private targets = new Map<string, Target>();
  /** Fired after layout/open/close/focus/setText so HUD tabs can sync. */
  onChange: (() => void) | null = null;

  private notify(): void {
    try { this.onChange?.(); } catch { /* ignore */ }
  }

  listed(): Pane[] {
    return this.panes.filter((p) => !this.targets.get(p.id)?.departing);
  }

  snapshot(): PaneSnap[] {
    return this.listed().map((p) => ({
      id: p.id, title: p.title, body: p.body, focused: p.focused,
    }));
  }

  restore(snaps: PaneSnap[]): void {
    for (const p of [...this.panes]) this.removeNow(p.id);
    for (const s of snaps) this.open(s.id, s.title, s.body, false);
    const f = snaps.find((s) => s.focused);
    if (f) this.focus(f.id, false);
    else this.layout();
    this.notify();
  }

  open(id: string, title: string, body = '', redraw = true): Pane | null {
    const existing = this.panes.find((p) => p.id === id && !this.targets.get(p.id)?.departing);
    if (existing) {
      this.setText(id, title, body);
      return existing;
    }
    if (this.listed().length >= 3) return null;
    const label = new Label(PW, PH);
    const root = new Group();
    root.add(label.mesh);
    this.root.add(root);
    // Slide in from the left toward the middle.
    root.position.set(-0.95, SLOT_Y, SLOT_Z);
    root.scale.setScalar(0.82);
    root.rotation.set(PITCH, YAW[this.listed().length] ?? 0, 0);
    const pane: Pane = { id, title, body, focused: false, label, root };
    this.panes.push(pane);
    this.focusId = id;
    if (redraw) this.layout();
    this.notify();
    return pane;
  }

  close(id: string, notify = true): boolean {
    const p = this.panes.find((x) => x.id === id);
    if (!p) return false;
    const cur = this.targets.get(id);
    this.targets.set(id, {
      x: -0.98,
      y: SLOT_Y,
      z: SLOT_Z,
      s: 0.78,
      departing: true,
    });
    if (!cur) {
      // still layout remaining immediately
    }
    if (this.focusId === id) this.focusId = this.listed().find((x) => x.id !== id)?.id ?? '';
    this.layout();
    if (notify) this.notify();
    return true;
  }

  private removeNow(id: string): void {
    const i = this.panes.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [p] = this.panes.splice(i, 1);
    this.root.remove(p.root);
    this.targets.delete(id);
    if (this.focusId === id) this.focusId = this.listed()[0]?.id ?? '';
  }

  tick(dt: number): void {
    const k = 1 - Math.exp(-dt * 9);
    for (const p of [...this.panes]) {
      const t = this.targets.get(p.id);
      if (!t) continue;
      p.root.position.x += (t.x - p.root.position.x) * k;
      p.root.position.y += (t.y - p.root.position.y) * k;
      p.root.position.z += (t.z - p.root.position.z) * k;
      const s = p.root.scale.x + (t.s - p.root.scale.x) * k;
      p.root.scale.setScalar(s);
      if (t.departing && Math.abs(p.root.position.x - t.x) < 0.04) {
        this.removeNow(p.id);
        this.layout();
        this.notify();
      }
    }
  }

  focus(id: string, notify = true): boolean {
    if (!this.listed().find((p) => p.id === id)) return false;
    this.focusId = id;
    this.layout();
    if (notify) this.notify();
    return true;
  }

  setText(id: string, title?: string, body?: string): boolean {
    const p = this.panes.find((x) => x.id === id);
    if (!p) return false;
    if (title != null) p.title = title;
    if (body != null) p.body = body;
    this.draw(p);
    this.notify();
    return true;
  }

  focused(): Pane | undefined {
    return this.listed().find((p) => p.id === this.focusId) ?? this.listed()[0];
  }

  redrawAll(): void {
    for (const pane of this.listed()) this.draw(pane);
  }

  /** On Keep: briefly dim non-focused world panes + a scale pulse. */
  pulseKeepFocus(ms = 650): void {
    if (this.dimTimer) clearTimeout(this.dimTimer);
    for (const p of this.listed()) {
      const mat = p.label.mesh.material as MeshBasicMaterial;
      mat.transparent = true;
      mat.opacity = p.focused ? 1 : 0.38;
      mat.needsUpdate = true;
      p.root.scale.setScalar(p.focused ? 1.12 : 0.9);
    }
    this.dimTimer = setTimeout(() => {
      for (const p of this.listed()) {
        const mat = p.label.mesh.material as MeshBasicMaterial;
        mat.opacity = 1;
        mat.needsUpdate = true;
      }
      this.layout();
      this.dimTimer = null;
    }, ms);
  }

  /** Undo: reverse slide cue before restore caller runs. */
  pulseUndo(): void {
    for (const p of this.listed()) {
      p.root.position.x -= 0.08;
    }
  }

  private layout(): void {
    this.listed().forEach((p, i) => {
      p.focused = p.id === this.focusId;
      this.targets.set(p.id, {
        x: SLOT_X[i] ?? 0,
        y: SLOT_Y,
        z: p.focused ? SLOT_Z + 0.07 : SLOT_Z,
        s: p.focused ? 1.03 : 0.96,
      });
      p.root.rotation.set(PITCH, YAW[i] ?? 0, 0);
      this.draw(p);
    });
  }

  private draw(p: Pane): void {
    p.label.draw((g, W, H) => {
      panel(g, W, H, C.pane, p.focused ? C.accent : undefined);
      const maxW = W - 80;
      const cap = paneCaption(p.title, p.id);
      let y = para(g, cap.heading, 40, 36, 48, maxW, C.ink, 700, 1);
      if (cap.subtitle) y = para(g, cap.subtitle, 40, y + 6, 34, maxW, C.mute, 600, 1);
      y += 14;
      para(g, p.body || ' ', 40, y, 48, maxW, C.mute, 400, 3);
    });
  }
}
