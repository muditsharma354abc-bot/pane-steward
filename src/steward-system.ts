import {
  createSystem, Group, HemisphereLight, Mesh, MeshStandardMaterial, PlaneGeometry,
  PokeInteractable, Pressed, RayInteractable, type Entity,
} from '@iwsdk/core';
import {
  demoConnectorBody, extractUrl, fetchPublicWeb, isConnected, loadConnectors,
  saveConnectors, type ConnectorId, type ConnectorState,
} from './connectors.js';
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

function titleFromIntent(raw: string | undefined, intentHint: string, fallbackId: string): string {
  const t = (raw || '').trim();
  if (t && !/^pane$/i.test(t)) return t.slice(0, 48);
  const hint = intentHint.trim().slice(0, 40);
  if (hint) return hint;
  if (fallbackId === 'brief') return 'Brief';
  if (fallbackId === 'now') return 'Now';
  if (fallbackId === 'done') return 'Done';
  if (fallbackId === 'web') return 'Web';
  return fallbackId ? fallbackId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Tab';
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
 * Chat-first Pane Steward — chatbot only, no character meshes.
 * Layout: left vertical tabs · middle content · right chat dock.
 * Connectors: Web (public) + Calendar/Mail/Notes demo stubs.
 */
export class StewardSystem extends createSystem({
  pressed: { required: [RayInteractable, Pressed] },
}) {
  private panes = new PaneManager();
  private room = new Group();
  private pending: ToolBatch | null = null;
  private lastKeepBefore: PaneSnap[] | null = null;
  private stats: SessionStats = loadStats();
  private a11y: A11yPrefs = loadA11y();
  private connectors: ConnectorState = loadConnectors();
  private busy = false;
  private mode: 'demo' | 'live' = 'demo';
  private frozen = false;
  private buttons = new Map<number, WorldBtn>();
  private keepBtn!: WorldBtn;
  private undoBtn!: WorldBtn;
  private lastIntent = '';
  private undidCount = 0;
  private tabSeq = 0;

  init(): void {
    captureKeyFromUrl();
    this.refreshModeChip();
    this.paintConnectors();
    const scene = this.world.scene;
    scene.add(new HemisphereLight(0xf0f4ff, 0x404858, 1.4));
    scene.add(this.room);
    this.room.add(this.panes.root);

    const floor = new Mesh(
      new PlaneGeometry(2.4, 2.4),
      new MeshStandardMaterial({ color: '#1a1f2a', roughness: 1, transparent: true, opacity: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    this.room.add(floor);

    this.panes.onChange = () => this.syncTabUi();
    this.buildWorldBtns();
    this.bindHud();
    this.applyA11y(true);
    this.paintSession();
    this.syncTabUi();
    this.setStatus(hasLiveKey()
      ? 'Live chat · ready — ask to open ≤3 tabs'
      : 'Demo Steward · offline twin — chat still drives tabs');
    if (import.meta.env.DEV) (window as unknown as { __ps: unknown }).__ps = this;

    this.queries.pressed.subscribe('qualify', (e) => {
      const b = this.buttons.get(e.index);
      if (b) b.action();
    });

    if (IS_DEMO) setTimeout(() => void this.runDemoTour(), 900);
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
      try { void this.world.launchXR(); } catch { /* */ }
    };
    el<HTMLButtonElement>('btn-demo').onclick = () => void this.runDemoTour();
    el<HTMLButtonElement>('btn-keep').onclick = () => this.keep();
    el<HTMLButtonElement>('btn-undo').onclick = () => this.undo();
    el<HTMLButtonElement>('btn-send').onclick = () => void this.onUserText();
    el<HTMLInputElement>('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.onUserText();
    });
    el<HTMLButtonElement>('btn-tab-add').onclick = () => this.addBlankTab();

    document.querySelectorAll<HTMLButtonElement>('#chips [data-intent]').forEach((b) => {
      b.onclick = () => {
        const map: Record<string, string> = {
          prep: 'Prep call',
          park: 'Park this',
          next: "What's next",
          web: 'Lookup https://example.com',
        };
        void this.handleIntent(map[b.dataset.intent || ''] || b.textContent || '');
      };
    });

    document.querySelectorAll<HTMLButtonElement>('#connectors [data-conn]').forEach((b) => {
      b.onclick = () => {
        const id = (b.dataset.conn || '') as ConnectorId;
        if (!id) return;
        this.connectors[id] = !this.connectors[id];
        saveConnectors(this.connectors);
        this.paintConnectors();
        const on = this.connectors[id];
        const label = id[0].toUpperCase() + id.slice(1);
        this.setStatus(
          on
            ? (id === 'web'
              ? 'Connected Web · public pages only (no account login)'
              : `Connected ${label} · demo stub (no OAuth)`)
            : `${label} disconnected`,
        );
        this.setSpeech(
          on
            ? (id === 'web'
              ? 'Web connected — send a URL or tap Lookup web. Public fetch into a tab only.'
              : `${label} connected (demo) — ask about ${id}. No real account tokens in this build.`)
            : `${label} off.`,
        );
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

  private paintConnectors(): void {
    document.querySelectorAll<HTMLButtonElement>('#connectors [data-conn]').forEach((b) => {
      const id = (b.dataset.conn || '') as ConnectorId;
      const on = !!this.connectors[id];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const name = id[0].toUpperCase() + id.slice(1);
      b.textContent = on
        ? (id === 'web' ? 'Web · On' : `${name} · Demo`)
        : `${name} · Connect`;
    });
  }

  /** Sync left tab strip + middle stage from PaneManager. */
  private syncTabUi(): void {
    const list = el<HTMLDivElement>('tab-list');
    list.innerHTML = '';
    for (const p of this.panes.panes) {
      const row = document.createElement('div');
      row.className = 'tab-item' + (p.focused ? ' active' : '');
      const sel = document.createElement('button');
      sel.type = 'button';
      sel.className = 'tab-select';
      sel.textContent = p.title.slice(0, 22) || p.id;
      sel.title = p.title;
      sel.onclick = () => {
        this.panes.focus(p.id);
        this.setStatus(`Focusing ${p.title}`);
      };
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.setAttribute('aria-label', `Remove ${p.title}`);
      close.textContent = '×';
      close.onclick = (ev) => {
        ev.stopPropagation();
        this.panes.close(p.id);
        this.setStatus(`Closed ${p.title}`);
      };
      row.append(sel, close);
      list.append(row);
    }
    el<HTMLButtonElement>('btn-tab-add').disabled = this.panes.panes.length >= 3;

    const stage = el<HTMLElement>('pane-stage');
    const empty = el<HTMLElement>('pane-stage-empty');
    const title = el<HTMLElement>('pane-stage-title');
    const body = el<HTMLElement>('pane-stage-body');
    const f = this.panes.focused();
    if (!f) {
      empty.hidden = false;
      title.hidden = true;
      body.hidden = true;
    } else {
      empty.hidden = true;
      title.hidden = false;
      body.hidden = false;
      title.textContent = f.title;
      body.textContent = f.body || ' ';
    }
    stage.classList.toggle('dimmed', false);
  }

  private addBlankTab(): void {
    if (this.panes.panes.length >= 3) {
      this.setStatus('Max 3 tabs — close one or Keep/Undo');
      return;
    }
    this.tabSeq += 1;
    const id = `tab-${this.tabSeq}`;
    this.panes.open(id, `Tab ${this.tabSeq}`, 'Empty tab — chat to fill, or type an ask.');
    this.setStatus(`Added Tab ${this.tabSeq}`);
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
        const accent = b.kind === 'keep' ? C.keep : C.undo;
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
      ? 'Live chat — tabs from your API host (not website control)'
      : 'Demo Steward · offline twin — chat still drives ≤3 tabs';
    chip.style.borderColor = live ? C.keep : C.accent;
    chip.dataset.mode = this.mode;
  }

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
    el<HTMLButtonElement>('btn-keep').disabled = !on;
    const canUndo = on || !!this.lastKeepBefore;
    el<HTMLButtonElement>('btn-undo').disabled = !canUndo;
    if (this.keepBtn) this.keepBtn.label.mesh.visible = on;
    if (this.undoBtn) this.undoBtn.label.mesh.visible = canUndo;
    if (on) {
      for (const b of [this.keepBtn, this.undoBtn]) {
        if (!b) continue;
        this.drawWorldBtn(b.label, b.label.mesh.userData.btn as string, b.label.mesh.userData.accent as string, false);
      }
    } else if (canUndo && this.undoBtn) {
      this.drawWorldBtn(this.undoBtn.label, this.undoBtn.label.mesh.userData.btn as string, this.undoBtn.label.mesh.userData.accent as string, false);
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
    this.setStatus(`Chat → steering tabs… (“${text.slice(0, 42)}${text.length > 42 ? '…' : ''}”)`);
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
        const connSummary = Object.entries(this.connectors).filter(([, v]) => v).map(([k]) => k).join(',') || 'none';
        const res = await chatWithTools(
          `${text}\n[connectors_on=${connSummary}]`,
          summary,
        );
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
          await sleep(400);
        }
      }

      if (usedDemo) {
        this.mode = 'demo';
        this.refreshModeChip();
        this.setStatus('Demo Steward · offline twin — applying tab plan');
        const plan = demoPlan(text, this.panes.panes.map((p) => p.id), { connectors: this.connectors });
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
    const batch: ToolBatch = { id: `b-${Date.now()}`, speech, reason, calls, before };
    if (speech) this.setSpeech(speech);
    if (reason) this.setReason(reason);
    for (const call of calls) {
      await this.execTool(call);
      await sleep(200);
    }
    this.pending = batch;
    this.lastKeepBefore = null;
    this.stats.did += 1;
    this.paintSession();
    this.setPendingUi(true);
    this.setStatus(
      `Pending Keep-all · ${this.panes.panes.length} tab${this.panes.panes.length === 1 ? '' : 's'} from chat`,
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
      case 'open_web': {
        await this.execOpenWeb(a.url || extractUrl(this.lastIntent) || 'https://example.com', a.title);
        break;
      }
      case 'open_connector': {
        const service = (a.service || '').toLowerCase() as 'calendar' | 'mail' | 'notes';
        if (service !== 'calendar' && service !== 'mail' && service !== 'notes') break;
        if (!isConnected(service, this.connectors)) {
          this.setStatus(`${service} · Connect needed`);
          this.panes.open('brief', `${service} · Connect`, `Tap ${service} · Connect in the tray (demo — no OAuth).`);
          break;
        }
        const d = demoConnectorBody(service, this.lastIntent);
        const title = a.title?.trim() || d.title;
        const body = a.body?.trim() || d.body;
        this.ensurePaneSlot(d.id);
        this.setStatus(`Opening ${title}… (demo Connect)`);
        this.panes.open(d.id, title, body);
        this.panes.focus(d.id);
        break;
      }
      case 'close_pane': {
        const id = a.id || '';
        const existing = this.panes.panes.find((p) => p.id === id);
        this.setStatus(`Closing ${existing?.title || id || 'tab'}…`);
        this.panes.close(id);
        break;
      }
      case 'focus_pane': {
        const id = a.id || '';
        const existing = this.panes.panes.find((p) => p.id === id);
        this.setStatus(`Focusing ${existing?.title || id || 'tab'}`);
        this.panes.focus(id);
        break;
      }
      case 'set_pane_text': {
        const id = a.id || '';
        const title = a.title != null ? titleFromIntent(a.title, this.lastIntent, id) : undefined;
        this.setStatus(`Updating ${title || id || 'tab'}…`);
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


  /** Ensure room for a pane id — close Done or oldest if at cap. */
  private ensurePaneSlot(preferId: string): void {
    if (this.panes.panes.find((p) => p.id === preferId)) return;
    if (this.panes.panes.length < 3) return;
    const victim =
      this.panes.panes.find((p) => p.id === 'done') ||
      this.panes.panes.find((p) => !p.focused) ||
      this.panes.panes[0];
    if (victim) {
      this.setStatus(`Making room — closing ${victim.title}`);
      this.panes.close(victim.id);
    }
  }

  private async execOpenWeb(url: string, titleHint?: string): Promise<void> {
    if (!isConnected('web', this.connectors)) {
      this.setStatus('Web · Connect needed');
      this.panes.open('brief', 'Web · Connect', 'Tap Web · Connect first.\nPublic pages only — no account login / no Quest Browser RPA.');
      this.panes.focus('brief');
      return;
    }
    this.ensurePaneSlot('web');
    this.setStatus(`Opening ${url}…`);
    const offline = this.mode === 'demo' || !navigator.onLine || !hasLiveKey();
    // Demo Steward offline twin still simulates; live+online tries public fetch
    const useDemo = offline && this.mode === 'demo';
    if (!useDemo && navigator.onLine !== false) {
      this.setStatus('Connected Web · summarizing…');
    } else {
      this.setStatus('Demo Steward · offline twin — Web demo summary…');
    }
    const result = await fetchPublicWeb(url, {
      demo: useDemo || navigator.onLine === false,
    });
    const title = titleHint?.trim() || result.title;
    this.setStatus(
      result.source === 'demo'
        ? `Demo Web pane · ${title}`
        : result.source === 'link-only'
          ? `Web link pane · ${title}`
          : `Connected Web · ${title}`,
    );
    this.panes.open('web', title, result.body);
    this.panes.focus('web');
  }

  keep(): void {
    if (!this.pending) return;
    this.lastKeepBefore = this.pending.before;
    this.stats.kept += 1;
    this.paintSession();
    this.pending = null;
    this.setPendingUi(false);
    this.panes.pulseKeepFocus(700);
    const stage = el<HTMLElement>('pane-stage');
    stage.classList.add('dimmed');
    // Keep focused tab readable: undim after briefly showing commitment
    setTimeout(() => stage.classList.remove('dimmed'), 700);
    this.setSpeech('Kept all. Ready for the next ask.');
    this.setReason('');
    this.setStatus(`Kept ${this.stats.kept} · undid ${this.undidCount} — chat drives next tabs`);
  }

  undo(): void {
    if (this.pending) {
      this.panes.restore(this.pending.before);
      this.pending = null;
      this.undidCount += 1;
      this.paintSession();
      this.setPendingUi(false);
      this.setSpeech('Undone — tabs restored. Try another chip.');
      this.setReason('');
      this.setStatus(`Undid pending · Kept ${this.stats.kept} · undid ${this.undidCount}`);
      return;
    }
    if (this.lastKeepBefore) {
      this.panes.restore(this.lastKeepBefore);
      this.lastKeepBefore = null;
      this.undidCount += 1;
      if (this.stats.kept > 0) this.stats.kept -= 1;
      this.paintSession();
      this.setPendingUi(false);
      this.setSpeech('Undo last Keep — tabs restored.');
      this.setReason('');
      this.setStatus(`Undid last Keep · Kept ${this.stats.kept} · undid ${this.undidCount}`);
    }
  }

  /**
   * Demo tour: chat → ≤3 tabs → Keep-all → Park → Undo-last.
   * Also flips Web Connect briefly for a public/demo web pane beat when useful.
   */
  async runDemoTour(): Promise<void> {
    if (this.busy) return;
    for (const p of [...this.panes.panes]) this.panes.close(p.id);
    this.pending = null;
    this.lastKeepBefore = null;
    this.setPendingUi(false);
    this.setStatus('Demo tour · chat drives tabs (no character meshes)');
    this.setSpeech("Demo tour — chat opens tabs on the left, Keep-all / Undo-last, then a Web demo.");
    await sleep(600);

    await this.handleIntent('Prep call');
    await sleep(1400);
    if (this.pending) {
      this.setSpeech('👍 Keep all — accepting these tabs.');
      this.setStatus('Tour · Keep-all');
      this.flashWorldBtn('keep');
      await sleep(600);
      this.keep();
    }
    await sleep(700);

    // Web connector beat
    this.connectors.web = true;
    saveConnectors(this.connectors);
    this.paintConnectors();
    await this.handleIntent('Lookup https://example.com');
    await sleep(1400);
    if (this.pending) {
      this.setSpeech('👍 Keep all — Web pane kept.');
      this.flashWorldBtn('keep');
      await sleep(500);
      this.keep();
    }
    await sleep(600);

    await this.handleIntent('Park this');
    await sleep(1200);
    if (this.pending || this.lastKeepBefore) {
      this.setSpeech('👎 Undo last — restoring tabs.');
      this.setStatus('Tour · Undo-last');
      this.flashWorldBtn('undo');
      await sleep(600);
      this.undo();
    }
    await sleep(500);
    this.setSpeech('Tour done — right chat dock, left tabs, Connectors, no characters.');
    this.setStatus(
      `Tour done · Kept ${this.stats.kept} · undid ${this.undidCount} · Demo Steward · offline twin`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
