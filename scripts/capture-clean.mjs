#!/usr/bin/env node
/** Clean light-theme frames, including gaze + long-hold + cold-start guide. */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../screens/pane-steward');
const repoScreens = path.resolve(__dirname, '../screens');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(repoScreens, { recursive: true });
const base = (process.env.U || 'https://localhost:8082/pane-steward/').replace(/\?.*$/, '');
const U = (base.endsWith('/') ? base : base + '/') + '?demo=1';

let browser;
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
} catch {
  const { chromium: cr } = await import('playwright');
  browser = await cr.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(String(e.message || e)));

const shot = async (name) => {
  for (const dir of [outDir, repoScreens]) {
    const p = path.join(dir, name);
    await page.screenshot({ path: p, fullPage: false });
    console.log('wrote', p, fs.statSync(p).size);
  }
};

const forceClick = async (sel) => {
  await page.evaluate((s) => {
    const n = document.querySelector(s);
    if (n) n.click();
  }, sel);
};

const cleanChrome = async () => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
  try {
    if (window.IWER_DEVICE) {
      window.IWER_DEVICE.controlMode = 'programmatic';
      for (const side of ['left', 'right']) {
        if (window.IWER_DEVICE.hands?.[side]) window.IWER_DEVICE.hands[side].connected = false;
        if (window.IWER_DEVICE.controllers?.[side]) window.IWER_DEVICE.controllers[side].connected = false;
      }
    }
  } catch {}
  try { window.transformHandles?.forEach((h) => { h.visible = false; }); } catch {}
  for (const el of document.querySelectorAll('body > div')) {
    if (el.shadowRoot) el.style.setProperty('display', 'none', 'important');
  }
  for (const id of ['mode-chip', 'status-line', 'top-bar', 'tab-rail', 'pane-stage', 'chat-dock', 'cold-start', 'guide', 'opts-pop', 'quiz-root']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.zIndex = id === 'quiz-root' ? '10050' : '10000';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    if (id === 'quiz-root' && !el.hidden) el.style.removeProperty('display');
  }
  });
};

await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#cold-start', { timeout: 30000 });
await page.waitForTimeout(1200);
await cleanChrome();
await page.waitForTimeout(300);
await shot('light-cold-start.png');
await shot('light-demo-badge.png');

await forceClick('#btn-start');
await page.waitForSelector('#guide:not([hidden])', { timeout: 10000 }).catch((e) => errs.push('guide: ' + e.message));
await page.waitForTimeout(400);
await cleanChrome();
await shot('light-coldstart-guide.png');

// Dismiss the guide without finishing it so ?demo=1 does not auto-start the tour.
await page.evaluate(() => {
  const g = document.getElementById('guide');
  if (g) g.hidden = true;
  const c = document.getElementById('cold-start');
  if (c) c.hidden = true;
  document.body.classList.remove('onboarding');
  try { window.__ps?.showGuide?.(-1); } catch {}
});

await page.waitForTimeout(300);
await cleanChrome();
await shot('light-connectors.png');

await forceClick('#btn-more');
await page.waitForTimeout(120);
await forceClick('#chips [data-intent="prep"]');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(1600);
await page.evaluate(() => {
  const b = document.getElementById('btn-more');
  if (b && b.getAttribute('aria-expanded') === 'true') b.click();
});
await page.waitForTimeout(150);
await cleanChrome();
await shot('light-panes.png');

await forceClick('#btn-keep');
await page.waitForTimeout(280);
await cleanChrome();
await shot('light-keep.png');

// Gaze highlight after cleanChrome so pointerleave does not clear it
await cleanChrome();
await page.evaluate(() => {
  document.querySelectorAll('.tab-item')[1]?.classList.add('gaze');
  document.querySelector('#connectors [data-conn="calendar"]')?.classList.add('gaze');
});
await shot('light-gaze.png');
await page.evaluate(() => document.querySelectorAll('.gaze').forEach((n) => n.classList.remove('gaze')));

// Long-hold options popover
await page.evaluate(() => {
  const tab = document.querySelector('.tab-item .tab-select');
  if (!tab) return;
  tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
});
await page.waitForTimeout(700);
await page.waitForSelector('#opts-pop:not([hidden])', { timeout: 4000 }).catch((e) => errs.push('longhold: ' + e.message));
await cleanChrome();
await shot('light-longhold.png');
await forceClick('#opts-dismiss');
await page.waitForTimeout(200);

await forceClick('#btn-keep');
await page.waitForTimeout(800);

await page.click('#connectors [data-conn="web"]');
await page.waitForFunction(
  () => document.querySelector('#connectors [data-conn="web"]')?.getAttribute('aria-pressed') === 'true',
  { timeout: 8000 },
).catch((e) => errs.push('web conn: ' + e.message));
await page.waitForTimeout(400);
await page.evaluate(() => {
  const closes = [...document.querySelectorAll('.tab-item .tab-close')];
  if (closes.length >= 3) closes[closes.length - 1].click();
});
await page.waitForTimeout(400);
await forceClick('#btn-more');
await forceClick('#chips [data-intent="web"]');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait web: ' + e.message));
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const b = document.getElementById('btn-more');
  if (b && b.getAttribute('aria-expanded') === 'true') b.click();
});
await page.waitForTimeout(150);
await cleanChrome();
await shot('light-web.png');

await forceClick('#btn-keep');
await page.waitForTimeout(600);
await forceClick('#btn-more');
await forceClick('#chips [data-intent="park"]');
await page.waitForFunction(() => !document.getElementById('btn-undo')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait undo: ' + e.message));
await page.waitForTimeout(1400);
await cleanChrome();
await shot('light-undo.png');

const hud = await page.evaluate(() => ({
  mode: document.getElementById('mode-chip')?.textContent,
  status: document.getElementById('status-line')?.textContent,
  tabs: [...document.querySelectorAll('.tab-item .tab-select')].map((b) => b.textContent),
  connectors: [...document.querySelectorAll('#connectors button')].map((b) => b.textContent),
  stageTitle: document.getElementById('pane-stage-title')?.textContent,
  hasCharacterAsset: /hoodie-(male|female)|StewardCharacter|claymation duo/i.test(document.body.innerText),
  dockRight: getComputedStyle(document.getElementById('chat-dock')).right,
  railLeft: getComputedStyle(document.getElementById('tab-rail')).left,
  coldHidden: document.getElementById('cold-start')?.hidden,
}));
console.log(JSON.stringify({ hud, errs: errs.slice(0, 20) }, null, 2));


// 2D Break Quiz frames (tabs already open from the light flow)
try {
  await page.evaluate(() => { document.getElementById('quiz-root')?.style.removeProperty('display'); });
  await forceClick('#btn-break');
  await page.waitForSelector('#quiz-root:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(300);
  await cleanChrome();
  await shot('quiz-start.png');
  await forceClick('#quiz-begin');
  await page.waitForSelector('#quiz-play:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(300);
  await cleanChrome();
  await shot('quiz-question.png');
  await cleanChrome();
  await shot('quiz-lifelines.png');
  await forceClick('#quiz-lives [data-life="friend"]');
  await page.waitForTimeout(10500);
  await cleanChrome();
  await shot('quiz-friend.png');

  const clickAnswer = async (wantCorrect) => page.evaluate((wantCorrect) => {
    const q = window.__ps?.quiz?.current?.();
    if (!q) return false;
    const btns = [...document.querySelectorAll('#quiz-choices button')];
    let idx = q.answer;
    if (!wantCorrect) {
      idx = q.choices.findIndex((_, n) => n !== q.answer);
      if (idx < 0) idx = (q.answer + 1) % Math.max(btns.length, 1);
    }
    if (btns[idx]) btns[idx].click();
    return true;
  }, wantCorrect);

  await clickAnswer(false);
  await page.waitForTimeout(320);
  await cleanChrome();
  await shot('quiz-wrong.png');
  await page.waitForTimeout(2700);

  await clickAnswer(true);
  await page.waitForTimeout(280);
  await cleanChrome();
  await shot('quiz-feedback.png');
  await shot('quiz-levelup.png');
  await page.waitForTimeout(2700);

  for (let i = 0; i < 14; i++) {
    const info = await page.evaluate(() => ({
      ended: window.__ps?.quiz?.phase === 'end',
      left: window.__ps?.quiz?.sessionLeft?.() ?? 0,
    }));
    if (info.ended || info.left <= 12000) break;
    await clickAnswer(i % 3 !== 0);
    await page.waitForTimeout(3800);
  }
  await page.waitForFunction(() => {
    const end = document.getElementById('quiz-end');
    if (end && !end.hidden) return true;
    const n = parseInt(document.getElementById('quiz-timer-num')?.textContent || '99', 10);
    return n <= 10 && !document.getElementById('quiz-play')?.hidden;
  }, { timeout: 120000 }).catch((e) => errs.push('quiz-amber wait: ' + e.message));
  const playOn = await page.evaluate(() => {
    const play = document.getElementById('quiz-play');
    return !!(play && !play.hidden);
  });
  if (playOn) {
    await cleanChrome();
    await shot('quiz-amber.png');
  } else {
    errs.push('quiz-amber: play card already gone');
  }
  await page.waitForFunction(() => {
    const end = document.getElementById('quiz-end');
    return !!(end && !end.hidden);
  }, { timeout: 40000 }).catch((e) => errs.push('quiz-end wait: ' + e.message));
  await page.waitForTimeout(250);
  await cleanChrome();
  await shot('quiz-end.png');
  await forceClick('#quiz-back');
  await page.waitForTimeout(400);
} catch (e) {
  errs.push('quiz2d: ' + e.message);
}

const hideHudForXr = async (keepHands = false) => {
  await page.evaluate((keepHands) => {
    try {
      if (window.IWER_DEVICE) {
        window.IWER_DEVICE.controlMode = 'programmatic';
        if (!keepHands) {
          for (const side of ['left', 'right']) {
            if (window.IWER_DEVICE.hands?.[side]) window.IWER_DEVICE.hands[side].connected = false;
          }
        }
      }
    } catch {}
    const hideHost = (root) => {
      root.querySelectorAll('*').forEach((node) => {
        if (node.shadowRoot) hideHost(node.shadowRoot);
        const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (t === 'Remote Control Active' || (t.includes('Remote Control Active') && t.length < 48)) {
          node.style.setProperty('display', 'none', 'important');
        }
      });
    };
    hideHost(document);
    for (const el of document.querySelectorAll('body > div')) {
      if (el.shadowRoot) el.style.setProperty('display', 'none', 'important');
    }
    for (const id of ['top-bar', 'tab-rail', 'pane-stage', 'chat-dock', 'cold-start', 'guide', 'opts-pop', 'quiz-root']) {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    }
    const sc = document.getElementById('scene-container');
    if (sc) {
      sc.style.zIndex = '1';
      sc.style.display = 'block';
      sc.style.visibility = 'visible';
    }
    const quiz = document.getElementById('quiz-root');
    if (quiz) quiz.style.setProperty('display', 'none', 'important');
  }, keepHands);
};

const xrNote = { entered: false, hovered: false, held: false, detail: '' };

try {
  await forceClick('#btn-enter');
  await page.waitForTimeout(3500);
  const presenting = await page.evaluate(() => {
    const w = window.__psWorld || window.__ps?.world;
    return !!(w?.renderer?.xr?.isPresenting || window.IWER_DEVICE);
  });
  xrNote.entered = !!presenting;
  await hideHudForXr();
  await page.waitForTimeout(800);
  await shot('light-xr-panes.png');

  // Try IWER hover on a visible world twin
  const hover = await page.evaluate(async () => {
    const ps = window.__ps;
    const d = window.IWER_DEVICE;
    if (!ps || !d) return { ok: false, why: 'no __ps or IWER' };
    d.primaryInputMode = 'hand';
    d.controlMode = 'programmatic';
    const list = [...(ps.buttons?.values?.() || [])];
    const target = list.find((b) => b.label?.mesh?.visible && (b.kind?.startsWith('tab') || b.kind === 'keep' || b.kind.startsWith('intent'))) || list.find((b) => b.label?.mesh?.visible);
    if (!target) return { ok: false, why: 'no visible world btn', kinds: list.map((b) => [b.kind, !!b.label?.mesh?.visible]) };
    const m = target.label.mesh;
    m.updateMatrixWorld();
    const V = m.position.constructor;
    const pos = m.getWorldPosition(new V());
    const n = new V(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new m.quaternion.constructor()));
    const R = d.hands?.right;
    if (!R) return { ok: false, why: 'no right hand' };
    if (R.connected === false) R.connected = true;
    try { R.poseId = 'point'; } catch {}
    for (let i = 0; i <= 18; i++) {
      const dd = 0.22 - 0.10 * (i / 18);
      if (R.setPin) R.setPin({ anchor: 'index-tip', target: [pos.x + n.x * dd, pos.y + n.y * dd, pos.z + n.z * dd] });
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => setTimeout(r, 200));
    return { ok: !!target.gazed || !!target.entity?.hasComponent, gazed: !!target.gazed, kind: target.kind };
  });
  xrNote.detail = JSON.stringify(hover);
  xrNote.hovered = !!(hover && hover.gazed);
  await hideHudForXr(true);
  await page.waitForTimeout(250);
  await shot('light-xr-gaze.png');

  const held = await page.evaluate(async () => {
    const ps = window.__ps;
    const d = window.IWER_DEVICE;
    if (!ps || !d?.hands?.right) return { ok: false, why: 'missing' };
    const list = [...(ps.buttons?.values?.() || [])];
    const target = list.find((b) => b.hold && b.label?.mesh?.visible) || list.find((b) => b.kind?.startsWith('tab') && b.label?.mesh?.visible);
    if (!target) return { ok: false, why: 'no holdable' };
    const m = target.label.mesh;
    m.updateMatrixWorld();
    const V = m.position.constructor;
    const pos = m.getWorldPosition(new V());
    const n = new V(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new m.quaternion.constructor()));
    const R = d.hands.right;
    if (R.connected === false) R.connected = true;
    if (R.setPin) R.setPin({ anchor: 'index-tip', target: [pos.x + n.x * 0.04, pos.y + n.y * 0.04, pos.z + n.z * 0.04] });
    target.selectHeld = true;
    if (!target.pressAt) { target.pressAt = performance.now(); target.held = false; }
    if (R.updatePinchValue) R.updatePinchValue(1);
    await new Promise((r) => setTimeout(r, 750));
    const pop = document.getElementById('opts-pop');
    const worldOpen = !!target && (window.__ps?.optsPanel?.label?.mesh?.visible);
    const open = (pop && !pop.hidden) || worldOpen;
    if (R.updatePinchValue) R.updatePinchValue(0);
    target.selectHeld = false;
    return { ok: !!open, kind: target.kind, worldOpen, popHidden: !!(pop && pop.hidden) };
  });
  xrNote.held = !!(held && held.ok);
  xrNote.detail += ' | hold ' + JSON.stringify(held);
  await hideHudForXr(true);
  await page.waitForTimeout(400);
  await shot('light-xr-longhold.png');

  const pinchDock = await page.evaluate(async () => {
    const ps = window.__ps;
    const d = window.IWER_DEVICE;
    const list = [...(ps?.buttons?.values?.() || [])];
    const report = {};
    for (const kind of ['keep', 'undo', 'intent-next']) {
      const b = list.find((x) => x.kind === kind);
      report[kind] = { visible: !!b?.label?.mesh?.visible, dimmed: !!b?.dimmed };
    }
    const pinch = async (kind) => {
      const b = list.find((x) => x.kind === kind);
      if (!b?.label?.mesh?.visible) return { kind, ok: false, why: 'not visible' };
      const kept = ps.stats?.kept;
      const m = b.label.mesh;
      m.updateMatrixWorld();
      const V = m.position.constructor;
      const pos = m.getWorldPosition(new V());
      const R = d.hands.right;
      if (R.connected === false) R.connected = true;
      if (R.setPin) R.setPin({ anchor: 'index-tip', target: [pos.x, pos.y, pos.z + 0.05] });
      b.selectHeld = true;
      if (!b.pressAt) b.pressAt = performance.now();
      if (R.updatePinchValue) R.updatePinchValue(1);
      await new Promise((r) => setTimeout(r, 120));
      b.selectHeld = false;
      if (R.updatePinchValue) R.updatePinchValue(0);
      await new Promise((r) => setTimeout(r, 350));
      return { kind, ok: true, visible: true, keptBefore: kept, keptAfter: ps.stats?.kept };
    };
    report.pinchKeep = await pinch('keep');
    report.pinchUndo = await pinch('undo');
    return report;
  });
  xrNote.detail += ' | dock ' + JSON.stringify(pinchDock);
} catch (e) {
  xrNote.detail = String(e);
  errs.push('xr: ' + e.message);
}

// Fresh load for XR cold start (world Start twin, no HTML overlay)
try {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('#cold-start', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await forceClick('#btn-enter');
  await page.waitForTimeout(3500);
  await hideHudForXr();
  await page.waitForTimeout(700);
  await hideHudForXr();
  await page.evaluate(() => {
    const hide = (root) => {
      root.querySelectorAll('*').forEach((node) => {
        if (node.shadowRoot) hide(node.shadowRoot);
        const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (t === 'Remote Control Active' || (t.includes('Remote Control Active') && t.length < 48)) {
          node.style.setProperty('display', 'none', 'important');
        }
      });
    };
    hide(document);
  });
  await page.waitForTimeout(400);
  await shot('light-xr-cold-start.png');
} catch (e) {
  errs.push('xr-cold: ' + e.message);
}

try {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('#cold-start', { timeout: 30000 });
  await forceClick('#btn-start');
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__ps?.showGuide?.(-1); document.getElementById('guide').hidden = true; });
  await forceClick('#btn-more');
  await forceClick('#chips [data-intent="prep"]');
  await page.waitForTimeout(1600);
  await forceClick('#btn-break');
  await forceClick('#quiz-begin');
  await page.waitForTimeout(400);
  await forceClick('#btn-enter');
  await page.waitForTimeout(3500);
  await hideHudForXr();
  await page.waitForTimeout(700);
  await hideHudForXr();
  await page.evaluate(() => {
    const q = document.getElementById('quiz-root');
    if (q) q.style.setProperty('display', 'none', 'important');
    const hide = (root) => {
      root.querySelectorAll('*').forEach((node) => {
        if (node.shadowRoot) hide(node.shadowRoot);
        const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (t === 'Remote Control Active' || (t.includes('Remote Control Active') && t.length < 48)) {
          node.style.setProperty('display', 'none', 'important');
        }
      });
    };
    hide(document);
  });
  await page.waitForTimeout(400);
  await shot('quiz-xr-question.png');
  await page.evaluate(() => {
    const ps = window.__ps;
    const quiz = ps?.quiz;
    if (!quiz?.queue) return;
    const i = quiz.queue.findIndex((q) => q.id === 'd-evaw');
    if (i < 0) return;
    quiz.idx = i;
    if (typeof ps.paintQuiz === 'function') ps.paintQuiz();
  });
  await page.waitForTimeout(350);
  await hideHudForXr();
  await page.evaluate(() => {
    const q = document.getElementById('quiz-root');
    if (q) q.style.setProperty('display', 'none', 'important');
    const hide = (root) => {
      root.querySelectorAll('*').forEach((node) => {
        if (node.shadowRoot) hide(node.shadowRoot);
        const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (t === 'Remote Control Active' || (t.includes('Remote Control Active') && t.length < 48)) {
          node.style.setProperty('display', 'none', 'important');
        }
      });
    };
    hide(document);
  });
  await page.waitForTimeout(300);
  await shot('quiz-xr-long.png');
} catch (e) {
  errs.push('quiz-xr: ' + e.message);
}

console.log('xrNote', JSON.stringify(xrNote));
await browser.close();
process.exit(errs.some((e) => e.startsWith('wait ')) ? 1 : 0);
