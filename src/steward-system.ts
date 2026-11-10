import {
  Color, createSystem, DirectionalLight, Fog, Group, HemisphereLight,
  Hovered, Mesh, MeshStandardMaterial, PlaneGeometry,
  PokeInteractable, Pressed, RayInteractable, type Entity,
} from '@iwsdk/core';
import {
  demoConnectorBody, extractUrl, fetchPublicWeb, isConnected, loadConnectors,
  saveConnectors, type ConnectorId, type ConnectorState,
} from './connectors.js';
import { demoPlan } from './demo-steward.js';
import { Label, panel, para, text } from './label.js';
import { captureKeyFromUrl, chatWithTools, hasLiveKey } from './llm.js';
import { PaneManager } from './panes.js';
import { bindGaze, bindGazeHold, HOLD_MS, tabIcon } from './pointers.js';
import { IS_DEMO, loadA11y, loadStats, saveA11y, saveStats, type A11yPrefs, type SessionStats } from './state.js';
import { isMuted, sfxClick, sfxCorrect, sfxWhoosh, sfxWrong, toggleMuted } from './sfx.js';
import { applyContrast, C, FONT } from './style.js';
import type { PaneSnap, ToolBatch, ToolCall } from './tools.js';
import { paneCaption } from './titles.js';
import { BreakQuiz } from './quiz.js';
import type { LifelineId } from './quiz-pack.js';


function shortenStatus(s: string): string {
  if (/^Guide/.test(s)) return 'Guide · tab, Keep, Undo';
  if (/^Kept all/.test(s)) return 'Kept all — ready';
  if (/^Chat → Prep/.test(s)) return 'Chat → Prep → 3 panes';
  if (/^Tour done/.test(s)) return 'Tour done · offline twin';
  if (/^Demo Steward/.test(s)) return 'Demo Steward · offline';
  if (/^Pending Keep/.test(s)) return s.replace('Keep all', 'Keep');
  if (/^Quiz Game Mode · pick/.test(s)) return 'Quiz Game Mode · pick one';
  if (/^Quiz Game Mode · time up/.test(s)) return 'Quiz Game Mode · time up';
  if (/^Quiz Game Mode ·/.test(s)) return 'Quiz Game Mode · 60s, tabs back';
  if (/^Video Call/.test(s)) return 'Video Call a Friend';
  if (/^Back to work/.test(s) || /^Undid last Keep/.test(s) || /^Undid pending/.test(s)) return s;
  if (/^Steering tabs/.test(s) || /^Steer:/.test(s)) return s.length > 32 ? s.slice(0, 32) : s;
  if (s.length > 48) return s.slice(0, 48);
  return s;
}

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

type WorldBtn = {
  label: Label;
  entity: Entity;
  action: () => void;
  hold?: () => void;
  kind: string;
  pressAt: number;
  held: boolean;
  gazed: boolean;
  twin: string;
  title: string;
  subtitle?: string;
  wantVisible: boolean;
  dimmed?: boolean;
  pressLostAt: number;
  selectHeld: boolean;
};

const GUIDE = [
  { step: '1 / 3 · Open a tab', body: 'Tap + or Prep to open a pane.' },
  { step: '2 / 3 · Keep all', body: 'Keep all accepts the panes chat opened.' },
  { step: '3 / 3 · Undo last', body: 'Undo last restores the previous panes.' },
];

/**
 * Chat-first Pane Steward — chatbot only, no character meshes.
 * Layout: left vertical tabs · middle content · right chat dock.
 * Gaze: IWSDK Hovered on world twins + CSS .gaze on 2D HUD.
 * Long-hold: ~600 ms Pressed (pinch) or pointer-hold opens Options.
 */
export class StewardSystem extends createSystem({
  pressed: { required: [RayInteractable, Pressed] },
  hovered: { required: [RayInteractable, Hovered] },
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
  private startBtn!: WorldBtn;
  private guideBtn!: WorldBtn;
  private muteBtn!: WorldBtn;
  private optsPanel!: WorldBtn;
  private optsAddBtn!: WorldBtn;
  private optsDismissBtn!: WorldBtn;
  private tabWorld: WorldBtn[] = [];
  private lastIntent = '';
  private undidCount = 0;
  private tabSeq = 0;
  private guideIdx = -1;
  private xrOn = false;
  private quiz = new BreakQuiz();
  private quizHold = false;
  private workPause: import('./tools.js').PaneSnap[] | null = null;
  private xrStatus!: WorldBtn;
  private quizPanel!: WorldBtn;
  private quizAnswers: WorldBtn[] = [];
  private quizLives: WorldBtn[] = [];
  private quizFriendBtn!: WorldBtn;
  private lastCommitted: import('./tools.js').PaneSnap[] | null = null;

  init(): void {
    captureKeyFromUrl();
    this.refreshModeChip();
    this.paintConnectors();
    const scene = this.world.scene;
    scene.background = new Color(C.bg);
    scene.fog = new Fog(C.bg, 6, 16);
    scene.add(new HemisphereLight(C.hemiSky, C.hemiGround, 1.2));
    const sun = new DirectionalLight('#EFE4D4', 0.42);
    sun.position.set(0.7, 2.5, 1.3);
    scene.add(sun);
    scene.add(this.room);
    this.room.add(this.panes.root);

    const floor = new Mesh(
      new PlaneGeometry(2.4, 2.4),
      new MeshStandardMaterial({ color: C.floor, roughness: 1, transparent: true, opacity: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    this.room.add(floor);

    this.panes.onChange = () => { this.syncTabUi(); this.refreshKeepUndo(); };
    this.buildWorldBtns();
    this.wireXrVis();
    this.markChromeWorldVisible();
    this.bindHud();
    this.applyA11y(true);
    this.paintSession();
    this.paintMute();
    this.syncTabUi();
    this.setStatus(hasLiveKey()
      ? 'Live chat · ready'
      : 'Demo Steward · offline');
    (window as unknown as { __ps: unknown }).__ps = this;
  }

  update(dt: number): void {
    if (this.frozen) return;
    if (document.visibilityState === 'hidden') {
      this.frozen = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.frozen = false;
      }, { once: true });
      return;
    }
    this.panes.tick(typeof dt === 'number' && dt > 0 ? dt : 1 / 60);
    this.pollWorld();
  }


  private wireXrVis(): void {
    const xr = (this.world as unknown as { renderer?: { xr?: { addEventListener?: (e: string, fn: () => void) => void } } }).renderer?.xr;
    xr?.addEventListener?.('sessionstart', () => {
      this.xrOn = true;
      this.applyWorldVis();
      this.bindXrSelect();
    });
    xr?.addEventListener?.('sessionend', () => {
      this.xrOn = false;
      this.applyWorldVis();
    });
    this.applyWorldVis();
  }

  private markChromeWorldVisible(): void {
    for (const b of this.buttons.values()) {
      if (
        b.kind === 'start' || b.kind === 'add' ||
        b.kind === 'keep' || b.kind === 'undo' || b.kind === 'xr-status' ||
        b.kind.startsWith('conn-')
      ) b.wantVisible = true;
    }
  }

  private applyWorldVis(): void {
    const guideOpen = !!(document.getElementById('guide') && !el<HTMLElement>('guide').hidden);
    for (const b of this.buttons.values()) {
      const extra = b.kind === 'guide' ? guideOpen : true;
      b.label.mesh.visible = !!(b.wantVisible && this.xrOn && extra);
    }
  }

  private setVis(b: WorldBtn | undefined, on: boolean): void {
    if (!b) return;
    b.wantVisible = on;
    b.label.mesh.visible = !!(on && this.xrOn);
  }

  private pollWorld(): void {
    const now = performance.now();
    for (const b of this.buttons.values()) {
      const hovered = b.entity.hasComponent(Hovered);
      if (hovered !== b.gazed) {
        b.gazed = hovered;
        this.drawWorldBtn(b);
        this.syncTwinGaze(b.twin, hovered);
      }
      const pressed = b.entity.hasComponent(Pressed) || b.selectHeld;
      if (pressed) {
        if (!b.pressAt) { b.pressAt = now; b.held = false; }
        b.pressLostAt = 0;
        if (b.hold && !b.held && now - b.pressAt >= HOLD_MS) {
          b.held = true;
          b.hold();
        }
      } else if (b.pressAt) {
        if (!b.pressLostAt) b.pressLostAt = now;
        if (now - b.pressLostAt < 200) {
          if (b.hold && !b.held && now - b.pressAt >= HOLD_MS) {
            b.held = true;
            b.hold();
          }
          continue;
        }
        if (!b.held) b.action();
        b.pressAt = 0;
        b.pressLostAt = 0;
        b.held = false;
      }
    }
    if (this.quiz.phase === 'question') {
      const thinking = this.quiz.friendThinking;
      this.quiz.tickFriend();
      if (thinking && !this.quiz.friendThinking) {
        this.paintQuiz();
        this.quiz.pauseClock();
        window.setTimeout(() => this.quiz.resumeClock(), 2500);
      }
      if (this.quizHold) this.paintQuizMeta();
      else if (this.quiz.sessionOver()) this.showEndCard();
      else if (this.quiz.questionOver()) {
        const r = this.quiz.miss();
        this.setStatus(r.done ? 'Quiz Game Mode · time up' : 'Time up · next question');
        if (r.done) this.showEndCard();
        else this.paintQuiz();
      } else {
        this.paintQuizMeta();
      }
    }
  }

  private syncTwinGaze(sel: string, on: boolean): void {
    if (!sel) return;
    document.querySelectorAll(sel).forEach((n) => n.classList.toggle('gaze', on));
  }

  private buildWorldBtns(): void {
    this.xrStatus = this.makeWorldBtn('xr-status', 'Ready', [0.92, 1.62, -0.95], () => {}, { w: 0.38, h: 0.16 });
    this.keepBtn = this.makeWorldBtn('keep', 'Keep all', [0.92, 1.00, -0.95], () => this.keep(), { twin: '#btn-keep', w: 0.30, h: 0.09 });
    this.undoBtn = this.makeWorldBtn('undo', 'Undo last', [0.92, 0.88, -0.95], () => this.undo(), { twin: '#btn-undo', w: 0.30, h: 0.09 });
    this.startBtn = this.makeWorldBtn('start', 'Start', [0, 1.24, -0.78], () => this.beginOnboarding(), {
      twin: '#btn-start', w: 0.44, h: 0.14,
    });
    this.guideBtn = this.makeWorldBtn('guide', 'Next', [0, 1.08, -0.78], () => this.advanceGuide(), { twin: '#btn-guide-next' });
    this.setVis(this.guideBtn, false);
    this.muteBtn = this.makeWorldBtn('mute', 'Sound', [-0.92, 0.76, -0.95], () => this.toggleMute(), { twin: '#btn-mute', w: 0.28, h: 0.08 });
    this.makeWorldBtn('options', 'Options', [0.92, 0.64, -0.95], () => this.openOptions({ kind: 'generic' }), { twin: '#btn-options', w: 0.30, h: 0.08 });
    this.makeWorldBtn('demo', 'Demo', [-0.92, 0.64, -0.95], () => void this.runDemoTour(), { twin: '#btn-demo', w: 0.28, h: 0.08 });
    this.makeWorldBtn('add', '+ Tab', [-0.92, 0.98, -0.95], () => this.addBlankTab(), {
      twin: '#btn-tab-add', w: 0.30, h: 0.09,
      hold: () => this.openOptions({ kind: 'generic' }),
    });
    this.optsPanel = this.makeWorldBtn('opts-panel', 'Options', [0, 1.26, -0.70], () => {}, { w: 0.48, h: 0.16 });
    this.setVis(this.optsPanel, false);
    this.optsAddBtn = this.makeWorldBtn('opts-add', 'Add tab', [0, 1.16, -0.69], () => { this.addBlankTab(); this.closeOptions(); }, { w: 0.40, h: 0.08 });
    this.setVis(this.optsAddBtn, false);
    this.optsDismissBtn = this.makeWorldBtn('opts-dismiss', 'Close', [0, 1.06, -0.69], () => this.closeOptions(), { twin: '#opts-dismiss', w: 0.40, h: 0.08 });
    this.setVis(this.optsDismissBtn, false);
    for (let i = 0; i < 3; i++) {
      const slot = i;
      const b = this.makeWorldBtn(`tab-${i}`, 'Tab', [-0.92, 1.46 - i * 0.14, -0.95], () => {
        if (this.workPaused()) return;
        const p = this.panes.listed()[slot];
        if (p) {
          this.panes.focus(p.id);
          this.setStatus(`Focusing ${p.title}`);
        }
      }, {
        hold: () => {
          if (this.workPaused()) return;
          const p = this.panes.listed()[slot];
          if (p) this.openOptions({ kind: 'tab', id: p.id, title: p.title });
          else this.openOptions({ kind: 'generic' });
        },
        w: 0.30, h: 0.12,
      });
      b.label.mesh.visible = false;
      this.tabWorld.push(b);
    }
    const conns: ConnectorId[] = ['web', 'calendar', 'mail', 'notes'];
    const labels = ['Web', 'Cal · demo', 'Mail · demo', 'Notes · demo'];
    conns.forEach((id, i) => {
      this.makeWorldBtn(`conn-${id}`, labels[i], [0.92, 1.46 - i * 0.11, -0.95], () => this.toggleConnector(id), {
        twin: `#connectors [data-conn="${id}"]`,
        hold: () => this.openOptions({ kind: 'conn', id }),
        w: 0.30, h: 0.09,
      });
    });
    this.buildQuizWorld();
    this.refreshKeepUndo();
  }

  private makeWorldBtn(
    kind: string,
    title: string,
    pos: [number, number, number],
    action: () => void,
    extra?: { hold?: () => void; twin?: string; w?: number; h?: number },
  ): WorldBtn {
    const label = new Label(extra?.w ?? 0.26, extra?.h ?? 0.08);
    const entity = this.world.createTransformEntity(label.mesh);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);
    label.mesh.position.set(pos[0], pos[1], pos[2]);
    const b: WorldBtn = {
      label, entity, action, hold: extra?.hold, kind,
      pressAt: 0, pressLostAt: 0, selectHeld: false, held: false, gazed: false, wantVisible: false,
      twin: extra?.twin ?? '', title,
    };
    this.buttons.set(entity.index, b);
    const mesh = label.mesh as unknown as { onPointerEnter?: () => void; onPointerLeave?: () => void };
    mesh.onPointerEnter = () => { b.gazed = true; this.drawWorldBtn(b); this.syncTwinGaze(b.twin, true); };
    mesh.onPointerLeave = () => { b.gazed = false; this.drawWorldBtn(b); this.syncTwinGaze(b.twin, false); };
    this.drawWorldBtn(b);
    return b;
  }

  private drawWorldBtn(b: WorldBtn): void {
    const accent = b.gazed && !b.dimmed ? C.accent : undefined;
    const ink = b.dimmed ? C.mute : C.ink;
    b.label.draw((g, W, H) => {
      panel(g, W, H, b.gazed && !b.dimmed ? C.glassHi : C.pane, accent);
      if (b.kind === 'xr-status') {
        para(g, b.title, 28, 28, 26, W - 56, ink, 700, 2);
        return;
      }
      if (b.kind === 'quiz-panel') {
        const maxW = W - 72;
        let size = 68;
        while (size > 44 && countWrapLines(g, b.title, size, maxW) > 3) size -= 2;
        const after = para(g, b.title, 36, 28, size, maxW, ink, 700, 3);
        if (b.subtitle) {
          text(g, b.subtitle, W / 2, Math.min(after + 32, H - 48), 44, C.mute, 700, W - 64, 'center');
        }
        return;
      }
      if (b.kind.startsWith('quiz-life-')) {
        drawLifeIcon(g, b.kind.replace('quiz-life-', ''), W / 2, H * 0.28, 36, ink);
        if (b.subtitle) {
          text(g, b.title, W / 2, H * 0.58, 30, ink, 800, W - 20, 'center');
          text(g, b.subtitle, W / 2, H * 0.80, 30, ink, 800, W - 20, 'center');
        } else {
          text(g, b.title, W / 2, H * 0.68, 32, ink, 800, W - 20, 'center');
        }
        return;
      }
      if (b.subtitle) {
        text(g, b.title, W / 2, H * 0.38, Math.round(H * 0.28), ink, 700, W - 36, 'center');
        text(g, b.subtitle, W / 2, H * 0.68, Math.round(H * 0.22), C.mute, 500, W - 36, 'center');
      } else {
        text(g, b.title, W / 2, H / 2, Math.round(H * 0.36), ink, 700, W - 36, 'center');
      }
    });
  }

  private setWorldBtnActive(on: boolean): void {
    this.setVis(this.keepBtn, on);
    this.setVis(this.undoBtn, on || !!this.lastKeepBefore);
  }

  private flashWorldBtn(kind: 'keep' | 'undo'): void {
    const b = kind === 'keep' ? this.keepBtn : this.undoBtn;
    if (!b) return;
    this.setVis(b, true);
    b.gazed = true;
    this.drawWorldBtn(b);
    b.label.mesh.scale.setScalar(1.12);
    setTimeout(() => {
      b.label.mesh.scale.setScalar(1);
      b.gazed = false;
      this.drawWorldBtn(b);
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
    bindGazeHold(el('btn-tab-add'), {
      onClick: () => this.addBlankTab(),
      onHold: () => this.openOptions({ kind: 'generic' }),
    });
    el<HTMLButtonElement>('btn-start').onclick = () => this.beginOnboarding();
    el<HTMLButtonElement>('btn-guide-next').onclick = () => this.advanceGuide();
    el<HTMLButtonElement>('btn-mute').onclick = () => this.toggleMute();
    el<HTMLButtonElement>('btn-options').onclick = () => this.openOptions({ kind: 'generic' });
    const breakBtn = document.getElementById('btn-break') as HTMLButtonElement | null;
    if (breakBtn) {
      bindGaze(breakBtn);
      breakBtn.onclick = () => this.enterBreak();
    }
    const quizBegin = document.getElementById('quiz-begin') as HTMLButtonElement | null;
    if (quizBegin) {
      bindGaze(quizBegin);
      quizBegin.onclick = () => this.beginBreak();
    }
    const quizBack = document.getElementById('quiz-back') as HTMLButtonElement | null;
    if (quizBack) {
      bindGaze(quizBack);
      quizBack.onclick = () => this.finishBreak();
    }
    hideStrayEnterXr();
    document.querySelectorAll<HTMLButtonElement>('#quiz-lives [data-life]').forEach((b) => {
      bindGaze(b);
      b.onclick = () => this.useQuizLife((b.dataset.life || '') as LifelineId);
    });
    const moreBtn = document.getElementById('btn-more') as HTMLButtonElement | null;
    if (moreBtn) {
      bindGaze(moreBtn);
      moreBtn.onclick = () => {
        const panel = el<HTMLElement>('more-panel');
        const open = panel.hidden;
        panel.hidden = !open;
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        moreBtn.textContent = open ? 'Less' : 'More';
      };
    }
    el<HTMLButtonElement>('opts-dismiss').onclick = () => this.closeOptions();

    for (const id of ['btn-enter', 'btn-demo', 'btn-keep', 'btn-undo', 'btn-send', 'btn-start', 'btn-guide-next', 'btn-mute', 'btn-options', 'btn-contrast', 'btn-text-down', 'btn-text-up', 'opts-dismiss']) {
      const n = document.getElementById(id);
      if (n) bindGaze(n);
    }

    document.querySelectorAll<HTMLButtonElement>('#chips [data-intent]').forEach((b) => {
      bindGaze(b);
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
      const id = (b.dataset.conn || '') as ConnectorId;
      bindGazeHold(b, {
        onClick: () => this.toggleConnector(id),
        onHold: () => this.openOptions({ kind: 'conn', id }),
      });
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

  private beginOnboarding(): void {
    const cold = el<HTMLElement>('cold-start');
    cold.hidden = true;
    document.body.classList.remove('onboarding');
    this.setVis(this.startBtn, false);
    this.showGuide(0);
    this.setStatus('Guide · tab, Keep, Undo');
  }

  private showGuide(i: number): void {
    this.guideIdx = i;
    const box = el<HTMLElement>('guide');
    if (i < 0 || i >= GUIDE.length) {
      box.hidden = true;
      this.setVis(this.guideBtn, false);
      return;
    }
    box.hidden = false;
    el('guide-step').textContent = GUIDE[i].step;
    el('guide-body').textContent = GUIDE[i].body;
    this.setVis(this.guideBtn, true);
  }

  private advanceGuide(): void {
    const next = this.guideIdx + 1;
    if (next >= GUIDE.length) {
      this.showGuide(-1);
      this.setStatus('Ready · chat steers up to 3 panes');
      if (IS_DEMO) void this.runDemoTour();
      return;
    }
    this.showGuide(next);
  }

  private toggleMute(): void {
    toggleMuted();
    this.paintMute();
    this.setStatus(isMuted() ? 'Sound off' : 'Sound on');
  }

  private paintMute(): void {
    const btn = el<HTMLButtonElement>('btn-mute');
    const muted = isMuted();
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.textContent = muted ? 'Muted' : 'Sound';
    this.muteBtn.title = btn.textContent;
    this.drawWorldBtn(this.muteBtn);
  }

  private openOptions(ctx: { kind: 'generic' } | { kind: 'tab'; id: string; title: string } | { kind: 'conn'; id: ConnectorId }): void {
    const pop = el<HTMLElement>('opts-pop');
    const actions = el<HTMLDivElement>('opts-actions');
    const title = el('opts-title');
    actions.innerHTML = '';
    const add = (label: string, fn: () => void): void => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      bindGaze(b);
      b.onclick = () => { fn(); this.closeOptions(); };
      actions.append(b);
    };
    if (ctx.kind === 'tab') {
      title.textContent = ctx.title;
      add(`Remove “${ctx.title}”`, () => {
        this.panes.close(ctx.id);
        this.setStatus(`Closed ${ctx.title}`);
      });
      add('Add tab', () => this.addBlankTab());
    } else if (ctx.kind === 'conn') {
      const name = ctx.id === 'web' ? 'Web' : `${ctx.id[0].toUpperCase()}${ctx.id.slice(1)} · demo`;
      title.textContent = 'Connect';
      add(this.connectors[ctx.id] ? `Disconnect ${name}` : `Connect ${name}`, () => this.toggleConnector(ctx.id));
    } else {
      title.textContent = 'Options';
      add('Add tab', () => this.addBlankTab());
      const f = this.panes.focused();
      if (f) add(`Remove “${f.title}”`, () => {
        this.panes.close(f.id);
        this.setStatus(`Closed ${f.title}`);
      });
    }
    (['web', 'calendar', 'mail', 'notes'] as ConnectorId[]).forEach((id) => {
      const name = id === 'web' ? 'Web' : `${id[0].toUpperCase()}${id.slice(1)} · demo`;
      add(this.connectors[id] ? `${name} · on` : `Connect ${name}`, () => this.toggleConnector(id));
    });
    pop.hidden = !!this.xrOn;
    this.optsPanel.title = title.textContent || 'Options';
    this.drawWorldBtn(this.optsPanel);
    this.setVis(this.optsPanel, true);
    this.setVis(this.optsAddBtn, true);
    this.setVis(this.optsDismissBtn, true);
  }

  private closeOptions(): void {
    el<HTMLElement>('opts-pop').hidden = true;
    this.setVis(this.optsPanel, false);
    this.setVis(this.optsAddBtn, false);
    this.setVis(this.optsDismissBtn, false);
  }

  private toggleConnector(id: ConnectorId): void {
    if (!id) return;
    this.connectors[id] = !this.connectors[id];
    saveConnectors(this.connectors);
    this.paintConnectors();
    const on = this.connectors[id];
    const label = id[0].toUpperCase() + id.slice(1);
    this.setStatus(
      on
        ? (id === 'web'
          ? 'Connected Web · public pages only'
          : `Connected ${label} · demo stub (no OAuth)`)
        : `${label} disconnected`,
    );
    this.setSpeech(
      on
        ? (id === 'web'
          ? 'Web connected — send a URL or tap Web. Public fetch into a tab only.'
          : `${label} connected (demo) — no real account tokens.`)
        : `${label} off.`,
    );
  }

  private paintConnectors(): void {
    document.querySelectorAll<HTMLButtonElement>('#connectors [data-conn]').forEach((b) => {
      const id = (b.dataset.conn || '') as ConnectorId;
      const on = !!this.connectors[id];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (id === 'web') b.textContent = on ? 'Web · on' : 'Web';
      else {
        const name = id[0].toUpperCase() + id.slice(1);
        b.textContent = on ? `${name} · demo` : `${name === 'Calendar' ? 'Cal' : name} · demo`;
      }
    });
  }

  private syncTabUi(): void {
    const list = el<HTMLDivElement>('tab-list');
    list.innerHTML = '';
    const listed = this.panes.listed();
    for (const p of listed) {
      const row = document.createElement('div');
      row.className = 'tab-item' + (p.focused ? ' active' : '') + (this.workPaused() ? ' paused' : '');
      row.dataset.id = p.id;
      const sel = document.createElement('button');
      sel.type = 'button';
      sel.className = 'tab-select';
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = tabIcon(p.id);
      const cap = paneCaption(p.title, p.id);
      const textWrap = document.createElement('span');
      textWrap.className = 'tab-text';
      const head = document.createElement('span');
      head.className = 'tab-heading';
      head.textContent = cap.heading;
      textWrap.append(head);
      if (cap.subtitle) {
        const sub = document.createElement('span');
        sub.className = 'tab-sub';
        sub.textContent = cap.subtitle;
        textWrap.append(sub);
      }
      if (this.workPaused()) {
        const tag = document.createElement('span');
        tag.className = 'tab-paused-tag';
        tag.textContent = 'Paused';
        textWrap.append(tag);
      }
      sel.append(icon, textWrap);
      sel.title = p.title;
      sel.setAttribute('aria-label', this.workPaused() ? `${p.title} (paused)` : p.title);
      sel.disabled = this.workPaused();
      bindGazeHold(sel, {
        onClick: () => {
          if (this.workPaused()) return;
          this.panes.focus(p.id);
          this.setStatus(`Focusing ${p.title}`);
        },
        onHold: () => { if (!this.workPaused()) this.openOptions({ kind: 'tab', id: p.id, title: p.title }); },
      });
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.setAttribute('aria-label', `Remove ${p.title}`);
      close.textContent = '×';
      close.disabled = this.workPaused();
      bindGaze(close);
      close.onclick = (ev) => {
        ev.stopPropagation();
        if (this.workPaused()) return;
        row.classList.add('leaving');
        setTimeout(() => {
          this.panes.close(p.id);
          this.setStatus(`Closed ${p.title}`);
        }, 180);
      };
      row.append(sel, close);
      list.append(row);
    }
    el<HTMLButtonElement>('btn-tab-add').disabled = listed.length >= 3;

    for (let i = 0; i < this.tabWorld.length; i++) {
      const b = this.tabWorld[i];
      const p = listed[i];
      this.setVis(b, !!p);
      if (p) {
        const cap = paneCaption(p.title, p.id);
        b.title = cap.heading;
        b.subtitle = this.workPaused() ? 'Paused' : cap.subtitle;
        b.dimmed = this.workPaused();
        b.twin = `.tab-item[data-id="${p.id}"]`;
        b.gazed = false;
        this.drawWorldBtn(b);
      }
    }

    const stage = el<HTMLElement>('pane-stage');
    const empty = el<HTMLElement>('pane-stage-empty');
    const title = el<HTMLElement>('pane-stage-title');
    const sub = document.getElementById('pane-stage-sub') as HTMLElement | null;
    const body = el<HTMLElement>('pane-stage-body');
    const f = this.panes.focused();
    if (!f) {
      empty.hidden = false;
      title.hidden = true;
      if (sub) sub.hidden = true;
      body.hidden = true;
    } else {
      empty.hidden = true;
      title.hidden = false;
      body.hidden = false;
      const cap = paneCaption(f.title, f.id);
      title.textContent = cap.heading;
      if (sub) {
        sub.hidden = !cap.subtitle;
        sub.textContent = cap.subtitle;
      }
      body.textContent = f.body || ' ';
    }
    stage.classList.toggle('dimmed', false);
  }

  private addBlankTab(): void {
    if (this.panes.listed().length >= 3) {
      this.setStatus('You already have 3 tabs — close one with × to add another.');
      return;
    }
    const before = this.panes.snapshot();
    this.tabSeq += 1;
    const id = `tab-${this.tabSeq}`;
    this.panes.open(id, `Tab ${this.tabSeq}`, 'Empty tab — chat to fill.');
    this.pending = { id: `b-${Date.now()}`, speech: '', reason: '', calls: [], before };
    this.setPendingUi(true);
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
    this.world.scene.background = new Color(C.bg);
    if (this.world.scene.fog) (this.world.scene.fog as Fog).color = new Color(C.bg);
    if (redrawWorld) {
      this.panes.redrawAll();
      for (const b of this.buttons.values()) this.drawWorldBtn(b);
    }
  }

  private refreshModeChip(): void {
    const live = hasLiveKey();
    this.mode = live ? 'live' : 'demo';
    const chip = el<HTMLDivElement>('mode-chip');
    chip.textContent = live
      ? 'Live chat — tabs only, not website control'
      : 'Demo Steward · offline — no API key';
    chip.dataset.mode = this.mode;
  }

  private setStatus(s: string): void {
    const short = shortenStatus(s);
    const node = el<HTMLDivElement>('status-line');
    if (node) node.textContent = short;
    if (this.xrStatus) {
      this.xrStatus.title = short;
      this.drawWorldBtn(this.xrStatus);
    }
  }

  private paintSession(): void {
    el<HTMLDivElement>('session').textContent =
      `Did ${this.stats.did} · Kept ${this.stats.kept}` +
      (this.undidCount ? ` · Undid ${this.undidCount}` : '');
    saveStats(this.stats);
  }

  private setSpeech(s: string): void {
    el<HTMLDivElement>('speech').textContent = s;
    speakHud(s);
  }

  private setReason(s: string): void {
    el<HTMLDivElement>('reason').textContent = s ? s : '';
  }

  private setPendingUi(_on: boolean): void {
    this.refreshKeepUndo();
  }

  private refreshKeepUndo(): void {
    const canKeep = !!this.pending || this.panes.listed().length > 0;
    const canUndo = !!this.pending || !!this.lastKeepBefore;
    const keepEl = document.getElementById('btn-keep') as HTMLButtonElement | null;
    const undoEl = document.getElementById('btn-undo') as HTMLButtonElement | null;
    if (keepEl) keepEl.disabled = !canKeep;
    if (undoEl) undoEl.disabled = !canUndo;
    if (this.keepBtn) {
      this.keepBtn.dimmed = !canKeep;
      this.keepBtn.wantVisible = true;
      this.keepBtn.label.mesh.visible = !!this.xrOn;
      this.drawWorldBtn(this.keepBtn);
    }
    if (this.undoBtn) {
      this.undoBtn.dimmed = !canUndo;
      this.undoBtn.wantVisible = true;
      this.undoBtn.label.mesh.visible = !!this.xrOn;
      this.drawWorldBtn(this.undoBtn);
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
    this.setStatus(`Steer: ${text.slice(0, 18)}`);
    this.setSpeech('Working…');
    this.setReason('');
    try {
      let speech = '';
      let reason = '';
      let calls: ToolCall[] = [];
      let usedDemo = true;

      if (hasLiveKey()) {
        this.setStatus('Live chat · calling tools…');
        const summary = this.panes.listed().map((p) => `${p.id}:${p.title}`).join(', ');
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
          this.setSpeech(`Live chat failed — Demo Steward taking over.`);
          this.setStatus('Live failed → Demo Steward · offline twin');
          await sleep(400);
        }
      }

      if (usedDemo) {
        this.mode = 'demo';
        this.refreshModeChip();
        this.setStatus('Demo Steward · offline twin — applying tab plan');
        const plan = demoPlan(text, this.panes.listed().map((p) => p.id), { connectors: this.connectors });
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
    this.stats.did += 1;
    this.paintSession();
    this.setPendingUi(true);
    this.setStatus(
      `Pending Keep all · ${this.panes.listed().length} tab${this.panes.listed().length === 1 ? '' : 's'}`,
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
          this.panes.open('brief', `${service} · Connect`, `Tap ${service} · Connect (demo — no OAuth).`);
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
        const existing = this.panes.listed().find((p) => p.id === id);
        this.setStatus(`Closing ${existing?.title || id || 'tab'}…`);
        this.panes.close(id);
        break;
      }
      case 'focus_pane': {
        const id = a.id || '';
        const existing = this.panes.listed().find((p) => p.id === id);
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
        this.setStatus(a.summary || 'Step complete — Keep all or Undo last');
        break;
      default:
        break;
    }
  }

  private ensurePaneSlot(preferId: string): void {
    if (this.panes.listed().find((p) => p.id === preferId)) return;
    if (this.panes.listed().length < 3) return;
    const victim =
      this.panes.listed().find((p) => p.id === 'done') ||
      this.panes.listed().find((p) => !p.focused) ||
      this.panes.listed()[0];
    if (victim) {
      this.setStatus(`Making room — closing ${victim.title}`);
      this.panes.close(victim.id);
    }
  }

  private async execOpenWeb(url: string, titleHint?: string): Promise<void> {
    if (!isConnected('web', this.connectors)) {
      this.setStatus('Web · Connect needed');
      this.panes.open('brief', 'Web · Connect', 'Tap Web first.\nPublic pages only — no account login.');
      this.panes.focus('brief');
      return;
    }
    this.ensurePaneSlot('web');
    this.setStatus(`Opening ${url}…`);
    const offline = this.mode === 'demo' || !navigator.onLine || !hasLiveKey();
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
    const hasPanes = this.panes.listed().length > 0;
    if (!this.pending && !hasPanes) return;
    sfxClick();
    const current = this.panes.snapshot();
    if (this.pending) {
      this.lastKeepBefore = this.pending.before;
      this.pending = null;
    } else {
      this.lastKeepBefore = this.lastCommitted ?? [];
    }
    this.lastCommitted = current;
    this.stats.kept += 1;
    this.paintSession();
    this.setPendingUi(false);
    this.panes.pulseKeepFocus(700);
    const stage = el<HTMLElement>('pane-stage');
    stage.classList.add('dimmed', 'kept');
    setTimeout(() => stage.classList.remove('dimmed', 'kept'), 700);
    this.setSpeech('Kept all. Ready for the next ask.');
    this.setReason('');
    this.setStatus('Kept all — ready');
  }

  undo(): void {
    if (!this.pending && !this.lastKeepBefore) return;
    sfxWhoosh();
    this.panes.pulseUndo();
    if (this.pending) {
      this.panes.restore(this.pending.before);
      this.pending = null;
      this.undidCount += 1;
      this.paintSession();
      this.setPendingUi(false);
      this.setSpeech('Undone — tabs restored.');
      this.setReason('');
      this.setStatus('Undid pending — tabs restored');
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
      this.setStatus('Undid last Keep — tabs restored.');
    }
  }

  async runDemoTour(): Promise<void> {
    if (this.busy) return;
    const cold = el<HTMLElement>('cold-start');
    if (!cold.hidden) this.beginOnboarding();
    this.showGuide(-1);
    for (const p of [...this.panes.listed()]) this.panes.close(p.id);
    this.pending = null;
    this.lastKeepBefore = null;
    this.setPendingUi(false);
    this.setStatus('Demo tour · chat drives tabs');
    this.setSpeech('Demo tour — open tabs, Keep all, Undo last, then a Web demo.');
    await sleep(600);

    await this.handleIntent('Prep call');
    await sleep(1400);
    if (this.pending) {
      this.setSpeech('Keep all — accepting these tabs.');
      this.setStatus('Tour · Keep all');
      this.flashWorldBtn('keep');
      await sleep(600);
      this.keep();
    }
    await sleep(700);

    this.connectors.web = true;
    saveConnectors(this.connectors);
    this.paintConnectors();
    await this.handleIntent('Lookup https://example.com');
    await sleep(1400);
    if (this.pending) {
      this.setSpeech('Keep all — Web pane kept.');
      this.flashWorldBtn('keep');
      await sleep(500);
      this.keep();
    }
    await sleep(600);

    await this.handleIntent('Park this');
    await sleep(1200);
    if (this.pending || this.lastKeepBefore) {
      this.setSpeech('Undo last — restoring tabs.');
      this.setStatus('Tour · Undo last');
      this.flashWorldBtn('undo');
      await sleep(600);
      this.undo();
    }
    await sleep(500);
    this.setSpeech('Tour done — chat dock, tabs, Connectors. No characters.');
    this.setStatus('Tour done · offline twin');
    this.refreshKeepUndo();
  }

  private bindXrSelect(): void {
    const xr = (this.world as unknown as { renderer?: { xr?: { getSession?: () => { addEventListener: (e: string, fn: () => void) => void } | null } } }).renderer?.xr;
    const session = xr?.getSession?.();
    if (!session) return;
    session.addEventListener('selectstart', () => {
      for (const b of this.buttons.values()) {
        if (b.gazed || b.entity.hasComponent(Hovered)) {
          b.selectHeld = true;
          if (!b.pressAt) { b.pressAt = performance.now(); b.held = false; }
        }
      }
    });
    session.addEventListener('selectend', () => {
      for (const b of this.buttons.values()) b.selectHeld = false;
    });
  }

  private buildQuizWorld(): void {
    this.quizPanel = this.makeWorldBtn('quiz-panel', 'Quiz Game Mode', [0, 1.56, -1.12], () => {}, { w: 1.10, h: 0.46 });
    this.setVis(this.quizPanel, false);
    const spots: [number, number, number][] = [
      [-0.40, 1.16, -1.12], [0.40, 1.16, -1.12],
      [-0.40, 0.98, -1.12], [0.40, 0.98, -1.12],
    ];
    spots.forEach((pos, i) => {
      const b = this.makeWorldBtn(`quiz-ans-${i}`, `Option ${i + 1}`, pos, () => this.answerQuiz(i), { w: 0.38, h: 0.14 });
      this.setVis(b, false);
      this.quizAnswers.push(b);
    });
    const lives: LifelineId[] = ['hint', 'expert', 'fifty', 'star', 'friend'];
    const labels = ['Hint', 'Expert', '50:50', 'Star', 'Video Call'];
    const xs = [-0.54, -0.27, 0, 0.27, 0.54];
    lives.forEach((id, i) => {
      const b = this.makeWorldBtn(`quiz-life-${id}`, labels[i], [xs[i], 0.70, -1.12], () => this.useQuizLife(id), { w: 0.26, h: 0.20 });
      if (id === 'friend') b.subtitle = 'a Friend';
      this.setVis(b, false);
      this.quizLives.push(b);
    });
    this.quizFriendBtn = this.makeWorldBtn('quiz-friend', 'Practice friend', [0, 1.16, -0.78], () => {}, { w: 0.52, h: 0.20 });
    this.setVis(this.quizFriendBtn, false);
  }

  enterBreak(): void {
    if (this.quiz.phase !== 'off' && this.quiz.phase !== 'end') return;
    this.workPause = this.panes.snapshot();
    this.quiz.pausedTabs = this.workPause.length;
    this.quiz.reset();
    this.panes.root.visible = false;
    this.setQuizWorldVis(true);
    this.syncTabUi();
    this.paintQuiz();
    this.setStatus('Quiz Game Mode · 60s, then tabs return');
    this.setSpeech('Quiz Game Mode: a 60-second productivity game. Pane Steward pauses your tabs and puts them back exactly where you left them.');
  }

  beginBreak(): void {
    if (this.quiz.phase !== 'start') return;
    this.quiz.begin();
    this.setStatus('Quiz Game Mode · pick an answer');
    this.paintQuiz();
  }

  showEndCard(): void {
    if (this.quiz.phase === 'off') return;
    this.quiz.end();
    this.syncTabUi();
    this.setQuizWorldVis(false);
    this.setVis(this.quizPanel, true);
    this.paintQuiz();
    this.setStatus(`Back to work: ${this.quiz.pausedTabs} tabs restored.`);
  }

  finishBreak(): void {
    if (this.quiz.phase === 'off') return;
    if (this.quiz.phase !== 'end') this.quiz.end();
    const n = this.workPause?.length ?? this.quiz.pausedTabs;
    this.panes.root.visible = true;
    if (this.workPause) {
      this.panes.restore(this.workPause);
      this.workPause = null;
    }
    this.setQuizWorldVis(false);
    this.refreshKeepUndo();
    this.quiz.phase = 'off';
    this.syncTabUi();
    this.paintQuiz();
    this.setStatus(`Back to work: ${n} tabs restored.`);
    this.setSpeech(`Back to work: ${n} tabs restored.`);
  }

  answerQuiz(i: number): void {
    if (this.quizHold) return;
    const r = this.quiz.answer(i);
    if (!r) return;
    this.quizHold = true;
    this.quiz.pauseClock();
    document.querySelectorAll<HTMLButtonElement>('#quiz-choices button').forEach((b, n) => {
      b.classList.toggle('ans-ok', r.correct && n === i);
      b.classList.toggle('ans-bad', !r.correct && n === i);
      b.disabled = true;
    });
    this.showQuizFeedback(r);
    this.setStatus(r.correct ? `Correct · Lv ${this.quiz.level}` : 'Wrong');
    window.setTimeout(() => {
      this.quizHold = false;
      this.quiz.resumeClock();
      if (r.done || this.quiz.phase === 'end') this.showEndCard();
      else this.paintQuiz();
    }, 2500);
  }

  useQuizLife(id: LifelineId): void {
    const msg = this.quiz.useLifeline(id);
    if (!msg) return;
    this.setStatus(id === 'friend' ? 'Video Call a Friend' : msg.slice(0, 32));
    if (this.quiz.phase === 'end') this.showEndCard();
    else this.paintQuiz();
  }

  private showQuizFeedback(r: { correct: boolean; points: number; leveled: boolean; newLevel: number }): void {
    if (r.correct) sfxCorrect();
    else sfxWrong();
    const fb = document.getElementById('quiz-feedback');
    const mark = fb?.querySelector('.quiz-mark');
    const word = fb?.querySelector('.quiz-word');
    const pop = document.getElementById('quiz-points-pop');
    const chip = document.getElementById('quiz-level-chip');
    if (fb) {
      fb.hidden = false;
      fb.classList.toggle('ok', r.correct);
      fb.classList.toggle('bad', !r.correct);
    }
    if (mark) mark.textContent = r.correct ? '✓' : '✗';
    if (word) word.textContent = r.correct ? 'Correct' : 'Wrong';
    if (pop) pop.textContent = r.correct && r.points ? `+${r.points}` : '';
    if (chip) {
      chip.hidden = !r.leveled;
      chip.textContent = r.leveled ? `Level ${r.newLevel}!` : '';
    }
    const box = document.getElementById('quiz-choices');
    const chosen = box?.querySelectorAll('button');
    // flashed in paint just before timeout by class on last clicked; handled by caller via event
    void chosen;
  }

  private workPaused(): boolean {
    return this.quiz.phase === 'start' || this.quiz.phase === 'question';
  }

  private setQuizWorldVis(on: boolean): void {
    const playing = on && this.quiz.phase === 'question';
    this.setVis(this.quizPanel, on);
    for (const b of this.quizAnswers) this.setVis(b, playing);
    for (const b of this.quizLives) this.setVis(b, playing);
    const friendOn = playing && (this.quiz.friendThinking || !!this.quiz.friendReveal);
    this.setVis(this.quizFriendBtn, friendOn);
    if (on) {
      for (const b of this.buttons.values()) {
        if (b.kind.startsWith('conn-')) this.setVis(b, false);
      }
    } else {
      for (const b of this.buttons.values()) {
        if (b.kind.startsWith('conn-')) {
          b.wantVisible = true;
          b.label.mesh.visible = !!this.xrOn;
        }
      }
      this.refreshKeepUndo();
    }
  }

  private paintQuizMeta(): void {
    const meta = document.getElementById('quiz-meta');
    if (this.quiz.phase !== 'question') return;
    const left = this.quiz.sessionLeft();
    const sec = Math.ceil(left / 1000);
    const frac = Math.max(0, Math.min(1, left / this.quiz.sessionMs));
    if (meta) meta.textContent = `Lv ${this.quiz.level} · ${this.quiz.score} pts · streak ${this.quiz.streak}`;
    const num = document.getElementById('quiz-timer-num');
    if (num) num.textContent = String(sec);
    const ring = document.getElementById('quiz-ring') as unknown as SVGCircleElement | null;
    if (ring) ring.style.strokeDashoffset = String(100 - frac * 100);
    const wrap = document.getElementById('quiz-timer');
    if (wrap) wrap.classList.toggle('amber', sec <= 10);
    const timer = document.getElementById('quiz-timer');
    if (timer) timer.setAttribute('aria-label', `${sec} seconds left`);
    if (this.quizPanel && this.quiz.phase === 'question') {
      const q = this.quiz.current();
      this.quizPanel.title = q ? q.prompt : 'Quiz Game Mode';
      this.quizPanel.subtitle = `${sec}s · ${this.quiz.score} pts`;
      this.drawWorldBtn(this.quizPanel);
    }
  }

  private paintQuiz(): void {
    const root = document.getElementById('quiz-root');
    const start = document.getElementById('quiz-start');
    const play = document.getElementById('quiz-play');
    const end = document.getElementById('quiz-end');
    if (!root || !start || !play || !end) return;
    const on = this.quiz.phase !== 'off';
    root.hidden = !on;
    start.hidden = this.quiz.phase !== 'start';
    play.hidden = this.quiz.phase !== 'question';
    end.hidden = this.quiz.phase !== 'end';
    if (this.quiz.phase === 'question') {
      const q = this.quiz.current();
      this.paintQuizMeta();
      const prompt = document.getElementById('quiz-prompt');
      if (prompt && q) prompt.textContent = q.prompt;
      const box = document.getElementById('quiz-choices');
      if (box && q) {
        box.innerHTML = '';
        q.choices.forEach((c, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = c;
          b.disabled = this.quiz.hidden.has(i);
          bindGaze(b);
          b.onclick = () => this.answerQuiz(i);
          box.append(b);
        });
      }
      const fb = document.getElementById('quiz-feedback');
      if (fb) fb.hidden = true;
      document.querySelectorAll<HTMLButtonElement>('#quiz-lives [data-life]').forEach((b) => {
        const id = (b.dataset.life || '') as LifelineId;
        const used = !!this.quiz.used[id];
        b.disabled = used;
        b.classList.toggle('used', used);
      });
      const help = document.getElementById('quiz-help');
      if (help) {
        help.hidden = !this.quiz.help;
        help.textContent = this.quiz.help;
      }
      const friend = document.getElementById('quiz-friend');
      const fs = document.getElementById('quiz-friend-status');
      const fp = document.getElementById('quiz-friend-pick');
      if (friend) friend.hidden = !(this.quiz.friendThinking || this.quiz.friendReveal);
      if (fs) fs.textContent = this.quiz.friendThinking ? 'Thinking…' : '';
      if (fp) fp.textContent = this.quiz.friendReveal;
      this.quizAnswers.forEach((b, i) => {
        if (q) {
          b.title = q.choices[i];
          b.dimmed = this.quiz.hidden.has(i);
          this.drawWorldBtn(b);
        }
        this.setVis(b, true);
      });
      this.quizLives.forEach((b) => {
        const id = b.kind.replace('quiz-life-', '') as LifelineId;
        b.dimmed = this.quiz.used[id];
        if (id === 'friend') {
          b.title = 'Video Call';
          b.subtitle = 'a Friend';
        }
        this.drawWorldBtn(b);
        this.setVis(b, true);
      });
      this.quizPanel.title = q ? q.prompt : 'Quiz Game Mode';
      this.quizPanel.subtitle = `${Math.ceil(this.quiz.sessionLeft() / 1000)}s · ${this.quiz.score} pts`;
      this.drawWorldBtn(this.quizPanel);
      this.setVis(this.quizPanel, true);
      const friendOn = !!(this.quiz.friendThinking || this.quiz.friendReveal);
      this.quizFriendBtn.title = 'Practice friend · offline pick';
      this.quizFriendBtn.subtitle = this.quiz.friendReveal || (this.quiz.friendThinking ? 'Thinking…' : '');
      this.drawWorldBtn(this.quizFriendBtn);
      this.setVis(this.quizFriendBtn, friendOn);
    }
    if (this.quiz.phase === 'end') {
      const pts = document.getElementById('quiz-end-points');
      if (pts) pts.textContent = String(this.quiz.score);
      const score = document.getElementById('quiz-end-score');
      if (score) score.textContent = 'points';
      const meta = document.getElementById('quiz-end-meta');
      if (meta) meta.textContent = `Level ${this.quiz.level} · best streak ${this.quiz.bestStreak} · ${this.quiz.history.length} played`;
      const facts = document.getElementById('quiz-facts');
      if (facts) {
        const picked = this.quiz.history.slice(-3);
        facts.innerHTML = picked.map((h) => `<p>Did you know: ${h.q.fact}</p>`).join('') || '<p>No questions played.</p>';
      }
      const back = document.getElementById('quiz-end-backline');
      if (back) back.textContent = `Back to work: ${this.quiz.pausedTabs} tabs restored.`;
    }
    if (this.quiz.phase === 'start') {
      this.quizPanel.title = 'Quiz Game Mode';
      this.quizPanel.subtitle = '60-second game';
      this.drawWorldBtn(this.quizPanel);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function countWrapLines(g: CanvasRenderingContext2D, s: string, size: number, maxW: number): number {
  g.font = `700 ${size}px ${FONT}`;
  let lines = 0;
  let line = '';
  for (const w of (s || ' ').split(/\s+/).filter(Boolean)) {
    if (g.measureText(`${line}${w} `).width > maxW && line) {
      lines += 1;
      line = `${w} `;
    } else {
      line += `${w} `;
    }
  }
  if (line.trim()) lines += 1;
  return Math.max(1, lines);
}

function hideStrayEnterXr(): void {
  document.querySelectorAll('button').forEach((b) => {
    if (b.id !== 'btn-enter' && /^enter xr$/i.test((b.textContent || '').trim())) {
      b.style.setProperty('display', 'none', 'important');
    }
  });
}

function drawLifeIcon(g: CanvasRenderingContext2D, id: string, x: number, y: number, s: number, color: string): void {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(4, s * 0.12);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const r = s / 2;
  if (id === 'hint') {
    g.beginPath();
    g.arc(0, -r * 0.15, r * 0.55, Math.PI * 0.15, Math.PI * 0.85, true);
    g.stroke();
    g.beginPath();
    g.moveTo(-r * 0.22, r * 0.45);
    g.lineTo(r * 0.22, r * 0.45);
    g.moveTo(-r * 0.14, r * 0.68);
    g.lineTo(r * 0.14, r * 0.68);
    g.stroke();
  } else if (id === 'expert') {
    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(0, -r * 0.7);
    g.lineTo(r, 0);
    g.lineTo(0, r * 0.35);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(-r * 0.55, r * 0.15);
    g.lineTo(-r * 0.55, r * 0.55);
    g.quadraticCurveTo(0, r * 0.9, r * 0.55, r * 0.55);
    g.lineTo(r * 0.55, r * 0.15);
    g.stroke();
  } else if (id === 'fifty') {
    g.beginPath();
    g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -r * 0.85);
    g.lineTo(0, r * 0.85);
    g.stroke();
  } else if (id === 'star') {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      const ox = Math.cos(a) * r * 0.75;
      const oy = Math.sin(a) * r * 0.75;
      if (i === 0) g.moveTo(ox, oy);
      else g.lineTo(ox, oy);
      const b = a + Math.PI / 5;
      g.lineTo(Math.cos(b) * r * 0.32, Math.sin(b) * r * 0.32);
    }
    g.closePath();
    g.stroke();
  } else {
    g.beginPath();
    g.roundRect(-r * 0.75, -r * 0.4, r * 0.95, r * 0.8, 8);
    g.stroke();
    g.beginPath();
    g.moveTo(r * 0.28, -r * 0.15);
    g.lineTo(r * 0.75, -r * 0.4);
    g.lineTo(r * 0.75, r * 0.4);
    g.lineTo(r * 0.28, r * 0.15);
    g.closePath();
    g.stroke();
  }
  g.restore();
}
