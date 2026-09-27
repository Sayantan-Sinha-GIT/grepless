// Browser sweep: every page × both themes × phone + desktop.
// Flags console errors, failed requests, broken images, sideways overflow and
// unlabelled buttons, and checks the theme toggle and mobile menu work.
//
//   node scripts/qa-sweep.mjs [baseUrl] [--shots dir]
//
// Uses the locally installed Chrome through playwright-core (no browser download).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:3000').replace(/\/$/, '');
const shotsIdx = process.argv.indexOf('--shots');
const shots = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/explore', name: 'explore' },
  { path: '/how-it-works', name: 'how' },
  { path: '/r/sindresorhus/ky?q=merge%20headers', name: 'repo-search', waitFor: 'article' },
  { path: '/me', name: 'me' },
  { path: '/this-page-does-not-exist', name: '404', expectStatus: 404 },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844, mobile: true },
];
const THEMES = ['light', 'dark'];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const problems = [];
let checks = 0;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: theme,
      isMobile: !!vp.mobile,
      hasTouch: !!vp.mobile,
    });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('grepless-theme', t);
      } catch {}
    }, theme);

    for (const pg of PAGES) {
      checks++;
      const label = `${pg.name} · ${theme} · ${vp.name}`;
      const page = await ctx.newPage();
      const issues = [];
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (pg.expectStatus === 404 && /status of 404/.test(text)) return;
        issues.push(`console: ${text.slice(0, 200)}`);
      });
      page.on('pageerror', (e) => issues.push(`pageerror: ${e.message.slice(0, 200)}`));
      page.on('response', (r) => {
        const url = r.url();
        if (r.status() >= 400 && !(pg.expectStatus && url.startsWith(base + pg.path.split('?')[0]))) {
          issues.push(`http ${r.status()}: ${url.slice(0, 140)}`);
        }
      });

      const res = await page.goto(base + pg.path, { waitUntil: 'load', timeout: 60_000 }).catch((e) => {
        issues.push(`goto: ${e.message.slice(0, 120)}`);
        return null;
      });
      if (res && (pg.expectStatus ?? 200) !== res.status()) issues.push(`status ${res.status()} (expected ${pg.expectStatus ?? 200})`);
      if (pg.waitFor) await page.waitForSelector(pg.waitFor, { timeout: 45_000 }).catch(() => issues.push(`never showed ${pg.waitFor}`));
      await page.waitForTimeout(1500);

      // Scroll through so lazy content and in-view animations run.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += Math.round(vp.height * 0.8)) {
        await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
        await page.waitForTimeout(90);
      }
      await page.waitForTimeout(600);

      const audit = await page.evaluate(() => {
        const out = [];
        const cw = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > cw + 1) out.push(`sideways overflow: ${document.documentElement.scrollWidth}px > ${cw}px`);
        for (const img of document.images) {
          if (img.complete && img.naturalWidth === 0) out.push(`broken image: ${img.src.slice(0, 100)}`);
        }
        for (const el of document.querySelectorAll('button, a[href]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
          if (!name) out.push(`unlabelled ${el.tagName.toLowerCase()}: ${el.outerHTML.slice(0, 90)}`);
        }
        if (!document.querySelector('h1')) out.push('no <h1>');
        if (document.documentElement.dataset.theme !== undefined && !['light', 'dark'].includes(document.documentElement.dataset.theme)) out.push('bad data-theme');
        return out;
      });
      issues.push(...audit);

      const theme0 = await page.evaluate(() => document.documentElement.dataset.theme);
      if (theme0 !== theme) issues.push(`theme is ${theme0}, expected ${theme}`);

      if (shots) await page.screenshot({ path: `${shots}/${pg.name}-${theme}-${vp.name}.png` });

      // Interactions, once per viewport/theme on the home page.
      if (pg.name === 'home') {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const toggle = page.getByRole('switch', { name: /switch to/i });
        await toggle.click();
        await page.waitForTimeout(1100);
        const flipped = await page.evaluate(() => document.documentElement.dataset.theme);
        if (flipped === theme) issues.push('theme toggle did not change the theme');
        const stored = await page.evaluate(() => localStorage.getItem('grepless-theme'));
        if (stored !== flipped) issues.push('theme choice not remembered');
        await toggle.click();
        await page.waitForTimeout(900);
        if (vp.mobile) {
          await page.getByRole('button', { name: 'Open menu' }).click();
          await page.waitForTimeout(800);
          const menuLinks = await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link').count();
          if (menuLinks < 3) issues.push(`mobile menu shows ${menuLinks} links`);
          await page.getByRole('button', { name: 'Close menu' }).click();
          await page.waitForTimeout(700);
        }
      }

      if (issues.length) problems.push({ label, issues: [...new Set(issues)] });
      console.log(`${issues.length ? '✗' : '✓'} ${label}${issues.length ? `  (${issues.length} issue${issues.length > 1 ? 's' : ''})` : ''}`);
      await page.close();
    }
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${checks - problems.length}/${checks} page checks clean`);
for (const p of problems) {
  console.log(`\n${p.label}`);
  for (const i of p.issues) console.log(`  - ${i}`);
}
process.exit(problems.length ? 1 : 0);
