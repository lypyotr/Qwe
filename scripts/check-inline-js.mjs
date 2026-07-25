// Static checks for the inline <script> in index.html.
// Catches the class of failure that once took the whole app down: a syntax
// error (e.g. a duplicated function declaration) makes the browser drop the
// ENTIRE script, leaving a dead page of static HTML.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('index.html', 'utf8');

const match = html.match(/(?:^|\r?\n)<script>\r?\n([\s\S]*?)\r?\n<\/script>(?=\r?\n|$)/);
if (!match || match.index === undefined) {
  console.error('inline <script> block not found in index.html');
  process.exit(1);
}
const js = match[1];
const baseLine = html.slice(0, match.index).split(/\r?\n/).length + 1;

// 1. Full parse via node --check.
const tmp = path.join(os.tmpdir(), 'inline-check.js');
fs.writeFileSync(tmp, js);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  console.error('SYNTAX ERROR in inline script (line numbers are offset by ' + baseLine + ' in index.html):');
  console.error(String(e.stderr));
  process.exit(1);
}

// 2. Duplicate top-level function declarations — valid JS when balanced, but
// almost always a botched merge (and unbalanced ones already died above).
const seen = new Map();
let dupes = 0;
for (const m of js.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
  const name = m[1];
  const line = js.slice(0, m.index).split('\n').length + baseLine;
  if (seen.has(name)) {
    console.error(`DUPLICATE function ${name}() at index.html:${line} (first at :${seen.get(name)})`);
    dupes++;
  } else {
    seen.set(name, line);
  }
}
if (dupes) process.exit(1);

console.log(`inline script OK: parses cleanly, ${seen.size} top-level functions, no duplicates`);
