import { chromium } from 'playwright';
const U = ((process.env.U || 'https://muditsharma354abc-bot.github.io/pane-steward/').replace(/\?.*$/, '').replace(/\/?$/, '/')) + '?demo=1';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
const out = { ok: false, steps: [] };
try {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('#btn-start', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('btn-start')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__ps?.showGuide?.(-1); const g = document.getElementById('guide'); if (g) g.hidden = true; });
  await page.evaluate(() => document.getElementById('btn-demo')?.click());
  await page.waitForFunction(() => (document.getElementById('status-line')?.textContent || '').includes('Tour done'), { timeout: 30000 });
  const afterTour = await page.evaluate(() => ({
    keep: document.getElementById('btn-keep')?.disabled,
    undo: document.getElementById('btn-undo')?.disabled,
    tabs: document.querySelectorAll('.tab-item').length,
    status: document.getElementById('status-line')?.textContent,
  }));
  out.steps.push({ afterTour });
  await page.evaluate(() => document.getElementById('btn-tab-add')?.click());
  await page.waitForTimeout(300);
  const afterOpen = await page.evaluate(() => ({
    keep: document.getElementById('btn-keep')?.disabled,
    undo: document.getElementById('btn-undo')?.disabled,
    tabs: document.querySelectorAll('.tab-item').length,
  }));
  out.steps.push({ afterOpen });
  const keepEnabled = afterOpen.keep === false;
  await page.evaluate(() => document.getElementById('btn-keep')?.click());
  await page.waitForTimeout(400);
  const afterKeep = await page.evaluate(() => ({
    keep: document.getElementById('btn-keep')?.disabled,
    undo: document.getElementById('btn-undo')?.disabled,
    status: document.getElementById('status-line')?.textContent,
    tabs: document.querySelectorAll('.tab-item').length,
  }));
  out.steps.push({ afterKeep });
  await page.evaluate(() => document.getElementById('btn-undo')?.click());
  await page.waitForTimeout(400);
  const afterUndo = await page.evaluate(() => ({
    status: document.getElementById('status-line')?.textContent,
    tabs: document.querySelectorAll('.tab-item').length,
    undo: document.getElementById('btn-undo')?.disabled,
  }));
  out.steps.push({ afterUndo });
  const keepWorked = /Kept all/.test(afterKeep.status || '');
  const undoWorked = /Undid|restored/i.test(afterUndo.status || '');
  out.ok = !!(keepEnabled && keepWorked && undoWorked);
  out.keepEnabledAfterOpen = keepEnabled;
  out.keepWorked = keepWorked;
  out.undoWorked = undoWorked;
} catch (e) {
  out.error = String(e);
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(out.ok ? 0 : 1);
