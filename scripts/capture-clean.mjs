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
const U = (base.endsWith('/') ? base : base + '/');

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
  for (const id of ['mode-chip', 'status-line', 'privacy', 'top-bar', 'tab-rail', 'pane-stage', 'chat-dock']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.zIndex = '10000';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
  }
});

await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#chat-dock', { timeout: 30000 });
await page.waitForTimeout(1800);
await cleanChrome();
await page.waitForTimeout(400);

await shot('clean-cold-start.png');
await shot('clean-demo-badge.png');

await page.click('#chips [data-intent="prep"]');
await page.waitForFunction(() => !document.getElementById('btn-keep')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(1600);
await cleanChrome();
await shot('clean-panes.png');
await shot('clean-keep.png');

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
await shot('clean-web.png');

await forceClick('#btn-keep');
await page.waitForTimeout(600);
await page.click('#chips [data-intent="park"]');
await page.waitForFunction(() => !document.getElementById('btn-undo')?.disabled, { timeout: 25000 }).catch((e) => errs.push('wait undo: ' + e.message));
await page.waitForTimeout(1400);
await cleanChrome();
await shot('clean-undo.png');

const hud = await page.evaluate(() => ({
  mode: document.getElementById('mode-chip')?.textContent,
  status: document.getElementById('status-line')?.textContent,
  tabs: [...document.querySelectorAll('.tab-item .tab-select')].map((b) => b.textContent),
  connectors: [...document.querySelectorAll('#connectors button')].map((b) => b.textContent),
  stageTitle: document.getElementById('pane-stage-title')?.textContent,
  hasCharacterAsset: /hoodie-(male|female)|StewardCharacter|claymation duo/i.test(document.body.innerText),
  dockRight: getComputedStyle(document.getElementById('chat-dock')).right,
  railLeft: getComputedStyle(document.getElementById('tab-rail')).left,
}));
console.log(JSON.stringify({ hud, errs: errs.slice(0, 20) }, null, 2));
await browser.close();
process.exit(errs.some((e) => e.startsWith('wait ')) ? 1 : 0);
