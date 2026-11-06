#!/usr/bin/env node
/** Capture demo frames for README / judging. Requires playwright in iwsdk-test nm. */
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
    const n = document.getElementById(elId);
    if (!n) throw new Error('missing ' + elId);
    n.click();
  }, id);
};

const clickChip = async (intent) => {
  await page.evaluate((i) => {
    const n = document.querySelector(`#chips [data-intent="${i}"]`);
    if (!n) throw new Error('missing chip ' + i);
    n.click();
  }, intent);
};

await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#chips', { timeout: 30000 });
await page.waitForTimeout(2200);

// 1) chips + 5) demo badge — cold HUD (chat + chips + mode chip)
await shot('chips.png');
await shot('demo-badge.png');

// Drive panes WITHOUT immersive so DOM Keep/Undo + mode chip stay in frame
await clickChip('prep');
await page.waitForFunction(() => {
  const keep = document.getElementById('btn-keep');
  return !!(keep && !keep.disabled);
}, { timeout: 25000 }).catch((e) => errs.push('wait keep: ' + e.message));
await page.waitForTimeout(1800);

await shot('panes-3.png');
await shot('keep.png');

await clickId('btn-keep');
await page.waitForTimeout(1000);
await clickChip('park');
await page.waitForFunction(() => {
  const undo = document.getElementById('btn-undo');
  return !!(undo && !undo.disabled);
}, { timeout: 25000 }).catch((e) => errs.push('wait undo: ' + e.message));
await page.waitForTimeout(1600);

await shot('undo.png');

// Extra XR frame for spatial panes (judging likes world view)
await clickId('btn-keep'); // clear pending if still
await page.waitForTimeout(400);
await clickChip('prep');
await page.waitForFunction(() => {
  const keep = document.getElementById('btn-keep');
  return !!(keep && !keep.disabled);
}, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(800);
await clickId('btn-enter');
await page.waitForTimeout(4500);
await shot('panes-3-xr.png');

const files = [
  'chips.png',
  'panes-3.png',
  'keep.png',
  'undo.png',
  'demo-badge.png',
  'panes-3-xr.png',
];
const sizes = Object.fromEntries(
  files.map((f) => {
    const fp = path.join(outDir, f);
    return [f, fs.existsSync(fp) ? fs.statSync(fp).size : 0];
  }),
);
const hud = await page.evaluate(() => ({
  mode: document.getElementById('mode-chip')?.textContent,
  speech: document.getElementById('speech')?.textContent,
  reason: document.getElementById('reason')?.textContent,
  keepDisabled: document.getElementById('btn-keep')?.disabled,
  undoDisabled: document.getElementById('btn-undo')?.disabled,
}));
console.log(JSON.stringify({ outDir, U, sizes, hud, errs: errs.slice(0, 30) }, null, 2));
await browser.close();
process.exit(0);
