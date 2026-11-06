import {
  createSystem, Group, HemisphereLight, Mesh, MeshStandardMaterial, PlaneGeometry,
} from '@iwsdk/core';
import { StewardCharacter } from './character.js';
import { demoPlan } from './demo-steward.js';
import { captureKeyFromUrl, chatWithTools, hasLiveKey } from './llm.js';
import { PaneManager } from './panes.js';
import { IS_DEMO, loadStats, saveStats, type SessionStats } from './state.js';
import type { ToolBatch, ToolCall } from './tools.js';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export class StewardSystem extends createSystem({}) {
  private character = new StewardCharacter();
  private panes = new PaneManager();
  private room = new Group();
  private pending: ToolBatch | null = null;
  private stats: SessionStats = loadStats();
  private busy = false;
  private mode: 'demo' | 'live' = 'demo';
  private frozen = false;
  private worldBtns: { mesh: Mesh; action: () => void }[] = [];

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

    this.bindHud();
    this.paintSession();
    if (import.meta.env.DEV) (window as unknown as { __ps: unknown }).__ps = this;

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
  }

  private setReason(s: string): void {
    el<HTMLDivElement>('reason').textContent = s ? `Reason: ${s}` : '';
  }

  private setPendingUi(on: boolean): void {
    el<HTMLButtonElement>('btn-keep').disabled = !on;
    el<HTMLButtonElement>('btn-undo').disabled = !on;
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

  /** Scripted First Five for Reel: intent → panes → Keep in <90s. */
  async runDemoTour(): Promise<void> {
    if (this.busy) return;
    // reset panes for a clean hero loop
    for (const p of [...this.panes.panes]) this.panes.close(p.id);
    this.pending = null;
    this.setPendingUi(false);
    this.setSpeech('Demo tour — Prep call in under 90 seconds.');
    await sleep(600);
    await this.handleIntent('Prep call');
    await sleep(1400);
    if (this.pending) this.keep();
    await sleep(700);
    this.setSpeech('Tour done. Chip again anytime — or add ?key= for live chat.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// silence unused VisibilityState import warning by referencing
