import {
  createSystem, Group, HemisphereLight, Mesh, MeshStandardMaterial, PlaneGeometry,
  PokeInteractable, Pressed, RayInteractable, type Entity,
} from '@iwsdk/core';
import { StewardCharacter } from './character.js';
import { demoPlan } from './demo-steward.js';
import { Label, panel, text } from './label.js';
import { captureKeyFromUrl, chatWithTools, hasLiveKey } from './llm.js';
import { PaneManager } from './panes.js';
import { IS_DEMO, loadStats, saveStats, type SessionStats } from './state.js';
import { C } from './style.js';
import type { ToolBatch, ToolCall } from './tools.js';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

type WorldBtn = { label: Label; entity: Entity; action: () => void; kind: 'keep' | 'undo' };

export class StewardSystem extends createSystem({
  pressed: { required: [RayInteractable, Pressed] },
}) {
  private character = new StewardCharacter();
  private panes = new PaneManager();
  private room = new Group();
  private pending: ToolBatch | null = null;
  private stats: SessionStats = loadStats();
  private busy = false;
  private mode: 'demo' | 'live' = 'demo';
  private frozen = false;
  private buttons = new Map<number, WorldBtn>();
  private keepBtn!: WorldBtn;
  private undoBtn!: WorldBtn;

  init(): void {
    captureKeyFromUrl();
    this.refreshModeChip();
    const scene = this.world.scene;
    scene.add(new HemisphereLight(0xf0f4ff, 0x404858, 1.4));
    scene.add(this.room);
    this.room.add(this.character.root);
    this.room.add(this.panes.root);

    // soft floor disc for seated feel (no desk furniture)
    const floor = new Mesh(
      new PlaneGeometry(2.4, 2.4),
      new MeshStandardMaterial({ color: '#1a1f2a', roughness: 1, transparent: true, opacity: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    this.room.add(floor);

    this.buildWorldBtns();
    this.bindHud();
    this.paintSession();
    if (import.meta.env.DEV) (window as unknown as { __ps: unknown }).__ps = this;

    this.queries.pressed.subscribe('qualify', (e) => {
      const b = this.buttons.get(e.index);
      if (b) b.action();
    });

    if (IS_DEMO) {
      // autoplay kicks after world settles
      setTimeout(() => void this.runDemoTour(), 900);
    }
  }

  update(dt: number): void {
    if (this.frozen) return;
    this.character.update(dt);
    // pause on hidden tab
    if (document.visibilityState === 'hidden') {
      this.frozen = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.frozen = false;
      }, { once: true });
    }
  }

  private buildWorldBtns(): void {
    this.keepBtn = this.makeWorldBtn('keep', '👍 Keep', C.keep, () => this.keep());
    this.undoBtn = this.makeWorldBtn('undo', '👎 Undo', C.undo, () => this.undo());
    // seated reach: under the panes, above the character base
    this.keepBtn.label.mesh.position.set(-0.16, 0.92, -0.78);
    this.undoBtn.label.mesh.position.set(0.16, 0.92, -0.78);
    this.setWorldBtnActive(false);
  }

  private makeWorldBtn(
    kind: 'keep' | 'undo',
    title: string,
    accent: string,
    action: () => void,
  ): WorldBtn {
    const label = new Label(0.24, 0.08);
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
      text(g, title, W / 2, H / 2, Math.round(H * 0.42), C.ink, 700, W - 40, 'center');
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
  }

  private refreshModeChip(): void {
    const live = hasLiveKey();
    this.mode = live ? 'live' : 'demo';
    const chip = el<HTMLDivElement>('mode-chip');
    chip.textContent = live
      ? 'Live chat — panes driven by your API host'
      : 'Demo mode — add API key for live chat.';
    chip.style.borderColor = live ? '#5ad67a' : '#5a7cff';
  }

  private paintSession(): void {
    el<HTMLDivElement>('session').textContent =
      `Steward did ${this.stats.did} · you kept ${this.stats.kept}`;
    saveStats(this.stats);
  }

  private setSpeech(s: string): void {
    el<HTMLDivElement>('speech').textContent = s;
    this.character.talk(s);
  }

  private setReason(s: string): void {
    el<HTMLDivElement>('reason').textContent = s ? `Reason: ${s}` : '';
  }

  private setPendingUi(on: boolean): void {
    el<HTMLButtonElement>('btn-keep').disabled = !on;
    el<HTMLButtonElement>('btn-undo').disabled = !on;
    this.setWorldBtnActive(on);
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
    this.refreshModeChip();
    this.setSpeech('Working…');
    this.setReason('');
    try {
      let speech = '';
      let reason = '';
      let calls: ToolCall[] = [];
      let usedDemo = true;

      if (hasLiveKey()) {
        const summary = this.panes.panes.map((p) => `${p.id}:${p.title}`).join(', ');
        const res = await chatWithTools(text, summary);
        if (res.ok && res.calls.length) {
          speech = res.speech;
          reason = res.reason;
          calls = res.calls;
          usedDemo = false;
          this.mode = 'live';
        } else {
          this.setSpeech(`Live chat failed (${res.error || res.source}) — Demo Steward taking over.`);
          await sleep(500);
        }
      }

      if (usedDemo) {
        this.mode = 'demo';
        this.refreshModeChip();
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
    this.character.play('nod');

    for (const call of calls) {
      await this.execTool(call);
      await sleep(220);
    }

    this.pending = batch;
    this.stats.did += 1;
    this.paintSession();
    this.setPendingUi(true);
    this.character.play('point');
  }

  private async execTool(call: ToolCall): Promise<void> {
    const a = call.args;
    switch (call.name) {
      case 'propose_plan':
        if (a.speech) this.setSpeech(a.speech);
        if (a.reason) this.setReason(a.reason);
        this.character.play('nod');
        break;
      case 'open_pane':
        this.character.play('open');
        this.panes.open(a.id || 'pane', a.title || 'Pane', a.body || '');
        break;
      case 'close_pane':
        this.panes.close(a.id || '');
        break;
      case 'focus_pane':
        this.character.play('point');
        this.panes.focus(a.id || '');
        break;
      case 'set_pane_text':
        this.panes.setText(a.id || '', a.title, a.body);
        break;
      case 'complete_step':
        if (a.summary) this.setSpeech(a.summary);
        this.character.play('nod');
        break;
      default:
        break;
    }
  }

  keep(): void {
    if (!this.pending) return;
    this.stats.kept += 1;
    this.paintSession();
    this.pending = null;
    this.setPendingUi(false);
    this.setSpeech('Kept. Ready for the next ask.');
    this.setReason('');
    this.character.play('nod');
  }

  undo(): void {
    if (!this.pending) return;
    this.panes.restore(this.pending.before);
    this.pending = null;
    this.setPendingUi(false);
    this.setSpeech('Undone — panes restored. Try another chip.');
    this.setReason('');
    this.character.play('open');
  }

  /**
   * Scripted First Five for Reel (&demo=1):
   * character/chat → steer up to 3 panes → Keep → second steer → Undo.
   * Both Keep and Undo must appear in the cut; world-space twins flash with HUD.
   */
  async runDemoTour(): Promise<void> {
    if (this.busy) return;
    // reset panes for a clean hero loop
    for (const p of [...this.panes.panes]) this.panes.close(p.id);
    this.pending = null;
    this.setPendingUi(false);
    this.setSpeech("Demo tour — I'll chat, open panes, then show Keep and Undo.");
    this.character.play('nod');
    await sleep(700);

    // 1) Chat + steer up to 3 panes (Brief / Now / Done)
    await this.handleIntent('Prep call');
    await sleep(1600);

    // 2) Visible Keep (HUD + world twin flash)
    if (this.pending) {
      this.setSpeech('👍 Keep — accepting these three panes.');
      this.flashWorldBtn('keep');
      await sleep(700);
      this.keep();
    }
    await sleep(900);

    // 3) Second steer so Undo has a pending batch to reverse
    await this.handleIntent('Park this');
    await sleep(1400);

    // 4) Visible Undo (HUD + world twin flash)
    if (this.pending) {
      this.setSpeech('👎 Undo — restoring the kept panes.');
      this.flashWorldBtn('undo');
      await sleep(700);
      this.undo();
    }
    await sleep(800);
    this.setSpeech('Tour done — Keep and Undo both shown. Chip again anytime — or add ?key= for live chat.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
