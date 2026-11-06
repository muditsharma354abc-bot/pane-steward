#!/usr/bin/env node
/** Capture demo frames for README / judging. Requires playwright in iwsdk-test nm. */
import { chromium } from '../../iwsdk-test/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../screens/pane-steward');
fs.mkdirSync(outDir, { recursive: true });
const U = process.env.U || 'https://localhost:8082/pane-steward/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(U + '?demo=1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(outDir, '01-cold.png') });

await page.evaluate(() => document.getElementById('btn-enter')?.click());
await page.waitForTimeout(5000);
await page.screenshot({ path: path.join(outDir, '02-xr.png') });

// wait for autoplay Keep
await page.waitForTimeout(8000);
await page.screenshot({ path: path.join(outDir, '03-demo-tour.png') });

console.log(JSON.stringify({ outDir, errs }, null, 2));
await browser.close();
process.exit(errs.length ? 1 : 0);
