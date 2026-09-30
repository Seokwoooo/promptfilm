#!/usr/bin/env node
// Assemble a film's parts into one HTML file — the same as build.sh, without a shell (Windows included):
//   node build.mjs [film-dir] [name]        (defaults: this script's folder, then NAME below or the folder's name)
// Order: head, core, the film's scene parts (p3–p6), post, the film's timeline (p8, then p8z_pace.js — the Studio's pace edits),
// the engine, tail — the engine reads what the film defines. Writes <film-dir>/<name>.html.
// Every part runs in ONE module scope: a name declared twice at the top level stops the film at start-up, so the build stops first.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const NAME = 'film';                                            // new_film writes the film's name here

export function build(dir, name) {
  const P = path.join(dir, 'parts'), files = fs.readdirSync(P);
  const pick = re => files.filter(f => re.test(f)).sort();       // plain code-point order, as `ls` in the C locale
  const need = f => { if (!files.includes(f)) throw new Error(`missing parts/${f}`); return f; };
  const js = [need('p2_core.js'), ...pick(/^p[3-6].*\.js$/), need('p7_post.js'), ...pick(/^p8.*\.js$/), need('p9_engine.js')];
  const head = fs.readFileSync(path.join(P, need('p1_head.html')), 'utf8');
  const tail = fs.readFileSync(path.join(P, need('p10_tail.html')), 'utf8');
  const src = js.map(f => [f, fs.readFileSync(path.join(P, f), 'utf8')]);
  // top-level names: imports in the head, declarations at the start of a line in the JS parts (as build.sh reads them)
  const decl = new Map(), add = (n, where) => { if (!n) return; if (!decl.has(n)) decl.set(n, []); decl.get(n).push(where); };
  head.split('\n').forEach((l, i) => {
    let m = /^import \* as ([A-Za-z_$][\w$]*)/.exec(l); if (m) add(m[1], `p1_head.html:${i + 1}`);
    m = /^import \{([^}]*)\}/.exec(l); if (m) m[1].split(',').map(x => x.replace(/.* as /, '').trim()).forEach(n => add(n, `p1_head.html:${i + 1}`));
  });
  for (const [f, text] of src) text.split('\n').forEach((l, i) => {
    const m = /^(?:export )?(?:async )?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/.exec(l); if (m) add(m[1], `${f}:${i + 1}`);
  });
  const dups = [...decl].filter(([, w]) => w.length > 1);
  if (dups.length) throw new Error('these names are declared twice at the top level (all parts share one scope):\n' +
    dups.map(([n, w]) => `  ${n}  ←  ${w.join(', ')}`).join('\n') + '\nrename the film\'s one (e.g. a prefix for the film\'s own constants).');
  const out = path.join(dir, name + '.html');
  fs.writeFileSync(out, head + src.map(([, t]) => t).join('') + tail);
  return { out, bytes: fs.statSync(out).size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dir = path.resolve(process.argv[2] || path.dirname(fileURLToPath(import.meta.url)));
  const name = process.argv[3] || process.env.NAME || (NAME !== 'film' ? NAME : path.basename(dir));
  try { const r = build(dir, name); console.log(`built ${r.out} (${r.bytes} bytes)`); }
  catch (e) { console.error('build stopped: ' + e.message); process.exit(1); }
}
