/**
 * Browser QA for the activity layer: labels within 40 px of their markers,
 * at most 6 labels on a phone at world zoom, a card that opens at peek with
 * its spot above it, and ?spot= deep links. Screenshots go to the out dir.
 *
 *   npm run build && npm start &
 *   node scripts/activities/qa-globe.mjs /tmp/shots phone
 *   node scripts/activities/qa-globe.mjs /tmp/shots desk
 *   node scripts/activities/qa-globe.mjs /tmp/shots phone '?spot=aspen-snowmass-us'
 */
import { chromium } from 'playwright';
const out = process.argv[2]; const wide = process.argv[3] === 'desk';
const deep = process.argv[4] || '';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: wide ? { width: 1440, height: 900 } : { width: 390, height: 844 }, isMobile: !wide, hasTouch: !wide, deviceScaleFactor: wide ? 1 : 2, geolocation: { latitude: 41.2565, longitude: -95.9345 }, permissions: ['geolocation'], timezoneId: 'America/Chicago' });
await ctx.addInitScript(() => { try { localStorage.setItem('meridian.lens.v1', 'world'); } catch {} });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const t = wide ? 'd' : 'p';
await page.goto((process.env.BASE_URL ?? 'http://localhost:3000') + '/' + deep, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);
const world = page.locator('#world-map');
if (await world.count()) await world.scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/spot-${t}-1${deep ? '-deep' : ''}.png` });

// Label drift: every visible label's left edge within 40 px of its marker.
const drift = async () => page.evaluate(() => {
  const res = [];
  for (const b of document.querySelectorAll('button[data-mx]')) {
    if (b.style.display === 'none') continue;
    const r = b.getBoundingClientRect(); const host = b.parentElement.getBoundingClientRect();
    const mx = Number(b.dataset.mx) + host.left, my = Number(b.dataset.my) + host.top;
    const text = b.querySelector('span:last-child').getBoundingClientRect();
    const dx = Math.min(Math.abs(text.left - mx), Math.abs(text.right - mx));
    const dy = Math.abs((text.top + text.bottom) / 2 - my);
    res.push({ id: b.dataset.id, d: Math.round(Math.hypot(dx, dy)) });
  }
  return res;
});
console.log(t, 'labels', JSON.stringify(await drift()));

if (!deep) {
  const label = page.locator('button[data-mx]:visible').first();
  if (await label.count()) {
    const name = await label.getAttribute('aria-label');
    await label.click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/spot-${t}-card.png` });
    console.log(t, 'opened', name, 'url', page.url());
    const sel = await page.evaluate(() => { const s = document.querySelector('button[data-mx][class*="sel"]'); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, bottom: r.bottom }; });
    const card = await page.locator('aside[role="dialog"]').boundingBox();
    console.log(t, 'selected label', JSON.stringify(sel), 'card', JSON.stringify(card));
    if (!wide) {
      await page.locator('aside[role="dialog"] [role="button"]').first().click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/spot-${t}-half.png` });
      await page.locator('aside[role="dialog"] [role="button"]').first().click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/spot-${t}-full.png` });
    } else {
      await page.locator('aside[role="dialog"] > div').last().evaluate((el) => el.scrollTo(0, 600));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${out}/spot-${t}-scroll.png` });
    }
  }
} else {
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/spot-${t}-deep-card.png` });
  const card = await page.locator('aside[role="dialog"]').boundingBox();
  const sel = await page.evaluate(() => { const s = document.querySelector('button[data-mx][class*="sel"]'); if (!s) return null; return { mx: s.dataset.mx, my: s.dataset.my }; });
  console.log(t, 'deep card', JSON.stringify(card), 'sel', JSON.stringify(sel));
}
console.log(t, 'errors', errors.slice(0, 5));
await browser.close();
