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

const cleanChrome = async () => page.evaluate(() => {
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
  for (const id of ['mode-chip', 'status-line', 'top-bar', 'tab-rail', 'pane-stage', 'chat-dock', 'cold-start', 'guide', 'opts-pop']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.zIndex = '10000';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
  }
});

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
});

await page.waitForTimeout(300);
await cleanChrome();
await shot('light-connectors.png');

await page.click('#chips [data-intent="prep"]');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(1600);
await cleanChrome();
await shot('light-panes.png');
await shot('light-keep.png');

// Gaze highlight on the active tab
const tabSel = '.tab-item.active, .tab-item';
await page.hover('.tab-item .tab-select').catch((e) => errs.push('hover tab: ' + e.message));
await page.evaluate(() => {
  document.querySelector('.tab-item')?.classList.add('gaze');
});
await cleanChrome();
await shot('light-gaze.png');
await page.evaluate(() => document.querySelector('.tab-item')?.classList.remove('gaze'));

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
await page.click('#chips [data-intent="web"]');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait web: ' + e.message));
await page.waitForTimeout(2200);
await cleanChrome();
await shot('light-web.png');

await forceClick('#btn-keep');
await page.waitForTimeout(600);
await page.click('#chips [data-intent="park"]');
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
await browser.close();
process.exit(errs.some((e) => e.startsWith('wait ')) ? 1 : 0);
