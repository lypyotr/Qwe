// Crypto-core tests: boot index.html in headless Chromium and exercise the
// app's ACTUAL in-page crypto (msgEncrypt/msgDecrypt over an ECDH-derived
// AES-GCM key, and genRecovery) — round-trip, tamper-detection, wrong-key
// rejection, and recovery-code format/uniqueness. Runs in the browser so it
// tests the real WebCrypto code paths the app ships, not a re-implementation.
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

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof msgEncrypt === 'function' && typeof msgDecrypt === 'function' && typeof genRecovery === 'function', null, { timeout: 15000 });

const results = await page.evaluate(async () => {
  const out = [];
  const check = (name, cond) => out.push({ name, ok: !!cond });
  const sub = window.crypto.subtle;

  // Two ECDH P-256 identities → the shared AES-GCM conversation key (as msgConvKey does).
  const mkPair = () => sub.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const convKey = (priv, pubRaw) => sub.importKey('raw', pubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    .then(pub => sub.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));

  const a = await mkPair(), b = await mkPair(), c = await mkPair();
  const aPubRaw = new Uint8Array(await sub.exportKey('raw', a.publicKey));
  const bPubRaw = new Uint8Array(await sub.exportKey('raw', b.publicKey));
  const cPubRaw = new Uint8Array(await sub.exportKey('raw', c.publicKey));

  const keyAB = await convKey(a.privateKey, bPubRaw);   // A's view of the A↔B key
  const keyBA = await convKey(b.privateKey, aPubRaw);   // B's view of the same key
  const keyAC = await convKey(a.privateKey, cPubRaw);   // an unrelated key

  const FAIL = '🔒 не удалось расшифровать';   // MSG_DECRYPT_FAIL marker

  // 1. Round-trip: what A encrypts, B decrypts.
  const msg = 'Привет 👋 secret 12345';
  const packed = await msgEncrypt(keyAB, msg);
  check('packed format m1.<iv>.<ct>', /^m1\.[^.]+\.[^.]+$/.test(packed));
  check('round-trip A→B', (await msgDecrypt(keyBA, packed)) === msg);

  // 2. Wrong key cannot decrypt (returns the marker, never throws).
  check('wrong key rejected', (await msgDecrypt(keyAC, packed)) === FAIL);

  // 3. Tampered ciphertext is rejected (AES-GCM auth tag).
  const parts = packed.split('.');
  const ctB = atob(parts[2]); const arr = Uint8Array.from(ctB, ch => ch.charCodeAt(0));
  arr[0] ^= 0x01; parts[2] = btoa(String.fromCharCode(...arr));
  check('tamper rejected', (await msgDecrypt(keyBA, parts.join('.'))) === FAIL);

  // 4. Recovery-code format (Crockford-ish, no I/O/0/1) + uniqueness.
  const re = /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/;
  const seen = new Set(); let allFmt = true;
  for (let i = 0; i < 50; i++) { const r = genRecovery(); if (!re.test(r)) allFmt = false; seen.add(r); }
  check('recovery-code format', allFmt);
  check('recovery-code uniqueness', seen.size === 50);

  return out;
});

await browser.close();
server.close();

let failed = false;
for (const r of results) {
  console.log((r.ok ? 'PASS' : 'FAIL') + ': ' + r.name);
  if (!r.ok) failed = true;
}
if (!results.length) { console.error('FAIL: no crypto assertions ran'); failed = true; }
if (failed) process.exit(1);
console.log(`crypto tests OK: ${results.length} assertions`);
