#!/usr/bin/env node
/** Clean contest XR frames: programmatic IWER (no gizmos/DevUI), product HUD on top. */
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

const shot = async (name) => {
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log('wrote', p, fs.statSync(p).size);
};

const clickId = async (id) => {
  await page.evaluate((elId) => {
    document.getElementById(elId)?.click();
  }, id);
};

const clickChip = async (intent) => {
  await page.evaluate((i) => {
    document.querySelector(`#chips [data-intent="${i}"]`)?.click();
  }, intent);
};

const cleanChrome = async () => {
  return page.evaluate(() => {
    const w = window;
    const notes = [];

    // 1) Programmatic mode → DevUI hides Header/Controls; gizmos not drawn
    try {
      if (w.IWER_DEVICE) {
        w.IWER_DEVICE.controlMode = 'programmatic';
        notes.push('controlMode=programmatic');
      }
    } catch (e) {
      notes.push('controlMode err ' + e);
    }

    // 2) Force-hide transform handles (RGB axes)
    try {
      w.transformHandles?.forEach((h) => {
        h.visible = false;
      });
      notes.push('transformHandles hidden');
    } catch {}

    // 3) Disconnect emulated hands/controllers so wireframe hands drop
    try {
      const d = w.IWER_DEVICE;
      if (d) {
        for (const side of ['left', 'right']) {
          if (d.hands?.[side]) d.hands[side].connected = false;
          if (d.controllers?.[side]) d.controllers[side].connected = false;
        }
        notes.push('inputs disconnected');
      }
    } catch (e) {
      notes.push('disconnect err ' + e);
    }

    // 4) Hide DevUI shadow host + any "Remote Control Active" chrome
    for (const el of document.querySelectorAll('body > div, [data-webxr_runtime] div')) {
      const sr = el.shadowRoot;
      if (sr) {
        el.style.setProperty('display', 'none', 'important');
        notes.push('hid shadow host');
      }
    }
    // Walk open shadow roots for Remote Control text
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

    // 5) Soften IWER runtime blue border if present (outline/box-shadow on container)
    const rt = document.querySelector('[data-webxr_runtime]');
    if (rt) {
      rt.style.boxShadow = 'none';
      rt.style.outline = 'none';
      rt.style.border = 'none';
      // keep scene canvases; hide non-canvas chrome children that aren't the app canvas
      for (const c of [...rt.children]) {
        if (c.tagName !== 'CANVAS') {
          // empty overlay divs often hold pointer lock UI
          if (!(c.shadowRoot) && !(c.textContent || '').trim()) {
            // leave structure; just kill pointer chrome
            c.style.boxShadow = 'none';
          }
        }
      }
    }

    // 6) Product HUD above IWER (z-index 999)
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
};

await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#chips', { timeout: 30000 });
await page.waitForTimeout(1600);

await clickId('btn-enter');
await page.waitForTimeout(4500);
console.log('clean1', await cleanChrome());
await page.waitForTimeout(600);
console.log('clean1b', await cleanChrome()); // re-apply after a frame
await page.waitForTimeout(400);

await shot('clean-cold-start.png');
await shot('clean-demo-badge.png');

await clickChip('prep');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, {
  timeout: 25000,
}).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(1800);
await cleanChrome();
await page.waitForTimeout(400);

await shot('clean-panes.png');
await shot('clean-keep.png');

await clickId('btn-keep');
await page.waitForTimeout(900);
await clickChip('park');
await page.waitForFunction(() => !document.getElementById('btn-undo')?.disabled, {
  timeout: 25000,
}).catch((e) => errs.push('wait undo: ' + e.message));
await page.waitForTimeout(1500);
await cleanChrome();
await page.waitForTimeout(400);

await shot('clean-undo.png');

const files = [
  'clean-cold-start.png',
  'clean-panes.png',
  'clean-keep.png',
  'clean-undo.png',
  'clean-demo-badge.png',
];
const sizes = Object.fromEntries(
  files.map((f) => [f, fs.existsSync(path.join(outDir, f)) ? fs.statSync(path.join(outDir, f)).size : 0]),
);
const hud = await page.evaluate(() => ({
  mode: document.getElementById('mode-chip')?.textContent,
  speech: document.getElementById('speech')?.textContent,
  reason: document.getElementById('reason')?.textContent,
  controlMode: window.IWER_DEVICE?.controlMode,
  keepDisabled: document.getElementById('btn-keep')?.disabled,
  undoDisabled: document.getElementById('btn-undo')?.disabled,
}));
console.log(JSON.stringify({ outDir, sizes, hud, errs: errs.slice(0, 20) }, null, 2));
await browser.close();
process.exit(0);
