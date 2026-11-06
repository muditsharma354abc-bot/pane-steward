import {
  createSystem, Group, HemisphereLight, Mesh, MeshStandardMaterial, PlaneGeometry,
  PokeInteractable, Pressed, RayInteractable, type Entity,
} from '@iwsdk/core';
import { demoPlan } from './demo-steward.js';
import { Label, panel, text } from './label.js';
import { captureKeyFromUrl, chatWithTools, hasLiveKey } from './llm.js';
import { PaneManager } from './panes.js';
import { IS_DEMO, loadA11y, loadStats, saveA11y, saveStats, type A11yPrefs, type SessionStats } from './state.js';
import { applyContrast, C } from './style.js';
import type { PaneSnap, ToolBatch, ToolCall } from './tools.js';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** Prefer intent-derived titles over generic "Pane". */
function titleFromIntent(raw: string | undefined, intentHint: string, fallbackId: string): string {
  const t = (raw || '').trim();
  if (t && !/^pane$/i.test(t)) return t.slice(0, 48);
  const hint = intentHint.trim().slice(0, 40);
  if (hint) return hint;
  if (fallbackId === 'brief') return 'Brief';
  if (fallbackId === 'now') return 'Now';
  if (fallbackId === 'done') return 'Done';
  return fallbackId ? fallbackId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pane';
}

function speakHud(text: string): void {
  try {
    const ss = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (ss && text && typeof SpeechSynthesisUtterance !== 'undefined') {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      ss.speak(u);
    }
  } catch { /* TTS optional */ }
}

type WorldBtn = { label: Label; entity: Entity; action: () => void; kind: 'keep' | 'undo' };

/**
 * Chat-first Pane Steward — no character meshes.
 * Chat AI (live) or Demo Steward (offline twin) steers ≤3 spatial panes; Keep-all / Undo-last.
 */
export class StewardSystem extends createSystem({
  pressed: { required: [RayInteractable, Pressed] },
}) {
  private panes = new PaneManager();
  private room = new Group();
  private pending: ToolBatch | null = null;
  /** Snapshot before the last accepted Keep — Undo-last can reverse it. */
  private lastKeepBefore: PaneSnap[] | null = null;
  private stats: SessionStats = loadStats();
  private a11y: A11yPrefs = loadA11y();
  private busy = false;
  private mode: 'demo' | 'live' = 'demo';
  private frozen = false;
  private buttons = new Map<number, WorldBtn>();
  private keepBtn!: WorldBtn;
  private undoBtn!: WorldBtn;
  private lastIntent = '';
  private undidCount = 0;

  init(): void {
    captureKeyFromUrl();
    this.refreshModeChip();
    const scene = this.world.scene;
    scene.add(new HemisphereLight(0xf0f4ff, 0x404858, 1.4));
    scene.add(this.room);
    this.room.add(this.panes.root);

    // soft floor disc for seated feel (no desk furniture, no characters)
    const floor = new Mesh(
      new PlaneGeometry(2.4, 2.4),
      new MeshStandardMaterial({ color: '#1a1f2a', roughness: 1, transparent: true, opacity: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    this.room.add(floor);

    this.buildWorldBtns();
    this.bindHud();
    this.applyA11y(true);
    this.paintSession();
    this.setStatus(hasLiveKey()
      ? 'Live chat · ready — ask to open ≤3 panes'
      : 'Demo Steward · offline twin — chat still drives panes');
    if (import.meta.env.DEV) (window as unknown as { __ps: unknown }).__ps = this;

    this.queries.pressed.subscribe('qualify', (e) => {
      const b = this.buttons.get(e.index);
      if (b) b.action();
    });

    if (IS_DEMO) {
      setTimeout(() => void this.runDemoTour(), 900);
    }
  }

  update(_dt: number): void {
    if (this.frozen) return;
    if (document.visibilityState === 'hidden') {
      this.frozen = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.frozen = false;
      }, { once: true });
    }
  }

  private buildWorldBtns(): void {
    this.keepBtn = this.makeWorldBtn('keep', '👍 Keep all', C.keep, () => this.keep());
    this.undoBtn = this.makeWorldBtn('undo', '👎 Undo last', C.undo, () => this.undo());
    // seated reach: under the panes
    this.keepBtn.label.mesh.position.set(-0.18, 0.92, -0.78);
    this.undoBtn.label.mesh.position.set(0.18, 0.92, -0.78);
    this.setWorldBtnActive(false);
  }

  private makeWorldBtn(
    kind: 'keep' | 'undo',
    title: string,
    accent: string,
    action: () => void,
  ): WorldBtn {
    const label = new Label(0.28, 0.08);
    this.drawWorldBtn(label, title, accent, false);
    const entity = this.world.createTransformEntity(label.mesh);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);
    const b: WorldBtn = { label, entity, action, kind };
    this.buttons.set(entity.index, b);
    label.mesh.userData.btn = title;
    label.mesh.userData.accent = accent;
    return b;
  }

  private drawWorldBtn(label: Label, title: string, accent: string, hot: boolean): void {
    label.draw((g, W, H) => {
      panel(g, W, H, hot ? '#2a3348' : C.pane, accent);
      text(g, title, W / 2, H / 2, Math.round(H * 0.38), C.ink, 700, W - 40, 'center');
    });
  }

  private setWorldBtnActive(on: boolean): void {
    for (const b of [this.keepBtn, this.undoBtn]) {
      if (!b) continue;
      b.label.mesh.visible = on;
      const title = b.label.mesh.userData.btn as string;
      const accent = b.label.mesh.userData.accent as string;
      this.drawWorldBtn(b.label, title, accent, false);
    }
  }

  private flashWorldBtn(kind: 'keep' | 'undo'): void {
    const b = kind === 'keep' ? this.keepBtn : this.undoBtn;
    if (!b) return;
    b.label.mesh.visible = true;
    const title = b.label.mesh.userData.btn as string;
    const accent = b.label.mesh.userData.accent as string;
    this.drawWorldBtn(b.label, title, accent, true);
    b.label.mesh.scale.setScalar(1.12);
    setTimeout(() => {
      b.label.mesh.scale.setScalar(1);
      this.drawWorldBtn(b.label, title, accent, false);
    }, 500);
  }

  private bindHud(): void {
    el<HTMLButtonElement>('btn-enter').onclick = () => {
      try { void this.world.launchXR(); } catch { /* offer button may already show */ }
    };
    el<HTMLButtonElement>('btn-demo').onclick = () => void this.runDemoTour();
    el<HTMLButtonElement>('btn-keep').onclick = () => this.keep();
    el<HTMLButtonElement>('btn-undo').onclick = () => this.undo();
    el<HTMLButtonElement>('btn-send').onclick = () => void this.onUserText();
    el<HTMLInputElement>('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.onUserText();
    });
    document.querySelectorAll<HTMLButtonElement>('#chips [data-intent]').forEach((b) => {
      b.onclick = () => {
        const map: Record<string, string> = {
          prep: 'Prep call',
          park: 'Park this',
          next: "What's next",
        };
        void this.handleIntent(map[b.dataset.intent || ''] || b.textContent || '');
      };
    });
    el<HTMLButtonElement>('btn-contrast').onclick = () => {
      this.a11y.highContrast = !this.a11y.highContrast;
      this.applyA11y(true);
    };
    el<HTMLButtonElement>('btn-text-down').onclick = () => {
      this.a11y.textScale = Math.max(0, this.a11y.textScale - 1) as 0 | 1 | 2;
      this.applyA11y(false);
    };
    el<HTMLButtonElement>('btn-text-up').onclick = () => {
      this.a11y.textScale = Math.min(2, this.a11y.textScale + 1) as 0 | 1 | 2;
      this.applyA11y(false);
    };
  }

  private applyA11y(redrawWorld: boolean): void {
    saveA11y(this.a11y);
    const root = document.documentElement;
    root.classList.toggle('hc', this.a11y.highContrast);
    root.classList.remove('ts-0', 'ts-1', 'ts-2');
    root.classList.add(`ts-${this.a11y.textScale}`);
    const contrastBtn = el<HTMLButtonElement>('btn-contrast');
    contrastBtn.setAttribute('aria-pressed', this.a11y.highContrast ? 'true' : 'false');
    contrastBtn.textContent = this.a11y.highContrast ? 'Contrast ✓' : 'Contrast';
    applyContrast(this.a11y.highContrast);
    if (redrawWorld) {
      this.panes.redrawAll();
      for (const b of [this.keepBtn, this.undoBtn]) {
        if (!b) continue;
        const title = b.label.mesh.userData.btn as string;
        const kind = b.kind;
        const accent = kind === 'keep' ? C.keep : C.undo;
        b.label.mesh.userData.accent = accent;
        this.drawWorldBtn(b.label, title, accent, false);
      }
    }
  }

  private refreshModeChip(): void {
    const live = hasLiveKey();
    this.mode = live ? 'live' : 'demo';
    const chip = el<HTMLDivElement>('mode-chip');
    chip.textContent = live
      ? 'Live chat — panes from your API host (not website control)'
      : 'Demo Steward · offline twin — chat still drives ≤3 panes';
    chip.style.borderColor = live ? C.keep : C.accent;
    chip.dataset.mode = this.mode;
  }

  /** Always-visible "what's happening" narration. */
  private setStatus(s: string): void {
    const node = el<HTMLDivElement>('status-line');
    if (node) node.textContent = s;
  }

  private paintSession(): void {
    el<HTMLDivElement>('session').textContent =
      `Steward did ${this.stats.did} · you kept ${this.stats.kept}` +
      (this.undidCount ? ` · undid ${this.undidCount}` : '');
    saveStats(this.stats);
  }

  private setSpeech(s: string): void {
    el<HTMLDivElement>('speech').textContent = s;
    speakHud(s);
  }

  private setReason(s: string): void {
    el<HTMLDivElement>('reason').textContent = s ? `Reason: ${s}` : '';
  }

  private setPendingUi(on: boolean): void {
    el<HTMLButtonElement>('btn-keep').disabled = !on && !this.lastKeepBefore;
    // Undo-last: enabled for pending batch OR after a Keep
    const canUndo = on || !!this.lastKeepBefore;
    el<HTMLButtonElement>('btn-undo').disabled = !canUndo;
    // World twins: show Keep when pending; Undo when pending or lastKeep
    if (this.keepBtn) this.keepBtn.label.mesh.visible = on;
    if (this.undoBtn) this.undoBtn.label.mesh.visible = canUndo;
    if (on) {
      for (const b of [this.keepBtn, this.undoBtn]) {
        if (!b) continue;
        const title = b.label.mesh.userData.btn as string;
        const accent = b.label.mesh.userData.accent as string;
        this.drawWorldBtn(b.label, title, accent, false);
      }
    } else if (canUndo && this.undoBtn) {
      const title = this.undoBtn.label.mesh.userData.btn as string;
      const accent = this.undoBtn.label.mesh.userData.accent as string;
      this.drawWorldBtn(this.undoBtn.label, title, accent, false);
    }
  }

  private async onUserText(): Promise<void> {
    const input = el<HTMLInputElement>('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await this.handleIntent(text);
  }

  async handleIntent(text: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.lastIntent = text;
    this.refreshModeChip();
    this.setStatus(`Chat → steering panes… (“${text.slice(0, 42)}${text.length > 42 ? '…' : ''}”)`);
    this.setSpeech('Working…');
    this.setReason('');
    try {
      let speech = '';
      let reason = '';
      let calls: ToolCall[] = [];
      let usedDemo = true;

      if (hasLiveKey()) {
        this.setStatus('Live chat · calling tools…');
        const summary = this.panes.panes.map((p) => `${p.id}:${p.title}`).join(', ');
        const res = await chatWithTools(text, summary);
        if (res.ok && res.calls.length) {
          speech = res.speech;
          reason = res.reason;
          calls = res.calls;
          usedDemo = false;
          this.mode = 'live';
          this.refreshModeChip();
        } else {
          this.setSpeech(`Live chat failed (${res.error || res.source}) — Demo Steward taking over.`);
          this.setStatus('Live failed → Demo Steward · offline twin');
          await sleep(500);
        }
      }

      if (usedDemo) {
        this.mode = 'demo';
        this.refreshModeChip();
        this.setStatus('Demo Steward · offline twin — applying pane plan');
        const plan = demoPlan(text, this.panes.panes.map((p) => p.id));
        speech = plan.speech;
        reason = plan.reason;
        calls = plan.calls;
      }

      await this.applyBatch(speech, reason, calls);
    } finally {
      this.busy = false;
    }
  }

  private async applyBatch(speech: string, reason: string, calls: ToolCall[]): Promise<void> {
    const before = this.panes.snapshot();
    const batch: ToolBatch = {
      id: `b-${Date.now()}`,
      speech, reason, calls, before,
    };

    if (speech) this.setSpeech(speech);
    if (reason) this.setReason(reason);

    for (const call of calls) {
      await this.execTool(call);
      await sleep(220);
    }

    this.pending = batch;
    this.lastKeepBefore = null; // new pending supersedes post-keep undo target until Keep
    this.stats.did += 1;
    this.paintSession();
    this.setPendingUi(true);
    this.setStatus(
      `Pending Keep-all · ${this.panes.panes.length} pane${this.panes.panes.length === 1 ? '' : 's'} from chat`,
    );
  }

  private async execTool(call: ToolCall): Promise<void> {
    const a = call.args;
    switch (call.name) {
      case 'propose_plan':
        if (a.speech) this.setSpeech(a.speech);
        if (a.reason) this.setReason(a.reason);
        this.setStatus(`Planning… ${a.reason || ''}`.trim());
        break;
      case 'open_pane': {
        const id = a.id || 'pane';
        const title = titleFromIntent(a.title, this.lastIntent, id);
        this.setStatus(`Opening ${title}…`);
        this.panes.open(id, title, a.body || '');
        break;
      }
      case 'close_pane': {
        const id = a.id || '';
        const existing = this.panes.panes.find((p) => p.id === id);
        this.setStatus(`Closing ${existing?.title || id || 'pane'}…`);
        this.panes.close(id);
        break;
      }
      case 'focus_pane': {
        const id = a.id || '';
        const existing = this.panes.panes.find((p) => p.id === id);
        this.setStatus(`Focusing ${existing?.title || id || 'pane'}`);
        this.panes.focus(id);
        break;
      }
      case 'set_pane_text': {
        const id = a.id || '';
        const title = a.title != null
          ? titleFromIntent(a.title, this.lastIntent, id)
          : undefined;
        this.setStatus(`Updating ${title || id || 'pane'}…`);
        this.panes.setText(id, title, a.body);
        break;
      }
      case 'complete_step':
        if (a.summary) this.setSpeech(a.summary);
        this.setStatus(a.summary || 'Step complete — Keep-all or Undo-last');
        break;
      default:
        break;
    }
  }

  /** Keep-all — accept current pending batch; dim non-focused panes briefly. */
  keep(): void {
    if (!this.pending) return;
    this.lastKeepBefore = this.pending.before;
    this.stats.kept += 1;
    this.paintSession();
    this.pending = null;
    this.setPendingUi(false);
    this.panes.pulseKeepFocus(700);
    this.setSpeech('Kept all. Ready for the next ask.');
    this.setReason('');
    this.setStatus(
      `Kept ${this.stats.kept} · undid ${this.undidCount} — chat drives next panes`,
    );
  }

  /**
   * Undo-last — reverse pending batch, or reverse the last Keep if nothing pending.
   */
  undo(): void {
    if (this.pending) {
      this.panes.restore(this.pending.before);
      this.pending = null;
      this.undidCount += 1;
      this.paintSession();
      this.setPendingUi(false);
      this.setSpeech('Undone — panes restored. Try another chip.');
      this.setReason('');
      this.setStatus(
        `Undid pending · Kept ${this.stats.kept} · undid ${this.undidCount}`,
      );
      return;
    }
    if (this.lastKeepBefore) {
      this.panes.restore(this.lastKeepBefore);
      this.lastKeepBefore = null;
      this.undidCount += 1;
      if (this.stats.kept > 0) this.stats.kept -= 1;
      this.paintSession();
      this.setPendingUi(false);
      this.setSpeech('Undo last Keep — panes restored.');
      this.setReason('');
      this.setStatus(
        `Undid last Keep · Kept ${this.stats.kept} · undid ${this.undidCount}`,
      );
      return;
    }
  }

  /**
   * Scripted First Five for Reel (?demo=1):
   * chat → open ≤3 panes → Keep-all → second steer → Undo-last.
   * No character meshes. Both Keep and Undo must appear in the cut.
   */
  async runDemoTour(): Promise<void> {
    if (this.busy) return;
    for (const p of [...this.panes.panes]) this.panes.close(p.id);
    this.pending = null;
    this.lastKeepBefore = null;
    this.setPendingUi(false);
    this.setStatus('Demo tour · chat drives panes (no character meshes)');
    this.setSpeech("Demo tour — I'll chat, open panes, then show Keep-all and Undo-last.");
    await sleep(700);

    await this.handleIntent('Prep call');
    await sleep(1600);

    if (this.pending) {
      this.setSpeech('👍 Keep all — accepting these three panes.');
      this.setStatus('Tour · Keep-all');
      this.flashWorldBtn('keep');
      await sleep(700);
      this.keep();
    }
    await sleep(900);

    await this.handleIntent('Park this');
    await sleep(1400);

    if (this.pending || this.lastKeepBefore) {
      this.setSpeech('👎 Undo last — restoring the kept panes.');
      this.setStatus('Tour · Undo-last');
      this.flashWorldBtn('undo');
      await sleep(700);
      this.undo();
    }
    await sleep(800);
    this.setSpeech('Tour done — Keep-all and Undo-last shown. Chip again anytime — or add ?key= for live chat.');
    this.setStatus(
      `Tour done · Kept ${this.stats.kept} · undid ${this.undidCount} · Demo Steward · offline twin`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
