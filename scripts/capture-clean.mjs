#!/usr/bin/env node
/** Clean contest frames: right chat dock, left vertical tabs, no characters, connectors + status. */
import { chromium } from '../../iwsdk-test/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../screens/pane-steward');
const repoScreens = path.resolve(__dirname, '../screens');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(repoScreens, { recursive: true });
const base = (process.env.U || 'https://localhost:8082/pane-steward/').replace(/\?.*$/, '');
const U = (base.endsWith('/') ? base : base + '/') + '?demo=0';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(String(e.message || e)));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text());
});

const shot = async (name) => {
  for (const dir of [outDir, repoScreens]) {
    const p = path.join(dir, name);
    await page.screenshot({ path: p, fullPage: false });
    console.log('wrote', p, fs.statSync(p).size);
  }
};

const clickId = async (id) => {
  await page.evaluate((elId) => document.getElementById(elId)?.click(), id);
};
const clickChip = async (intent) => {
  await page.evaluate((i) => {
    document.querySelector(`#chips [data-intent="${i}"]`)?.click();
  }, intent);
};
const clickConn = async (id) => {
  await page.evaluate((c) => {
    document.querySelector(`#connectors [data-conn="${c}"]`)?.click();
  }, id);
};

const cleanChrome = async () => page.evaluate(() => {
  const notes = [];
  try {
    if (window.IWER_DEVICE) {
      window.IWER_DEVICE.controlMode = 'programmatic';
      notes.push('controlMode=programmatic');
      for (const side of ['left', 'right']) {
        if (window.IWER_DEVICE.hands?.[side]) window.IWER_DEVICE.hands[side].connected = false;
        if (window.IWER_DEVICE.controllers?.[side]) window.IWER_DEVICE.controllers[side].connected = false;
      }
    }
  } catch (e) { notes.push(String(e)); }
  try { window.transformHandles?.forEach((h) => { h.visible = false; }); } catch {}
  for (const el of document.querySelectorAll('body > div')) {
    if (el.shadowRoot) el.style.setProperty('display', 'none', 'important');
  }
  for (const id of ['mode-chip', 'status-line', 'privacy', 'top-bar', 'tab-rail', 'pane-stage', 'chat-dock']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.zIndex = '10000';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
  }
  return notes;
});

await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#chat-dock', { timeout: 30000 });
await page.waitForTimeout(1200);
await cleanChrome();
await page.waitForTimeout(400);

await shot('clean-cold-start.png');
await shot('clean-demo-badge.png');

await clickChip('prep');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(1600);
await cleanChrome();
await shot('clean-panes.png');
await shot('clean-keep.png');

await clickId('btn-keep');
await page.waitForTimeout(700);

await clickConn('web');
await page.waitForTimeout(400);
await clickChip('web');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait web: ' + e.message));
await page.waitForTimeout(2000);
await cleanChrome();
await shot('clean-web.png');

await clickId('btn-keep');
await page.waitForTimeout(500);
await clickChip('park');
await page.waitForFunction(() => !document.getElementById('btn-undo')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait undo: ' + e.message));
await page.waitForTimeout(1200);
await cleanChrome();
await shot('clean-undo.png');

const hud = await page.evaluate(() => ({
  mode: document.getElementById('mode-chip')?.textContent,
  status: document.getElementById('status-line')?.textContent,
  tabs: [...document.querySelectorAll('.tab-item .tab-select')].map((b) => b.textContent),
  connectors: [...document.querySelectorAll('#connectors button')].map((b) => b.textContent),
  hasCharacterText: /hoodie|character mesh|duo/i.test(document.body.innerText),
  dockRight: getComputedStyle(document.getElementById('chat-dock')).right,
  railLeft: getComputedStyle(document.getElementById('tab-rail')).left,
}));
console.log(JSON.stringify({ hud, errs: errs.slice(0, 20) }, null, 2));
await browser.close();
process.exit(0);
