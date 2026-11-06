import { Group, type MeshBasicMaterial } from '@iwsdk/core';
import { Label, panel, para, text } from './label.js';
import { C } from './style.js';
import type { PaneSnap } from './tools.js';

export interface Pane {
  id: string;
  title: string;
  body: string;
  focused: boolean;
  label: Label;
  root: Group;
}

const SLOT_X = [-0.42, 0, 0.42];
const SLOT_Y = 1.35;
const SLOT_Z = -1.05;
const PW = 0.36, PH = 0.42;

export class PaneManager {
  readonly root = new Group();
  panes: Pane[] = [];
  private focusId = '';
  private dimTimer: ReturnType<typeof setTimeout> | null = null;

  snapshot(): PaneSnap[] {
    return this.panes.map((p) => ({
      id: p.id, title: p.title, body: p.body, focused: p.focused,
    }));
  }

  restore(snaps: PaneSnap[]): void {
    for (const p of [...this.panes]) this.close(p.id);
    for (const s of snaps) this.open(s.id, s.title, s.body, false);
    const f = snaps.find((s) => s.focused);
    if (f) this.focus(f.id);
    else this.layout();
  }

  open(id: string, title: string, body = '', redraw = true): Pane | null {
    if (this.panes.find((p) => p.id === id)) {
      this.setText(id, title, body);
      return this.panes.find((p) => p.id === id)!;
    }
    if (this.panes.length >= 3) return null;
    const label = new Label(PW, PH);
    const root = new Group();
    root.add(label.mesh);
    this.root.add(root);
    const pane: Pane = { id, title, body, focused: false, label, root };
    this.panes.push(pane);
    this.focusId = id;
    if (redraw) this.layout();
    return pane;
  }

  close(id: string): boolean {
    const i = this.panes.findIndex((p) => p.id === id);
    if (i < 0) return false;
    const [p] = this.panes.splice(i, 1);
    this.root.remove(p.root);
    if (this.focusId === id) this.focusId = this.panes[0]?.id ?? '';
    this.layout();
    return true;
  }

  focus(id: string): boolean {
    if (!this.panes.find((p) => p.id === id)) return false;
    this.focusId = id;
    this.layout();
    return true;
  }

  setText(id: string, title?: string, body?: string): boolean {
    const p = this.panes.find((x) => x.id === id);
    if (!p) return false;
    if (title != null) p.title = title;
    if (body != null) p.body = body;
    this.draw(p);
    return true;
  }

  /** Redraw every open pane (e.g. after high-contrast toggle). */
  redrawAll(): void {
    for (const pane of this.panes) this.draw(pane);
  }

  /**
   * On Keep: briefly dim non-focused panes so kept/focused pane reads as committed.
   * ~0.6s then restore full opacity.
   */
  pulseKeepFocus(ms = 650): void {
    if (this.dimTimer) clearTimeout(this.dimTimer);
    for (const p of this.panes) {
      const mat = p.label.mesh.material as MeshBasicMaterial;
      mat.transparent = true;
      mat.opacity = p.focused ? 1 : 0.38;
      mat.needsUpdate = true;
    }
    this.dimTimer = setTimeout(() => {
      for (const p of this.panes) {
        const mat = p.label.mesh.material as MeshBasicMaterial;
        mat.opacity = 1;
        mat.needsUpdate = true;
      }
      this.dimTimer = null;
    }, ms);
  }

  private layout(): void {
    this.panes.forEach((p, i) => {
      p.focused = p.id === this.focusId;
      const x = SLOT_X[i] ?? 0;
      const z = p.focused ? SLOT_Z + 0.08 : SLOT_Z;
      const s = p.focused ? 1.08 : 0.95;
      p.root.position.set(x, SLOT_Y, z);
      p.root.scale.setScalar(s);
      this.draw(p);
    });
  }

  private draw(p: Pane): void {
    p.label.draw((g, W, H) => {
      panel(g, W, H, C.pane, p.focused ? C.accent : undefined);
      text(g, p.title, 36, 48, 36, C.ink, 700, W - 60);
      para(g, p.body || ' ', 36, 90, 26, W - 72, C.mute);
      if (p.focused) text(g, 'FOCUSED', W - 36, H - 36, 18, C.warm, 600, 200, 'right');
    });
  }
}
