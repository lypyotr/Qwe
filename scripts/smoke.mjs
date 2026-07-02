// Smoke test: serve the repo, open index.html in headless Chromium and make
// sure the app actually boots — the inline script runs to the end, no
// uncaught errors, the CSP doesn't block our own code, and the auth screen
// comes up. Network to Supabase may fail in CI; that must not fail the boot.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(process.cwd(), req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

// CHROMIUM_PATH lets environments with a pre-installed browser skip the
// playwright-managed download (CI leaves it unset).
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);

const state = await page.evaluate(() => ({
  scriptRan: typeof switchPage === 'function' && typeof loadFriends === 'function',
  supabaseLib: typeof supabase !== 'undefined',
  clientCreated: typeof sbClient !== 'undefined' && !!sbClient,
  authOverlayShown: (() => {
    const el = document.getElementById('authOverlay');
    return !!el && !el.classList.contains('hidden');
  })(),
  authDiag: (document.getElementById('authDiag') || {}).textContent || '',
}));

await browser.close();
server.close();

let failed = false;
const fail = m => { console.error('FAIL:', m); failed = true; };

if (!state.scriptRan) fail('inline script did not execute to the end (SyntaxError or CSP block?)');
if (pageErrors.length) fail('uncaught page errors:\n  ' + pageErrors.join('\n  '));
// If the CDN was reachable the client must exist; if not, the app must have
// shown the explicit CDN error instead of hanging silently.
if (state.supabaseLib && !state.clientCreated) fail('supabase-js loaded but the client was not created');
if (!state.supabaseLib && !/CDN/i.test(state.authDiag)) fail('supabase-js missing and no CDN error surfaced');
if (!state.authOverlayShown) fail('auth overlay never appeared (no stored session in a fresh browser)');

if (failed) process.exit(1);
console.log('smoke OK:', JSON.stringify(state));
