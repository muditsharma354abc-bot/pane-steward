#!/usr/bin/env node
/** Clean XR frame: hoodie duo + panes, no IWER gizmos / no procedural steward. */
import { chromium } from '../../iwsdk-test/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../screens/pane-steward');
fs.mkdirSync(outDir, { recursive: true });
const base = (process.env.U || 'https://localhost:8082/pane-steward/').replace(/\?.*$/, '');
const U = base.endsWith('/') ? base : base + '/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(String(e.message || e)));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text());
});

const cleanChrome = async () => page.evaluate(() => {
  const w = window;
  const notes = [];
  try {
    if (w.IWER_DEVICE) {
      w.IWER_DEVICE.controlMode = 'programmatic';
      notes.push('controlMode=programmatic');
    }
  } catch (e) { notes.push('controlMode err ' + e); }
  try {
    w.transformHandles?.forEach((h) => { h.visible = false; });
    notes.push('transformHandles hidden');
  } catch {}
  try {
    const d = w.IWER_DEVICE;
    if (d) {
      for (const side of ['left', 'right']) {
        if (d.hands?.[side]) d.hands[side].connected = false;
        if (d.controllers?.[side]) d.controllers[side].connected = false;
      }
      notes.push('inputs disconnected');
    }
  } catch (e) { notes.push('disconnect err ' + e); }
  for (const el of document.querySelectorAll('body > div, [data-webxr_runtime] div')) {
    if (el.shadowRoot) {
      el.style.setProperty('display', 'none', 'important');
      notes.push('hid shadow host');
    }
  }
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      const t = (el.textContent || '').trim();
      if (/Remote Control Active/i.test(t) && t.length < 40) {
        el.style.setProperty('display', 'none', 'important');
        notes.push('hid remote badge');
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const rt = document.querySelector('[data-webxr_runtime]');
  if (rt) {
    rt.style.boxShadow = 'none';
    rt.style.outline = 'none';
    rt.style.border = 'none';
  }
  for (const id of ['mode-chip', 'privacy', 'top-bar', 'hud']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.zIndex = '10000';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    if (id === 'hud') el.style.display = 'flex';
    el.style.pointerEvents = 'auto';
  }
  return notes;
});

await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#chips', { timeout: 30000 });
await page.waitForTimeout(1800);

await page.evaluate(() => document.getElementById('btn-enter')?.click());
await page.waitForTimeout(5000);
await cleanChrome();
await page.waitForTimeout(700);
await cleanChrome();

await page.evaluate(() => document.querySelector('#chips [data-intent="prep"]')?.click());
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, {
  timeout: 25000,
}).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(2200);
await cleanChrome();

// Reveal duo: shrink screen HUD that sits over billboards; keep mode chip + short speech
await page.evaluate(() => {
  const speech = document.getElementById('speech');
  if (speech) {
    speech.textContent = 'Hoodie duo — prep panes ready.';
    speech.style.padding = '4px 12px';
    speech.style.fontSize = '15px';
    speech.style.maxWidth = '420px';
  }
  for (const id of ['chips', 'keep-row', 'chat-bar', 'session', 'reason']) {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('display', 'none', 'important');
  }
  // nudge privacy / top-bar less noisy for hero frame
  const priv = document.getElementById('privacy');
  if (priv) priv.style.opacity = '0.35';
});

// Scale character billboards ~1.8x so claymation reads in 1280 screenshot
const scaled = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  let scaled = 0;
  // Scale hoodie glTF roots / legacy cutout planes for screenshot readability
  const tryRoot = (obj, depth = 0) => {
    if (!obj || depth > 30) return;
    if (obj.isMesh && obj.material?.map && obj.geometry?.type === 'PlaneGeometry') {
      const w = obj.geometry.parameters?.width ?? 0;
      if (w > 0.2 && w < 0.5) {
        obj.scale.set(1.85, 1.85, 1);
        scaled++;
      }
    }
    // glTF character roots named HoodieMale / HoodieFemale
    if (obj.name === 'HoodieMale' || obj.name === 'HoodieFemale') {
      obj.scale.setScalar((obj.scale?.x || 1) * 1.55);
      scaled++;
    }
    for (const c of obj.children || []) tryRoot(c, depth + 1);
  };
  // IWSDK / three often stash scene on renderer
  const gl = canvases[0]?.getContext?.('webgl2') || canvases[0]?.getContext?.('webgl');
  // Fallback: search window for Object3D roots
  const seen = new Set();
  const hunt = (v, d = 0) => {
    if (!v || d > 6 || typeof v !== 'object') return;
    if (seen.has(v)) return;
    try { seen.add(v); } catch { return; }
    if (v.isScene || (v.isObject3D && v.type === 'Scene')) tryRoot(v);
    if (v.scene?.isScene) tryRoot(v.scene);
    // limited key walk
    const keys = Object.keys(v).slice(0, 40);
    for (const k of keys) {
      try { hunt(v[k], d + 1); } catch {}
    }
  };
  hunt(window);
  return scaled;
});
console.log('scaled planes', scaled);

await page.waitForTimeout(700);
await cleanChrome();
// re-hide HUD pieces after cleanChrome (it sets hud display flex)
await page.evaluate(() => {
  for (const id of ['chips', 'keep-row', 'chat-bar', 'session', 'reason']) {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('display', 'none', 'important');
  }
});
await page.waitForTimeout(400);

const probe = await page.evaluate(() => ({
  loadedHoodie: performance.getEntriesByType('resource').some((r) => /hoodie-(duo|male|female)\.(png|glb|jpg)/i.test(r.name)),
  controlMode: window.IWER_DEVICE?.controlMode,
  speech: document.getElementById('speech')?.textContent,
}));
console.log('probe', JSON.stringify(probe));

const out = path.join(outDir, 'clean-duo.png');
await page.screenshot({ path: out, fullPage: false });
console.log('wrote', out, fs.statSync(out).size);
console.log(JSON.stringify({ errs: errs.slice(0, 15) }));
await browser.close();
process.exit(0);
